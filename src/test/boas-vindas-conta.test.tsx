/**
 * 29/10 (alarme telas-repetidas na build 53): a boas-vindas pós-compra ("Pronto, Nome.") voltava em outro celular,
 * numa 2ª compra ou em outro navegador — a marca era só do aparelho. Agora a CONTA também guarda
 * (user_metadata.boas_vindas_pago_vista), e quem já viu na conta não vê de novo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const conta: { user: Record<string, unknown> | null } = { user: null };
const updateUser = vi.fn(async () => ({ data: {}, error: null }));
vi.mock("@/hooks/use-auth", () => ({ useAuthOpcional: () => ({ user: conta.user }), useAuth: () => ({ user: conta.user }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, set: () => {}, loaded: true }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { updateUser: (a: unknown) => updateUser(a) } } }));

import { BoasVindasPago, boasVindasVistaNaConta } from "@/components/onboarding/BoasVindasPago";
import { trackEvent } from "@/lib/analytics";

const usuario = (vista: boolean) => ({ id: "u1", email: "a@x.com", created_at: "2026-09-01T10:00:00Z", user_metadata: vista ? { boas_vindas_pago_vista: true } : {} });

beforeEach(() => { cleanup(); localStorage.clear(); updateUser.mockClear(); vi.mocked(trackEvent).mockClear(); });

describe("boas-vindas pós-compra: a marca também na conta", () => {
  it("lê a marca do user_metadata", () => {
    expect(boasVindasVistaNaConta(usuario(true))).toBe(true);
    expect(boasVindasVistaNaConta(usuario(false))).toBe(false);
    expect(boasVindasVistaNaConta(null)).toBe(false);
  });

  it("1ª vez (aparelho e conta sem marca): aparece; Começar grava no aparelho E na conta", () => {
    conta.user = usuario(false);
    const seguir = vi.fn();
    render(<BoasVindasPago nome="Bia" onComecar={seguir} nuncaPula />);
    fireEvent.click(screen.getByRole("button", { name: /Começar/ }));
    expect(seguir).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("core-boas-vindas-visto")).toBe("1");
    expect(updateUser).toHaveBeenCalledWith({ data: { boas_vindas_pago_vista: true } });
  });

  it("compra nova / outro celular com a conta já marcada: não aparece e o fluxo segue sozinho", () => {
    conta.user = usuario(true);
    const seguir = vi.fn();
    render(<BoasVindasPago nome="Bia" onComecar={seguir} imediato nuncaPula />);
    expect(screen.queryByRole("button", { name: /Começar/ })).toBeNull();
    expect(seguir).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("core-boas-vindas-visto")).toBe("1");
    expect(vi.mocked(trackEvent).mock.calls.map((c) => c[0])).not.toContain("boas_vindas_pago_visto");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("abertura em outro navegador com a conta já marcada: não aparece", () => {
    conta.user = usuario(true);
    render(<BoasVindasPago nome="Bia" onComecar={vi.fn()} nuncaPula />);
    expect(screen.queryByRole("button", { name: /Começar/ })).toBeNull();
    expect(vi.mocked(trackEvent).mock.calls.map((c) => c[0])).toContain("boas_vindas_pago_repetida_evitada");
  });
});
