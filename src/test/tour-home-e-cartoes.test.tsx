/**
 * TOUR DA HOME + CARTÕES DE BOAS-VINDAS DO MÓDULO (10/10, lib/tour-home) — o que este arquivo trava:
 *   · as 3 chaves DESLIGADAS (sem força) = o app de hoje: nenhum cartão, nenhum tour, nenhum evento,
 *     nada no storage, o álbum com os mesmos adesivos, módulo oculto sem efeito nas pendências;
 *   · a força pelo link só vale no navegador (no app das lojas a chave decide);
 *   · os cartões: 3 páginas, bolinhas, "Já sei" sempre visível, a miniatura VIVA, "Fazer agora" acende o
 *     alvo real, nunca empilham com outra guia, 1x por aparelho (+ `core-tip-seen-*` na conta);
 *   · a Beleza troca o "Dicas pra começar" pelos cartões só com a chave ligada;
 *   · o tour: quando aparece (deveMostrarTourHome), os 5 passos com ação de 1 toque ou "Deixar como está",
 *     o que cada ação grava, os eventos, o fim (chave no aparelho e na conta) e o adesivo "Casa arrumada";
 *   · módulo oculto ⇒ pendências dele não cobradas (derivado, sem mexer em `home-pendencias-prefs`; religar volta).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const nativo = vi.hoisted(() => ({ v: false }));
const trial = vi.hoisted(() => ({ ativo: false }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
vi.mock("@/lib/teste-gratis", async (orig) => ({ ...(await orig<typeof import("@/lib/teste-gratis")>()), trialCartaoAtivo: () => trial.ativo }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", created_at: new Date().toISOString() }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/image-upload", () => ({ uploadFromInput: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })) }) } },
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { ModuleDrawer } from "@/components/home/ModuleDrawer";
import { EVENTO_ACAO_RAPIDA } from "@/components/home/QuickActions";
import { TourDaHome, TOTAL_PASSOS, ASSENTA_MS } from "@/components/home/TourDaHome";
import { CartoesDoModulo, guiaDoModuloAtiva } from "@/components/cartoes-modulo/CartoesDoModulo";
import { cartoesFinancas } from "@/components/cartoes-modulo/cartoes-financas";
import Beleza from "@/pages/Beleza";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { raridadeDe } from "@/components/gamification/types";
import { temArte } from "@/components/conquistas/adesivos-arte";
import {
  CARTOES_MODULO, TOUR_HOME, MODULO_OCULTA_PENDENCIAS, CHAVE_TOUR_FEITO, CHAVE_FORCA_CARTOES, CHAVE_FORCA_TOUR_HOME, CHAVE_FORCA_MODULO_OCULTA,
  cartoesLigados, tourHomeLigado, moduloOcultaPendenciasLigado, guardarForcasDaUrl, deveMostrarTourHome, chaveCartoesVistos,
} from "@/lib/tour-home";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, TIPOS_DO_MODULO, tiposCobradosHoje, tiposDosModulosOcultos, type PendenciasPrefs } from "@/lib/home-pendencias";
import { CHAVE_ESTADO_MISSAO_DOSES, CHAVE_FORCA_MISSAO_DOSES, gravarMissao, iniciarMissao } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";
import { prepararJsdom } from "./compat-comum";

/* ------------------------------------------------------------ o aparelho de mentira */
type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados, escritas: [] as string[] };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode, rota = "/") => render(<MemoryRouter initialEntries={[rota]}><Provedor>{ui}</Provedor></MemoryRouter>);
  const ler = <T,>(k: string) => estado.dados[k] as T;
  const get = <T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f);
  return { estado, Provedor, montar, ler, get };
}

const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const hoje = () => localDayKey();
/** Uma conta com Rotina, Treino, Água e Dieta (refeições pendentes) — pendências de sobra pro tour. */
const CONTA = (): Dados => ({
  "core-user-name": "Ana",
  "rotina-habits": [{ id: "h1", name: "Meditar" }],
  "core-rotina-habit-log": { [hoje()]: { h1: true } },
  "saude-workouts-v2": { [DIAS[new Date().getDay()]]: { muscles: ["Pernas"] } },
  "treino-active-days": [DIAS[new Date().getDay()]],
  "saude-workout-log": [hoje()],
  "core-saude-water": { [hoje()]: 8 },
  "saude-meals": { [DIAS[new Date().getDay()]]: { "Café da Manhã": "Pão", "Almoço": "Arroz" } },
  "conquistas-vistas": { adesivos: [], marcos: [] },
  "conquistas-desbloqueadas": {},
});
const nomes = () => eventos.map(([n]) => n);
const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);
const ligar = (...chaves: string[]) => chaves.forEach((c) => localStorage.setItem(c, "on"));

beforeAll(prepararJsdom);
beforeEach(() => { localStorage.clear(); eventos.length = 0; nativo.v = false; trial.ativo = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ================================================================== 0. desligado = hoje */
describe("chaves desligadas (padrão) = o app de hoje, byte a byte", () => {
  it("as três chaves nascem off e nada liga sem força", () => {
    expect(CARTOES_MODULO).toBe("off"); expect(TOUR_HOME).toBe("off"); expect(MODULO_OCULTA_PENDENCIAS).toBe("off");
    expect(cartoesLigados()).toBe(false); expect(tourHomeLigado()).toBe(false); expect(moduloOcultaPendenciasLigado()).toBe(false);
    expect(deveMostrarTourHome(new Date().toISOString())).toBe(false);
  });

  it("Finanças: os cartões não existem (nem nó, nem evento, nem storage)", () => {
    const s = criarStore(CONTA());
    s.montar(<CartoesDoModulo config={cartoesFinancas({ irParaFinanceiro: () => {} })} />, "/financas");
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos).toEqual([]);
    expect(localStorage.length).toBe(0);
    expect(s.estado.escritas).toEqual([]);
  });

  it("Beleza: o 'Dicas pra começar' de sempre, sem cartões", () => {
    const s = criarStore({});
    s.montar(<Beleza />, "/beleza");
    expect(screen.getByTestId("dicas-beleza")).toBeInTheDocument();
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });

  it("álbum: 'Casa arrumada' não está no catálogo (os 65 de sempre)", () => {
    const s = criarStore({ [CHAVE_TOUR_FEITO]: "2026-10-10" });
    expect(buildBadgesVida(s.get).find((b) => b.id === "casa-arrumada")).toBeUndefined();
  });

  it("módulo oculto NÃO mexe nas pendências (a regra derivada só vale com a chave)", () => {
    const s = criarStore({ ...CONTA(), "core-module-prefs": { favorites: [], hidden: ["dieta", "saude"], order: [] } });
    const { result } = renderHook(() => useLifeHubData(), { wrapper: s.Provedor });
    expect(result.current.pendenciasCobradas).toContain("refeicoes");
    expect(result.current.pendenciasCobradas).toContain("agua");
    expect(result.current.pendenciasPorModulo).toEqual([]);
  });
});

/* ================================================================== 1. a força do link */
describe("força de QA pelo link — só no navegador", () => {
  it("?cartoes=on&tour-home=recomecar&modulo-oculta-pendencias=on liga os três e apaga o 'já vi' do tour; auto desfaz", () => {
    localStorage.setItem(CHAVE_TOUR_FEITO, "x");
    guardarForcasDaUrl("?cartoes=on&tour-home=recomecar&modulo-oculta-pendencias=on");
    expect(cartoesLigados()).toBe(true); expect(tourHomeLigado()).toBe(true); expect(moduloOcultaPendenciasLigado()).toBe(true);
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).toBeNull();
    guardarForcasDaUrl("?cartoes=auto&tour-home=off");
    expect(cartoesLigados()).toBe(false); expect(tourHomeLigado()).toBe(false); expect(moduloOcultaPendenciasLigado()).toBe(true);
  });

  it("no app das lojas a força é ignorada: só a chave do código decide", () => {
    nativo.v = true;
    guardarForcasDaUrl("?cartoes=on&tour-home=on");
    expect(localStorage.getItem(CHAVE_FORCA_CARTOES)).toBeNull();
    localStorage.setItem(CHAVE_FORCA_TOUR_HOME, "on");
    expect(tourHomeLigado()).toBe(false);
    expect(cartoesLigados("on")).toBe(true);
  });
});

/* ================================================================== 2. os cartões */
describe("cartões de boas-vindas — Finanças (força on)", () => {
  beforeEach(() => ligar(CHAVE_FORCA_CARTOES));

  it("5 cartões, bolinhas, 'Já sei' sempre visível, a miniatura VIVA com a tabela real e o dedinho; eventos", async () => {
    const s = criarStore(CONTA());
    s.montar(<CartoesDoModulo config={cartoesFinancas({ irParaFinanceiro: () => {} })} />, "/financas");
    const raiz = screen.getByTestId("cartoes-modulo");
    expect(raiz.getAttribute("data-modulo")).toBe("financas");
    expect(raiz.className).toContain("ct-financas");
    expect(raiz.querySelectorAll("article")).toHaveLength(5); // os fora da tela ficam aria-hidden
    expect(screen.getByText("Faz isso agora", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Seus gastos, mês a mês", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("O que não precisa hoje", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("cartoes-ja-sei")).toBeVisible();
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("1 de 5");
    // o cartão 2: o componente REAL (a tabela de gastos, com o "+ Novo gasto") em memória, com dedinho
    const minis = screen.getAllByTestId("miniatura");
    expect(minis).toHaveLength(4);
    const mini = minis[1];
    expect(mini.textContent).toContain("CUSTOS VARIÁVEIS");
    expect(mini.querySelector('input[placeholder*="Novo gasto"]')).not.toBeNull();
    expect(mini.querySelector("[inert]")).not.toBeNull();
    expect(screen.getAllByTestId("dedinho").length).toBeGreaterThan(0);
    expect(raiz.querySelector("[data-figurinha-placeholder]")).not.toBeNull();
    expect(nomes()).toEqual(["modulo_cartoes_vistos", "modulo_cartao"]);
    expect(dos("modulo_cartao")[0]).toEqual({ moduleId: "financas", indice: 0 });
    // bolinha 2 → "2 de 5" + evento do cartão 1
    fireEvent.click(screen.getByTestId("cartoes-bolinha-1"));
    expect(screen.getByTestId("cartoes-contador").textContent).toBe("2 de 5");
    expect(dos("modulo_cartao").at(-1)).toEqual({ moduleId: "financas", indice: 1 });
    // "Já sei": some, marca o aparelho E a conta (o Dicas antigo não volta), evento com o índice
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(localStorage.getItem(chaveCartoesVistos("financas"))).toBeTruthy();
    expect(s.ler("core-tip-seen-financas")).toBe("true");
    expect(dos("modulo_cartoes_fechados")).toEqual([{ moduleId: "financas", indice: 1 }]);
    // a miniatura não gravou NADA na conta (só o carimbo do Já sei)
    expect(s.estado.escritas).toEqual(["core-tip-seen-financas"]);
    // 1x por aparelho: não volta
    cleanup();
    s.montar(<CartoesDoModulo config={cartoesFinancas({ irParaFinanceiro: () => {} })} />, "/financas");
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
  });

  it("'Fazer agora': troca pra aba certa, fecha os cartões e acende o campo real", async () => {
    const s = criarStore(CONTA());
    const irPara = vi.fn();
    s.montar(<><button type="button" data-spotlight="add-expense">+</button><CartoesDoModulo config={cartoesFinancas({ irParaFinanceiro: irPara })} /></>, "/financas");
    fireEvent.click(screen.getByTestId("cartoes-fazer-agora"));
    expect(irPara).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(dos("modulo_cartao_fazer_agora")).toEqual([{ moduleId: "financas" }]);
    expect(await screen.findByTestId("cartoes-anel")).toBeInTheDocument();
    expect(localStorage.getItem(chaveCartoesVistos("financas"))).toBeTruthy();
  });

  it("não empilha: com outra guia na tela (holofote, missão) os cartões não aparecem e NÃO contam como vistos", () => {
    const s = criarStore(CONTA());
    s.montar(<><div data-camada-guia="spotlight" /><CartoesDoModulo config={cartoesFinancas({ irParaFinanceiro: () => {} })} /></>, "/financas");
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(eventos).toEqual([]);
    expect(localStorage.getItem(chaveCartoesVistos("financas"))).toBeNull();
    // as regras sem DOM: tutorial de recém-cadastrado, replay, missão em doses com o passo DESTE módulo
    cleanup(); // tira a guia de mentira do DOM
    expect(guiaDoModuloAtiva("financas", s.get)).toBe(false);
    expect(guiaDoModuloAtiva("financas", <T,>(k: string, f: T) => (k === "tutorial-replay-modules" ? (["financas"] as unknown as T) : f))).toBe(true);
    localStorage.setItem("force-new-user-tutorial", "true");
    expect(guiaDoModuloAtiva("financas", s.get)).toBe(true);
    localStorage.removeItem("force-new-user-tutorial");
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true;
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    iniciarMissao(["financas", "rotina", "saude"]);
    expect(guiaDoModuloAtiva("financas", s.get)).toBe(true);
    expect(guiaDoModuloAtiva("beleza", s.get)).toBe(false);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    delete (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__;
  });
});

describe("cartões de boas-vindas — Beleza (força on)", () => {
  it("substitui o 'Dicas pra começar': cartões na paleta da Beleza, a rotina real em miniatura", () => {
    ligar(CHAVE_FORCA_CARTOES);
    const s = criarStore({});
    s.montar(<Beleza />, "/beleza");
    const raiz = screen.getByTestId("cartoes-modulo");
    expect(raiz.getAttribute("data-modulo")).toBe("beleza");
    expect(raiz.className).toContain("ct-beleza");
    expect(screen.queryByTestId("dicas-beleza")).toBeNull();
    expect(screen.getAllByTestId("miniatura").some((m) => m.querySelector(".tema-beleza"))).toBe(true);
    expect(screen.getAllByText(/Monta sua rotina de skincare em 3 toques/)).not.toHaveLength(0);
    // "Já sei" devolve a Beleza de sempre — e o Dicas também fica como visto
    fireEvent.click(screen.getByTestId("cartoes-ja-sei"));
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.queryByTestId("dicas-beleza")).toBeNull();
    expect(s.ler("core-tip-seen-beleza")).toBe("true");
  });
});

/* ================================================================== 3. quando o tour aparece */
describe("deveMostrarTourHome — a régua", () => {
  const agora = Date.now();
  const novo = new Date(agora - 3600e3).toISOString();
  const antigo = new Date(agora - 3 * 86400e3).toISOString();
  beforeEach(() => ligar(CHAVE_FORCA_TOUR_HOME));

  it("conta nova (< 48 h) sem missão → sim; conta antiga → não; força de QA ignora a idade; 1x por aparelho", () => {
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
    // a força de QA está ligada neste teste, então a idade não trava; sem força, conta antiga = não
    localStorage.removeItem(CHAVE_FORCA_TOUR_HOME);
    expect(deveMostrarTourHome(antigo, agora, )).toBe(false);
    expect(tourHomeLigado("on")).toBe(true);
    localStorage.setItem(CHAVE_TOUR_FEITO, "feito");
    ligar(CHAVE_FORCA_TOUR_HOME);
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
  });

  it("Missão dos 3 dias do iPhone em andamento → não", () => {
    trial.ativo = true;
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
  });

  it("10/10: em teste grátis COM a missão em doses ligada (o caso de quase toda conta nova do iPhone), missão cumprida → sim", () => {
    trial.ativo = true;
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true;
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    const m = iniciarMissao(["financas", "rotina", "saude"]);
    const feitos = { 1: { dia: hoje(), rotulo: "a" }, 2: { dia: hoje(), rotulo: "b" }, 3: { dia: hoje(), rotulo: "c" } };
    gravarMissao({ ...m, boasVindas: true, feitos, fimVisto: true });
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    delete (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__;
  });

  it("missão em doses: dose por fazer → espera; pulou ('Explorar por conta própria') → sim; cumprida com 'O que você construiu' por ver → espera; fim visto → sim", () => {
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true;
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    const m = iniciarMissao(["financas", "rotina", "saude"]);
    expect(deveMostrarTourHome(novo, agora)).toBe(false);
    gravarMissao({ ...m, boasVindas: true, explorou: true });
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
    const feitos = { 1: { dia: hoje(), rotulo: "a" }, 2: { dia: hoje(), rotulo: "b" }, 3: { dia: hoje(), rotulo: "c" } };
    gravarMissao({ ...m, boasVindas: true, feitos: { 1: feitos[1] } });
    expect(deveMostrarTourHome(novo, agora)).toBe(false); // ainda falta dose
    gravarMissao({ ...m, boasVindas: true, feitos });
    expect(deveMostrarTourHome(novo, agora)).toBe(false); // a missão da 1.0.10 ainda tem "O que você construiu" pra mostrar (missaoEmAndamento)
    gravarMissao({ ...m, boasVindas: true, feitos, fimVisto: true });
    expect(deveMostrarTourHome(novo, agora)).toBe(true);
    localStorage.removeItem(CHAVE_ESTADO_MISSAO_DOSES);
    delete (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__;
  });
});

/* ================================================================== 4. o tour em si */
/** Uma Home de mentira com as âncoras reais do tour, as peças reais (pendências, grade de módulos) e o tour. */
const HomeDeMentira = ({ adicionarWidget }: { adicionarWidget: (id: string) => void }) => {
  const life = useLifeHubData();
  return (
    <div>
      <div data-tour="score"><p data-testid="score">{life.dayScore}</p></div>
      <div data-tour="acoes-rapidas">ações</div>
      <button type="button" data-tour="adicionar-widget">Adicionar widget</button>
      <div data-tour="pendencias"><NextHoursTimeline data={life} /></div>
      <div data-tour="modulos"><ModuleDrawer /></div>
      <TourDaHome lifeData={life} widgetsAtivos={["habits"]} adicionarWidget={adicionarWidget as never} />
    </div>
  );
};

describe("Sua Home em 5 passos (força on)", () => {
  beforeEach(() => ligar(CHAVE_FORCA_TOUR_HOME, CHAVE_FORCA_MODULO_OCULTA));

  it("1.0.17: o balão só entra quando o alvo ASSENTA (a lista abrindo + a rolagem) — antes ele nascia por cima do cabeçalho e pulava", async () => {
    const s = criarStore(CONTA());
    s.montar(<HomeDeMentira adicionarWidget={vi.fn()} />, "/home");
    const tour = screen.getByTestId("tour-home");
    const balao = () => screen.getByTestId("tour-balao").parentElement as HTMLElement;
    expect(tour.hasAttribute("data-assentado")).toBe(false);
    expect(balao().style.pointerEvents).toBe("none"); // invisível e sem toque enquanto o alvo se mexe
    await waitFor(() => expect(screen.getByTestId("tour-home").hasAttribute("data-assentado")).toBe(true), { timeout: ASSENTA_MS * 6 });
    expect(balao().style.pointerEvents).toBe("auto");
  });

  it("5 passos, cada um com UMA ação de 1 toque: o que cada toque grava, os eventos e o fim", async () => {
    const s = criarStore(CONTA());
    const addWidget = vi.fn();
    const acoesRapidas: string[] = [];
    window.addEventListener(EVENTO_ACAO_RAPIDA, (e) => acoesRapidas.push((e as CustomEvent<{ id: string }>).detail.id));
    s.montar(<HomeDeMentira adicionarWidget={addWidget} />, "/home");

    const tour = screen.getByTestId("tour-home");
    expect(tour.getAttribute("data-camada-guia")).toBe("tour-home"); // a festa do adesivo espera o tour sair
    expect(tour.getAttribute("data-passo")).toBe("1");
    expect(screen.getByTestId("tour-contador").textContent).toBe(`Passo 1 de ${TOTAL_PASSOS} · falta ${TOTAL_PASSOS - 1}`);
    expect(screen.queryByText(/pular/i)).toBeNull(); // sem "pular tudo"
    // 10/10: o escuro com o alvo recortado; o passo do score é só LEITURA (sem instrução, sem dedinho) e o botão é "Continuar"
    expect(screen.queryByTestId("tour-faca")).toBeNull();
    expect(screen.getByTestId("tour-escuro")).toBeInTheDocument();
    expect(screen.queryByTestId("tour-dedinho")).toBeNull();
    expect(screen.getByTestId("tour-continuar").textContent).toBe("Continuar");
    expect(screen.queryByText("Fazer isso")).toBeNull();
    expect(screen.getByTestId("tour-balao").querySelector("[data-figurinha-placeholder]")).not.toBeNull();
    expect(nomes()).toEqual(["home_tour_visto"]);

    // 1 — score: "O que conta ponto" abre os 12 blocos com os pontos; "Entendi" avança
    fireEvent.click(screen.getByTestId("tour-ver-pontos"));
    expect(screen.getByTestId("tour-pontos").textContent).toContain("Hábitos do dia");
    expect(screen.getByTestId("tour-pontos").textContent).toContain("20");
    fireEvent.click(screen.getByTestId("tour-entendi"));
    expect(screen.getByTestId("tour-home").getAttribute("data-passo")).toBe("2");

    // 2 — pendências: a lista abriu (o "⋯" está na tela) e "Esconder Refeições" grava na chave de sempre; instrução + dedinho
    expect(screen.getByTestId("opcoes-refeicoes")).toBeInTheDocument();
    expect(screen.getByTestId("tour-faca").textContent).toMatch(/^Toque no ⋯/);
    expect(screen.getByTestId("tour-dedinho")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tour-ocultar-refeicoes"));
    expect(s.ler<PendenciasPrefs>(CHAVE_PENDENCIAS_PREFS).ocultos).toEqual(["refeicoes"]);
    expect(screen.getByTestId("tour-home").getAttribute("data-passo")).toBe("3");

    // 3 — ações rápidas: a MESMA ação do botão (+1 copo)
    fireEvent.click(screen.getByTestId("tour-agua"));
    expect(acoesRapidas).toEqual(["water"]);
    expect(screen.getByTestId("tour-home").getAttribute("data-passo")).toBe("4");

    // 4 — widgets: só os que ainda não estão na Home; adiciona 1
    expect(screen.queryByTestId("tour-widget-habits")).toBeNull();
    fireEvent.click(screen.getByTestId("tour-widget-finances"));
    expect(addWidget).toHaveBeenCalledWith("finances");
    expect(screen.getByTestId("tour-home").getAttribute("data-passo")).toBe("5");

    // 5 — módulos: a engrenagem abriu por evento; esconder Dieta vai pelo ModuleDrawer (fonte única)
    expect(screen.getByLabelText("Fechar edição dos módulos")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tour-ocultar-modulo-dieta"));
    await waitFor(() => expect(s.ler<{ hidden: string[] }>("core-module-prefs").hidden).toEqual(["dieta"]));
    expect(s.ler<{ favorites: string[]; hidden: string[]; order: string[] }>("core-module-prefs")).toEqual({ favorites: [], hidden: ["dieta"], order: [] });

    // fim: o tour some, a engrenagem fecha, a chave vai pro aparelho E pra conta, os eventos fecham a conta
    expect(screen.queryByTestId("tour-home")).toBeNull();
    expect(screen.getByLabelText("Editar módulos")).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_TOUR_FEITO)).toBeTruthy();
    expect(s.ler<string>(CHAVE_TOUR_FEITO)).toBeTruthy();
    expect(dos("home_tour_passo").map((d) => d.acao)).toEqual(["ver_pontos", "ocultar:refeicoes", "agua", "widget:finances", "modulo:dieta"]);
    expect(dos("home_tour_passo").map((d) => d.indice)).toEqual([0, 1, 2, 3, 4]);
    expect(nomes().at(-1)).toBe("home_tour_concluido");
    expect(deveMostrarTourHome(new Date().toISOString())).toBe(false); // 1x por aparelho

    // o adesivo "Casa arrumada" (comum, com arte) abriu na conta
    const casa = buildBadgesVida(s.get).find((b) => b.id === "casa-arrumada")!;
    expect(casa.unlocked).toBe(true);
    expect(raridadeDe(casa)).toBe("comum");
    expect(temArte("casa-arrumada")).toBe(true);
  });

  it("'Continuar' em todos (e 'Concluir missão' no último): termina em 5 toques sem gravar nada além da chave do tour — ninguém fica preso", () => {
    const s = criarStore(CONTA());
    s.montar(<HomeDeMentira adicionarWidget={vi.fn()} />, "/home");
    for (let i = 0; i < TOTAL_PASSOS - 1; i++) fireEvent.click(screen.getByTestId("tour-continuar"));
    expect(screen.getByTestId("tour-concluir").textContent).toBe("Concluir missão");
    fireEvent.click(screen.getByTestId("tour-concluir"));
    expect(screen.queryByTestId("tour-home")).toBeNull();
    expect(dos("home_tour_passo").map((d) => d.acao)).toEqual(["continuar", "continuar", "continuar", "continuar", "concluir"]);
    expect(s.estado.escritas.filter((k) => k !== CHAVE_TOUR_FEITO && k !== "core-module-prefs")).toEqual([]);
    expect(s.ler<string>(CHAVE_TOUR_FEITO)).toBeTruthy();
  });

  it("álbum com a chave ligada: 'Casa arrumada' existe, trancado até o tour acabar", () => {
    const s = criarStore({});
    const casa = buildBadgesVida(s.get).find((b) => b.id === "casa-arrumada")!;
    expect(casa).toBeDefined();
    expect(casa.unlocked).toBe(false);
    expect(casa.category).toBe("vida");
  });
});

/* ================================================================== 5. módulo oculto ⇒ pendências */
describe("módulo oculto ⇒ pendências dele não cobradas (MODULO_OCULTA_PENDENCIAS)", () => {
  it("o mapa real: cada tipo nasce num módulo; humor e gratidão são da Home (não entram)", () => {
    expect(TIPOS_DO_MODULO.dieta).toEqual(["refeicoes"]);
    expect(TIPOS_DO_MODULO.saude).toEqual(["agua", "peso", "sono", "suplementos"]);
    expect(tiposDosModulosOcultos(["dieta", "saude", "beleza", "x"])).toEqual(["refeicoes", "agua", "peso", "sono", "suplementos"]);
    expect(tiposDosModulosOcultos(null)).toEqual([]);
    const todos = Object.values(TIPOS_DO_MODULO).flat();
    expect(todos).not.toContain("humor"); expect(todos).not.toContain("gratidao");
  });

  it("tiposCobradosHoje: sem o 3º argumento é a conta de sempre; com ele tira os derivados; religar volta (prefs intactas)", () => {
    const prefs: PendenciasPrefs = { ...PREFS_PADRAO, ocultos: ["gasto"] };
    expect([...tiposCobradosHoje(prefs, true)]).toHaveLength(11);
    const comModulo = tiposCobradosHoje(prefs, true, tiposDosModulosOcultos(["dieta"]));
    expect(comModulo.has("refeicoes")).toBe(false);
    expect(comModulo.has("gasto")).toBe(false);
    expect(comModulo.size).toBe(10);
    expect([...tiposCobradosHoje(prefs, true, tiposDosModulosOcultos([]))]).toHaveLength(11);
    expect(prefs.ocultos).toEqual(["gasto"]);
  });

  it("no hub: Dieta oculta ⇒ refeições saem da lista e do score (reescala), sem copiar pra home-pendencias-prefs; religar o módulo volta", () => {
    ligar(CHAVE_FORCA_MODULO_OCULTA);
    const s = criarStore({ ...CONTA(), "core-module-prefs": { favorites: [], hidden: [], order: [] } });
    const { result } = renderHook(() => useLifeHubData(), { wrapper: s.Provedor });
    const antes = result.current.dayScore;
    expect(result.current.pendenciasCobradas).toContain("refeicoes");
    cleanup();
    const s2 = criarStore({ ...CONTA(), "core-module-prefs": { favorites: [], hidden: ["dieta"], order: [] } });
    const r2 = renderHook(() => useLifeHubData(), { wrapper: s2.Provedor });
    expect(r2.result.current.pendenciasCobradas).not.toContain("refeicoes");
    expect(r2.result.current.pendenciasPorModulo).toEqual(["refeicoes"]);
    expect(r2.result.current.pendenciasPrefs?.ocultos).toEqual([]); // nada copiado
    expect(r2.result.current.dayScore).toBeGreaterThan(antes); // as refeições pendentes não puxam mais o score
    expect(s2.ler(CHAVE_PENDENCIAS_PREFS)).toBeUndefined();
    cleanup();
    const s3 = criarStore({ ...CONTA(), "core-module-prefs": { favorites: [], hidden: [], order: [] } });
    const r3 = renderHook(() => useLifeHubData(), { wrapper: s3.Provedor });
    expect(r3.result.current.dayScore).toBe(antes);
    expect(r3.result.current.pendenciasCobradas).toContain("refeicoes");
  });

  it("a lista e a folha Personalizar: a linha some da lista; na folha ela aparece travada 'junto com o módulo'", () => {
    ligar(CHAVE_FORCA_MODULO_OCULTA);
    const s = criarStore({ ...CONTA(), "core-module-prefs": { favorites: [], hidden: ["dieta"], order: [] } });
    const Tela = () => { const life = useLifeHubData(); return <NextHoursTimeline data={life} />; };
    s.montar(<Tela />, "/home");
    fireEvent.click(screen.getByRole("button", { name: /Pendências de hoje/ }));
    expect(screen.queryByTestId("opcoes-refeicoes")).toBeNull();
    expect(screen.getByTestId("opcoes-humor")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("personalizar-pendencias-abrir"));
    const linha = screen.getByTestId("pref-refeicoes");
    expect(linha.hasAttribute("data-pelo-modulo")).toBe(true);
    expect(linha.textContent).toContain("junto com o módulo");
    expect(linha.querySelector('button[role="switch"]')).toHaveAttribute("disabled");
  });
});
