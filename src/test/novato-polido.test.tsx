/**
 * NOVATO POLIDO (1.0.19, dono 26/10 — "a Home está bonita e intuitiva pra quem acabou de começar o teste?"):
 *   1. PENDÊNCIAS enxutas na conta nova (primeiros 7 dias): só o que ela já usa + os 3 módulos da missão + o que ligou à
 *      mão; nada de "Pesar hoje"/"refeições"/"Check de humor" de módulo que ela nunca escolheu; no máximo 4 linhas; vazia
 *      = uma linha calma. Personalizar segue mandando (ligar → aparece). Conta antiga: nada muda.
 *   2. WIDGETS padrão da conta nova que nunca escolheu: o que já tem conteúdo + Sono/Humor de 1 toque (nunca o que já está
 *      na página 1); os vazios viram convite curto ("Como foi a noite?"), não "Sem …". Quem escolheu: nada muda.
 *   3. As folhas da missão por cima da Home nova ("Dia 1 feito · Combinado" etc.): botão da E (tinta), não magenta.
 *   4. Braço B: fechou no meio da dose 1 → a Home nova mostra "Dose de hoje" (estilo E) → toca → volta pro passo. A: igual.
 *   5. O score do novato = a lista.
 *   6. (1.0.20, dono 27/10) A PÁGINA 1 da conta nova sem escolha = o que conta no score (na ordem da lista); faltando card,
 *      o padrão entra em CONVITE tracejado — nunca "Refeições 0/4" do lado do 100. Quem escolheu e a conta antiga: igual.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({ user: { id: "u1", email: "bia@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} }, session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {} }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, useAuthOpcional: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q, abortSignal: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }), update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r) });
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) }, auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }, storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) }, channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn() } };
});

import HomePage from "@/pages/Home";
import { BarraVidroGlobal } from "@/components/home-nova/e/BarraVidroGlobal";
import { CHAVE_FORCA_HOME_NOVA, CHAVE_ORIGEM_APARELHO, _zerarHomeNova, tomDoBotaoDaMissao } from "@/lib/home-nova";
import { _zerarEntradaDaHome } from "@/components/home-nova/e/Animacoes";
import { DIAS_NOVATO_PENDENCIAS, enxugarPendencias, pendenciasDeNovato, tiposAdotados, tiposDoNovato } from "@/lib/pendencias-novato";
import { desligarAMao, ligarAMao, normalizarPrefs, PREFS_PADRAO } from "@/lib/home-pendencias";
import { CATALOGO_WIDGETS_E, WIDGETS_E_PADRAO, dadoDoWidgetE, widgetsDoNovato, widgetsE } from "@/lib/home-widgets-e";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_DIA_100_VISTO } from "@/components/home/DayScoreRing";
import { CHAVE_ESTADO_MISSAO_DOSES, doseDoDia1DoBracoB, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { PlanoDeAmanhaA } from "@/components/missao-doses/PlanoDeAmanhaA";
import { Folha as PreFolha } from "@/components/missao-doses/PreFolhaLembrete";
import { pendenciasDeHoje, type PendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { CONVITE_DO_PADRAO, metricasDoDia, type Metrica } from "@/components/home-nova/e/PaginaSeuDia";
import { PersonalizarInicio } from "@/pages/Voce";
import { resumoDoCard, resumosEscolhidos } from "@/lib/home-resumos";
import { ORDEM_DA_LISTA } from "@/lib/pendencias-novato";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const AGORA = Date.now();
let gravar: (k: string, v: unknown) => void = () => {};
const Sonda = () => { const { pathname } = useLocation(); return <div data-testid="sonda" data-rota={pathname} />; };
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
/** Um `set` da conta na mão do teste (como o "+" gravaria). */
const Gravador = () => { const { set } = useUserData(); gravar = set; return null; };
const montar = async (dados: Dados) => {
  const n = criarNuvem(dados);
  render(<MemoryRouter initialEntries={["/home"]}><n.Provedor><Routes><Route path="/home" element={<HomePage />} /><Route path="*" element={<Sonda />} /></Routes><BarraVidroGlobal /><Gravador /></n.Provedor></MemoryRouter>);
  await respirar(30);
  await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
  return n;
};
const pagina = (n: 1 | 2 | 3) => screen.getByTestId(`he-pagina-${n}`);
const linhas = () => within(pagina(2)).queryAllByTestId("hn-pendencia").map((e) => e.textContent?.trim() ?? "");

/** A conta NOVA: criada há 2 h, marcador "nova" na conta. Os dados = o que o Montar Finanças + o 1º gasto gravam. */
const CONTA_NOVA: Dados = {
  "core-home-nova-origem": { tipo: "nova", em: new Date(AGORA - 2 * 3600e3).toISOString(), versao: "1.0.19", regra: "conta<48h e sem missão de antes" },
  "core-user-name": "Bia",
  "finance-incomes": [{ id: "r1", description: "Salário", value: 3200, date: hoje }],
  "finance-fixed-expenses": [{ id: "f1", description: "Aluguel", value: 1300 }, { id: "f2", description: "Luz", value: 160 }],
  "finance-expenses": [{ id: "g1", description: "Café", value: 12, category: "Alimentação", date: hoje }],
  "core-dias-anotados": [hoje], "core-hub-streak": { count: 1, lastDate: hoje },
};
/** A missão do aparelho (Finanças → Rotina → Saúde), no braço pedido. */
const missao = (braco: "A" | "B", extra: Partial<EstadoMissaoDoses> = {}, inicio = hoje): EstadoMissaoDoses => ({
  v: 1, inicio, modulos: ["financas", "rotina", "saude"], boasVindas: true, braco, criadaNa: "1.0.19", feitos: {}, ...extra,
});
const gravarMissao = (m: EstadoMissaoDoses) => localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify(m));
const contaNova = () => { auth.user.created_at = new Date(AGORA - 2 * 3600e3).toISOString(); };
const contaAntiga = () => { auth.user.created_at = "2026-08-01T12:00:00Z"; };

beforeAll(() => { prepararJsdom(); Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo; });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); _zerarEntradaDaHome();
  localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");
  localStorage.setItem("dia1-cheio-force", "ab"); // o teste da missão (braços A/B) ligado neste "aparelho"
  contaAntiga();
});
afterEach(() => { cleanup(); document.body.className = ""; });

/* ================================================================== 1. pendências do novato */
describe("1. pendências do novato — só o que ela usa + a missão (lib/pendencias-novato)", () => {
  it("a régua: conta NOVA e criada há menos de 7 dias; antiga, sem data ou passada da semana: a lista de sempre", () => {
    expect(DIAS_NOVATO_PENDENCIAS).toBe(7);
    const criada = new Date(AGORA - 3 * 86400e3).toISOString();
    expect(pendenciasDeNovato({ origemNova: true, criadoEm: criada, agora: AGORA })).toBe(true);
    expect(pendenciasDeNovato({ origemNova: false, criadoEm: criada, agora: AGORA })).toBe(false);
    expect(pendenciasDeNovato({ origemNova: true, criadoEm: null, agora: AGORA })).toBe(false);
    expect(pendenciasDeNovato({ origemNova: true, criadoEm: new Date(AGORA - 8 * 86400e3).toISOString(), agora: AGORA })).toBe(false);
  });
  it("adotado = já tem registro/cadastro; missão traz água (não peso) da Saúde; ligado à mão entra, oculto sai", () => {
    const get = <T,>(k: string, f: T): T => ((CONTA_NOVA as Record<string, unknown>)[k] as T) ?? f;
    const adotados = tiposAdotados(get);
    expect([...adotados]).toEqual(["gasto"]); // o Montar Finanças + 1 gasto: só Finanças
    const tipos = tiposDoNovato({ adotados, modulosDaMissao: ["financas", "rotina", "saude"], prefs: PREFS_PADRAO });
    expect([...tipos].sort()).toEqual(["agua", "gasto", "habitos"]);
    expect(tipos.has("peso")).toBe(false);
    expect(tipos.has("refeicoes")).toBe(false);
    const comPeso = tiposDoNovato({ adotados, modulosDaMissao: ["financas", "rotina", "saude"], prefs: { ...PREFS_PADRAO, ligados: ["peso"], ocultos: ["agua"] } });
    expect(comPeso.has("peso")).toBe(true);
    expect(comPeso.has("agua")).toBe(false);
    // registro vazio não conta como uso ({dia: 0}, [], {dia: []})
    const vazio = <T,>(k: string, f: T): T => ({ "core-saude-water": { [hoje]: 0 }, "core-mood-log": {}, "hiperfoco-thoughts": { [hoje]: { ideias: [] } } } as Record<string, unknown>)[k] as T ?? f;
    expect(tiposAdotados(vazio).size).toBe(0);
  });
  it("enxugar: tira o que não é dela, mantém o compromisso dela, espera a dose do módulo e só avisa treino se permitido", () => {
    const p: PendenciasDeHoje = {
      pending: [
        { label: "15:00 · Dentista", done: false, emoji: "📅", priority: -10 },
        { label: "Adicionar hábitos diários", done: false, emoji: "✅", priority: 1, tipo: "habitos" },
        { label: "4 refeições para registrar", done: false, emoji: "🍽️", priority: 3, tipo: "refeicoes" },
        { label: "Faltam 8 copos de água", done: false, emoji: "💧", priority: 4, tipo: "agua" },
        { label: "Pesar hoje", done: false, emoji: "⚖️", priority: 22, tipo: "peso" },
      ],
      done: [{ label: "Gasto registrado", done: true, emoji: "💸", priority: 31, tipo: "gasto" }],
      avisoTreino: true, avisoConta: { nome: "Aluguel", dias: 2 },
    };
    const permitidos = new Set(["gasto", "habitos", "agua"] as const);
    const e = enxugarPendencias(p, permitidos);
    expect(e.pending.map((i) => i.label)).toEqual(["15:00 · Dentista", "Adicionar hábitos diários", "Faltam 8 copos de água"]);
    expect(e.done.map((i) => i.label)).toEqual(["Gasto registrado"]);
    expect(e.avisoTreino).toBe(false);
    expect(e.avisoConta).toEqual({ nome: "Aluguel", dias: 2 });
    // a dose de hoje é Rotina: "Adicionar hábitos diários" espera a dose sair
    expect(enxugarPendencias(p, permitidos, "rotina").pending.map((i) => i.label)).toEqual(["15:00 · Dentista", "Faltam 8 copos de água"]);
  });
  it("prefs: `ligados` só existe quando tem algo; ligar/desligar à mão mexem em ligados e ocultos", () => {
    expect(normalizarPrefs({ ocultos: ["peso"] })).toEqual({ ocultos: ["peso"], peso: { frequencia: "diaria", diaSemana: 1 } });
    expect(normalizarPrefs({ ligados: ["peso", "x", "peso"] })).toEqual({ ocultos: [], peso: { frequencia: "diaria", diaSemana: 1 }, ligados: ["peso"] });
    const ligado = ligarAMao({ ...PREFS_PADRAO, ocultos: ["peso"] }, "peso");
    expect(ligado).toEqual({ ...PREFS_PADRAO, ocultos: [], ligados: ["peso"] });
    expect(desligarAMao(ligado, "peso")).toEqual({ ...PREFS_PADRAO, ocultos: ["peso"] });
  });
  it("Home nova, conta NOVA no dia 1 (dose 1 feita): a página 2 mostra só Rotina e Saúde da missão — sem refeições, peso, humor", async () => {
    contaNova();
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "Pode gastar R$ 54 por dia" } }, lembrete: "20h" }));
    await montar(CONTA_NOVA);
    const l = linhas();
    expect(l).toEqual(["Adicionar hábitos diários", "Faltam 8 copos de água"]);
    expect(pagina(2).textContent).not.toMatch(/refeiç|Pesar|humor|ideia|gratidão|sono/i);
    expect(within(pagina(2)).queryByTestId("pendencia-dose-de-hoje")).toBeNull(); // dose de hoje já feita
    expect(within(pagina(2)).getByTestId("hn-pendencias-mais").textContent).toContain("Ver todas (3)"); // + o gasto feito
    // Personalizar: segue a lista (peso nasce desligado); ligar à mão grava `ligados` e o "Pesar hoje" entra
    fireEvent.click(within(pagina(2)).getByTestId("hn-personalizar"));
    const folha = await screen.findByTestId("hn-prefs-folha");
    expect(within(folha).getByTestId("hn-prefs-explica").textContent).toMatch(/^Só o que você já usa entra na lista e no score/);
    expect(within(folha).getByTestId("pref-peso").getAttribute("data-ligado")).toBe("0");
    expect(within(folha).getByTestId("pref-agua").getAttribute("data-ligado")).toBe("1");
    fireEvent.click(within(within(folha).getByTestId("pref-peso")).getByRole("switch"));
    await waitFor(() => expect(linhas()).toContain("Pesar hoje"));
  });
  it("conta nova sem nada pendente: UMA linha calma (sem o 'Tudo feito' com ícone); até 4 linhas no máximo", async () => {
    contaNova();
    // explorou por conta própria (sem missão) e só usou Finanças, com o gasto de hoje feito
    gravarMissao(missao("A", { explorou: true }));
    await montar(CONTA_NOVA);
    expect(linhas()).toEqual([]);
    expect(within(pagina(2)).getByTestId("hn-pendencias-calmo").textContent).toBe("Tudo em dia por aqui.");
    expect(pagina(2).textContent).not.toContain("Tudo feito por hoje");
    cleanup(); _zerarEntradaDaHome();
    // usou tudo: no máximo 4 linhas na página
    const usouTudo: Dados = { ...CONTA_NOVA, "finance-expenses": [], "core-mood-log": { [somarDias(hoje, -1)]: { value: 4, emoji: "🙂" } }, "core-saude-measures": [{ date: somarDias(hoje, -1), weight: 60 }], "core-saude-sleep": { [somarDias(hoje, -1)]: 7 }, "core-gratitude-log": { [somarDias(hoje, -1)]: ["x"] } };
    await montar(usouTudo);
    expect(linhas().length).toBe(4);
  });
  it("conta ANTIGA: a lista de sempre (todas as pendências, 5 linhas com o aviso do treino, sem a linha calma)", async () => {
    contaAntiga();
    await montar({ "core-user-name": "Ana" });
    expect(within(pagina(2)).getAllByTestId("hn-pendencia").length).toBe(4);
    expect(within(pagina(2)).getByTestId("hn-aviso").textContent).toContain("Configurar treino da semana");
    expect(pagina(2).textContent).toMatch(/^Pendências de hoje9/); // as 9 de sempre (peso, sono, ideia… atrás do "Ver todas")
    expect(pagina(2).textContent).toMatch(/refeições para registrar/);
    expect(pagina(2).textContent).toContain("Check de humor");
    expect(within(pagina(2)).queryByTestId("hn-pendencias-calmo")).toBeNull();
  });
});

/* ================================================================== 2. widgets da conta nova */
describe("2. widgets padrão da conta nova (widgetsDoNovato) e os vazios em convite", () => {
  const vida = (extra: Partial<LifeHubData> = {}): LifeHubData => ({
    habits: [], waterGlasses: 0, waterGoal: 8, mealsLogged: 0, mealsTotal: 4, caloriesConsumed: 0, caloriesGoal: 2000, sleepHours: null,
    currentBook: null, readingProgress: 0, todayWorkoutGroup: null, workoutDone: false, workoutStatus: "vazio", nextBillName: null, nextBillDaysUntil: null,
    nextBillDate: null, dayScore: 7, registrosHoje: { humor: false, gasto: true, peso: false, sono: false, gratidao: false, ideia: false }, ...extra,
  }) as unknown as LifeHubData;
  const getDe = (d: Dados) => <T,>(k: string, f: T): T => ((d as Record<string, unknown>)[k] as T) ?? f;
  it("depois do Montar Finanças: Orçamento + a conta sem dia + Sono e Humor de 1 toque (nada da página 1)", () => {
    expect(widgetsDoNovato(vida(), getDe(CONTA_NOVA), ["habitos", "agua", "refeicoes"], hoje)).toEqual(["orcamento", "proxima-conta", "sono", "humor"]);
  });
  it("quem explorou sem montar nada: só os de 1 toque; com hábito e livro, eles entram (o que já tem conteúdo vem antes)", () => {
    expect(widgetsDoNovato(vida(), getDe({}), ["habitos", "agua", "refeicoes"], hoje)).toEqual(["sono", "humor"]);
    expect(widgetsDoNovato(vida({ habits: [{ name: "a", done: false }], currentBook: "Dom Casmurro", readingProgress: 10 }), getDe({}), ["agua", "refeicoes", "sono"], hoje)).toEqual(["habitos", "leitura", "humor"]);
  });
  it("conta antiga/sem padrão = o de sempre; quem escolheu (core-home-widgets-e) não muda", () => {
    expect(widgetsE(undefined, undefined)).toEqual(WIDGETS_E_PADRAO);
    expect(widgetsE(undefined, undefined, ["sono", "humor"])).toEqual(["sono", "humor"]);
    expect(widgetsE(["agua", "treino"], undefined, ["sono", "humor"])).toEqual(["agua", "treino"]);
    expect(CATALOGO_WIDGETS_E.some((w) => w.id === "humor")).toBe(true);
  });
  it("os vazios viram convite curto (nada de 'Sem …'/'Nenhum …'); Sono, Humor e Calorias abrem o formulário em 1 toque", () => {
    const d = vida();
    const get = getDe({});
    for (const w of CATALOGO_WIDGETS_E) {
      const dado = dadoDoWidgetE(w.id, d, get, hoje);
      if (dado.vazio) expect(dado.vazio.texto, w.id).not.toMatch(/^(Sem|Nenhum|Nenhuma|Nada)\b/);
    }
    expect(dadoDoWidgetE("sono", d, get, hoje).vazio).toEqual({ texto: "Como foi a noite?", cta: "Registrar sono", acao: "sleep" });
    expect(dadoDoWidgetE("humor", d, get, hoje).vazio).toEqual({ texto: "Como você está hoje?", cta: "Registrar humor", acao: "mood" });
    expect(dadoDoWidgetE("calorias", d, get, hoje).vazio?.acao).toBe("meal");
    expect(dadoDoWidgetE("proxima-conta", d, getDe(CONTA_NOVA), hoje).vazio).toEqual({ texto: "Que dia vencem Aluguel e mais 1?", cta: "Pôr o dia" });
    // humor feito hoje: a carinha e o rótulo
    expect(dadoDoWidgetE("humor", d, getDe({ "core-mood-log": { [hoje]: { value: 4, emoji: "🙂" } } }), hoje)).toMatchObject({ numero: "🙂", detalhe: "Bom", vazio: null });
  });
  it("Home nova, conta NOVA: a página 3 abre no padrão dela; tocar no Sono vazio abre o formulário do sono (não o módulo)", async () => {
    contaNova();
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "x" } }, lembrete: "20h" }));
    await montar(CONTA_NOVA);
    const ids = Array.from(pagina(3).querySelectorAll('button[data-testid^="he-widget-"]')).map((e) => e.getAttribute("data-testid"));
    expect(ids).toEqual(["he-widget-orcamento", "he-widget-proxima-conta", "he-widget-sono", "he-widget-humor"]);
    fireEvent.click(within(pagina(3)).getByTestId("he-widget-sono"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-acao").getAttribute("data-acao")).toBe("sleep"));
    expect(screen.queryByTestId("sonda")).toBeNull(); // continua na Home
  });
  it("Home nova, conta ANTIGA sem escolha: o padrão de sempre (próxima conta, orçamento, treino, sono)", async () => {
    contaAntiga();
    await montar({ "core-user-name": "Ana" });
    const ids = Array.from(pagina(3).querySelectorAll('button[data-testid^="he-widget-"]')).map((e) => e.getAttribute("data-testid")?.replace("he-widget-", ""));
    expect(ids).toEqual(WIDGETS_E_PADRAO);
  });
});

/* ================================================================== 3. botão da E nas folhas da missão */
describe("3. as folhas da missão por cima da Home nova: botão da E (tinta), não magenta", () => {
  const m = missao("A", { feitos: { 1: { dia: hoje, rotulo: "x" } } });
  const plano = () => { const n = criarNuvem({}); return render(<MemoryRouter><n.Provedor><PlanoDeAmanhaA missao={m} aoCombinar={() => {}} aoSemLembrete={() => {}} /></n.Provedor></MemoryRouter>); };
  it("Home nova ligada → 'e'; desligada → 'magenta' (a Home antiga fica como está)", () => {
    expect(tomDoBotaoDaMissao()).toBe("e");
    plano();
    expect(screen.getByTestId("plano-a-combinado").getAttribute("data-tom")).toBe("e");
    render(<PreFolha hora="20h" conteudo={{ title: "t", body: "b", modulo: null } as never} aoSim={() => {}} aoAgoraNao={() => {}} />);
    expect(screen.getByTestId("pre-folha-sim").getAttribute("data-tom")).toBe("e");
    cleanup();
    localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "off");
    _zerarHomeNova();
    expect(tomDoBotaoDaMissao()).toBe("magenta");
    plano();
    expect(screen.getByTestId("plano-a-combinado").getAttribute("data-tom")).toBe("magenta");
  });
});

/* ================================================================== 4. braço B: a dose que ficou no meio */
describe("4. braço B: fechou no meio da dose 1 → 'Dose de hoje' na Home nova → volta pro passo", () => {
  it("a regra: B, dia 1, dose por fazer, sem o dia fechado; nunca no dia 2, com o plano decidido, explorando ou A", () => {
    expect(doseDoDia1DoBracoB(missao("B"), hoje)).toBe(true);
    expect(doseDoDia1DoBracoB(missao("B", { feitos: { 1: { dia: hoje, rotulo: "x" } } }), hoje)).toBe(true); // dose 2 por fazer
    expect(doseDoDia1DoBracoB(missao("B", {}, somarDias(hoje, -1)), hoje)).toBe(false); // dia 2
    expect(doseDoDia1DoBracoB(missao("B", { planoAmanha: { quando: "noite" } as never }), hoje)).toBe(false);
    expect(doseDoDia1DoBracoB(missao("B", { planoAmanhaPulado: hoje }), hoje)).toBe(false);
    expect(doseDoDia1DoBracoB(missao("B", { agoraNao: { dia: hoje, indice: 2 } }), hoje)).toBe(false); // a folha do plano está devendo (na tela)
    expect(doseDoDia1DoBracoB(missao("B", { explorou: true }), hoje)).toBe(false);
    expect(doseDoDia1DoBracoB(missao("B", { boasVindas: false }), hoje)).toBe(false);
    expect(doseDoDia1DoBracoB(missao("A"), hoje)).toBe(false);
    const tres = { 1: { dia: hoje, rotulo: "a" }, 2: { dia: hoje, rotulo: "b" }, 3: { dia: hoje, rotulo: "c" } };
    expect(doseDoDia1DoBracoB(missao("B", { feitos: tres }), hoje)).toBe(false);
  });
  it("reabrir com a dose 1 no meio: a linha aparece (estilo E, 'Dose 1 de 3') → toca → vai pro módulo da dose (o passo retoma lá)", async () => {
    contaNova();
    gravarMissao(missao("B", { gastoGuiado: undefined }));
    await montar({ ...CONTA_NOVA, "finance-expenses": [] });
    const linha = within(pagina(2)).getByTestId("pendencia-dose-de-hoje");
    expect(linha.getAttribute("data-braco")).toBe("B");
    expect(linha.textContent).toContain("Dose de hoje · Finanças");
    expect(linha.textContent).toContain("Dose 1 de 3");
    // não duplica com a pendência do mesmo módulo (o gasto espera a dose)
    expect(linhas().some((t) => /gasto/i.test(t))).toBe(false);
    fireEvent.click(linha);
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/financas"));
    expect(eventos).toContainEqual(["home_pendencia", { tipo: "dose_de_hoje", destino: "/financas", braco_linha: "B" }]);
  });
  it("B com o dia 1 fechado (plano combinado) ou no dia 2: sem linha; A no dia 2: a linha de sempre ('Dia 2 de 3')", async () => {
    contaNova();
    gravarMissao(missao("B", { feitos: { 1: { dia: hoje, rotulo: "x" } }, planoAmanha: { quando: "noite" } as never }));
    await montar(CONTA_NOVA);
    expect(within(pagina(2)).queryByTestId("pendencia-dose-de-hoje")).toBeNull();
    cleanup(); _zerarEntradaDaHome();
    gravarMissao(missao("A", { feitos: { 1: { dia: somarDias(hoje, -1), rotulo: "x" } }, lembrete: "20h", convites: { [hoje]: "depois" } }, somarDias(hoje, -1)));
    await montar(CONTA_NOVA);
    const linha = within(pagina(2)).getByTestId("pendencia-dose-de-hoje");
    expect(linha.getAttribute("data-braco")).toBe("A");
    expect(linha.textContent).toContain("Dose de hoje · Rotina");
    expect(linha.textContent).toContain("Dia 2 de 3");
  });
});

/* ================================================================== 5. o score do novato = a lista */
/** Sonda: o score e os tipos do hub na tela, e um `set` na mão do teste (como o "+" gravaria). */
const Sonda5 = () => {
  const d = useLifeHubData();
  const { set } = useUserData();
  gravar = set;
  return <div data-testid="sonda-score" data-score={d.dayScore} data-cobrados={(d.pendenciasCobradas ?? []).slice().sort().join(",")} data-novato={d.pendenciasNovato ? "1" : "0"} />;
};
const sondar = (dados: Dados) => { const n = criarNuvem(dados); render(<n.Provedor><Sonda5 /></n.Provedor>); return n; };
const score = () => Number(screen.getByTestId("sonda-score").getAttribute("data-score"));
const cobrados = () => screen.getByTestId("sonda-score").getAttribute("data-cobrados");
/** A conta nova que explorou sozinha (sem missão) e já usou Finanças (renda) e o humor (ontem): a lista = gasto + humor. */
const ONTEM = somarDias(hoje, -1);
const NOVA_2_TIPOS: Dados = {
  "core-home-nova-origem": CONTA_NOVA["core-home-nova-origem"], "core-user-name": "Bia",
  "finance-incomes": [{ id: "r1", description: "Salário", value: 3200, date: hoje }],
  "core-mood-log": { [ONTEM]: { value: 4, emoji: "🙂" } },
};

describe("5. score do novato conta SÓ o que a lista mostra (dono 26/10: 'o score só contar o que tá lá')", () => {
  beforeEach(() => { contaNova(); gravarMissao(missao("A", { explorou: true })); });
  it("2 tipos na lista (gasto + humor): 0 → 50 → 100; os mesmos tipos no score e na lista", () => {
    sondar(NOVA_2_TIPOS);
    expect(cobrados()).toBe("gasto,humor");
    expect(screen.getByTestId("sonda-score").getAttribute("data-novato")).toBe("1");
    expect(score()).toBe(0);
    act(() => gravar("finance-expenses", [{ id: "g1", description: "Café", value: 12, date: hoje }]));
    expect(score()).toBe(50);
    act(() => gravar("core-mood-log", { [ONTEM]: { value: 4, emoji: "🙂" }, [hoje]: { value: 5, emoji: "🤩" } }));
    expect(score()).toBe(100);
  });
  it("ligou um tipo em Personalizar: entra no score junto (pode cair — é o plano dela); desligou: sai dos dois", () => {
    sondar({ ...NOVA_2_TIPOS, "finance-expenses": [{ id: "g1", value: 12, date: hoje }], "core-mood-log": { [hoje]: { value: 5, emoji: "🤩" } } });
    expect(score()).toBe(100);
    act(() => gravar("home-pendencias-prefs", ligarAMao(PREFS_PADRAO, "peso")));
    expect(cobrados()).toBe("gasto,humor,peso");
    expect(score()).toBe(67); // 10 de 15
    act(() => gravar("home-pendencias-prefs", desligarAMao(ligarAMao(PREFS_PADRAO, "peso"), "humor")));
    expect(cobrados()).toBe("gasto,peso");
    expect(score()).toBe(50);
  });
  it("sem nenhum tipo na lista: 0 (nunca o 100 de graça), sem dividir por zero", () => {
    sondar({ "core-home-nova-origem": CONTA_NOVA["core-home-nova-origem"] });
    expect(cobrados()).toBe("");
    expect(score()).toBe(0);
  });
  it("a missão conta (Finanças → Rotina → Saúde): gasto + hábitos + água; o score é a lista do dia 1", () => {
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "x" } }, lembrete: "20h" }));
    sondar(CONTA_NOVA);
    expect(cobrados()).toBe("agua,gasto,habitos");
    expect(score()).toBe(13); // o gasto de hoje: 5 de 40
  });
  it("conta ANTIGA, passada dos 7 dias ou com a Home antiga: a conta de sempre", () => {
    contaAntiga();
    sondar({ "core-user-name": "Ana", "finance-expenses": [{ id: "g1", value: 12, date: hoje }] });
    expect(screen.getByTestId("sonda-score").getAttribute("data-novato")).toBe("0");
    expect(score()).toBe(30); // os 12 blocos de sempre (treino/leitura/suplementos sem cadastro contam cheio)
    cleanup();
    // conta nova de 8 dias: sem a régua do novato (só sem os pontos de graça, como já era)
    const velha = { ...NOVA_2_TIPOS, "core-home-nova-origem": { tipo: "nova", em: new Date(AGORA - 8 * 86400e3).toISOString() } };
    auth.user.created_at = new Date(AGORA - 8 * 86400e3).toISOString();
    sondar(velha);
    expect(screen.getByTestId("sonda-score").getAttribute("data-novato")).toBe("0");
    expect(cobrados()?.split(",").length).toBe(9);
    cleanup();
    // Home antiga (chave desligada): a conta de sempre, mesmo na conta nova
    contaNova();
    localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "off"); _zerarHomeNova();
    sondar(NOVA_2_TIPOS);
    expect(screen.getByTestId("sonda-score").getAttribute("data-novato")).toBe("0");
  });
  it("Home nova: fez tudo o que a lista mostra → 'Dia completo' (1x por dia) e a folha do score tem as MESMAS linhas", async () => {
    await montar({ ...NOVA_2_TIPOS, "finance-expenses": [{ id: "g1", value: 12, date: hoje }] });
    // a lista: só o humor pendente (o gasto feito)
    expect(linhas()).toEqual(["Check de humor"]);
    fireEvent.click(screen.getByTestId("he-score-abrir"));
    const folha = await screen.findByTestId("he-folha-score");
    expect(within(folha).getAllByTestId("he-score-item").map((e) => e.getAttribute("data-tipo")).sort()).toEqual(["gasto", "humor"]);
    fireEvent.click(within(folha).getByLabelText("Fechar"));
    await waitFor(() => expect(screen.queryByTestId("he-folha-score")).toBeNull());
    expect(screen.queryByTestId("celebracao-100")).toBeNull();
    // o humor de hoje: tudo o que a lista mostra está feito → 100 → "Dia completo" (estrela âmbar), 1x por dia
    act(() => gravar("core-mood-log", { [hoje]: { value: 5, emoji: "🤩" } }));
    const dia = await screen.findByTestId("celebracao-100");
    expect(dia.textContent).toContain("Dia completo");
    expect(localStorage.getItem(CHAVE_DIA_100_VISTO)).toBe(hoje);
    expect(within(pagina(2)).getByTestId("hn-pendencias-calmo").textContent).toBe("Tudo em dia por aqui.");
    cleanup(); _zerarEntradaDaHome();
    await montar({ ...NOVA_2_TIPOS, "finance-expenses": [{ id: "g1", value: 12, date: hoje }], "core-mood-log": { [hoje]: { value: 5, emoji: "🤩" } } });
    await respirar(50);
    expect(screen.queryByTestId("celebracao-100")).toBeNull(); // já comemorou hoje
  });
});

/* ================================================================== 6. a página 1 da conta nova = o que conta */
describe("6. página 1 da conta nova = o que conta no score (1.0.20, dono 27/10)", () => {
  const NADA = { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };
  /** o hub de uma conta qualquer (nada feito hoje) */
  const hub = (extra: Partial<LifeHubData> = {}): LifeHubData => ({
    dayScore: 0, habits: [{ name: "Beber água", done: false }], waterGlasses: 0, waterGoal: 8, mealsLogged: 0, mealsTotal: 4, sleepHours: null,
    supplementsTaken: 0, supplementsTotal: 0, currentBook: null, leuHoje: false, todayWorkoutGroup: null, workoutDone: false, workoutStatus: "vazio",
    registrosHoje: NADA, ...extra,
  }) as unknown as LifeHubData;
  /** o que o hub devolve pra conta nova: `contam` = a lista (e o score); o "de sempre" = os 9 sem os pontos de graça */
  const DE_SEMPRE = ["habitos", "agua", "refeicoes", "humor", "gasto", "peso", "sono", "ideia", "gratidao"] as const;
  const novato = (contam: readonly string[], extra: Partial<LifeHubData> = {}, deSempre: readonly string[] = DE_SEMPRE) =>
    hub({ pendenciasNovato: [...contam], pendenciasCobradas: [...contam], pendenciasCobradasSemNovato: [...deSempre], ...extra } as Partial<LifeHubData>);
  const cards = (ms: Metrica[]) => ms.map((m) => (m.convite ? `${m.rotulo} (${m.convite})` : `${m.rotulo} ${m.valor}/${m.max}`));

  it("a ordem fixa dos cards é a da lista (página 2 com tudo pendente)", () => {
    const tudo = hub({ todayWorkoutGroup: "Peito", workoutStatus: "treino", supplementsTotal: 1, currentBook: "Dom Casmurro", readingProgress: 10 });
    expect(pendenciasDeHoje(tudo, [], new Date()).pending.map((i) => i.tipo)).toEqual([...ORDEM_DA_LISTA]);
  });
  it("sem escolha: os tipos que CONTAM, na ordem da lista — o dia 1 da missão é Hábitos · Água · Gasto (sem Refeições)", () => {
    expect(cards(metricasDoDia(novato(["gasto", "habitos", "agua"])))).toEqual(["Hábitos 0/1", "Água 0/8", "Gasto 0/1"]);
    // ordem da lista, não a da escolha: refeições (3) vem antes da água (4)
    expect(cards(metricasDoDia(novato(["agua", "gasto", "refeicoes", "habitos"])))).toEqual(["Hábitos 0/1", "Refeições 0/4", "Água 0/8"]);
    // fez tudo o que a lista mostra: os 3 cards completos (é o 100 do lado)
    const feito = metricasDoDia(novato(["gasto", "habitos", "agua"], { habits: [{ name: "Beber água", done: true }], waterGlasses: 8, registrosHoje: { ...NADA, gasto: true } }));
    expect(feito.every((m) => m.max > 0 && m.valor >= m.max)).toBe(true);
  });
  it("cada card diz o mesmo que o score: sono = registrou hoje (não as horas); treino em dia de descanso de quem tem plano = feito; humor/ideia/gratidão/peso viram card de sim/não", () => {
    expect(cards(metricasDoDia(novato(["sono"], { sleepHours: 6, registrosHoje: { ...NADA, sono: true } })))[0]).toBe("Sono 1/1");
    expect(cards(metricasDoDia(novato(["treino"], { workoutStatus: "descanso" })))[0]).toBe("Treino 1/1");
    expect(cards(metricasDoDia(novato(["treino"], { todayWorkoutGroup: "Peito", workoutStatus: "treino" })))[0]).toBe("Treino 0/1");
    const reg = metricasDoDia(novato(["humor", "ideia", "gratidao"], { registrosHoje: { ...NADA, ideia: true } }));
    expect(cards(reg)).toEqual(["Humor 0/1", "Ideia 1/1", "Gratidão 0/1"]);
    expect(reg.map((m) => m.action)).toEqual(["mood", "idea", "gratitude"]); // tocar abre o formulário do "+" (nunca registra sozinho)
    expect(cards(metricasDoDia(novato(["peso", "suplementos"], { supplementsTotal: 2, supplementsTaken: 1 })))).toEqual(["Suplementos 1/2", "Peso 0/1", "Hábitos (Criar hábito)"]);
  });
  it("contou menos de 3: completa com o padrão em CONVITE (tracejado), nunca como obrigação; o que ela escondeu não volta", () => {
    expect(cards(metricasDoDia(novato(["gasto", "humor"])))).toEqual(["Humor 0/1", "Gasto 0/1", "Hábitos (Criar hábito)"]);
    expect(cards(metricasDoDia(novato([])))).toEqual(["Hábitos (Criar hábito)", "Água (Anotar copo)", "Refeições (Criar plano)"]);
    expect(CONVITE_DO_PADRAO).toEqual({ habitos: "Criar hábito", agua: "Anotar copo", refeicoes: "Criar plano" });
    // cabe numa linha no card de 375 pt (~78 pt de texto: "Criar hábito" mede 70; "Anotar refeição", 92, cortava)
    expect(Object.values(CONVITE_DO_PADRAO).every((t) => t.length <= "Criar hábito".length)).toBe(true);
    // escondeu Refeições e Hábitos em Personalizar: nem convite
    expect(cards(metricasDoDia(novato(["gasto"], {}, ["agua", "humor", "gasto", "peso", "sono", "ideia", "gratidao"])))).toEqual(["Gasto 0/1", "Água (Anotar copo)"]);
    // os convites abrem o mesmo lugar do card de sempre (água = o formulário do copo; refeições = a Dieta)
    const [h, a, r] = metricasDoDia(novato([]));
    expect([h.route, a.action, r.route]).toEqual(["/rotina", "water", "/dieta"]);
  });
  it("quem ESCOLHEU resumos mantém a escolha (mesmo o que não conta); a vaga que sobra segue o score", () => {
    expect(cards(metricasDoDia(novato(["gasto", "habitos", "agua"]), undefined, ["habitos", "agua", "refeicoes"]))).toEqual(["Hábitos 0/1", "Água 0/8", "Refeições 0/4"]);
    // escolheu só o Sono: a reserva "Registros" conta só o registro que vale pra ela (o gasto), não os 6
    expect(cards(metricasDoDia(novato(["gasto", "habitos", "agua"]), undefined, ["sono"]))).toEqual(["Sono 0/8", "Registros 0/1"]);
  });
  it("conta antiga/admin (sem a régua do novato): nada muda", () => {
    expect(cards(metricasDoDia(hub()))).toEqual(["Hábitos 0/1", "Água 0/8", "Refeições 0/4"]);
    expect(cards(metricasDoDia(hub({ pendenciasCobradas: ["habitos", "agua", "humor", "gasto"] } as Partial<LifeHubData>)))).toEqual(["Hábitos 0/1", "Água 0/8", "Registros 0/2"]);
  });
  it("resumosEscolhidos: null quando nunca escolheu (ou lixo); resumoDoCard: o card do gasto é o resumo 'financas'", () => {
    expect(resumosEscolhidos(null)).toBeNull();
    expect(resumosEscolhidos([])).toBeNull();
    expect(resumosEscolhidos(["x", 3])).toBeNull();
    expect(resumosEscolhidos(["sono", "x", "sono"])).toEqual(["sono"]);
    expect(resumoDoCard("gasto")).toBe("financas");
    expect(resumoDoCard("habitos")).toBe("habitos");
    expect(resumoDoCard("humor")).toBeNull();
  });
  it("widgets da conta nova: o Humor que virou card na página 1 não se repete na página 3", () => {
    const get = <T,>(_k: string, f: T): T => f;
    expect(widgetsDoNovato(hub(), get, ["humor", "gasto", "agua"], hoje)).toEqual(["habitos", "sono"]);
    expect(widgetsDoNovato(hub(), get, ["habitos", "agua", "gasto"], hoje)).toEqual(["sono", "humor"]);
  });

  it("Home nova, conta NOVA no dia 1: página 1 = Hábitos · Água · Gasto (o que conta) → fez tudo → 100 com os 3 completos", async () => {
    contaNova();
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "Pode gastar R$ 54 por dia" } }, lembrete: "20h" }));
    await montar(CONTA_NOVA);
    const ids = () => within(pagina(1)).getAllByTestId("he-metrica").map((c) => c.getAttribute("data-metrica"));
    expect(ids()).toEqual(["habitos", "agua", "gasto"]);
    expect(pagina(1).textContent).not.toMatch(/Refeiç/);
    // sem hábito ainda: o "Criar hábito" (conta no score, 0 de 20) — é o card dela, não um convite de fora
    const habitos = within(pagina(1)).getAllByTestId("he-metrica")[0];
    expect(habitos.hasAttribute("data-criar")).toBe(true);
    expect(habitos.hasAttribute("data-convite")).toBe(false);
    // o hábito criado e feito + os 8 copos: tudo o que a lista mostra → 100, e os 3 cards completos
    act(() => { gravar("rotina-habits", ["Beber água ao acordar"]); gravar("core-rotina-habit-log", { [hoje]: { "Beber água ao acordar": true } }); gravar("core-saude-water", { [hoje]: 8 }); });
    await waitFor(() => expect(screen.getByTestId("he-score-numero").getAttribute("data-valor")).toBe("100"));
    expect(ids()).toEqual(["habitos", "agua", "gasto"]);
    expect(within(pagina(1)).getAllByTestId("he-metrica").map((c) => c.textContent?.replace(/\s+/g, ""))).toEqual(["1/1Hábitos", "8/8Água", "1/1Gasto"]);
  });
  it("Home nova, conta nova que explorou sem usar nada: 3 convites tracejados (score 0); o 'Anotar copo' abre o copo; a conta antiga segue Hábitos · Água · Refeições", async () => {
    contaNova();
    gravarMissao(missao("A", { explorou: true }));
    await montar({ "core-home-nova-origem": CONTA_NOVA["core-home-nova-origem"], "core-user-name": "Bia" });
    const cs = within(pagina(1)).getAllByTestId("he-metrica");
    expect(cs.map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "refeicoes"]);
    expect(cs.every((c) => c.hasAttribute("data-convite"))).toBe(true);
    expect(cs.map((c) => c.getAttribute("aria-label"))).toEqual(["Hábitos: Criar hábito", "Água: Anotar copo", "Refeições: Criar plano"]);
    expect(pagina(1).textContent).not.toMatch(/0\/4|0\/8/);
    expect(screen.getByTestId("he-score-numero").getAttribute("data-valor")).toBe("0");
    fireEvent.click(cs[1]);
    await waitFor(() => expect(screen.getByTestId("hn-folha-acao").getAttribute("data-acao")).toBe("water"));
    cleanup(); _zerarEntradaDaHome();
    contaAntiga();
    await montar({ "core-user-name": "Ana" });
    const antiga = within(pagina(1)).getAllByTestId("he-metrica");
    expect(antiga.map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "refeicoes"]);
    expect(antiga.some((c) => c.hasAttribute("data-convite"))).toBe(false);
  });
  it("Home nova, conta nova que ESCOLHEU Hábitos · Água · Refeições: fica a escolha dela (Refeições 0/4)", async () => {
    contaNova();
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "x" } }, lembrete: "20h" }));
    await montar({ ...CONTA_NOVA, "core-home-resumos": ["habitos", "agua", "refeicoes"] });
    const cs = within(pagina(1)).getAllByTestId("he-metrica");
    expect(cs.map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "refeicoes"]);
    expect(cs[2].textContent?.replace(/\s+/g, "")).toBe("0/4Refeições");
  });
  it("Personalizar início da conta nova sem escolha: a prévia e os ligados são os da Home (Hábitos · Água · Gasto); mexer grava a escolha", async () => {
    contaNova();
    gravarMissao(missao("A", { feitos: { 1: { dia: hoje, rotulo: "x" } }, lembrete: "20h" }));
    const n = criarNuvem(CONTA_NOVA);
    render(<MemoryRouter initialEntries={["/voce/inicio"]}><n.Provedor><Routes><Route path="/voce/inicio" element={<PersonalizarInicio />} /><Route path="*" element={<Sonda />} /></Routes></n.Provedor></MemoryRouter>);
    await respirar(30);
    expect(within(screen.getByTestId("pi-resumos-previa")).getAllByTestId("he-metrica").map((c) => c.getAttribute("data-metrica"))).toEqual(["habitos", "agua", "gasto"]);
    expect(screen.getByTestId("resumo-habitos").getAttribute("data-ligado")).toBe("1");
    expect(screen.getByTestId("resumo-agua").getAttribute("data-ligado")).toBe("1");
    expect(within(screen.getByTestId("resumo-financas")).getByLabelText("posição 3")).toBeTruthy();
    expect(screen.getByTestId("resumo-refeicoes").getAttribute("data-ligado")).toBe("0");
    fireEvent.click(within(screen.getByTestId("resumo-financas")).getByRole("switch"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua"]));
    fireEvent.click(within(screen.getByTestId("resumo-sono")).getByRole("switch"));
    await waitFor(() => expect(n.ler<string[]>("core-home-resumos")).toEqual(["habitos", "agua", "sono"]));
  });
});
