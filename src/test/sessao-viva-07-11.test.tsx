/**
 * SESSÃO VIVA APAGAVA O MÊS NOVO DE OUTRO APARELHO (07/11).
 *
 * Aba do PC aberta em 31/10 (a conta chegou do servidor nesse dia). O celular,
 * em novembro, roda a virada dele e lança Padaria 42, Salário 5.000 e paga a
 * Luz. A aba volta em 06/11: `useMesCorrente` vê o mês novo e a virada rodava
 * NA HORA, em cima do store de outubro — e o `set` manda a chave inteira: o
 * servidor ficava com gastos [], receitas [] e a Luz "não paga". A leitura da
 * 2ª rodada (o auth reemite a sessão na volta) chegava tarde demais.
 *
 * Agora (use-virada-do-mes + use-user-data): com a conta lida NOUTRO MÊS, a
 * virada pede `relerConta` e só roda depois que a leitura dá certo (falhou:
 * tenta de novo sozinha; offline: espera). A irmã em `registrarDiaAnotado`:
 * com a conta lida NOUTRO DIA, o dia anotado espera a releitura e entra na
 * lista nova — antes, a lista velha + hoje ia por cima dos dias do celular.
 *
 * O "servidor" é um Map por conta (como em dados-offline-guard): o upsert grava
 * nele, a leitura tira retrato no momento do PEDIDO. O celular escreve direto
 * no Map, como faria pelo próprio app.
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
let soltarLeitura: (() => void) | null = null;
let leiturasTotais = 0;
/** (07/11, bug "offline-some") rede caída também pros envios */
let upsertFalha = false;
const ERRO_REDE = { message: "TypeError: Load failed", details: "", hint: "", code: "" };
/** (07/11, bug "envio-velho") só os próximos N envios caem (rede piscando) */
let falharProximos = 0;
/** (07/11, bug "recusa-laco") o SERVIDOR responde e recusa esta chave (não é rede caída) */
let recusa: { key: string; error: Record<string, string>; status?: number } | null = null;

const auth: { user: { id: string } | null; loading: boolean } = { user: { id: "u1" }, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn }));
vi.mock("@/integrations/supabase/client", () => {
  const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const consulta = () => {
    let uid = "";
    const q: Record<string, (...a: unknown[]) => unknown> = {
      eq: (col: unknown, v: unknown) => { if (col === "user_id") uid = v as string; return q; },
      order: () => q,
      range: () => q,
      in: () => Promise.resolve({ data: [], error: null }),
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
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    return q;
  };
  return {
    supabase: {
      from: () => ({
        select: () => consulta(),
        upsert: (linha: Linha) => {
          if (falharProximos > 0) { falharProximos--; return Promise.resolve({ error: ERRO_REDE, status: 0 }); }
          if (upsertFalha) return Promise.resolve({ error: ERRO_REDE });
          if (recusa && linha.key === recusa.key) return Promise.resolve({ error: recusa.error, status: recusa.status });
          upserts.push(clonar(linha));
          doServidor(linha.user_id).set(linha.key, clonar(linha.value));
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      auth: {
        getSession: () => Promise.resolve({
          data: { session: auth.user ? { access_token: "t", expires_at: 4102444800, user: auth.user } : null },
          error: null,
        }),
      },
    },
  };
});

import { UserDataProvider, useUserData, type UserDataContextType } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useViradaDoMes, useVersaoDaVirada } from "@/hooks/use-virada-do-mes";
import { CHAVE_CARIMBO_CONTAS, type DiaDeContas } from "@/lib/virada-contas";
import { CHAVE_DIAS_ANOTADOS } from "@/lib/sequencia";
import { trackEvent } from "@/lib/analytics";

type Gasto = { id: string; date: string; value: number; description: string };
let api: UserDataContextType;
const Sonda = () => { api = useUserData(); return null; };
/** Dublê da tela de Finanças: o mesmo `usePersistedState` do Index, remontada pela versão da virada (como o Index real). */
let gastosNaTela: Gasto[] = [];
let setGastosNaTela: (v: Gasto[] | ((p: Gasto[]) => Gasto[])) => void = () => {};
const Financas = () => {
  const [g, set] = usePersistedState<Gasto[]>("finance-expenses", []);
  gastosNaTela = g; setGastosNaTela = set;
  return null;
};
const FinancasComVersao = () => { const v = useVersaoDaVirada(); return <Financas key={v} />; };
/** Como o App real: o hook da virada no pai das telas. */
const AppComVirada = ({ financas }: { financas?: boolean }) => { useViradaDoMes(); return <>{financas ? <FinancasComVersao /> : null}</>; };
const arvore = (financas = false) => <UserDataProvider><Sonda /><AppComVirada financas={financas} /></UserDataProvider>;
const montar = (financas = false) => render(arvore(financas));
const esperar = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** Data LOCAL de Brasília (mês 1-12, como se fala). */
const em = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
/** Id de conta nascido nessa data — o formato real (`Date.now()`). */
const nascida = (a: number, m: number, d: number) => String(em(a, m, d).getTime());
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x: { id: string }) => x.id) : v);
const luzPaga = (dias: unknown) => (dias as DiaDeContas[]).flatMap((d) => d.bills).find((b) => b.name === "Luz")?.paid;
/** A aba volta: a mesma volta ao app do mundo real (visibilitychange + focus). */
const voltarPraAba = () => act(async () => {
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
});
const gravacoesDe = (key: string) => upserts.filter((u) => u.key === key).map((u) => u.value);

/* ── O que o servidor tinha em 31/10 e o que o celular deixou nele em novembro ── */
const LUZ = { id: nascida(2026, 8, 2), name: "Luz", paid: true, value: 180 };
const OUTUBRO = {
  "finance-expenses": [{ id: "mercado", date: "2026-10-28", value: 300, description: "Mercado" }],
  "finance-incomes": [{ id: "sal-out", date: "2026-10-05", value: 5000, description: "Salário" }],
  "finance-dueDays": [{ day: 10, color: "yellow", bills: [LUZ] }],
  [CHAVE_CARIMBO_CONTAS]: "2026-10",
};
const PADARIA = { id: "padaria", date: "2026-11-03", value: 42, description: "Padaria" };
const SALARIO_NOV = { id: "sal-nov", date: "2026-11-05", value: 5000, description: "Salário" };
/** O celular virou o mês dele e lançou novembro: é assim que o servidor fica. */
const celularEmNovembro = () => {
  servidor().set("finance-2026-outubro-expenses", OUTUBRO["finance-expenses"]);
  servidor().set("finance-2026-outubro-incomes", OUTUBRO["finance-incomes"]);
  servidor().set("finance-2026-outubro-dueDays", OUTUBRO["finance-dueDays"]);
  servidor().set("finance-expenses", [PADARIA]);
  servidor().set("finance-incomes", [SALARIO_NOV]);
  servidor().set("finance-dueDays", [{ day: 10, color: "yellow", bills: [{ ...LUZ, paid: true }] }]); // Luz ✓ de novembro
  servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
};
const servidorIntacto = () => {
  expect(ids(servidor().get("finance-expenses"))).toEqual(["padaria"]);
  expect(ids(servidor().get("finance-incomes"))).toEqual(["sal-nov"]);
  expect(luzPaga(servidor().get("finance-dueDays"))).toBe(true);
  expect(servidor().get(CHAVE_CARIMBO_CONTAS)).toBe("2026-11");
};

beforeEach(() => {
  servidores.clear();
  upserts.length = 0;
  leituraTotal = "ok";
  soltarLeitura = null;
  leiturasTotais = 0;
  upsertFalha = false;
  falharProximos = 0;
  recusa = null;
  auth.user = { id: "u1" };
  auth.loading = false;
  toastFn.mockClear();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(em(2026, 10, 31, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("sessão viva atravessa o mês: a virada relê a conta antes de rodar", () => {
  it("aba aberta em 31/10 volta em 06/11: o servidor fica com o novembro do celular (Padaria, Salário, Luz ✓)", async () => {
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(upserts).toHaveLength(0); // outubro em outubro: nada a virar

    celularEmNovembro();
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    // o auth reemite a sessão na volta (objeto novo, mesma conta) — depois da virada, como no mundo real
    auth.user = { id: "u1" };
    await esperar(500);

    servidorIntacto();
    // e a aba passou a ver o que o celular lançou
    expect(ids(api.get("finance-expenses", []))).toEqual(["padaria"]);
    expect(ids(api.get("finance-incomes", []))).toEqual(["sal-nov"]);
    expect(luzPaga(api.get("finance-dueDays", []))).toBe(true);
    // em momento nenhum um balde vazio foi mandado pro servidor
    expect(gravacoesDe("finance-expenses")).not.toContainEqual([]);
    expect(gravacoesDe("finance-incomes")).not.toContainEqual([]);
  });

  it("aba EM Finanças: a tela remonta com o novembro do celular; o 1º gasto novo não devolve outubro", async () => {
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar(true);
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["mercado"]));

    celularEmNovembro();
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await esperar(500);

    servidorIntacto();
    expect(ids(gastosNaTela)).toEqual(["padaria"]); // a tela renasceu lendo o store relido
    act(() => setGastosNaTela((p) => [...p, { id: "farmacia", date: "2026-11-06", value: 30, description: "Farmácia" }]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["padaria", "farmacia"]);
  });

  it("sem rede na volta: a virada ESPERA (nada gravado por cima); a rede volta → relê e segue", async () => {
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    celularEmNovembro();
    leituraTotal = "erro";
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await esperar(500);
    expect(upserts).toHaveLength(0); // leitura falhou: a virada não rodou em cima de outubro
    servidorIntacto();
    expect(ids(api.get("finance-expenses", []))).toEqual(["mercado"]); // a aba segue com o que tem

    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(500);
    servidorIntacto();
    expect(ids(api.get("finance-expenses", []))).toEqual(["padaria"]);
    expect(gravacoesDe("finance-expenses")).not.toContainEqual([]);
  });

  it("um aparelho só, sem rede na volta: a virada roda assim que a leitura der certo e arquiva outubro", async () => {
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    leituraTotal = "erro";
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await esperar(500);
    expect(upserts).toHaveLength(0);

    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(500);
    expect(ids(servidor().get("finance-2026-outubro-expenses"))).toEqual(["mercado"]);
    expect(ids(servidor().get("finance-2026-outubro-incomes"))).toEqual(["sal-out"]);
    expect(servidor().get("finance-expenses")).toEqual([]);
    expect(luzPaga(servidor().get("finance-dueDays"))).toBe(false); // o ✓ de outubro expirou
    expect(servidor().get(CHAVE_CARIMBO_CONTAS)).toBe("2026-11");
  });

  it("controle: abrir do zero em 06/11 vira na hora, com UMA leitura (como sempre)", async () => {
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    expect(leiturasTotais).toBe(1);
    expect(ids(servidor().get("finance-2026-outubro-expenses"))).toEqual(["mercado"]);
    expect(servidor().get(CHAVE_CARIMBO_CONTAS)).toBe("2026-11");
  });
});

describe("irmã: dia anotado com a conta lida noutro dia", () => {
  const DIAS_DO_CELULAR = ["2026-11-03", "2026-11-04", "2026-11-05"];
  const anotar = () => act(() => api.set("todo-list", [{ id: "t1", texto: "pagar luz" }]));

  it("aba aberta em 03/11, o celular anota 04 e 05; a aba anota em 06/11: os dias do celular FICAM", async () => {
    vi.setSystemTime(em(2026, 11, 3, 10, 0));
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-03"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    servidor().set(CHAVE_DIAS_ANOTADOS, DIAS_DO_CELULAR);
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await anotar();
    await esperar(500);

    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual([...DIAS_DO_CELULAR, "2026-11-06"]);
    expect(api.get(CHAVE_DIAS_ANOTADOS, [])).toEqual([...DIAS_DO_CELULAR, "2026-11-06"]);
    // o gesto em si subiu na hora, como sempre
    expect(servidor().get("todo-list")).toEqual([{ id: "t1", texto: "pagar luz" }]);
  });

  it("sem rede: o dia espera (a lista do celular não é apagada); a rede volta → o dia entra na lista nova", async () => {
    vi.setSystemTime(em(2026, 11, 3, 10, 0));
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-03"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    servidor().set(CHAVE_DIAS_ANOTADOS, DIAS_DO_CELULAR);
    leituraTotal = "erro";
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await anotar();
    await esperar(500);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(DIAS_DO_CELULAR); // nada por cima
    expect(gravacoesDe(CHAVE_DIAS_ANOTADOS)).toHaveLength(0);

    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(500);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual([...DIAS_DO_CELULAR, "2026-11-06"]);
  });

  it("controle: conta lida HOJE anota na hora, sem leitura extra", async () => {
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    servidor().set(CHAVE_DIAS_ANOTADOS, DIAS_DO_CELULAR);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await anotar();
    await esperar(400);
    expect(leiturasTotais).toBe(1);
    expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual([...DIAS_DO_CELULAR, "2026-11-06"]);
  });
});

/* Crítica dos dados (07/11): a releitura que o próprio conserto pede não pode desfazer o gesto que a disparou. O
   retrato do servidor é tirado no PEDIDO, e o envio do gesto espera 250 ms: se a resposta chega depois do envio, a
   chave já saiu da fila e a escrita é poucos ms ANTERIOR ao pedido — a memória e o cache voltavam pro valor velho, e
   a próxima gravação feita em cima do `get` apagava o que ela anotou. */
describe("a releitura não volta atrás o gesto que estava na fila", () => {
  it("o 1º gesto depois da meia-noite não volta atrás quando a releitura chega depois do envio", async () => {
    vi.setSystemTime(em(2026, 11, 5, 22, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-05"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    vi.setSystemTime(em(2026, 11, 6, 0, 10));
    leituraTotal = "segurar"; // rede de celular: a resposta demora mais que o debounce de 250 ms
    // o gesto às 00:10:00.000; o React roda o efeito da releitura uns ms depois (no aparelho, 5–30 ms)
    api.set("todo-list", [{ id: "t0" }, { id: "t1" }]);
    vi.setSystemTime(new Date(em(2026, 11, 6, 0, 10).getTime() + 20));
    await act(async () => {}); // a releitura sai antes do envio do gesto
    await esperar(400);
    // (07/11, bug "retrato-velho") o gesto com a conta lida noutro dia não sobe mais na hora: espera a releitura
    // pra ser juntado com o que o servidor tem hoje (a cópia fica guardada no aparelho enquanto isso)
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }]);
    expect(leiturasTotais).toBe(2);
    await act(async () => { soltarLeitura?.(); });
    await esperar(400);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }]);
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }]);
    // quem lê pelo `get` (Pet, Conquistas, widgets da Home) e grava em cima: o t1 fica
    act(() => api.set("todo-list", [...api.get<{ id: string }[]>("todo-list", []), { id: "t2" }]));
    await esperar(400);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }, { id: "t2" }]);
  });

  it("um gesto qualquer 20 ms antes da releitura da virada (volta pra aba em 01/11) não volta atrás", async () => {
    vi.setSystemTime(em(2026, 10, 31, 22, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    vi.setSystemTime(em(2026, 11, 1, 9, 0));
    leituraTotal = "segurar";
    api.set("todo-list", [{ id: "t0" }, { id: "t1" }]); // gesto às 09:00:00.000
    vi.setSystemTime(new Date(em(2026, 11, 1, 9, 0).getTime() + 20));
    await voltarPraAba(); // a virada pede a releitura 20 ms depois
    await esperar(400);
    await act(async () => { soltarLeitura?.(); });
    await esperar(400);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }]); // o servidor tem
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }]); // e esta aba também
    expect(JSON.parse(localStorage.getItem("u:u1:todo-list") ?? "null")).toEqual([{ id: "t0" }, { id: "t1" }]);
  });
});

/* Crítica (07/11): a virada pede a releitura UMA vez por alvo e "a leitura no ar serve". Se essa leitura estava no ar
   desde ANTES da meia-noite, ela chega com `pedidaEm` ainda em outubro: a virada voltava sem virar e não pedia outra.
   Numa aba sempre visível nada mais dispara leitura — o mês não virava até reabrir. */
describe("a leitura no ar desde antes da virada não trava o mês", () => {
  it("leitura pedida 31/10 23:59:58, volta pra aba 01/11 00:00:01, a leitura chega: pede outra e vira", async () => {
    vi.setSystemTime(em(2026, 10, 31, 22, 0));
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    leituraTotal = "segurar";
    vi.setSystemTime(new Date(em(2026, 11, 1, 0, 0).getTime() - 2000)); // 31/10 23:59:58
    await act(async () => { api.relerConta?.(); });
    expect(leiturasTotais).toBe(2);
    vi.setSystemTime(new Date(em(2026, 11, 1, 0, 0).getTime() + 1000)); // 01/11 00:00:01
    await voltarPraAba();
    expect(leiturasTotais).toBe(2); // a do ar serve (dentro do prazo)
    const soltarAntiga = soltarLeitura;
    leituraTotal = "ok";
    await act(async () => { soltarAntiga?.(); });
    await esperar(800);
    expect(leiturasTotais).toBe(3); // a virada pediu uma leitura deste mês
    expect(ids(servidor().get("finance-2026-outubro-expenses"))).toEqual(["mercado"]);
    expect(servidor().get(CHAVE_CARIMBO_CONTAS)).toBe("2026-11");
  });
});

/* Crítica dos dados r2 (07/11, bug "offline-some"): o envio que falha 3 vezes desistia, e a releitura seguinte (a rede
   voltando, o dia novo) punha o valor do servidor no lugar do que ela anotou — na tela e no cache. A próxima gravação
   partia desse valor velho e a perda ficava de vez. */
describe("o que ela anotou sem rede não some quando a rede volta", () => {
  it("OFFLINE: app aberto desde ontem, metrô sem sinal; a rede volta 20 min depois: o t1 fica na tela e sobe", async () => {
    vi.setSystemTime(em(2026, 11, 5, 22, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-05"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));

    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    leituraTotal = "erro";
    upsertFalha = true;
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1-sem-rede" }]));
    await esperar(2500); // o envio tenta 3 vezes (0,5 s + 1 s) e desiste
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1-sem-rede" }]);

    vi.setSystemTime(em(2026, 11, 6, 8, 20));
    leituraTotal = "ok";
    upsertFalha = false;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(600);
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1-sem-rede" }]);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1-sem-rede" }]);
    expect(JSON.parse(localStorage.getItem("u:u1:todo-list") ?? "null")).toEqual([{ id: "t0" }, { id: "t1-sem-rede" }]);
  }, 15000);

  it("mesmo dia: o envio desiste, outro aparelho lança na mesma lista, a rede volta: os dois ficam", async () => {
    vi.setSystemTime(em(2026, 11, 6, 7, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-06"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    upsertFalha = true;
    leituraTotal = "erro";
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1-sem-rede" }]));
    await esperar(2500);
    servidor().set("todo-list", [{ id: "t0" }, { id: "do-celular" }]); // o celular, com rede
    upsertFalha = false;
    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(600);
    expect(ids(servidor().get("todo-list"))).toEqual(["t0", "do-celular", "t1-sem-rede"]);
    expect(ids(api.get("todo-list", []))).toEqual(["t0", "do-celular", "t1-sem-rede"]);
  }, 15000);

  it("na tela de Finanças: o gasto sem rede e o do celular aparecem os dois, e o próximo gasto não apaga nenhum", async () => {
    vi.setSystemTime(em(2026, 11, 6, 7, 0));
    servidor().set("finance-expenses", [PADARIA]);
    servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
    montar(true);
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["padaria"]));
    upsertFalha = true;
    leituraTotal = "erro";
    act(() => setGastosNaTela((p) => [...p, { id: "farmacia", date: "2026-11-06", value: 30, description: "Farmácia" }]));
    await esperar(2500);
    servidor().set("finance-expenses", [PADARIA, { id: "uber", date: "2026-11-06", value: 18, description: "Uber" }]); // o celular
    upsertFalha = false;
    leituraTotal = "ok";
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await esperar(600);
    expect(ids(gastosNaTela)).toEqual(["padaria", "uber", "farmacia"]);
    act(() => setGastosNaTela((p) => [...p, { id: "cafe", date: "2026-11-06", value: 8, description: "Café" }]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["padaria", "uber", "farmacia", "cafe"]);
  }, 15000);

  it("o app é fechado antes de a rede voltar: o t1 volta na próxima abertura e sobe", async () => {
    vi.setSystemTime(em(2026, 11, 6, 7, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    const r = montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    upsertFalha = true;
    leituraTotal = "erro";
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1-sem-rede" }]));
    await esperar(2500);
    r.unmount();
    upsertFalha = false;
    leituraTotal = "ok";
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(600);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1-sem-rede" }]);
  }, 15000);
});

/* Crítica dos dados r2 (07/11, bug "retrato-velho"): a sessão viva protegia só a virada e a lista de dias. O 1º gesto
   numa aba com a conta lida NOUTRO DIA mandava a chave INTEIRA a partir do retrato velho e apagava o que o celular
   lançou na mesma chave — e a releitura que chegava depois mantinha o valor do aparelho. */
describe("o 1º gesto com a conta lida noutro dia não apaga o que o celular lançou", () => {
  const A = { id: "a", date: "2026-11-03", value: 10, description: "A" };
  const FARMACIA = { id: "farmacia", date: "2026-11-06", value: 30, description: "Farmácia" };

  it("DOIS APARELHOS: aba de 03/11, o celular lança Padaria em 05/11, a aba lança Farmácia em 06/11: os dois ficam", async () => {
    vi.setSystemTime(em(2026, 11, 3, 10, 0));
    servidor().set("finance-expenses", [A]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    servidor().set("finance-expenses", [A, PADARIA]); // o celular, em 05/11
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    act(() => api.set("finance-expenses", [...api.get<Gasto[]>("finance-expenses", []), FARMACIA]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
    expect(ids(api.get("finance-expenses", []))).toEqual(["a", "padaria", "farmacia"]);
    expect(gravacoesDe("finance-expenses").map(ids)).not.toContainEqual(["a", "farmacia"]); // nada por cima, nem por um instante
  });

  it("na tela de Finanças (o mesmo gesto pelo usePersistedState): a tela mostra os dois", async () => {
    vi.setSystemTime(em(2026, 11, 3, 10, 0));
    servidor().set("finance-expenses", [A]);
    servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
    montar(true);
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["a"]));
    servidor().set("finance-expenses", [A, PADARIA]);
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    act(() => setGastosNaTela((p) => [...p, FARMACIA]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
    expect(ids(gastosNaTela)).toEqual(["a", "padaria", "farmacia"]);
  });

  it("o 1º gesto foi noutra chave: a releitura avisa a tela de Finanças, e o gasto seguinte não apaga a Padaria", async () => {
    vi.setSystemTime(em(2026, 11, 3, 10, 0));
    servidor().set("finance-expenses", [A]);
    servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
    montar(true);
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["a"]));
    servidor().set("finance-expenses", [A, PADARIA]);
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    act(() => api.set("todo-list", [{ id: "t1" }]));
    await esperar(600);
    expect(ids(gastosNaTela)).toEqual(["a", "padaria"]); // a tela adotou o que o servidor tem hoje
    act(() => setGastosNaTela((p) => [...p, FARMACIA]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
  });

  it("Finanças aberta enquanto a virada espera a releitura (rede lenta): o gasto novo junta com o novembro do celular", async () => {
    for (const [k, v] of Object.entries(OUTUBRO)) servidor().set(k, v);
    montar(true);
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["mercado"]));
    celularEmNovembro();
    leituraTotal = "segurar";
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    await voltarPraAba();
    await esperar(300);
    expect(ids(gastosNaTela)).toEqual(["mercado"]); // a tela ainda mostra outubro: a leitura não chegou
    act(() => setGastosNaTela((p) => [...p, FARMACIA]));
    await esperar(400);
    expect(gravacoesDe("finance-expenses")).toHaveLength(0); // nada sobe em cima do novembro do celular
    expect(ids(servidor().get("finance-expenses"))).toEqual(["padaria"]);
    leituraTotal = "ok";
    await act(async () => { soltarLeitura?.(); });
    await esperar(800);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["padaria", "farmacia"]);
    expect(ids(servidor().get("finance-2026-outubro-expenses"))).toEqual(["mercado"]);
    expect(ids(servidor().get("finance-incomes"))).toEqual(["sal-nov"]);
    expect(luzPaga(servidor().get("finance-dueDays"))).toBe(true);
    expect(ids(gastosNaTela)).toEqual(["padaria", "farmacia"]);
  });

  it("controle: conta lida HOJE grava na hora, sem leitura extra", async () => {
    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    servidor().set("finance-expenses", [A]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    act(() => api.set("finance-expenses", [A, FARMACIA]));
    await esperar(400);
    expect(leiturasTotais).toBe(1);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "farmacia"]);
  });
});

/* Crítica do ciclo r2 (07/11, bug "meia-noite-dois-aparelhos", achado com 2 navegadores e backend falso em
   scratchpad/ciclo/dias.mjs): A abre 07/11 23:57 e lança Mercado; B lança Padaria 08/11 00:05; A, ainda aberto, lança
   Farmácia às 00:10. A releitura acontecia, mas o servidor terminava com [Mercado, Farmácia] — a Padaria sumia, até
   depois de reabrir. Já existia antes do ramo. O gesto das 00:10 é o "gesto em cima do retrato velho" (bug
   "retrato-velho"): entra segurado e é juntado com mesclar3 na releitura. */
describe("A e B lançando na mesma lista depois da meia-noite", () => {
  const MERCADO = { id: "mercado", date: "2026-11-07", value: 50, description: "Mercado" };
  const PADARIA_B = { id: "padaria-b", date: "2026-11-08", value: 12, description: "Padaria" };
  const FARMACIA_A = { id: "farmacia-a", date: "2026-11-08", value: 30, description: "Farmácia" };

  it("pelo get: o servidor termina com Mercado, Padaria e Farmácia, e a reabertura também", async () => {
    vi.setSystemTime(em(2026, 11, 7, 23, 57));
    const r = montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    act(() => api.set("finance-expenses", [MERCADO]));
    await esperar(400);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["mercado"]);

    servidor().set("finance-expenses", [MERCADO, PADARIA_B]); // B, 08/11 00:05
    vi.setSystemTime(em(2026, 11, 8, 0, 10));
    act(() => api.set("finance-expenses", [...api.get<Gasto[]>("finance-expenses", []), FARMACIA_A]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["mercado", "padaria-b", "farmacia-a"]);
    expect(ids(api.get("finance-expenses", []))).toEqual(["mercado", "padaria-b", "farmacia-a"]);

    r.unmount();
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(ids(api.get("finance-expenses", []))).toEqual(["mercado", "padaria-b", "farmacia-a"]);
  });

  it("pela tela de Finanças: a tela de A mostra a Padaria de B junto", async () => {
    vi.setSystemTime(em(2026, 11, 7, 23, 57));
    servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
    montar(true);
    await waitFor(() => expect(api.loaded).toBe(true));
    act(() => setGastosNaTela([MERCADO]));
    await esperar(400);
    servidor().set("finance-expenses", [MERCADO, PADARIA_B]);
    vi.setSystemTime(em(2026, 11, 8, 0, 10));
    act(() => setGastosNaTela((p) => [...p, FARMACIA_A]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["mercado", "padaria-b", "farmacia-a"]);
    expect(ids(gastosNaTela)).toEqual(["mercado", "padaria-b", "farmacia-a"]);
    // e o dia 08 entra na sequência (sobe na liberação, depois do gasto juntado)
    await waitFor(() => expect(servidor().get(CHAVE_DIAS_ANOTADOS)).toEqual(["2026-11-07", "2026-11-08"]));
  });
});

/* Crítica dos dados r3 (07/11, bug "envio-velho", achado em scratchpad/critico-dados-r3, R5). Rede piscando: o 1º envio
   de [t0,t1] cai; 300 ms depois [t0,t1,t2] sobe na hora; aos 500 ms a nova tentativa de [t0,t1] subia POR CIMA. A tela
   ficava com o t2 e o servidor sem ele — na próxima leitura ou ao reabrir, o t2 sumia. Já existia antes do ramo. */
describe("rede piscando: a nova tentativa do valor velho não passa por cima do novo", () => {
  it("[t0,t1] cai, [t0,t1,t2] sobe: o servidor termina com o t2, e a reabertura também", async () => {
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    const r = montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    await esperar(400);
    falharProximos = 1;
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1" }]));
    await esperar(300);
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1" }, { id: "t2" }]));
    for (let i = 0; i < 8; i++) await esperar(300);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }, { id: "t2" }]);
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }, { id: "t2" }]);
    // a tentativa velha desistiu calada: nenhum envio de [t0,t1] depois do [t0,t1,t2]
    const gravados = gravacoesDe("todo-list").map((v) => (v as { id: string }[]).length);
    expect(gravados).toEqual([3]);
    r.unmount();
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }, { id: "t2" }]);
  }, 20000);

  it("controle: um envio só que cai uma vez sobe na 2ª tentativa", async () => {
    vi.setSystemTime(em(2026, 11, 6, 9, 0));
    servidor().set("todo-list", [{ id: "t0" }]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    falharProximos = 1;
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1" }]));
    for (let i = 0; i < 4; i++) await esperar(300);
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }]);
    expect(leiturasTotais).toBe(1);
  });
});

/* Crítica r3 (07/11, bug "recusa-laco", achado por três críticos: scratchpad/critico-dados-r3 R1,
   scratchpad/ciclo-bugs-r3/critico-ciclo-r3-recusa-loop e scratchpad/critico-r3-loop). O 7884fd5d (offline-some)
   fazia o 3º envio que desiste pedir `relerConta` pra QUALQUER erro. Com o servidor RECUSANDO a chave (não é rede:
   texto com \u0000 → 22P05, 413 de corpo grande, 42501 da RLS, 503 numa queda), a leitura dava certo, juntava, o envio
   era recusado de novo e pedia outra leitura: uma leitura da conta inteira a cada ~2 s, sem fim, com o app aberto.
   Antes do ramo: 3 tentativas e parava. O relógio anda em passos (o React segura os efeitos do provider até o act
   acabar: um act só de 12 s esconde o laço). */
describe("envio recusado pelo servidor não vira laço de leitura", () => {
  const andar = async (segundos: number, desde: Date) => {
    for (let i = 1; i <= segundos * 2; i++) {
      vi.setSystemTime(new Date(desde.getTime() + i * 500));
      await esperar(500);
    }
  };
  const recusas: [string, { error: Record<string, string>; status?: number }][] = [
    ["22P05 (texto colado com \\u0000), sem status", { error: { message: "unsupported Unicode escape sequence", code: "22P05", details: "", hint: "" } }],
    ["413 (corpo grande demais)", { error: { message: "Payload Too Large", code: "", details: "", hint: "" }, status: 413 }],
    ["42501 da RLS (chave que o servidor não aceita)", { error: { message: "new row violates row-level security policy", code: "42501", details: "", hint: "" }, status: 403 }],
    ["503 numa queda da Supabase", { error: { message: "Service Unavailable", code: "", details: "", hint: "" }, status: 503 }],
  ];
  for (const [nome, r] of recusas) {
    it(`${nome}: 3 tentativas, nenhuma releitura; o que ela anotou fica na tela e no aparelho`, async () => {
      const inicio = em(2026, 11, 7, 10, 0);
      vi.setSystemTime(inicio);
      servidor().set("todo-list", [{ id: "t0" }]);
      servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-07"]);
      montar();
      await waitFor(() => expect(api.loaded).toBe(true));
      const antes = leiturasTotais;
      recusa = { key: "todo-list", ...r };
      const upsertsAntes = upserts.length;
      act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1" }]));
      await andar(10, inicio);
      expect(leiturasTotais - antes).toBe(0);
      expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }]);
      expect(servidor().get("todo-list")).toEqual([{ id: "t0" }]);
      expect(upserts.length).toBe(upsertsAntes); // o mock só guarda o que o servidor aceitou
      expect(vi.mocked(trackEvent)).toHaveBeenCalledWith("dados_envio_recusado", expect.objectContaining({ key: "todo-list" }));
      // a cópia fica no aparelho: a próxima abertura tenta de novo (3 envios, sem laço)
      expect(localStorage.getItem("u:u1:todo-list")).toContain("t1");
    }, 20000);
  }

  it("2ª trava: erro com cara de rede numa chave só, com a leitura funcionando: no máximo 1 releitura", async () => {
    const inicio = em(2026, 11, 7, 10, 0);
    vi.setSystemTime(inicio);
    servidor().set("todo-list", [{ id: "t0" }]);
    servidor().set(CHAVE_DIAS_ANOTADOS, ["2026-11-07"]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    const antes = leiturasTotais;
    recusa = { key: "todo-list", error: ERRO_REDE, status: 0 };
    act(() => api.set("todo-list", [{ id: "t0" }, { id: "t1" }]));
    await andar(12, inicio);
    expect(leiturasTotais - antes).toBeLessThanOrEqual(1);
    expect(api.get("todo-list", [])).toEqual([{ id: "t0" }, { id: "t1" }]);
    // a rede "volta" (evento online): junta e sobe
    recusa = null;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await andar(2, new Date(inicio.getTime() + 12_000));
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }]);
  }, 30000);
});

/* Crítica dos dados r3 (07/11, bug "retrato-minutos", achado em scratchpad/critico-dados-r3, R2). A régua do
   "retrato-velho" só olhava o DIA. No MESMO dia, a aba do PC lida às 8h00 e o celular lançando a Padaria: às 8h40 a
   aba volta e lança a Farmácia — a volta pra aba não relia (sincronizado = sai cedo) e o gesto mandava a chave
   inteira do retrato das 8h00. O servidor ficava ['a','farmacia'] e a Padaria sumia. Já existia antes do ramo. */
describe("mesmo dia: a conta lida há mais de 10 min não grava por cima do celular", () => {
  const A = { id: "a", date: "2026-11-06", value: 10, description: "A" };
  const FARMACIA = { id: "farmacia", date: "2026-11-06", value: 30, description: "Farmácia" };

  it("aba lida às 8h00, celular lança Padaria, a aba VOLTA às 8h40 e lança Farmácia: as duas ficam", async () => {
    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    servidor().set("finance-expenses", [A]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    servidor().set("finance-expenses", [A, PADARIA]); // o celular
    vi.setSystemTime(em(2026, 11, 6, 8, 40));
    await voltarPraAba();
    act(() => api.set("finance-expenses", [...api.get<Gasto[]>("finance-expenses", []), FARMACIA]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
    expect(ids(api.get("finance-expenses", []))).toEqual(["a", "padaria", "farmacia"]);
  });

  it("sem voltar pra aba (aba sempre visível): o 1º gesto às 8h40 é juntado com o servidor", async () => {
    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    servidor().set("finance-expenses", [A]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    servidor().set("finance-expenses", [A, PADARIA]);
    vi.setSystemTime(em(2026, 11, 6, 8, 40));
    act(() => api.set("finance-expenses", [...api.get<Gasto[]>("finance-expenses", []), FARMACIA]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
    expect(ids(api.get("finance-expenses", []))).toEqual(["a", "padaria", "farmacia"]);
  });

  it("na tela de Finanças (usePersistedState): a tela mostra as duas", async () => {
    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    servidor().set(CHAVE_CARIMBO_CONTAS, "2026-11");
    servidor().set("finance-expenses", [A]);
    montar(true);
    await waitFor(() => expect(api.loaded).toBe(true));
    await waitFor(() => expect(ids(gastosNaTela)).toEqual(["a"]));
    servidor().set("finance-expenses", [A, PADARIA]);
    vi.setSystemTime(em(2026, 11, 6, 8, 40));
    act(() => setGastosNaTela((p) => [...p, FARMACIA]));
    await esperar(600);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "padaria", "farmacia"]);
    expect(ids(gastosNaTela)).toEqual(["a", "padaria", "farmacia"]);
  });

  it("controle: lida há 5 min, a volta pra aba não relê e o gesto grava na hora", async () => {
    vi.setSystemTime(em(2026, 11, 6, 8, 0));
    servidor().set("finance-expenses", [A]);
    montar();
    await waitFor(() => expect(api.loaded).toBe(true));
    vi.setSystemTime(em(2026, 11, 6, 8, 5));
    await voltarPraAba();
    act(() => api.set("finance-expenses", [A, FARMACIA]));
    await esperar(400);
    expect(leiturasTotais).toBe(1);
    expect(ids(servidor().get("finance-expenses"))).toEqual(["a", "farmacia"]);
  });
});
