/**
 * A MENSAL NO iPHONE (04/09) — recusa 2.1 da Apple, sessão 1b27531a.
 *
 * `subscriptionOptions` é coisa do Google Play (plano base × oferta com fase
 * grátis). Na App Store a lista vem VAZIA, e a regra "semTrial sem plano base
 * = falha fechada" — certa no Android — fazia a mensal falhar SEMPRE no
 * iPhone com `sem_base_plan`, antes de abrir a folha. O revisor tocou duas
 * vezes e viu isso. Aqui a decisão é pura e testada nas duas lojas.
 */
import { describe, it, expect } from "vitest";
import { escolherOpcaoDeCompra } from "@/lib/revenuecat";

const base = { id: "core_mensal:base", isBasePlan: true };
const trial = { id: "core_mensal:coretrialmensal", freePhase: { dias: 3 }, isBasePlan: false };

describe("escolherOpcaoDeCompra — Android continua igual", () => {
  it("semTrial compra o PLANO BASE explicitamente", () => {
    expect(escolherOpcaoDeCompra([trial, base], { semTrial: true, naApple: false })).toEqual({ escolhida: base });
  });
  it("semTrial SEM plano base identificável = falha fechada (não vende teste grátis prometendo cobrar hoje)", () => {
    expect(escolherOpcaoDeCompra([trial], { semTrial: true, naApple: false })).toEqual({ falha: "sem_base_plan" });
    expect(escolherOpcaoDeCompra([], { semTrial: true, naApple: false })).toEqual({ falha: "sem_base_plan" });
  });
  it("com trial permitido, prefere a oferta com fase grátis; sem nenhuma, deixa o pacote decidir", () => {
    expect(escolherOpcaoDeCompra([base, trial], { semTrial: false, naApple: false })).toEqual({ escolhida: trial });
    expect(escolherOpcaoDeCompra([], { semTrial: false, naApple: false })).toEqual({ escolhida: undefined });
  });
});

describe("escolherOpcaoDeCompra — App Store", () => {
  it("lista vazia + semTrial NÃO é falha: compra o pacote (o que o revisor precisava)", () => {
    const d = escolherOpcaoDeCompra([], { semTrial: true, naApple: true });
    expect(d.falha).toBeUndefined();
    expect(d.escolhida).toBeUndefined(); // → purchasePackage
  });
  it("nunca devolve sem_base_plan no iPhone", () => {
    for (const semTrial of [true, false]) {
      expect(escolherOpcaoDeCompra([], { semTrial, naApple: true }).falha).toBeUndefined();
    }
  });
});
