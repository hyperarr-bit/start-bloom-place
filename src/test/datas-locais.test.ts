import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * REGRA DE DATA (a família de bug mais cara da história deste app).
 *
 * Três rodadas de "meus dados sumiram" (julho/2026) tiveram a MESMA raiz:
 * derivar dia ou mês com `toISOString()`. O método devolve UTC, e no Brasil
 * (UTC-3) isso significa que das 21h em diante o app já está no dia seguinte
 * — grava em "amanhã", lê "hoje", e o registro simplesmente não aparece. Em
 * 08/08 o mesmo padrão foi achado ainda vivo nos gastos do Pet: gasto do dia
 * 1º sumindo do extrato do mês.
 *
 * O certo é `localDayKey()` (chave de dia) e `parseLocalDay()` (exibição),
 * ambos em src/lib/utils.
 *
 * Este teste é a trava. Falhou? Troque por localDayKey — não adicione
 * exceção sem entender o fuso do caso.
 */
const RAIZ = join(process.cwd(), "src");

// AdminCampaigns já converte BRT na mão antes de fatiar (subtrai 3h), então
// o toISOString ali é proposital e correto para o relatório de anúncios.
const EXCECOES = ["src/pages/admin/AdminCampaigns.tsx"];

const PROIBIDO = /toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*(7|10)\s*\)/;

const arquivos = (dir: string): string[] => {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "test" || nome === "node_modules") continue;
      saida.push(...arquivos(caminho));
    } else if (/\.tsx?$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
};

describe("chave de dia/mês", () => {
  it("ninguém deriva dia ou mês com toISOString (usa localDayKey)", () => {
    const infratores: string[] = [];
    for (const caminho of arquivos(RAIZ)) {
      const rel = caminho.slice(caminho.indexOf("src/"));
      if (EXCECOES.includes(rel)) continue;
      const src = readFileSync(caminho, "utf8");
      src.split("\n").forEach((linha, i) => {
        if (PROIBIDO.test(linha)) infratores.push(`${rel}:${i + 1}`);
      });
    }
    expect(infratores, `use localDayKey() em: ${infratores.join(", ")}`).toEqual([]);
  });
});
