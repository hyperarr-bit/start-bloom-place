/**
 * OS BOTÕES DO /admin/suporte (30/10).
 *
 * Liberar Pix (no chamado "Pix pago sem e-mail" e no formulário avulso) chama
 * transferir_pix. Trocar email chama trocar_email. E-mail ruim nem sai da tela.
 * Sucesso e erro aparecem em texto, e nenhuma ação pede a concessão de vitalício.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { pedidoDoChamado, lerRespostaFuncao } from "@/pages/admin/acoes-suporte-api";
import { AcoesSuporte, LiberarPixChamado } from "@/pages/admin/acoes-suporte";

const { invoke, tickets } = vi.hoisted(() => ({
  invoke: vi.fn(),
  tickets: [
    {
      id: "t-pix", user_id: "anon-1", source: "pix_sem_email", status: "open",
      created_at: "2026-10-29T14:33:00.000Z", resolved_at: null, resposta: null, respondido_em: null,
      message: "Pix pago sem e-mail · R$ 27,90 · 29/10 11:33 · pagador: MARIA\nPagou na landing e não deixou e-mail.\nPedido: qr_landing_99",
    },
    {
      id: "t-duvida", user_id: "user-duvida", source: "app_duvida", status: "open",
      created_at: "2026-10-29T15:00:00.000Z", resolved_at: null, resposta: null, respondido_em: null,
      message: "Não consigo abrir o treino.",
    },
  ],
}));

function chain(data: unknown) {
  const q: Record<string, unknown> = {};
  const passo = () => q;
  for (const m of ["select", "order", "limit", "neq", "in", "gte", "eq"]) q[m] = passo;
  q.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(ok, err);
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (tabela: string) => chain(tabela === "support_tickets" ? tickets : []),
  },
}));

beforeEach(() => { invoke.mockReset(); });

describe("pedido e resposta da função", () => {
  it("lê o Pedido do chamado e o erro que volta no 4xx", async () => {
    expect(pedidoDoChamado("Pix pago sem e-mail\nPedido: qr_landing_99\n")).toBe("qr_landing_99");
    expect(pedidoDoChamado("sem pedido")).toBeNull();
    expect(await lerRespostaFuncao(null, {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => ({ error: "destino_nao_encontrado" }) },
    })).toEqual({ error: "destino_nao_encontrado" });
    expect(await lerRespostaFuncao({ ok: true, plan: "lifetime" }, null)).toMatchObject({ ok: true });
  });
});

describe("formulários", () => {
  const chamar = vi.fn();
  beforeEach(() => chamar.mockReset());

  it("Liberar Pix avulso manda pedido + e-mail e mostra sucesso; e-mail ruim não chama", async () => {
    render(<AcoesSuporte chamar={chamar} />);
    const painel = screen.getByRole("heading", { name: "Liberar Pix" }).closest(".rounded-2xl")!;
    fireEvent.change(within(painel).getByLabelText(/Pedido ou id do pagamento/), { target: { value: "qr_landing_99" } });
    fireEvent.change(within(painel).getByLabelText("E-mail da conta"), { target: { value: "nao-e-email" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Liberar Pix" }));
    expect(await within(painel).findByRole("alert")).toHaveTextContent(/parece errado/i);
    expect(chamar).not.toHaveBeenCalled();

    fireEvent.change(within(painel).getByLabelText("E-mail da conta"), { target: { value: "Maria@exemplo.com" } });
    chamar.mockResolvedValueOnce({ ok: true, plan: "lifetime", amount_cents: 2790 });
    fireEvent.click(within(painel).getByRole("button", { name: "Liberar Pix" }));
    await waitFor(() => expect(chamar).toHaveBeenCalledTimes(1));
    expect(chamar.mock.calls[0][0]).toEqual({ action: "transferir_pix", pedido: "qr_landing_99", email: "maria@exemplo.com" });
    expect(JSON.stringify(chamar.mock.calls)).not.toContain("liberar_vitalicio");
    expect(await within(painel).findByRole("status")).toHaveTextContent(/Pix liberado na conta maria@exemplo.com/);
    expect(within(painel).getByRole("status")).toHaveTextContent(/vitalício, R\$ 27,90/);
    expect(within(painel).getByRole("status")).toHaveTextContent(/Nenhum e-mail foi enviado/);
  });

  it("erro do servidor aparece em texto", async () => {
    render(<AcoesSuporte chamar={chamar} />);
    const painel = screen.getByRole("heading", { name: "Liberar Pix" }).closest(".rounded-2xl")!;
    fireEvent.change(within(painel).getByLabelText(/Pedido ou id/), { target: { value: "qr_1" } });
    fireEvent.change(within(painel).getByLabelText("E-mail da conta"), { target: { value: "maria@exemplo.com" } });
    chamar.mockResolvedValueOnce({ error: "destino_ja_tem_assinatura" });
    fireEvent.click(within(painel).getByRole("button", { name: "Liberar Pix" }));
    expect(await within(painel).findByRole("alert")).toHaveTextContent(/já tem acesso próprio/);
  });

  it("Trocar email manda o atual (ou id) e o novo; recusa formato e e-mail de outra conta", async () => {
    render(<AcoesSuporte chamar={chamar} />);
    const painel = screen.getByRole("heading", { name: "Trocar email" }).closest(".rounded-2xl")!;
    fireEvent.change(within(painel).getByLabelText(/E-mail atual ou id/), { target: { value: "antiga@exemplo.com" } });
    fireEvent.change(within(painel).getByLabelText("E-mail novo"), { target: { value: "ruim" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Trocar email" }));
    expect(await within(painel).findByRole("alert")).toHaveTextContent(/parece errado/i);
    expect(chamar).not.toHaveBeenCalled();

    fireEvent.change(within(painel).getByLabelText("E-mail novo"), { target: { value: "Nova@exemplo.com" } });
    chamar.mockResolvedValueOnce({ error: "destino_ja_existe" });
    fireEvent.click(within(painel).getByRole("button", { name: "Trocar email" }));
    expect(await within(painel).findByRole("alert")).toHaveTextContent(/já é de outra conta/);
    expect(chamar.mock.calls[0][0]).toEqual({ action: "trocar_email", de: "antiga@exemplo.com", para: "nova@exemplo.com" });

    fireEvent.change(within(painel).getByLabelText(/E-mail atual ou id/), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    chamar.mockResolvedValueOnce({ ok: true, uid: "22222222-2222-4222-8222-222222222222" });
    fireEvent.click(within(painel).getByRole("button", { name: "Trocar email" }));
    await waitFor(() => expect(chamar).toHaveBeenCalledTimes(2));
    expect(chamar.mock.calls[1][0]).toMatchObject({ action: "trocar_email", de: "22222222-2222-4222-8222-222222222222", para: "nova@exemplo.com" });
    expect(await within(painel).findByRole("status")).toHaveTextContent(/trocado para nova@exemplo.com/);
    expect(within(painel).getByRole("status")).toHaveTextContent(/Nenhum e-mail foi enviado/);
    expect(JSON.stringify(chamar.mock.calls)).not.toContain("liberar_vitalicio");
  });

  it("no chamado, Liberar Pix manda o uid anônimo, o pedido e o e-mail", async () => {
    render(<LiberarPixChamado deUid="anon-1" pedido="qr_landing_99" chamar={chamar} />);
    fireEvent.click(screen.getByRole("button", { name: "Liberar Pix" }));
    expect(screen.getByText(/Pedido: qr_landing_99/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail da conta"), { target: { value: "maria@exemplo.com" } });
    chamar.mockResolvedValueOnce({ ok: true, plan: "lifetime", amount_cents: 2790 });
    fireEvent.click(screen.getAllByRole("button", { name: "Liberar Pix" })[1]);
    await waitFor(() => expect(chamar).toHaveBeenCalledTimes(1));
    expect(chamar.mock.calls[0][0]).toEqual({
      action: "transferir_pix", deUid: "anon-1", pedido: "qr_landing_99", email: "maria@exemplo.com",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/Pix liberado na conta maria@exemplo.com/);
  });
});

describe("a página /admin/suporte", () => {
  it("mostra as ações e o botão só no chamado de Pix sem e-mail", async () => {
    const { default: AdminSuporte } = await import("@/pages/admin/AdminSuporte");
    render(<AdminSuporte />);
    expect(await screen.findByRole("heading", { name: "Liberar Pix" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trocar email" })).toBeInTheDocument();
    const cardPix = screen.getByText("anon-1").closest(".rounded-2xl")!;
    const cardDuvida = screen.getByText("user-duvida").closest(".rounded-2xl")!;
    expect(within(cardPix).getByRole("button", { name: "Liberar Pix" })).toBeInTheDocument();
    expect(within(cardDuvida).queryByRole("button", { name: "Liberar Pix" })).toBeNull();

    fireEvent.click(within(cardPix).getByRole("button", { name: "Liberar Pix" }));
    fireEvent.change(within(cardPix).getByLabelText("E-mail da conta"), { target: { value: "maria@exemplo.com" } });
    invoke.mockResolvedValueOnce({ data: { ok: true, plan: "lifetime", amount_cents: 2790 }, error: null });
    fireEvent.click(within(cardPix).getAllByRole("button", { name: "Liberar Pix" })[1]);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const [nome, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(nome).toBe("admin-suporte");
    expect(opts.body).toEqual({ action: "transferir_pix", deUid: "anon-1", pedido: "qr_landing_99", email: "maria@exemplo.com" });
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("liberar_vitalicio");
    expect(await within(cardPix).findByRole("status")).toHaveTextContent(/Nenhum e-mail foi enviado/);
  });
});
