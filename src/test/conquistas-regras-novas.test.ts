/**
 * Os 26 adesivos novos (27/09): cada regra lida do dado que o app grava de
 * verdade (chaves e formatos conferidos no código dos módulos).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildBadgesVida, semanasSeguidasNaMeta } from "@/components/gamification/badges-vida";
import { buildBadgesFinancas, lerMesesArquivados, mesesSeguidosNoAzul } from "@/components/gamification/badges-financas";
import { buildBadgesSequencia, rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { somarDias } from "@/lib/sequencia";
import { chaveArquivada } from "@/lib/virada-do-mes";

const HOJE = "2026-09-26";
const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const vida = (dados: Record<string, unknown>) => Object.fromEntries(buildBadgesVida(leitor(dados), HOJE).map((b) => [b.id, b]));
const fin = (dados: Record<string, unknown>) => Object.fromEntries(buildBadgesFinancas(leitor(dados)).map((b) => [b.id, b]));
const dias = (n: number, fim = somarDias(HOJE, -1)) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));
const registro = <T,>(lista: string[], v: T) => Object.fromEntries(lista.map((d) => [d, v]));

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 26, 10, 0)); });
afterAll(() => { vi.useRealTimers(); });

describe("sequência: Salvo pelo Gelo e Um Ano Anotado", () => {
  it("protetor-1 abre com 1 dia salvo; ano-365 conta os dias anotados no total (não seguidos)", () => {
    const sem = Object.fromEntries(buildBadgesSequencia(10).map((b) => [b.id, b]));
    expect(sem["protetor-1"].unlocked).toBe(false);
    expect(sem["ano-365"].progresso).toEqual({ atual: 0, alvo: 365 });
    const com = Object.fromEntries(buildBadgesSequencia(10, { protetoresUsados: 1, diasAnotados: 400 }).map((b) => [b.id, b]));
    expect(com["protetor-1"].unlocked).toBe(true);
    expect(com["ano-365"].unlocked).toBe(true);
    expect(com["ano-365"].raridade).toBe("lendario");
    const meio = buildBadgesSequencia(10, { diasAnotados: 78 }).find((b) => b.id === "ano-365")!;
    expect(rotuloProgresso(meio)).toBe("78/365");
    expect(textoFalta(meio, 10)).toBe("mais 287 dias anotados");
    // os marcos de dias SEGUIDOS continuam falando em "seguidos"
    expect(textoFalta(buildBadgesSequencia(10)[1], 10)).toBe("mais 20 dias seguidos anotando");
  });
});

describe("finanças: Mês Fechado e 3 Meses no Azul", () => {
  const mesArquivado = (ano: number, mes: number, receita: number, gastos: number[]) => ({
    [chaveArquivada(ano, mes, "incomes")]: [{ value: receita }],
    [chaveArquivada(ano, mes, "expenses")]: gastos.map((v, i) => ({ value: v, date: `${ano}-${String(mes + 1).padStart(2, "0")}-0${i + 1}` })),
    [chaveArquivada(ano, mes, "fixed")]: [{ value: 800 }],
  });
  const cincoGastos = [100, 100, 100, 100, 100];

  it("as chaves do arquivo são as da virada (finance-2026-agosto-expenses)", () => {
    expect(chaveArquivada(2026, 7, "expenses")).toBe("finance-2026-agosto-expenses");
  });

  it("sem mês arquivado: os dois trancados; 1 mês com lançamento abre Mês Fechado", () => {
    expect(fin({})["mes-fechado"].unlocked).toBe(false);
    const r = fin({ [chaveArquivada(2026, 7, "expenses")]: [{ value: 40, date: "2026-08-03" }] });
    expect(r["mes-fechado"].unlocked).toBe(true);
    expect(r["azul-3"].progresso).toEqual({ atual: 0, alvo: 3 });
  });

  it("3 meses seguidos com receita, ≥ 5 gastos e saldo > 0 abrem 3 Meses no Azul; um mês no vermelho quebra a conta", () => {
    const azul = { ...mesArquivado(2026, 7, 4000, cincoGastos), ...mesArquivado(2026, 6, 4000, cincoGastos), ...mesArquivado(2026, 5, 4000, cincoGastos) };
    expect(mesesSeguidosNoAzul(lerMesesArquivados(leitor(azul)))).toBe(3);
    expect(fin(azul)["azul-3"].unlocked).toBe(true);
    const vermelho = { ...azul, ...mesArquivado(2026, 6, 900, cincoGastos) };
    expect(mesesSeguidosNoAzul(lerMesesArquivados(leitor(vermelho)))).toBe(1);
    // mês sem receita não é medido: não conta como azul
    const semReceita = { ...azul, [chaveArquivada(2026, 6, "incomes")]: [] };
    expect(mesesSeguidosNoAzul(lerMesesArquivados(leitor(semReceita)))).toBe(1);
  });
});

describe("rotina: humor, foco e rotina de ferro", () => {
  it("Humor em Dia junta as 3 chaves de humor e conta cada dia uma vez", () => {
    const d = dias(9);
    const r = vida({
      "mood-log": registro(d.slice(0, 4), { mood: 4, note: "" }),
      "core-mood-log": registro(d.slice(2, 6), { value: 3, emoji: "🙂", time: "10:00" }),
      "dp-mood-log": registro(d.slice(5, 7), 4),
    });
    expect(r["humor-7"].progresso).toEqual({ atual: 7, alvo: 7 });
    expect(r["humor-7"].unlocked).toBe(true);
  });

  it("Foco Total: 600 minutos de pomodoro; o círculo mostra horas", () => {
    const meio = vida({ "pomodoro-total-focus": 300 })["foco-10h"];
    expect(meio.unlocked).toBe(false);
    expect(rotuloProgresso(meio)).toBe("5h/10h");
    expect(textoFalta(meio)).toBe("mais 5 horas de foco");
    expect(vida({ "pomodoro-total-focus": 600 })["foco-10h"].unlocked).toBe(true);
  });

  it("Rotina de Ferro: recorde de 60 dias seguidos na rotina (lendário)", () => {
    expect(vida({ "heatmap-log": registro(dias(59), true) })["rotina-60"].unlocked).toBe(false);
    const r = vida({ "heatmap-log": registro(dias(60), 1) })["rotina-60"];
    expect(r.unlocked).toBe(true);
    expect(r.raridade).toBe("lendario");
  });
});

describe("leitura: maratona, meta do ano e biblioteca viva", () => {
  it("Maratona: 30 dias distintos em lib-read-log", () => {
    expect(vida({ "lib-read-log": [...dias(29), ...dias(5)] })["leitura-30"].progresso!.atual).toBe(29);
    expect(vida({ "lib-read-log": dias(30) })["leitura-30"].unlocked).toBe(true);
  });

  it("Meta do Ano: lidos com endDate no ano ≥ lib-year-goal (lido sem data não conta)", () => {
    const livros = [
      { status: "lido", endDate: "2026-03-10" }, { status: "lido", endDate: "2026-08-01" }, { status: "lido", endDate: "2025-12-30" }, { status: "lido" }, { status: "lendo" },
    ];
    const r = vida({ "lib-books": livros, "lib-year-goal": 2 })["meta-ano"];
    expect(r.unlocked).toBe(true);
    expect(r.progresso).toEqual({ atual: 2, alvo: 2 });
    expect(vida({ "lib-books": livros, "lib-year-goal": 3 })["meta-ano"].unlocked).toBe(false);
    expect(vida({ "lib-books": livros })["meta-ano"].progresso!.alvo).toBe(12);
  });

  it("Biblioteca Viva: 25 terminados", () => {
    const r = vida({ "lib-books": Array.from({ length: 25 }, () => ({ status: "lido" })) });
    expect(r["leitura-25"].unlocked).toBe(true);
    expect(r["leitura-10"].unlocked).toBe(true);
    expect(r["leitura-1"].name).toBe("1º Livro Lido");
  });
});

describe("treino: máquina, lenda e mês completo", () => {
  it("50 e 100 treinos (dias únicos)", () => {
    const r = vida({ "saude-workout-log": [...dias(50), ...dias(3)] });
    expect(r["treino-50"].unlocked).toBe(true);
    expect(r["treino-100"].progresso).toEqual({ atual: 50, alvo: 100 });
  });

  it("Mês Completo: 4 semanas seguidas batendo a meta semanal (meta salva, ou a do plano, ou 3)", () => {
    // 3 treinos por semana (seg, qua, sex) nas 4 semanas fechadas antes desta (a semana de hoje começa em 21/09)
    const treinos: string[] = [];
    for (let s = 1; s <= 4; s++) for (const d of [0, 2, 4]) treinos.push(somarDias("2026-09-21", -(7 * s) + d));
    expect(semanasSeguidasNaMeta(treinos, 3, HOJE)).toBe(4);
    expect(semanasSeguidasNaMeta(treinos, 5, HOJE)).toBe(0);
    expect(vida({ "saude-workout-log": treinos })["meta-semanal-4"].unlocked).toBe(true);
    expect(vida({ "saude-workout-log": treinos, "treino-meta-semanal": 5 })["meta-semanal-4"].unlocked).toBe(false);
    expect(vida({ "saude-workout-log": treinos, "treino-active-days": ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA"] })["meta-semanal-4"].unlocked).toBe(false);
  });
});

describe("dieta: chef e 30 dias impecáveis", () => {
  it("Chef de Casa: 1 receita própria (a lista nasce vazia)", () => {
    expect(vida({})["receita-1"].unlocked).toBe(false);
    expect(vida({ "dieta-recipes-v2": [{ id: "r1", name: "Omelete" }] })["receita-1"].unlocked).toBe(true);
  });

  it("30 Dias Impecáveis: total de dias com todas as refeições seguidas (não precisa ser seguido)", () => {
    const impecavel = { meals: { cafe: { followed: true }, almoco: { followed: true } } };
    const furado = { meals: { cafe: { followed: true }, almoco: { followed: false } } };
    const diario = { ...registro(dias(20), impecavel), ...registro(dias(10, somarDias(HOJE, -40)), impecavel), ...registro(dias(3, somarDias(HOJE, -60)), furado) };
    const r = vida({ "dieta-diary-v2": diario });
    expect(r["dieta-30"].unlocked).toBe(true);
    expect(r["dieta-7"].unlocked).toBe(true);
  });
});

describe("saúde: água, sono, remédio e medidas", () => {
  it("Hidratada (30) e Fonte (100): dias com copos ≥ meta", () => {
    const r = vida({ "water-log": { ...registro(dias(30), 8), ...registro(dias(5, somarDias(HOJE, -60)), 3) }, "core-saude-water-goal": 8 });
    expect(r["agua-30"].unlocked).toBe(true);
    expect(r["agua-100"].progresso).toEqual({ atual: 30, alvo: 100 });
  });

  it("Noites Bem Dormidas: horas ≥ meta, nas 2 chaves de sono (a maior do dia vale)", () => {
    const d = dias(8);
    const r = vida({ "sleep-log": registro(d.slice(0, 4), 8), "core-saude-sleep": { ...registro(d.slice(4, 7), 9), [d[7]]: 5 }, "core-saude-sleep-goal": 8 });
    expect(r["sono-7"].progresso).toEqual({ atual: 7, alvo: 7 });
    expect(r["sono-7"].unlocked).toBe(true);
  });

  it("Remédio em Dia: 7 dias com ≥ 1 remédio marcado (dia com lista vazia não conta)", () => {
    const d = dias(8);
    const r = vida({ "core-saude-supplement-log": { ...registro(d.slice(0, 7), ["vitamina d"]), [d[7]]: [] } });
    expect(r["remedio-7"].unlocked).toBe(true);
    expect(r["remedio-7"].progresso!.atual).toBe(7);
  });

  it("Evolução Anotada: 4 medições", () => {
    expect(vida({ "core-saude-measures": [{ date: "2026-09-01", peso: "60" }, { date: "2026-09-08", peso: "60" }, { date: "2026-09-15", peso: "60" }, { date: "2026-09-22", peso: "60" }] })["medidas-4"].unlocked).toBe(true);
  });
});

describe("vida: metas, carta, pet, momentos, detox e estudos", () => {
  it("Meta Concluída: 1 item da linha do tempo (goals-timeline) marcado como feito", () => {
    const timeline = { "6meses": { items: [{ id: "a", text: "x", done: false }] }, "1ano": { items: [{ id: "b", text: "y", done: true }] }, "3anos": { items: [] }, "5anos": { items: [] } };
    const r = vida({ "goals-timeline": timeline })["meta-1"];
    expect(r.unlocked).toBe(true);
    expect(r.rota).toEqual({ caminho: "/desenvolvimento", nome: "Desenvolvimento" });
    expect(vida({ "goals-timeline": { "6meses": { items: [{ id: "a", text: "x", done: false }] } } })["meta-1"].unlocked).toBe(false);
  });

  it("Carta pro Futuro: texto escrito (espaço em branco não vale)", () => {
    expect(vida({ "dp-future-letter": { text: "   ", openDate: "", written: "" } })["carta-futuro"].unlocked).toBe(false);
    expect(vida({ "dp-future-letter": { text: "Oi, eu do futuro", openDate: "2027-01-01", written: "2026-09-01" } })["carta-futuro"].unlocked).toBe(true);
  });

  it("Diário do Pet (7 registros), Álbum de Momentos (5) e Semana Detox (7 dias distintos)", () => {
    const entradas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), date: somarDias(HOJE, -i), note: "x" }));
    const r = vida({ "pet-diary": entradas(7), "rel-moments": entradas(5), "detox-diary": [...entradas(5), ...entradas(5)] });
    expect(r["pet-7"].unlocked).toBe(true);
    expect(r["momentos-5"].unlocked).toBe(true);
    expect(r["detox-7"].progresso).toEqual({ atual: 5, alvo: 7 });
    expect(vida({ "detox-diary": entradas(7) })["detox-7"].unlocked).toBe(true);
  });

  it("Revisão Feita: 1 cartão respondido em estudos-revisoes (vezes ≥ 1)", () => {
    expect(vida({ "estudos-revisoes": { a1: { proxima: "2026-09-27", degrau: 0, vezes: 0 } } })["estudos-revisao-1"].unlocked).toBe(false);
    const r = vida({ "estudos-revisoes": { a1: { proxima: "2026-09-27", degrau: 1, vezes: 1 } } })["estudos-revisao-1"];
    expect(r.unlocked).toBe(true);
    expect(r.rota!.caminho).toBe("/estudos");
  });
});
