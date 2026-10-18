/**
 * /raio-x com a chave desligada: volta pra landing e leva a query (step sai, utm fica).
 * O arquivo entregue tem RAIOX = "off".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/raiox", () => ({ RAIOX: "off", RAIOX_DEMO: "ab" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false, isSubscribed: false }) }));

import RaioXRota from "@/pages/raiox/RaioX";

function Destino() {
  const loc = useLocation();
  return <div data-testid="destino">{loc.pathname}{loc.search}</div>;
}

describe("RAIOX off", () => {
  it("o arquivo entregue está desligado", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/raiox.ts"), "utf8");
    expect(src).toMatch(/export const RAIOX: "off" \| "on" = "off"/);
  });

  it("redireciona pra / e preserva utm e fbclid", () => {
    window.history.replaceState({}, "", "/raio-x?utm_source=meta&utm_campaign=120&fbclid=abc&step=lixo");
    render(
      <MemoryRouter initialEntries={["/raio-x?utm_source=meta&utm_campaign=120&fbclid=abc&step=lixo"]}>
        <Routes>
          <Route path="/raio-x" element={<RaioXRota />} />
          <Route path="/" element={<Destino />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("destino").textContent).toBe("/?utm_source=meta&utm_campaign=120&fbclid=abc");
  });

  it("a rota nova está no SoNaWeb e as rotas antigas seguem iguais", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/raio-x" element={<SoNaWeb><RouteErrorBoundary routeName="raio-x"><RaioX /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinar" element={<SoNaWeb><RouteErrorBoundary routeName="venda-web"><VendaWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/comece" element={<SoNaWeb><RouteErrorBoundary routeName="porta-iphone"><PortaIphone /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/experimente" element={<SoNaWeb><RouteErrorBoundary routeName="experimente"><Experimente /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/liberar" element={<SoNaWeb><RouteErrorBoundary routeName="liberar"><Liberar /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app).toContain('<Route path="/assinatura" element={<SoNaWeb><RouteErrorBoundary routeName="assinatura-app"><AssinaturaApp /></RouteErrorBoundary></SoNaWeb>} />');
    expect(readFileSync(join(process.cwd(), "src/lib/rotas-web.ts"), "utf8")).toContain("export const VENDA_NA_WEB = false");
    expect(readFileSync(join(process.cwd(), "src/components/TrialBanner.tsx"), "utf8")).toContain('location.pathname.startsWith("/raio-x")');
  });
});
