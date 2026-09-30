/**
 * FUNIL B — "O app é o funil" (30/09, src/lib/funil-b.ts). O que este arquivo trava:
 *   · a CHAVE: "off" = o funil de hoje, byte a byte (nem `f=b` na URL é lido);
 *     "kenny" = só quem chegou pela kenny g (utm_campaign = o id da campanha);
 *     "on" = todo mundo; a força de QA manda mais que a chave;
 *   · a PORTA no B abre a demo direto (sem quiz), já com a missão e o braço na
 *     URL (`guia=1&f=b`), e todo evento leva `funil: "b"`;
 *   · a DEMO no B: as pílulas e a volta levam `f=b` (+ o item e as respostas);
 *     a volta cai em `?step=guardando` (preço antes da conta); a missão começa
 *     pela pergunta do quiz (quanto sai por mês → eco), anota 1 gasto, olha o
 *     mês e termina na vitória da semana; as respostas viram `qg`/`qv` na URL;
 *   · o /inicio no B: "Guardando…" → paywall SEM conta (checkout no modo B) ou
 *     o cadastro de hoje se a sessão anônima estiver desligada; `?step=pronto`
 *     mostra o Pronto; assinante no "offer"/"pronto" NÃO é jogado pro app;
 *   · o ROLLBACK: chave "off" com `?step=guardando&f=b` = o cadastro de hoje.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), campanha: "" as string }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: analytics.trackEvent,
  trackEventBeacon: analytics.trackEventBeacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => (analytics.campanha ? { utm_source: "ig", utm_medium: "paid", utm_campaign: analytics.campanha } : {}),
  markActivation: vi.fn(),
}));
vi.mock("@/lib/funil-roi2", () => ({ FUNIL_ROI2: true, ehFunilRoi2: () => true }));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => String(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
const auth = vi.hoisted(() => ({ user: null as null | { id: string }, isSubscribed: false }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.user, loading: false, isSubscribed: auth.isSubscribed, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
}));
const sessao = vi.hoisted(() => ({ anonimoLigado: true }));
vi.mock("@/lib/sessao-anonima", () => ({
  guardarCompraAnonima: vi.fn().mockResolvedValue(undefined),
  anonimoLigado: () => Promise.resolve(sessao.anonimoLigado),
}));
// a chave de produção pode estar em qualquer valor: o teste manda no modo pelas funções que o funil chama
const chave = vi.hoisted(() => ({ modo: "off" as "off" | "kenny" | "on", abriu: [] as string[] }));
vi.mock("@/lib/funil-b", async (orig) => {
  const real = await orig<typeof import("@/lib/funil-b")>();
  return {
    ...real,
    decidirFunilB: (c: string | null | undefined, modo: "off" | "kenny" | "on" = chave.modo) => real.decidirFunilB(c, modo),
    ehFunilB: (b?: string | URLSearchParams, modo: "off" | "kenny" | "on" = chave.modo) => real.ehFunilB(b, modo),
    abrirUrl: (url: string) => { chave.abriu.push(url); },
  };
});
// o sorteio da demo guiada fica FORA do experimento: no B a missão tem que ligar por conta do braço
vi.mock("@/lib/demo-guiada-braco", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo-guiada-braco")>()),
  sortearBracoDaDemo: () => null,
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
vi.mock("@/lib/loja", async (orig) => ({ ...(await orig<typeof import("@/lib/loja")>()), ehApple: () => false }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));
const pix = vi.hoisted(() => ({ props: null as null | Record<string, unknown>, aquecer: vi.fn() }));
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: (p: Record<string, unknown>) => { pix.props = p; return <div data-testid="pix-mock">oferta:{String(p.offer)}</div>; },
  aquecerCheckoutPix: pix.aquecer,
  prepararPixAdiantado: () => ({ tocou: () => {}, parar: () => {} }),
}));
vi.mock("@/pages/funis/dia14/ProntoB", () => ({ default: () => <div data-testid="pronto-b-stub">pronto</div> }));

/* Módulo de mentira de Finanças: o formulário com a âncora real (add-expense) e o MEU MÊS (add-bill). */
const moduloDeMentira = async (nome: string) => {
  const { usePersistedState } = await import("@/hooks/use-persisted-state");
  const Modulo = () => {
    const [gastos] = usePersistedState<Array<{ id: string; description: string }>>("finance-expenses", []);
    const lista = Array.isArray(gastos) ? gastos : [];
    return (
      <div data-testid={`modulo-${nome}`}>
        <ul>{lista.map((g) => <li key={g.id} data-testid="gasto">{g.description}</li>)}</ul>
        {nome === "financas" && (
          <>
            <div>
              <input placeholder="+ Novo gasto" readOnly />
              <input placeholder="Valor" readOnly />
              <button data-spotlight="add-expense">+</button>
            </div>
            <div data-spotlight="add-bill"><div>MEU MÊS</div><div><span>↓ Saiu R$ 3.718</span></div></div>
          </>
        )}
      </div>
    );
  };
  return { default: Modulo };
};
vi.mock("@/pages/Index", () => moduloDeMentira("financas"));
vi.mock("@/pages/Rotina", () => moduloDeMentira("rotina"));

import Preview from "@/pages/Preview";
import ComecarDia14 from "@/pages/funis/dia14/ComecarDia14";
import { UserDataProvider } from "@/hooks/use-user-data";
import { esquecerMissao, estadoDaMissao } from "@/lib/demo-guiada";
import { TEMPOS_DA_MISSAO } from "@/components/demo-guiada/alvos";
import {
  FUNIL_B, CAMPANHA_KENNY_G, CHAVE_FORCA_FUNIL_B, comFunilB, comRespostas, decidirFunilB, ehFunilB, normalizarRespostas, respostasDaUrl,
} from "@/lib/funil-b";

MotionGlobalConfig.skipAnimations = true;
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
Element.prototype.getBoundingClientRect = function () {
  return { top: 200, left: 10, width: 300, height: 40, bottom: 240, right: 310, x: 10, y: 200, toJSON() { return this; } } as DOMRect;
};
window.scrollBy = () => {};
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollIntoView = () => {};

const KENNY = CAMPANHA_KENNY_G;
const OUTRA = "120250648120140041";
const DEMO_B = "/preview/financas?funnel=1&tour=vida&from=dia14&guia=1&f=b";
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => analytics.trackEvent.mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const hrefsDasPilulas = () => Array.from(document.querySelectorAll(".demo-tour-nav a")).map((a) => a.getAttribute("href") ?? "");
const botaoDeBaixo = () => document.querySelector(".z-\\[70\\] a") as HTMLAnchorElement | null;

const Rotas = () => {
  const location = useLocation();
  return (
    <>
      <Routes location={location} key={location.pathname}>
        <Route path="/preview/:moduleKey" element={<Preview />} />
        <Route path="/inicio" element={<p data-testid="fora">fora</p>} />
      </Routes>
      <p data-testid="url">{location.pathname + location.search}</p>
    </>
  );
};
const abrirDemo = async (url: string) => {
  render(<MemoryRouter initialEntries={[url]}><Rotas /></MemoryRouter>);
  await screen.findByTestId("modulo-financas");
};
const porta = (url = "/inicio") => render(<MemoryRouter initialEntries={[url]}><UserDataProvider><ComecarDia14 /></UserDataProvider></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  esquecerMissao();
  auth.user = null;
  auth.isSubscribed = false;
  analytics.campanha = "";
  analytics.trackEvent.mockClear();
  analytics.trackEventBeacon.mockClear();
  chave.modo = "off";
  chave.abriu = [];
  pix.props = null;
  pix.aquecer.mockClear();
  sessao.anonimoLigado = true;
  window.history.replaceState({}, "", "/");
  Object.assign(TEMPOS_DA_MISSAO, { inicio: 60, antesDoHolofote: 50, registrou: 30, primeiroRegistro: 900, olhar: 900, trava: 60_000, eco: 900 });
});
afterEach(cleanup);

/* ------------------------------------------------------------ a chave */

describe("a chave", () => {
  it("é uma das três e NASCE desligada (30/09: sobe atrás de chave; o dono liga 'kenny' no dia)", () => {
    expect(["off", "kenny", "on"]).toContain(FUNIL_B);
    expect(FUNIL_B).toBe("off");
  });
  it("'kenny' = só a campanha kenny g (o id em utm_campaign); 'on' = todo mundo; 'off' = ninguém", () => {
    expect(decidirFunilB(KENNY, "kenny")).toBe(true);
    expect(decidirFunilB(OUTRA, "kenny")).toBe(false);
    expect(decidirFunilB("", "kenny")).toBe(false);
    expect(decidirFunilB(null, "kenny")).toBe(false);
    expect(decidirFunilB(` ${KENNY} `, "kenny")).toBe(true);
    expect(decidirFunilB(null, "on")).toBe(true);
    expect(decidirFunilB(KENNY, "off")).toBe(false);
  });
  it("a força de QA manda mais que a chave", () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_B, "on");
    expect(decidirFunilB(OUTRA, "off")).toBe(true);
    expect(ehFunilB("?x=1", "off")).toBe(true);
    localStorage.setItem(CHAVE_FORCA_FUNIL_B, "off");
    expect(decidirFunilB(KENNY, "on")).toBe(false);
    expect(ehFunilB("?f=b", "on")).toBe(false);
  });
  it("o link de QA (?funil-b=on|off|auto) grava a força no aparelho e vale nas páginas seguintes, sem o link", () => {
    const antes = window.location.pathname + window.location.search;
    try {
      window.history.replaceState({}, "", "/inicio?funil-b=on");
      expect(decidirFunilB(OUTRA, "off")).toBe(true);
      expect(localStorage.getItem(CHAVE_FORCA_FUNIL_B)).toBe("on");
      window.history.replaceState({}, "", "/preview/financas?funnel=1&guia=1");
      expect(ehFunilB(undefined, "off")).toBe(true);
      window.history.replaceState({}, "", "/inicio?funil-b=off");
      expect(decidirFunilB(KENNY, "on")).toBe(false);
      window.history.replaceState({}, "", "/inicio?funil-b=auto");
      expect(decidirFunilB(KENNY, "kenny")).toBe(true);
      expect(decidirFunilB(OUTRA, "kenny")).toBe(false);
      expect(localStorage.getItem(CHAVE_FORCA_FUNIL_B)).toBeNull();
      window.history.replaceState({}, "", "/inicio?funil-b=sim");
      expect(decidirFunilB(OUTRA, "off")).toBe(false);
      expect(localStorage.getItem(CHAVE_FORCA_FUNIL_B)).toBeNull();
    } finally {
      window.history.replaceState({}, "", antes);
    }
  });
  it("depois da porta, a URL manda (f=b) — mas só com a chave ligada (rollback total)", () => {
    expect(ehFunilB("?step=guardando&f=b", "kenny")).toBe(true);
    expect(ehFunilB("?step=guardando&f=b", "on")).toBe(true);
    expect(ehFunilB("?step=guardando&f=b", "off")).toBe(false);
    expect(ehFunilB("?step=signup", "on")).toBe(false);
    expect(ehFunilB("?f=a", "on")).toBe(false);
  });
  it("comFunilB carimba f=b e troca a volta 'signup' por 'guardando', sem mexer no resto", () => {
    expect(comFunilB("/inicio?step=signup&porta=vida")).toBe("/inicio?step=guardando&porta=vida&f=b");
    expect(comFunilB("/preview/financas?funnel=1&tour=vida&from=dia14&guia=1")).toBe("/preview/financas?funnel=1&tour=vida&from=dia14&guia=1&f=b");
    expect(comFunilB("/inicio?step=offer")).toBe("/inicio?step=offer&f=b");
  });
  it("as respostas na URL: só lista fechada entra, e a ida e volta é exata", () => {
    const url = comRespostas("/inicio?step=guardando&f=b", { gasto: "R$ 100 a R$ 300", vitoria: "Entender meus gastos" });
    expect(url).toBe("/inicio?step=guardando&f=b&qg=R%24+100+a+R%24+300&qv=Entender+meus+gastos");
    expect(respostasDaUrl(url.split("?")[1])).toEqual({ gasto: "R$ 100 a R$ 300", vitoria: "Entender meus gastos" });
    expect(normalizarRespostas({ gasto: "R$ 1 milhão", vitoria: "<script>", consistencia: "Uns 3 dias" })).toEqual({ consistencia: "Uns 3 dias" });
    expect(comRespostas("/inicio?f=b", {})).toBe("/inicio?f=b");
    expect(comRespostas("/inicio?f=b", { gasto: "inventado" })).toBe("/inicio?f=b");
  });
});

/* ------------------------------------------------------------ a porta */

describe("a porta", () => {
  it("chave 'kenny' + campanha kenny g: tocar na área abre a DEMO direto (sem quiz), com guia=1 e f=b, e o start leva funil:b", async () => {
    chave.modo = "kenny";
    analytics.campanha = KENNY;
    porta();
    expect(screen.getByTestId("porta-roi2")).toBeTruthy();
    expect(eventos("funnel_view").find((e) => e.step === "start")).toEqual(expect.objectContaining({ funil: "b" }));
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await waitFor(() => expect(chave.abriu).toHaveLength(1));
    expect(chave.abriu[0]).toBe(DEMO_B);
    expect(screen.queryByTestId("quiz-pilula")).toBeNull();
    expect(eventos("funnel_click").find((e) => e.cta === "start")).toEqual(expect.objectContaining({ area: "dinheiro", porta: "vida", funil: "b" }));
    expect(eventos("funnel_click").find((e) => e.cta === "start")).not.toHaveProperty("quiz");
    expect(localStorage.getItem("core-funnel-area")).toBe("dinheiro");
    expect(JSON.parse(localStorage.getItem("funnel-quiz-answers") ?? "{}")).toEqual({ area: "dinheiro" });
  });
  it("'Tudo, sinceramente' no B abre Finanças; Metas abre a aba de metas", async () => {
    chave.modo = "on";
    porta();
    fireEvent.click(screen.getByText("Tudo, sinceramente"));
    await waitFor(() => expect(chave.abriu).toHaveLength(1));
    expect(chave.abriu[0]).toBe(DEMO_B);
    cleanup();
    chave.abriu = [];
    porta();
    fireEvent.click(screen.getByText("Metas e evolução pessoal"));
    await waitFor(() => expect(chave.abriu).toHaveLength(1));
    expect(chave.abriu[0]).toBe("/preview/desenvolvimento?funnel=1&tour=vida&from=dia14&tab=metas&guia=1&f=b");
  });
  it("chave 'kenny' + OUTRA campanha: o funil de hoje (quiz), sem a marca em evento nenhum", async () => {
    chave.modo = "kenny";
    analytics.campanha = OUTRA;
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(chave.abriu).toHaveLength(0);
    for (const e of [...eventos("funnel_click"), ...eventos("funnel_view")]) expect(e).not.toHaveProperty("funil");
  });
  it("chave 'off' + campanha kenny g: o funil de hoje, byte a byte", async () => {
    chave.modo = "off";
    analytics.campanha = KENNY;
    porta();
    fireEvent.click(screen.getByText("Meu dinheiro"));
    await screen.findByTestId("quiz-pilula", {}, { timeout: 4000 });
    expect(chave.abriu).toHaveLength(0);
    for (const e of [...eventos("funnel_click"), ...eventos("funnel_view")]) expect(e).not.toHaveProperty("funil");
  });
  it("a força de QA 'on' liga o B sem campanha nenhuma", async () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_B, "on");
    porta();
    fireEvent.click(screen.getByText("Minha rotina"));
    await waitFor(() => expect(chave.abriu).toHaveLength(1));
    expect(chave.abriu[0]).toBe("/preview/rotina?funnel=1&tour=vida&from=dia14&guia=1&f=b");
  });
});

/* ------------------------------------------------------------ a demo */

describe("a demo no B", () => {
  it("pílulas e volta levam f=b; a volta é ?step=guardando; a demo leva funil:b no evento; a missão liga mesmo com o sorteio fora", async () => {
    chave.modo = "kenny";
    await abrirDemo(DEMO_B);
    expect(eventos("funnel_view").find((e) => e.step === "demo")).toEqual(expect.objectContaining({ guia: "on", funil: "b" }));
    for (const h of hrefsDasPilulas()) { expect(h).toContain("f=b"); expect(h).toContain("guia=1"); }
    // a missão está na tela (a trava suave no lugar do "Quase lá") — pergunta 1 no post-it
    expect(await screen.findByTestId("demo-guia-pergunta1", {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByTestId("demo-cta-travado")).toBeTruthy();
    act(() => { fireEvent.click(screen.getByTestId("demo-cta-travado")); });
    const volta = await waitFor(() => { const a = botaoDeBaixo(); if (!a) throw new Error("sem botão"); return a; });
    expect(volta.getAttribute("href")).toBe("/inicio?step=guardando&porta=vida&f=b");
    expect(volta.textContent).toMatch(/Quase lá/);
  });

  it("as 2 respostas do quiz viram toques: quanto sai por mês (eco) → 1 gasto → olhar → a vitória → Missão cumprida; e a volta leva c=, qg= e qv=", async () => {
    chave.modo = "kenny";
    await abrirDemo(DEMO_B);
    // toque 1: a pergunta de gasto do quiz, com as MESMAS opções
    const p1 = await screen.findByTestId("demo-guia-pergunta1", {}, { timeout: 4000 });
    expect(p1.textContent).toMatch(/Quanto você acha que gasta sem perceber, por mês\?/);
    expect(within(p1).getAllByTestId("demo-guia-pergunta1-chip")).toHaveLength(5);
    expect(screen.getByTestId("demo-guia-texto").textContent).toMatch(/Área escolhida ✓ · Agora: 1 toque, quanto sai por mês\?/);
    act(() => { fireEvent.click(within(p1).getByText("R$ 100 a R$ 300")); });
    // o eco: a tela de impacto de hoje, dentro do app
    const eco = await screen.findByTestId("demo-guia-pergunta1-eco");
    expect(eco.textContent).toMatch(/R\$ 300 somem por mês/);
    expect(eco.textContent).toMatch(/R\$ 3\.600 no ano/);
    expect(eventos("demo_guia_resposta")).toContainEqual(expect.objectContaining({ chave: "gasto", answer: "R$ 100 a R$ 300", funil: "b" }));
    expect(JSON.parse(localStorage.getItem("funnel-quiz-answers") ?? "{}")).toEqual(expect.objectContaining({ area: "dinheiro", gasto: "R$ 100 a R$ 300" }));
    act(() => { fireEvent.click(screen.getByTestId("demo-guia-pergunta1-seguir")); });
    // toque 2: o post-it dos gastos prontos (a missão de hoje)
    const postit = await screen.findByTestId("demo-guia-postit", {}, { timeout: 4000 });
    const chip = within(postit).getAllByTestId("demo-guia-chip").find((b) => b.textContent?.includes("Café")) as HTMLElement;
    await act(async () => { fireEvent.pointerDown(chip); fireEvent.click(chip); await Promise.resolve(); });
    const festa = await screen.findByTestId("demo-guia-comemoracao", {}, { timeout: 4000 });
    act(() => { fireEvent.click(within(festa).getByTestId("demo-guia-ver")); });
    const passo3 = await screen.findByTestId("demo-guia-passo3", {}, { timeout: 4000 });
    act(() => { fireEvent.click(within(passo3).getByTestId("demo-guia-continuar")); });
    // toque 3: a vitória da semana (a pergunta que dá o título do paywall)
    const p3 = await screen.findByTestId("demo-guia-pergunta3", {}, { timeout: 4000 });
    expect(p3.textContent).toMatch(/Qual seria uma vitória nos próximos 7 dias\?/);
    expect(screen.getByTestId("demo-guia-texto").textContent).toMatch(/1º registro: Café · R\$ 12 ✓ · Agora: sua vitória da semana/);
    act(() => { fireEvent.click(within(p3).getByText("Entender meus gastos")); });
    const fim = await screen.findByTestId("demo-guia-cumprida", {}, { timeout: 4000 });
    expect(within(fim).getByTestId("demo-guia-lista").textContent).toMatch(/Área escolhida: Finanças.*Café · R\$ 12 anotado.*Vitória: entender seus gastos/);
    expect(estadoDaMissao().respostas).toEqual({ gasto: "R$ 100 a R$ 300", vitoria: "Entender meus gastos" });
    // "Levar pros meus números" → guardando, com tudo na URL
    act(() => { fireEvent.click(within(fim).getByTestId("demo-guia-levar")); });
    await screen.findByTestId("fora");
    expect(screen.getByTestId("url").textContent).toBe("/inicio?step=guardando&porta=vida&c=gasto%7CCaf%C3%A9%7C12&f=b&qg=R%24+100+a+R%24+300&qv=Entender+meus+gastos");
    expect(eventos("demo_guia_feito")).toContainEqual(expect.objectContaining({ funil: "b" }));
  });

  it("chave 'off': f=b na URL é ignorado — a demo de hoje (sem missão do B, pílulas e volta iguais)", async () => {
    chave.modo = "off";
    await abrirDemo(DEMO_B);
    for (const h of hrefsDasPilulas()) expect(h).not.toContain("f=b");
    expect(screen.queryByTestId("demo-guia-pergunta1")).toBeNull();
    expect(eventos("funnel_view").find((e) => e.step === "demo")).not.toHaveProperty("funil");
    // (guia=1 continua valendo: é a missão de hoje)
    await screen.findByTestId("demo-guia-faixa", {}, { timeout: 4000 });
    act(() => { fireEvent.click(screen.getByTestId("demo-cta-travado")); });
    const volta = await waitFor(() => { const a = botaoDeBaixo(); if (!a) throw new Error("sem botão"); return a; });
    expect(volta.getAttribute("href")).toBe("/inicio?step=signup&porta=vida");
  });
});

/* ------------------------------------------------------------ o /inicio depois da demo */

describe("o /inicio no B", () => {
  const VOLTA = "/inicio?step=guardando&porta=vida&c=gasto%7CCaf%C3%A9%7C12&f=b&qg=R%24+100+a+R%24+300&qv=Entender+meus+gastos";

  it("'Guardando…' aquece o Pix (sem criar pedido) e cai no paywall SEM conta, com o checkout no modo B e a marca nos eventos", async () => {
    chave.modo = "kenny";
    localStorage.setItem("core-funnel-area", "dinheiro");
    // o bloco "construiu" lê a URL do navegador (a volta da demo é uma URL de verdade)
    window.history.replaceState({}, "", VOLTA);
    porta(VOLTA);
    expect(texto()).toMatch(/Guardando o que você fez/);
    expect(eventos("funnel_view").find((e) => e.step === "guardando")).toEqual(expect.objectContaining({ funil: "b" }));
    expect(pix.aquecer).toHaveBeenCalledWith(undefined, "w27");
    await screen.findByTestId("paywall-roi2", {}, { timeout: 8000 });
    expect(eventos("funnel_view").find((e) => e.step === "offer")).toEqual(expect.objectContaining({ funil: "b", roi2: true }));
    // sem cadastro no meio: nada de "Salva seu plano"
    expect(screen.queryByTestId("cadastro-roi2")).toBeNull();
    // "O que você já construiu" com os 3 registros dela (item + as 2 respostas)
    const construiu = await screen.findByTestId("construiu", {}, { timeout: 4000 });
    expect(construiu.textContent).toMatch(/Café · R\$ 12/);
    expect(construiu.textContent).toMatch(/Seu mês: ~R\$ 300 saindo sem você ver/);
    expect(construiu.textContent).toMatch(/Vitória da semana: entender seus gastos/);
    // o título usa a vitória e a âncora usa o gasto (as mesmas chaves do quiz de hoje)
    expect(texto()).toMatch(/entender seus gastos/);
    expect(texto()).toMatch(/R\$ 3\.600/);
    // o CTA abre o MESMO checkout (w27), no modo B
    fireEvent.click(screen.getByRole("button", { name: /Liberar os 16 módulos — R\$ 27,90 no Pix/ }));
    expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w27");
    expect(pix.props?.funilB).toEqual(expect.objectContaining({ aoConfirmar: expect.any(Function) }));
    expect(pix.props?.v2).toBeUndefined();
    expect(eventos("funnel_click").find((e) => e.cta === "paywall_lifetime")).toEqual(expect.objectContaining({ funil: "b" }));
    // pagou → o Pronto do funil (não a tela do checkout)
    act(() => { (pix.props?.funilB as { aoConfirmar: () => void }).aoConfirmar(); });
    await screen.findByTestId("pronto-b-stub");
  });

  it("sessão anônima DESLIGADA no painel: degrada pro cadastro de hoje (nunca um beco no checkout)", async () => {
    chave.modo = "kenny";
    sessao.anonimoLigado = false;
    porta(VOLTA);
    await screen.findByTestId("cadastro-roi2", {}, { timeout: 8000 });
    expect(eventos("funnel_view").find((e) => e.step === "b_sem_anonimo")).toEqual(expect.objectContaining({ funil: "b" }));
  });

  it("ROLLBACK: chave 'off' com ?step=guardando&f=b cai no cadastro de hoje, sem marca", () => {
    chave.modo = "off";
    porta(VOLTA);
    expect(screen.getByTestId("cadastro-roi2")).toBeTruthy();
    expect(texto()).not.toMatch(/Guardando o que você fez/);
    for (const e of eventos("funnel_view")) expect(e).not.toHaveProperty("funil");
  });

  it("?step=pronto&f=b mostra o Pronto; assinante no Pronto/offer NÃO é jogado pro app (a conta ainda é anônima)", async () => {
    chave.modo = "kenny";
    auth.user = { id: "anon-1" };
    auth.isSubscribed = true;
    porta("/inicio?step=pronto&f=b&c=gasto%7CCaf%C3%A9%7C12");
    await screen.findByTestId("pronto-b-stub");
    cleanup();
    // e no funil de hoje o assinante continua indo pro app (nada muda)
    const { container } = porta("/inicio?step=signup");
    expect(container.querySelector('[data-testid="cadastro-roi2"]')).toBeNull();
  });

  it("no paywall do B, a assinatura virando ativa (o webhook antes do checkout) leva pro Pronto", async () => {
    chave.modo = "kenny";
    sessao.anonimoLigado = true;
    localStorage.setItem("core-funnel-area", "dinheiro");
    const { rerender } = porta(VOLTA);
    await screen.findByTestId("paywall-roi2", {}, { timeout: 8000 });
    auth.user = { id: "anon-1" };
    auth.isSubscribed = true;
    rerender(<MemoryRouter initialEntries={[VOLTA]}><UserDataProvider><ComecarDia14 /></UserDataProvider></MemoryRouter>);
    await screen.findByTestId("pronto-b-stub", {}, { timeout: 4000 });
  });
});
