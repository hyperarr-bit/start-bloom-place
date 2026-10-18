/**
 * FUNIL-DEMO (/experimente, 14/10) — o anúncio abre o app de verdade com dados de exemplo; "Criar conta" sempre
 * à vista → a MESMA conta e o MESMO sucesso da Porta.
 *
 * O que não pode quebrar:
 *   · pílulas trocam o módulo (5, ordem do uso real; `?m=` escolhe o 1º) e medem a troca;
 *   · a folha aparece 1x por sessão: aos 30 s OU na 2ª troca de módulo — e NUNCA bloqueia a demo;
 *   · todo "Criar conta" (topo, faixa, fim, folha, seta ← do módulo) abre a conta da Porta com o título do funil;
 *   · conta: user_metadata.porta com a campanha + variante "demo"; CompleteRegistration 1x por conta nova;
 *   · o que ELA criou vai pra conta; dado de EXEMPLO nunca (nem pela migração do convidado);
 *   · nenhum preço do produto, nunca "sem cartão".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
type U = { id: string; email: string; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean } = { user: null, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

const getUser = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const invoke = vi.fn();
const lerUserData = vi.fn();
const upsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ in: (...a: unknown[]) => lerUserData(...a) }) }),
      upsert: (...a: unknown[]) => upsert(...a),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
vi.mock("@/pages/porta/navegar", () => ({ irPraLoja: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/auth-nativo", () => ({ entrarComGoogle: vi.fn(async () => ({ error: null })), entrarComApple: vi.fn(async () => ({ error: null })) }));
vi.mock("@/pages/Index", async () => ({ default: (await import("./experimente-modulos-falsos")).FinancasFalsa }));
vi.mock("@/pages/Rotina", async () => ({ default: (await import("./experimente-modulos-falsos")).RotinaFalsa }));
vi.mock("@/pages/Treino", async () => ({ default: (await import("./experimente-modulos-falsos")).TreinoFalso }));
vi.mock("@/pages/Saude", async () => ({ default: (await import("./experimente-modulos-falsos")).SaudeFalsa }));
vi.mock("@/pages/Dieta", async () => ({ default: (await import("./experimente-modulos-falsos")).DietaFalsa }));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComGoogle } from "@/lib/auth-nativo";
import ExperimenteRota, { _zerarEstadoDemo } from "@/pages/experimente/Experimente";
import { CONTA_TITULO, FOLHA_TITULO, MODULOS_DEMO, moduloDaUrl } from "@/pages/experimente/conteudo";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { ehCaminhoDeDemo } from "@/lib/caminho-demo";
import { desvioNaDemo } from "@/pages/experimente/navegacao";
import { DemoDoFunilProvider } from "@/lib/demo-do-funil";
import { ModuleTip } from "@/components/ModuleTip";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";

/* ---------------------------------------------------------------- ambiente */
const UA = {
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 390.0.0.28.85 (iPhone15,3; iOS 18_5; pt_BR; pt; scale=3.00; 1290x2796; 721384054)",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
};
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const QUERY_AD = "utm_source=meta&utm_medium=paid&utm_campaign=demo_teste&utm_content=video_demo&c_id=111&as_id=222&ad_id=333&fbclid=IwAR_demo";
const irPara = (url: string) => window.history.replaceState({}, "", url);
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
let local = { search: "" };
const Local = () => { const l = useLocation(); local = { search: l.search }; return null; };
const montar = (query = `m=financas&${QUERY_AD}`) => {
  irPara(`/experimente?${query}`);
  return render(
    <MemoryRouter initialEntries={[`/experimente?${query}`]}>
      <Local />
      <Routes>
        <Route path="/experimente" element={<ExperimenteRota />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );
};
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const funil = () => screen.getByTestId("demo-funil");
const passo = () => funil().getAttribute("data-passo");
const texto = () => document.body.textContent ?? "";
/** um toque de verdade (o provider só conta como "dela" a gravação logo depois do pointerdown) */
const tocar = (testid: string) => { const el = screen.getByTestId(testid); act(() => { fireEvent.pointerDown(el); fireEvent.click(el); }); };
const noModulo = async (m: string, falso: string) => {
  await waitFor(() => expect(funil().getAttribute("data-modulo")).toBe(m));
  await screen.findByTestId(falso);
};
/** PREÇO DO PRODUTO: nunca na web. */
const PRECO_DO_PRODUTO = /\d+,90|R\$\s?\d+,\d{2}|\banual\b|\bmensal\b|mensalidade|assinatura|por ano|\/ano|\/mês/i;
const conferirCopy = () => {
  expect(texto()).not.toMatch(PRECO_DO_PRODUTO);
  expect(texto()).not.toMatch(/sem cart[aã]o/i);
};
const usuario = (over: Partial<U> = {}): U => ({ id: "u-1", email: "ana@exemplo.com", created_at: new Date().toISOString(), user_metadata: {}, ...over });
const criarComEmail = async () => {
  fireEvent.change(screen.getByTestId("porta-email"), { target: { value: "ana@exemplo.com" } });
  fireEvent.change(screen.getByTestId("porta-senha"), { target: { value: "segredo1" } });
  fireEvent.click(screen.getByTestId("porta-criar-conta"));
};
/** signUp devolve sessão; getUser devolve a conta com a porta que o signUp gravou (como o Supabase faz) */
const contaNovaComSessao = () => {
  signUp.mockImplementation(async (args: { options: { data: { porta: unknown } } }) => {
    const u = usuario({ user_metadata: { porta: args.options.data.porta } });
    getUser.mockResolvedValue({ data: { user: u } });
    return { data: { session: { access_token: "t" }, user: u }, error: null };
  });
};

beforeEach(() => {
  _zerarMemoriaPorta();
  _zerarEstadoDemo();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  nativo(false);
  authState.user = null;
  authState.loading = false;
  [getUser, signUp, signInWithPassword, updateUser, signOut, invoke, lerUserData, upsert].forEach((f) => f.mockReset());
  invoke.mockResolvedValue({ data: null, error: { message: "funcao_fora" } });
  updateUser.mockResolvedValue({ data: {}, error: null });
  lerUserData.mockResolvedValue({ data: [], error: null });
  upsert.mockResolvedValue({ error: null });
  vi.mocked(trackEvent).mockClear();
  vi.mocked(fireMetaEvent).mockClear();
  vi.mocked(entrarComGoogle).mockClear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  ua(UA.instagram);
});
afterEach(() => { cleanup(); nativo(false); irPara("/"); vi.useRealTimers(); });

/* ---------------------------------------------------------------- rota */
describe("rota", () => {
  it("o app nativo NUNCA monta /experimente", () => {
    nativo(true);
    montar();
    expect(screen.getByTestId("onde").textContent).toBe("/app");
  });

  it("App.tsx: /experimente só na web (SoNaWeb); o banner do teste grátis não monta por cima; volta do Google permitida", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />');
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/experimente")');
    expect(readFileSync(join(process.cwd(), "src/lib/destino-seguro.ts"), "utf8")).toContain('"/experimente"');
  });

  it("os módulos tratam /experimente como demonstração (foto não sobe, sem pedido de lembrete/avaliação)", () => {
    expect(ehCaminhoDeDemo("/experimente")).toBe(true);
    expect(ehCaminhoDeDemo("/preview/financas")).toBe(true);
    expect(ehCaminhoDeDemo("/experimentar")).toBe(false);
    expect(ehCaminhoDeDemo("/financas")).toBe(false);
  });

  it("noindex enquanto o funil está montado", () => {
    const { unmount } = montar();
    expect(document.head.querySelector('meta[name="robots"][data-demo]')?.getAttribute("content")).toMatch(/noindex/);
    unmount();
    expect(document.head.querySelector('meta[name="robots"][data-demo]')).toBeNull();
  });
});

/* ---------------------------------------------------------------- pílulas */
describe("pílulas dos módulos", () => {
  it("5 pílulas na ordem do uso real; Finanças é o padrão; ?m= escolhe o 1º", async () => {
    expect(MODULOS_DEMO.map((m) => m.label)).toEqual(["Finanças", "Rotina", "Treino", "Saúde", "Dieta"]);
    expect(moduloDaUrl(null)).toBe("financas");
    expect(moduloDaUrl("Saúde")).toBe("saude");
    expect(moduloDaUrl("pet")).toBe("financas");
    montar(QUERY_AD);
    await noModulo("financas", "falso-n-gastos");
    expect(screen.getByTestId("demo-pilula-financas").getAttribute("aria-selected")).toBe("true");
    cleanup();
    vi.mocked(trackEvent).mockClear();
    montar(`m=rotina&${QUERY_AD}`);
    await noModulo("rotina", "falso-habitos");
    expect(screen.getByTestId("demo-pilula-rotina").getAttribute("aria-selected")).toBe("true");
    expect(eventos("demo_view")[0]).toMatchObject({ modulo: "rotina", entrada: true, variante: "demo", utm_campaign: "demo_teste" });
  });

  it("tocar na pílula troca o módulo, a URL (?m=) e manda demo_pilula + demo_view do novo", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    await noModulo("treino", "falso-exercicio");
    expect(local.search).toContain("m=treino");
    expect(local.search).toContain("utm_campaign=demo_teste");
    expect(screen.getByTestId("demo-pilula-treino").getAttribute("aria-selected")).toBe("true");
    expect(eventos("demo_pilula")).toEqual([expect.objectContaining({ de: "financas", para: "treino", n: 1, variante: "demo", porta_session_id: expect.any(String) })]);
    expect(eventos("demo_view").map((e) => e.modulo)).toEqual(["financas", "treino"]);
    // tocar na pílula do módulo aberto não conta
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    expect(eventos("demo_pilula")).toHaveLength(1);
  });

  it("o que ela mexeu num módulo continua lá quando ela volta pela pílula; demo_edicao 1x por módulo", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    const antes = Number(screen.getByTestId("falso-n-gastos").textContent);
    tocar("falso-gasto");
    expect(Number(screen.getByTestId("falso-n-gastos").textContent)).toBe(antes + 1);
    tocar("falso-editar-exemplo");
    expect(eventos("demo_edicao")).toEqual([expect.objectContaining({ modulo: "financas", chave: "finance-expenses" })]);
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    await noModulo("rotina", "falso-habitos");
    fireEvent.click(screen.getByTestId("demo-pilula-financas"));
    await noModulo("financas", "falso-n-gastos");
    expect(Number(screen.getByTestId("falso-n-gastos").textContent)).toBe(antes + 1);
    expect(screen.getByTestId("falso-gastos").textContent).toContain("Pizza");
  });
});

/* ---------------------------------------------------------------- a folha */
describe("a folha de baixo (\"Gostou? Crie sua conta grátis…\")", () => {
  it("aparece UMA vez aos 30 s (não antes), e não volta na mesma sessão", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_900); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId("demo-folha").textContent).toContain(FOLHA_TITULO);
    expect(eventos("demo_folha_view")).toEqual([expect.objectContaining({ gatilho: "30s", variante: "demo" })]);
    conferirCopy();
    fireEvent.click(screen.getByTestId("demo-folha-fechar"));
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    expect(eventos("demo_folha_fechar")).toEqual([expect.objectContaining({ gatilho: "30s", via: "botao" })]);
    // a 2ª troca de módulo não reabre; recarregar (mesma sessão) também não
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    cleanup();
    _zerarEstadoDemo();
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    expect(eventos("demo_folha_view")).toHaveLength(1);
  });

  it("aparece na 2ª troca de módulo (antes dos 30 s) — não na 1ª — e os 30 s não repetem", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    fireEvent.click(screen.getByTestId("demo-pilula-saude"));
    expect(screen.getByTestId("demo-folha")).toBeInTheDocument();
    expect(eventos("demo_folha_view")).toEqual([expect.objectContaining({ gatilho: "pilula" })]);
    fireEvent.click(screen.getByTestId("demo-folha-x"));
    expect(eventos("demo_folha_fechar")).toEqual([expect.objectContaining({ gatilho: "pilula", via: "x" })]);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    expect(eventos("demo_folha_view")).toHaveLength(1);
  });

  it("NÃO bloqueia: sem fundo, aria-modal=false, container transparente ao toque; dá pra mexer e trocar de módulo com ela aberta", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    await noModulo("rotina", "falso-habitos");
    fireEvent.click(screen.getByTestId("demo-pilula-financas"));
    await noModulo("financas", "falso-n-gastos");
    const folha = screen.getByTestId("demo-folha");
    expect(folha.getAttribute("aria-modal")).toBe("false");
    expect(screen.getByTestId("demo-folha-area").className).toContain("pointer-events-none");
    expect(folha.className).toContain("pointer-events-auto");
    expect(document.querySelector("[data-testid='demo-folha-area'] [class*='bg-black']")).toBeNull();
    const antes = Number(screen.getByTestId("falso-n-gastos").textContent);
    tocar("falso-gasto");
    expect(Number(screen.getByTestId("falso-n-gastos").textContent)).toBe(antes + 1);
    expect(screen.getByTestId("demo-folha")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("demo-pilula-dieta"));
    await noModulo("dieta", "falso-dieta");
  });
});

/* ---------------------------------------------------------------- criar conta */
describe("todo \"Criar conta\" abre a conta da Porta", () => {
  const abriuConta = async (origem: string) => {
    await waitFor(() => expect(passo()).toBe("conta"));
    expect(screen.getByTestId("porta-conta-titulo").textContent).toBe(CONTA_TITULO);
    expect(screen.getByTestId("porta-email")).toBeInTheDocument();
    expect(local.search).toContain("passo=conta");
    expect(eventos("demo_criar_conta_click").at(-1)).toMatchObject({ origem, modulo: "financas", variante: "demo" });
    expect(eventos("porta_passo").at(-1)).toMatchObject({ passo: "conta", resposta: "view", variante: "demo" });
    conferirCopy();
  };

  it.each([
    ["topo", "demo-topo-criar"],
    ["faixa", "demo-faixa-criar"],
    ["fim", "demo-fim-criar"],
  ])("origem %s", async (origem, testid) => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    conferirCopy();
    fireEvent.click(screen.getByTestId(testid));
    await abriuConta(origem);
  });

  it("origem folha (+ demo_folha_criar)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    fireEvent.click(screen.getByTestId("demo-folha-criar"));
    vi.useRealTimers();
    await abriuConta("folha");
    expect(eventos("demo_folha_criar")).toEqual([expect.objectContaining({ gatilho: "30s" })]);
  });

  it("origem seta ← do cabeçalho do módulo", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-seta"));
    await abriuConta("seta");
  });

  it("Voltar da conta devolve pra demo, no mesmo módulo; Entrar vai pro login", async () => {
    montar(`m=rotina&${QUERY_AD}`);
    await noModulo("rotina", "falso-habitos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    fireEvent.click(screen.getByTestId("demo-voltar"));
    await noModulo("rotina", "falso-habitos");
    fireEvent.click(screen.getByTestId("demo-entrar"));
    expect(screen.getByTestId("onde").textContent).toBe("/entrar");
    expect(eventos("demo_entrar_click")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- a conta */
describe("conta (a da Porta) + o que vai pra conta", () => {
  it("conta nova por e-mail: porta com a campanha + variante demo; CompleteRegistration 1x; sucesso do iPhone; SÓ os itens dela vão pra conta", async () => {
    contaNovaComSessao();
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");            // dela → vai
    tocar("falso-editar-exemplo");   // exemplo editado → não vai
    fireEvent.click(screen.getByTestId("demo-pilula-rotina"));
    await noModulo("rotina", "falso-habitos");
    tocar("falso-marcar");           // quadradinho de um hábito de EXEMPLO → não vai
    tocar("falso-habito");           // hábito digitado → vai
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    await noModulo("treino", "falso-exercicio");
    tocar("falso-exercicio");        // exercício digitado → vai
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    expect(screen.getByTestId("porta-conta-texto").textContent).toContain("3 coisas que você anotou");
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));

    const porta = signUp.mock.calls[0][0].options.data.porta;
    expect(porta).toMatchObject({ v: 1, variante: "demo", metodo: "senha", respostas: { area: "dinheiro", modulo: "financas", itens: "3" } });
    expect(porta.attr).toMatchObject({ utm_campaign: "demo_teste", ad_id: "333", c_id: "111", origem: "url" });
    expect(porta.event_id).toMatch(/^porta_cr_/);
    expect(vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === "CompleteRegistration")).toEqual([["CompleteRegistration", { content_name: "porta_iphone", status: true }, porta.event_id]]);
    expect(invoke).toHaveBeenCalledWith("porta-handoff", { body: { acao: "registro", event_id: porta.event_id } });
    expect(eventos("porta_conta_criada")[0]).toMatchObject({ metodo: "senha", existente: false, variante: "demo" });
    expect(eventos("porta_passo").map((e) => e.passo)).toEqual(["conta", "sucesso"]);

    // o que foi pra conta: só o que ela criou, nunca o exemplo
    expect(upsert).toHaveBeenCalledTimes(1);
    const linhas = upsert.mock.calls[0][0] as Array<{ user_id: string; key: string; value: unknown }>;
    const porChave = Object.fromEntries(linhas.map((l) => [l.key, l.value]));
    // exercício em sábado/domingo também liga o dia no plano (treino-active-days = padrão seg–sex + hoje,
    // mesma regra do adicionarExercicio em demo-guiada-registro) — é dela, não exemplo. Seg–sex: só as 3.
    const hojeSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][new Date().getDay()];
    const fimDeSemana = hojeSemana === "SÁBADO" || hojeSemana === "DOMINGO";
    expect(Object.keys(porChave).sort()).toEqual(["finance-expenses", "rotina-habits", "saude-workouts-v2", ...(fimDeSemana ? ["treino-active-days"] : [])]);
    if (fimDeSemana) expect(porChave["treino-active-days"]).toEqual(["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", hojeSemana]);
    expect(porChave["finance-expenses"]).toEqual([expect.objectContaining({ description: "Pizza", value: 45 })]);
    expect(porChave["rotina-habits"]).toEqual(["Tomar vitamina"]);
    expect(JSON.stringify(porChave["saude-workouts-v2"])).toContain("Burpee");
    const tudo = JSON.stringify(linhas);
    for (const exemplo of ["Mercado", "iFood", "Uber", "Treinar", "Beber 2L", "Ler 30min"]) expect(tudo).not.toContain(exemplo);
    expect(linhas.every((l) => l.user_id === "u-1")).toBe(true);
    expect(eventos("demo_itens_conta")).toEqual([expect.objectContaining({ ok: true, n: 3 })]);
    // a migração do convidado (use-user-data) não leva NADA da demo: nenhum guest:* foi escrito
    expect(Object.keys(localStorage).filter((k) => k.startsWith("guest:"))).toEqual([]);

    // sucesso = o da Porta (iPhone: App Store)
    expect(screen.getByTestId("porta-sucesso").getAttribute("data-plataforma")).toBe("ios");
    expect(screen.getByTestId("porta-loja").getAttribute("href")).toContain("/baixar?origem=porta_demo");
    conferirCopy();
  });

  it("sem nada criado por ela: nada é gravado em user_data (só a conta)", async () => {
    contaNovaComSessao();
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-editar-exemplo");
    fireEvent.click(screen.getByTestId("demo-fim-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(upsert).not.toHaveBeenCalled();
    expect(lerUserData).not.toHaveBeenCalled();
  });

  it("lançou e apagou antes de criar a conta: não vai", async () => {
    contaNovaComSessao();
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");
    tocar("falso-apagar-gasto");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("conta que já existia (entrou com a senha): sem CompleteRegistration; a lista dela na conta só GANHA o item", async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: "User already registered" } });
    signInWithPassword.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: usuario({ created_at: "2026-01-01T00:00:00Z" }) } });
    lerUserData.mockResolvedValue({ data: [{ key: "finance-expenses", value: [{ id: "antigo", description: "Aluguel", value: 1200 }] }], error: null });
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === "CompleteRegistration")).toEqual([]);
    expect(updateUser.mock.calls[0][0].data.porta).toMatchObject({ variante: "demo" });
    const linhas = upsert.mock.calls[0][0] as Array<{ key: string; value: Array<{ description: string }> }>;
    expect(linhas[0].value.map((g) => g.description)).toEqual(["Aluguel", "Pizza"]);
  });

  it("erro ao ler a conta: não grava nada por cima (perde o item, nunca a conta)", async () => {
    contaNovaComSessao();
    lerUserData.mockResolvedValue({ data: null, error: { message: "rls" } });
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(upsert).not.toHaveBeenCalled();
    expect(eventos("demo_itens_conta")).toEqual([expect.objectContaining({ ok: false, erro: "ler" })]);
  });

  it("Google no Instagram: aviso, sem OAuth; o eventID e os itens vão na URL pro \"Abrir no navegador\"", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    tocar("falso-gasto");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    fireEvent.click(screen.getByTestId("porta-google"));
    expect(screen.getByTestId("porta-aviso-google").textContent).toContain("Instagram");
    expect(entrarComGoogle).not.toHaveBeenCalled();
    const q = new URLSearchParams(window.location.search);
    expect(q.get("passo")).toBe("conta");
    const pe = JSON.parse(q.get("pe") as string);
    expect(pe.eventId).toMatch(/^porta_cr_/);
    expect(pe.itens).toEqual(["gasto|Pizza|45"]);
    expect(q.get("ps")).toBeTruthy();
    expect(eventos("porta_google_bloqueado")[0]).toMatchObject({ app: "Instagram", variante: "demo" });

    // …e no Safari (storage novo) a conta abre com o mesmo eventID e o item dela
    const url = `${window.location.pathname}${window.location.search}`;
    cleanup();
    _zerarEstadoDemo();
    _zerarMemoriaPorta();
    localStorage.clear();
    sessionStorage.clear();
    ua(UA.safari);
    contaNovaComSessao();
    montar(url.split("?")[1]);
    await waitFor(() => expect(passo()).toBe("conta"));
    expect(screen.getByTestId("porta-conta-texto").textContent).toContain("vai junto");
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(signUp.mock.calls[0][0].options.data.porta.event_id).toBe(pe.eventId);
    expect((upsert.mock.calls[0][0] as Array<{ key: string }>).map((l) => l.key)).toEqual(["finance-expenses"]);
  });

  it("volta do Google fora do Instagram (/experimente?passo=voltou): conclui 1x com a mesma conta", async () => {
    ua(UA.safari);
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    fireEvent.click(screen.getByTestId("porta-google"));
    await waitFor(() => expect(entrarComGoogle).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem("core-auth-next")).toBe("/experimente?m=financas&passo=voltou");
    cleanup();
    _zerarEstadoDemo(); // página nova: o estado volta do localStorage
    const u = usuario();
    authState.user = u;
    getUser.mockResolvedValue({ data: { user: u } });
    montar("m=financas&passo=voltou");
    await waitFor(() => expect(passo()).toBe("sucesso"));
    expect(updateUser.mock.calls[0][0].data.porta).toMatchObject({ variante: "demo", metodo: "google" });
    expect(vi.mocked(fireMetaEvent).mock.calls.filter((c) => c[0] === "CompleteRegistration")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- 14/10 (dono): sem chamada no topo; nada sai do funil */
describe("só aparece o que a pessoa tocar; o que ela toca fica no funil", () => {
  it("\"Dicas para começar\" some SÓ no funil-demo (no /preview e no app, igual)", () => {
    const dica = <ModuleTip moduleId="rotina" tips={["Adicione seus hábitos"]} />;
    const { unmount } = render(<PreviewUserDataProvider moduleKey="rotina">{dica}</PreviewUserDataProvider>);
    expect(screen.getByText("Dicas para começar")).toBeInTheDocument();
    unmount();
    render(<DemoDoFunilProvider value={{ abrirConta: () => {} }}><PreviewUserDataProvider moduleKey="rotina">{dica}</PreviewUserDataProvider></DemoDoFunilProvider>);
    expect(screen.queryByText("Dicas para começar")).toBeNull();
  });

  it("Finanças: Retrospectiva e Desafio da semana fora do topo do Dashboard SÓ no funil-demo", () => {
    const index = readFileSync(join(process.cwd(), "src/pages/Index.tsx"), "utf8");
    expect(index).toContain("{!demoDoFunil && <WrappedBanner />}");
    expect(index).toMatch(/\{!demoDoFunil && \(\s*<TrackedCard cardKey="weekly-challenge"/);
    expect(index).toContain("const demoDoFunil = useDemoDoFunil();");
  });

  it("desvioNaDemo: módulo da demo troca aqui (com a aba); o resto do app vai pra conta; /experimente e fora do site seguem", () => {
    expect(desvioNaDemo("/rotina?aba=meu-mes")).toEqual({ tipo: "modulo", modulo: "rotina", aba: "meu-mes" });
    expect(desvioNaDemo("/financas")).toEqual({ tipo: "modulo", modulo: "financas", aba: null });
    for (const d of ["/auth", "/entrar", "/comecar?step=signup", "/home", "/casa", "/conquistas", "/retrospectiva?mes=Setembro", "/planos", "/lp"]) {
      expect(desvioNaDemo(d)).toMatchObject({ tipo: "conta" });
    }
    expect(desvioNaDemo("/experimente?m=rotina&passo=conta")).toBeNull();
    expect(desvioNaDemo("https://exemplo.com/x")).toBeNull();
  });

  it("o módulo navegando pra /auth (useNavigate), <Link to=/home> e <a href=/conquistas> → a conta do funil (origem modulo), sem sair", async () => {
    for (const testid of ["falso-ir-auth", "falso-link-home", "falso-a-conquistas"]) {
      cleanup();
      vi.mocked(trackEvent).mockClear();
      montar();
      await noModulo("financas", "falso-n-gastos");
      fireEvent.click(screen.getByTestId(testid));
      await waitFor(() => expect(passo()).toBe("conta"));
      expect(screen.queryByTestId("onde")).toBeNull();
      expect(eventos("demo_navegacao")[0]).toMatchObject({ acao: "conta", variante: "demo" });
      expect(eventos("demo_criar_conta_click")[0]).toMatchObject({ origem: "modulo" });
    }
  });

  it("o módulo navegando pra outro módulo da demo (/rotina?aba=…) troca o módulo AQUI, com a aba na URL", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-ir-rotina"));
    await noModulo("rotina", "falso-habitos");
    expect(local.search).toContain("m=rotina");
    expect(local.search).toContain("aba=meu-mes");
    expect(eventos("demo_navegacao")[0]).toMatchObject({ acao: "modulo", para: "rotina", aba: "meu-mes" });
    // a pílula volta sem a aba
    fireEvent.click(screen.getByTestId("demo-pilula-treino"));
    await noModulo("treino", "falso-exercicio");
    expect(local.search).not.toContain("aba=");
  });

  it("link pra fora do site não é desviado", async () => {
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("falso-a-fora"));
    expect(passo()).toBe("demo");
    expect(eventos("demo_navegacao")).toEqual([]);
  });

  it("sucesso no iPhone com a sessão já no useAuth: o código do \"abrir logado\" é pedido UMA vez", async () => {
    signUp.mockImplementation(async (args: { options: { data: { porta: unknown } } }) => {
      const u = usuario({ user_metadata: { porta: args.options.data.porta } });
      authState.user = u;
      getUser.mockResolvedValue({ data: { user: u } });
      return { data: { session: { access_token: "t" }, user: u }, error: null };
    });
    invoke.mockImplementation(async (_n: string, { body }: { body: { acao: string } }) => (body.acao === "criar" ? { data: { codigo: "ABCDEFGH23", email_enviado: true }, error: null } : { data: { ok: true }, error: null }));
    montar();
    await noModulo("financas", "falso-n-gastos");
    fireEvent.click(screen.getByTestId("demo-topo-criar"));
    await waitFor(() => expect(passo()).toBe("conta"));
    await criarComEmail();
    await waitFor(() => expect(passo()).toBe("sucesso"));
    await waitFor(() => expect(eventos("porta_codigo")[0]).toMatchObject({ ok: true }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(invoke.mock.calls.filter((c) => (c[1] as { body: { acao: string } }).body.acao === "criar")).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- copy */
describe("copy", () => {
  it("nenhum preço do produto nem \"sem cartão\" nos arquivos do funil; nada de área de transferência", () => {
    const dir = join(process.cwd(), "src/pages/experimente");
    for (const f of readdirSync(dir)) {
      const s = readFileSync(join(dir, f), "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
      expect(s, f).not.toMatch(/\d+,90|R\$\s?\d/);
      expect(s, f).not.toMatch(/sem cart[aã]o/i);
      expect(s, f).not.toMatch(/clipboard|writeText/);
    }
  });
});
