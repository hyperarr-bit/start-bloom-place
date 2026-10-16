/** 17/10 (dono: "o vídeo não funciona, só fica um print no mockup"): autoplay negado → as 6 telas do passeio
 *  passam em sequência (2 s cada) no lugar da tela parada; o toque tenta o vídeo de novo. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
import { WelcomeVideo, TELAS_PASSEIO } from "@/pages/funis/app-web/WelcomeVideo";

describe("abertura do /assinatura com o vídeo bloqueado", () => {
  let play: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    play = vi.fn(() => Promise.reject(Object.assign(new Error("bloqueado"), { name: "NotAllowedError" })));
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  });
  afterEach(() => vi.useRealTimers());

  it("passa as telas do passeio a cada 2 s e o toque tenta o vídeo de novo", async () => {
    render(<WelcomeVideo onComecar={() => {}} onEntrar={() => {}} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const img = () => screen.getByTestId("welcome-poster") as HTMLImageElement;
    expect(img().getAttribute("src")).toBe(TELAS_PASSEIO[0]);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(img().getAttribute("src")).toBe(TELAS_PASSEIO[1]);
    await act(async () => { vi.advanceTimersByTime(2000 * 5); });
    expect(img().getAttribute("src")).toBe(TELAS_PASSEIO[0]); // volta ao começo
    const chamadas = play.mock.calls.length;
    fireEvent.pointerDown(screen.getByTestId("welcome-app-web"));
    expect(play.mock.calls.length).toBe(chamadas + 1);
  });
});
