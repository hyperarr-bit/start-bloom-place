/**
 * /auth/callback?next=… (01/10): o link mágico do e-mail de cartão recusado
 * cai aqui e tem que seguir pra /planos?oferta=w97 — e SÓ pra caminho interno
 * permitido. Link vencido → /entrar com e-mail preenchido e o mesmo destino.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const sb = vi.hoisted(() => ({
  setSession: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(async () => ({ data: { user: { id: "u1", created_at: "2026-09-20T00:00:00Z" } } })),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession: sb.setSession, getUser: sb.getUser } } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import AuthCallback from "@/pages/AuthCallback";

const Onde = ({ nome }: { nome: string }) => {
  const l = useLocation();
  return <div data-testid="onde">{nome}{l.search}</div>;
};

const montar = (url: string) => {
  // AuthCallback lê window.location (hash + query), não o router
  window.history.replaceState({}, "", url);
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/planos" element={<Onde nome="PLANOS" />} />
        <Route path="/entrar" element={<Onde nome="ENTRAR" />} />
        <Route path="/auth" element={<Onde nome="AUTH" />} />
        <Route path="/" element={<Onde nome="HOME" />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => { localStorage.clear(); sb.setSession.mockClear(); sb.getUser.mockResolvedValue({ data: { user: { id: "u1", created_at: "2026-09-20T00:00:00Z" } } }); });
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("/auth/callback com ?next=", () => {
  it("link mágico válido + next interno → cai em /planos?oferta=w97, logado", async () => {
    montar("/auth/callback?next=%2Fplanos%3Foferta%3Dw97&e=ana%40x.com#access_token=a&refresh_token=b");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("PLANOS?oferta=w97"));
    expect(sb.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "b" });
  });

  it("next externo é ignorado: vai pra Home", async () => {
    montar("/auth/callback?next=https%3A%2F%2Fevil.com%2Fplanos#access_token=a&refresh_token=b");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("HOME"));
  });

  it("next protocolo-relativo (//evil.com) também é ignorado", async () => {
    montar("/auth/callback?next=%2F%2Fevil.com#access_token=a&refresh_token=b");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("HOME"));
  });

  it("link VENCIDO com next → /entrar com e-mail preenchido e o destino", async () => {
    montar("/auth/callback?next=%2Fplanos%3Foferta%3Dw97&e=ana%40x.com#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("ENTRAR?e=ana%40x.com&next=%2Fplanos%3Foferta%3Dw97"));
    expect(sb.setSession).not.toHaveBeenCalledWith(expect.objectContaining({ access_token: "a" }));
  });

  it("link vencido SEM next segue o caminho antigo (/auth)", async () => {
    montar("/auth/callback#error_description=Email+link+is+invalid");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("AUTH"));
  });

  it("sem sessão (link já usado) e com next → /entrar com o destino", async () => {
    sb.getUser.mockResolvedValueOnce({ data: { user: null } } as never);
    montar("/auth/callback?next=%2Fplanos%3Foferta%3Dw97&e=ana%40x.com");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("ENTRAR?e=ana%40x.com&next=%2Fplanos%3Foferta%3Dw97"));
  });

  it("destino guardado pelo /entrar antes do Google vale na volta (sem query)", async () => {
    localStorage.setItem("core-auth-next", "/planos?oferta=w97");
    montar("/auth/callback#access_token=a&refresh_token=b");
    await waitFor(() => expect(screen.getByTestId("onde").textContent).toBe("PLANOS?oferta=w97"));
    expect(localStorage.getItem("core-auth-next")).toBeNull();
  });
});
