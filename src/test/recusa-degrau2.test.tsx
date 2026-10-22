/**
 * 2º DEGRAU DA RECUSA (1.0.18, dono 22/10) — lib/mensal-degraus + components/paywall/MensalHeroi, dentro do
 * AvisoCobrancaRecusada. O mensal 19,90 "estilo BitePal" pra quem segue com o cartão recusado 7+ dias depois do card
 * da recusa, ou sem acesso. Chave `recusa_degrau2` (padrão OFF), 1x por recusa, só com a offering `mensal_19`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";

const estado = vi.hoisted(() => ({
  problema: { temProblema: true, comAcesso: true, url: null, detectadoEm: "2026-10-10T10:00:00Z" } as {
    temProblema: boolean; comAcesso: boolean; url: string | null; detectadoEm?: string | null; produto?: string | null;
  },
  oferta: { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9, precoDe: "R$ 24,90", fimMs: null } as null | Record<string, unknown>,
  compraOk: true,
  motivo: null as string | null,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  problemaDeCobranca: vi.fn(async () => estado.problema),
  comprarMensal19: vi.fn(async () => estado.compraOk),
  motivoUltimaCompra: vi.fn(() => estado.motivo),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/components/paywall/OfertaMensal19", async (original) => ({
  ...(await original<typeof import("@/components/paywall/OfertaMensal19")>()),
  carregarOfertaMensal19: vi.fn(async () => estado.oferta),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/lib/conta-ja-tinha-acesso", async (original) => ({
  ...(await original<typeof import("@/lib/conta-ja-tinha-acesso")>()),
  acessoAnteriorDaSessao: vi.fn(async () => null),
}));
vi.mock("@/lib/cobranca-nativa", async (original) => ({
  ...(await original<typeof import("@/lib/cobranca-nativa")>()),
  segurarFolhaNativa: vi.fn(async () => {}),
}));

import { trackEvent } from "@/lib/analytics";
import { comprarMensal19 } from "@/lib/revenuecat";
import { carregarOfertaMensal19 } from "@/components/paywall/OfertaMensal19";
import { AvisoCobrancaRecusada } from "@/components/app/AvisoCobrancaRecusada";
import { zerarAvisoDaAbertura } from "@/lib/cobranca-recusada";
import { CHAVE_CARD_RECUSA_VISTO, CHAVE_CARD_RECUSA_VISTO_EM, _zerarCardRecusaRemoto, registrarCardRecusaRemoto } from "@/lib/card-recusa";
import {
  CHAVE_DEGRAU2_APARELHO, CHAVE_DEGRAU2_VISTO, CHAVE_FORCA_DEGRAU2, RECUSA_DEGRAU2, _zerarDegrau2Remoto, degrau2JaVisto,
  guardarForcaDegrau2, lerDegrau2Remoto, modoDegrau2, recusaNoPontoDoDegrau2, registrarDegrau2Remoto,
} from "@/lib/mensal-degraus";
import { oQueJaMontou, partesDoPreco } from "@/components/paywall/MensalHeroi";
import { ehChaveDoAparelho } from "@/lib/chaves-do-aparelho";

const DIA = 86_400_000;
const RECUSA = "2026-10-10T10:00:00Z";
const plataforma = (p: "ios" | "android" | null) => {
  if (!p) delete (window as { Capacitor?: unknown }).Capacitor;
  else (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
};
const ligar = (v: "on" | "off" = "on", outras: Record<string, unknown> = {}) =>
  registrarDegrau2Remoto({ current: { identifier: "default", metadata: { recusa_degrau2: v, ...outras } }, all: {} });
/** O card desta recusa apareceu há N dias (gravado pelo card da 1.0.18). */
const cardVistoHa = (dias: number, recusa = RECUSA) => {
  localStorage.setItem(CHAVE_CARD_RECUSA_VISTO, recusa);
  localStorage.setItem(CHAVE_CARD_RECUSA_VISTO_EM, String(Date.now() - dias * DIA));
};
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome);
const abrirOApp = async () => {
  cleanup();
  zerarAvisoDaAbertura();
  render(<AvisoCobrancaRecusada />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const degrau2 = () => screen.queryByTestId("mensal-heroi-degrau2");

beforeEach(() => {
  localStorage.clear();
  _zerarCardRecusaRemoto();
  _zerarDegrau2Remoto();
  zerarAvisoDaAbertura();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarMensal19).mockClear();
  vi.mocked(carregarOfertaMensal19).mockClear();
  estado.problema = { temProblema: true, comAcesso: true, url: null, detectadoEm: RECUSA };
  estado.oferta = { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9, precoDe: "R$ 24,90", fimMs: null };
  estado.compraOk = true;
  estado.motivo = null;
  plataforma("ios");
});
afterEach(() => { cleanup(); plataforma(null); });

describe("2º degrau da recusa — a chave", () => {
  it("padrão OFF; a metadata (current vence) liga; tirar a chave volta pro off; o aparelho guarda a última resposta", () => {
    expect(RECUSA_DEGRAU2).toBe("off");
    expect(modoDegrau2()).toBe("off");
    expect(lerDegrau2Remoto({ current: { metadata: { recusa_degrau2: "off" } }, all: { m: { metadata: { recusa_degrau2: "on" } } } })).toBe("off");
    expect(lerDegrau2Remoto({ current: { metadata: {} }, all: { mensal_19: { metadata: { recusa_degrau2: "ON" } } } })).toBe("on");
    expect(lerDegrau2Remoto({ current: { metadata: { recusa_degrau2: "talvez" } } })).toBeNull();
    ligar("on");
    expect(localStorage.getItem(CHAVE_DEGRAU2_APARELHO)).toBe("on");
    _zerarDegrau2Remoto();
    expect(modoDegrau2()).toBe("on");
    registrarDegrau2Remoto({ current: { metadata: {} }, all: {} });
    expect(modoDegrau2()).toBe("off");
  });

  it("QA `?recusa-degrau2=on|off|auto|agora[,recomecar]`; `agora` dispensa a espera do card", () => {
    guardarForcaDegrau2("?recusa-degrau2=on");
    expect(modoDegrau2()).toBe("on");
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: RECUSA })).toBe(false);
    guardarForcaDegrau2("?recusa-degrau2=agora");
    expect(modoDegrau2()).toBe("on");
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: RECUSA })).toBe(true);
    localStorage.setItem(CHAVE_DEGRAU2_VISTO, RECUSA);
    guardarForcaDegrau2("?recusa-degrau2=off,recomecar");
    expect(modoDegrau2()).toBe("off");
    expect(degrau2JaVisto(RECUSA)).toBe(false);
    guardarForcaDegrau2("?recusa-degrau2=auto");
    expect(localStorage.getItem(CHAVE_FORCA_DEGRAU2)).toBeNull();
  });

  it("a régua do tempo: com acesso só 7+ dias depois do card desta recusa; sem acesso, sim", () => {
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: RECUSA })).toBe(false); // card nunca visto
    cardVistoHa(6.9);
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: RECUSA })).toBe(false);
    cardVistoHa(7);
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: RECUSA })).toBe(true);
    // o card visto era de OUTRA recusa
    expect(recusaNoPontoDoDegrau2({ comAcesso: true, detectadoEm: "2026-11-10T10:00:00Z" })).toBe(false);
    expect(recusaNoPontoDoDegrau2({ comAcesso: false, detectadoEm: "2026-11-10T10:00:00Z" })).toBe(true);
  });

  it("as chaves novas são do aparelho (nenhuma vassoura apaga)", () => {
    for (const k of ["core-recusa-degrau2", "core-recusa-degrau2-visto", "core-card-recusa-visto-em", "core-motivos-folha", "core-motivos-braco"]) {
      expect(ehChaveDoAparelho(k)).toBe(true);
    }
  });
});

describe("2º degrau da recusa — na tela", () => {
  it("chave OFF: igual a hoje — card visto há 8 dias, a recusa segue, e só a tela/faixa de sempre", async () => {
    cardVistoHa(8);
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    expect(carregarOfertaMensal19).not.toHaveBeenCalled();
    expect(eventos("degrau2_view")).toHaveLength(0);
    expect(localStorage.getItem(CHAVE_DEGRAU2_VISTO)).toBeNull();
  });

  it("ON, com acesso, card há 8 dias: a tela do mensal 1x, com o preço-herói e a regra do card; marca na hora", async () => {
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    const tela = await screen.findByTestId("mensal-heroi-degrau2");
    expect(screen.getByText("Seu CORE continua por")).toBeInTheDocument();
    expect(screen.getByTestId("mensal-heroi-preco")).toHaveAttribute("aria-label", "R$ 19,90 por mês");
    expect(screen.getByTestId("mensal-heroi-cta")).toHaveTextContent("Mudar pro mensal");
    expect(screen.getByTestId("mensal-heroi-regra").textContent).toBe("Você segue usando enquanto a App Store tenta cobrar o valor menor. Renova todo mês até você cancelar.");
    expect(screen.getByTestId("mensal-heroi-agora-nao")).toHaveTextContent("Agora não");
    // nada inventado: sem dados da conta, sem o bloco
    expect(screen.queryByTestId("mensal-heroi-construido")).toBeNull();
    // copy: título sem ponto final; nada de 24 h, Pix, site; não promete acesso imediato
    expect(screen.getByText("Seu CORE continua por").textContent).not.toMatch(/\.$/);
    expect(tela.textContent).not.toMatch(/24 ?h|Pix|site|antes de|na hora|agora mesmo|imediat/i);
    // nada por baixo
    expect(screen.queryByText("Seu pagamento não passou")).toBeNull();
    expect(eventos("aviso_cobranca_view")).toHaveLength(0);
    expect(eventos("degrau2_view")).toEqual([["degrau2_view", { com_acesso: true, dias_restantes: expect.any(Number), preco: "R$ 19,90", construido: 0 }]]);
    expect(localStorage.getItem(CHAVE_DEGRAU2_VISTO)).toBe(RECUSA);
  });

  it("reabrir não repete (fechou o app com a tela aberta); outra recusa pode mostrar de novo", async () => {
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    await screen.findByTestId("mensal-heroi-degrau2");
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    await abrirOApp();
    expect(degrau2()).toBeNull();
    expect(eventos("degrau2_view")).toHaveLength(1);
    // um mês depois, outra recusa sem acesso
    estado.problema = { ...estado.problema, comAcesso: false, detectadoEm: "2026-11-10T10:00:00Z" };
    await abrirOApp();
    expect(await screen.findByTestId("mensal-heroi-degrau2")).toBeInTheDocument();
    expect(eventos("degrau2_view")).toHaveLength(2);
  });

  it("ON, com acesso: card há 3 dias ou card nunca visto → ainda não", async () => {
    ligar();
    cardVistoHa(3);
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    localStorage.clear(); ligar();
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    expect(eventos("degrau2_view")).toHaveLength(0);
  });

  it("ON, SEM acesso (o bloqueio do cartão recusado): mostra, e o texto não promete acesso na hora", async () => {
    ligar();
    estado.problema = { ...estado.problema, comAcesso: false };
    await abrirOApp();
    await screen.findByTestId("mensal-heroi-degrau2");
    expect(screen.getByText("Seu CORE volta por")).toBeInTheDocument();
    expect(screen.getByTestId("mensal-heroi-regra").textContent).toBe("O acesso volta quando a App Store conseguir cobrar o valor menor. Renova todo mês até você cancelar.");
    expect(eventos("degrau2_view")[0][1]).toMatchObject({ com_acesso: false });
  });

  it("nunca na mesma abertura do card: o card ganha; fechado, a faixa; o degrau vem numa abertura seguinte", async () => {
    ligar("on", { card_recusa: "on" });
    registrarCardRecusaRemoto({ current: { metadata: { card_recusa: "on" } }, all: {} });
    estado.problema = { ...estado.problema, comAcesso: false };
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    expect(degrau2()).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-agora-nao")); });
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    expect(eventos("degrau2_view")).toHaveLength(0);
    await abrirOApp();
    expect(await screen.findByTestId("mensal-heroi-degrau2")).toBeInTheDocument();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
  });

  it("SEM a offering mensal_19 (hoje): nada aparece, nada é gravado, e a faixa de sempre", async () => {
    estado.oferta = null;
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    expect(localStorage.getItem(CHAVE_DEGRAU2_VISTO)).toBeNull();
    expect(eventos("degrau2_view")).toHaveLength(0);
  });

  it("'Mudar pro mensal' com sucesso: compra (lugar degrau2) e 'Plano trocado' sem prometer acesso na hora", async () => {
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    await screen.findByTestId("mensal-heroi-degrau2");
    await act(async () => { fireEvent.click(screen.getByTestId("mensal-heroi-cta")); });
    await waitFor(() => expect(screen.getByTestId("mensal-heroi-trocou")).toBeInTheDocument());
    expect(comprarMensal19).toHaveBeenCalledWith("degrau2");
    expect(screen.getByText("Plano trocado")).toBeInTheDocument();
    expect(screen.getByTestId("mensal-heroi-trocou").textContent).toBe("Agora é R$ 19,90 por mês. A App Store cobra o valor novo na próxima tentativa.");
    expect(eventos("degrau2_compra")[0][1]).toMatchObject({ resultado: "sucesso", motivo: null, preco: "R$ 19,90", com_acesso: true });
    await act(async () => { fireEvent.click(screen.getByTestId("mensal-heroi-entendi")); });
    expect(degrau2()).toBeNull();
  });

  it("folha cancelada: resultado 'cancelou', a tela fica sem erro; erro da loja: 'falhou' e a frase de sempre", async () => {
    estado.compraOk = false; estado.motivo = "cancelou";
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    await screen.findByTestId("mensal-heroi-degrau2");
    await act(async () => { fireEvent.click(screen.getByTestId("mensal-heroi-cta")); });
    await waitFor(() => expect(eventos("degrau2_compra")).toHaveLength(1));
    expect(eventos("degrau2_compra")[0][1]).toMatchObject({ resultado: "cancelou", motivo: "cancelou" });
    expect(degrau2()).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    estado.motivo = "billing_erro";
    await act(async () => { fireEvent.click(screen.getByTestId("mensal-heroi-cta")); });
    await waitFor(() => expect(eventos("degrau2_compra")).toHaveLength(2));
    expect(eventos("degrau2_compra")[1][1]).toMatchObject({ resultado: "falhou", motivo: "billing_erro" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("'Agora não': evento, a tela sai e fica a faixa de sempre nesta abertura", async () => {
    ligar();
    cardVistoHa(8);
    await abrirOApp();
    await screen.findByTestId("mensal-heroi-degrau2");
    await act(async () => { fireEvent.click(screen.getByTestId("mensal-heroi-agora-nao")); });
    expect(degrau2()).toBeNull();
    expect(eventos("degrau2_agora_nao")).toHaveLength(1);
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
  });

  it("quem trocou pro mensal no card não vê o 2º degrau dessa recusa; quem já está no core_mensal_19 também não", async () => {
    ligar("on");
    registrarCardRecusaRemoto({ current: { metadata: { card_recusa: "on" } }, all: {} });
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-mensal19")); });
    await waitFor(() => expect(screen.getByTestId("card-recusa-trocou")).toBeInTheDocument());
    expect(degrau2JaVisto(RECUSA)).toBe(true);
    localStorage.setItem(CHAVE_CARD_RECUSA_VISTO_EM, String(Date.now() - 8 * DIA));
    await abrirOApp();
    expect(degrau2()).toBeNull();
    // outra recusa, já no mensal 19 (card desligado)
    localStorage.clear(); _zerarCardRecusaRemoto(); ligar();
    estado.problema = { ...estado.problema, comAcesso: false, produto: "core_mensal_19" };
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
  });

  it("Android e web: nada, mesmo com a chave", async () => {
    plataforma("android");
    guardarForcaDegrau2("?recusa-degrau2=agora");
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(degrau2()).toBeNull();
    plataforma(null);
    await abrirOApp();
    expect(degrau2()).toBeNull();
  });
});

describe("o que a pessoa já montou (só dado real)", () => {
  it("dias com algo anotado (2+), o 'pode gastar hoje' das Finanças e os módulos com registro", () => {
    const hoje = new Date();
    const dados: Record<string, unknown> = {
      "core-dias-anotados": ["2026-10-01", "2026-10-02", "2026-10-05"],
      "finance-incomes": [{ value: 3000 }],
      "finance-fixed-expenses": [{ id: "a", value: 900 }],
      "finance-expenses": [{ value: 50, date: hoje.toISOString().slice(0, 10) }],
      "rotina-habits": ["Ler"],
    };
    const get = <T,>(k: string, d: T): T => (k in dados ? (dados[k] as T) : d);
    const linhas = oQueJaMontou(get);
    expect(linhas[0]).toBe("3 dias com o CORE");
    expect(linhas[1]).toMatch(/^Pode gastar R\$ [\d.]+ hoje$/);
    expect(linhas[2]).toBe("2 módulos montados");
  });

  it("conta vazia: nada (a tela nunca inventa)", () => {
    expect(oQueJaMontou((_k, d) => d)).toEqual([]);
    expect(oQueJaMontou(null)).toEqual([]);
  });

  it("o preço da loja vira moeda pequena + número grande", () => {
    expect(partesDoPreco("R$ 19,90")).toEqual({ antes: "R$", numero: "19,90" });
    expect(partesDoPreco("$4.99")).toEqual({ antes: "$", numero: "4.99" });
  });
});
