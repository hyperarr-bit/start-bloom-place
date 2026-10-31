/**
 * PLANNER 2027 VERSÃO B (31/10 — novidades-guardadas/2026-10-31/upsell-planner/BRIEF.md).
 *   · chaves: tudo OFF; com a chave off o app, o planner (A, byte a byte) e a oferta (/organizar e Fluxo2027) ficam na versão A;
 *   · o planner: 12 folhas nas 2 direções, com os dados dela (Seu 2027 + Rotina + Finanças do perfil ativo), escapados;
 *     conta VAZIA = linhas pra escrever (nada de "undefined", "NaN", "R$ 0");
 *   · o app com a chave: prévia + o que entrou + convite pra planejar quando é pouco; site = janela de impressão;
 *     iPhone = as 12 folhas em PNG pela folha nativa (Share.share com 12 arquivos), nunca <a download>;
 *   · a oferta com a chave: as 2 folhas reais (imagem na direção do app) + a frase nova.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig()), isNativeShell: () => nativo.v }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" }, isSubscribed: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig()), trackEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const foto = vi.hoisted(() => ({ gerarPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));
vi.mock("@/components/conquistas/gerar-imagem", () => ({ gerarPng: foto.gerarPng }));
const cap = vi.hoisted(() => ({ escrever: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///cache/${path}` })), share: vi.fn(async () => ({})) }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { writeFile: cap.escrever }, Directory: { Cache: "CACHE" } }));
vi.mock("@capacitor/share", () => ({ Share: { share: cap.share } }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Pacote2027 } from "@/components/pacote-2027/Pacote2027";
import { CHAVE_PACOTE_2027, CHAVE_PLANO_2027, CHAVE_DICA_2027, novoPlano2027, type Plano2027 } from "@/lib/pacote-2027";
import { htmlDoPlanner2027 } from "@/lib/pacote-2027-pdf";
import {
  EXEMPLO_DO_PLANNER, PLANNER_2027, PLANNER_ESTILO, TOTAL_DE_FOLHAS, estiloDoPlanner, folhasDoPlanner, htmlDoPlannerNovo, lerExtrasDoPlanner,
  plannerNovoLigado, resumoDoPlanner, cssDoPlanner, type DadosDoPlanner,
} from "@/lib/planner-2027";
import { U27_PLANNER, imagemDoPlanner, u27PlannerLigado } from "@/lib/planner-2027-chave";
import { DESC_U2027, criarUpsell2027 } from "@/landing/upsell-2027";
import { Fluxo2027 } from "@/upsell-2027/Fluxo2027";

const raiz = resolve(__dirname, "../..");
const VAZIO: DadosDoPlanner = { plano: novoPlano2027(), cofrinho: { marcadas: [], invertido: false }, habitos: [], contas: [] };

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); nativo.v = false; });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

/* ───────────────────────── as chaves ───────────────────────── */

describe("as chaves (tudo desligado)", () => {
  it("PLANNER_2027 e U27_PLANNER saem 'off'; a direção padrão é 'core'", () => {
    expect(PLANNER_2027).toBe("off");
    expect(U27_PLANNER).toBe("off");
    expect(PLANNER_ESTILO).toBe("core");
    expect(plannerNovoLigado("")).toBe(false);
    expect(u27PlannerLigado("")).toBe(false);
    expect(estiloDoPlanner("")).toBe("core");
  });
  it("QA: ?planner27=on fica guardado no aparelho; ?planner27=auto volta pra chave; o mesmo pro estilo e pra oferta", () => {
    expect(plannerNovoLigado("?planner27=on")).toBe(true);
    expect(plannerNovoLigado("")).toBe(true);
    expect(plannerNovoLigado("?planner27=auto")).toBe(false);
    expect(plannerNovoLigado("")).toBe(false);
    expect(estiloDoPlanner("?planner-estilo=codex")).toBe("codex");
    expect(estiloDoPlanner("")).toBe("codex");
    expect(estiloDoPlanner("?planner-estilo=lixo")).toBe("codex");
    expect(estiloDoPlanner("?planner-estilo=auto")).toBe("core");
    expect(u27PlannerLigado("?u27planner=on")).toBe(true);
    expect(u27PlannerLigado("?u27planner=off")).toBe(false);
    expect(imagemDoPlanner("codex")).toBe("/landing/planner-2027-codex.webp");
  });
  it("o planner da versão A não mudou (byte a byte)", () => {
    const p = { ...novoPlano2027(), metas: ["Juntar <R$ 5 mil>", "Viajar", ""], gastarMes: 3200, guardarMes: 300, datas: [{ id: "a", tipo: "aniversario" as const, titulo: "Mãe", dia: "2027-03-14" }] };
    const h = htmlDoPlanner2027(p, { marcadas: [1, 2], invertido: false }, new Date(2026, 9, 21));
    expect(createHash("sha256").update(h).digest("hex")).toBe("3b6097b2f88f2b7b6cc1b1d1acc50f13a9a7248036cc93f594c6fccf1c4f32d6");
  });
  it("as 2 miniaturas da oferta existem (scripts/planner-2027-miniaturas.ts) e são leves", () => {
    for (const e of ["core", "codex"]) {
      const f = resolve(raiz, `public/landing/planner-2027-${e}.webp`);
      expect(existsSync(f)).toBe(true);
      expect(statSync(f).size).toBeLessThan(80 * 1024);
    }
  });
});

/* ───────────────────────── o planner ───────────────────────── */

const sujeira = /undefined|NaN|\bnull\b|R\$ 0(?![\d,.])|\[object/;

describe("o planner B: 12 folhas, 2 direções, os dados dela", () => {
  for (const estilo of ["core", "codex"] as const) {
    it(`${estilo}: 12 folhas com as metas, o dinheiro, as datas, os hábitos e as contas — escapados`, () => {
      const d: DadosDoPlanner = { ...EXEMPLO_DO_PLANNER, plano: { ...EXEMPLO_DO_PLANNER.plano, metas: ["Juntar <R$ 5 mil> & \"viajar\"", "Ler", ""] } };
      const f = folhasDoPlanner(d, estilo);
      expect(f).toHaveLength(TOTAL_DE_FOLHAS);
      const h = f.join("");
      expect(h).toContain("Juntar &lt;R$ 5 mil&gt; &amp; &quot;viajar&quot;");
      expect(h).not.toContain("<R$ 5 mil>");
      for (const s of ["R$ 3.200", "R$ 450", "R$ 5.400", "Aniversário da mãe", "Água ao acordar", "Aluguel", "R$ 1.450", "R$ 1.378", "Dev. Pessoal", "Detox"]) expect(h).toContain(s);
      expect(h).not.toMatch(sujeira);
      for (let i = 1; i <= 12; i++) expect(h).toContain(`data-folha="${i}"`);
      expect(h).toContain(`${12} / ${12} · feito com CORE`);
    });
    it(`${estilo}: conta VAZIA = linhas pra escrever, sem 'R$ 0', 'undefined' nem painel sem nada`, () => {
      const h = folhasDoPlanner(VAZIO, estilo).join("");
      expect(h).not.toMatch(sujeira);
      expect((h.match(/class="pl-ln/g) ?? []).length).toBeGreaterThan(100);
      expect(h).toContain("pl-escrever"); // o "R$ ____" no lugar do valor
      expect(h).not.toContain("ESTE ANO EU VOU"); // sem metas, a capa não mostra a lista vazia
      expect(resumoDoPlanner(VAZIO).pouco).toBe(true);
    });
  }
  it("as 2 direções: mesmo layout, cara diferente (codex = serifada + flor; core = ícones dos módulos + magenta)", () => {
    const codex = folhasDoPlanner(EXEMPLO_DO_PLANNER, "codex").join("");
    const core = folhasDoPlanner(EXEMPLO_DO_PLANNER, "core").join("");
    expect(codex).toContain("pl-flor");
    expect(codex).not.toContain("pl-ico");
    expect(core).toContain("pl-capa-grade");
    expect((core.match(/class="pl-ico"/g) ?? []).length).toBeGreaterThan(30);
    expect(cssDoPlanner("codex")).toContain("Instrument Serif");
    expect(cssDoPlanner("core")).toContain("#d6338a");
    // o CSS escopado não vaza: toda regra começa pela raiz
    const escopado = cssDoPlanner("core", ".pl.pl-core");
    for (const regra of escopado.split("}").map((r) => r.trim()).filter(Boolean)) for (const sel of regra.split("{")[0].split(",")) expect(sel.trim().startsWith(".pl.pl-core")).toBe(true);
  });
  it("a impressão do site: A4 sem margem, 1 folha por página, fontes carregadas (Inter + Instrument Serif)", () => {
    const h = htmlDoPlannerNovo(EXEMPLO_DO_PLANNER, "codex", "https://www.coreaplicativo.com.br");
    expect(h).toContain("@page{size:A4;margin:0}");
    expect(h).toContain("break-after:page");
    expect(h).toContain("https://www.coreaplicativo.com.br/fonts/instrument-serif-italic-latin.woff2");
    expect(h).toContain("https://www.coreaplicativo.com.br/fonts/inter-latin.woff2");
    expect(h).not.toContain("googleapis");
    expect((h.match(/class="pg pl-folha/g) ?? []).length).toBe(12);
  });
  it("lê a Rotina e o Finanças: hábitos (formato antigo também), contas fixas SÓ do perfil ativo, por dia; lixo vira lista vazia", () => {
    const store: Record<string, unknown> = {
      "rotina-habits": ["Beber água", { name: "Treinar" }, "", 3],
      "finance-perfil-ativo": "pessoal",
      "finance-fixed-expenses": [
        { description: "Internet", value: 99.9, day: 15 }, { description: "Aluguel", value: 1450, day: 5 },
        { description: "Da empresa", value: 500, day: 1, perfil: "empresa-1" }, { name: "Luz", amount: "120" }, null, "x",
      ],
    };
    const get = <T,>(k: string, f: T) => (k in store ? (store[k] as T) : f);
    const r = lerExtrasDoPlanner(get);
    expect(r.habitos).toEqual(["Beber água", "Treinar"]);
    expect(r.contas.map((c) => c.nome)).toEqual(["Aluguel", "Internet", "Luz"]);
    expect(r.contas[2]).toEqual({ nome: "Luz", valor: 120, dia: null });
    expect(lerExtrasDoPlanner(<T,>() => ({ lixo: 1 }) as unknown as T)).toEqual({ habitos: [], contas: [] });
  });
});

/* ───────────────────────── o app ───────────────────────── */

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown) => setStore((p) => ({ ...p, [k]: v })), []);
  const valor = useMemo(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }) as unknown as UserDataContextType, [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const PLANO: Plano2027 = { ...EXEMPLO_DO_PLANNER.plano };
const CONTA_CHEIA = {
  [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true", [CHAVE_PLANO_2027]: PLANO,
  "rotina-habits": ["Água ao acordar", "Ler 10 páginas"], "finance-fixed-expenses": [{ description: "Aluguel", value: 1450, day: 5 }],
};
const CONTA_VAZIA = { [CHAVE_PACOTE_2027]: { comprado: true, em: "2026-10-31T15:00:00-03:00", pedido: "qr_1" }, [CHAVE_DICA_2027]: "true" };
const montar = (inicial: Record<string, unknown>) => render(
  <MemoryRouter initialEntries={["/desenvolvimento?tab=2027"]}>
    <Provedor inicial={inicial}><Routes><Route path="/desenvolvimento" element={<Pacote2027 />} /></Routes></Provedor>
  </MemoryRouter>,
);

describe("o app: chave off = versão A", () => {
  it("o botão é o de sempre e abre a impressão da versão A (sem prévia)", () => {
    const janela = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
    montar(CONTA_CHEIA);
    const b = screen.getByTestId("pacote-2027-pdf");
    expect(b.textContent).toBe("🖨️ Planner pra imprimir");
    fireEvent.click(b);
    return waitFor(() => {
      expect(abrir).toHaveBeenCalled();
      expect(String(janela.document.write.mock.calls[0][0])).toContain("Planner <em>2027</em>");
      expect(screen.queryByTestId("planner-b")).toBeNull();
    }).finally(() => abrir.mockRestore());
  });
});

describe("o app: chave on (QA ?planner27=on)", () => {
  beforeEach(() => { window.history.replaceState(null, "", "/?planner27=on"); });

  it("conta preenchida: prévia das 12 folhas + o que entrou do Seu 2027, da Rotina e do Finanças; sem convite", () => {
    montar(CONTA_CHEIA);
    expect(screen.getByTestId("pacote-2027-pdf").textContent).toBe("🖨️ Seu planner 2027");
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    const b = screen.getByTestId("planner-b");
    expect(b.getAttribute("data-estilo")).toBe("core");
    expect(screen.getAllByRole("img", { name: /^Folha \d+/ })).toHaveLength(12);
    const itens = screen.getByTestId("planner-b-itens").textContent!;
    for (const s of ["3 metas de 2027", "Gastar e guardar por mês", "5 datas marcadas", "2 hábitos da sua Rotina", "1 conta fixa do Finanças"]) expect(itens).toContain(s);
    expect(screen.queryByTestId("planner-b-planejar")).toBeNull();
    expect(screen.getByTestId("planner-b-baixar").textContent).toContain("Imprimir ou salvar em PDF");
    expect(document.getElementById("pl-css-core")).not.toBeNull();
  });

  it("conta VAZIA: as folhas saem com linhas pra escrever + convite curto pra planejar (abre o Planejar)", () => {
    montar(CONTA_VAZIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect(screen.getAllByRole("img", { name: /^Folha \d+/ })).toHaveLength(12);
    expect(screen.getByTestId("planner-b-itens").textContent).toContain("Metas: linhas pra escrever");
    expect(screen.getByTestId("planner-b").innerHTML).not.toMatch(sujeira);
    fireEvent.click(screen.getByText("Planejar 2027"));
    expect(screen.queryByTestId("planner-b")).toBeNull();
  });

  it("site: a janela de impressão com as 12 folhas da direção escolhida", async () => {
    window.history.replaceState(null, "", "/?planner27=on&planner-estilo=codex");
    const janela = { document: { write: vi.fn(), close: vi.fn(), fonts: { ready: Promise.resolve() } }, focus: vi.fn(), print: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(janela as unknown as Window);
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    fireEvent.click(screen.getByTestId("planner-b-baixar"));
    expect(abrir).toHaveBeenCalledTimes(1);
    const html = String(janela.document.write.mock.calls[0][0]);
    expect(html).toContain('class="pl pl-codex"');
    expect((html.match(/data-folha=/g) ?? []).length).toBe(12);
    await waitFor(() => expect(janela.print).toHaveBeenCalled(), { timeout: 3000 });
    abrir.mockRestore();
  });

  it("app do iPhone: as 12 folhas viram PNG e vão JUNTAS pela folha nativa (nunca <a download>)", async () => {
    nativo.v = true;
    const criar = vi.spyOn(document, "createElement");
    montar(CONTA_CHEIA);
    fireEvent.click(screen.getByTestId("pacote-2027-pdf"));
    expect(screen.getByTestId("planner-b-baixar").textContent).toContain("Salvar ou imprimir");
    fireEvent.click(screen.getByTestId("planner-b-baixar"));
    await waitFor(() => expect(cap.share).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(foto.gerarPng).toHaveBeenCalledTimes(12);
    const arg = (cap.share.mock.calls[0] as unknown as [{ files: string[] }])[0];
    expect(arg.files).toHaveLength(12);
    expect(arg.files[0]).toMatch(/planner-2027-core-01\.png$/);
    expect(criar.mock.calls.filter((c) => c[0] === "a")).toHaveLength(0);
    criar.mockRestore();
  });
});

/* ───────────────────────── a oferta ───────────────────────── */

function ofertaDaOrganizar() {
  const caixa = document.createElement("div"), card = document.createElement("div");
  const u = criarUpsell2027("c1", {
    caixa, card, evento: () => {}, copiarNoToque: async () => ({ ok: true, via: "x" }), copiarTexto: async () => true, desenharQr: () => {}, email: () => null,
    linhaConfirmada: () => "O CORE é seu pra sempre.", aoTerminar: () => {}, aoMudar: () => {},
    api: { gerar: async () => ({ orderId: "o1", qrCode: "0002", qrCodeBase64: null, expiresAt: "2099-01-01T00:00:00Z", donoIgual: true }), conferir: async () => false, simulado: true },
  });
  u.render();
  return { caixa, u };
}

describe("a oferta do 2027", () => {
  afterEach(() => { document.getElementById("lp-u27-planner-css")?.remove(); });
  it("/organizar com a chave off: a oferta da versão A (sem imagem, sem frase nova, sem CSS novo)", () => {
    const { caixa, u } = ofertaDaOrganizar();
    expect(caixa.querySelector("[data-testid=u2027-planner]")).toBeNull();
    expect(caixa.innerHTML).toContain(`<p class="u27-desc">${DESC_U2027}</p>`);
    expect(document.getElementById("lp-u27-planner-css")).toBeNull();
    u.parar();
  });
  it("/organizar com ?u27planner=on: as 2 folhas reais (na direção do app) acima da frase nova; o preço e o botão continuam", () => {
    window.history.replaceState(null, "", "/organizar?u27planner=on&planner-estilo=codex");
    const { caixa, u } = ofertaDaOrganizar();
    const fig = caixa.querySelector("[data-testid=u2027-planner]")!;
    expect(fig.querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-codex.webp");
    expect(fig.textContent).toContain("Exemplo. O seu sai com o que você planejar.");
    expect(caixa.textContent).toContain("Um planner 2027 pra imprimir, montado com as suas metas");
    expect(caixa.textContent).not.toMatch(/PDF|já organizado|orçamento do ano/);
    expect(caixa.querySelector("#u27-quero")).not.toBeNull();
    expect(caixa.textContent).toContain("R$ 14,90");
    expect(document.getElementById("lp-u27-planner-css")).not.toBeNull();
    u.parar();
  });
  it("Fluxo2027 (/hoje e /inicio): off = o caderno desenhado; on = as folhas do planner", () => {
    const r = render(<Fluxo2027 origem="hoje" compra="c-off" valorPago={27.9} versao="visual" onFim={vi.fn()} />);
    expect(screen.getByTestId("u2027-ilustra")).toBeTruthy();
    expect(screen.queryByTestId("u2027-planner")).toBeNull();
    r.unmount();
    window.history.replaceState(null, "", "/hoje?u27planner=on");
    render(<Fluxo2027 origem="hoje" compra="c-on" valorPago={27.9} versao="visual" onFim={vi.fn()} />);
    expect(screen.getByTestId("u2027-planner").querySelector("img")!.getAttribute("src")).toBe("/landing/planner-2027-core.webp");
    expect(screen.queryByTestId("u2027-ilustra")).toBeNull();
  });
});
