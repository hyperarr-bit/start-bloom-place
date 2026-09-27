/**
 * Evolução do Treino (26/09, mockup p3): esta semana (comparando até o mesmo
 * dia), recordes do mês automáticos e carga por exercício em 30 dias.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { cargaPorExercicio, detalheDoExercicio, recordesDoMes, resumoDaSemana } from "@/lib/treino-evolucao";
import type { EntradaDoHistorico } from "@/lib/treino-series";

const HOJE = new Date(2026, 8, 26, 10, 0); // sábado
const d = (dia: number, mes = 9) => `2026-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
const e = (date: string, exercise: string, carga: number, reps: number[] | number, extra: Partial<EntradaDoHistorico> = {}): EntradaDoHistorico => {
  const lista = Array.isArray(reps) ? reps : [reps];
  return { date, exercise, sets: String(lista.length), reps: String(Math.max(...lista)), carga: `${carga}kg`, series: lista.map((r) => ({ carga, reps: r })), ...extra };
};

describe("esta semana", () => {
  it("treinos da semana, volume e a comparação até o MESMO dia da semana passada", () => {
    const log = [d(21), d(23), d(25), d(14), d(16), d(18), d(20)];
    const vol = { [d(21)]: 4000, [d(23)]: 3000, [d(25)]: 2200, [d(14)]: 3500, [d(16)]: 3000, [d(18)]: 2000, [d(20)]: 9000 };
    const r = resumoDaSemana(log, vol, HOJE);
    expect(r.treinos).toBe(3);
    expect(r.volume).toBe(9200);
    // semana passada até o sábado: 3500 + 3000 + 2000 (o domingo 20 fica de fora)
    expect(r.anterior).toBe(8500);
    expect(r.variacao).toBe(8);
    expect(r.rotulo).toBe("21 a 27 de set");
    expect(resumoDaSemana([], {}, HOJE).variacao).toBeNull();
    // hoje ainda sem treino não entra (nem o sábado passado): senão toda manhã é "queda"
    const comSabadoPassado = { ...vol, [d(19)]: 3400 };
    expect(resumoDaSemana(log, comSabadoPassado, HOJE).anterior).toBe(8500);
    // treinou hoje: os dois sábados entram
    expect(resumoDaSemana(log, { ...comSabadoPassado, [d(26)]: 3600 }, HOJE)).toMatchObject({ volume: 12800, anterior: 11900 });
    // segunda de manhã, nada ainda: sem comparação; segunda já treinada: compara as duas segundas
    const semSegunda: Record<string, number> = { ...vol };
    delete semSegunda[d(21)];
    expect(resumoDaSemana(log, semSegunda, new Date(2026, 8, 21, 8)).variacao).toBeNull();
    expect(resumoDaSemana(log, vol, new Date(2026, 8, 21, 20)).variacao).toBe(14);
  });
});

describe("recordes do mês", () => {
  const h: EntradaDoHistorico[] = [
    e(d(24), "Supino reto", 55, [8, 8, 7]),
    e(d(17), "Supino reto", 52.5, [10, 9]),
    e(d(3), "Supino reto", 52.5, [8]),
    e(d(27, 8), "Supino reto", 50, [10, 10]),
    e(d(22), "Agachamento", 80, [6, 6]),
    e(d(15), "Agachamento", 75, [8]),
    // remada: melhor do mês (45) não supera agosto (47,5) → não é recorde
    e(d(23), "Remada curvada", 45, [10]),
    e(d(20, 8), "Remada curvada", 47.5, [8]),
    // 1ª vez no mês: não bateu nada
    e(d(10), "Leg press", 180, [12]),
    // mesma carga, mais reps: recorde de reps
    e(d(19), "Rosca direta", 12, [12]),
    e(d(12), "Rosca direta", 12, [10]),
    { date: d(25), exercise: "Esteira", sets: "", reps: "", carga: "", tipo: "cardio" },
  ];

  it("o último recorde de cada exercício no mês, com o ganho sobre o recorde que ele derrubou", () => {
    const r = recordesDoMes(h, 2026, 8);
    expect(r.map((x) => x.exercicio)).toEqual(["Supino reto", "Agachamento", "Rosca direta"]);
    expect(r[0]).toMatchObject({ melhor: { carga: 55, reps: 8 }, anterior: { carga: 52.5, reps: 10 }, data: d(24), ganhoKg: 2.5 });
    expect(r[1]).toMatchObject({ melhor: { carga: 80, reps: 6 }, ganhoKg: 5, data: d(22) });
    expect(r[2]).toMatchObject({ ganhoKg: 0, ganhoReps: 2 });
  });

  it("histórico antigo (só resumo) também conta; mês sem recorde → vazio", () => {
    const antigo = [
      { date: d(20), exercise: "Supino", sets: "4", reps: "10", carga: "60kg" },
      { date: d(10, 8), exercise: "Supino", sets: "4", reps: "10", carga: "57,5kg" },
    ];
    expect(recordesDoMes(antigo, 2026, 8)[0]).toMatchObject({ exercicio: "Supino", ganhoKg: 2.5 });
    expect(recordesDoMes(antigo, 2026, 9)).toEqual([]);
  });
});

describe("carga por exercício (30 dias)", () => {
  const h: EntradaDoHistorico[] = [
    e(d(24), "Supino reto", 55, [8]),
    e(d(17), "Supino reto", 52.5, [10]),
    e(d(10), "Supino reto", 50, [10]),
    e(d(20, 8), "Supino reto", 50, [10]),
    e(d(23), "Remada curvada", 45, [10]),
    e(d(16), "Remada curvada", 45, [10]),
    e(d(9), "Remada curvada", 45, [10]),
    e(d(2), "Remada curvada", 42.5, [10]),
    e(d(1, 7), "Rosca", 10, [12]),
    e(d(22), "Prancha", 0, [40]),
  ];

  it("variação desde a base (última antes da janela), minigráfico e carga atual", () => {
    const r = cargaPorExercicio(h, d(26));
    expect(r.map((x) => x.nome)).toEqual(["Supino reto", "Remada curvada"]);
    expect(r[0]).toMatchObject({ atual: 55, variacao: { tipo: "subiu", kg: 5 } });
    expect(r[0].pontos.map((p) => p.carga)).toEqual([50, 50, 52.5, 55]);
  });

  it("igual: conta há quantas semanas a carga está parada", () => {
    const r = cargaPorExercicio(h, d(26));
    expect(r[1]).toMatchObject({ atual: 45, variacao: { tipo: "subiu", kg: 2.5 } });
    const parada = cargaPorExercicio(h.filter((x) => x.date !== d(2)), d(26));
    expect(parada.find((x) => x.nome === "Remada curvada")?.variacao).toEqual({ tipo: "igual", semanas: 2 });
  });

  it("detalhe: todas as sessões (mais nova primeiro) e o 1RM (Epley) da melhor série", () => {
    const r = detalheDoExercicio(h, "supino reto");
    expect(r.sessoes.map((s) => s.data)).toEqual([d(24), d(17), d(10), d(20, 8)]);
    expect(r.sessoes[0]).toMatchObject({ melhor: { carga: 55, reps: 8 }, volume: 440 });
    // 55 × 8 → 70; 52,5 × 10 → 70 (empate fica com o 1º visto, o mais novo)
    expect(r.rm).toMatchObject({ valor: 70, data: d(24) });
  });
});
