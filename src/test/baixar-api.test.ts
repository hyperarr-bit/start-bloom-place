/**
 * /baixar (api/baixar.js) — o link único de download (01/10: ganhou `?loja=`
 * e a marca de robô). O que este arquivo trava:
 *   · gente de celular continua indo pra loja do aparelho, igual a antes;
 *   · computador sem `loja` continua indo pro site (comportamento antigo);
 *   · `loja=ios|android` manda pra loja escolhida em qualquer aparelho;
 *   · robô de pré-visualização (Instagram/Facebook/WhatsApp…) é marcado
 *     `robo: true` no evento, mas recebe o MESMO redirect de antes.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import handler, { destino, ehRobo } from "../../api/baixar.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";
const FB_BOT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const META_BOT = "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
const IG_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 320.0.0.0";

afterEach(() => vi.unstubAllGlobals());

describe("destino() — pra onde cada clique vai", () => {
  it("iPhone → App Store com ct da origem; Android → Play com referrer utm; computador → site", () => {
    expect(destino(IPHONE, "site_hero")).toMatchObject({ plataforma: "ios", loja: "ios", robo: false, url: "https://apps.apple.com/br/app/id6806913181?ct=site_hero" });
    const a = destino(ANDROID, "site_hero");
    expect(a.plataforma).toBe("android");
    expect(a.loja).toBe("android");
    expect(decodeURIComponent(a.url)).toContain("referrer=utm_source=site&utm_medium=link&utm_campaign=site_hero");
    const w = destino(MAC, "site_hero");
    expect(w).toMatchObject({ plataforma: "web", loja: "web" });
    expect(w.url).toBe("https://coreaplicativo.com.br/?utm_source=site&utm_medium=link&utm_campaign=site_hero");
  });

  it("sem parâmetros é o link da bio de sempre (ig_bio)", () => {
    expect(destino(IPHONE, undefined).url).toBe("https://apps.apple.com/br/app/id6806913181?ct=ig_bio");
    expect(destino(MAC, undefined).url).toContain("utm_campaign=ig_bio");
  });

  it("?loja= decide a loja no computador (os selos da landing) e vence o UA", () => {
    expect(destino(MAC, "site_preco_iphone", undefined, "ios")).toMatchObject({ plataforma: "web", loja: "ios", url: expect.stringContaining("apps.apple.com") });
    expect(destino(MAC, "site_preco_android", undefined, "android")).toMatchObject({ plataforma: "web", loja: "android", url: expect.stringContaining("play.google.com") });
    // iPhone escolhendo o selo do Android (vai mandar pra alguém): respeita
    expect(destino(IPHONE, "site_baixar", undefined, "android").url).toContain("play.google.com");
    // valor inválido = como se não viesse
    expect(destino(MAC, "x", undefined, "windows").loja).toBe("web");
  });

  it("robô de pré-visualização é marcado, mas o redirect é o mesmo de antes", () => {
    expect(ehRobo(FB_BOT)).toBe(true);
    expect(ehRobo(META_BOT)).toBe(true);
    expect(ehRobo("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(ehRobo("TelegramBot (like TwitterBot)")).toBe(true);
    expect(ehRobo(IPHONE)).toBe(false);
    expect(ehRobo(ANDROID)).toBe(false);
    expect(ehRobo(IG_APP)).toBe(false); // navegador DENTRO do Instagram é gente
    const r = destino(FB_BOT, "ig_bio");
    expect(r.robo).toBe(true);
    expect(r).toMatchObject({ plataforma: "web", url: expect.stringContaining("coreaplicativo.com.br") });
  });
});

const fakeRes = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0, body: "",
    setHeader: (k: string, v: string) => { headers[k] = v; },
    end: (b?: string) => { res.body = b ?? ""; },
    headers,
  };
  return res;
};

describe("handler() — resposta HTTP e o evento gravado", () => {
  it("302 pra loja + evento baixar_click com plataforma, loja, robo e origem", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { posts.push(JSON.parse(String(init.body))); return { ok: true }; }));
    const res = fakeRes();
    await handler({ query: { origem: "site_hero", loja: "ios" }, headers: { "user-agent": MAC, referer: "https://coreaplicativo.com.br/" } }, res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toContain("apps.apple.com");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ event_name: "baixar_click", event_data: { plataforma: "web", loja: "ios", robo: false, origem: "site_hero" } });
  });

  it("robô do Facebook: evento com robo=true, redirect igual ao de um computador", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { posts.push(JSON.parse(String(init.body))); return { ok: true }; }));
    const res = fakeRes();
    await handler({ query: { origem: "ig_bio" }, headers: { "user-agent": FB_BOT } }, res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toContain("coreaplicativo.com.br/?utm_source=ig");
    expect((posts[0] as { event_data: { robo: boolean } }).event_data.robo).toBe(true);
  });

  it("navegador do Instagram recebe a página que pula pra loja (não 302)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
    const res = fakeRes();
    await handler({ query: {}, headers: { "user-agent": IG_APP } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Abrir na App Store");
    expect(res.body).toContain("apps.apple.com/br/app/id6806913181?ct=ig_bio");
  });

  it("se o banco não responder, o redirect sai mesmo assim", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("rede"); }));
    const res = fakeRes();
    await handler({ query: { origem: "site_qr" }, headers: { "user-agent": ANDROID } }, res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toContain("play.google.com");
  });
});
