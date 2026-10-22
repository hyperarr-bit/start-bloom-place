/**
 * iPHONE 1.0.18 (dono 22/10): o pedido de avaliação também pra quem está no TESTE GRÁTIS (renovação ligada) e
 * VOLTOU no dia 2 (dia BRT diferente da compra do teste, ≥ 20 h depois), no mesmo momento de valor do pagante.
 * Chave `avaliacao_teste_dia2` (padrão off) — off = a regra de 23/09, igual.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
  track: vi.fn(), requestReview: vi.fn(async () => {}), trial: true, assinante: true, plataforma: "ios",
  teste: null as null | { ativo: boolean; cancelado: boolean; inicioMs: number | null },
  lerTeste: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: m.requestReview } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => m.plataforma, isNativePlatform: () => true } }));
vi.mock("@/lib/teste-gratis", () => ({ trialCartaoAtivo: () => m.trial }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: m.assinante, subLoaded: true }) }));
vi.mock("@/lib/revenuecat", () => ({ testeParaAvaliacao: m.lerTeste }));

import { deveConvidarTesteNoDia2, registrarDiaDeUso, rotaDoMomentoDeValorTeste, outraTelaNaFrente } from "@/lib/avaliacao";
import {
  CHAVE_AVALIACAO_TESTE_DIA2_APARELHO, _zerarAvaliacaoTesteDia2Remoto, avaliacaoTesteDia2Ligada, guardarForcaAvaliacaoTesteDia2,
  lerAvaliacaoTesteDia2Remoto, registrarAvaliacaoTesteDia2Remoto,
} from "@/lib/avaliacao-teste-dia2";
import { ConviteDeValor } from "@/components/avaliacao/ConviteDeValor";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

const H = 3600_000;
const plataforma = (p: string) => {
  m.plataforma = p;
  (window as unknown as { Capacitor: unknown }).Capacitor = { getPlatform: () => p, isNativePlatform: () => true };
};
const doisDias = () => { registrarDiaDeUso(new Date(2026, 9, 20, 10)); registrarDiaDeUso(new Date(2026, 9, 21, 10)); };
const ligar = () => guardarForcaAvaliacaoTesteDia2("?avaliacao-teste-dia2=on");
const acao = (action: string) => act(() => { window.dispatchEvent(new CustomEvent("core:activation", { detail: { action, key: "k" } })); });
const esperar = () => new Promise((r) => setTimeout(r, 1800));
/** Teste comprado ontem (26 h atrás = dia BRT diferente e ≥ 20 h), renovação ligada. */
const testeDoDia2 = () => { m.teste = { ativo: true, cancelado: false, inicioMs: Date.now() - 26 * H }; };

beforeEach(() => {
  localStorage.clear();
  _zerarAvaliacaoTesteDia2Remoto();
  m.track.mockClear(); m.requestReview.mockClear();
  m.lerTeste.mockReset(); m.lerTeste.mockImplementation(async () => m.teste);
  m.trial = true; m.assinante = true; m.teste = null;
  plataforma("ios");
  window.history.replaceState({}, "", "/home");
  document.documentElement.removeAttribute("data-missao-dose");
});
afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  document.body.innerHTML = "";
});

describe("a chave avaliacao_teste_dia2 (RevenueCat + QA)", () => {
  it("padrão off; liga pela metadata (current vence), cópia no aparelho; some da metadata = off; QA on/off/auto", () => {
    expect(avaliacaoTesteDia2Ligada()).toBe(false);
    expect(lerAvaliacaoTesteDia2Remoto({ current: { metadata: {} }, all: {} })).toBeNull();
    const cur = { metadata: { avaliacao_teste_dia2: "on" } };
    expect(lerAvaliacaoTesteDia2Remoto({ current: cur, all: { a: { metadata: { avaliacao_teste_dia2: "off" } }, cur } })).toBe("on");
    registrarAvaliacaoTesteDia2Remoto({ current: cur, all: { cur } });
    expect(avaliacaoTesteDia2Ligada()).toBe(true);
    expect(localStorage.getItem(CHAVE_AVALIACAO_TESTE_DIA2_APARELHO)).toBe("on");
    _zerarAvaliacaoTesteDia2Remoto();
    expect(avaliacaoTesteDia2Ligada()).toBe(true); // a última resposta do aparelho vale até o RevenueCat responder
    registrarAvaliacaoTesteDia2Remoto({ current: { metadata: {} }, all: {} });
    expect(avaliacaoTesteDia2Ligada()).toBe(false);
    expect(localStorage.getItem(CHAVE_AVALIACAO_TESTE_DIA2_APARELHO)).toBeNull();
    guardarForcaAvaliacaoTesteDia2("?avaliacao-teste-dia2=on");
    expect(avaliacaoTesteDia2Ligada()).toBe(true);
    guardarForcaAvaliacaoTesteDia2("?avaliacao-teste-dia2=auto");
    expect(avaliacaoTesteDia2Ligada()).toBe(false);
  });
  it("as chaves novas são do aparelho (nenhuma vassoura leva)", () => {
    for (const k of ["core-avaliacao-teste-dia2", "core-avaliacao-convite-teste-dia2", "avaliacao-teste-dia2-force"]) expect(vassouraLeva(k), k).toBe(false);
  });
});

describe("leitura do teste na loja (RevenueCat)", () => {
  it("TRIAL ativo: início = latestPurchaseDateMillis (sem ela, fim − 3 dias); cancelado = unsubscribe ou willRenew false sem cartão recusado", async () => {
    const { lerTesteParaAvaliacao } = await vi.importActual<typeof import("@/lib/revenuecat")>("@/lib/revenuecat");
    const ent = (e: Record<string, unknown>) => ({ entitlements: { active: { pro: { periodType: "TRIAL", ...e } } } });
    expect(lerTesteParaAvaliacao(ent({ latestPurchaseDateMillis: 1000, willRenew: true }))).toEqual({ ativo: true, cancelado: false, inicioMs: 1000 });
    expect(lerTesteParaAvaliacao(ent({ expirationDateMillis: 10 * 86_400_000 })).inicioMs).toBe(7 * 86_400_000);
    expect(lerTesteParaAvaliacao(ent({ latestPurchaseDateMillis: 1, unsubscribeDetectedAt: "2026-10-21" })).cancelado).toBe(true);
    expect(lerTesteParaAvaliacao(ent({ latestPurchaseDateMillis: 1, willRenew: false })).cancelado).toBe(true);
    expect(lerTesteParaAvaliacao(ent({ latestPurchaseDateMillis: 1, willRenew: false, billingIssueDetectedAt: "x" })).cancelado).toBe(false);
    expect(lerTesteParaAvaliacao({ entitlements: { active: { pro: { periodType: "NORMAL" } } } }).ativo).toBe(false);
  });
});

describe("regra pura do teste no dia 2", () => {
  // 21/10 00:30 BRT = 03:30 UTC
  const inicio = Date.UTC(2026, 9, 21, 3, 30);
  const base = { ligada: true, iphone: true, acao: "first_transaction", teste: { ativo: true, cancelado: false, inicioMs: inicio }, agora: inicio + 26 * H, dias: 2, podePedir: true, conviteRecente: false };
  it("teste ativo, renovação ligada, dia BRT seguinte e ≥ 20 h, ação de valor, 2 dias de uso: pede", () => {
    expect(deveConvidarTesteNoDia2(base)).toBe(true);
  });
  it("não pede: chave off, Android, ação que não é de valor, sem teste, teste cancelado, sem início, 1 dia de uso, convite recente, cota fechada", () => {
    expect(deveConvidarTesteNoDia2({ ...base, ligada: false })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, iphone: false })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, acao: "first_note" })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, teste: null })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, teste: { ativo: false, cancelado: false, inicioMs: inicio } })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, teste: { ativo: true, cancelado: true, inicioMs: inicio } })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, teste: { ativo: true, cancelado: false, inicioMs: null } })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, dias: 1 })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, conviteRecente: true })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, podePedir: false })).toBe(false);
  });
  it("dia 1: mesmo dia BRT mesmo com 21 h (00:30 → 21:30) não pede; dia seguinte com menos de 20 h (23:00 → 08:00) não pede", () => {
    expect(deveConvidarTesteNoDia2({ ...base, agora: inicio + 21 * H })).toBe(false);
    const noite = Date.UTC(2026, 9, 22, 2, 0); // 21/10 23:00 BRT
    const t = { ativo: true, cancelado: false, inicioMs: noite };
    expect(deveConvidarTesteNoDia2({ ...base, teste: t, agora: noite + 9 * H })).toBe(false);
    expect(deveConvidarTesteNoDia2({ ...base, teste: t, agora: noite + 20 * H })).toBe(true);
  });
  it("telas: só Home e módulos (nada de funil, paywall, planos, demo, treino)", () => {
    for (const r of ["/home", "/financas", "/rotina", "/hoje"]) expect(rotaDoMomentoDeValorTeste(r), r).toBe(true);
    for (const r of ["/comece", "/comecar", "/planos", "/assinatura", "/assinar", "/auth", "/bem-vindo", "/missao", "/hoje/demo", "/preview/financas", "/treino", "/"]) {
      expect(rotaDoMomentoDeValorTeste(r), r).toBe(false);
    }
  });
});

describe("ConviteDeValor com o teste no dia 2", () => {
  it("OFF (padrão) = igual a hoje: teste no dia 2 não é pedido e a loja nem é consultada; o pagante segue pedido com publico 'pagante'", async () => {
    doisDias(); testeDoDia2();
    const { unmount } = render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
    expect(m.lerTeste).not.toHaveBeenCalled();
    unmount();
    m.trial = false;
    render(<ConviteDeValor />);
    acao("first_transaction");
    await waitFor(() => expect(m.requestReview).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(m.track).toHaveBeenCalledWith("app_avaliacao_pedida", expect.objectContaining({ motivo: "momento_valor", pagante: true, publico: "pagante" }));
  });

  it("ON: teste que voltou no dia 2 conclui uma ação → caixinha da Apple, evento com publico 'teste_dia2'; reabrir o app não repete", async () => {
    ligar(); doisDias(); testeDoDia2();
    const { unmount } = render(<ConviteDeValor />);
    acao("first_transaction");
    await waitFor(() => expect(m.requestReview).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(m.track).toHaveBeenCalledWith("app_avaliacao_pedida", expect.objectContaining({ motivo: "momento_valor", publico: "teste_dia2", pagante: false }));
    expect(localStorage.getItem("core-avaliacao-convite-teste-dia2")).toBe("1");
    // fecha e reabre o app: outra ação de valor não pede de novo (90 dias / semana)
    unmount();
    render(<ConviteDeValor />);
    acao("first_habit");
    await esperar();
    expect(m.requestReview).toHaveBeenCalledTimes(1);
  });

  it("ON: teste no dia 1 (comprou há 2 h) não pede", async () => {
    ligar(); doisDias();
    m.teste = { ativo: true, cancelado: false, inicioMs: Date.now() - 2 * H };
    render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
    expect(localStorage.getItem("core-avaliacao-convite-teste-dia2")).toBeNull(); // a semana não foi gasta
  });

  it("ON: teste cancelado (sem renovação) não pede, mesmo no dia 2", async () => {
    ligar(); doisDias();
    m.teste = { ativo: true, cancelado: true, inicioMs: Date.now() - 26 * H };
    render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
  });

  it("ON: loja sem resposta (null) não pede", async () => {
    ligar(); doisDias();
    m.teste = null;
    render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
  });

  it("ON: não pede por cima de outra tela (escolha do dia 2, card da recusa, diálogo, festa de adesivo, dose da missão) nem fora da Home/módulos — a reserva fica pra próxima ação", async () => {
    ligar(); doisDias(); testeDoDia2();
    render(<ConviteDeValor />);
    const camadas: Array<[string, string]> = [
      ["data-camada-guia", "missao-doses-convite"], // EscolhaDoDia2 / convite do dia
      ["data-testid", "card-recusa"],
      ["role", "dialog"],
      ["role", "alertdialog"],
      ["data-momento", ""],
      ["data-camada-guia", "missao-doses-fim"], // "Você construiu isso em 3 dias"
    ];
    for (const [attr, v] of camadas) {
      const el = document.createElement("div");
      el.setAttribute(attr, v);
      document.body.appendChild(el);
      expect(outraTelaNaFrente()).toBe(true);
      acao("first_transaction");
      await esperar();
      expect(m.requestReview, `${attr}=${v}`).not.toHaveBeenCalled();
      el.remove();
    }
    document.documentElement.setAttribute("data-missao-dose", "1");
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
    document.documentElement.removeAttribute("data-missao-dose");
    window.history.replaceState({}, "", "/planos");
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
    // tela livre, de volta à Home: agora pede
    window.history.replaceState({}, "", "/home");
    acao("first_transaction");
    await waitFor(() => expect(m.requestReview).toHaveBeenCalledTimes(1), { timeout: 4000 });
  }, 20_000);

  it("ON: se uma tela abrir enquanto a loja responde, não pede", async () => {
    ligar(); doisDias(); testeDoDia2();
    m.lerTeste.mockImplementation(async () => {
      const el = document.createElement("div");
      el.setAttribute("data-testid", "card-recusa");
      document.body.appendChild(el);
      return m.teste;
    });
    render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.lerTeste).toHaveBeenCalled();
    expect(m.requestReview).not.toHaveBeenCalled();
  });

  it("ON, Android: nada muda (o ConviteDeValor não faz nada)", async () => {
    ligar(); doisDias(); testeDoDia2(); plataforma("android");
    render(<ConviteDeValor />);
    acao("first_transaction");
    await esperar();
    expect(m.requestReview).not.toHaveBeenCalled();
    expect(m.lerTeste).not.toHaveBeenCalled();
  });
});
