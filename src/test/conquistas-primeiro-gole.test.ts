import { describe, expect, it } from "vitest";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { mesclarDesbloqueios } from "@/lib/conquistas-registro";

const hoje = "2026-10-18";
const badges = (log: unknown, meta = 8) => {
  const dados: Record<string, unknown> = { "water-log": log, "core-saude-water-goal": meta };
  return buildBadgesVida(<T,>(key: string, fallback: T): T => key in dados ? dados[key] as T : fallback, hoje);
};

describe("Primeiro gole", () => {
  it("um copo já libera a conquista, mesmo abaixo da meta diária", () => {
    const lista = badges({ [hoje]: 1 }, 12);
    expect(lista.find(b => b.id === "agua-1")).toMatchObject({ unlocked: true, raridade: "comum", progresso: { atual: 1, alvo: 1 } });
    expect(lista.find(b => b.id === "agua-7")?.unlocked).toBe(false);
  });

  it.each([{}, { [hoje]: 0 }, { [hoje]: -1 }, { [hoje]: true }, { [hoje]: Infinity }, { [hoje]: "lixo" }, { outraChave: 1 }, []])("não libera com registro vazio ou inválido: %j", log => {
    expect(badges(log).find(b => b.id === "agua-1")?.unlocked).toBe(false);
  });

  it("vale um registro anterior e continua conquistada depois de gravada", () => {
    const resultado = mesclarDesbloqueios(badges({ "2026-10-17": 1 }), {}, hoje);
    expect(resultado.novas).toContain("agua-1");
    const depois = mesclarDesbloqueios(badges({}), resultado.desbloqueadas, hoje);
    expect(depois.adesivos.find(b => b.id === "agua-1")?.unlocked).toBe(true);
    expect(depois.novas).not.toContain("agua-1");
  });
});
