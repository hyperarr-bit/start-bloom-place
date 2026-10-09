/**
 * PAINEL DA AFILIADA e ABA AFILIADOS (09/10/2026) — o que aparece na tela.
 *
 * O painel é público por token. O que se trava aqui: ele mostra os números
 * que a função devolve e, mesmo que a resposta trouxesse um campo a mais
 * (um e-mail, um uid), nada disso vai pro DOM — a tela só lê os campos que
 * conhece. E o link inválido dá uma tela honesta, não um spinner eterno.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PAINEL_EXEMPLO, textoSituacao, type DadosAdminAfiliados } from "@/lib/afiliados";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import Afiliado, { PainelAfiliadaVista } from "@/pages/Afiliado";
import { AdminAfiliadosVista, type AcoesAdminAfiliados } from "@/pages/admin/AdminAfiliados";

const TOKEN = "a".repeat(43);
const renderRota = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/afiliado/${token}`]}>
      <Routes><Route path="/afiliado/:token" element={<Afiliado />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => invoke.mockReset());

describe("PainelAfiliadaVista", () => {
  it("mostra os agregados e as linhas sem identidade", () => {
    render(<PainelAfiliadaVista p={PAINEL_EXEMPLO} />);
    expect(screen.getByText("Oi, Bia!")).toBeInTheDocument();
    expect(screen.getByTestId("codigo")).toHaveTextContent("BIA");
    expect(screen.getByText("R$ 160,60")).toBeInTheDocument(); // a receber
    expect(screen.getByText("R$ 281,05")).toBeInTheDocument(); // já recebido
    expect(screen.getByText("segunda, 12/10")).toBeInTheDocument();
    expect(screen.getByTestId("link")).toHaveTextContent("code=BIA");
    const linhas = within(screen.getByTestId("linhas")).getAllByRole("listitem");
    expect(linhas).toHaveLength(PAINEL_EXEMPLO.linhas.length);
    expect(linhas[2]).toHaveTextContent("venda de 07/10");
    expect(linhas[2]).toHaveTextContent("R$ 40,15");
    expect(linhas[2]).toHaveTextContent("Pix previsto pra 19/10");
  });
  it("frases das situações", () => {
    expect(textoSituacao({ dia: "2026-10-05", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-10-13" })).toBe("paga em 13/10");
    expect(textoSituacao({ dia: "2026-10-05", comissao_cents: 0, situacao: "em_teste", pagamento_dia: null })).toBe("em teste grátis");
    expect(textoSituacao({ dia: "2026-10-05", comissao_cents: 0, situacao: "reembolsada", pagamento_dia: null })).toBe("reembolsada");
  });
  it("pausada: aviso aparece", () => {
    render(<PainelAfiliadaVista p={{ ...PAINEL_EXEMPLO, pausado: true }} />);
    expect(screen.getByTestId("aviso-pausado")).toBeInTheDocument();
  });
});

describe("/afiliado/:token", () => {
  it("chama a função com o token e NÃO deixa vazar campo extra da resposta", async () => {
    invoke.mockResolvedValue({ data: { ...PAINEL_EXEMPLO, email: "cliente@segredo.com", user_id: "33333333-3333-3333-3333-333333333333" }, error: null });
    const { container } = renderRota(TOKEN);
    await screen.findByText("Oi, Bia!");
    expect(invoke).toHaveBeenCalledWith("afiliados", { body: { action: "painel", token: TOKEN } });
    expect(container.textContent).not.toContain("segredo.com");
    expect(container.textContent).not.toContain("33333333");
  });
  it("token curto nem chama a função; token desconhecido mostra 'não existe'", async () => {
    renderRota("curto");
    expect(await screen.findByText("Este link não existe")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    invoke.mockResolvedValue({ data: { error: "nao_encontrado" }, error: null });
    renderRota("b".repeat(43));
    expect((await screen.findAllByText("Este link não existe")).length).toBeGreaterThan(0);
  });
});

describe("AdminAfiliadosVista", () => {
  const dados: DadosAdminAfiliados = {
    proxima_segunda: "2026-10-12",
    afiliados: [{ id: "a1", nome: "Beatriz", codigo: "BIA", email: null, pix_chave: "***4421", pix_tipo: "CPF", token_painel: "t".repeat(43), limite_semanal_cents: 50000, pausado: false, criado_em: "2026-09-20T12:00:00Z", link_painel: `/afiliado/${"t".repeat(43)}`, link_resgate: "https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=BIA" }],
    vendas: [{ id: "v1", afiliado_id: "a1", plataforma: "ios", produto: "core_anual_97", valor_bruto_cents: 9790, valor_liquido_cents: 8030, comissao_cents: 4015, status: "pago", motivo: null, cobrado_em: "2026-10-01T10:00:00Z", pagamento_id: null, criado_em: "2026-09-24T10:00:00Z" }],
    pagamentos: [{ id: "p1", afiliado_id: "a1", valor_cents: 40150, asaas_transfer_id: null, asaas_status: null, status: "segurado", motivo: "acima_do_limite_30000", erro: null, vendas_ids: ["x"], semana: "2026-10-05", criado_em: "2026-10-05T12:00:00Z" }],
  };
  const acoes: AcoesAdminAfiliados = { recarregar: async () => {}, criar: async () => null, pausar: async () => null, liberar: async () => null, novoToken: async () => null, previaSemana: async () => [] };

  it("lista, detalhe com Pix mascarado e botão de liberar o segurado", () => {
    render(<AdminAfiliadosVista dados={dados} loading={false} erro={null} acoes={acoes} selecionadoInicial="a1" />);
    expect(within(screen.getByTestId("lista-afiliadas")).getByText("Beatriz")).toBeInTheDocument();
    expect(screen.getByText(/Pix CPF \*\*\*4421/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Liberar Pix/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pausar pagamentos/ })).toBeInTheDocument();
    expect(within(screen.getByTestId("vendas")).getByText("R$ 40,15")).toBeInTheDocument();
  });
  it("formulário de nova afiliada abre com os campos pedidos", () => {
    render(<AdminAfiliadosVista dados={dados} loading={false} erro={null} acoes={acoes} abrirFormInicial />);
    const form = screen.getByTestId("form-nova");
    for (const rotulo of ["Nome", "Código", "E-mail \\(pra falar", "Limite semanal", "Chave Pix", "Tipo da chave"]) expect(within(form).getAllByText(new RegExp(rotulo)).length).toBeGreaterThan(0);
  });
});
