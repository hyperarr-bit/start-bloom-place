/**
 * TESTE A/B DOS 2 DESENHOS DO PLANNER 2027 (31/10, pedido do dono: "codex" × "core", meio a meio).
 *   · o sorteio é UM módulo (src/lib/planner-2027-braco.ts): a oferta da /organizar, o Fluxo2027 (/hoje, /inicio) e o app
 *     (Pacote2027 → PlannerB) chamam o mesmo bracoDoPlanner; FNV-1a 32 bits do e-mail normalizado, par = core, ímpar = codex;
 *   · ~50/50 em 1000 e-mails; maiúsculas/espaços caem no mesmo braço; ?planner-estilo= vence; PLANNER_ESTILO fixo = como antes;
 *   · a mesma compradora vê na oferta e recebe no app o mesmo desenho; todo evento do 2027 leva braco_planner;
 *   · chaves off: nenhum evento ganha braco_planner (a página fica a de antes — os hashes travados em planner-2027.test.tsx).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const conta = vi.hoisted(() => ({ email: "ana@exemplo.com" as string | null, id: "u1" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: conta.id, email: conta.email }, isSubscribed: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig()), trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { trackEvent } from "@/lib/analytics";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Pacote2027 } from "@/components/pacote-2027/Pacote2027";
import { CHAVE_PACOTE_2027, CHAVE_DICA_2027 } from "@/lib/pacote-2027";
import { emailDoSorteio, estiloDoHash, fnv1a32, misturar, normalizarEmail, sortearEstilo } from "@/lib/planner-2027-braco";
import { PLANNER_ESTILO, bracoDoPlanner, estiloDoPlanner } from "@/lib/planner-2027-chave";
import { criarUpsell2027 } from "@/landing/upsell-2027";
import { Fluxo2027 } from "@/upsell-2027/Fluxo2027";

const raiz = resolve(__dirname, "../..");
/** conferidos à mão (scratchpad): b@x.com → core; ana@exemplo.com → codex */
const EMAIL_CORE = "b@x.com";
const EMAIL_CODEX = "ana@exemplo.com";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/"); conta.email = "ana@exemplo.com"; conta.id = "u1"; });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/"); document.getElementById("u27-zoom")?.remove(); });

describe("o sorteio (um módulo só)", () => {
  it("FNV-1a 32 bits: os vetores de referência", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
    expect(misturar(0)).toBe(0);
    expect(estiloDoHash("b")).toBe("core");
    expect(estiloDoHash("a")).toBe("codex");
    expect(estiloDoHash(EMAIL_CORE)).toBe("core");
    expect(estiloDoHash(EMAIL_CODEX)).toBe("codex");
  });
  it("o padrão é o teste A/B ('ab')", () => { expect(PLANNER_ESTILO).toBe("ab"); });
  it("~50/50 em 1000 e-mails sintéticos (2 formatos)", () => {
    for (const fazer of [(i: number) => `cliente${i}.${(i * 7919) % 1000}@gmail.com`, (i: number) => `Maria${i}@Hotmail.com`]) {
      let core = 0;
      for (let i = 0; i < 1000; i++) if (sortearEstilo({ email: fazer(i) }).estilo === "core") core++;
      expect(core).toBeGreaterThan(450);
      expect(core).toBeLessThan(550);
    }
  });
  it("por que misturar: só a paridade do FNV-1a puro deixa e-mails vizinhos sempre juntos", () => {
    // "1" e "3" têm a mesma paridade de código: o último bit do FNV-1a puro é igual; o misturado não fica preso a isso
    expect(fnv1a32("maria1@gmail.com") % 2).toBe(fnv1a32("maria3@gmail.com") % 2);
    const lados = new Set(Array.from({ length: 20 }, (_, i) => estiloDoHash(`maria${2 * i + 1}@gmail.com`)));
    expect(lados.size).toBe(2);
  });
  it("e-mail com maiúsculas e espaços cai no mesmo braço; o apelido anônimo (pix-…@) não vale como e-mail", () => {
    for (let i = 0; i < 200; i++) {
      const e = `Pessoa.${i}@Exemplo.COM`;
      expect(sortearEstilo({ email: `  ${e}\t` })).toEqual(sortearEstilo({ email: e.toLowerCase() }));
      expect(bracoDoPlanner({ email: ` ${e.toUpperCase()} ` }, "", "ab")).toEqual(bracoDoPlanner({ email: e.toLowerCase() }, "", "ab"));
    }
    expect(normalizarEmail("  Ana@Exemplo.com ")).toBe("ana@exemplo.com");
    expect(emailDoSorteio("pix-1a2b3c@coreaplicativo.com.br")).toBeNull();
    expect(emailDoSorteio("sem-arroba")).toBeNull();
    expect(sortearEstilo({ email: "pix-1a2b3c@coreaplicativo.com.br", reserva: "b" })).toEqual({ estilo: "core", via: "reserva" });
  });
  it("sem e-mail: a reserva (também ~50/50); sem nada: 'codex' (padrao)", () => {
    expect(sortearEstilo({ email: null, reserva: "a" })).toEqual({ estilo: "codex", via: "reserva" });
    expect(sortearEstilo({})).toEqual({ estilo: "codex", via: "padrao" });
    let core = 0;
    for (let i = 0; i < 1000; i++) if (sortearEstilo({ reserva: `pay_${(i * 104729).toString(36)}` }).estilo === "core") core++;
    expect(core).toBeGreaterThan(450);
    expect(core).toBeLessThan(550);
  });
  it("a força de QA (?planner-estilo=) vence o sorteio e o fixo; 'auto' volta", () => {
    expect(bracoDoPlanner({ email: EMAIL_CORE }, "?planner-estilo=codex", "ab")).toEqual({ estilo: "codex", via: "forca" });
    expect(bracoDoPlanner({ email: EMAIL_CORE }, "", "ab")).toEqual({ estilo: "codex", via: "forca" }); // guardada no aparelho
    expect(bracoDoPlanner({ email: EMAIL_CORE }, "", "core")).toEqual({ estilo: "codex", via: "forca" });
    expect(bracoDoPlanner({ email: EMAIL_CORE }, "?planner-estilo=auto", "ab")).toEqual({ estilo: "core", via: "email" });
    expect(bracoDoPlanner({ email: EMAIL_CODEX }, "?planner-estilo=core", "ab").estilo).toBe("core");
  });
  it("PLANNER_ESTILO fixo ('core' ou 'codex'): todo mundo no fixo, como antes", () => {
    for (let i = 0; i < 50; i++) {
      expect(bracoDoPlanner({ email: `p${i}@x.com`, reserva: `c${i}` }, "", "core")).toEqual({ estilo: "core", via: "fixo" });
      expect(bracoDoPlanner({ email: `p${i}@x.com` }, "", "codex")).toEqual({ estilo: "codex", via: "fixo" });
    }
  });
  it("a oferta, o Fluxo2027 e o app usam o MESMO bracoDoPlanner (nenhum outro hash por aí)", () => {
    for (const f of ["src/landing/upsell-2027.ts", "src/upsell-2027/Fluxo2027.tsx", "src/components/pacote-2027/Pacote2027.tsx"]) {
      const src = readFileSync(resolve(raiz, f), "utf8");
      expect(src).toMatch(/bracoDoPlanner\(\{/);
      expect(src).not.toMatch(/estiloDoPlanner\(\)/);
      expect(src).not.toMatch(/0x811c9dc5|0x01000193/);
    }
    const chave = readFileSync(resolve(raiz, "src/lib/planner-2027-chave.ts"), "utf8");
    expect(chave).toContain('from "./planner-2027-braco"');
    expect(estiloDoPlanner("", { email: EMAIL_CORE })).toBe("core");
  });
});

/* ───────────────────────── a oferta da /organizar ───────────────────────── */

function oferta(compra: string, email: string | null) {
  const caixa = document.createElement("div"), card = document.createElement("div");
  const eventos: { nome: string; d: Record<string, unknown> }[] = [];
  const u = criarUpsell2027(compra, {
    caixa, card, evento: (nome, d = {}) => { eventos.push({ nome, d }); }, copiarNoToque: async () => ({ ok: true, via: "x" }), copiarTexto: async () => true, desenharQr: () => {}, email: () => email,
    linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar: () => {}, aoMudar: () => {},
    api: { gerar: async () => ({ orderId: "o1", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }), conferir: async () => false, simulado: true },
  });
  u.render();
  return { caixa, u, eventos };
}
const LIGADA = "/organizar?u27planner=on&planner27=on";

describe("a oferta da /organizar", () => {
  it("chaves off: nenhum evento ganha braco_planner (e nada de imagem)", async () => {
    const { caixa, u, eventos } = oferta("c-off", EMAIL_CORE);
    (caixa.querySelector("#u27-quero") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    u.parar();
    expect(caixa.querySelector("[data-testid=u2027-planner]")).toBeNull();
    expect(eventos.length).toBeGreaterThan(0);
    for (const e of eventos) { expect(e.d).not.toHaveProperty("braco_planner"); expect(e.d).not.toHaveProperty("braco_planner_via"); }
  });
  it("ligada: o desenho sai do e-mail (com maiúsculas/espaços também) e TODO evento leva o braço", async () => {
    for (const [email, estilo] of [[EMAIL_CORE, "core"], ["  B@X.com ", "core"], [EMAIL_CODEX, "codex"], [" ANA@Exemplo.COM", "codex"]] as const) {
      window.history.replaceState(null, "", LIGADA);
      localStorage.clear(); sessionStorage.clear();
      const { caixa, u, eventos } = oferta(`c-${estilo}-${email.length}`, email);
      const fig = caixa.querySelector("[data-testid=u2027-planner]")!;
      expect(fig.getAttribute("data-estilo")).toBe(estilo);
      expect(fig.querySelector("img")!.getAttribute("src")).toBe(`/landing/planner-2027-${estilo}.webp`);
      (caixa.querySelector("#u27-zoom-abrir") as HTMLButtonElement).click();
      expect(document.getElementById("u27-zoom")!.querySelector("img")!.getAttribute("src")).toBe(`/landing/planner-2027-${estilo}-ano.webp`);
      document.getElementById("u27-zoom")!.querySelector("button")!.click();
      (caixa.querySelector("#u27-quero") as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 0));
      (caixa.querySelector("#u27-ja-paguei") as HTMLButtonElement | null)?.click();
      await new Promise((r) => setTimeout(r, 0));
      u.parar();
      const nomes = eventos.map((e) => e.nome);
      expect(nomes).toEqual(expect.arrayContaining(["landing_u2027_view", "landing_u2027_zoom", "landing_u2027_quero"]));
      for (const e of eventos) expect(e.d).toMatchObject({ braco_planner: estilo, braco_planner_via: "email" });
      expect(eventos.find((e) => e.nome === "landing_u2027_view")!.d.planner).toBe(estilo);
    }
  });
  it("ligada sem e-mail nesta aba (link do e-mail noutro navegador): reserva = a compra", () => {
    window.history.replaceState(null, "", LIGADA);
    const { caixa, u, eventos } = oferta("a", null);
    u.parar();
    expect(caixa.querySelector("[data-testid=u2027-planner]")!.getAttribute("data-estilo")).toBe("codex");
    expect(eventos[0].d).toMatchObject({ braco_planner: "codex", braco_planner_via: "reserva" });
  });
  it("ligada + ?planner-estilo=core: a força vence o e-mail", () => {
    window.history.replaceState(null, "", `${LIGADA}&planner-estilo=core`);
    const email = Array.from({ length: 50 }, (_, i) => `z${i}@x.com`).find((e) => estiloDoHash(e) === "codex")!;
    const { caixa, u, eventos } = oferta("c-forca", email);
    u.parar();
    expect(caixa.querySelector("[data-testid=u2027-planner]")!.getAttribute("data-estilo")).toBe("core");
    expect(eventos[0].d).toMatchObject({ braco_planner: "core", braco_planner_via: "forca" });
  });
});

/* ───────────────────────── o app: recebe o mesmo desenho ───────────────────────── */

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => setStore((p) => ({ ...p, [k]: v })), []);
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const CONTA = { [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true" };
const montar = () => render(
  <MemoryRouter initialEntries={["/desenvolvimento?tab=2027"]}>
    <Provedor inicial={CONTA}><Routes><Route path="/desenvolvimento" element={<Pacote2027 />} /></Routes></Provedor>
  </MemoryRouter>,
);
const eventosDo = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);

describe("o app (Pacote2027 → PlannerB)", () => {
  it("a mesma compradora: o desenho da oferta = o desenho do planner no app; abrir/ver levam o braço", async () => {
    const emailCodex = Array.from({ length: 50 }, (_, i) => `y${i}@x.com`).find((e) => estiloDoHash(e) === "codex")!;
    for (const [emailDaConta, emailNaOferta] of [[EMAIL_CORE, " B@x.COM"], [emailCodex, emailCodex.toUpperCase()], [EMAIL_CODEX, "Ana@Exemplo.com "]] as const) {
      // a oferta (landing) com o e-mail digitado
      window.history.replaceState(null, "", LIGADA);
      localStorage.clear();
      const o = oferta(`c-${emailDaConta}`, emailNaOferta);
      o.u.parar();
      const naOferta = o.caixa.querySelector("[data-testid=u2027-planner]")!.getAttribute("data-estilo");
      // o app (outro armazenamento: nada guardado da landing), logada com o e-mail da conta
      localStorage.clear();
      window.history.replaceState(null, "", "/?planner27=on");
      conta.email = emailDaConta;
      vi.mocked(trackEvent).mockClear();
      const r = montar();
      fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
      const b = await screen.findByTestId("planner-b", {}, { timeout: 8000 });
      expect(b.getAttribute("data-estilo")).toBe(naOferta);
      expect(eventosDo("plano2027_planner_abrir")[0]).toMatchObject({ braco_planner: naOferta, braco_planner_via: "email" });
      expect(eventosDo("plano2027_planner_view")[0]).toMatchObject({ braco_planner: naOferta, braco_planner_via: "email", estilo: naOferta });
      r.unmount();
    }
  });
  it("conta sem e-mail de verdade (apelido pix-…@): reserva = o id da conta", async () => {
    window.history.replaceState(null, "", "/?planner27=on");
    conta.email = "pix-abc123@coreaplicativo.com.br"; conta.id = "b";
    montar();
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect((await screen.findByTestId("planner-b", {}, { timeout: 8000 })).getAttribute("data-estilo")).toBe("core");
    expect(eventosDo("plano2027_planner_view")[0]).toMatchObject({ braco_planner: "core", braco_planner_via: "reserva" });
  });
  it("chave off (versão A): o abrir não leva braço", () => {
    vi.spyOn(window, "open").mockReturnValue({ document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() } as unknown as Window);
    montar();
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect(eventosDo("plano2027_planner_abrir")).toHaveLength(0);
    for (const c of vi.mocked(trackEvent).mock.calls) expect(c[1] ?? {}).not.toHaveProperty("braco_planner");
  });
});

/* ───────────────────────── o Fluxo2027 (/hoje, /inicio) ───────────────────────── */

describe("Fluxo2027 (/hoje e /inicio)", () => {
  it("ligada: o desenho pelo e-mail da compra; os eventos levam o braço", () => {
    window.history.replaceState(null, "", "/hoje?u27planner=on&planner27=on");
    render(<Fluxo2027 origem="hoje" compra="c-fluxo" valorPago={27.9} versao="visual" email=" B@x.com" onFim={vi.fn()} />);
    expect(screen.getByTestId("u2027-planner").getAttribute("data-estilo")).toBe("core");
    expect(screen.getByTestId("u2027-planner").querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-core.webp");
    fireEvent.click(screen.getByTestId("u2027-quero"));
    expect(eventosDo("u2027_oferta_view")[0]).toMatchObject({ braco_planner: "core", braco_planner_via: "email" });
    expect(eventosDo("u2027_quero")[0]).toMatchObject({ braco_planner: "core", braco_planner_via: "email" });
  });
  it("chaves off: os eventos ficam sem o braço", () => {
    render(<Fluxo2027 origem="hoje" compra="c-fluxo-off" valorPago={27.9} versao="visual" email={EMAIL_CORE} onFim={vi.fn()} />);
    expect(screen.queryByTestId("u2027-planner")).toBeNull();
    expect(eventosDo("u2027_oferta_view")[0]).not.toHaveProperty("braco_planner");
  });
});
