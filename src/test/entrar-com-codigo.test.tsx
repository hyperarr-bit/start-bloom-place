/**
 * Entrar com código por e-mail (15/09) — a saída pra quem pagou e caiu em
 * "esse e-mail já tem conta" sem lembrar a senha.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a), verifyOtp: (...a: unknown[]) => verifyOtp(...a) } } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { EntrarComCodigo } from "@/components/auth/EntrarComCodigo";

beforeEach(() => { cleanup(); signInWithOtp.mockReset(); verifyOtp.mockReset(); });

describe("EntrarComCodigo", () => {
  it("pede o código só pra conta existente e entra com os 8 números", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    const onSession = vi.fn();
    render(<EntrarComCodigo email=" Ana@Exemplo.com " funil="ios" onSession={onSession} />);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    await waitFor(() => expect(screen.getByTestId("codigo-email")).toBeTruthy());
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "ana@exemplo.com", options: { shouldCreateUser: false } });
    fireEvent.change(screen.getByLabelText("Código do e-mail"), { target: { value: "1234-5678" } });
    fireEvent.click(screen.getByText("Entrar"));
    await waitFor(() => expect(onSession).toHaveBeenCalledTimes(1));
    expect(verifyOtp).toHaveBeenCalledWith({ email: "ana@exemplo.com", token: "12345678", type: "email" });
  });

  it("e-mail sem conta: avisa e não abre o campo do código", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Signups not allowed for otp" } });
    render(<EntrarComCodigo email="ninguem@exemplo.com" funil="w" onSession={() => {}} />);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não achei conta/i);
    expect(screen.queryByTestId("codigo-email")).toBeNull();
  });

  it("código errado: mostra o erro e deixa tentar de novo", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const onSession = vi.fn();
    render(<EntrarComCodigo email="ana@exemplo.com" funil="entrar" onSession={onSession} />);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    await waitFor(() => expect(screen.getByTestId("codigo-email")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Código do e-mail"), { target: { value: "00000000" } });
    fireEvent.click(screen.getByText("Entrar"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Código do e-mail")).toBeTruthy();
  });
});

describe("EntrarComCodigo guiado (tela nova do /entrar)", () => {
  const abrirCodigo = async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<EntrarComCodigo email="ana@exemplo.com" funil="entrar_codigo" guiado rotulo="Receber código" onSession={() => {}}><input aria-label="campo" /></EntrarComCodigo>);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    await waitFor(() => expect(screen.getByTestId("codigo-email")).toBeTruthy());
  };

  it("depois de mandar, conta até poder reenviar; o reenvio fica travado até zerar", async () => {
    await abrirCodigo();
    const reenviar = screen.getByTestId("codigo-reenviar");
    expect(reenviar).toHaveTextContent(/Mandar outro código em [01]:\d\d/);
    expect(reenviar).toBeDisabled();
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it("o campo aceita 8 números, nem mais nem menos", async () => {
    await abrirCodigo();
    const campo = screen.getByLabelText("Código do e-mail") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "123456789" } });
    expect(campo.value).toBe("12345678");
  });

  it("código vencido: avisa e, com a contagem zerada, reenvia sem sair da tela", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await abrirCodigo();
      verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
      fireEvent.change(screen.getByLabelText("Código do e-mail"), { target: { value: "00000000" } });
      fireEvent.click(screen.getByText("Entrar"));
      expect(await screen.findByTestId("codigo-vencido")).toHaveTextContent(/venceu ou não bateu/);
      await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
      const reenviar = screen.getByTestId("codigo-reenviar");
      expect(reenviar).toHaveTextContent(/^Mandar outro código$/);
      fireEvent.click(reenviar);
      expect(await screen.findByTestId("codigo-info")).toHaveTextContent(/Só ele vale/);
      expect(signInWithOtp).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId("codigo-vencido")).toBeNull();
      expect((screen.getByLabelText("Código do e-mail") as HTMLInputElement).value).toBe("");
    } finally { vi.useRealTimers(); }
  });

  it("pediu rápido demais: abre o campo do código com a contagem do servidor, sem erro", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "For security purposes, you can only request this after 42 seconds." } });
    render(<EntrarComCodigo email="ana@exemplo.com" funil="entrar_codigo" guiado onSession={() => {}} />);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    expect(await screen.findByTestId("codigo-info")).toHaveTextContent(/Já mandei um código/);
    expect(screen.getByTestId("codigo-reenviar")).toHaveTextContent("em 0:42");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("e-mail sem conta: pergunta da compra, caminho pro suporte, sem campo do código; some ao trocar o e-mail", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Signups not allowed for otp" } });
    const { rerender } = render(<EntrarComCodigo email="ninguem@exemplo.com" funil="entrar_codigo" guiado onSession={() => {}} />);
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    expect(await screen.findByTestId("email-sem-conta")).toHaveTextContent("Não achei esse e-mail. A compra foi com outro?");
    expect(screen.getByTestId("email-sem-conta-suporte").getAttribute("href")).toMatch(/^mailto:contato@coreaplicativo\.com\.br\?subject=/);
    expect(screen.queryByTestId("codigo-email")).toBeNull();
    rerender(<EntrarComCodigo email="outro@exemplo.com" funil="entrar_codigo" guiado onSession={() => {}} />);
    expect(screen.queryByTestId("email-sem-conta")).toBeNull();
  });

  it("enviarAoAbrir pede o código uma vez só, mesmo no StrictMode", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<StrictMode><EntrarComCodigo email="ana@exemplo.com" funil="entrar_codigo" guiado enviarAoAbrir aviso="Esse e-mail já tem conta." onSession={() => {}} /></StrictMode>);
    expect(await screen.findByTestId("codigo-aviso")).toHaveTextContent("Esse e-mail já tem conta.");
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it("sem a prop guiado, nada disso aparece (funil e checkout seguem iguais)", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<EntrarComCodigo email="ana@exemplo.com" funil="ios" enviarAoAbrir onSession={() => {}} />);
    expect(signInWithOtp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("entrar-com-codigo"));
    await waitFor(() => expect(screen.getByTestId("codigo-email")).toBeTruthy());
    expect(screen.queryByTestId("codigo-reenviar")).toBeNull();
    expect(screen.getByText("Mandar outro código")).toBeTruthy();
  });
});
