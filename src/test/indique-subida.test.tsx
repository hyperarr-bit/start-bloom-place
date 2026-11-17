/**
 * INDIQUE E GANHE — a SUBIDA de 17/11 (dono: "essa tela vê em qual parte fica no app e ensinar o usuário a ir lá"):
 *   - quem pode: QUALQUER cliente pagante (web, Pix, cartão, loja) — teste grátis da loja e código grátis não;
 *   - o link pela conta (1 por conta, comprador_pi "conta:<uid>"), sem senha (a prova é o login);
 *   - a linha na Você do SITE com o selo "Novo" (some ao tocar), o pontinho e o balão de 1 vez só;
 *   - o caminho "Você → Indique e ganhe" no painel, no e-mail de acesso e na tela "link pronto" da /oferta.
 * (A loja nunca mostra nada: src/test/indique-loja.test.tsx.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
const subsDaConta = { data: [] as unknown[], error: null as unknown };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({ select: () => ({ eq: async () => subsDaConta }) }),
  },
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web", isIOS: () => false, isAndroid: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1", email: "ana@exemplo.com" }, session: null, loading: false }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));

import {
  CAMINHO_NO_APP, blocoIndiqueEmail, chaveLinkDaConta, ehPagante, linkDaContaPagante, linkJaDaConta,
} from "../../supabase/functions/_shared/indique";
import {
  balaoIndiqueDevido, gravarMarcaNovo, lerMarcaNovo, pontoIndiqueDevido, seloNovoNaLinha, DIAS_SELO_NOVO,
} from "@/lib/indique-entrada";
import { EntradaIndique } from "@/components/indique/EntradaIndique";
import { BalaoNaAbaVoce, ESPERA_BALAO_INDIQUE_MS, DURA_BALAO_INDIQUE_MS, useAvisoNovoIndique } from "@/components/indique/AvisoNovoIndique";
import { __zerarElegivelIndique } from "@/components/indique/use-indique-elegivel";
import { PainelIndiqueVista } from "@/pages/IndiquePainel";
import { PAINEL_INDIQUE_EXEMPLO } from "@/lib/afiliados";

const AGORA = new Date("2026-11-17T15:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() + n * 86400e3).toISOString();

beforeEach(() => { localStorage.clear(); invoke.mockReset(); subsDaConta.data = []; subsDaConta.error = null; __zerarElegivelIndique(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("quem é cliente pagante (ehPagante — a mesma regra no app e no servidor)", () => {
  it("vitalício do site (Stripe ou Pix), anual/mensal da loja já cobrado, atrasado (past_due) = sim", () => {
    expect(ehPagante([{ status: "active", payment_method: "stripe", plan: "lifetime", amount_cents: 6790 }], AGORA)).toBe(true);
    expect(ehPagante([{ status: "active", payment_method: "pix", billing_period: "lifetime", amount_cents: 2790 }], AGORA)).toBe(true);
    expect(ehPagante([{ status: "active", payment_method: "play_store", billing_period: "annual", amount_cents: 9790, current_period_start: dias(-40), current_period_end: dias(325) }], AGORA)).toBe(true);
    expect(ehPagante([{ status: "past_due", payment_method: "stripe", billing_period: "monthly", amount_cents: 1990, current_period_start: dias(-31), current_period_end: dias(1) }], AGORA)).toBe(true);
  });
  it("teste grátis da loja (3 dias), código grátis, valor 0, vencida, cancelada, sem linha = não", () => {
    expect(ehPagante([{ status: "active", payment_method: "play_store", billing_period: "annual", amount_cents: 9790, current_period_start: dias(-1), current_period_end: dias(2) }], AGORA)).toBe(false);
    expect(ehPagante([{ status: "active", payment_method: "codigo", billing_period: "CORE30", amount_cents: 0, current_period_end: dias(20) }], AGORA)).toBe(false);
    expect(ehPagante([{ status: "active", payment_method: "pix", billing_period: "monthly", amount_cents: 0, current_period_end: dias(20) }], AGORA)).toBe(false);
    expect(ehPagante([{ status: "active", payment_method: "stripe", billing_period: "monthly", amount_cents: 1990, current_period_end: dias(-1) }], AGORA)).toBe(false);
    expect(ehPagante([{ status: "canceled", payment_method: "stripe", plan: "lifetime", amount_cents: 6790 }], AGORA)).toBe(false);
    expect(ehPagante([], AGORA)).toBe(false);
    expect(ehPagante(null, AGORA)).toBe(false);
  });
});

/* banco falso: só o que linkDaContaPagante/linkJaDaConta usam */
function bancoFalso(o: { afiliados?: Array<Record<string, unknown>>; subs?: unknown[]; conflitos?: number }) {
  const linhas = [...(o.afiliados ?? [])];
  let conflitos = o.conflitos ?? 0;
  const inseridos: Array<Record<string, unknown>> = [];
  const consulta = (tabela: string) => {
    const filtros: Array<[string, unknown]> = [];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
      order: () => q,
      limit: async () => ({ data: linhas.filter((l) => filtros.every(([c, v]) => l[c] === v)) }),
      maybeSingle: async () => ({ data: linhas.find((l) => filtros.every(([c, v]) => l[c] === v)) ?? null }),
      then: (r: (x: unknown) => void) => r(tabela === "subscriptions" ? { data: o.subs ?? [], error: null } : { data: [] }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (conflitos > 0) { conflitos--; return { data: null, error: { code: "23505" } }; }
            inseridos.push(row); linhas.push({ ...row, pausado: false });
            return { data: { codigo: row.codigo, token_painel: row.token_painel }, error: null };
          },
        }),
      }),
    };
    return q;
  };
  return { admin: { from: consulta }, inseridos };
}
const gerar = () => { let n = 0; return { codigo: () => `COD${++n}`, token: () => `t${"x".repeat(40)}${n}` }; };

describe("o link pela conta (indique_conta, pra quem não comprou na /oferta)", () => {
  const anual = { status: "active", payment_method: "play_store", billing_period: "annual", amount_cents: 9790, current_period_start: dias(-40), current_period_end: dias(325) };
  it("pagante sem link: cria 1, com a chave conta:<uid>, a conta e o e-mail (as travas de autoindicação)", async () => {
    const b = bancoFalso({ subs: [anual] });
    const l = await linkDaContaPagante(b.admin, "uid-9", "Ana@Exemplo.com", AGORA, gerar());
    expect(l).toMatchObject({ codigo: "COD1", novo: true });
    expect(b.inseridos[0]).toMatchObject({ origem: "comprador", comprador_pi: chaveLinkDaConta("uid-9"), comprador_user_id: "uid-9", comprador_email: "ana@exemplo.com", pix_chave: null });
  });
  it("já tem: devolve o mesmo (nunca 2 links pra mesma conta)", async () => {
    const b = bancoFalso({ subs: [anual], afiliados: [{ comprador_pi: "conta:uid-9", codigo: "ANA7K2", token_painel: "tok", pausado: false }] });
    expect(await linkDaContaPagante(b.admin, "uid-9", null, AGORA, gerar())).toMatchObject({ codigo: "ANA7K2", novo: false });
    expect(b.inseridos).toHaveLength(0);
  });
  it("teste grátis da loja: não cria (nao_pagante)", async () => {
    const b = bancoFalso({ subs: [{ ...anual, current_period_start: dias(-1), current_period_end: dias(2) }] });
    expect(await linkDaContaPagante(b.admin, "uid-9", null, AGORA, gerar())).toBe("nao_pagante");
    expect(b.inseridos).toHaveLength(0);
  });
  it("código repetido no banco: sorteia outro", async () => {
    const b = bancoFalso({ subs: [anual], conflitos: 1 });
    expect(await linkDaContaPagante(b.admin, "uid-9", null, AGORA, gerar())).toMatchObject({ codigo: "COD2", novo: true });
  });
  it("linkJaDaConta: o link que a conta já tem (da /oferta ou pela conta)", async () => {
    const b = bancoFalso({ afiliados: [{ origem: "comprador", comprador_user_id: "uid-9", pausado: false, codigo: "OFE123", token_painel: "tk" }] });
    expect(await linkJaDaConta(b.admin, "uid-9")).toMatchObject({ codigo: "OFE123" });
    expect(await linkJaDaConta(b.admin, "uid-0")).toBeNull();
  });
});

describe("o 'Novo' de 1 vez só (regras puras)", () => {
  it("balão só antes de tudo; pontinho até ver a linha; selo até tocar (ou 10 dias depois de ver)", () => {
    expect(balaoIndiqueDevido({})).toBe(true);
    expect(balaoIndiqueDevido({ balao: true })).toBe(false);
    expect(balaoIndiqueDevido({ voce: 1 })).toBe(false); // achou sozinha: sem balão
    expect(balaoIndiqueDevido(null)).toBe(false); // sem storage: nunca (não dá pra garantir 1 vez só)
    expect(pontoIndiqueDevido({ balao: true })).toBe(true);
    expect(pontoIndiqueDevido({ voce: 1 })).toBe(false);
    const viu = AGORA.getTime();
    expect(seloNovoNaLinha({ voce: viu }, viu + 86400e3)).toBe(true);
    expect(seloNovoNaLinha({ voce: viu }, viu + DIAS_SELO_NOVO * 86400e3 + 1)).toBe(false);
    expect(seloNovoNaLinha({ voce: viu, aberto: true }, viu)).toBe(false);
  });
});

describe("a linha na Você do site", () => {
  const pagante = [{ status: "active", payment_method: "play_store", billing_period: "annual", amount_cents: 9790, current_period_start: dias(-40), current_period_end: "2099-01-01T00:00:00Z" }];
  it("cliente pagante da LOJA (sem compra na /oferta) vê a linha com 'Novo'; o toque pede o painel e o 'Novo' some", async () => {
    localStorage.setItem("indique-entrada-force", "on");
    subsDaConta.data = pagante;
    invoke.mockResolvedValue({ data: { ok: true, painel: "https://www.coreaplicativo.com.br/indique/tok123" } });
    render(<MemoryRouter><EntradaIndique estilo="e" /></MemoryRouter>);
    const linha = await screen.findByTestId("entrada-indique");
    expect(screen.getByTestId("entrada-indique-novo")).toHaveTextContent("Novo");
    expect(lerMarcaNovo("uid-1")?.voce).toBeGreaterThan(0); // viu a linha: o pontinho da aba some
    fireEvent.click(linha);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("afiliados", { body: { action: "indique_conta" } }));
    await waitFor(() => expect(screen.queryByTestId("entrada-indique-novo")).toBeNull());
    expect(lerMarcaNovo("uid-1")?.aberto).toBe(true);
  });
  it("quem ainda não pagou (teste grátis) não vê nada", async () => {
    localStorage.setItem("indique-entrada-force", "on");
    subsDaConta.data = [{ ...pagante[0], current_period_start: dias(-1), current_period_end: dias(2) }];
    render(<MemoryRouter><EntradaIndique estilo="classico" /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId("entrada-indique")).toBeNull();
  });
  it("chave desligada (padrão): nem consulta", async () => {
    subsDaConta.data = pagante;
    render(<MemoryRouter><EntradaIndique estilo="menu" /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("entrada-indique")).toBeNull();
  });
});

function Balao({ pode = true }: { pode?: boolean }) {
  const a = useAvisoNovoIndique("aba", pode);
  return <div>{a.ponto && <span data-testid="ponto" />}{a.balao && <BalaoNaAbaVoce onToque={a.usar} />}</div>;
}
describe("o balão 'Novo: Indique e ganhe' (1 vez só)", () => {
  it("aparece depois da espera, marca na hora (reabrir não repete) e some sozinho", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("indique-entrada-force", "on");
    subsDaConta.data = [{ status: "active", payment_method: "stripe", plan: "lifetime", amount_cents: 6790 }];
    const { unmount } = render(<Balao />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_BALAO_INDIQUE_MS + 50); });
    expect(screen.getByTestId("indique-novo-balao")).toHaveTextContent("Novo: Indique e ganhe");
    expect(screen.getByTestId("indique-novo-balao")).toHaveTextContent("R$ 33,95 por amiga");
    expect(screen.getByTestId("ponto")).toBeInTheDocument();
    expect(lerMarcaNovo("uid-1")?.balao).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(DURA_BALAO_INDIQUE_MS + 50); });
    expect(screen.queryByTestId("indique-novo-balao")).toBeNull();
    unmount();
    render(<Balao />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_BALAO_INDIQUE_MS * 3); });
    expect(screen.queryByTestId("indique-novo-balao")).toBeNull(); // 1 vez só
    expect(screen.getByTestId("ponto")).toBeInTheDocument(); // o pontinho fica até ela ver a linha
    act(() => { gravarMarcaNovo("uid-1", { voce: Date.now() }); });
    expect(screen.queryByTestId("ponto")).toBeNull();
  });
  it("com algo por cima (folha aberta) espera; sem pagar, nunca", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("indique-entrada-force", "on");
    subsDaConta.data = [];
    render(<Balao />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_BALAO_INDIQUE_MS * 3); });
    expect(screen.queryByTestId("indique-novo-balao")).toBeNull();
    expect(screen.queryByTestId("ponto")).toBeNull();
    cleanup(); __zerarElegivelIndique();
    subsDaConta.data = [{ status: "active", payment_method: "stripe", plan: "lifetime", amount_cents: 6790 }];
    const folha = document.createElement("div"); folha.setAttribute("role", "dialog"); document.body.appendChild(folha);
    render(<Balao />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_BALAO_INDIQUE_MS + 1500); });
    expect(screen.queryByTestId("indique-novo-balao")).toBeNull();
    folha.remove();
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(screen.getByTestId("indique-novo-balao")).toBeInTheDocument();
  });
});

describe("o caminho ensinado em todo lugar", () => {
  it("e-mail de acesso, painel e a frase", () => {
    expect(CAMINHO_NO_APP).toBe("Você → Indique e ganhe");
    expect(blocoIndiqueEmail()).toContain(CAMINHO_NO_APP);
    render(<PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={vi.fn()} agora={new Date("2026-11-23T15:00:00Z")} estilo="c" />);
    expect(blocoIndiqueEmail()).toContain("coreaplicativo.com.br/indique");
    expect(blocoIndiqueEmail()).not.toMatch(/aberto no site/);
    expect(screen.getByTestId("indique-caminho")).toHaveTextContent("Perdeu o link? Entre em coreaplicativo.com.br/indique e digite seu e-mail.");
    expect(screen.getByTestId("indique-caminho")).toHaveTextContent("ou, no computador");
    cleanup();
    render(<PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, pix: { cadastrado: false, tipo: null, final: null } }} salvarPix={vi.fn()} agora={new Date("2026-11-23T15:00:00Z")} estilo="c" />);
    const abrirPix = screen.queryByTestId("pix-abrir"); if (abrirPix) fireEvent.click(abrirPix);
    expect(screen.getByTestId("pix-lgpd")).toHaveTextContent("Usamos sua chave só para pagar suas comissões");
    expect(screen.getByTestId("pix-lgpd").querySelector("a")!.getAttribute("href")).toBe("/privacidade#indique");
    expect(screen.getByTestId("indique-caminho")).toHaveTextContent("Você");
    expect(screen.getByTestId("indique-caminho")).toHaveTextContent("Indique e ganhe");
  });
});
