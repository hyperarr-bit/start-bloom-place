/**
 * ResizeObserver pra navegador velho (16/08) — o módulo Finanças caía inteiro.
 *
 * Crash real de produção: `Can't find variable: ResizeObserver`. O
 * <ResponsiveContainer> do Recharts faz `new ResizeObserver(...)` SEM guarda
 * (node_modules/recharts/es6/component/ResponsiveContainer.js:93) dentro de um
 * useEffect — e efeito que lança sobe pro RouteErrorBoundary. Por isso a pessoa
 * não vê "gráfico em branco": vê a TELA DE ERRO no lugar do módulo.
 *
 * ResizeObserver não existe em Chrome < 64, Safari < 13.1 e WebView Android
 * antiga — a mesma família de aparelho que já custou o `:where()` do preflight,
 * o `inset` dos overlays e o crypto.randomUUID do index.html. "Can't find
 * variable" é frase do JavaScriptCore (o V8 diz "is not defined"): esse usuário
 * é Safari velho, na web — mas a WebView antiga tem o mesmo buraco.
 *
 * Conserta de uma vez o Recharts (/financas, /treino, /detox, /admin/funil) e
 * os `new ResizeObserver` crus de Preview.tsx:105 e ComecarV2.tsx:1245. O de
 * Preview é PIOR que os outros: /preview/:moduleKey NÃO tem RouteErrorBoundary
 * (App.tsx:412), então lá o throw desmonta a árvore inteira = tela branca.
 *
 * POR QUE UM SHIM CASEIRO, e não um pacote: `resize-observer-polyfill` (~2,6KB
 * gzip) entraria no bundle de todo mundo por causa de uma minoria; import
 * dinâmico põe rede no boot de quem já está no aparelho pior, não compila com
 * top-level await no target es2015 do vite.config.ts, e é mais um chunk pra
 * sumir num deploy (este repo já tem histórico disso). O contrato que os três
 * consumidores usam cabe aqui: observe/unobserve/disconnect e
 * `entries[0].contentRect.width/height`.
 *
 * POR QUE AMOSTRAGEM POR INTERVALO, e não requestAnimationFrame: rAF
 * re-agenda a cada quadro e faria `getBoundingClientRect()` — layout forçado —
 * 60x/s por container (são 3 no dashboard de Finanças) enquanto o módulo
 * estiver aberto, no celular mais fraco. 250ms + os eventos de resize/rotação
 * dão resposta imediata no que o usuário percebe, sem queimar bateria.
 *
 * Fidelidade: `contentRect` aqui é o getBoundingClientRect (border-box), não o
 * content-box do ResizeObserver de verdade. É o MESMO que o Recharts já usa na
 * medição inicial dele (ResponsiveContainer.js:94), e os containers destes
 * gráficos não têm padding/borda próprios — os três consumidores só precisam
 * saber "mudou", e dois deles (Preview, ComecarV2) remedem por conta própria.
 */

type Entrada = { target: Element; contentRect: DOMRectReadOnly };
type Cb = (entradas: Entrada[]) => void;

const INTERVALO_MS = 250;

class ResizeObserverFallback {
  private cb: Cb;
  private alvos = new Map<Element, { w: number; h: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(cb: Cb) {
    this.cb = cb;
  }

  observe(alvo: Element) {
    if (!alvo || this.alvos.has(alvo)) return;
    // -1 força a primeira medição a "mudar" e emitir: sem callback inicial o
    // Recharts fica no width/height 0 quando o pai só define a altura em %
    // (DetoxStats.tsx:115, AdminFunnel.tsx:306) — trocaríamos a tela de erro
    // por um espaço em branco, que é pior de diagnosticar.
    this.alvos.set(alvo, { w: -1, h: -1 });
    if (this.timer === null) {
      this.timer = setInterval(this.medir, INTERVALO_MS);
      window.addEventListener("resize", this.medir);
      window.addEventListener("orientationchange", this.medir);
    }
    // assíncrono de propósito: o RO de verdade nunca entrega dentro do
    // observe(), e o Recharts chama observe() de dentro de um efeito — emitir
    // síncrono seria setState no meio do commit.
    setTimeout(this.medir, 0);
  }

  unobserve(alvo: Element) {
    this.alvos.delete(alvo);
    if (!this.alvos.size) this.parar();
  }

  disconnect() {
    this.alvos.clear();
    this.parar();
  }

  private parar() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("resize", this.medir);
    window.removeEventListener("orientationchange", this.medir);
  }

  private medir = () => {
    const mudou: Entrada[] = [];
    this.alvos.forEach((antes, alvo) => {
      // Desanexado do DOM: para de observar sozinho, sem vazar timer.
      // `=== false` de propósito: em WebView pré-Chrome 51 `isConnected` é
      // undefined, e um `!alvo.isConnected` descartaria TODO alvo já na
      // primeira medição — o shim nunca emitiria nada.
      if (alvo.isConnected === false) {
        this.alvos.delete(alvo);
        return;
      }
      const r = alvo.getBoundingClientRect();
      if (Math.abs(r.width - antes.w) > 0.5 || Math.abs(r.height - antes.h) > 0.5) {
        this.alvos.set(alvo, { w: r.width, h: r.height });
        mudou.push({ target: alvo, contentRect: r });
      }
    });
    if (!this.alvos.size) this.parar();
    if (mudou.length) {
      // callback do consumidor nunca pode derrubar o laço
      try {
        this.cb(mudou);
      } catch {
        /* noop */
      }
    }
  };
}

/** Instala o fallback SÓ se o navegador não tiver o de verdade. */
export function instalarResizeObserverSePreciso(): void {
  try {
    if (typeof window === "undefined") return;
    const w = window as unknown as { ResizeObserver?: unknown };
    if (typeof w.ResizeObserver === "function") return;
    w.ResizeObserver = ResizeObserverFallback;
  } catch {
    /* se nem instalar der certo, o app segue exatamente como estava */
  }
}
