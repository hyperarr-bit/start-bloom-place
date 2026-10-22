/**
 * REVISOR 1.0.18 (22/10) — trazido do revisor de bugs. Com `dias23` ligada, o tutorial do módulo ESCOLHIDO no dia 2 é a
 * dose 2. Na 2ª aparição (fechou o app no meio e voltou) a intro grava "vista" (pulada) ao montar — e a missão achava
 * que a intro já tinha passado: montava faixa + post-it por cima e a intro saía 700 ms depois, sem gravar a dose 2.
 * Correto: enquanto a intro retomada estiver na tela a missão NÃO monta o passo guiado; o fim dela ("Pronto", "Agora
 * não" ou sair do módulo) grava a dose 2 (feita/pulada). Abaixo o cabeçalho original do v1018-dias23:
 *
 * 1.0.18 (22/10) — DIAS 2 E 3 DO TESTE (chave remota `dias23`, lib/dias23), sempre com CONTA VAZIA (sem seeds):
 *   · off (padrão): o teste de hoje, igual — "Amanhã: Rotina" no dia 1, "Dia 2: Rotina" no dia 2, nada de resumo ao
 *     abrir no dia 3, nenhum campo/evento novo;
 *   · on, dia 1: a folha "Dia 1 feito" promete o que fica pronto amanhã (com Finanças: "Quanto dá pra gastar amanhã");
 *   · on, dia 2: ao abrir, 1x, "Ficou pronto · Hoje dá pra gastar R$ X" + "Dia 2: escolhe o seu" (3 módulos pessoais);
 *     escolher abre o módulo e a INTRO dele é a dose 2 (nunca o passo guiado por cima; o fim da intro grava a dose);
 *   · on, dia 3: "Você construiu isso em 3 dias" ao ABRIR (sem a 3ª dose), 1x; o convite da dose 3 não vem por cima;
 *   · reabrir o app (e sair da conta) não repete nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString(), user_metadata: {} as Record<string, unknown> }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: vi.fn(async () => true) }));
vi.mock("@/hooks/use-auth", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-auth")>()),
  useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, user_metadata: conta.user_metadata }, isSubscribed: true }),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: vi.fn(async () => "concedeu"),
  agendarProximaDose: vi.fn(async () => ({ ok: true, quando: new Date() })),
  estadoPermissao: vi.fn(async () => "granted"),
  armarLembreteDoTesteSePuder: vi.fn(async () => {}),
}));
/* o resumo de verdade usa Home/Conquistas inteiras — aqui uma tela com o mesmo contrato (o bloco 6 testa a de verdade) */
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", async (orig) => {
  const real = await orig<typeof import("@/components/missao-doses/ConstruiuEm3Dias")>();
  return {
    ...real,
    ConstruiuEm3Dias: function ConstruiuFalso({ aoContinuar, aoAbrir, aoVer }: { aoContinuar: () => void; aoAbrir?: boolean; aoVer?: () => void }) {
      const { useEffect } = require("react") as typeof import("react");
      useEffect(() => { aoVer?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return <div data-testid="construiu" data-ao-abrir={aoAbrir ? "1" : "0"}><button type="button" data-testid="construiu-continuar" onClick={aoContinuar}>Continuar</button></div>;
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } } }));

import { UserDataContext } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { MissaoDosesNaWeb } from "@/components/missao-doses/MissaoDosesNaWeb";
import { PlanoDeAmanhaA } from "@/components/missao-doses/PlanoDeAmanhaA";
import { EVENTO_ABRIR_ESCOLHA_DIA2 } from "@/components/missao-doses/LinhaDoseDeHoje";
import { linhaDoFeitoNoResumo } from "@/components/missao-doses/ConstruiuEm3Dias";
import {
  CHAVE_ESTADO_MISSAO_DOSES, ROTULO_DOSE_PELA_INTRO, comEscolha2, construiuAoAbrirDevido, definirDonoDaMissao, escolhaDoDia2Devida, eventoDaMissao, iniciarMissao,
  introEhADoseDoDia2, lerMissao, missaoEmAndamento, moduloDaMissaoHoje, opcoesDoDia2,
} from "@/lib/missao-doses";
import { _zerarUmPorDiaRemoto, registrarUmPorDiaRemoto } from "@/lib/dia1-cheio";
import { CHAVE_DIAS23_APARELHO, CHAVE_FORCA_DIAS23, _zerarDias23Remoto, dias23Ligado, guardarForcaDias23, lerDias23Remoto, modoDias23, registrarDias23Remoto } from "@/lib/dias23";
import { _novaAberturaDoTour, marcarTourFeito } from "@/lib/tour-home";
import { avisarFimDaIntro, porQueNaoMostrar } from "@/lib/intro-modulo";
import { conteudoDaMissao } from "@/lib/lembrete-dia2";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

/* ------------------------------------------------------------ o aparelho de mentira (o mesmo do v1016-missao-1-por-dia) */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const set = (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); };
  return { dados, get, set, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [versao, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  const get = useCallback(<T,>(k: string, f: T): T => store.get(k, f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const valor = useMemo(() => ({ get, set: store.set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, store.set]);
  return <UserDataContext.Provider value={valor as never}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/beleza" element={<><Rota /><IntroDoModulo moduleId="beleza" /></>} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const offerings = (meta: Record<string, unknown>) => {
  const current = { identifier: "default", metadata: meta };
  return { current, all: { default: current } };
};
/** braço A pra todos (missao_1_por_dia on) + a chave nova */
const ligar = (dias23?: "on" | "off") => {
  const meta: Record<string, unknown> = { missao_1_por_dia: "on" };
  if (dias23) meta.dias23 = dias23;
  registrarUmPorDiaRemoto(offerings(meta));
  registrarDias23Remoto(offerings(meta));
};
const missaoA = (feitos: Record<number, { dia: string; rotulo: string }>, extra: Record<string, unknown> = {}) =>
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, lembrete: "8h", feitos, ...extra }));
const iphone = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
/** Finanças montada no dia 1: renda + 1 conta fixa (o "quanto dá pra gastar" existe) */
const comFinancas = () => montarStore({ "finance-incomes": [{ id: 1, value: 3000 }], "finance-fixed-expenses": [{ id: 2, name: "Aluguel", value: 1200 }] });
const DIA1 = { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } };

beforeEach(() => {
  localStorage.clear();
  definirDonoDaMissao(null);
  _novaAberturaDoTour();
  marcarTourFeito(); // o tour curto da Home já foi (o bloco 9 do v1016 cobre a ordem tour → plano)
  eventos.length = 0;
  _zerarUmPorDiaRemoto();
  _zerarDias23Remoto();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.user_metadata = {};
  iphone();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026 — dia 1 da missão
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ a 2ª aparição da intro escolhida no dia 2 */

import { marcarIntroAbertaNoAparelho } from "@/lib/intro-modulo";
import { useNavigate } from "react-router-dom";

const diaDoisComBeleza = () => {
  ligar("on");
  missaoA(DIA1);
  vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(comEscolha2(lerMissao()!, "beleza", "comecar", "2026-10-04")));
  marcarIntroAbertaNoAparelho("beleza"); // a 1ª aparição já foi (o app fechou no meio da intro)
};

describe("revisor 1.0.18: a 2ª aparição da intro do módulo escolhido no dia 2", () => {
  it("volta pra Beleza: a intro retomada fica na tela e a missão NÃO monta faixa/post-it por cima", () => {
    diaDoisComBeleza();
    const store = comFinancas();
    montar(store, "/beleza");
    avancar(3000);
    expect(screen.getByTestId("intro-modulo-faixa")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(document.documentElement.dataset.missaoDose).not.toBe("1");
    expect(lerMissao()!.feitos[2]).toBeUndefined();
    expect(lerMissao()!.pulados?.[2]).toBeUndefined();
  });

  it("'Agora não' na intro retomada grava a dose 2 pulada (e a missão não monta o passo guiado no mesmo dia)", () => {
    diaDoisComBeleza();
    const store = comFinancas();
    montar(store, "/beleza");
    avancar(2000);
    fireEvent.click(screen.getByTestId("intro-modulo-agora-nao"));
    avancar(3000);
    expect(lerMissao()!.pulados).toEqual({ 2: "2026-10-04" });
    expect(eventos).toContainEqual(["dia2_dose_pulada", expect.objectContaining({ modulo: "beleza" })]);
    expect(screen.queryByTestId("intro-modulo-faixa")).toBeNull();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    // reabrir o app na Beleza no mesmo dia: nem intro nem passo guiado
    cleanup();
    montar(store, "/beleza");
    avancar(3000);
    expect(screen.queryByTestId("intro-modulo-faixa")).toBeNull();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("saiu do módulo no meio da intro retomada (a última aparição): a dose 2 fica pulada, nada volta por cima ao entrar de novo", () => {
    diaDoisComBeleza();
    const store = comFinancas();
    let ir: (r: string) => void = () => {};
    const Navegador = () => { const n = useNavigate(); ir = n; return null; };
    render(
      <MemoryRouter initialEntries={["/beleza"]}>
        <Provedor store={store}>
          <Navegador />
          <MissaoDosesNaWeb />
          <Routes>
            <Route path="/beleza" element={<><Rota /><IntroDoModulo moduleId="beleza" /></>} />
            <Route path="*" element={<Rota />} />
          </Routes>
        </Provedor>
      </MemoryRouter>,
    );
    avancar(2000);
    expect(screen.getByTestId("intro-modulo-faixa")).toBeInTheDocument();
    act(() => { ir("/home"); });
    avancar(500);
    expect(lerMissao()!.pulados).toEqual({ 2: "2026-10-04" });
    act(() => { ir("/beleza"); });
    avancar(3000);
    expect(screen.queryByTestId("intro-modulo-faixa")).toBeNull();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("controle (dias23 off): a dose do dia 2 segue o passo guiado de sempre na Rotina", () => {
    ligar("off");
    const store = comFinancas();
    missaoA(DIA1);
    vi.setSystemTime(new Date(2026, 9, 4, 9, 0));
    montar(store, "/rotina");
    avancar(3000);
    expect(moduloDaMissaoHoje()).toBe("rotina");
  });
});
