/**
 * iPHONE: NOTA SÓ DE QUEM PAGA E VOLTOU (23/09, ordem do dono).
 * 17–23/09: 97% dos pedidos de avaliação do iPhone iam pra quem nunca usou nem
 * pagou (plano pronto do funil). Agora: sem pedido no funil nem caixinha
 * automática; só a folha, depois de uma ação de valor, pra quem paga (fora do
 * trial) e usou em 2+ dias. Android intocado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const m = vi.hoisted(() => ({ track: vi.fn(), requestReview: vi.fn(async () => {}), trial: false, plataforma: "ios" }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: m.requestReview } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => m.plataforma, isNativePlatform: () => true } }));
vi.mock("@/lib/teste-gratis", () => ({ trialCartaoAtivo: () => m.trial }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: true, subLoaded: true }) }));

import {
  deveConvidarNoMomentoDeValor, registrarDiaDeUso, diasDeUso, reservarConviteDeValor, registrarRecusaDeValor,
  pedirAvaliacaoPlanoPronto, pedirAvaliacaoSePuder, reservarConvitePrimeiroGasto, reservarConviteDoFunil,
} from "@/lib/avaliacao";
import { ConviteAvaliacao } from "@/components/avaliacao/ConviteAvaliacao";
import { ConviteDeValor } from "@/components/avaliacao/ConviteDeValor";

const plataforma = (p: string) => {
  m.plataforma = p;
  (window as unknown as { Capacitor: unknown }).Capacitor = { getPlatform: () => p, isNativePlatform: () => true };
};
const doisDias = () => {
  registrarDiaDeUso(new Date(2026, 8, 21, 10));
  registrarDiaDeUso(new Date(2026, 8, 22, 10));
};

beforeEach(() => {
  localStorage.clear();
  m.track.mockClear(); m.requestReview.mockClear(); m.trial = false;
  plataforma("ios");
  window.history.replaceState({}, "", "/home");
});
afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; });

const base = { iphone: true, acao: "first_workout", pagante: true, emTrial: false, dias: 2, podePedir: true, conviteRecente: false, recusas: 0 };

describe("regra do convite de valor (pura)", () => {
  it("paga, fora do trial, 2 dias de uso, ação de valor, sem convite recente: convida", () => {
    expect(deveConvidarNoMomentoDeValor(base)).toBe(true);
  });
  it("não convida: Android, ação que não é de valor, não pagante, no trial, 1 dia só, convite recente, cota fechada, 2 recusas", () => {
    expect(deveConvidarNoMomentoDeValor({ ...base, iphone: false })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, acao: "first_note" })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, acao: null })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, pagante: false })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, emTrial: true })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, dias: 1 })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, conviteRecente: true })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, podePedir: false })).toBe(false);
    expect(deveConvidarNoMomentoDeValor({ ...base, recusas: 2 })).toBe(false);
  });
});

describe("dias de uso", () => {
  it("conta dias DIFERENTES: abrir 3× no mesmo dia é 1 dia", () => {
    registrarDiaDeUso(new Date(2026, 8, 21, 8));
    registrarDiaDeUso(new Date(2026, 8, 21, 13));
    registrarDiaDeUso(new Date(2026, 8, 21, 22));
    expect(diasDeUso()).toBe(1);
    registrarDiaDeUso(new Date(2026, 8, 22, 9));
    expect(diasDeUso()).toBe(2);
  });
});

describe("reservarConviteDeValor (iPhone)", () => {
  it("reserva uma vez e segura a semana; 1 dia de uso não basta", () => {
    registrarDiaDeUso(new Date(2026, 8, 21, 10));
    expect(reservarConviteDeValor("first_workout", { pagante: true, emTrial: false })).toBe(false);
    registrarDiaDeUso(new Date(2026, 8, 22, 10));
    expect(reservarConviteDeValor("first_workout", { pagante: true, emTrial: false })).toBe(true);
    expect(reservarConviteDeValor("first_transaction", { pagante: true, emTrial: false })).toBe(false); // mesma semana
  });
  it("depois de 2 'Agora não', nunca mais", () => {
    doisDias();
    registrarRecusaDeValor(); registrarRecusaDeValor();
    expect(reservarConviteDeValor("first_workout", { pagante: true, emTrial: false })).toBe(false);
  });
  it("no trial não convida (espera virar pagamento)", () => {
    doisDias();
    expect(reservarConviteDeValor("first_workout", { pagante: true, emTrial: true })).toBe(false);
  });
});

describe("iPhone: nada de pedido no funil nem caixinha automática", () => {
  it("plano pronto não pede no iPhone", async () => {
    expect(await pedirAvaliacaoPlanoPronto()).toBe(false);
    expect(m.requestReview).not.toHaveBeenCalled();
  });
  it("conta paga / sequência / retrospectiva não abrem a caixinha no iPhone", async () => {
    expect(await pedirAvaliacaoSePuder("conta_paga", { pagante: true })).toBe(false);
    expect(await pedirAvaliacaoSePuder("retrospectiva", { forte: true })).toBe(false);
    expect(m.requestReview).not.toHaveBeenCalled();
  });
  it("convites do 1º gasto e do funil não existem no iPhone", () => {
    expect(reservarConvitePrimeiroGasto("u1", "g1")).toBe(false);
    expect(reservarConviteDoFunil()).toBe(false);
  });
  it("Android segue como estava: plano pronto pede", async () => {
    plataforma("android");
    expect(await pedirAvaliacaoPlanoPronto()).toBe(true);
    expect(m.requestReview).toHaveBeenCalled();
  });
});

describe("folha no iPhone", () => {
  it("momento de valor: mostra o que acabou de fazer, os dias e fala App Store; 'Agora não' conta recusa", () => {
    const onRecusou = vi.fn(), onFechar = vi.fn();
    render(<ConviteAvaliacao momento={{ rotulo: "Treino registrado", dias: 3 }} pagante onRecusou={onRecusou} onFechar={onFechar} />);
    expect(screen.getByText("Treino registrado")).toBeInTheDocument();
    expect(screen.getByText("3 DIAS USANDO O CORE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deixar minha nota na App Store/ })).toBeInTheDocument();
    expect(screen.queryByText(/na Play/)).not.toBeInTheDocument();
    expect(screen.getByText(/É a sua nota na App Store que faz o app/)).toBeInTheDocument(); // espaço antes do "que" (print 23/09)
    fireEvent.click(screen.getByRole("button", { name: /Agora não/ }));
    expect(onRecusou).toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalled();
    expect(m.track).toHaveBeenCalledWith("app_avaliacao_convite", expect.objectContaining({ motivo: "momento_valor", acao: "recusou" }));
  });
  it("no Android a folha continua dizendo Play", () => {
    plataforma("android");
    render(<ConviteAvaliacao gasto={{ id: "g", descricao: "Mercado", valor: 10, categoria: "Alimentação" }} pagante onFechar={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Deixar minha nota na Play/ })).toBeInTheDocument();
    expect(screen.getByText(/É a sua nota na Play que faz o app/)).toBeInTheDocument();
  });
});

describe("ConviteDeValor (escuta as ações salvas)", () => {
  it("pagante com 2 dias de uso registra um treino → a folha abre com 'Treino registrado'", async () => {
    doisDias();
    render(<ConviteDeValor />);
    act(() => { window.dispatchEvent(new CustomEvent("core:activation", { detail: { action: "first_workout", key: "treino-semana-dos-checks" } })); });
    await waitFor(() => expect(screen.getByText("Treino registrado")).toBeInTheDocument(), { timeout: 4000 });
  });
  it("ação que não é de valor não abre nada", async () => {
    doisDias();
    render(<ConviteDeValor />);
    act(() => { window.dispatchEvent(new CustomEvent("core:activation", { detail: { action: "first_note", key: "notes" } })); });
    await new Promise((r) => setTimeout(r, 1800));
    expect(screen.queryByText(/DIAS USANDO O CORE/)).not.toBeInTheDocument();
  });
});
