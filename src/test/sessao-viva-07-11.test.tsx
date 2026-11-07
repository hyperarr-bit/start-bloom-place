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
    await esperar(400); // o envio do gesto sai (o retrato da releitura foi tirado ANTES dele)
    expect(servidor().get("todo-list")).toEqual([{ id: "t0" }, { id: "t1" }]);
    expect(leiturasTotais).toBe(2);
    await act(async () => { soltarLeitura?.(); });
    await esperar(400);
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
