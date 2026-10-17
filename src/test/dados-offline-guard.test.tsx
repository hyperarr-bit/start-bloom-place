/**
 * DADO DA CONTA SEM REDE NA ABERTURA (16/10).
 *
 * Toda abertura do app varre o cache local da conta (purgeUserLocalCache) e
 * hidrata do servidor. Se essa leitura falhava (sem rede, rede piscando, servidor
 * engasgado) ou demorava, o app tratava o "vazio" como o dado da pessoa: uma
 * escrita feita em cima do vazio, que passasse quando a rede voltasse,
 * SOBRESCREVIA a chave inteira no servidor (user_data não tem versão). Os 5
 * primeiros casos de risco falhavam no código de antes (servidor ficava com
 * ['d'], com ['2026-10-16'], widgets [] e favoritos vazios).
 *
 * O "servidor" aqui é um Map por conta: o upsert grava nele, a leitura tira
 * retrato dele no momento do PEDIDO.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

type Linha = { user_id: string; key: string; value: unknown };
const servidores = new Map<string, Map<string, unknown>>();
const doServidor = (uid: string) => { let m = servidores.get(uid); if (!m) { m = new Map(); servidores.set(uid, m); } return m; };
const servidor = () => doServidor("u1");
const upserts: Linha[] = [];
let leituraTotal: "ok" | "erro" | "segurar" = "ok";
let leituraChave: "ok" | "erro" | "segurar" = "ok";
let gravacaoFalha = false;
let sessaoValida = true;
let soltarLeitura: (() => void) | null = null;
let soltarChave: (() => void) | null = null;
let leiturasTotais = 0;

const ERRO_REDE = { message: "TypeError: Load failed", details: "", hint: "", code: "" };

const auth: { user: { id: string } | null; loading: boolean } = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn }));
vi.mock("@/integrations/supabase/client", () => {
  const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const consulta = () => {
    let uid = "";
    let chave: string | null = null;
    const q: Record<string, (...a: unknown[]) => unknown> = {
      eq: (col: unknown, v: unknown) => { if (col === "user_id") uid = v as string; if (col === "key") chave = v as string; return q; },
      in: () => Promise.resolve({ data: [], error: null }),
      // leitura de TODAS as chaves (hidratação): retrato tirado na hora do pedido
      abortSignal: (sinal: unknown) => {
        leiturasTotais++;
        const foto = [...doServidor(uid).entries()].map(([key, value]) => ({ key, value: clonar(value) }));
        if (leituraTotal === "erro") return Promise.resolve({ data: null, error: ERRO_REDE });
        if (leituraTotal === "segurar") {
          return new Promise((ok) => {
            soltarLeitura = () => ok({ data: foto, error: null });
            (sinal as AbortSignal)?.addEventListener?.("abort", () => ok({ data: null, error: { message: "AbortError: aborted" } }));
          });
        }
        return Promise.resolve({ data: foto, error: null });
      },
      // leitura de UMA chave (fetchKey)
      maybeSingle: () => {
        const k = chave as string;
        const m = doServidor(uid);
        const resposta = () => ({ data: m.has(k) ? { value: clonar(m.get(k)) } : null, error: null });
        if (leituraChave === "erro") return Promise.resolve({ data: null, error: ERRO_REDE });
        if (leituraChave === "segurar") {
          const foto = resposta();
          return new Promise((ok) => { soltarChave = () => ok(foto); });
        }
        return Promise.resolve(resposta());
      },
    };
    return q;
  };
  return {
    supabase: {
      from: () => ({
        select: () => consulta(),
        upsert: (linha: Linha) => {
          if (gravacaoFalha) return Promise.resolve({ error: ERRO_REDE });
          upserts.push(clonar(linha));
          doServidor(linha.user_id).set(linha.key, clonar(linha.value));
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      auth: {
        getSession: () => Promise.resolve({
          data: { session: sessaoValida && auth.user ? { access_token: "t", expires_at: 4102444800, user: auth.user } : null },
          error: null,
        }),
      },
    },
  };
});

import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useHomeWidgets } from "@/hooks/use-home-widgets";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { CHAVE_DIAS_ANOTADOS } from "@/lib/sequencia";
import { trackEvent } from "@/lib/analytics";

type Gasto = { id: string; valor: number };
let api: UserDataContextType;
let gastos: Gasto[] = [];
let setGastos: (v: Gasto[] | ((p: Gasto[]) => Gasto[])) => void = () => {};
const Sonda = () => { api = useUserData(); return null; };
const Financas = () => {
  const [g, set] = usePersistedState<Gasto[]>("finance-expenses", []);
  gastos = g; setGastos = set;
  return null;
};
const arvore = () => <UserDataProvider><Sonda /><Financas /></UserDataProvider>;
const montar = () => render(arvore());
const esperar = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const ANTIGOS: Gasto[] = [{ id: "a", valor: 10 }, { id: "b", valor: 20 }, { id: "c", valor: 30 }];
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x: Gasto) => x.id) : v);
const voltaARede = async () => {
  leituraTotal = "ok";
  leituraChave = "ok";
  await act(async () => { window.dispatchEvent(new Event("online")); });
};

beforeEach(() => {
  servidores.clear();
  upserts.length = 0;
  leituraTotal = "ok";
  leituraChave = "ok";
  gravacaoFalha = false;
  sessaoValida = true;
  soltarLeitura = null;
  soltarChave = null;
  leiturasTotais = 0;
  auth.user = { id: "u1" };
  auth.loading = false;
  toastFn.mockClear();
  vi.mocked(trackEvent).mockClear();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("abertura sem rede não pode apagar dado do servidor", () => {
  it("controle (com rede): somar um gasto mantém os antigos e sobe na hora, como sempre", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(gastos)).toEqual(["a", "b", "c"]));
    expect(api.semConexao).toBeNull();
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]);
    expect(trackEvent).not.toHaveBeenCalledWith("dados_conta_atrasada", expect.anything());
  });

  it("leitura falha (sem rede) → gasto novo → rede volta: o servidor NÃO perde os antigos", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    leituraChave = "erro";
    montar();
    await esperar(100);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(600);
    const noServidor = ids(servidor().get("finance-expenses")) as string[];
    expect(noServidor).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("leitura falha → 1ª anotação do dia: a lista de dias anotados do servidor não vira só 'hoje'", async () => {
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-10-13", "2026-10-14", "2026-10-15"]);
    leituraTotal = "erro";
    leituraChave = "erro";
    montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }]));
    await esperar(600);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(expect.arrayContaining(["2026-10-13", "2026-10-14", "2026-10-15"]));
  });

  it("leitura demorada → gasto somado ANTES da resposta: o servidor fica com antigos + novo", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "segurar"; // retrato tirado no pedido, resposta só quando soltar
    montar();
    await esperar(50);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(400); // passa o debounce de 250 ms com a leitura ainda no ar
    expect(upserts).toHaveLength(0); // nada sobe antes de a conta chegar
    await act(async () => { soltarLeitura?.(); });
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]);
    expect(ids(gastos)).toEqual(["a", "b", "c", "d"]); // a tela fica com o juntado
  });

  it("leitura falha e a rede volta na hora: a Home sozinha (sem toque) não apaga widgets nem favoritos", async () => {
    const WIDGETS = [{ id: "habits", size: "small" }, { id: "agua", size: "large" }];
    const PREFS = { favorites: ["financas"], hidden: ["pet"], order: ["financas", "rotina"] };
    servidor().set("core-home-widgets-v2", WIDGETS);
    servidor().set("core-module-prefs", PREFS);
    leituraTotal = "erro";
    leituraChave = "erro";
    const Home = () => { useHomeWidgets(); useModulePreferences(); return null; };
    render(<UserDataProvider><Sonda /><Home /></UserDataProvider>);
    await esperar(50); // fecha o act: o React desenha o estado e roda os efeitos da Home
    await esperar(800);
    expect(servidor().get("core-home-widgets-v2")).toEqual(WIDGETS);
    expect(servidor().get("core-module-prefs")).toEqual(PREFS);
    // e quando a conta chega, a Home vê o que é dela (não o vazio)
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(api.get("core-home-widgets-v2", [])).toEqual(WIDGETS);
    expect(servidor().get("core-home-widgets-v2")).toEqual(WIDGETS);
    expect(servidor().get("core-module-prefs")).toEqual(PREFS);
  });

  it("leitura falha → busca da chave demora → escrita no meio: a guarda do fetchKey não pode deixar a escrita pequena vencer", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    leituraChave = "segurar";
    montar();
    await esperar(100);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await act(async () => { soltarChave?.(); });
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });
});

describe("o conserto: segurar, avisar, tentar de novo e juntar", () => {
  it("leitura falha: NÃO diz 'carregado' com o vazio — avisa sem conexão e nada sobe", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    expect(api.loaded).toBe(false);
    expect(api.semConexao).toBe("sem");
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    expect(ids(gastos)).toEqual(["d"]); // a pessoa vê o que fez…
    await esperar(600);
    expect(upserts).toHaveLength(0); // …mas nada sobe por cima do servidor
  });

  it("sem rede → escreve → a rede volta (evento online): junta, sobe o juntado e a tela mostra tudo", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    leituraChave = "erro";
    montar();
    await esperar(100);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(100);
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(api.semConexao).toBeNull();
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]);
    expect(ids(gastos)).toEqual(["a", "b", "c", "d"]);
    expect(trackEvent).toHaveBeenCalledWith("dados_conta_atrasada", expect.objectContaining({ falhas: 1, seguradas: 1, juntadas: 1, perdidas: 0 }));
    expect(toastFn).not.toHaveBeenCalled(); // juntou sem perder nada: nada a avisar
  });

  it("tenta de novo sozinho depois de uma falha (sem precisar de evento)", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    expect(api.loaded).toBe(false);
    const antes = leiturasTotais;
    leituraTotal = "ok";
    await esperar(2300); // 1ª espera é de 2 s
    expect(leiturasTotais).toBeGreaterThan(antes);
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(ids(gastos)).toEqual(["a", "b", "c"]);
  });

  it("botão 'Tentar de novo' do aviso relê a conta", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    leituraTotal = "ok";
    await act(async () => { api.tentarDeNovo?.(); });
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(ids(gastos)).toEqual(["a", "b", "c"]);
  });

  it("dias anotados: a 1ª anotação feita sem rede não grava a lista; com a conta, entra hoje SEM perder os dias", async () => {
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-10-13", "2026-10-14", "2026-10-15"]);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }]));
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(servidor().get("todo-list")).toEqual([{ id: "t1", texto: "pagar luz" }]); // não existia lá: sobe inteiro
    // a próxima anotação (já com a conta) entra no dia de hoje, por cima da lista certa
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }, { id: "t2", texto: "mercado" }]));
    await esperar(400);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  });

  it("conflito de valor (água de hoje: 3 no servidor, 1 feito sem rede): fica o do servidor e a pessoa é avisada", async () => {
    servidor().set("water-log", { "2026-10-15": 8, "2026-10-16": 3 });
    leituraTotal = "erro";
    montar();
    await esperar(100);
    act(() => api.set("water-log", { "2026-10-16": 1 }));
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(servidor().get("water-log")).toEqual({ "2026-10-15": 8, "2026-10-16": 3 });
    expect(api.get("water-log", {})).toEqual({ "2026-10-15": 8, "2026-10-16": 3 });
    expect(upserts.filter((u) => u.key === "water-log")).toHaveLength(0); // juntado = servidor: nada a subir
    expect(toastFn).toHaveBeenCalledWith("Seus dados voltaram", expect.objectContaining({ description: expect.any(String) }));
  });

  it("conflito numa escrita de SISTEMA ou de ajuste de tela não avisa ninguém", async () => {
    servidor().set("finance-perfil-ativo", "pj");
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    act(() => { api.set("finance-perfil-ativo", "pf"); api.set("finance-expenses", [], { system: true }); });
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(servidor().get("finance-perfil-ativo")).toBe("pj");
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c"]);
    expect(toastFn).not.toHaveBeenCalled(); // perfil é ajuste de tela; gastos foi escrita de sistema
  });

  it("leitura demorada: depois de 8 s o aviso diz 'conexão lenta'; a resposta chega e tudo segue", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "segurar";
    vi.useRealTimers(); // o beforeEach só falsifica o Date; aqui o relógio dos timers também
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(api.semConexao).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
    expect(api.semConexao).toBe("lenta");
    expect(api.loaded).toBe(false);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await act(async () => { soltarLeitura?.(); await vi.advanceTimersByTimeAsync(10); });
    expect(api.loaded).toBe(true);
    expect(api.semConexao).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]);
    expect(trackEvent).toHaveBeenCalledWith("dados_conta_atrasada", expect.objectContaining({ falhas: 0, seguradas: 1 }));
  });

  it("sessão do auth sumiu (token vencido sem rede): a leitura vazia da chave anônima NÃO vale como conta", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    sessaoValida = false;
    montar();
    await esperar(100);
    expect(api.loaded).toBe(false);
    expect(api.semConexao).toBe("sem");
    expect(leiturasTotais).toBe(0); // nem pediu: sem token, a RLS devolveria [] sem erro
    sessaoValida = true;
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(ids(gastos)).toEqual(["a", "b", "c"]);
  });

  it("troca de conta com escrita segurada: nada da conta A vai pra B (nem pra A)", async () => {
    doServidor("u1").set("finance-expenses", ANTIGOS);
    doServidor("u2").set("finance-expenses", [{ id: "x", valor: 1 }]);
    leituraTotal = "erro";
    const r = montar();
    await esperar(100);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    leituraTotal = "ok";
    auth.user = { id: "u2" };
    r.rerender(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(upserts).toHaveLength(0);
    expect(ids(doServidor("u1").get("finance-expenses"))).toEqual(["a", "b", "c"]);
    expect(ids(doServidor("u2").get("finance-expenses"))).toEqual(["x"]);
    expect(ids(api.get("finance-expenses", []))).toEqual(["x"]);
  });

  it("sair e entrar de novo: o que ficou segurado antes de sair é descartado; a conta volta inteira", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "erro";
    const r = montar();
    await esperar(100);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    auth.user = null; // saiu
    r.rerender(arvore());
    await esperar(100);
    expect(api.isGuest).toBe(true);
    expect(api.semConexao).toBeNull();
    leituraTotal = "ok";
    auth.user = { id: "u1" }; // entrou de novo
    r.rerender(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(upserts).toHaveLength(0);
    expect(ids(api.get("finance-expenses", []))).toEqual(["a", "b", "c"]);
  });

  it("chave pesada (≥50KB) sem rede: o item novo junta com o histórico grande", async () => {
    const grande = Array.from({ length: 700 }, (_, i) => ({ id: `r${i}`, texto: "x".repeat(80) }));
    expect(JSON.stringify(grande).length).toBeGreaterThan(50_000);
    servidor().set("diario-grande", grande);
    leituraTotal = "erro";
    leituraChave = "erro";
    let setDiario: (f: (p: { id: string }[]) => { id: string }[]) => void = () => {};
    const Diario = () => { const [, s] = usePersistedState<{ id: string }[]>("diario-grande", []); setDiario = s; return null; };
    render(<UserDataProvider><Sonda /><Diario /></UserDataProvider>);
    await esperar(100);
    act(() => setDiario((p) => [...p, { id: "novo" }]));
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    const v = servidor().get("diario-grande") as { id: string }[];
    expect(v).toHaveLength(701);
    expect(v[700].id).toBe("novo");
  });

  it("2ª rodada (volta pro app) com a leitura falhando: a chave pesada continua na memória", async () => {
    const grande = Array.from({ length: 700 }, (_, i) => ({ id: `r${i}`, texto: "x".repeat(80) }));
    servidor().set("pet-registro", grande);
    servidor().set("finance-expenses", ANTIGOS);
    const r = montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect((api.get("pet-registro", []) as unknown[]).length).toBe(700);
    leituraTotal = "erro";
    auth.user = { id: "u1" }; // o auth emite SIGNED_IN na volta pro app: objeto novo, mesma conta
    r.rerender(arvore());
    await esperar(200);
    expect(api.loaded).toBe(true); // já tinha a conta: segue com ela
    expect(api.semConexao).toBeNull();
    expect((api.get("pet-registro", []) as unknown[]).length).toBe(700); // antes: o cache trocava o store e a pesada sumia
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]); // conta já lida: escrita sobe normal
  });

  it("2ª rodada com retrato velho: escrita feita depois do pedido não é desfeita pelo retrato", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    const r = montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    leituraTotal = "segurar";
    auth.user = { id: "u1" };
    r.rerender(arvore());
    await esperar(50); // pedido da 2ª rodada no ar (retrato sem o 'd')
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    await esperar(400); // sobe o 'd' (conta já lida)
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d"]);
    await act(async () => { soltarLeitura?.(); });
    await esperar(100);
    expect(ids(api.get("finance-expenses", []))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("o aviso na tela (OfflineBanner)", () => {
  const contexto = (extra: Partial<UserDataContextType>): UserDataContextType => ({
    get: (_k, f) => f, set: () => {}, loaded: false, isGuest: false, fetchKey: async () => null, ...extra,
  });

  it("sem a conta: diz que os dados aparecem quando a internet voltar e o botão tenta de novo", async () => {
    const { OfflineBanner } = await import("@/components/OfflineBanner");
    const { UserDataContext } = await import("@/hooks/use-user-data");
    const { screen, fireEvent } = await import("@testing-library/react");
    const tentar = vi.fn();
    render(<UserDataContext.Provider value={contexto({ semConexao: "sem", tentarDeNovo: tentar })}><OfflineBanner /></UserDataContext.Provider>);
    expect(screen.getByRole("status").textContent).toContain("Sem conexão — seus dados aparecem quando a internet voltar.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("leitura demorando: 'conexão lenta', sem botão; com a conta em dia: nada", async () => {
    const { OfflineBanner } = await import("@/components/OfflineBanner");
    const { UserDataContext } = await import("@/hooks/use-user-data");
    const { screen } = await import("@testing-library/react");
    const r = render(<UserDataContext.Provider value={contexto({ semConexao: "lenta" })}><OfflineBanner /></UserDataContext.Provider>);
    expect(screen.getByRole("status").textContent).toContain("Conexão lenta — seus dados aparecem assim que carregarem.");
    expect(screen.queryByRole("button")).toBeNull();
    r.unmount();
    render(<UserDataContext.Provider value={contexto({ semConexao: null, loaded: true })}><OfflineBanner /></UserDataContext.Provider>);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
