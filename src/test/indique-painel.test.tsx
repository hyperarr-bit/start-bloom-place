/**
 * PAINEL de quem indica pela web (/indique/:token, 23/11) — o que aparece na tela.
 * Ganho total + meta "seu CORE sai de graça", a liberar / já no Pix / vendas, o link (copiar, WhatsApp, story), o extrato
 * (libera dd/mm, Pix dd/mm, reembolsada), a chave Pix pedida uma vez, as regras (inclui a proibição de anúncio pago).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PAINEL_INDIQUE_EXEMPLO } from "@/lib/afiliados";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import Afiliado from "@/pages/Afiliado";
import { PainelIndiqueVista } from "@/pages/IndiquePainel";

const AGORA = new Date("2026-11-23T15:00:00Z");
beforeEach(() => invoke.mockReset());

describe("PainelIndiqueVista", () => {
  it("números, meta batida, link e extrato com as datas de liberação", () => {
    render(<PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={vi.fn()} agora={AGORA} estilo="bitepal" />);
    expect(screen.getByTestId("ganho")).toHaveTextContent("R$ 101,85");
    // revisão 17/11: só R$ 33,95 caiu de verdade — nada de "já saiu de graça" antes do Pix
    expect(screen.getByText("Quando esses Pix caírem, seu CORE terá saído de graça")).toBeInTheDocument();
    expect(screen.getByTestId("recebido")).toHaveTextContent("R$ 33,95");
    expect(screen.getByTestId("proximo-pix")).toHaveTextContent("R$ 67,90 caem no seu Pix na segunda, 30/11"); // 1 frase, sem contradição
    expect(screen.getByTestId("pix-resumo")).toHaveTextContent("•••4321");
    expect(screen.getByTestId("link")).toHaveTextContent("coreaplicativo.com.br/oferta?ref=ANA7K2");
    expect(decodeURIComponent(screen.getByTestId("whatsapp").getAttribute("href")!)).toContain("oferta?ref=ANA7K2");
    const ext = within(screen.getByTestId("extrato"));
    expect(ext.getByText("libera 27/11")).toBeInTheDocument();
    expect(ext.getByText("Pago 23/11")).toBeInTheDocument();
    expect(ext.getByText("reembolsada")).toBeInTheDocument();
    expect(screen.getByTestId("regras")).toHaveTextContent("Só não pode fazer anúncio pago com o nome CORE");
    expect(screen.getByTestId("regras")).toHaveTextContent("Se ela assinar direto na App Store ou no Google Play, não conta");
    expect(screen.getByTestId("regras")).toHaveTextContent("50% de cada compra");
    expect(screen.getByTestId("regras")).toHaveTextContent("Sem limite de amigas");
    expect(screen.getByTestId("regras")).not.toHaveTextContent("67,90");
    expect(screen.getByTestId("regras")).toHaveTextContent("Não vale comprar pelo próprio link");
  });
  it("antes da meta: 'Falta 1 amiga…'; sem nada: 'Faltam 2 amigas'; sem chave: diz quem paga", () => {
    const { unmount } = render(<PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, a_receber_cents: 3395, ja_recebido_cents: 0 }} salvarPix={vi.fn()} agora={AGORA} estilo="bitepal" />);
    expect(screen.getByText("Falta 1 amiga pro seu CORE sair de graça")).toBeInTheDocument();
    unmount();
    render(<PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, pix: { cadastrado: false, tipo: null, final: null }, a_receber_cents: 0, ja_recebido_cents: 0, pagaram: 0, linhas: [] }} salvarPix={vi.fn()} agora={AGORA} estilo="bitepal" />);
    expect(screen.getByTestId("ganho")).toHaveTextContent("Faltam 2 amigas");
    expect(screen.getByTestId("pix")).toHaveTextContent("O Pix sai da CORE (CNPJ 55.041.112/0001-82)");
  });
  it("chave Pix: salva uma vez; erro vira frase simples", async () => {
    const salvar = vi.fn().mockResolvedValueOnce({ ok: false, motivo: "chave_em_uso" }).mockResolvedValueOnce({ ok: true, pix: { cadastrado: true, tipo: "CPF", final: "•••4725" } });
    render(<PainelIndiqueVista p={{ ...PAINEL_INDIQUE_EXEMPLO, pix: { cadastrado: false, tipo: null, final: null } }} salvarPix={salvar} agora={AGORA} />);
    fireEvent.click(screen.getByRole("radio", { name: "CPF" }));
    fireEvent.change(screen.getByTestId("pix-chave"), { target: { value: "529.982.247-25" } });
    fireEvent.click(screen.getByTestId("pix-salvar"));
    await waitFor(() => expect(screen.getByTestId("pix-erro")).toHaveTextContent("já recebe por outro link"));
    fireEvent.click(screen.getByTestId("pix-salvar"));
    await waitFor(() => expect(screen.getByTestId("pix-ok")).toHaveTextContent("•••4725"));
    expect(salvar).toHaveBeenCalledWith("CPF", "529.982.247-25");
  });
});

describe("/indique/:token", () => {
  it("a função devolve origem 'comprador' → o painel do indique (o da afiliada fica pras influenciadoras)", async () => {
    invoke.mockResolvedValue({ data: PAINEL_INDIQUE_EXEMPLO, error: null });
    render(<MemoryRouter initialEntries={[`/indique/${"b".repeat(43)}`]}><Routes><Route path="/indique/:token" element={<Afiliado />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("painel-indique")).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("afiliados", { body: { action: "painel", token: "b".repeat(43) } });
  });
});
