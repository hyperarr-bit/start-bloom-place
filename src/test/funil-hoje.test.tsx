/**
 * FUNIL WEB NOVO (/hoje, 18/10): renda → contas → o número → oferta (anual 27,90 1º ano × mensal 14,90, Pix; bump do
 * Kit no MESMO Pix) → Pix na página SEM conta (sessão anônima) → upsells (pra sempre 47 → pra sempre 27 → vida a dois)
 * → e-mail depois de pagar → app web logado com Finanças montada + as lojas.
 *
 * O que não pode quebrar:
 *   · a chave: OFF leva pra landing com a query; ?funil-hoje=on liga (e fica no navegador);
 *   · o número é o do card QUANTO POSSO GASTAR HOJE (computeDailyBudget) e o que vai pra Finanças tem o formato do app;
 *   · Pix: a oferta certa (h279/h149/h279k/h149k), gerado SEM e-mail, copiar no toque, CNPJ do CORE (sem "em nome de");
 *   · cada upsell aparece no máximo 1 vez, sempre com "Não, obrigado"; o downsell (27) só depois do "Não" do 47;
 *   · depois de pagar: e-mail livre → mesma conta + Finanças/kit/boas-vindas; e-mail com conta → código (nunca 2ª conta);
 *   · os valores do cliente batem com os do servidor (ofertas-hoje.ts) e com o pixel (purchase-tracking).
 * 20/10: OFERTA_HOJE = "vitalicio" (padrão) — 1 opção, vitalício R$ 27,90 (hv279), sem upsells. As suítes do "anual"
 * (rollback) continuam rodando com `_forcarOfertaHoje("anual")`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const setSession = vi.fn();
const invoke = vi.fn();
const upserts: Array<unknown> = [];
let userDataExistente: Array<{ key: string; value: unknown }> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (tabela: string) => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: tabela === "user_data" ? userDataExistente : [], error: null }) }) }),
      upsert: (linhas: unknown) => { upserts.push(linhas); return Promise.resolve({ error: null }); },
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const garantirSessao = vi.fn();
const definirEmailDaCompra = vi.fn();
const guardarCompraAnonima = vi.fn(async () => {});
const vincularCompraAnonima = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: (...a: unknown[]) => garantirSessao(...a),
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: () => guardarCompraAnonima(),
  vincularCompraAnonima: (...a: unknown[]) => vincularCompraAnonima(...a),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { markPixPurchasePending } from "@/lib/purchase-tracking";
import FunilHojeRota, { _zerarEstadoHoje, proximoPosCompra } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import {
  CONTAS, FUNIL_HOJE, LINHA_RENOVACAO, OFERTA_HOJE, UPSELL_A_DOIS, VALOR_OFERTA, _forcarOfertaHoje, _zerarForcaHoje, calcular, contasEscolhidas, fimDoAcesso,
  funilHojeLigado, itensParaGravar, modoOfertaHoje, ofertaDoPlano,
} from "@/pages/hoje/conteudo";
import { BUMP_KIT } from "@/pages/hoje/conteudo";
const comKit = it.skipIf(!BUMP_KIT); // 19/10: bump desligado pelo dono — os testes do kit voltam quando ligar
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { computeDailyBudget } from "@/lib/finance-totals";
import { PRECOS_HOJE, CONCESSAO_HOJE } from "../../supabase/functions/_shared/ofertas-hoje";
import { PRECOS_PLANO30, PRECOS_PRESENTE } from "../../supabase/functions/_shared/presente";
import { VALORES_VENDA } from "../../supabase/functions/_shared/venda-capi";

/* ---------------------------------------------------------------- ambiente */
const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (url = "/hoje?funil-hoje=on&utm_source=meta&utm_campaign=hoje&fbclid=IwAR_x") => {
  irPara(url);
  return render(
    <MemoryRouter initialEntries={["/hoje"]}>
      <Routes>
        <Route path="/hoje" element={<FunilHojeRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
        <Route path="/financas" element={<div data-testid="financas">app</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const etapa = () => screen.getByTestId("hoje").getAttribute("data-etapa");
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const invocacoes = (fn: string, acao?: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body).filter((b) => !acao || b.action === acao);

let pedidos = 0;
let falharCreate = false;
const pagos = new Set<string>();
const parceiroOk = vi.fn(() => ({ ok: true }));
function servidor() {
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn !== "asaas-pix") return { data: { ok: true }, error: null };
    if (body.action === "create" && falharCreate) return { data: null, error: { message: "502" } };
    if (body.action === "create") { const id = `qr_${++pedidos}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (body.action === "check") return { data: { paid: pagos.has(String(body.id)) }, error: null };
    if (body.action === "parceiro") return { data: parceiroOk(), error: null };
    return { data: { ok: true }, error: null };
  });
}
const pagarEConferir = async (oferta: string) => {
  await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
  const ped = invocacoes("asaas-pix", "create").filter((b) => b.offer === oferta).length;
  expect(ped).toBeGreaterThan(0);
  pagos.add(`qr_${pedidos}_${oferta}`);
  fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
};
const ateOferta = async () => {
  montar();
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  for (const c of ["aluguel", "luz", "internet"]) fireEvent.click(screen.getByTestId(`hoje-conta-${c}`));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
  fireEvent.click(screen.getByTestId("hoje-ver-core"));
  await waitFor(() => expect(etapa()).toBe("oferta"));
};

const clip = vi.fn(async () => {});
beforeEach(() => {
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, updateUser, setSession, invoke, garantirSessao, definirEmailDaCompra, clip, parceiroOk].forEach((f) => f.mockReset());
  guardarCompraAnonima.mockClear(); vincularCompraAnonima.mockClear(); vincularCompraAnonima.mockResolvedValue(true);
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear(); vi.mocked(markPixPurchasePending).mockClear();
  upserts.length = 0; userDataExistente = []; pedidos = 0; pagos.clear(); falharCreate = false;
  // a sessão anônima: nasce no "Pagar com Pix" (garantirSessao), sem e-mail
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  parceiroOk.mockReturnValue({ ok: true });
  servidor();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: clip }, configurable: true });
});
afterEach(() => { cleanup(); irPara("/"); _forcarOfertaHoje(null); });
/** as suítes do desenho "anual" (1º ano × mensal + upsells) — o rollback da chave OFERTA_HOJE */
const comoAnual = () => beforeEach(() => _forcarOfertaHoje("anual"));

/* ---------------------------------------------------------------- chave e rota */
describe("a chave e a rota", () => {
  it("LIGADO (dono 18/10): /hoje abre o funil; ?funil-hoje=off leva pra landing levando a query (utm/fbclid)", () => {
    expect(FUNIL_HOJE).toBe("on");
    montar("/hoje?funil-hoje=off&utm_source=meta&fbclid=IwAR_y");
    expect(screen.getByTestId("landing")).toBeTruthy();
  });
  it("?funil-hoje=on liga e fica no navegador; ?funil-hoje=off desliga", () => {
    expect(funilHojeLigado("?funil-hoje=on")).toBe(true);
    expect(funilHojeLigado("")).toBe(true);
    expect(funilHojeLigado("?funil-hoje=off")).toBe(false);
    expect(funilHojeLigado("")).toBe(false);
  });
  it("App.tsx: /hoje só na web (SoNaWeb), sem link em lugar nenhum do site", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/hoje" element={<SoNaWeb><RouteErrorBoundary routeName="funil-hoje"><FunilHoje /></RouteErrorBoundary></SoNaWeb>} />');
    for (const f of ["src/pages/site/Landing.tsx", "src/pages/site/SiteHome.tsx", "src/pages/site/Suporte.tsx"]) {
      try { expect(readFileSync(join(process.cwd(), f), "utf8")).not.toMatch(/["'`]\/hoje\b/); } catch (e) { if ((e as { code?: string }).code !== "ENOENT") throw e; }
    }
  });
  it("noindex + hoje_view + ViewContent com o fbclid da campanha", () => {
    montar();
    expect(document.head.querySelector('meta[name="robots"][data-hoje]')?.getAttribute("content")).toMatch(/noindex/);
    expect(eventos("hoje_view")[0]).toMatchObject({ utm_campaign: "hoje", fbclid: "IwAR_x" });
    expect(vi.mocked(fireMetaEvent).mock.calls.find((c) => c[0] === "ViewContent")?.[2]).toMatch(/^venda_vc_/);
  });
});

/* ---------------------------------------------------------------- o cálculo */
describe("o número e o que vai pra Finanças", () => {
  const dia = new Date(2026, 9, 18, 12);
  it("é a mesma conta do card QUANTO POSSO GASTAR HOJE", () => {
    const contas = contasEscolhidas({ aluguel: 900, luz: 150, internet: 100 });
    const r = calcular(3000, contas, dia);
    const b = computeDailyBudget(3000, 1150, [], contas.map((c) => ({ id: c.id, value: c.valor })), dia);
    expect(r).toMatchObject({ renda: 3000, fixos: 1150, n: 3, porDia: Math.round(b.perDay), aperto: false });
    expect(r.porDia).toBeGreaterThan(0);
  });
  it("contas que passam da renda: aperto, R$ 0 por dia", () => {
    const r = calcular(1500, contasEscolhidas({ aluguel: 900, cartao: 600, luz: 150 }), dia);
    expect(r.aperto).toBe(true);
    expect(r.porDia).toBe(0);
    expect(r.livre).toBeLessThan(0);
  });
  it("itensParaGravar: o formato do IncomeTable/FixedExpensesTable (receita do dia + fixos no boleto, categorias do módulo)", () => {
    const { receita, fixos } = itensParaGravar(3000, contasEscolhidas({ aluguel: 900, cartao: 600, streaming: 0 }), dia);
    expect(receita).toEqual([{ id: expect.stringMatching(/^fh-/), description: "Renda do mês", value: 3000, date: "2026-10-18" }]);
    expect(fixos).toEqual([
      { id: expect.any(String), description: "Aluguel", category: "moradia", value: 900, paymentMethod: "boleto" },
      { id: expect.any(String), description: "Fatura do cartão", category: "fatura_cartao", value: 600, paymentMethod: "boleto" },
    ]);
  });
  it("toda conta tem categoria que existe em FIXED_CATEGORIES", async () => {
    const { FIXED_CATEGORIES } = await import("@/lib/finance-categories");
    const validas = new Set(FIXED_CATEGORIES.map((c) => c.value));
    for (const c of CONTAS) expect(validas.has(c.categoria)).toBe(true);
  });
});

/* ---------------------------------------------------------------- ofertas: cliente × servidor */
describe("as ofertas batem com o servidor", () => {
  it("VALOR_OFERTA (reais) = PRECOS_HOJE (centavos) do ofertas-hoje.ts (+ 21/10: o presente e o plano de 30 dias, presente.ts)", () => {
    const servidor: Record<string, number> = { ...PRECOS_HOJE, ...PRECOS_PRESENTE, ...PRECOS_PLANO30 };
    for (const [o, v] of Object.entries(VALOR_OFERTA)) expect(servidor[o]).toBe(Math.round(v * 100));
    expect(Object.keys(servidor).sort()).toEqual(Object.keys(VALOR_OFERTA).sort());
  });
  it("o que cada oferta concede: 1º ano 365 dias, mês 30, kit = mesmo prazo, upsells vitalício em linha própria, casal não credita quem pagou", () => {
    expect(CONCESSAO_HOJE.h279).toMatchObject({ periodo: "annual", dias: 365 });
    expect(CONCESSAO_HOJE.h279k).toMatchObject({ periodo: "annual", dias: 365 });
    expect(CONCESSAO_HOJE.h149).toMatchObject({ periodo: "monthly_prepaid", dias: 30 });
    expect(CONCESSAO_HOJE.h149k).toMatchObject({ periodo: "monthly_prepaid", dias: 30 });
    expect(CONCESSAO_HOJE.hv47).toMatchObject({ dias: null, linhaNova: true });
    expect(CONCESSAO_HOJE.hv27).toMatchObject({ dias: null, linhaNova: true });
    expect(CONCESSAO_HOJE.hc199).toBeUndefined();
  });
  it("o pixel do navegador conhece as ofertas com o valor certo; a venda-capi aceita os valores do InitiateCheckout", () => {
    const pt = readFileSync(join(process.cwd(), "src/lib/purchase-tracking.ts"), "utf8");
    for (const [o, v] of Object.entries(VALOR_OFERTA)) expect(pt).toMatch(new RegExp(`\\b${o}: ${String(v).replace(".", "\\.")},`));
    for (const v of [27.9, 14.9, 37.8, 24.8]) expect((VALORES_VENDA as readonly number[]).includes(v)).toBe(true);
  });
  comKit("ofertaDoPlano: o bump vai no MESMO Pix", () => {
    expect(ofertaDoPlano("anual", false)).toBe("h279");
    expect(ofertaDoPlano("anual", true)).toBe("h279k");
    expect(ofertaDoPlano("mensal", false)).toBe("h149");
    expect(ofertaDoPlano("mensal", true)).toBe("h149k");
  });
});

/* ---------------------------------------------------------------- os passos */
describe("os passos até a oferta", () => {
  it("faixa avança no toque; contas; o número; funnel_view por tela", async () => {
    await ateOferta();
    expect(eventos("hoje_faixa")[0]).toMatchObject({ faixa: "2a4" });
    expect(eventos("hoje_contas")[0]).toMatchObject({ n: 3, contas: "aluguel,luz,internet" });
    expect(eventos("hoje_resultado")[0]).toMatchObject({ aperto: false, n: 3 });
    expect(eventos("funnel_view").map((e) => e.step)).toEqual(expect.arrayContaining(["renda", "contas", "resultado", "oferta"]));
    expect(eventos("funnel_view").every((e) => e.funil === "hoje")).toBe(true);
  });
  it("prefiro digitar: o valor digitado vira a renda", async () => {
    montar();
    fireEvent.click(screen.getByTestId("hoje-digitar"));
    fireEvent.change(screen.getByTestId("hoje-renda"), { target: { value: "3.200" } });
    fireEvent.click(screen.getByTestId("hoje-renda-continuar"));
    await waitFor(() => expect(etapa()).toBe("contas"));
    expect(texto()).toContain("Entra R$ 3.200");
  });
  it("[anual] oferta enxuta: anual 27,90 '1º ano, no Pix' × mensal 14,90 '30 dias, no Pix'; renovação UMA vez embaixo do botão; nada de cartão", async () => {
    _forcarOfertaHoje("anual");
    await ateOferta();
    expect(screen.getByTestId("hoje-plano-anual").textContent).toContain("1º ano, no Pix");
    expect(screen.getByTestId("hoje-plano-mensal").textContent).toContain("30 dias, no Pix");
    expect(screen.getByTestId("hoje-renovacao").textContent).toBe(LINHA_RENOVACAO.anual);
    expect(texto().match(/97,90/g)?.length).toBe(1);
    expect(texto()).toContain("No iPhone, no Android e no computador");
    expect(texto()).not.toMatch(/cart[aã]o de cr[eé]dito|no cart[aã]o|cancela quando quiser|em nome de/i);
    fireEvent.click(screen.getByTestId("hoje-plano-mensal"));
    expect(screen.getByTestId("hoje-renovacao").textContent).toBe(LINHA_RENOVACAO.mensal);
    expect(screen.getByTestId("hoje-pagar").textContent).toContain("R$ 14,90");
  });
  comKit("o bump soma no botão (37,80) e é desmarcado por padrão", async () => {
    _forcarOfertaHoje("anual");
    await ateOferta();
    expect(screen.getByTestId("hoje-bump").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("hoje-pagar").textContent).toContain("R$ 27,90");
    fireEvent.click(screen.getByTestId("hoje-bump"));
    expect(screen.getByTestId("hoje-pagar").textContent).toContain("R$ 37,80");
  });
});

/* ---------------------------------------------------------------- Pix */
describe("[anual] o Pix (mock da asaas-pix)", () => {
  comoAnual();
  it("gera SEM e-mail na sessão anônima, com a oferta do plano + fbp/fbc/url; InitiateCheckout com o valor; copiar no toque; CNPJ", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(garantirSessao).toHaveBeenCalled();
    expect(definirEmailDaCompra).not.toHaveBeenCalled();
    const c = invocacoes("asaas-pix", "create")[0];
    expect(c).toMatchObject({ action: "create", offer: "h279" });
    expect(String(c.sourceUrl)).toContain("/hoje");
    expect(vi.mocked(fireMetaEvent).mock.calls.find((x) => x[0] === "InitiateCheckout")?.[1]).toMatchObject({ value: 27.9, currency: "BRL" });
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "h279", orderId: "qr_1_h279" });
    expect(screen.getByTestId("hoje-cnpj").textContent).toBe("CORE · CNPJ 55.041.112/0001-82");
    expect(texto()).not.toMatch(/em nome de/i);
    expect(clip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("hoje-copiar"));
    await waitFor(() => expect(clip).toHaveBeenCalledWith("000201PIXqr_1_h279"));
    await waitFor(() => expect(eventos("hoje_pix_copiado")[0]).toMatchObject({ ok: true, oferta: "h279" }));
  });
  comKit("com o kit, o Pix é o h279k de R$ 37,80", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-bump"));
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(invocacoes("asaas-pix", "create")[0]).toMatchObject({ offer: "h279k" }));
    expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 37,80");
  });
  it("'Já paguei' sem o Pix ter caído: avisa e continua no Pix", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("hoje-ainda-nao")).toBeTruthy());
    expect(etapa()).toBe("pix");
  });
  it("erro ao gerar: mensagem + tentar de novo", async () => {
    falharCreate = true;
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-pix-tentar")).toBeTruthy());
    expect(eventos("hoje_erro")[0]).toMatchObject({ onde: "pix_create" });
  });
});

/* ---------------------------------------------------------------- upsells */
describe("[anual] upsells: 1 tela cada, sempre com 'Não, obrigado'", () => {
  comoAnual();
  it("proximoPosCompra: 47 → (recusou) 27 → [vida a dois, desligada no lançamento] → e-mail; cada um 1 vez", () => {
    expect(UPSELL_A_DOIS).toBe(false);
    expect(proximoPosCompra({ pagos: [], recusou: [], parceiro: null })).toBe("up1");
    expect(proximoPosCompra({ pagos: [], recusou: ["hv47"], parceiro: null })).toBe("down");
    expect(proximoPosCompra({ pagos: [], recusou: ["hv47", "hv27"], parceiro: null })).toBe("pago");
    expect(proximoPosCompra({ pagos: [{ oferta: "hv47", orderId: "x", em: 0 }], recusou: [], parceiro: null })).toBe("pago");
    // religada (UPSELL_A_DOIS = true): casal → e-mail da(o) parceira(o) → pago
    expect(proximoPosCompra({ pagos: [], recusou: ["hv47", "hv27"], parceiro: null }, true)).toBe("up2");
    expect(proximoPosCompra({ pagos: [{ oferta: "hc199", orderId: "y", em: 0 }], recusou: ["hv47", "hv27"], parceiro: null }, true)).toBe("parceiro");
    expect(proximoPosCompra({ pagos: [{ oferta: "hc199", orderId: "y", em: 0 }], recusou: ["hv47", "hv27"], parceiro: "p@x.com" }, true)).toBe("pago");
    expect(proximoPosCompra({ pagos: [], recusou: ["hv47", "hv27", "hc199"], parceiro: null }, true)).toBe("pago");
  });
  it("pagou o plano → 47 (Não) → 27 (Sim, paga) → direto pro e-mail (sem vida a dois); eventos de cada um", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await pagarEConferir("h279");
    await waitFor(() => expect(etapa()).toBe("up1"));
    expect(screen.getByTestId("hoje-confirmado").textContent).toContain("R$ 27,90");
    expect(screen.getByTestId("hoje-up1").textContent).toContain("Troque o 1º ano pelo CORE pra sempre");
    expect(screen.getByTestId("hoje-up1-nao").textContent).toBe("Não, obrigado");
    // 18/10 (desenho animado aprovado): o gráfico renovando × pra sempre diz em letra pequena que a renovação é escolha
    expect(screen.getByTestId("hoje-up1-nota").textContent).toContain("se você renovar todo ano por R$ 97,90");
    expect(screen.getByTestId("hoje-up1-grafico").textContent).toContain("R$ 74,90");
    expect(screen.getByTestId("hoje").className).toContain("ua");
    fireEvent.click(screen.getByTestId("hoje-up1-nao"));
    await waitFor(() => expect(etapa()).toBe("down"));
    expect(screen.getByTestId("hoje-down").textContent).toContain("O CORE pra sempre por R$ 27");
    expect(screen.getByTestId("hoje-down-etiqueta").getAttribute("aria-label")).toBe("De R$ 47 por R$ 27");
    expect(screen.getByTestId("hoje-down-nao").textContent).toBe("Não, obrigado");
    fireEvent.click(screen.getByTestId("hoje-down-sim"));
    await pagarEConferir("hv27");
    await waitFor(() => expect(etapa()).toBe("pago"));
    const up = eventos("hoje_upsell").map((x) => `${x.oferta}:${x.acao}`);
    expect(up).toEqual(["hv47:vista", "hv47:recusou", "hv27:vista", "hv27:aceitou", "hv27:pago"]);
    expect(eventos("hoje_pago").map((x) => `${x.oferta}:${x.valor}`)).toEqual(["h279:27.9", "hv27:27"]);
    expect(texto()).toContain("R$ 54,90 recebido · acesso pra sempre");
    expect(screen.getByTestId("hoje-pago-pra-sempre")).toBeTruthy();
    expect(screen.getByTestId("hoje-confete")).toBeTruthy();
    expect(texto()).not.toMatch(/vida a dois|2ª conta/i);
  });
  it("aceitou o de 47: o de 27 não aparece; vai pro e-mail", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await pagarEConferir("h279");
    await waitFor(() => expect(etapa()).toBe("up1"));
    fireEvent.click(screen.getByTestId("hoje-up1-sim"));
    await pagarEConferir("hv47");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(invocacoes("asaas-pix", "create").map((b) => b.offer)).toEqual(["h279", "hv47"]);
  });
  it("recusou os dois: vai direto pro e-mail, sem o downsell repetir", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-plano-mensal"));
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await pagarEConferir("h149");
    await waitFor(() => expect(etapa()).toBe("up1"));
    expect(screen.getByTestId("hoje-up1").textContent).toContain("Troque os 30 dias pelo CORE pra sempre");
    expect(screen.getByTestId("hoje-up1-nota").textContent).toContain("se você renovar todo mês por R$ 14,90");
    fireEvent.click(screen.getByTestId("hoje-up1-nao"));
    await waitFor(() => expect(etapa()).toBe("down"));
    fireEvent.click(screen.getByTestId("hoje-down-nao"));
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(invocacoes("asaas-pix", "create")).toHaveLength(1);
    expect(screen.queryByTestId("hoje-pago-pra-sempre")).toBeNull();
  });
});

/* ---------------------------------------------------------------- pós-compra */
const atePosCompra = async (kit = false) => {
  await ateOferta();
  if (kit) fireEvent.click(screen.getByTestId("hoje-bump"));
  fireEvent.click(screen.getByTestId("hoje-pagar"));
  await pagarEConferir(kit ? "h279k" : "h279");
  await waitFor(() => expect(etapa()).toBe("up1"));
  fireEvent.click(screen.getByTestId("hoje-up1-nao"));
  await waitFor(() => expect(etapa()).toBe("down"));
  fireEvent.click(screen.getByTestId("hoje-down-nao"));
  await waitFor(() => expect(screen.getByTestId("hoje-email")).toBeTruthy());
};
describe("[anual] pós-compra: 1 campo de e-mail", () => {
  comoAnual();
  it("e-mail livre → MESMA conta; Finanças nas chaves do app; kit; boas-vindas; lojas + e-mail; abre o app web", async () => {
    await atePosCompra(BUMP_KIT);
    const ped = BUMP_KIT ? "qr_1_h279k" : "qr_1_h279";
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "Mari@Exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    expect(definirEmailDaCompra).toHaveBeenCalledWith("mari@exemplo.com");
    const fin = upserts.find((u) => Array.isArray(u)) as Array<{ key: string; value: unknown[] }>;
    expect(fin.map((l) => l.key)).toEqual(["finance-incomes", "finance-fixed-expenses"]);
    expect(fin[0].value).toEqual([expect.objectContaining({ description: "Renda do mês", value: 3000 })]);
    expect((fin[1].value as Array<{ description: string }>).map((x) => x.description)).toEqual(["Aluguel", "Luz", "Internet"]);
    // 21/10 (segurança): o kit do bump é gravado pelo SERVIDOR na confirmação do Pix — a página nunca grava a chave paga
    expect(upserts.some((u) => (u as { key?: string })?.key === "core-kit-primeiro-mes")).toBe(false);
    expect(invocacoes("asaas-pix", "boas_vindas")[0]).toMatchObject({ id: ped });
    expect(updateUser).toHaveBeenCalledWith({ data: { hoje: expect.objectContaining({ v: 1, plano: "anual" }) } });
    expect(screen.getByTestId("hoje-lojas").textContent).toContain("mari@exemplo.com");
    expect(screen.getByTestId("selo-app-store")).toBeTruthy();
    expect(screen.getByTestId("selo-google-play")).toBeTruthy();
    expect(eventos("hoje_email_salvo")[0]).toMatchObject({ via: "nova" });
    fireEvent.click(screen.getByTestId("hoje-abrir"));
    await waitFor(() => expect(screen.getByTestId("financas")).toBeTruthy());
    expect(eventos("hoje_app_aberto")).toHaveLength(1);
  });
  it("conta que já usa Finanças não é tocada", async () => {
    userDataExistente = [{ key: "finance-incomes", value: [{ id: "x", value: 5000 }] }];
    await atePosCompra();
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    expect(upserts.find((u) => Array.isArray(u))).toBeUndefined();
    expect(eventos("hoje_financas")[0]).toMatchObject({ r: "ja_tinha" });
  });
  it("e-mail que JÁ tem conta → guarda a sessão anônima e pede o código (nunca 2ª conta); depois do código, traz a compra", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    await atePosCompra();
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-existe")).toBeTruthy());
    expect(guardarCompraAnonima).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ email: expect.anything() }));
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /código/i })).toBeTruthy());
    fireEvent.change(screen.getByRole("textbox", { name: /código/i }), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar|confirmar/i }));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    expect(vincularCompraAnonima).toHaveBeenCalledWith("anon-1", true);
    expect(eventos("hoje_email_salvo")[0]).toMatchObject({ via: "codigo" });
  });
  it("e-mail errado não salva", async () => {
    await atePosCompra();
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@" } });
    expect((screen.getByTestId("hoje-salvar-email") as HTMLButtonElement).disabled).toBe(true);
  });
});

/* ---------------------------------------------------------------- e-mail opcional na tela do Pix */
describe("[anual] e-mail OPCIONAL na tela do Pix (não bloqueia; só aparece com o código)", () => {
  comoAnual();
  const atePix = async () => {
    await ateOferta();
    expect(screen.queryByTestId("hoje-email-pix")).toBeNull();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-email-pix")).toBeTruthy());
  };
  it("e-mail livre: entra na própria conta anônima; o pós-compra não pede de novo (a conta já tem e-mail)", async () => {
    await atePix();
    expect(texto()).toContain("Quer receber o acesso por e-mail? (opcional)");
    fireEvent.change(screen.getByTestId("hoje-email-pix-campo"), { target: { value: "Mari@Exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-email-pix-salvar"));
    await waitFor(() => expect(screen.getByTestId("hoje-email-pix-ok")).toBeTruthy());
    expect(definirEmailDaCompra).toHaveBeenCalledWith("mari@exemplo.com");
    expect(invocacoes("asaas-pix", "email_pedido")).toHaveLength(0);
    expect(eventos("hoje_email_pix")[0]).toMatchObject({ ok: true, via: "conta" });
    // a conta agora tem e-mail: depois do pagamento e dos upsells, o pós-compra vai direto pras lojas
    getUser.mockImplementation(async () => ({ data: { user: { id: "anon-1", email: "mari@exemplo.com", user_metadata: {} } } }));
    await pagarEConferir("h279");
    await waitFor(() => expect(etapa()).toBe("up1"));
    fireEvent.click(screen.getByTestId("hoje-up1-nao"));
    await waitFor(() => expect(etapa()).toBe("down"));
    fireEvent.click(screen.getByTestId("hoje-down-nao"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    expect(eventos("hoje_email_salvo")[0]).toMatchObject({ via: "ja_logada" });
  });
  it("e-mail que já tem conta: vira o DESTINO do pedido no servidor; o pós-compra vem preenchido", async () => {
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    await atePix();
    fireEvent.change(screen.getByTestId("hoje-email-pix-campo"), { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-email-pix-salvar"));
    await waitFor(() => expect(screen.getByTestId("hoje-email-pix-ok")).toBeTruthy());
    expect(invocacoes("asaas-pix", "email_pedido")[0]).toMatchObject({ id: "qr_1_h279", email: "ana@exemplo.com" });
    expect(eventos("hoje_email_pix")[0]).toMatchObject({ ok: true, via: "destino" });
    await pagarEConferir("h279");
    await waitFor(() => expect(etapa()).toBe("up1"));
    fireEvent.click(screen.getByTestId("hoje-up1-nao"));
    fireEvent.click(await screen.findByTestId("hoje-down-nao"));
    await waitFor(() => expect((screen.getByTestId("hoje-email") as HTMLInputElement).value).toBe("ana@exemplo.com"));
  });
  it("sem preencher nada: o Pix segue normal", async () => {
    await atePix();
    await pagarEConferir("h279");
    await waitFor(() => expect(etapa()).toBe("up1"));
    expect(invocacoes("asaas-pix", "email_pedido")).toHaveLength(0);
  });
});

describe("bump desligado (19/10)", () => {
  it.skipIf(BUMP_KIT)("sem o post-it do kit na oferta e o anual é o h279 de R$ 27,90", () => {
    expect(ofertaDoPlano("anual", true)).toBe("h279");
    expect(ofertaDoPlano("mensal", true)).toBe("h149");
  });
});

/* ---------------------------------------------------------------- 20/10: a oferta do /inicio (padrão) */
describe("OFERTA_HOJE = 'vitalicio' (padrão, dono 20/10): a MESMA oferta do /inicio", () => {
  it("a chave: padrão vitalício; o rollback é 'anual'", () => {
    expect(OFERTA_HOJE).toBe("vitalicio");
    expect(modoOfertaHoje()).toBe("vitalicio");
    _forcarOfertaHoje("anual");
    expect(modoOfertaHoje()).toBe("anual");
    _forcarOfertaHoje(null);
    expect(modoOfertaHoje()).toBe("vitalicio");
  });
  it("tela enxuta: UMA opção — 'CORE pra sempre' · R$ 27,90 · 'Pague 1x. Seu pra sempre.' + provas + garantia + botão; sem plano, sem mensal, sem 'renova'", async () => {
    await ateOferta();
    const card = screen.getByTestId("hoje-oferta-vitalicio");
    expect(card.textContent).toContain("CORE pra sempre");
    expect(card.textContent).toContain("R$ 27,90");
    expect(card.textContent).toContain("Pague 1x. Seu pra sempre.");
    expect(texto()).toContain("Finanças montada + 15 áreas da vida");
    expect(texto()).toContain("No iPhone, no Android e no computador");
    expect(texto()).toContain("Garantia de 7 dias");
    expect(screen.getByTestId("hoje-pagar").textContent).toBe("Pagar R$ 27,90 com Pix");
    expect(screen.queryByTestId("hoje-plano-anual")).toBeNull();
    expect(screen.queryByTestId("hoje-plano-mensal")).toBeNull();
    expect(screen.queryByTestId("hoje-renovacao")).toBeNull();
    expect(screen.queryByTestId("hoje-bump")).toBeNull();
    expect(texto()).not.toMatch(/97,90|14,90|renova|1º ano|mensal|anual/i);
  });
  it("Pix = hv279 de R$ 27,90 (InitiateCheckout 27,90 core_vitalicio_hoje); pagou → DIRETO pro pós-compra (sem o 47 nem o 27); eventos com oferta/plano", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(invocacoes("asaas-pix", "create")[0]).toMatchObject({ action: "create", offer: "hv279" });
    expect(screen.getByTestId("hoje-pix-valor").textContent).toBe("R$ 27,90");
    expect(texto()).toContain("CORE pra sempre");
    expect(vi.mocked(fireMetaEvent).mock.calls.find((x) => x[0] === "InitiateCheckout")?.[1]).toMatchObject({ value: 27.9, currency: "BRL", content_name: "core_vitalicio_hoje" });
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "hv279", orderId: "qr_1_hv279" });
    expect(eventos("funnel_click").find((x) => x.cta === "pagar_pix")).toMatchObject({ plano: "vitalicio", oferta: "hv279", valor: 27.9, oferta_hoje: "vitalicio" });
    expect(eventos("hoje_pix_gerado")[0]).toMatchObject({ oferta: "hv279", valor: 27.9, oferta_hoje: "vitalicio" });
    await pagarEConferir("hv279");
    await waitFor(() => expect(etapa()).toBe("pago"));
    expect(eventos("hoje_pago")).toEqual([expect.objectContaining({ oferta: "hv279", plano: "vitalicio", valor: 27.9, order_id: "qr_1_hv279", oferta_hoje: "vitalicio" })]);
    expect(eventos("hoje_upsell")).toHaveLength(0);
    expect(eventos("funnel_view").map((x) => x.step)).not.toEqual(expect.arrayContaining(["up1"]));
    expect(eventos("funnel_view").map((x) => x.step)).not.toEqual(expect.arrayContaining(["down"]));
    expect(invocacoes("asaas-pix", "create")).toHaveLength(1);
    expect(texto()).toContain("R$ 27,90 recebido · acesso pra sempre");
    expect(screen.getByTestId("hoje-pago-pra-sempre")).toBeTruthy();
    expect(texto()).not.toMatch(/vida a dois|2ª conta|Kit Primeiro/i);
  });
  it("pós-compra: e-mail → Finanças + boas-vindas do pedido hv279 + atribuição plano 'vitalicio' + lojas; abre o app", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("hoje-pagar"));
    await pagarEConferir("hv279");
    await waitFor(() => expect(screen.getByTestId("hoje-email")).toBeTruthy());
    fireEvent.change(screen.getByTestId("hoje-email"), { target: { value: "mari@exemplo.com" } });
    fireEvent.click(screen.getByTestId("hoje-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("hoje-lojas")).toBeTruthy());
    expect(invocacoes("asaas-pix", "boas_vindas")[0]).toMatchObject({ id: "qr_1_hv279" });
    expect((upserts.find((u) => Array.isArray(u)) as Array<{ key: string }>).map((l) => l.key)).toEqual(["finance-incomes", "finance-fixed-expenses"]);
    expect(upserts.some((u) => (u as { key?: string })?.key === "core-kit-primeiro-mes")).toBe(false);
    expect(updateUser).toHaveBeenCalledWith({ data: { hoje: expect.objectContaining({ plano: "vitalicio", pagos: ["hv279"] }) } });
    expect(screen.getByTestId("selo-app-store")).toBeTruthy();
    expect(screen.getByTestId("selo-google-play")).toBeTruthy();
    expect(screen.getByTestId("hoje-lojas").textContent).toContain("mari@exemplo.com");
    fireEvent.click(screen.getByTestId("hoje-abrir"));
    await waitFor(() => expect(screen.getByTestId("financas")).toBeTruthy());
  });
  it("proximoPosCompra: quem pagou o hv279 já é pra sempre — nenhum upsell; fimDoAcesso vitalício", () => {
    expect(proximoPosCompra({ pagos: [{ oferta: "hv279", orderId: "x", em: 0 }], recusou: [], parceiro: null })).toBe("pago");
    expect(fimDoAcesso("anual", ["hv279"]).vitalicio).toBe(true);
    expect(fimDoAcesso("anual", ["h279"]).vitalicio).toBe(false);
  });
  it("todo evento do /hoje leva oferta_hoje", async () => {
    await ateOferta();
    for (const nome of ["hoje_view", "funnel_view", "hoje_faixa", "hoje_resultado"]) expect(eventos(nome).every((x) => x.oferta_hoje === "vitalicio")).toBe(true);
  });
});
