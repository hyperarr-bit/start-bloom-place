/**
 * MEDIÇÃO TOTAL (1.0.16) NAS TELAS DE VERDADE — privacidade e cobertura.
 *
 * PRIVACIDADE: a conta tem dado com SENTINELAS (hábito, gasto, categoria, livro, autor, pessoa,
 * nota, tarefa, nome da pessoa) e um hábito chamado "Conquistas" — texto que EXISTE no código
 * (item do menu) mas aqui é dado. Home, Rotina, Finanças, Biblioteca e Relações são montadas,
 * TODO elemento tocável é tocado (2 rodadas: o que abre folha também é tocado por dentro), as
 * folhas são varridas, e o `uso_resumo` que sairia não pode conter nenhuma sentinela nem
 * "CONQUISTAS". O dicionário é o do build de verdade (virtual:medicao-textos).
 *
 * COBERTURA: as chaves de cada bloco da Home (cabeçalho, ações rápidas, widgets, pendências,
 * grade de módulos, menu da conta) e de 3 módulos aparecem, com aba (TrackedModule) e blocos vistos.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const enviados = vi.hoisted(() => ({ beacon: [] as Array<[string, Record<string, unknown>]>, normal: [] as Array<[string, Record<string, unknown>]> }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { enviados.normal.push([n, d]); },
  trackEventBeacon: (n: string, d: Record<string, unknown> = {}) => { enviados.beacon.push([n, d]); },
  markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
// objeto ESTÁVEL (como o provider de verdade): um `user` novo a cada render faz a Home reexecutar o efeito do onboarding em loop
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} },
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => auth,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
let linhasDoServidor: Array<{ key: string; value: unknown }> = [];
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  const fim = async () => ({ data: linhasDoServidor, error: null });
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    abortSignal: fim, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q,
      rpc: async () => ({ data: null, error: null }),
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: {
        getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }),
        resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: vi.fn(),
    },
  };
});

import {
  _telaEAba, _zerarMedicaoTotal, anotarTela, carregarDicionario, chaveDoToque, descarregarResumo, ehDadoDaPessoa,
  instalarMedicaoTotal, nomeDaFolha, registrarLeitorDosDados, tituloSeguroDoCard, varrer,
} from "@/lib/medicao-total";
import { normalizarChave } from "@/lib/medicao-normalizar";
import { TrackedModule } from "@/components/TrackedModule";
import { AccountDrawer } from "@/components/home/AccountDrawer";
import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import HomePage from "@/pages/Home";
import Rotina from "@/pages/Rotina";
import Index from "@/pages/Index";
import Biblioteca from "@/pages/Biblioteca";
import Relacionamentos from "@/pages/Relacionamentos";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";
import { localDayKey } from "@/lib/utils";

const SENTINELAS = [
  "Zumbalaia", "Quixabeira Torta", "Pirilampo Xadrez", "Fulustreca", "Tamborete Azul", "Caramujo Lilás",
  "Xerimbabo Ferreira", "Anaclara Bittencourt", "Bolota Vasconcelos", "Jabuticaba Roxa",
];
const hoje = localDayKey();
const DADOS: Dados = {
  "core-user-name": "Anaclara Bittencourt",
  "core-onboarding-done": "true",
  "core-all-modules-celebrated": "true",
  // "Conquistas" é texto do código (item do menu da conta) — aqui é DADO da pessoa
  "rotina-habits": ["Zumbalaia", "Conquistas"],
  "rotina-urgencies": [{ id: "u1", text: "Jabuticaba Roxa", done: false }],
  "todo-list": [{ id: "t1", text: "Tamborete Azul", done: false, titulo: "Tamborete Azul" }],
  "core-home-quick-notes": "Caramujo Lilás com mais coisa escrita",
  "core-home-widgets-v2": [
    { id: "habits", size: "large" }, { id: "quick-notes", size: "large" }, { id: "tasks", size: "large" },
    { id: "finances", size: "small" }, { id: "reading", size: "small" }, { id: "relacoes", size: "large" },
  ],
  "finance-expenses": [
    { id: "e1", description: "Quixabeira Torta", category: "Fulustreca", value: 987.65, date: hoje, paymentMethod: "pix" },
    { id: "e2", description: "Zumbalaia", category: "Fulustreca", value: 12, date: hoje, paymentMethod: "credito", cardName: "Tamborete Azul" },
  ],
  "finance-incomes": [{ id: "i1", description: "Xerimbabo Ferreira", value: 5000, date: hoje }],
  "lib-books": [
    { id: "b1", title: "Pirilampo Xadrez", author: "Xerimbabo Ferreira", status: "lendo", pages: 300, currentPage: 40, genre: "Ficção", quotes: [], rating: 0, notes: "Caramujo Lilás" },
    { id: "b2", title: "Jabuticaba Roxa", author: "Bolota Vasconcelos", status: "lido", pages: 120, currentPage: 120, genre: "Ficção", quotes: [], rating: 4 },
  ],
  "rel-people": [
    { id: "p1", name: "Bolota Vasconcelos", relation: "Tamborete Azul", birthday: "1990-05-10" },
    { id: "p2", name: "Anaclara Bittencourt", relation: "amiga", birthday: "" },
  ],
};
for (const m of ["financas", "rotina", "biblioteca", "relacionamentos", "dieta", "treino", "saude"]) {
  DADOS[`spotlight-done-${m}`] = "true";
  DADOS[`core-tip-seen-${m}`] = "true";
}

/** Igual ao app: caixa alta, sem acento — é a forma que um texto teria numa chave. */
const formaDeChave = (s: string) => normalizarChave(s);
const SELETOR_TOCAVEL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], input, select, textarea, label, summary';
const comOnClick = (): Element[] => {
  const out: Element[] = [];
  document.querySelectorAll("div, span, li, section, article, p").forEach((el) => {
    const k = Object.keys(el).find((x) => x.startsWith("__reactProps$"));
    if (k && typeof (el as unknown as Record<string, { onClick?: unknown }>)[k]?.onClick === "function") out.push(el);
  });
  return out;
};
const respirar = async (n = 3) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

/** A chave que CADA controle da tela teria se fosse tocado, o título de cada card e o nome de cada folha
 *  aberta — sem tocar (a chave sai só do DOM). É o que a peneira tem que segurar. */
const chavesPossiveis = new Set<string>();
function anotarChavesPossiveis() {
  const { tela, aba } = _telaEAba();
  for (const el of [...document.querySelectorAll(SELETOR_TOCAVEL), ...comOnClick()]) {
    const k = chaveDoToque(el, tela, aba);
    if (k) chavesPossiveis.add(k);
  }
  document.querySelectorAll('[class*="rounded"][class*="border"],[data-card]').forEach((el) => { const t = tituloSeguroDoCard(el); if (t) chavesPossiveis.add(`card:${t}`); });
  document.querySelectorAll('[data-folha],[data-camada-guia],[role="dialog"],[role="alertdialog"],[aria-modal="true"]').forEach((el) => chavesPossiveis.add(`folha:${nomeDaFolha(el)}`));
}

/** Toca em tudo que dá pra tocar, em rodadas (o que abriu na rodada 1 é tocado na 2), anotando as chaves possíveis. */
async function tocarTudo(rodadas = 2, maxPorRodada = 260) {
  const tocados = new WeakSet<Element>();
  for (let r = 0; r < rodadas; r++) {
    anotarChavesPossiveis();
    const alvos = [...document.querySelectorAll(SELETOR_TOCAVEL), ...comOnClick()].filter((el) => !tocados.has(el)).slice(0, maxPorRodada);
    for (const el of alvos) {
      tocados.add(el);
      if (!el.isConnected) continue;
      try { fireEvent.click(el); } catch { /* handler quebrado não importa aqui */ }
      if (document.querySelector('[role="dialog"],[role="alertdialog"],[data-folha]')) anotarChavesPossiveis();
    }
    await respirar();
    varrer();
  }
  anotarChavesPossiveis();
}

/** Módulo: passa por TODAS as abas; em cada uma anota as chaves de todos os controles e toca em até `max`. */
async function percorrerAbas(max = 40) {
  const abas = () => [...document.querySelectorAll('[data-spotlight^="tab-"],[data-track^="tab-"],[data-spotlight="financeiro"]')];
  const ids = abas().map((el) => el.getAttribute("data-spotlight") || el.getAttribute("data-track"));
  for (const id of ids) {
    const botao = abas().find((el) => (el.getAttribute("data-spotlight") || el.getAttribute("data-track")) === id);
    if (!botao) continue;
    fireEvent.click(botao);
    await respirar(2);
    await tocarTudo(1, max);
  }
}

const textoDoResumo = (p: Record<string, unknown> | null) => JSON.stringify(p ?? {});

function semSentinela(p: Record<string, unknown> | null, extras: string[] = []) {
  const texto = textoDoResumo(p);
  const textoEmChave = formaDeChave(texto.replace(/[|":{},]/g, " "));
  for (const s of [...SENTINELAS, ...extras]) {
    expect(texto.toLowerCase(), `sentinela "${s}" no resumo`).not.toContain(s.toLowerCase());
    expect(textoEmChave, `sentinela "${s}" (forma de chave) no resumo`).not.toContain(formaDeChave(s));
  }
}

let erroGlobal: (e: ErrorEvent) => void;
beforeAll(async () => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return 120; } });
  window.confirm = () => false;
  window.alert = () => {};
  window.open = (() => null) as typeof window.open;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
  erroGlobal = (e: ErrorEvent) => e.preventDefault();
  window.addEventListener("error", erroGlobal);
  await carregarDicionario(); // o do build (o 1º carregamento lê o src inteiro)
}, 180_000);

beforeEach(() => {
  _zerarMedicaoTotal();
  localStorage.clear();
  enviados.beacon.length = 0;
  enviados.normal.length = 0;
  chavesPossiveis.clear();
});
afterEach(() => { cleanup(); _zerarMedicaoTotal(); });

/** Monta a tela com a nuvem em memória e a peneira lendo o store dela (como o use-user-data faz). */
async function abrir(rota: string, ui: ReactNode, dados: Dados = DADOS) {
  await carregarDicionario();
  instalarMedicaoTotal({ aceitarSinteticos: true, dedupeMs: 0 });
  anotarTela(rota);
  const n = criarNuvem(dados);
  registrarLeitorDosDados(() => n.estado.dados);
  n.montar(ui, rota);
  await respirar(6);
  return n;
}

describe("privacidade: nenhum dado da pessoa vira chave", () => {
  it("Home inteira (cabeçalho, menu da conta, ações rápidas, widgets, pendências, módulos): tocar no que abre algo e derivar a chave de tudo", async () => {
    await abrir("/home", <HomePage />);
    const tocar = async (el: Element | null | undefined) => { if (!el?.isConnected) return; try { fireEvent.click(el); } catch { /* noop */ } await respirar(1); anotarChavesPossiveis(); };
    const fechar = async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); await respirar(1); };
    const porTrack = (t: string) => document.querySelector(`[data-track="${t}"],[data-tour="${t}"],[data-spotlight="${t}"]`);
    anotarChavesPossiveis();
    // cada ação rápida abre o formulário dela (bloco acao:<id>)
    for (const a of [...document.querySelectorAll('[data-track^="acao:"]')].map((el) => el.getAttribute("data-track")!)) await tocar(porTrack(a));
    await tocar(porTrack("pendencias-abrir"));
    await tocar(document.querySelector('[data-track^="pendencia-opcoes:"]'));
    await tocar(screen.queryByLabelText("Personalizar pendências")); await fechar();
    await tocar(porTrack("adicionar-widget")); await fechar();
    await tocar(porTrack("modulos-engrenagem"));
    await tocar(porTrack("modulo-favoritar"));
    await tocar(porTrack("modulos-engrenagem"));
    await tocar(porTrack("modulo:financas"));
    // widgets: o 1º controle de cada um (tarefa abre a ficha; hábito marca)
    for (const w of document.querySelectorAll('[data-track-bloco^="widget:"]')) await tocar(w.querySelector("button,[role=button],input,textarea"));
    await fechar();
    // menu da conta → "Minha conta" (outra tela da folha)
    await tocar(screen.queryByLabelText("Minha conta"));
    await tocar(porTrack("minha-conta"));
    await fechar();
    await tocar(screen.queryByLabelText("Trocar a cor do tema"));
    await tocarTudo(1, 60);
    const p = descarregarResumo("teste");
    expect(p).not.toBeNull();
    console.log(`[medicao] home: ${Object.keys(p!.n as object).length} chaves · ${chavesPossiveis.size} possíveis`);
    expect(Object.keys(p!.n as object).length).toBeGreaterThan(15);
    semSentinela(p, ["Conquistas"]);
    semSentinela({ possiveis: [...chavesPossiveis] }, ["Conquistas"]);
    expect(chavesPossiveis.size).toBeGreaterThan(60);
    // cobertura da Home
    const n = Object.keys(p!.n as object);
    const tem = (re: RegExp) => n.some((k) => re.test(k));
    expect(tem(/^home\|\|\|cabecalho\|MINHA CONTA$/)).toBe(true);
    expect(tem(/^home\|\|\|acoes-rapidas\|acao:/)).toBe(true);
    expect(tem(/^home\|\|\|modulos\|modulo:financas$/)).toBe(true);
    expect(tem(/^home\|\|\|modulos\|modulos-engrenagem$/)).toBe(true);
    expect(tem(/^home\|\|\|pendencias\|pendencias-abrir$/)).toBe(true);
    expect(tem(/^home\|\|\|widget:(habits|tasks|finances|reading|relacoes|quick-notes)\|/)).toBe(true);
    expect(tem(/^home\|\|\|\|adicionar-widget$/)).toBe(true);
    expect(tem(/^home\|\|(MENU|MINHA CONTA)\|\|/)).toBe(true); // dentro do menu da conta (título da folha pela peneira)
    expect(p!.t).toMatchObject({ "home|": 1 });
    expect(Object.keys(p!.b as object)).toEqual(expect.arrayContaining(["home||score", "home||acoes-rapidas", "home||pendencias", "home||modulos"]));
    expect(Object.keys((p!.f ?? {}) as object).some((k) => k.startsWith("home||"))).toBe(true);
  }, 180_000);

  for (const [rota, modulo, Pagina] of [
    ["/rotina", "rotina", Rotina],
    ["/financas", "financas", Index],
    ["/biblioteca", "biblioteca", Biblioteca],
    ["/relacionamentos", "relacionamentos", Relacionamentos],
  ] as const) {
    it(`${modulo}: todas as abas, todo controle — chaves com aba e bloco, sem nenhuma sentinela`, async () => {
      await abrir(rota, <TrackedModule moduleId={modulo}><Pagina /></TrackedModule>);
      await percorrerAbas(15);
      await new Promise((r) => setTimeout(r, 450)); // a varredura dos cards (300 ms) e a das folhas (400 ms)
      varrer();
      const p = descarregarResumo("teste");
      expect(p).not.toBeNull();
      const n = Object.keys(p!.n as object);
      console.log(`[medicao] ${modulo}: ${n.length} chaves · ${Object.keys((p!.b ?? {}) as object).length} blocos vistos · ${Object.keys((p!.f ?? {}) as object).length} folhas · ex.: ${n.slice(0, 12).join("  ")}`);
      expect(n.length).toBeGreaterThan(8);
      expect(n.every((k) => k.startsWith(`${modulo}|`))).toBe(true);
      // a aba do TrackedModule entra na tela e nas chaves
      const abas = Object.keys(p!.t as object).filter((k) => k.startsWith(`${modulo}|`) && k !== `${modulo}|`);
      expect(abas.length).toBeGreaterThan(0);
      expect(n.some((k) => k.split("|")[1] !== "")).toBe(true);
      expect(Object.keys((p!.b ?? {}) as object).length).toBeGreaterThan(0); // cards vistos (medição de cards → resumo)
      semSentinela(p, modulo === "rotina" ? ["Conquistas"] : []);
      semSentinela({ possiveis: [...chavesPossiveis] }, modulo === "rotina" ? ["Conquistas"] : []);
      console.log(`[medicao] ${modulo}: ${chavesPossiveis.size} chaves possíveis (todas as abas)`);
    }, 180_000);
  }
});

describe("a peneira tira texto do código que virou dado", () => {
  it("menu da conta: 'Conquistas' vira chave só pra quem NÃO tem um hábito chamado Conquistas", async () => {
    const abrirMenu = async (dados: Dados) => {
      await abrir("/home", <AccountDrawer open onOpenChange={() => {}} displayName="Anaclara Bittencourt" />, dados);
      fireEvent.click(await screen.findByText("Conquistas"));
      const p = descarregarResumo("teste")!;
      cleanup(); _zerarMedicaoTotal();
      return Object.keys(p.n as object);
    };
    const semDado = await abrirMenu({});
    expect(semDado).toContain("home||MENU||CONQUISTAS");
    const comDado = await abrirMenu({ "rotina-habits": ["Conquistas"] });
    expect(comDado).not.toContain("home||MENU||CONQUISTAS");
    expect(comDado).toContain("home||MENU||icone:trophy"); // cai pro ícone (nome de componente)
  }, 60_000);

  it("o use-user-data de verdade registra o store em memória na peneira", async () => {
    linhasDoServidor = [{ key: "rotina-habits", value: ["Fulustreca"] }];
    let api: UserDataContextType | null = null;
    const Sonda = () => { api = useUserData(); return null; };
    render(<MemoryRouter><UserDataProvider><Sonda /></UserDataProvider></MemoryRouter>);
    await waitFor(() => expect(api?.loaded).toBe(true));
    await waitFor(() => expect(ehDadoDaPessoa(formaDeChave("Fulustreca"))).toBe(true));
    expect(ehDadoDaPessoa(formaDeChave("Pronto"))).toBe(false);
    linhasDoServidor = [];
  }, 60_000);
});
