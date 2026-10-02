/**
 * "Esqueceu de marcar?" (02/10) — as REGRAS puras: a janela de 2 dias, a
 * sequência que se recompõe, nada de adesivo em dobro, os hábitos que cruzam a
 * virada da semana e o treino de um dia que passou.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  DIAS_PRA_TRAS, calcularSequencia, diasAtras, diasRetroativos, registrarDia, registrarDiaRetroativo,
} from "@/lib/sequencia";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
import { alternarHabitoNoDia, marcadosDoDia, nomeDoDiaDaRotina, semanaDoDia } from "@/lib/rotina-habitos";
import { gravarTreinoDeOutroDia, seriesDoDiaPassado, treinouNoDia } from "@/lib/treino-outro-dia";
import { chavesDosExercicios, type ExercicioDoPlano } from "@/lib/treino-series";

const HOJE = "2026-10-02"; // sexta

describe("a janela: hoje, ontem e anteontem — nada além", () => {
  it("diasAtras e diasRetroativos", () => {
    expect(DIAS_PRA_TRAS).toBe(2);
    expect(diasAtras(HOJE, HOJE)).toBe(0);
    expect(diasAtras("2026-10-01", HOJE)).toBe(1);
    expect(diasAtras("2026-09-30", HOJE)).toBe(2);
    expect(diasAtras("2026-09-29", HOJE)).toBeNull(); // 3 dias
    expect(diasAtras("2026-10-03", HOJE)).toBeNull(); // amanhã
    expect(diasAtras("lixo", HOJE)).toBeNull();
    expect(diasRetroativos(HOJE)).toEqual([
      { dia: "2026-10-01", diasAtras: 1, rotulo: "ontem" },
      { dia: "2026-09-30", diasAtras: 2, rotulo: "anteontem" },
    ]);
  });

  it("virada de mês e de ano: ontem de 01/01 é 31/12", () => {
    expect(diasAtras("2025-12-31", "2026-01-01")).toBe(1);
    expect(diasAtras("2025-12-30", "2026-01-01")).toBe(2);
    expect(diasAtras("2026-09-30", "2026-10-01")).toBe(1);
  });

  it("registrarDiaRetroativo: entra ontem/anteontem; hoje, 3 dias, futuro e repetido não gravam nada", () => {
    const lista = ["2026-09-28", "2026-09-29"];
    expect(registrarDiaRetroativo(lista, "2026-10-01", HOJE)).toEqual(["2026-09-28", "2026-09-29", "2026-10-01"]);
    expect(registrarDiaRetroativo(lista, "2026-09-30", HOJE)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(registrarDiaRetroativo(lista, HOJE, HOJE)).toBeNull();
    expect(registrarDiaRetroativo(lista, "2026-09-29", HOJE)).toBeNull(); // 3 dias atrás (já está lá, mas é fora da janela)
    expect(registrarDiaRetroativo(lista, "2026-09-27", HOJE)).toBeNull();
    expect(registrarDiaRetroativo(lista, "2026-10-03", HOJE)).toBeNull();
    expect(registrarDiaRetroativo(["2026-10-01"], "2026-10-01", HOJE)).toBeNull(); // já anotado: nada a gravar
  });

  it("lista ainda inexistente (1ª vez) nasce da semente do hub + o dia, sem hoje", () => {
    const hub = { count: 1, lastDate: "2026-10-01" }; // o hub tinha só ontem (1 dia) → semente [01/10]
    const nova = registrarDiaRetroativo(undefined, "2026-09-30", HOJE, hub);
    expect(nova).toEqual(["2026-09-30", "2026-10-01"]);
    expect(nova).not.toContain(HOJE);
  });
});

describe("a sequência se recompõe com o dia que entrou", () => {
  it("buraco de ontem fechado: 3 dias + buraco + hoje vira uma corrente só", () => {
    const antes = ["2026-09-28", "2026-09-29", "2026-09-30", HOJE];
    expect(calcularSequencia(antes, HOJE).dias).toBe(1); // ontem vazio, sem protetor: zerou e hoje recomeça
    const depois = registrarDiaRetroativo(antes, "2026-10-01", HOJE) as string[];
    expect(calcularSequencia(depois, HOJE).dias).toBe(5);
    expect(calcularSequencia(depois, HOJE).recorde).toBe(5);
  });

  it("marcar ontem NÃO faz hoje contar: hoje segue em aberto (hojeFeito false)", () => {
    const base = ["2026-09-29", "2026-09-30"];
    const depois = registrarDiaRetroativo(base, "2026-10-01", HOJE) as string[];
    const e = calcularSequencia(depois, HOJE);
    expect(e.hojeFeito).toBe(false);
    expect(e.dias).toBe(3);
  });

  it("entrar duas vezes é a mesma lista (nada duplica); a ordem em que os dias entram não muda a conta", () => {
    const base = ["2026-09-25", HOJE];
    const a = registrarDiaRetroativo(base, "2026-10-01", HOJE) as string[];
    expect(registrarDiaRetroativo(a, "2026-10-01", HOJE)).toBeNull();
    const b = registrarDiaRetroativo(a, "2026-09-30", HOJE) as string[];
    const c = registrarDiaRetroativo(registrarDiaRetroativo(base, "2026-09-30", HOJE) as string[], "2026-10-01", HOJE) as string[];
    expect(b).toEqual(c);
    expect(calcularSequencia(b, HOJE)).toEqual(calcularSequencia(c, HOJE));
  });

  it("registrar hoje depois de marcar ontem continua funcionando (as duas escritas convivem)", () => {
    const a = registrarDiaRetroativo(["2026-09-30"], "2026-10-01", HOJE) as string[];
    expect(registrarDia(a, HOJE)).toEqual(["2026-09-30", "2026-10-01", HOJE]);
  });
});

describe("conquistas: o dia retroativo não dá adesivo em dobro", () => {
  it("o marco de 7 dias abre UMA vez, com o dia da 1ª abertura; marcar o mesmo dia de novo não repete nem muda a data", () => {
    // 5 dias seguidos + buraco ontem + hoje → recorde 5; marcar ontem fecha 7
    const lista = ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"];
    const antes = calcularSequencia([...lista, HOJE], HOJE);
    expect(antes.recorde).toBe(6);
    const r0 = mesclarDesbloqueios(buildBadgesSequencia(antes.recorde), {}, HOJE);
    expect(r0.novas).not.toContain("sequencia-7");

    const nova = registrarDiaRetroativo([...lista, HOJE], "2026-10-01", HOJE) as string[];
    const depois = calcularSequencia(nova, HOJE);
    expect(depois.recorde).toBe(8);
    const r1 = mesclarDesbloqueios(buildBadgesSequencia(depois.recorde), r0.desbloqueadas, HOJE);
    expect(r1.novas.filter((id) => id === "sequencia-7")).toEqual(["sequencia-7"]);
    // de novo, com o MESMO dia: lista idêntica, nenhuma conquista nova
    expect(registrarDiaRetroativo(nova, "2026-10-01", HOJE)).toBeNull();
    const r2 = mesclarDesbloqueios(buildBadgesSequencia(calcularSequencia(nova, HOJE).recorde), r1.desbloqueadas, HOJE);
    expect(r2.novas).toEqual([]);
    expect(r2.desbloqueadas["sequencia-7"]).toBe(HOJE);
  });
});

describe("hábitos da Rotina: a data real, a grade e a virada da semana", () => {
  const nomes = ["Água", "Treinar", "Ler"];
  const semanaDe = (d: string) => semanaDoDia(d);

  it("semanaDoDia e nome do dia", () => {
    expect(semanaDoDia("2026-10-01")).toBe("2026-09-28"); // quinta → segunda 28/09
    expect(semanaDoDia("2026-09-27")).toBe("2026-09-21"); // domingo ainda é da semana de 21/09
    expect(nomeDoDiaDaRotina("2026-10-01")).toBe("QUINTA");
    expect(nomeDoDiaDaRotina("2026-09-27")).toBe("DOMINGO");
  });

  it("ontem NA MESMA semana: escreve a grade (QUINTA), o log por data e o heatmap — e carimba a semana", () => {
    const r = alternarHabitoNoDia({ nomes, checked: {}, semana: "", habitLog: {}, heatmap: {}, indice: 1, dia: "2026-10-01", hoje: HOJE });
    expect(r.checked.QUINTA).toEqual([false, true, false]);
    expect(r.semana).toBe(semanaDe(HOJE));
    expect(r.habitLog["2026-10-01"]).toEqual(["Treinar"]);
    expect(r.heatmap["2026-10-01"]).toBe(true);
    expect(r.marcando).toBe(true);
  });

  it("segunda-feira: ontem (domingo) é da SEMANA PASSADA — a grade não é tocada, só o log e o heatmap", () => {
    const hoje = "2026-09-28"; // segunda
    const checked = { SEGUNDA: [true, false, false] };
    const r = alternarHabitoNoDia({ nomes, checked, semana: "2026-09-28", habitLog: {}, heatmap: {}, indice: 0, dia: "2026-09-27", hoje });
    expect(r.checked).toBe(checked); // a mesma referência: nada gravado na grade
    expect(r.semana).toBe("2026-09-28");
    expect(r.habitLog["2026-09-27"]).toEqual(["Água"]);
    expect(r.heatmap["2026-09-27"]).toBe(true);
    // e lê de volta pelo log
    expect(marcadosDoDia({ nomes, checked, semana: "2026-09-28", habitLog: r.habitLog, dia: "2026-09-27", hoje })).toEqual([true, false, false]);
  });

  it("desmarcar o último hábito do dia tira o dia do heatmap; marcar/desmarcar é reversível", () => {
    const um = alternarHabitoNoDia({ nomes, checked: {}, semana: "", habitLog: {}, heatmap: {}, indice: 2, dia: "2026-09-30", hoje: HOJE });
    expect(um.heatmap["2026-09-30"]).toBe(true);
    const zero = alternarHabitoNoDia({ nomes, checked: um.checked, semana: um.semana, habitLog: um.habitLog, heatmap: um.heatmap, indice: 2, dia: "2026-09-30", hoje: HOJE });
    expect(zero.marcando).toBe(false);
    expect(zero.heatmap["2026-09-30"]).toBeUndefined();
    expect(zero.habitLog["2026-09-30"]).toEqual([]);
  });

  it("grade de semana velha (sem carimbo) é ignorada: o dia desta semana lê do log", () => {
    const velha = { QUINTA: [true, true, true] }; // de outra semana
    expect(marcadosDoDia({ nomes, checked: velha, semana: "2026-09-21", habitLog: {}, dia: "2026-10-01", hoje: HOJE })).toEqual([false, false, false]);
    expect(marcadosDoDia({ nomes, checked: velha, semana: "2026-09-21", habitLog: { "2026-10-01": ["Ler"] }, dia: "2026-10-01", hoje: HOJE })).toEqual([false, false, true]);
  });
});

describe("treino de um dia que passou", () => {
  const ex = (name: string, sets = "3", reps = "10", carga = "20kg"): ExercicioDoPlano => ({ name, sets, reps, carga, done: false, obs: "" });
  const exercicios = [ex("Supino reto", "3", "10", "40"), ex("Crucifixo", "2", "12", "10"), { ...ex("Esteira"), tipo: "cardio" as const, duracao: "20" }];
  const chaves = chavesDosExercicios(exercicios);
  const vazio = { historico: [] as unknown[], log: [] as string[], volume: {} as Record<string, number>, sessoes: {} as Record<string, unknown> };

  it("as séries partem do PREVISTO (alvo do plano ou última vez), todas por marcar", () => {
    const s = seriesDoDiaPassado({ exercicios, chaves, historico: [], dia: "2026-10-01" });
    expect(s["Supino reto"]).toEqual([{ carga: 40, reps: 10, feito: false }, { carga: 40, reps: 10, feito: false }, { carga: 40, reps: 10, feito: false }]);
    expect(s["Crucifixo"]).toHaveLength(2);
    expect(s["Esteira"]).toEqual([{ carga: 0, reps: 0, feito: false }]);
    // com uma última vez (antes do dia), ela manda
    const hist = [{ date: "2026-09-24", exercise: "Supino reto", sets: "3", reps: "8", carga: "45kg", series: [{ carga: 45, reps: 8 }, { carga: 45, reps: 8 }, { carga: 47.5, reps: 6 }] }];
    const s2 = seriesDoDiaPassado({ exercicios, chaves, historico: hist, dia: "2026-10-01" });
    expect(s2["Supino reto"].map((x) => [x.carga, x.reps])).toEqual([[45, 8], [45, 8], [47.5, 6]]);
  });

  it("gravar: histórico por exercício na data, registro de treinos, volume e carimbo — sem minutos", () => {
    const series = seriesDoDiaPassado({ exercicios, chaves, historico: [], dia: "2026-10-01" });
    series["Supino reto"] = series["Supino reto"].map((x, i) => ({ ...x, feito: i < 2, ok: true })); // 2 de 3
    series["Esteira"] = [{ carga: 0, reps: 0, feito: true }];
    const g = gravarTreinoDeOutroDia({ dia: "2026-10-01", diaDoPlano: "QUINTA", musculos: ["Peito"], exercicios, chaves, series, ...vazio });
    expect(g.feitas).toBe(3); // 2 séries + 1 cardio
    expect(g.log).toEqual(["2026-10-01"]);
    expect(g.volume["2026-10-01"]).toBe(40 * 10 * 2);
    expect(g.sessoes["2026-10-01"]).toEqual({ dia: "QUINTA", musculos: ["Peito"] });
    const doDia = g.historico.filter((h) => h.date === "2026-10-01").map((h) => h.exercise).sort();
    expect(doDia).toEqual(["Esteira", "Supino reto"]);
    expect(g.historico.find((h) => h.exercise === "Supino reto")?.series).toHaveLength(2);
    expect(treinouNoDia(g.log, "2026-10-01")).toBe(true);
    expect(treinouNoDia(g.log, "2026-09-30")).toBe(false);
  });

  it("salvar de novo SUBSTITUI o dia (não duplica); reabrir mostra o que foi salvo; sem nada marcado, tira o dia", () => {
    const s1 = seriesDoDiaPassado({ exercicios, chaves, historico: [], dia: "2026-10-01" });
    s1["Supino reto"] = s1["Supino reto"].map((x) => ({ ...x, feito: true }));
    const g1 = gravarTreinoDeOutroDia({ dia: "2026-10-01", diaDoPlano: "QUINTA", musculos: [], exercicios, chaves, series: s1, ...vazio });
    const reaberto = seriesDoDiaPassado({ exercicios, chaves, historico: g1.historico, dia: "2026-10-01" });
    expect(reaberto["Supino reto"].every((x) => x.feito)).toBe(true);
    expect(reaberto["Crucifixo"].every((x) => !x.feito)).toBe(true);

    reaberto["Crucifixo"] = reaberto["Crucifixo"].map((x) => ({ ...x, feito: true }));
    const g2 = gravarTreinoDeOutroDia({ dia: "2026-10-01", diaDoPlano: "QUINTA", musculos: [], exercicios, chaves, series: reaberto, historico: g1.historico, log: g1.log, volume: g1.volume, sessoes: g1.sessoes });
    expect(g2.log).toEqual(["2026-10-01"]); // o dia não entra duas vezes
    expect(g2.historico.filter((h) => h.exercise === "Supino reto")).toHaveLength(1);
    expect(g2.historico.filter((h) => h.date === "2026-10-01")).toHaveLength(2);

    const nada = Object.fromEntries(chaves.map((k) => [k, (reaberto[k] ?? []).map((x) => ({ ...x, feito: false }))]));
    const g3 = gravarTreinoDeOutroDia({ dia: "2026-10-01", diaDoPlano: "QUINTA", musculos: [], exercicios, chaves, series: nada, historico: g2.historico, log: g2.log, volume: g2.volume, sessoes: g2.sessoes });
    expect(g3.feitas).toBe(0);
    expect(g3.limpou).toBe(true);
    expect(g3.log).toEqual([]);
    expect(g3.historico.filter((h) => h.date === "2026-10-01")).toHaveLength(0);
    expect(g3.volume["2026-10-01"]).toBeUndefined();
    expect(g3.sessoes["2026-10-01"]).toBeUndefined();
  });

  it("não encosta no treino de OUTRO dia nem nas séries mais velhas", () => {
    const outro = [{ date: "2026-09-30", exercise: "Supino reto", sets: "3", reps: "10", carga: "40kg", series: [{ carga: 40, reps: 10 }] }];
    const series = seriesDoDiaPassado({ exercicios, chaves, historico: outro, dia: "2026-10-01" });
    series["Supino reto"] = series["Supino reto"].map((x) => ({ ...x, feito: true }));
    const g = gravarTreinoDeOutroDia({ dia: "2026-10-01", diaDoPlano: "QUINTA", musculos: [], exercicios, chaves, series, historico: outro, log: ["2026-09-30"], volume: { "2026-09-30": 400 }, sessoes: {} });
    expect(g.log).toEqual(["2026-09-30", "2026-10-01"]);
    expect(g.historico.filter((h) => h.date === "2026-09-30")).toHaveLength(1);
    expect(g.volume["2026-09-30"]).toBe(400);
  });
});
