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
let leituraTotal: "ok" | "erro" | "segurar" | "pendurar" = "ok";
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
        if (leituraTotal === "pendurar") return new Promise(() => {}); // rede morta: nunca responde, nem ao cancelar
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
import { mesclarPerfilDueDays } from "@/lib/finance-perfil";
import { EVENTO_TELAS_DA_CHAVE } from "@/hooks/use-user-data";
import { EVENTO_MESMA_CHAVE } from "@/hooks/use-persisted-state";
import { vassouraLeva } from "@/lib/chaves-do-aparelho";

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
// o aviso da junção (o da sequência sai 2,4 s depois e pode cair no teste seguinte — não conta)
const avisosDeJuncao = () => toastFn.mock.calls.filter((c) => c[0] === "Seus dados chegaram");
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
    expect(avisosDeJuncao()).toHaveLength(0); // juntou sem perder nada: nada a avisar
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

  it("dias anotados: a anotação feita sem rede NÃO grava a lista em cima do vazio; na junção, hoje entra SEM perder os dias", async () => {
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-10-13", "2026-10-14", "2026-10-15"]);
    leituraTotal = "erro";
    montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }]));
    await esperar(400);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]); // nada subiu sem a conta
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    // revisão 17/10: o registro feito antes da conta chegar conta o dia (antes só a próxima anotação contava)
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(servidor().get("todo-list")).toEqual([{ id: "t1", texto: "pagar luz" }]); // não existia lá: sobe inteiro
    // a próxima anotação do dia não regrava a lista
    const gravacoes = upserts.filter((u) => u.key === CHAVE_DIAS_ANOTADOS).length;
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }, { id: "t2", texto: "mercado" }]));
    await esperar(400);
    expect(upserts.filter((u) => u.key === CHAVE_DIAS_ANOTADOS)).toHaveLength(gravacoes);
  });

  it("dias anotados: anotou ONTEM sem rede, fechou o app e só voltou hoje — o dia de ontem entra (janela de 2 dias)", async () => {
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-10-13", "2026-10-14"]);
    vi.setSystemTime(new Date(2026, 9, 15, 22, 0)); // 15/10 à noite
    leituraTotal = "erro";
    const r = montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }]));
    r.unmount(); // o app morreu sem a conta chegar
    vi.setSystemTime(new Date(2026, 9, 16, 9, 0)); // reabre no dia seguinte, com rede
    leituraTotal = "ok";
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(servidor().get("todo-list")).toEqual([{ id: "t1", texto: "pagar luz" }]);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
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
    expect(toastFn).toHaveBeenCalledWith("Seus dados chegaram", expect.objectContaining({ description: expect.stringContaining("enquanto eles carregavam") }));
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
    expect(avisosDeJuncao()).toHaveLength(0); // perfil é ajuste de tela; gastos foi escrita de sistema
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

/* ------------------------------------------------------------------------- *
 * Revisão 17/10 — os casos do revisor viram teste de verdade
 * ------------------------------------------------------------------------- */
const guardadasNoAparelho = (uid = "u1") => Object.keys(localStorage).filter((k) => k.startsWith(`core-seguradas-${uid}:`));

describe("revisão 17/10: contas do mês (finance-dueDays) gravadas antes de a conta chegar", () => {
  const DUE_PADRAO = [
    { day: 5, color: "yellow", bills: [] as { id: string; name: string; paid: boolean }[] },
    { day: 10, color: "slate", bills: [] as { id: string; name: string; paid: boolean }[] },
    { day: 20, color: "indigo", bills: [] as { id: string; name: string; paid: boolean }[] },
    { day: 30, color: "emerald", bills: [] as { id: string; name: string; paid: boolean }[] },
  ];
  type Dia = (typeof DUE_PADRAO)[number];
  let due: Dia[] = [];
  let setDue: (v: Dia[] | ((p: Dia[]) => Dia[])) => void = () => {};
  const Contas = () => { const [d, sd] = usePersistedState<Dia[]>("finance-dueDays", DUE_PADRAO); due = d; setDue = sd; return null; };

  it("conta no Dia 5 sem rede → rede volta: UM Dia 5 com as contas do servidor + a nova; a conta seguinte entra UMA vez", async () => {
    servidor().set("finance-dueDays", [
      { day: 5, color: "yellow", bills: [{ id: "s1", name: "Aluguel", paid: true }, { id: "s2", name: "Internet", paid: false }] },
      { day: 10, color: "slate", bills: [{ id: "s3", name: "Cartão", paid: false }] },
      { day: 20, color: "indigo", bills: [] }, { day: 30, color: "emerald", bills: [] },
    ]);
    leituraTotal = "erro";
    render(<UserDataProvider><Sonda /><Contas /></UserDataProvider>);
    await esperar(100);
    // o que o MonthCalendar.setBillsForDay faz: mapeia pelo dia
    act(() => setDue((p) => p.map((d) => (d.day === 5 ? { ...d, bills: [...d.bills, { id: "n1", name: "Luz", paid: false }] } : d))));
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    const noServidor = servidor().get("finance-dueDays") as Dia[];
    expect(noServidor.filter((d) => d.day === 5)).toHaveLength(1);
    expect(noServidor.find((d) => d.day === 5)!.bills.map((b) => b.id)).toEqual(["s1", "s2", "n1"]);
    expect(due.filter((d) => d.day === 5)).toHaveLength(1); // a tela também
    // a PRÓXIMA conta no Dia 5 (já com a conta lida), pelo caminho do calendário + perfil Pessoal
    const proxima = due.map((d) => (d.day === 5 ? { ...d, bills: [...d.bills, { id: "x", name: "Academia", paid: false }] } : d));
    act(() => setDue(mesclarPerfilDueDays(due, proxima, "pessoal")));
    await esperar(400);
    const depois = servidor().get("finance-dueDays") as Dia[];
    expect(depois.flatMap((d) => d.bills).filter((b) => b.id === "x")).toHaveLength(1);
    expect(depois.filter((d) => d.day === 5)).toHaveLength(1);
  });
});

describe("revisão 17/10: anotou e FECHOU o app antes de a conta chegar", () => {
  it("leitura lenta, tarefa nova, app vai pro fundo e morre: ao reabrir o registro existe e sobe junto com o do servidor", async () => {
    servidor().set("todo-list", [{ id: "a", text: "antiga" }]);
    leituraTotal = "segurar";
    let setTodos: (v: { id: string; text: string }[] | ((p: { id: string; text: string }[]) => { id: string; text: string }[])) => void = () => {};
    const Tarefas = () => { const [, st] = usePersistedState<{ id: string; text: string }[]>("todo-list", []); setTodos = st; return null; };
    const r = render(<UserDataProvider><Sonda /><Tarefas /></UserDataProvider>);
    await esperar(50);
    act(() => setTodos((p) => [...p, { id: "n", text: "nova" }]));
    await esperar(400);
    // vai pro fundo: o provider força o envio — a segurada não pode subir (a conta não chegou)
    const vis = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    try {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("pagehide"));
      });
      await esperar(300);
      expect(upserts).toHaveLength(0);
      expect(guardadasNoAparelho()).toEqual(["core-seguradas-u1:todo-list"]); // guardada no aparelho
      expect(vassouraLeva("core-seguradas-u1:todo-list")).toBe(false); // a vassoura da abertura não leva
      r.unmount(); // o iOS mata o processo
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
      if (vis) Object.defineProperty(Document.prototype, "visibilityState", vis);
    }
    // reabre: novo provider (a vassoura da abertura limpa o u:*), leitura ok
    leituraTotal = "ok";
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(api.get<{ id: string }[]>("todo-list", []).map((t) => t.id)).toEqual(["a", "n"]);
    await esperar(400);
    expect((servidor().get("todo-list") as { id: string }[]).map((t) => t.id)).toEqual(["a", "n"]);
    expect(guardadasNoAparelho()).toEqual([]); // o servidor confirmou: a cópia do aparelho sai
  });

  it("a junção não subiu (rede caiu de novo): a cópia do aparelho FICA pra próxima abertura", async () => {
    servidor().set("todo-list", [{ id: "a", text: "antiga" }]);
    leituraTotal = "erro";
    const r = montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "n", text: "nova" }]));
    gravacaoFalha = true; // lê, mas a gravação falha (3 tentativas)
    await voltaARede();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(2200);
    expect(guardadasNoAparelho()).toEqual(["core-seguradas-u1:todo-list"]);
    r.unmount();
    gravacaoFalha = false;
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect((servidor().get("todo-list") as { id: string }[]).map((t) => t.id)).toEqual(["a", "n"]);
    expect(guardadasNoAparelho()).toEqual([]);
  });

  it("toque no intervalo da liberação + envio falhando + app morre: a próxima abertura junta tudo (a cópia guarda a base ORIGINAL)", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "segurar";
    const r = montar();
    await esperar(50);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }]));
    gravacaoFalha = true; // a conta chega, mas nenhuma gravação passa
    await act(async () => {
      soltarLeitura?.();
      for (let i = 0; i < 20; i++) await Promise.resolve();
      setGastos((p) => [...p, { id: "e", valor: 7 }]); // a tela ainda via só o 'd'
    });
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(2200); // as 3 tentativas falham
    const copia = JSON.parse(localStorage.getItem("core-seguradas-u1:finance-expenses") ?? "null");
    expect(copia?.base).toEqual([]); // base relativa ao servidor de verdade (que não tem o juntado)
    r.unmount(); // morreu antes de conseguir gravar
    gravacaoFalha = false;
    leituraTotal = "ok";
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d", "e"]);
    expect(guardadasNoAparelho()).toEqual([]);
  });

  it("sair da conta apaga o que ela tinha guardado; outra conta entrando apaga o de quem não é ela", async () => {
    leituraTotal = "erro";
    const r = montar();
    await esperar(100);
    act(() => api.set("todo-list", [{ id: "n", text: "nova" }]));
    expect(guardadasNoAparelho("u1")).toHaveLength(1);
    auth.user = null; // saiu
    r.rerender(arvore());
    await esperar(50);
    expect(guardadasNoAparelho("u1")).toHaveLength(0);
    // sobra de uma conta antiga no aparelho (ex.: sessão trocada por link, sem sair)
    localStorage.setItem("core-seguradas-u9:todo-list", JSON.stringify({ base: [], valor: [{ id: "z" }], sistema: false, dia: "2026-10-16" }));
    leituraTotal = "ok";
    auth.user = { id: "u1" };
    r.rerender(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(guardadasNoAparelho("u9")).toHaveLength(0);
    expect(upserts.filter((u) => u.user_id === "u9")).toHaveLength(0);
  });
});

describe("revisão 17/10: leitura que nunca responde (rede pendurada)", () => {
  it("passa do limite (15 s) → vira falha, aparece o 'tentar de novo' e a próxima tentativa carrega", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "pendurar";
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(api.semConexao).toBe("lenta");
    await act(async () => { await vi.advanceTimersByTimeAsync(6_500); }); // 15 s: estourou
    expect(api.semConexao).toBe("sem");
    expect(api.loaded).toBe(false);
    leituraTotal = "ok";
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); }); // 1ª espera: 2 s
    expect(api.loaded).toBe(true);
    expect(api.semConexao).toBeNull();
  });

  it("evento online / volta pro app / botão com a 1ª leitura pendurada há mais de 8 s: começa outra na hora", async () => {
    leituraTotal = "pendurar";
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000); });
    expect(api.semConexao).toBe("lenta");
    const antes = leiturasTotais;
    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(leiturasTotais).toBeGreaterThan(antes);
    expect(api.loaded).toBe(true);
  });

  it("leitura no ar há pouco (< 8 s): a volta pro app NÃO corta (o que está chegando continua)", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "segurar";
    montar();
    await esperar(50);
    const antes = leiturasTotais;
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
    await esperar(50);
    expect(leiturasTotais).toBe(antes);
    await act(async () => { soltarLeitura?.(); });
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(ids(gastos)).toEqual(["a", "b", "c"]);
  });
});

describe("revisão 17/10: liberar a escrita só depois que as telas têm o valor juntado", () => {
  it("toque no intervalo entre a junção e as telas atualizarem: não grava o valor velho da tela por cima do juntado", async () => {
    servidor().set("finance-expenses", ANTIGOS);
    leituraTotal = "segurar";
    montar();
    await esperar(50);
    act(() => setGastos((p) => [...p, { id: "d", valor: 5 }])); // segurada (a conta não chegou)
    await act(async () => {
      soltarLeitura?.();
      for (let i = 0; i < 20; i++) await Promise.resolve(); // a junção rodou, o React ainda não redesenhou
      expect(localStorage.getItem("u:u1:finance-expenses")).toContain('"a"'); // juntado já no cache
      expect(ids(gastos)).toEqual(["d"]); // a tela ainda mostra o velho…
      setGastos((p) => [...p, { id: "e", valor: 7 }]); // …e a pessoa toca de novo
    });
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(gastos)).toEqual(["a", "b", "c", "d", "e"]); // a tela adota o juntado
    const enviosDosGastos = upserts.filter((u) => u.key === "finance-expenses");
    expect(enviosDosGastos.length).toBeGreaterThan(0);
    expect(enviosDosGastos.every((u) => (u.value as Gasto[]).length >= 4)).toBe(true); // nenhum envio só com d/e
  });

  it("o aviso de 'chave mudou' do provider é o MESMO evento que o usePersistedState ouve", () => {
    expect(EVENTO_TELAS_DA_CHAVE).toBe(EVENTO_MESMA_CHAVE);
  });
});

describe("o aviso na tela (OfflineBanner)", () => {
  const contexto = (extra: Partial<UserDataContextType>): UserDataContextType => ({
    get: (_k, f) => f, set: () => {}, loaded: false, isGuest: false, fetchKey: async () => null, ...extra,
  });

  it("sem a conta e o aparelho SEM rede: 'Sem conexão…' e o botão tenta de novo", async () => {
    const { OfflineBanner } = await import("@/components/OfflineBanner");
    const { UserDataContext } = await import("@/hooks/use-user-data");
    const { screen, fireEvent } = await import("@testing-library/react");
    const tentar = vi.fn();
    const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    try {
      render(<UserDataContext.Provider value={contexto({ semConexao: "sem", tentarDeNovo: tentar })}><OfflineBanner /></UserDataContext.Provider>);
      expect(screen.getByRole("status").textContent).toContain("Sem conexão — seus dados aparecem quando a internet voltar.");
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      expect(tentar).toHaveBeenCalledTimes(1);
    } finally {
      delete (navigator as unknown as Record<string, unknown>).onLine;
      if (onLine) Object.defineProperty(Navigator.prototype, "onLine", onLine);
    }
  });

  it("sem a conta COM rede (servidor falhando, relógio torto): não diz 'sem conexão' — diz que está tentando de novo", async () => {
    const { OfflineBanner } = await import("@/components/OfflineBanner");
    const { UserDataContext } = await import("@/hooks/use-user-data");
    const { screen } = await import("@testing-library/react");
    render(<UserDataContext.Provider value={contexto({ semConexao: "sem", tentarDeNovo: () => {} })}><OfflineBanner /></UserDataContext.Provider>);
    const texto = screen.getByRole("status").textContent ?? "";
    expect(texto).toContain("Não conseguimos carregar seus dados agora — tentando de novo…");
    expect(texto).not.toContain("Sem conexão");
  });

  it("leitura demorando: 'conexão lenta'; com a conta em dia: nada", async () => {
    const { OfflineBanner } = await import("@/components/OfflineBanner");
    const { UserDataContext } = await import("@/hooks/use-user-data");
    const { screen } = await import("@testing-library/react");
    const r = render(<UserDataContext.Provider value={contexto({ semConexao: "lenta" })}><OfflineBanner /></UserDataContext.Provider>);
    expect(screen.getByRole("status").textContent).toContain("Conexão lenta — seus dados aparecem assim que carregarem.");
    expect(screen.queryByRole("button")).toBeNull(); // sem tentarDeNovo no contexto, sem botão
    r.unmount();
    render(<UserDataContext.Provider value={contexto({ semConexao: null, loaded: true })}><OfflineBanner /></UserDataContext.Provider>);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
