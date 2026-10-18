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
 *   · a intro de 1 toque de cada módulo (17/10, o padrão da Saúde): post-it no controle real, 1 chip grava no
 *     formato do módulo, o cartão do fim confirma o que entrou, "Pular" sempre à vista; TODOS os 16 têm intro;
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

import { UserDataContext, _regrasDeAtivacao, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { IntroDoModulo } from "@/components/intro-modulo/IntroDoModulo";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import {
  ATRIBUTO_MONTAR_FINANCAS, CHAVE_FORCA_INTRO, CHAVE_INTRO_FEITAS_CONTA, CHAVE_INTRO_VISTAS_CONTA, EVENTO_MONTAR_FINANCAS_FIM, INTRO_MODULO, INTRO_MODULO_APP, INTROS,
  ATRIBUTO_MONTAR_ROTINA, EVENTO_MONTAR_ROTINA_FIM, MODULOS_COM_INTRO, MODULOS_SEM_INTRO, MODULOS_SEM_NADA, MONTAR_ROTINA, OLHAR_POSSO_GASTAR, _zerarIntroRemota,
  chaveIntroAberta, chaveIntroVista, guardarForcaDaIntro, introConcluida, introLigada, montarNaTela, porQueNaoMostrar, registrarIntroRemota, semConteudo,
} from "@/lib/intro-modulo";
import { EscolherTreino } from "@/components/intro-modulo/EscolherTreino";
import { IntroDeUmToque } from "@/components/intro-modulo/IntroDeUmToque";
import { modeloPara } from "@/lib/intro-modulo-acoes";
import { TREINOS_DE_HOJE, adicionarCurso, anotarCafeDaManha, diaDaSemana, montarTreino, montarTreinoDeHoje, type ContextoDaAcao } from "@/lib/intro-modulo-acoes";
import type { IntroDeUmToqueConfig } from "@/lib/intro-modulo";
import { ehChaveDoAparelho, vassouraLeva } from "@/lib/chaves-do-aparelho";
import { CATEGORIAS_PADRAO_MERCADO } from "@/lib/mercado";
import { MODULOS } from "@/lib/modulos";
import { CHAVE_FORCA_CARTOES } from "@/lib/tour-home";
import { CHAVE_FORCA_MISSAO_DOSES, gravarMissao, iniciarMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { localDayKey } from "@/lib/utils";
const ontem = () => localDayKey(new Date(Date.now() - 86_400_000));

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
  return { estado, Provedor, carregar: () => { estado.carregada = true; ouvintes.forEach((o) => o()); }, subir: () => ouvintes.forEach((o) => o()) };
}
const montar = (ui: ReactNode, inicial: Dados = {}, carregada = true) => {
  const s = criarStore(inicial, carregada);
  const r = render(<MemoryRouter initialEntries={["/casa"]}><s.Provedor>{ui}</s.Provedor></MemoryRouter>);
  const get = <T,>(k: string, f: T): T => (k in s.estado.dados ? (s.estado.dados[k] as T) : f);
  return { ...r, ...s, get };
};
/** a intro na tela = a faixa de planner no topo (portal no body; vale pra guiada e pra de 1 toque) */
const card = () => document.querySelector("[data-testid=intro-modulo-faixa]");
/** como `montar`, com o `set` do store na mão (simular a pessoa mexendo no módulo) */
const montarComSet = (ui: ReactNode, inicial: Dados = {}) => {
  const r = montar(ui, inicial);
  return { ...r, set: (k: string, v: unknown) => { r.estado.dados = { ...r.estado.dados, [k]: JSON.parse(JSON.stringify(v)) }; r.estado.escritas.push(k); r.subir(); } };
};
/** o i-ésimo chip do post-it — que só aparece depois de achar (ou desistir de achar, ~5 s) o controle real */
const chip = async (i = 0) => { await waitFor(() => expect(screen.queryAllByTestId("demo-guia-chip").length).toBeGreaterThan(i), { timeout: 8000 }); return screen.getAllByTestId("demo-guia-chip")[i]; };
const tocar = async (i = 0) => { fireEvent.click(await chip(i)); };
/** anda pelos passos até o cartão do fim: chips (toca no 1º), "olha" (Entendi; sem o card no DOM de mentira é pulado sozinho) */
const irAteOFim = async (acaoNoModulo?: () => void) => {
  for (let i = 0; i < 8; i++) {
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto") || screen.queryByTestId("intro-modulo-entendi") || screen.queryAllByTestId("demo-guia-chip")[0] || (acaoNoModulo && screen.queryByTestId("demo-guia-postit"))).toBeTruthy(), { timeout: 9000 });
    if (screen.queryByTestId("intro-modulo-pronto")) return;
    const entendi = screen.queryByTestId("intro-modulo-entendi");
    if (entendi) { fireEvent.click(entendi); continue; }
    const chips = screen.queryAllByTestId("demo-guia-chip");
    if (chips[0]) { fireEvent.click(chips[0]); await waitFor(() => expect(document.contains(chips[0])).toBe(false), { timeout: 9000 }); continue; }
    acaoNoModulo?.();
    await dormir(300);
  }
};
/** toca nos chips até o fim e fecha pelo "Pronto" do cartão do fim (é o que marca "feita") */
const fazerETerminar = async () => {
  await irAteOFim();
  fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
};
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
  document.documentElement.removeAttribute(ATRIBUTO_MONTAR_FINANCAS);
  document.documentElement.removeAttribute(ATRIBUTO_MONTAR_ROTINA);
  document.documentElement.removeAttribute("data-escolher-treino");
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
    expect(vassouraLeva(CHAVE_INTRO_FEITAS_CONTA)).toBe(true);
  });
  it("os 16 módulos TÊM intro, de VÁRIOS passos (dono 17/10: 'tipo Finanças, que tem vários'): 3–4 passos cada, ação → olha → ação; chips de 2–5, olhares de 1 frase, textos curtos; nada de vídeo", () => {
    expect([...MODULOS_COM_INTRO].sort()).toEqual(MODULOS.map((m) => m.id).sort());
    expect(MODULOS_COM_INTRO).toHaveLength(16);
    expect(MODULOS_SEM_INTRO).toEqual([]);
    expect(MODULOS_SEM_NADA).toEqual([]);
    const conferirPasso = (m: string, p: { pergunta: string; opcoes: unknown[]; olhar?: { titulo: string; texto: string }; escutar?: unknown; executar?: unknown; foco?: unknown }) => {
      if (p.olhar) { expect(p.opcoes.length, m).toBe(0); expect(p.olhar.titulo.length, m).toBeLessThanOrEqual(40); expect(p.olhar.texto.length, m).toBeLessThanOrEqual(170); return; }
      expect(p.pergunta.length, m).toBeGreaterThan(8);
      expect(p.pergunta.length, m).toBeLessThanOrEqual(60);
      if (p.escutar) expect(p.opcoes.length, m).toBe(0);
      else { expect(p.opcoes.length, m).toBeGreaterThanOrEqual(2); expect(p.opcoes.length, m).toBeLessThanOrEqual(5); expect(!!p.executar || !!p.foco, m).toBe(true); }
    };
    for (const m of ["financas", "rotina", "saude"]) {
      const c = INTROS[m];
      expect(c.formato).toBe("guiada");
      if (c.formato !== "guiada") continue;
      const guiada = m === "rotina" ? 3 : 2; // criar → marcar → olha · ação → olha
      expect(guiada + (c.maisPassos?.length ?? 0), m).toBeGreaterThanOrEqual(3);
      expect(guiada + (c.maisPassos?.length ?? 0), m).toBeLessThanOrEqual(4);
      for (const p of c.maisPassos ?? []) conferirPasso(m, p);
    }
    for (const m of ["treino", "dieta", "estudos", "biblioteca", "casa", "desenvolvimento", "carreira", "detox", "hiperfoco", "viagens", "beleza", "relacionamentos", "pet"]) {
      const c = INTROS[m];
      expect(c.formato, m).toBe("toque");
      if (c.formato !== "toque") continue;
      expect(c.pedido.length, m).toBeGreaterThan(8);
      expect(c.pronto.length, m).toBeGreaterThan(12);
      expect(c.passos.length, m).toBeGreaterThanOrEqual(3);
      expect(c.passos.length, m).toBeLessThanOrEqual(4);
      expect(c.passos[0].olhar, `${m}: o 1º passo é uma ação`).toBeUndefined();
      expect(c.passos.some((p) => !!p.olhar), `${m}: tem um "olha"`).toBe(true);
      for (const p of c.passos) conferirPasso(m, p);
      const texto = JSON.stringify(c).toLowerCase();
      for (const proibido of ["no app do celular", ".mp4", "gravado do app"]) expect(texto, m).not.toContain(proibido);
    }
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

  it("os cartões saem do fluxo mesmo com a força deles ligada; Relações, Pet e Treino (17/10) também ganham a intro, sem as dicas antigas", async () => {
    localStorage.setItem(CHAVE_FORCA_CARTOES, "on");
    montar(<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} />);
    expect(card()).toBeTruthy();
    await dormir(50);
    expect(screen.queryByTestId("cartoes-modulo")).toBeNull();
    expect(screen.queryByText("Dica antiga")).toBeNull();
    cleanup(); document.body.innerHTML = "";
    montar(<BoasVindasDoModulo moduleId="relacionamentos" tips={["Guarde as datas"]} />);
    expect(card()?.textContent).toContain("anota 1 pessoa");
    expect(screen.queryByText("Guarde as datas")).toBeNull();
    cleanup(); document.body.innerHTML = "";
    montar(<BoasVindasDoModulo moduleId="pet" />);
    expect(card()?.textContent).toContain("cadastra o seu pet");
    cleanup(); document.body.innerHTML = "";
    montar(<BoasVindasDoModulo moduleId="treino" tips={["Dica antiga do Treino"]} />);
    expect(card()?.textContent).toContain("monta o treino de hoje");
    expect(screen.queryByText("Dica antiga do Treino")).toBeNull();
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
    expect(porQueNaoMostrar("rotina", (k, f) => (k === "rotina-habits" ? (["Beber água"] as never) : f))).toBeNull(); // hábitos criados (pelo montar) não contam
    expect(porQueNaoMostrar("rotina", (k, f) => (k === "rotina-habits-checked" ? ({ SEXTA: [true] } as never) : f))).toBe("com_dado"); // marcou: conta de antes
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

  it("17/10 (achado no app de verdade): o tutorial antigo da página (SpotlightOverlay, que marca spotlight-done na 1ª abertura de QUALQUER conta logada, num efeito que roda antes) não esconde a intro da conta nova; quem já tinha o tutorial gravado ANTES continua sem intro", async () => {
    ligar();
    const pagina = (m: "casa") => <><SpotlightOverlay moduleKey={m} steps={[]} /><IntroDoModulo moduleId={m} /></>;
    const a = montar(pagina("casa"));
    await dormir(10);
    expect(a.estado.dados["spotlight-done-casa"]).toBe("true"); // a página antiga marcou na mesma abertura
    expect(card()).toBeTruthy(); // e a intro aparece mesmo assim
    a.unmount();
    // fechou o app no meio: a marca veio dessa visita — a intro volta 1 vez
    const b = montar(pagina("casa"), { "spotlight-done-casa": "true" });
    await dormir(10);
    expect(card()).toBeTruthy();
    b.unmount();
    localStorage.clear(); ligar();
    // conta de antes: o tutorial antigo já estava gravado ANTES desta abertura (e a intro nunca apareceu aqui) ⇒ nada
    const c = montar(pagina("casa"), { "spotlight-done-casa": "true" });
    await dormir(10);
    expect(card()).toBeNull();
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

  it("fechou o app no meio: volta 1 vez; na 2ª aparição já marca vista; a 3ª não existe", { timeout: 40_000 }, async () => {
    const a = montar(<IntroDoModulo moduleId="casa" />);
    expect(card()).toBeTruthy();
    expect(localStorage.getItem(chaveIntroAberta("casa"))).toBeTruthy();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeNull();
    a.unmount(); // fechou sem terminar
    const b = montar(<IntroDoModulo moduleId="casa" />);
    expect(card()).toBeTruthy();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toMatch(/^pulada@/); // vista, mas não feita
    expect(b.estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(b.estado.dados[CHAVE_INTRO_FEITAS_CONTA]).toBeUndefined();
    expect(introConcluida("casa", b.get)).toBe(false);
    await fazerETerminar(); // ela termina mesmo assim: vira feita
    expect(localStorage.getItem(chaveIntroVista("casa"))).toMatch(/^feita@/);
    expect(b.estado.dados[CHAVE_INTRO_FEITAS_CONTA]).toEqual(["casa"]);
    expect(introConcluida("casa", b.get)).toBe(true);
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

  it("missão em doses (dono 17/10): bloqueia SÓ a dose na tela, o módulo da dose de HOJE por fazer e o módulo cuja dose já foi feita; Rotina no dia 1 mostra a intro", () => {
    const get = (_k: string, f: unknown) => f;
    expect(porQueNaoMostrar("casa", get as never)).toBeNull();
    // (a) uma dose na tela
    document.documentElement.dataset.missaoDose = "1";
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    delete document.documentElement.dataset.missaoDose;
    (globalThis as { __QA_MISSAO_DOSES__?: boolean }).__QA_MISSAO_DOSES__ = true; // a missão na web só liga por QA
    localStorage.setItem(CHAVE_FORCA_MISSAO_DOSES, "on");
    // (b) o export do ramo da missão manda quando existe
    missaoHoje.v = "casa";
    expect(porQueNaoMostrar("casa", get as never)).toBe("missao");
    expect(porQueNaoMostrar("dieta", get as never)).toBeNull();
    missaoHoje.v = null;
    // (b) sem o export: o próximo passo por fazer, se é de hoje no calendário da missão
    const m = iniciarMissao(["financas", "rotina", "saude"]); // nasceu hoje, braço A (1 dose por dia), dose 1 por fazer
    gravarMissao(m);
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao"); // a dose de hoje É a intro de Finanças
    expect(porQueNaoMostrar("rotina", get as never)).toBeNull(); // abriu Rotina por curiosidade no dia 1: intro normal
    expect(porQueNaoMostrar("saude", get as never)).toBeNull();
    expect(porQueNaoMostrar("dieta", get as never)).toBeNull();
    // (c) dose 1 feita hoje: Finanças fica bloqueada (seria repetir a mesma ação); Rotina (dose de amanhã) continua livre
    const feita = { dia: localDayKey(), rotulo: "Café · R$ 12" };
    gravarMissao({ ...m, feitos: { 1: feita } } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao");
    expect(porQueNaoMostrar("rotina", get as never)).toBeNull();
    // dia 2 (a missão nasceu ontem): a dose 2 (Rotina) é a de hoje → bloqueada enquanto estiver por fazer; Saúde (dia 3) livre
    gravarMissao({ ...iniciarMissao(["financas", "rotina", "saude"], ontem()), feitos: { 1: { dia: ontem(), rotulo: "x" } } } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("rotina", get as never)).toBe("missao");
    expect(porQueNaoMostrar("saude", get as never)).toBeNull();
    // braço B (as 3 doses no dia 1, só com a chave do dia 1 cheio ligada): o próximo passo por fazer é sempre de hoje
    guardarForcaDia1Cheio("?dia1-cheio=on");
    gravarMissao({ ...m, braco: "B", feitos: { 1: feita } } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("rotina", get as never)).toBe("missao");
    expect(porQueNaoMostrar("saude", get as never)).toBeNull();
    guardarForcaDia1Cheio("?dia1-cheio=auto");
    // missão completa: as 3 doses foram as intros deles; o resto, livre
    gravarMissao({ ...m, feitos: { 1: feita, 2: feita, 3: feita } } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao");
    expect(porQueNaoMostrar("rotina", get as never)).toBe("missao");
    expect(porQueNaoMostrar("saude", get as never)).toBe("missao");
    expect(porQueNaoMostrar("dieta", get as never)).toBeNull();
    // pulou a missão inteira: nenhuma dose aconteceu → tudo livre; com a dose 1 feita antes de pular, só Finanças fica
    gravarMissao({ ...m, explorou: true } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("financas", get as never)).toBeNull();
    gravarMissao({ ...m, explorou: true, feitos: { 1: feita } } as EstadoMissaoDoses);
    expect(porQueNaoMostrar("financas", get as never)).toBe("missao");
    expect(porQueNaoMostrar("rotina", get as never)).toBeNull();
    // e na tela: a dose de hoje por fazer não ganha a intro; Rotina ganha
    gravarMissao(m);
    const a = montar(<IntroDoModulo moduleId="financas" />);
    expect(a.container.innerHTML).toBe("");
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    a.unmount();
    montar(<IntroDoModulo moduleId="rotina" />);
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("marca 1 hábito");
  });

  it("introConcluida: só a intro FEITA conta (pular não), pelo aparelho, pelo get da conta ou pelo cache do user_data", () => {
    expect(introConcluida("casa")).toBe(false);
    localStorage.setItem(chaveIntroVista("casa"), "pulada@2026-10-17T10:00:00.000Z");
    expect(introConcluida("casa")).toBe(false);
    localStorage.setItem(chaveIntroVista("casa"), "feita@2026-10-17T10:00:00.000Z");
    expect(introConcluida("casa")).toBe(true);
    localStorage.clear();
    localStorage.setItem("u:conta-x:core-intro-feitas", JSON.stringify(["treino"])); // o cache do user_data, sem precisar do hook
    expect(introConcluida("treino")).toBe(true);
    expect(introConcluida("dieta")).toBe(false);
    localStorage.setItem("guest:core-intro-feitas", JSON.stringify(["dieta"]));
    expect(introConcluida("dieta")).toBe(true);
    const get = <T,>(k: string, f: T): T => (k === CHAVE_INTRO_FEITAS_CONTA ? (["estudos"] as never) : f);
    expect(introConcluida("estudos", get)).toBe(true);
    expect(introConcluida("casa", get)).toBe(false);
  });

  it("Montar Finanças na tela: a intro espera; o evento de fim + o atributo saindo do <html> ⇒ ela começa; renda e contas fixas não desqualificam", async () => {
    document.documentElement.setAttribute(ATRIBUTO_MONTAR_FINANCAS, "1");
    const dados = { "finance-incomes": [{ id: "r", value: 2400, description: "Salário", date: localDayKey() }], "finance-fixed-expenses": [{ id: "f", value: 1100, description: "Aluguel", day: 5 }] };
    const { container } = montar(<div><button type="button" data-spotlight="add-expense">+</button><IntroDoModulo moduleId="financas" /></div>, dados);
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    expect(localStorage.getItem(chaveIntroAberta("financas"))).toBeNull();
    // o evento chega enquanto o Montar ainda está saindo (atributo ainda lá): continua esperando
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_FINANCAS_FIM, { detail: { resultado: "pronto" } })); });
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    act(() => { document.documentElement.removeAttribute(ATRIBUTO_MONTAR_FINANCAS); });
    await waitFor(() => expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeTruthy());
    expect(container).toBeTruthy();
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("toca em 1 gasto");
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

/* ───────────────────────────────── a intro de 1 toque ───────────────────────────────── */
describe("ligada: a intro de 1 toque de cada módulo (o padrão da Saúde, 17/10)", () => {
  beforeEach(ligar);
  const hoje = localDayKey();
  const comodos = () => <div><header><button type="button">🚪 CÔMODOS</button></header><div><input placeholder="Adicionar item..." /><button type="button">+</button></div></div>;

  it("Casa (4 passos): a faixa '1 de 4' com 'Pular' à vista, o anel no campo real, chip grava 1 tarefa no cômodo (a ação #1) → olha → mercado → olha → o cartão do fim junta o que entrou e 'Pronto' marca vista (aparelho + conta)", { timeout: 40_000 }, async () => {
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const { estado } = montar(<>{comodos()}<BoasVindasDoModulo moduleId="casa" tips={["Dica antiga"]} /></>);
    expect(screen.queryByText("Dica antiga")).toBeNull();
    expect(card()?.textContent).toContain("1 de 4 · organiza 1 cômodo");
    expect(screen.getByTestId("intro-modulo-pular")).toBeTruthy();
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.modulo === "casa" && d.formato === "toque" && d.passos === 4)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-anel")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByTestId("demo-guia-postit").textContent).toContain("Qual cômodo você quer organizar primeiro?");
    expect(screen.getAllByTestId("demo-guia-chip").map((c) => c.textContent)).toEqual(["🍳Cozinha", "🛏️Quarto", "🚿Banheiro"]);
    await tocar(0);
    const rooms = estado.dados["casa-rooms"] as Array<{ name: string; tasks: Array<{ text: string; done: boolean }> }>;
    expect(rooms.map((r) => r.name)).toEqual(["COZINHA", "SALA", "QUARTO", "BANHEIRO", "ÁREA DE SERVIÇO", "ESCRITÓRIO"]); // os cômodos padrão nascem junto
    expect(rooms.flatMap((r) => r.tasks)).toEqual([{ id: expect.any(String), text: "Lavar a louça", done: false }]); // 1 toque = 1 tarefa, no cômodo certo
    expect(rooms[0].tasks).toHaveLength(1);
    expect(estado.dados["casa-grocery-categories"]).toBeUndefined();
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "chip" && d.opcao === "cozinha" && d.passo === 1)).toBeTruthy();
    // 2) o "olha" do cômodo (sem o card no DOM de mentira: pulado sozinho) → 3) o mercado (chips) → 4) olha a limpeza (pulado) → o fim
    await waitFor(() => expect(card()?.textContent).toContain("3 de 4 · anota 1 item do mercado"), { timeout: 9000 });
    expect(eventos.find(([n, d]) => n === "modulo_intro_olhar" && d.passo === 2 && d.via === "pulado")).toBeTruthy();
    await tocar(0); // Leite
    const cats = estado.dados["casa-grocery-categories"] as typeof CATEGORIAS_PADRAO_MERCADO;
    expect(cats.flatMap((c) => c.items.map((i) => i.text))).toEqual(["Leite"]);
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 9000 });
    expect(screen.getByTestId("intro-modulo-pronto").textContent).toContain("Lavar a louça (Cozinha) e Leite já estão aqui. Casa é isso");
    expect(screen.queryByTestId("intro-modulo-conhecer-mais")).toBeNull(); // Casa não tem passeio: sem oferta
    expect(card()?.textContent).toContain("pronto ✓");
    expect(eventos.find(([n, d]) => n === "modulo_intro_registrou" && d.via === "chip")).toBeTruthy();
    expect(eventos.find(([n]) => n === "modulo_intro_concluida")).toBeTruthy();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toBeNull(); // só o "Pronto" (ou o tempo) marca
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toMatch(/^feita@/);
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(estado.dados[CHAVE_INTRO_FEITAS_CONTA]).toEqual(["casa"]);
    expect(introConcluida("casa")).toBe(true);
    medir.mockRestore();
  });

  it("Pular fecha, marca vista (pulada, não feita) e conta como pulada", () => {
    const { estado } = montar(<IntroDoModulo moduleId="casa" />);
    fireEvent.click(screen.getByTestId("intro-modulo-pular"));
    expect(card()).toBeNull();
    expect(localStorage.getItem(chaveIntroVista("casa"))).toMatch(/^pulada@/);
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["casa"]);
    expect(estado.dados[CHAVE_INTRO_FEITAS_CONTA]).toBeUndefined();
    expect(introConcluida("casa")).toBe(false);
    expect(eventos.find(([n, d]) => n === "modulo_intro_pulou" && d.fase === "toque" && d.passo === 1)).toBeTruthy();
  });

  it("sem o controle real na tela (módulo pesado, aba diferente): o post-it fica SOLTO embaixo da faixa e os chips continuam funcionando", async () => {
    const { estado } = montar(<IntroDoModulo moduleId="estudos" />);
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-postit-solto")).toBeTruthy(), { timeout: 8000 });
    expect(screen.queryByTestId("intro-modulo-anel")).toBeNull();
    await tocar(0);
    expect(estado.dados["estudos-cursos-andamento"]).toMatchObject([{ name: "Inglês" }]);
  }, 12_000);

  it("Treino (4 passos): 'Qual treino você faz hoje?' monta o treino de HOJE no plano real → marcar o 1º exercício no módulo (a ação #1) → olha a semana → olha os modelos → o fim junta o que entrou", { timeout: 40_000 }, async () => {
    expect(TREINOS_DE_HOJE.map((t) => t.rotulo)).toEqual(["Peito e tríceps", "Costas e bíceps", "Pernas", "Em casa", "Corrida"]);
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const { estado, set } = montarComSet(<><header><button type="button">📋 PLANO</button><button type="button">🏋️ HOJE</button></header><section data-testid="plano-semana"><h2>MEU PLANO DA SEMANA</h2></section><div data-testid="treino-hoje"><button type="button" aria-label="Marcar Supino reto inteiro">☐</button></div><IntroDoModulo moduleId="treino" /></>);
    expect(card()?.textContent).toContain("1 de 4 · monta o treino de hoje");
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-anel")).toBeTruthy(), { timeout: 3000 });
    await tocar(0); // Peito e tríceps
    const plano = estado.dados["saude-workouts-v2"] as Record<string, { muscles: string[]; exercises: Array<{ name: string; sets: string; done: boolean }> }>;
    const dia = diaDaSemana();
    expect(plano[dia].muscles).toEqual(["Peito", "Tríceps"]);
    expect(plano[dia].exercises).toHaveLength(5);
    expect(plano[dia].exercises[0]).toMatchObject({ name: "Supino reto", sets: "4", done: false });
    expect(estado.dados["treino-active-days"]).toContain(dia);
    // passo 2: o anel vai pro quadradinho do 1º exercício de HOJE e espera a pessoa marcar (nenhum chip)
    await waitFor(() => expect(card()?.textContent).toContain("2 de 4 · marca a 1ª série"), { timeout: 2500 });
    await waitFor(() => expect(screen.getByTestId("demo-guia-postit").textContent).toContain("Fez o primeiro? Marca ali"), { timeout: 3000 });
    expect(screen.queryAllByTestId("demo-guia-chip")).toHaveLength(0);
    expect(screen.queryByTestId("intro-modulo-pronto")).toBeNull();
    act(() => { set("saude-workouts-v2", { ...plano, [dia]: { ...plano[dia], exercises: plano[dia].exercises.map((e, i) => (i === 0 ? { ...e, done: true } : e)) } }); }); // ela marcou no módulo
    // 3) olha a semana e 4) olha os modelos: sem os cards no DOM de mentira, pulados sozinhos → o fim
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 12_000 });
    expect(screen.getByTestId("intro-modulo-pronto").textContent).toContain("Peito e tríceps (5 exercícios) e Supino reto feito já estão aqui. Marca cada série no HOJE");
    expect(screen.getByTestId("intro-modulo-conhecer-mais").textContent).toContain("Ver mais 4 dicas de Treino"); // o passeio do Treino (17/10)
    expect(eventos.filter(([n]) => n === "modulo_intro_registrou").map(([, d]) => [d.passo, d.via])).toEqual([[1, "chip"], [2, "foco"]]);
    medir.mockRestore();
    // os outros chips, puros: casa = 5 de chão; corrida = cardio de 20 min; dia que já tem exercício fica com os dele
    const ctx = (dados: Record<string, unknown>): ContextoDaAcao & { dados: Record<string, unknown> } => { const d = { ...dados }; return { dados: d, get: <T,>(k: string, f: T) => (k in d ? (d[k] as T) : f), gravar: (k, v) => { d[k] = v; } }; };
    const casa = ctx({});
    expect(montarTreinoDeHoje(casa, "em_casa")).toMatchObject({ rotulo: "Em casa", exercicios: 5 });
    expect((casa.dados["saude-workouts-v2"] as Record<string, { exercises: Array<{ name: string }> }>)[dia].exercises.map((e) => e.name)).toEqual(["Flexão de braço", "Agachamento livre", "Afundo", "Prancha", "Abdominal supra"]);
    const corrida = ctx({});
    montarTreinoDeHoje(corrida, "corrida");
    expect((corrida.dados["saude-workouts-v2"] as Record<string, { exercises: Array<{ name: string; tipo?: string; duracao?: string }> }>)[dia].exercises).toMatchObject([{ name: "Corrida", tipo: "cardio", duracao: "20" }]);
    const cheio = ctx({ "saude-workouts-v2": { [dia]: { muscles: ["Costas"], exercises: [{ name: "Remada", sets: "3", reps: "10", carga: "", done: false, obs: "" }] } } });
    expect(montarTreinoDeHoje(cheio, "pernas").exercicios).toBe(1);
    expect((cheio.dados["saude-workouts-v2"] as Record<string, { muscles: string[] }>)[dia].muscles).toEqual(["Pernas"]);
  });

  it("EscolherTreino (só a missão monta): 2 perguntas → o modelo existente que casa, gravado pelo caminho do módulo; o bloco de modelos do módulo some enquanto o quiz está na tela", async () => {
    expect(modeloPara("academia", "2-3").nome).toBe("Full Body 3x");
    expect(modeloPara("academia", "4").nome).toBe("Upper / Lower");
    expect(modeloPara("academia", "5-6").nome).toBe("Push / Pull / Legs");
    expect(modeloPara("casa", "5-6")).toMatchObject({ nome: "Full Body 3x" });
    expect(modeloPara("casa", "4").aviso).toMatch(/em casa/);
    const pronto = vi.fn();
    const { estado } = montar(<EscolherTreino onPronto={pronto} />);
    expect(document.documentElement.hasAttribute("data-escolher-treino")).toBe(true);
    expect(eventos.find(([n, d]) => n === "modulo_intro_vista" && d.modulo === "treino" && d.formato === "escolha")).toBeTruthy();
    const dias = screen.getAllByTestId("escolher-dias");
    expect((dias[0] as HTMLButtonElement).disabled).toBe(true); // primeiro "onde"
    fireEvent.click(screen.getAllByTestId("escolher-onde")[0]); // Academia
    fireEvent.click(dias[1]); // 4 dias
    const plano = estado.dados["saude-workouts-v2"] as Record<string, { muscles: string[] }>;
    expect(plano.SEGUNDA.muscles).toContain("Peito");
    expect(plano["TERÇA"].muscles).toContain("Quadríceps");
    expect(estado.dados["treino-active-days"]).toEqual(["SEGUNDA", "TERÇA", "QUINTA", "SEXTA"]);
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "escolha" && d.onde === "academia" && d.dias === "4" && d.modelo === "Upper / Lower")).toBeTruthy();
    expect(screen.getByTestId("escolher-treino-pronto").textContent).toContain("Upper / Lower");
    await waitFor(() => expect(pronto).toHaveBeenCalledWith({ onde: "academia", dias: "4", modelo: "Upper / Lower" }), { timeout: 2500 });
    cleanup();
    expect(document.documentElement.hasAttribute("data-escolher-treino")).toBe(false);
  });

  it("Dieta: o chip grava o café da manhã de HOJE no cardápio, sem mexer no resto", async () => {
    const plano = { SEGUNDA: { "Café da Manhã": "", Almoço: "" }, [diaDaSemana()]: { "Café da Manhã": "", Almoço: "" } };
    const { estado } = montar(<IntroDoModulo moduleId="dieta" />, { "saude-meals": plano });
    expect(card()?.textContent).toContain("anota o café de hoje");
    await chip(0);
    expect(screen.getByTestId("demo-guia-postit").textContent).toContain("O que foi o seu café da manhã hoje?");
    expect(screen.getAllByTestId("demo-guia-chip")).toHaveLength(3);
    await tocar(1);
    const meals = estado.dados["saude-meals"] as Record<string, Record<string, string>>;
    expect(meals[diaDaSemana()]["Café da Manhã"]).toBe("Ovos mexidos");
    expect(meals[diaDaSemana()].Almoço).toBe("");
    expect(meals.SEGUNDA["Café da Manhã"]).toBe("");
    expect(eventos.find(([n, d]) => n === "modulo_intro_acao" && d.via === "chip" && d.opcao === "ovos")).toBeTruthy();
  }, 12_000);

  it("Dieta: o alvo do post-it é o card de HOJE e abre SÓ o botão 'Abrir <dia>' — nunca o gatilho do diálogo 'Limpar cardápio' (bug de 16/10)", () => {
    const limpar = vi.fn(), abrir = vi.fn();
    document.body.innerHTML = `<div data-spotlight="first-day"><div id="cabecalho"><button id="limpar" aria-expanded="false" aria-haspopup="dialog">Limpar</button><button id="abrir" aria-label="Abrir SEXTA" aria-expanded="false">SEXTA</button></div></div>`;
    document.getElementById("limpar")!.addEventListener("click", limpar);
    document.getElementById("abrir")!.addEventListener("click", abrir);
    const cfg = INTROS.dieta;
    const alvo = cfg.formato === "toque" ? cfg.passos[0].alvo : undefined;
    expect(alvo?.aba).toBe("CARDÁPIO");
    expect(alvo?.achar()?.id).toBe("cabecalho");
    expect(limpar).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledTimes(1);
    // o card já aberto ("Recolher") não é tocado
    document.body.innerHTML = `<div data-spotlight="first-day"><div><button id="limpar" aria-expanded="false" aria-haspopup="dialog">Limpar</button><button id="recolher" aria-label="Recolher SEXTA" aria-expanded="true">SEXTA</button></div></div>`;
    const recolher = vi.fn(); document.getElementById("recolher")!.addEventListener("click", recolher); document.getElementById("limpar")!.addEventListener("click", limpar);
    alvo?.achar();
    expect(limpar).not.toHaveBeenCalled();
    expect(recolher).not.toHaveBeenCalled();
  });

  it("Estudos, Biblioteca, Metas, Carreira e Detox: cada chip grava no formato do módulo", async () => {
    const e = montar(<IntroDoModulo moduleId="estudos" />);
    await tocar(0);
    expect(e.estado.dados["estudos-cursos-andamento"]).toMatchObject([{ name: "Inglês" }]);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const b = montar(<IntroDoModulo moduleId="biblioteca" />);
    await tocar(0);
    expect(b.estado.dados["lib-books"]).toMatchObject([{ title: "Hábitos Atômicos", author: "James Clear", status: "lendo", currentPage: 0, quotes: [] }]);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const d = montar(<IntroDoModulo moduleId="desenvolvimento" />);
    await tocar(1);
    const metas = d.estado.dados["goals-board-v2"] as Array<{ title: string; actionGroups: unknown[] }>;
    expect(metas).toHaveLength(1);
    expect(metas[0].title).toBe("Guardar R$ 1.000");
    expect(metas[0].actionGroups).toHaveLength(2);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const c = montar(<IntroDoModulo moduleId="carreira" />);
    await tocar(2);
    expect(c.estado.dados["career-day-tasks"]).toMatchObject([{ texto: "Ligar pro cliente", feito: false, dia: hoje }]);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const x = montar(<IntroDoModulo moduleId="detox" />);
    await tocar(1);
    expect(x.estado.dados["detox-habits"]).toMatchObject([{ name: "Açúcar", icon: "🍬", startDate: hoje, relapses: [], record: 0, checkins: [] }]);
  }, 40_000);

  it("Mente, Viagens, Beleza, Relações e Pet (17/10): cada chip grava no formato do módulo — 1 toque de verdade, nada de vídeo nem campo vazio", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 14, 30));
    const m = montar(<IntroDoModulo moduleId="hiperfoco" />);
    await tocar(1);
    expect(m.estado.dados["hiperfoco-thoughts"]).toEqual({ "2026-10-17": { 14: [expect.objectContaining({ text: "Uma ideia pra não perder", tags: [], hour: 14 })] } });
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const v = montar(<IntroDoModulo moduleId="viagens" />);
    await tocar(1);
    expect(v.estado.dados["travel-bucket"]).toMatchObject([{ name: "Gramado", country: "Brasil", visited: false, priority: "sonho" }]);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const b = montar(<IntroDoModulo moduleId="beleza" />);
    expect(card()?.textContent).toContain("monta o seu skincare");
    await tocar(0); // Oleosa
    expect(b.estado.dados["skincare-perfil"]).toMatchObject({ pele: "oleosa", objetivo: "basico", nivel: "iniciante" });
    expect((b.estado.dados["skincare-am-steps"] as unknown[]).length).toBeGreaterThan(0);
    expect((b.estado.dados["skincare-pm-steps"] as unknown[]).length).toBeGreaterThan(0);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const r = montar(<IntroDoModulo moduleId="relacionamentos" />);
    await tocar(0); // Mãe
    expect(r.estado.dados["rel-people"]).toMatchObject([{ name: "Mãe", relation: "Mãe", circulo: "familia", birthday: "" }]);
    cleanup(); document.body.innerHTML = ""; localStorage.clear(); ligar();

    const p = montar(<IntroDoModulo moduleId="pet" />);
    await tocar(1); // Gato
    const pets = p.estado.dados["pet-list"] as Array<{ id: string; name: string; species: string }>;
    expect(pets).toMatchObject([{ name: "Meu gato", species: "Gato", faixa: "adulto" }]);
    expect((p.estado.dados[`pet-routine-tasks-${pets[0].id}`] as Array<{ id: string }>)[0]).toMatchObject({ id: "food" });
    vi.useRealTimers();
  }, 40_000);

  it("vários passos: cada um é 1 toque; a faixa conta '1 de 2'; o fim junta o que entrou", async () => {
    const escritas: Record<string, unknown> = {};
    const config: IntroDeUmToqueConfig = {
      formato: "toque", moduleId: "casa", nome: "Casa", pedido: "2 toques", pronto: "Pronto é isso.",
      cor: { faixa: "#eee", tinta: "#111", acento: "#222" }, vazio: () => true,
      passos: [
        { pergunta: "Primeiro?", opcoes: [{ emoji: "a", rotulo: "Leite", id: "leite" }], executar: (_c, o) => { escritas.p1 = o.id; } },
        { pergunta: "Segundo?", opcoes: [{ emoji: "b", rotulo: "Pão", id: "pao" }], executar: (_c, o) => { escritas.p2 = o.id; return "Pão francês"; } },
      ],
    };
    const fim = vi.fn();
    montar(<IntroDeUmToque config={config} aoTerminar={fim} />);
    expect(card()?.textContent).toContain("1 de 2 · 2 toques");
    await waitFor(() => expect(screen.queryByTestId("demo-guia-postit")).toBeTruthy(), { timeout: 8000 });
    expect(screen.getByTestId("demo-guia-postit").textContent).toContain("1 de 2 · 1 toque");
    await tocar(0);
    await waitFor(() => expect(card()?.textContent).toContain("2 de 2 · 2 toques"), { timeout: 2500 });
    await waitFor(() => expect(screen.getByTestId("demo-guia-postit").textContent).toContain("Segundo?"), { timeout: 8000 });
    await tocar(0);
    await waitFor(() => expect(screen.queryByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 2500 });
    expect(screen.getByTestId("intro-modulo-pronto").textContent).toContain("Leite e Pão francês já estão aqui. Pronto é isso.");
    expect(escritas).toEqual({ p1: "leite", p2: "pao" });
    expect(eventos.filter(([n]) => n === "modulo_intro_registrou").map(([, d]) => d.passo)).toEqual([1, 2]);
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(fim).toHaveBeenCalledWith("feita");
  }, 20_000);
});

describe("Montar Rotina (ramo v1016-rotina, só como 1ª dose da missão)", () => {
  beforeEach(ligar);
  it("com o montar na tela a intro espera; 'pronto' + o atributo saindo ⇒ a intro começa pedindo 'marca o primeiro quando fizer' (os hábitos criados não contam como dado)", async () => {
    expect(MONTAR_ROTINA).toEqual({ evento: EVENTO_MONTAR_ROTINA_FIM, atributo: ATRIBUTO_MONTAR_ROTINA });
    document.documentElement.setAttribute(ATRIBUTO_MONTAR_ROTINA, "1");
    expect(montarNaTela(MONTAR_ROTINA)).toBe(true);
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const dados = { "rotina-habits": ["Beber água ao acordar", "Alongar 5 min"] }; // o que o montar criou
    montar(<div><button type="button" data-spotlight="add-habit">+ Hábito</button><IntroDoModulo moduleId="rotina" /></div>, dados);
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull();
    act(() => { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_ROTINA_FIM, { detail: { resultado: "pronto" } })); });
    expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeNull(); // o atributo ainda está lá
    act(() => { document.documentElement.removeAttribute(ATRIBUTO_MONTAR_ROTINA); });
    await waitFor(() => expect(document.querySelector("[data-testid=intro-modulo-faixa]")).toBeTruthy());
    const postIt = await screen.findAllByTestId("demo-guia-postit", {}, { timeout: 4000 });
    expect(postIt.at(-1)!.textContent).toContain("Marca o primeiro quando fizer");
    expect(postIt.at(-1)!.textContent).toContain("A linha de HOJE");
    medir.mockRestore();
  });
  it("o chip da Rotina cria o hábito em 1 TOQUE (preenche o campo real e toca no Adicionar do módulo) e o anel vai pro quadradinho de hoje", async () => {
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
    const Modulo = () => {
      const { get, set } = useUserData();
      const [nome, setNome] = useState("");
      const habitos = get<string[]>("rotina-habits", []) ?? [];
      return (
        <div>
          <div className="rounded-2xl">
            <button type="button" data-spotlight="add-habit">+ Hábito</button>
            <div><input placeholder="Nome do hábito..." value={nome} onChange={(e) => setNome(e.target.value)} /><button type="button" onClick={() => { if (nome.trim()) { set("rotina-habits", [...habitos, nome.trim()]); setNome(""); } }}>Adicionar</button></div>
            <table><tbody>{DIAS.map((d) => <tr key={d}><td>{d}</td>{habitos.map((h) => <td key={h}><input type="checkbox" aria-label={`${h} ${d}`} /></td>)}</tr>)}</tbody></table>
          </div>
          <IntroDoModulo moduleId="rotina" />
        </div>
      );
    };
    const { estado } = montar(<Modulo />);
    const chips = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 6000 });
    fireEvent.click(chips[0]); // Beber água ao acordar
    await waitFor(() => expect(estado.dados["rotina-habits"]).toEqual(["Beber água ao acordar"]), { timeout: 3000 });
    expect(eventos.find(([n, d]) => n === "modulo_intro_registrou" && d.via === "criar_habito")).toBeTruthy();
    // passo 2: o anel abraça o QUADRADINHO de hoje (a célula com o checkbox), não a linha inteira
    await waitFor(() => expect(screen.getAllByTestId("demo-guia-postit").at(-1)!.textContent).toContain("Agora marca o quadradinho de hoje"), { timeout: 4000 });
    expect(screen.getAllByTestId("demo-guia-postit").at(-1)!.textContent).toContain("2 de 2");
    medir.mockRestore();
  });

  it("âncora perdida (saiu da tela, segundo plano, tempo): o post-it com os chips continua na tela, solto no topo — nunca some em silêncio", async () => {
    let medida = { top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect;
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => medida);
    montar(<div><div><input placeholder="+ Novo gasto" /><button data-spotlight="add-expense">+</button></div><IntroDoModulo moduleId="financas" /></div>);
    await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    expect(screen.queryByTestId("intro-modulo-postit-solto")).toBeNull(); // com o anel, o post-it mora no anel
    medida = { ...medida, width: 0, height: 0 } as DOMRect; // o alvo sumiu (a tela mudou)
    await waitFor(() => expect(screen.getByTestId("intro-modulo-postit-solto")).toBeTruthy(), { timeout: 3000 });
    expect(screen.getAllByTestId("demo-guia-chip").length).toBeGreaterThan(0);
    expect(eventos.find(([n, d]) => n === "modulo_intro_anel_saiu" && d.motivo === "ancora_invisivel")).toBeTruthy();
    medir.mockRestore();
  });

  it("sem o montar (abriu por curiosidade): a intro de sempre, 'criar' o 1º hábito", { timeout: 20_000 }, async () => {
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    montar(<div><button type="button" data-spotlight="add-habit">+ Hábito</button><IntroDoModulo moduleId="rotina" /></div>);
    expect(screen.getByTestId("intro-modulo-faixa").textContent).toContain("marca 1 hábito");
    // (sem o campo do hábito no DOM de mentira, a intro procura ~5,4 s e segue no botão — com folga pra suíte carregada)
    const postIt = await screen.findAllByTestId("demo-guia-postit", {}, { timeout: 10_000 });
    expect(postIt.at(-1)!.textContent).toContain("Qual hábito você quer começar hoje?");
    medir.mockRestore();
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
  it("a faixa sobe, o post-it acha o controle real e o chip grava o gasto na conta no formato do módulo; depois do 'olha' continua na conta fixa (passos 3–4) e o 'pronto' marca vista", { timeout: 40_000 }, async () => {
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
    // sem o card MEU MÊS na tela, o "olha" é pulado (fail-open) e a intro CONTINUA nos passos 3 e 4 (17/10): a conta fixa, o olha dela
    await waitFor(() => expect(card()?.textContent).toContain("3 de 4 · anota 1 conta fixa"), { timeout: 4000 });
    expect(screen.queryByTestId("intro-modulo-pronto")).toBeNull();
    await tocar(0); // Aluguel
    expect(estado.dados["finance-fixed-expenses"]).toMatchObject([{ description: "Aluguel", value: 1200, paymentMethod: "pix" }]);
    await waitFor(() => expect(screen.getByTestId("intro-modulo-pronto")).toBeTruthy(), { timeout: 9000 });
    expect(screen.getByTestId("intro-modulo-pronto").textContent).toContain("Café · R$ 12 e Aluguel · R$ 1.200 já estão aqui. Finanças é isso");
    fireEvent.click(screen.getByTestId("intro-modulo-fechar"));
    expect(localStorage.getItem(chaveIntroVista("financas"))).toBeTruthy();
    expect(estado.dados[CHAVE_INTRO_VISTAS_CONTA]).toEqual(["financas"]);
    expect(document.documentElement.getAttribute("data-intro-modulo-faixa")).toBeNull();
    medir.mockRestore();
  });

  it("depois do Montar (renda gravada): o 'olha' vai no QUANTO POSSO GASTAR HOJE do Dashboard, com o número de antes → depois", async () => {
    const dias = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1;
    // o Dashboard de mentira: o card com o número REAL da conta (renda − gastos) ÷ dias restantes, como o computeDailyBudget
    const Modulo = () => {
      const { get } = useUserData();
      const gastos = (get<Array<{ value: number }>>("finance-expenses", []) ?? []).reduce((s, e) => s + Number(e.value || 0), 0);
      return (
        <div>
          <header><button type="button">📊 DASHBOARD</button><button type="button">💰 MEU FINANCEIRO</button></header>
          <div><input placeholder="+ Novo gasto" /><button data-spotlight="add-expense">+</button></div>
          <div data-missao="posso-gastar"><h3>QUANTO POSSO GASTAR HOJE</h3><p>R$ {Math.round((2400 - gastos) / dias)}</p></div>
          <IntroDoModulo moduleId="financas" />
        </div>
      );
    };
    const medir = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 200, left: 10, width: 300, height: 40, right: 310, bottom: 240, x: 10, y: 200, toJSON: () => ({}) } as DOMRect);
    const dados = { "finance-incomes": [{ id: "r", value: 2400, description: "Salário", date: localDayKey() }] };
    expect(OLHAR_POSSO_GASTAR.quando((k, f) => (k === "finance-incomes" ? (dados["finance-incomes"] as never) : f))).toBe(true);
    expect(OLHAR_POSSO_GASTAR.quando((_k, f) => f)).toBe(false);
    montar(<Modulo />, dados);
    const chip = await screen.findAllByTestId("demo-guia-chip", {}, { timeout: 4000 });
    fireEvent.click(chip[0]); // Café · R$ 12
    await waitFor(() => expect(screen.getByTestId("intro-modulo-olhar")).toBeTruthy(), { timeout: 6000 });
    const balao = screen.getByTestId("intro-modulo-olhar");
    expect(balao.textContent).toContain("Esse número é o seu guia do dia");
    expect(balao.textContent).toContain("Hoje dá pra gastar");
    const antes = Math.round(2400 / dias), depois = Math.round((2400 - 12) / dias);
    if (antes !== depois) expect(balao.textContent).toContain(`R$ ${antes}`);
    expect(eventos.find(([n, d]) => n === "modulo_intro_olhar" && d.resumo === "alternativo")).toBeTruthy();
    medir.mockRestore();
  });
});
