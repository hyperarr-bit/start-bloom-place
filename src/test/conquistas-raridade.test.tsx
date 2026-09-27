/**
 * Conquistas v2 (27/09): a coleção de 65 adesivos com RARIDADE (XP 50 · 100 ·
 * 200 · 400), a escada nova de níveis (Bronze 0 · Prata 300 · Ouro 800 ·
 * Platina 1.600 · Diamante 3.000) e o PISO — o nível nunca cai, nem na
 * migração de quem já tinha nível pela escada antiga.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z" } }) }));
vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));

import { UserDataContext } from "@/hooks/use-user-data";
import {
  CHAVE_NIVEL_PISO, LEVELS, XP_RARIDADE, getLevel, getNextLevel, nivelPelaEscadaAntiga, nivelPeloXp, raridadeDe,
} from "@/components/gamification/types";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { XP_ANTIGO, XP_DIAMANTE, XP_MESTRE, buildBadgesSequencia, mesclarDesbloqueios, xpPelaTabelaAntiga } from "@/lib/conquistas-registro";
import { contarAdesivos, useConquistas } from "@/components/conquistas/use-conquistas";
import { IDS_COM_ARTE } from "@/components/conquistas/adesivos-arte";
import type { Badge } from "@/components/gamification/types";

const HOJE = "2026-09-26";
const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
const colecao = (dados: Record<string, unknown> = {}) =>
  mesclarDesbloqueios([...buildBadgesSequencia(0), ...buildBadgesFinancas(leitor(dados)), ...buildBadgesVida(leitor(dados), HOJE)], {}, HOJE).adesivos;

describe("coleção de 65 com raridade", () => {
  it("65 adesivos: 23 comuns · 21 raros · 14 épicos · 7 lendários, todos com arte e id único", () => {
    const lista = colecao();
    expect(lista).toHaveLength(65);
    expect(new Set(lista.map((b) => b.id)).size).toBe(65);
    const { porRaridade, colecoes } = contarAdesivos(lista);
    expect(porRaridade.comum.total).toBe(23);
    expect(porRaridade.raro.total).toBe(21);
    expect(porRaridade.epico.total).toBe(14);
    expect(porRaridade.lendario.total).toBe(7);
    expect(lista.filter((b) => !IDS_COM_ARTE.includes(b.id)).map((b) => b.id)).toEqual([]);
    expect(colecoes.map((c) => `${c.id}:${c.total}`)).toEqual(["sequencia:5", "finance:24", "rotina:7", "leitura:6", "treino:6", "dieta:4", "saude:6", "vida:6", "geral:1"]);
  });

  it("o XP de cada adesivo é o da raridade (50 · 100 · 200 · 400); máximo possível 8.850", () => {
    const lista = colecao();
    for (const b of lista) expect(b.xp, b.id).toBe(XP_RARIDADE[raridadeDe(b)]);
    expect(lista.reduce((s, b) => s + b.xp, 0)).toBe(8850);
    expect(lista.filter((b) => raridadeDe(b) === "lendario").map((b) => b.id).sort()).toEqual(
      ["ano-365", "investor-100k", "leitura-25", "master", "rotina-60", "sequencia-100", "treino-100"],
    );
  });

  it("raridade sem declarar cai pelo XP", () => {
    expect(raridadeDe({ xp: 50 })).toBe("comum");
    expect(raridadeDe({ xp: 100 })).toBe("raro");
    expect(raridadeDe({ xp: 200 })).toBe("epico");
    expect(raridadeDe({ xp: 400 })).toBe("lendario");
    expect(raridadeDe({ xp: 400, raridade: "comum" })).toBe("comum");
  });

  it("Mestre do CORE é lendário e abre no Diamante da escada nova (3.000 XP das outras)", () => {
    expect(XP_MESTRE).toBe(400);
    expect(XP_DIAMANTE).toBe(3000);
    const quaseTudo = colecao();
    const gravadas = Object.fromEntries(quaseTudo.filter((b) => b.id !== "master").slice(0, 40).map((b) => [b.id, "2026-09-01"]));
    const r = mesclarDesbloqueios(quaseTudo, gravadas, HOJE);
    const xpOutras = r.adesivos.filter((b) => b.unlocked && b.id !== "master").reduce((s, b) => s + b.xp, 0);
    expect(r.adesivos.find((b) => b.id === "master")!.unlocked).toBe(xpOutras >= 3000);
  });

  it("os 3 que subiram pra lendário valiam 200: o XP antigo é o que decide o piso", () => {
    expect(XP_ANTIGO).toEqual({ "sequencia-100": 200, "investor-100k": 200, master: 200 });
    const b = (id: string, xp: number): Badge => ({ id, name: id, description: "", icon: "", category: "finance", unlocked: true, color: "", xp });
    expect(xpPelaTabelaAntiga([b("sequencia-100", 400), b("first-income", 50), { ...b("master", 400), unlocked: false }])).toBe(250);
  });
});

describe("escada de níveis com piso", () => {
  it("Bronze 0 · Prata 300 · Ouro 800 · Platina 1.600 · Diamante 3.000", () => {
    expect(LEVELS.map((l) => [l.name, l.minXP])).toEqual([["Bronze", 0], ["Prata", 300], ["Ouro", 800], ["Platina", 1600], ["Diamante", 3000]]);
    expect(nivelPeloXp(299).name).toBe("Bronze");
    expect(nivelPeloXp(300).name).toBe("Prata");
    expect(nivelPeloXp(1200).name).toBe("Ouro");
    expect(nivelPeloXp(8850).name).toBe("Diamante");
  });

  it("o piso gravado vence o XP (nível nunca cai) e o próximo é o de cima do efetivo", () => {
    expect(getLevel(650, "Ouro").name).toBe("Ouro");
    expect(getLevel(650, "Bronze").name).toBe("Prata");
    expect(getLevel(650, undefined).name).toBe("Prata");
    expect(getLevel(650, "lixo").name).toBe("Prata");
    expect(getLevel(9000, "Bronze").name).toBe("Diamante");
    expect(getNextLevel(650, "Ouro")!.name).toBe("Platina");
    expect(getNextLevel(650)!.name).toBe("Ouro");
    expect(getNextLevel(3000)).toBeNull();
  });

  it("migração: o piso é o nível pela escada ANTIGA (Prata 200 · Ouro 500 · Platina 1.000 · Diamante 2.000)", () => {
    expect(nivelPelaEscadaAntiga(0).name).toBe("Bronze");
    expect(nivelPelaEscadaAntiga(250).name).toBe("Prata");
    expect(nivelPelaEscadaAntiga(650).name).toBe("Ouro");
    expect(nivelPelaEscadaAntiga(1200).name).toBe("Platina");
    expect(nivelPelaEscadaAntiga(2000).name).toBe("Diamante");
  });
});

describe("useConquistas grava e respeita o piso", () => {
  const montar = (dados: Record<string, unknown>) => {
    const gravacoes: Array<[string, unknown]> = [];
    let estado: ReturnType<typeof useConquistas> | null = null;
    const Sonda = () => { estado = useConquistas(); return null; };
    const valor = { get: leitor(dados), loaded: true, isGuest: false, fetchKey: async () => null, set: (k: string, v: unknown) => { gravacoes.push([k, v]); } };
    render(<UserDataContext.Provider value={valor}><Sonda /></UserDataContext.Provider>);
    return { gravacoes, estado: () => estado! };
  };
  // 250 XP de antes: Poupador, Investidor, 1º Salário, 1ª Despesa e Lista de Desejos (50 cada)
  const gravadas = { "saver-20": "2026-08-01", "investor-1k": "2026-08-01", "first-income": "2026-08-01", "first-expense": "2026-08-01", wishlist: "2026-08-02" };

  it("1ª vez sem piso: grava o nível da escada antiga como piso (250 XP era Prata; na nova seria Bronze)", async () => {
    const { gravacoes, estado } = montar({ "conquistas-desbloqueadas": gravadas });
    await waitFor(() => expect(gravacoes.find(([k]) => k === CHAVE_NIVEL_PISO)).toBeTruthy());
    expect(gravacoes.find(([k]) => k === CHAVE_NIVEL_PISO)![1]).toBe("Prata");
    expect(estado().xp).toBe(250);
    expect(estado().nivelPorXp.name).toBe("Bronze");
    expect(estado().nivel.name).toBe("Prata");
    expect(estado().pisoValendo).toBe(true);
  });

  it("com o piso valendo, o nível é o piso e a tela sabe (pisoValendo)", () => {
    const { estado } = montar({ "conquistas-desbloqueadas": { "first-income": "2026-08-01" }, [CHAVE_NIVEL_PISO]: "Ouro" });
    expect(estado().xp).toBe(50);
    expect(estado().nivel.name).toBe("Ouro");
    expect(estado().pisoValendo).toBe(true);
    expect(estado().proximoNivel!.name).toBe("Platina");
  });

  it("o piso sobe quando o XP passa de um degrau — e nunca desce", async () => {
    const muitas = Object.fromEntries(colecao().slice(0, 30).map((b) => [b.id, "2026-09-01"]));
    const { gravacoes, estado } = montar({ "conquistas-desbloqueadas": muitas, [CHAVE_NIVEL_PISO]: "Bronze" });
    const porXp = estado().nivelPorXp.name;
    expect(["Prata", "Ouro", "Platina", "Diamante"]).toContain(porXp);
    await waitFor(() => expect(gravacoes.find(([k]) => k === CHAVE_NIVEL_PISO)).toBeTruthy());
    expect(gravacoes.find(([k]) => k === CHAVE_NIVEL_PISO)![1]).toBe(porXp);
    // piso acima do XP: nada é gravado (nível fica no piso)
    const outra = montar({ "conquistas-desbloqueadas": { "first-income": "2026-08-01" }, [CHAVE_NIVEL_PISO]: "Diamante" });
    await new Promise((r) => setTimeout(r, 30));
    expect(outra.gravacoes.find(([k]) => k === CHAVE_NIVEL_PISO)).toBeUndefined();
    expect(outra.estado().nivel.name).toBe("Diamante");
  });
});
