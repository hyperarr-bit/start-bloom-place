/**
 * Varredura 26/10 (Conquistas › "Ver todas" em branco ao rolar rápido): a grade usa MINIATURAS de cada figurinha do
 * caderno (scripts/miniaturas-figurinhas.mjs → src/assets/conquistas-caderno/mini/<id>.webp). Esta trava falha se uma
 * figurinha entrar/mudar no mapa e a miniatura não for gerada (a grade cairia na arte grande — funciona, mas pesado).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ARTES_CADERNO } from "@/components/conquistas/artes-caderno";
import { ARTES_MINI, arteMini } from "@/components/conquistas/artes-caderno-mini";

const PASTA = path.resolve(__dirname, "../assets/conquistas-caderno/mini");

describe("miniaturas da grade da coleção", () => {
  it("toda figurinha do caderno tem a sua miniatura (e nenhuma sobra)", () => {
    const ids = Object.keys(ARTES_CADERNO).sort();
    const minis = fs.readdirSync(PASTA).filter((f) => f.endsWith(".webp")).map((f) => f.replace(".webp", "")).sort();
    expect(minis).toEqual(ids);
    expect(Object.keys(ARTES_MINI).sort()).toEqual(ids);
  });
  it("as miniaturas são pequenas (288 px, poucos KB) e arteMini cai na grande se faltar", () => {
    for (const f of fs.readdirSync(PASTA)) expect(fs.statSync(path.join(PASTA, f)).size).toBeLessThan(80 * 1024);
    expect(arteMini("nao-existe")).toBeUndefined();
    const id = Object.keys(ARTES_CADERNO)[0];
    expect(arteMini(id)).toBe(ARTES_MINI[id]);
  });
});
