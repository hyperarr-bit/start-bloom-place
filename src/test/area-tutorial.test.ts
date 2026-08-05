import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { AREAS, AREA_TUTORIAL, type AreaKey } from "@/lib/funnel";

/**
 * O tour de um módulo só liga se a chave gravada no cadastro for EXATAMENTE a
 * string que a página passa pro SpotlightOverlay. É um acoplamento por texto,
 * invisível pro TypeScript, e a pegadinha mora em metas: a rota é
 * /desenvolvimento, o módulo do funil é "desenvolvimento", mas o tour se
 * chama "metas". Errar aqui não quebra nada — só faz o tutorial nunca
 * aparecer, que foi o defeito de 05/08 (5 dos 20 pagantes do dia sem
 * tutorial nenhum). Este teste é a trava.
 */
const PAGES_DIR = join(process.cwd(), "src/pages");

const chavesDeSpotlightNasPaginas = (): Set<string> => {
  const achadas = new Set<string>();
  for (const arquivo of readdirSync(PAGES_DIR)) {
    if (!arquivo.endsWith(".tsx")) continue;
    const src = readFileSync(join(PAGES_DIR, arquivo), "utf8");
    for (const m of src.matchAll(/moduleKey=["']([a-z]+)["']/g)) achadas.add(m[1]);
  }
  return achadas;
};

describe("AREA_TUTORIAL", () => {
  it("cobre todas as áreas da porta", () => {
    for (const area of Object.keys(AREAS) as AreaKey[]) {
      expect(AREA_TUTORIAL[area], `área ${area} sem chave de tutorial`).toBeTruthy();
    }
  });

  it("usa chaves que alguma página realmente entrega ao SpotlightOverlay", () => {
    const reais = chavesDeSpotlightNasPaginas();
    expect(reais.size).toBeGreaterThan(3); // sanidade: o scan achou páginas
    for (const [area, chave] of Object.entries(AREA_TUTORIAL)) {
      expect(reais.has(chave), `${area} → "${chave}" não existe em nenhum moduleKey=`).toBe(true);
    }
  });

  it("mantém metas apontando pro tour 'metas' (e não pra rota 'desenvolvimento')", () => {
    expect(AREA_TUTORIAL.metas).toBe("metas");
    expect(AREAS.metas.module).toBe("desenvolvimento"); // rota ≠ chave do tour
  });
});
