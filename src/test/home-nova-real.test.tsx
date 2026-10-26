/**
 * 1.0.19 — A HOME NOVA DE VERDADE (opção E) atrás da chave `home_nova` (lib/home-nova), montada pela Home de
 * hoje (pages/Home) com a nuvem em memória:
 *   · chave OFF (padrão): a Home de hoje, sem NENHUM nó da nova — nem a barra de vidro;
 *   · chave ON (força de QA): a Home nova com os dados reais (score, Hábitos 2/5 · Água 3/8 · Refeições 1/4,
 *     pendências, 16 módulos), SEM o tour antigo da Home;
 *   · o "+" da barra de vidro abre a folha e GRAVA pelo QuickActions real: água (+1 nas duas chaves, evento com
 *     origem "folha"), humor (formulário de sempre → core-mood-log);
 *   · pendência com ação abre a folha já no formulário; "Organizar" abre a configuração real e esconder tira o azulejo;
 *   · as abas navegam de verdade (Conquistas com origem "home", Você, e Início volta);
 *   · modo "admin": só a conta admin vê a nova; a resposta fica guardada pra conta;
 *   · reabrir: nada repete (nenhuma folha aberta, o acendimento do fogo 1x por dia).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn(), warning: vi.fn() }), Toaster: () => null }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
const auth = vi.hoisted(() => ({
  user: { id: "u1", email: "fulana@exemplo.com.br", created_at: "2026-08-01T12:00:00Z", user_metadata: {} },
  session: null, loading: false, isSubscribed: true, subLoaded: true, signOut: () => {},
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth, AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/image-upload", async (orig) => ({ ...(await orig<typeof import("@/lib/image-upload")>()), uploadFromInput: vi.fn() }));
vi.mock("@/lib/desfazer", () => ({ avisarApagado: vi.fn() }));
const adminMock = vi.hoisted(() => ({ resposta: false as boolean, chamadas: 0 }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => { adminMock.chamadas++; return adminMock.resposta; }) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  const fim = async () => ({ data: [], error: null });
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, limit: () => q, gte: () => q, lte: () => q, neq: () => q, is: () => q,
    abortSignal: fim, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
    update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
  });
  return {
    supabase: {
      from: () => q, rpc: async () => ({ data: null, error: null }), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: { access_token: "x", user: { id: "u1" } } } }), resetPasswordForEmail: vi.fn(async () => ({ error: null })), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn(async () => ({ data: null })), remove: vi.fn() }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: vi.fn(),
    },
  };
});

import HomePage from "@/pages/Home";
import { BarraVidroGlobal, __zerarPilhaDaBarraVidro } from "@/components/home-nova/e/BarraVidroGlobal";
import { _definirTempoLimiteAdmin, _zerarConsultaAdmin } from "@/hooks/use-home-nova";
import { FolhaMaisE } from "@/components/home-nova/e/FolhaMaisE";
import type { ActionId } from "@/components/home/QuickActions";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { toast } from "sonner";

/** os dados do dia que os formulários do "+" leem quando montados sozinhos */
const HUB = { dayScore: 27, waterGlasses: 3, waterGoal: 8, todayWorkoutGroup: "Peito", workoutDone: false, workoutStatus: "treino" } as unknown as LifeHubData;
import { CHAVE_ADMIN_HOME_NOVA, CHAVE_FOGO_ACESO_HOME_NOVA, CHAVE_FORCA_HOME_NOVA, _zerarHomeNova, registrarHomeNovaRemoto } from "@/lib/home-nova";
import { localDayKey, semanaAtualId } from "@/lib/utils";
import { criarNuvem, prepararJsdom, type Dados } from "./compat-comum";

const hoje = localDayKey();
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDayKey(d); })();
const DADOS: Dados = {
  "core-user-name": "João Victor",
  "core-onboarding-done": "true",
  "core-all-modules-celebrated": "true",
  "rotina-habits": ["Água de manhã", "Ler 10 min", "Alongar", "Caminhar", "Dormir cedo"],
  "rotina-habits-week": semanaAtualId(),
  "rotina-habits-checked": { [["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"][(new Date().getDay() + 6) % 7]]: [true, true, false, false, false] },
  "core-saude-water": { [hoje]: 3 },
  "water-log": { [hoje]: 3 },
  "core-dieta-log": { [hoje]: { r1: { name: "Café da manhã", calories: 0 } } },
  "core-dias-anotados": [ontem, hoje],
  "core-hub-streak": { count: 2, lastDate: hoje },
  "finance-dueDays": [{ day: Number(hoje.slice(8, 10)), bills: [{ name: "Cartão Nubank", paid: false }] }],
};

const Sonda = () => {
  const { pathname, state } = useLocation();
  const tipo = useNavigationType();
  return <div data-testid="sonda" data-rota={pathname} data-tipo={tipo} data-estado={state ? JSON.stringify(state) : ""} data-origem={(state as { origem?: string } | null)?.origem ?? ""} />;
};
const App = () => (
  <>
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/conquistas" element={<div data-testid="tela-conquistas" />} />
      <Route path="/voce" element={<div data-testid="tela-voce-falsa" />} />
      <Route path="*" element={<div data-testid="outra-rota" />} />
    </Routes>
    <BarraVidroGlobal />
    <Sonda />
  </>
);
const respirar = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const montar = async (dados: Dados = DADOS) => {
  const n = criarNuvem(dados);
  const r = render(<MemoryRouter initialEntries={["/home"]}><n.Provedor><App /></n.Provedor></MemoryRouter>);
  await respirar(30);
  return { n, ...r };
};
const ligar = () => localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");

beforeAll(() => {
  prepararJsdom();
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  window.confirm = () => false;
  window.alert = () => {};
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => true });
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; _zerarHomeNova(); _zerarConsultaAdmin(); __zerarPilhaDaBarraVidro(); adminMock.resposta = false; adminMock.chamadas = 0; });
afterEach(() => { cleanup(); document.body.className = ""; });

describe("Home nova — chave OFF", () => {
  it("é a Home de hoje, sem nenhum nó da nova (nem a barra de vidro), e nenhuma chave nova é gravada", async () => {
    const { n } = await montar();
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy();
    for (const t of ["score", "acoes-rapidas", "adicionar-widget", "pendencias", "modulos"]) expect(document.querySelector(`[data-tour="${t}"]`), t).toBeTruthy();
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(document.querySelector('[data-testid="barra-vidro-global"]')).toBeNull();
    expect(document.querySelector('[data-testid="hn-barra"]')).toBeNull();
    const raiz = document.querySelector('[data-nav-raiz="hoje"]') as HTMLElement;
    expect(raiz).toBeTruthy();
    expect(raiz.className.includes("hn")).toBe(false);
    expect(raiz.innerHTML).not.toMatch(/he-|hn-|home-nova/);
    expect(Object.keys(localStorage).filter((k) => k.includes("home-nova"))).toEqual([]);
    expect(n.escritasDeDado().some((k) => k.includes("home-nova"))).toBe(false);
  });
});

describe("Home nova — chave ON", () => {
  it("monta a Home nova com os dados reais, a barra de vidro, e sem o tour antigo", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeNull();
    expect(screen.getByText(/Boa (noite|tarde|madrugada)|Bom dia/).textContent).toContain("João");
    expect(screen.getByTestId("he-score-numero").textContent).toMatch(/^\d+$/);
    const metricas = Array.from(document.querySelectorAll('[data-testid="he-metrica"]')).map((e) => e.textContent?.replace(/\s+/g, " ").trim());
    expect(metricas).toEqual(["2/5Hábitos", "3/8Água", "1/4Refeições"].map((s) => s.replace("/", " /")).map((s) => s.replace(" /", "/")));
    expect(document.querySelectorAll('[data-testid="hn-pendencia"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Vence hoje: Cartão Nubank/)).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="hn-modulo"]').length).toBe(16);
    await waitFor(() => expect(document.querySelector('[data-testid="barra-vidro-global"] [data-testid="hn-barra"]')).toBeTruthy());
    expect(document.querySelector('[data-camada-guia]')).toBeNull();
    expect(document.querySelector('[data-testid="barra-de-abas"]')).toBeNull();
    // o fogo acendeu hoje (o dia está anotado): ~0,4 s apagado e acende; a marca do aparelho é de hoje
    await waitFor(() => expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(hoje));
  });

  it("o '+' → Água abre o FORMULÁRIO da água (não registra no toque); '+ 1 copo' grava nas duas chaves, a folha fica aberta e 'Pronto' fecha", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="water"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-acao").getAttribute("data-acao")).toBe("water"));
    expect((n.ler<Record<string, number>>("core-saude-water") ?? {})[hoje]).toBe(3); // só abrir não grava
    expect(screen.getByTestId("hn-agua-numero").textContent).toBe("3");
    expect(eventos.some(([e, d]) => e === "home_acao_rapida" && d.acao === "water" && d.origem === "folha")).toBe(true);
    fireEvent.click(screen.getByTestId("hn-agua-mais"));
    await waitFor(() => expect((n.ler<Record<string, number>>("core-saude-water") ?? {})[hoje]).toBe(4));
    expect((n.ler<Record<string, number>>("water-log") ?? {})[hoje]).toBe(4);
    await waitFor(() => expect(screen.getByTestId("hn-agua-numero").textContent).toBe("4"));
    expect(screen.getByTestId("hn-folha-mais")).toBeTruthy(); // fica aberta pra somar copos
    fireEvent.click(screen.getByTestId("hn-acao-pronto"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
    // os 3 cards acompanham: Água 4/8
    expect(document.querySelector('[data-metrica="agua"]')?.textContent?.replace(/\s+/g, "")).toContain("4/8");
  });

  it("BUG do dono: tocar no CARD 'Água' da página 1 NÃO registra um copo — abre o formulário da água", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-metrica="agua"]')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-metrica="agua"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("water"));
    await respirar(100);
    expect((n.ler<Record<string, number>>("core-saude-water") ?? {})[hoje]).toBe(3);
    expect(screen.getByTestId("hn-agua-mais")).toBeTruthy();
    expect(screen.queryByTestId("hn-acao-voltar")).toBeNull(); // veio direto, não da grade
  });

  it("humor: os 5 humores grandes no formulário novo; tocar grava em core-mood-log e a folha fecha", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="mood"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("mood"));
    expect(screen.queryByTestId("hn-acoes")).toBeNull(); // a grade some com o formulário aberto
    expect(document.querySelectorAll("[data-humor]").length).toBe(5);
    fireEvent.click(document.querySelector('[data-humor="4"]')!);
    await waitFor(() => expect((n.ler<Record<string, { value: number }>>("core-mood-log") ?? {})[hoje]?.value).toBe(4));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
  });

  it("gasto: campo grande com teclado decimal, categoria em pílulas e o botão principal — grava pelo mesmo caminho de Finanças", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="expense"]')!);
    const campo = await screen.findByLabelText("Valor do gasto");
    expect(campo.getAttribute("inputmode")).toBe("decimal");
    fireEvent.click(screen.getByTestId("hn-acao-principal"));
    expect(toast.error).toHaveBeenCalledWith("Informe um valor válido"); // a mesma validação de sempre
    fireEvent.change(campo, { target: { value: "12,50" } });
    fireEvent.click(document.querySelector('[data-pilula="Lazer"]')!);
    fireEvent.click(screen.getByTestId("hn-acao-principal"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("12,50")));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Lazer"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
  });

  it("uma pendência com ação abre a folha já no formulário dela; o anel abre a folha da pontuação", async () => {
    ligar();
    // sem a conta a vencer: a página 2 cabe 5 linhas e os avisos (conta, treino sem plano) tomam vagas — assim o humor aparece
    const { "finance-dueDays": _conta, ...semConta } = DADOS; void _conta;
    await montar(semConta);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    const humor = Array.from(document.querySelectorAll('[data-testid="hn-pendencia"]')).find((e) => /humor/i.test(e.textContent ?? ""));
    expect(humor, "a pendência do humor").toBeTruthy();
    fireEvent.click(humor!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("mood"));
    fireEvent.click(screen.getByTestId("hn-folha-mais-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    fireEvent.click(screen.getByTestId("he-score-abrir"));
    await waitFor(() => expect(screen.getByTestId("he-folha-score")).toBeTruthy());
    expect(screen.getByTestId("he-folha-explica").textContent).toMatch(/Falta/);
  });

  it("Organizar abre a configuração real; esconder tira o azulejo e grava em core-module-prefs", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-organizar"));
    await waitFor(() => expect(screen.getByTestId("hn-organizar-folha")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Esconder Pet"));
    await waitFor(() => expect(document.querySelectorAll('[data-testid="hn-modulo"]').length).toBe(15));
    expect((n.ler<{ hidden?: string[] }>("core-module-prefs") ?? {}).hidden).toContain("pet");
    expect(eventos.some(([e, d]) => e === "home_modulos_editar" && d.origem === "organizar")).toBe(true);
    fireEvent.click(screen.getByTestId("hn-organizar-pronto"));
    await waitFor(() => expect(screen.queryByTestId("hn-organizar-folha")).toBeNull());
    expect(screen.getByText(/\+1 oculto/)).toBeTruthy();
  });

  it("as abas navegam: Conquistas (origem home), Você, e Início volta pra Home", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-conquistas"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-conquistas"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/conquistas"));
    expect(screen.getByTestId("sonda").getAttribute("data-origem")).toBe("home");
    expect(screen.getByTestId("tela-conquistas")).toBeTruthy();
    await waitFor(() => expect(document.body.classList.contains("com-barra-vidro")).toBe(true)); // o respiro de baixo nas outras abas
    expect(eventos.some(([e, d]) => e === "tab_click" && d.tab === "conquistas" && d.barra === "vidro")).toBe(true);
    fireEvent.click(screen.getByTestId("hn-aba-voce"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce"));
    fireEvent.click(screen.getByTestId("hn-aba-inicio"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.body.classList.contains("com-barra-vidro")).toBe(false);
  });

  it("o '+' numa outra aba leva pra Home já com a folha aberta", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-voce"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-voce"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce"));
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
  });

  it("reabrir o app não repete nada: a mesma Home, nenhuma folha, o fogo não acende de novo", async () => {
    ligar();
    const primeira = await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    await waitFor(() => expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(hoje));
    const marca = localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA);
    primeira.unmount();
    cleanup();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(screen.queryByTestId("hn-folha-mais")).toBeNull();
    expect(screen.queryByTestId("he-folha-score")).toBeNull();
    expect(screen.queryByTestId("hn-organizar-folha")).toBeNull();
    expect(localStorage.getItem(CHAVE_FOGO_ACESO_HOME_NOVA)).toBe(marca);
    expect(document.querySelector('[data-testid="hn-pilula-fogo"]')?.classList.contains("he-acende")).toBe(false);
    // reabriu no mesmo dia: já monta ACESO (sem o "apagado → acende") e sem tocar o acender
    expect(document.querySelector('[data-testid="hn-pilula-fogo"] [data-testid="fg-seq"]')?.getAttribute("data-fogo")).toBe("aceso");
    expect(document.querySelector('[data-testid="hn-pilula-fogo"] .cf-ignite')).toBeNull();
  });
});

/** uma consulta de admin PRESA: devolve quem responde, pro teste decidir quando (e o quê) */
const consultaPresa = async () => {
  let resolver: (v: boolean) => void = () => {};
  const { checkIsAdmin } = await import("@/lib/admin");
  (checkIsAdmin as unknown as { mockImplementationOnce: (f: () => Promise<boolean>) => void }).mockImplementationOnce(() => new Promise<boolean>((r) => { adminMock.chamadas++; resolver = r; }));
  return (v: boolean) => act(async () => { resolver(v); await new Promise((r) => setTimeout(r, 0)); });
};
/** a tela em branco da Home (carregando) */
const BRANCO = '[aria-hidden="true"].fixed.inset-0';
const ligarAdmin = () => registrarHomeNovaRemoto({ current: { metadata: { home_nova: "admin" } }, all: {} });

describe("Home nova — modo admin (a chave é global no RevenueCat: nenhum cliente pode ver a tela em branco)", () => {
  it("1ª abertura, conta SEM papel de admin: a Home de HOJE aparece na hora, antes da consulta responder; a resposta fica guardada pra conta", async () => {
    ligarAdmin();
    const responder = await consultaPresa();
    await montar();
    // ainda sem resposta: a Home de hoje (não a tela em branco, não a nova)
    await waitFor(() => expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy());
    expect(document.querySelector(BRANCO)).toBeNull();
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(adminMock.chamadas).toBe(1); // a Home e a barra perguntam, a consulta é uma só
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBeNull();
    await responder(false);
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy();
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(document.querySelector('[data-testid="barra-vidro-global"]')).toBeNull();
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("u1:0");
  });

  it("consulta que não responde no tempo limite: vale 'não' (a Home de hoje fica), SEM guardar; um 'sim' atrasado ainda liga (o dono numa rede lenta)", async () => {
    ligarAdmin();
    _definirTempoLimiteAdmin(40);
    const responder = await consultaPresa();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy());
    await respirar(120); // passou do tempo limite
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy();
    expect(document.querySelector(BRANCO)).toBeNull();
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBeNull(); // tempo limite não é resposta: a próxima abertura pergunta de novo
    await responder(true);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("u1:1");
  });

  it("1ª abertura, conta ADMIN: a Home de hoje primeiro; quando a resposta vem, troca pra nova sem a tela em branco; na abertura seguinte a guardada vale na hora", async () => {
    ligarAdmin();
    const responder = await consultaPresa();
    const primeira = await montar();
    await waitFor(() => expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeTruthy());
    expect(document.querySelector(BRANCO)).toBeNull();
    await responder(true);
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(document.querySelector(BRANCO)).toBeNull();
    expect(document.querySelector('[data-tour="acoes-rapidas"]')).toBeNull();
    expect(localStorage.getItem(CHAVE_ADMIN_HOME_NOVA)).toBe("u1:1");
    expect(adminMock.chamadas).toBe(1);
    await waitFor(() => expect(document.querySelector('[data-testid="barra-vidro-global"] [data-testid="hn-barra"]')).toBeTruthy());
    primeira.unmount(); cleanup();
    _zerarHomeNova(); _zerarConsultaAdmin(); // outra abertura: o RevenueCat ainda não respondeu, a resposta do aparelho vale
    localStorage.setItem("core-home-nova", "admin");
    const responder2 = await consultaPresa();
    await montar();
    // a Home nova já está na tela ANTES da consulta responder (a resposta guardada vale)
    await waitFor(() => expect(document.querySelector('[data-layout="e"]')).toBeTruthy());
    expect(adminMock.chamadas).toBe(2);
    await responder2(true);
    expect(document.querySelector('[data-layout="e"]')).toBeTruthy();
  });
});

describe("Home nova — as 12 ações do '+' (revisor 26/10: a Tarefa abria escondida atrás da folha e travava a grade)", () => {
  const TODAS: ActionId[] = ["water", "mood", "expense", "income", "task", "workout", "sleep", "meal", "weight", "idea", "gratitude", "detox"];
  const DIALOGO_PADRAO = '[role="dialog"][data-state="open"]';

  it("as 12 ações: cada uma abre o SEU formulário (nenhuma grava no toque, nenhuma fica atrás de um diálogo); a Tarefa abre a folha da Rotina por cima e, ao fechar, leva o '+' junto", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    const abrir = async () => { fireEvent.click(screen.getByTestId("hn-mais")); await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy()); };
    const fecharPeloX = async () => { fireEvent.click(screen.getByTestId("hn-folha-mais-fechar")); await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull()); };
    const agua = () => (n.ler<Record<string, number>>("core-saude-water") ?? {})[hoje];
    const treino = () => n.ler<string[]>("saude-workout-log") ?? [];
    for (const id of TODAS) {
      await abrir();
      expect(screen.getByTestId("hn-folha-mais").getAttribute("data-escondida"), id).toBeNull();
      fireEvent.click(document.querySelector(`[data-testid="hn-acoes"] [data-acao="${id}"]`)!);
      if (id === "task") {
        const tarefa = await screen.findByTestId("folha-nova-tarefa");
        expect(tarefa.getAttribute("data-state")).toBe("open");
        // a folha do "+" saiu da frente (continua montada: é ela quem segura o QuickActions e a folha da tarefa)
        const mais = screen.getByTestId("hn-folha-mais");
        expect(mais.getAttribute("data-escondida")).toBe("1");
        expect(mais.getAttribute("aria-hidden")).toBe("true");
        expect(mais.style.visibility).toBe("hidden");
        expect(mais.style.pointerEvents).toBe("none");
        // cancelar a tarefa (X da faixa) fecha a folha do "+" junto, e o toque volta (o Radix solta o body)
        fireEvent.click(within(tarefa).getByLabelText("Fechar"));
        await waitFor(() => expect(screen.queryByTestId("folha-nova-tarefa")).toBeNull());
        await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
        expect(document.body.style.pointerEvents).not.toBe("none");
        continue;
      }
      // o formulário da ação, dentro da folha, na frente, sem nenhum diálogo padrão escondido atrás — e nada gravado só de abrir
      await waitFor(() => expect(screen.getByTestId("hn-folha-acao").getAttribute("data-acao"), id).toBe(id));
      expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe(id);
      expect(screen.getByTestId("hn-folha-mais").getAttribute("data-escondida")).toBeNull();
      expect(screen.queryByTestId("hn-acoes")).toBeNull();
      expect(document.querySelector(DIALOGO_PADRAO), id).toBeNull();
      expect(agua(), id).toBe(3);
      expect(treino(), id).not.toContain(hoje);
      // a seta ← volta pra grade
      fireEvent.click(screen.getByTestId("hn-acao-voltar"));
      await waitFor(() => expect(screen.getByTestId("hn-acoes")).toBeTruthy());
      await fecharPeloX();
    }
    // o treino grava só pelo botão principal do formulário dele (nunca no toque do azulejo)
    await abrir();
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="workout"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-acao").getAttribute("data-acao")).toBe("workout"));
    fireEvent.click(screen.getByTestId("hn-acao-principal"));
    await waitFor(() => expect(treino()).toContain(hoje));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull(), { timeout: 3000 });
  });

  it("abrir um formulário, fechar pelo X e reabrir o '+': a folha FICA aberta (no Simulador ela se fechava sozinha em 150 ms)", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="idea"]')!);
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais").getAttribute("data-ativa")).toBe("idea"));
    fireEvent.click(screen.getByTestId("hn-folha-mais-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    await respirar(400);
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    await respirar(700); // mais que os 150 ms do fechamento automático
    expect(screen.getByTestId("hn-folha-mais")).toBeTruthy();
    expect(screen.getByTestId("hn-acoes")).toBeTruthy(); // a grade, sem formulário
    // e a mesma coisa depois da Tarefa cancelada
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="task"]')!);
    const tarefa = await screen.findByTestId("folha-nova-tarefa");
    fireEvent.click(within(tarefa).getByLabelText("Fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    await respirar(400);
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    await respirar(700);
    expect(screen.getByTestId("hn-folha-mais")).toBeTruthy();
    expect(screen.getByTestId("hn-folha-mais").getAttribute("data-escondida")).toBeNull();
  });

  it("salvar a tarefa pela folha própria grava nas tarefas de hoje da Rotina e fecha tudo", async () => {
    ligar();
    const { n } = await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-mais"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-testid="hn-acoes"] [data-acao="task"]')!);
    const tarefa = await screen.findByTestId("folha-nova-tarefa");
    const campo = within(tarefa).getAllByRole("textbox")[0];
    fireEvent.change(campo, { target: { value: "Ligar pro dentista" } });
    const salvar = within(tarefa).getAllByRole("button").find((b) => /Salvar tarefa/i.test(b.textContent ?? ""));
    expect(salvar, "o botão de salvar da folha da tarefa").toBeTruthy();
    fireEvent.click(salvar!);
    // as tarefas de hoje da Rotina (CHAVE_TAREFAS_ROTINA = rotina-day-tasks), como pelo QuickActions da Home de hoje
    await waitFor(() => expect(JSON.stringify(n.ler("rotina-day-tasks") ?? {})).toContain("Ligar pro dentista"));
    await waitFor(() => expect(screen.queryByTestId("folha-nova-tarefa")).toBeNull());
    await waitFor(() => expect(screen.queryByTestId("hn-folha-mais")).toBeNull());
    expect(eventos.some(([e, d]) => e === "home_acao_rapida" && d.acao === "task" && d.origem === "folha")).toBe(true);
  });

  it("vindo direto em 'task' (uma pendência / a folha do score), a folha do '+' nem aparece: só a da tarefa; cancelar fecha tudo", async () => {
    const n = criarNuvem(DADOS);
    const onFechar = vi.fn();
    render(<MemoryRouter><n.Provedor><FolhaMaisE aberta inicial="task" onFechar={onFechar} data={HUB} /></n.Provedor></MemoryRouter>);
    expect(screen.getByTestId("hn-folha-mais").getAttribute("data-escondida")).toBe("1"); // desde o 1º quadro
    const tarefa = await screen.findByTestId("folha-nova-tarefa");
    expect(tarefa.getAttribute("data-state")).toBe("open");
    expect(onFechar).not.toHaveBeenCalled();
    fireEvent.click(within(tarefa).getByLabelText("Fechar"));
    await waitFor(() => expect(onFechar).toHaveBeenCalled());
  });

  it("o Voltar (Android/navegador) com a folha do '+' aberta fecha a folha, não a tela; fechar pelo X desfaz a entrada fantasma do histórico", async () => {
    const n = criarNuvem(DADOS);
    const onFechar = vi.fn();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const arvore = (aberta: boolean) => <MemoryRouter><n.Provedor><FolhaMaisE aberta={aberta} onFechar={onFechar} data={HUB} /></n.Provedor></MemoryRouter>;
    const { rerender } = render(arvore(true));
    expect((window.history.state as { coreSheet?: string } | null)?.coreSheet).toBe("home-mais");
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(onFechar).toHaveBeenCalledTimes(1);
    rerender(arvore(false));
    expect(back).not.toHaveBeenCalled(); // fechou pelo Voltar: a entrada já foi consumida
    rerender(arvore(true));
    rerender(arvore(false)); // fechou pelo X
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});

describe("Home nova — a barra de vidro e as folhas padrão (revisor 26/10: a barra ficava por cima das folhas z-50)", () => {
  it("a folha de Widgets (estilo E, rodada 2) abre por cima da barra e grava na mesma chave; um diálogo padrão (Radix) na Home ainda esconde a barra", async () => {
    ligar();
    const { n } = await montar({ ...DADOS, "core-home-widgets-e": [] }); // rodada 3: sem widget escolhido → o convite "Escolher"
    await waitFor(() => expect(document.querySelector('[data-testid="hn-barra"]')).toBeTruthy());
    const escolher = screen.queryByTestId("he-widgets-escolher") ?? screen.getByText("Escolher");
    fireEvent.click(escolher);
    await waitFor(() => expect(screen.getByTestId("hn-widgets-folha")).toBeTruthy());
    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull(); // não é Radix: fica acima da barra (z-71)
    // rodada 3: os widgets da E (lib/home-widgets-e, chave core-home-widgets-e); Leitura não está no padrão
    fireEvent.click(screen.getByLabelText("Mostrar Leitura"));
    await waitFor(() => expect(JSON.stringify(n.ler("core-home-widgets-e") ?? [])).toContain("leitura"));
    fireEvent.click(screen.getByTestId("hn-widgets-fechar"));
    await waitFor(() => expect(screen.queryByTestId("hn-widgets-folha")).toBeNull());
    // um diálogo padrão (Radix) ainda esconde a barra
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("data-state", "open");
    document.body.appendChild(dlg);
    await waitFor(() => expect(document.querySelector('[data-testid="hn-barra"]')).toBeNull());
    dlg.remove();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-barra"]')).toBeTruthy());
  });

  it("em Conquistas/Você qualquer folha padrão esconde a barra (data-state open→closed), e o respiro de baixo do body fica", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-conquistas"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-conquistas"));
    await waitFor(() => expect(document.body.classList.contains("com-barra-vidro")).toBe(true));
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("data-state", "open");
    document.body.appendChild(dlg);
    await waitFor(() => expect(document.querySelector('[data-testid="hn-barra"]')).toBeNull());
    expect(document.body.classList.contains("com-barra-vidro")).toBe(true);
    dlg.setAttribute("data-state", "closed");
    await waitFor(() => expect(document.querySelector('[data-testid="hn-barra"]')).toBeTruthy());
    dlg.remove();
  });
});

describe("Home nova — o '+' fora da Home e o Rever tutorial", () => {
  it("o '+' em outra aba volta pra Home SEM empilhar (POP: a Home estava logo abaixo), sem estado no histórico, e a folha abre ao chegar", async () => {
    ligar();
    await montar();
    await waitFor(() => expect(document.querySelector('[data-testid="hn-aba-voce"]')).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-aba-voce"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/voce"));
    expect(screen.getByTestId("sonda").getAttribute("data-tipo")).toBe("PUSH");
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    expect(screen.getByTestId("sonda").getAttribute("data-tipo")).toBe("POP");
    expect(screen.getByTestId("sonda").getAttribute("data-estado")).toBe("");
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
    expect(eventos.some(([e, d]) => e === "home_mais_abrir" && d.de === "voce")).toBe(true);
  });

  it("chegando direto numa aba (sem a Home atrás), o '+' SUBSTITUI a entrada (REPLACE) e a folha abre", async () => {
    ligar();
    const n = criarNuvem(DADOS);
    render(<MemoryRouter initialEntries={["/voce"]}><n.Provedor><App /></n.Provedor></MemoryRouter>);
    await respirar(30);
    await waitFor(() => expect(screen.getByTestId("hn-mais")).toBeTruthy());
    fireEvent.click(screen.getByTestId("hn-mais"));
    await waitFor(() => expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/home"));
    expect(screen.getByTestId("sonda").getAttribute("data-tipo")).toBe("REPLACE");
    await waitFor(() => expect(screen.getByTestId("hn-folha-mais")).toBeTruthy());
  });

  it("Rever tutorial (aba Você → /home com reverTutorial) continua funcionando com a Home nova ligada: o replay entra, não a Home nova", async () => {
    ligar();
    const n = criarNuvem(DADOS);
    render(<MemoryRouter initialEntries={[{ pathname: "/home", state: { reverTutorial: true } }]}><n.Provedor><App /></n.Provedor></MemoryRouter>);
    await respirar(30);
    await waitFor(() => expect(screen.getAllByText("Encerrar tutorial").length).toBeGreaterThan(0));
    expect(document.querySelector('[data-layout="e"]')).toBeNull();
    expect(document.querySelector('[data-testid="hn-barra"]')).toBeNull(); // a raiz não está pronta: sem barra sobre o tutorial
  });
});
