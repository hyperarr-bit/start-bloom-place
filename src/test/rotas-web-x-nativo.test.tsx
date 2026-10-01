/**
 * ROTAS: WEB × APP DA LOJA depois de 01/10 (venda na web desligada).
 *
 * O que não pode quebrar, e por quê:
 *   · NO APP nada muda: /inicio, /comecar, /lp… continuam indo pra porta do
 *     app (ENTRADA_APP) exatamente como o SoNaWeb fazia; /app e /funil-w
 *     continuam renderizando o funil W. Já aconteceu de repontar rota de web
 *     e derrubar o app junto (26/07) — este teste é a cerca.
 *   · NA WEB toda rota de funil leva pra landing "/" PRESERVANDO utm/fbclid
 *     (anúncio antigo, link salvo) e tirando o lixo do funil (step, porta).
 *   · App.tsx está ligado do jeito certo (checagem no fonte: cada rota de
 *     venda passa pelo FunilAposentado; o nativo do /app é o ComecarW).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FunilAposentado } from "@/components/site/FunilAposentado";
import { destinoNaLanding, ENTRADA_APP, VENDA_NA_WEB } from "@/lib/rotas-web";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
import { trackEvent } from "@/lib/analytics";

const nativo = (on: boolean) => {
  if (on) (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "android", isNativePlatform: () => true };
  else delete (window as { Capacitor?: unknown }).Capacitor;
};
const Onde = () => { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; };

const montar = (entrada: string, rota: string, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path={rota} element={<FunilAposentado {...props} />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => { nativo(false); vi.mocked(trackEvent).mockClear(); });
afterEach(() => { cleanup(); nativo(false); });

describe("a chave", () => {
  it("a venda na web está DESLIGADA (decisão do dono, 01/10) — mudar aqui é mudar o site inteiro de propósito", () => {
    expect(VENDA_NA_WEB).toBe(false);
    expect(ENTRADA_APP).toBe("/app");
  });
});

describe("destinoNaLanding — a landing recebe a atribuição, não o lixo do funil", () => {
  it("preserva utm/fbclid/gclid/ttclid/ref e tira step/porta/from", () => {
    expect(destinoNaLanding("?utm_source=ig&utm_campaign=120250474048320041&fbclid=abc&step=offer&porta=vida&from=dia14"))
      .toBe("/?utm_source=ig&utm_campaign=120250474048320041&fbclid=abc");
    expect(destinoNaLanding("?gclid=g1&ttclid=t1&ref=AMIGA")).toBe("/?gclid=g1&ttclid=t1&ref=AMIGA");
  });
  it("sem parâmetros é a raiz limpa", () => {
    expect(destinoNaLanding("")).toBe("/");
    expect(destinoNaLanding("?step=analise")).toBe("/");
  });
});

describe("FunilAposentado na WEB", () => {
  it("/inicio com utm → landing com os mesmos utm (e registra de onde veio)", () => {
    montar("/inicio?utm_source=ig&utm_campaign=kenny&fbclid=xyz&step=offer", "/inicio", { web: <p>funil dia14</p> });
    expect(screen.getByTestId("onde").textContent).toBe("/?utm_source=ig&utm_campaign=kenny&fbclid=xyz");
    expect(screen.queryByText("funil dia14")).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("funil_redirecionado", { de: "/inicio" });
  });

  it("/app?step=offer fora do app → landing (o funil radar não monta)", () => {
    montar("/app?step=offer&utm_source=ig", "/app", { web: <p>radar</p>, nativo: <p>funil W</p> });
    expect(screen.getByTestId("onde").textContent).toBe("/?utm_source=ig");
    expect(screen.queryByText("funil W")).toBeNull();
    expect(screen.queryByText("radar")).toBeNull();
  });

  it("todas as rotas de venda antigas caem na raiz", () => {
    for (const r of ["/comecar", "/comecar-v2", "/plano", "/direto", "/lp", "/funil-dia14", "/funil-radar", "/funil-v1", "/funil-w"]) {
      montar(`${r}?utm_source=x`, r, { web: <p>funil</p> });
      expect(screen.getByTestId("onde").textContent, r).toBe("/?utm_source=x");
      cleanup();
    }
  });
});

describe("FunilAposentado no APP DA LOJA — igual ao SoNaWeb de antes", () => {
  it("rota de funil da web → porta do app (ENTRADA_APP), sem registrar redirecionamento", () => {
    nativo(true);
    montar("/inicio?utm_source=ig", "/inicio", { web: <p>funil dia14</p> });
    expect(screen.getByTestId("onde").textContent).toBe("/app");
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("/app renderiza o elemento nativo (o funil W), nunca redireciona", () => {
    nativo(true);
    montar("/app?step=compromissos", "/app", { web: <p>radar</p>, nativo: <p>funil W</p> });
    expect(screen.getByText("funil W")).toBeInTheDocument();
    expect(screen.queryByTestId("onde")).toBeNull();
  });
});

describe("App.tsx está ligado do jeito certo (fonte)", () => {
  const src = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

  it("cada rota de venda da web passa pelo FunilAposentado", () => {
    for (const p of ["/inicio", "/comecar", "/comecar-v2", "/plano", "/direto", "/lp", "/funil-dia14", "/funil-radar", "/funil-v1", "/funil-w", "/app"]) {
      const m = src.match(new RegExp(`<Route path="${p.replace(/[/-]/g, (c) => `\\${c}`)}" element=\\{<FunilAposentado`));
      expect(m, `rota ${p}`).not.toBeNull();
    }
  });

  it("o nativo do /app e do /funil-w continua sendo o ComecarW com o mesmo boundary", () => {
    expect(src).toContain('<Route path="/app" element={<FunilAposentado nativo={<PageTransition><RouteErrorBoundary routeName="funil-app"><ComecarW /></RouteErrorBoundary></PageTransition>}');
    expect(src).toContain('<Route path="/funil-w" element={<FunilAposentado nativo={<PageTransition><RouteErrorBoundary routeName="funil-w"><ComecarW /></RouteErrorBoundary></PageTransition>}');
  });

  it("a raiz deslogada da web é a Landing; o desvio de anúncio pro /inicio só com a venda ligada", () => {
    expect(src).toContain("return <Landing />;");
    expect(src).toContain("if (VENDA_NA_WEB && temMarcaDeAnuncio())");
    expect(src).not.toContain("<SiteHome />");
    // o volta-da-demo pro /inicio?step=analise só vale no app (ou com a venda ligada)
    expect(src).toContain("if (!user && (isNativeShell() || VENDA_NA_WEB)) {");
  });

  it("suporte, como-entrar e as legais continuam públicas na web; /planos da web passa pelo PlanosWeb", () => {
    expect(src).toContain('<Route path="/suporte" element={<SoNaWeb>');
    expect(src).toContain('<Route path="/como-entrar" element={<SoNaWeb>');
    expect(src).toContain('<Route path="/privacidade"');
    expect(src).toContain('<Route path="/termos"');
    expect(src).toContain('<Route path="/excluir-conta"');
    expect(src).toContain('<Route path="/entrar" element={<Entrar />} />');
    expect(src).toContain('<Route path="/bem-vindo"');
    expect(src).toContain("{isNativeShell() ? <PlanosApp /> : <PlanosWeb />}");
  });

  it("o funil do dia 14 saiu do bundle inicial (não há mais import eager dele)", () => {
    expect(src).not.toContain('import ComecarDia14Eager');
    expect(src).not.toContain('import LandingPage from "./pages/lp/LpFinancas"');
  });
});
