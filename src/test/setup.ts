import "@testing-library/jest-dom";

/**
 * IntersectionObserver não existe no jsdom, e o framer-motion chama ele em
 * TODO `whileInView` — que é como quase toda seção dos paywalls aparece. Sem
 * este stub, qualquer teste que renderize um paywall morre no mount com
 * "IntersectionObserver is not defined", antes de chegar a asserção nenhuma.
 *
 * Dispara `isIntersecting: true` uma vez no observe: no teste a tela não
 * rola, então esperar interseção de verdade deixaria todo conteúdo animado
 * invisível pra sempre — e o teste passaria a medir a ausência do elemento,
 * não o conteúdo.
 */
class IntersectionObserverStub {
  private cb: IntersectionObserverCallback;
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe(alvo: Element) {
    this.cb(
      [{ isIntersecting: true, target: alvo, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
if (!("IntersectionObserver" in window)) {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverStub,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverStub,
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
