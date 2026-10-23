import { describe, expect, it } from "vitest";
import { ORDEM_EDITORIAL, ordenarParaAlbumEditorial } from "@/components/conquistas/album-curadoria";
import { montarAlbumEditorial, montarAlbumPorModulo } from "@/components/conquistas/album-paginas";
import { buildBadgesFinancas } from "@/components/gamification/badges-financas";
import { buildBadgesVida } from "@/components/gamification/badges-vida";
import { aplicarCatalogoCaderno } from "@/components/gamification/catalogo-caderno";
import { buildBadgesSequencia, mesclarDesbloqueios } from "@/lib/conquistas-registro";
import type { Badge } from "@/components/gamification/types";

const hoje = "2026-10-23";
const get = <T,>(_chave: string, fallback: T): T => fallback;
const catalogo = () => mesclarDesbloqueios(aplicarCatalogoCaderno([
  ...buildBadgesSequencia(0), ...buildBadgesFinancas(get), ...buildBadgesVida(get, hoje),
], get, {}, hoje), {}, hoje).adesivos;
const vagasDoMiolo = (adesivos: Badge[], datas: Record<string, string> = {}) =>
  montarAlbumEditorial(adesivos, datas).slice(1).map(p => ({ pagina: p.id, ids: p.vagas.map(b => b.id) }));

describe("Curadoria estável do álbum editorial", () => {
  it("usa somente IDs ativos do módulo correto, sem duplicações", () => {
    const base = catalogo();
    const porId = new Map(base.map(b => [b.id, b]));
    const ids = Object.values(ORDEM_EDITORIAL).flat();
    expect(new Set(ids).size).toBe(ids.length);
    for (const [modulo, ordem] of Object.entries(ORDEM_EDITORIAL)) {
      for (const id of ordem) expect(porId.get(id)?.category, id).toBe(modulo);
    }
  });

  it("preserva todas as 98 figurinhas e seus dados sem modificar a entrada", () => {
    const base = catalogo();
    const idsOriginais = base.map(b => b.id);
    const ordenados = ordenarParaAlbumEditorial(base);
    expect(base).toHaveLength(98);
    expect(ordenados).toHaveLength(98);
    expect(new Set(ordenados.map(b => b.id))).toEqual(new Set(idsOriginais));
    expect(base.map(b => b.id)).toEqual(idsOriginais);
    for (const figurinha of ordenados) expect(base.find(b => b.id === figurinha.id)).toBe(figurinha);
    const miolo = vagasDoMiolo(base).flatMap(p => p.ids);
    expect(miolo).toHaveLength(98);
    expect(new Set(miolo)).toEqual(new Set(idsOriginais));
    expect(ordenados.some(b => b.id === "treino-25")).toBe(true);
  });

  it("não muda uma vaga quando a conta ganha figurinhas, progresso ou datas de conquista", () => {
    const base = catalogo();
    const antes = vagasDoMiolo(base);
    const novas = base.map((b, i) => ({ ...b, unlocked: i % 2 === 0, progresso: { atual: i, alvo: 100 } }));
    const datas = Object.fromEntries(novas.map((b, i) => [b.id, `2026-10-${String(i % 23 + 1).padStart(2, "0")}`]));
    expect(vagasDoMiolo(novas, datas)).toEqual(antes);
    expect(vagasDoMiolo(base.map(b => ({ ...b, unlocked: true })), datas)).toEqual(antes);
  });

  it("mantém a evolução da sequência e dos dias de treino mesmo com entrada invertida", () => {
    const ordenados = ordenarParaAlbumEditorial([...catalogo()].reverse());
    expect(ordenados.filter(b => b.category === "sequencia").map(b => b.id)).toEqual([
      "sequencia-2", "sequencia-3", "sequencia-7", "sequencia-14", "sequencia-30",
      "retorno", "protetor-1", "sequencia-100", "mes-20", "ano-365",
    ]);
    const diasDeTreino = new Set(["treino-1", "treino-7", "treino-12", "treino-25", "treino-50", "treino-100"]);
    expect(ordenados.filter(b => diasDeTreino.has(b.id)).map(b => b.id)).toEqual([
      "treino-1", "treino-7", "treino-12", "treino-25", "treino-50", "treino-100",
    ]);
  });

  it("acrescenta IDs futuros ao fim do módulo e preserva a ordem relativa dos desconhecidos", () => {
    const exemplo = catalogo().find(b => b.id === "first-income")!;
    const futuros = ["nova-b", "nova-a"].map(id => ({ ...exemplo, id }));
    const entrada = [futuros[0], exemplo, futuros[1]];
    expect(ordenarParaAlbumEditorial(entrada).map(b => b.id)).toEqual(["first-income", "nova-b", "nova-a"]);
    expect(entrada[0]).toBe(futuros[0]);
    const semCuradoria = catalogo().filter(b => b.category === "vida").reverse();
    expect(ordenarParaAlbumEditorial(semCuradoria)).toEqual(semCuradoria);
  });

  it("aplica a curadoria somente ao livro editorial e mantém quatro destaques na abertura", () => {
    const base = catalogo().map(b => ({ ...b, unlocked: true }));
    const legado = montarAlbumPorModulo(base);
    expect(legado.filter(p => p.modulo === "finance").flatMap(p => p.vagas.map(b => b.id)))
      .toEqual(base.filter(b => b.category === "finance").map(b => b.id));
    const editorial = montarAlbumEditorial(base);
    expect(editorial[0].vagas).toHaveLength(4);
    expect(editorial.filter(p => p.modulo === "finance").map(p => p.vagas.length)).toEqual([5, 5, 5, 5]);
    expect(editorial.filter(p => p.modulo === "rotina").map(p => p.vagas.length)).toEqual([5, 4, 4, 4]);
    expect(editorial.filter(p => p.modulo === "treino").map(p => p.vagas.length)).toEqual([5, 4, 4]);
  });
});
