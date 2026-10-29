/**
 * /vendas (29/10) — a página do dono: sem sessão pede pra entrar; quem não é admin não vê nada (volta pra home) e a
 * página nem chama o painel; o admin vê as 4 abas, as vendas de hoje e o passo a passo de instalar quando não está na
 * Tela de Início.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({
  sessao: null as null | { user: { id: string } },
  admin: false,
  invocacoes: [] as Array<{ fn: string; body: Record<string, unknown> }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.sessao } }),
      signInWithPassword: async () => ({ error: null }),
    },
    functions: {
      invoke: async (fn: string, { body }: { body: Record<string, unknown> }) => {
        h.invocacoes.push({ fn, body });
        if (fn === "vendas-painel" && body.aba === "vendas") {
          return { data: { dia: "2026-10-29", itens: [{ hora: "10:30", valor_cents: 9790, origem: "apple", plano: "anual", renovacao: false }], total_cents: 9790, porOrigem: { pix: { n: 0, cents: 0 }, apple: { n: 1, cents: 9790 }, play: { n: 0, cents: 0 } } }, error: null };
        }
        if (fn === "vendas-painel" && body.aba === "turmas") {
          return { data: { dia: "2026-10-29", semEstadoRC: 0, errosMeta: [], turmas: [{ dia: "2026-10-26", situacao: "fecha_hoje", fechaEm: "2026-10-29", testes: 25, pagaram: 5, pctPagaram: 20, recusas: 6, cancelaram: 12, emTeste: 2, outros: 0, mensais: 0, gasto: 240, custoPorTeste: 9.6, liquido: 401.5, retorno: 1.67, cor: "amarelo" }] }, error: null };
        }
        return { data: {}, error: null };
      },
    },
  },
}));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: async () => h.admin }));

import VendasApp from "@/vendas/VendasApp";

beforeEach(() => {
  h.sessao = null; h.admin = false; h.invocacoes = [];
});

describe("/vendas: acesso", () => {
  it("sem sessão: formulário de entrar, nenhum dado", async () => {
    render(<VendasApp />);
    expect(await screen.findByPlaceholderText("Senha")).toBeInTheDocument();
    expect(screen.queryByText("Vendas de hoje")).toBeNull();
    expect(h.invocacoes).toEqual([]);
  });

  it("logado mas NÃO admin: não mostra nada e não chama o painel", async () => {
    h.sessao = { user: { id: "u-qualquer" } };
    const { container } = render(<VendasApp />);
    await waitFor(() => expect(container.querySelector(".v-giro")).toBeNull());
    expect(container.innerHTML).toBe("");
    expect(h.invocacoes).toEqual([]);
  });

  it("admin: 4 abas, vendas de hoje, instrução de instalar fora da Tela de Início; troca de aba busca a aba", async () => {
    h.sessao = { user: { id: "u-dono" } }; h.admin = true;
    render(<VendasApp />);
    expect(await screen.findByText("Vendas de hoje")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Vendas", "Turmas", "Campanhas", "Web"]);
    expect(screen.getAllByText("R$ 97,90").length).toBeGreaterThan(0);
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Turmas" }));
    expect(await screen.findByText("Turma 26/10")).toBeInTheDocument();
    expect(screen.getByText("1,67×").className).toContain("v-cor-amarelo");
    expect(h.invocacoes.map((i) => i.body.aba)).toEqual(["vendas", "turmas"]);
  });
});
