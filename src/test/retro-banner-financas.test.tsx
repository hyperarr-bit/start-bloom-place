/**
 * 02/11: o banner da retrospectiva em Finanças era o único caminho que ainda abria a ANTIGA (MonthlyWrapped)
 * com a nova ligada. Agora, com a nova ativa pro mês, ele leva pra página da retrospectiva (a mesma do cartão
 * da Home); com a nova desligada, abre a de sempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const navegar = vi.fn();
const ativa = vi.hoisted(() => ({ v: true }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navegar }));
const conta = vi.hoisted(() => ({ user: { id: "u1", user_metadata: {} } as { id: string; user_metadata: object } | null }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: conta.user }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, f: unknown) => f, set: () => {}, loaded: true }) }));
vi.mock("@/hooks/use-persisted-state", () => ({ usePersistedState: (_k: string, v: unknown) => [v, () => {}] }));
vi.mock("@/lib/retro-outubro", async (orig) => ({ ...(await orig<typeof import("@/lib/retro-outubro")>()), retroOutubroAtiva: () => ativa.v }));
vi.mock("@/lib/retrospectiva", async (orig) => ({
  ...(await orig<typeof import("@/lib/retrospectiva")>()),
  construirRetroMes: () => ({ mes: "Outubro", ano: 2026, mesIdx: 9 }),
}));
vi.mock("@/components/wrapped/MonthlyWrapped", () => ({ MonthlyWrapped: () => <div data-testid="antiga">antiga</div> }));

import { WrappedBanner } from "@/components/wrapped/WrappedBanner";

beforeEach(() => { navegar.mockClear(); conta.user = { id: "u1", user_metadata: {} }; delete (window as unknown as { __PREVIEW_SEEDS__?: unknown }).__PREVIEW_SEEDS__; });

describe("banner da retrospectiva em Finanças", () => {
  it("nova ligada: a faixa tem a cara nova e leva pra página da retrospectiva (nova), não abre a antiga", () => {
    ativa.v = true;
    render(<WrappedBanner />);
    expect(screen.getByTestId("wrapped-banner").getAttribute("data-estilo")).toBe("novo");
    fireEvent.click(screen.getByText(/do seu jeito/));
    expect(navegar).toHaveBeenCalledWith("/retrospectiva?mes=Outubro&origem=banner");
    expect(screen.queryByTestId("antiga")).toBeNull();
  });
  it("nova desligada: abre a de sempre", async () => {
    ativa.v = false;
    render(<WrappedBanner />);
    fireEvent.click(screen.getByText(/Sua retrospectiva de outubro tá pronta/));
    expect(navegar).not.toHaveBeenCalled();
    expect(await screen.findByTestId("antiga")).toBeTruthy();
  });
  it("demo sem conta (/preview): fica a faixa de sempre, que abre ali mesmo — sem mandar pro login", async () => {
    ativa.v = true;
    conta.user = null;
    (window as unknown as { __PREVIEW_SEEDS__?: unknown }).__PREVIEW_SEEDS__ = {};
    render(<WrappedBanner />);
    expect(screen.getByTestId("wrapped-banner").getAttribute("data-estilo")).toBeNull();
    fireEvent.click(screen.getByText(/Sua retrospectiva de outubro tá pronta/));
    expect(navegar).not.toHaveBeenCalled();
    expect(await screen.findByTestId("antiga")).toBeTruthy();
  });
});
