import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _zerarHomePronta, avisarHomePronta, homeJaPronta, quandoHomePronta, quandoHomeProntaEOciosa } from "@/lib/home-pronta";

/** lib/home-pronta (07/11, desempenho): quem espera a Home pintar recebe o aviso uma vez — ou o teto, sem Home. */
describe("home-pronta", () => {
  beforeEach(() => { vi.useFakeTimers(); _zerarHomePronta(); });
  afterEach(() => { vi.useRealTimers(); _zerarHomePronta(); });

  it("avisa quando a Home pinta, uma vez só", () => {
    const cb = vi.fn();
    quandoHomePronta(cb, 8000);
    expect(cb).not.toHaveBeenCalled();
    avisarHomePronta();
    avisarHomePronta();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(homeJaPronta()).toBe(true);
    vi.advanceTimersByTime(9000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("quem pergunta depois de a Home ter pintado é atendido na hora", () => {
    avisarHomePronta();
    const cb = vi.fn();
    quandoHomePronta(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("sem Home nesta abertura, o teto solta o trabalho mesmo assim", () => {
    const cb = vi.fn();
    quandoHomePronta(cb, 6000);
    vi.advanceTimersByTime(5999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    avisarHomePronta(); // a Home pintando depois não chama de novo
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancelar antes do aviso não roda nada", () => {
    const cb = vi.fn();
    const cancelar = quandoHomePronta(cb, 6000);
    cancelar();
    avisarHomePronta();
    vi.advanceTimersByTime(7000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("'pronta e ociosa' espera a Home e depois o tempo ocioso (sem requestIdleCallback, um setTimeout curto)", () => {
    const original = (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    try {
      const cb = vi.fn();
      quandoHomeProntaEOciosa(cb, { maxMs: 8000, ociosoMs: 4000 });
      avisarHomePronta();
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1500);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      if (original) (window as { requestIdleCallback?: unknown }).requestIdleCallback = original;
    }
  });
});
