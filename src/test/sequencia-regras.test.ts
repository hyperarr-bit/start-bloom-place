/**
 * Sequência nova (26/09): dias com algo ANOTADO, não dias abrindo o app.
 * Regras puras de src/lib/sequencia.ts — virada de dia local no fuso de
 * Brasília, protetor, migração do core-hub-streak e o que conta como anotação.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, afterEach, vi } from "vitest";
import { localDayKey } from "@/lib/utils";
import {
  calcularSequencia, contaComoAnotacao, normalizarDias, registrarDia, semearDoHub, somarDias, temConteudo,
  MAX_DIAS_GUARDADOS, MAX_PROTETORES,
} from "@/lib/sequencia";

/** n dias seguidos terminando em `fim` (inclusive). */
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));

afterEach(() => { vi.useRealTimers(); });

describe("dia local (fuso de Brasília)", () => {
  it("o fuso do teste é mesmo o de Brasília (UTC-3)", () => {
    expect(new Date(2026, 8, 26, 12).getTimezoneOffset()).toBe(180);
  });

  it("23:30 em Brasília ainda é o dia de HOJE, mesmo com o UTC já no dia seguinte", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T02:30:00Z")); // 25/09 23:30 BRT
    expect(localDayKey()).toBe("2026-09-25");
    const lista = registrarDia(["2026-09-24"], localDayKey());
    expect(lista).toEqual(["2026-09-24", "2026-09-25"]);
    expect(calcularSequencia(lista, localDayKey()).dias).toBe(2);
  });

  it("00:05 já vira o dia seguinte — e o dia de ontem continua valendo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T03:05:00Z")); // 26/09 00:05 BRT
    const hoje = localDayKey();
    expect(hoje).toBe("2026-09-26");
    const s = calcularSequencia(["2026-09-24", "2026-09-25"], hoje);
    expect(s).toMatchObject({ dias: 2, hojeFeito: false });
  });

  it("virada de mês e de ano não comem nem duplicam dia", () => {
    expect(somarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2027-03-01", -1)).toBe("2027-02-28");
    expect(calcularSequencia(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01").dias).toBe(3);
  });
});

describe("a conta da sequência", () => {
  const hoje = "2026-09-26";

  it("hoje sem nada ainda não quebra: a sequência de ontem segue viva", () => {
    expect(calcularSequencia(corrida("2026-09-25", 5), hoje)).toMatchObject({ dias: 5, hojeFeito: false });
    expect(calcularSequencia(corrida(hoje, 6), hoje)).toMatchObject({ dias: 6, hojeFeito: true });
  });

  it("um dia vazio sem protetor zera", () => {
    const s = calcularSequencia([...corrida("2026-09-20", 4), "2026-09-22", "2026-09-23"], "2026-09-23");
    expect(s.dias).toBe(2);
    expect(s.recorde).toBe(4);
    expect(s.usados).toEqual([]);
  });

  it("protetor: ganha 1 aos 7 dias e segura sozinho o dia vazio", () => {
    // 7 dias (16–22), 23 vazio, 24 e 25 anotados, hoje (26) em aberto
    const dias = [...corrida("2026-09-22", 7), "2026-09-24", "2026-09-25"];
    const s = calcularSequencia(dias, hoje);
    expect(s.usados).toEqual(["2026-09-23"]);
    expect(s.dias).toBe(9); // o dia protegido segura, mas não soma
    expect(s.saldo).toBe(0);
  });

  it("protetor segura o buraco de ONTEM (a pessoa abre hoje e a sequência está lá)", () => {
    const s = calcularSequencia(corrida("2026-09-24", 7), hoje); // 25 vazio
    expect(s.usados).toEqual(["2026-09-25"]);
    expect(s.dias).toBe(7);
    expect(s.hojeFeito).toBe(false);
  });

  it("2 dias vazios seguidos precisam de 2 protetores — com 1, zera e o protetor fica guardado", () => {
    const um = calcularSequencia([...corrida("2026-09-20", 7), "2026-09-23"], "2026-09-23"); // 21 e 22 vazios
    expect(um.dias).toBe(1);
    expect(um.usados).toEqual([]);
    expect(um.saldo).toBe(1);

    const dois = calcularSequencia([...corrida("2026-09-20", 14), "2026-09-23"], "2026-09-23");
    expect(dois.usados).toEqual(["2026-09-21", "2026-09-22"]);
    expect(dois.dias).toBe(15);
    expect(dois.saldo).toBe(0);
  });

  it("guarda no máximo 2 protetores", () => {
    const s = calcularSequencia(corrida(hoje, 35), hoje); // 7, 14, 21, 28, 35 → teto 2
    expect(s.saldo).toBe(MAX_PROTETORES);
    expect(s.dias).toBe(35);
  });

  it("dia no futuro (relógio adiantado) não conta", () => {
    expect(calcularSequencia(["2026-09-25", "2026-09-27"], hoje).dias).toBe(1);
  });

  it("lista vazia, ausente ou suja dá zero sem quebrar", () => {
    expect(calcularSequencia(undefined, hoje).dias).toBe(0);
    expect(calcularSequencia(["lixo", 3, null, "2026-9-1"], hoje).dias).toBe(0);
  });
});

describe("registro do dia", () => {
  it("acrescenta hoje uma vez só, em ordem e sem repetir", () => {
    expect(registrarDia(["2026-09-25", "2026-09-24"], "2026-09-26")).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(registrarDia(["2026-09-26"], "2026-09-26")).toBeNull(); // nada a gravar
  });

  it("guarda só os últimos 400 dias", () => {
    const longa = corrida("2026-09-25", 450);
    const r = registrarDia(longa, "2026-09-26")!;
    expect(r).toHaveLength(MAX_DIAS_GUARDADOS);
    expect(r[r.length - 1]).toBe("2026-09-26");
    expect(normalizarDias(longa)).toHaveLength(MAX_DIAS_GUARDADOS);
  });
});

describe("migração do core-hub-streak (ninguém perde a sequência que via ontem)", () => {
  const hoje = "2026-09-26";

  it("lastDate ONTEM com 12: semeia os 12 dias até ontem — hoje continua em aberto", () => {
    const s = semearDoHub({ count: 12, lastDate: "2026-09-25" }, hoje);
    expect(s).toHaveLength(12);
    expect(s[0]).toBe("2026-09-14");
    expect(s[s.length - 1]).toBe("2026-09-25");
    expect(calcularSequencia(s, hoje)).toMatchObject({ dias: 12, hojeFeito: false });
  });

  it("lastDate HOJE com 12 (o 12 de hoje era só a abertura): 11 até ontem, e anotar hoje volta aos 12", () => {
    const s = semearDoHub({ count: 12, lastDate: hoje }, hoje);
    expect(s).toHaveLength(11);
    expect(calcularSequencia(s, hoje).dias).toBe(11);
    expect(calcularSequencia(registrarDia(undefined, hoje, { count: 12, lastDate: hoje }), hoje).dias).toBe(12);
  });

  it("sequência antiga já quebrada (anteontem pra trás) não semeia nada", () => {
    expect(semearDoHub({ count: 30, lastDate: "2026-09-24" }, hoje)).toEqual([]);
    expect(semearDoHub(null, hoje)).toEqual([]);
    expect(semearDoHub({ count: "x", lastDate: "2026-09-25" }, hoje)).toEqual([]);
  });

  it("1ª anotação sem lista: a lista nasce da semente + hoje", () => {
    const r = registrarDia(undefined, hoje, { count: 3, lastDate: "2026-09-25" });
    expect(r).toEqual(["2026-09-23", "2026-09-24", "2026-09-25", hoje]);
  });
});

describe("o que conta como anotação", () => {
  it("dado dos módulos conta", () => {
    for (const k of ["finance-expenses", "rotina-habits-checked", "heatmap-log", "saude-workout-log", "mood-log", "core-mood-log",
      "dieta-diary-v2", "lib-books", "water-log", "core-saude-supplements", "core-home-quick-notes", "pet-diary", "todo-list"]) {
      expect(contaComoAnotacao(k), k).toBe(true);
    }
  });

  it("preferência, navegação e carimbo automático não contam", () => {
    for (const k of ["spotlight-done-financas", "core-onboarding-done", "core-home-widgets-v2", "notif-prefs", "core-module-prefs",
      "finance-visto-dia", "core-boas-vindas-visto", "finance-last-seen-month", "finance-turnover-ack", "conquistas-capa",
      "core-dias-anotados", "core-hub-streak", "gamification-lastCheckIn", "rotina-habits-week", "treino-semana-dos-checks",
      "core-saude-water-goal", "abas-ocultas:rotina", "wrapped-banner-dismissed", "finance-challenges-hidden", "core-user-name",
      "tutorial-replay-modules", "force-new-user-tutorial", "core-theme-mode", "lembretes-contas-perguntado"]) {
      expect(contaComoAnotacao(k), k).toBe(false);
    }
  });

  it("limpar (lista/objeto vazio, texto em branco) não anota nada", () => {
    expect(temConteudo([])).toBe(false);
    expect(temConteudo({})).toBe(false);
    expect(temConteudo("  ")).toBe(false);
    expect(temConteudo(0)).toBe(false);
    expect(temConteudo([{ id: 1 }])).toBe(true);
    expect(temConteudo({ "2026-09-26": 3 })).toBe(true);
  });
});
