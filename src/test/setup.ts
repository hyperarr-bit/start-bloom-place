import "@testing-library/jest-dom";
import { afterAll } from "vitest";

/**
 * REDE EXTERNA BLOQUEADA NOS TESTES (28/09). O cliente do Supabase aponta pra
 * PRODUÇÃO (endereço fixo em integrations/supabase/client) e o trackEvent
 * grava em analytics_events de verdade, com user_id nulo (a policy do anon
 * aceita). Em 27/09 a suíte sujou o banco com eventos de teste — e o hook de
 * push roda a suíte inteira a cada push.
 *
 * Este arquivo roda ANTES dos imports de cada teste, e o supabase-js guarda a
 * referência do `fetch` quando o cliente é criado: trocando aqui, todo pedido
 * que não seja localhost falha na hora (o supabase-js devolve {error}, nada
 * quebra). Nenhum teste dependia de rede de verdade; quem precisar de
 * resposta de mentira usa vi.stubGlobal("fetch", ...) por cima.
 * REDE_BLOQUEADA=1 mostra no fim de cada arquivo o que tentou sair.
 */
const fetchDeVerdade = globalThis.fetch;
const tentativas: string[] = [];
if (typeof fetchDeVerdade === "function") {
  globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) return fetchDeVerdade(entrada, init);
    tentativas.push(url);
    return Promise.reject(new TypeError(`rede externa bloqueada no teste: ${url}`));
  }) as typeof fetch;
}
afterAll(() => {
  if (process.env.REDE_BLOQUEADA === "1" && tentativas.length) {
    console.warn(`[rede bloqueada] ${tentativas.length} pedido(s): ${[...new Set(tentativas.map((u) => u.split("?")[0]))].join(", ")}`);
  }
});

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
