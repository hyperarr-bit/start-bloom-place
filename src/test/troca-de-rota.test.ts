/**
 * 1.0.17 QA — troca de rota sem quadro em branco (lib/troca-de-rota): no app, ao mudar de rota a tela de antes vira uma
 * foto por cima (antes de o React trocar a árvore) e some quando a rota nova pinta. Mesmo caminho só muda o pathname;
 * query não fotografa; no jsdom/"reduzir movimento" nada acontece (o PageTransition faz o fade de sempre).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { instalarTrocaDeRotaSemBranco, rotaComFoto, rotaMontou } from "@/lib/troca-de-rota";

const ua = navigator.userAgent;
afterEach(() => { Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true }); vi.useRealTimers(); });

describe("troca de rota sem branco", () => {
  it("no jsdom não fotografa (o fade do PageTransition segue)", () => {
    instalarTrocaDeRotaSemBranco();
    history.pushState({}, "", "/financas");
    expect(rotaComFoto()).toBe(false);
    expect(document.querySelector("[data-saida-calma]")).toBeNull();
  });

  it("no aparelho: rota nova = foto por cima, sem testid/role; query não fotografa; a rota montou → a foto sai", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone)", configurable: true });
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = vi.fn(() => ({ onfinish: null }));
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
    const raiz = document.createElement("div");
    raiz.innerHTML = '<main data-testid="pagina-velha" role="main">Home</main>';
    raiz.getBoundingClientRect = () => ({ top: 0, left: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(raiz);
    history.pushState({}, "", "/home");
    rotaMontou(); vi.advanceTimersByTime(1000); // (a rota de antes do teste)
    history.pushState({}, "", "/home?x=1");
    history.pushState({}, "", "/home?x=2"); // mesma rota (só a query): nada
    expect(rotaComFoto()).toBe(false);
    history.pushState({}, "", "/rotina");
    expect(rotaComFoto()).toBe(true);
    const foto = document.querySelector<HTMLElement>('[data-saida-calma="tela"]');
    expect(foto).not.toBeNull();
    expect(foto!.querySelector("[data-testid], [role]")).toBeNull();
    rotaMontou();
    expect(rotaComFoto()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector("[data-saida-calma]")).toBeNull();
    raf.mockRestore(); raiz.remove();
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });
});
