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
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import { Anel, PostItDaMissao, TOLERANCIA_ANCORA_MS } from "@/components/demo-guiada/pecas";
import {
  CHAVE_ESTADO_MISSAO_DOSES, EVENTO_MISSAO_DOSES, conviteDoDiaDevido, doseDeHojeDevida, doseLiberadaHoje, ehUmPorDia, eventoDaMissao, iniciarMissao, lerMissao, ORDEM_MODULOS, missaoEmAndamento, modulosPadrao, precisaPlanoA,
  missaoDoDiaEmCena, moduloDaMissaoHoje, definirDonoDaMissao, donoDaConta, marcarDoseNaTela, doseNaTela, CHAVE_MISSAO_NA_CONTA,
  retomadaDoGasto, setupDaDose, idDaMissao, doseCurta, dicaDoDiaDevida, MAX_VISTAS_SEM_DECISAO, unidadeJunta, emSegundos,
} from "@/lib/missao-doses";
import { CHAVE_LEMBRETE_TESTE, CHAVE_TRIAL_CARTAO, DIAS_DE_TESTE_PADRAO, diasDoTesteDaLoja } from "@/lib/teste-da-loja";
import { marcarTrialCartaoAte } from "@/lib/teste-gratis";
import { fraseDoAcesso } from "@/components/missao-doses/BoasVindasDoses";
import { CONHECER_MAIS, SETUPS_ENCAIXADOS } from "@/components/missao-doses/encaixes";
import { ConhecerMaisHost } from "@/components/intro-modulo/ConhecerMais";
import { EVENTO_FIM_TOUR } from "@/lib/conhecer-mais";
import { CHAVE_FORCA_INTRO, CHAVE_INTRO_FEITAS_CONTA, CHAVE_INTRO_VISTAS_CONTA, _zerarIntroRemota, chaveIntroVista, porQueNaoMostrar, registrarIntroRemota } from "@/lib/intro-modulo";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { FALTA_A_HOME, PASSAGEM_B_MS, rotuloConhecerMais, semFaixaNaDose, tituloDoModuloPronto } from "@/components/missao-doses/PassoDoDia";
import { tituloDoDiaFeito } from "@/components/missao-doses/PlanoDeAmanhaA";
import { alturaDaFaixa } from "@/hooks/use-folha-acima-do-teclado";
import fsDaFaixa from "node:fs";
import pathDaFaixa from "node:path";
import { _novaAberturaDoTour, marcarTourFeito, varianteDoTour } from "@/lib/tour-home";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { TourDaHome, useTourDaHome } from "@/components/home/TourDaHome";
import { escolherAdesivoDaDose } from "@/components/missao-doses/adesivo-da-dose";
import {
  CHAVE_BRACO_DIA1, CHAVE_UM_POR_DIA_APARELHO, _zerarUmPorDiaRemoto, bracoDia1, idDoAparelho, lerUmPorDiaRemoto, modoDia1Cheio, modoUmPorDia, registrarUmPorDiaRemoto, sortearBraco, tourHomeQuando, lerTourQuandoRemoto,
} from "@/lib/dia1-cheio";
import { CHAVES_FUNIL_W, guardarChave, lerChave, limparProgresso } from "@/pages/funis/w/retomada";
import { conteudoDoLembrete, porDiaExato, praHojeDasFinancas } from "@/lib/lembrete-dia2";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CHAVE_DIAS_ANOTADOS, contaComoAnotacao, registrarDia, temConteudo } from "@/lib/sequencia";
import { CHAVE_SEM_GASTO } from "@/lib/acao-do-dia";
import { EV_PRIMEIRO_GASTO } from "@/lib/montar-financas";
import { localDayKey } from "@/lib/utils";
import { instalarTecladoIphone, type TecladoIphone } from "./helpers/teclado-iphone";

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
/** Finanças com as DUAS abas que a dose usa, como o Dashboard de SEMPRE (painel limpo desligado na 1.0.16): MEU
 *  FINANCEIRO (o "+ Novo gasto" e, mais embaixo, o MEU MÊS com o "↓ Saiu" = contas fixas + gastos) e DASHBOARD (o card
 *  "QUANTO POSSO GASTAR HOJE", com o número pela mesma conta do card de verdade, arredondado igual — sem MEU MÊS). */
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
        <>
          {!semBotao && <div key={`linha-${versao}`}><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div>}
          <section data-missao="meu-mes"><div><h3>MEU MÊS</h3></div><div><span>↑ Entrou R$ {soma("finance-incomes").toLocaleString("pt-BR")}</span><span data-testid="meu-mes-saiu">↓ Saiu R$ {saiu.toLocaleString("pt-BR")}</span></div></section>
        </>
      ) : (
        <div data-spotlight="pode-gastar"><h3>QUANTO POSSO GASTAR HOJE</h3><p data-testid="pode-gastar-valor">R$ {porDia === null ? 0 : Math.round(porDia)}</p></div>
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
/** Como `montarComHome`, com o host DE VERDADE do "Conhecer mais" nos 3 módulos (é a IntroDoModulo que monta ele no app) e
 *  um "voltar" que sai do módulo no meio do passeio. */
const SairDoModulo = () => { const ir = useNavigate(); return <button type="button" onClick={() => ir("/rotina")}>sair do módulo</button>; };
const montarComPasseio = (store: Store, rota: string) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Provedor store={store}>
        <MissaoDosesNaWeb />
        <Routes>
          <Route path="/home" element={<HomeReal />} />
          <Route path="/financas" element={<><FinancasFalsa /><SairDoModulo /><ConhecerMaisHost moduleId="financas" /></>} />
          <Route path="/rotina" element={<><RotinaFalsa /><ConhecerMaisHost moduleId="rotina" /></>} />
          <Route path="/saude" element={<><SaudeFalsa /><ConhecerMaisHost moduleId="saude" /></>} />
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** O relógio em passos de 50 ms: o React desenha entre um timer e outro (como no aparelho) — pra medir tempo de verdade. */
const andar = (ms: number) => { for (let t = 0; t < ms; t += 50) avancar(Math.min(50, ms - t)); };
/** 1.0.17 (dono 20/10): entre a tela do número e o tutorial do gasto, a PONTE — "Ir pro app" segue. */
const passarDaPonte = () => fireEvent.click(screen.getByTestId("montar-ponte-ir"));
/** 1.0.17 (mockup d1): o tour da Home começa num popup — "Mostrar" leva aos balões. */
const mostrarTour = () => fireEvent.click(screen.getByTestId("tour-popup-mostrar"));
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
/** `quando` = a chave remota `tour_home_quando` (1.0.17): ausente = "dia1" (o padrão) */
const ligarUmPorDia = (modo: "on" | "ab" | "off", quando?: "dia1" | "dia2") => registrarUmPorDiaRemoto(offerings({ missao_1_por_dia: modo, ...(quando ? { tour_home_quando: quando } : {}) }));
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
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).toHaveTextContent("2 de 2");
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

describe("1.0.17 (item 7) — a festa da dose 1 comemora o MÓDULO; o 'Dia 1 feito 💛' fecha o dia no plano de amanhã", () => {
  it("o título da festa da dose 1 por módulo (concorda com o nome) e o do plano (sem ponto final)", () => {
    expect(tituloDoModuloPronto("financas")).toBe("Finanças pronta 💛");
    expect(tituloDoModuloPronto("rotina")).toBe("Rotina pronta 💛");
    expect(tituloDoModuloPronto("saude")).toBe("Saúde pronta 💛");
    expect(tituloDoModuloPronto("treino")).toBe("Treino pronto 💛");
    expect(tituloDoModuloPronto("estudos")).toBe("Estudos prontos 💛");
    expect(tituloDoModuloPronto("desenvolvimento")).toBe("Metas prontas 💛");
    for (const m of ORDEM_MODULOS) expect(tituloDoModuloPronto(m)).toMatch(/^\S.* pront[ao]s? 💛$/);
    expect(FALTA_A_HOME).toBe("Falta só conhecer sua Home");
    const missao = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-16", undefined, "A"), feitos: { 1: { dia: "2026-10-16", rotulo: "x" } } };
    expect(tituloDoDiaFeito(missao, "2026-10-16")).toBe("Dia 1 feito 💛");
  });
  it("PULOU o tour no popup (ou não recebe tour): a festa da dose 1 não fala da Home ('Continuar') e o plano de amanhã aparece com 'Dia 1 feito 💛' + 'Amanhã: Rotina' — ninguém fica sem o fechamento", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas");
    guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
    marcarTourFeito("pulou:2026-10-16T12:00:00.000Z"); // o "Pular" do popup grava a mesma marca do tour feito
    const store = montarStore({});
    montar(store, "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByTestId("montar-ponte-nao-gastei")); // "Ainda não gastei" na ponte → o olhar → a festa
    const festa = passarOlhaDeFinancas();
    expect(screen.getByTestId("missao-doses-festa-titulo")).toHaveTextContent(/^Finanças pronta 💛$/);
    expect(festa).not.toHaveTextContent(/Dia 1 feito|Falta só conhecer/);
    expect(screen.queryByTestId("missao-doses-amanha")).toBeNull();
    expect(screen.getByTestId("missao-doses-continuar")).toHaveTextContent(/^Continuar$/);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    avancar(300); avancar(400); avancar(600);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("tour-popup")).toBeNull();
    avancar(3000);
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); }); // a Home relê a missão (como no bloco 4)
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a-titulo")).toHaveTextContent(/^Dia 1 feito 💛$/);
    expect(screen.getByTestId("plano-amanha-a-amanha")).toHaveTextContent(/^Amanhã: Rotina$/);
    expect(screen.getByTestId("plano-amanha-a")).toHaveTextContent("Que horas te lembro?");
  });
});

describe("4. braço A — uma dose por dia, conta VAZIA, do dia 1 ao dia 3", () => {
  it("dia 1 (conta VAZIA, área dinheiro): boas-vindas de 1 tela → Montar Finanças (a dose) → o 1º gasto de carona (opcional) → festa PEQUENA com o adesivo REAL ('Primeira Despesa') e o de amanhã trancado → Home → (tour curto) → 'Plano de amanhã' → a Rotina não abre a dose 2 hoje", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas"); // a dose de Finanças de verdade
    guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
    // veio do paywall: comprou o anual com 3 dias grátis (o pedido do aviso do teste guarda o início e o fim)
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, JSON.stringify({ fimMs: Date.now() + 3 * 864e5, precoAno: "R$ 97,90", inicioMs: Date.now() }));
    const store = montarStore({});
    montar(store, "/home");
    const boas = screen.getByTestId("missao-doses-boas-vindas");
    // 1.0.17 (dono 19/10: "minimalista, calmo"): uma ideia por tela — sem segundos, sem parágrafo, sem "16 módulos"
    expect(screen.getByTestId("missao-doses-titulo")).toHaveTextContent(/^Tá dentro/);
    expect(screen.getByTestId("missao-doses-subtitulo")).toHaveTextContent(/^Seus 3 dias grátis começaram$/); // dono 19/10: a linha do teste volta (1.0.17: sem ponto final)
    // 1.0.17 (dono 20/10, mockup a1): o Tá dentro diz que começa um TUTORIAL e mostra o plano (o que cada dia entrega)
    expect(screen.getByTestId("missao-doses-tutorial")).toHaveTextContent("Pra você tirar o melhor do CORE, preparamos um tutorial especial pra você.");
    expect(boas).toHaveTextContent("Seu plano de 3 dias");
    expect(boas).not.toHaveTextContent(/\d+\s?s\b|16 módulos/);
    expect(screen.getByTestId("missao-doses-linha-1")).toHaveTextContent(/^💰\s*Finanças\s*Quanto dá pra gastar por dia\s*Hoje$/);
    expect(screen.getByTestId("missao-doses-linha-2")).toHaveTextContent(/^📅\s*Rotina\s*Seu primeiro hábito\s*Amanhã$/);
    expect(screen.getByTestId("missao-doses-linha-3")).toHaveTextContent(/^❤️\s*Saúde\s*Sua meta de água\s*\S+$/);
    expect(screen.queryByTestId("missao-doses-boas-vindas-nota")).toBeNull();
    expect(screen.getByTestId("missao-doses-comecar")).toHaveTextContent(/^Começar meu tutorial$/);
    expect(screen.getByTestId("missao-doses-explorar")).toHaveTextContent("Prefiro explorar sozinho");
    expect(screen.queryByTestId("missao-doses-trocar")).toBeNull(); // sem "Trocar" (6–14% mexiam)
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
    // a tela do número é SÓ o número (revisão do dono, 17/10): o "Já gastou…", os chips e o "Ainda não gastei" são o tutorial
    expect(screen.getByTestId("montar-por-dia")).toBeInTheDocument();
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(mf().queryByText(/Já gastou|Ainda não gastei|Café/)).toBeNull();
    const doMontar = Number(screen.getByTestId("montar-por-dia").getAttribute("data-valor"));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    expect(Array.isArray(store.dados["finance-incomes"])).toBe(true);
    // a dose JÁ conta no "Continuar" do Montar (fechar o app no tutorial não desfaz o Montar)
    expect(lerMissao()?.feitos[1]?.rotulo).toBe(`Pode gastar R$ ${doMontar} por dia`);
    // 1.0.17: a ponte ("Agora vamos anotar seu primeiro gasto") → "Ir pro app"
    expect(screen.getByTestId("montar-ponte")).toHaveTextContent("Agora vamos anotar seu primeiro gasto");
    passarDaPonte();
    // o TUTORIAL no formulário de verdade: o post-it com os 3 prontos, "escrever o meu" e "Ainda não gastei" (o anel só
    // procura o "+ Novo gasto" com o Montar fora da tela)
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    expect(within(postIt).getByTestId("demo-guia-outro")).toHaveTextContent("Outro");
    expect(within(postIt).getByTestId("missao-doses-ainda-nao")).toHaveTextContent(/^Ainda não$/);
    expect(screen.getByTestId("missao-doses-anel")).toBeInTheDocument();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]); // ☕ Café
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Café", value: 12 })]);
    // o "olha": UM balão no MEU MÊS, na aba MEU FINANCEIRO (nada de ir e voltar pelo Dashboard)
    andar(1300);
    expect(screen.getByTestId("missao-doses-olhar")).toHaveAttribute("data-olha", "financas");
    expect(screen.getByText("MEU FINANCEIRO")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Seu mês");
    expect(screen.queryByTestId("missao-doses-olhar-tempo")).toBeNull(); // sem "Olha · 1 de 2"
    expect(screen.queryByTestId("missao-doses-pular-passo")).toBeNull(); // curto: só o "Entendi"
    // o "Saiu" do mês de ANTES (as contas fixas do Montar) → + R$ 12 (a batida do 1.0.14)
    const saiuAgora = Number((screen.getByTestId("meu-mes-saiu").textContent ?? "").replace(/\D/g, ""));
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent("Saiu no mês");
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent(`R$ ${(saiuAgora - 12).toLocaleString("pt-BR")}`);
    // (17/10, opção 3) "Sobra pra hoje ~~R$ X~~ R$ X − 12": a linha "Sobram R$ X pra hoje" do card QUANTO POSSO GASTAR HOJE
    // (29 dias no mês: R$ 12 não mexem no número grande arredondado — mexem na sobra de HOJE)
    const porDiaDoCard = Math.round(porDiaExato(store.get)!);
    expect(porDiaDoCard).toBe(doMontar);
    expect(praHojeDasFinancas(store.get)).toEqual({ doDia: doMontar, sobra: doMontar - 12, gasto: 12 });
    const pode = screen.getByTestId("missao-doses-olhar-pode");
    expect(pode).toHaveTextContent("Sobra hoje");
    expect(pode).not.toHaveTextContent("Dá pra gastar hoje");
    expect(pode).toHaveAttribute("data-sobra");
    expect(pode).toHaveAttribute("data-valor", String(doMontar - 12));
    expect(pode.querySelector("s")).toHaveTextContent(`R$ ${doMontar}`);
    const olhar = eventos.find(([nome, d]) => nome === "missao_doses_passo" && d.passo === "olhar" && d.acao === "view")?.[1];
    expect(olhar).toMatchObject({ alvo: "meu_mes", contou: true, caiu: true });
    expect(olhar).not.toHaveProperty("antes"); // (17/10) nunca valor em reais em evento
    // ... e a festa entra SOZINHA (o balão segura 2,4 s desde que o anel apareceu)
    andar(1500);
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    const festa = passarOlhaDeFinancas();
    expect(festa).toHaveAttribute("data-braco", "A");
    expect(festa).not.toHaveAttribute("data-tela-cheia");
    // 1.0.17 (item 7, dono 20/10): a dose 1 comemora o MÓDULO — "Finanças pronta 💛" + UMA linha do que ficou + "Falta só
    // conhecer sua Home" (o tour vem logo depois) + 1 botão que leva pra Home; o "Dia 1 feito 💛" mora no plano de amanhã
    expect(screen.getByTestId("missao-doses-festa-titulo")).toHaveTextContent(/^Finanças pronta 💛$/);
    expect(festa).not.toHaveTextContent(/Dia 1 feito/);
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(/^R\$ [\d.]+ por dia, já nas suas Finanças\.$/);
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    // o adesivo é o REAL que o 1º registro abriu (só o desenho, sem legenda) — e fica VISTO
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "first-expense");
    expect(screen.queryByTestId("missao-doses-adesivo-legenda")).toBeNull();
    expect((store.dados["conquistas-vistas"] as { adesivos: string[] }).adesivos).toEqual(expect.arrayContaining(["first-expense", "first-income"]));
    expect(screen.queryByTestId("missao-doses-amanha")).toBeNull();
    expect(screen.getByTestId("missao-doses-falta-home")).toHaveTextContent(/^Falta só conhecer sua Home$/);
    expect(screen.queryByTestId("missao-doses-adesivo-amanha")).toBeNull();
    expect(festa).not.toHaveTextContent(/\d+\s?s\b|segundos|\(1 min\)/);
    expect(screen.getByTestId("missao-doses-continuar")).toHaveTextContent(/^Conhecer minha Home$/);
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(screen.queryByTestId("missao-doses-bora-proxima")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "montar_financas", acao: "feito", variante: "A", dia_cal: 1 })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip" })]);
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "first-expense", tipo: "registro", dia: 1 })]);
    expect(eventos.filter(([n, d]) => n === "adesivo_desbloqueado" && String(d.origem ?? "").startsWith("missao"))).toEqual([]);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(eventos).toContainEqual(["montar_financas_view", expect.objectContaining({ origem: "missao" })]);
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    // 1.0.17 (dono: "o corte Finanças → Home é brusco"): a folha DESCE, o véu cobre, a rota troca por baixo e abre devagar —
    // nunca no mesmo tique do toque
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    expect(screen.getByTestId("missao-doses-festa")).toHaveAttribute("data-saindo");
    avancar(300);
    expect(screen.getByTestId("missao-doses-veu")).toHaveAttribute("data-fase", "cobre");
    avancar(400);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    avancar(600);
    expect(screen.queryByTestId("missao-doses-veu")).toBeNull();
    expect(document.documentElement.hasAttribute("data-missao-dose")).toBe(false);
    const m = lerMissao()!;
    expect(m.adesivosMostrados).toEqual(["first-expense"]);
    expect(doseLiberadaHoje(m)).toBe(false);
    expect(moduloDaMissaoHoje()).toBe("financas"); // a dose de hoje foi Finanças
    // 1.0.17 (tour_home_quando "dia1", o padrão): a Home é dela — o tour curto pode vir (depois do respiro, bloco 9),
    // e a folha do plano ESPERA ele (uma camada por vez)
    expect(missaoEmAndamento(m)).toBe(false);
    expect(missaoDoDiaEmCena(m)).toBe(true); // os popups de adesivo esperam o plano de amanhã
    expect(varianteDoTour(m)).toBe("curto");
    expect(precisaPlanoA(m)).toBe(true);
    avancar(3000);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    marcarTourFeito(); // ... o tour curto acabou
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MISSAO_DOSES)); });
    avancar(2000);
    // 1.0.17 (item 7): o fechamento do dia mora aqui — "Dia 1 feito 💛" + "Amanhã: Rotina"
    expect(screen.getByTestId("plano-amanha-a-titulo")).toHaveTextContent(/^Dia 1 feito 💛$/);
    expect(screen.getByTestId("plano-amanha-a-amanha")).toHaveTextContent(/^Amanhã: Rotina$/);
    expect(screen.getByTestId("plano-amanha-a")).toHaveTextContent("Que horas te lembro?");
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
    /* 17/10 (regra do dono: tutorial é UMA vez por módulo — ele viu Finanças repetir no Simulador): a dose feita É o
     * tutorial de Finanças. Ficou gravada como intro feita no aparelho E na conta; a introdução do módulo não monta
     * nada ao entrar de novo, nem depois de fechar/reabrir o app (acima), nem com a missão sumida do aparelho (reinstalou). */
    expect(localStorage.getItem(chaveIntroVista("financas"))).toMatch(/^dose@/);
    expect(store.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["financas"]);
    expect(store.dados[CHAVE_INTRO_FEITAS_CONTA]).toBeUndefined(); // "feita" é só da intro por curiosidade (a missão vira continuação por ela)
    localStorage.setItem(CHAVE_FORCA_INTRO, "on");
    expect(porQueNaoMostrar("financas", store.get)).not.toBeNull();
    const intro = render(<Provedor store={store}><IntroDoModulo moduleId="financas" /></Provedor>);
    avancar(1000);
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    intro.unmount();
    const missaoGuardada = localStorage.getItem(CHAVE_ESTADO_MISSAO_DOSES)!;
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES); // reinstalou: sem a missão no aparelho
    expect(porQueNaoMostrar("financas", store.get)).toBe("ja_vista"); // a conta lembra
    localStorage.removeItem(chaveIntroVista("financas")); // e sem a marca do aparelho também
    expect(porQueNaoMostrar("financas", store.get)).toBe("ja_vista");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, missaoGuardada);
    localStorage.removeItem(CHAVE_FORCA_INTRO);
    // ela entra sozinha na Rotina no MESMO dia: uso livre, nada de dose 2
    cleanup();
    montar(store, "/rotina");
    avancar(4000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("demo-guia-postit")).toBeNull();
  });

  it("depois do Montar (dia 1, SEM a faixa desde 20/10): nenhum 'Pular' de faixa nem aos 20 s — a saída é o 'Ainda não' do post-it, que fecha a dose com a festa (não conta como pulada); fechar o app no post-it do gasto não desfaz a dose", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const fazerMontar = () => {
      const mf = () => within(screen.getByTestId("montar-financas"));
      fireEvent.click(mf().getByRole("button", { name: "Até R$ 2 mil" }));
      fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
      fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
      fireEvent.click(mf().getByRole("button", { name: "Pular" })); // pula só a pergunta do cartão: o Montar fecha igual
      avancar(2500);
      fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
      passarDaPonte();
    };
    // 1) sem faixa no dia 1: nem a faixa nem o "Pular" dela, nem depois de 20 s — o "Ainda não" do post-it é a saída
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    const postIt1 = esperarPostIt();
    avancar(20_000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("missao-doses-pular")).toBeNull();
    fireEvent.click(within(postIt1).getByTestId("missao-doses-ainda-nao"));
    const festa = passarOlhaDeFinancas();
    expect(festa).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.pulados).toBeUndefined();
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "ainda_nao" })]);
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
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
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
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
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
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
    expect(convite).not.toHaveTextContent("Ontem"); // 1.0.17: sem a linha de ontem — só "Dia 2: Rotina" e um botão
    expect(screen.queryByTestId("missao-doses-convite-texto")).toBeNull(); // os 3 seguidos é só no dia 3
    expect(screen.getByTestId("missao-doses-convite-ir")).toHaveTextContent(/^Começar$/);
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
    expect(festa).toHaveTextContent("Dia 2 feito.");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(/^“Beber água ao acordar” está na sua Rotina\.$/);
    expect(screen.getByTestId("missao-doses-sequencia")).toHaveTextContent("🔥 2 dias seguidos");
    // o adesivo da sequência: o REAL do registro (Conquistas 2, merge 17/10) — "sequencia-2" = "Voltei", com a arte dele
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("data-adesivo", "sequencia-2");
    expect(within(screen.getByTestId("missao-doses-adesivo")).getByTestId("missao-doses-adesivo-arte")).toHaveAttribute("data-arte", "registro");
    expect(screen.getByTestId("missao-doses-adesivo")).toHaveAttribute("aria-label", "Adesivo: Voltei"); // sem legenda na tela
    expect(store.dados["conquistas-vistas"]).toMatchObject({ adesivos: expect.arrayContaining(["sequencia-2"]), marcos: [2] });
    expect(screen.getByTestId("missao-doses-amanha")).toHaveTextContent(/^Amanhã: Saúde\.$/);
    expect(screen.getByTestId("missao-doses-hora-12h")).toHaveAttribute("aria-checked", "true"); // a combinada; dá pra trocar
    expect(screen.queryByTestId("missao-doses-amanha-agora")).toBeNull();
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "sequencia-2", tipo: "registro", dia: 2, sequencia: 2 })]);
    expect(screen.getByTestId("missao-doses-combinado")).toHaveTextContent(/^Combinado$/);
    fireEvent.click(screen.getByTestId("missao-doses-combinado"));
    avancar(300); avancar(400); // 1.0.17: a folha desce, o véu cobre e a rota troca por baixo
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(lerMissao()?.scoreAntes?.[2]).toEqual(expect.any(Number)); // o score de ANTES da dose (a dica conta "de X pra Y")
    for (let k = 0; k < 6; k++) avancar(500); // o véu abre e a Home fica quieta (o véu também é camada) antes da dica
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
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 3: Saúde");
    expect(screen.getByTestId("missao-doses-convite-texto")).toHaveTextContent(/^Falta um passo pros 3 dias seguidos\.$/);
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
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(/^É assim que um hábito pega\.$/);
    expect(festa3).not.toHaveTextContent(/R\$ ?97|assin|plano anual|oferta|pre[cç]o/i);
    expect(store.dados["conquistas-vistas"]).toMatchObject({ marcos: [2, 3] });
    expect(eventos).toContainEqual(["missao_adesivo_mostrado", expect.objectContaining({ id: "sequencia-3", tela_cheia: true, dia: 3 })]);
    expect(screen.getByTestId("missao-doses-ver-fim")).toHaveTextContent(/^Ver meu resumo$/);
    fireEvent.click(screen.getByTestId("missao-doses-ver-fim"));
    avancar(400); // 1.0.17: a festa sai em fade antes do resumo
    expect(screen.getByTestId("construiu")).toBeInTheDocument();
  });

  it("1.0.17 (bug da 1.0.16): na dose da Rotina o chip CRIA o hábito em 1 toque — mesmo com o campo fechado; e com a dose na tela o '+ Hábito' só ABRE (nunca fecha); o '+ Outro' cria igual", () => {
    ligarUmPorDia("on");
    const store = montarStore({ [CHAVE_DIAS_ANOTADOS]: ["2026-10-03"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { convites: { "2026-10-04": "foi" } });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    const maisHabito = () => document.querySelector<HTMLElement>('[data-spotlight="add-habit"]')!;
    expect(screen.getByPlaceholderText("Nome do hábito...")).toBeInTheDocument(); // a dose abriu o campo
    fireEvent.click(maisHabito()); fireEvent.click(maisHabito()); // os toques da 1.0.16 que FECHAVAM o campo
    expect(screen.getByPlaceholderText("Nome do hábito...")).toBeInTheDocument();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[1]); // 🧘 Alongar 5 min — 1 toque
    avancar(100);
    expect(store.dados["rotina-habits"]).toEqual(["Alongar 5 min"]);
    expect(eventos).toContainEqual(["missao_doses_chip", expect.objectContaining({ nome: "Alongar 5 min", ok: true })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "criar_habito", acao: "feito" })]);
  });

  it("1.0.17: o '+ Outro' da dose da Rotina cria o hábito DELA pelo mesmo caminho (abre o campo, preenche, Adicionar)", () => {
    ligarUmPorDia("on");
    const store = montarStore({ [CHAVE_DIAS_ANOTADOS]: ["2026-10-03"] });
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { convites: { "2026-10-04": "foi" } });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(store, "/rotina");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getByTestId("demo-guia-outro"));
    fireEvent.change(within(postIt).getByTestId("demo-guia-texto"), { target: { value: "Caminhar 10 min" } });
    fireEvent.click(within(postIt).getByTestId("demo-guia-adicionar"));
    avancar(100);
    expect(store.dados["rotina-habits"]).toEqual(["Caminhar 10 min"]);
    expect(eventos).toContainEqual(["missao_doses_chip", expect.objectContaining({ nome: "outro", proprio: true, ok: true })]);
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
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 2 feito.");
    expect(screen.queryByTestId("missao-doses-adesivo")).toBeNull(); // "voltou": sem adesivo, sem legenda, sem drama
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
    // 1.0.17, tour_home_quando ausente = "dia1" (padrão): dia 1 com a dose feita já solta o tour (a Home espera o respiro)
    expect(missaoEmAndamento({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(false);
    expect(missaoEmAndamento(base, "2026-10-03")).toBe(false);
    // "dia2": o tour espera a dose de um dia seguinte — "Agora não" no convite não solta o tour antes dela
    ligarUmPorDia("on", "dia2");
    expect(missaoEmAndamento({ ...base, convites: { "2026-10-04": "depois" } }, "2026-10-04")).toBe(true);
    expect(missaoEmAndamento({ ...base, feitos: { ...base.feitos, 2: { dia: "2026-10-04", rotulo: "y" } } }, "2026-10-04")).toBe(false); // dose 2 feita: o tour pode vir
    expect(missaoEmAndamento({ ...base, explorou: true }, "2026-10-04")).toBe(false); // quem explorou: a regra de sempre
    expect(missaoEmAndamento(base, "2026-10-03")).toBe(true); // dia 1 com a dose feita: limpo, sem tour
    ligarUmPorDia("on");
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
    expect(linha).toHaveTextContent("Dose de hoje · Rotina");
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

describe("9. o tour curto do braço A (3 passos 'faz isso') — 1.0.17: QUANDO é chave remota (tour_home_quando: dia1 padrão | dia2), nunca colado na festa", () => {
  /* 1.0.17 (decisão do dono, 19/10): o tour curto fica no DIA 1, mas nunca colado na festa — festa → passagem calma → a
     Home parada ~1,5 s sem outra camada → o tour; o "Plano de amanhã" só depois dele. Com `tour_home_quando: "dia2"`, o
     dia 1 termina limpo e o tour vem num dia seguinte, depois da dose daquele dia. `depoisDaDose1` monta o dia 2 com a
     dose 2 feita (o caminho do "dia2"). */
  const depoisDaDose1 = (extra: Record<string, unknown> = {}) => {
    // (a dica do score do dia 2 já foi vista — senão ela é a camada da vez e o tour espera ela sair)
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: "2026-10-04", rotulo: "Beber água ao acordar" } }, { dicas: { 2: "2026-10-04" }, ...extra });
    vi.setSystemTime(new Date(2026, 9, 4, 15, 10));
  };

  it("dia1 (o padrão, chave ausente): a festa ainda na tela segura o tour; saiu, a Home fica QUIETA ~1,5 s e só então o tour entra; o plano espera o tour acabar; reabrir não repete nada", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on"); // sem tour_home_quando = "dia1"
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } });
    expect(tourHomeQuando()).toBe("dia1");
    const store = montarStore({});
    // a camada da festa (ou do véu da passagem) ainda na tela
    const festa = document.createElement("div"); festa.setAttribute("data-camada-guia", "missao-doses-festa"); document.body.appendChild(festa);
    montarComHome(store, "/home");
    expect(missaoEmAndamento(lerMissao())).toBe(false); // a Home é dela: o tour pode vir...
    avancar(3000);
    expect(screen.queryByTestId("tour-balao")).toBeNull(); // ...mas nunca por cima/colado na festa
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull(); // uma camada por vez: o plano espera o tour
    act(() => { festa.remove(); });
    avancar(1000);
    expect(screen.queryByTestId("tour-balao")).toBeNull(); // o respiro: a Home assenta antes
    expect(screen.queryByTestId("tour-popup")).toBeNull();
    avancar(1000);
    // 1.0.17 (mockup d1): primeiro o popup de entrada, com o número real de passos do tour curto
    expect(screen.getByTestId("tour-popup-titulo")).toHaveTextContent("Agora, sua Home em 3 toques");
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    mostrarTour();
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 1 de 3");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("O que falta hoje.");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Amanhã, 📅 Rotina aparece aqui.");
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    expect(eventos.filter(([n]) => n === "home_tour_visto")).toEqual([["home_tour_visto", { total: 3, variante: "curto", tour_quando: "dia1" }]]);
    fireEvent.click(screen.getByTestId("tour-continuar"));
    fireEvent.click(screen.getByTestId("tour-continuar")); // "Deixar como está"
    fireEvent.click(screen.getByTestId("tour-concluir"));
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    avancar(800);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull(); // nunca colado no fim do tour
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("plano-a-combinado"));
    cleanup();
    _novaAberturaDoTour();
    montarComHome(store, "/home");
    avancar(4000);
    for (const t of ["tour-balao", "tour-popup", "plano-amanha-a", "missao-doses-festa"]) expect(screen.queryByTestId(t), t).toBeNull();
    expect(eventos).toContainEqual(["home_tour_concluido", expect.objectContaining({ tour_quando: "dia1" })]);
  });

  it("dia2 (chave remota): depois da dose do dia 1 a Home NÃO abre o tour — nem reabrindo o app no mesmo dia; a folha do lembrete vem sozinha, com respiro", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on", "dia2");
    expect(tourHomeQuando()).toBe("dia2");
    expect(localStorage.getItem("core-tour-home-quando")).toBe("dia2"); // a última resposta fica no aparelho
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } });
    const store = montarStore({});
    montarComHome(store, "/home");
    expect(missaoEmAndamento(lerMissao())).toBe(true);
    avancar(800);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull(); // o respiro: nada colado na chegada à Home
    avancar(1500);
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("plano-a-combinado"));
    cleanup();
    _novaAberturaDoTour();
    montarComHome(store, "/home");
    avancar(3000);
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(eventos.filter(([n]) => n === "home_tour_visto")).toEqual([]);
  });

  it("Pendências conta que a dose de amanhã aparece ali; Ações rápidas grava um gasto DE VERDADE; Módulos: 'Deixar todos'; o 'visto' sai quando aparece de fato; 1x (aparelho e conta)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on", "dia2");
    depoisDaDose1();
    const store = montarStore({});
    montarComHome(store, "/home");
    avancar(2500); // o respiro antes do tour (RESPIRO_ANTES_DO_TOUR_MS)
    mostrarTour(); // 1.0.17: o popup de entrada
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 1 de 3");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("O que falta hoje.");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Amanhã, ❤️ Saúde aparece aqui.");
    expect(eventos.filter(([n]) => n === "home_tour_visto")).toEqual([["home_tour_visto", { total: 3, variante: "curto", tour_quando: "dia2" }]]);
    fireEvent.click(screen.getByTestId("tour-continuar"));
    expect(screen.getByTestId("tour-contador")).toHaveTextContent("Passo 2 de 3");
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Anote sem abrir o módulo.");
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
    expect(eventos).toContainEqual(["home_tour_concluido", { total: 3, variante: "curto", tour_quando: "dia2" }]);
    // a folha do plano de amanhã vem DEPOIS do tour
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
  });

  it("reinstalou (aparelho sem a marca, conta com ela): o tour não volta — e o aparelho guarda a marca", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on", "dia2");
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
    avancar(2500);
    mostrarTour();
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("Tocou, resolveu.");
  });

  it("fechou o app no meio do tour: ele volta, mas no máximo em 2 aberturas", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on", "dia2");
    depoisDaDose1();
    const store = montarStore({});
    for (const abertura of [1, 2]) {
      _novaAberturaDoTour();
      montarComHome(store, "/home");
      avancar(2500);
      mostrarTour();
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
    if (braco === "A") expect(festa).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
          expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(braco === "A" ? /^“.+” está na sua semana\.$/ : /já está/);
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
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
    expect(postIt).toHaveTextContent("“Beber água ao acordar”: o quadradinho de hoje.");
    expect(postIt).not.toHaveTextContent("Qual hábito você quer começar?");
    expect(within(postIt).queryAllByTestId("demo-guia-chip")).toHaveLength(0);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "toque", acao: "view", continuacao: true, intro_feita: true })]);
    fireEvent.click(screen.getByLabelText(`Beber água ao acordar ${hojeDaRotina()}`));
    avancar(700);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent("Dia 2 feito.");
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("“Beber água ao acordar” está na sua Rotina.");
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
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
    expect(postIt).toHaveTextContent("Qual exercício você fez hoje?");
    expect(postIt).not.toHaveTextContent("Qual treino combina com você?");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => c.textContent)).toEqual(["🦵Agachamento", "🏃Corrida", "🚶Caminhada"]);
  });

  it("sem introdução (o caminho normal) nada muda: Rotina vazia ensina a criar o 1º hábito; e o braço B TAMBÉM continua quando a introdução foi feita (regra final do dono, 17/10)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "x" } }, { convites: { "2026-10-04": "foi" } });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    montar(montarStore({}), "/rotina");
    expect(esperarPostIt()).toHaveTextContent("Qual hábito você quer começar?");
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

/* ------------------------------------------------------------ 10b: o dia 1 SEM a faixa preta (1.0.17, dono 20/10) */

describe("10b. 1.0.17 (dono 20/10: 'não é necessário ter essa barra preta no topo'): a 1ª dose do braço A roda SEM a faixa 'Missão · dia 1 de 3' — e ninguém fica sem saída", () => {
  it("a regra: só a 1ª dose do braço A (dias 2 e 3, o 'aprofundar' e o braço B seguem com a faixa)", () => {
    expect(semFaixaNaDose("A", "dose", 1)).toBe(true);
    expect(semFaixaNaDose("A", "dose", 2)).toBe(false);
    expect(semFaixaNaDose("A", "dose", 3)).toBe(false);
    expect(semFaixaNaDose("B", "dose", 1)).toBe(false);
    expect(semFaixaNaDose(null, "dose", 1)).toBe(false);
    expect(semFaixaNaDose("A", "aprofundar", 1)).toBe(false);
  });

  it("Saúde no dia 1 (conta vazia): nem faixa nem 'Pular' (nem aos 20 s); a altura dela zera ('0'); a saída é o 'Agora não' do post-it — a dose fica pra depois, como o 'Pular' fazia, e ela volta pra Home", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    guardarChave(CHAVES_FUNIL_W.area, "saude");
    const store = montarStore({});
    montar(store, "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/saude");
    const postIt = esperarPostIt();
    avancar(20_000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.queryByTestId("missao-doses-pular")).toBeNull();
    // o atributo fica (quem precisa saber que a dose está na tela continua sabendo), com a altura zerada no CSS
    expect(document.documentElement.getAttribute("data-missao-doses-faixa")).toBe("0");
    expect(document.documentElement.getAttribute("data-missao-dose")).toBe("1");
    const agoraNao = within(postIt).getByTestId("missao-doses-agora-nao");
    expect(agoraNao).toHaveTextContent(/^Agora não$/);
    fireEvent.click(agoraNao);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(lerMissao()?.pulados).toEqual({ 1: "2026-10-03" });
    expect(lerMissao()?.feitos[1]).toBeUndefined();
    expect(eventos).toContainEqual(["missao_pular", expect.objectContaining({ dia: 1, passo: "toque", via: "agora_nao" })]);
    expect(document.documentElement.hasAttribute("data-missao-doses-faixa")).toBe(false);
  });

  it("o dia 2 segue com a faixa (e o 'Pular' dela aos 20 s); o post-it do dia 2 não ganha o 'Agora não'", () => {
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } }, { dicas: { 2: "2026-10-04" } });
    vi.setSystemTime(new Date(2026, 9, 4, 15, 10));
    montar(montarStore({}), "/rotina");
    const postIt = esperarPostIt();
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · dia 2 de 3");
    expect(document.documentElement.getAttribute("data-missao-doses-faixa")).toBe("1");
    expect(within(postIt).queryByTestId("missao-doses-agora-nao")).toBeNull();
    avancar(20_000);
    expect(screen.getByTestId("missao-doses-pular")).toBeInTheDocument();
  });

  it("o CSS zera a altura da faixa com o atributo '0' (a página não desce 40 px por nada) e a folha acima do teclado lê o 0 como 0 (o `|| 40` de antes virava 40)", () => {
    const css = fsDaFaixa.readFileSync(pathDaFaixa.resolve(__dirname, "../components/missao-doses/missao-doses.css"), "utf8");
    expect(css).toMatch(/html\[data-missao-doses-faixa="0"\]\s*\{\s*--missao-doses-faixa-h:\s*0px;\s*\}/);
    expect(alturaDaFaixa("0px")).toBe(0);
    expect(alturaDaFaixa(" 40px")).toBe(40);
    expect(alturaDaFaixa("")).toBe(40);
  });
});

/* ------------------------------------------------------------ 14: a dose de Finanças termina OLHANDO o número */

describe("14. dose de Finanças (os dois braços): Montar → tutorial do 1º gasto → UM balão no MEU MÊS ('Saiu' + 'Hoje ainda dá pra gastar', o número do card do Dashboard) → festa", () => {
  const montarAte2mil = () => {
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "Até R$ 2 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não tenho conta fixa" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    passarDaPonte();
  };

  it("fim do mês (28/10, 4 dias): o balão mostra a SOBRA de hoje — ~~R$ 375~~ R$ 363 —, a aba fica no MEU FINANCEIRO e o card do Dashboard mostra R$ 372 + a MESMA linha 'Sobram R$ 363 pra hoje' (a mesma conta)", () => {
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas");
    vi.setSystemTime(new Date(2026, 9, 28, 10, 0));
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-28", undefined, "A"), boasVindas: true }));
    conta.created_at = new Date(2026, 9, 28, 9, 0).toISOString();
    const store = montarStore({});
    montar(store, "/financas");
    montarAte2mil();
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]); // ☕ Café · R$ 12
    const tToque = Date.now();
    andar(1300);
    const pode = screen.getByTestId("missao-doses-olhar-pode");
    expect(pode).toHaveTextContent("Sobra hoje");
    expect(pode.querySelector("s")).toHaveTextContent("R$ 375"); // o do começo do dia, riscado
    expect(pode).toHaveAttribute("data-valor", "363"); // 375 − 12
    expect(screen.getByText("MEU FINANCEIRO")).toHaveAttribute("data-active", "true"); // sem trocar de aba
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent("Saiu no mês");
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", contou: true, caiu: true })]);
    expect(eventos.some(([n, d]) => n === "missao_doses_passo" && d.alvo === "pode_gastar")).toBe(false); // nada de ir pro Dashboard
    // sem tocar em nada: a festa entra sozinha, ≤ 4 s desde o toque
    for (let i = 0; i < 80 && !screen.queryByTestId("missao-doses-festa"); i++) avancar(50);
    expect(Date.now() - tToque).toBeLessThanOrEqual(4000);
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    // 1.0.17: a festa diz o número do DIA (o mesmo do número, da ponte e do riscado do balão), não a média refeita (372)
    expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent("R$ 375 por dia, já nas suas Finanças.");
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "feito", via: "auto" })]);
    // o card QUANTO POSSO GASTAR HOJE do Dashboard: o MESMO número do balão
    fireEvent.click(screen.getByText("DASHBOARD"));
    expect(screen.getByTestId("pode-gastar-valor")).toHaveTextContent("R$ 372");
    // ... e a conta da linha "Sobram R$ X pra hoje" do card (a de verdade: montar-financas-primeiro-gasto) = a do balão
    expect(praHojeDasFinancas(store.get)).toEqual({ doDia: 375, sobra: 363, gasto: 12 });
  });

  it("pulou o Montar e não tem renda: o tutorial do 1º gasto direto; sem número de 'pode gastar', o balão é SÓ o 'Saiu' do MEU MÊS e a festa entra sozinha", () => {
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-financas");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    fireEvent.click(within(screen.getByTestId("montar-financas")).getByRole("button", { name: "Pular" }));
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    andar(1300);
    expect(eventos.some(([n, d]) => n === "missao_doses_passo" && d.alvo === "pode_gastar")).toBe(false);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", contou: true })]);
    expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Seu mês");
    expect(screen.getByTestId("missao-doses-olhar-saiu")).toHaveTextContent("R$ 0"); // o "Saiu" conta de R$ 0 → R$ 12
    expect(screen.queryByTestId("missao-doses-olhar-pode")).toBeNull(); // sem renda, sem o número
    expect(screen.getByTestId("meu-mes-saiu")).toHaveTextContent("↓ Saiu R$ 12"); // o MEU MÊS da aba MEU FINANCEIRO
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(eventos.filter(([n]) => n === EV_PRIMEIRO_GASTO)).toEqual([]); // sem o Montar, não é o passo 1 novo
  });
});

/* ------------------------------------------------------------ 15: o 1º passo de Finanças (o maior vazamento: 63%) */

describe("15. o 1º passo de Finanças, do fim do Montar ao 1º gasto (dono, 17/10: 'foca no primeiro passo de Finanças')", () => {
  /** Montar até o número (renda + 1 conta + sem cartão) e "Continuar"; devolve a hora do toque. */
  const fazerMontar = () => {
    const mf = () => within(screen.getByTestId("montar-financas"));
    fireEvent.click(mf().getByRole("button", { name: "R$ 2 a 4 mil" }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: /Aluguel/ }));
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    fireEvent.click(mf().getByRole("button", { name: "Não uso cartão" }));
    avancar(2500);
    fireEvent.click(mf().getByRole("button", { name: "Continuar" }));
    passarDaPonte(); // 1.0.17: a ponte pro 1º gasto
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

  it("B11: o app morreu no 'Montando…' (antes do número) → reabrir volta NO NÚMERO, só o número; depois de VISTO, fechar e reabrir é o TUTORIAL (nunca o número de novo); o Café fecha a dose com o balão e a festa, um gasto só", () => {
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
    avancar(400); // ainda no "Montando…" (a conta entrando linha por linha) — mas a dose já gravou (B11)
    expect(screen.getByTestId("montar-montando")).toBeInTheDocument();
    expect(lerMissao()?.feitos[1]).toBeDefined();
    expect(lerMissao()?.gastoGuiado).toMatchObject({ n: 1, dia: "2026-10-03" });
    // (1) o app morre no "Montando…" → reabre na Home → a missão leva pra Finanças, DIRETO NO NÚMERO (sem as perguntas)
    cleanup();
    montar(store, "/home");
    for (let i = 0; i < 10; i++) avancar(300);
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    expect(screen.getByTestId("montar-pronto")).toBeInTheDocument();
    expect(screen.queryByTestId("montar-postit-gasto")).toBeNull();
    expect(screen.queryByText("Quanto entra por mês?")).toBeNull();
    expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0); // o tutorial espera o número sair da tela
    // (2) VIU o número e o app morreu de novo → reabre: a PONTE (1.0.17; o número é tela de uma vez)
    cleanup();
    montar(store, "/financas");
    avancar(300);
    expect(screen.getByTestId("montar-ponte")).toBeInTheDocument();
    expect(screen.queryByTestId("montar-pronto")).toBeNull();
    passarDaPonte();
    const postIt = esperarPostIt();
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    // (3) o Café → o balão do MEU MÊS → a festa; o gasto é um só, a renda é uma só, a dose é uma só
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull(); // 1.0.17: a festa não repete o gasto
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    expect(store.dados["finance-incomes"]).toHaveLength(1);
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1);
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
  });

  for (const braco of ["A", "B"] as const) {
    it(`braço ${braco}: 'Ainda não gastei nada hoje' grava o dia sem gasto (o MESMO registro do 'não gastei nada hoje' da Home) → o balão 'Hoje ainda dá pra gastar R$ X' (o número do card do Dashboard) → a festa; nenhum gasto inventado, a dose não conta como pulada`, () => {
      vi.stubEnv("VITE_V14_LOJA", "1");
      if (braco === "A") ligarUmPorDia("on");
      else { ligarUmPorDia("ab"); localStorage.setItem(CHAVE_BRACO_DIA1, "B"); }
      missaoNova(braco);
      const store = montarStore({});
      montar(store, "/financas");
      fazerMontar();
      const postIt = esperarPostIt();
      const ainda = within(postIt).getByTestId("missao-doses-ainda-nao");
      fireEvent.click(ainda);
      fireEvent.click(ainda); // toque duplo: 1 registro
      expect(store.dados[CHAVE_SEM_GASTO]).toEqual({ "2026-10-03": true }); // o formato do "não gastei" da Home (lib/acao-do-dia)
      expect(store.dados["finance-expenses"]).toBeUndefined();
      andar(900);
      expect(screen.getByTestId("missao-doses-olhar")).toHaveAttribute("data-sem-gasto");
      expect(screen.getByTestId("missao-doses-olhar-titulo")).toHaveTextContent("Dia sem gasto ✓");
      expect(screen.queryByTestId("missao-doses-olhar-saiu")).toBeNull();
      const porDia = Math.round(porDiaExato(store.get)!);
      expect(screen.getByTestId("missao-doses-olhar-pode")).toHaveTextContent(`Dá pra gastar hoje`);
      expect(screen.getByTestId("missao-doses-olhar-pode")).toHaveAttribute("data-valor", String(porDia));
      expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", acao: "view", alvo: "meu_mes", sem_gasto: true, caiu: false })]);
      const festa = passarOlhaDeFinancas();
      expect(festa).toHaveTextContent(braco === "A" ? /(pronta|pronto|prontas|prontos) 💛/ : "Primeira dose feita!");
      expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
      expect(lerMissao()?.feitos[1]).toBeDefined();
      expect(lerMissao()?.pulados).toBeUndefined();
      expect(lerMissao()?.gastoGuiado).toBeUndefined(); // reabrir não volta no tutorial
      expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "ainda_nao" })]);
      expect(eventos.filter(([n]) => n === EV_PRIMEIRO_GASTO).map(([, d]) => d.acao)).toEqual(["resultado", "continuar", "ponte", "ponte_saiu", "tutorial", "nao_gastei", "olha"]);
      // o card QUANTO POSSO GASTAR HOJE do Dashboard: o MESMO número
      fireEvent.click(screen.getByText("DASHBOARD"));
      expect(screen.getByTestId("pode-gastar-valor")).toHaveTextContent(`R$ ${porDia}`);
      if (braco === "A") {
        cleanup();
        montar(store, "/financas");
        avancar(3000);
        expect(screen.queryAllByTestId("demo-guia-postit")).toHaveLength(0);
        expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
      }
    });
  }

  it("a cadeia inteira no relógio falso: 'Continuar' → post-it com os chips em < 1,5 s → 1 TOQUE no chip = o gasto na conta → o 'olha' (≤ 4 s) → a festa; os eventos do Montar, do passo 1 e da dose levam o mesmo missao_id/braço", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    const t0 = fazerMontar();
    const tPostIt = ate(postItNaTela);
    const postIt = screen.getAllByTestId("demo-guia-postit").at(-1)!;
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip").map((c) => c.textContent)).toEqual(["☕Café· R$ 12", "🚗Uber· R$ 23", "🍔Almoço· R$ 35"]);
    expect(within(postIt).getByTestId("demo-guia-outro")).toBeInTheDocument();
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
    expect(screen.getByTestId("missao-doses-festa")).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    // o funil Montar → 1º gasto → olha se lê junto: o mesmo id da missão e o mesmo braço
    const id = idDaMissao(lerMissao()!);
    const doMontar = eventos.filter(([n]) => n.startsWith("montar_financas_")).map(([, d]) => d);
    expect(doMontar.length).toBeGreaterThanOrEqual(3);
    for (const d of doMontar) expect(d).toMatchObject({ origem: "missao", missao_id: id, braco: "um_por_dia" });
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "montar_financas", acao: "view", missao_id: id })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip", missao_id: id })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "olhar", alvo: "meu_mes", missao_id: id })]);
    // o passo 1 novo, do número ao 1º gasto, num evento só (sem reais): resultado → continuar → tutorial → chip → gasto → olha
    const doPasso1 = eventos.filter(([n]) => n === EV_PRIMEIRO_GASTO).map(([, d]) => d);
    expect(doPasso1.map((d) => d.acao)).toEqual(["resultado", "continuar", "ponte", "ponte_saiu", "tutorial", "chip", "gasto", "olha"]);
    for (const d of doPasso1) expect(d).toMatchObject({ missao_id: id, braco: "um_por_dia" });
    expect(doPasso1.find((d) => d.acao === "gasto")).toMatchObject({ via: "chip", ms: expect.any(Number), ms_tutorial: expect.any(Number) });
    expect(lerMissao()?.gastoGuiado).toBeUndefined(); // o gasto entrou: nada pendente
  });

  it("'+ Outro' (1.0.17, dono: 'e se ela não gastou com nenhum daqueles?'): o campo abre NO post-it (nome + R$), o post-it não some enquanto ela digita, o gasto DELA entra pelo caminho do chip e volta como chip 'seu' na próxima vez", () => {
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    const postIt = () => screen.getAllByTestId("demo-guia-postit").at(-1)!;
    fireEvent.click(within(postIt()).getByTestId("demo-guia-outro"));
    const campo = within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
    expect(document.activeElement).toBe(campo); // o foco vai pro campo DO post-it (não pro do módulo)
    act(() => { campo.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); });
    avancar(100);
    expect(screen.queryAllByTestId("demo-guia-postit").length).toBeGreaterThan(0); // escrevendo no post-it: ele fica na tela
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    // sem valor não adiciona; com nome + R$, sim
    fireEvent.change(campo, { target: { value: "Padaria" } });
    expect((within(postIt()).getByTestId("demo-guia-adicionar") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(postIt()).getByTestId("demo-guia-reais"), { target: { value: "18" } });
    fireEvent.click(within(postIt()).getByTestId("demo-guia-adicionar"));
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Padaria", value: 18, category: "outros" })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "gasto_extra", acao: "feito", via: "chip" })]);
    expect(store.dados["core-escolhas-proprias"]).toEqual({ "missao-gasto": [{ nome: "Padaria", valor: 18 }] });
    passarOlhaDeFinancas();
    const mes = eventos.find(([n, d]) => n === "missao_doses_passo" && d.alvo === "meu_mes")?.[1];
    expect(mes).toMatchObject({ contou: true }); // o "Saiu" contou + R$ 18 na tela (o valor nunca vai no evento)
    // o texto dela não vai nos eventos do chip/passo 1 ("outro")
    for (const [n, d] of eventos.filter(([n]) => n === "missao_doses_chip" || n === EV_PRIMEIRO_GASTO)) expect(JSON.stringify(d), n).not.toMatch(/Padaria/);
    expect(eventos).toContainEqual(["missao_doses_chip", expect.objectContaining({ nome: "outro", proprio: true })]);
  });

  it("20/10 (vídeo do dono no iPhone, build 42): '+ Outro' com o TECLADO DE VERDADE — a área visível encolhe e o iPhone rola; o post-it NÃO recolhe (antes recolhia levando o campo, o teclado fechava e voltava fechado, em loop)", () => {
    ligarUmPorDia("on");
    missaoNova("A");
    const store = montarStore({});
    montar(store, "/financas");
    fazerMontar();
    ate(postItNaTela);
    const postIt = () => screen.getAllByTestId("demo-guia-postit").at(-1)!;
    fireEvent.click(within(postIt()).getByTestId("demo-guia-outro"));
    const campo = within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
    act(() => { campo.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); });
    // o teclado do iPhone: o visualViewport encolhe (o alvo "+ Novo gasto" fica debaixo do teclado) e a página rola
    const ouvintes: Array<() => void> = [];
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { height: 90, offsetTop: 0, addEventListener: (_: string, f: () => void) => ouvintes.push(f), removeEventListener: () => {} } });
    try {
      act(() => { window.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("scroll")); });
      avancar(900);
      expect(screen.queryByTestId("missao-doses-postit-doca")).toBeNull();
      expect(screen.queryAllByTestId("demo-guia-postit").length).toBeGreaterThan(0);
      expect(within(postIt()).getByTestId("demo-guia-texto")).toBe(campo); // o MESMO campo (não remontou fechado)
      expect(document.activeElement).toBe(campo);
      fireEvent.change(campo, { target: { value: "Padaria" } });
      fireEvent.change(within(postIt()).getByTestId("demo-guia-reais"), { target: { value: "18" } });
      fireEvent.click(within(postIt()).getByTestId("demo-guia-adicionar"));
      expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Padaria", value: 18 })]);
    } finally {
      delete (window as { visualViewport?: unknown }).visualViewport;
    }
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
    expect(solto).toHaveTextContent("Gastou algo hoje?");
    expect(within(solto).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    visibilidade("visible");
    avancar(50);
    expect(eventos).toContainEqual(["missao_doses_anel_voltou", expect.objectContaining({ motivo: "segundo_plano" })]);
    // de novo no 2º plano, e ela toca o chip assim que volta (antes do anel)
    visibilidade("hidden");
    fireEvent.click(within(screen.getByTestId("missao-doses-postit-solto")).getAllByTestId("demo-guia-chip")[1]);
    visibilidade("visible");
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Uber", value: 23 })]);
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
    expect(postIt).toHaveTextContent("Gastou algo hoje?");
    expect(within(postIt).getAllByTestId("demo-guia-chip")).toHaveLength(3);
    expect(screen.queryByTestId("montar-financas")).toBeNull();
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_retomada", expect.objectContaining({ passo: "gasto_depois_do_montar", vez: 1 })]);
    expect(eventos).toContainEqual(["missao_doses_passo", expect.objectContaining({ passo: "toque", acao: "view", retomada: "gasto_depois_do_montar" })]);
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[2]); // 🍔 Almoço
    const festa = passarOlhaDeFinancas();
    expect(festa).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
    expect(screen.queryByTestId("missao-doses-gasto-extra")).toBeNull();
    expect(lerMissao()?.gastoGuiado).toBeUndefined();
    expect(eventos.filter(([n]) => n === "missao_doses_dia_feito")).toHaveLength(1); // a dose é uma só
    fireEvent.click(screen.getByTestId("missao-doses-continuar"));
    avancar(300); avancar(400); // 1.0.17: a folha desce e o véu troca a rota por baixo
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    // reabrir de novo: nada volta
    cleanup();
    montar(store, "/home");
    avancar(3000);
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
  });

  it("no máximo 2 retomadas: a 3ª abertura sem o gasto é a Home de sempre; num dia novo, nada; o 'Ainda não' na retomada fecha a dose com a festa (dia 1 sem faixa: sem 'Pular')", () => {
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
    // a saída na retomada (1.0.17: o dia 1 não tem faixa nem "Pular" — o "Ainda não" do post-it): a festa (a dose já
    // estava feita), nada de "pulada"
    montar(store, "/financas");
    ate(postItNaTela);
    avancar(20_000);
    expect(screen.queryByTestId("missao-doses-pular")).toBeNull();
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getByTestId("missao-doses-ainda-nao"));
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
    // na TELA o tempo vai preso ao número (U+00A0, #42); o texto das notificações (acima) segue com o espaço comum
    // 1.0.17 (dono: "sem segundos na tela"): a folha do plano diz só "Amanhã: Finanças."
    expect(fraseDeAmanha("financas", 2)).toBe("Amanhã: Finanças.");
    expect(fraseDeAmanha("financas", 1)).toBe("Amanhã: Finanças.");
    registrarChaveMontarRotina({ current: { metadata: { montar_rotina: "off" } } });
    try { expect(doseCurta("rotina", 1)).toEqual({ texto: "1 hábito, 20 s", seg: 20 }); } finally { _zerarRemotaMontarRotina(); }
  });

  it("#42 (revisão tela a tela): na tela, o tempo nunca se separa do número — 'monte em 3 toques, 30 s' com o espaço que não quebra, a linha das boas-vindas equilibra e o resto das telas da missão também ('20 s', '(1 min)')", () => {
    // o ajudante: só número + unidade (s / min); o resto do texto fica igual
    expect(unidadeJunta("monte em 3 toques, 30 s")).toBe("monte em 3 toques, 30\u00a0s");
    expect(unidadeJunta("1 copo d'água, 10 s")).toBe("1 copo d'água, 10\u00a0s");
    expect(unidadeJunta("Ver em 1 min?")).toBe("Ver em 1\u00a0min?");
    expect(unidadeJunta("3 toques, 2 sabores, 5 semanas")).toBe("3 toques, 2 sabores, 5 semanas"); // "s" de palavra não
    expect(emSegundos(20)).toBe("20\u00a0s");
    expect(rotuloConhecerMais("financas")).toBe("Mais dicas das Finanças"); // 1.0.17: quieto, sem "(1 min)"
    // as boas-vindas do braço A com a Rotina primeiro (a dose que quebrava a 390 px)
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    localStorage.removeItem("core-montar-rotina"); // o quiz da Rotina ligado: "monte em 3 toques, 30 s"
    guardarChave(CHAVES_FUNIL_W.area, "rotina");
    montar(montarStore({}), "/home");
    // 1.0.17 (dono: "sem segundos na tela"; 20/10: o plano diz o que cada dia entrega) — nenhum tempo pra quebrar
    expect(screen.getByTestId("missao-doses-linha-1").textContent).toBe("📅RotinaSeu primeiro hábitoHoje");
    expect(screen.queryByTestId("missao-doses-linha-1-dose")).toBeNull();
    expect(screen.getByTestId("missao-doses-linha-2").textContent).toBe("💰FinançasQuanto dá pra gastar por diaAmanhã");
    expect(screen.getByTestId("missao-doses-comecar").textContent).toBe("Começar meu tutorial");
    // e nenhum "N s"/"N min" na tela
    expect(screen.getByTestId("missao-doses-boas-vindas").textContent).not.toMatch(/\d[\s\u00a0](s|min)(?![\p{L}\d])/u);
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
      expect(postIt, braco).toHaveTextContent("Gastou algo hoje?");
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
        expect(screen.getByTestId("missao-doses-festa-texto")).toHaveTextContent(braco === "A" ? "“Beber água ao acordar” está na sua Rotina." : "Beber água ao acordar já está na sua Rotina.");
        cleanup();
        // pular o quiz: a dose guiada simples (criar o 1º hábito → marcar)
        localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["rotina", "financas", "saude"], "2026-10-03", undefined, braco), boasVindas: true }));
        montar(montarStore({}), "/rotina");
        fireEvent.click(screen.getByText("Pular quiz"));
        expect(esperarPostIt()).toHaveTextContent("Qual hábito você quer começar?");
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
    expect(link).toHaveTextContent(/^Mais dicas das Finanças$/); // 1.0.17: quieto, sem "(1 min)"
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

  /* ── 17/10, revisão tela a tela #17: o passeio que a FESTA abriu devolve a pessoa pro caminho da missão ── */

  it("A (#17): 'Mais dicas' NA FESTA do dia 1 → o passeio abre ali; no 'Sair' ela volta pra HOME — o tour curto (depois do respiro) e DEPOIS o 'Plano de amanhã'; reabrir o app não repete nada", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    const store = montarStore({});
    montarComPasseio(store, "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(screen.queryByTestId("missao-doses-festa")).toBeNull();
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas"); // o passeio é do módulo: abre AQUI
    expect(screen.getByTestId("conhecer-mais-faixa")).toHaveTextContent("Conhecer mais · Finanças");
    expect(eventos).toContainEqual(["conhecer_mais_abrir", { modulo: "financas", origem: "fim_dose" }]);
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    expect(screen.queryByTestId("conhecer-mais-faixa")).toBeNull();
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais_volta", expect.objectContaining({ dia: 1, modulo: "financas", completo: false, para: "home", variante: "A" })]);
    // 1.0.17 (tour_home_quando "dia1"): a Home quieta ~1,5 s → o tour curto; o plano só depois dele (uma camada por vez)
    avancar(2500);
    mostrarTour(); // 1.0.17: o popup de entrada do tour
    expect(screen.getByTestId("tour-balao")).toHaveTextContent("O que falta hoje.");
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    fireEvent.click(screen.getByTestId("tour-continuar"));
    fireEvent.click(screen.getByTestId("tour-continuar")); // "Deixar como está"
    fireEvent.click(screen.getByTestId("tour-concluir"));
    expect(screen.queryByTestId("tour-balao")).toBeNull();
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument(); // a hora do lembrete do dia 2 e a permissão de aviso
    fireEvent.click(screen.getByTestId("plano-a-hora-20h"));
    fireEvent.click(screen.getByTestId("plano-a-combinado"));
    expect(lerMissao()?.lembrete).toBe("20h");
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull();
    // fecha e reabre o app 2 h depois: nada de festa, passeio, tour ou plano de novo
    cleanup();
    _novaAberturaDoTour();
    vi.setSystemTime(new Date(2026, 9, 3, 17, 10));
    montarComPasseio(store, "/home");
    avancar(4000);
    for (const t of ["missao-doses-festa", "conhecer-mais-faixa", "tour-balao", "plano-amanha-a", "missao-doses-convite", "missao-dica"]) expect(screen.queryByTestId(t), t).toBeNull();
  });

  it("A (#17): o passeio que vai até o FIM ('Terminar', completo) também devolve pra Home", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    montarComPasseio(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(screen.getByTestId("conhecer-mais-faixa")).toBeInTheDocument();
    // o "Terminar" da última parada (o passeio de verdade emite isto no fim — conhecer-mais.test trava o lado de lá)
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_FIM_TOUR, { detail: { modulo: "financas", origem: "fim_dose", completo: true } })); });
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("conhecer-mais-faixa")).toBeNull();
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais_volta", expect.objectContaining({ dia: 1, modulo: "financas", completo: true, para: "home" })]);
    // uma volta só: outro fim (o mesmo passeio não acaba duas vezes) não navega de novo
    eventos.length = 0;
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_FIM_TOUR, { detail: { modulo: "financas", origem: "fim_dose", completo: true } })); });
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_conhecer_mais_volta");
  });

  it("A (#17), dia 2: 'Conhecer mais' na festa da Rotina → no 'Sair' a Home, onde vem a dica do dia (o score)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // domingo 04/10: dia 2 da missão
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" } }, { lembrete: "20h", convites: { "2026-10-04": "foi" } });
    montarComPasseio(montarStore({ "core-home-tour-done": "2026-10-03T15:00:00.000Z" }), "/rotina");
    const postIt = esperarPostIt();
    fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
    fireEvent.click(screen.getByText("Adicionar"));
    avancar(400); avancar(1000);
    fireEvent.click(screen.getByLabelText("Beber água ao acordar DOMINGO"));
    const festa = terminarOlhar();
    expect(festa).toHaveTextContent("Dia 2 feito.");
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(screen.getByTestId("conhecer-mais-faixa")).toHaveTextContent("Conhecer mais · Rotina");
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais_volta", expect.objectContaining({ dia: 2, modulo: "rotina", para: "home" })]);
    avancar(2000);
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-dia", "2");
  });

  it("B (#17): 'Conhecer mais' na passagem da dose 1 → no 'Sair' do passeio segue pra PRÓXIMA dose (a Rotina abre, como a passagem faria)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "B"), boasVindas: true }));
    montarComPasseio(montarStore({}), "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(screen.getByTestId("conhecer-mais-faixa")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais_volta", expect.objectContaining({ dia: 1, modulo: "financas", para: "rotina", variante: "B" })]);
    expect(esperarPostIt()).toHaveTextContent("1 de 2");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("dose 2 de 4");
  });

  it("B (#17): 'Conhecer mais' na festa da 3ª dose → no 'Sair' a Home com o 4º passo (a faixa 'Missão · 4 de 4' e o tour) — o plano de amanhã só depois", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({
      ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "B"), boasVindas: true,
      feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Beber água ao acordar" } },
    }));
    montarComPasseio(montarStore({}), "/saude");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    expect(terminarOlhar()).toHaveTextContent("Terceira dose feita!");
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    expect(screen.getByTestId("conhecer-mais-faixa")).toHaveTextContent("Conhecer mais · Saúde");
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(eventos).toContainEqual(["missao_doses_conhecer_mais_volta", expect.objectContaining({ dia: 3, modulo: "saude", para: "home" })]);
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · 4 de 4");
    avancar(1500);
    mostrarTour(); // 1.0.17: o popup de entrada do tour
    expect(screen.getByTestId("tour-balao")).toBeInTheDocument();
    expect(screen.queryByTestId("plano-amanha")).toBeNull();
  });

  it("(#17) só o passeio que A FESTA abriu: saiu do módulo no meio (a seta de voltar) → o fim que chegar depois não leva a lugar nenhum; o passeio do botão de dicas nunca mexe na rota", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    const store = montarStore({});
    montarComPasseio(store, "/financas");
    fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
    passarOlhaDeFinancas();
    fireEvent.click(screen.getByTestId("missao-doses-conhecer-mais"));
    fireEvent.click(screen.getByText("sair do módulo"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_FIM_TOUR, { detail: { modulo: "financas", origem: "fim_dose", completo: false } })); });
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_conhecer_mais_volta");
    cleanup();
    // o passeio pelo botão de dicas do módulo (origem "menu"): "Sair" fica no módulo
    montarComPasseio(store, "/financas");
    avancar(500);
    act(() => { window.dispatchEvent(new CustomEvent("conhecer-mais:abrir", { detail: { modulo: "financas", origem: "menu" } })); });
    fireEvent.click(screen.getByTestId("conhecer-mais-sair"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/financas");
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_conhecer_mais_volta");
  });

  it("(#17) com a introdução dos módulos desligada (rollback remoto): sem o host do passeio, a festa não oferece o link", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    registrarIntroRemota(offerings({ intro_modulo: "off" }));
    try {
      missaoA({});
      montar(montarStore({}), "/financas");
      fireEvent.click(within(esperarPostIt()).getAllByTestId("demo-guia-chip")[0]);
      expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
      expect(screen.queryByTestId("missao-doses-conhecer-mais")).toBeNull();
      expect(screen.getByTestId("missao-doses-continuar")).toBeInTheDocument();
    } finally { _zerarIntroRemota(); }
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
    expect(postIt).toHaveTextContent("Primeiro o gasto");
    expect(eventos).toContainEqual(["missao_doses_aba", expect.objectContaining({ de: "financeiro", para: "dashboard", bloqueada: true })]);
    expect(eventos.map(([n]) => n)).not.toContain("missao_doses_anel_saiu");
    avancar(2700); // o aviso some sozinho
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!).not.toHaveTextContent("Primeiro o gasto");
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getAllByTestId("demo-guia-chip")[1]);
    expect(store.dados["finance-expenses"]).toHaveLength(1);
    expect(passarOlhaDeFinancas()).toHaveTextContent(/(pronta|pronto|prontas|prontos) 💛/); // 1.0.17 (item 7): a dose 1 comemora o módulo
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
    expect(within(doca).getByTestId("demo-guia-postit")).toHaveTextContent("Gastou algo hoje?");
    expect(within(doca).queryByText(/Ainda não gastei/)).toBeNull(); // colado: só a pergunta e os chips
    expect(screen.queryByTestId("missao-doses-anel")).toBeNull(); // o anel recolhido não desenha (nem o escuro)
    fireEvent.click(within(doca).getAllByTestId("demo-guia-chip")[2]);
    expect((store.dados["finance-expenses"] as Array<{ description: string }>)[0]).toMatchObject({ description: "Almoço" });
    expect(eventos).toContainEqual(["missao_doses_chip", expect.objectContaining({ onde: "postit_doca", nome: "Almoço" })]);
  });

  it("o teclado no passo ('+ Outro' → o campo do post-it) é medido: aberto e fechado", () => {
    dose();
    eventos.length = 0;
    fireEvent.click(within(screen.getAllByTestId("demo-guia-postit").at(-1)!).getByTestId("demo-guia-outro"));
    expect(document.activeElement).toBe(screen.getByTestId("demo-guia-texto"));
    act(() => { (document.activeElement as HTMLElement).dispatchEvent(new FocusEvent("focusin", { bubbles: true })); });
    expect(eventos).toContainEqual(["missao_doses_teclado", expect.objectContaining({ aberto: true })]);
    act(() => { (document.activeElement as HTMLElement).blur(); document.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    avancar(200);
    expect(eventos).toContainEqual(["missao_doses_teclado", expect.objectContaining({ aberto: false })]);
  });
});

/* ------------------------------------------------------------ 19: quando a pessoa NÃO decide (revisão pré-build, 17/10) */

describe("19. as telas da missão quando a pessoa NÃO decide: aparecer conta, no máximo 2 vezes, e o 'visto' só com a tela na tela", () => {
  /** Os toques que levam a outra tela e de volta pra Home (o véu da dica deixa o toque passar pro que está embaixo). */
  const Navegar = () => {
    const ir = useNavigate();
    return (
      <nav>
        <button type="button" data-testid="ir-saude" onClick={() => ir("/saude")}>Saúde</button>
        <button type="button" data-testid="ir-home" onClick={() => ir("/home")}>Home</button>
      </nav>
    );
  };
  const montarComNavegacao = (store: Store, rota: string) =>
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Provedor store={store}>
          <MissaoDosesNaWeb />
          <Navegar />
          <Routes>
            <Route path="/home" element={<HomeFalsa />} />
            <Route path="/saude" element={<SaudeFalsa />} />
            <Route path="*" element={<Rota />} />
          </Routes>
        </Provedor>
      </MemoryRouter>,
    );
  /** Dia 2 (04/10, 18:00) com a dose 2 FEITA hoje e o lembrete combinado: a dica do score está devendo. */
  const dia2ComADoseFeita = () => {
    missaoA(
      { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: "2026-10-04", rotulo: "Beber água ao acordar" } },
      { lembrete: "12h", scoreAntes: { 2: 20 }, dono: donoDaConta("u1") },
    );
    vi.setSystemTime(new Date(2026, 9, 4, 18, 0));
  };
  const vistasDaDica = () => eventos.filter(([n, d]) => n === "missao_dica_dia" && d.acao === "view").map(([, d]) => d);
  const vistasDoConvite = () => eventos.filter(([n, d]) => n === "missao_convite" && d.acao === "visto").map(([, d]) => d);

  it("dica do dia: aparece (conta) → fecha o app SEM o 'Entendi' → reabre: a 2ª vez FICA na tela → reabre: nunca mais — nem saindo da conta, nem reinstalando (a cópia da conta lembra)", () => {
    ligarUmPorDia("on");
    dia2ComADoseFeita();
    const store = montarStore({});
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-dia", "2");
    expect(lerMissao()?.dicasVistas).toEqual({ 2: 1 }); // contou quando APARECEU (antes, só o "Entendi" gravava)
    expect(vistasDaDica()).toEqual([expect.objectContaining({ dia: 2, vez: 1, braco: "um_por_dia" })]);
    cleanup(); // fechou o app com o balão aberto
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toBeInTheDocument(); // a 2ª (e última) vez
    avancar(5000);
    expect(screen.getByTestId("missao-dica")).toBeInTheDocument(); // e ela FICA: a própria vista não a tira da tela
    expect(lerMissao()?.dicasVistas).toEqual({ 2: 2 });
    expect(lerMissao()?.dicas).toBeUndefined(); // ela não decidiu
    expect(vistasDaDica().map((d) => d.vez)).toEqual([1, 2]);
    cleanup();
    montar(store, "/home");
    avancar(5000);
    expect(screen.queryByTestId("missao-dica")).toBeNull(); // 3ª abertura no mesmo dia: chega
    cleanup();
    purgeLocalUserCache(); // saiu da conta e entrou de novo (a vassoura do logout)
    montar(store, "/home");
    avancar(5000);
    expect(screen.queryByTestId("missao-dica")).toBeNull();
    cleanup();
    // reinstalou: o aparelho limpo — a missão volta pela cópia da conta, com as vistas
    expect(store.dados[CHAVE_MISSAO_NA_CONTA]).toMatchObject({ dicasVistas: { 2: 2 } });
    localStorage.clear();
    montar(store, "/home");
    avancar(5000);
    expect(lerMissao()?.dicasVistas).toEqual({ 2: 2 });
    expect(screen.queryByTestId("missao-dica")).toBeNull();
    expect(vistasDaDica()).toHaveLength(2);
  });

  it("dica do dia: o toque passa pelo véu e ela sai da Home SEM decidir → volta pra Home (2ª vez, fica) → sai e volta de novo: não aparece mais", () => {
    ligarUmPorDia("on");
    dia2ComADoseFeita();
    montarComNavegacao(montarStore({}), "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ir-saude")); // abriu outro módulo com o balão aberto
    expect(screen.queryByTestId("missao-dica")).toBeNull();
    avancar(2000);
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull(); // (a dose 3 é só amanhã)
    fireEvent.click(screen.getByTestId("ir-home"));
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toBeInTheDocument(); // a 2ª vez
    avancar(5000);
    expect(screen.getByTestId("missao-dica")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ir-saude"));
    fireEvent.click(screen.getByTestId("ir-home"));
    avancar(5000);
    expect(screen.queryByTestId("missao-dica")).toBeNull(); // nunca mais
    expect(lerMissao()?.dicasVistas).toEqual({ 2: 2 });
    expect(vistasDaDica()).toHaveLength(2);
  });

  it("dica do dia 3 (depois de 'O que você construiu'): a conta é dela, separada da do dia 2; o 'Entendi' segue fechando de vez já na 1ª vez", () => {
    ligarUmPorDia("on");
    missaoA(
      { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" }, 2: { dia: "2026-10-04", rotulo: "Beber água ao acordar" }, 3: { dia: "2026-10-05", rotulo: "1 copo" } },
      { lembrete: "12h", fimVisto: true, dicas: { 2: "2026-10-04" }, dicasVistas: { 2: 2 } },
    );
    vi.setSystemTime(new Date(2026, 9, 5, 19, 0));
    const store = montarStore({});
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-dica")).toHaveAttribute("data-dia", "3");
    expect(lerMissao()?.dicasVistas).toEqual({ 2: 2, 3: 1 });
    fireEvent.click(screen.getByTestId("missao-dica-entendi"));
    expect(screen.queryByTestId("missao-dica")).toBeNull();
    expect(lerMissao()?.dicas).toEqual({ 2: "2026-10-04", 3: "2026-10-05" });
    cleanup();
    montar(store, "/home");
    avancar(5000);
    expect(screen.queryByTestId("missao-dica")).toBeNull();
  });

  it("dicaDoDiaDevida / conviteDoDiaDevido (puras): menos de 2 vistas sem decisão; a que já está NA TELA não sai pela própria vista; decidir tira na hora", () => {
    ligarUmPorDia("on");
    const base = { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03", undefined, "A"), boasVindas: true, feitos: { 1: { dia: "2026-10-03", rotulo: "x" }, 2: { dia: "2026-10-04", rotulo: "y" } } };
    expect(MAX_VISTAS_SEM_DECISAO).toBe(2);
    expect(dicaDoDiaDevida(base, "2026-10-04")).toBe(2);
    expect(dicaDoDiaDevida({ ...base, dicasVistas: { 2: 1 } }, "2026-10-04")).toBe(2);
    expect(dicaDoDiaDevida({ ...base, dicasVistas: { 2: 2 } }, "2026-10-04")).toBeNull();
    expect(dicaDoDiaDevida({ ...base, dicasVistas: { 2: 2 } }, "2026-10-04", 2)).toBe(2); // a 2ª vista, já na tela
    expect(dicaDoDiaDevida({ ...base, dicasVistas: { 2: 3 } }, "2026-10-04", 2)).toBeNull();
    expect(dicaDoDiaDevida({ ...base, dicas: { 2: "2026-10-04" } }, "2026-10-04", 2)).toBeNull(); // "Entendi"
    expect(dicaDoDiaDevida(base, "2026-10-05")).toBeNull(); // o dia da dose passou
    expect(dicaDoDiaDevida({ ...base, explorou: true }, "2026-10-04")).toBeNull();
    expect(dicaDoDiaDevida({ ...base, braco: "B" }, "2026-10-04")).toBeNull();
    const dia3 = { ...base, feitos: { ...base.feitos, 3: { dia: "2026-10-05", rotulo: "z" } } };
    expect(dicaDoDiaDevida(dia3, "2026-10-05")).toBeNull(); // antes de "O que você construiu"
    expect(dicaDoDiaDevida({ ...dia3, fimVisto: true }, "2026-10-05")).toBe(3);
    expect(dicaDoDiaDevida({ ...dia3, fimVisto: true, dicasVistas: { 3: 2 } }, "2026-10-05")).toBeNull();
    const convite = { ...base, feitos: { 1: base.feitos[1] } };
    expect(conviteDoDiaDevido({ ...convite, convitesVistos: { "2026-10-04": 1 } }, "2026-10-04")).toBe(true);
    expect(conviteDoDiaDevido({ ...convite, convitesVistos: { "2026-10-04": 2 } }, "2026-10-04")).toBe(false);
    expect(conviteDoDiaDevido({ ...convite, convitesVistos: { "2026-10-04": 2 } }, "2026-10-04", true)).toBe(true); // a 2ª, já na tela
    expect(conviteDoDiaDevido({ ...convite, convitesVistos: { "2026-10-04": 2 }, convites: { "2026-10-04": "depois" } }, "2026-10-04", true)).toBe(false);
  });

  it("convite do dia: fechou o app com ele aberto → a 2ª chance APARECE de verdade e fica (o 'visto' conta 1 vez, vez=2) → de novo sem decidir: a 3ª abertura não mostra nem conta", () => {
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { lembrete: "12h" });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    const store = montarStore({});
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite")).toBeInTheDocument();
    expect(lerMissao()?.convitesVistos).toEqual({ "2026-10-04": 1 });
    expect(vistasDoConvite()).toHaveLength(1);
    cleanup(); // fechou o app sem decidir
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite")).toBeInTheDocument(); // a 2ª chance aparece...
    avancar(5000);
    expect(screen.getByTestId("missao-doses-convite")).toBeInTheDocument(); // ...e FICA (antes ela sumia no mesmo instante)
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
    expect(lerMissao()?.convitesVistos).toEqual({ "2026-10-04": 2 });
    expect(vistasDoConvite()).toEqual([expect.objectContaining({ dia: 2, vez: 1 }), expect.objectContaining({ dia: 2, vez: 2 })]); // cada vista de verdade, 1 vez
    cleanup(); // de novo sem decidir
    montar(store, "/home");
    avancar(5000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull(); // chega por hoje
    expect(vistasDoConvite()).toHaveLength(2); // o que não apareceu não conta como visto
    expect(lerMissao()?.convitesVistos).toEqual({ "2026-10-04": 2 });
    cleanup();
    // amanhã o convite volta (é por dia) — a dose 2 continua sendo a de hoje
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    montar(store, "/home");
    avancar(1500);
    expect(screen.getByTestId("missao-doses-convite-titulo")).toHaveTextContent("Dia 2: Rotina");
    expect(lerMissao()?.convitesVistos).toEqual({ "2026-10-04": 2, "2026-10-05": 1 });
  });

  it("convite do dia: na 2ª chance ela decide — 'Bora' leva pra dose; 'Agora não' fecha e nada volta (reabrir)", () => {
    ligarUmPorDia("on");
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { lembrete: "12h", convitesVistos: { "2026-10-04": 1 } });
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0));
    const store = montarStore({});
    montar(store, "/home");
    avancar(1500);
    fireEvent.click(screen.getByTestId("missao-doses-convite-ir"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "foi" });
    expect(eventos).toContainEqual(["missao_convite", expect.objectContaining({ acao: "bora", dia: 2 })]);
    cleanup();
    missaoA({ 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } }, { lembrete: "12h", convitesVistos: { "2026-10-04": 1 } });
    montar(store, "/home");
    avancar(1500);
    fireEvent.click(screen.getByTestId("missao-doses-convite-depois"));
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
    expect(lerMissao()?.convites).toEqual({ "2026-10-04": "depois" });
    cleanup();
    montar(store, "/home");
    avancar(5000);
    expect(screen.queryByTestId("missao-doses-convite")).toBeNull();
  });
});

/* ------------------------------------------------------------ 20: as boas-vindas (revisão pré-build, 17/10) */

describe("20. boas-vindas: o 'viu' nos dois braços e 'Seus N dias grátis' só com o teste da loja de verdade", () => {
  const vistasDasBoasVindas = () => eventos.filter(([n, d]) => n === "missao_doses_boas_vindas" && d.acao === "view").map(([, d]) => d);
  const pedidoDoTeste = (dias: number) =>
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, JSON.stringify({ fimMs: Date.now() + dias * 864e5, precoAno: "R$ 97,90", inicioMs: Date.now() }));

  it("boas-vindas: o braço A também manda o 'view' (com o braço) — 1 por abertura em que a tela aparece, então o funil A×B tem o 'viu' e o alarme de telas que voltam enxerga o A", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const store = montarStore({});
    montar(store, "/home");
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveAttribute("data-braco", "A");
    expect(vistasDasBoasVindas()).toEqual([expect.objectContaining({ tela: 1, variante: "A", braco: "um_por_dia" })]);
    // (1.0.17: o A não tem mais "Trocar" — a escolha dos módulos é só do B) re-render na mesma abertura não é outra vista
    act(() => { window.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveAttribute("data-braco", "A");
    expect(vistasDasBoasVindas()).toHaveLength(1);
    cleanup(); // fechou o app na tela, sem decidir
    montar(store, "/home");
    expect(screen.getByTestId("missao-doses-boas-vindas")).toBeInTheDocument();
    expect(vistasDasBoasVindas()).toHaveLength(2); // a tela voltou noutra abertura: é isso que o alarme (telas-repetidas) lê
  });

  it("boas-vindas do braço B: o 'view' segue por tela, agora também com o braço legível", () => {
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    montar(montarStore({}), "/home");
    expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveAttribute("data-braco", "B");
    expect(vistasDasBoasVindas()).toEqual([expect.objectContaining({ tela: 1, variante: "B", braco: "dia1_cheio" })]);
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    expect(vistasDasBoasVindas()).toEqual([expect.objectContaining({ tela: 1 }), expect.objectContaining({ tela: 2, braco: "dia1_cheio" })]);
  });

  it("boas-vindas do A: 'Seus N dias grátis começaram' (sem ponto final, 1.0.17) só com teste da loja de verdade — 3 dias (paywall), 7 dias (código da App Store); quem pagou no site ou assinou o mensal lê 'Seu acesso começou'", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    const abrirBoasVindas = () => {
      cleanup();
      localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
      montar(montarStore({}), "/home");
      expect(screen.getByTestId("missao-doses-boas-vindas")).toHaveAttribute("data-braco", "A");
      return screen.getByTestId("missao-doses-subtitulo");
    };
    // 1) comprou o anual com 3 dias grátis no paywall (o pedido do aviso guarda o início e o fim do teste)
    // 1.0.17 (dono 19/10): a linha do teste volta no layout mínimo — só com teste da loja de verdade
    pedidoDoTeste(3);
    expect(abrirBoasVindas()).toHaveTextContent(/^Seus 3 dias grátis começaram$/);
    localStorage.removeItem(CHAVE_LEMBRETE_TESTE);
    // 2) o código de 7 dias da App Store (afiliados): a loja confirmou o teste no boot
    localStorage.setItem(CHAVE_TRIAL_CARTAO, String(Date.now() + 7 * 864e5 - 60_000));
    expect(abrirBoasVindas()).toHaveTextContent(/^Seus 7 dias grátis começaram$/);
    localStorage.removeItem(CHAVE_TRIAL_CARTAO);
    // 3) pagou no site ou assinou o mensal (cobra hoje): teste nenhum
    expect(abrirBoasVindas()).toHaveTextContent(/^Seu acesso começou$/);
    expect(screen.getByTestId("missao-doses-boas-vindas")).not.toHaveTextContent(/dias? grátis/);
    // 4) um teste que já acabou não conta
    localStorage.setItem(CHAVE_TRIAL_CARTAO, String(Date.now() - 1));
    expect(abrirBoasVindas()).toHaveTextContent(/^Seu acesso começou$/);
  });

  it("boas-vindas do B (já no ar): a mesma regra — sem teste, 'Seu acesso começou agora'; o boot que confirma o teste DEPOIS da 1ª tela troca a frase pra 'Seus 3 dias grátis começaram agora'", () => {
    ligarUmPorDia("ab");
    localStorage.setItem(CHAVE_BRACO_DIA1, "B");
    montar(montarStore({}), "/home");
    expect(screen.getByTestId("missao-doses-subtitulo")).toHaveTextContent("Seu acesso começou agora. Dá pra usar tudo.");
    act(() => { marcarTrialCartaoAte(Date.now() + 3 * 864e5 - 60_000); }); // revenuecat.conferirTrialCartao respondeu
    expect(screen.getByTestId("missao-doses-subtitulo")).toHaveTextContent("Seus 3 dias grátis começaram agora. Dá pra usar tudo.");
    cleanup();
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    localStorage.removeItem(CHAVE_TRIAL_CARTAO);
    pedidoDoTeste(7);
    montar(montarStore({}), "/home");
    expect(screen.getByTestId("missao-doses-subtitulo")).toHaveTextContent("Seus 7 dias grátis começaram agora. Dá pra usar tudo.");
  });

  it("diasDoTesteDaLoja / fraseDoAcesso (puras): o pedido da compra (início → fim) dá os dias exatos; sem início ou só com o marcador da loja, os que faltam (nunca menos que a reserva); acabou ou ilegível = sem teste", () => {
    const agora = Date.now();
    const DIA = 864e5;
    expect(DIAS_DE_TESTE_PADRAO).toBe(3);
    expect(diasDoTesteDaLoja(agora)).toBeNull();
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, JSON.stringify({ fimMs: agora + 7 * DIA, precoAno: "R$ 97,90", inicioMs: agora }));
    expect(diasDoTesteDaLoja(agora)).toBe(7);
    expect(diasDoTesteDaLoja(agora + 2 * DIA)).toBe(7); // é o teste dela, não o que falta
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, JSON.stringify({ fimMs: agora + 3 * 60_000, precoAno: "R$ 97,90", inicioMs: agora })); // sandbox (3 min)
    expect(diasDoTesteDaLoja(agora)).toBe(DIAS_DE_TESTE_PADRAO);
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, JSON.stringify({ fimMs: agora + 3 * DIA, precoAno: "R$ 97,90" })); // pedido de antes da 1.0.16
    expect(diasDoTesteDaLoja(agora)).toBe(3);
    expect(diasDoTesteDaLoja(agora + 2 * DIA)).toBe(3); // nunca "seu 1 dia grátis"
    expect(diasDoTesteDaLoja(agora + 3 * DIA + 1)).toBeNull(); // acabou
    localStorage.setItem(CHAVE_LEMBRETE_TESTE, "{lixo");
    expect(diasDoTesteDaLoja(agora)).toBeNull();
    localStorage.setItem(CHAVE_TRIAL_CARTAO, String(agora + 7 * DIA - 60_000));
    expect(diasDoTesteDaLoja(agora)).toBe(7);
    localStorage.setItem(CHAVE_TRIAL_CARTAO, String(agora - 1));
    expect(diasDoTesteDaLoja(agora)).toBeNull();
    expect(fraseDoAcesso(3)).toBe("Seus 3 dias grátis começaram");
    expect(fraseDoAcesso(7)).toBe("Seus 7 dias grátis começaram");
    expect(fraseDoAcesso(1)).toBe("Seu 1 dia grátis começou");
    expect(fraseDoAcesso(null)).toBe("Seu acesso começou");
  });
});

/* ------------------------------------------------------------ 21: o TECLADO DO iPHONE DE VERDADE no "+ Outro" do post-it */

describe("21. TECLADO DE VERDADE (20/10, caça aos bugs de aparelho): o '+ Outro' do post-it sobrevive ao teclado abrir, FECHAR e à troca de lugar do post-it", () => {
  let teclado: TecladoIphone | null = null;
  afterEach(() => { teclado?.desinstalar(); teclado = null; });
  /** o alvo ("+ Novo gasto") mais embaixo na tela: com o teclado aberto ele fica DEBAIXO do teclado */
  const alvoEmbaixo = (top = 600) => vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return (this.matches?.("header.sticky, .demo-tour-nav")
      ? { top: 0, left: 0, width: 390, height: 56, bottom: 56, right: 390, x: 0, y: 0, toJSON: () => ({}) }
      : { top, left: 10, width: 300, height: 48, bottom: top + 48, right: 310, x: 10, y: top, toJSON: () => ({}) }) as DOMRect;
  });
  const dose = () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarUmPorDia("on");
    missaoA({});
    const store = montarStore({});
    montar(store, "/financas");
    esperarPostIt();
    return store;
  };
  const postIt = () => screen.getAllByTestId("demo-guia-postit").at(-1)!;
  const abrirOutro = () => {
    fireEvent.click(within(postIt()).getByTestId("demo-guia-outro"));
    return within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
  };

  it("escreveu o nome, tocou no 'OK' do teclado (o foco sai ANTES de o teclado descer): o post-it NÃO some nem remonta — o campo segue aberto com o que ela escreveu", () => {
    const store = dose();
    alvoEmbaixo();
    teclado = instalarTecladoIphone();
    const campo = abrirOutro();
    teclado.abrir(campo);
    fireEvent.change(campo, { target: { value: "Padaria" } });
    avancar(900);
    expect(within(postIt()).getByTestId("demo-guia-texto")).toBe(campo);
    // o "OK" da barra do teclado: o foco sai na hora, a área visível ainda pequena por ~250 ms, o iPhone desfaz a rolagem
    teclado.soltarFoco();
    avancar(100);
    expect(screen.queryAllByTestId("demo-guia-postit").length).toBeGreaterThan(0); // o post-it não pisca fora
    avancar(250);
    teclado.assentar();
    avancar(900);
    const agora = within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
    expect(agora).toBe(campo); // o MESMO campo (não remontou fechado)
    expect(agora.value).toBe("Padaria");
    expect(screen.queryByTestId("missao-doses-postit-doca")).toBeNull();
    fireEvent.change(within(postIt()).getByTestId("demo-guia-reais"), { target: { value: "18" } });
    fireEvent.click(within(postIt()).getByTestId("demo-guia-adicionar"));
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Padaria", value: 18 })]);
  });

  it("com o campo aberto, o '+ Novo gasto' some e volta (o módulo redesenha): o post-it solto NÃO troca pelo do anel enquanto ela escreve (trocar = campo fechado e teclado caindo)", () => {
    const store = dose();
    teclado = instalarTecladoIphone();
    act(() => { store.set("__semBotao", true); });
    avancar(300); avancar(3000);
    expect(screen.getByTestId("missao-doses-postit-solto")).toBeInTheDocument();
    const campo = abrirOutro();
    teclado.abrir(campo);
    fireEvent.change(campo, { target: { value: "Farmácia" } });
    act(() => { store.set("__semBotao", false); });
    avancar(2000);
    const agora = within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
    expect(agora).toBe(campo);
    expect(agora.value).toBe("Farmácia");
    fireEvent.change(within(postIt()).getByTestId("demo-guia-reais"), { target: { value: "32,50" } });
    fireEvent.click(within(postIt()).getByTestId("demo-guia-adicionar"));
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Farmácia", value: 32.5 })]);
  });

  it("escreveu 'Padaria' e saiu do app pra ver o valor no banco (2º plano): ao voltar, o campo segue aberto com o que ela escreveu", () => {
    const store = dose();
    teclado = instalarTecladoIphone();
    const campo = abrirOutro();
    teclado.abrir(campo);
    fireEvent.change(campo, { target: { value: "Padaria" } });
    // o app vai pro 2º plano: o teclado some junto
    teclado.soltarFoco();
    teclado.assentar();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    avancar(5000);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    avancar(1000);
    const agora = within(postIt()).getByTestId("demo-guia-texto") as HTMLInputElement;
    expect(agora.value).toBe("Padaria");
    fireEvent.change(within(postIt()).getByTestId("demo-guia-reais"), { target: { value: "18" } });
    fireEvent.click(within(postIt()).getByTestId("demo-guia-adicionar"));
    expect(store.dados["finance-expenses"]).toEqual([expect.objectContaining({ description: "Padaria", value: 18 })]);
  });

  it("o Anel com tempo (os tutoriais: 60 s) não sai pelo tempo enquanto ela escreve no '+ Outro' do balão", () => {
    const alvo = document.createElement("button");
    document.body.appendChild(alvo);
    const saidas: string[] = [];
    render(<Anel alvo={alvo} fixo interativo duracao={60_000} aoSair={(m) => saidas.push(m)} testid="anel-x"
      balao={<PostItDaMissao pergunta="O que você comeu?" chips={[{ emoji: "🍞", nome: "Pão" }]} aoChip={() => {}} outro={{ placeholder: "Escreva aqui", aoEscolher: () => {} }} />} />);
    avancar(900);
    avancar(50_000);
    fireEvent.click(screen.getByTestId("demo-guia-outro"));
    fireEvent.change(screen.getByTestId("demo-guia-texto"), { target: { value: "Tapioca" } });
    avancar(15_000);
    expect(saidas).toEqual([]);
    expect((screen.getByTestId("demo-guia-texto") as HTMLInputElement).value).toBe("Tapioca");
    // (fechar o campo devolve o tempo: no jsdom a animação de saída do campo não termina com o relógio falso — não dá pra conferir aqui)
    alvo.remove();
  });

  it("print do dono (Simulador, teclado do iPhone): escrevendo no '+ Outro', o recorte do anel NÃO fica em outro lugar — some (só o post-it, parado); fechou o teclado, o recorte volta no '+ Novo gasto'", () => {
    dose();
    teclado = instalarTecladoIphone();
    expect(screen.getByTestId("anel-recorte")).toBeInTheDocument();
    const campo = abrirOutro();
    const topoAntes = postIt().parentElement!.parentElement!.style.top; // o lugar do balão no Anel
    expect(topoAntes).not.toBe("");
    teclado.abrir(campo, 120, 60); // o iPhone desloca a área visível pra mostrar o campo do post-it
    alvoEmbaixo(420); // o alvo "anda" na medida (rolagem/deslocamento) — antes o recorte ia junto pro lugar errado e o post-it pulava
    avancar(900);
    expect(screen.queryByTestId("anel-recorte")).toBeNull();
    expect(postIt().parentElement!.parentElement!.style.top).toBe(topoAntes); // não vai atrás do alvo enquanto ela escreve
    expect(within(postIt()).getByTestId("demo-guia-texto")).toBe(campo);
    fireEvent.click(within(postIt()).getByText("Cancelar"));
    teclado.soltarFoco();
    avancar(300);
    teclado.assentar();
    avancar(600);
    expect(screen.getByTestId("anel-recorte")).toBeInTheDocument();
  });

  it("toque real no Simulador (20/10, regressão pega no build bd198e7d): o post-it 'parado' deixava o campo ATRÁS do teclado (o iPhone não rola por campo dentro de algo fixed) — ele sobe o que precisa pra caber acima do teclado e depois não segue o anel", () => {
    const alturas = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.querySelector?.('[data-testid="demo-guia-postit"]') && !this.matches('[data-testid="demo-guia-postit"]') ? 300 : 0;
    });
    try {
      teclado = instalarTecladoIphone();
      dose();
      alvoEmbaixo(600);
      avancar(900);
      const balao = () => postIt().parentElement!.parentElement!; // o lugar do balão no Anel
      const topoSemTeclado = parseFloat(balao().style.top);
      expect(topoSemTeclado + 300).toBeGreaterThan(844 - 336); // com o teclado aberto, ficaria debaixo dele
      const campo = abrirOutro();
      teclado.abrir(campo, 0, 0);
      avancar(900);
      const topo = parseFloat(balao().style.top);
      expect(topo + 300).toBeLessThanOrEqual(844 - 336 - 8); // inteiro acima do teclado: o campo, o R$ e o Adicionar à vista
      alvoEmbaixo(200); // o alvo "anda" — o post-it não vai atrás dele enquanto ela escreve
      act(() => { window.dispatchEvent(new Event("scroll")); });
      avancar(900);
      expect(parseFloat(balao().style.top)).toBe(topo);
      expect(within(postIt()).getByTestId("demo-guia-texto")).toBe(campo);
    } finally { alturas.mockRestore(); }
  });

  it("toque real no iPhone SE (375×667, 339 px visíveis com o teclado): o post-it não cabe inteiro abaixo das abas — o CAMPO e o 'Adicionar' ficam acima do teclado (o balão passa por cima do cabeçalho)", () => {
    const alturas = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.querySelector?.('[data-testid="demo-guia-postit"]') && !this.matches('[data-testid="demo-guia-postit"]') ? 290 : 0;
    });
    try {
      teclado = instalarTecladoIphone({ alturaTela: 667, larguraTela: 375, alturaTeclado: 328 });
      dose();
      alvoEmbaixo(500);
      avancar(900);
      const balao = () => postIt().parentElement!.parentElement!;
      const campo = abrirOutro();
      // no balão, o fim do campo (com o R$ e o "Adicionar") fica 240 px abaixo do topo do balão
      const rectAntes = vi.mocked(Element.prototype.getBoundingClientRect).getMockImplementation()!;
      vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
        const topoDoBalao = parseFloat(balao().style.top) || 0;
        if (this === balao()) return { top: topoDoBalao, bottom: topoDoBalao + 290, left: 0, right: 375, width: 375, height: 290, x: 0, y: topoDoBalao, toJSON: () => ({}) } as DOMRect;
        if (this.matches?.("[data-escolha-campo]")) return { top: topoDoBalao + 150, bottom: topoDoBalao + 240, left: 0, right: 375, width: 375, height: 90, x: 0, y: topoDoBalao + 150, toJSON: () => ({}) } as DOMRect;
        // o cabeçalho do módulo + as abas, grudados no topo (no SE terminam em ~112)
        if (this.matches?.("header.sticky")) return { top: 0, bottom: 112, left: 0, right: 375, width: 375, height: 112, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
        return rectAntes.call(this);
      });
      teclado.abrir(campo, 0, 0);
      avancar(900);
      const topo = parseFloat(balao().style.top);
      expect(topo + 240).toBeLessThanOrEqual(667 - 328 - 8); // o fim do campo acima do teclado
      expect(within(postIt()).getByTestId("demo-guia-texto")).toBe(campo);
    } finally { alturas.mockRestore(); }
  });

  it("print do dono: com o teclado aberto o iPhone desloca a área visível e a faixa 'Missão · dia 1 de 3' subia pra cima do relógio — enquanto deslocada, <html data-tela-deslocada> (o CSS tira a faixa); fechou, volta", () => {
    teclado = instalarTecladoIphone(); // no aparelho o visualViewport existe desde a abertura
    dose();
    const campo = abrirOutro();
    expect(document.documentElement.hasAttribute("data-tela-deslocada")).toBe(false);
    teclado.abrir(campo, 0, 59);
    expect(document.documentElement.hasAttribute("data-tela-deslocada")).toBe(true);
    teclado.soltarFoco();
    teclado.assentar();
    expect(document.documentElement.hasAttribute("data-tela-deslocada")).toBe(false);
  });

  it("o Anel sozinho (o mesmo dos tutoriais de 1ª abertura): '+ Outro' do balão, o 'OK' do teclado com a área ainda pequena — o balão não sai nem remonta, o texto fica", () => {
    teclado = instalarTecladoIphone();
    const alvo = document.createElement("button");
    document.body.appendChild(alvo);
    render(<Anel alvo={alvo} fixo interativo duracao={60_000} aoSair={() => {}} testid="anel-x"
      balao={<PostItDaMissao pergunta="O que você comeu?" chips={[{ emoji: "🍞", nome: "Pão" }]} aoChip={() => {}} outro={{ placeholder: "Escreva aqui", aoEscolher: () => {} }} />} />);
    avancar(900);
    fireEvent.click(screen.getByTestId("demo-guia-outro"));
    const campo = screen.getByTestId("demo-guia-texto") as HTMLInputElement;
    teclado.abrir(campo, 120, 40);
    fireEvent.change(campo, { target: { value: "Tapioca" } });
    avancar(500);
    teclado.soltarFoco();
    avancar(100);
    expect(screen.queryByTestId("demo-guia-postit")).not.toBeNull();
    avancar(350);
    teclado.assentar();
    avancar(500);
    expect(screen.getByTestId("demo-guia-texto")).toBe(campo);
    expect(campo.value).toBe("Tapioca");
    alvo.remove();
  });

  it("tocou em 'Cancelar' com o teclado aberto: o post-it não pisca (sai e volta) enquanto o teclado desce", () => {
    dose();
    teclado = instalarTecladoIphone();
    const campo = abrirOutro();
    teclado.abrir(campo);
    const antes = postIt();
    fireEvent.click(within(postIt()).getByText("Cancelar"));
    avancar(100);
    expect(screen.queryAllByTestId("demo-guia-postit").length).toBeGreaterThan(0);
    avancar(400);
    expect(screen.queryAllByTestId("demo-guia-postit").length).toBeGreaterThan(0);
    teclado.assentar();
    avancar(500);
    expect(postIt()).toBe(antes); // o mesmo post-it (não remontou)
  });
});
