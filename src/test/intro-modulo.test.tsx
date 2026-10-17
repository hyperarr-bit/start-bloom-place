/**
 * INTRO DO MÓDULO (1.0.16, lib/intro-modulo) — o que este arquivo trava:
 *   · chave: web nasce OFF (o app de hoje, byte a byte); app das lojas nasce ON; a metadata do RC manda
 *     sem build; a força `?intro-modulo=on` só vale no navegador;
 *   · com a chave ligada os CARTÕES saem do fluxo (mesmo com a força deles ligada): módulo com intro
 *     mostra a intro, módulo sem intro (Relações/Pet/Beleza) fica com o "Dicas para começar";
 *   · a porta: só com a conta carregada; nunca pra quem já tem dado no módulo; nunca se o módulo já foi
 *     apresentado (dicas fechadas, cartões vistos, tutorial antigo); 1x por aparelho e por conta; a
 *     missão em doses (dose na tela, módulo de hoje, dose feita, missão em andamento) bloqueia; outra
 *     guia por cima bloqueia; fechar no meio = volta 1 vez e a 2ª já marca; logout→login não repete;
 *   · o estado vazio de cada módulo: captura por tema (claro/escuro), sem o rótulo "gravado do app",
 *     e a ação de 1 toque grava o conteúdo no formato do módulo (ou abre o campo real);
 *   · a intro guiada de Finanças: faixa, anel, chip grava o gasto, "pronto" marca vista;
 *   · as regras novas de uso_modulo não mudam a ação das chaves que já tinham regra.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const nativo = vi.hoisted(() => ({ v: false }));
const missaoHoje = vi.hoisted(() => ({ v: null as string | null }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
// o ramo da missão (merge depois) exporta `moduloDaMissaoHoje`; aqui ele existe só quando o teste quer
vi.mock("@/lib/missao-doses", async (orig) => ({ ...(await orig<typeof import("@/lib/missao-doses")>()), moduloDaMissaoHoje: () => missaoHoje.v }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }), Toaster: () => null }));

import { UserDataContext, _regrasDeAtivacao, type UserDataContextType } from "@/hooks/use-user-data";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import {
  CHAVE_FORCA_INTRO, CHAVE_INTRO_VISTAS_CONTA, INTRO_MODULO, INTRO_MODULO_APP, INTROS, MODULOS_COM_INTRO, MODULOS_SEM_INTRO, _zerarIntroRemota,
  chaveIntroAberta, chaveIntroVista, guardarForcaDaIntro, introLigada, porQueNaoMostrar, registrarIntroRemota, semConteudo,
} from "@/lib/intro-modulo";
import { adicionarCurso, anotarCafeDaManha, diaDaSemana, montarTreino, type ContextoDaAcao } from "@/lib/intro-modulo-acoes";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import { MODULOS } from "@/lib/modulos";
import { CHAVE_FORCA_CARTOES } from "@/lib/tour-home";
import { CHAVE_FORCA_MISSAO_DOSES, gravarMissao, iniciarMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados, carregada = true) {
  const estado = { dados: JSON.parse(JSON.stringify(inicial)) as Dados, escritas: [] as string[], carregada };
  const ouvintes = new Set<() => void>();
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    useState(() => { ouvintes.add(subir); });
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; estado.escritas.push(k); subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: estado.carregada, isGuest: false, fetchKey: async () => null }), [get, set, versao]); // eslint-disable-line react-hooks/exhaustive-deps
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor, carregar: () => { estado.carregada = true; ouvintes.forEach((o) => o()); } };
}
const montar = (ui: ReactNode, inicial: Dados = {}, carregada = true) => {
  const s = criarStore(inicial, carregada);
  const r = render(<MemoryRouter initialEntries={["/casa"]}><s.Provedor>{ui}</s.Provedor></MemoryRouter>);
  return { ...r, ...s };
};
const card = () => screen.queryByTestId("intro-modulo-vazio");
const dormir = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const ligar = () => localStorage.setItem(CHAVE_FORCA_INTRO, "on");

beforeAll(() => {
  // jsdom não implementa o <video>: a intro chama play()/load() e segue com o poster
  for (const m of ["play", "load", "pause"]) Object.defineProperty(HTMLMediaElement.prototype, m, { configurable: true, value: vi.fn(() => (m === "play" ? Promise.resolve() : undefined)) });
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; nativo.v = false; missaoHoje.v = null; _zerarIntroRemota(); });
afterEach(() => {
  cleanup(); document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-intro-modulo-faixa");
  delete document.documentElement.dataset.missaoDose;
  document.documentElement.classList.remove("dark");
});

/* ───────────────────────────────── chaves, constantes, regras ───────────────────────────────── */
describe("chave, constantes e classificação", () => {
  it("web nasce OFF; app das lojas nasce ON; a metadata do RC manda nos dois; a força só vale no navegador", () => {
    expect(INTRO_MODULO).toBe("off");
    expect(INTRO_MODULO_APP).toBe("on");
    expect(introLigada()).toBe(false);
    guardarForcaDaIntro("?intro-modulo=on");
    expect(localStorage.getItem(CHAVE_FORCA_INTRO)).toBe("on");
    expect(introLigada()).toBe(true);
    nativo.v = true;
    expect(introLigada()).toBe(true); // a força é ignorada: é a constante do app
    registrarIntroRemota({ current: { identifier: "default", metadata: { intro_modulo: "off" } }, all: {} });
    expect(introLigada()).toBe(false); // rollback sem build
    registrarIntroRemota({ current: { identifier: "default", metadata: { intro_modulo: "ON" } }, all: {} });
    expect(introLigada()).toBe(true);
    registrarIntroRemota({ current: { identifier: "default", metadata: {} }, all: {} });
    expect(introLigada()).toBe(true); // sem metadata: a constante do app
    nativo.v = false;
    guardarForcaDaIntro("?intro-modulo=auto");
    expect(introLigada()).toBe(false);
  });
  it("as chaves novas estão classificadas: as do aparelho sobrevivem à vassoura, a da conta é da conta", () => {
    expect(ehChaveDoAparelho(chaveIntroVista("financas"))).toBe(true);
    expect(ehChaveDoAparelho(chaveIntroAberta("casa"))).toBe(true);
    expect(vassouraLeva(chaveIntroVista("casa"))).toBe(false);
    expect(vassouraLeva(chaveIntroAberta("casa"))).toBe(false);
    expect(CHAVE_INTRO_VISTAS_CONTA.startsWith("core-")).toBe(true);
    expect(vassouraLeva(CHAVE_INTRO_VISTAS_CONTA)).toBe(true); // da conta: a hidratação traz de volta
  });
  it("os 16 módulos: 3 guiadas + 10 estados vazios com captura nos dois temas; Relações, Pet e Beleza sem intro", () => {
    expect([...MODULOS_COM_INTRO, ...MODULOS_SEM_INTRO].sort()).toEqual(MODULOS.map((m) => m.id).sort());
    expect(MODULOS_COM_INTRO).toHaveLength(13);
    for (const m of ["financas", "rotina", "saude"]) expect(INTROS[m].formato).toBe("guiada");
    for (const m of ["treino", "dieta", "estudos", "biblioteca", "casa", "desenvolvimento", "carreira", "detox", "hiperfoco", "viagens"]) {
      const c = INTROS[m];
      expect(c.formato, m).toBe("vazio");
      if (c.formato !== "vazio") continue;
      expect(c.midia.video.claro, m).toMatch(/^\/intro\/[a-z]+\.mp4$/);
      expect(c.midia.video.escuro, m).toMatch(/^\/intro\/[a-z]+-escuro\.mp4$/);
      expect(c.midia.poster.claro, m).toMatch(/\.jpg$/);
      expect(JSON.stringify(c).toLowerCase(), m).not.toContain("gravado do app");
      expect(c.titulo.length, m).toBeGreaterThan(8);
    }
    expect(INTROS.relacionamentos).toBeUndefined();
    expect(INTROS.pet).toBeUndefined();
    expect(INTROS.beleza).toBeUndefined();
  });
  it("semConteudo: nulo, vazio, lista vazia, mapa vazio, texto em branco", () => {
    for (const v of [null, undefined, "", "  ", [], {}, 0, false]) expect(semConteudo(v), String(v)).toBe(true);
    for (const v of ["x", [1], { a: 1 }, 3, true]) expect(semConteudo(v), String(v)).toBe(false);
  });
  it("uso_modulo: as regras novas cobrem os módulos sem regra e NÃO mudam a ação das chaves antigas", () => {
    const acao = (k: string) => _regrasDeAtivacao.find((r) => r.match.test(k))?.action;
    // antigas, como eram
    expect(acao("finance-expenses")).toBe("first_transaction");
    expect(acao("saude-workouts-v2")).toBe("first_workout");
    expect(acao("estudos-notebooks")).toBe("first_note");
    expect(acao("career-day-tasks")).toBe("first_task");
    expect(acao("pet-routine-tasks-1")).toBe("first_task");
    expect(acao("goals-board-v2")).toBe("first_goal");
    expect(acao("dieta-smart-list")).toBe("first_grocery");
    // novas
    expect(acao("casa-grocery-categories")).toBe("first_casa");
    expect(acao("estudos-cursos-andamento")).toBe("first_estudo");
    expect(acao("lib-books")).toBe("first_book");
    expect(acao("career-jobs")).toBe("first_career");
    expect(acao("hiperfoco-thoughts")).toBe("first_thought");
    expect(acao("rel-people")).toBe("first_relacao");
    expect(acao("detox-habits")).toBe("first_detox");
    expect(acao("pet-list")).toBe("first_pet");
    expect(acao("travel-bucket")).toBe("first_trip");
    expect(acao("skincare-am-steps")).toBe("first_beleza");
    expect(acao("dp-values")).toBe("first_dp");
    // as fases padrão da Carreira (sem contagem) e os cômodos sem tarefa não contam como uso
    const casa = _regrasDeAtivacao.find((r) => r.action === "first_casa")!;
    expect(casa.meaningful!([{ id: "1", name: "Cozinha", tasks: [] }])).toBe(false);
    expect(casa.meaningful!([{ id: "1", name: "Cozinha", tasks: [{ id: "t", text: "Lavar", done: false }] }])).toBe(true);
    expect(casa.meaningful!(CATEGORIAS_PADRAO_MERCADO)).toBe(false);
    const carreira = _regrasDeAtivacao.find((r) => r.action === "first_career")!;
    expect(carreira.meaningful!([{ id: "f1", nome: "Prospecção", memo: "", counts: {} }])).toBe(false);
    expect(carreira.meaningful!([{ id: "f1", nome: "Prospecção", memo: "", counts: { "2026-10-16": 2 } }])).toBe(true);
  });
});

/* ───────────────────────────────── chave desligada ───────────────────────────────── */
describe("chave desligada (web) = o app de hoje", () => {
  it("a porta do módulo segue pro Dicas para começar; a IntroDoModulo não monta nada; nenhum evento, nada no storage", () => {
    montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(screen.getByText("Dica antiga")).toBeTruthy();
    expect(card()).toBeNull();
    const { container } = montar(<IntroDoModulo moduleId="financas" />);
    expect(container.innerHTML).toBe("");
    expect(eventos.filter(([n]) => n.startsWith("modulo_intro"))).toHaveLength(0);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("core-intro"))).toHaveLength(0);
  });
});

/* ───────────────────────────────── a porta ───────────────────────────────── */
describe("ligada: a porta do módulo", () => {
  beforeEach(ligar);

  it("os cartões saem do fluxo mesmo com a força deles ligada; módulo sem intro fica com as dicas; Pet sem dicas = nada", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(card()).toBeTruthy();
    await dormir(50);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.queryByText("Dica antiga")).toBeNull();
    cleanup();
    montar(<BoasVindasDoModulo moduleId="relacionamentos" tips={["Guarde as datas"]} />);
    expect(screen.getByText("Guarde as datas")).toBeTruthy();
    await dormir(50);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    cleanup();
    const pet = montar(<BoasVindasDoModulo moduleId="pet" />);
    expect(pet.container.innerHTML).toBe("");
  });

  it("espera a conta carregar: nada antes do loaded, a intro depois (o 2º aparelho precisa da lista da conta)", async () => {
    const s = montar(<IntroDoModulo moduleId="casa" />, {}, false);
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroAberta("casa"))).toBeNull();
    act(() => s.carregar());
    await waitFor(() => expect(card()).toBeTruthy());
    expect(localStorage.getItem(chaveIntroAberta("casa"))).toBeTruthy();
  });

  it("quem já tem dado no módulo nunca vê a intro (conta de antes)", () => {
    const cats = CATEGORIAS_PADRAO_MERCADO.map((c, i) => (i === 0 ? { ...c, items: [{ id: "1", text: "Banana", done: false }] } : c));
    expect(porQueNaoMostrar("casa", (k, f) => (k === "casa-grocery-categories" ? (cats as never) : f))).toBe("com_dado");
    expect(porQueNaoMostrar("financas", (k, f) => (k === "finance-expenses" ? ([{ id: "1", value: 10 }] as never) : f))).toBe("com_dado");
    expect(porQueNaoMostrar("treino", (k, f) => (k === "saude-workouts-v2" ? ({ SEGUNDA: { muscles: ["Peito"], exercises: [] } } as never) : f))).toBe("com_dado");
    expect(porQueNaoMostrar("dieta", (k, f) => (k === "saude-meals" ? ({ SEGUNDA: { Almoço: "arroz" } } as never) : f))).toBe("com_dado");
    expect(porQueNaoMostrar("dieta", (k, f) => (k === "saude-meals" ? ({ SEGUNDA: { Almoço: "" } } as never) : f))).toBeNull(); // o plano padrão é vazio
    expect(porQueNaoMostrar("carreira", (k, f) => (k === "career-day-phases" ? ([{ id: "f1", nome: "Prospecção", memo: "", counts: {} }] as never) : f))).toBeNull(); // fases padrão sem contagem = vazio
    const a = montar(<IntroDoModulo moduleId="casa" />, { "casa-grocery-categories": cats });
    expect(a.container.innerHTML).toBe("");
    expect(eventos).toHaveLength(0);
  });

  it("módulo já apresentado de outro jeito (dicas fechadas, cartões vistos, tutorial antigo) ⇒ nada", () => {
    expect(porQueNaoMostrar("casa", (k, f) => (k === "core-tip-seen-casa" ? ("true" as never) : f))).toBe("ja_apresentado");
    expect(porQueNaoMostrar("casa", (k, f) => (k === "spotlight-done-casa" ? ("true" as never) : f))).toBe("ja_apresentado");
    localStorage.setItem("core-cartoes-vistos-casa", "2026-10-14");
    expect(porQueNaoMostrar("casa", (_k, f) => f)).toBe("ja_apresentado");
  });

  it("1x: já vista neste aparelho OU nesta conta (2º aparelho) ⇒ nada", () => {
    localStorage.setItem(chaveIntroVista("casa"), "2026-10-16");
    const a = montar(<IntroDoModulo moduleId="casa" />);
    expect(a.container.innerHTML).toBe("");
    a.unmount(); localStorage.removeItem(chaveIntroVista("casa"));
    const b = montar(<IntroDoModulo moduleId="casa" />, { [CHAVE_INTRO_VISTAS_CONTA]: ["casa"] }); // aparelho limpo, conta já viu
    expect(b.container.innerHTML).toBe("");
    expect(Object.keys(localStorage).filter((k) => k.startsWith("core-intro"))).toHaveLength(0);
  });

  it("fechou o app no meio: volta 1 vez; na 2ª aparição já marca vista; a 3ª não existe", () => {
    const a = montar(<IntroDoModulo moduleId="casa" />);
    expect(card()).toBeTruthy();
    expect(localStorage.getItem(chaveIntroAberta("casa"))).toBeTruthy();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeNull();
    a.unmount(); // fechou sem terminar
    const b = montar(<IntroDoModulo moduleId="casa" />);
    expect(card()).toBeTruthy();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(b.estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    b.unmount();
    const c = montar(<IntroDoModulo moduleId="casa" />);
    expect(c.container.innerHTML).toBe("");
  });

  it("logout → login: a vassoura não apaga a marca do aparelho e a conta traz a lista de volta ⇒ não repete; outra conta no mesmo aparelho também não", () => {
    const a = montar(<IntroDoModulo moduleId="casa" />);
    fireEvent.click(screen.getByTestId("intro-modulo-pular"));
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    const lista = a.estado.dados[CHAVE_INTRO_VISTAS_CONTA];
    a.unmount();
    // a vassoura do logout: apaga tudo que é da conta no localStorage
    localStorage.setItem("u:abc:core-intro-vistas", JSON.stringify(lista));
    for (const k of Object.keys(localStorage)) if (vassouraLeva(k)) localStorage.removeItem(k);
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(localStorage.getItem("u:abc:core-intro-vistas")).toBeNull();
    const b = montar(<IntroDoModulo moduleId="casa" />, { [CHAVE_INTRO_VISTAS_CONTA]: lista }); // a mesma conta, hidratada
    expect(b.container.innerHTML).toBe("");
    b.unmount();
    const c = montar(<IntroDoModulo moduleId="casa" />, {}); // outra conta, mesmo aparelho
    expect(c.container.innerHTML).toBe("");
  });

  it("missão em doses: dose na tela, módulo de hoje, dose feita e missão em andamento bloqueiam; completa ou abandonada libera", () => {
    const get = (_k: string, f: unknown) => f;
    expect(porQueNaoMostrar("casa", get as never)).toBeNull();
    document.documentElement.dataset.missaoDose = "1";
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    delete document.documentElement.dataset.missaoDose;
    missaoHoje.v = "casa"; // o export do ramo da missão
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    expect(porQueNaoMostrar("treino", get as never)).toBeNull();
    missaoHoje.v = null;
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true; // a missão na web só liga por QA
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    const m = iniciarMissao(["financas", "casa", "treino"]);
    gravarMissao(m); // em andamento: os 3 esperam a própria dose
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    expect(porQueNaoMostrar("treino", get as never)).toBe("missao");
    expect(porQueNaoMostrar("dieta", get as never)).toBeNull();
    const feita = (n: 1 | 2 | 3) => ({ dia: localDayKey(), rotulo: "x" });
    gravarMissao({ ...m, feitos: { 1: feita(1), 2: feita(2), 3: feita(3) } } as EstadoMissaoDoses); // completa: as 3 doses foram as intros deles
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao");
    expect(porQueNaoMostrar("dieta", get as never)).toBeNull();
    gravarMissao({ ...m, explorou: true } as EstadoMissaoDoses); // pulou a missão inteira: nenhuma dose aconteceu
    expect(porQueNaoMostrar("casa", get as never)).toBeNull();
    gravarMissao({ ...m, explorou: true, feitos: { 1: feita(1) } } as EstadoMissaoDoses); // a dose de Finanças aconteceu antes de pular
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao");
    expect(porQueNaoMostrar("casa", get as never)).toBeNull();
    const a = montar(<IntroDoModulo moduleId="financas" />);
    expect(a.container.innerHTML).toBe("");
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
  });

  it("outra guia por cima: presente no mount ⇒ nada; aparecendo logo depois ⇒ a intro sai sem marcar vista", async () => {
    const festa = document.createElement("div"); festa.setAttribute("data-camada-guia", "missao-doses-festa"); document.body.appendChild(festa);
    const a = montar(<IntroDoModulo moduleId="casa" />);
    expect(a.container.innerHTML).toBe("");
    festa.remove(); a.unmount(); localStorage.clear(); ligar();
    montar(<IntroDoModulo moduleId="casa" />);
    expect(card()).toBeTruthy();
    document.documentElement.dataset.missaoDose = "1"; // a dose da missão montou depois
    await dormir(800);
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeNull();
  });
});

/* ───────────────────────────────── estado vazio ───────────────────────────────── */
describe("ligada: o estado vazio de cada módulo", () => {
  beforeEach(ligar);
  const hoje = localDayKey();

  it("Casa: captura + 1 toque grava os 3 itens na lista real, marca vista no aparelho e na conta, eventos; o card sai", async () => {
    const { estado } = montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(screen.queryByText("Dica antiga")).toBeNull();
    expect(card()).toBeTruthy();
    expect(screen.queryByText(/gravado do app/i)).toBeNull();
    expect(screen.getByTestId("intro-modulo-video").getAttribute("src")).toBe("/intro/casa.mp4");
    expect(screen.getByTestId("intro-modulo-poster").getAttribute("src")).toBe("/intro/casa.jpg");
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.modulo === "casa" && d.formato === "vazio" && d.tema === "claro")).toBeTruthy();
    fireEvent.click(screen.getByTestId("intro-modulo-acao"));
    const cats = estado.dados["casa-grocery-categories"] as typeof CATEGORIAS_PADRAO_MERCADO;
    expect(cats.flatMap((c) => c.items.map((i) => i.text))).toEqual(expect.arrayContaining(["Leite", "Pão", "Café"]));
    expect(cats).toHaveLength(CATEGORIAS_PADRAO_MERCADO.length);
    expect(screen.getByTestId("intro-modulo-acao").textContent).toContain("Pronto");
    fireEvent.click(screen.getByTestId("intro-modulo-acao")); // 2º toque não duplica
    expect((estado.dados["casa-grocery-categories"] as typeof CATEGORIAS_PADRAO_MERCADO).flatMap((c) => c.items)).toHaveLength(3);
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "botao")).toBeTruthy();
    expect(eventos.find(([n]) => n === "modulo_intro_concluida")).toBeTruthy();
    await waitFor(() => expect(card()).toBeNull(), { timeout: 2500 });
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
  });

  it("Pular fecha, marca vista e conta como pulada", () => {
    const { estado } = montar(<IntroDoModulo moduleId="casa" />);
    fireEvent.click(screen.getByTestId("intro-modulo-pular"));
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(eventos.find(([n, d]) => n === "modulo_intro_pulou" && d.fase === "vazio")).toBeTruthy();
  });

  it("tema: a captura é a do tema da pessoa e acompanha a troca", async () => {
    document.documentElement.classList.add("dark");
    montar(<IntroDoModulo moduleId="treino" />);
    expect(screen.getByTestId("intro-modulo-video").getAttribute("src")).toBe("/intro/treino-escuro.mp4");
    expect(screen.getByTestId("intro-modulo-poster").getAttribute("src")).toBe("/intro/treino-escuro.jpg");
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.tema === "escuro")).toBeTruthy();
    document.documentElement.classList.remove("dark");
    await waitFor(() => expect(screen.getByTestId("intro-modulo-video").getAttribute("src")).toBe("/intro/treino.mp4"));
  });

  it("Treino: 1 toque monta a semana com o Full Body 3x (plano real + dias ativos)", async () => {
    const { estado } = montar(<IntroDoModulo moduleId="treino" />);
    fireEvent.click(screen.getByTestId("intro-modulo-acao"));
    const plano = estado.dados["saude-workouts-v2"] as Record<string, { muscles: string[]; exercises: unknown[] }>;
    expect(plano.SEGUNDA.muscles).toEqual(["Full Body"]);
    expect(plano.SEGUNDA.exercises.length).toBeGreaterThan(0);
    expect(plano["TERÇA"].exercises).toHaveLength(0);
    expect(estado.dados["treino-active-days"]).toEqual(["SEGUNDA", "QUARTA", "SEXTA"]);
    await waitFor(() => expect(card()).toBeNull(), { timeout: 2500 });
  });

  it("Dieta: o chip grava o café da manhã de HOJE no cardápio, sem mexer no resto", () => {
    const plano = { SEGUNDA: { "Café da Manhã": "", Almoço: "" }, [diaDaSemana()]: { "Café da Manhã": "", Almoço: "" } };
    const { estado } = montar(<IntroDoModulo moduleId="dieta" />, { "saude-meals": plano });
    const chips = screen.getAllByTestId("intro-modulo-chip");
    expect(chips).toHaveLength(3);
    fireEvent.click(chips[1]);
    const meals = estado.dados["saude-meals"] as Record<string, Record<string, string>>;
    expect(meals[diaDaSemana()]["Café da Manhã"]).toBe("Ovos mexidos");
    expect(meals[diaDaSemana()].Almoço).toBe("");
    expect(meals.SEGUNDA["Café da Manhã"]).toBe("");
    expect(chips[1].getAttribute("data-feito")).toBe("1");
    expect((chips[0] as HTMLButtonElement).disabled).toBe(true);
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "chip" && d.opcao === "ovos")).toBeTruthy();
  });

  it("Dieta: o 'depois' abre SÓ o card de hoje — nunca o gatilho do diálogo 'Limpar cardápio' (bug de 16/10)", () => {
    const limpar = vi.fn(), abrir = vi.fn();
    document.body.innerHTML = `<div data-spotlight="first-day"><button id="limpar" aria-expanded="false" aria-haspopup="dialog">Limpar</button><button id="abrir" aria-label="Abrir SEXTA" aria-expanded="false">SEXTA</button></div>`;
    document.getElementById("limpar")!.addEventListener("click", limpar);
    document.getElementById("abrir")!.addEventListener("click", abrir);
    const cfg = INTROS.dieta;
    if (cfg.formato === "vazio") cfg.depois?.();
    expect(limpar).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledTimes(1);
    // o card já aberto ("Recolher") não é tocado
    document.body.innerHTML = `<div data-spotlight="first-day"><button id="limpar" aria-expanded="false" aria-haspopup="dialog">Limpar</button><button id="recolher" aria-label="Recolher SEXTA" aria-expanded="true">SEXTA</button></div>`;
    const recolher = vi.fn(); document.getElementById("recolher")!.addEventListener("click", recolher); document.getElementById("limpar")!.addEventListener("click", limpar);
    if (cfg.formato === "vazio") cfg.depois?.();
    expect(limpar).not.toHaveBeenCalled();
    expect(recolher).not.toHaveBeenCalled();
  });

  it("Estudos, Biblioteca, Metas, Carreira e Detox: cada chip grava no formato do módulo", () => {
    const e = montar(<IntroDoModulo moduleId="estudos" />);
    fireEvent.click(screen.getAllByTestId("intro-modulo-chip")[0]);
    expect(e.estado.dados["estudos-cursos-andamento"]).toMatchObject([{ name: "Inglês" }]);
    cleanup(); localStorage.clear(); ligar();

    const b = montar(<IntroDoModulo moduleId="biblioteca" />);
    fireEvent.click(screen.getAllByTestId("intro-modulo-chip")[0]);
    expect(b.estado.dados["lib-books"]).toMatchObject([{ title: "Hábitos Atômicos", author: "James Clear", status: "lendo", currentPage: 0, quotes: [] }]);
    cleanup(); localStorage.clear(); ligar();

    const d = montar(<IntroDoModulo moduleId="desenvolvimento" />);
    fireEvent.click(screen.getAllByTestId("intro-modulo-chip")[1]);
    const metas = d.estado.dados["goals-board-v2"] as Array<{ title: string; actionGroups: unknown[] }>;
    expect(metas).toHaveLength(1);
    expect(metas[0].title).toBe("Guardar R$ 1.000");
    expect(metas[0].actionGroups).toHaveLength(2);
    cleanup(); localStorage.clear(); ligar();

    const c = montar(<IntroDoModulo moduleId="carreira" />);
    fireEvent.click(screen.getAllByTestId("intro-modulo-chip")[2]);
    expect(c.estado.dados["career-day-tasks"]).toMatchObject([{ texto: "Ligar pro cliente", feito: false, dia: hoje }]);
    cleanup(); localStorage.clear(); ligar();

    const x = montar(<IntroDoModulo moduleId="detox" />);
    fireEvent.click(screen.getAllByTestId("intro-modulo-chip")[1]);
    expect(x.estado.dados["detox-habits"]).toMatchObject([{ name: "Açúcar", icon: "🍬", startDate: hoje, relapses: [], record: 0, checkins: [] }]);
  });

  it("Mente e Viagens: o toque abre o campo real (o conteúdo é da pessoa), nada é gravado", () => {
    const m = montar(<><input placeholder="O que está pensando?" /><IntroDoModulo moduleId="hiperfoco" /></>);
    fireEvent.click(screen.getByTestId("intro-modulo-acao"));
    expect((document.activeElement as HTMLInputElement | null)?.placeholder).toBe("O que está pensando?");
    expect(m.estado.escritas.filter((k) => !k.startsWith("core-intro"))).toHaveLength(0);
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("hiperfoco"))).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "foco" && d.modulo === "hiperfoco")).toBeTruthy();
    cleanup(); localStorage.clear(); ligar();
    montar(<><input placeholder="Destino..." /><IntroDoModulo moduleId="viagens" /></>);
    fireEvent.click(screen.getByTestId("intro-modulo-acao"));
    expect((document.activeElement as HTMLInputElement | null)?.placeholder).toBe("Destino...");
  });
});

/* ───────────────────────────────── as ações (puras) ───────────────────────────────── */
describe("as ações de 1 toque são idempotentes e respeitam o que já existe", () => {
  const ctx = (dados: Record<string, unknown>): ContextoDaAcao & { dados: Record<string, unknown> } => ({
    dados, get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f), gravar: (k, v) => { dados[k] = v; },
  });
  it("curso repetido não entra duas vezes", () => {
    const c = ctx({});
    adicionarCurso(c, "Inglês"); adicionarCurso(c, "inglês ");
    expect(c.dados["estudos-cursos-andamento"]).toHaveLength(1);
  });
  it("o café da manhã respeita as refeições configuradas e os outros dias", () => {
    const c = ctx({ "dieta-meals-config": ["Café da Manhã", "Almoço", "Janta", "Ceia"], "saude-meals": { SEGUNDA: { Almoço: "arroz" } } });
    anotarCafeDaManha(c, "Pão com café", );
    const meals = c.dados["saude-meals"] as Record<string, Record<string, string>>;
    expect(meals.SEGUNDA).toEqual({ Almoço: "arroz" });
    expect(Object.keys(meals[diaDaSemana()])).toEqual(expect.arrayContaining(["Café da Manhã", "Almoço", "Janta", "Ceia"]));
    expect(meals[diaDaSemana()]["Café da Manhã"]).toBe("Pão com café");
  });
  it("o treino não apaga exercícios que já estavam num dia", () => {
    const c = ctx({ "saude-workouts-v2": { SEGUNDA: { muscles: [], exercises: [{ name: "Corrida", sets: "", reps: "", carga: "", done: false, obs: "" }] } } });
    montarTreino(c);
    const plano = c.dados["saude-workouts-v2"] as Record<string, { exercises: Array<{ name: string }> }>;
    expect(plano.SEGUNDA.exercises.map((e) => e.name)).toEqual(["Corrida"]);
    expect(plano.QUARTA.exercises.length).toBeGreaterThan(0);
  });
});

/* ───────────────────────────────── guiada ───────────────────────────────── */
describe("ligada: a intro guiada de Finanças", () => {
  beforeEach(ligar);
  it("a faixa sobe, o post-it acha o controle real e o chip grava o gasto na conta no formato do módulo; o 'pronto' marca vista", async () => {
    // o módulo de mentira: só o controle que a intro procura, com tamanho (jsdom não mede)
    const Modulo = () => (
      <div>
        <div data-cartao-alvo="novo-gasto"><input placeholder="+ Novo gasto" /><button data-spotlight="add-expense">+</button></div>
        <IntroDoModulo moduleId="financas" />
      </div>
    );
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const { estado } = montar(<Modulo />);
    expect(document.documentElement.getAttribute("data-intro-modulo-faixa")).toBe("1");
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("toca em 1 gasto");
    expect(screen.getByTestId("intro-modulo-faixa").getAttribute("data-camada-guia")).toBe("intro-modulo");
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.formato === "guiada")).toBeTruthy();
    const chip = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    fireEvent.click(chip[0]);
    const gastos = estado.dados["finance-expenses"] as Array<{ description: string; value: number }>;
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ description: "Café", value: 12 });
    expect(eventos.find(([n, d]) => n === "modulo_intro_chip" && d.nome === "Café")).toBeTruthy();
    await waitFor(() => expect(eventos.find(([n, d]) => n === "modulo_intro_registrou" && d.via === "chip")).toBeTruthy(), { timeout: 3000 });
    // sem o card MEU MÊS na tela, vai direto pro "pronto" (fail-open) e marca vista
    await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(localStorage.getItem(chaveIntroVista("financas"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["financas"]);
    expect(document.documentElement.getAttribute("data-intro-modulo-faixa")).toBeNull();
    medir.mockRestore();
  });
});
