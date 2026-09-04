/**
 * FOLHA DO GOOGLE — o que a autópsia de 28/08–02/09 achou escondido em
 * "cancelou a folha" (02/09):
 *  1. o app morre com a folha aberta e volta na WELCOME (progresso em
 *     sessionStorage) → agora retoma de onde parou, só no shell, com validade;
 *  2. "already active" (pagou, app morreu, tocou de novo) recebia "tenta de
 *     novo" → agora restaura, e tem nome próprio na telemetria;
 *  3. "not allowed" (conta Google que não pode comprar) idem → nome próprio.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn(), shell: { on: true } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: mocks.trackEvent, getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => mocks.shell.on }));

import { desfechoDaFalha, motivoUltimaCompra } from "@/lib/revenuecat";
import { CHAVES_FUNIL_W, VALIDADE_PROGRESSO_MS, guardarChave, lerChave, limparProgresso, passoDeRetomada } from "@/pages/funis/w/retomada";

beforeEach(() => { localStorage.clear(); mocks.trackEvent.mockClear(); mocks.shell.on = true; });

describe("desfechoDaFalha — triagem única das três folhas", () => {
  const falhou = (motivo: string) => mocks.trackEvent.mock.calls.some(([n, d]) => n === "app_compra_falhou" && (d as { motivo: string }).motivo === motivo);

  it("'already active' vira ja_ativo (e tenta restaurar antes de desistir)", async () => {
    const ok = await desfechoDaFalha({ code: "6", message: "This product is already active for the user." }, "core_vitalicio_97");
    expect(ok).toBe(false); // sem loja configurada, restaurar não tem como confirmar
    expect(motivoUltimaCompra()).toBe("ja_ativo");
    expect(mocks.trackEvent).toHaveBeenCalledWith("app_compra_ja_ativa", { produto: "core_vitalicio_97" });
    expect(falhou("ja_ativo")).toBe(true);
    expect(falhou("billing_erro")).toBe(false);
  });

  it("'not allowed' vira nao_permitido — não é cancelamento nem 'tenta de novo'", async () => {
    await desfechoDaFalha({ code: "3", message: "The device or user is not allowed to make the purchase." }, "core_mensal");
    expect(motivoUltimaCompra()).toBe("nao_permitido");
    expect(falhou("nao_permitido")).toBe(true);
    expect(falhou("cancelou")).toBe(false);
  });

  it("reconhece pela MENSAGEM quando o código não vem", async () => {
    await desfechoDaFalha(new Error("Item already owned"), "p");
    expect(motivoUltimaCompra()).toBe("ja_ativo");
    await desfechoDaFalha(new Error("The device or user is not allowed to make the purchase."), "p");
    expect(motivoUltimaCompra()).toBe("nao_permitido");
  });

  it("cancelou, pendente e erro genérico continuam iguais", async () => {
    await desfechoDaFalha({ code: "1", message: "Purchase was cancelled." }, "p");
    expect(motivoUltimaCompra()).toBe("cancelou");
    await desfechoDaFalha({ code: "20", message: "The payment is pending." }, "p");
    expect(motivoUltimaCompra()).toBe("pendente");
    expect(mocks.trackEvent).toHaveBeenCalledWith("app_compra_pendente", { produto: "p" });
    await desfechoDaFalha({ code: "2", message: "Error performing request." }, "p");
    expect(motivoUltimaCompra()).toBe("billing_erro");
  });
});

describe("retomada do funil W — o progresso sobrevive ao app morrer", () => {
  it("guarda com carimbo e lê de volta; vencido ou lixo = nada", () => {
    guardarChave(CHAVES_FUNIL_W.passo, "offer");
    expect(lerChave<string>(CHAVES_FUNIL_W.passo)).toBe("offer");
    localStorage.setItem(CHAVES_FUNIL_W.passo, JSON.stringify({ v: "offer", t: Date.now() - VALIDADE_PROGRESSO_MS - 1 }));
    expect(lerChave(CHAVES_FUNIL_W.passo)).toBeNull();
    localStorage.setItem(CHAVES_FUNIL_W.passo, "offer"); // formato antigo (sessionStorage cru)
    expect(lerChave(CHAVES_FUNIL_W.passo)).toBeNull();
    localStorage.setItem(CHAVES_FUNIL_W.passo, "{nope");
    expect(lerChave(CHAVES_FUNIL_W.passo)).toBeNull();
  });

  it("no shell, volta pro passo certo: paywall fica paywall, carregando vira o seguinte, pós-compra vira cadastro", () => {
    expect(passoDeRetomada("offer", true)).toBe("offer");
    expect(passoDeRetomada("contrato", true)).toBe("contrato");
    expect(passoDeRetomada("progress", true)).toBe("result");
    expect(passoDeRetomada("liberando", true)).toBe("signup");
    expect(passoDeRetomada("confirm", true)).toBe("signup");
    expect(passoDeRetomada("signup", true)).toBe("signup");
  });

  it("welcome/promessas/porta e nada salvo = começa do começo; na WEB nunca retoma", () => {
    expect(passoDeRetomada("welcome", true)).toBeNull();
    expect(passoDeRetomada("promessas", true)).toBeNull();
    expect(passoDeRetomada("porta", true)).toBeNull();
    expect(passoDeRetomada(null, true)).toBeNull();
    expect(passoDeRetomada("offer", false)).toBeNull();
  });

  it("limparProgresso apaga as quatro chaves (conta nasceu, funil acabou)", () => {
    for (const k of Object.values(CHAVES_FUNIL_W)) guardarChave(k, "x");
    limparProgresso();
    for (const k of Object.values(CHAVES_FUNIL_W)) expect(localStorage.getItem(k)).toBeNull();
  });
});

/* ============================================================
 * ANÚNCIO NA WEB COMEÇA NA PORTA (02/09) — 69% dos cliques pagos morriam
 * na welcome do app. No shell a welcome fica.
 * ============================================================ */
import { comecaNaPorta, veioDeAnuncio } from "@/pages/funis/w/retomada";
describe("anúncio na web → porta", () => {
  it("reconhece o clique pago pela URL ou pela atribuição guardada", () => {
    expect(veioDeAnuncio("?utm_campaign=kazu&utm_source=ig", {})).toBe(true);
    expect(veioDeAnuncio("?fbclid=abc", {})).toBe(true);
    expect(veioDeAnuncio("", { utm_campaign: "120250123961310041" })).toBe(true);
    expect(veioDeAnuncio("", {})).toBe(false);
    expect(veioDeAnuncio("?step=offer", { utm_source: "ig" })).toBe(false); // fonte sem campanha não conta
  });
  it("só na WEB e só de anúncio: o app mantém a welcome; direto/orgânico também", () => {
    expect(comecaNaPorta(false, true)).toBe(true);
    expect(comecaNaPorta(true, true)).toBe(false);
    expect(comecaNaPorta(false, false)).toBe(false);
  });
});

/* ============================================================
 * BOTÃO VOLTAR DO ANDROID (02/09) — 63% dos que não tocavam em comprar
 * "voltavam": era o Voltar físico caindo na demo pelo history.
 * ============================================================ */
import { passoAnteriorDe, ficaNoVoltar, PASSOS_DE_DEEP_LINK, RECUO_DO_PAYWALL } from "@/pages/funis/w/retomada";
describe("Voltar do Android no funil W", () => {
  it("volta de PASSO, nunca de history: contrato→compromissos→central→result→quiz→porta→welcome", () => {
    expect(passoAnteriorDe("contrato")).toBe("compromissos");
    expect(passoAnteriorDe("compromissos")).toBe("central");
    expect(passoAnteriorDe("central")).toBe("result");
    expect(passoAnteriorDe("result")).toBe("quiz");
    expect(passoAnteriorDe("quiz")).toBe("porta");
    expect(passoAnteriorDe("porta")).toBe("welcome");
    expect(passoAnteriorDe("notif")).toBe("contrato");
    // 03/09: a tela de prova mora entre o quiz e o carregamento do plano
    expect(passoAnteriorDe("prova")).toBe("quiz");
    expect(passoAnteriorDe("progress")).toBe("prova");
  });
  it("na welcome não há pra onde voltar (minimiza); no paywall e no pós-compra o Voltar FICA", () => {
    expect(passoAnteriorDe("welcome")).toBeNull();
    for (const s of ["offer", "signup", "confirm", "liberando"]) expect(ficaNoVoltar(s)).toBe(true);
    for (const s of ["welcome", "quiz", "contrato"]) expect(ficaNoVoltar(s)).toBe(false);
  });
  it("deep link (notificação) só abre passos que fazem sentido sem contexto", () => {
    expect(PASSOS_DE_DEEP_LINK.has("offer")).toBe(true);
    expect(PASSOS_DE_DEEP_LINK.has("compromissos")).toBe(true);
    expect(PASSOS_DE_DEEP_LINK.has("quiz")).toBe(false);
  });
});

import { alvoDoDeepLink } from "@/pages/funis/w/retomada";
describe("deep link depois de montado (revisão 02/09)", () => {
  it("quem acabou de pagar e voltou do Google vai pro liberando, nunca pro paywall", () => {
    expect(alvoDoDeepLink("offer", "signup", true)).toBe("liberando");
    expect(alvoDoDeepLink("offer", "signup", false)).toBeNull();
    expect(alvoDoDeepLink("offer", "liberando", false)).toBeNull();
  });
  it("notificação abre o paywall pra quem estava na welcome; passo igual ou fora da lista é ignorado", () => {
    expect(alvoDoDeepLink("offer", "welcome", false)).toBe("offer");
    expect(alvoDoDeepLink("compromissos", "quiz", false)).toBe("compromissos");
    expect(alvoDoDeepLink("offer", "offer", false)).toBeNull();
    expect(alvoDoDeepLink("quiz", "welcome", false)).toBeNull();
    expect(alvoDoDeepLink(null, "welcome", false)).toBeNull();
  });
});

/* ============================================================
 * O RECUO DO PAYWALL (03/09) — o 2º Voltar deixa de jogar pro launcher
 * ============================================================ */
describe("recuo do paywall", () => {
  it("o destino é o CONTRATO, e é um passo que existe no funil", () => {
    expect(RECUO_DO_PAYWALL).toBe("contrato");
    // e o caminho de volta ao paywall é curto: contrato → notif → offer
    expect(passoAnteriorDe("notif")).toBe("contrato");
    // 03/09: a tela de prova mora entre o quiz e o carregamento do plano
    expect(passoAnteriorDe("prova")).toBe("quiz");
    expect(passoAnteriorDe("progress")).toBe("prova");
  });

  it("o paywall continua sendo 'fica no Voltar' — o recuo é o 2º toque, não o 1º", () => {
    expect(ficaNoVoltar("offer")).toBe(true);
    // e o destino do recuo NÃO pode ser uma tela que também segura o Voltar,
    // senão o 2º toque cairia em outro laço
    expect(ficaNoVoltar(RECUO_DO_PAYWALL)).toBe(false);
  });

  it("do contrato o Voltar volta a andar de passo — ninguém fica preso", () => {
    expect(passoAnteriorDe(RECUO_DO_PAYWALL)).toBe("compromissos");
  });
});

/* ============================================================
 * OFERTAS DO PIX — display e cobrança andam juntos
 * ============================================================ */
describe("ofertas do checkout da web", () => {
  it("toda oferta tem preço e diz se é vitalícia", async () => {
    const { PIX_PRICES, OFERTA_VITALICIA } = await import("@/components/paywall/PixCheckout");
    for (const oferta of Object.keys(PIX_PRICES) as Array<keyof typeof PIX_PRICES>) {
      expect(PIX_PRICES[oferta]).toMatch(/^\d+,\d{2}$/);
      expect(typeof OFERTA_VITALICIA[oferta]).toBe("boolean");
    }
  });

  it("a w25 é o mês pré-pago: 24,90 e NÃO vitalícia", async () => {
    const { PIX_PRICES, OFERTA_VITALICIA } = await import("@/components/paywall/PixCheckout");
    expect(PIX_PRICES.w25).toBe("24,90");
    expect(OFERTA_VITALICIA.w25).toBe(false);
    // e a oferta cheia da web continua vitalícia a 97,90
    expect(PIX_PRICES.w97).toBe("97,90");
    expect(OFERTA_VITALICIA.w97).toBe(true);
  });

  it("o 27,90 não existe mais em oferta nenhuma", async () => {
    const { PIX_PRICES } = await import("@/components/paywall/PixCheckout");
    expect(Object.values(PIX_PRICES)).not.toContain("27,90");
  });
});
