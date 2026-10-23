/**
 * /hoje · teste da 1ª pergunta (22/10, chave HOJE_P1 em src/pages/hoje/conteudo.ts).
 *   · "off" (padrão): o funil de sempre — a 1ª tela é a renda e NENHUM evento ganha o campo `p1`;
 *   · "leve" (`?hoje-p1=leve`): "Qual gasto mais te pega?" → renda (2 de 3) → contas (3 de 3) → resultado citando o gasto →
 *     oferta; todo evento com `p1: "leve"`;
 *   · "ab" (`?hoje-p1=ab`): 50/50 sorteado 1x, guardado no estado; todo evento com o braço.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authState = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      getUser: vi.fn(async () => ({ data: { user: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
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

import { trackEvent } from "@/lib/analytics";
import FunilHojeRota, { CHAVE_ESTADO_HOJE, _zerarEstadoHoje } from "@/pages/hoje/FunilHoje";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { GASTOS_P1, HOJE_P1, _forcarOfertaHoje, _zerarForcaHoje, _zerarForcaP1, bracoP1, modoP1 } from "@/pages/hoje/conteudo";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";

const irPara = (url: string) => window.history.replaceState({}, "", url);
const montar = (extra = "") => {
  irPara(`/hoje?funil-hoje=on&ofertas=off&utm_source=meta&utm_campaign=hoje${extra}`);
  return render(
    <MemoryRouter initialEntries={["/hoje"]}>
      <Routes>
        <Route path="/hoje" element={<FunilHojeRota />} />
        <Route path="/" element={<div data-testid="landing">landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
const etapa = () => screen.getByTestId("hoje").getAttribute("data-etapa");
const texto = () => document.body.textContent ?? "";
const chamadas = () => vi.mocked(trackEvent).mock.calls.map((c) => [c[0], c[1] as Record<string, unknown>] as const);
const eventos = (nome: string) => chamadas().filter((c) => c[0] === nome).map((c) => c[1]);

const ateResultado = async () => {
  fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
  await waitFor(() => expect(etapa()).toBe("contas"));
  for (const c of ["aluguel", "luz"]) fireEvent.click(screen.getByTestId(`hoje-conta-${c}`));
  fireEvent.click(screen.getByTestId("hoje-ver-numero"));
  await waitFor(() => expect(etapa()).toBe("resultado"));
};

beforeEach(() => {
  _zerarEstadoHoje(); _zerarForcaHoje(); _zerarForcaP1(); _zerarCopiaSessao(); _zerarMemoriaPorta(); _forcarOfertaHoje(null);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  vi.mocked(trackEvent).mockClear();
});
afterEach(() => { cleanup(); irPara("/"); });

describe("a chave HOJE_P1", () => {
  it("padrão DESLIGADA", () => {
    expect(HOJE_P1).toBe("leve"); // ligada pra todos em 22/10
    expect(modoP1("")).toBe("leve");
  });
  it("?hoje-p1= liga/desliga e fica no navegador (heap + storage)", () => {
    expect(modoP1("?hoje-p1=leve")).toBe("leve");
    expect(modoP1("")).toBe("leve");
    localStorage.clear(); // Instagram zera o storage: o heap segura
    expect(modoP1("")).toBe("leve");
    expect(modoP1("?hoje-p1=ab")).toBe("ab");
    expect(modoP1("?hoje-p1=off")).toBe("off");
    expect(modoP1("")).toBe("off");
    expect(modoP1("?hoje-p1=qualquer")).toBe("off");
  });
  it("bracoP1: off → null, leve → leve, ab sorteia 50/50 e mantém o sorteado", () => {
    expect(bracoP1("off", "leve")).toBeNull();
    expect(bracoP1("leve", "controle")).toBe("leve");
    expect(bracoP1("ab", null, () => 0.2)).toBe("leve");
    expect(bracoP1("ab", null, () => 0.7)).toBe("controle");
    expect(bracoP1("ab", "controle", () => 0.1)).toBe("controle");
  });
});

describe("off: o /hoje de sempre", () => {
  it("1ª tela = renda (1 de 2), nenhum evento com p1, estado sem p1/gasto", async () => {
    modoP1("?hoje-p1=off"); // a chave está em "leve" desde 22/10: o modo antigo agora só pela força
    montar();
    expect(etapa()).toBe("renda");
    expect(screen.queryByTestId("hoje-p1")).toBeNull();
    expect(texto()).toContain("Quanto entra por mês?");
    expect(texto()).toContain("1 de 2");
    expect(texto()).toContain("quanto você pode gastar hoje");
    await ateResultado();
    expect(screen.queryByTestId("hoje-p1-dica")).toBeNull();
    fireEvent.click(screen.getByTestId("hoje-ver-core"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(chamadas().length).toBeGreaterThan(5);
    for (const [, dados] of chamadas()) expect(dados).not.toHaveProperty("p1");
    expect(eventos("hoje_resultado")[0]).not.toHaveProperty("gasto");
    expect(eventos("hoje_gasto")).toHaveLength(0);
    expect(eventos("funnel_view").map((e) => e.step)).toEqual(["renda", "contas", "resultado", "oferta"]);
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO_HOJE) ?? "{}");
    expect(salvo).not.toHaveProperty("p1");
    expect(salvo).not.toHaveProperty("gasto");
  });
});

describe("leve: a 1ª pergunta sem dinheiro", () => {
  it("pergunta leve → renda (2 de 3) → contas (3 de 3) → resultado com o gasto → oferta, tudo com p1=leve", async () => {
    montar("&hoje-p1=leve");
    expect(etapa()).toBe("gasto");
    expect(texto()).toContain("Qual gasto mais te pega?");
    expect(texto()).toContain("1 de 3");
    for (const g of GASTOS_P1) expect(screen.getByTestId(`hoje-gasto-${g.id}`)).toBeTruthy();
    expect(texto()).not.toContain("Quanto entra por mês?");

    fireEvent.click(screen.getByTestId("hoje-gasto-delivery"));
    await waitFor(() => expect(etapa()).toBe("renda"));
    expect(texto()).toContain("Quanto entra por mês?");
    expect(texto()).toContain("2 de 3");
    expect(eventos("hoje_gasto")[0]).toMatchObject({ gasto: "delivery", p1: "leve" });

    // voltar da renda leva à pergunta leve, com a escolha marcada
    fireEvent.click(screen.getByTestId("hoje-renda-voltar"));
    await waitFor(() => expect(etapa()).toBe("gasto"));
    expect(screen.getByTestId("hoje-gasto-delivery").hasAttribute("data-on")).toBe(true);
    fireEvent.click(screen.getByTestId("hoje-gasto-delivery"));
    await waitFor(() => expect(etapa()).toBe("renda"));

    fireEvent.click(screen.getByTestId("hoje-faixa-2a4"));
    await waitFor(() => expect(etapa()).toBe("contas"));
    expect(texto()).toContain("3 de 3");
    fireEvent.click(screen.getByTestId("hoje-conta-aluguel"));
    fireEvent.click(screen.getByTestId("hoje-ver-numero"));
    await waitFor(() => expect(etapa()).toBe("resultado"));
    const dica = screen.getByTestId("hoje-p1-dica");
    expect(dica.textContent).toContain("O que mais te pega: comida e delivery");
    expect(eventos("hoje_resultado")[0]).toMatchObject({ gasto: "delivery", p1: "leve" });

    fireEvent.click(screen.getByTestId("hoje-ver-core"));
    await waitFor(() => expect(etapa()).toBe("oferta"));
    expect(screen.getByTestId("hoje-pagar")).toBeTruthy();

    expect(eventos("funnel_view").map((e) => e.step)).toEqual(["gasto", "renda", "gasto", "renda", "contas", "resultado", "oferta"]);
    for (const [, dados] of chamadas()) expect(dados).toMatchObject({ p1: "leve" });
    expect(eventos("hoje_view")[0]).toMatchObject({ p1: "leve", retomou: null });
  });
});

describe("ab: 50/50 por sessão", () => {
  it("sorteia 1x, guarda no estado e marca todo evento com o braço", () => {
    const sorteio = vi.spyOn(Math, "random").mockReturnValue(0.9);
    montar("&hoje-p1=ab");
    expect(etapa()).toBe("renda"); // braço controle = o funil de sempre
    expect(screen.queryByTestId("hoje-p1")).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHAVE_ESTADO_HOJE) ?? "{}").p1).toBe("controle");
    expect(chamadas().length).toBeGreaterThan(0);
    for (const [, dados] of chamadas()) expect(dados).toMatchObject({ p1: "controle" });
    cleanup();

    // recarregou: o sorteio não roda de novo
    sorteio.mockReturnValue(0.1);
    vi.mocked(trackEvent).mockClear();
    _zerarEstadoHoje();
    montar();
    expect(etapa()).toBe("renda");
    for (const [, dados] of chamadas()) expect(dados).toMatchObject({ p1: "controle" });
    cleanup();

    // outra pessoa (estado zerado): cai no leve
    _zerarEstadoHoje(); localStorage.removeItem(CHAVE_ESTADO_HOJE);
    vi.mocked(trackEvent).mockClear();
    montar();
    expect(etapa()).toBe("gasto");
    expect(chamadas().length).toBeGreaterThan(0);
    for (const [, dados] of chamadas()) expect(dados).toMatchObject({ p1: "leve" });
    sorteio.mockRestore();
  });
});
