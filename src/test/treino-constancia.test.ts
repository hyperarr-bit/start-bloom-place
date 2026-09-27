/**
 * Constância do Treino (26/09, mockup p7 — o heatmap copiado da Rotina foi
 * recusado): meta semanal com sequência de semanas, mês carimbado com o grupo
 * muscular e o post-it do grupo esquecido.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  carimboDoTreino,
  diaDaSemanaDe,
  faixaDaSemana,
  grupoEsquecido,
  mesCarimbado,
  metaPadrao,
  regiaoDoExercicio,
  regioesDoTreino,
  semanasNaMeta,
  type FonteDosTreinos,
} from "@/lib/treino-constancia";

// 26/09/2026 é sábado
const HOJE = new Date(2026, 8, 26, 10, 0);
const d = (dia: number, mes = 9) => `2026-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

describe("semanas na meta", () => {
  it("12 colunas (a atual por último), rótulo = segunda da semana", () => {
    const { semanas } = semanasNaMeta([], 4, HOJE);
    expect(semanas).toHaveLength(12);
    expect(semanas[11]).toMatchObject({ inicio: "2026-09-21", rotulo: "21/9", atual: true, treinos: 0 });
    expect(semanas[0].rotulo).toBe("6/7");
  });

  it("descanso não quebra: conta semanas FECHADAS na meta; a atual só entra depois de bater", () => {
    const log = [
      // semana de 14/9: 4 treinos (bateu)
      d(14), d(15), d(17), d(19),
      // semana de 7/9: 4 (bateu), com dia repetido que não conta 2x
      d(7), d(8), d(8), d(10), d(12),
      // semana de 31/8: 2 (não bateu)
      d(31, 8), d(2),
      // semana atual (21/9): 2 até agora
      d(21), d(23),
    ];
    const r = semanasNaMeta(log, 4, HOJE);
    expect(r.semanas[11]).toMatchObject({ treinos: 2, bateu: false });
    expect(r.semanas[10]).toMatchObject({ treinos: 4, bateu: true });
    expect(r.semanas[9]).toMatchObject({ treinos: 4, bateu: true });
    expect(r.sequencia).toBe(2);
    // batendo na semana atual, ela entra
    expect(semanasNaMeta([...log, d(24), d(25)], 4, HOJE).sequencia).toBe(3);
  });

  it("dado sujo e data futura não contam; meta padrão = dias de treino do plano", () => {
    expect(semanasNaMeta(["lixo", null, d(30)], 1, HOJE).semanas[11].treinos).toBe(0);
    expect(metaPadrao(["SEGUNDA", "QUARTA", "SEXTA"])).toBe(3);
    expect(metaPadrao([])).toBe(3);
    expect(faixaDaSemana(new Date(2026, 8, 21))).toBe("21 a 27 de set");
    expect(faixaDaSemana(new Date(2026, 8, 28))).toBe("28 de set a 4 de out");
  });
});

describe("carimbos do mês", () => {
  const fonte: FonteDosTreinos = {
    sessoes: { [d(22)]: { dia: "TERÇA", minutos: 50, musculos: ["Peito", "Tríceps"] } },
    historico: [
      { date: d(21), exercise: "Agachamento livre" },
      { date: d(21), exercise: "Leg press 45°" },
      { date: d(21), exercise: "Rosca direta" },
      { date: d(23), exercise: "Esteira", tipo: "cardio" },
      { date: d(24), exercise: "Puxada frente" },
      { date: d(24), exercise: "Remada curvada" },
      { date: d(24), exercise: "Rosca direta" },
    ],
    plano: { SEXTA: { muscles: ["Ombros", "Abdômen"] }, QUINTA: { muscles: ["Full Body"] } },
  };

  it("grupo pelo nome do exercício, pelos músculos gravados ou, sem nada, pelo plano do dia da semana", () => {
    expect(regiaoDoExercicio("Tríceps corda")).toBe("braços");
    expect(regiaoDoExercicio("Pular corda")).toBe("cardio");
    expect(regiaoDoExercicio("Mesa flexora")).toBe("pernas");
    expect(regiaoDoExercicio("Flexão de braço")).toBe("peito");
    expect(regiaoDoExercicio("Elevação lateral")).toBe("ombros");
    expect(regiaoDoExercicio("Crucifixo invertido")).toBe("ombros");
    expect(regiaoDoExercicio("Bike", "cardio")).toBe("cardio");
    expect(regiaoDoExercicio("Alongamento")).toBeNull();
    expect(carimboDoTreino(regioesDoTreino(d(21), fonte)).emoji).toBe("🦵");
    expect(carimboDoTreino(regioesDoTreino(d(22), fonte)).emoji).toBe("💪");
    expect(carimboDoTreino(regioesDoTreino(d(23), fonte)).emoji).toBe("🏃");
    expect(carimboDoTreino(regioesDoTreino(d(24), fonte)).emoji).toBe("🚣");
    // 25/09 é sexta: sem histórico nem sessão → o plano (Ombros + Abdômen, empate → o 1º)
    expect(carimboDoTreino(regioesDoTreino(d(25), fonte)).emoji).toBe("💪");
    // quinta (Full Body) → 🔥
    expect(carimboDoTreino(regioesDoTreino(d(17), fonte)).emoji).toBe("🔥");
    // nada em lugar nenhum → ✓
    expect(carimboDoTreino(regioesDoTreino(d(20), fonte)).emoji).toBe("✓");
  });

  it("setembro/2026 começa na terça; futuro sem carimbo; treinos e horas do mês", () => {
    const log = [d(21), d(22), d(23), d(24), d(27), d(15, 8)];
    const m = mesCarimbado(2026, 8, log, fonte, d(26));
    expect(m.vazioAntes).toBe(1);
    expect(m.dias).toHaveLength(30);
    expect(m.dias[0]).toMatchObject({ dia: 1, coluna: 1 });
    expect(m.dias.find((x) => x.dia === 26)).toMatchObject({ hoje: true, treinou: false });
    // 27 é futuro: mesmo no log (dado sujo), não carimba
    expect(m.dias.find((x) => x.dia === 27)).toMatchObject({ futuro: true, carimbo: null });
    expect(m.treinos).toBe(4);
    expect(m.minutos).toBe(50);
    expect(m.grupos).toEqual(["pernas", "superiores", "costas", "cardio"]);
    expect(diaDaSemanaDe(d(26))).toBe("SÁBADO");
  });
});

describe("grupo esquecido", () => {
  const plano: FonteDosTreinos["plano"] = {
    SEGUNDA: { muscles: ["Quadríceps", "Pernas"] },
    QUARTA: { muscles: ["Costas", "Bíceps"] },
    SEXTA: { muscles: ["Ombros", "Abdômen"] },
    "SÁBADO": { muscles: ["Peito", "Tríceps"] },
  };
  const ativos = ["SEGUNDA", "QUARTA", "SEXTA", "SÁBADO"];

  it("ombros há 15 dias → post-it sugerindo a próxima sexta", () => {
    const fonte: FonteDosTreinos = { sessoes: {}, historico: [], plano };
    // o carimbo vem do plano do dia da semana: 11/09 (sexta) foi o último treino de ombros
    const log = [d(11), d(14), d(16), d(19), d(21), d(23)];
    const g = grupoEsquecido({ fonte, diasAtivos: ativos, log, hoje: d(26) });
    expect(g).toMatchObject({ regiao: "ombros", dias: 15, dia: "SEXTA" });
    expect(`${g?.frase} ${g?.pergunta}`).toBe("Faz 15 dias sem treinar ombros. Encaixa na sexta?");
  });

  it("menos de 10 dias, sem treino nenhum, ou grupo fora do plano → nada", () => {
    const fonte: FonteDosTreinos = { sessoes: {}, historico: [], plano };
    expect(grupoEsquecido({ fonte, diasAtivos: ativos, log: [d(18), d(19), d(21), d(23)], hoje: d(26) })).toBeNull();
    expect(grupoEsquecido({ fonte, diasAtivos: ativos, log: [], hoje: d(26) })).toBeNull();
  });

  it("dia de hoje no plano com o grupo e ainda sem treino → 'Encaixa hoje?'; cardio vira 'fazer cardio'", () => {
    const p2: FonteDosTreinos["plano"] = { "SÁBADO": { muscles: ["Cardio"] }, SEGUNDA: { muscles: ["Pernas"] } };
    const fonte: FonteDosTreinos = { sessoes: {}, historico: [{ date: d(14), exercise: "Agachamento" }], plano: p2 };
    const g = grupoEsquecido({ fonte, diasAtivos: ["SÁBADO", "SEGUNDA"], log: [d(1), d(14), d(21)], hoje: d(26) });
    expect(g?.frase).toBe("Faz 25 dias sem fazer cardio.");
    expect(g?.pergunta).toBe("Encaixa hoje?");
  });

  it("treino Full Body cobre todos os grupos", () => {
    const fonte: FonteDosTreinos = { sessoes: { [d(20)]: { musculos: ["Full Body"] } }, historico: [], plano };
    expect(grupoEsquecido({ fonte, diasAtivos: ativos, log: [d(1), d(20)], hoje: d(26) })).toBeNull();
  });
});
