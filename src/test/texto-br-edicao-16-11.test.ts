/** 16/11 (revisor da 1.0.28): rascunho de edição com vírgula — digitar vírgula num valor que veio com ponto não multiplica por 10. */
import { describe, it, expect } from "vitest";
import { numeroBR, textoBR } from "@/lib/data-normalizers";

describe("textoBR", () => {
  it("mostra a vírgula e o numeroBR lê de volta o mesmo número", () => {
    expect(textoBR(1234.5)).toBe("1234,5");
    expect(numeroBR(textoBR(1234.5))).toBe(1234.5);
    expect(numeroBR(textoBR(1234.5) + "0")).toBe(1234.5);
    expect(textoBR(80)).toBe("80");
    expect(textoBR(undefined)).toBe("");
    expect(textoBR("")).toBe("");
  });
  it("antes: o texto com ponto + vírgula virava 10x", () => {
    expect(numeroBR("1234.5,")).toBe(12345);
  });
});
