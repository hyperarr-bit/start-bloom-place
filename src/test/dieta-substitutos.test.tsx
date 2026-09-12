/**
 * Dieta: substitutos por refeição e "o que comi no lugar" (11/09).
 * Cliente por áudio: "a dieta tem 30.000 substitutos… eu comi um prato feito,
 * tive que mudar a dieta e depois mudar de novo". Plano fica intacto; o
 * diário guarda o que foi comido.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { adicionarSubstituto, comoSubstitutos, notaDeSubstituto, removerSubstituto } from "@/lib/dieta-substitutos";
import Dieta from "@/pages/Dieta";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/analytics", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...real, trackEvent: () => {}, trackEventBeacon: () => {}, markActivation: async () => {} };
});
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

describe("contas dos substitutos", () => {
  it("adiciona sem repetir (sem caixa/espaço), remove e limpa lixo", () => {
    let m = adicionarSubstituto({}, "Café da manhã", "  Tapioca com queijo ");
    m = adicionarSubstituto(m, "Café da manhã", "tapioca com queijo");
    m = adicionarSubstituto(m, "Café da manhã", "Pão integral com ovo");
    expect(m).toEqual({ "Café da manhã": ["Tapioca com queijo", "Pão integral com ovo"] });
    expect(removerSubstituto(m, "Café da manhã", "Tapioca com queijo")).toEqual({ "Café da manhã": ["Pão integral com ovo"] });
    expect(removerSubstituto({ Almoço: ["PF"] }, "Almoço", "PF")).toEqual({});
    expect(comoSubstitutos({ Almoço: ["", " PF ", 3], Janta: "x", y: null })).toEqual({ Almoço: ["PF"] });
    expect(notaDeSubstituto(" prato feito ")).toBe("Comi: prato feito");
  });
});

describe("Dieta: diário com substitutos", () => {
  const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
  const hojeNome = DIAS[(new Date().getDay() + 6) % 7];
  const montar = () => {
    const dados: Record<string, unknown> = {
      "dieta-meals-config": ["Almoço"],
      "saude-meals": Object.fromEntries(DIAS.map(d => [d, { "Almoço": "Frango grelhado, arroz e salada" }])),
      "dieta-substitutos": { "Almoço": ["Prato feito", "Marmita da firma"] },
    };
    const valor: UserDataContextType = {
      get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
      set: (key: string, value: unknown) => { dados[key] = value; },
      loaded: true, isGuest: true, fetchKey: async () => null,
    };
    render(<MemoryRouter><UserDataContext.Provider value={valor}><Dieta /></UserDataContext.Provider></MemoryRouter>);
    return dados;
  };

  it("marcar ❌ mostra os substitutos; tocar num deles grava 'Comi: …' no diário e o PLANO não muda", () => {
    const dados = montar();
    fireEvent.click(screen.getByRole("button", { name: /DIÁRIO/ }));
    const card = screen.getByText("Frango grelhado, arroz e salada").closest("div.rounded-xl") as HTMLElement;
    expect(within(card).queryByTestId("opcoes-Almoço")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByText("❌"));
    fireEvent.click(within(within(card).getByTestId("opcoes-Almoço")).getByText("Prato feito"));

    const diario = dados["dieta-diary-v2"] as Record<string, { meals: Record<string, { followed: boolean; note: string }> }>;
    expect(diario[localDayKey()].meals["Almoço"]).toEqual({ followed: false, note: "Comi: Prato feito" });
    expect((dados["saude-meals"] as Record<string, Record<string, string>>)[hojeNome]["Almoço"]).toBe("Frango grelhado, arroz e salada");
    // o campo livre mostra a mesma nota e continua editável
    expect((screen.getByLabelText("O que comeu em Almoço") as HTMLInputElement).value).toBe("Comi: Prato feito");
  });

  it("no cardápio, o substituto aparece como 'ou:' embaixo do plano", () => {
    montar();
    expect(screen.getAllByText("ou: Prato feito · Marmita da firma").length).toBeGreaterThan(0);
  });
});
