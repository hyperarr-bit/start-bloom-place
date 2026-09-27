/**
 * A demo do Treino (/preview/treino) é tela de venda e pode abrir em qualquer
 * dia (26/09): hoje sempre tem treino de força com "última vez" e o post-it de
 * progressão, a sequência de semanas na meta aparece e o post-it do grupo
 * esquecido também. Roda nos 7 dias da semana e na virada do mês.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, afterEach } from "vitest";
import { localDayKey } from "@/lib/utils";
import { sessaoValida, sugestaoDeCarga, ultimaVez, type ExercicioDoPlano } from "@/lib/treino-series";
import { DIAS, grupoEsquecido, indiceDoDia, semanasNaMeta } from "@/lib/treino-constancia";
import { cargaPorExercicio } from "@/lib/treino-evolucao";

afterEach(() => {
  vi.useRealTimers();
});

const DATAS = [
  new Date(2026, 8, 21, 9), new Date(2026, 8, 22, 9), new Date(2026, 8, 23, 9), new Date(2026, 8, 24, 9),
  new Date(2026, 8, 25, 9), new Date(2026, 8, 26, 9), new Date(2026, 8, 27, 9),
  new Date(2026, 9, 1, 7), new Date(2027, 0, 1, 12),
];

describe("demo do Treino, em qualquer dia", () => {
  for (const quando of DATAS) {
    it(`${localDayKey(quando)} (${DIAS[indiceDoDia(quando)]})`, async () => {
      vi.useFakeTimers({ now: quando, toFake: ["Date"] });
      vi.resetModules();
      const { getSeedsForModule } = await import("@/lib/preview-seeds");
      const s = getSeedsForModule("treino");
      const hojeKey = localDayKey(quando);
      const hojeNome = DIAS[indiceDoDia(quando)];

      // hoje: força, supino fechado 4×10 da última vez → post-it "sobe pra 52,5"
      const plano = s["saude-workouts-v2"][hojeNome];
      expect(plano.muscles).toEqual(["Peito", "Tríceps"]);
      const supino = plano.exercises.find((e: ExercicioDoPlano) => e.name === "Supino reto");
      const ultima = ultimaVez(s["treino-exercise-history"], "Supino reto", hojeKey);
      expect(ultima?.series).toEqual(Array(4).fill({ carga: 50, reps: 10 }));
      expect(sugestaoDeCarga(supino, ultima)?.nova).toBe(52.5);
      expect(sessaoValida(s["treino-sessao"], hojeKey, quando.getTime())).toBe(true);

      // 5 semanas seguidas na meta de 4; ombros esquecido há 15 dias
      expect(semanasNaMeta(s["saude-workout-log"], s["treino-meta-semanal"], quando).sequencia).toBeGreaterThanOrEqual(5);
      const g = grupoEsquecido({
        fonte: { sessoes: s["treino-sessoes"], historico: s["treino-exercise-history"], plano: s["saude-workouts-v2"] },
        diasAtivos: s["treino-active-days"],
        log: s["saude-workout-log"],
        hoje: hojeKey,
      });
      expect(g).toMatchObject({ regiao: "ombros", dias: 15 });

      // carga subindo no supino, parada na remada
      const cargas = cargaPorExercicio(s["treino-exercise-history"], hojeKey);
      expect(cargas.find((c) => c.nome === "Supino reto")?.variacao.tipo).toBe("subiu");
      expect(cargas.find((c) => c.nome === "Remada curvada")?.variacao.tipo).toBe("igual");

      // histórico do mais novo pro mais antigo, sem nada de hoje (o de hoje está em andamento)
      const datas = s["treino-exercise-history"].map((h: { date: string }) => h.date);
      expect([...datas].sort().reverse()).toEqual(datas);
      expect(datas).not.toContain(hojeKey);
    });
  }
});
