/**
 * Treino série por série (26/09, redesenho aprovado em mockup): última vez,
 * post-it de progressão, sessão do dia, concluir (histórico compatível com o
 * formato antigo + `series`) e volume.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  ajustarCarga,
  alternarFeito,
  adicionarSerie,
  assinaturaDasSeries,
  chavesDosExercicios,
  concluirTreino,
  definirValor,
  duracaoEstimada,
  epley,
  marcarExercicio,
  melhorSerie,
  proximaCarga,
  quandoFoi,
  recordeAnterior,
  registrarNoHistorico,
  removerUltimaSerie,
  repsAlvo,
  seriesDaEntrada,
  seriesIniciais,
  sessaoNova,
  sessaoValida,
  subirCarga,
  sugestaoDeCarga,
  textoDaUltimaVez,
  ultimaVez,
  volumeDaVezAnterior,
  volumeDasSeries,
  type EntradaDoHistorico,
  type ExercicioDoPlano,
} from "@/lib/treino-series";

const ex = (o: Partial<ExercicioDoPlano> = {}): ExercicioDoPlano => ({
  name: "Supino reto", sets: "4", reps: "10", carga: "50kg", done: false, obs: "", ...o,
});

describe("última vez", () => {
  it("entrada nova (com series) é lida série por série", () => {
    const h: EntradaDoHistorico[] = [
      { date: "2026-09-19", exercise: "Supino reto", sets: "4", reps: "10", carga: "50kg", series: [{ carga: 50, reps: 10 }, { carga: 50, reps: 10 }, { carga: 50, reps: 9 }, { carga: 50, reps: 8 }] },
      { date: "2026-09-12", exercise: "Supino reto", sets: "4", reps: "10", carga: "47,5kg" },
    ];
    expect(ultimaVez(h, "Supino reto")).toEqual({ data: "2026-09-19", series: [{ carga: 50, reps: 10 }, { carga: 50, reps: 10 }, { carga: 50, reps: 9 }, { carga: 50, reps: 8 }] });
  });

  it("entrada ANTIGA (só o resumo) vira séries iguais, com vírgula decimal", () => {
    expect(seriesDaEntrada({ date: "2026-09-12", exercise: "Supino", sets: "3", reps: "12", carga: "52,5kg" }))
      .toEqual([{ carga: 52.5, reps: 12 }, { carga: 52.5, reps: 12 }, { carga: 52.5, reps: 12 }]);
    // sem séries no resumo: 1
    expect(seriesDaEntrada({ date: "2026-09-12", exercise: "Supino", sets: "", reps: "10", carga: "40" })).toEqual([{ carga: 40, reps: 10 }]);
    // nada preenchido: nada
    expect(seriesDaEntrada({ date: "2026-09-12", exercise: "Supino", sets: "", reps: "", carga: "" })).toEqual([]);
  });

  it("pega a MAIS NOVA por data (qualquer ordem gravada), ignora a de hoje, cardio e nome com maiúscula diferente conta", () => {
    const h: EntradaDoHistorico[] = [
      { date: "2026-09-05", exercise: "supino reto ", sets: "4", reps: "10", carga: "45kg" },
      { date: "2026-09-26", exercise: "Supino reto", sets: "4", reps: "10", carga: "55kg" },
      { date: "2026-09-19", exercise: "Supino Reto", sets: "4", reps: "10", carga: "50kg" },
      { date: "2026-09-25", exercise: "Supino reto", sets: "", reps: "", carga: "", tipo: "cardio" },
    ];
    expect(ultimaVez(h, "Supino reto", "2026-09-26")?.data).toBe("2026-09-19");
    expect(ultimaVez(h, "Supino reto")?.data).toBe("2026-09-26");
    expect(ultimaVez(h, "Agachamento")).toBeNull();
  });

  it("texto da última vez: carga única, faixa e peso do corpo", () => {
    expect(textoDaUltimaVez([{ carga: 50, reps: 10 }, { carga: 50, reps: 10 }, { carga: 50, reps: 9 }, { carga: 50, reps: 8 }])).toBe("50 kg × 10·10·9·8");
    expect(textoDaUltimaVez([{ carga: 50, reps: 10 }, { carga: 52.5, reps: 8 }])).toBe("50–52,5 kg × 10·8");
    expect(textoDaUltimaVez([{ carga: 0, reps: 15 }, { carga: 0, reps: 12 }])).toBe("15·12 reps");
  });
});

describe("séries de partida", () => {
  it("nº de séries = o do plano; valores = os da última vez (cinza)", () => {
    const s = seriesIniciais(ex({ sets: "4" }), { series: [{ carga: 50, reps: 10 }, { carga: 50, reps: 9 }] });
    expect(s).toEqual([
      { carga: 50, reps: 10, feito: false }, { carga: 50, reps: 9, feito: false },
      { carga: 50, reps: 9, feito: false }, { carga: 50, reps: 9, feito: false },
    ]);
    expect(s.every((x) => !("ok" in x) || !x.ok)).toBe(true);
  });

  it("sem última vez: o alvo do plano; plano sem séries → 3; cardio = 1 linha", () => {
    expect(seriesIniciais(ex({ sets: "3", reps: "12", carga: "14kg" }), null)).toEqual(Array(3).fill({ carga: 14, reps: 12, feito: false }));
    expect(seriesIniciais(ex({ sets: "", reps: "", carga: "" }), null)).toEqual(Array(3).fill({ carga: 0, reps: 0, feito: false }));
    expect(seriesIniciais(ex({ tipo: "cardio", sets: "", reps: "" }), null)).toEqual([{ carga: 0, reps: 0, feito: false }]);
  });

  it("exercício já com ✓ no plano (versão antiga) nasce feito", () => {
    expect(seriesIniciais(ex({ done: true, sets: "2" }), null).every((s) => s.feito)).toBe(true);
  });

  it("nome repetido no mesmo dia não divide a mesma sessão", () => {
    expect(chavesDosExercicios([{ name: "Prancha" }, { name: "Supino" }, { name: "Prancha" }])).toEqual(["Prancha", "Supino", "Prancha #2"]);
  });
});

describe("post-it de progressão", () => {
  const ultima = (reps: number[], carga = 50) => ({ data: "2026-09-19", series: reps.map((r) => ({ carga, reps: r })) });

  it("fechou 4×10 → sobe 2,5 kg", () => {
    expect(sugestaoDeCarga(ex(), ultima([10, 10, 10, 10]))).toEqual({ base: 50, nova: 52.5, fechou: "4×10", data: "2026-09-19" });
  });

  it("abaixo de 20 kg sobe 1 kg", () => {
    expect(sugestaoDeCarga(ex({ sets: "3", reps: "12", carga: "14kg" }), ultima([12, 12, 12], 14))?.nova).toBe(15);
  });

  it("não fechou (uma série abaixo do alvo, ou menos séries que o plano) → nada", () => {
    expect(sugestaoDeCarga(ex(), ultima([10, 10, 9, 8]))).toBeNull();
    expect(sugestaoDeCarga(ex(), ultima([10, 10, 10]))).toBeNull();
    expect(sugestaoDeCarga(ex(), null)).toBeNull();
    expect(sugestaoDeCarga(ex({ tipo: "cardio" }), ultima([10, 10, 10, 10]))).toBeNull();
  });

  it("faixa 8-12 fecha no topo; sem reps no plano, fecha quem fez todas iguais", () => {
    expect(repsAlvo("8-12")).toBe(12);
    expect(repsAlvo("8 a 12")).toBe(12);
    expect(repsAlvo("10")).toBe(10);
    expect(sugestaoDeCarga(ex({ reps: "8-12" }), ultima([12, 12, 12, 12]))).not.toBeNull();
    expect(sugestaoDeCarga(ex({ reps: "8-12" }), ultima([12, 12, 11, 10]))).toBeNull();
    expect(sugestaoDeCarga(ex({ reps: "" }), ultima([10, 10, 10, 10]))?.fechou).toBe("4×10");
  });

  it("a base é a carga que ela aguentou em TODAS as séries", () => {
    const u = { data: "2026-09-19", series: [{ carga: 50, reps: 10 }, { carga: 52.5, reps: 10 }, { carga: 52.5, reps: 10 }, { carga: 52.5, reps: 10 }] };
    expect(sugestaoDeCarga(ex(), u)?.nova).toBe(52.5);
  });

  it("quando foi: ontem, dia da semana, semana passada", () => {
    expect(quandoFoi("2026-09-25", "2026-09-26")).toBe("Ontem");
    expect(quandoFoi("2026-09-22", "2026-09-26")).toBe("Na terça");
    expect(quandoFoi("2026-09-20", "2026-09-26")).toBe("No domingo");
    expect(quandoFoi("2026-09-19", "2026-09-26")).toBe("Semana passada");
    expect(quandoFoi("2026-09-01", "2026-09-26")).toBe("Da última vez");
  });

  it("degrau do −/+: 2,5 kg; até 20 kg, 1 kg; nunca negativo", () => {
    expect(ajustarCarga(50, 1)).toBe(52.5);
    expect(ajustarCarga(50, -1)).toBe(47.5);
    expect(ajustarCarga(20, 1)).toBe(22.5);
    expect(ajustarCarga(20, -1)).toBe(19);
    expect(ajustarCarga(8, 1)).toBe(9);
    expect(ajustarCarga(0, -1)).toBe(0);
    expect(proximaCarga(19)).toBe(20);
  });
});

describe("a sessão do dia", () => {
  const ini = seriesIniciais(ex(), { series: Array(4).fill({ carga: 50, reps: 10 }) });

  it("marcar fora de ordem, ajustar, subir a carga das que faltam", () => {
    let s = sessaoNova("2026-09-26", "SÁBADO");
    s = alternarFeito(s, "Supino reto", ini, 2);
    expect(s.series["Supino reto"].map((x) => x.feito)).toEqual([false, false, true, false]);
    s = definirValor(s, "Supino reto", ini, 0, "carga", 55);
    s = definirValor(s, "Supino reto", ini, 0, "reps", 8.4);
    expect(s.series["Supino reto"][0]).toEqual({ carga: 55, reps: 8, feito: false, ok: true });
    s = subirCarga(s, "Supino reto", ini, 52.5);
    // a que ela já tinha subido pra 55 não desce; a feita (50) fica como foi
    expect(s.series["Supino reto"].map((x) => x.carga)).toEqual([55, 52.5, 50, 52.5]);
    // a série já feita não muda
    expect(s.series["Supino reto"][2].feito).toBe(true);
  });

  it("+ série copia a última; − série só tira a última se não foi feita", () => {
    let s = sessaoNova("2026-09-26", "SÁBADO");
    s = adicionarSerie(s, "Supino reto", ini);
    expect(s.series["Supino reto"]).toHaveLength(5);
    s = removerUltimaSerie(s, "Supino reto", ini);
    expect(s.series["Supino reto"]).toHaveLength(4);
    s = alternarFeito(s, "Supino reto", ini, 3);
    s = removerUltimaSerie(s, "Supino reto", ini);
    expect(s.series["Supino reto"]).toHaveLength(4);
  });

  it("quadradinho do exercício marca todas; a assinatura muda quando o feito muda", () => {
    let s = sessaoNova("2026-09-26", "SÁBADO");
    const a0 = assinaturaDasSeries(s.series);
    s = marcarExercicio(s, "Supino reto", ini, true);
    expect(s.series["Supino reto"].every((x) => x.feito && x.ok)).toBe(true);
    const a1 = assinaturaDasSeries(s.series);
    expect(a1).not.toBe(a0);
    expect(assinaturaDasSeries({ ...s.series })).toBe(a1);
    // exercício novo, sem nada feito, não muda a assinatura
    expect(assinaturaDasSeries({ ...s.series, Crucifixo: [{ carga: 14, reps: 12, feito: false }] })).toBe(a1);
  });

  it("sessão de outro dia se descarta; passou da meia-noite (< 6 h, aberta) continua", () => {
    const agora = new Date(2026, 8, 27, 0, 40).getTime();
    expect(sessaoValida({ data: "2026-09-27", dia: "DOMINGO", inicio: null, series: {} }, "2026-09-27", agora)).toBe(true);
    expect(sessaoValida({ data: "2026-09-26", dia: "SÁBADO", inicio: null, series: {} }, "2026-09-27", agora)).toBe(false);
    expect(sessaoValida({ data: "2026-09-26", dia: "SÁBADO", inicio: new Date(2026, 8, 26, 23, 30).toISOString(), series: {} }, "2026-09-27", agora)).toBe(true);
    expect(sessaoValida({ data: "2026-09-26", dia: "SÁBADO", inicio: new Date(2026, 8, 26, 8, 0).toISOString(), series: {} }, "2026-09-27", agora)).toBe(false);
    expect(sessaoValida({ data: "2026-09-26", dia: "SÁBADO", inicio: new Date(2026, 8, 26, 23, 30).toISOString(), fim: new Date(2026, 8, 27, 0, 20).toISOString(), series: {} }, "2026-09-27", agora)).toBe(false);
    expect(sessaoValida(null, "2026-09-27", agora)).toBe(false);
    expect(sessaoValida("lixo", "2026-09-27", agora)).toBe(false);
  });
});

describe("concluir o treino", () => {
  const exercicios: ExercicioDoPlano[] = [
    ex(),
    ex({ name: "Crucifixo inclinado", sets: "3", reps: "12", carga: "14kg" }),
    ex({ name: "Esteira", tipo: "cardio", sets: "", reps: "", carga: "", duracao: "25", distancia: "2,5 km" }),
    ex({ name: "Tríceps corda", sets: "3", reps: "12", carga: "25kg" }),
  ];
  const chaves = chavesDosExercicios(exercicios);
  const historico: EntradaDoHistorico[] = [
    { date: "2026-09-19", exercise: "Supino reto", sets: "4", reps: "10", carga: "52,5kg" },
  ];

  it("uma entrada por exercício feito, resumo de sempre + series; cardio sem carga; o que não foi feito não entra", () => {
    const r = concluirTreino({
      exercicios, chaves, historico, data: "2026-09-26",
      series: {
        "Supino reto": [
          { carga: 52.5, reps: 10, feito: true }, { carga: 55, reps: 8, feito: true },
          { carga: 55, reps: 7, feito: true }, { carga: 55, reps: 6, feito: false },
        ],
        "Crucifixo inclinado": [{ carga: 14, reps: 12, feito: false }],
        Esteira: [{ carga: 0, reps: 0, feito: true }],
        "Tríceps corda": [{ carga: 25, reps: 12, feito: true }, { carga: 27.5, reps: 12, feito: true }],
      },
    });
    expect(r.entradas.map((e) => e.exercise)).toEqual(["Supino reto", "Esteira", "Tríceps corda"]);
    expect(r.entradas[0]).toMatchObject({ date: "2026-09-26", sets: "3", reps: "8", carga: "55kg", series: [{ carga: 52.5, reps: 10 }, { carga: 55, reps: 8 }, { carga: 55, reps: 7 }] });
    expect(r.entradas[1]).toMatchObject({ sets: "", reps: "", carga: "", tipo: "cardio", duracao: "25", distancia: "2,5 km" });
    expect(r.entradas[2]).toMatchObject({ sets: "2", reps: "12", carga: "27,5kg" });
    // volume = só as séries feitas; cardio não soma
    expect(r.volume).toBe(52.5 * 10 + 55 * 8 + 55 * 7 + 25 * 12 + 27.5 * 12);
    expect(r.feitas).toBe(3 + 1 + 2);
    // 55 × 8 bateu o 52,5 anterior; o tríceps nunca tinha sido feito → não é recorde
    expect(r.recordes).toEqual(["Supino reto"]);
    expect(r.linhas.find((l) => l.nome === "Supino reto")).toMatchObject({ series: 3, melhor: { carga: 55, reps: 8 }, recorde: true });
  });

  it("a entrada gravada é lida de volta como a 'última vez' do próximo treino", () => {
    const r = concluirTreino({ exercicios, chaves, historico, data: "2026-09-26", series: { "Supino reto": [{ carga: 52.5, reps: 10, feito: true }, { carga: 52.5, reps: 10, feito: true }] } });
    const novo = registrarNoHistorico(historico, r.entradas, "2026-09-26");
    expect(ultimaVez(novo, "Supino reto", "2026-10-03")).toEqual({ data: "2026-09-26", series: [{ carga: 52.5, reps: 10 }, { carga: 52.5, reps: 10 }] });
  });

  it("concluir de novo no mesmo dia SUBSTITUI a do dia (sem duplicar), mais novo primeiro, máx 500", () => {
    const velho = Array.from({ length: 499 }, (_, i) => ({ date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`, exercise: `X${i}`, sets: "1", reps: "1", carga: "1" }));
    const dia1 = registrarNoHistorico([...historico, ...velho], [{ date: "2026-09-26", exercise: "Supino reto", sets: "2", reps: "10", carga: "52,5kg" }], "2026-09-26");
    const dia2 = registrarNoHistorico(dia1, [{ date: "2026-09-26", exercise: "Supino reto", sets: "4", reps: "10", carga: "52,5kg" }], "2026-09-26");
    expect(dia2.filter((h) => h.date === "2026-09-26")).toHaveLength(1);
    expect(dia2[0].sets).toBe("4");
    expect(dia2[1].date).toBe("2026-09-19");
    expect(dia2).toHaveLength(500);
  });

  it("recorde anterior e melhor série: maior carga; empate, mais reps", () => {
    expect(melhorSerie([{ carga: 50, reps: 10 }, { carga: 52.5, reps: 6 }, { carga: 52.5, reps: 8 }])).toEqual({ carga: 52.5, reps: 8 });
    expect(recordeAnterior(historico, "Supino reto", "2026-09-26")).toEqual({ carga: 52.5, reps: 10 });
    expect(recordeAnterior(historico, "Supino reto", "2026-09-19")).toBeNull();
  });
});

describe("volume", () => {
  it("Σ carga × reps", () => {
    expect(volumeDasSeries([{ carga: 52.5, reps: 10 }, { carga: 50, reps: 8 }])).toBe(925);
    expect(volumeDasSeries([])).toBe(0);
  });

  it("vs. última: a vez anterior com esses exercícios", () => {
    const h: EntradaDoHistorico[] = [
      { date: "2026-09-19", exercise: "Supino reto", sets: "4", reps: "10", carga: "50kg" },
      { date: "2026-09-19", exercise: "Tríceps corda", sets: "3", reps: "12", carga: "25kg" },
      { date: "2026-09-21", exercise: "Agachamento", sets: "4", reps: "10", carga: "80kg" },
      { date: "2026-09-12", exercise: "Supino reto", sets: "4", reps: "10", carga: "47,5kg" },
    ];
    expect(volumeDaVezAnterior(h, ["Supino reto", "Tríceps corda"], "2026-09-26")).toEqual({ data: "2026-09-19", volume: 2000 + 900 });
    expect(volumeDaVezAnterior(h, ["Remada"], "2026-09-26")).toBeNull();
  });

  it("1RM (Epley) e duração estimada", () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(60, 10)).toBe(80);
    expect(epley(0, 10)).toBe(0);
    // média das últimas vezes desse dia, arredondada de 5 em 5
    expect(duracaoEstimada([ex()], 60, [44, 48, 47])).toBe(45);
    // sem histórico: 4 séries × (1,5 + 1) + 2 = 12 → 10
    expect(duracaoEstimada([ex()], 60)).toBe(10);
    expect(duracaoEstimada([ex({ tipo: "cardio", duracao: "30" })], 60)).toBe(30);
  });
});
