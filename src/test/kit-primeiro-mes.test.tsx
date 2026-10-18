/**
 * KIT PRIMEIRO MÊS ORGANIZADO (18/10) — order bump de R$ 9,90 do funil web.
 * Trava: só quem tem `core-kit-primeiro-mes` = { comprado: true } vê alguma
 * coisa; o plano de 30 dias anda pelo dia da compra; os desafios das 4 semanas
 * entram 1x por segunda sem atropelar a escolha da pessoa; a planilha de
 * dívidas ordena pela bola de neve e exporta CSV que abre no Excel.
 *
 * Rodar com: TZ=America/Sao_Paulo npx vitest run src/test/kit-primeiro-mes.test.tsx
 */
process.env.TZ = "America/Sao_Paulo";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-kit" }, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    from: () => {
      const q: any = {
        select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, gte: () => q, lte: () => q,
        maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }),
        update: () => q, delete: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      };
      return q;
    },
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { useDesafioDoKit } from "@/hooks/use-kit-primeiro-mes";
import Index from "@/pages/Index";
import {
  CHAVE_KIT, CHAVE_KIT_DIVIDAS, CHAVE_KIT_PROGRESSO, PLANO_30_DIAS, agendaDosDesafios, desafioDoKitParaAplicar, diaDoPlano,
  dividasEmCSV, kitLiberado, lerProgresso, ordemBolaDeNeve, segundaDoDesafio1, simularBolaDeNeve, type Divida,
} from "@/lib/kit-primeiro-mes";
import { CHALLENGES, EMPTY_CHALLENGES, type ChallengesState } from "@/components/challenges/challenges";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

const quando = (a: number, m: number, d: number, h = 10) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(a, m - 1, d, h, 0));
};

type Controle = { dados: () => Record<string, unknown>; sistema: string[] };
const Provedor = ({ inicial, controle, children }: { inicial: Record<string, unknown>; controle: Controle; children?: React.ReactNode }) => {
  const [store, setStore] = useState<Record<string, unknown>>(() => ({ ...inicial }));
  const ref = useRef<Record<string, unknown>>({ ...inicial });
  const get = useCallback(<T,>(k: string, fb: T): T => (k in store ? (store[k] as T) : fb), [store]);
  const set = useCallback((k: string, v: unknown, opts?: { system?: boolean }) => {
    ref.current = { ...ref.current, [k]: v };
    if (opts?.system) controle.sistema.push(k);
    setStore((prev) => ({ ...prev, [k]: v }));
  }, [controle]);
  controle.dados = () => ref.current;
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};
const novoControle = (): Controle => ({ dados: () => ({}), sistema: [] });
const montarFinancas = (inicial: Record<string, unknown>, c = novoControle()) => {
  render(
    <MemoryRouter initialEntries={["/financas"]}>
      <Provedor inicial={{ "spotlight-done-financas": "true", ...inicial }} controle={c}>
        <Routes><Route path="/financas" element={<Index />} /></Routes>
      </Provedor>
    </MemoryRouter>,
  );
  return c;
};

describe("o plano de 30 dias", () => {
  it("30 tarefas, dias 1..30, cada uma com destino em Finanças", () => {
    expect(PLANO_30_DIAS.map((t) => t.dia)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const t of PLANO_30_DIAS) {
      expect(t.titulo.length).toBeGreaterThan(5);
      expect(t.destino.aba).toMatch(/^(dashboard|financeiro|limites|itens|saude|relatorios|kit)$/);
    }
  });
  it("texto honesto: nada de 'sair das dívidas' nem IA", () => {
    const tudo = JSON.stringify(PLANO_30_DIAS).toLowerCase();
    expect(tudo).not.toMatch(/sair das d[ií]vidas|livre das d[ií]vidas|\bia\b|intelig[eê]ncia artificial/);
  });
  it("dia do plano: 1 no dia da compra, conta pelo calendário local", () => {
    expect(diaDoPlano("2026-10-18", new Date(2026, 9, 18, 23, 50))).toBe(1);
    expect(diaDoPlano("2026-10-18", new Date(2026, 9, 19, 0, 10))).toBe(2);
    expect(diaDoPlano("2026-10-18", new Date(2026, 10, 16, 9))).toBe(30);
  });
  it("só libera com comprado === true", () => {
    expect(kitLiberado({ comprado: true, em: "2026-10-18T13:00:00Z" })).toBe(true);
    expect(kitLiberado({ comprado: "true" })).toBe(false);
    expect(kitLiberado(null)).toBe(false);
    expect(kitLiberado(true)).toBe(false);
  });
});

describe("desafios das 4 semanas", () => {
  it("compra de segunda/terça começa nesta semana; de quarta em diante, na próxima segunda", () => {
    expect(segundaDoDesafio1("2026-10-19")).toBe("2026-10-19"); // segunda
    expect(segundaDoDesafio1("2026-10-20")).toBe("2026-10-19"); // terça
    expect(segundaDoDesafio1("2026-10-21")).toBe("2026-10-26"); // quarta
    expect(segundaDoDesafio1("2026-10-18")).toBe("2026-10-19"); // domingo
  });
  it("as 4 chaves existem no catálogo e são diferentes", () => {
    const ag = agendaDosDesafios("2026-10-18");
    expect(ag.map((a) => a.weekStart)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(new Set(ag.map((a) => a.key)).size).toBe(4);
    for (const a of ag) expect(CHALLENGES.some((c) => c.key === a.key)).toBe(true);
  });
  it("põe o desafio da semana 1x; respeita quem já escolheu; espera a semana passada fechar", () => {
    const p = lerProgresso(null, "2026-10-18");
    const seg = new Date(2026, 9, 19, 9);
    const r = desafioDoKitParaAplicar(EMPTY_CHALLENGES, p, seg)!;
    expect(r.estado?.active).toEqual({ key: "registro-5-dias", weekStart: "2026-10-19" });
    expect(r.progresso.desafios).toEqual(["2026-10-19"]);
    // já tratada → nada (a pessoa pode trocar sem o kit insistir)
    expect(desafioDoKitParaAplicar({ active: null, history: [] }, r.progresso, seg)).toBeNull();
    // já escolheu outro nesta semana → só marca
    const escolheu: ChallengesState = { active: { key: "sem-delivery", weekStart: "2026-10-19" }, history: [] };
    const r2 = desafioDoKitParaAplicar(escolheu, p, seg)!;
    expect(r2.estado).toBeNull();
    expect(r2.progresso.desafios).toEqual(["2026-10-19"]);
    // ativo de semana passada ainda aberto → espera o fechamento
    const velho: ChallengesState = { active: { key: "sem-delivery", weekStart: "2026-10-12" }, history: [] };
    expect(desafioDoKitParaAplicar(velho, p, seg)).toBeNull();
    // fora das 4 semanas → nada
    expect(desafioDoKitParaAplicar(EMPTY_CHALLENGES, p, new Date(2026, 10, 17, 9))).toBeNull();
  });
  it("o hook na abertura do app grava o desafio (sistema) e não regrava", async () => {
    quando(2026, 10, 26);
    const c = novoControle();
    const Abertura = () => { useDesafioDoKit(); return <p>app</p>; };
    render(<Provedor inicial={{ [CHAVE_KIT]: { comprado: true, em: "2026-10-18T15:00:00-03:00" } }} controle={c}><Abertura /></Provedor>);
    await act(async () => {});
    const d = c.dados()["finance-challenges"] as ChallengesState;
    expect(d.active).toEqual({ key: "sem-delivery", weekStart: "2026-10-26" });
    expect(c.sistema).toContain("finance-challenges");
    expect((c.dados()[CHAVE_KIT_PROGRESSO] as any).desafios).toEqual(["2026-10-26"]);
  });
  it("sem kit, o hook não escreve nada", async () => {
    quando(2026, 10, 26);
    const c = novoControle();
    const Abertura = () => { useDesafioDoKit(); return <p>app</p>; };
    render(<Provedor inicial={{}} controle={c}><Abertura /></Provedor>);
    await act(async () => {});
    expect(c.dados()).toEqual({});
  });
});

describe("planilha de dívidas", () => {
  const dividas: Divida[] = [
    { id: "a", nome: "Cartão", saldo: 3000, juros: 12, parcela: 400 },
    { id: "b", nome: "Loja", saldo: 600, juros: 0, parcela: 100 },
    { id: "c", nome: "Empréstimo", saldo: 1500, juros: 3, parcela: 150 },
  ];
  it("bola de neve: a menor primeiro", () => {
    expect(ordemBolaDeNeve(dividas).map((d) => d.nome)).toEqual(["Loja", "Empréstimo", "Cartão"]);
  });
  it("simulação: a parcela livre vai pra próxima; parcela que não cobre juros = não fecha", () => {
    const fim = simularBolaDeNeve(dividas);
    expect(fim.b).toBe(6);
    expect(fim.c!).toBeGreaterThan(6);
    expect(fim.a!).toBeGreaterThan(fim.c!);
    expect(simularBolaDeNeve([{ id: "x", nome: "Rotativo", saldo: 5000, juros: 15, parcela: 500 }]).x).toBeNull();
  });
  it("CSV abre no Excel BR: BOM, ponto e vírgula, decimal com vírgula, na ordem", () => {
    const csv = dividasEmCSV(dividas);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('1;"Loja";600,00;0,00;100,00;0,00;');
    expect(csv.indexOf('"Loja"')).toBeLessThan(csv.indexOf('"Cartão"'));
  });
});

describe("na tela de Finanças", () => {
  it("SEM o kit: nenhuma aba, linha ou cadeado do kit", async () => {
    quando(2026, 10, 20);
    montarFinancas({});
    await act(async () => {});
    expect(screen.queryByText(/KIT 30 DIAS/)).toBeNull();
    expect(screen.queryByTestId("kit-hoje-painel")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Kit Primeiro/i);
  });

  it("COM o kit: aba própria, dia de hoje destacado, marcar grava como sistema", async () => {
    quando(2026, 10, 20); // comprou dia 18 → dia 3
    const c = montarFinancas({ [CHAVE_KIT]: { comprado: true, em: "2026-10-18T15:00:00-03:00" } });
    await act(async () => {});
    // linha no Painel (Finanças), não na Home
    expect(screen.getByTestId("kit-hoje-painel").textContent).toContain("DIA 3");
    fireEvent.click(screen.getByText("📒 KIT 30 DIAS"));
    await act(async () => {});
    expect(screen.getByText("Dia 3 de 30")).toBeTruthy();
    expect(screen.getByTestId("kit-dia-3").getAttribute("data-hoje")).toBe("true");
    // dia futuro não marca
    const futuro = screen.getByTestId("kit-dia-10").querySelector("button")!;
    expect((futuro as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("Marcar feito"));
    await act(async () => {});
    const prog = c.dados()[CHAVE_KIT_PROGRESSO] as any;
    expect(Object.keys(prog.feitos)).toEqual(["3"]);
    expect(c.sistema).toContain(CHAVE_KIT_PROGRESSO);
    expect(screen.getByText("1 de 30 tarefas feitas", { exact: false })).toBeTruthy();
  });

  it("planilha: adicionar 2 dívidas mostra a menor como 'comece por esta'", async () => {
    quando(2026, 10, 20);
    const c = montarFinancas({ [CHAVE_KIT]: { comprado: true, em: "2026-10-18T15:00:00-03:00" } });
    await act(async () => {});
    fireEvent.click(screen.getByText("📒 KIT 30 DIAS"));
    await act(async () => {});
    const add = (nome: string, saldo: string, juros: string, parcela: string) => {
      fireEvent.click(screen.getByTestId("kit-dividas-adicionar"));
      const form = screen.getByTestId("kit-dividas-form");
      const inputs = form.querySelectorAll("input");
      fireEvent.change(inputs[0], { target: { value: nome } });
      fireEvent.change(inputs[1], { target: { value: saldo } });
      fireEvent.change(inputs[2], { target: { value: juros } });
      fireEvent.change(inputs[3], { target: { value: parcela } });
      fireEvent.click(screen.getByText("Adicionar"));
    };
    add("Cartão", "2.000", "12", "300");
    await act(async () => {});
    add("Carnê da loja", "450", "", "90");
    await act(async () => {});
    const lista = screen.getByTestId("kit-dividas-ordem");
    expect(lista.querySelectorAll("li")[0].textContent).toContain("Carnê da loja");
    expect(lista.querySelectorAll("li")[0].textContent).toContain("Comece por esta");
    expect((c.dados()[CHAVE_KIT_DIVIDAS] as Divida[]).map((d) => d.saldo)).toEqual([2000, 450]);
  });
});
