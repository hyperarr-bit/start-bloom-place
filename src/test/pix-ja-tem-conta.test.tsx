/**
 * E-MAIL QUE JÁ TEM CONTA NO CHECKOUT PIX (22/09, dono, caso Eliza): pedia
 * senha, ela não lembrava, pagou o QR anônimo e ficou 4 dias fora. Agora o
 * caminho principal é o código por e-mail; a senha fica atrás de um link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const m = vi.hoisted(() => ({
  invoke: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  guardar: vi.fn(),
  limparBatismo: vi.fn(),
  entrarSenha: vi.fn(),
  definirEmail: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: { signInWithOtp: m.signInWithOtp, verifyOtp: m.verifyOtp, getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "anonima",
  anonimoLigado: async () => true,
  emailDaSessao: async () => null,
  definirEmailDaCompra: m.definirEmail,
  entrarNaContaExistente: m.entrarSenha,
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: m.guardar,
  limparBatismo: m.limparBatismo,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track, getAttributionParams: () => ({}) }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn() }));

import { PixCheckout } from "@/components/paywall/PixCheckout";

const qr = (n: number) => ({ data: { orderId: `ord${n}`, qrCode: `000201pix${n}`, amount: "27,90", expiresAt: new Date(Date.now() + 30 * 60e3).toISOString() }, error: null });

describe("Pix: e-mail que já tem conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    m.invoke.mockImplementation(async (fn: string) => (fn === "asaas-pix" ? qr(++n) : { data: { paid: false, status: "pending" }, error: null }));
    m.definirEmail.mockResolvedValue({ erro: "email_em_uso" });
    m.signInWithOtp.mockResolvedValue({ error: null });
    m.verifyOtp.mockResolvedValue({ error: null });
  });

  const chegarNoQr = async () => {
    render(<PixCheckout offer="w27" context="funnel" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument(), { timeout: 6000 });
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "eliza@gmail.com" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Salvar e-mail/i })); });
  };

  it("oferece o código (não a senha), guarda a compra anônima, e entrar gera o Pix na conta", async () => {
    await chegarNoQr();
    await waitFor(() => expect(screen.getByTestId("pix-ja-tem-conta-qr")).toBeInTheDocument());
    expect(m.guardar).toHaveBeenCalled(); // a sessão anônima (com o QR que pode já estar pago) fica guardada antes de trocar de conta
    expect(screen.queryByPlaceholderText("sua senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entrar e passar o Pix/i })).not.toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTestId("entrar-com-codigo")); });
    expect(m.signInWithOtp).toHaveBeenCalledWith({ email: "eliza@gmail.com", options: { shouldCreateUser: false } });
    fireEvent.change(screen.getByLabelText("Código do e-mail"), { target: { value: "12345678" } });
    const antes = m.invoke.mock.calls.filter((c) => c[0] === "asaas-pix").length;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Entrar$/ })); });
    expect(m.verifyOtp).toHaveBeenCalledWith({ email: "eliza@gmail.com", token: "12345678", type: "email" });
    await waitFor(() => expect(m.invoke.mock.calls.filter((c) => c[0] === "asaas-pix").length).toBe(antes + 1), { timeout: 6000 });
    expect(m.limparBatismo).toHaveBeenCalled();
    expect(m.track).toHaveBeenCalledWith("funnel_click", expect.objectContaining({ cta: "pix_email_login_ok", via: "codigo", no_qr: true }));
    expect(m.entrarSenha).not.toHaveBeenCalled();
  }, 20000);

  it("'Prefiro usar minha senha' volta o caminho de senha de antes", async () => {
    m.entrarSenha.mockResolvedValue({ erro: null });
    await chegarNoQr();
    await waitFor(() => expect(screen.getByTestId("pix-ja-tem-conta-qr")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Prefiro usar minha senha/i }));
    fireEvent.change(screen.getByPlaceholderText("sua senha"), { target: { value: "segredo1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Entrar e passar o Pix/i })); });
    expect(m.entrarSenha).toHaveBeenCalledWith("eliza@gmail.com", "segredo1");
  }, 20000);

  it("trocar o e-mail sai do modo 'já tem conta'", async () => {
    await chegarNoQr();
    await waitFor(() => expect(screen.getByTestId("pix-ja-tem-conta-qr")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "outro@gmail.com" } });
    expect(screen.queryByTestId("pix-ja-tem-conta-qr")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar e-mail/i })).toBeInTheDocument();
  }, 20000);
});
