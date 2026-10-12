/**
 * PORTA v4 (12/10): o <script> do index.html que mede ANTES do React (porta_html) e pega erro de JS
 * (porta_erro_js) — só em /comece. Roda o bloco de verdade, extraído do index.html, no jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAVE_HTML, lerHtmlDaPorta } from "@/pages/porta/medicao";

const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
const inicio = html.indexOf("// ─── PORTA (/comece): medir ANTES do React");
const bloco = (() => {
  const abre = html.lastIndexOf("<script>", inicio) + "<script>".length;
  const fecha = html.indexOf("</script>", inicio);
  return html.slice(abre, fecha);
})();

type Chamada = { url: string; init: RequestInit & { keepalive?: boolean } };
let chamadas: Chamada[] = [];
const corpos = () => chamadas.map((c) => JSON.parse(String(c.init.body)) as { event_name: string; event_data: Record<string, unknown>; session_id: string; user_id: null });
const rodar = (caminho: string) => {
  window.history.replaceState({}, "", caminho);
  // eslint-disable-next-line no-new-func
  new Function(bloco)();
};
const ouvintes: Array<[string, EventListenerOrEventListenerObject, boolean | undefined]> = [];
const addOriginal = window.addEventListener.bind(window);

beforeEach(() => {
  chamadas = [];
  sessionStorage.clear();
  delete (window as { __portaHtml?: unknown }).__portaHtml;
  globalThis.fetch = vi.fn((url: string, init: RequestInit) => { chamadas.push({ url, init }); return Promise.resolve(new Response(null, { status: 201 })); }) as unknown as typeof fetch;
  // guarda os ouvintes que o bloco põe na window, pra tirar depois (cada teste roda o bloco de novo)
  window.addEventListener = ((t: string, l: EventListenerOrEventListenerObject, o?: boolean) => { ouvintes.push([t, l, o]); addOriginal(t, l, o); }) as typeof window.addEventListener;
});
afterEach(() => {
  for (const [t, l, o] of ouvintes.splice(0)) window.removeEventListener(t, l, o);
  window.addEventListener = addOriginal;
  window.history.replaceState({}, "", "/");
});

describe("index.html: porta_html e porta_erro_js", () => {
  it("o bloco existe, é ES5 (sem arrow/let/const/template) e roda antes do bundle", () => {
    expect(inicio).toBeGreaterThan(0);
    expect(bloco).not.toMatch(/=>|\blet\b|\bconst\b|`/);
    expect(html.indexOf("PORTA (/comece): medir ANTES")).toBeLessThan(html.indexOf('src="/src/main.tsx"'));
  });

  it("fora de /comece não faz NADA (nem storage, nem rede, nem ouvinte)", () => {
    for (const c of ["/", "/baixar", "/app", "/comecar"]) rodar(c);
    expect(chamadas).toHaveLength(0);
    expect(sessionStorage.getItem(CHAVE_HTML)).toBeNull();
    expect(ouvintes).toHaveLength(0);
  });

  it("em /comece: 1 porta_html (keepalive, anon, user_id nulo) com tempo, aparelho e anúncio; MESMO session_id do analytics", () => {
    sessionStorage.setItem("core_session_id", "sessao-analytics-1");
    rodar("/comece?utm_source=meta&utm_campaign=lua&utm_content=video1&ad_id=333&fbclid=IwAR_x");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events");
    expect(chamadas[0].init.keepalive).toBe(true);
    const [c] = corpos();
    expect(c.event_name).toBe("porta_html");
    expect(c.user_id).toBeNull();
    expect(c.session_id).toBe("sessao-analytics-1");
    expect(c.event_data).toMatchObject({ utm_source: "meta", utm_campaign: "lua", utm_content: "video1", ad_id: "333", tem_fbclid: true, plataforma: expect.any(String), in_app: expect.any(Boolean) });
    expect(typeof c.event_data.t_ms).toBe("number");
    // o html_id fica pro porta_view levar junto (heap e sessionStorage)
    const h = lerHtmlDaPorta();
    expect(h?.id).toBe(c.event_data.html_id);
    expect(JSON.parse(sessionStorage.getItem(CHAVE_HTML)!).id).toBe(h?.id);
  });

  it("sem session_id ainda: cria o core_session_id (o analytics lê o mesmo depois)", () => {
    rodar("/comece");
    const [c] = corpos();
    expect(c.session_id).toBeTruthy();
    expect(sessionStorage.getItem("core_session_id")).toBe(c.session_id);
  });

  it("erro de JS e promise rejeitada em /comece → porta_erro_js (no máximo 5); script que não carregou também", () => {
    rodar("/comece");
    window.dispatchEvent(new ErrorEvent("error", { message: "TypeError: x is not a function" }));
    const ev = new Event("unhandledrejection") as Event & { reason?: unknown };
    ev.reason = new Error("falhou o chunk");
    window.dispatchEvent(ev);
    // pixel de terceiro bloqueado: NÃO conta (não deixa a tela branca)
    const pixel = document.createElement("script");
    pixel.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(pixel);
    pixel.dispatchEvent(new Event("error"));
    pixel.remove();
    // o bundle nosso que não carregou: conta
    const s = document.createElement("script");
    s.src = `${location.origin}/assets/index-abc.js`;
    document.head.appendChild(s);
    s.dispatchEvent(new Event("error"));
    const erros = corpos().filter((c) => c.event_name === "porta_erro_js");
    expect(erros.map((e) => e.event_data.msg)).toEqual([
      "TypeError: x is not a function",
      "promise: falhou o chunk",
      "recurso: /assets/index-abc.js",
    ]);
    expect(erros[0].event_data).toMatchObject({ montou: expect.any(Boolean), html_id: expect.any(String) });
    for (let i = 0; i < 10; i++) window.dispatchEvent(new ErrorEvent("error", { message: `e${i}` }));
    expect(corpos().filter((c) => c.event_name === "porta_erro_js")).toHaveLength(5);
    s.remove();
  });

  it("fetch que falha não lança nada", () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(() => rodar("/comece")).not.toThrow();
  });
});
