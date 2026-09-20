/**
 * LEMBRETE "ACABA AMANHÃ" do teste grátis da loja (20/09, iPhone).
 * A Apple não avisa antes de cobrar e exige cancelar 24 h antes do fim —
 * o aviso tem que cair DEPOIS de 24 h do começo e ANTES de 48 h do fim,
 * numa hora acordada. Estes casos travam a conta.
 */
import { describe, it, expect } from "vitest";
import { quandoLembrarDoTeste, copyDoLembreteDoTeste } from "@/lib/notificacoes";

const h = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600e3;

describe("quandoLembrarDoTeste", () => {
  it("compra às 15h: avisa no dia 3 às 9h — 42 h depois, 30 h antes de cobrar", () => {
    const inicio = new Date(2026, 8, 21, 15, 0, 0);
    const alvo = quandoLembrarDoTeste(inicio, 3);
    expect(alvo.getDate()).toBe(23);
    expect(alvo.getHours()).toBe(9);
    expect(h(inicio, alvo)).toBe(42);
  });

  it("compra às 22h: 36 h antes do fim cai às 10h, fica como está", () => {
    const inicio = new Date(2026, 8, 21, 22, 0, 0);
    const alvo = quandoLembrarDoTeste(inicio, 3);
    expect(alvo.getDate()).toBe(23);
    expect(alvo.getHours()).toBe(10);
    expect(h(inicio, alvo)).toBe(36);
  });

  it("compra às 9h30: 36 h antes seria 21h30 — recua pra 20h30 do mesmo dia", () => {
    const inicio = new Date(2026, 8, 21, 9, 30, 0);
    const alvo = quandoLembrarDoTeste(inicio, 3);
    expect(alvo.getDate()).toBe(22);
    expect(alvo.getHours()).toBe(20);
    expect(alvo.getMinutes()).toBe(30);
  });

  it("qualquer hora de compra, 3 ou 7 dias: aviso entre 24 h e 48 h antes do fim, das 9h às 21h", () => {
    for (const dias of [3, 7]) {
      for (let hora = 0; hora < 24; hora++) {
        const inicio = new Date(2026, 8, 21, hora, 17, 0);
        const alvo = quandoLembrarDoTeste(inicio, dias);
        const fim = new Date(inicio.getTime() + dias * 86400e3);
        const antesDoFim = h(alvo, fim);
        expect(antesDoFim, `dias=${dias} hora=${hora}`).toBeGreaterThanOrEqual(24);
        expect(antesDoFim, `dias=${dias} hora=${hora}`).toBeLessThanOrEqual(48);
        expect(alvo.getHours(), `dias=${dias} hora=${hora}`).toBeGreaterThanOrEqual(9);
        expect(alvo.getHours(), `dias=${dias} hora=${hora}`).toBeLessThan(21);
        expect(alvo.getTime()).toBeGreaterThan(inicio.getTime());
      }
    }
  });

  it("copy diz o preço do ano, onde cancelar, e que já cancelou pode ignorar", () => {
    const c = copyDoLembreteDoTeste("R$ 97,90");
    expect(c.title).toBe("Seu teste grátis do CORE acaba amanhã");
    expect(c.body).toMatch(/R\$ 97,90 pelo ano inteiro/);
    expect(c.body).toMatch(/Ajustes › Assinaturas/);
    expect(c.body).toMatch(/Já cancelou\? Pode ignorar/);
    expect(c.body).not.toMatch(/vitalíc|pra sempre/i);
  });
});
