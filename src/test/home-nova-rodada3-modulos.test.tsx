/**
 * RODADA 3 (26/10) — a IDENTIDADE DO MÓDULO dentro do módulo (components/modules/IconeDoModulo): com a chave home_nova
 * ligada, o cabeçalho usa o MESMO ícone da grade da Home nova (lib/modulos) e a cor da paleta nova (paleta.ts);
 * desligada, rende o de hoje. O Pet fica como está (não usa o componente). E as cores do fogo (fogo-caderno) na régua
 * suave da Home: petróleo/violeta/ouro com o croma ajustado e a progressão âmbar < ouro mantida.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Apple, Mail } from "lucide-react";
import { IconeDoModulo } from "@/components/modules/IconeDoModulo";
import { MODULOS } from "@/lib/modulos";
import { CHAVE_FORCA_HOME_NOVA, _zerarHomeNova } from "@/lib/home-nova";
import { FOGOS_CADERNO, fogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/admin", () => ({ checkIsAdmin: vi.fn(async () => false) }));

/* OKLCH de um #hex (a mesma conta usada na medição do adendo B) */
const oklch = (hex: string) => {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
};

beforeEach(() => { localStorage.clear(); _zerarHomeNova(); });
afterEach(() => cleanup());

describe("a identidade do módulo dentro do módulo", () => {
  it("com a chave ligada: o ícone da grade (Users em Relações, Apple em Dieta) na cor da paleta nova; desligada: o de hoje", () => {
    localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "on");
    render(<IconeDoModulo id="relacionamentos" antes={<Mail data-testid="antes-mail" className="w-5 h-5" />} />);
    const inv = screen.getByTestId("icone-modulo-relacionamentos");
    expect(inv.getAttribute("data-identidade")).toBe("home-nova");
    expect(screen.queryByTestId("antes-mail")).toBeNull();
    const svg = inv.querySelector("svg")!;
    expect(svg.getAttribute("class")).toContain("lucide-users"); // o MESMO ícone da grade (lib/modulos)
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
    expect(inv.getAttribute("data-cor")).toMatch(/^oklch\(/); // a cor da paleta nova (paleta.ts), não a classe tailwind (o jsdom não guarda oklch no style)
    expect(MODULOS.find((m) => m.id === "relacionamentos")!.Icon).toBeTruthy();
    cleanup();
    localStorage.setItem(CHAVE_FORCA_HOME_NOVA, "off");
    render(<IconeDoModulo id="dieta" antes={<Apple data-testid="antes-apple" className="w-5 h-5 text-green-600" />} />);
    expect(screen.getByTestId("antes-apple")).toBeTruthy();
    expect(screen.queryByTestId("icone-modulo-dieta")).toBeNull();
  });
  it("os 15 cabeçalhos passam pelo componente (o Pet não)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const paginas: Record<string, string> = { treino: "Treino", dieta: "Dieta", rotina: "Rotina", desenvolvimento: "DesenvolvimentoPessoal", saude: "Saude", casa: "Casa", estudos: "Estudos", biblioteca: "Biblioteca", beleza: "Beleza", viagens: "Viagens", carreira: "Carreira", hiperfoco: "Hiperfoco", relacionamentos: "Relacionamentos", detox: "Detox", financas: "Index" };
    for (const [id, arquivo] of Object.entries(paginas)) {
      const src = readFileSync(resolve(process.cwd(), `src/pages/${arquivo}.tsx`), "utf8");
      expect(src, arquivo).toContain(`<IconeDoModulo id="${id}"`);
    }
    expect(readFileSync(resolve(process.cwd(), "src/pages/Pet.tsx"), "utf8")).not.toContain("IconeDoModulo");
  });
});

describe("as cores do fogo na régua suave da Home (adendo B)", () => {
  it("petróleo, violeta e ouro com o croma na faixa dos azulejos (0,08–0,14); a progressão âmbar < ouro; as iniciais na faixa", () => {
    const C = (i: number) => oklch(FOGOS_CADERNO[i].meio).C;
    expect(C(3)).toBeGreaterThan(0.08); // petróleo (era 0,06)
    expect(C(4)).toBeGreaterThan(0.10); // violeta (era 0,08)
    expect(C(5)).toBeGreaterThan(C(2)); // ouro mais rico que o âmbar (era ao contrário)
    for (let i = 0; i < 6; i++) { expect(C(i)).toBeGreaterThan(0.08); expect(C(i)).toBeLessThan(0.15); }
    // a matiz de cada faixa ficou (laranja ~60–70 · âmbar ~88 · petróleo ~200 · violeta ~308 · ouro ~86)
    expect(oklch(FOGOS_CADERNO[3].meio).h).toBeGreaterThan(190); expect(oklch(FOGOS_CADERNO[3].meio).h).toBeLessThan(212);
    expect(oklch(FOGOS_CADERNO[4].meio).h).toBeGreaterThan(300); expect(oklch(FOGOS_CADERNO[4].meio).h).toBeLessThan(316);
    expect(fogoDoCaderno(14).id).toBe("petroleo"); expect(fogoDoCaderno(30).id).toBe("violeta"); expect(fogoDoCaderno(100).id).toBe("dourado");
  });
});
