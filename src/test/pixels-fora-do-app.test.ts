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

  it("no app da loja (Capacitor nativo): nenhum pixel", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(rodar()).toEqual([]);
  });
});
