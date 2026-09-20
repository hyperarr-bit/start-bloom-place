import { describe, it, expect, beforeEach } from "vitest";
import { varianteCadastro, SIGNUP_AB_FORCE } from "@/lib/cadastro-ab";

describe("A/B da tela de cadastro", () => {
  beforeEach(() => localStorage.clear());
  it("sorteia uma vez e repete a mesma variante pro mesmo navegador", () => {
    const a = varianteCadastro();
    expect(["padrao", "email_primeiro"]).toContain(a);
    for (let i = 0; i < 20; i++) expect(varianteCadastro()).toBe(a);
    expect(localStorage.getItem("core-cadastro-ab")).toBe(a);
  });
  it("respeita a variante gravada", () => {
    localStorage.setItem("core-cadastro-ab", "email_primeiro");
    expect(varianteCadastro()).toBe("email_primeiro");
    localStorage.setItem("core-cadastro-ab", "padrao");
    expect(varianteCadastro()).toBe("padrao");
  });
  it("o sorteio é de verdade: em 400 navegadores as duas aparecem", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 400 && vistas.size < 2; i++) { localStorage.clear(); vistas.add(varianteCadastro()); }
    expect(vistas.size).toBe(2);
  });
  it("teste ligado (sem força) — trocar SIGNUP_AB_FORCE é a alavanca de 1 linha", () => {
    expect(SIGNUP_AB_FORCE).toBeNull();
  });
});
