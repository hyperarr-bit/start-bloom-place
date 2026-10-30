/**
 * OCULTAR ABAS (1.0.22, dono 28/10 — "completo mas confuso"; chamados pedindo pra ocultar as abas que não usam).
 *
 * Trava: (1) a regra pura (ordem, padrão enxuto, mínimo 1); (2) a fileira + folha "Organizar abas": ocultar, religar,
 * a última nunca some, a aba aberta oculta cai na primeira visível, link profundo abre a aba oculta, ↑↓ grava a ordem,
 * eventos; (3) só as chaves NOVAS/da fileira são gravadas — nenhuma chave antiga muda; (4) o padrão enxuto só pra conta
 * NOVA com a chave ligada, sem gravar nada até a pessoa mexer; (5) o tutorial aberto mostra todas; (6) FECHAR E REABRIR
 * o app (provider de verdade, servidor em memória): o que foi oculto continua oculto, o que voltou continua lá, e
 * gravar `abas-ocultas:financas` não vira "first_transaction".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const ativacoes = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: vi.fn(),
  markActivation: (a: string) => { ativacoes.push(a); return Promise.resolve(); },
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useAbasOcultas, type AbaOcultavel } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import {
  CHAVE_FORCA_ABAS_ENXUTAS, _zerarTodasAsAbas, lerListaDeIds, moverNaOrdem, ocultasEfetivas, ordenarAbas, padraoEnxuto,
  segurarTodasAsAbas,
} from "@/lib/abas-ocultas";
import { ABAS_ENXUTAS, ABAS_POUCO_USO, ABAS_QUE_NUNCA_SAEM } from "@/lib/abas-enxutas";
import { CHAVE_ORIGEM_CONTA, _zerarHomeNova } from "@/lib/home-nova";

/* As abas de Finanças, como em pages/Index (sem o KIT). */
const FIN: AbaOcultavel[] = [
  { id: "dashboard", label: "DASHBOARD", icon: "📊" },
  { id: "financeiro", label: "MEU FINANCEIRO", icon: "💰", spotlight: "financeiro" },
  { id: "investimentos", label: "INVESTIMENTOS", icon: "📈" },
  { id: "itens", label: "DESEJOS", icon: "❤️" },
  { id: "viagem", label: "VIAGEM", icon: "✈️" },
  { id: "simuladores", label: "SIMULADORES", icon: "🧮" },
  { id: "limites", label: "LIMITES", icon: "🎯" },
  { id: "relatorios", label: "RELATÓRIOS", icon: "📋" },
  { id: "saude", label: "SAÚDE FINANCEIRA", icon: "💚" },
];
const IDS_FIN = FIN.map((a) => a.id);

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const escritas: string[] = [];
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { escritas.push(key); dados[key] = JSON.parse(JSON.stringify(value)); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  return { dados, valor, escritas };
};
const Com = ({ store, children }: { store: ReturnType<typeof criarStore>; children: ReactNode }) => (
  <UserDataContext.Provider value={store.valor}>{children}</UserDataContext.Provider>
);
const Pagina = ({ inicial = "financeiro", modulo = "financas" }: { inicial?: string; modulo?: string }) => {
  const [ativa, setAtiva] = useState(inicial);
  const abas = useAbasOcultas(modulo, FIN);
  return (
    <div>
      <AbasOcultaveis abas={abas} ativa={ativa} onTrocar={setAtiva} />
      <p data-testid="ativa">{ativa}</p>
      <button type="button" onClick={() => setAtiva("viagem")}>atalho viagem</button>
    </div>
  );
};
const naFileira = () => Array.from(document.querySelectorAll<HTMLElement>("[data-spotlight]")).map((b) => b.getAttribute("data-spotlight"));
const abrirFolha = () => fireEvent.click(screen.getByTestId("abas-organizar"));
const linha = (id: string) => document.querySelector<HTMLElement>(`[data-testid="abas-organizar-linha"][data-aba="${id}"]`)!;
const interruptor = (id: string) => linha(id).querySelector<HTMLElement>('[role="switch"]')!;

beforeEach(() => {
  eventos.length = 0; ativacoes.length = 0;
  localStorage.clear();
  _zerarTodasAsAbas(); _zerarHomeNova();
});
afterEach(() => cleanup());

/* ------------------------------------------------------------------ 1. a regra pura */
describe("regra pura", () => {
  it("lerListaDeIds: ausente = null (pode valer o padrão); lixo = [] (mostra tudo)", () => {
    expect(lerListaDeIds(undefined)).toBeNull();
    expect(lerListaDeIds(null)).toBeNull();
    expect(lerListaDeIds("lixo")).toEqual([]);
    expect(lerListaDeIds(["a", 3, "b"])).toEqual(["a", "b"]);
  });

  it("ordem gravada: ids sumidos saem; aba nova entra logo depois da vizinha de antes", () => {
    const abas = [{ id: "a" }, { id: "kit" }, { id: "b" }, { id: "c" }];
    expect(ordenarAbas(abas, null).map((x) => x.id)).toEqual(["a", "kit", "b", "c"]);
    expect(ordenarAbas(abas, ["c", "b", "a", "velha"]).map((x) => x.id)).toEqual(["c", "b", "a", "kit"]);
    expect(moverNaOrdem(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moverNaOrdem(["a", "b", "c"], "a", -1)).toBeNull();
  });

  it("nunca esconde todas: sobra a 1ª", () => {
    expect(ocultasEfetivas({ ids: ["a", "b"], gravada: ["a", "b"], enxuta: false, moduloId: "x" })).toEqual(["b"]);
    expect(ocultasEfetivas({ ids: ["a", "b"], gravada: ["b", "zzz"], enxuta: false, moduloId: "x" })).toEqual(["b"]);
  });

  it("padrão enxuto: chave LIGADA no código (dono 28/10); nenhuma lista esconde a aba de entrada ou alvo de missão", () => {
    expect(ABAS_ENXUTAS).toBe(true);
    for (const [m, lista] of Object.entries(ABAS_POUCO_USO)) {
      for (const id of lista) expect(ABAS_QUE_NUNCA_SAEM[m] ?? [], `${m}/${id}`).not.toContain(id);
    }
    // 28/10 (sem repetição): a aba Viagem saiu de Finanças (vive em Viagens › Budget) — some do padrão enxuto
    expect(padraoEnxuto("financas", IDS_FIN)).toEqual(["investimentos", "itens", "simuladores", "limites", "relatorios", "saude"]);
    // todo id da lista existe na página do módulo (aba renomeada não pode virar lista morta sem ninguém ver)
    const PAGINA: Record<string, string> = { financas: "Index", rotina: "Rotina", saude: "Saude", treino: "Treino", dieta: "Dieta", beleza: "Beleza", casa: "Casa",
      biblioteca: "Biblioteca", desenvolvimento: "DesenvolvimentoPessoal", estudos: "Estudos", relacionamentos: "Relacionamentos", detox: "Detox",
      hiperfoco: "Hiperfoco", carreira: "Carreira", pet: "Pet", viagens: "Viagens" };
    for (const [m, lista] of Object.entries(ABAS_POUCO_USO)) {
      const fonte = readFileSync(resolve(__dirname, `../pages/${PAGINA[m]}.tsx`), "utf8");
      for (const id of lista) expect(new RegExp(`(id|v): "${id}"`).test(fonte), `${m}/${id}`).toBe(true);
    }
    // gravado (mesmo vazio) vence o padrão
    expect(ocultasEfetivas({ ids: IDS_FIN, gravada: [], enxuta: true, moduloId: "financas" })).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 2/3. fileira + folha */
describe("fileira e folha 'Organizar abas'", () => {
  it("ocultar 5 pela folha → somem da fileira, grava SÓ abas-ocultas:financas, eventos; religar traz de volta", () => {
    const store = criarStore({ "finance-expenses": [{ id: 1 }], "abas-ocultas:rotina": ["mes"] });
    render(<Com store={store}><Pagina /></Com>);
    expect(screen.getByTestId("abas-organizar")).toHaveAccessibleName("Organizar abas");
    abrirFolha();
    expect(eventos).toContainEqual(["abas_organizar_aberto", { modulo: "financas", ocultas: 0 }]);
    expect(screen.getByRole("dialog", { name: "Organizar abas" })).toBeInTheDocument();
    for (const id of ["investimentos", "viagem", "simuladores", "limites", "saude"]) fireEvent.click(interruptor(id));
    expect(store.dados["abas-ocultas:financas"]).toEqual(["investimentos", "viagem", "simuladores", "limites", "saude"]);
    expect(eventos.filter(([n]) => n === "aba_ocultada")).toHaveLength(5);
    expect(eventos).toContainEqual(["aba_ocultada", { modulo: "financas", aba: "viagem" }]);
    fireEvent.click(screen.getByTestId("abas-organizar-pronto"));
    expect(naFileira()).toEqual(["tab-dashboard", "financeiro", "tab-itens", "tab-relatorios"]);
    expect(screen.getByTestId("abas-organizar")).toHaveTextContent("+5 ocultas");
    // religar
    abrirFolha();
    fireEvent.click(interruptor("viagem"));
    expect(store.dados["abas-ocultas:financas"]).toEqual(["investimentos", "simuladores", "limites", "saude"]);
    expect(eventos).toContainEqual(["aba_mostrada", { modulo: "financas", aba: "viagem" }]);
    fireEvent.click(screen.getByTestId("abas-organizar-mostrar-todas"));
    expect(store.dados["abas-ocultas:financas"]).toEqual([]);
    expect(eventos).toContainEqual(["abas_mostrar_todas", { modulo: "financas", ocultas: 4 }]);
    // nenhuma chave antiga foi tocada
    expect(new Set(store.escritas)).toEqual(new Set(["abas-ocultas:financas"]));
    expect(store.dados["finance-expenses"]).toEqual([{ id: 1 }]);
    expect(store.dados["abas-ocultas:rotina"]).toEqual(["mes"]);
  });

  it("a última visível vem travada; o hook recusa", () => {
    const store = criarStore({ "abas-ocultas:financas": IDS_FIN.filter((x) => x !== "financeiro") });
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).toEqual(["financeiro"]);
    abrirFolha();
    expect(interruptor("financeiro")).toBeDisabled();
    expect(screen.getByText(/Pelo menos uma aba fica sempre à vista/)).toBeInTheDocument();
  });

  it("ocultar a aba ABERTA cai na primeira visível", () => {
    const store = criarStore();
    render(<Com store={store}><Pagina inicial="financeiro" /></Com>);
    abrirFolha();
    fireEvent.click(interruptor("financeiro"));
    expect(screen.getByTestId("ativa")).toHaveTextContent("dashboard");
    // pelo × (segurar) também
    fireEvent.click(screen.getByTestId("abas-organizar-pronto"));
    fireEvent.contextMenu(document.querySelector('[data-spotlight="tab-dashboard"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar aba 📊 DASHBOARD" }));
    expect(screen.getByTestId("ativa")).toHaveTextContent("investimentos");
    expect(store.dados["abas-ocultas:financas"]).toEqual(["financeiro", "dashboard"]);
  });

  it("LINK PROFUNDO pra aba oculta abre mesmo assim (tracejada na fileira) e some da fileira ao sair dela", () => {
    const store = criarStore({ "abas-ocultas:financas": ["viagem", "limites"] });
    render(<Com store={store}><Pagina inicial="limites" /></Com>);
    expect(screen.getByTestId("ativa")).toHaveTextContent("limites");
    const aba = document.querySelector('[data-spotlight="tab-limites"]')!;
    expect(aba).toHaveAttribute("data-oculta", "1");
    expect(aba).toHaveAttribute("data-active", "true");
    expect(naFileira()).not.toContain("tab-viagem");
    // um atalho (o "+" da Home, um lembrete) com o módulo já aberto
    fireEvent.click(screen.getByRole("button", { name: "atalho viagem" }));
    expect(screen.getByTestId("ativa")).toHaveTextContent("viagem");
    expect(naFileira()).toContain("tab-viagem");
    expect(naFileira()).not.toContain("tab-limites");
    expect(store.escritas).toEqual([]); // abrir aba oculta não religa nada
  });

  it("↑↓ grava a ordem em abas-ordem:<modulo> e a fileira segue", () => {
    const store = criarStore();
    render(<Com store={store}><Pagina /></Com>);
    abrirFolha();
    fireEvent.click(screen.getByRole("button", { name: "Mover MEU FINANCEIRO pra cima" }));
    expect(store.dados["abas-ordem:financas"]).toEqual(["financeiro", "dashboard", ...IDS_FIN.slice(2)]);
    expect(naFileira().slice(0, 2)).toEqual(["financeiro", "tab-dashboard"]);
    expect(eventos).toContainEqual(["aba_movida", { modulo: "financas", aba: "financeiro", para: 0 }]);
  });

  it("tutorial aberto (holofote) mostra todas; ao fechar, voltam a ficar ocultas", () => {
    const store = criarStore({ "abas-ocultas:financas": ["investimentos", "itens"] });
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).not.toContain("tab-investimentos");
    let soltar = () => {};
    act(() => { soltar = segurarTodasAsAbas(); });
    expect(naFileira()).toContain("tab-investimentos");
    expect(naFileira()).toContain("tab-itens");
    act(() => soltar());
    expect(naFileira()).not.toContain("tab-investimentos");
    expect(store.escritas).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 4. padrão enxuto da conta nova */
describe("padrão enxuto (ABAS_ENXUTAS) — só conta nova", () => {
  it("conta NOVA + chave ligada: começa enxuta sem gravar nada; 'Mostrar todas as abas' grava [] e dispara o evento", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_ENXUTAS, "on");
    const store = criarStore({ [CHAVE_ORIGEM_CONTA]: { tipo: "nova", em: "2026-10-28T10:00:00Z", versao: "1.0.19", regra: "x" } });
    render(<Com store={store}><Pagina /></Com>);
    // "viagem" (só no fixture): saiu de Finanças em 28/10 e do padrão enxuto — id fora da lista continua visível
    expect(naFileira()).toEqual(["tab-dashboard", "financeiro", "tab-viagem"]);
    expect(store.escritas).toEqual([]);
    fireEvent.click(screen.getByTestId("abas-mostrar-todas"));
    expect(store.dados["abas-ocultas:financas"]).toEqual([]);
    expect(eventos).toContainEqual(["abas_mostrar_todas", { modulo: "financas", ocultas: 6 }]);
    expect(naFileira()).toHaveLength(IDS_FIN.length);
    expect(screen.queryByTestId("abas-mostrar-todas")).not.toBeInTheDocument();
  });

  it("conta ANTIGA com a chave ligada: nada muda", () => {
    localStorage.setItem(CHAVE_FORCA_ABAS_ENXUTAS, "on");
    const store = criarStore({ [CHAVE_ORIGEM_CONTA]: { tipo: "antiga" } });
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).toHaveLength(IDS_FIN.length);
    expect(screen.queryByTestId("abas-mostrar-todas")).not.toBeInTheDocument();
  });

  it("conta nova SEM força (a chave ligada no código) já começa enxuta; ?abas-enxutas=off neste aparelho desliga (QA)", () => {
    const store = criarStore({ [CHAVE_ORIGEM_CONTA]: { tipo: "nova" } });
    render(<Com store={store}><Pagina /></Com>);
    // "viagem" (só no fixture): saiu de Finanças em 28/10 e do padrão enxuto — id fora da lista continua visível
    expect(naFileira()).toEqual(["tab-dashboard", "financeiro", "tab-viagem"]);
    expect(screen.getByTestId("abas-mostrar-todas")).toHaveTextContent("Ver todas");
    cleanup();
    localStorage.setItem(CHAVE_FORCA_ABAS_ENXUTAS, "off");
    render(<Com store={store}><Pagina /></Com>);
    expect(naFileira()).toHaveLength(IDS_FIN.length);
  });

  it("DEMO de venda (/preview, iframe /organizar/demo): sem a porta e sem o 'Ver todas' — a fileira de antes", () => {
    const store = criarStore({ "abas-ocultas:financas": ["viagem"] });
    for (const rota of ["/preview/financas", "/organizar/demo"]) {
      window.history.pushState({}, "", rota);
      render(<Com store={store}><Pagina /></Com>);
      expect(screen.queryByTestId("abas-organizar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("abas-mostrar-todas")).not.toBeInTheDocument();
      expect(naFileira()).toContain("tab-dashboard");
      cleanup();
    }
    window.history.pushState({}, "", "/financas");
    render(<Com store={store}><Pagina /></Com>);
    expect(screen.getByTestId("abas-organizar")).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});

/* ------------------------------------------------------------------ 6. FECHAR E REABRIR o app (provider de verdade) */
describe("fechar e reabrir o app", () => {
  it("oculta → fecha → reabre (cache do aparelho varrido, volta do servidor): continua oculta; religa → reabre: continua à vista", async () => {
    vi.resetModules();
    const servidor = new Map<string, unknown>();
    const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
    vi.doMock("@/hooks/use-auth", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-auth")>()), useAuth: () => auth }));
    vi.doMock("@/integrations/supabase/client", () => {
      const linhas = () => Promise.resolve({ data: [...servidor.entries()].map(([key, value]) => ({ key, value })), error: null });
      const selecao: Record<string, unknown> = {};
      Object.assign(selecao, {
        eq: () => selecao, order: () => selecao, range: () => selecao, in: () => Promise.resolve({ data: [], error: null }),
        abortSignal: linhas, then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => linhas().then(ok, erro),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      });
      return {
        supabase: {
          from: () => ({
            select: () => selecao,
            upsert: (row: { key: string; value: unknown } | Array<{ key: string; value: unknown }>) => {
              for (const r of Array.isArray(row) ? row : [row]) servidor.set(r.key, JSON.parse(JSON.stringify(r.value)));
              return Promise.resolve({ error: null });
            },
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }),
          auth: { getSession: async () => ({ data: { session: { access_token: "t", user: auth.user } } }), getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
          functions: { invoke: async () => ({ data: null, error: null }) },
          rpc: async () => ({ data: null, error: null }),
        },
      };
    });
    const { UserDataProvider, useUserData } = await import("@/hooks/use-user-data");
    const { useAbasOcultas: useAbas } = await import("@/hooks/use-abas-ocultas");
    const { AbasOcultaveis: Fileira } = await import("@/components/ui/abas-ocultaveis");

    const PaginaReal = () => {
      const { loaded } = useUserData();
      const [ativa, setAtiva] = useState("financeiro");
      const abas = useAbas("financas", FIN);
      return <div data-carregou={loaded ? "1" : "0"}><Fileira abas={abas} ativa={ativa} onTrocar={setAtiva} /></div>;
    };
    const abrirOApp = async () => {
      render(<UserDataProvider><PaginaReal /></UserDataProvider>);
      await waitFor(() => expect(document.querySelector('[data-carregou="1"]')).not.toBeNull());
    };
    const fecharOApp = () => { cleanup(); localStorage.clear(); /* o pior caso: nada no aparelho, tudo volta do servidor */ };

    await abrirOApp();
    fireEvent.click(screen.getByTestId("abas-organizar"));
    for (const id of ["investimentos", "simuladores"]) fireEvent.click(interruptor(id));
    await waitFor(() => expect(servidor.get("abas-ocultas:financas")).toEqual(["investimentos", "simuladores"]), { timeout: 3000 });
    fecharOApp();

    await abrirOApp();
    await waitFor(() => expect(naFileira()).not.toContain("tab-investimentos"));
    expect(naFileira()).not.toContain("tab-simuladores");
    expect(naFileira()).toContain("tab-itens");
    fireEvent.click(screen.getByTestId("abas-organizar"));
    fireEvent.click(interruptor("investimentos"));
    await waitFor(() => expect(servidor.get("abas-ocultas:financas")).toEqual(["simuladores"]), { timeout: 3000 });
    fecharOApp();

    await abrirOApp();
    await waitFor(() => expect(naFileira()).toContain("tab-investimentos"));
    expect(naFileira()).not.toContain("tab-simuladores");
    // só a chave da fileira foi pro servidor; e ela não virou "first_transaction" (o /financ/ das regras de ativação)
    expect([...servidor.keys()]).toEqual(["abas-ocultas:financas"]);
    expect(ativacoes).toEqual([]);
    vi.doUnmock("@/hooks/use-auth");
    vi.doUnmock("@/integrations/supabase/client");
  });
});
