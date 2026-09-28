/**
 * A regra global do alvo de toque (index.css, "botão só-ícone nu") dá 8 px de
 * padding em content-box e margem −8 px a todo botão cujo único filho é um
 * ícone e que NÃO tem fundo/borda pela classe do Tailwind. Botão pintado por
 * classe própria (conquistas.css) escapa do filtro e INFLA: na varredura de
 * 27/09 o X e o Instagram do álbum em tela cheia (círculos de 40 px) viravam
 * 56 px colados na borda da tela, e as setas (34) viravam 50; o "Abrir agora"
 * da dica do planner (ícone + texto: o texto não conta pro :only-child) virava
 * uma pílula de 54 px avançando 8 px sobre a margem do cartão.
 *
 * Este teste lê a regra do index.css e os fundos do conquistas.css e garante
 * que nenhum botão pintado das Conquistas (dica, planner aberto, álbum) cai nela.
 */
process.env.TZ = "America/Sao_Paulo";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: () => {},
}));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => null }));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { CHAVE_DICA_PLANNER } from "@/components/conquistas/DicaDoPlanner";
import { somarDias } from "@/lib/sequencia";

const raiz = path.resolve(__dirname, "..");
const indexCss = fs.readFileSync(path.join(raiz, "index.css"), "utf8");
const conquistasCss = fs.readFileSync(path.join(raiz, "components/conquistas/conquistas.css"), "utf8");

/** O seletor da regra global (a linha que começa em `button:has(> svg:only-child)`). */
const REGRA = /^(button:has\(> svg:only-child\)[^{]*)\{/m.exec(indexCss)?.[1].trim() ?? "";

/** Classes do conquistas.css com fundo próprio (regra de classe única com background ≠ none). */
const PINTADAS = new Set(
  [...conquistasCss.matchAll(/(?:^|\n)\s*\.([a-z0-9-]+)\s*\{([^}]*)\}/gi)]
    .filter(([, , corpo]) => {
      const bg = /background(?:-color)?\s*:\s*([^;]+)/.exec(corpo)?.[1]?.trim();
      return !!bg && !/^(none|transparent)$/.test(bg);
    })
    .map(([, classe]) => classe),
);

const HOJE = "2026-09-26";
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("alvo de toque × botões pintados das Conquistas", () => {
  it("a regra do index.css e os fundos do conquistas.css foram achados (senão o teste não prova nada)", () => {
    expect(REGRA).toContain('button:has(> svg:only-child)');
    expect(PINTADAS.has("alb-redondo")).toBe(true);
    expect(PINTADAS.has("alb-seta")).toBe(true);
    expect(PINTADAS.has("dica-abrir")).toBe(true);
    // a seta das insígnias NÃO tem fundo: ganhar a área de toque extra é o esperado
    expect(PINTADAS.has("pin-seta")).toBe(false);
  });

  it("dica do planner, planner aberto e álbum em tela cheia: nenhum botão pintado por classe própria cai na regra que infla", async () => {
    const dados: Record<string, unknown> = {
      "core-user-name": "Ana Beatriz",
      "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
      "conquistas-desbloqueadas": { "sequencia-7": "2026-09-20", "leitura-1": "2026-09-21" },
      "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
      "conquistas-nivel-piso": "Bronze",
      // 1ª visita: a dica aparece (o "Abrir agora" tem ícone + texto e fundo do conquistas.css)
      [CHAVE_DICA_PLANNER]: { vistas: 0, fim: false },
      "lib-books": [{ status: "lido" }],
    };
    const valor = {
      get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
      set: (k: string, v: unknown) => { dados[k] = v; },
      loaded: true, isGuest: false, fetchKey: async () => null,
    } as unknown as UserDataContextType;
    render(
      <MemoryRouter>
        <UserDataContext.Provider value={valor}>
          <TelaConquistas />
        </UserDataContext.Provider>
      </MemoryRouter>,
    );
    const infladosPintados = () =>
      [...document.querySelectorAll<HTMLButtonElement>(REGRA)]
        .filter((b) => [...b.classList].some((c) => PINTADAS.has(c)))
        .map((b) => `${b.className} (${b.getAttribute("aria-label") ?? ""})`);

    expect(screen.getByTestId("dica-abrir")).toBeInTheDocument();
    expect(infladosPintados()).toEqual([]);

    fireEvent.click(screen.getByTestId("capa-3d"));
    await screen.findByTestId("pagina-insignias");
    expect(infladosPintados()).toEqual([]);

    fireEvent.click(screen.getByTestId("album-abrir"));
    const tela = await screen.findByTestId("album-tela");
    // os quatro botões redondos do álbum existem e estão fora da regra
    expect(tela.querySelectorAll(".alb-redondo, .alb-seta")).toHaveLength(4);
    expect(infladosPintados()).toEqual([]);
  });
});
