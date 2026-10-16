/**
 * TROCA DE ABA NO module_analytics (16/10). O insert da troca de aba não tinha
 * `await` nem `.then` — o construtor do Supabase é preguiçoso e só dispara a
 * requisição quando alguém espera por ele, então nenhuma troca de aba chegava
 * ao banco. Aqui o construtor falso só "executa" quando o `.then` é chamado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const db = vi.hoisted(() => ({
  executados: [] as Array<Record<string, unknown>>,
  construidos: 0,
  falhar: false,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (linha: Record<string, unknown>) => {
        db.construidos += 1;
        return {
          then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => {
            db.executados.push(linha);
            if (db.falhar) return Promise.reject(new Error("sem rede")).then(ok, erro);
            return Promise.resolve({ error: null }).then(ok, erro);
          },
        };
      },
    }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { useModuleTracker } from "@/hooks/use-module-tracker";

beforeEach(() => {
  db.executados = [];
  db.construidos = 0;
  db.falhar = false;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("useModuleTracker — troca de aba grava de verdade", () => {
  it("trocar de aba depois de ≥ 2 s EXECUTA o insert da aba anterior (com tab_id e duração)", () => {
    const { result } = renderHook(() => useModuleTracker("financas"));
    act(() => { result.current("visao"); });
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 30));
    act(() => { result.current("gastos"); });
    expect(db.construidos).toBe(1);
    expect(db.executados).toHaveLength(1);
    expect(db.executados[0]).toMatchObject({ user_id: "u1", module_id: "financas", tab_id: "visao", duration_seconds: 30 });
  });

  it("menos de 2 s na aba: nada é gravado; a mesma aba de novo também não", () => {
    const { result } = renderHook(() => useModuleTracker("rotina"));
    act(() => { result.current("habitos"); });
    act(() => { result.current("habitos"); });
    vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 1));
    act(() => { result.current("agenda"); });
    expect(db.executados).toHaveLength(0);
  });

  it("erro do banco é engolido (sem rejeição solta derrubando a tela)", async () => {
    db.falhar = true;
    const soltas: unknown[] = [];
    const ouvir = (e: unknown) => { soltas.push(e); };
    process.on("unhandledRejection", ouvir);
    try {
      const { result } = renderHook(() => useModuleTracker("saude"));
      act(() => { result.current("agua"); });
      vi.setSystemTime(new Date(2026, 9, 16, 10, 1, 0));
      expect(() => act(() => { result.current("remedios"); })).not.toThrow();
      await new Promise((r) => setTimeout(r, 0));
      expect(db.executados).toHaveLength(1);
      expect(soltas).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", ouvir);
    }
  });
});
