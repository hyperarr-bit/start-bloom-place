/**
 * 1.0.22 (dono 29/10): no modo 1.0.12 o lembrete da missão volta ao texto EXATO da 1.0.12 ("🔥 Dia N da missão")
 * — nada de "Dia 2 do seu plano", "Hoje dá pra gastar até R$ X" ou "Dia 3: feche seus 3 dias seguidos".
 */
import { describe, it, expect, afterEach } from "vitest";
import { conteudoDaMissao, type Leitor } from "@/lib/lembrete-dia2";
import { iniciarMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";

const g = globalThis as { __MODO_1012__?: unknown };
afterEach(() => { delete g.__MODO_1012__; });

// renda + custo fixo no formato real das chaves de Finanças: com o modo desligado viraria "Hoje dá pra gastar até R$ X"
const comRenda: Leitor = <T,>(k: string, f: T): T => (({
  "finance-income": [{ id: "r1", description: "Salário", value: 3000, date: "2026-10-01" }],
  "finance-fixed-expenses": [{ id: "f1", description: "Aluguel", value: 1000, dueDay: 5 }],
} as Record<string, unknown>)[k] as T) ?? f;

describe("lembrete da missão no modo 1.0.12", () => {
  const base = (): EstadoMissaoDoses => ({ ...iniciarMissao(["financas", "rotina", "saude"], "2026-10-03"), boasVindas: true, braco: "A", feitos: { 1: { dia: "2026-10-03", rotulo: "Pode gastar R$ 61 por dia" } } } as EstadoMissaoDoses);

  it("dia 2: o texto da 1.0.12, mesmo com renda anotada", () => {
    g.__MODO_1012__ = true;
    const c = conteudoDaMissao(base(), "2026-10-03", comRenda)!;
    expect(c.title).toBe("🔥 Dia 2 da missão: 📅 Rotina");
    expect(c.body).toBe("Marca 1 hábito no quadradinho — 40 segundos e o passo 2 de 3 fica feito (1 de 3 já foram).");
    expect(c.temNumero).toBe(false);
    expect(c.rota).toBe("/rotina");
  });

  it("dia 3: também o da 1.0.12; missão abandonada há dias some", () => {
    g.__MODO_1012__ = true;
    const m = { ...base(), feitos: { 1: { dia: "2026-10-03", rotulo: "x" }, 2: { dia: "2026-10-04", rotulo: "y" } } } as EstadoMissaoDoses;
    expect(conteudoDaMissao(m, "2026-10-04", comRenda)!.title).toBe("🔥 Dia 3 da missão: ❤️ Saúde");
    expect(conteudoDaMissao(base(), "2026-10-09", comRenda)).toBeNull();
  });
});
