/**
 * 1.0.19 — CARD DO SCORE V7 (escolha do dono 26/10): "44 /100 pontos" — número grande preto e "/100 pontos" cinza
 * na mesma linha, "Score do dia" cinza embaixo, SEM selo da faixa, anel 104 com a estrela (no 100 a estrela FICA e vira
 * âmbar — 26/10, "o Cal AI não muda o símbolo"; testes da festinha em src/test/festa-100.test.tsx). No 100 o
 * número desce de 50 pra 46 px e a linha nunca quebra (cabe em 390 e 430 pt — conferido nos prints do Simulador web).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CardScoreE } from "@/components/home-nova/e/PaginaSeuDia";

afterEach(cleanup);

describe("card do score V7", () => {
  it.each([4, 12, 44, 100])("%i: número + '/100 pontos' na mesma linha e 'Score do dia' embaixo, sem selo", (n) => {
    render(<CardScoreE score={n} onAbrir={() => {}} />);
    expect(screen.getByTestId("he-score-numero").textContent).toBe(String(n));
    expect(screen.getByTestId("he-score-meta").textContent).toBe("/100 pontos");
    expect(screen.getByTestId("hn-score-explica").textContent).toBe("Score do dia");
    const linha = screen.getByTestId("he-score-linha");
    expect(linha.contains(screen.getByTestId("he-score-numero"))).toBe(true);
    expect(linha.contains(screen.getByTestId("he-score-meta"))).toBe(true);
    expect(linha.className).toContain("whitespace-nowrap");
    expect(screen.getByTestId("he-score-meta").className).toContain("text-muted-foreground");
    // sem selo da faixa nem a palavra "pontos" solta em preto
    const texto = screen.getByTestId("he-score").textContent ?? "";
    for (const selo of ["Vamos lá", "Bom ritmo", "Quase lá", "Dia completo", "Dia começando"]) expect(texto).not.toContain(selo);
    expect(texto.match(/pontos/g)?.length).toBe(1);
  });

  it("100 cabe: 3 dígitos descem pra 46 px; 1–2 dígitos ficam em 50 px", () => {
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(screen.getByTestId("he-score-numero").className).toContain("text-[46px]");
    cleanup();
    render(<CardScoreE score={44} onAbrir={() => {}} />);
    expect(screen.getByTestId("he-score-numero").className).toContain("text-[50px]");
  });

  it("anel 104: estrela até 99 E no 100 (nunca ✓ — 26/10); tocar no card abre a folha", () => {
    const abrir = vi.fn();
    render(<CardScoreE score={44} onAbrir={abrir} />);
    const anel = screen.getByTestId("hn-anel");
    expect(anel.style.width).toBe("104px");
    expect(anel.querySelector(".lucide-star")).toBeTruthy();
    fireEvent.click(screen.getByTestId("hn-score-explica"));
    expect(abrir).toHaveBeenCalledTimes(1);
    cleanup();
    render(<CardScoreE score={100} onAbrir={() => {}} />);
    expect(screen.getByTestId("hn-anel").querySelector(".lucide-check")).toBeNull();
    expect(screen.getByTestId("hn-anel").querySelector(".lucide-star")).toBeTruthy();
  });
});
