/**
 * B3 (1.0.18, QA 21/10): a faixa "PRIMEIRA VEZ AQUI · <pedido>" cortava o pedido com reticências no iPhone (Biblioteca
 * "PONHA 1 LIVRO NA E…", Detox "FAÇA O CHECK-IN DE …", Treino no SE "MONTE O TREINO…") — justamente o que a pessoa
 * precisa ler no passo que pede ação dela. O jsdom não faz layout: o que este arquivo trava é a regra da folha de
 * estilo (até 2 linhas, sem nowrap/ellipsis) e que os pedidos longos cabem em 2 linhas de ~26 caracteres no SE.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INTROS } from "@/lib/intro-modulo";

const css = readFileSync(join(process.cwd(), "src/components/intro-modulo/intro-modulo.css"), "utf8");
const regra = (seletor: string) => css.split("\n").find((l) => l.startsWith(`${seletor} {`)) ?? "";

describe("faixa da intro: o pedido em até 2 linhas", () => {
  it(".im-faixa-titulo quebra em até 2 linhas (line-clamp 2) e não corta mais com reticências numa linha só", () => {
    const r = regra(".im-faixa-titulo");
    expect(r).toContain("-webkit-line-clamp: 2");
    expect(r).toContain("-webkit-box-orient: vertical");
    expect(r).not.toContain("nowrap");
    expect(r).not.toContain("text-overflow: ellipsis");
  });

  it("a faixa continua com 36 px; 2 linhas de 11 px × 1,15 cabem nela", () => {
    expect(css).toContain("--intro-modulo-faixa-h: 36px");
    expect(regra(".im-faixa-titulo")).toContain("line-height: 1.15");
    expect(11 * 1.15 * 2).toBeLessThan(36);
  });

  it("todo pedido ('Primeira vez aqui · <pedido>') cabe em 2 linhas de 26 caracteres (iPhone SE)", () => {
    const pedidos = Object.values(INTROS).flatMap((c) => [c.pedido, ...(c.formato === "toque" ? c.passos : (c.maisPassos ?? [])).map((p) => p.pedido ?? c.pedido)]);
    for (const p of pedidos) expect(`Primeira vez aqui · ${p}`.length, p).toBeLessThanOrEqual(52);
  });
});
