/**
 * LEITURA DA CONTA EM PÁGINAS (revisão S1, 17/10 — revisão antes da build da 1.0.16).
 *
 * O PostgREST devolve no máximo `max-rows` linhas por pedido (1000 no Supabase) e corta o resto SEM
 * erro. A leitura da conta (use-user-data) era UM pedido: conta com mais de 1000 linhas perdia as de
 * depois, calada — e, na 1.0.16, a chave cortada valia como "não existe no servidor" (sem a busca por
 * chave) e a próxima escrita nela sobrescrevia o servidor.
 *
 * O "servidor" aqui é um Map por conta e o mock é o PostgREST no que importa: filtra pela conta, ordena
 * se pedirem, aplica a faixa (`range`) e NUNCA devolve mais que 1000 linhas num pedido — com ou sem
 * faixa. Os casos de 2.345 linhas falham no código de antes (1 pedido, as 1000 primeiras linhas).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

type Linha = { user_id: string; key: string; value: unknown };
/** o teto do PostgREST (max-rows do Supabase): nenhuma resposta passa disto, com ou sem `range` */
const MAX_ROWS = 1000;
const servidores = new Map<string, Map<string, unknown>>();
const doServidor = (uid: string) => { let m = servidores.get(uid); if (!m) { m = new Map(); servidores.set(uid, m); } return m; };
const servidor = () => doServidor("u1");
const upserts: Linha[] = [];
/** cada pedido da leitura da conta inteira (= uma página): de quem, a ordem e a faixa pedidas */
type Pedido = { uid: string; ordem: string | null; asc: boolean | null; de: number | null; ate: number | null };
const pedidos: Pedido[] = [];
/** as buscas de UMA chave (fetchKey) */
const buscasPorChave: string[] = [];
/** a próxima vez que a página `pagina` (0 = a 1ª) da u1 for pedida, falha: "erro" volta {error}; "lanca" rejeita */
let falhar: { pagina: number; como: "erro" | "lanca" } | null = null;
/** segura a resposta da página `pagina` desta conta até `soltar()` */
let segurar: { uid: string; pagina: number } | null = null;
let soltar: (() => void) | null = null;
/** roda logo depois de cada página servida */
let depoisDaPagina: ((uid: string, pagina: number) => void) | null = null;
let sessaoValida = true;

const ERRO_REDE = { message: "TypeError: Load failed", details: "", hint: "", code: "" };

const auth: { user: { id: string } | null; loading: boolean } = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => {
  const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const consulta = () => {
    let uid = "";
    let chave: string | null = null;
    let ordem: string | null = null;
    let asc: boolean | null = null;
    let de: number | null = null;
    let ate: number | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- o encadeamento do cliente do Supabase, mockado
    const q: Record<string, (...a: any[]) => unknown> = {
      eq: (col: string, v: string) => { if (col === "user_id") uid = v; if (col === "key") chave = v; return q; },
      in: () => Promise.resolve({ data: [], error: null }),
      order: (col: string, opts?: { ascending?: boolean }) => { ordem = col; asc = opts?.ascending ?? true; return q; },
      range: (a: number, b: number) => { de = a; ate = b; return q; },
      // a leitura da conta inteira: o retrato sai na hora do pedido
      abortSignal: (sinal: AbortSignal) => {
        pedidos.push({ uid, ordem, asc, de, ate });
        const pagina = Math.floor((de ?? 0) / MAX_ROWS);
        let linhas = [...doServidor(uid).entries()].map(([key, value]) => ({ key, value: clonar(value) }));
        // sem `order`, a ordem é a do disco (aqui, a de inserção)
        if (ordem === "key") linhas.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0) * (asc === false ? -1 : 1));
        const ini = de ?? 0;
        const fim = ate === null ? linhas.length : ate + 1;
        linhas = linhas.slice(ini, Math.min(fim, ini + MAX_ROWS)); // a faixa pedida, nunca mais que o teto
        depoisDaPagina?.(uid, pagina);
        if (falhar && uid === "u1" && falhar.pagina === pagina) {
          const como = falhar.como;
          falhar = null;
          if (como === "lanca") return Promise.reject(new TypeError("Load failed"));
          return Promise.resolve({ data: null, error: ERRO_REDE });
        }
        if (segurar && segurar.uid === uid && segurar.pagina === pagina) {
          segurar = null;
          return new Promise((ok) => {
            soltar = () => ok({ data: linhas, error: null });
            sinal?.addEventListener?.("abort", () => ok({ data: null, error: { message: "AbortError: aborted" } }));
          });
        }
        return Promise.resolve({ data: linhas, error: null });
      },
      // a busca de UMA chave (fetchKey)
      maybeSingle: () => {
        const k = chave as string;
        buscasPorChave.push(k);
        const m = doServidor(uid);
        return Promise.resolve({ data: m.has(k) ? { value: clonar(m.get(k)) } : null, error: null });
      },
    };
    return q;
  };
  return {
    supabase: {
      from: () => ({
        select: () => consulta(),
        upsert: (linha: Linha) => {
          upserts.push(clonar(linha));
          doServidor(linha.user_id).set(linha.key, clonar(linha.value));
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      auth: {
        getSession: () => Promise.resolve({
          data: { session: sessaoValida && auth.user ? { access_token: "t", user: auth.user } : null },
          error: null,
        }),
      },
    },
  };
});

import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";

type Item = { id: string };
const chave = (i: number) => `k${String(i).padStart(4, "0")}`;
/** a chave #1.500: cai na 2ª página */
const CHAVE_1500 = chave(1500);
/** a conta de `n` linhas (k0000, k0001, …, valores pequenos); a #1.500, se existir, tem uma lista */
const contaCom = (n: number, uid = "u1") => {
  const m = doServidor(uid);
  for (let i = 0; i < n; i++) m.set(chave(i), { n: i });
  if (n > 1500) m.set(CHAVE_1500, [{ id: "s1" }, { id: "s2" }]);
};
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x: Item) => x.id) : v);
const faixas = () => pedidos.map((p) => [p.de, p.ate]);

let api: UserDataContextType;
const Sonda = () => { api = useUserData(); return null; };
let itens: Item[] = [];
let setItens: (v: Item[] | ((p: Item[]) => Item[])) => void = () => {};
/** uma tela na chave #1.500 */
const Lista = () => { const [v, s] = usePersistedState<Item[]>(CHAVE_1500, []); itens = v; setItens = s; return null; };
/** telas em chaves quaisquer (com `key`: as que já estão montadas continuam montadas) */
const Tela = ({ k }: { k: string }) => { usePersistedState<unknown[]>(k, []); return null; };
const Telas = ({ chaves }: { chaves: string[] }) => <>{chaves.map((k) => <Tela key={k} k={k} />)}</>;
const arvore = (chaves: string[] = []) => <UserDataProvider><Sonda /><Telas chaves={chaves} /></UserDataProvider>;
const esperar = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  servidores.clear();
  upserts.length = 0;
  pedidos.length = 0;
  buscasPorChave.length = 0;
  falhar = null;
  segurar = null;
  soltar = null;
  depoisDaPagina = null;
  sessaoValida = true;
  auth.user = { id: "u1" };
  auth.loading = false;
  vi.mocked(trackEvent).mockClear();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 17, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("a leitura da conta traz TODAS as linhas, em páginas", () => {
  it("conta com 2.345 linhas: todas as chaves chegam, em 3 páginas ordenadas por key (0–999, 1000–1999, 2000–2999)", async () => {
    contaCom(2345);
    render(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    const faltando = Array.from({ length: 2345 }, (_, i) => chave(i)).filter((k) => api.get<unknown>(k, undefined) === undefined);
    expect(faltando).toEqual([]);
    expect(api.get(chave(2344), null)).toEqual({ n: 2344 });
    expect(api.get(CHAVE_1500, null)).toEqual([{ id: "s1" }, { id: "s2" }]);
    expect(faixas()).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(pedidos.every((p) => p.uid === "u1" && p.ordem === "key" && p.asc === true)).toBe(true);
    expect(api.contaCompleta).toBe(true);
    // a medida de quantas contas passam de uma página (1x por abertura)
    expect(trackEvent).toHaveBeenCalledWith("dados_conta_paginada", { paginas: 3, linhas: 2345 });
  });

  it("menos de 1000 linhas: UM pedido, como antes — e conta nova (vazia) também", async () => {
    contaCom(999);
    const r = render(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(faixas()).toEqual([[0, 999]]);
    expect(api.get(chave(998), null)).toEqual({ n: 998 });
    expect(api.contaCompleta).toBe(true);
    expect(trackEvent).not.toHaveBeenCalledWith("dados_conta_paginada", expect.anything());
    r.unmount();
    pedidos.length = 0;
    auth.user = { id: "u-nova" };
    render(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(pedidos).toHaveLength(1);
    expect(api.contaCompleta).toBe(true);
  });

  it("exatamente 1000 linhas: a 2ª página (vazia) confirma o fim — 2 pedidos e nada mais", async () => {
    contaCom(1000);
    render(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(faixas()).toEqual([[0, 999], [1000, 1999]]);
    expect(api.get(chave(999), null)).toEqual({ n: 999 });
  });
});

describe("escrever numa chave que só vem na 2ª página não apaga o servidor", () => {
  it("escrita na chave #1.500 DEPOIS de carregar: parte do que o servidor tem e junta — não sobrescreve", async () => {
    contaCom(2345);
    render(<UserDataProvider><Sonda /><Lista /></UserDataProvider>);
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(itens)).toEqual(["s1", "s2"])); // a tela vê o valor da 2ª página
    act(() => setItens((p) => [...p, { id: "n" }]));
    await esperar(400);
    expect(ids(servidor().get(CHAVE_1500))).toEqual(["s1", "s2", "n"]);
    const envios = upserts.filter((u) => u.key === CHAVE_1500);
    expect(envios).toHaveLength(1);
    expect(ids(envios[0].value)).toEqual(["s1", "s2", "n"]);
    expect(buscasPorChave).toEqual([]); // nem precisou da busca por chave: a leitura trouxe a chave
  });

  it("escrita na chave #1.500 ANTES de a conta chegar (segurada): a junção de 3 vias usa o valor da 2ª página", async () => {
    contaCom(2345);
    segurar = { uid: "u1", pagina: 1 };
    render(<UserDataProvider><Sonda /><Lista /></UserDataProvider>);
    await waitFor(() => expect(soltar).not.toBeNull()); // a 1ª página chegou; a 2ª está no ar
    expect(api.loaded).toBe(false); // meia conta não libera nada
    act(() => setItens((p) => [...p, { id: "n" }])); // em cima do vazio da abertura
    await esperar(400);
    expect(upserts).toHaveLength(0); // nada sobe antes de a conta INTEIRA chegar
    await act(async () => { soltar?.(); });
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(ids(servidor().get(CHAVE_1500))).toEqual(["s1", "s2", "n"]);
    expect(ids(itens)).toEqual(["s1", "s2", "n"]);
    expect(faixas()).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

describe("página que falha = a leitura inteira falhou (nunca meia conta)", () => {
  it("a 2ª página volta erro: nada da 1ª é aplicado, nada sobe; a rede volta e a leitura recomeça do início e traz tudo", async () => {
    contaCom(2345);
    falhar = { pagina: 1, como: "erro" };
    render(<UserDataProvider><Sonda /><Lista /></UserDataProvider>);
    await esperar(100);
    expect(faixas()).toEqual([[0, 999], [1000, 1999]]); // parou na que falhou: a 3ª nem foi pedida
    expect(api.loaded).toBe(false);
    expect(api.semConexao).toBe("sem");
    expect(api.contaCompleta).toBe(false);
    expect(api.get(chave(0), "nada")).toBe("nada"); // a 1ª página não virou "a conta"
    expect(localStorage.getItem(`u:u1:${chave(0)}`)).toBeNull(); // nem no cache do aparelho
    act(() => setItens((p) => [...p, { id: "n" }]));
    await esperar(400);
    expect(upserts).toHaveLength(0);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(faixas().slice(2)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(api.get(chave(2344), null)).toEqual({ n: 2344 });
    expect(ids(servidor().get(CHAVE_1500))).toEqual(["s1", "s2", "n"]);
    expect(api.contaCompleta).toBe(true);
  });

  it("a rede cai no meio (a 2ª página lança): o mesmo caminho — falhou, e tenta de novo sozinho", async () => {
    contaCom(2345);
    falhar = { pagina: 1, como: "lanca" };
    render(arvore());
    await esperar(100);
    expect(api.loaded).toBe(false);
    expect(api.semConexao).toBe("sem");
    expect(api.get(chave(0), "nada")).toBe("nada");
    await esperar(2300); // a 1ª espera é de 2 s
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(api.get(chave(2344), null)).toEqual({ n: 2344 });
  });

  it("a sessão do auth some entre as páginas: a 2ª nem é pedida (a página vazia da chave anônima pareceria o fim) e a leitura não vale", async () => {
    contaCom(2345);
    depoisDaPagina = (_uid, pagina) => { if (pagina === 0) sessaoValida = false; };
    render(arvore());
    await esperar(100);
    expect(pedidos).toHaveLength(1);
    expect(api.loaded).toBe(false);
    expect(api.semConexao).toBe("sem");
    expect(api.get(chave(0), "nada")).toBe("nada");
  });

  it("a conta troca no meio da paginação: a página seguinte da conta velha não é pedida e nada dela entra na nova", async () => {
    contaCom(2345, "u1");
    doServidor("u2").set("finance-expenses", [{ id: "x" }]);
    segurar = { uid: "u1", pagina: 0 };
    const r = render(arvore());
    await waitFor(() => expect(soltar).not.toBeNull());
    auth.user = { id: "u2" };
    r.rerender(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    await act(async () => { soltar?.(); }); // a 1ª página da conta velha chegando tarde
    await esperar(100);
    expect(pedidos.filter((p) => p.uid === "u1")).toHaveLength(1);
    expect(api.get(chave(0), "nada")).toBe("nada");
    expect(api.get("finance-expenses", [])).toEqual([{ id: "x" }]);
  });
});

describe("chave ausente sem busca no servidor só com a conta lida INTEIRA", () => {
  it("leitura completa (3 páginas): chave que não existe na conta não vira busca por chave (o ganho da 1.0.16 fica)", async () => {
    contaCom(2345);
    const r = render(arvore());
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(api.contaCompleta).toBe(true);
    r.rerender(arvore(["finance-notes", chave(2000)]));
    await esperar(50);
    expect(buscasPorChave).toEqual([]);
  });

  it("leitura incompleta (a 2ª rodada falha na 2ª página, com a conta já lida): a busca por chave volta; a próxima leitura inteira a desliga de novo", async () => {
    contaCom(2345);
    const r = render(arvore(["finance-notes"]));
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(50);
    expect(buscasPorChave).toEqual([]);
    // o auth reemite a sessão (token renovado): 2ª rodada — e a 2ª página dela falha
    falhar = { pagina: 1, como: "erro" };
    auth.user = { id: "u1" };
    r.rerender(arvore(["finance-notes"]));
    await waitFor(() => expect(api.contaCompleta).toBe(false));
    expect(api.loaded).toBe(true); // a conta já lida segue (nada da leitura que falhou foi aplicado)
    expect(api.get(chave(2344), null)).toEqual({ n: 2344 });
    r.rerender(arvore(["finance-notes", "finance-goals"]));
    await esperar(50);
    expect(buscasPorChave).toEqual(["finance-goals"]);
    // a rodada seguinte vem inteira: tela nova em chave ausente não busca mais
    auth.user = { id: "u1" };
    r.rerender(arvore(["finance-notes", "finance-goals"]));
    await waitFor(() => expect(api.contaCompleta).toBe(true));
    r.rerender(arvore(["finance-notes", "finance-goals", "finance-wishlist"]));
    await esperar(50);
    expect(buscasPorChave).toEqual(["finance-goals"]);
  });
});
