/**
 * A MISSÃO NASCE NA ÁREA QUE A PESSOA ESCOLHEU (01/10). Bug medido nas turmas
 * do teste do iPhone: 162 de 162 Missões em Finanças — o funil W grava a área
 * em `core-funil-w-area` (formato {v, t} da retomada) e a Missão lia só o
 * `core-funnel-area` do funil antigo. Quem escolheu rotina (33) ou treino (6)
 * recebia "Anota qualquer gasto de hoje".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
}));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => { eventos.push([n, d]); } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: true }) }));

import { MissaoDoTrial, areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";
import { missaoAtual } from "@/lib/teste-gratis";
import { CHAVES_FUNIL_W, guardarChave } from "@/pages/funis/w/retomada";

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <MissaoDoTrial />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86_400_000));
});
afterEach(() => {
  cleanup();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("areaEscolhidaNoFunil", () => {
  it("lê a área do funil W (core-funil-w-area, formato {v,t})", () => {
    guardarChave(CHAVES_FUNIL_W.area, "corpo");
    expect(areaEscolhidaNoFunil()).toBe("corpo");
  });
  it("sem o funil W, cai no funil antigo (core-funnel-area)", () => {
    localStorage.setItem("core-funnel-area", "rotina");
    expect(areaEscolhidaNoFunil()).toBe("rotina");
  });
  it("o funil W vence o antigo quando os dois existem", () => {
    localStorage.setItem("core-funnel-area", "dinheiro");
    guardarChave(CHAVES_FUNIL_W.area, "saude");
    expect(areaEscolhidaNoFunil()).toBe("saude");
  });
  it("chave vencida (30 dias) ou corrompida não vale", () => {
    localStorage.setItem(CHAVES_FUNIL_W.area, JSON.stringify({ v: "corpo", t: Date.now() - 31 * 86_400_000 }));
    expect(areaEscolhidaNoFunil()).toBeNull();
    localStorage.setItem(CHAVES_FUNIL_W.area, "{lixo");
    expect(areaEscolhidaNoFunil()).toBeNull();
  });
});

describe("a Missão nasce na área do funil W", () => {
  it("quem escolheu 'Minha rotina e hábitos' na porta do iPhone recebe a Missão de Rotina", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    montar();
    expect(await screen.findByText(/Seu primeiro registro em Rotina/)).toBeInTheDocument();
    expect(missaoAtual()?.area).toBe("rotina");
    expect(eventos).toContainEqual(["missao_area", { escolhida: "rotina", usada: "rotina", origem: "funil_w" }]);
  });

  it("'Treino e alimentação' (corpo) vira a Missão de Treino", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "corpo");
    montar();
    expect(await screen.findByText(/Seu primeiro registro em Corpo/)).toBeInTheDocument();
    expect(missaoAtual()?.area).toBe("corpo");
  });

  it("sem nenhuma área gravada: Finanças, como sempre (padrão), e o evento diz que foi padrão", async () => {
    montar();
    expect(await screen.findByText(/Seu primeiro registro em Dinheiro/)).toBeInTheDocument();
    expect(missaoAtual()?.area).toBe("dinheiro");
    expect(eventos).toContainEqual(["missao_area", { escolhida: "dinheiro", usada: "dinheiro", origem: "funil_antigo_ou_padrao" }]);
  });

  it("área desconhecida gravada no funil não derruba a Missão: cai em dinheiro", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "viagens");
    montar();
    expect(await screen.findByText(/Seu primeiro registro em Dinheiro/)).toBeInTheDocument();
    expect(missaoAtual()?.area).toBe("dinheiro");
  });

  it("o guia da semente (teste sem cartão) continua mandando acima do funil", async () => {
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    localStorage.setItem("core-guia-semente", JSON.stringify({ area: "saude", passo: 1, status: "pendente" }));
    montar();
    expect(await screen.findByText(/Seu primeiro registro em Saúde/)).toBeInTheDocument();
    expect(missaoAtual()?.area).toBe("saude");
  });
});
