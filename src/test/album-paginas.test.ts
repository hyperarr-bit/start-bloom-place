/**
 * O álbum de adesivos (27/09): a 1ª página são os mais raros (lendário →
 * comum, o mais recente antes), as outras são a coleção por raridade com
 * VAGA FIXA e silhueta no lugar do que falta; com pouco adesivo, a 1ª página
 * traz os 3 mais perto de colar. Tudo conta pura sobre os adesivos reais.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { MAIS_RAROS, VAGAS_POR_PAGINA, contagemDaPagina, maisRaros, montarAlbum, proximosDoAlbum, resumoRaridades, tituloDaPagina } from "@/components/conquistas/album-paginas";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
import type { Badge, Raridade } from "@/components/gamification/types";

const XP: Record<Raridade, number> = { comum: 50, raro: 100, epico: 200, lendario: 400 };
const b = (id: string, raridade: Raridade, unlocked: boolean, extra: Partial<Badge> = {}): Badge => ({
  id, name: id, description: `regra de ${id}`, icon: "x", category: "finance", color: "green", xp: XP[raridade], raridade, unlocked, ...extra,
});

const HOJE = "2026-09-26";
const leitor = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
/** A coleção de verdade (65), com o que estiver gravado como colado. */
const colecao = (gravadas: Record<string, string>) =>
  mesclarDesbloqueios([...buildBadgesSequencia(0), ...buildBadgesFinancas(leitor({})), ...buildBadgesVida(leitor({}), HOJE)], gravadas, HOJE);

describe("os mais raros", () => {
  it("vêm do lendário pro comum; na mesma raridade o colado mais recente primeiro; no máximo 6", () => {
    const lista = [
      b("c1", "comum", true), b("c2", "comum", true), b("c3", "comum", true),
      b("r1", "raro", true), b("r2", "raro", true), b("r3", "raro", true),
      b("e1", "epico", true), b("e2", "epico", true),
      b("l1", "lendario", true), b("l2", "lendario", false),
    ];
    const datas = { e1: "2026-09-10", e2: "2026-09-20", r1: "2026-08-01", r2: "2026-09-01", r3: "2026-07-01", l1: "2026-09-25" };
    const raros = maisRaros(lista, datas);
    expect(raros).toHaveLength(MAIS_RAROS);
    expect(raros.map((x) => x.id)).toEqual(["l1", "e2", "e1", "r2", "r1", "r3"]);
  });

  it("os próximos a colar são os mais perto (começados antes, do mais perto pro mais longe; depois o mais fácil)", () => {
    const lista = [
      b("longe", "raro", false, { progresso: { atual: 1, alvo: 10 } }),
      b("perto", "comum", false, { progresso: { atual: 8, alvo: 10 } }),
      b("meio", "epico", false, { progresso: { atual: 5, alvo: 10 } }),
      b("parado-facil", "comum", false),
      b("parado-dificil", "lendario", false),
      b("colado", "comum", true),
    ];
    expect(proximosDoAlbum(lista).map((x) => x.id)).toEqual(["perto", "meio", "longe"]);
  });
});

describe("as páginas", () => {
  it("1ª = OS MAIS RAROS (X de todos); depois LENDÁRIOS · ÉPICOS · RAROS · COMUNS com vaga FIXA (na ordem da coleção) e até 16 por página (02/10: 4 × 4), divididas PARELHAS", () => {
    const epicos = Array.from({ length: 20 }, (_, i) => b(`e${i}`, "epico", i === 3 || i === 9 || i === 13));
    const lendarios = Array.from({ length: 7 }, (_, i) => b(`l${i}`, "lendario", false));
    const lista = [...epicos, b("r0", "raro", true), b("r1", "raro", false), ...lendarios, b("c0", "comum", true)];
    const paginas = montarAlbum(lista, { e3: "2026-09-01", e9: "2026-09-02", e13: "2026-09-03", r0: "2026-09-04", c0: "2026-09-05" });
    expect(VAGAS_POR_PAGINA).toBe(16);
    expect(paginas.map((p) => p.id)).toEqual(["mais-raros", "lendario-1", "epico-1", "epico-2", "raro-1", "comum-1"]);

    const primeira = paginas[0];
    expect(primeira.titulo).toBe("OS MAIS RAROS");
    expect(primeira.vagas.map((x) => x.id)).toEqual(["e13", "e9", "e3", "r0", "c0"]);
    expect(primeira.proximos).toEqual([]);
    expect(contagemDaPagina(primeira)).toBe("5 de 30");

    const lend = paginas[1];
    expect(lend.vagas).toHaveLength(7);
    expect(lend.vagas.every((x) => !x.unlocked)).toBe(true);
    expect(lend.parte).toBeUndefined();
    expect(contagemDaPagina(lend)).toBe("0 de 7 · faltam 7");
    expect(tituloDaPagina(lend)).toBe("LENDÁRIOS");

    const [ep1, ep2] = [paginas[2], paginas[3]];
    // 20 épicos não cabem em 16: duas páginas PARELHAS (10 + 10), não 16 + 4
    expect(ep1.vagas).toHaveLength(10);
    expect(ep2.vagas).toHaveLength(10);
    // a vaga é a posição na coleção, não "colados primeiro": e3 continua na 4ª vaga
    expect(ep1.vagas.map((x) => x.id)).toEqual(epicos.slice(0, 10).map((x) => x.id));
    expect(ep1.vagas[3].unlocked).toBe(true);
    expect(ep1.vagas[4].unlocked).toBe(false);
    expect(tituloDaPagina(ep1)).toBe("ÉPICOS · 1/2");
    expect(tituloDaPagina(ep2)).toBe("ÉPICOS · 2/2");
    expect(contagemDaPagina(ep1)).toBe("3 de 20 · faltam 17");
    expect(contagemDaPagina(ep2)).toBe("3 de 20 · faltam 17");
    expect(contagemDaPagina(paginas[5])).toBe("1 de 1");
  });

  it("com menos de 3 colados, a 1ª página traz os 3 mais perto como silhueta; sem nenhum, o título vira COMEÇANDO O ÁLBUM", () => {
    const base = [
      b("a", "comum", false, { progresso: { atual: 2, alvo: 3 } }),
      b("b", "raro", false, { progresso: { atual: 1, alvo: 4 } }),
      b("c", "epico", false),
      b("d", "lendario", false),
    ];
    const zero = montarAlbum(base)[0];
    expect(zero.titulo).toBe("COMEÇANDO O ÁLBUM");
    expect(zero.vagas).toEqual([]);
    expect(zero.proximos.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(contagemDaPagina(zero)).toBe("0 de 4");

    const um = montarAlbum([b("x", "comum", true), ...base], { x: "2026-09-01" })[0];
    expect(um.titulo).toBe("OS MAIS RAROS");
    expect(um.vagas.map((x) => x.id)).toEqual(["x"]);
    expect(um.proximos.map((x) => x.id)).toEqual(["a", "b", "c"]);

    const tres = montarAlbum([b("x", "comum", true), b("y", "comum", true), b("z", "raro", true), ...base])[0];
    expect(tres.vagas).toHaveLength(3);
    expect(tres.proximos).toEqual([]);
  });

  it("na coleção de verdade (65): 7 páginas — 1 + lendários 1 + épicos 1 (14 cabem) + raros 2 (11 + 10) + comuns 2 (12 + 11) — e o total fecha", () => {
    const { adesivos, desbloqueadas } = colecao({ "sequencia-7": "2026-09-20", "leitura-1": "2026-09-21", "rotina-21": "2026-09-10" });
    const paginas = montarAlbum(adesivos, desbloqueadas);
    expect(paginas.map((p) => p.id)).toEqual(["mais-raros", "lendario-1", "epico-1", "raro-1", "raro-2", "comum-1", "comum-2"]);
    expect(paginas[0].vagas.map((x) => x.id)).toEqual(["rotina-21", "leitura-1", "sequencia-7"]);
    expect(paginas[0].total).toBe(65);
    const soma = paginas.slice(1).reduce((s, p) => s + p.vagas.length, 0);
    expect(soma).toBe(65);
    expect(paginas.filter((p) => p.raridade === "epico").map((p) => p.vagas.length)).toEqual([14]);
    expect(paginas.filter((p) => p.raridade === "raro").map((p) => p.vagas.length)).toEqual([11, 10]);
    expect(paginas.filter((p) => p.raridade === "comum").map((p) => p.vagas.length)).toEqual([12, 11]);
  });
});

describe("o resumo por raridade", () => {
  it("'1 lendário · 3 épicos · 1 comum' (sem os zeros; singular e plural certos)", () => {
    expect(resumoRaridades({ lendario: { abertos: 1, total: 7 }, epico: { abertos: 3, total: 14 }, raro: { abertos: 0, total: 21 }, comum: { abertos: 1, total: 23 } })).toBe("1 lendário · 3 épicos · 1 comum");
    expect(resumoRaridades({ lendario: { abertos: 0, total: 7 }, epico: { abertos: 0, total: 14 }, raro: { abertos: 2, total: 21 }, comum: { abertos: 0, total: 23 } })).toBe("2 raros");
    expect(resumoRaridades({ lendario: { abertos: 0, total: 7 }, epico: { abertos: 0, total: 14 }, raro: { abertos: 0, total: 21 }, comum: { abertos: 0, total: 23 } })).toBe("nenhum adesivo colado ainda");
  });
});
