/**
 * "Explorar por conta própria" também arma o aviso do dia 2 (28/09). Nas
 * boas-vindas da Missão, só o CTA principal armava a régua — quem saía sem
 * guia ficava sem o toque da volta. Os dois botões fazem a MESMA chamada.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const notif = vi.hoisted(() => ({
  agendar: vi.fn(async (..._: unknown[]) => {}),
  pedir: vi.fn(async () => true),
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarReguaDaMissao: (...a: unknown[]) => notif.agendar(...a),
  pedirPermissao: () => notif.pedir(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: true }) }));

import { MissaoDoTrial } from "@/components/missao/MissaoDoTrial";
import { missaoAtual } from "@/lib/teste-gratis";

const montar = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <MissaoDoTrial />
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  localStorage.setItem("core-trial-cartao-fim", String(Date.now() + 3 * 86_400_000));
  localStorage.setItem("core-funnel-area", "rotina");
  localStorage.setItem("core-lembrete-hora", "noite");
  notif.agendar.mockClear();
  notif.pedir.mockClear();
});
afterEach(() => {
  cleanup();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe("boas-vindas da Missão: os dois botões armam o aviso do dia 2", () => {
  it("Explorar por conta própria arma a régua (antes não armava)", async () => {
    montar();
    fireEvent.click(await screen.findByText("Explorar por conta própria"));
    expect(notif.agendar).toHaveBeenCalledTimes(1);
    expect(notif.agendar).toHaveBeenCalledWith("rotina", "Rotina", "noite");
    // o resto do explorar segue igual: sem holofote, boas-vindas vistas
    expect(missaoAtual()).toMatchObject({ vista: true, holofote: "dispensado" });
    // e quem pede a permissão (se ainda não decidida) é a própria régua
    expect(notif.pedir).not.toHaveBeenCalled();
  });

  it("o CTA principal continua armando — com exatamente os mesmos argumentos", async () => {
    montar();
    fireEvent.click(await screen.findByText("Fazer meu primeiro registro"));
    await waitFor(() => expect(notif.agendar).toHaveBeenCalledTimes(1));
    expect(notif.agendar).toHaveBeenCalledWith("rotina", "Rotina", "noite");
    expect(notif.pedir).toHaveBeenCalledTimes(1);
  });
});
