/**
 * Conquistas que não voltam atrás (26/09): o desbloqueio fica gravado em
 * conquistas-desbloqueadas; no dia 1º, quando a conta do mês zera, o adesivo
 * continua colado e o nível não cai. XP e nível vêm do conjunto gravado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: unknown) => { eventos.push([nome, dados]); },
}));

import { UserDataContext } from "@/hooks/use-user-data";
import { useConquistas, membroDesdeTexto } from "@/components/conquistas/use-conquistas";
import {
  CHAVE_DESBLOQUEADAS, buildBadgesSequencia, mesclarDesbloqueios, ordenarParaFolha, proximoAdesivo, rotuloProgresso, textoFalta, brlCurto,
} from "@/lib/conquistas-registro";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { IDS_COM_ARTE } from "@/components/conquistas/adesivos-arte";
import type { Badge } from "@/components/gamification/types";

const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const hoje = "2026-09-26";

describe("mesclarDesbloqueios (puro)", () => {
  // setembro: poupança do mês em 10% — em agosto passou de 20% e "Poupador" abriu
  const setembro = leitor({
    "finance-incomes": [{ value: 1000 }],
    "finance-expenses": [{ value: 900, category: "mercado", date: "2026-09-02" }],
  });

  it("gravado vence o cálculo do mês: o adesivo continua aberto e o XP conta", () => {
    const calculadas = buildBadgesFinancas(setembro);
    expect(calculadas.find((b) => b.id === "saver-20")!.unlocked).toBe(false); // a conta do mês não bate mais
    const r = mesclarDesbloqueios(calculadas, { "saver-20": "2026-08-20" }, hoje);
    const poupador = r.adesivos.find((b) => b.id === "saver-20")!;
    expect(poupador.unlocked).toBe(true);
    expect(poupador.progresso).toEqual({ atual: 20, alvo: 20 });
    expect(r.novas).not.toContain("saver-20");
    // 50 (Poupador, gravado) + 50 (1º salário) + 50 (1ª despesa), que abriram agora
    expect(r.xp).toBe(150);
    expect(r.novas.sort()).toEqual(["first-expense", "first-income"]);
    expect(r.desbloqueadas).toMatchObject({ "saver-20": "2026-08-20", "first-income": hoje, "first-expense": hoje });
  });

  it("o nível não cai na virada do mês (dado zerado, conjunto gravado igual)", () => {
    const gravadas = { "saver-20": "2026-08-20", "saver-40": "2026-08-20", "saver-60": "2026-08-21", "investor-1k": "2026-08-02", "budget-master": "2026-08-30", "emergency-fund": "2026-08-30" };
    const agosto = mesclarDesbloqueios(buildBadgesFinancas(leitor({})), gravadas, "2026-08-31");
    const setembroZerado = mesclarDesbloqueios(buildBadgesFinancas(leitor({})), gravadas, "2026-09-01");
    expect(setembroZerado.xp).toBe(agosto.xp);
    expect(setembroZerado.xp).toBe(50 + 100 + 200 + 50 + 100 + 200);
    expect(setembroZerado.adesivos.filter((b) => b.unlocked).map((b) => b.id).sort()).toEqual(Object.keys(gravadas).sort());
  });

  it("Mestre do CORE abre por XP das outras e depois fica", () => {
    const muitas = Object.fromEntries(
      [...buildBadgesFinancas(leitor({})), ...buildBadgesVida(leitor({})), ...buildBadgesSequencia(0)].map((b) => [b.id, "2026-09-01"]),
    );
    const r = mesclarDesbloqueios([...buildBadgesFinancas(leitor({})), ...buildBadgesVida(leitor({})), ...buildBadgesSequencia(0)], muitas, hoje);
    const mestre = r.adesivos.find((b) => b.id === "master")!;
    expect(mestre.unlocked).toBe(true);
    expect(r.novas).toEqual(["master"]);
    expect(r.xp).toBeGreaterThanOrEqual(2000 + 200);
  });

  it("a 1ª receita sem gasto nenhum não vira '100% poupado' (agora seria pra sempre)", () => {
    const soReceita = buildBadgesFinancas(leitor({ "finance-incomes": [{ value: 3000 }] }));
    expect(soReceita.filter((b) => b.id.startsWith("saver-") && b.unlocked)).toEqual([]);
    const gastos = Array.from({ length: 5 }, (_, i) => ({ value: 100, date: `2026-09-0${i + 1}` }));
    const mesAnotado = buildBadgesFinancas(leitor({ "finance-incomes": [{ value: 3000 }], "finance-expenses": gastos }));
    expect(mesAnotado.filter((b) => b.id.startsWith("saver-") && b.unlocked).map((b) => b.id)).toEqual(["saver-20", "saver-40", "saver-60"]);
  });

  it("lixo no storage não abre adesivo", () => {
    const r = mesclarDesbloqueios(buildBadgesSequencia(0), { "sequencia-7": "ontem", x: 3 } as unknown, hoje);
    expect(r.adesivos.find((b) => b.id === "sequencia-7")!.unlocked).toBe(false);
  });
});

describe("folha, próximo e textos", () => {
  const b = (id: string, extra: Partial<Badge>): Badge => ({ id, name: id, description: "Descrição " + id, icon: "", category: "finance", unlocked: false, color: "", xp: 50, ...extra });

  it("conquistados na ordem em que foram colados; depois os começados, do mais perto pro mais longe", () => {
    const lista = [
      b("a", { unlocked: true }), b("z", { progresso: { atual: 0, alvo: 5 } }), b("c", { unlocked: true }),
      b("perto", { progresso: { atual: 6, alvo: 7 } }), b("longe", { progresso: { atual: 1, alvo: 10 } }),
    ];
    const folha = ordenarParaFolha(lista, { a: "2026-09-20", c: "2026-09-02" }).map((x) => x.id);
    expect(folha).toEqual(["c", "a", "perto", "longe", "z"]);
    expect(proximoAdesivo(lista)!.id).toBe("perto");
  });

  it("rótulo do círculo tracejado e o 'falta' em palavras", () => {
    expect(rotuloProgresso(b("x", { progresso: { atual: 3, alvo: 7 } }))).toBe("3/7");
    expect(rotuloProgresso(b("x", { progresso: { atual: 80, alvo: 1000 }, formato: "reais" }))).toBe("R$ 80");
    expect(rotuloProgresso(b("x", { progresso: { atual: 12.4, alvo: 20 }, formato: "porcento" }))).toBe("12%");
    expect(rotuloProgresso(b("x", {}))).toBeNull();
    expect(brlCurto(12500)).toBe("R$ 13 mil");
    expect(brlCurto(1200)).toBe("R$ 1,2 mil");
    expect(textoFalta(b("x", { progresso: { atual: 3, alvo: 7 }, unidade: ["livro", "livros"] }))).toBe("mais 4 livros");
    expect(textoFalta(b("x", { progresso: { atual: 6, alvo: 7 }, unidade: ["livro", "livros"] }))).toBe("mais 1 livro");
    expect(textoFalta(b("x", { description: "Todas as contas pagas" }))).toBe("todas as contas pagas");
    expect(textoFalta({ ...buildBadgesSequencia(4)[0] }, 4)).toBe("mais 3 dias seguidos anotando");
  });

  it("todo adesivo que existe hoje tem arte própria (nenhum cai na reserva)", () => {
    const ids = [
      ...buildBadgesFinancas(leitor({})), ...buildBadgesVida(leitor({})), ...buildBadgesSequencia(0),
    ].map((x) => x.id).concat("master");
    expect(ids.filter((id) => !IDS_COM_ARTE.includes(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("membro desde = mês de criação da conta (sem conta, o 1º dia anotado)", () => {
    expect(membroDesdeTexto("2026-07-10T12:00:00Z", undefined, hoje)).toBe("julho de 2026");
    expect(membroDesdeTexto(undefined, "2026-05-03", hoje)).toBe("maio de 2026");
  });
});

describe("useConquistas grava o que abriu", () => {
  beforeEach(() => { eventos.length = 0; });

  const montar = (dados: Record<string, unknown>) => {
    const gravacoes: Array<[string, unknown, unknown]> = [];
    let estado: ReturnType<typeof useConquistas> | null = null;
    const Sonda = () => { estado = useConquistas(); return null; };
    const valor = {
      get: leitor(dados), loaded: true, isGuest: false, fetchKey: async () => null,
      set: (k: string, v: unknown, o?: unknown) => { gravacoes.push([k, v, o]); },
    };
    render(<UserDataContext.Provider value={valor}><Sonda /></UserDataContext.Provider>);
    return { gravacoes, estado: () => estado! };
  };

  it("1ª abertura: grava a linha de base em silêncio (sem evento de 'desbloqueado')", () => {
    const { gravacoes } = montar({ "finance-incomes": [{ value: 10 }] });
    const g = gravacoes.find(([k]) => k === CHAVE_DESBLOQUEADAS)!;
    expect(g[1]).toMatchObject({ "first-income": expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(g[2]).toEqual({ system: true });
    expect(eventos.filter(([n]) => n === "adesivo_desbloqueado")).toEqual([]);
  });

  it("depois da base, adesivo novo grava e dispara adesivo_desbloqueado", () => {
    const { gravacoes } = montar({ [CHAVE_DESBLOQUEADAS]: { "first-income": "2026-09-01" }, "finance-incomes": [{ value: 10 }], "lib-books": [{ status: "lido" }] });
    const g = gravacoes.find(([k]) => k === CHAVE_DESBLOQUEADAS)!;
    expect(Object.keys(g[1] as object).sort()).toEqual(["first-income", "leitura-1"]);
    expect(eventos).toContainEqual(["adesivo_desbloqueado", { id: "leitura-1" }]);
  });

  it("nada novo, nada gravado; o nível vem do conjunto gravado", () => {
    const { gravacoes, estado } = montar({ [CHAVE_DESBLOQUEADAS]: { "investor-100k": "2026-08-01", "saver-60": "2026-08-01", "treino-pr": "2026-08-01" } });
    act(() => {});
    expect(gravacoes.filter(([k]) => k === CHAVE_DESBLOQUEADAS)).toEqual([]);
    // 27/09: Patrimônio 100k virou lendário (400) — 400 + 200 + 200; Ouro na escada nova (≥ 800)
    expect(estado().xp).toBe(800);
    expect(estado().nivel.name).toBe("Ouro");
  });
});
