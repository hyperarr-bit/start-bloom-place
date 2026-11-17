/**
 * INDIQUE E GANHE — o app das LOJAS nunca mostra nada (17/11, subida): nem a linha da Você, nem o balão, nem o pontinho, nem
 * consulta a assinatura — mesmo com a chave ligada e com o QA forçando (?indique-entrada=on). É dinheiro por indicação de compra
 * feita FORA da loja: mostrar isso no app do iPhone/Android pede build + revisão (regras da Apple e da Play).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const from = vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [{ status: "active", payment_method: "stripe", plan: "lifetime", amount_cents: 6790 }], error: null }) }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => from(), functions: { invoke: vi.fn() } } }));
let plataforma: "ios" | "android" = "ios";
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true, plataformaApp: () => plataforma, isIOS: () => plataforma === "ios", isAndroid: () => plataforma === "android" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));

import { EntradaIndique } from "@/components/indique/EntradaIndique";
import { useAvisoNovoIndique, ESPERA_BALAO_INDIQUE_MS } from "@/components/indique/AvisoNovoIndique";
import { __zerarElegivelIndique } from "@/components/indique/use-indique-elegivel";
import { entradaIndiqueAqui } from "@/lib/indique-entrada";

afterEach(() => { cleanup(); localStorage.clear(); from.mockClear(); __zerarElegivelIndique(); vi.useRealTimers(); });

function Aviso() {
  const a = useAvisoNovoIndique("aba", true);
  return <div>{a.ponto && <span data-testid="ponto" />}{a.balao && <span data-testid="balao" />}</div>;
}

describe.each(["ios", "android"] as const)("app da loja (%s)", (p) => {
  it("nada aparece e nada é consultado, mesmo com a chave e o QA ligados", async () => {
    plataforma = p;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("indique-entrada-force", "on");
    expect(entradaIndiqueAqui({ modo: "web" })).toBe(false);
    render(<MemoryRouter><EntradaIndique estilo="e" /><EntradaIndique estilo="classico" /><EntradaIndique estilo="menu" /><Aviso /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_BALAO_INDIQUE_MS * 3); });
    expect(screen.queryByTestId("entrada-indique")).toBeNull();
    expect(screen.queryByTestId("balao")).toBeNull();
    expect(screen.queryByTestId("ponto")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
