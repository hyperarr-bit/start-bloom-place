/**
 * A ação do dia — sequência INDIVIDUAL (02/10): módulos vivos, peso por dia
 * da semana, rodízio, "não gastei nada hoje", dia 1 pela porta, e o conserto
 * do dia 1º (balde arquivado do Finanças).
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { somarDias } from "@/lib/sequencia";
import {
  acaoDoDia, acoesDoDia, diasPorModulo, pesosNoDia, principaisAte, marcarDiaSemGasto, diaSemGasto, textoDoLembrete, nomeDoDiaDaSemana,
  ACAO_PADRAO, CHAVE_SEM_GASTO, JANELA_VIVO, MIN_DIAS_VIVO,
} from "@/lib/acao-do-dia";

const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
/** n dias terminando em `fim` (inclusive). */
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));
/** Os dias da janela [hoje-28, hoje-1] que caem no(s) dia(s) da semana dados (0 = domingo). */
const nasSemanas = (hoje: string, dias: number[], semanas = 4) => corrida(somarDias(hoje, -1), 7 * semanas).filter((d) => dias.includes(new Date(`${d}T12:00:00`).getDay()));
const mapa = (dias: string[], v: unknown = true) => Object.fromEntries(dias.map((d) => [d, v]));

const TERCA = "2026-10-06";
const DOMINGO = "2026-10-11";
const QUARTA = "2026-10-07";

describe("módulos vivos", () => {
  it("vivo = registrou em ≥ 2 dos últimos 14 dias (até ontem); 1 registro não basta", () => {
    expect(MIN_DIAS_VIVO).toBe(2);
    expect(JANELA_VIVO).toBe(14);
    const get = leitor({
      "finance-expenses": [{ date: somarDias(TERCA, -2) }, { date: somarDias(TERCA, -5) }],
      "saude-workout-log": [somarDias(TERCA, -3)],
      "lib-read-log": [somarDias(TERCA, -20), somarDias(TERCA, -22)], // fora da janela
    });
    const dias = diasPorModulo(get, somarDias(TERCA, -60), TERCA);
    const pesos = pesosNoDia(dias, TERCA, null);
    expect(pesos.map((p) => p.id)).toEqual(["financas"]);
  });

  it("todos os 12 módulos têm leitor e nenhum lança com dado estranho", () => {
    const get = leitor({ "finance-expenses": "lixo", "heatmap-log": [1, 2], "saude-workout-log": { a: 1 }, "pet-diary": [{ date: 42 }], "rel-moments": null });
    const dias = diasPorModulo(get, "2026-09-01", TERCA);
    expect(Object.keys(dias)).toHaveLength(12);
    for (const s of Object.values(dias)) expect(s.size).toBe(0);
  });

  it("gasto com data ISO completa (pet, relações) cai no dia LOCAL", () => {
    const get = leitor({ "pet-diary": [{ date: "2026-10-04T02:30:00.000Z" }, { date: "2026-10-02T02:30:00.000Z" }] }); // 03/10 23:30 e 01/10 23:30 em Brasília
    const dias = diasPorModulo(get, "2026-09-01", TERCA);
    expect([...dias.pet].sort()).toEqual(["2026-10-01", "2026-10-03"]);
  });
});

describe("peso por dia da semana", () => {
  it("treino só nos dias em que ela treina: terça pede treino, domingo não", () => {
    const get = leitor({
      "heatmap-log": mapa(corrida(somarDias(TERCA, -1), 10)),
      "saude-workout-log": nasSemanas(TERCA, [2, 4, 6]), // ter/qui/sáb
    });
    const terca = acaoDoDia(get, TERCA, { area: null });
    expect(terca.id).toBe("treino");
    expect(terca.texto).toBe("marque o treino de terça");
    expect(terca.motivo).toMatch(/Terça é um dos seus dias de treino/);
    expect(terca.chips.map((c) => c.id)).toEqual(["rotina"]);

    const getDomingo = leitor({
      "heatmap-log": mapa(corrida(somarDias(DOMINGO, -1), 10)),
      "saude-workout-log": nasSemanas(DOMINGO, [2, 4, 6]),
    });
    const domingo = acaoDoDia(getDomingo, DOMINGO, { area: null });
    expect(domingo.id).toBe("rotina");
    expect(domingo.texto).toBe("marque um hábito");
    // treino nem vira chip no domingo: ela nunca treinou num domingo e não está no plano
    expect(domingo.chips).toEqual([]);
    expect(domingo.vivos.map((v) => v.id)).toEqual(["rotina"]);
  });

  it("o PLANO do Treino conta como dia dela: domingo no plano, sem histórico ainda, entra (como chip)", () => {
    const get = leitor({
      "heatmap-log": mapa(corrida(somarDias(DOMINGO, -1), 10)),
      "saude-workout-log": nasSemanas(DOMINGO, [2, 4]),
      "treino-active-days": ["TERÇA", "QUINTA", "DOMINGO"],
    });
    const domingo = acaoDoDia(get, DOMINGO, { area: null });
    expect(domingo.id).toBe("rotina");
    expect(domingo.chips.map((c) => c.id)).toEqual(["treino"]);
  });

  it("o rodízio não empurra 'treino de domingo' só porque ontem foi hábito (2 vivos, um sem história no dia)", () => {
    const get = leitor({
      "heatmap-log": mapa(corrida(somarDias(DOMINGO, -1), 10)),
      "saude-workout-log": nasSemanas(DOMINGO, [2, 4, 6]),
    });
    const acoes = acoesDoDia(get, somarDias(DOMINGO, -1), { area: null, aFrente: 3 }); // sáb, dom, seg, ter
    expect(acoes.map((a) => a.id)).toEqual(["treino", "rotina", "rotina", "treino"]);
  });

  it("o peso: 10 por registro nesse dia da semana nas últimas 4 semanas + dias em 14", () => {
    const get = leitor({ "saude-workout-log": nasSemanas(TERCA, [2]), "heatmap-log": mapa(corrida(somarDias(TERCA, -1), 14)) });
    const dias = diasPorModulo(get, somarDias(TERCA, -60), TERCA);
    const pesos = pesosNoDia(dias, TERCA, null);
    const treino = pesos.find((p) => p.id === "treino")!;
    const rotina = pesos.find((p) => p.id === "rotina")!;
    expect(treino.noDiaDaSemana).toBe(4);
    expect(treino.em14).toBe(2);
    expect(treino.peso).toBe(42);
    expect(rotina.noDiaDaSemana).toBe(2);
    expect(rotina.em14).toBe(14);
    expect(rotina.peso).toBe(34);
    expect(pesos[0].id).toBe("treino");
  });
});

describe("rodízio", () => {
  it("quem usa tudo não vê a mesma frase dois dias seguidos (a principal de ontem cede)", () => {
    const todos = corrida(somarDias(TERCA, -1), 28);
    const get = leitor({
      "finance-expenses": todos.map((d) => ({ date: d })),
      "heatmap-log": mapa(todos),
      "dieta-diary-v2": mapa(todos, { meals: { cafe: { followed: true } } }),
    });
    const acoes = acoesDoDia(get, TERCA, { area: null, aFrente: 5 });
    const ids = acoes.map((a) => a.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    // 3 módulos empatados → alterna entre os dois primeiros da ordem (financas, rotina)
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);
    // os chips são os outros vivos (até 2) + o "não gastei" quando Finanças está viva
    for (const a of acoes) {
      expect(a.chips.length).toBeLessThanOrEqual(3);
      expect(a.chips.some((c) => c.tipo === "sem-gasto")).toBe(true);
    }
  });

  it("com UM módulo vivo só, repete (é o caso de quem só usa Finanças)", () => {
    const get = leitor({ "finance-expenses": corrida(somarDias(QUARTA, -1), 11).map((d) => ({ date: d })) });
    const acoes = acoesDoDia(get, QUARTA, { area: null, aFrente: 3 });
    expect(acoes.map((a) => a.id)).toEqual(["financas", "financas", "financas", "financas"]);
    expect(acoes[0].texto).toBe("anote o gasto de hoje");
    expect(acoes[0].chips).toEqual([{ id: "sem-gasto", texto: "não gastei nada hoje", rota: "/financas", tipo: "sem-gasto" }]);
    expect(acoes[0].motivo).not.toMatch(/às domingos|às sábados/);
    expect(acoes[0].motivo).toMatch(/Finanças em 11 dos últimos 14 dias|Você costuma registrar Finanças às quartas/);
  });

  it("é determinística: a mesma lista dá a mesma principal (dois aparelhos, a mesma frase)", () => {
    const todos = corrida(somarDias(TERCA, -1), 28);
    const dados = { "finance-expenses": todos.map((d) => ({ date: d })), "heatmap-log": mapa(todos) };
    const a = principaisAte(diasPorModulo(leitor(dados), "2026-08-01", TERCA), TERCA, null, 2);
    const b = principaisAte(diasPorModulo(leitor({ ...dados }), "2026-08-01", TERCA), TERCA, null, 2);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get(TERCA)).not.toBe(a.get(somarDias(TERCA, -1)));
  });
});

describe("não gastei nada hoje", () => {
  it("grava o dia (uma vez), guarda só os últimos 400 e conta como registro do Finanças", () => {
    const m1 = marcarDiaSemGasto(undefined, "2026-10-06")!;
    expect(m1).toEqual({ "2026-10-06": true });
    expect(marcarDiaSemGasto(m1, "2026-10-06")).toBeNull();
    expect(diaSemGasto(m1, "2026-10-06")).toBe(true);
    expect(diaSemGasto(m1, "2026-10-07")).toBe(false);
    const muitos = Object.fromEntries(corrida("2026-10-05", 450).map((d) => [d, true]));
    const m2 = marcarDiaSemGasto(muitos, "2026-10-06")!;
    expect(Object.keys(m2)).toHaveLength(400);
    expect(m2["2026-10-06"]).toBe(true);
    // conta como dia do Finanças (módulo vivo só com dias-sem-gasto)
    const get = leitor({ [CHAVE_SEM_GASTO]: mapa(corrida(somarDias(TERCA, -1), 5)) });
    expect(acaoDoDia(get, TERCA, { area: null }).id).toBe("financas");
  });
});

describe("dia 1 e sem histórico", () => {
  it("sem nada: a área da porta decide a frase (dinheiro → gasto, corpo → treino, metas → como você está)", () => {
    const get = leitor({});
    expect(acaoDoDia(get, TERCA, { area: "dinheiro" })).toMatchObject({ id: "area", modulo: "financas", texto: "anote 1 gasto de hoje", rota: "/financas" });
    expect(acaoDoDia(get, TERCA, { area: "dinheiro" }).chips.map((c) => c.id)).toEqual(["sem-gasto"]);
    expect(acaoDoDia(get, TERCA, { area: "corpo" })).toMatchObject({ id: "area", modulo: "treino", rota: "/treino" });
    expect(acaoDoDia(get, TERCA, { area: "metas" })).toMatchObject({ id: "area", modulo: "humor", rota: "/rotina" });
  });

  it("sem área: 'anote 1 coisa do seu dia' com 3 chips", () => {
    const a = acaoDoDia(leitor({}), TERCA, { area: null });
    expect(a.id).toBe("qualquer");
    expect(a.texto).toBe(ACAO_PADRAO.texto);
    expect(a.chips.map((c) => c.id)).toEqual(["financas", "rotina", "saude"]);
  });

  it("1 registro só (ontem) ainda não é vivo: segue a área da porta", () => {
    const get = leitor({ "finance-expenses": [{ date: somarDias(TERCA, -1) }] });
    expect(acaoDoDia(get, TERCA, { area: "rotina" }).modulo).toBe("rotina");
  });
});

describe("conserto do dia 1º", () => {
  it("no dia 1º o balde corrente está vazio, mas o ARQUIVADO do mês passado prova que Finanças é vivo", () => {
    const primeiro = "2026-10-01";
    const setembro = corrida("2026-09-30", 12);
    const get = leitor({
      "finance-expenses": [],
      "finance-2026-setembro-expenses": setembro.map((d) => ({ date: d, value: 10 })),
    });
    const a = acaoDoDia(get, primeiro, { area: null });
    expect(a.id).toBe("financas");
    expect(a.texto).toBe("anote o gasto de hoje");
  });

  it("o nome do mês arquivado sai sem acento (março)", () => {
    const get = leitor({ "finance-2026-marco-expenses": corrida("2026-03-31", 10).map((d) => ({ date: d })) });
    expect(acaoDoDia(get, "2026-04-01", { area: null }).id).toBe("financas");
  });
});

describe("a frase do aviso das 20h", () => {
  it("usa a ação da pessoa (treino: o dia da semana; Finanças: o 'não gastei')", () => {
    expect(nomeDoDiaDaSemana(TERCA)).toBe("terça");
    expect(textoDoLembrete({ id: "treino", modulo: "treino", texto: "marque o treino de terça" }, 5, TERCA)).toEqual({ title: "Terça é dia de treino 🔥", body: "Marque o treino e sua sequência de 5 dias continua." });
    expect(textoDoLembrete({ id: "financas", modulo: "financas", texto: "anote o gasto de hoje" }, 12, QUARTA).body).toMatch(/não gastei nada/);
    expect(textoDoLembrete({ id: "rotina", modulo: "rotina", texto: "marque um hábito" }, 1, QUARTA)).toEqual({ title: "Sua sequência de 1 dia acaba hoje 🔥", body: "Falta 1 coisa: marque um hábito. Leva 10 segundos." });
  });

  it("os dias seguintes são previstos pelo dia da semana (terça pede treino; quarta, hábito)", () => {
    const seg = "2026-10-05";
    const get = leitor({ "heatmap-log": mapa(corrida(somarDias(seg, -1), 14)), "saude-workout-log": nasSemanas(seg, [2, 4]) });
    const acoes = acoesDoDia(get, seg, { area: null, aFrente: 2 });
    expect(acoes.map((a) => a.id)).toEqual(["rotina", "treino", "rotina"]);
    expect(acoes[1].texto).toBe("marque o treino de terça");
  });
});
