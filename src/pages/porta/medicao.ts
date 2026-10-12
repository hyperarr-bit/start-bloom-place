/**
 * MEDIR ANTES DA 1ª TELA DA PORTA (v4, 12/10).
 *
 * O porta_view só sai depois que o React monta — quem desiste durante o carregamento (bundle de ~350 KB no 4G
 * ruim, navegador do Instagram) não aparecia em lugar nenhum. Agora:
 *
 *   1. index.html, num <script> no <head> que só roda quando location.pathname começa com "/comece", manda
 *      `porta_html` (fetch keepalive direto no analytics_events, igual ao trackEventBeacon) com o tempo desde o
 *      início da navegação. Ele usa o MESMO session_id do analytics (sessionStorage "core_session_id" — se não
 *      existe, ele cria, e o getSessionId do analytics lê o mesmo) e gera um `html_id`, guardado em
 *      window.__portaHtml (o heap sobrevive à zerada de storage do Instagram) e em sessionStorage "porta-html-v1".
 *      O mesmo <script> manda `porta_erro_js` (window.onerror / unhandledrejection) enquanto a página está em
 *      /comece — inclusive erro do bundle que impede o React de montar.
 *   2. o porta_view leva `html_id` + `html_ms` (pra juntar com o porta_html), `tempo_ms` (performance.now() na
 *      montagem = do início da navegação até a tela existir) e se a tela 1 ficou visível.
 *
 * As chaves aqui TÊM que bater com o <script> do index.html (não dá pra importar de lá).
 */
export const CHAVE_HTML = "porta-html-v1";

export type HtmlDaPorta = { id: string; t: number };

/** O que o index.html deixou (heap primeiro; depois o sessionStorage). null = o script não rodou (ex.: navegação interna). */
export function lerHtmlDaPorta(): HtmlDaPorta | null {
  try {
    const w = (typeof window !== "undefined" ? window : null) as (Window & { __portaHtml?: HtmlDaPorta }) | null;
    const h = w?.__portaHtml;
    if (h && typeof h.id === "string") return h;
    const raw = sessionStorage.getItem(CHAVE_HTML);
    if (!raw) return null;
    const o = JSON.parse(raw) as HtmlDaPorta;
    return o && typeof o.id === "string" ? o : null;
  } catch {
    return null;
  }
}

/** ms desde o início da navegação (performance.now()); null sem a API. */
export function msDesdeANavegacao(): number | null {
  try {
    const t = performance.now();
    return Number.isFinite(t) ? Math.round(t) : null;
  } catch {
    return null;
  }
}
