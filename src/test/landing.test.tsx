/**
 * A LANDING DA RAIZ (01/10) — objetivo único: baixar o app.
 *   · o selo da loja do aparelho vem primeiro; computador vê os dois + QR;
 *   · TODO selo passa pelo /baixar (origem site_<onde> + loja) — medição num
 *     lugar só, junto com o link da bio;
 *   · registra landing_view e loja_click {loja, onde, aparelho};
 *   · "Entrar" visível no topo (o site logado continua) e nenhum link pra
 *     funil/checkout da web.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import Landing from "@/pages/site/Landing";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
};
const ua = (v: string) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const montar = () => render(<MemoryRouter><Landing /></MemoryRouter>);
const selosDoHero = () => within(screen.getAllByTestId("selos-das-lojas")[0]).getAllByRole("link");

beforeEach(() => { vi.mocked(trackEvent).mockClear(); vi.mocked(trackEventBeacon).mockClear(); });
afterEach(() => { cleanup(); ua(UA.mac); });

describe("por aparelho", () => {
  it("iPhone: App Store primeiro, sem QR, sem preço", () => {
    ua(UA.iphone);
    montar();
    expect(screen.getByTestId("landing").getAttribute("data-aparelho")).toBe("iphone");
    const [primeiro, segundo] = selosDoHero();
    expect(primeiro.getAttribute("data-loja")).toBe("ios");
    expect(primeiro.getAttribute("href")).toBe("/baixar?origem=site_hero&loja=ios");
    expect(segundo.getAttribute("href")).toBe("/baixar?origem=site_hero&loja=android");
    expect(primeiro.getAttribute("target")).toBeNull(); // mesma aba: a loja abre por cima
    expect(screen.getByTestId("hero-linha").textContent).not.toMatch(/R\$|grátis/);
    expect(screen.queryByTestId("hero-qr")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("landing_view", { aparelho: "iphone" });
  });

  it("Android: Google Play primeiro; a barra fixa só tem o selo do Android", () => {
    ua(UA.android);
    montar();
    expect(selosDoHero()[0].getAttribute("data-loja")).toBe("android");
    const barra = screen.getByTestId("barra-fixa");
    expect(barra.querySelectorAll("[data-loja]")).toHaveLength(2); // os dois existem; o do iPhone está escondido por CSS
    expect(barra.querySelector("[data-loja=ios]")?.closest(".\\[\\&_\\[data-loja\\=ios\\]\\]\\:hidden")).not.toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("landing_view", { aparelho: "android" });
  });

  it("computador: os dois selos em aba nova + QR apontando pro /baixar?origem=site_qr", () => {
    ua(UA.mac);
    montar();
    const links = selosDoHero();
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.getAttribute("target") === "_blank")).toBe(true);
    expect(screen.getByTestId("hero-qr")).toBeInTheDocument();
    expect(screen.getByTestId("baixar-qr").querySelector("img")?.getAttribute("src")).toBe("/selos/qr-baixar.svg");
    // o SVG commitado codifica o link único de download com origem site_qr
    expect(screen.queryByTestId("barra-fixa")).toBeNull(); // barra fixa é só do celular
  });
});

describe("medição", () => {
  it("clicar num selo registra loja_click {loja, onde, aparelho} com keepalive", () => {
    ua(UA.iphone);
    montar();
    fireEvent.click(selosDoHero()[0]);
    expect(trackEventBeacon).toHaveBeenCalledWith("loja_click", { loja: "ios", onde: "site_hero", aparelho: "iphone" });
  });

  it("cada selo da página passa pelo /baixar com a sua origem", () => {
    ua(UA.mac);
    montar();
    const lojas = screen.getAllByRole("link").filter((a) => a.hasAttribute("data-loja"));
    expect(lojas.length).toBeGreaterThanOrEqual(6); // hero, como funciona, baixar
    for (const a of lojas) expect(a.getAttribute("href")).toMatch(/^\/baixar\?origem=site_[a-z_]+&loja=(ios|android)$/);
    const origens = new Set(lojas.map((a) => new URL(a.getAttribute("href")!, "http://x").searchParams.get("origem")));
    expect([...origens].sort()).toEqual(["site_baixar", "site_como_funciona", "site_hero"]);
  });
});

describe("conteúdo", () => {
  it("'Entrar' NÃO está no topo nem no hero (dono); fica na faixa do computador, no fecho e no rodapé; nenhum link pra funil ou checkout", () => {
    ua(UA.mac);
    montar();
    const topo = screen.getByTestId("landing-topo");
    expect(topo.querySelector('a[href="/entrar"]')).toBeNull();
    expect(topo.textContent).not.toMatch(/Entrar/);
    expect(screen.getByTestId("hero-prova").closest("section")?.querySelector('a[href="/entrar"]')).toBeNull();
    expect(screen.getByTestId("landing-entrar-faixa").getAttribute("href")).toBe("/entrar");
    expect(screen.getByTestId("landing-entrar-baixar").getAttribute("href")).toBe("/entrar");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    for (const proibido of ["/inicio", "/comecar", "/plano", "/lp", "/funil", "/auth", "apps.apple.com", "play.google.com"]) {
      expect(hrefs.some((h) => h.includes(proibido)), proibido).toBe(false);
    }
    // rodapé institucional (exigência das lojas e da Apple): legais + suporte + empresa
    for (const h of ["/privacidade", "/termos", "/excluir-conta", "/suporte"]) expect(hrefs).toContain(h);
  });

  it("os benefícios usam prints reais (home, finanças, rotina, treino, dieta, computador) e os 16 tiles estão lá", () => {
    montar();
    for (const m of ["home", "financas", "rotina", "treino", "dieta", "computador"]) {
      expect(document.querySelector(`img[src="/landing/${m}.webp"]`), m).not.toBeNull();
    }
    expect(screen.getByTestId("tiles-modulos").querySelectorAll("li")).toHaveLength(16);
    // toda imagem tem largura/altura declaradas (sem CLS)
    for (const img of Array.from(document.querySelectorAll("img"))) {
      expect(img.getAttribute("width"), img.getAttribute("src") ?? "").not.toBeNull();
      expect(img.getAttribute("height"), img.getAttribute("src") ?? "").not.toBeNull();
    }
  });

  it("prova social é só o que existe de verdade: avaliações das DUAS lojas, nomes como na loja, sem nota nem contagem", () => {
    montar();
    const bloco = screen.getByTestId("avaliacoes");
    expect(bloco.querySelectorAll("li")).toHaveLength(6);
    const lojas = [...bloco.querySelectorAll("[data-loja-avaliacao]")].map((e) => e.getAttribute("data-loja-avaliacao"));
    expect(lojas.filter((l) => l === "App Store")).toHaveLength(2);
    expect(lojas.filter((l) => l === "Google Play")).toHaveLength(4);
    expect(bloco.textContent).toContain("Sabryna1610");
    expect(bloco.textContent).toContain("Elisa M."); // nome conferido na API da Play (o paywall tem "Elisa D.", errado)
    expect(bloco.textContent).not.toContain("Elisa D.");
    expect(screen.getByTestId("hero-prova").textContent).toContain("App Store");
    expect(screen.getByTestId("landing").textContent).not.toMatch(/★|\+\s?\d+\s?(mil|pessoas)|4,\d\s?estrelas/);
  });

  it("NENHUM preço na página (dono 01/10): nem R$, nem 'dias grátis', nem 'pagamento único'", () => {
    montar();
    const texto = screen.getByTestId("landing").textContent ?? "";
    expect(texto).not.toMatch(/R\$/);
    expect(texto).not.toMatch(/dias grátis|pagamento único|por ano|por mês|27,90|97,90|24,90/i);
    expect(screen.queryByTestId("plano-ios")).toBeNull();
  });
});
