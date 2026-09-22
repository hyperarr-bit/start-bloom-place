/**
 * COMPROMISSOS COM HORA (22/09) — a conta que vira notificação: expansão da
 * repetição semanal, antecedência do aviso, nada no passado, teto do iOS.
 */
import { describe, it, expect } from "vitest";
import {
  compromissosValidos, ocorrencias, planejarCompromissos, proximosDeHoje, rotuloRepeticao, rotuloAviso, TETO_AVISOS,
  type Compromisso,
} from "@/lib/compromissos";

const medico: Compromisso = { id: "a", titulo: "Médico", data: "2026-09-29", hora: "09:00", aviso: 1440 };
const jiu: Compromisso = { id: "b", titulo: "Jiu-jitsu", data: "2026-09-21", hora: "19:30", repete: [0, 2, 4], aviso: 30, local: "Academia" };
const semAviso: Compromisso = { id: "c", titulo: "Reunião", data: "2026-09-22", hora: "15:00", aviso: -1 };

describe("ocorrencias", () => {
  it("compromisso único aparece uma vez, no dia e hora certos", () => {
    const o = ocorrencias([medico], new Date(2026, 8, 22), 30);
    expect(o).toHaveLength(1);
    expect(o[0].dia).toBe("2026-09-29");
    expect(o[0].quando.getHours()).toBe(9);
  });

  it("seg/qua/sex expande a partir da data cadastrada, na hora, dentro da janela", () => {
    // 22/09/2026 é terça; janela de 7 dias = ter 22 → seg 28
    const o = ocorrencias([jiu], new Date(2026, 8, 22), 7);
    expect(o.map((x) => x.dia)).toEqual(["2026-09-23", "2026-09-25", "2026-09-28"]);
    expect(o.every((x) => x.quando.getHours() === 19 && x.quando.getMinutes() === 30)).toBe(true);
  });

  it("repetição não nasce antes da data cadastrada", () => {
    const futuro: Compromisso = { ...jiu, data: "2026-10-05" }; // segunda
    const o = ocorrencias([futuro], new Date(2026, 8, 22), 21); // ter 22/09 → seg 12/10 (inclusive)
    expect(o.map((x) => x.dia)).toEqual(["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-12"]);
  });

  it("fora da janela não entra; lista vem em ordem de horário", () => {
    const o = ocorrencias([medico, jiu, semAviso], new Date(2026, 8, 22), 2);
    expect(o.map((x) => `${x.dia} ${x.compromisso.titulo}`)).toEqual(["2026-09-22 Reunião", "2026-09-23 Jiu-jitsu"]);
  });

  it("dado torto (sem hora, sem título, lixo) fica de fora sem derrubar", () => {
    const lixo = [null, {}, { id: "x", titulo: "", data: "2026-09-22", hora: "10:00" }, { id: "y", titulo: "Y", data: "22/09", hora: "10:00" }, medico];
    expect(compromissosValidos(lixo)).toHaveLength(1);
    expect(ocorrencias(lixo as Compromisso[], new Date(2026, 8, 22), 30)).toHaveLength(1);
  });
});

describe("planejarCompromissos", () => {
  const BASE = 1100000;

  it("avisa 1 dia antes do médico e 30 min antes de cada aula, ids únicos na faixa", () => {
    const agora = new Date(2026, 8, 22, 8, 0);
    const avisos = planejarCompromissos([medico, jiu], BASE, agora);
    const doMedico = avisos.find((a) => a.title.includes("Médico"))!;
    expect(doMedico.quando.getTime()).toBe(new Date(2026, 8, 28, 9, 0).getTime());
    expect(doMedico.body).toBe("Amanhã às 09:00");
    const daAula = avisos.filter((a) => a.title.includes("Jiu-jitsu"));
    expect(daAula.length).toBeGreaterThan(20); // 3 por semana × ~8 semanas, até o teto
    expect(daAula[0].quando.getTime()).toBe(new Date(2026, 8, 23, 19, 0).getTime());
    expect(daAula[0].body).toBe("Em 30 min, às 19:30 · Academia");
    const ids = avisos.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBe(BASE);
    expect(Math.max(...ids)).toBeLessThan(BASE + 10000);
  });

  it("sem aviso não agenda; aviso que já ficou pra trás não agenda", () => {
    const agora = new Date(2026, 8, 22, 14, 45); // reunião às 15h com aviso de 1h → passou
    const reuniao: Compromisso = { ...semAviso, aviso: 60 };
    expect(planejarCompromissos([semAviso], BASE, agora)).toHaveLength(0);
    expect(planejarCompromissos([reuniao], BASE, agora)).toHaveLength(0);
    // com 15 min de antecedência ainda cabe (14:45 = agora → não; 14:46+ sim)
    expect(planejarCompromissos([{ ...reuniao, aviso: 0 }], BASE, agora)).toHaveLength(1);
  });

  it("respeita o teto do iOS", () => {
    const todoDia: Compromisso = { id: "d", titulo: "Café", data: "2026-09-22", hora: "07:00", repete: [0, 1, 2, 3, 4, 5, 6], aviso: 0 };
    expect(planejarCompromissos([todoDia], BASE, new Date(2026, 8, 22, 6, 0))).toHaveLength(TETO_AVISOS);
  });
});

describe("proximosDeHoje / rótulos", () => {
  it("só o que ainda não passou hoje, com 30 min de tolerância", () => {
    const hoje = new Date(2026, 8, 23, 19, 50); // quarta, aula às 19:30
    expect(proximosDeHoje([jiu, medico], hoje).map((o) => o.compromisso.titulo)).toEqual(["Jiu-jitsu"]);
    expect(proximosDeHoje([jiu], new Date(2026, 8, 23, 20, 10))).toHaveLength(0);
  });

  it("rótulos legíveis", () => {
    expect(rotuloRepeticao(jiu)).toBe("seg, qua, sex");
    expect(rotuloRepeticao({ ...jiu, repete: [0, 1, 2, 3, 4] })).toBe("seg a sex");
    expect(rotuloRepeticao(medico)).toBe("");
    expect(rotuloAviso(1440)).toBe("1 dia antes");
    expect(rotuloAviso(-1)).toBe("Sem aviso");
  });
});
