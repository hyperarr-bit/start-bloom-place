/**
 * 1.0.16 (16/10) — A PARTE DO TESTE GRÁTIS: o que este arquivo trava, sempre com CONTA VAZIA (sem seeds).
 *
 *   1. A ÁREA do funil sobrevive ao "liberando" (retomada.limparProgresso não leva mais
 *      `core-funil-w-area`) e a missão nasce nela; a conta da Porta do site traz a área em
 *      `user_metadata.porta.respostas.area`. "Treino e dieta" (corpo) = Treino → Saúde → Finanças.
 *   2. O ANEL da dose não some quando o módulo redesenha e troca o nó (`anel_saiu motivo=ancora_invisivel`):
 *      ele re-acha a âncora; sumiu de verdade → espera a tolerância e só então sai.
 *   3. A chave remota `missao_1_por_dia` (metadata de offering do RevenueCat, só iPhone): ausente/"off" →
 *      o de hoje (build de loja = todos no B); "ab" → 50/50 A × B; "on" → todos no A. RevenueCat que nunca
 *      respondeu → o de hoje. A última resposta fica no aparelho (`core-missao-1-por-dia`).
 *   4. Braço A = UMA dose por dia: dia 1 dose 1 + "amanhã · te lembro às…" (sem adiantar); a dose de
 *      amanhã não abre hoje nem entrando no módulo; num dia novo, o convite "Dia N da missão" na Home
 *      (1x por dia, sobrevive a fechar/reabrir e ao logout); o Lembrete do dia 2 aponta pra dose.
 *   5. Os eventos levam `variante`, `braco` ("um_por_dia" | "dia1_cheio") e `missao_1_por_dia`.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";

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
}));
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => ({ data: null, error: null }) } } }));

import { UserDataContext, useUserData } from "@/hooks/use-user-data";
import { purgeLocalUserCache } from "@/hooks/use-auth";
import { MissaoDosesNaWeb, areaDaMissao } from "@/components/missao-doses/MissaoDosesNaWeb";
import { Anel, TOLERANCIA_ANCORA_MS } from "@/components/demo-guiada/pecas";
import {
  CHAVE_ESTADO_MISSAO_DOSES, EVENTO_MISSAO_DOSES, conviteDoDiaDevido, doseDeHojeDevida, doseLiberadaHoje, ehUmPorDia, eventoDaMissao, iniciarMissao, lerMissao, missaoEmAndamento, modulosPadrao, precisaPlanoA,
  missaoDoDiaEmCena, moduloDaMissaoHoje, definirDonoDaMissao, donoDaConta, marcarDoseNaTela, doseNaTela, CHAVE_MISSAO_NA_CONTA,
} from "@/lib/missao-doses";
import { _novaAberturaDoTour, marcarTourFeito, varianteDoTour } from "@/lib/tour-home";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { TourDaHome, useTourDaHome } from "@/components/home/TourDaHome";
import { escolherAdesivoDaDose } from "@/components/missao-doses/adesivo-da-dose";
import {
  CHAVE_BRACO_DIA1, CHAVE_UM_POR_DIA_APARELHO, _zerarUmPorDiaRemoto, bracoDia1, idDoAparelho, lerUmPorDiaRemoto, modoDia1Cheio, modoUmPorDia, registrarUmPorDiaRemoto, sortearBraco,
} from "@/lib/dia1-cheio";
import { CHAVES_FUNIL_W, guardarChave, lerChave, limparProgresso } from "@/pages/funis/w/retomada";
import { conteudoDoLembrete } from "@/lib/lembrete-dia2";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CHAVE_DIAS_ANOTADOS, contaComoAnotacao, registrarDia, temConteudo } from "@/lib/sequencia";
import { localDayKey } from "@/lib/utils";

/* ------------------------------------------------------------ o aparelho de mentira (o mesmo do dia1-cheio.test) */

/** O store da conta, como o UserDataProvider de verdade: o 1º registro de DADO do dia (chave que conta, com
 *  conteúdo) acrescenta hoje em `core-dias-anotados` — é a sequência do app (a régua dos adesivos de sequência). */
function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const get = <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  const set = (k: string, v: unknown, opts?: { system?: boolean }) => {
    dados[k] = v;
    if (!opts?.system && contaComoAnotacao(k) && temConteudo(v)) {
      const nova = registrarDia(dados[CHAVE_DIAS_ANOTADOS], localDayKey());
      if (nova) dados[CHAVE_DIAS_ANOTADOS] = nova;
    }
    ouvintes.forEach((o) => o());
  };
  const valor = () => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null });
  return { dados, valor, get, set, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
/* `get` só muda quando o store muda (como o provider de verdade) — as peças da Home e das Conquistas têm efeitos
 * e memos que dependem dele */
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [versao, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  const get = useCallback(<T,>(k: string, f: T): T => store.get(k, f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const valor = useMemo(() => ({ get, set: store.set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, store.set]);
  return <UserDataContext.Provider value={valor as never}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><p>home de sempre</p></div>;
/** Finanças que REMONTA o botão de adicionar quando `__versao` muda (a hidratação da conta redesenhando o módulo). */
const FinancasFalsa = () => {
  const { get } = useUserData();
  const versao = get<number>("__versao", 0);
  const semBotao = get<boolean>("__semBotao", false); // a linha do "+ Novo gasto" some DE VEZ (o módulo trocou de tela)
  return (
    <div><Rota /><header className="sticky">FINANÇAS</header>
      {!semBotao && <div key={`linha-${versao}`}><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div>}
      <section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
  );
};
const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
/** Rotina com o caminho REAL de criar hábito; a tabela REFAZ as linhas quando `__versao` muda. */
const RotinaFalsa = () => {
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const habitos = (get<string[]>("rotina-habits", []) ?? []);
  const grade = get<Record<string, boolean[]>>("rotina-habits-checked", {}) ?? {};
  const versao = get<number>("__versao", 0);
  const adicionar = () => { if (!nome.trim()) return; set("rotina-habits", [...habitos, nome.trim()]); setNome(""); setAberto(false); };
  const marcar = (dia: string, i: number) => { const linha = [...(grade[dia] ?? habitos.map(() => false))]; linha[i] = !linha[i]; set("rotina-habits-checked", { ...grade, [dia]: linha }); };
  return (
    <div>
      <Rota /><header className="sticky">ROTINA</header>
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={adicionar}>Adicionar</button></div>}
      <table><tbody>{DIAS_ROTINA.map((d) => (
        <tr key={`${d}-${versao}`}><td>{d}</td>{habitos.map((h, i) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} checked={!!grade[d]?.[i]} onChange={() => marcar(d, i)} /></td>)}</tr>
      ))}</tbody></table>
    </div>
  );
};
const SaudeFalsa = () => <div><Rota /><header className="sticky">SAÚDE</header><button type="button" data-spotlight="add-water">+</button></div>;
const TreinoFalsa = () => <div><Rota /><header className="sticky">TREINO</header><div><input placeholder="Exercício" /><button type="button" data-spotlight="add-exercise">+</button></div></div>;
const MetasFalsa = () => <div><Rota /><header className="sticky">METAS</header><button type="button" data-spotlight="add-goal">+ Meta</button></div>;
/** A Home com as peças REAIS que a missão toca: as Pendências (com a linha da dose) e o tour (a régua real). */
const HomeReal = () => {
  const life = useLifeHubData();
  const mostrarTour = useTourDaHome(conta.created_at, true);
  return (
    <div>
      <Rota />
      <div data-tour="score"><p data-testid="score">{life.dayScore}</p></div>
      <div data-tour="acoes-rapidas">ações</div>
      <button type="button" data-tour="adicionar-widget">Adicionar widget</button>
      <div data-tour="pendencias"><NextHoursTimeline data={life} /></div>
      <div data-tour="modulos">módulos</div>
      {mostrarTour && <TourDaHome lifeData={life} widgetsAtivos={[]} adicionarWidget={() => {}} variante={varianteDoTour() ?? "longo"} />}
    </div>
  );
};
const montar = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeFalsa />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="/rotina" element={<RotinaFalsa />} />
          <Route path="/saude" element={<SaudeFalsa />} />
          <Route path="/treino" element={<TreinoFalsa />} />
          <Route path="/desenvolvimento" element={<MetasFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
/** Como `montar`, mas a Home é a de verdade (Pendências + tour). */
const montarComHome = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeReal />} />
          <Route path="/financas" element={<FinancasFalsa />} />
          <Route path="/rotina" element={<RotinaFalsa />} />
          <Route path="/saude" element={<SaudeFalsa />} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
const terminarOlhar = () => {
  avancar(700); avancar(1000); avancar(1500);
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
const offerings = (meta: Record<string, unknown> | null, outra?: Record<string, unknown>) => {
  const current = { identifier: "default", metadata: meta ?? {} };
  return { current, all: { default: current, ...(outra ? { anual_69: { identifier: "anual_69", metadata: outra } } : {}) } };
};
const ligarUmPorDia = (modo: "on" | "ab" | "off") => registrarUmPorDiaRemoto(offerings({ missao_1_por_dia: modo }));
/** Uma missão do braço A nascida em 03/10 (o dia 1), com as boas-vindas vistas. */
const missaoA = (feitos: Record<number, { dia: string; rotulo: string }>, extra: Record<string, unknown> = {}) =>
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, feitos, ...extra }));
const iphone = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const hojeDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  localStorage.clear();
  definirDonoDaMissao(null);
  _novaAberturaDoTour();
  // 1.0.16: a dose de Finanças virou o "Vamos montar suas Finanças" — aqui, o caminho de quem PULOU (o 1º gasto pelo chip)
  localStorage.setItem("core-montar-financas", JSON.stringify({ r: "pulou" }));
  eventos.length = 0;
  _zerarUmPorDiaRemoto();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.user_metadata = {};
  iphone();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) } as DOMRect);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10 — dia 1 da missão
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); delete (window as { Capacitor?: unknown }).Capacitor; });

/* ------------------------------------------------------------ 1 + 4: a área */

describe("1. a área escolhida no funil chega na missão", () => {
  it("o 'liberando' (limparProgresso) leva o progresso do funil mas DEIXA a área; a missão nasce em Rotina e o evento diz area=rotina", () => {
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    guardarChave(CHAVES_FUNIL_W.passo, "signup");
    guardarChave(CHAVES_FUNIL_W.respostas, { compromisso: "Sim, topo" });
    limparProgresso(); // a conta nasceu
    expect(lerChave(CHAVES_FUNIL_W.passo)).toBeNull();
    expect(lerChave(CHAVES_FUNIL_W.respostas)).toBeNull();
    expect(lerChave<string>(CHAVES_FUNIL_W.area)).toBe("rotina");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.modulos).toEqual(["rotina", "financas", "saude"]);
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area: "rotina", origem_area: "funil", modulos: ["rotina", "financas", "saude"] })]);
  });

  it("a área é chave do APARELHO: a vassoura da abertura/logout não leva", () => {
    expect(vassouraLeva(CHAVES_FUNIL_W.area)).toBe(false);
  });

  it("conta da Porta (site): sem área no aparelho, vale user_metadata.porta.respostas.area", () => {
    conta.user_metadata = { porta: { respostas: { area: "corpo" } } };
    expect(areaDaMissao(conta.user_metadata)).toBe("corpo");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.modulos).toEqual(["treino", "saude", "financas"]);
    expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area: "corpo", origem_area: "porta" })]);
  });

  it("a 1ª dose é SEMPRE a área escolhida; corpo puxa a Saúde (1 copo d'água) pra 2ª", () => {
    expect(modulosPadrao("dinheiro")[0]).toBe("financas");
    expect(modulosPadrao("rotina")[0]).toBe("rotina");
    expect(modulosPadrao("corpo")).toEqual(["treino", "saude", "financas"]);
    expect(modulosPadrao("saude")[0]).toBe("saude");
    expect(modulosPadrao("metas")[0]).toBe("desenvolvimento");
    expect(modulosPadrao(null)).toEqual(["financas", "rotina", "saude"]);
    expect(areaDaMissao({ porta: { respostas: { area: "lixo" } } })).toBeNull();
  });
});

/* ------------------------------------------------------------ 2: o anel */

describe("2. o anel da dose não some quando o módulo redesenha", () => {
  it("Finanças REMONTA o botão de adicionar (hidratação) com o anel aceso: o anel re-acha, segue aceso, nenhum anel_saiu", () => {
    const store = montarStore({});
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true }));
    montar(store, "/financas");
    esperarPostIt();
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    const antes = document.querySelector('[data-spotlight="add-expense"]');
    act(() => { store.valor().set("__versao", 1); });
    expect(document.querySelector('[data-spotlight="add-expense"]')).not.toBe(antes); // o nó trocou mesmo
    expect(antes!.isConnected).toBe(false);
    avancar(300); avancar(300); avancar(TOLERANCIA_ANCORA_MS + 500);
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.queryByTestId("missao-doses-onde")).toBeNull();
  });

  it("Rotina de conta vazia: criou o hábito → anel no quadradinho de HOJE; a tabela REFAZ as linhas → o anel segue (antes: ancora_invisivel)", () => {
    const store = montarStore({});
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03"), boasVindas: true }));
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).toHaveTextContent("2 de 2 · marcar");
    eventos.length = 0;
    act(() => { store.valor().set("__versao", 1); }); // a tabela se refaz (nós novos)
    avancar(300); avancar(TOLERANCIA_ANCORA_MS + 500);
    expect(screen.getAllByTestId("missao-doses-anel").length).toBeGreaterThan(0);
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.queryByTestId("missao-doses-onde")).toBeNull();
    // e o toque no quadradinho de hoje fecha a dose
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    expect(terminarOlhar()).toHaveTextContent("Primeiro registro feito!");
  });

  it("o Anel sozinho: âncora trocada → segue no nó novo; âncora sumida de vez → sai com ancora_invisivel só depois da tolerância; sem `reachar`, sai na hora (o de sempre)", () => {
    const caixa = document.createElement("div");
    document.body.appendChild(caixa);
    const botao = () => { const b = document.createElement("button"); b.setAttribute("data-alvo", "1"); caixa.appendChild(b); return b; };
    const b1 = botao();
    const saidas: string[] = [];
    const reachar = () => document.querySelector('[data-alvo="1"]');
    render(<Anel alvo={b1} fixo interativo duracao={null} reachar={reachar} aoSair={(m) => saidas.push(m)} testid="anel-x" balao={<p>post-it</p>} />);
    avancar(900);
    expect(screen.getByTestId("anel-x")).toBeInTheDocument();
    b1.remove(); botao(); // o módulo remontou o botão
    avancar(1000);
    expect(saidas).toEqual([]);
    caixa.innerHTML = ""; // sumiu de verdade
    avancar(TOLERANCIA_ANCORA_MS - 500);
    expect(saidas).toEqual([]);
    expect(screen.getByText("post-it")).toBeInTheDocument(); // o post-it não pisca enquanto espera
    avancar(1000);
    expect(saidas).toEqual(["ancora_invisivel"]);
    cleanup();
    const b3 = botao();
    const saidas2: string[] = [];
    render(<Anel alvo={b3} fixo interativo duracao={null} aoSair={(m) => saidas2.push(m)} balao={<p>p</p>} />);
    avancar(900);
    b3.remove();
    avancar(300);
    expect(saidas2).toEqual(["ancora_invisivel"]);
    caixa.remove();
  });
});

/* ------------------------------------------------------------ 3: a chave remota */

describe("3. a metadata `missao_1_por_dia` do RevenueCat", () => {
  it("leitura pura: ausente = off; qualquer offering vale; a `current` vence; valor estranho é ignorado", () => {
    expect(lerUmPorDiaRemoto(offerings(null))).toBe("off");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "AB" }))).toBe("ab");
    expect(lerUmPorDiaRemoto(offerings(null, { missao_1_por_dia: "on" }))).toBe("on");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "off" }, { missao_1_por_dia: "on" }))).toBe("off");
    expect(lerUmPorDiaRemoto(offerings({ missao_1_por_dia: "talvez" }))).toBe("off");
    expect(lerUmPorDiaRemoto(null)).toBe("off");
  });

  it("RevenueCat NUNCA respondeu + build de loja (VITE_V14_LOJA=1) → o de hoje: todos no B, sem sorteio", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    expect(modoUmPorDia()).toBe("off");
    expect(modoDia1Cheio()).toBe("on");
    expect(bracoDia1()).toBe("B");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
  });

  it("respondeu sem a chave (ou 'off') → o de hoje; e grava a resposta no aparelho", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    registrarUmPorDiaRemoto(offerings(null));
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("off");
    expect(bracoDia1()).toBe("B");
    registrarUmPorDiaRemoto(undefined); // falha de rede: não apaga a resposta anterior
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("off");
  });

  it("'ab' → sorteio 50/50 pelo id do aparelho (gravado em core-dia1-braco); 'on' → todos no A", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    expect(modoDia1Cheio()).toBe("ab");
    const b = bracoDia1();
    expect(b).toBe(sortearBraco(idDoAparelho()));
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBe(b);
    localStorage.clear(); _zerarUmPorDiaRemoto();
    ligarUmPorDia("on");
    expect(bracoDia1()).toBe("A");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBeNull();
  });

  it("a última resposta vale na abertura seguinte antes do getOfferings (a missão nasce às vezes antes dele)", () => {
    ligarUmPorDia("on");
    _zerarUmPorDiaRemoto(); // reabriu o app: memória vazia
    expect(modoUmPorDia()).toBe("on");
    expect(bracoDia1()).toBe("A");
  });

  it("só iPhone: no Android (e na web) a metadata não liga nada", () => {
    ligarUmPorDia("on");
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    expect(modoUmPorDia()).toBe("off");
    delete (window as { Capacitor?: unknown }).Capacitor;
    expect(modoUmPorDia()).toBe("off");
  });

  it("o braço é da MISSÃO: a metadata desligar no meio não muda quem já começou no A", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.braco).toBe("A");
    ligarUmPorDia("off");
    expect(ehUmPorDia(lerMissao())).toBe(true);
  });
});

/* ------------------------------------------------------------ 4: o braço A, dia a dia */

describe("4. braço A — uma dose por dia, conta VAZIA, do dia 1 ao dia 3", () => {
  it("dia 1 (conta VAZIA, área dinheiro): boas-vindas de 1 tela → Montar Finanças (a dose) → o 1º gasto de carona (opcional) → festa PEQUENA com o adesivo REAL ('Primeira Despesa') e o de amanhã trancado → Home → (tour curto) → 'Plano de amanhã' → a Rotina não abre a dose 2 hoje", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas"); // a dose de Finanças de verdade
    guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
    const store = montarStore({});
    montar(store, "/home");
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    expect(boas).toHaveTextContent("Tá dentro! 🎉");
    expect(boas).toHaveTextContent("Seus 3 dias grátis começaram. Os 16 módulos já estão abertos.");
    expect(boas).toHaveTextContent("Seu plano de 3 dias");
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent("Hoje · 💰 Finanças · monte em 30 s");
    expect(screen.getByTestId("missao-doses-linha-2")).toHaveTextContent("Amanhã · 📅 Rotina · 1 hábito, 20 s");
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent("Dia 3 · ❤️ Saúde · 1 copo d'água, 10 s");
    expect(screen.getByTestId("missao-doses-boas-vindas-nota")).toHaveTextContent("A gente começa pelas Finanças, que foi o que você escolheu.");
    expect(screen.getByTestId("missao-doses-comecar")).toHaveTextContent("Começar (30 s)");
    expect(screen.getByTestId("missao-doses-trocar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    // contrato: enquanto a dose está na tela, <html data-missao-dose="1"> e o módulo de hoje é Finanças
    expect(document.documentElement.getAttribute("data-missao-dose")).toBe("1");
    expect(moduloDaMissaoHoje()).toBe("financas");
    // a dose = "Vamos montar suas Finanças" (renda → contas → o número dela)
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: /Aluguel/ }));
    fireEvent.click(mf().getByRole("button", { name: "Ver quanto posso gastar" }));
    avancar(2500);
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull(); // nada da missão por cima do Montar
    fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    expect(Array.isArray(store.dados["finance-incomes"])).toBe(true);
    // a dose JÁ conta no "Pronto" do Montar (fechar o app no gasto de carona não desfaz o Montar)
    expect(lerMissao()?.feitos[1]?.rotulo).toMatch(/^Pode gastar R\$ [\d.]+ por dia$/);
    // o 1º gasto de carona: post-it com os 3 prontos + "Agora não" (o anel só procura o "+ Novo gasto" com o Montar fora da tela)
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("E o gasto de hoje? Toca num:");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    expect(within(postIt).getByTestId("missao-doses-gasto-agora-nao")).toBeInTheDocument();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]); // ☕ Café
    avancar(700);
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveAttribute("data-braco", "A");
    expect(festa).not.toHaveAttribute("data-tela-cheia");
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(/💰 Você pode gastar R\$ [\d.]+ por dia — e isso já está nas suas Finanças\./);
    expect(screen.getByTestId("missao-doses-gasto-extra")).toHaveTextContent("E o gasto de hoje (Café, R$ 12) já entrou no seu mês.");
    // o adesivo é o REAL que o 1º registro abriu — nenhum id inventado, nenhum prêmio à parte — e fica VISTO
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "first-expense");
    expect(screen.getByTestId("missao-doses-adesivo-legenda")).toHaveTextContent("Adesivo novo: Primeira Despesa");
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual(expect.arrayContaining(["first-expense", "first-income"]));
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: 📅 Rotina · 20 s");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("E o adesivo do dia 2 fica te esperando 🔒");
    expect(screen.getByTestId("missao-doses-adesivo-amanha")).toHaveAttribute("data-adesivo", "sequencia-2");
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "montar_financas", acao: "feito", variante: "A", dia_cal: 1 })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip" })]);
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "first-expense", tipo: "registro", dia: 1 })]);
    expect(eventos.filter(([n, d]) => n === "adesivo_desbloqueado" && String(d.origem ?? "").startsWith("missao"))).toEqual([]);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(eventos).toContainEqual(["montar_financas_view", expect.objectContaining({ origem: "missao" })]);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(document.documentElement.hasAttribute("data-missao-dose")).toBe(false);
    const m = lerMissao()!;
    expect(m.adesivosMostrados).toEqual(["first-expense"]);
    expect(doseLiberadaHoje(m)).toBe(false);
    expect(moduloDaMissaoHoje()).toBe("financas"); // a dose de hoje foi Finanças
    expect(missaoEmAndamento(m)).toBe(false); // a Home é dela: o tour curto pode entrar
    expect(missaoDoDiaEmCena(m)).toBe(true); // os popups de adesivo esperam o plano de amanhã
    expect(varianteDoTour(m)).toBe("curto");
    expect(precisaPlanoA(m)).toBe(true);
    // o tour curto ainda não aconteceu: a folha do plano ESPERA ele
    avancar(3000);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    marcarTourFeito(); // ... o tour curto acabou
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); });
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a-titulo")).toHaveTextContent("Amanhã a gente monta sua Rotina em 20 s. Que horas te lembro?");
    expect(screen.getByTestId("plano-a-hora-12h")).toHaveAttribute("aria-checked", "true"); // 15:10 → o mais perto é 12h
    fireEvent.click(screen.getByTestId("plano-a-hora-20h"));
    fireEvent.click(screen.getByTestId("plano-a-combinado"));
    expect(lerMissao()?.lembrete).toBe("20h");
    expect(missaoDoDiaEmCena(lerMissao())).toBe(false);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    // fechar → reabrir no mesmo dia: nada volta (boas-vindas, Montar, festa, plano)
    cleanup();
    montar(store, "/home");
    avancar(4000);
    for (const t of ["missao-doses-boas-vindas", "plano-amanha-a", "missao-doses-convite", "missao-doses-festa", "montar-financas"]) expect(screen.queryByTestId(t), t).toBeNull();
    cleanup();
    montar(store, "/financas");
    avancar(4000);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    // ela entra sozinha na Rotina no MESMO dia: uso livre, nada de dose 2
    cleanup();
    montar(store, "/rotina");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull();
  });

  it("depois do Montar o gasto é opcional: 'Agora não' vai direto pra festa (a dose NÃO conta como pulada); fechar o app no post-it do gasto não desfaz a dose", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const fazerMontar = () => {
      const mf = () => within(screen.getByTestId("montar-financas"));
      fireEvent.click(mf().getByRole("button", { name: "Até R$ 2 mil" }));
      fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
      fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
      avancar(2500);
      fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    };
    // 1) "Agora não"
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    fireEvent.click(within(esperarPostIt()).getByTestId("missao-doses-gasto-agora-nao"));
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "agora_nao" })]);
    cleanup();
    // 2) fecha o app com o post-it do gasto na tela
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store2 = montarStore({});
    montar(store2, "/financas");
    fazerMontar();
    esperarPostIt();
    cleanup();
    expect(lerMissao()?.feitos[1]?.rotulo).toMatch(/^Pode gastar R\$ [\d.]+ por dia$/);
    expect(document.documentElement.hasAttribute("data-missao-dose")).toBe(false);
    montar(store2, "/financas");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull(); // a dose de hoje já foi
    expect(screen.queryByTestId("montar-financas")).toBeNull();
  });

  it("23:59 → 00:01: a dose 2 não abre no dia 1 e abre no dia 2 (relógio falso)", () => {
    ligarUmPorDia("on");
    const store = montarStore({});
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59));
    montar(store, "/rotina");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 4, 0, 1));
    montar(store, "/rotina");
    esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3");
  });

  it("pulou o dia 2: no dia 3 vem 'Dia 2 de 3' (a ordem, não o calendário); a missão para no 7º dia", () => {
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } });
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    montar(montarStore({}), "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2 de 3 · 📅 Rotina · 20 s");
    cleanup();
    const m = lerMissao()!;
    expect(conviteDoDiaDevido(m, "2026-10-09")).toBe(true); // dia 7
    expect(conviteDoDiaDevido(m, "2026-10-10")).toBe(false); // dia 8: acabou
    expect(doseDeHojeDevida(m, "2026-10-10")).toBe(false);
  });

  it("dia 2: convite 1x ('Dia 2 de 3 · Rotina · 20 s' + o de ontem) → 'Bora' → 3 hábitos prontos → festa PEQUENA com o adesivo da sequência de 2 dias (reserva do fogo enquanto o registro não tem 'sequencia-2') + 'Sequência: 2 dias 🔥' + o dos 3 dias trancado + a hora; dica do score; dia 3: convite 'Faltam 10 s' → 'Agora não' não volta (reabrir, logout) → Saúde (meta + copo) → a ÚNICA festa em tela cheia, '3 dias seguidos' → 'O que você construiu'", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    // dia 1 (03/10) teve registro: a sequência do app tem 1 dia
    const store = montarStore({ [CHAVE_DIAS_ANOTADOS]: ["2026-10-03"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { lembrete: "12h" });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/home");
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // espera a Home assentar
    avancar(1500);
    const convite = screen.getByTestId("missao-doses-convite");
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2 de 3 · 📅 Rotina · 20 s");
    expect(convite).toHaveTextContent("Ontem você montou suas Finanças: R$ 61 por dia.");
    expect(convite).not.toHaveTextContent("Faltam"); // os 3 seguidos é só no dia 3
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "visto", dia: 2, modulo: "rotina", braco: "um_por_dia", dia_cal: 2 })]);
    fireEvent.click(screen.getByTestId("missao-doses-convite-ir"));
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "foi" });
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "bora", dia: 2 })]);
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    const postIt = esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    avancar(700); // braço A: sem o "olhar explicado" — direto pra comemoração
    expect(screen.queryByTestId("missao-doses-olhar")).toBeNull();
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).not.toHaveAttribute("data-tela-cheia");
    expect(festa).toHaveTextContent("Dia 2 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("📅 “Beber água ao acordar” já está na sua Rotina, com o quadradinho de hoje marcado.");
    expect(screen.getByTestId("missao-doses-sequencia")).toHaveTextContent("Sequência: 2 dias 🔥");
    // o adesivo da sequência: o id do registro ("sequencia-2", do ramo das Conquistas); aqui ainda não existe → a reserva do fogo
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "sequencia-2");
    expect(within(screen.getByTestId("missao-doses-adesivo")).getByTestId("missao-doses-adesivo-arte")).toHaveAttribute("data-arte", "fogo");
    expect(screen.getByTestId("missao-doses-adesivo-legenda")).toHaveTextContent("Adesivo novo: 2 dias seguidos");
    expect(store.dados["conquistas-vistas"]).toMatchObject({ adesivos: expect.arrayContaining(["sequencia-2"]), marcos: [2] });
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: ❤️ Saúde · 10 s");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("E o adesivo dos 3 dias seguidos é seu 🔒");
    expect(screen.getByTestId("missao-doses-hora-12h")).toHaveAttribute("aria-checked", "true"); // a combinada; dá pra trocar
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "sequencia-2", tipo: "reserva", dia: 2, sequencia: 2 })]);
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(lerMissao()?.scoreAntes?.[2]).toEqual(expect.any(Number)); // o score de ANTES da dose (a dica conta "de X pra Y")
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-dia", "2"); // 1 balão no score
    expect(screen.getByTestId("missao-dica-titulo")).toHaveTextContent(/score/);
    fireEvent.click(screen.getByTestId("missao-dica-entendi"));
    expect(lerMissao()?.dicas?.[2]).toBe("2026-10-04");
    cleanup();
    // a Saúde não abre hoje
    montar(store, "/saude");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    cleanup();

    // dia 3: a sequência está viva em 2 dias e hoje ainda não tem registro → "Faltam 10 s pros seus 3 dias seguidos"
    vi.setSystemTime(new Date(2026, 9, 5, 19, 0));
    eventos.length = 0;
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 3 de 3 · ❤️ Saúde · 10 s");
    expect(screen.getByTestId("missao-doses-convite-texto")).toHaveTextContent("Faltam 10 s pros seus 3 dias seguidos. Ontem você começou o hábito “Beber água ao acordar”.");
    fireEvent.click(screen.getByTestId("missao-doses-convite-depois"));
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "depois", dia: 3 })]);
    cleanup();
    montar(store, "/home"); avancar(3000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // fechar → reabrir
    cleanup();
    purgeLocalUserCache(); // sair da conta e entrar de novo
    montar(store, "/home"); avancar(3000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    cleanup();
    // a dose de hoje continua no módulo dela (e na linha das Pendências — bloco 6)
    montar(store, "/saude");
    const postIt3 = esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 3 de 3");
    const chips3 = within(postIt3).getAllByTestId("demo-guia-chip");
    expect(chips3.map((c) => c.textContent)).toEqual(["💧Meta de 6 copos", "💧Meta de 8 copos", "💧Meta de 10 copos"]);
    fireEvent.click(chips3[1]);
    expect(store.dados["core-saude-water-goal"]).toBe(8);
    avancar(700);
    const festa3 = screen.getByTestId("missao-doses-festa");
    expect(festa3).toHaveAttribute("data-tela-cheia");
    expect(festa3).toHaveTextContent("3 dias seguidos!");
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "sequencia-3");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("1 copo d'água marcado. Sua meta agora é de 8 copos por dia.");
    expect(festa3).not.toHaveTextContent(/R\$ ?97|assin|plano anual|oferta|pre[cç]o/i);
    expect(store.dados["conquistas-vistas"]).toMatchObject({ marcos: [2, 3] });
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "sequencia-3", tela_cheia: true, dia: 3 })]);
    fireEvent.click(screen.getByTestId("missao-doses-ver-fim"));
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
  });

  it("pulou um dia: a dose 2 no dia 3 NÃO é '2 dias seguidos' — 'Voltou! A sequência recomeça hoje.' (sem adesivo de sequência, sem drama)", () => {
    ligarUmPorDia("on");
    const store = montarStore({ [CHAVE_DIAS_ANOTADOS]: ["2026-10-03"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { convites: { "2026-10-05": "depois" } });
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[1]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    fireEvent.click(screen.getByLabelText(`Alongar 5 min ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
    avancar(700);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 2 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-adesivo-legenda")).toHaveTextContent("Voltou! A sequência recomeça hoje.");
    expect(screen.queryByTestId("missao-doses-adesivo")).toBeNull();
    expect(screen.queryByTestId("missao-doses-sequencia")).toBeNull();
    // nada de sequência marcado como visto (a linha de base dos adesivos nasce, como os Momentos fariam)
    expect((store.dados["conquistas-vistas"] as { adesivos: string[]; marcos: number[] })).toMatchObject({ marcos: [] });
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).not.toContain("sequencia-2");
  });

  it("o convite espera outra folha/festa sair da tela (nunca duas folhas juntas)", () => {
    ligarUmPorDia("on");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({
      ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true,
      feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } },
    }));
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    const outra = document.createElement("div");
    outra.setAttribute("role", "alertdialog");
    document.body.appendChild(outra);
    montar(montarStore({}), "/home");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    outra.remove();
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite")).toBeInTheDocument();
  });

  it("quem escolheu 'Explorar por conta própria' não recebe convite; o braço B (o de hoje) nunca recebe", () => {
    ligarUmPorDia("on");
    const base = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "x" } } };
    expect(conviteDoDiaDevido(base, "2026-10-04")).toBe(true);
    expect(missaoEmAndamento(base, "2026-10-04")).toBe(true); // o tour espera o convite
    expect(conviteDoDiaDevido({ ...base, explorou: true }, "2026-10-04")).toBe(false);
    expect(conviteDoDiaDevido({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(false);
    expect(missaoEmAndamento({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(false);
    expect(conviteDoDiaDevido({ ...base, braco: "B" }, "2026-10-04")).toBe(false);
    expect(doseLiberadaHoje({ ...base, braco: "B" }, "2026-10-03")).toBe(true); // B: as 3 no dia 1, como hoje
  });

  it("braço B com a metadata 'ab': a festa continua 'Bora a próxima?' (o de hoje) e os eventos dizem braco=dia1_cheio", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    montar(montarStore({}), "/home");
    expect(lerMissao()?.braco).toBe("B");
    expect(eventoDaMissao({})).toEqual(expect.objectContaining({ variante: "B", braco: "dia1_cheio", missao_1_por_dia: "ab" }));
  });
});

/* ------------------------------------------------------------ 5: telas de uma vez só */

describe("5. as chaves novas sobrevivem às vassouras", () => {
  it("core-missao-1-por-dia, core-dia1-braco e a missão (com os convites) ficam depois do logout", () => {
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "A");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], hojeDe(new Date()), undefined, "A"), convites: { "2026-10-04": "depois" } }));
    purgeLocalUserCache();
    expect(localStorage.getItem(CHAVE_UM_POR_DIA_APARELHO)).toBe("ab");
    expect(localStorage.getItem(CHAVE_BRACO_DIA1)).toBe("A");
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "depois" });
    for (const k of [CHAVE_UM_POR_DIA_APARELHO, CHAVE_BRACO_DIA1, CHAVE_ESTADO_MISSAO_DOSES, CHAVES_FUNIL_W.area]) expect(vassouraLeva(k), k).toBe(false);
  });
});

/* ------------------------------------------------------------ 6: a linha nas Pendências */

describe("6. 'Dose de hoje' nas Pendências — a ÚNICA presença da missão na Home (nenhum card novo)", () => {
  it("dia 2 com a dose por fazer: a linha aparece com a lista FECHADA ('Dose de hoje · Rotina · 20 s · Dia 2 de 3'); toque → Rotina; feita → some; Explorar e braço B: nunca", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { convites: { "2026-10-04": "depois" }, lembrete: "12h", planoAPulado: undefined });
    marcarTourFeito();
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    const store = montarStore({});
    montarComHome(store, "/home");
    avancar(1500);
    const linha = screen.getByTestId("pendencia-dose-de-hoje");
    expect(linha).toHaveTextContent("Dose de hoje · Rotina · 20 s");
    expect(linha).toHaveTextContent("Dia 2 de 3");
    expect(screen.queryAllByTestId("pendencia")).toHaveLength(0); // a lista continua fechada
    fireEvent.click(within(linha).getByRole("button"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(eventos).toContainEqual(["home_pendencia", { tipo: "dose_de_hoje", destino: "/rotina" }]);
    cleanup();
    // feita hoje → some
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" }, 2: { dia: "2026-10-04", rotulo: "y" } }, { convites: { "2026-10-04": "foi" } });
    montarComHome(store, "/home"); avancar(1500);
    expect(screen.queryByTestId("pendencia-dose-de-hoje")).toBeNull();
    cleanup();
    // Explorar por conta própria → nunca
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" } }, { explorou: true });
    montarComHome(store, "/home"); avancar(1500);
    expect(screen.queryByTestId("pendencia-dose-de-hoje")).toBeNull();
    cleanup();
    // braço B (o de hoje) → nunca
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "B"), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "x" } } }));
    montarComHome(store, "/home"); avancar(1500);
    expect(screen.queryByTestId("pendencia-dose-de-hoje")).toBeNull();
  });
});

/* ------------------------------------------------------------ 7: contrato + a missão é da CONTA */

describe("7. contrato com Conquistas e cartões; a missão é da CONTA (não do aparelho)", () => {
  it("moduloDaMissaoHoje(): null sem missão, com as boas-vindas na tela e pra quem foi explorar; a dose devida hoje; a feita hoje; amanhã, a próxima", () => {
    ligarUmPorDia("on");
    expect(moduloDaMissaoHoje()).toBeNull();
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, "A")));
    expect(moduloDaMissaoHoje()).toBeNull(); // boas-vindas ainda na tela
    missaoA({});
    expect(moduloDaMissaoHoje()).toBe("financas");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" } });
    expect(moduloDaMissaoHoje()).toBe("financas"); // a de hoje já foi — continua sendo Finanças hoje
    expect(moduloDaMissaoHoje("2026-10-04")).toBe("rotina");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" } }, { explorou: true });
    expect(moduloDaMissaoHoje("2026-10-04")).toBeNull();
  });

  it("<html data-missao-dose>: conta as peças — duas juntas não apagam o atributo uma da outra; soltar duas vezes não estraga a conta", () => {
    const a = marcarDoseNaTela();
    const b = marcarDoseNaTela();
    expect(doseNaTela()).toBe(true);
    a(); a();
    expect(doseNaTela()).toBe(true);
    b();
    expect(doseNaTela()).toBe(false);
    expect(document.documentElement.hasAttribute("data-missao-dose")).toBe(false);
  });

  it("outra conta no mesmo aparelho: a missão dela não vaza pra ninguém que lê (Home, tour, Conquistas, lembretes) e esta conta ganha a sua", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-02", undefined, "A"), boasVindas: true, feitos: { 1: { dia: "2026-10-02", rotulo: "Arrumar a cama" } }, dono: donoDaConta("u2") }));
    definirDonoDaMissao("u1");
    expect(lerMissao()).toBeNull();
    expect(moduloDaMissaoHoje()).toBeNull();
    const store = montarStore({});
    montar(store, "/home");
    expect(screen.getByTestId("missao-doses-boas-vindas")).toBeInTheDocument(); // a dela, nova (conta < 48 h)
    expect(lerMissao()?.dono).toBe(donoDaConta("u1"));
    expect(lerMissao()?.feitos).toEqual({});
  });

  it("reinstalou (aparelho limpo) e a cópia está na conta: a missão volta como estava — sem boas-vindas, sem convite repetido, sem dose refeita", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const copia = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, lembrete: "12h", feitos: { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, convites: { "2026-10-04": "depois" }, dono: donoDaConta("u1") };
    localStorage.clear(); // reinstalou
    const store = montarStore({ [CHAVE_MISSAO_NA_CONTA]: copia });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/home");
    avancar(2500);
    expect(screen.queryByTestId("missao-doses-boas-vindas")).toBeNull();
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    expect(lerMissao()).toMatchObject({ feitos: { 1: { dia: "2026-10-03" } }, convites: { "2026-10-04": "depois" } });
    expect(eventos).toContainEqual(["missao_restaurada", expect.objectContaining({ doses: 1, boas_vindas: true })]);
  });

  it("a cópia na conta acompanha a missão como escrita de SISTEMA (mexer na missão não conta dia na sequência)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const store = montarStore({});
    montar(store, "/home");
    expect(store.dados[CHAVE_MISSAO_NA_CONTA]).toMatchObject({ v: 1, braco: "A", dono: donoDaConta("u1") });
    fireEvent.click(screen.getByTestId("missao-doses-explorar"));
    expect(store.dados[CHAVE_MISSAO_NA_CONTA]).toMatchObject({ explorou: true });
    expect(store.dados[CHAVE_DIAS_ANOTADOS]).toBeUndefined();
  });
});

/* ------------------------------------------------------------ 8: o adesivo da dose (pura) */

describe("8. o adesivo da dose é o REAL do registro (contrato com as Conquistas: nenhum id novo, nenhum prêmio à parte)", () => {
  const b = (id: string, name: string, unlocked = true) => ({ id, name, unlocked, xp: 50, raridade: "comum" as const });
  it("dia 2 com o registro do ramo das Conquistas ('sequencia-2' = 'Voltei'): mostra ele, marca visto (adesivo + marco 2)", () => {
    const e = escolherAdesivoDaDose({ n: 2, modulo: "rotina", adesivos: [b("sequencia-2", "Voltei"), b("rotina-1", "Primeiro Dia")], vistos: [], sequencia: 2 });
    expect(e.principal).toMatchObject({ tipo: "registro", id: "sequencia-2", nome: "Voltei", sequencia: 2 });
    expect(e.extras).toEqual([{ id: "rotina-1", nome: "Primeiro Dia" }]); // entra na MESMA comemoração
    expect(e.vistos).toEqual(["sequencia-2", "rotina-1"]);
    expect(e.marcos).toEqual([2]);
    expect(e.telaCheia).toBe(false);
  });
  it("o registro tem o marco mas ele já foi comemorado (as Conquistas mostraram antes): nada de repetir", () => {
    const e = escolherAdesivoDaDose({ n: 2, modulo: "rotina", adesivos: [b("sequencia-2", "Voltei")], vistos: ["sequencia-2"], sequencia: 2 });
    expect(e.principal).toBeNull();
    expect(e.vistos).toEqual([]);
  });
  it("dia 3 sem o id no registro (este ramo): a reserva do fogo com '3 dias seguidos', a ÚNICA tela cheia, e o marco maior cobre o menor", () => {
    const e = escolherAdesivoDaDose({ n: 3, modulo: "saude", adesivos: [], vistos: [], sequencia: 3 });
    expect(e.principal).toMatchObject({ tipo: "reserva", id: "sequencia-3", nome: "3 dias seguidos", sequencia: 3 });
    expect(e.telaCheia).toBe(true);
    expect(e.marcos).toEqual([2, 3]);
    expect(e.vistos).toEqual(["sequencia-3", "sequencia-2"]);
    // a missão já mostrou a reserva: não mostra de novo
    expect(escolherAdesivoDaDose({ n: 3, modulo: "saude", adesivos: [], vistos: [], sequencia: 3, jaMostrados: ["sequencia-3"] }).principal).toBeNull();
  });
  it("pulou um dia: 'recomeça' (nenhum adesivo); dia 1 sem adesivo de 1º registro (Saúde): a marca 'Dia 1', sem id do registro", () => {
    expect(escolherAdesivoDaDose({ n: 2, modulo: "rotina", adesivos: [], vistos: [], sequencia: 1 }).principal).toEqual({ tipo: "recomeca" });
    const d1 = escolherAdesivoDaDose({ n: 1, modulo: "saude", adesivos: [b("first-expense", "Primeira Despesa")], vistos: [], sequencia: 1 });
    expect(d1.principal).toEqual({ tipo: "marca", id: "marca:dia-1", nome: "Dia 1" });
    expect(d1.vistos).toEqual(["first-expense"]); // o que abriu junto entra na comemoração e fica visto
  });
  it("sem a linha de base (Momentos nunca montou): só o 1º registro e a sequência — nada de 'e mais N' com as insígnias de graça", () => {
    const e = escolherAdesivoDaDose({ n: 1, modulo: "financas", adesivos: [b("first-income", "Primeiro Salário"), b("debt-free", "Livre de Dívidas")], vistos: null, sequencia: 1 });
    expect(e.principal).toMatchObject({ tipo: "registro", id: "first-income" });
    expect(e.extras).toEqual([]);
  });
});

/* ------------------------------------------------------------ 9: o tour curto */

describe("9. o tour curto do braço A (3 passos 'faz isso', logo depois da dose 1)", () => {
  const depoisDaDose1 = (extra: Record<string, unknown> = {}) => missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, extra);

  it("Pendências conta que a dose de amanhã aparece ali; Ações rápidas grava um gasto DE VERDADE; Módulos: 'Deixar todos'; o 'visto' sai quando aparece de fato; 1x (aparelho e conta)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    depoisDaDose1();
    const store = montarStore({});
    montarComHome(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 1 de 3");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Pendências de hoje");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Aqui fica o que falta fazer hoje. Amanhã, a sua dose de 📅 Rotina vai aparecer nessa lista.");
    expect(eventos.filter(([n]) => n === "home_tour_visto")).toEqual([["home_tour_visto", { total: 3, variante: "curto" }]]);
    fireEvent.click(screen.getByTestId("tour-continuar"));
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 2 de 3");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Da próxima vez, anota o gasto daqui mesmo, sem abrir Finanças.");
    expect(screen.getByTestId("tour-continuar")).toHaveTextContent("Deixar como está");
    expect(within(screen.getByTestId("tour-gastos")).getAllByRole("button").map((x) => x.textContent)).toEqual(["☕ Café · R$ 12", "🚗 Uber · R$ 23", "🍔 Almoço · R$ 35"]);
    fireEvent.click(screen.getByTestId("tour-gasto-Uber"));
    expect((store.dados["finance-expenses"] as Array<{ description: string; value: number }>)).toEqual([expect.objectContaining({ description: "Uber", value: 23 })]);
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 3 de 3");
    expect(screen.getByTestId("tour-concluir")).toHaveTextContent("Deixar todos");
    fireEvent.click(screen.getByTestId("tour-concluir"));
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(localStorage.getItem("core-home-tour-done")).not.toBeNull();
    expect(store.dados["core-home-tour-done"]).toBeTruthy();
    expect(eventos.filter(([n]) => n === "home_tour_passo").map(([, d]) => [d.indice, d.acao])).toEqual([[0, "continuar"], [1, "gasto:Uber"], [2, "deixar"]]);
    expect(eventos).toContainEqual(["home_tour_concluido", { total: 3, variante: "curto" }]);
    // a folha do plano de amanhã vem DEPOIS do tour
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
  });

  it("reinstalou (aparelho sem a marca, conta com ela): o tour não volta — e o aparelho guarda a marca", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    depoisDaDose1();
    const store = montarStore({ "core-home-tour-done": "2026-10-03T15:00:00.000Z" });
    montarComHome(store, "/home");
    avancar(2500);
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(localStorage.getItem("core-home-tour-done")).not.toBeNull();
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument(); // e o plano de amanhã não fica esperando um tour que não vem
  });

  it("'Explorar por conta própria' (A): o tour curto não cai no mesmo segundo — entra na 1ª VOLTA à Home, sem falar de dose", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({}, { explorou: true });
    const store = montarStore({});
    montarComHome(store, "/home");
    avancar(2500);
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    cleanup();
    montarComHome(store, "/financas"); // foi explorar
    avancar(500);
    expect(lerMissao()?.saiuDaHome).toBe(true);
    cleanup();
    montarComHome(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Aqui fica o que falta fazer hoje: água, hábitos, refeições. Tocou, resolveu.");
  });

  it("fechou o app no meio do tour: ele volta, mas no máximo em 2 aberturas", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    depoisDaDose1();
    const store = montarStore({});
    for (const abertura of [1, 2]) {
      _novaAberturaDoTour();
      montarComHome(store, "/home");
      avancar(1500);
      expect(screen.getByTestId("tour-balao"), `abertura ${abertura}`).toBeInTheDocument();
      cleanup();
    }
    _novaAberturaDoTour();
    montarComHome(store, "/home");
    avancar(2500);
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------ 10: as 6 áreas com conta vazia */

describe("10. conta VAZIA nas 6 áreas da porta: a dose 1 só pede o que a conta vazia tem (ou cria na hora) e o chip GRAVA", () => {
  const casos: Array<[string, string, string]> = [
    ["dinheiro", "financas", "/financas"], ["rotina", "rotina", "/rotina"], ["corpo", "treino", "/treino"],
    ["saude", "saude", "/saude"], ["metas", "desenvolvimento", "/desenvolvimento"], ["tudo", "financas", "/financas"],
  ];
  for (const [area, modulo, rota] of casos) {
    it(`área "${area}": a missão nasce em ${modulo}, a dose abre em ${rota} e fecha com a festa pequena`, () => {
      vi.stubEnv("VITE_V14_LOJA", "1");
      ligarUmPorDia("on");
      guardarChave(CHAVES_FUNIL_W.area, area);
      const store = montarStore({});
      montar(store, "/home");
      expect(lerMissao()?.modulos[0]).toBe(modulo);
      expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area_lida: area })]);
      fireEvent.click(screen.getByTestId("missao-doses-comecar"));
      expect(screen.getByTestId("rota")).toHaveTextContent(rota);
      const postIt = esperarPostIt();
      const chips = within(postIt).getAllByTestId("demo-guia-chip");
      expect(chips.length).toBeGreaterThanOrEqual(3);
      fireEvent.click(chips[0]);
      if (modulo === "rotina") {
        fireEvent.click(screen.getByText("Adicionar"));
        avancar(400); avancar(1000);
        fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
      }
      avancar(700);
      expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
      // o registro é DE VERDADE, na chave que o módulo lê
      const chave = { financas: "finance-expenses", rotina: "rotina-habits-checked", treino: "saude-workouts-v2", saude: "core-saude-water", desenvolvimento: "goals-board-v2" }[modulo]!;
      expect(store.dados[chave], chave).toBeTruthy();
      if (modulo === "saude") expect(store.dados["core-saude-water-goal"]).toBe(6);
    });
  }
});

/* ------------------------------------------------------------ 11: o 900002 e o braço B */

describe("11. 'próxima dose' em +3 h (900002): nunca no braço A; no B (o controle) continua", () => {
  it("A: a dose 1 inteira não arma nada; B: o 'Agora não' arma como na 1.0.15", async () => {
    const notif = await import("@/lib/notificacoes");
    const armar = vi.mocked(notif.agendarProximaDose);
    armar.mockClear();
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    avancar(700);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    expect(armar).not.toHaveBeenCalled();
    cleanup();
    // B
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    montar(montarStore({}), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    terminarOlhar();
    fireEvent.click(screen.getByTestId("missao-doses-agora-nao"));
    expect(armar).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------ 12: o anel que perde a âncora de vez */

describe("12. a âncora sumiu DE VEZ: o post-it fica (e grava); ela volta: o anel volta sozinho", () => {
  it("post-it solto na tela (o portal fora do AnimatePresence monta), evento ancora_invisivel; o botão volta → missao_doses_anel_voltou; o chip grava e fecha a dose", () => {
    ligarUmPorDia("on");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    esperarPostIt();
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    act(() => { store.set("__semBotao", true); });
    avancar(300); avancar(3000);
    expect(screen.getByTestId("missao-doses-postit-solto")).toBeInTheDocument();
    expect(eventos).toContainEqual(["missao_doses_anel_saiu", expect.objectContaining({ motivo: "ancora_invisivel" })]);
    act(() => { store.set("__semBotao", false); });
    avancar(800);
    expect(eventos).toContainEqual(["missao_doses_anel_voltou", expect.objectContaining({ dia: 1, modulo: "financas" })]);
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    // e com o post-it solto o chip também grava: some de novo e toca o chip do post-it solto
    act(() => { store.set("__semBotao", true); });
    avancar(300); avancar(3000);
    fireEvent.click(within(screen.getByTestId("missao-doses-postit-solto")).getAllByTestId("demo-guia-chip")[1]);
    avancar(700);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect((store.dados["finance-expenses"] as Array<{ description: string }>)[0]).toMatchObject({ description: "Uber" });
  });
});
