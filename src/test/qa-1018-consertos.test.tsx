/**
 * QA de Simulador da 1.0.18 — três defeitos visíveis:
 *  1. o "✓ As N figurinhas foram coladas no álbum" nunca sumia (cobria o contador e a seta ‹);
 *  2. faixa BRANCA atrás do relógio sobre o álbum e sobre o escurecido da folha "O que te fez parar?";
 *  3. o "Meu acesso" do iPhone mostrava a versão do Android.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: () => undefined,
}));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => <canvas /> }));
vi.mock("framer-motion", async (importOriginal) => {
  const real = await importOriginal<typeof import("framer-motion")>();
  return { ...real, useReducedMotion: () => true };
});

import { AlbumTela, AVISO_FIM_COLAGEM_MS } from "@/components/conquistas/AlbumTela";
import { montarAlbum } from "@/components/conquistas/album-paginas";
import { FolhaMotivos } from "@/components/paywall/FolhaMotivos";
import { versaoVisivel } from "@/lib/versao-visivel";
import type { Badge, Raridade } from "@/components/gamification/types";

const figurinha = (id: string, raridade: Raridade, unlocked: boolean): Badge =>
  ({ id, name: id, description: id, icon: "⭐", color: "#000", category: "finance", raridade, unlocked, xp: 50, progresso: unlocked ? undefined : { atual: 1, alvo: 3 } } as Badge);
const ADESIVOS: Badge[] = [
  figurinha("lend-1", "lendario", true), figurinha("lend-2", "lendario", false),
  figurinha("epi-1", "epico", true), figurinha("epi-2", "epico", false),
  figurinha("raro-1", "raro", true), figurinha("raro-2", "raro", true), figurinha("raro-3", "raro", false),
  figurinha("com-1", "comum", true), figurinha("com-2", "comum", true), figurinha("com-3", "comum", false),
];
const DESBLOQUEADAS: Record<string, string> = Object.fromEntries(ADESIVOS.filter((b) => b.unlocked).map((b) => [b.id, "2026-09-20"]));
const POR_RARIDADE = { lendario: { abertos: 1, total: 2 }, epico: { abertos: 1, total: 2 }, raro: { abertos: 2, total: 3 }, comum: { abertos: 2, total: 3 } };

/** O álbum editorial aberto pelo pacotinho com 2 figurinhas pra colar; colar tira da lista de pendentes, como a tela faz. */
function AlbumComFila({ aberto = true }: { aberto?: boolean }) {
  const paginas = montarAlbum(ADESIVOS, DESBLOQUEADAS);
  const [pendentes, setPendentes] = useState(["com-1", "com-2"]);
  return (
    <MemoryRouter>
      <AlbumTela
        aberto={aberto} editorial via="pacotinho" paginaInicial={4} pendentes={pendentes}
        onColar={(b) => setPendentes((p) => p.filter((id) => id !== b.id))}
        paginas={paginas} adesivos={ADESIVOS} desbloqueadas={DESBLOQUEADAS} novas={[]} maisRaros={paginas[0].vagas}
        abertos={6} total={10} porRaridade={POR_RARIDADE} nome="Ana" nivel="Bronze" ano={2026} diasDeSequencia={3}
        onFechar={() => undefined} onCompartilhar={() => undefined} onCompartilharFigurinha={() => undefined}
      />
    </MemoryRouter>
  );
}
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const status = () => document.querySelector(".alb-colagem-status") as HTMLElement;

describe("1. o aviso do fim da colagem some sozinho", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    vi.setSystemTime(new Date(2026, 9, 24, 10, 0));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("aparece ao terminar a fila e some em ~3 s, sem voltar", () => {
    render(<AlbumComFila />);
    for (let i = 0; i < 20 && !status().textContent?.includes("figurinhas foram coladas"); i++) avancar(100);
    expect(status()).toHaveTextContent("As 2 figurinhas foram coladas no álbum");
    expect(status()).toHaveAttribute("data-visivel");
    avancar(AVISO_FIM_COLAGEM_MS - 200);
    expect(status()).toHaveAttribute("data-visivel");
    avancar(400);
    expect(status()).not.toHaveAttribute("data-visivel");
    avancar(10_000);
    expect(status()).not.toHaveAttribute("data-visivel");
  });

  it("virar a página tira o aviso na hora", () => {
    render(<AlbumComFila />);
    for (let i = 0; i < 20 && !status().textContent?.includes("figurinhas foram coladas"); i++) avancar(100);
    expect(status()).toHaveAttribute("data-visivel");
    fireEvent.click(screen.getByTestId("album-tela-anterior"));
    avancar(50);
    expect(status()).not.toHaveAttribute("data-visivel");
  });
});

describe("2. telas escuras cobrem a área do relógio (sem a faixa branca)", () => {
  afterEach(() => { cleanup(); document.documentElement.style.removeProperty("--safe-top-cor"); });

  it("o álbum aberto deixa a faixa do relógio transparente (o fundo dele, fixed inset-0, vai até o topo) e devolve ao fechar", () => {
    const { rerender } = render(<AlbumComFila />);
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("transparent");
    rerender(<AlbumComFila aberto={false} />);
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("");
  });

  it("a folha 'O que te fez parar?': escurecido em inset-0 e a faixa transparente; ao sair, volta a cor que a tela tinha", () => {
    document.documentElement.style.setProperty("--safe-top-cor", "#ffffff");
    const { unmount } = render(
      <FolhaMotivos dias={3} aviso={null} onPresente={() => undefined} onTeste={() => undefined} onVoltar={() => undefined} />,
    );
    const folha = screen.getByTestId("folha-motivos");
    expect(folha.className).toMatch(/\bfixed\b/);
    expect(folha.className).toMatch(/\binset-0\b/);
    const escurecido = folha.querySelector("[aria-hidden]") as HTMLElement;
    expect(escurecido.className).toMatch(/\binset-0\b/);
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("transparent");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--safe-top-cor")).toBe("#ffffff");
  });
});

describe("3. a versão do 'Meu acesso' por plataforma", () => {
  const g = globalThis as unknown as { __APP_VERSION__?: string; __APP_VERSION_IOS__?: string };
  beforeEach(() => { g.__APP_VERSION__ = "1.0.133 (134)"; g.__APP_VERSION_IOS__ = "1.0.18 (45)"; });
  afterEach(() => { delete g.__APP_VERSION__; delete g.__APP_VERSION_IOS__; });

  it("iPhone mostra a do iOS; Android e web, a do build.gradle", () => {
    expect(versaoVisivel("ios")).toBe("1.0.18 (45)");
    expect(versaoVisivel("android")).toBe("1.0.133 (134)");
    expect(versaoVisivel("web")).toBe("1.0.133 (134)");
  });

  it("sem a constante do build (vitest/dev) não quebra", () => {
    delete g.__APP_VERSION_IOS__;
    expect(versaoVisivel("ios")).toBe("dev");
  });

  it("o vite.config lê 1.0.18 (45) do project.pbxproj", async () => {
    const fs = await import("fs");
    const p = fs.readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    expect(p).toMatch(/MARKETING_VERSION = 1\.0\.18;/);
    expect(p).toMatch(/CURRENT_PROJECT_VERSION = 45;/);
    const cfg = fs.readFileSync("vite.config.ts", "utf8");
    expect(cfg).toContain("__APP_VERSION_IOS__: JSON.stringify(versaoDoAppIos)");
  });
});
