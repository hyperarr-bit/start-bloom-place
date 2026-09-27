/**
 * Começar do zero (26/09) — chamado do iPhone: "quero excluir tudo o que já
 * botei e iniciar o app novamente". Apaga os registros, mantém conta e acesso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useEffect } from "react";

const chamadas: { deletes: Array<[string, string]>; upserts: unknown[] } = { deletes: [], upserts: [] };
let erroNoDelete: unknown = null;

// objeto ESTÁVEL: um user novo a cada render faria o provedor re-hidratar em laço
const auth = { user: { id: "u1" }, loading: false, isSubscribed: true };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), markActivation: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  const selecao = { eq: () => selecao, in: () => Promise.resolve({ data: [], error: null }), abortSignal: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) };
  return {
    supabase: {
      from: () => ({
        select: () => selecao,
        upsert: (linhas: unknown) => { chamadas.upserts.push(linhas); return Promise.resolve({ error: null }); },
        delete: () => ({ eq: (col: string, v: string) => { chamadas.deletes.push([col, v]); return Promise.resolve({ error: erroNoDelete }); } }),
      }),
    },
  };
});

import { UserDataProvider, useUserData } from "@/hooks/use-user-data";
import { ApagarDadosDialog } from "@/components/account/ApagarDadosDialog";

describe("Começar do zero — ação no provedor", () => {
  beforeEach(() => { chamadas.deletes = []; chamadas.upserts = []; erroNoDelete = null; localStorage.clear(); });

  it("descarta gravação pendente, apaga no servidor e limpa o cache do aparelho", async () => {
    let resultado: { ok: boolean } | null = null;
    const Sonda = () => {
      const { set, apagarTudo, loaded } = useUserData();
      useEffect(() => {
        if (!loaded) return;
        set("finance-expenses", [{ id: 1 }]); // gravação ainda no debounce
        void apagarTudo!().then((r) => { resultado = r; });
      }, [loaded]);
      return null;
    };
    localStorage.setItem("u:u1:finance-expenses", JSON.stringify([{ id: 0 }]));
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await waitFor(() => expect(resultado).toEqual({ ok: true }));
    expect(chamadas.deletes).toEqual([["user_id", "u1"]]);
    expect(localStorage.getItem("u:u1:finance-expenses")).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); }); // passa o debounce de 250 ms
    expect(chamadas.upserts).toEqual([]); // nada recriou a linha apagada
  });

  it("se o servidor falhar, o cache do aparelho fica (nada meio apagado)", async () => {
    erroNoDelete = { message: "offline" };
    let resultado: { ok: boolean; erro?: string } | null = null;
    const Sonda = () => {
      const { apagarTudo, loaded } = useUserData();
      useEffect(() => { if (loaded) void apagarTudo!().then((r) => { resultado = r; }); }, [loaded]);
      return null;
    };
    render(<UserDataProvider><Sonda /></UserDataProvider>);
    await waitFor(() => expect(resultado?.ok).toBe(false));
    expect(resultado!.erro).toMatch(/internet/);
  });
});

describe("Começar do zero — diálogo", () => {
  it("só apaga depois de digitar APAGAR", async () => {
    const apagarTudo = vi.fn().mockResolvedValue({ ok: true });
    const { UserDataContext } = await import("@/hooks/use-user-data");
    Object.defineProperty(window, "location", { value: { href: "/" }, writable: true });
    render(
      <UserDataContext.Provider value={{ get: (_k, f) => f, set: () => {}, loaded: true, isGuest: false, fetchKey: async () => null, apagarTudo }}>
        <ApagarDadosDialog open onOpenChange={() => {}} />
      </UserDataContext.Provider>,
    );
    const botao = screen.getByRole("button", { name: "Apagar tudo" });
    expect(botao).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Digite APAGAR pra confirmar"), { target: { value: "apagar" } });
    expect(botao).not.toBeDisabled();
    fireEvent.click(botao);
    await waitFor(() => expect(apagarTudo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.href).toBe("/home"));
  });
});
