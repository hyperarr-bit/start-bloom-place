/**
 * 11/11 (velocidade 1.0.26): o carregador adiado dos pixels do index.html (Meta, Google, UTMify, TikTok) não roda dentro do
 * app da loja (window.Capacitor nativo). No site, igual a antes.
 */
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const carregador = (html.match(/<script>((?:(?!<\/script>)[\s\S])*function pixels\(\)[\s\S]*?)<\/script>/) ?? [])[1];

const rodar = () => {
  // eslint-disable-next-line no-new-func
  new Function(carregador!)();
  window.dispatchEvent(new Event("core:montou"));
  return [...document.head.querySelectorAll("script[src]")].map((s) => s.getAttribute("src") ?? "");
};

describe("pixels do site fora do app da loja", () => {
  afterEach(() => {
    document.head.querySelectorAll("script[src]").forEach((s) => s.remove());
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("o carregador existe no index.html", () => { expect(carregador).toBeTruthy(); });

  it("no site: carrega Meta, Google e UTMify (TikTok pela fila ttq)", () => {
    const srcs = rodar();
    expect(srcs.some((s) => s.includes("connect.facebook.net"))).toBe(true);
    expect(srcs.some((s) => s.includes("googletagmanager.com"))).toBe(true);
    expect(srcs.some((s) => s.includes("utmify"))).toBe(true);
  });

  // críticas 17/11: o token do painel na URL é a senha de quem indica — o PageView mandaria a URL inteira pra Meta/Google/TikTok/UTMify
  it.each(["/indique/abcDEF123_-abcDEF123_-abcDEF123_-", "/indique", "/afiliado/abcDEF123_-abcDEF123_-abcDEF123_-"])("no painel de quem indica (%s): nenhum pixel", (rota) => {
    const antes = location.pathname;
    window.history.replaceState({}, "", rota);
    try { expect(rodar()).toEqual([]); } finally { window.history.replaceState({}, "", antes); }
  });

  it("o bloco do PageView (fbq init) também pula o painel (as 2 regras iguais)", () => {
    const bloco = (html.match(/<script>((?:(?!<\/script>)[\s\S])*fbq\('track', 'PageView'\)[\s\S]*?)<\/script>/) ?? [])[1] ?? "";
    const fbq = Object.assign((...a: unknown[]) => { chamadas.push(a); }, { queue: [] as unknown[] });
    const chamadas: unknown[][] = [];
    const w = window as unknown as { fbq?: unknown; _fbq?: unknown };
    for (const rota of ["/indique/tok_abcdefghijklmnopqrstuvwxyz0123", "/afiliado/tok_abcdefghijklmnopqrstuvwxyz0123", "/oferta"]) {
      const antes = location.pathname;
      window.history.replaceState({}, "", rota);
      chamadas.length = 0; w.fbq = fbq; w._fbq = fbq;
      // eslint-disable-next-line no-new-func
      try { new Function(bloco)(); } finally { window.history.replaceState({}, "", antes); delete w.fbq; delete w._fbq; }
      const pageView = chamadas.some((c) => c[0] === "track" && c[1] === "PageView");
      expect([rota, pageView]).toEqual([rota, rota === "/oferta"]);
    }
  });

  it("no app da loja (Capacitor nativo): nenhum pixel", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(rodar()).toEqual([]);
  });
});
