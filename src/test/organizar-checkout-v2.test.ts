/**
 * /organizar — O CHECKOUT NOVO (08/11, chave CHECKOUT_ORG_V2 no <head>; novidades-guardadas/2026-11-07/checkout-organizar/SPEC.md).
 *
 * 1. Chave off idêntica: o roteiro fixo (./organizar-cko-roteiro.ts) dá EXATAMENTE a fixture gravada do HEAD 08bc1145 antes de mexer
 *    (os 2 braços do AB_LP × os 2 braços do AB_PIX), tirando só braco_cko/cko_forcado dos eventos.
 * A página roda de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção).
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { roteiroHoje, type Lp, type Pix, type Roteiro } from "./organizar-cko-roteiro";

const FIXTURE = resolve(__dirname, "fixtures/organizar-hoje-07-11.json");
const COMBOS: Array<[Lp, Pix]> = [["atual", "atual"], ["atual", "b"], ["v2", "atual"], ["v2", "b"]];

describe("chave off idêntica: o /organizar de hoje, nos 2 braços do AB_LP × 2 do AB_PIX", () => {
  it("o roteiro fixo dá exatamente a fixture gravada antes de mexer (cartão em cada estado, eventos e pixel)", async () => {
    const gravar = process.env.GRAVAR_FIXTURE_CKO === "1";
    if (!gravar) expect(existsSync(FIXTURE)).toBe(true); // sem a fixture e sem pedir pra gravar: falha (nunca grava escondido)
    const tudo: Record<string, Roteiro> = {};
    for (const [lp, pix] of COMBOS) tudo[`${lp}|${pix}`] = await roteiroHoje(lp, pix);
    if (gravar) {
      mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
      writeFileSync(FIXTURE, JSON.stringify(tudo, null, 1) + "\n");
    }
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Roteiro>;
    for (const k of Object.keys(fx)) {
      expect(tudo[k].estados, k).toEqual(fx[k].estados);
      expect(tudo[k].eventos, k).toEqual(fx[k].eventos);
      expect(tudo[k].pixel, k).toEqual(fx[k].pixel);
    }
  }, 120_000);
});
