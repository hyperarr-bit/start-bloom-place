/**
 * O NOVATO NA HOME NOVA (1.0.19, decisões do dono 26/10 — novidades-guardadas/2026-10-26/novato-home-nova/PLANO.md).
 *   1. a MISSÃO com a Home nova segue SEM o tour antigo: braço B fecha o 4º passo sozinho (sem a faixa "Missão · 4 de 4"
 *      por cima da barra) e o "Plano de amanhã" vem; braço A não segura o plano (hora do lembrete); festa da dose 1 sem
 *      "Conhecer minha Home"; as dicas dos dias 2/3 saem; "Casa arrumada" some do álbum;
 *   2. a chave `home_nova` ganha "novas" e "novas+admin" (origem da conta: nova × antiga, gravada na conta);
 *   3. a dica do "+" — 1x, some no 1º toque, nunca volta (fechar e reabrir);
 *   4. resumo sem meta = "Criar" (anel tracejado + "+");
 *   5. score SEM os pontos "de graça" só pra conta nova.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
const nota = vi.hoisted(() => ({ pedir: vi.fn(async (_m: string) => true) }));
vi.mock("@/lib/avaliacao", async (orig) => ({ ...(await orig<typeof import("@/lib/avaliacao")>()), pedirAvaliacaoPorMissao: (m: string) => nota.pedir(m) }));
vi.mock("@/hooks/use-auth", () => {
  const u = () => ({ user: { id: "u1", created_at: conta.created_at, email: "ana@x.com" }, isSubscribed: true });
  return { useAuth: u, useAuthOpcional: u };
});
const notif = vi.hoisted(() => ({
  pedirDia2: vi.fn(async (_o: string) => "concedeu" as const),
  proximaDose: vi.fn(async (_d: unknown) => ({ ok: true as const, quando: new Date(2026, 9, 3, 18, 10) })),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: vi.fn(async () => {}),
  pedirPermissao: vi.fn(async () => true),
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
  agendarProximaDose: (d: unknown) => notif.proximaDose(d),
}));
// ConstruiuEm3Dias puxa a Home inteira (life hub, conquistas): aqui só importa SE ela aparece
vi.mock("@/components/missao-doses/ConstruiuEm3Dias", () => ({ ConstruiuEm3Dias: () => <div data-testid="construiu">O que você construiu</div> }));

import { UserDataContext, useUserData } from "@/hooks/use-user-data";
import { MissaoDosesNaWeb, EVENTO_MISSAO_COMPLETA } from "@/components/missao-doses/MissaoDosesNaWeb";
import {
  CHAVE_ESTADO_MISSAO_DOSES, aprofundarPendente, ehBracoB, eventoDaMissao, iniciarMissao, lerMissao, missaoDoDiaEmCena, missaoEmAndamento, precisaPlanoAmanha, varianteDia1,
} from "@/lib/missao-doses";
import { EVENTO_TOUR_HOME_FIM, deveMostrarTourHome, tourHomeLigado } from "@/lib/tour-home";
import {
  CHAVE_BRACO_DIA1, CHAVE_FORCA_DIA1_CHEIO, CHAVE_ID_LOCAL, DIA1_CHEIO, bracoDia1, dia1CheioLigado, fraseDoPlano, guardarForcaDia1Cheio, idDoAparelho, minutosDoPlano, modoDia1Cheio, quandoSugerido, sortearBraco,
} from "@/lib/dia1-cheio";
import { ESPERA_AVALIACAO_MS } from "@/components/missao-doses/MissaoDosesNaWeb";
import { PASSAGEM_B_MS } from "@/components/missao-doses/PassoDoDia";
import { conteudoDoLembrete, lerDia2, registrarAbertura, type Leitor } from "@/lib/lembrete-dia2";
import { CHAVE_LEMBRETE_TESTE } from "@/lib/teste-da-loja";

/* ------------------------------------------------------------ o aparelho de mentira */

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  const ouvintes = new Set<() => void>();
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvintes.forEach((o) => o()); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvintes.add(fn); return () => ouvintes.delete(fn); } };
}
type Store = ReturnType<typeof montarStore>;
const Provedor = ({ store, children }: { store: Store; children: ReactNode }) => {
  const [, setN] = useState(0);
  useState(() => store.ouvir(() => setN((n) => n + 1)));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const Rota = () => { const { pathname } = useLocation(); return <p data-testid="rota">{pathname}</p>; };
const HomeFalsa = () => <div><Rota /><p>home de sempre</p></div>;
const FinancasFalsa = () => (
  <div><Rota /><header className="sticky">FINANÇAS</header><div><input placeholder="Novo gasto" /><button type="button" data-spotlight="add-expense">+</button></div><section data-spotlight="add-bill"><h3>MEU MÊS</h3></section></div>
);
/** A Rotina de mentira com o caminho REAL de criar um hábito: "+ Hábito" abre o campo, "Adicionar" grava
 *  `rotina-habits` (como a página), e a tabela tem a linha de HOJE com um quadradinho por hábito que grava
 *  `rotina-habits-checked`. É o que a dose 2 ensina em 2 passos. */
const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const RotinaFalsa = () => {
  const { get, set } = useUserData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const habitos = (get<string[]>("rotina-habits", []) ?? []);
  const grade = get<Record<string, boolean[]>>("rotina-habits-checked", {}) ?? {};
  const adicionar = () => { if (!nome.trim()) return; set("rotina-habits", [...habitos, nome.trim()]); setNome(""); setAberto(false); };
  const marcar = (dia: string, i: number) => { const linha = [...(grade[dia] ?? habitos.map(() => false))]; linha[i] = !linha[i]; set("rotina-habits-checked", { ...grade, [dia]: linha }); };
  return (
    <div>
      <Rota /><header className="sticky">ROTINA</header>
      <button type="button" data-spotlight="add-habit" onClick={() => setAberto((a) => !a)}>+ Hábito</button>
      {aberto && <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={adicionar}>Adicionar</button></div>}
      <table><tbody>{DIAS_ROTINA.map((d) => (
        <tr key={d}><td>{d}</td>{habitos.map((h, i) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} checked={!!grade[d]?.[i]} onChange={() => marcar(d, i)} /></td>)}</tr>
      ))}</tbody></table>
    </div>
  );
};
const SaudeFalsa = () => <div><Rota /><header className="sticky">SAÚDE</header><button type="button" data-spotlight="add-water">+</button></div>;
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
          <Route path="*" element={<Rota />} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );
/** A CONTA NOVA DE VERDADE é VAZIA (10/10, dono): nenhum seed — cada dose tem que funcionar assim. */
const dados = (): Record<string, unknown> => ({});
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** em passos curtos: a missão abre o campo da Rotina por um click que o React só confirma entre os `act` */
const esperarPostIt = () => { for (let i = 0; i < 12; i++) avancar(300); return screen.getAllByTestId("demo-guia-postit").at(-1)!; };
/** toca no 1º chip e chega na festa */
const tocarChipAteAFesta = () => {
  const postIt = esperarPostIt();
  fireEvent.click(within(postIt).getAllByTestId("demo-guia-chip")[0]);
  avancar(700); avancar(1000); avancar(1500); /* 10/10: o olhar rola o card por 1 s, pausa 500 ms e só então monta o anel */
  const entendi = screen.queryByTestId("missao-doses-entendi");
  if (entendi) fireEvent.click(entendi);
  return screen.getByTestId("missao-doses-festa");
};
const missaoGravada = (extra: Record<string, unknown>, inicio = "2026-10-03") => {
  const m = iniciarMissao(["financas", "rotina", "saude"], inicio);
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({ ...m, boasVindas: true, ...extra }));
};
const ligarB = () => guardarForcaDia1Cheio("?dia1-cheio=b");
const ligarA = () => guardarForcaDia1Cheio("?dia1-cheio=a");

beforeEach(() => {
  localStorage.clear();
  // 1.0.16: a dose de Finanças virou o "Vamos montar suas Finanças" — aqui, o caminho de quem PULOU (o 1º gasto pelo chip)
  localStorage.setItem("core-montar-financas", JSON.stringify({ r: "pulou" }));
  eventos.length = 0;
  notif.pedirDia2.mockClear(); notif.proximaDose.mockClear(); nota.pedir.mockClear();
  conta.created_at = new Date(2026, 9, 3, 9, 0).toISOString();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-funnel-area", "dinheiro");
  // o cabeçalho fixo do módulo fica no TOPO (0–56); o resto, em 100–148 (o post-it "colado embaixo da faixa" decide por aí)
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return (this.matches?.("header.sticky, .demo-tour-nav")
      ? { top: 0, left: 0, width: 390, height: 56, bottom: 56, right: 390, x: 0, y: 0, toJSON: () => ({}) }
      : { top: 100, left: 10, width: 300, height: 48, bottom: 148, right: 310, x: 10, y: 100, toJSON: () => ({}) }) as DOMRect;
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 15, 10)); // sábado 03/10/2026, 15:10
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); delete (window as { Capacitor?: unknown }).Capacitor; });
import {
  CHAVE_ORIGEM_APARELHO, CHAVE_ORIGEM_CONTA, _zerarHomeNova, classificarOrigem, contaEhNova, definirContaHomeNova, guardarAdmin, homeNovaLigada,
  homeNovaLigadaSincrona, homeNovaPrecisaDeAdmin, lerHomeNovaRemoto, origemConhecida, registrarHomeNovaRemoto, registrarOrigem, camposHomeNova,
} from "@/lib/home-nova";
import { OrigemDaContaNaSessao } from "@/components/home-nova/OrigemDaConta";
import { CHAVE_MISSAO_NA_CONTA, dicaDoDiaDevida, totalDePassos } from "@/lib/missao-doses";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CHAVE_DICA_MAIS, ESPERA_DICA_MAIS_MS, dicaDoMaisDevida } from "@/lib/dica-mais";
import { CardMetrica, type Metrica } from "@/components/home-nova/e/PaginaSeuDia";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { BarraVidroGlobal, __zerarDicaDaBarraVidro, __zerarPilhaDaBarraVidro } from "@/components/home-nova/e/BarraVidroGlobal";
import { CalendarCheck } from "lucide-react";
import { TOM_DO_TIPO } from "@/components/home-nova/e/paleta";

const offerings = (home_nova: string) => ({ current: { metadata: { home_nova } }, all: {} });
/** o modo "novas" com a conta u1 já classificada */
const novas = (origem: "nova" | "antiga", modo = "novas") => {
  registrarHomeNovaRemoto(offerings(modo));
  definirContaHomeNova("u1");
  registrarOrigem("u1", origem);
};
const tres = { 1: { dia: "2026-10-03", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" }, 3: { dia: "2026-10-03", rotulo: "c" } };

beforeEach(() => { _zerarHomeNova(); });

/* ================================================================== a chave: "novas" e "novas+admin" */
describe("home_nova — modos 'novas' e 'novas+admin' (sem A/B)", () => {
  it("lê os dois valores novos (espaço/maiúscula não atrapalham); os antigos seguem", () => {
    expect(lerHomeNovaRemoto(offerings("novas"))).toBe("novas");
    expect(lerHomeNovaRemoto(offerings(" Novas + Admin "))).toBe("novas+admin");
    expect(lerHomeNovaRemoto(offerings("admin+novas"))).toBe("novas+admin");
    for (const v of ["off", "admin", "on", "ab"]) expect(lerHomeNovaRemoto(offerings(v))).toBe(v);
  });
  it("novas: conta NOVA liga; antiga e desconhecida não (nem o admin)", () => {
    registrarHomeNovaRemoto(offerings("novas"));
    expect(homeNovaLigada(null, "nova")).toBe(true);
    expect(homeNovaLigada(true, "antiga")).toBe(false);
    expect(homeNovaLigada(true, null)).toBe(false);
    expect(homeNovaPrecisaDeAdmin()).toBe(false);
  });
  it("novas+admin: conta nova OU o dono; cliente antigo não", () => {
    registrarHomeNovaRemoto(offerings("novas+admin"));
    expect(homeNovaPrecisaDeAdmin()).toBe(true);
    expect(homeNovaLigada(false, "nova")).toBe(true);
    expect(homeNovaLigada(true, "antiga")).toBe(true);
    expect(homeNovaLigada(false, "antiga")).toBe(false);
    expect(homeNovaLigada(null, null)).toBe(false);
  });
  it("sem React: a conta da sessão + espelho do aparelho (abre o app de novo e vale sem esperar a conta)", () => {
    novas("nova");
    expect(homeNovaLigadaSincrona()).toBe(true);
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:nova");
    expect(camposHomeNova()).toEqual({ home_nova: "nova" });
    _zerarHomeNova(); registrarHomeNovaRemoto(offerings("novas")); definirContaHomeNova("u1"); // reabriu
    expect(origemConhecida("u1")).toBe("nova");
    expect(homeNovaLigadaSincrona()).toBe(true);
    expect(homeNovaLigadaSincrona("outra-conta")).toBe(false); // o espelho é POR conta
  });
  it("novas+admin: o dono (admin guardado) vê, mesmo com a conta antiga", () => {
    novas("antiga", "novas+admin");
    expect(homeNovaLigadaSincrona()).toBe(false);
    guardarAdmin("u1", true);
    expect(homeNovaLigadaSincrona()).toBe(true);
  });
  it("as chaves novas: espelho e dica são do aparelho (vassoura não leva); o marcador é da conta", () => {
    expect(ehChaveDoAparelho(CHAVE_ORIGEM_APARELHO)).toBe(true);
    expect(ehChaveDoAparelho(CHAVE_DICA_MAIS)).toBe(true);
    expect(vassouraLeva(CHAVE_ORIGEM_CONTA)).toBe(true); // no aparelho, só o cache u:<id>: (volta pela conta)
  });
});

/* ================================================================== a regra de "conta nova" */
describe("origem da conta — a regra (classificarOrigem) e a gravação (OrigemDaContaNaSessao)", () => {
  const agora = new Date(2026, 9, 3, 15, 10).getTime();
  it("regra pura: app + conta < 48 h + sem missão de antes = nova; o resto é antiga", () => {
    const h = (n: number) => new Date(agora - n * 3600e3).toISOString();
    expect(classificarOrigem({ nativo: true, criadoEm: h(1), temMissaoDeAntes: false, agora })).toBe("nova");
    expect(classificarOrigem({ nativo: true, criadoEm: h(47), temMissaoDeAntes: false, agora })).toBe("nova");
    expect(classificarOrigem({ nativo: true, criadoEm: h(49), temMissaoDeAntes: false, agora })).toBe("antiga"); // já tinha conta, começa o teste agora
    expect(classificarOrigem({ nativo: true, criadoEm: h(24 * 400), temMissaoDeAntes: false, agora })).toBe("antiga"); // cliente antigo reinstalando
    expect(classificarOrigem({ nativo: true, criadoEm: h(2), temMissaoDeAntes: true, agora })).toBe("antiga"); // começou o teste na 1.0.18
    expect(classificarOrigem({ nativo: false, criadoEm: h(1), temMissaoDeAntes: false, agora })).toBe("antiga");
    expect(classificarOrigem({ nativo: true, criadoEm: null, temMissaoDeAntes: false, agora })).toBe("antiga");
  });

  const montarOrigem = (store: Store) => render(<Provedor store={store}><OrigemDaContaNaSessao /></Provedor>);

  it("conta NOVA no app: grava { tipo: nova } na conta + espelho, e a Home nova liga no modo 'novas'", () => {
    registrarHomeNovaRemoto(offerings("novas"));
    conta.created_at = new Date(2026, 9, 3, 14, 0).toISOString();
    const store = montarStore({});
    montarOrigem(store);
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "nova", versao: "1.0.19" }));
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:nova");
    expect(contaEhNova()).toBe(true);
    expect(homeNovaLigadaSincrona()).toBe(true);
  });
  it("cliente ANTIGO (conta de meses) reinstalando: antiga, e nunca liga", () => {
    registrarHomeNovaRemoto(offerings("novas"));
    conta.created_at = new Date(2026, 3, 1).toISOString();
    const store = montarStore({});
    montarOrigem(store);
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "antiga" }));
    expect(homeNovaLigadaSincrona()).toBe(false);
  });
  it("conta de 1 dia que começou o teste numa versão anterior (missão na conta): antiga", () => {
    conta.created_at = new Date(2026, 9, 2, 20, 0).toISOString();
    const store = montarStore({ [CHAVE_MISSAO_NA_CONTA]: { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-02"), boasVindas: true } });
    montarOrigem(store);
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "antiga" }));
  });
  it("uma vez nova, nova pra sempre: o marcador da conta vence a data (reinstalou meses depois, outro aparelho)", () => {
    registrarHomeNovaRemoto(offerings("novas"));
    conta.created_at = new Date(2026, 3, 1).toISOString();
    const marcador = { tipo: "nova", em: "2026-04-01T10:00:00.000Z", versao: "1.0.19", regra: "x" };
    const store = montarStore({ [CHAVE_ORIGEM_CONTA]: marcador });
    montarOrigem(store);
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toBe(marcador); // não regrava
    expect(homeNovaLigadaSincrona()).toBe(true);
  });
  it("marcador 'antiga' vence o espelho do aparelho e a data recente", () => {
    localStorage.setItem(CHAVE_ORIGEM_APARELHO, "u1:nova");
    const store = montarStore({ [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } });
    montarOrigem(store);
    expect(origemConhecida("u1")).toBe("antiga");
    expect(localStorage.getItem(CHAVE_ORIGEM_APARELHO)).toBe("u1:antiga");
  });
  it("a decisão é UMA: a missão que nasce depois (na mesma abertura) não vira a conta nova em antiga", () => {
    const store = montarStore({});
    const t = montarOrigem(store);
    expect(origemConhecida("u1")).toBe("nova");
    act(() => { store.valor().set(CHAVE_MISSAO_NA_CONTA, { ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true }); });
    t.rerender(<Provedor store={store}><OrigemDaContaNaSessao /></Provedor>);
    expect(origemConhecida("u1")).toBe("nova");
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toEqual(expect.objectContaining({ tipo: "nova" }));
  });
  it("no site (navegador): nada é decidido nem gravado (a conta da Porta decide ao abrir o app)", () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    const store = montarStore({});
    montarOrigem(store);
    expect(store.dados[CHAVE_ORIGEM_CONTA]).toBeUndefined();
    expect(origemConhecida("u1")).toBeNull();
  });
});

/* ================================================================== 1. a missão sem tour com a Home nova */
describe("missão com a Home nova: segue SEM o tour antigo", () => {
  it("o tour antigo está aposentado pra conta da sessão (mesmo numa build com o tour ligado)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    expect(tourHomeLigado()).toBe(true);
    novas("nova");
    expect(tourHomeLigado()).toBe(false);
    expect(deveMostrarTourHome(conta.created_at)).toBe(false);
  });
  it("braço B, build COM tour, conta ANTIGA no 'novas': a faixa 'Missão · 4 de 4' (o de hoje, intacto)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarB(); novas("antiga");
    missaoGravada({ braco: "B", feitos: tres });
    montar(montarStore(dados()), "/home");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("Missão · 4 de 4");
    expect(lerMissao()?.homeTour).toBeUndefined();
  });
  it("braço B, conta NOVA: nenhuma faixa (a barra/'+' nunca fica coberta), o 4º passo fecha sozinho e o 'Plano de amanhã' vem", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarB(); novas("nova");
    missaoGravada({ braco: "B", feitos: tres });
    const completou = vi.fn();
    window.addEventListener(EVENTO_MISSAO_COMPLETA, completou);
    montar(montarStore(dados()), "/home");
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(document.documentElement.hasAttribute("data-missao-doses-faixa")).toBe(false);
    expect(lerMissao()?.homeTour).toEqual({ dia: "2026-10-03", via: "home_nova" });
    expect(eventos).toContainEqual(["missao_completa", expect.objectContaining({ variante: "B", home: "home_nova" })]);
    expect(completou).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument(); // a hora do lembrete; a nota é pedida no "Combinado"
    expect(totalDePassos(lerMissao())).toBe(3);
    window.removeEventListener(EVENTO_MISSAO_COMPLETA, completou);
  });
  it("braço B, conta NOVA: as boas-vindas não prometem 'Depois a gente arruma sua Home junto' (conta antiga: sim)", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarB(); novas("antiga");
    let t = montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    expect(screen.getByTestId("missao-doses-depois")).toBeInTheDocument();
    t.unmount(); localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    registrarOrigem("u1", "nova");
    t = montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-vamos-la"));
    expect(screen.getByTestId("missao-doses-comecar")).toBeInTheDocument();
    expect(screen.queryByTestId("missao-doses-depois")).toBeNull();
  });
  it("braço B, conta NOVA: a 3ª dose não fala de 'arrumar a Home' — 'Missão de hoje · 3 de 3' e 'Ver minha Home'", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarB(); novas("nova");
    missaoGravada({ braco: "B", feitos: { 1: { dia: "2026-10-03", rotulo: "Café · R$ 12" }, 2: { dia: "2026-10-03", rotulo: "Beber água ao acordar marcado" } } });
    montar(montarStore(dados()), "/saude");
    expect(screen.getByTestId("missao-doses-faixa")).toHaveTextContent("dose 3 de 3");
    const festa = tocarChipAteAFesta();
    expect(festa).toHaveTextContent("Missão de hoje · 3 de 3");
    expect(screen.queryByTestId("missao-doses-falta-home")).toBeNull();
    expect(screen.getByTestId("missao-doses-fechar-dia")).toHaveTextContent("Ver minha Home");
    fireEvent.click(screen.getByTestId("missao-doses-fechar-dia"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/home");
    expect(screen.queryByTestId("missao-doses-faixa")).toBeNull();
    expect(screen.getByTestId("plano-amanha")).toBeInTheDocument();
  });
  it("braço A, build COM tour: conta antiga espera o tour; conta NOVA ganha o 'Plano de amanhã' (hora do lembrete do dia 2) na hora", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarA(); novas("antiga");
    missaoGravada({ braco: "A", feitos: { 1: { dia: "2026-10-03", rotulo: "a" } } });
    const t = montar(montarStore(dados()), "/home");
    avancar(2000);
    expect(screen.queryByTestId("plano-amanha-a")).toBeNull(); // segurado pelo tour curto
    t.unmount();
    registrarOrigem("u1", "nova");
    montar(montarStore(dados()), "/home");
    avancar(2000);
    expect(screen.getByTestId("plano-amanha-a")).toBeInTheDocument();
  });
  it("braço A, conta NOVA: a festa da dose 1 diz 'Ver minha Home' (nada de 'Conhecer minha Home' nem 'Falta só conhecer sua Home')", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    ligarA(); novas("nova");
    montar(montarStore(dados()), "/home");
    fireEvent.click(screen.getByTestId("missao-doses-comecar"));
    tocarChipAteAFesta();
    expect(screen.getByTestId("missao-doses-continuar")).toHaveTextContent(/^Ver minha Home$/);
    expect(screen.queryByTestId("missao-doses-falta-home")).toBeNull();
  });
  it("dicas dos dias 2/3 (score antigo / 'Adicionar widget') não existem com a Home nova", () => {
    ligarA();
    missaoGravada({ braco: "A", fimVisto: true, feitos: { 1: { dia: "2026-10-01", rotulo: "a" }, 2: { dia: "2026-10-03", rotulo: "b" } } }, "2026-10-01");
    expect(dicaDoDiaDevida(lerMissao())).toBe(2);
    novas("nova");
    expect(dicaDoDiaDevida(lerMissao())).toBeNull();
  });
  it("'Casa arrumada' (fazer o tour) sai do álbum com a Home nova — não dá pra ganhar", () => {
    vi.stubEnv("VITE_V14_LOJA", "1");
    const ler = <T,>(_k: string, f: T) => f;
    expect(buildBadgesVida(ler).some((b) => b.id === "casa-arrumada")).toBe(true);
    novas("nova");
    expect(buildBadgesVida(ler).some((b) => b.id === "casa-arrumada")).toBe(false);
  });
  it("as festas não ficam represadas: com o plano decidido, missaoDoDiaEmCena libera (B)", () => {
    ligarB(); novas("nova");
    missaoGravada({ braco: "B", feitos: tres });
    montar(montarStore(dados()), "/home");
    expect(missaoDoDiaEmCena(lerMissao())).toBe(true);
    fireEvent.click(screen.getByTestId("plano-amanha-pular"));
    expect(missaoDoDiaEmCena(lerMissao())).toBe(false);
  });
});

/* ================================================================== 3. a dica do "+" */
describe("a dica do '+': depois da 1ª dose, some no 1º toque, nunca volta", () => {
  const m = (extra: Record<string, unknown>) => ({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true, braco: "A" as const, ...extra });
  it("regra: antes da 1ª dose não; com a missão do dia em cena (plano por decidir) não; depois sim; quem explorou também", () => {
    ligarA();
    expect(dicaDoMaisDevida(null)).toBe(false);
    expect(dicaDoMaisDevida(m({}))).toBe(false);
    expect(dicaDoMaisDevida(m({ feitos: { 1: { dia: "2026-10-03", rotulo: "a" } } }))).toBe(false); // falta o plano de amanhã
    expect(dicaDoMaisDevida(m({ feitos: { 1: { dia: "2026-10-03", rotulo: "a" } }, lembrete: "20:00" }))).toBe(true);
    expect(dicaDoMaisDevida(m({ explorou: true }))).toBe(true);
    expect(dicaDoMaisDevida(m({ explorou: true }), { feita: "x" })).toBe(false); // tocada em outro aparelho (conta)
  });
});

describe("a dica do '+' na barra de vidro (fechar e reabrir o app)", () => {
  const abrirApp = (store: Store, comCamada = false) => {
    __zerarDicaDaBarraVidro(); __zerarPilhaDaBarraVidro(); // uma abertura nova do app
    const t = render(
      <MemoryRouter initialEntries={["/home"]}>
        <Provedor store={store}>
          <div data-nav-raiz="hoje" />
          {comCamada && <div data-camada-guia="missao-doses-plano" />}
          <BarraVidroGlobal />
        </Provedor>
      </MemoryRouter>,
    );
    avancar(40); // a barra relê a tela no próximo quadro (a raiz já montada)
    return t;
  };
  beforeEach(() => {
    // o quadro da barra (requestAnimationFrame) no relógio de mentira
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    ligarA(); novas("nova");
    missaoGravada({ braco: "A", feitos: { 1: { dia: "2026-10-03", rotulo: "a" } }, lembrete: "20:00" });
  });
  it("aparece presa ao '+' depois da espera; o toque no '+' encerra (usada) e ela NUNCA volta, nem reabrindo o app", () => {
    const store = montarStore({});
    const t = abrirApp(store);
    expect(screen.getByTestId("hn-mais")).toBeInTheDocument();
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
    avancar(ESPERA_DICA_MAIS_MS + 50);
    const dica = screen.getByTestId("hn-dica-mais");
    expect(dica).toHaveTextContent("pra anotar qualquer coisa do seu dia");
    expect(screen.getByTestId("hn-mais").parentElement?.contains(dica)).toBe(true); // ancorada no "+"
    expect(eventos).toContainEqual(["home_dica_mais", expect.objectContaining({ acao: "vista", aparicao: 1 })]);
    fireEvent.pointerDown(screen.getByTestId("hn-mais"));
    // nada muda NO MEIO do toque (o WebKit do iPhone engolia o clique do "+"): a dica sai com o clique
    expect(screen.getByTestId("hn-dica-mais")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("hn-mais"));
    avancar(10);
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
    expect(eventos).toContainEqual(["home_dica_mais", { acao: "usada" }]);
    expect(store.dados[CHAVE_DICA_MAIS]).toEqual(expect.objectContaining({ via: "usada" }));
    t.unmount();
    abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS * 3);
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
    // reinstalou (o aparelho zerado): a marca da CONTA segura
    localStorage.removeItem(CHAVE_DICA_MAIS);
    cleanup();
    abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS * 3);
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
  });
  it("toque em qualquer outro lugar também encerra (dispensada)", () => {
    const store = montarStore({});
    abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS + 50);
    fireEvent.pointerDown(document.body); // virou rolagem (sem clique): sai sozinha em 700 ms
    expect(screen.getByTestId("hn-dica-mais")).toBeInTheDocument();
    avancar(720);
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
    expect(eventos).toContainEqual(["home_dica_mais", { acao: "dispensada" }]);
  });
  it("fechou o app com ela na tela, sem tocar: volta 1 vez (2ª aparição) e depois nunca mais", () => {
    const store = montarStore({});
    let t = abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS + 50);
    expect(screen.getByTestId("hn-dica-mais")).toBeInTheDocument();
    t.unmount();
    t = abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS + 50);
    expect(screen.getByTestId("hn-dica-mais")).toBeInTheDocument();
    t.unmount();
    abrirApp(store);
    avancar(ESPERA_DICA_MAIS_MS * 3);
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
  });
  it("com uma camada guiada por cima (o 'Plano de amanhã', uma festa) a barra sai — e a dica junto", () => {
    abrirApp(montarStore({}), true);
    avancar(ESPERA_DICA_MAIS_MS * 3);
    expect(screen.queryByTestId("hn-barra")).toBeNull();
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
  });
  it("antes da 1ª dose: barra sim, dica não", () => {
    missaoGravada({ braco: "A" });
    abrirApp(montarStore({}));
    avancar(ESPERA_DICA_MAIS_MS * 3);
    expect(screen.getByTestId("hn-mais")).toBeInTheDocument();
    expect(screen.queryByTestId("hn-dica-mais")).toBeNull();
  });
});

/* ================================================================== 4. "Criar" */
describe("resumo sem meta = 'Criar'", () => {
  const habitos = (valor: number, max: number): Metrica => ({ id: "habitos", rotulo: "Hábitos", valor, max, Icone: CalendarCheck, tom: TOM_DO_TIPO.habitos, route: "/rotina" });
  it("Hábitos 0/0 vira 'Criar hábito' com o anel tracejado (sem '0/0'); com hábito, o de sempre", () => {
    const t = render(<MemoryRouter><CardMetrica m={habitos(0, 0)} atraso={0} onAcao={() => {}} onMais={() => {}} /></MemoryRouter>);
    const card = screen.getByTestId("he-metrica");
    expect(card).toHaveAttribute("data-criar");
    expect(screen.getByTestId("he-metrica-criar")).toHaveTextContent("Criar hábito");
    expect(screen.getByTestId("he-anel-criar")).toBeInTheDocument();
    expect(card.textContent).not.toContain("/0");
    t.unmount();
    render(<MemoryRouter><CardMetrica m={habitos(1, 3)} atraso={0} onAcao={() => {}} onMais={() => {}} /></MemoryRouter>);
    expect(screen.getByTestId("he-metrica")).not.toHaveAttribute("data-criar");
    expect(screen.getByTestId("he-metrica").textContent).toContain("/3");
  });
  it("tocar no 'Criar hábito' leva pra Rotina", () => {
    render(<MemoryRouter initialEntries={["/home"]}><Routes><Route path="/home" element={<CardMetrica m={habitos(0, 0)} atraso={0} onAcao={() => {}} onMais={() => {}} />} /><Route path="*" element={<Rota />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByTestId("he-metrica"));
    expect(screen.getByTestId("rota")).toHaveTextContent("/rotina");
  });
});

/* ================================================================== 5. score sem pontos de graça só pra conta nova */
describe("score: sem os ~25 pontos 'de graça' só pra conta NOVA", () => {
  const Sonda = () => { const d = useLifeHubData(); return <p data-testid="score" data-cobrados={(d.pendenciasCobradas ?? []).join(",")}>{d.dayScore}</p>; };
  const scoreDe = (inicial: Record<string, unknown>) => {
    const t = render(<Provedor store={montarStore(inicial)}><Sonda /></Provedor>);
    const el = screen.getByTestId("score");
    const r = { score: Number(el.textContent), cobrados: el.getAttribute("data-cobrados")!.split(",") };
    t.unmount();
    return r;
  };
  it("conta vazia: antiga (sem marcador) segue com 25 (treino 15 + leitura 5 + suplementos 5); nova abre com 0", () => {
    expect(scoreDe({}).score).toBe(25);
    const nova = scoreDe({ [CHAVE_ORIGEM_CONTA]: { tipo: "nova" } });
    expect(nova.score).toBe(0);
    expect(nova.cobrados).not.toContain("treino");
    expect(nova.cobrados).not.toContain("leitura");
    expect(nova.cobrados).not.toContain("suplementos");
    expect(scoreDe({ [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } }).score).toBe(25);
  });
  it("conta nova: o que ela FAZ conta (8 copos de água sobem o score do 0)", () => {
    const hoje = "2026-10-03";
    const tudo = {
      [CHAVE_ORIGEM_CONTA]: { tipo: "nova" },
      "core-saude-water": { [hoje]: 8 },
    };
    const s = scoreDe(tudo);
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(100);
  });
  it("conta nova COM cadastro (livro em leitura): a leitura volta a ser cobrada (sem ponto de graça, com ponto de verdade)", () => {
    const s = scoreDe({ [CHAVE_ORIGEM_CONTA]: { tipo: "nova" }, "lib-books": [{ id: "b1", title: "Livro", status: "lendo", pages: 100, currentPage: 10 }] });
    expect(s.cobrados).toContain("leitura");
  });
  it("conta nova sabida pela sessão (antes de o marcador subir pra conta) já não ganha os pontos", () => {
    novas("nova");
    expect(scoreDe({}).score).toBe(0);
  });
});
