/**
 * Retrospectiva, tema Recortes, página "Como você estava": a palavra do humor
 * vai numa foto de polaroide de largura fixa. Varredura 27/09: "no meio-termo."
 * saía cortada ("no meio-term") em 360 e 390 — o piso de tamanho (40% do
 * máximo) não deixava a palavra comprida diminuir até caber. Toda palavra do
 * humor tem que caber na linha, nas duas alturas de tela do desenho.
 */
import { describe, it, expect } from "vitest";
import { larguraDe } from "@/components/wrapped/prancheta";
import { FONTE_DA_PALAVRA, tamanhoDaPalavra } from "@/components/wrapped/tema-recortes";

// as 5 palavras de PALAVRA_DO_HUMOR (lib/retrospectiva), com o ponto que a página põe
const PALAVRAS = ["mal.", "pra baixo.", "no meio-termo.", "bem.", "muito bem."];

describe("Recortes · a palavra do humor cabe na foto", () => {
  for (const w of [212, 229, 246]) {
    it(`foto de ${w}: todas cabem em ${w - 40}, cada uma no MAIOR tamanho que cabe (até 42% da foto)`, () => {
      for (const p of PALAVRAS) {
        const tam = tamanhoDaPalavra(p, w);
        expect(larguraDe(p, tam, FONTE_DA_PALAVRA)).toBeLessThanOrEqual(w - 40 + 0.01);
        // não encolhe à toa: é o teto do desenho ou o tamanho exato que enche a linha
        expect(tam).toBeCloseTo(Math.min(w * 0.42, (w - 40) / larguraDe(p, 1, FONTE_DA_PALAVRA)), 6);
      }
      expect(tamanhoDaPalavra("bem.", w)).toBeGreaterThan(tamanhoDaPalavra("no meio-termo.", w) * 2);
    });
  }
});
