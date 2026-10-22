/**
 * PAYWALL MINIMALISTA DO iPHONE (17/10, 1.0.16) — chave `paywall_minimalista` (lib/paywall-minimalista), LIGADA.
 * Copy do dono ("minimalismo é melhor"), linha do tempo do Blinkist (+23% conversão, −55% reclamação de cobrança):
 *  · pura (LinhaDoTempoDoTeste): Hoje — R$ 0,00 · Amanhã — Lembrete · Dia 3 — {anual da loja}/ano, sem datas; 7 dias →
 *    "Dia 6"/"Dia 7"; sem permissão de aviso → sem o lembrete; o dia do lembrete é a MESMA conta do aviso 920001;
 *  · a tela: título + subtítulo + linha + UM cartão do plano + "Começar teste grátis" + "Ver plano mensal" + legal de
 *    1 linha + Termos · Privacidade · Restaurar + Tenho um código; nada da tela de antes (imagem, "3 DIAS GRÁTIS",
 *    economize, mensal à vista, "Sem cobrança hoje · a gente te avisa", pílula de 1,2 s, legal de 2 linhas);
 *  · preços da loja nos braços 97,90 · 119,90 · 69,90; 7 dias; sem direito ao teste; o mensal pelo link;
 *  · eventos: `minimalista: true` + `paywall_linha_tempo_view` 1x por paywall aberto;
 *  · a chave off (metadata que chega com as offerings, ou `?paywall-minimalista=off`) = o curto de hoje;
 *  · 2ª vez: presente 69,90 e ExplicaFolha ENXUTOS, com os MESMOS passos do paywall; Voltar redondo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9 as number | null, precoMensal: "R$ 24,90" as string | null,
  precoTeste: "R$ 0,00" as string | null, dias: 3, trial: true,
  compraOk: true, motivo: null as string | null, compraPresenteOk: true,
  tipo: null as string | null, codigo: null as string | null, restauraOk: false,
  presente: { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3, precoTeste: "R$ 0,00" } as null | { preco: string; valor?: number; precoMes: string | null; produto: string; comTrial: boolean; dias: number; precoTeste?: string | null },
  permissao: "granted" as "granted" | "denied" | "prompt" | "indisponivel",
  metadataMini: null as null | "on" | "off",
}));
const notif = vi.hoisted(() => ({
  pedirLembrete: vi.fn(async (_p: { fimMs: number; precoAno: string }) => "pendente" as const),
  permissao: vi.fn(async () => loja.permissao),
}));
vi.mock("@/lib/notificacoes", () => ({
  pedirLembreteDoTeste: (p: { fimMs: number; precoAno: string }) => notif.pedirLembrete(p),
  cancelarLembreteDoTeste: vi.fn(async () => undefined),
  pedidoDeLembreteDoTeste: () => null,
  agendarRecuperacaoDoPaywall: vi.fn(async () => ({ ok: true })),
  cancelarRecuperacaoDoPaywall: vi.fn(async () => undefined),
  estadoPermissao: () => notif.permissao(),
}));
const id97 = (preco: string) => (preco === "R$ 69,90" ? "core_anual_69" : "core_anual_97");
vi.mock("@/lib/revenuecat", async (original) => {
  const mini = await import("@/lib/paywall-minimalista");
  return {
    ...(await original<typeof import("@/lib/revenuecat")>()),
    // a metadata das offerings chega junto com a loja (o revenuecat.ts real registra em registrarChavesDasOfferings)
    initRevenueCat: vi.fn(async () => {
      if (loja.metadataMini) mini.registrarChavePaywallMinimalista({ current: { identifier: "d", metadata: { paywall_minimalista: loja.metadataMini } }, all: {} });
      return "pronto";
    }),
    prefetchAnualIos: vi.fn(async () => undefined),
    temAnualIos: () => true,
    precoAnualIos: () => loja.preco,
    idProdutoAnualIos: () => id97(loja.preco),
    mesesDeMensalQuePagamOAno: () => 4,
    ofertaAnualIos: () => id97(loja.preco).replace("core_", ""),
    dadosDaOfertaIos: () => ({ oferta: id97(loja.preco).replace("core_", ""), produto: id97(loja.preco), offering: "default", preco: loja.preco, pacote: true }),
    precoMensalDoAnualIos: () => loja.mes,
    diasTrialIos: () => (loja.trial ? loja.dias : 0),
    anualIosTemTrial: () => loja.trial,
    ultimaCompraAnualFoiTrial: () => loja.trial,
    fimDaUltimaCompraTrial: () => null,
    comprarAnualIos: vi.fn(async () => loja.compraOk),
    comprar: vi.fn(async () => loja.compraOk),
    estadoRevenueCat: () => "pronto",
    restaurar: vi.fn(async () => loja.restauraOk),
    compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
    compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
    motivoUltimaCompra: () => loja.motivo,
    tipoUltimaFalha: () => loja.tipo,
    codigoUltimaFalha: () => loja.codigo,
    sincronizarAssinatura: vi.fn(),
    valorAnualIos: () => loja.valorAnual,
    valorMensalIos: () => loja.valorMensal,
    precoMensalIos: () => loja.precoMensal,
    economiaDoAnualIos: () => (loja.valorAnual && loja.valorMensal ? Math.round((1 - loja.valorAnual / (12 * loja.valorMensal)) * 100) : null),
    precoDoTesteIos: () => (loja.trial ? loja.precoTeste : null),
    situacaoDoPresente: vi.fn(async () => null),
    carregarPresente69: vi.fn(async () => loja.presente),
    comprarPresente69: vi.fn(async () => loja.compraPresenteOk),
    carregarMensal19: vi.fn(async () => null),
    marcarToqueDeCompra: vi.fn(),
  };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, loaded: true }) }));

import { trackEvent } from "@/lib/analytics";
import { comprarAnualIos, comprar as comprarAssinatura, comprarPresente69 } from "@/lib/revenuecat";
import { CHAVE_FORCA_OFERTAS, _zerarChavesRemotas } from "@/lib/ofertas-saida";
import { CHAVE_FORCA_PAYWALL_MINIMALISTA, _zerarRemotaMinimalista } from "@/lib/paywall-minimalista";
import { PaywallIOS, TEXTO_DO_ERRO_DA_LOJA, diaDoAviso as diaDoAvisoDoPaywall } from "@/pages/funis/ios/PaywallIOS";
import { diaDoAviso, diasAteOAviso, passosDoTeste, passosSemTeste } from "@/components/paywall/LinhaDoTempoDoTeste";

const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const ligar = (v: string) => localStorage.setItem(CHAVE_FORCA_OFERTAS, v);
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const montar = (o: { onPago?: () => void; onVoltar?: () => void } = {}) => {
  const onPago = o.onPago ?? vi.fn();
  render(<MemoryRouter><PaywallIOS area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} onVoltar={o.onVoltar} /></MemoryRouter>);
  return onPago;
};
/** espera a loja responder (o cartão com o preço do anual) */
const esperarLoja = (preco = loja.preco) => waitFor(() => expect(screen.getByTestId("ios-mini-plano").textContent).toContain(`${preco}/ano`));
const titulosDosPassos = (raiz: HTMLElement) => [...raiz.querySelectorAll("[data-passo-titulo]")].map((n) => n.textContent);
const dd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };

beforeEach(() => {
  localStorage.clear();
  _zerarChavesRemotas();
  _zerarRemotaMinimalista();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarAnualIos).mockClear();
  vi.mocked(comprarAssinatura).mockClear();
  vi.mocked(comprarPresente69).mockClear();
  notif.pedirLembrete.mockClear(); notif.permissao.mockClear();
  ios();
  ligar("curto"); // o curto (na loja: VITE_V14_LOJA); a chave minimalista nasce ligada
  Object.assign(loja, {
    preco: "R$ 97,90", mes: "R$ 8,16", valorAnual: 97.9, valorMensal: 24.9, precoMensal: "R$ 24,90", precoTeste: "R$ 0,00", dias: 3, trial: true,
    compraOk: true, motivo: null, compraPresenteOk: true, permissao: "granted", metadataMini: null, tipo: null, codigo: null, restauraOk: false,
    presente: { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: true, dias: 3, precoTeste: "R$ 0,00" },
  });
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ─────────────────────────────── a linha do tempo, pura ─────────────────────────────── */
describe("a linha do tempo do teste (LinhaDoTempoDoTeste) — pura", () => {
  it("copy do dono, sem datas: 3 dias = Hoje · Amanhã · Dia 3, com o preço do teste e o anual que a loja serviu", () => {
    const p3 = passosDoTeste({ dias: 3, precoAnual: "R$ 97,90", precoTeste: "R$ 0,00", aviso: "sim" });
    expect(p3.map((p) => `${p.quando} — ${p.valor} · ${p.texto}`)).toEqual([
      "Hoje — R$ 0,00 · Seu acesso gratuito começa agora.",
      "Amanhã — Lembrete · Avisamos que seu teste está terminando.",
      "Dia 3 — R$ 97,90/ano · A cobrança começa se você não cancelar antes do fim do teste.",
    ]);
    expect(p3.map((p) => p.tipo)).toEqual(["hoje", "aviso", "fim"]);
    // os três braços do teste de preço e a vitrine dos EUA: nada chumbado
    expect(passosDoTeste({ dias: 3, precoAnual: "R$ 119,90", precoTeste: "R$ 0,00", aviso: "sim" })[2].valor).toBe("R$ 119,90/ano");
    expect(passosDoTeste({ dias: 3, precoAnual: "R$ 69,90", precoTeste: "R$ 0,00", aviso: "sim" })[2].valor).toBe("R$ 69,90/ano");
    expect(passosDoTeste({ dias: 3, precoAnual: "$14.99", precoTeste: "$0.00", aviso: "sim" }).map((p) => p.valor)).toEqual(["$0.00", "Lembrete", "$14.99/ano"]);
    // loja calada: "Grátis" — nunca um "R$ 0,00" inventado
    expect(passosDoTeste({ dias: 3, precoAnual: "R$ —", precoTeste: null, aviso: "sim" })[0].valor).toBe("Grátis");
    // nada de data, de "24 h" ou de "sem cartão"
    expect(JSON.stringify(p3)).not.toMatch(/\d{2}\/\d{2}|24 ?h|sem cart[aã]o|antes do prazo/i);
  });

  it("outra duração muda os rótulos (7 dias → Dia 6 · Dia 7); teste de menos de 3 dias não tem lembrete", () => {
    expect(passosDoTeste({ dias: 7, precoAnual: "R$ 97,90", precoTeste: "R$ 0,00", aviso: "sim" }).map((p) => `${p.quando} — ${p.valor}`))
      .toEqual(["Hoje — R$ 0,00", "Dia 6 — Lembrete", "Dia 7 — R$ 97,90/ano"]);
    expect(passosDoTeste({ dias: 30, precoAnual: "R$ 97,90", precoTeste: "R$ 0,00", aviso: "sim" }).map((p) => p.quando)).toEqual(["Hoje", "Dia 29", "Dia 30"]);
    expect(passosDoTeste({ dias: 2, precoAnual: "R$ 97,90", precoTeste: "R$ 0,00", aviso: "sim" }).map((p) => p.tipo)).toEqual(["hoje", "fim"]);
  });

  it("o lembrete só aparece se o app vai mesmo mandar: negado/indisponível ('nao') tira; ainda lendo (null) ou não perguntado mostra", () => {
    const base = { dias: 3, precoAnual: "R$ 97,90", precoTeste: "R$ 0,00" };
    expect(passosDoTeste({ ...base, aviso: "nao" }).map((p) => p.tipo)).toEqual(["hoje", "fim"]);
    expect(passosDoTeste({ ...base, aviso: "se_ligar" }).map((p) => p.tipo)).toEqual(["hoje", "aviso", "fim"]);
    expect(passosDoTeste({ ...base, aviso: null }).map((p) => p.tipo)).toEqual(["hoje", "aviso", "fim"]);
  });

  it("o dia do lembrete é a conta do aviso 920001 (dia da compra + N − 2): 'Amanhã' no teste de 3 dias; o PaywallIOS exporta a MESMA função", () => {
    expect(diasAteOAviso(3)).toBe(1);
    expect(diasAteOAviso(7)).toBe(5);
    expect(diasAteOAviso(2)).toBeNull();
    expect(diaDoAviso(3, new Date(2026, 9, 31))).toBe("01/11"); // virada do mês
    expect(diaDoAviso(7, new Date(2026, 9, 10))).toBe("15/10");
    expect(diaDoAvisoDoPaywall).toBe(diaDoAviso); // o teste do 920001 (lembrete-teste-loja) lê pelo PaywallIOS
  });

  it("sem teste grátis (o mensal, ou o anual de quem já usou o teste): cobra hoje e renova", () => {
    expect(passosSemTeste({ preco: "R$ 24,90", periodo: "mes" }).map((p) => `${p.quando} — ${p.valor} · ${p.texto}`)).toEqual([
      "Hoje — R$ 24,90 · Seu acesso começa agora.",
      "Todo mês — R$ 24,90 · Renova sozinho até você cancelar.",
    ]);
    expect(passosSemTeste({ preco: "R$ 97,90", periodo: "ano" }).map((p) => p.quando)).toEqual(["Hoje", "Todo ano"]);
  });
});

/* ─────────────────────────────── a tela ─────────────────────────────── */
describe("a tela minimalista (chave ligada)", () => {
  it("título + subtítulo + linha do tempo + um cartão do anual + 'Começar teste grátis' + 'Ver plano mensal' + legal de 1 linha + rodapé; nada da tela de antes", async () => {
    montar();
    await esperarLoja();
    const tela = screen.getByTestId("ios-minimalista");
    expect(screen.getByTestId("ios-mini-titulo")).toHaveTextContent("Experimente 3 dias grátis");
    expect(tela).toHaveTextContent("Veja exatamente como funciona sua assinatura.");
    const linha = screen.getByTestId("ios-mini-linha");
    expect([...linha.querySelectorAll("li")].map((li) => li.getAttribute("data-tipo"))).toEqual(["hoje", "aviso", "fim"]);
    await waitFor(() => expect(titulosDosPassos(linha)).toEqual(["Hoje — R$ 0,00", "Amanhã — Lembrete", "Dia 3 — R$ 97,90/ano"]));
    expect(linha).toHaveTextContent("Seu acesso gratuito começa agora.");
    expect(linha).toHaveTextContent("Avisamos que seu teste está terminando.");
    expect(linha).toHaveTextContent("A cobrança começa se você não cancelar antes do fim do teste.");
    const plano = screen.getByTestId("ios-mini-plano");
    expect(plano).toHaveTextContent("Plano anual");
    expect(plano).toHaveTextContent("3 dias grátis");
    expect(plano).toHaveTextContent("R$ 97,90/ano");
    expect(plano).toHaveTextContent("R$ 8,16/mês");
    expect(screen.getByRole("button", { name: "Começar teste grátis" })).toBeInTheDocument();
    expect(screen.getByTestId("ios-mini-trocar-plano")).toHaveTextContent("Ver plano mensal");
    expect(screen.getByTestId("ios-mini-legal").textContent).toBe("Renova automaticamente até você cancelar.");
    expect(screen.getByText("Termos")).toHaveAttribute("href", "/termos");
    expect(screen.getByText("Privacidade")).toHaveAttribute("href", "/privacidade");
    expect(screen.getByText("Restaurar compras")).toBeInTheDocument();
    expect(screen.getByTestId("ios-tenho-codigo")).toBeInTheDocument();
    expect(screen.getByTestId("ios-mini-voltar")).toHaveAttribute("aria-label", "Voltar");
    // o que saiu da tela
    for (const id of ["ios-curto", "ios-curto-hero", "ios-curto-anual", "ios-curto-mensal", "ios-sem-cobranca", "ios-economize", "ios-curto-legal", "ios-cronograma", "ios-coluna-anual"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(document.body.textContent).not.toContain("DIAS GRÁTIS"); // o cabeçalho preto do cartão de antes
    expect(document.body.textContent).not.toMatch(/economize|pra continuar|cobrado por ano|24,90|a gente te avisa|Pix|Google|Play|vitalício|24 ?h|sem cart[aã]o/i);
    // sempre claro, até no gate com o app no escuro ("paywall sempre claro")
    expect(tela).toHaveClass("tema-claro");
    expect(tela.style.getPropertyValue("--background")).toBe("0 0% 100%");
  });

  it("eventos: os de sempre + `minimalista: true`; `paywall_linha_tempo_view` 1x por paywall aberto (trocar de plano e voltar não repete)", async () => {
    montar();
    await esperarLoja();
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", funil: "ios", loja: "ios" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ paywall_curto: true, minimalista: true, oferta: "anual_97", trial: true, dias: 3 });
    await waitFor(() => expect(eventos("paywall_linha_tempo_view")).toHaveLength(1));
    expect(eventos("paywall_linha_tempo_view")[0]).toEqual({
      funil: "ios", loja: "ios", area: "dinheiro", oferta: "anual_97", produto: "core_anual_97", preco: "R$ 97,90", dias: 3, aviso: "sim", passos: 3, minimalista: true,
    });
    fireEvent.click(screen.getByTestId("ios-mini-trocar-plano"));
    expect(eventos("funnel_click").find((e) => e.cta === "ios_plano")).toMatchObject({ plano: "mensal", paywall_curto: true, minimalista: true });
    fireEvent.click(screen.getByTestId("ios-mini-trocar-plano"));
    await espera();
    expect(eventos("paywall_linha_tempo_view")).toHaveLength(1);
  });

  it("o toque: SEM a pílula de 1,2 s (a linha já disse Hoje R$ 0,00 e Dia 3 o preço) — a folha abre direto; teste arma o lembrete com o preço da loja", async () => {
    const onPago = montar();
    await esperarLoja();
    fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
    expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).toMatchObject({ paywall_curto: true, minimalista: true, produto: "core_anual_97", oferta: "anual_97", preco: "R$ 97,90" });
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_97", funil: "ios" });
    expect(notif.pedirLembrete).toHaveBeenCalledWith(expect.objectContaining({ precoAno: "R$ 97,90" }));
  });

  it("'Ver plano mensal': título, linha (cobra hoje), cartão e botão do mensal, com o preço da loja; a volta mostra a conta do anual; compra o core_mensal sem teste", async () => {
    loja.precoMensal = "R$ 26,90"; loja.valorMensal = 26.9;
    montar();
    await esperarLoja();
    fireEvent.click(screen.getByTestId("ios-mini-trocar-plano"));
    expect(screen.getByTestId("ios-mini-titulo")).toHaveTextContent("Assine o plano mensal");
    expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))).toEqual(["Hoje — R$ 26,90", "Todo mês — R$ 26,90"]);
    const plano = screen.getByTestId("ios-mini-plano");
    expect(plano).toHaveTextContent("Plano mensal");
    expect(plano).toHaveTextContent("R$ 26,90/mês");
    expect(plano).toHaveTextContent("Cancele quando quiser");
    expect(screen.getByTestId("ios-mini-trocar-plano")).toHaveTextContent("Ver plano anual · R$ 8,16/mês");
    expect(document.body.textContent).not.toMatch(/grátis/i);
    fireEvent.click(screen.getByRole("button", { name: "Assinar por R$ 26,90/mês" }));
    expect(screen.queryByTestId("ios-preparando-folha")).toBeNull();
    await waitFor(() => expect(vi.mocked(comprarAssinatura)).toHaveBeenCalledWith("core_mensal", { semTrial: true }));
  });

  it("os três braços do preço vêm da loja: 97,90 · 119,90 · 69,90 (linha, cartão e por mês); nenhum outro preço na tela", async () => {
    for (const [preco, mes, valor] of [["R$ 97,90", "R$ 8,16", 97.9], ["R$ 119,90", "R$ 9,99", 119.9], ["R$ 69,90", "R$ 5,83", 69.9]] as const) {
      Object.assign(loja, { preco, mes, valorAnual: valor });
      vi.mocked(trackEvent).mockClear();
      montar();
      await esperarLoja(preco);
      await waitFor(() => expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))[2]).toBe(`Dia 3 — ${preco}/ano`));
      expect(screen.getByTestId("ios-mini-plano")).toHaveTextContent(`${mes}/mês`);
      const outros = ["97,90", "119,90", "69,90"].filter((p) => !preco.includes(p));
      for (const p of outros) expect(document.body.textContent).not.toContain(p);
      await waitFor(() => expect(eventos("paywall_linha_tempo_view")[0]).toMatchObject({ preco }));
      cleanup();
    }
  });

  it("7 dias de teste (lido da loja): 'Experimente 7 dias grátis', 'Dia 6 — Lembrete', 'Dia 7 — R$ 97,90/ano', cartão '7 dias grátis'", async () => {
    loja.dias = 7;
    montar();
    await esperarLoja();
    expect(screen.getByTestId("ios-mini-titulo")).toHaveTextContent("Experimente 7 dias grátis");
    await waitFor(() => expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))).toEqual(["Hoje — R$ 0,00", "Dia 6 — Lembrete", "Dia 7 — R$ 97,90/ano"]));
    expect(screen.getByTestId("ios-mini-plano")).toHaveTextContent("7 dias grátis");
    await waitFor(() => expect(eventos("paywall_linha_tempo_view")[0]).toMatchObject({ dias: 7, passos: 3 }));
  });

  it("sem direito ao teste (já usou): 'Assine o plano anual', Hoje — R$ 97,90 · Todo ano, 'Assinar por R$ 97,90/ano', nada de grátis; sem paywall_linha_tempo_view", async () => {
    loja.trial = false; loja.precoTeste = null;
    montar();
    await esperarLoja();
    await waitFor(() => expect(screen.getByTestId("ios-mini-titulo")).toHaveTextContent("Assine o plano anual"));
    expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))).toEqual(["Hoje — R$ 97,90", "Todo ano — R$ 97,90"]);
    expect(screen.getByRole("button", { name: "Assinar por R$ 97,90/ano" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/grátis|R\$ 0,00/i);
    fireEvent.click(screen.getByRole("button", { name: "Assinar por R$ 97,90/ano" }));
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(1));
    expect(eventos("paywall_linha_tempo_view")).toHaveLength(0);
  });

  it("permissão de aviso negada: a linha sem o lembrete (Hoje · Dia 3) e o evento conta 2 passos; ainda não perguntada: o lembrete fica", async () => {
    loja.permissao = "denied";
    montar();
    await esperarLoja();
    await waitFor(() => expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))).toEqual(["Hoje — R$ 0,00", "Dia 3 — R$ 97,90/ano"]));
    await waitFor(() => expect(eventos("paywall_linha_tempo_view")[0]).toMatchObject({ aviso: "nao", passos: 2 }));
    cleanup();
    vi.mocked(trackEvent).mockClear();
    loja.permissao = "prompt";
    montar();
    await esperarLoja();
    await waitFor(() => expect(eventos("paywall_linha_tempo_view")[0]).toMatchObject({ aviso: "se_ligar", passos: 3 }));
    expect(titulosDosPassos(screen.getByTestId("ios-mini-linha"))).toContain("Amanhã — Lembrete");
  });
});

/* ─────────────────────────────── a chave ─────────────────────────────── */
describe("a chave `paywall_minimalista` desligada = o paywall curto de hoje", () => {
  it("metadata `off` chegando com as offerings: volta o curto de hoje (com 'Sem cobrança hoje · a gente te avisa dia DD/MM', a pílula e 'Continuar'), sem `minimalista` nos eventos", async () => {
    loja.metadataMini = "off";
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar();
      expect(await screen.findByTestId("ios-curto")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("R$ 97,90 cobrado por ano"));
      expect(screen.queryByTestId("ios-minimalista")).toBeNull();
      expect(screen.getByTestId("ios-sem-cobranca")).toHaveTextContent(`Sem cobrança hoje · a gente te avisa dia ${dd(1)}`);
      expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ paywall_curto: true });
      expect(eventos("paywall_oferta_vista")[0]).not.toHaveProperty("minimalista");
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
      expect(screen.getByTestId("ios-preparando-folha")).toBeInTheDocument();
      expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).not.toHaveProperty("minimalista");
      expect(eventos("paywall_linha_tempo_view")).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });

  it("`?paywall-minimalista=off` neste aparelho (QA): o curto de hoje desde o 1º quadro; `on` vence a metadata off", async () => {
    window.history.replaceState(null, "", "/comecar?paywall-minimalista=off");
    try {
      montar();
      expect(screen.getByTestId("ios-curto")).toBeInTheDocument();
      expect(localStorage.getItem(CHAVE_FORCA_PAYWALL_MINIMALISTA)).toBe("off");
      await waitFor(() => expect(screen.getByTestId("ios-curto-anual")).toHaveTextContent("R$ 97,90 cobrado por ano"));
      cleanup();
      window.history.replaceState(null, "", "/comecar?paywall-minimalista=on");
      loja.metadataMini = "off";
      montar();
      await esperarLoja();
      expect(screen.getByTestId("ios-minimalista")).toBeInTheDocument();
    } finally { window.history.replaceState(null, "", "/"); }
  });

  it("com o curto desligado o minimalista não liga nada: o layout longo de sempre", async () => {
    localStorage.removeItem(CHAVE_FORCA_OFERTAS);
    montar();
    expect(await screen.findByText("por mês · R$ 97,90/ano")).toBeInTheDocument();
    expect(screen.queryByTestId("ios-minimalista")).toBeNull();
    expect(screen.getByTestId("ios-cronograma")).toBeInTheDocument();
  });
});

/* ─────────────────────────────── a 2ª vez e as saídas ─────────────────────────────── */
describe("2ª vez e saídas, enxutas como a tela", () => {
  it("fechou a folha: presente 69,90 ENXUTO (sem o parágrafo repetido, regra curta); o toque explica com a MESMA linha do tempo (R$ 69,90) e a frase curta da folha", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onPago = montar();
      await esperarLoja();
      loja.compraOk = false; loja.motivo = "cancelou";
      fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
      const folha = await screen.findByTestId("presente69");
      expect(folha).toHaveAttribute("data-lugar", "folha_cancelada");
      expect(folha.textContent).not.toMatch(/\(em vez de/);
      expect(screen.getByTestId("presente69-regra").textContent).toBe("Nada é cobrado hoje. Cancelou antes do fim do teste, não paga nada.");
      await act(async () => { vi.advanceTimersByTime(450); });
      fireEvent.click(screen.getByTestId("presente69-cta"));
      const explica = await screen.findByTestId("explica-folha");
      expect(explica).toHaveAttribute("data-lugar", "presente_folha_cancelada");
      // o "R$ 0,00" é o da oferta introdutória do 69,90, da loja (sem ele: "Grátis")
      expect(titulosDosPassos(screen.getByTestId("explica-folha-linhas"))).toEqual(["Hoje — R$ 0,00", "Amanhã — Lembrete", "Dia 3 — R$ 69,90/ano"]);
      expect(screen.getByTestId("explica-folha-apple").textContent).toMatch(/confirme com 2 cliques no botão lateral \(ou Touch ID\)/);
      expect(explica.textContent).not.toMatch(/No iPhone com botão de início|24 ?h|sem cart[aã]o/i);
      fireEvent.click(screen.getByTestId("explica-folha-continuar"));
      await waitFor(() => expect(vi.mocked(comprarPresente69)).toHaveBeenCalledWith("folha_cancelada"));
      await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    } finally { vi.useRealTimers(); }
  });

  it("sem o presente: cartão da 2ª chance numa linha ('Hoje você não paga nada.') → 'Tentar de novo' → a explicação com OS MESMOS passos do paywall (R$ 0,00 da loja, Amanhã, Dia 3) → folha", async () => {
    loja.presente = null;
    montar();
    await esperarLoja();
    await waitFor(() => expect(eventos("paywall_linha_tempo_view")).toHaveLength(1));
    const doPaywall = titulosDosPassos(screen.getByTestId("ios-mini-linha"));
    loja.compraOk = false; loja.motivo = "cancelou";
    fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
    const cartao = await screen.findByTestId("ios-segunda-chance");
    expect(cartao.textContent).toMatch(/^Hoje você não paga nada\.Tentar de novo$/);
    loja.compraOk = true; loja.motivo = null;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    const explica = screen.getByTestId("explica-folha");
    expect(explica).toHaveAttribute("data-lugar", "paywall");
    expect(titulosDosPassos(screen.getByTestId("explica-folha-linhas"))).toEqual(doPaywall);
    expect(doPaywall).toEqual(["Hoje — R$ 0,00", "Amanhã — Lembrete", "Dia 3 — R$ 97,90/ano"]);
    // a permissão que o paywall já leu vale aqui (a mesma promessa nas duas telas)
    expect(eventos("explica_folha_view")[0]).toMatchObject({ lugar: "paywall", aviso: "sim", preco: "R$ 97,90", dias: 3 });
    fireEvent.click(screen.getByTestId("explica-folha-continuar"));
    await waitFor(() => expect(vi.mocked(comprarAnualIos)).toHaveBeenCalledTimes(2));
    expect(eventos("folha_segunda_chance_click")).toHaveLength(1);
  });

  it("Voltar redondo: o mesmo core:voltar (presente 69,90 do X por cima; sem presente, o funil recua)", async () => {
    ligar("curto,x_paywall");
    const onVoltar = vi.fn();
    montar({ onVoltar });
    await esperarLoja();
    fireEvent.click(screen.getByTestId("ios-mini-voltar"));
    expect(eventos("funnel_click").find((e) => e.cta === "ios_paywall_voltar")).toMatchObject({ paywall_curto: true, minimalista: true });
    expect(await screen.findByTestId("presente69")).toHaveAttribute("data-lugar", "x_paywall");
    await espera(450);
    expect(onVoltar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("presente69-agora-nao"));
    fireEvent.click(screen.getByTestId("ios-mini-voltar"));
    await espera(450);
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────── 1.0.18 (decepções 21/10, itens 1 e 4): erro da loja com "Tentar de novo" e Restaurar vazio ─────────────── */
describe("1.0.18: a loja falhou (depois da retentativa automática) → caixa por tipo com 'Tentar de novo'", () => {
  let href = "";
  beforeEach(() => {
    href = "";
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, get href() { return href; }, set href(v: string) { href = v; }, pathname: "/comecar", search: "" } });
  });
  const falhar = async (motivo: string, tipo: string | null, codigo: string | null) => {
    Object.assign(loja, { compraOk: false, motivo, tipo, codigo });
    montar();
    await esperarLoja();
    fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
    await waitFor(() => expect(screen.getByTestId("ios-erro-loja")).toBeInTheDocument());
    return screen.getByTestId("ios-erro-loja");
  };

  it("loja (problem with the App Store): a frase do pagamento do ID Apple + 'Tentar de novo' compra de novo; evento com tipo e código; sem a linha vermelha antiga", async () => {
    const caixa = await falhar("billing_erro", "loja", "2");
    expect(caixa.textContent).toContain(TEXTO_DO_ERRO_DA_LOJA.loja);
    expect(TEXTO_DO_ERRO_DA_LOJA.loja).toBe("A App Store não conseguiu concluir. Confira a forma de pagamento do seu ID Apple (Ajustes › seu nome › Pagamento) e tente de novo.");
    expect(screen.queryByText(/A Apple não concluiu o pagamento/)).toBeNull();
    expect(eventos("paywall_erro_loja_view")).toEqual([expect.objectContaining({ funil: "ios", produto: "core_anual_97", motivo: "billing_erro", tipo: "loja", codigo: "2", minimalista: true })]);
    expect(comprarAnualIos).toHaveBeenCalledTimes(1);
    loja.compraOk = true; loja.motivo = null;
    fireEvent.click(screen.getByTestId("ios-erro-loja-tentar"));
    expect(eventos("funnel_click").find((e) => e.cta === "erro_loja_tentar_de_novo")).toMatchObject({ produto: "anual", codigo: "2" });
    await waitFor(() => expect(comprarAnualIos).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("ios-erro-loja")).toBeNull());
  });

  it("rede: a frase da internet; bloqueado (nao_permitido): a frase do Tempo de Uso; nenhuma fala de cobrança nem de 24 h", async () => {
    const rede = await falhar("billing_erro", "rede", "10");
    expect(rede.textContent).toContain("Sem conexão com a App Store agora. Confira a internet e tente de novo.");
    cleanup(); vi.mocked(trackEvent).mockClear();
    const bloq = await falhar("nao_permitido", "bloqueado", "3");
    expect(bloq.textContent).toContain("Este iPhone está com compras bloqueadas (Tempo de Uso ou conta familiar). Libere em Ajustes e tente de novo.");
    expect(eventos("paywall_erro_loja_view")[0]).toMatchObject({ motivo: "nao_permitido", tipo: "bloqueado" });
    for (const t of Object.values(TEXTO_DO_ERRO_DA_LOJA)) expect(t).not.toMatch(/cobr|24 ?h/i);
  });

  it("cancelou a folha: nenhuma caixa de erro (é decisão dela)", async () => {
    Object.assign(loja, { compraOk: false, motivo: "cancelou", tipo: "cancelou", codigo: "1", presente: null });
    montar();
    await esperarLoja();
    fireEvent.click(screen.getByRole("button", { name: "Começar teste grátis" }));
    await espera(80);
    expect(screen.queryByTestId("ios-erro-loja")).toBeNull();
    expect(eventos("paywall_erro_loja_view")).toEqual([]);
  });

  it("Restaurar sem compra: 'Nenhuma compra encontrada…' + 'Comprou pelo site ou com outro e-mail? Entrar com o e-mail da compra' → /entrar (só login, sem link de pagamento)", async () => {
    montar();
    await esperarLoja();
    expect(screen.queryByTestId("ios-restauro-vazio")).toBeNull();
    fireEvent.click(screen.getByText("Restaurar compras"));
    const caixa = await screen.findByTestId("ios-restauro-vazio");
    expect(caixa.textContent).toContain("Nenhuma compra encontrada nesta conta da App Store.");
    expect(caixa.textContent).toContain("Comprou pelo site ou com outro e-mail?");
    expect(caixa.textContent).not.toMatch(/pix|site\.|http|pagar|assinar/i);
    expect(eventos("app_restore_vazio")).toEqual([expect.objectContaining({ funil: "ios", minimalista: true })]);
    fireEvent.click(screen.getByTestId("ios-restauro-vazio-entrar"));
    expect(href).toBe("/entrar");
    expect(eventos("funnel_click").find((e) => e.cta === "restauro_vazio_entrar")).toBeTruthy();
  });

  it("Restaurar que ACHA a compra: segue pra Home, sem a caixa", async () => {
    loja.restauraOk = true;
    montar();
    await esperarLoja();
    fireEvent.click(screen.getByText("Restaurar compras"));
    await waitFor(() => expect(href).toBe("/"));
    expect(screen.queryByTestId("ios-restauro-vazio")).toBeNull();
  });
});
