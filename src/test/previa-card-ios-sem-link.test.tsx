/**
 * COMPARTILHAR_V2 (23/10): o "Copiar o link pra figurinha de Link" copia o link do site/funil de venda — no app do
 * iPhone ele não pode aparecer (regra da loja: sem link de site/Pix no iOS). Na web e no Android segue igual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const plataforma = vi.hoisted(() => ({ nativo: false, p: "web" as "web" | "ios" | "android" }));
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isIOS: () => plataforma.p === "ios",
  isAndroid: () => plataforma.p === "android",
}));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn() }));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: () => Promise.resolve(false) }));

import { PreviaDoCard } from "@/components/compartilhar/PreviaDoCard";
import type { DadosCard } from "@/components/compartilhar/tipos";

const dados: DadosCard = { tipo: "agua", ano: 2026, mesIdx: 9, hoje: "2026-10-23", porDia: [1, 0.5, 1] };
const abrir = () => render(<PreviaDoCard dados={dados} origem="teste" titulo="Água" onFechar={() => {}} formatoInicial="stories" />);

beforeEach(() => { plataforma.nativo = false; plataforma.p = "web"; });
afterEach(() => cleanup());

describe("prévia do card · link pra figurinha de Link", () => {
  it("web: o botão aparece nos Stories", () => {
    abrir();
    expect(screen.getByTestId("copiar-link-card")).toBeTruthy();
  });
  it("app Android: o botão aparece", () => {
    plataforma.nativo = true; plataforma.p = "android";
    abrir();
    expect(screen.getByTestId("copiar-link-card")).toBeTruthy();
  });
  it("app iPhone: o botão NÃO aparece (o resto da prévia segue)", () => {
    plataforma.nativo = true; plataforma.p = "ios";
    abrir();
    expect(screen.queryByTestId("copiar-link-card")).toBeNull();
    expect(screen.getByTestId("postar-card-imagem")).toBeTruthy();
  });
});
