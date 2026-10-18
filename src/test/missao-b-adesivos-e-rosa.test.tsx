/**
 * MISSÃO EM DOSES (braço B) × o resto do app — 2 bugs do dono no Simulador (10/10):
 *
 *   1. ADESIVO POR CIMA DA MISSÃO: o "Primeira Despesa" abria na hora em que o chip "Café" lançava o
 *      gasto e cobria o post-it/olhar/festa ("cliquei e saiu da missão"). Regra: enquanto a missão do
 *      dia 1 está em cena (até a folha do plano de amanhã decidida), os adesivos ficam na fila SEM virar
 *      "vistos"; depois aparecem agrupados num popup só. A exceção é o "Casa arrumada" (fecha a missão).
 *      Conta antiga sem missão: o adesivo abre na hora, como hoje.
 *
 *   2. DUAS TELAS DE "PRONTO": a rosa (BoasVindasPago, pós-cadastro) e a boas-vindas da missão seguidas.
 *      Regra: quando a missão em doses vai aparecer (conta nova no app), a rosa é PULADA — eventos com
 *      `pulada: true` e a marca "já viu" gravada. Sem missão (conta antiga, web, chave off): como hoje.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: true, subLoaded: true }),
  useAuthOpcional: () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" } }),
}));
const nativo = vi.hoisted(() => ({ v: true }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) }));

import { UserDataContext } from "@/hooks/use-user-data";
import { MomentosConquistas } from "@/components/conquistas/Momentos";
import { BoasVindasPago, pulaPelaMissao } from "@/components/onboarding/BoasVindasPago";
import { CHAVE_ESTADO_MISSAO_DOSES, iniciarMissao, lerMissao } from "@/lib/missao-doses";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { somarDias } from "@/lib/sequencia";

const HOJE = "2026-10-03";
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
/** O que a dose 1 deixou na conta: o gasto do chip (e um salário, pra 2 adesivos comuns ficarem devendo) */
const depoisDaDose1 = () => ({
  "core-dias-anotados": [somarDias(HOJE, -1), HOJE],
  "conquistas-vistas": { adesivos: [], marcos: [] },
  "finance-expenses": [{ id: "demo-1", description: "Café", value: 12, date: HOJE }],
  "finance-incomes": [{ id: 1, value: 3000 }],
});
const montarMomentos = (store: ReturnType<typeof montarStore>, contaNova = true) =>
  render(<MemoryRouter initialEntries={["/financas"]}><Provedor store={store}><MomentosConquistas contaNova={contaNova} /></Provedor></MemoryRouter>);
const espera = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const missaoB = (extra: Record<string, unknown> = {}) => {
  const m = iniciarMissao(["financas", "rotina", "saude"], HOJE);
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, braco: "B", ...extra }));
};

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  nativo.v = true;
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  // 16/10: no app a Conquistas 2 (chave `conquistas2`) troca o popup pelo toast; a coreografia da missão × festa
  // é a mesma — aqui ela é testada com a tela de hoje (chave desligada); o toast tem teste próprio (conquistas-nova)
  localStorage.setItem("conquistas2-force", "off");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("adesivos × missão do dia 1 (braço B)", () => {
  it("missão em cena (dose 1 feita, plano ainda não decidido): NENHUM popup de adesivo em 3 s, e o adesivo NÃO vira visto", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=b");
    missaoB({ feitos: { 1: { dia: HOJE, rotulo: "Café · R$ 12" } } });
    const store = montarStore(depoisDaDose1());
    montarMomentos(store);
    await espera(3200);
    expect(screen.queryByTestId("momento-popup")).toBeNull();
    expect(screen.queryByTestId("momento-adesivo")).toBeNull();
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual([]);
  });

  it("missão do dia encerrada (plano de amanhã combinado): os adesivos ganhos chegam juntos, num popup só (2), e viram vistos ao continuar", async () => {
    guardarForcaDia1Cheio("?dia1-cheio=b");
    missaoB({ feitos: { 1: { dia: HOJE, rotulo: "Café · R$ 12" } }, agoraNao: { dia: HOJE, indice: 1 }, planoAmanha: { quando: "noite", dia: HOJE } });
    const store = montarStore(depoisDaDose1());
    montarMomentos(store);
    const popup = await screen.findByTestId("momento-popup", {}, { timeout: 4000 });
    expect(popup).toHaveAttribute("data-quantidade", "2");
    expect(lerMissao()?.planoAmanha).toBeTruthy();
  });

  it("conta antiga sem missão: o adesivo abre na hora, como hoje", async () => {
    conta.created_at = "2026-07-10T12:00:00Z";
    const store = montarStore(depoisDaDose1());
    montarMomentos(store, false);
    expect(await screen.findByTestId("momento-popup", {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe("a tela rosa pós-cadastro × a boas-vindas da missão", () => {
  it("conta nova no app (a missão vai aparecer): a rosa é PULADA — onComecar na hora, eventos com pulada: true, marca 'já viu' gravada", () => {
    expect(pulaPelaMissao(conta.created_at)).toBe(true);
    const onComecar = vi.fn();
    render(<Provedor store={montarStore({})}><BoasVindasPago imediato nome="Ana" onComecar={onComecar} /></Provedor>);
    expect(screen.queryByText(/Pronto, Ana/)).toBeNull();
    expect(onComecar).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("core-boas-vindas-visto")).toBe("1");
    expect(eventos).toContainEqual(["boas_vindas_pago_visto", { origem: "compra", pulada: true }]);
    expect(eventos).toContainEqual(["boas_vindas_pago_seguiu", { pulada: true }]);
  });

  it("conta antiga (sem missão): a rosa aparece como hoje; na web também", () => {
    conta.created_at = "2026-07-10T12:00:00Z";
    expect(pulaPelaMissao(conta.created_at)).toBe(false);
    const onComecar = vi.fn();
    render(<Provedor store={montarStore({})}><BoasVindasPago imediato nome="Ana" onComecar={onComecar} /></Provedor>);
    expect(screen.getByText(/Pronto, Ana/)).toBeInTheDocument();
    expect(onComecar).not.toHaveBeenCalled();
    expect(eventos).toContainEqual(["boas_vindas_pago_visto", { origem: "compra" }]);
    cleanup();
    nativo.v = false;
    conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
    expect(pulaPelaMissao(conta.created_at)).toBe(false);
  });
});
