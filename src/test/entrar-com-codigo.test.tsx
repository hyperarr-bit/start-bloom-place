/**
 * Entrar com código por e-mail (15/09) — a saída pra quem pagou e caiu em
 * "esse e-mail já tem conta" sem lembrar a senha.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

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
