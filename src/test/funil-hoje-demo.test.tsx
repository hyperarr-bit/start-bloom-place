/* eslint-disable @typescript-eslint/no-explicit-any -- as sementes são Record<string, any> como no app */
/**
 * /hoje — VARIANTE "demo" (19/10, link `/hoje?v=demo`): depois do número, "Ver meu CORE" abre Finanças de verdade com
 * os números da pessoa (/hoje/demo) e de lá "Quero o meu CORE" → a oferta.
 *
 * O que não pode quebrar:
 *   · sem `?v=demo` o funil é o de antes: "Ver meu CORE" → oferta, eventos com variante "controle";
 *   · com `?v=demo`: a variante fica salva; "Ver meu CORE" → /hoje/demo com a renda e as contas DELA (não as do exemplo);
 *     botão / saída do módulo / folha → a oferta; o "Voltar" da oferta volta pra demo; todo evento com variante "demo";
 *   · /hoje/demo sem o /hoje antes → /hoje;
 *   · /hoje/demo é caminho de demo (o módulo desliga intro/tutorial/Montar); /hoje não;
 *   · o número do Dashboard da demo fica perto do número do funil e nunca negativo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

/* ---------------------------------------------------------------- mocks */
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, isSubscribed: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      getUser: vi.fn(async () => ({ data: { user: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    from: () => ({ select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }), upsert: () => Promise.resolve({ error: null }) }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: vi.fn(), definirEmailDaCompra: vi.fn(), guardarCompraAnonima: vi.fn(async () => {}), vincularCompraAnonima: vi.fn(async () => true), limparBatismo: vi.fn(),
}));
/* Finanças FALSO: lê pelo mesmo useUserData (o contexto do PreviewUserDataProvider) e navega como o módulo de verdade */
vi.mock("@/pages/Index", async () => {
  const { useUserData } = await import("@/hooks/use-user-data");
  const { ehCaminhoDeDemo } = await import("@/lib/caminho-demo");
  return {
    default: function FinancasFalsa() {
      const { get } = useUserData();
      const navigate = useNavigate();
      const { pathname } = useLocation();
      const rendas = get<Array<{ value: number }>>("finance-incomes", []);
      const fixos = get<Array<{ description: string }>>("finance-fixed-expenses", []);
      return (
        <div>
          <p data-testid="falso-demo">{String(ehCaminhoDeDemo(pathname))}</p>
          <p data-testid="falso-renda">{rendas.reduce((s, r) => s + r.value, 0)}</p>
          <p data-testid="falso-fixos">{fixos.map((f) => f.description).join("|")}</p>
          <button type="button" data-testid="falso-ir-auth" onClick={() => navigate("/auth")}>auth</button>
          <button type="button" data-testid="falso-ir-aba" onClick={() => navigate("/financas?aba=investimentos")}>aba</button>
        </div>
      );
    },
  };
});

import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import FunilHojeRota, { _zerarEstadoHoje, CHAVE_ESTADO_HOJE } from "@/pages/hoje/FunilHoje";
import { SEGUNDOS_ATE_A_FOLHA_HOJE } from "@/pages/hoje/DemoHoje";
import { demoDoHoje } from "@/pages/hoje/demo-financas";
import { CONTAS, _zerarForcaHoje, calcular, contasEscolhidas } from "@/pages/hoje/conteudo";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { ehCaminhoDeDemo } from "@/lib/caminho-demo";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { computeDailyBudget, computeLooseBillsOutflow, computeMonthlyOutflow } from "@/lib/finance-totals";
import { praHojeDoDia } from "@/lib/montar-financas";

/* ---------------------------------------------------------------- ambiente */
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };
const montar = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Onde />
      <Routes>
        <Route path="/hoje" element={<FunilHojeRota />} />
        <Route path="/hoje/demo" element={<FunilHojeRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const onde = () => screen.getByTestId("onde").textContent ?? "";
const etapa = () => screen.getByTestId("hoje").getAttribute("data-etapa");
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const cliques = (cta: string) => eventos("funnel_click").filter((e) => e.cta === cta);

const ateResultado = async (url: string) => {
  montar(url);
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  for (const c of ["aluguel", "luz", "internet"]) fireEvent.click(screen.getByTestId(`hoje-conta-${c}`));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
};
const ateDemo = async () => {
  await ateResultado("/hoje?v=demo&utm_source=meta");
  fireEvent.click(screen.getByTestId("hoje-ver-core"));
  await waitFor(() => expect(screen.getByTestId("hoje-demo")).toBeTruthy());
  await waitFor(() => expect(screen.getByTestId("falso-renda")).toBeTruthy());
};

beforeEach(() => {
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarMemoriaPorta();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  vi.mocked(trackEvent).mockClear(); vi.mocked(trackEventBeacon).mockClear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("caminho de demo", () => {
  it("/hoje/demo é demo; /hoje (e o resto do funil) não", () => {
    expect(ehCaminhoDeDemo("/hoje/demo")).toBe(true);
    expect(ehCaminhoDeDemo("/hoje/demo/")).toBe(true);
    expect(ehCaminhoDeDemo("/hoje")).toBe(false);
    expect(ehCaminhoDeDemo("/hojedemo")).toBe(false);
    expect(ehCaminhoDeDemo("/liberar")).toBe(true);
    expect(ehCaminhoDeDemo("/financas")).toBe(false);
  });
});

describe("controle (sem ?v=demo)", () => {
  it("'Ver meu CORE' vai pra oferta como sempre; eventos com variante 'controle'", async () => {
    await ateResultado("/hoje?utm_source=meta");
    fireEvent.click(screen.getByTestId("hoje-ver-core"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(onde()).toBe("/hoje?utm_source=meta");
    expect(screen.queryByTestId("hoje-demo")).toBeNull();
    fireEvent.click(screen.getByTestId("hoje-oferta-voltar"));
    await waitFor(() => expect(etapa()).toBe("resultado"));
    expect(JSON.parse(localStorage.getItem(CHAVE_ESTADO_HOJE) as string).variante).toBeUndefined();
    const todos = vi.mocked(trackEvent).mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(todos.length).toBeGreaterThan(5);
    for (const e of todos) expect(e.variante).toBe("controle");
    expect(eventos("hoje_demo_view")).toHaveLength(0);
  });
});

describe("variante demo (?v=demo)", () => {
  it("'Ver meu CORE' → /hoje/demo: Finanças em modo demo com a renda e as contas DELA", async () => {
    await ateDemo();
    expect(onde()).toBe("/hoje/demo?v=demo&utm_source=meta");
    expect(screen.getByTestId("falso-demo").textContent).toBe("true");
    expect(screen.getByTestId("falso-renda").textContent).toBe("3000");
    expect(screen.getByTestId("falso-fixos").textContent).toBe("Aluguel|Luz|Internet");
    expect(screen.getByTestId("hoje-demo-topo").textContent).toContain("com os seus números");
    expect(eventos("hoje_demo_view")).toHaveLength(1);
    expect(eventos("hoje_demo_view")[0]).toMatchObject({ renda: 3000, n: 3, variante: "demo" });
    expect(eventos("funnel_view").some((e) => e.step === "demo")).toBe(true);
    expect(JSON.parse(localStorage.getItem(CHAVE_ESTADO_HOJE) as string).variante).toBe("demo");
  });

  it("'Quero o meu CORE' → a oferta (com a query); 'Voltar' da oferta → a demo de novo", async () => {
    await ateDemo();
    fireEvent.click(screen.getByTestId("hoje-demo-cta"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(onde()).toBe("/hoje?v=demo&utm_source=meta");
    expect(eventos("hoje_demo_cta")).toHaveLength(1);
    expect(eventos("hoje_demo_cta")[0]).toMatchObject({ via: "botao", variante: "demo" });
    expect(typeof eventos("hoje_demo_cta")[0].segundos).toBe("number");
    expect(cliques("demo_cta")).toHaveLength(1);
    const tempo = vi.mocked(trackEventBeacon).mock.calls.filter((c) => c[0] === "hoje_demo_tempo").map((c) => c[1] as Record<string, unknown>);
    expect(tempo).toHaveLength(1);
    expect(tempo[0]).toMatchObject({ fim: "botao", variante: "demo" });
    fireEvent.click(screen.getByTestId("hoje-oferta-voltar"));
    await waitFor(() => expect(screen.getByTestId("hoje-demo")).toBeTruthy());
    expect(onde()).toBe("/hoje/demo?v=demo&utm_source=meta");
  });

  it("todo evento do /hoje leva variante 'demo' (inclusive hoje_view)", async () => {
    await ateDemo();
    fireEvent.click(screen.getByTestId("hoje-demo-cta"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    const todos = vi.mocked(trackEvent).mock.calls.filter((c) => String(c[0]).startsWith("hoje_") || c[0] === "funnel_view" || c[0] === "funnel_click");
    expect(todos.some((c) => c[0] === "hoje_view")).toBe(true);
    for (const c of todos) expect((c[1] as Record<string, unknown>).variante).toBe("demo");
  });

  it("o módulo tentando sair (login, outro lugar) → a oferta (via desvio); troca de aba do próprio Finanças fica", async () => {
    await ateDemo();
    fireEvent.click(screen.getByTestId("falso-ir-aba"));
    expect(screen.getByTestId("hoje-demo")).toBeTruthy();
    expect(eventos("hoje_demo_cta")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("falso-ir-auth"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(eventos("hoje_demo_cta")[0]).toMatchObject({ via: "desvio" });
  });

  it("aos 40 s, a folha (1x) leva pra oferta (via folha)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await ateDemo();
    expect(screen.queryByTestId("demo-folha")).toBeNull();
    act(() => { vi.advanceTimersByTime(SEGUNDOS_ATE_A_FOLHA_HOJE * 1000 + 50); });
    expect(screen.getByTestId("demo-folha")).toBeTruthy();
    expect(screen.queryByTestId("hoje-demo-cta")).toBeNull(); // o botão fixo sai enquanto a folha está aberta
    expect(eventos("hoje_demo_folha")[0]).toMatchObject({ acao: "vista" });
    fireEvent.click(screen.getByTestId("demo-folha-criar"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(eventos("hoje_demo_cta")[0]).toMatchObject({ via: "folha" });
  });

  it("a variante sobrevive ao recarregar sem a query (volta do app do banco)", async () => {
    await ateResultado("/hoje?v=demo");
    cleanup();
    _zerarEstadoHoje();
    montar("/hoje");
    await waitFor(() => expect(etapa()).toBe("resultado"));
    fireEvent.click(screen.getByTestId("hoje-ver-core"));
    await waitFor(() => expect(screen.getByTestId("hoje-demo")).toBeTruthy());
  });

  it("recarregar /hoje/demo com o /hoje salvo abre a demo; sem nada salvo → /hoje", async () => {
    await ateDemo();
    cleanup();
    _zerarEstadoHoje();
    montar("/hoje/demo");
    await waitFor(() => expect(screen.getByTestId("falso-renda").textContent).toBe("3000"));
    cleanup();
    _zerarEstadoHoje();
    localStorage.clear();
    montar("/hoje/demo?v=demo");
    await waitFor(() => expect(etapa()).toBe("renda"));
    expect(onde()).toBe("/hoje?v=demo");
  });
});

describe("os números da demo (demoDoHoje)", () => {
  const conta = (renda: number, ids: string[], agora: Date) => {
    const contas = contasEscolhidas(Object.fromEntries(ids.map((id) => [id, CONTAS.find((c) => c.id === id)!.valor])));
    const { sementes, porDiaDoFunil, gastoDeHoje } = demoDoHoje(getSeedsForModule("financas"), renda, contas, agora);
    const s = sementes as Record<string, any>;
    const entra = s["finance-incomes"].reduce((t: number, x: any) => t + x.value, 0);
    const fixos = s["finance-fixed-expenses"].reduce((t: number, x: any) => t + x.value, 0);
    const variaveis = s["finance-expenses"].reduce((t: number, x: any) => t + x.value, 0);
    const parcelas = s["finance-installments"].length;
    const sai = computeMonthlyOutflow(variaveis, fixos, 0, computeLooseBillsOutflow(s["finance-dueDays"], s["finance-fixed-expenses"]));
    const b = computeDailyBudget(entra, sai, s["finance-dueDays"], s["finance-fixed-expenses"], agora);
    const pra = praHojeDoDia(entra, sai, gastoDeHoje, s["finance-dueDays"], s["finance-fixed-expenses"], agora);
    return { s, b, pra, porDiaDoFunil, gastoDeHoje, parcelas, r: calcular(renda, contas, agora) };
  };

  it("renda 3000 + aluguel/luz/internet em 19/10: Dashboard ≈ número do funil, 'R$ X do dia' = número do funil", () => {
    const { s, b, pra, porDiaDoFunil, gastoDeHoje, parcelas, r } = conta(3000, ["aluguel", "luz", "internet"], new Date(2026, 9, 19, 12));
    expect(r.porDia).toBe(142);
    expect(porDiaDoFunil).toBe(142);
    expect(parcelas).toBe(0);
    expect(gastoDeHoje).toBeGreaterThan(0);
    expect(b.cantSpend).toBe(false);
    expect(Math.round(b.perDay)).toBeGreaterThanOrEqual(Math.round(r.porDia * 0.95));
    expect(Math.round(b.perDay)).toBeLessThanOrEqual(r.porDia);
    expect(pra?.doDia).toBe(142);
    // nada do exemplo no mês dela: nem as contas, nem o perfil da empresa, nem as contas do MEU MÊS
    const nomes = JSON.stringify([s["finance-fixed-expenses"], s["finance-dueDays"]]);
    expect(nomes).not.toMatch(/Curso de inglês|Plano de saúde|Energia elétrica/);
    expect(s["finance-perfis"]).toEqual([]);
    expect(s["finance-incomes"][0].value).toBe(3000);
    // histórico na escala dela, com sobra positiva
    const hist = Object.keys(s).filter((k) => /^finance-\d{4}-[a-z]+-incomes$/.test(k));
    expect(hist).toHaveLength(4);
    for (const k of hist) {
      const base = k.replace(/-incomes$/, "");
      const ent = s[k][0].value;
      const sai = s[`${base}-fixed`].reduce((t: number, x: any) => t + x.value, 0) + s[`${base}-expenses`].reduce((t: number, x: any) => t + x.value, 0);
      expect(ent).toBe(3000);
      expect(ent - sai).toBeGreaterThan(0);
    }
    // metas/aportes na escala (nada de meta de 45 mil pra quem ganha 3 mil sem escala)
    expect(s["finance-goals"].every((g: any) => g.currentValue <= g.targetValue)).toBe(true);
  });

  it("vários dias e rendas: nunca negativo nem absurdo quando o mês fecha; apertado = o mesmo 'não dá' do funil", () => {
    for (const dia of [1, 15, 28, 31]) {
      for (const [renda, ids] of [[1500, ["aluguel"]], [5500, ["aluguel", "condominio", "cartao", "saude"]], [8000, CONTAS.map((c) => c.id)]] as const) {
        const { b, r } = conta(renda, [...ids], new Date(2026, 9, dia, 12));
        if (r.aperto) { expect(b.cantSpend).toBe(true); continue; }
        expect(b.cantSpend).toBe(false);
        expect(b.perDay).toBeGreaterThan(0);
        expect(b.perDay).toBeLessThanOrEqual(r.porDia + 0.5);
        expect(b.perDay).toBeGreaterThanOrEqual(r.porDia * 0.9);
      }
    }
    const { b } = conta(1500, ["aluguel", "cartao", "carro"], new Date(2026, 9, 10, 12));
    expect(b.cantSpend).toBe(true);
  });
});
