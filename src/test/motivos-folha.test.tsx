/**
 * "O QUE TE FEZ PARAR?" (1.0.18, dono 22/10) — lib/mensal-degraus (`motivos_folha`: off|on|ab, padrão OFF) +
 * components/paywall/FolhaMotivos, dentro do PaywallIOS do funil. Fechou a folha do anual com teste → antes do
 * presente 69,90, a folha dos motivos; cada motivo leva à sua resposta. "Achei caro" recusado → mensal 19,90
 * (MensalHeroi) se a offering `mensal_19` existir. 1x por sessão do paywall, braço nos eventos.
 * (Os mocks da loja são os do ofertas-saida.test.tsx.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9, precoMensal: "R$ 24,90",
  compraOk: true, motivo: null as string | null,
  presente: { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 } as null | { preco: string; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
  mensal19: { preco: "R$ 19,90", produto: "core_mensal_19" } as null | { preco: string; produto: string },
  compraPresenteOk: true, compraMensal19Ok: true,
  situacao: null as null | { lugar: "cancelou_teste" | "bloqueio"; fimMs: number | null },
  trialCancelado: true,
  ultimaFoiTrial: true,
  auth: {} as Record<string, unknown>,
}));
const notif = vi.hoisted(() => ({
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const), cancelar: vi.fn(async () => undefined),
  recuperar: vi.fn(async (_area: string | null) => ({ ok: true as const, quando: { tresHoras: new Date(), manha: new Date() } })),
  cancelarRecuperacao: vi.fn(async () => undefined),
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
  cancelarLembreteDoTeste: () => notif.cancelar(),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: (area: string | null) => notif.recuperar(area),
  cancelarRecuperacaoDoPaywall: () => notif.cancelarRecuperacao(),
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn().mockResolvedValue("pronto"),
  prefetchAnualIos: vi.fn(async () => undefined),
  temAnualIos: () => true,
  precoAnualIos: () => loja.preco,
  idProdutoAnualIos: () => "core_anual_97",
  mesesDeMensalQuePagamOAno: () => 4,
  ofertaAnualIos: () => "anual_97",
  dadosDaOfertaIos: () => ({ oferta: "anual_97", produto: "core_anual_97", offering: "default", preco: loja.preco, pacote: true }),
  precoMensalDoAnualIos: () => loja.mes,
  diasTrialIos: () => 3,
  anualIosTemTrial: () => true,
  ultimaCompraAnualFoiTrial: () => loja.ultimaFoiTrial,
  fimDaUltimaCompraTrial: () => null,
  comprarAnualIos: vi.fn(async () => loja.compraOk),
  comprar: vi.fn(async () => loja.compraOk),
  estadoRevenueCat: () => "pronto",
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => loja.motivo,
  sincronizarAssinatura: vi.fn(),
  valorAnualIos: () => loja.valorAnual,
  valorMensalIos: () => loja.valorMensal,
  precoMensalIos: () => loja.precoMensal,
  economiaDoAnualIos: () => (loja.valorAnual && loja.valorMensal ? Math.round((1 - loja.valorAnual / (12 * loja.valorMensal)) * 100) : null),
  situacaoDoPresente: vi.fn(async () => loja.situacao),
  carregarPresente69: vi.fn(async () => loja.presente),
  comprarPresente69: vi.fn(async () => loja.compraPresenteOk),
  carregarMensal19: vi.fn(async () => loja.mensal19),
  comprarMensal19: vi.fn(async () => loja.compraMensal19Ok),
  marcarToqueDeCompra: vi.fn(),
  estadoTrialCancelado: vi.fn(async () => loja.trialCancelado),
  problemaDeCobranca: vi.fn(async () => ({ temProblema: false, comAcesso: false, url: null })),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => loja.auth }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/purchase-tracking", () => ({ firePixPurchaseOnce: vi.fn(), temPixEmConfirmacao: () => false }));
vi.mock("@/lib/teste-gratis", async (original) => ({ ...(await original<typeof import("@/lib/teste-gratis")>()), trialCartaoAtivo: () => true }));
vi.mock("@/components/paywall/PaywallAssinatura", () => ({ PaywallAssinatura: () => <div data-testid="paywall-gate" /> }));
vi.mock("@/components/paywall/PaywallFlow", async (original) => ({ ...(await original<typeof import("@/components/paywall/PaywallFlow")>()), PaywallFlow: () => <div data-testid="paywall-web" /> }));


import { trackEvent } from "@/lib/analytics";
import { comprarMensal19, comprarAnualIos } from "@/lib/revenuecat";
import { _zerarChavesRemotas } from "@/lib/ofertas-saida";
import {
  MOTIVOS_FOLHA, CHAVE_BRACO_MOTIVOS, CHAVE_FORCA_MOTIVOS, _zerarMotivosRemoto, bracoMotivos, camposDosMotivos, guardarForcaMotivos,
  lerMotivosRemoto, modoMotivos, registrarMotivosRemoto, sortearBracoMotivos,
} from "@/lib/mensal-degraus";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const clicar = async (id: string) => { await act(async () => { fireEvent.click(screen.getByTestId(id)); }); await espera(); };
const passarExplicacao = async () => {
  const b = await screen.findByTestId("explica-folha-continuar");
  await act(async () => { fireEvent.click(b); });
};
const montarPaywall = (onPago = vi.fn()) => {
  render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};
const esperarLoja = () => screen.findByText("por mês · R$ 97,90/ano");
const fecharFolha97 = async () => {
  loja.compraOk = false; loja.motivo = "cancelou";
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ })); });
  await espera();
};
const ateMotivos = async () => {
  await esperarLoja();
  await fecharFolha97();
  return screen.findByTestId("folha-motivos");
};
const folha = () => screen.queryByTestId("folha-motivos");
const mensal = () => screen.queryByTestId("mensal-heroi-motivo_mensal");
const ligar = (v = "on") => guardarForcaMotivos(`?motivos-folha=${v}`);
const C = { funil: "ios", loja: "ios", area: "dinheiro", braco: "com" };

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  _zerarMotivosRemoto();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarMensal19).mockClear();
  vi.mocked(comprarAnualIos).mockClear();
  ios();
  loja.preco = "R$ 97,90"; loja.valorAnual = 97.9; loja.valorMensal = 24.9; loja.precoMensal = "R$ 24,90";
  loja.compraOk = true; loja.motivo = null; loja.compraPresenteOk = true; loja.compraMensal19Ok = true; loja.ultimaFoiTrial = true;
  loja.presente = { preco: "R$ 69,90", precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3 };
  loja.mensal19 = { preco: "R$ 19,90", produto: "core_mensal_19" };
  loja.situacao = null; loja.trialCancelado = true;
  loja.auth = {};
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("motivos da folha — a chave", () => {
  it("padrão OFF; metadata (current vence); força de QA; o aparelho guarda a última resposta", () => {
    expect(MOTIVOS_FOLHA).toBe("off");
    expect(modoMotivos()).toBe("off");
    expect(camposDosMotivos()).toEqual({});
    expect(lerMotivosRemoto({ current: { metadata: { motivos_folha: "ab" } }, all: { x: { metadata: { motivos_folha: "on" } } } })).toBe("ab");
    expect(lerMotivosRemoto({ current: { metadata: {} }, all: { mensal_19: { metadata: { motivos_folha: "ON" } } } })).toBe("on");
    expect(lerMotivosRemoto({ current: { metadata: { motivos_folha: "talvez" } } })).toBeNull();
    registrarMotivosRemoto({ current: { metadata: { motivos_folha: "on" } }, all: {} });
    _zerarMotivosRemoto();
    expect(modoMotivos()).toBe("on");
    registrarMotivosRemoto({ current: { metadata: {} }, all: {} });
    expect(modoMotivos()).toBe("off");
    ligar("ab");
    expect(modoMotivos()).toBe("ab");
    ligar("auto");
    expect(localStorage.getItem(CHAVE_FORCA_MOTIVOS)).toBeNull();
  });

  it("ab: 50/50 determinístico pelo aparelho, sorteado 1x e gravado", () => {
    const bracos = new Set(Array.from({ length: 40 }, (_, i) => sortearBracoMotivos(`aparelho-${i}`)));
    expect(bracos).toEqual(new Set(["com", "sem"]));
    ligar("ab");
    const b = bracoMotivos();
    expect(localStorage.getItem(CHAVE_BRACO_MOTIVOS)).toBe(b);
    localStorage.setItem(CHAVE_BRACO_MOTIVOS, b === "com" ? "sem" : "com");
    expect(bracoMotivos()).toBe(b === "com" ? "sem" : "com");
  });
});

describe("motivos da folha — no paywall do funil", () => {
  it("OFF (padrão): igual a hoje — a folha fechada abre o presente 69,90 direto; nenhum evento novo nem campo", async () => {
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    expect(await screen.findByTestId("presente69")).toBeInTheDocument();
    expect(folha()).toBeNull();
    expect(vi.mocked(trackEvent).mock.calls.some((c) => String(c[0]).startsWith("motivo"))).toBe(false);
    expect(eventos("funnel_view")[0]).not.toHaveProperty("motivos");
    expect(localStorage.getItem(CHAVE_BRACO_MOTIVOS)).toBeNull();
  });

  it("ON: a folha com os 5 motivos + 'Voltar ao plano' (sem vitalício), ANTES do presente; view com o braço", async () => {
    ligar();
    montarPaywall();
    const f = await ateMotivos();
    expect(screen.getByText("O que te fez parar?")).toBeInTheDocument();
    for (const t of ["Achei caro", "Tenho medo de esquecer de cancelar", "Quero conhecer o app antes", "Não tenho cartão na conta Apple", "Outro motivo", "Voltar ao plano"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(f.textContent).not.toMatch(/vital[ií]cio|Pix|site|24 ?h/i);
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("motivo_folha_view")).toEqual([C]);
    expect(eventos("funnel_view")[0]).toMatchObject({ motivos: "com" });
  });

  it("'Achei caro' → o presente 69,90; recusou ('Agora não') → o mensal 19,90 (cobra hoje); 'Agora não' → paywall", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-caro");
    expect(eventos("motivo_escolhido")).toEqual([{ ...C, motivo: "caro" }]);
    expect(folha()).toBeNull();
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "folha_cancelada");
    await espera(450);
    await clicar("presente69-agora-nao");
    const tela = await screen.findByTestId("mensal-heroi-motivo_mensal");
    expect(screen.getByText("Comece pelo mensal")).toBeInTheDocument();
    expect(screen.getByTestId("mensal-heroi-cta")).toHaveTextContent("Continuar com o mensal");
    expect(screen.getByTestId("mensal-heroi-regra").textContent).toBe("Cobrado hoje pela App Store. Renova todo mês até você cancelar.");
    expect(tela.textContent).not.toMatch(/24 ?h|Pix|site/i);
    expect(eventos("motivo_mensal_view")).toEqual([{ ...C, motivo: "caro", preco: "R$ 19,90", construido: 0 }]);
    await clicar("mensal-heroi-agora-nao");
    expect(mensal()).toBeNull();
    expect(eventos("motivo_mensal_agora_nao")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeInTheDocument();
  });

  it("'Achei caro' e fechou a folha do PRÓPRIO 69,90 → também o mensal", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-caro");
    await screen.findByTestId("presente69");
    await espera(450);
    loja.compraPresenteOk = false; // motivo segue "cancelou"
    await clicar("presente69-cta");
    await passarExplicacao();
    await espera();
    expect(await screen.findByTestId("mensal-heroi-motivo_mensal")).toBeInTheDocument();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });

  it("'Achei caro' SEM a offering mensal_19: o presente de sempre (folha fechada fica nele; 'Agora não' = paywall)", async () => {
    ligar();
    loja.mensal19 = null;
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-caro");
    await screen.findByTestId("presente69");
    await espera(450);
    await clicar("presente69-agora-nao");
    expect(mensal()).toBeNull();
    expect(eventos("motivo_mensal_view")).toHaveLength(0);
  });

  it("mensal do 'caro' comprado: core_mensal_19 (lugar motivo_mensal), resultado sucesso, app_sheet_success com braço, cadastro", async () => {
    ligar();
    const onPago = montarPaywall();
    await ateMotivos();
    await clicar("motivo-caro");
    await screen.findByTestId("presente69");
    await espera(450);
    await clicar("presente69-agora-nao");
    await screen.findByTestId("mensal-heroi-motivo_mensal");
    await clicar("mensal-heroi-cta");
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(comprarMensal19).toHaveBeenCalledWith("motivo_mensal");
    expect(eventos("motivo_mensal_compra")[0]).toMatchObject({ resultado: "sucesso", motivo: null });
    expect(eventos("app_sheet_success")).toEqual([expect.objectContaining({ produto: "core_mensal_19", oferta: "mensal19", lugar: "motivo_caro", motivos: "com" })]);
  });

  it("'Outro motivo' → o presente 69,90; recusado → paywall (sem mensal)", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-outro");
    await screen.findByTestId("presente69");
    await espera(450);
    await clicar("presente69-agora-nao");
    expect(mensal()).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
  });

  it("'Medo de esquecer' (aviso vai sair): a resposta do aviso, sem desconto; o botão é a MESMA compra do anual; sucesso contado", async () => {
    localStorage.setItem("__dev_aviso_teste", "sim");
    ligar();
    const onPago = montarPaywall();
    await ateMotivos();
    await espera();
    await clicar("motivo-medo_esquecer");
    expect(screen.getByTestId("motivo-resposta-medo_esquecer")).toBeInTheDocument();
    expect(screen.getByText("A gente te avisa antes")).toBeInTheDocument();
    expect(screen.getByTestId("motivo-resposta-texto").textContent).toBe("Um aviso 1 dia antes do teste acabar. Cancele quando quiser nos Ajustes do iPhone.");
    expect(folha()!.textContent).not.toMatch(/69,90|19,90|desconto|24 ?h|Pix|site/i);
    expect(screen.getByTestId("motivo-cta")).toHaveTextContent("Começar 3 dias grátis");
    loja.compraOk = true; loja.motivo = null;
    vi.mocked(comprarAnualIos).mockClear();
    await clicar("motivo-cta");
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(comprarAnualIos).toHaveBeenCalledTimes(1);
    expect(eventos("motivo_compra")).toEqual([{ ...C, motivo: "medo_esquecer", resultado: "sucesso", motivo_loja: null }]);
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_97", motivos: "com" });
  });

  it("'Medo de esquecer' sem permissão de aviso: não promete o aviso", async () => {
    localStorage.setItem("__dev_aviso_teste", "nao");
    ligar();
    montarPaywall();
    await ateMotivos();
    await espera();
    await clicar("motivo-medo_esquecer");
    expect(screen.getByText("Cancele quando quiser")).toBeInTheDocument();
    expect(screen.getByTestId("motivo-resposta-texto").textContent).not.toMatch(/aviso/i);
  });

  it("'Conhecer antes': 'São 3 dias grátis pra conhecer tudo'; a folha da Apple fechada de novo = 'cancelou' contado e nada reabre", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-conhecer_antes");
    expect(screen.getByText("São 3 dias grátis pra conhecer tudo")).toBeInTheDocument();
    await clicar("motivo-cta"); // loja.motivo segue "cancelou"
    await espera(60);
    expect(eventos("motivo_compra")).toEqual([{ ...C, motivo: "conhecer_antes", resultado: "cancelou", motivo_loja: "cancelou" }]);
    expect(folha()).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("motivo_folha_view")).toHaveLength(1);
  });

  it("'Sem cartão': o passo a passo dos Ajustes + 'Tentar de novo' (sem Pix/site); erro da loja = 'falhou' contado", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-sem_cartao");
    expect(screen.getByText("Adicione um cartão no iPhone")).toBeInTheDocument();
    expect(screen.getByTestId("motivo-passos-cartao").textContent).toMatch(/Ajustes.*seu nome.*Pagamento e Envio/);
    expect(folha()!.textContent).not.toMatch(/Pix|site|link/i);
    expect(screen.getByTestId("motivo-cta")).toHaveTextContent("Tentar de novo");
    loja.motivo = "billing_erro";
    await clicar("motivo-cta");
    await espera(60);
    expect(eventos("motivo_compra")[0]).toMatchObject({ motivo: "sem_cartao", resultado: "falhou", motivo_loja: "billing_erro" });
  });

  it("'Voltar ao plano': a folha sai, o paywall fica, sem presente; 1x por sessão (fechar a folha de novo não reabre)", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-voltar-plano");
    expect(folha()).toBeNull();
    expect(screen.queryByTestId("presente69")).toBeNull();
    expect(eventos("motivo_voltar_plano")).toEqual([{ ...C, motivo: null }]);
    await waitFor(() => expect(screen.getByRole("button", { name: /Começar 3 dias grátis/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Começar 3 dias grátis/ }));
    await passarExplicacao();
    await espera(60);
    expect(folha()).toBeNull();
    expect(eventos("motivo_folha_view")).toHaveLength(1);
  });

  it("reabrir o paywall (outra sessão): nada aparece sozinho", async () => {
    ligar();
    montarPaywall();
    await ateMotivos();
    cleanup();
    vi.mocked(trackEvent).mockClear();
    loja.compraOk = true; loja.motivo = null;
    montarPaywall();
    await esperarLoja();
    await espera(60);
    expect(folha()).toBeNull();
    expect(eventos("motivo_folha_view")).toHaveLength(0);
  });

  it("ab, braço 'sem': o presente direto (como hoje), e os eventos do paywall levam motivos: 'sem'", async () => {
    ligar("ab");
    localStorage.setItem(CHAVE_BRACO_MOTIVOS, "sem");
    montarPaywall();
    await esperarLoja();
    await fecharFolha97();
    expect(await screen.findByTestId("presente69")).toBeInTheDocument();
    expect(folha()).toBeNull();
    expect(eventos("funnel_view")[0]).toMatchObject({ motivos: "sem" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ motivos: "sem" });
  });

  it("ab, braço 'com': a folha aparece e o braço vai nos motivo_*", async () => {
    ligar("ab");
    localStorage.setItem(CHAVE_BRACO_MOTIVOS, "com");
    montarPaywall();
    await ateMotivos();
    await clicar("motivo-outro");
    expect(eventos("motivo_escolhido")[0]).toMatchObject({ braco: "com", motivo: "outro" });
  });
});
