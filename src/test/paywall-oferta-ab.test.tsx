/**
 * A/B DA OFERTA DO PAYWALL SEM TESTE (12/11, dono) — SÓ iPhone (lib/paywall-teste `paywall_oferta`).
 *  · o visual é sempre o desenho do Android (PaywallW semTeste) — `paywall_visual` agora nasce "android";
 *  · o sorteio é estável por aparelho (FNV-1a com sal "paywall-oferta:") e fica gravado (chave do aparelho);
 *  · a chave remota (anual|vitalicio|ab, a `current` vence) MANDA sobre o braço gravado — é o "vencedor em 100% sem
 *    build" — e vale na reabertura antes de o RevenueCat responder; "ab" devolve o braço gravado;
 *  · QA por URL `?paywall-oferta=anual|vitalicio|auto`;
 *  · braço anual: anual 97,90/ano (core_anual_97_direto); braço vitalício: vitalício 97,90 pagamento único
 *    (core_vitalicio_97) marcado, os textos do Android "pela App Store"; nos dois: mensal 34,90 e o presente 69,90;
 *    nenhum texto de teste grátis;
 *  · funil, gate e "Ver planos" no mesmo braço do aparelho; todo evento leva `paywall_oferta`;
 *  · o vitalício comprado: sync/webhook gravam 9790 vitalício (acesso até 2126), afiliados conta 9790/8030;
 *  · Android intocado: a chave não vale lá (nunca sorteia nem grava), o PaywallW de hoje vende o vitalício de sempre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loja = vi.hoisted(() => ({
  ok: true, motivo: null as string | null,
  anual: { produto: "core_anual_97_direto", preco: "R$ 97,90", valor: 97.9, precoMes: "R$ 8,16", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  mensal: { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  presente: { produto: "core_anual_69_direto", preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,83", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  vitalicio: { produto: "core_vitalicio_97", preco: "R$ 97,90", valor: 97.9, precoMes: null, offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchSemTeste: vi.fn(async () => undefined),
  prefetchVitalicio: vi.fn(async () => undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  dadosSemTeste: (p: "anual" | "mensal" | "presente" | "vitalicio") => loja[p],
  comprarSemTeste: vi.fn(async () => loja.ok),
  comprar: vi.fn(async () => true),
  comprarVitalicio: vi.fn(async () => true),
  comprarAnual97: vi.fn(async () => true),
  comprarMensalAndroid: vi.fn(async () => true),
  motivoUltimaCompra: () => loja.motivo,
  restaurar: vi.fn(async () => false),
  compraAssinaturaLocal: vi.fn(async () => false),
  compraVitaliciaLocal: vi.fn(async () => false),
  identificarRevenueCat: vi.fn(async () => undefined),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/notificacoes", () => ({ cancelarResgateDoPlano: vi.fn(async () => undefined), agendarResgateDoPlano: vi.fn(async () => undefined) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "conta-logada" } } } }), signOut: vi.fn(async () => ({ error: null })) } },
}));

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { comprarSemTeste, comprarVitalicio, identificarRevenueCat, lerPacotesSemTeste } from "@/lib/revenuecat";
import {
  CHAVE_FORCA_PAYWALL_OFERTA, CHAVE_PAYWALL_OFERTA_APARELHO, CHAVE_PAYWALL_OFERTA_BRACO, PRODUTOS_SEM_TESTE,
  _zerarChavePaywallTeste, _zerarPaywallOferta, _zerarPaywallVisual, camposDaOfertaNaFolha, guardarForcaPaywallOferta,
  lerChaveRemotaPaywallOferta, ofertaDoPaywall, registrarPaywallTesteRemoto, sortearOfertaPaywall, visualDoPaywall,
} from "@/lib/paywall-teste";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";
import { PaywallW } from "@/pages/funis/w/PaywallW";
import { AppPurchaseSheet } from "@/components/app/AppPurchaseSheet";
import { classificarEvento, type EventoRC } from "../../supabase/functions/_shared/afiliados";

/** nenhum texto de teste grátis (nos dois braços) */
const TEXTO_TESTE = /teste|gr[aá]tis|3 dias|R\$ ?0,00/i;
/** e o braço anual não fala de vitalício */
const TEXTO_VITALICIO = /vital[ií]c|pra sempre|para sempre|pagamento [uú]nico|uma [uú]nica vez/i;
const plataforma = (p: "ios" | "android") => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; };
const chamadas = () => [...vi.mocked(trackEvent).mock.calls, ...vi.mocked(trackEventBeacon).mock.calls];
const eventos = (nome: string) => chamadas().filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const forcar = (o: "anual" | "vitalicio") => localStorage.setItem(CHAVE_FORCA_PAYWALL_OFERTA, o);
type Modo = "funil" | "gate" | "planos";
const montar = (o: { modo?: Modo; onPago?: () => void; onVoltar?: () => void; area?: "dinheiro" | "rotina" } = {}) => {
  const onPago = o.onPago ?? vi.fn();
  render(<MemoryRouter><PaywallW area={o.area ?? "dinheiro"} answers={o.modo && o.modo !== "funil" ? {} : { gasto: "R$ 100 a R$ 300" }} semTeste modo={o.modo} onVoltar={o.onVoltar} onPagoSemConta={onPago} /></MemoryRouter>);
  return onPago;
};
const tela = () => screen.getByTestId("paywall-w-sem-teste");

beforeEach(() => {
  delete (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__;
  localStorage.clear(); // conta VAZIA, aparelho novo: nenhum seed
  window.history.replaceState({}, "", "/");
  _zerarChavePaywallTeste();
  _zerarPaywallVisual();
  _zerarPaywallOferta();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(trackEventBeacon).mockClear();
  vi.mocked(comprarSemTeste).mockClear();
  vi.mocked(comprarVitalicio).mockClear();
  vi.mocked(identificarRevenueCat).mockClear();
  loja.ok = true; loja.motivo = null;
  plataforma("ios");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__ = "on"; });

/* ─────────────────────────────── a chave ─────────────────────────────── */
describe("a chave `paywall_oferta` (só iPhone)", () => {
  it("o sorteio é estável: o mesmo id dá sempre o mesmo braço; ids diferentes dão os dois (~50/50); sal próprio", () => {
    expect(sortearOfertaPaywall("aparelho-1")).toBe(sortearOfertaPaywall("aparelho-1"));
    const n = 2000;
    let vit = 0;
    for (let i = 0; i < n; i++) if (sortearOfertaPaywall(`id-${i}`) === "vitalicio") vit++;
    expect(vit / n).toBeGreaterThan(0.45);
    expect(vit / n).toBeLessThan(0.55);
  });
  it("padrão = ab: sorteia 1x, grava no aparelho e repete na reabertura (e depois de o RevenueCat responder sem a chave)", () => {
    const b = ofertaDoPaywall();
    expect(["anual", "vitalicio"]).toContain(b);
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_BRACO)).toBe(b);
    _zerarPaywallOferta(); // fechou o app
    expect(ofertaDoPaywall()).toBe(b);
    registrarPaywallTesteRemoto({ current: { metadata: {} }, all: {} });
    expect(ofertaDoPaywall()).toBe(b);
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_APARELHO)).toBe("ab");
  });
  it("o visual agora nasce \"android\" (o A/B do visual acabou) — sem sorteio", () => {
    expect(visualDoPaywall()).toBe("android");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "vitalicio" } }, all: {} });
    expect(visualDoPaywall()).toBe("android");
  });
  it("CHAVE REMOTA MANDA (vencedor em 100% sem build): vence o braço sorteado e gravado, nos dois sentidos", () => {
    localStorage.setItem(CHAVE_PAYWALL_OFERTA_BRACO, "anual"); // este aparelho tinha sorteado anual
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "vitalicio" } }, all: {} });
    expect(ofertaDoPaywall()).toBe("vitalicio");
    localStorage.setItem(CHAVE_PAYWALL_OFERTA_BRACO, "vitalicio");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "anual" } }, all: {} });
    expect(ofertaDoPaywall()).toBe("anual");
    // o braço gravado fica guardado (não é apagado) e volta a valer com "ab"
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_BRACO)).toBe("vitalicio");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "ab" } }, all: {} });
    expect(ofertaDoPaywall()).toBe("vitalicio");
  });
  it("a chave remota da abertura anterior vale na reabertura, ANTES de o RevenueCat responder", () => {
    localStorage.setItem(CHAVE_PAYWALL_OFERTA_BRACO, "anual");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "vitalicio" } }, all: {} });
    _zerarPaywallOferta(); // o app morreu; nesta abertura o RevenueCat ainda não respondeu
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_APARELHO)).toBe("vitalicio");
    expect(ofertaDoPaywall()).toBe("vitalicio");
  });
  it("lê a chave como as outras: a `current` vence; qualquer offering serve; lixo = ninguém disse", () => {
    expect(lerChaveRemotaPaywallOferta({ current: { metadata: {} }, all: { sem_teste: { metadata: { paywall_oferta: "vitalicio" } } } })).toBe("vitalicio");
    expect(lerChaveRemotaPaywallOferta({ current: { metadata: { paywall_oferta: "anual" } }, all: { sem_teste: { metadata: { paywall_oferta: "vitalicio" } } } })).toBe("anual");
    expect(lerChaveRemotaPaywallOferta({ current: { metadata: { paywall_oferta: " Vitalicio " } }, all: {} })).toBe("vitalicio");
    expect(lerChaveRemotaPaywallOferta({ current: { metadata: { paywall_oferta: "xyz" } }, all: {} })).toBeNull();
    expect(lerChaveRemotaPaywallOferta(null)).toBeNull();
  });
  it("QA por URL: ?paywall-oferta=vitalicio|anual vence a chave remota e o sorteio; auto desfaz", () => {
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "anual" } }, all: {} });
    window.history.replaceState({}, "", "/app?paywall-oferta=vitalicio");
    expect(ofertaDoPaywall()).toBe("vitalicio");
    window.history.replaceState({}, "", "/app");
    expect(ofertaDoPaywall()).toBe("vitalicio"); // gravado no aparelho
    guardarForcaPaywallOferta("?paywall-oferta=anual");
    expect(ofertaDoPaywall()).toBe("anual");
    guardarForcaPaywallOferta("?paywall-oferta=auto");
    expect(localStorage.getItem(CHAVE_FORCA_PAYWALL_OFERTA)).toBeNull();
    expect(ofertaDoPaywall()).toBe("anual"); // volta a valer a chave remota
  });
  it("as chaves novas são do APARELHO (sobrevivem às vassouras); a força de QA não", () => {
    expect(CHAVES_DO_APARELHO).toContain(CHAVE_PAYWALL_OFERTA_APARELHO);
    expect(CHAVES_DO_APARELHO).toContain(CHAVE_PAYWALL_OFERTA_BRACO);
    expect(CHAVES_DO_APARELHO).not.toContain(CHAVE_FORCA_PAYWALL_OFERTA);
  });
  it("o vitalício sem teste é o core_vitalicio_97 (o mesmo do Android) e mora no pacote `vitalicio` da `sem_teste` — só no iPhone", () => {
    expect(PRODUTOS_SEM_TESTE.vitalicio).toBe("core_vitalicio_97");
    const pac = (id: string) => ({ identifier: id, product: { identifier: id, priceString: "R$ 97,90", price: 97.9 } });
    const offerings = {
      current: { identifier: "default", availablePackages: [pac("core_anual_97"), pac("core_mensal")] },
      all: { sem_teste: { identifier: "sem_teste", availablePackages: [pac("core_anual_97_direto"), pac("core_mensal_34"), pac("core_anual_69_direto"), pac("core_vitalicio_97")] } },
    };
    expect(lerPacotesSemTeste(offerings).vitalicio?.offering).toBe("sem_teste");
    plataforma("android");
    expect(lerPacotesSemTeste(offerings).vitalicio).toBeUndefined();
  });
});

/* ─────────────────────────────── ANDROID INTOCADO ─────────────────────────────── */
describe("Android intocado", () => {
  it("a chave não vale fora do iPhone: sempre \"anual\", sem sortear nem gravar nada (nem com força ou chave remota)", () => {
    plataforma("android");
    forcar("vitalicio");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_oferta: "vitalicio", paywall_teste: "off" } }, all: {} });
    expect(ofertaDoPaywall()).toBe("anual");
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_BRACO)).toBeNull();
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_APARELHO)).toBeNull();
  });
  it("o site também", () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    expect(ofertaDoPaywall()).toBe("anual");
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_BRACO)).toBeNull();
  });
  it("o PaywallW do Android (sem semTeste) segue vendendo o vitalício de sempre (comprarVitalicio core_vitalicio_97), sem paywall_oferta", async () => {
    plataforma("android");
    const onPago = vi.fn();
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPago} /></MemoryRouter>);
    await espera();
    expect(screen.queryByTestId("paywall-w-sem-teste")).toBeNull();
    fireEvent.click(screen.getAllByText(/Pra sempre/)[0]);
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    await waitFor(() => expect(comprarVitalicio).toHaveBeenCalledWith("core_vitalicio_97"));
    expect(comprarSemTeste).not.toHaveBeenCalledWith("vitalicio", expect.anything());
    expect(chamadas().some((c) => (c[1] as Record<string, unknown>)?.paywall_oferta)).toBe(false);
    expect(localStorage.getItem(CHAVE_PAYWALL_OFERTA_BRACO)).toBeNull();
  });
});

/* ─────────────────────── braço ANUAL ─────────────────────── */
describe("braço anual (conta vazia)", () => {
  beforeEach(() => forcar("anual"));
  it("anual 97,90 marcado (R$ 8,16/mês · economize 77%), mensal 34,90; nada de teste nem de vitalício; compra o core_anual_97_direto", async () => {
    const onPago = montar();
    await waitFor(() => expect(screen.getByText(/Economize 77%/)).toBeTruthy());
    expect(tela().dataset.plano).toBe("anual");
    expect(tela().dataset.oferta).toBe("anual");
    expect(tela().textContent).toContain("R$ 8,16/mês");
    expect(tela().textContent).toContain("R$ 34,90");
    expect(tela().textContent).toContain("Quero o anual — R$ 97,90/ano");
    expect(tela().textContent).not.toMatch(TEXTO_TESTE);
    expect(tela().textContent).not.toMatch(TEXTO_VITALICIO);
    expect(tela().textContent).toContain("Cancele quando quiser"); // 1.0.27: o selo do anual (assinatura) fica como hoje
    fireEvent.click(screen.getByText(/Quero o anual/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("anual", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_97_direto", paywall_oferta: "anual" });
  });
});

/* ─────────────────────── braço VITALÍCIO ─────────────────────── */
describe("braço vitalício (conta vazia)", () => {
  beforeEach(() => forcar("vitalicio"));
  it("vitalício 97,90 pagamento único MARCADO, com os textos do Android \"pela App Store\"; mensal 34,90; nenhum texto de teste", async () => {
    montar();
    await espera();
    expect(tela().dataset.plano).toBe("vitalicio");
    expect(tela().dataset.oferta).toBe("vitalicio");
    const t = tela().textContent ?? "";
    expect(t).toContain("Pra sempre");
    expect(t).toContain("vitalício · uma única vez");
    expect(t).toContain("3 meses de mensal =");
    expect(t).toContain("1x, pra sempre");
    expect(t).toContain("Quero pra sempre — R$ 97,90");
    expect(t).toContain("Pagamento único de R$ 97,90 pela App Store · sem mensalidade");
    expect(t).toContain("R$ 34,90");
    expect(t).not.toMatch(TEXTO_TESTE);
    expect(t).not.toMatch(/R\$ 8,16|Economize 77%|\/ano|1 ano|24,90|99,90/);
    expect(eventos("funnel_view")[0]).toMatchObject({ step: "offer", paywall_oferta: "vitalicio", paywall_visual: "android", paywall_teste: "off" });
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ produto: "core_vitalicio_97", preco: "R$ 97,90", paywall_oferta: "vitalicio", trial: false });
  });
  it("1.0.27: com o vitalício marcado o selo \"Cancele quando quiser\" vira \"Pagamento único. Sem mensalidade.\"; marcando o mensal volta", async () => {
    montar();
    await espera();
    const selos = () => [...tela().querySelectorAll("span.rounded-full")].map((e) => e.textContent?.trim() ?? "");
    expect(selos().some((t) => t.includes("Pagamento único. Sem mensalidade."))).toBe(true);
    expect(selos().some((t) => /Cancele quando quiser/.test(t))).toBe(false);
    // a única "cancele quando quiser" que sobra é a da coluna do MENSAL (que é assinatura)
    expect(screen.getAllByText(/cancele quando quiser/i)).toHaveLength(1);
    fireEvent.click(screen.getAllByText(/cancele quando quiser/i)[0]);
    expect(tela().dataset.plano).toBe("mensal");
    expect(selos().some((t) => t.includes("Cancele quando quiser"))).toBe(true);
    expect(selos().some((t) => t.includes("Pagamento único. Sem mensalidade."))).toBe(false);
  });
  it("loja calada: a reserva de texto (97,90 vitalício / 34,90) e ainda nenhum texto de teste", async () => {
    const v = loja.vitalicio, m = loja.mensal;
    loja.vitalicio = null; loja.mensal = null;
    montar();
    await espera();
    expect(tela().textContent).toContain("Quero pra sempre — R$ 97,90");
    expect(tela().textContent).toContain("R$ 34,90");
    expect(tela().textContent).not.toMatch(TEXTO_TESTE);
    loja.vitalicio = v; loja.mensal = m;
  });
  it("comprar: core_vitalicio_97 pela folha sem teste; o evento de sucesso leva o braço e a folha anota o braço", async () => {
    const onPago = montar();
    await espera();
    expect(camposDaOfertaNaFolha()).toEqual({ paywall_oferta: "vitalicio" });
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("vitalicio", "ios");
    expect(comprarVitalicio).not.toHaveBeenCalled();
    expect(eventos("funnel_click").find((e) => e.cta === "app_paywall_cta")).toMatchObject({ plano: "vitalicio", produto: "core_vitalicio_97", paywall_oferta: "vitalicio" });
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_vitalicio_97", oferta: "sem_teste_vitalicio", trial: false, paywall_oferta: "vitalicio" });
    cleanup();
    expect(camposDaOfertaNaFolha()).toEqual({}); // saiu do paywall: a folha não carrega braço velho
  });
  it("mensal marcado: compra o core_mensal_34 com o braço no evento", async () => {
    const onPago = montar();
    await espera();
    fireEvent.click(screen.getAllByText(/cancele quando quiser/i)[0]);
    expect(tela().dataset.plano).toBe("mensal");
    expect(tela().textContent).toContain("Começar por R$ 34,90/mês");
    expect(tela().textContent).toContain("Assinatura de R$ 34,90/mês pela App Store");
    fireEvent.click(screen.getByText(/Começar por R\$ 34,90/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("mensal", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_mensal_34", paywall_oferta: "vitalicio" });
  });
  it("CANCELOU A FOLHA → o MESMO presente 69,90/ano (sem riscar o 97,90 do vitalício); comprar = core_anual_69_direto", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    const onPago = montar();
    await espera();
    fireEvent.click(screen.getByText(/Quero pra sempre/));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    const p = screen.getByTestId("presente-direto");
    expect(p.textContent).toContain("R$ 69,90");
    expect(p.textContent).not.toMatch(TEXTO_TESTE);
    expect(p.querySelector("s")).toBeNull();
    expect(eventos("presente69_view")[0]).toMatchObject({ lugar: "folha_cancelada", paywall_oferta: "vitalicio", de: "R$ 97,90" });
    loja.ok = true; loja.motivo = null;
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    fireEvent.click(screen.getByTestId("presente-direto-cta"));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenLastCalledWith("presente", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_69_direto", oferta: "presente69_direto", paywall_oferta: "vitalicio" });
  });
  it("VOLTAR redondo → presente; Agora não → o paywall; todo evento da tela leva o braço", async () => {
    const onVoltar = vi.fn();
    montar({ onVoltar });
    await espera();
    fireEvent.click(screen.getByTestId("paywall-w-voltar"));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    fireEvent.click(screen.getByTestId("presente-direto-agora-nao"));
    cleanup();
    const doPaywall = chamadas().filter((c) => /^(funnel_view|funnel_click|paywall_oferta_vista|paywall_saiu|presente69_)/.test(String(c[0])));
    expect(doPaywall.length).toBeGreaterThan(4);
    for (const [, d] of doPaywall) expect(d).toMatchObject({ paywall_oferta: "vitalicio" });
  });
});

/* ─────────────────────── gate e "Ver planos" ─────────────────────── */
describe.each(["anual", "vitalicio"] as const)("gate e \"Ver planos\" no desenho do Android — braço %s", (braco) => {
  beforeEach(() => forcar(braco));
  it("gate: título neutro (sem \"Seu plano … está pronto\"), sem Voltar, com Restaurar/Termos/Privacidade e \"Entrar com outra conta\"", async () => {
    const onPago = montar({ modo: "gate" });
    await espera();
    const t = tela().textContent ?? "";
    expect(tela().dataset.modo).toBe("gate");
    expect(tela().dataset.oferta).toBe(braco);
    expect(screen.getByTestId("paywall-w-titulo").textContent).toBe("Sua vida inteira organizada");
    expect(screen.getByTestId("paywall-w-selo").textContent).toBe("Último passo");
    expect(t).not.toMatch(/Seu plano pra|está pronto/);
    expect(screen.queryByTestId("paywall-w-voltar")).toBeNull();
    expect(screen.getByTestId("paywall-w-trocar-conta")).toBeTruthy();
    expect(t).not.toMatch(TEXTO_TESTE);
    if (braco === "vitalicio") expect(t).toContain("Quero pra sempre — R$ 97,90");
    else { expect(t).toContain("Quero o anual — R$ 97,90/ano"); expect(t).not.toMatch(TEXTO_VITALICIO); }
    // a compra é da CONTA logada; o sucesso vai por beacon (o gate recarrega)
    fireEvent.click(screen.getByText(braco === "vitalicio" ? /Quero pra sempre/ : /Quero o anual/));
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(identificarRevenueCat).toHaveBeenCalledWith("conta-logada");
    expect(comprarSemTeste).toHaveBeenCalledWith(braco, "gate_ios");
    const ok = vi.mocked(trackEventBeacon).mock.calls.find((c) => c[0] === "app_sheet_success")?.[1];
    expect(ok).toMatchObject({ funil: "gate_ios", paywall_oferta: braco, produto: PRODUTOS_SEM_TESTE[braco] });
    expect(eventos("funnel_view")[0]).toMatchObject({ funil: "gate_ios", paywall_oferta: braco });
  });
  it("gate: folha cancelada → o mesmo presente 69,90", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    montar({ modo: "gate" });
    await espera();
    fireEvent.click(screen.getByText(braco === "vitalicio" ? /Quero pra sempre/ : /Quero o anual/));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    expect(eventos("presente69_view")[0]).toMatchObject({ funil: "gate_ios", paywall_oferta: braco });
  });
  it("Ver planos: selo \"Seu acesso\", Voltar fecha (sem presente aberto), eventos funil planos + braço", async () => {
    const onVoltar = vi.fn();
    montar({ modo: "planos", onVoltar });
    await espera();
    expect(screen.getByTestId("paywall-w-selo").textContent).toBe("Seu acesso");
    expect(tela().textContent).not.toMatch(/Seu plano pra|está pronto/);
    expect(tela().textContent).not.toMatch(TEXTO_TESTE);
    fireEvent.click(screen.getByTestId("paywall-w-voltar"));
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy()); // 1ª saída: o presente
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    expect(onVoltar).not.toHaveBeenCalled(); // o presente segurou o fechar
    fireEvent.click(screen.getByTestId("presente-direto-agora-nao"));
    fireEvent.click(screen.getByTestId("paywall-w-voltar"));
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    expect(onVoltar).toHaveBeenCalledTimes(1);
    expect(eventos("funnel_view")[0]).toMatchObject({ funil: "planos", paywall_oferta: braco });
  });
  it("AppPurchaseSheet (/planos) no iPhone sem teste abre este desenho, no braço do aparelho", async () => {
    render(<MemoryRouter><AppPurchaseSheet onClose={() => {}} /></MemoryRouter>);
    expect(await screen.findByTestId("planos-ios-paywall-w")).toBeTruthy();
    const w = await screen.findByTestId("paywall-w-sem-teste");
    expect(w.dataset.modo).toBe("planos");
    expect(w.dataset.oferta).toBe(braco);
  });
});

/* ─────────────────────── o vitalício comprado: acesso permanente ─────────────────────── */
describe("vitalício comprado = acesso permanente (servidor)", () => {
  const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");
  const semTipos = (js: string) => js.replace(/:\s*Record<[^=]*>\s*=/g, " =").replace(/ as number \| null/g, "").replace(/\(storeId: string \| null \| undefined\)/, "(storeId)");
  it.each(["revenuecat-sync/index.ts", "revenuecat-webhook/index.ts"])("%s: core_vitalicio_97 = vitalício 9790, acesso até 2126", (f) => {
    const s = fonte(f);
    const mapa = s.match(/const PRODUTOS: Record<string, \{ billing: string; cents: number \}> = \{[\s\S]*?\n\};/)?.[0];
    const info = s.match(/const infoProduto = \(storeId[\s\S]*?\n\};/)?.[0];
    const infoProduto = new Function(`${semTipos(mapa!)}\n${semTipos(info!)}\nreturn infoProduto;`)() as (id: string) => { billing: string; cents: number };
    expect(infoProduto("core_vitalicio_97")).toEqual({ billing: "lifetime", cents: 9790 });
    expect(s).toMatch(/FIM_VITALICIO = "2126-/);
    expect(s).toMatch(/startsWith\("core_vitalicio"\)/); // a compra única mora em /purchases e vira linha vitalícia
  });
  it("afiliados: a compra única (NON_RENEWING_PURCHASE) do vitalício conta 97,90 bruto / 80,30 líquido", () => {
    const ev: EventoRC = { type: "NON_RENEWING_PURCHASE", store: "APP_STORE", product_id: "core_vitalicio_97", offer_code: "BIA", price: 17.9, price_in_purchased_currency: 97.9, currency: "BRL", transaction_id: "tx-v", original_transaction_id: "tx-v", purchased_at_ms: Date.UTC(2026, 10, 12), app_user_id: "22222222-2222-2222-2222-222222222222" };
    expect(classificarEvento(ev)).toMatchObject({ tipo: "pago", bruto: 9790, liquido: 8030, plataforma: "ios", produto: "core_vitalicio_97" });
    // sem preço em BRL no evento: o preço cheio do produto
    expect(classificarEvento({ ...ev, price_in_purchased_currency: 19.99, currency: "USD" })).toMatchObject({ tipo: "pago", bruto: 9790 });
  });
});
