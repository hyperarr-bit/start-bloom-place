/**
 * "O CORE é app de celular também" (15/09) — a maior causa de reembolso na
 * web era a pessoa achar que comprou um site. O card das lojas substitui o
 * convite de PWA e aparece na Home, no /bem-vindo e na tela de "Pronto"
 * logo depois de pagar. Só na web.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => "", set: vi.fn(), loaded: true }) }));

import { LojasCard, BotoesDasLojas, aparelhoDaWeb } from "@/components/LojasCard";
import { BoasVindasPago } from "@/components/onboarding/BoasVindasPago";

const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "android", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};

beforeEach(() => { localStorage.clear(); nativo(false); ua("Mozilla/5.0 (Macintosh)"); });
afterEach(() => { cleanup(); nativo(false); });

describe("card das lojas na web", () => {
  it("mostra App Store e Google Play com link e referrer da origem", () => {
    render(<LojasCard variant="home" />);
    expect(screen.getByTestId("lojas-card")).toBeTruthy();
    expect(screen.getByTestId("loja-app-store").getAttribute("href")).toContain("apps.apple.com/br/app/id6806913181");
    const play = screen.getByTestId("loja-play").getAttribute("href") ?? "";
    expect(play).toContain("br.com.coreaplicativo.app");
    expect(decodeURIComponent(play)).toContain("utm_campaign=web_home");
  });

  it("no app das lojas não aparece", () => {
    nativo(true);
    render(<LojasCard variant="home" />);
    expect(screen.queryByTestId("lojas-card")).toBeNull();
  });

  it("na Home dá pra dispensar e fica dispensado", () => {
    const { unmount } = render(<LojasCard variant="home" />);
    fireEvent.click(screen.getByLabelText("Dispensar"));
    expect(screen.queryByTestId("lojas-card")).toBeNull();
    unmount();
    render(<LojasCard variant="home" />);
    expect(screen.queryByTestId("lojas-card")).toBeNull();
  });

  it("a loja do aparelho vem primeiro", () => {
    ua("Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/128");
    expect(aparelhoDaWeb()).toBe("android");
    render(<BotoesDasLojas origem="teste" />);
    const links = screen.getAllByRole("link");
    expect(links[0].getAttribute("data-testid")).toBe("loja-play");
    cleanup();
    ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari");
    render(<BotoesDasLojas origem="teste" />);
    expect(screen.getAllByRole("link")[0].getAttribute("data-testid")).toBe("loja-app-store");
  });
});

describe("tela de 'Pronto' depois de pagar", () => {
  it("na web mostra as lojas antes do Começar; no app não", () => {
    render(<BoasVindasPago imediato nome="Ana" onComecar={() => {}} />);
    expect(screen.getByTestId("lojas-pos-compra")).toBeTruthy();
    expect(screen.getByText("Começar")).toBeTruthy();
    cleanup();
    nativo(true);
    render(<BoasVindasPago imediato nome="Ana" onComecar={() => {}} />);
    expect(screen.queryByTestId("lojas-pos-compra")).toBeNull();
  });
});
