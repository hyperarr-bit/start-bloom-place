import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { NumeroQueConta } from "@/components/home-nova/e/Animacoes";

/**
 * A CADÊNCIA DA CONTAGEM DO SCORE (vídeo da welcome, 26/10 — dono: "o score dá uma bugada: fica 41 e depois vai pra 42").
 *
 * O NumeroQueConta (components/home-nova/e/Animacoes.tsx) conta com `animate(de, valor)` do framer, 0,9 s, ease
 * [0.16, 1, 0.3, 1] (um "expo out") e `Math.round` a cada quadro. Pra contagens grandes (0 → 37 na abertura) isso é
 * liso; pra um salto pequeno como o do 1º registro do dia (37 → 42) os 5 números se espremem no começo da curva:
 * 38, 39, 40 e 41 caem em ~0,16 s, o 41 fica parado ~0,14 s (2× o passo anterior) e o 42 entra ~0,3 s depois do
 * início — e os outros ~0,6 s da animação não mudam nada na tela. É o "fica 41 e pula pro 42".
 *
 * Este teste mede a contagem DE VERDADE (o componente real, com o movimento ligado e os timers/quadros falsos) e
 * exige uma cadência lisa: nenhum número parado mais que 1,6× o anterior e o último número entrando depois de 45% da
 * duração. Com o código de hoje ele FALHA (é a prova do bug); com uma curva lisa pra saltos pequenos ele passa.
 */
const QUADRO = 1000 / 60;

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

async function medirContagem(de: number, ate: number) {
  // o componente desliga o movimento quando MODE === "test" (emTeste) — aqui a gente quer a contagem de verdade
  vi.stubEnv("MODE", "development");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance", "Date"] });
  const { rerender } = render(<NumeroQueConta valor={de} testid="n" />);
  // a 1ª montagem conta 0 → de (a abertura da Home); deixa terminar
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(screen.getByTestId("n").textContent).toBe(String(de));
  rerender(<NumeroQueConta valor={ate} testid="n" />);
  const trocas: { t: number; n: number }[] = [];
  let ultimo = de;
  for (let q = 1; q <= 90; q++) { // 1,5 s a 60 qps
    await act(async () => { vi.advanceTimersByTime(QUADRO); });
    const n = Number(screen.getByTestId("n").textContent);
    if (n !== ultimo) { trocas.push({ t: Math.round(q * QUADRO), n }); ultimo = n; }
  }
  return trocas;
}

describe("NumeroQueConta — cadência da contagem num salto pequeno (37 → 42, o 1º registro do dia)", () => {
  it("conta 38, 39, 40, 41, 42 em ordem e termina PARADO no 42", async () => {
    const trocas = await medirContagem(37, 42);
    expect(trocas.map((x) => x.n)).toEqual([38, 39, 40, 41, 42]);
  });

  it("cadência lisa: nenhum número fica parado mais que 1,6× o anterior e o 42 não chega antes de 45% da animação (0,9 s)", async () => {
    const trocas = await medirContagem(37, 42);
    const passos = trocas.slice(1).map((x, i) => x.t - trocas[i].t);
    const relatorio = trocas.map((x) => `${x.n}@${x.t}ms`).join(" · ");
    for (let i = 1; i < passos.length; i++) {
      expect(passos[i], `o ${trocas[i].n} ficou ${passos[i]} ms na tela, ${(passos[i] / passos[i - 1]).toFixed(1)}× o passo anterior (${relatorio})`).toBeLessThanOrEqual(passos[i - 1] * 1.6 + QUADRO);
    }
    expect(trocas[trocas.length - 1].t, `o 42 chegou cedo demais e o resto da animação não mexe em nada (${relatorio})`).toBeGreaterThanOrEqual(900 * 0.45);
  });
});
