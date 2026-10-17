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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
  // o "Rotina pronta em 3 toques" (quiz da 1ª dose da Rotina) pergunta a permissão e arma o aviso do teste
  estadoPermissao: vi.fn(async () => "granted"),
  armarLembreteDoTesteSePuder: vi.fn(async () => {}),
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
  retomadaDoGasto, setupDaDose, idDaMissao, doseCurta,
} from "@/lib/missao-doses";
import { CONHECER_MAIS, SETUPS_ENCAIXADOS } from "@/components/missao-doses/encaixes";
import { PASSAGEM_B_MS } from "@/components/missao-doses/PassoDoDia";
import { _novaAberturaDoTour, marcarTourFeito, varianteDoTour } from "@/lib/tour-home";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { TourDaHome, useTourDaHome } from "@/components/home/TourDaHome";
import { escolherAdesivoDaDose } from "@/components/missao-doses/adesivo-da-dose";
import {
  CHAVE_BRACO_DIA1, CHAVE_UM_POR_DIA_APARELHO, _zerarUmPorDiaRemoto, bracoDia1, idDoAparelho, lerUmPorDiaRemoto, modoDia1Cheio, modoUmPorDia, registrarUmPorDiaRemoto, sortearBraco,
} from "@/lib/dia1-cheio";
import { CHAVES_FUNIL_W, guardarChave, lerChave, limparProgresso } from "@/pages/funis/w/retomada";
import { conteudoDoLembrete, porDiaExato } from "@/lib/lembrete-dia2";
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
/** Finanças com as DUAS abas que a dose usa, como o PAINEL LIMPO da conta nova: MEU FINANCEIRO (o "+ Novo gasto") e
 *  DASHBOARD (o card "QUANTO POSSO GASTAR HOJE", com o número pela mesma conta do card de verdade, arredondado igual,
 *  e logo abaixo o MEU MÊS com o "↓ Saiu" = contas fixas + gastos). */
const FinancasFalsa = () => {
  const { get } = useUserData();
  const [aba, setAba] = useState<"financeiro" | "dashboard">("financeiro");
  const versao = get<number>("__versao", 0);
  const semBotao = get<boolean>("__semBotao", false); // a linha do "+ Novo gasto" some DE VEZ (o módulo trocou de tela)
  const porDia = porDiaExato(get);
  const soma = (k: string) => (get<Array<{ value?: unknown }>>(k, []) ?? []).reduce((t, e) => t + (Number(e?.value) || 0), 0);
  const saiu = soma("finance-expenses") + soma("finance-fixed-expenses");
  return (
    <div><Rota /><header className="sticky">FINANÇAS</header>
      <nav><button type="button" data-spotlight="tab-dashboard" data-active={aba === "dashboard"} onClick={() => setAba("dashboard")}>DASHBOARD</button><button type="button" data-spotlight="financeiro" data-active={aba === "financeiro"} onClick={() => setAba("financeiro")}>MEU FINANCEIRO</button></nav>
      {aba === "financeiro" ? (
        !semBotao && <div key={`linha-${versao}`}><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div>
      ) : (
        <>
          <div data-spotlight="pode-gastar"><h3>QUANTO POSSO GASTAR HOJE</h3><p data-testid="pode-gastar-valor">R$ {porDia === null ? 0 : Math.round(porDia)}</p></div>
          <section data-missao="meu-mes"><div><h3>MEU MÊS</h3></div><div><span>↑ Entrou R$ 0</span><span data-testid="meu-mes-saiu">↓ Saiu R$ {saiu.toLocaleString("pt-BR")}</span></div></section>
        </>
      )}
    </div>
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
/** O relógio em passos de 50 ms: o React desenha entre um timer e outro (como no aparelho) — pra medir tempo de verdade. */
const andar = (ms: number) => { for (let t = 0; t < ms; t += 50) avancar(Math.min(50, ms - t)); };
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
/** O "olha" de Finanças anda SOZINHO (≤ 4 s: o número → o MEU MÊS, ou só o MEU MÊS) até a festa. */
const passarOlhaDeFinancas = () => {
  for (let i = 0; i < 40 && !screen.queryByTestId("missao-doses-festa"); i++) avancar(250);
  return screen.getByTestId("missao-doses-festa");
};
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
  // ... e a da Rotina, o "Rotina pronta em 3 toques": idem (quem pulou cria o 1º hábito pelo chip) — os blocos 16 e 18 tiram
  localStorage.setItem("core-montar-rotina", JSON.stringify({ r: "pulou" }));
  eventos.length = 0;
  _zerarUmPorDiaRemoto();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  conta.user_metadata = {};
  iphone();
  // o cabeçalho fixo do módulo fica no TOPO (0–56); o resto, em 100–148 (o post-it "colado embaixo da faixa" decide por aí)
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return (this.matches?.("header.sticky, .demo-tour-nav")
      ? { top: 0, left: 0, width: 390, height: 56, bottom: 56, right: 390, x: 0, y: 0, toJSON: () => ({}) }
      : { top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) }) as DOMRect;
  });
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
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    // 3º passo (opcional): o cartão — "Não uso cartão" já monta
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull(); // nada da missão por cima do Montar
    fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    expect(Array.isArray(store.dados["finance-incomes"])).toBe(true);
    // a dose JÁ conta no "Pronto" do Montar (fechar o app no gasto de carona não desfaz o Montar)
    expect(lerMissao()?.feitos[1]?.rotulo).toMatch(/^Pode gastar R\$ [\d.]+ por dia$/);
    // o 1º gasto guiado: post-it com os 3 prontos + "escrever o meu" (o anel só procura o "+ Novo gasto" com o Montar fora da tela)
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    expect(within(postIt).getByTestId("demo-guia-escrever")).toBeInTheDocument();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]); // ☕ Café
    // o "olha": a aba troca pro DASHBOARD e o "QUANTO POSSO GASTAR HOJE" acende com o número de antes → depois
    // (registrou 550 ms → acha o card 250 ms → pausa 500 ms → o anel assenta e aparece em ~2 s)
    andar(2200);
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Quanto você pode gastar hoje");
    expect(screen.getByTestId("missao-doses-olhar")).toHaveTextContent("Esse gasto já entrou na conta");
    const olhar = eventos.find(([nome, d]) => nome === "missao_doses_passo" && d.passo === "olhar" && d.acao === "view")?.[1];
    expect(olhar).toMatchObject({ alvo: "pode_gastar", caiu: false });
    expect(olhar).not.toHaveProperty("antes"); // (17/10) nunca valor em reais em evento
    // 29 dias no mês (03/10): R$ 12 não mexem no "por dia" arredondado — o balão diz o que saiu, sem fingir uma queda
    const porDiaDoCard = (screen.getByTestId("pode-gastar-valor").textContent ?? "").replace(/\D/g, "");
    expect(screen.getByTestId("missao-doses-olhar-numero")).toHaveTextContent(`R$ ${porDiaDoCard} por dia`);
    expect(screen.getByTestId("missao-doses-olhar-numero")).toHaveTextContent("Saíram R$ 12 do que sobra no mês.");
    expect(screen.getByTestId("missao-doses-olhar-tempo")).toHaveTextContent("Olha · 1 de 2");
    // o "Entendi" do 1º tempo leva pro 2º: a rolagem pousa no MEU MÊS e o "Saiu" do mês conta + R$ 12 (a batida do 1.0.14)
    fireEvent.click(screen.getByTestId("missao-doses-entendi"));
    andar(300); // o anel do 2º tempo desenha no 1º quadro estável (a tela já rolou)
    const ultimo = (id: string) => screen.getAllByTestId(id).at(-1)!; // o balão do 1º tempo ainda sai animado no jsdom
    expect(ultimo("missao-doses-olhar-tempo")).toHaveTextContent("Olha · 2 de 2");
    expect(ultimo("missao-doses-olhar-titulo")).toHaveTextContent("E o seu mês");
    expect(ultimo("missao-doses-olhar")).toHaveTextContent("O gasto entrou no dia de hoje e o “Saiu” do mês somou sozinho.");
    const mes = eventos.find(([nome, d]) => nome === "missao_doses_passo" && d.alvo === "meu_mes")?.[1];
    expect(mes).toMatchObject({ contou: true }); // (17/10) o valor nunca vai no evento
    // na tela: o "Saiu" do mês de ANTES (as contas fixas do Montar) → + R$ 12
    const saiuAgora = Number((screen.getByTestId("meu-mes-saiu").textContent ?? "").replace(/\D/g, ""));
    expect(ultimo("missao-doses-olhar-numero")).toHaveTextContent("Saiu no mês:");
    expect(ultimo("missao-doses-olhar-numero")).toHaveTextContent(`R$ ${(saiuAgora - 12).toLocaleString("pt-BR")}`);
    // ... e a festa entra SOZINHA (o 2º tempo segura 1,5 s desde que o anel apareceu)
    andar(1300);
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    andar(300);
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
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("O adesivo do dia 2 te espera 🔒");
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

  it("depois do Montar: o 'Pular' da faixa (aos 20 s) fecha a dose com a festa — a dose NÃO conta como pulada; fechar o app no post-it do gasto não desfaz a dose", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const fazerMontar = () => {
      const mf = () => within(screen.getByTestId("montar-financas"));
      fireEvent.click(mf().getByRole("button", { name: "Até R$ 2 mil" }));
      fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
      fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
      fireEvent.click(mf().getByRole("button", { name: "Pular" })); // pula só a pergunta do cartão: o Montar fecha igual
      avancar(2500);
      fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    };
    // 1) o "Pular" da faixa, que aparece aos 20 s
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    esperarPostIt();
    avancar(20_000);
    fireEvent.click(screen.getByTestId("missao-doses-pular"));
    const festa = screen.getByTestId("missao-doses-festa");
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "agora_nao" })]);
    cleanup();
    // 2) fecha o app com o post-it do gasto na tela: a dose está gravada e o gasto fica PENDENTE — reabrir no mesmo
    //    dia volta NO PASSO DO GASTO, com os chips prontos (nunca o Montar) — a seção 15 cobre o resto
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store2 = montarStore({});
    montar(store2, "/financas");
    fazerMontar();
    esperarPostIt();
    cleanup();
    expect(lerMissao()?.feitos[1]?.rotulo).toMatch(/^Pode gastar R\$ [\d.]+ por dia$/);
    expect(lerMissao()?.gastoGuiado).toEqual({ n: 1, dia: "2026-10-03", retomadas: 0 });
    expect(document.documentElement.hasAttribute("data-missao-dose")).toBe(false);
    montar(store2, "/financas");
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(lerMissao()?.pulados).toBeUndefined();
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

  it("dia 2: convite 1x ('Dia 2 de 3 · Rotina · 20 s' + o de ontem) → 'Bora' → 3 hábitos prontos → festa PEQUENA com o adesivo da sequência de 2 dias (o 'Voltei' do registro, sequencia-2) + 'Sequência: 2 dias 🔥' + o dos 3 dias trancado + a hora; dica do score; dia 3: convite 'Faltam 10 s' → 'Agora não' não volta (reabrir, logout) → Saúde (meta + copo) → a ÚNICA festa em tela cheia, '3 dias seguidos' → 'O que você construiu'", () => {
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
    // o adesivo da sequência: o REAL do registro (Conquistas 2, merge 17/10) — "sequencia-2" = "Voltei", com a arte dele
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "sequencia-2");
    expect(within(screen.getByTestId("missao-doses-adesivo")).getByTestId("missao-doses-adesivo-arte")).toHaveAttribute("data-arte", "registro");
    expect(screen.getByTestId("missao-doses-adesivo-legenda")).toHaveTextContent("Adesivo novo: Voltei");
    expect(store.dados["conquistas-vistas"]).toMatchObject({ adesivos: expect.arrayContaining(["sequencia-2"]), marcos: [2] });
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("Amanhã: ❤️ Saúde · 10 s");
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent("E o adesivo dos 3 dias é seu 🔒");
    expect(screen.getByTestId("missao-doses-hora-12h")).toHaveAttribute("aria-checked", "true"); // a combinada; dá pra trocar
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "sequencia-2", tipo: "registro", dia: 2, sequencia: 2 })]);
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
  it("Conquistas: o 'Missão · dia N de 3' sai da missão NOVA quando não há a antiga (missaoAtual/diaDaMissao intocados: a antiga, se existir, manda)", async () => {
    const { diaDoTeste } = await import("@/components/conquistas/nova/ConquistasNova");
    localStorage.setItem("core-trial-cartao-fim", String(new Date(2026, 9, 6, 15, 0).getTime()));
    expect(diaDoTeste()).toBeNull(); // sem missão nenhuma
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } });
    expect(diaDoTeste()).toBe(1);
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    expect(diaDoTeste()).toBe(2);
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0)); // passou do dia 3
    expect(diaDoTeste()).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, explorou: true }));
    expect(diaDoTeste()).toBeNull(); // foi explorar: sem missão
    // a missão ANTIGA (core-missao, 1.0.9) continua mandando quando existe
    localStorage.setItem("core-missao", JSON.stringify({ inicio: new Date(2026, 9, 2, 9, 0).getTime(), area: "dinheiro", d1: true, d2: false, d3: false, vista: true, holofote: "feito" }));
    expect(diaDoTeste()).toBe(3);
  });

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

describe("10. conta VAZIA nas 6 áreas da porta × os DOIS braços: a dose 1 só pede o que a conta vazia tem (ou cria na hora) e o chip GRAVA", () => {
  const casos: Array<[string, string, string]> = [
    ["dinheiro", "financas", "/financas"], ["rotina", "rotina", "/rotina"], ["corpo", "treino", "/treino"],
    ["saude", "saude", "/saude"], ["metas", "desenvolvimento", "/desenvolvimento"], ["tudo", "financas", "/financas"],
  ];
  /** A: a comemoração pequena ("Dia 1 de 3 feito"); B: a festa com a passagem pra próxima (o "olhar" do B, se vier, no Entendi). */
  const ateAFesta = (braco: "A" | "B") => {
    for (let i = 0; i < 40 && !screen.queryByTestId("missao-doses-festa"); i++) {
      const entendi = screen.queryByTestId("missao-doses-entendi");
      if (entendi && braco === "B") fireEvent.click(entendi);
      avancar(250);
    }
    return screen.getByTestId("missao-doses-festa");
  };
  const conferirFesta = (braco: "A" | "B") => {
    const festa = ateAFesta(braco);
    if (braco === "A") expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    else { expect(festa).toHaveTextContent("Primeira dose feita!"); expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent(/^Agora (a|as|o|os) .+ — \d+ s$/); }
  };
  for (const braco of ["A", "B"] as const) {
    for (const [area, modulo, rota] of casos) {
      it(`braço ${braco}, área "${area}": a missão nasce em ${modulo}, a dose abre em ${rota} e fecha com a festa do braço`, () => {
        vi.stubEnv("VITE_V14_LOJA", "1");
        if (braco === "A") ligarUmPorDia("on"); else { ligarUmPorDia("ab"); localStorage.setItem(CHAVE_BRACO_DIA1, "B"); }
        guardarChave(CHAVES_FUNIL_W.area, area);
        const store = montarStore({});
        montar(store, "/home");
        expect(lerMissao()).toMatchObject({ braco, modulos: [modulo, expect.any(String), expect.any(String)] });
        expect(eventos).toContainEqual(["missao_doses_inicio", expect.objectContaining({ area_lida: area })]);
        if (braco === "B") fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
        fireEvent.click(screen.getByTestId("missao-doses-comecar"));
        expect(screen.getByTestId("rota")).toHaveTextContent(rota);
        if (modulo === "treino") {
          // corpo: o quiz da 1ª dose (EscolherTreino da introdução dos módulos) — 2 toques e a semana sai montada = a dose
          const q = within(screen.getByTestId("missao-escolher-treino"));
          fireEvent.click(q.getByRole("button", { name: /Academia/ }));
          fireEvent.click(q.getByRole("button", { name: "4 dias" }));
          conferirFesta(braco);
          expect(screen.queryByTestId("missao-escolher-treino")).toBeNull();
          expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(braco === "A" ? /O treino “.+” já está montado na sua semana\./ : /já está/);
          expect(store.dados["saude-workouts-v2"]).toBeTruthy();
          return;
        }
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
        // Finanças termina olhando o MEU MÊS (sozinho, ≤ 4 s); os outros vão direto pra festa no braço A
        conferirFesta(braco);
        // o registro é DE VERDADE, na chave que o módulo lê
        const chave = { financas: "finance-expenses", rotina: "rotina-habits-checked", treino: "saude-workouts-v2", saude: "core-saude-water", desenvolvimento: "goals-board-v2" }[modulo]!;
        expect(store.dados[chave], chave).toBeTruthy();
        if (modulo === "saude") expect(store.dados["core-saude-water-goal"]).toBe(6);
        expect(lerMissao()?.feitos[1]?.dia).toBe("2026-10-03");
      });
    }
  }
});

/* ------------------------------------------------------------ 11: o 900002 e o braço B */

describe("11. 'próxima dose' em +3 h (900002): fora dos dois braços (dono, 17/10 — no máximo 1 aviso de teste por dia)", () => {
  it("A: a dose 1 inteira não arma nada; B: o 'Agora não' também não arma (o do dia 2 já leva a dose)", async () => {
    const notif = await import("@/lib/notificacoes");
    const armar = vi.mocked(notif.agendarProximaDose);
    armar.mockClear();
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
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
    expect(armar).not.toHaveBeenCalled();
    expect(eventos.map(([n]) => n)).toContain("missao_agora_nao");
    expect(eventos.map(([n]) => n)).not.toContain("missao_proxima_dose_armada");
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
    expect(passarOlhaDeFinancas()).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect((store.dados["finance-expenses"] as Array<{ description: string }>)[0]).toMatchObject({ description: "Uber" });
  });
});

/* ------------------------------------------------------------ 13: módulo já apresentado → a dose continua */

describe("13. contrato com a introdução dos módulos: o módulo já apresentado no dia 1 (por curiosidade) — a dose CONTINUA, não repete a 1ª ação", () => {
  const hojeDaRotina = () => DIAS_ROTINA[(new Date().getDay() + 6) % 7];

  it("Rotina apresentada no dia 1 (chave do aparelho): no dia 2 a dose é 'Já fez o seu hábito hoje?' com o hábito DELA — nada de 'crie o 1º hábito'; marcou → festa", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.setItem("core-intro-vista-rotina", "feita@2026-10-03T16:00:00.000Z"); // a introdução da Rotina FEITA (lib/intro-modulo)
    const store = montarStore({ "rotina-habits": ["Beber água ao acordar"], "rotina-habits-checked": { SÁBADO: [true] }, [CHAVE_DIAS_ANOTADOS]: ["2026-10-03"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { convites: { "2026-10-04": "foi" }, lembrete: "12h" });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // domingo, dia 2
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Já fez o seu hábito hoje?");
    expect(postIt).toHaveTextContent("“Beber água ao acordar”: toca no quadradinho da linha de HOJE.");
    expect(postIt).not.toHaveTextContent("Qual hábito você quer começar hoje?");
    expect(within(postIt).queryAllByTestId("demo-guia-chip")).toHaveLength(0);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "toque", acao: "view", continuacao: true, intro_feita: true })]);
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${hojeDaRotina()}`));
    avancar(700);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 2 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("“Beber água ao acordar” já está na sua Rotina, com o quadradinho de hoje marcado.");
    expect(store.dados["rotina-habits"]).toEqual(["Beber água ao acordar"]); // nenhum hábito novo
  });

  it("Saúde apresentada (chave da CONTA): no dia 3 não pergunta a meta de novo — 'Mais 1 copo d'água hoje?' e 1 toque", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const store = montarStore({ "core-intro-feitas": ["saude"], [CHAVE_DIAS_ANOTADOS]: ["2026-10-03", "2026-10-04"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" }, 2: { dia: "2026-10-04", rotulo: "y" } }, { convites: { "2026-10-05": "foi" } });
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
    montar(store, "/saude");
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Mais 1 copo d'água hoje?");
    const chips = within(postIt).getAllByTestId("demo-guia-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["💧1 copo d'água"]);
    fireEvent.click(chips[0]);
    expect(store.dados["core-saude-water-goal"]).toBeUndefined(); // a meta não foi perguntada de novo
    avancar(700);
    expect(screen.getByTestId("missao-doses-festa")).toHaveAttribute("data-tela-cheia"); // 3 dias seguidos
  });

  it("Finanças apresentada (chave da conta): a dose de Finanças é o gasto de hoje — o Montar não abre", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas"); // nem decidido: só a introdução foi feita
    const store = montarStore({ "core-intro-feitas": ["financas"] });
    missaoA({});
    montar(store, "/financas");
    const postIt = esperarPostIt();
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect(passarOlhaDeFinancas()).toHaveTextContent("Dia 1 de 3 feito ✅");
  });

  it("Treino apresentado com plano (a introdução aplicou um modelo): a dose é anotar 1 exercício de hoje — nunca um 2º modelo por cima", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.setItem("core-intro-vista-treino", "feita@2026-10-03T12:00:00.000Z");
    const plano = { SEGUNDA: { exercises: [{ name: "Supino" }] }, QUARTA: { exercises: [{ name: "Agachamento livre" }] } };
    const store = montarStore({ "saude-workouts-v2": plano });
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["treino", "saude", "financas"], "2026-10-03", undefined, "A"), boasVindas: true }));
    montar(store, "/treino");
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Anota 1 exercício de hoje:");
    expect(postIt).not.toHaveTextContent("Escolhe um treino pronto");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => c.textContent)).toEqual(["🦵Agachamento", "🏃Corrida", "🚶Caminhada"]);
  });

  it("sem introdução (o caminho normal) nada muda: Rotina vazia ensina a criar o 1º hábito; e o braço B TAMBÉM continua quando a introdução foi feita (regra final do dono, 17/10)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" } }, { convites: { "2026-10-04": "foi" } });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(montarStore({}), "/rotina");
    expect(esperarPostIt()).toHaveTextContent("Qual hábito você quer começar hoje?");
    cleanup();
    // B com a introdução da Saúde gravada: "toda outra dose é a guiada simples, ou a continuação se a introdução daquele
    // módulo já foi feita" — vale nos dois braços (o B não é a 1.0.15 byte a byte)
    localStorage.setItem("core-intro-vista-saude", "feita@2026-10-04T09:00:00.000Z");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "saude", "rotina"], "2026-10-04", undefined, "B"), boasVindas: true, feitos: { 1: { dia: "2026-10-04", rotulo: "Café · R$ 12" } } }));
    montar(montarStore({}), "/saude");
    expect(esperarPostIt()).toHaveTextContent("Mais 1 copo d'água hoje?");
    cleanup();
    // ... e sem a introdução, o B segue a dose guiada simples (a meta no chip)
    localStorage.removeItem("core-intro-vista-saude");
    montar(montarStore({}), "/saude");
    expect(esperarPostIt()).toHaveTextContent("Quantos copos por dia?");
  });
});

/* ------------------------------------------------------------ 14: a dose de Finanças termina OLHANDO o número */

describe("14. dose de Finanças (os dois braços): Montar → 1º gasto guiado → 'olha' no QUANTO POSSO GASTAR HOJE → festa", () => {
  const montarAte2mil = () => {
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "Até R$ 2 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
  };

  it("fim do mês (28/10, 4 dias): o número CAI na frente dela — R$ 375 → R$ 372 — e a aba vira o DASHBOARD", () => {
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas");
    vi.setSystemTime(new Date(2026, 9, 28, 10, 0));
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-28", undefined, "A"), boasVindas: true }));
    conta.created_at = new Date(2026, 9, 28, 9, 0).toISOString();
    const store = montarStore({});
    montar(store, "/financas");
    montarAte2mil();
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]); // ☕ Café · R$ 12
    andar(2200);
    expect(screen.getByTestId("pode-gastar-valor")).toHaveTextContent("R$ 372"); // o card de verdade, já com o gasto
    const numero = screen.getByTestId("missao-doses-olhar-numero");
    expect(numero).toHaveTextContent("Por dia:");
    expect(numero).toHaveTextContent("R$ 375");
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "pode_gastar", caiu: true })]);
    // sem tocar em nada: 1,4 s no número → o MEU MÊS (o "Saiu" conta + R$ 12) → 1,5 s → a festa (< 4 s com o anel na tela)
    const anelNaTela = Date.now();
    andar(1700);
    const ultimo = (id: string) => screen.getAllByTestId(id).at(-1)!;
    expect(ultimo("missao-doses-olhar-tempo")).toHaveTextContent("Olha · 2 de 2");
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", tempo: 2, contou: true })]);
    expect(ultimo("missao-doses-olhar-numero")).toHaveTextContent("Saiu no mês:");
    for (let i = 0; i < 40 && !screen.queryByTestId("missao-doses-festa"); i++) avancar(50);
    expect(Date.now() - anelNaTela).toBeLessThanOrEqual(4000);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("Você pode gastar R$ 372 por dia"); // o número de AGORA, não o do "Saiu"
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "feito", via: "auto" })]);
  });

  it("pulou o Montar e não tem renda: o 1º gasto guiado direto; sem número de 'pode gastar', o 'olha' é SÓ o MEU MÊS (1 de 1, o 'Saiu' conta) e a festa entra sozinha", () => {
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    fireEvent.click(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Pular" }));
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    andar(2200);
    expect(eventos.some(([n, d]) => n === "missao_doses_passo" && d.alvo === "pode_gastar")).toBe(false);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", contou: true })]);
    expect(screen.getByTestId("missao-doses-olhar-numero")).toHaveTextContent("R$ 0"); // o "Saiu" conta de R$ 0 → R$ 12 na tela
    expect(screen.getByTestId("missao-doses-olhar-tempo")).toHaveTextContent("Olha · 1 de 1");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Olha o seu mês");
    expect(screen.getByTestId("meu-mes-saiu")).toHaveTextContent("↓ Saiu R$ 12"); // o MEU MÊS do painel limpo (a aba virou o DASHBOARD)
    andar(2000);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
  });
});

/* ------------------------------------------------------------ 15: o 1º passo de Finanças (o maior vazamento: 63%) */

describe("15. o 1º passo de Finanças, do fim do Montar ao 1º gasto (dono, 17/10: 'foca no primeiro passo de Finanças')", () => {
  /** Montar até o número (renda + 1 conta + sem cartão) e "Ver minhas Finanças"; devolve a hora do toque. */
  const fazerMontar = () => {
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: /Aluguel/ }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    fireEvent.click(mf().getByRole("button", { name: "Ver minhas Finanças" }));
    return Date.now();
  };
  const ate = (cond: () => boolean, maxMs = 8000) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < maxMs) avancar(50); return Date.now(); };
  const postItNaTela = () => screen.queryAllByTestId("demo-guia-postit").length > 0;
  const visibilidade = (v: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  };
  const missaoNova = (braco: "A" | "B") => {
    localStorage.removeItem("core-montar-financas");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, braco), boasVindas: true, dono: donoDaConta("u1") }));
  };
  afterEach(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); });

  it("B11 + D1: fechar o app NA tela do número (com ou sem o gasto anotado ali) → reabrir volta NELA, com os chips (ou o ✓), nunca no anel do 1º gasto; 'Ver no meu mês' → o MEU MÊS → a festa, um gasto só", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: /Aluguel/ }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500); // "Montando…" → "Você pode gastar hoje R$ X" com os chips do 1º gasto
    expect(screen.getByTestId("montar-postit-gasto")).toHaveTextContent("Já gastou com alguma coisa hoje?");
    avancar(400); // a dose grava ali mesmo, na tela do número (B11)
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.gastoGuiado).toMatchObject({ n: 1, dia: "2026-10-03" });
    // (1) o app morre sem ela tocar em nada → reabre na Home → a missão leva de volta pra TELA DO NÚMERO
    cleanup();
    montar(store, "/home");
    for (let i = 0; i < 10; i++) avancar(300);
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    expect(screen.getByTestId("montar-postit-gasto")).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(screen.queryByTestId("missao-doses-anel")).toBeNull(); // nunca o anel do passo do gasto
    expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0);
    // (2) toca o Café ALI (vira ✓) e o app morre de novo
    fireEvent.click(screen.getByRole("button", { name: /^Café, R\$ 12/ }));
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    cleanup();
    montar(store, "/financas");
    for (let i = 0; i < 6; i++) avancar(300);
    const postit = screen.getByTestId("montar-postit-gasto");
    expect(postit).toHaveAttribute("data-anotado"); // o ✓ de antes, sem gravar de novo
    expect(postit).toHaveTextContent("Primeiro gasto no lugar.");
    expect(screen.queryByTestId("missao-doses-anel")).toBeNull();
    // (3) "Ver no meu mês →": sem anel — o MEU MÊS (o "Saiu" conta) e a festa; o gasto é um só, a dose é uma só
    fireEvent.click(screen.getByRole("button", { name: /Ver no meu mês/ }));
    expect(passarOlhaDeFinancas()).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-gasto-extra")).toHaveTextContent("E o gasto de hoje (Café, R$ 12) já entrou no seu mês.");
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(eventos.some(([n, d]) => n === "missao_doses_passo" && d.alvo === "pode_gastar")).toBe(false); // o número já caiu na tela do Montar
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
  });

  it("a cadeia inteira no relógio falso: 'Ver minhas Finanças' → post-it com os chips em < 1,5 s → 1 TOQUE no chip = o gasto na conta → o 'olha' (≤ 4 s) → a festa; os eventos do Montar e da dose levam o mesmo missao_id/braço", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    const t0 = fazerMontar();
    const tPostIt = ate(postItNaTela);
    const postIt = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => c.textContent)).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    expect(within(postIt).getByTestId("demo-guia-escrever")).toBeInTheDocument();
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument(); // o anel já está no "+ Novo gasto" (aba MEU FINANCEIRO)
    // 1 toque: o chip GRAVA o gasto direto (sem caçar o campo nem o "+")
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    const tGasto = Date.now();
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Café", value: 12 })]);
    const tOlha = ate(() => screen.queryAllByTestId("missao-doses-olhar").length > 0);
    const tFesta = ate(() => !!screen.queryByTestId("missao-doses-festa"));
    const tempos = { ate_os_chips: tPostIt - t0, toque_ate_o_olha: tOlha - tGasto, olha_ate_a_festa: tFesta - tOlha, toque_ate_a_festa: tFesta - tGasto };
    console.info("[1o-passo-financas]", JSON.stringify(tempos));
    expect(tempos.ate_os_chips).toBeLessThanOrEqual(1500);
    expect(tempos.olha_ate_a_festa).toBeLessThanOrEqual(4000);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    // o funil Montar → 1º gasto → olha se lê junto: o mesmo id da missão e o mesmo braço
    const id = idDaMissao(lerMissao()!);
    const doMontar = eventos.filter(([n]) => n.startsWith("montar_financas_")).map(([, d]) => d);
    expect(doMontar.length).toBeGreaterThanOrEqual(3);
    for (const d of doMontar) expect(d).toMatchObject({ origem: "missao", missao_id: id, braco: "um_por_dia" });
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "montar_financas", acao: "view", missao_id: id })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip", missao_id: id })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", alvo: "meu_mes", missao_id: id })]);
    expect(lerMissao()?.gastoGuiado).toBeUndefined(); // o gasto entrou: nada pendente
  });

  it("teclado: '✎ escrever o meu' põe o foco no campo do módulo e o anel some enquanto ela digita (sem sair do passo); o gasto digitado conta igual e o 'Saiu' do MEU MÊS soma o valor dela", () => {
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getByTestId("demo-guia-escrever"));
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Novo gasto"));
    avancar(100);
    expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0); // digitando: nada desenhado por cima do campo
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    expect(screen.getByTestId("missao-doses-faixa")).toBeInTheDocument(); // o passo continua
    // ela salva o gasto dela pelo formulário do módulo
    act(() => { store.set("finance-expenses", [{ id: "g-1", description: "Padaria", value: 18, date: "2026-10-03", category: "alimentacao", paymentMethod: "pix" }]); });
    (document.activeElement as HTMLElement | null)?.blur();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "digitado" })]);
    passarOlhaDeFinancas();
    const mes = eventos.find(([n, d]) => n === "missao_doses_passo" && d.alvo === "meu_mes")?.[1];
    expect(mes).toMatchObject({ contou: true }); // o "Saiu" contou + R$ 18 na tela (o valor nunca vai no evento)
    expect(screen.getByTestId("missao-doses-gasto-extra")).toHaveTextContent("E o gasto de hoje (Padaria, R$ 18) já entrou no seu mês.");
  });

  it("saiu do app no meio do passo (2º plano) e voltou: o post-it com os chips NUNCA some (fica solto) e o anel volta sozinho; o chip do post-it solto grava", () => {
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    visibilidade("hidden");
    expect(eventos).toContainEqual(["missao_doses_anel_saiu", expect.objectContaining({ motivo: "segundo_plano" })]);
    const solto = screen.getByTestId("missao-doses-postit-solto");
    expect(solto).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(solto).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    visibilidade("visible");
    avancar(50);
    expect(eventos).toContainEqual(["missao_doses_anel_voltou", expect.objectContaining({ motivo: "segundo_plano" })]);
    // de novo no 2º plano, e ela toca o chip assim que volta (antes do anel)
    visibilidade("hidden");
    fireEvent.click(within(screen.getByTestId("missao-doses-postit-solto")).getAllByTestId("demo-guia-chip")[1]);
    visibilidade("visible");
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Uber", value: 23 })]);
    expect(passarOlhaDeFinancas()).toHaveTextContent("Dia 1 de 3 feito ✅");
  });

  it("o app MORREU no meio do passo: reabrir no mesmo dia (na Home) leva direto pro passo do gasto, com os chips prontos — o Montar NUNCA recomeça; o gasto fecha a dose com o 'olha' e a festa", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    cleanup(); // o iOS matou o app
    expect(lerMissao()?.feitos[1]?.rotulo).toMatch(/^Pode gastar R\$ [\d.]+ por dia$/);
    expect(retomadaDoGasto(lerMissao())).toEqual({ n: 1, retomadas: 0 });
    expect(missaoEmAndamento(lerMissao())).toBe(true); // o tour e as folhas da Home esperam
    vi.setSystemTime(new Date(2026, 9, 3, 18, 40)); // reabre horas depois, no mesmo dia
    montarComHome(store, "/home");
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    const t0 = Date.now();
    ate(postItNaTela);
    expect(Date.now() - t0).toBeLessThanOrEqual(1500);
    const postIt = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postIt).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_retomada", expect.objectContaining({ passo: "gasto_depois_do_montar", vez: 1 })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "toque", acao: "view", retomada: "gasto_depois_do_montar" })]);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[2]); // 🍔 Almoço
    const festa = passarOlhaDeFinancas();
    expect(festa).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(screen.getByTestId("missao-doses-gasto-extra")).toHaveTextContent("E o gasto de hoje (Almoço, R$ 35) já entrou no seu mês.");
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1); // a dose é uma só
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    // reabrir de novo: nada volta
    cleanup();
    montar(store, "/home");
    avancar(3000);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("no máximo 2 retomadas: a 3ª abertura sem o gasto é a Home de sempre; num dia novo, nada; 'Pular' na retomada fecha a dose com a festa", () => {
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    cleanup();
    for (const vez of [1, 2]) {
      montar(store, "/home");
      expect(screen.getByTestId("rota"), `retomada ${vez}`).toHaveTextContent("/financas");
      ate(postItNaTela);
      cleanup();
    }
    expect(lerMissao()?.gastoGuiado?.retomadas).toBe(2);
    montar(store, "/home");
    avancar(3000);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(retomadaDoGasto(lerMissao())).toBeNull();
    cleanup();
    // num dia novo, a pendência de ontem não vale
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...lerMissao()!, gastoGuiado: { n: 1, dia: "2026-10-03", retomadas: 0 } }));
    expect(retomadaDoGasto(lerMissao(), "2026-10-04")).toBeNull();
    // Pular na retomada: a festa (a dose já estava feita), nada de "pulada"
    montar(store, "/financas");
    ate(postItNaTela);
    avancar(20_000);
    fireEvent.click(screen.getByTestId("missao-doses-pular"));
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 1 de 3 feito ✅");
    expect(lerMissao()?.pulados).toBeUndefined();
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
  });

  it("braço B também: o Montar da 1ª dose, o app morre no gasto, reabre → o passo do gasto → festa que leva sozinha pra Rotina", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    missaoNova("B");
    const store = montarStore({});
    montar(store, "/financas");
    expect(screen.getByTestId("montar-financas")).toBeInTheDocument();
    fazerMontar();
    ate(postItNaTela);
    cleanup();
    montar(store, "/home");
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    ate(postItNaTela);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getAllByTestId("demo-guia-chip")[0]);
    expect(passarOlhaDeFinancas()).toHaveTextContent("Primeira dose feita!");
    expect(screen.getByTestId("missao-doses-agora-o")).toHaveTextContent("Agora a Rotina — 20 s");
    avancar(PASSAGEM_B_MS + 50);
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
  });
});

/* ------------------------------------------------------------ 16: o quiz só na 1ª dose, na área escolhida (os 2 braços) */

describe("16. regra final do dono (17/10): o quiz ('monte o seu módulo') só na 1ª DOSE, na área escolhida no funil — nos DOIS braços; as outras doses são a guiada simples", () => {
  const ligar = (braco: "A" | "B") => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    if (braco === "A") ligarUmPorDia("on");
    else { ligarUmPorDia("ab"); localStorage.setItem(CHAVE_BRACO_DIA1, "B"); }
  };
  const viewDaDose = () => eventos.filter(([n, d]) => n === "missao_doses_passo" && d.passo === "toque" && d.acao === "view").at(-1)?.[1];
  const casos: Array<[string, string, string, string | null]> = [
    ["dinheiro", "financas", "/financas", "montar-financas"],
    ["tudo", "financas", "/financas", "montar-financas"],
    ["rotina", "rotina", "/rotina", "montar-rotina"],
    ["corpo", "treino", "/treino", "escolher-treino"],
    ["metas", "desenvolvimento", "/desenvolvimento", "meta-guiada"],
    ["saude", "saude", "/saude", null],
  ];
  for (const braco of ["A", "B"] as const) {
    for (const [area, modulo, rota, setup] of casos) {
      it(`braço ${braco}, área "${area}": a 1ª dose é ${modulo}${setup ? ` com o quiz "${setup}"` : " (sem quiz)"}${setup && setup !== "montar-financas" ? " — sem o ramo dele, a dose guiada simples" : ""}`, () => {
        ligar(braco);
        localStorage.removeItem("core-montar-financas"); // o Montar poderia abrir: só a régua da missão decide
        localStorage.removeItem("core-montar-rotina"); // idem o "Rotina pronta em 3 toques"
        guardarChave(CHAVES_FUNIL_W.area, area);
        const store = montarStore({});
        montar(store, "/home");
        if (braco === "B") fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
        fireEvent.click(screen.getByTestId("missao-doses-comecar"));
        expect(lerMissao()).toMatchObject({ braco, modulos: [modulo, expect.any(String), expect.any(String)] });
        expect(screen.getByTestId("rota")).toHaveTextContent(rota);
        expect(setupDaDose(1, modulo as never)).toBe(setup);
        const view = viewDaDose()!;
        // o quiz em folha: Finanças (Montar), Rotina (Rotina pronta) e Treino (EscolherTreino); Metas é a meta guiada no post-it
        if (setup) expect(view).toMatchObject({ setup, setup_aberto: setup !== "meta-guiada" });
        else expect(view).not.toHaveProperty("setup");
        if (setup === "montar-financas") {
          expect(screen.getByTestId("montar-financas")).toBeInTheDocument();
          expect(eventos).toContainEqual(["montar_financas_view", expect.objectContaining({ origem: "missao", braco: braco === "A" ? "um_por_dia" : "dia1_cheio" })]);
        } else if (setup === "montar-rotina") {
          expect(screen.getByTestId("montar-minha-rotina")).toBeInTheDocument();
          expect(document.documentElement.getAttribute("data-montar-rotina")).toBe("missao");
          expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0); // nada da missão por cima do quiz
          expect(screen.queryByTestId("missao-doses-pular")).toBeNull();
        } else if (setup === "escolher-treino") {
          expect(screen.getByTestId("missao-escolher-treino")).toBeInTheDocument();
          expect(screen.getByText("Onde você treina?")).toBeInTheDocument();
          expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0);
        } else {
          expect(screen.queryByTestId("montar-financas")).toBeNull();
          const postIt = esperarPostIt();
          expect(within(postIt).getAllByTestId("demo-guia-chip").length).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }

  it("o pedido curto segue a POSIÇÃO da dose (o quiz é só a 1ª): Finanças em 1º 'monte em 30 s', em 2º/3º '1 gasto, 10 s'; Rotina em 1º 'monte em 3 toques', em 2º '1 hábito'; com o quiz desligado, o pedido da dose simples", async () => {
    const { copyDoLembreteDoTeste } = await vi.importActual<typeof import("@/lib/notificacoes")>("@/lib/notificacoes");
    const { fraseDeAmanha } = await import("@/components/missao-doses/PlanoDeAmanhaA");
    const { registrarChaveMontarRotina, _zerarRemotaMontarRotina } = await import("@/lib/montar-rotina");
    expect(doseCurta("financas", 1)).toEqual({ texto: "monte em 30 s", seg: 30 });
    expect(doseCurta("financas", 2)).toEqual({ texto: "1 gasto, 10 s", seg: 10 });
    expect(doseCurta("financas", 3).texto).toBe("1 gasto, 10 s");
    expect(doseCurta("rotina", 1)).toEqual({ texto: "monte em 3 toques, 30 s", seg: 30 });
    expect(doseCurta("rotina", 2)).toEqual({ texto: "1 hábito, 20 s", seg: 20 });
    expect(doseCurta("saude", 3).texto).toBe("1 copo d'água, 10 s");
    expect(copyDoLembreteDoTeste({ modulo: "financas", n: 2 }).body).toMatch(/Hoje: 💰 Finanças — 1 gasto, 10 s\.$/);
    expect(fraseDeAmanha("financas", 2)).toBe("Amanhã é 1 gasto nas suas Finanças: 10 s.");
    expect(fraseDeAmanha("financas", 1)).toBe("Amanhã a gente monta suas Finanças em 30 s.");
    registrarChaveMontarRotina({ current: { metadata: { montar_rotina: "off" } } });
    try { expect(doseCurta("rotina", 1)).toEqual({ texto: "1 hábito, 20 s", seg: 20 }); } finally { _zerarRemotaMontarRotina(); }
  });

  it("a 2ª e a 3ª dose NUNCA abrem o quiz (Finanças depois da Rotina, com o Montar ainda em aberto) — A no dia 2, B no mesmo dia", () => {
    for (const braco of ["A", "B"] as const) {
      ligar(braco);
      localStorage.removeItem("core-montar-financas");
      eventos.length = 0;
      const dia2 = braco === "A";
      localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, braco), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "Beber água ao acordar" } }, ...(dia2 ? { convites: { "2026-10-04": "foi" }, lembrete: "12h" } : {}) }));
      vi.setSystemTime(dia2 ? new Date(2026, 9, 4, 10, 0) : new Date(2026, 9, 3, 15, 30));
      const store = montarStore({});
      montar(store, "/financas");
      const postIt = esperarPostIt();
      expect(screen.queryByTestId("montar-financas"), braco).toBeNull();
      expect(postIt, braco).toHaveTextContent("Já gastou com alguma coisa hoje?");
      expect(viewDaDose(), braco).not.toHaveProperty("setup");
      fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
      passarOlhaDeFinancas(); // o MEU MÊS de sempre (sem renda, sem número de "pode gastar")
      expect(eventos.some(([n, d]) => n === "missao_doses_passo" && d.alvo === "meu_mes"), braco).toBe(true);
      cleanup();
      localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
      vi.setSystemTime(new Date(2026, 9, 3, 15, 10));
    }
  });

  it("abrir um módulo por conta própria nunca abre o quiz (A, área Rotina: entrar em Finanças no dia 1 é uso livre)", () => {
    ligar("A");
    localStorage.removeItem("core-montar-financas");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, "A"), boasVindas: true }));
    montar(montarStore({}), "/financas");
    avancar(4000);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("o ponto de encaixe do quiz de outro ramo (Rotina pronta em 3 toques): abre por cima, o que ele grava NÃO é a dose; 'pronto' → 'Sua rotina está pronta. Marca o primeiro quando fizer.' → marcar o 1º = a dose; 'pular' → a dose guiada simples", () => {
    const MontarRotinaFalsa = ({ origem, onPronto, onPular }: { origem: "missao"; onPronto: (r?: unknown) => void; onPular: () => void }) => {
      const { set } = useUserData();
      useEffect(() => { document.documentElement.setAttribute("data-montar-rotina", origem); return () => document.documentElement.removeAttribute("data-montar-rotina"); }, [origem]);
      return (
        <div data-testid="montar-rotina-falsa" data-origem={origem}>
          <button type="button" onClick={() => { set("rotina-habits", ["Beber água ao acordar", "Ler 10 páginas"]); onPronto({ itens: 2 }); }}>Rotina pronta</button>
          <button type="button" onClick={onPular}>Pular quiz</button>
        </div>
      );
    };
    const deVerdade = SETUPS_ENCAIXADOS["montar-rotina"];
    SETUPS_ENCAIXADOS["montar-rotina"] = { Componente: MontarRotinaFalsa, deveMostrar: () => true, atributo: "data-montar-rotina", depoisDoPronto: "Sua rotina está pronta. Marca o primeiro quando fizer." };
    try {
      for (const braco of ["A", "B"] as const) {
        ligar(braco);
        eventos.length = 0;
        localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, braco), boasVindas: true }));
        const store = montarStore({});
        montar(store, "/rotina");
        expect(screen.getByTestId("montar-rotina-falsa")).toHaveAttribute("data-origem", "missao");
        avancar(1500);
        expect(screen.queryAllByTestId("demo-guia-postit"), braco).toHaveLength(0); // nada da missão por cima do quiz
        fireEvent.click(screen.getByText("Rotina pronta"));
        expect(store.dados["rotina-habits"]).toEqual(["Beber água ao acordar", "Ler 10 páginas"]);
        expect(screen.queryByTestId("missao-doses-festa"), braco).toBeNull(); // criar os hábitos NÃO é a dose
        const postIt = esperarPostIt();
        expect(postIt).toHaveTextContent("Sua rotina está pronta. Marca o primeiro quando fizer.");
        expect(within(postIt).queryAllByTestId("demo-guia-chip")).toHaveLength(0);
        expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "setup", setup: "montar-rotina", acao: "feito" })]);
        fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${DIAS_ROTINA[(new Date().getDay() + 6) % 7]}`));
        for (let i = 0; i < 20 && !screen.queryByTestId("missao-doses-festa"); i++) avancar(500); // o B ainda olha a linha da semana
        if (!screen.queryByTestId("missao-doses-festa")) fireEvent.click(screen.getByTestId("missao-doses-entendi"));
        expect(screen.getByTestId("missao-doses-festa"), braco).toBeInTheDocument();
        expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(braco === "A" ? "“Beber água ao acordar” já está na sua Rotina, com o quadradinho de hoje marcado." : "Beber água ao acordar já está na sua Rotina.");
        cleanup();
        // pular o quiz: a dose guiada simples (criar o 1º hábito → marcar)
        localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, braco), boasVindas: true }));
        montar(montarStore({}), "/rotina");
        fireEvent.click(screen.getByText("Pular quiz"));
        expect(esperarPostIt()).toHaveTextContent("Qual hábito você quer começar hoje?");
        cleanup();
        localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
      }
    } finally {
      SETUPS_ENCAIXADOS["montar-rotina"] = deVerdade;
    }
  });
});

/* ------------------------------------------------------------ 17: "Conhecer mais do <módulo>" e a passagem do B */

describe("17. a comemoração: 'Conhecer mais do <módulo> (1 min)' quieto (ponto de encaixe) e, no B, a passagem sozinha pro próximo módulo", () => {
  const abrirDeVerdade = CONHECER_MAIS.abrir;
  afterEach(() => { CONHECER_MAIS.abrir = abrirDeVerdade; });

  it("sem o tour do outro ramo encaixado, nada de link; encaixado: o link quieto fecha a comemoração AQUI no módulo e abre o tour do módulo", () => {
    CONHECER_MAIS.abrir = null; // como era antes do merge do ramo da introdução
    ligarUmPorDia("on");
    missaoA({});
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    expect(screen.queryByTestId("missao-doses-conhecer-mais")).toBeNull();
    cleanup();
    const abrir = vi.fn();
    CONHECER_MAIS.abrir = abrir;
    missaoA({});
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    const link = screen.getByTestId("missao-doses-conhecer-mais");
    expect(link).toHaveTextContent("Conhecer mais das Finanças (1 min)");
    expect(abrir).not.toHaveBeenCalled(); // nunca sozinho
    fireEvent.click(link);
    expect(abrir).toHaveBeenCalledWith("financas");
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas"); // fica no módulo
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais", expect.objectContaining({ dia: 1, modulo: "financas" })]);
    expect(lerMissao()?.feitos[1]).toBeDefined(); // a dose continua feita
  });

  it("B: o link quieto também na passagem — tocar fecha a festa, PARA a passagem (a Rotina não abre sozinha) e abre o passeio do módulo", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    const abrir = vi.fn();
    CONHECER_MAIS.abrir = abrir;
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "B"), boasVindas: true }));
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    expect(screen.getByTestId("missao-doses-proxima-dose")).toHaveTextContent("Agora a Rotina — 20 s");
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(abrir).toHaveBeenCalledWith("financas");
    avancar(PASSAGEM_B_MS + 500);
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    expect(lerMissao()?.feitos[1]).toBeDefined();
  });

  it("B: 'Agora não' na festa PARA a passagem (a Rotina não abre sozinha)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "B"), boasVindas: true }));
    montar(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    fireEvent.click(screen.getByTestId("missao-doses-agora-nao"));
    avancar(PASSAGEM_B_MS + 500);
    expect(screen.getByTestId("rota")).not.toHaveTextContent("/rotina");
    expect(eventos.map(([n]) => n)).not.toContain("missao_bora_proxima");
  });
});

/* ------------------------------------------------------------ 18: o 1º gasto à prova de toque (B8, D4, toque duplo, teclado) */

describe("18. o 1º gasto à prova de toque (relatório 11): a aba ao lado não troca, o post-it cola embaixo da faixa, o toque duplo grava 1", () => {
  const dose = () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    const postIt = esperarPostIt();
    return { store, postIt };
  };

  it("B8: no meio do passo, o toque na aba DASHBOARD não troca de aba — o post-it fica (e avisa), o evento conta, e o chip grava depois", () => {
    const { store } = dose();
    eventos.length = 0;
    fireEvent.click(screen.getByText("DASHBOARD"));
    expect(screen.getByText("DASHBOARD")).toHaveAttribute("data-active", "false"); // continua no MEU FINANCEIRO
    expect(screen.getByPlaceholderText("Novo gasto")).toBeInTheDocument();
    const postIt = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postIt).toHaveTextContent("Primeiro o gasto — depois é só explorar");
    expect(eventos).toContainEqual(["missao_doses_aba", expect.objectContaining({ de: "financeiro", para: "dashboard", bloqueada: true })]);
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    avancar(2700); // o aviso some sozinho
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).not.toHaveTextContent("Primeiro o gasto");
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getAllByTestId("demo-guia-chip")[1]);
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    expect(passarOlhaDeFinancas()).toHaveTextContent("Dia 1 de 3 feito ✅");
    // fora do passo (a festa na tela), as abas voltam a trocar normalmente
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
  });

  it("toque DUPLO no chip (ou o dedo que treme) grava 1 gasto só e 1 dose só", () => {
    const { store, postIt } = dose();
    const cafe = within(postIt).getAllByTestId("demo-guia-chip")[0];
    fireEvent.click(cafe);
    fireEvent.click(cafe);
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    passarOlhaDeFinancas();
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(store.dados["finance-expenses"]).toHaveLength(1);
  });

  it("D4/B6: ela rolou e o alvo saiu da tela — o anel recolhe e o post-it COLA embaixo da faixa (só a pergunta e os chips), e o chip dali grava em 1 toque", () => {
    const { store } = dose();
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    // a rolagem pra cima: tudo (menos o cabeçalho fixo) vai pra baixo da área visível
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      return (this.matches?.("header.sticky, .demo-tour-nav")
        ? { top: 0, left: 0, width: 390, height: 56, bottom: 56, right: 390, x: 0, y: 0, toJSON: () => ({}) }
        : { top: 2400, left: 10, width: 300, height: 48, bottom: 2448, right: 310, x: 10, y: 2400, toJSON: () => ({}) }) as DOMRect;
    });
    act(() => { window.dispatchEvent(new Event("scroll")); });
    avancar(400);
    const doca = screen.getByTestId("missao-doses-postit-doca");
    expect(within(doca).getByTestId("demo-guia-postit")).toHaveTextContent("Já gastou com alguma coisa hoje?");
    expect(within(doca).queryByText(/Ainda não gastei/)).toBeNull(); // colado: só a pergunta e os chips
    expect(screen.queryByTestId("missao-doses-anel")).toBeNull(); // o anel recolhido não desenha (nem o escuro)
    fireEvent.click(within(doca).getAllByTestId("demo-guia-chip")[2]);
    expect((store.dados["finance-expenses"] as Array<{ description: string }>)[0]).toMatchObject({ description: "Almoço" });
    expect(eventos).toContainEqual(["missao_doses_chip", expect.objectContaining({ onde: "postit_doca", nome: "Almoço" })]);
  });

  it("o teclado no passo (✎ outro → o campo do módulo) é medido: aberto e fechado", () => {
    dose();
    eventos.length = 0;
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getByTestId("demo-guia-escrever"));
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Novo gasto"));
    act(() => { (document.activeElement as HTMLElement).dispatchEvent(new FocusEvent("focusin", { bubbles: true })); });
    expect(eventos).toContainEqual(["missao_doses_teclado", expect.objectContaining({ aberto: true })]);
    act(() => { (document.activeElement as HTMLElement).blur(); document.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    avancar(200);
    expect(eventos).toContainEqual(["missao_doses_teclado", expect.objectContaining({ aberto: false })]);
  });
});
