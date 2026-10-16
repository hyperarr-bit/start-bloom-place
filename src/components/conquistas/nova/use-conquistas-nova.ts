import { useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { CATEGORIAS, raridadeDe, type Badge, type BadgeCategoria } from "@/components/gamification/types";
import { ordenarParaFolha } from "@/lib/conquistas-registro";
import { useConquistas, usePerfilConquistas, useSequencia, type Sequencia } from "../use-conquistas";
import { adesivosDaSequenciaNovos, fraseDaColecao, marcoDoAdesivo, proximoPremio, type ProximoPremio } from "./recompensas";

/**
 * O estado da CONQUISTAS 2 (protótipo 16/10): a sequência de sempre + os
 * adesivos de sempre + os 3 adesivos novos da sequência (2, 3 e 14 dias) +
 * o próximo prêmio + as coleções por módulo. Lê as MESMAS chaves do app
 * (`core-dias-anotados`, `conquistas-desbloqueadas`, `conquistas-album-visto`):
 * quem já tem adesivo e sequência vê tudo igual aqui.
 *
 * Não grava nada que a tela antiga não grave (os hooks de baixo cuidam do
 * registro). Quando a tela for ligada, os 3 adesivos novos entram em
 * `buildBadgesSequencia` e passam pelo `mesclarDesbloqueios` como os outros.
 */

export interface ColecaoNova {
  id: BadgeCategoria;
  label: string;
  emoji: string;
  rota: string;
  adesivos: Badge[];
  abertos: number;
  total: number;
  frase: string;
  /** O mais perto de colar desta coleção (ou null se fechou). */
  proximo: Badge | null;
}

export interface EstadoConquistasNova {
  seq: Sequencia;
  nome: string;
  membroDesde: string;
  /** Todos os adesivos, com os 3 novos da sequência no meio. */
  adesivos: Badge[];
  /** Na ordem da folha: colados primeiro (mais recente antes), depois os mais perto. */
  folha: Badge[];
  desbloqueadas: Record<string, string>;
  abertos: number;
  total: number;
  /** Colados desde a última visita (a chave `conquistas-album-visto` de hoje). */
  novos: Badge[];
  /** O último colado (pra "Colado hoje"/"Último adesivo"). */
  ultimo: Badge | null;
  premio: ProximoPremio;
  colecoes: ColecaoNova[];
  /** Os adesivos da sequência em ordem de marco (a trilha). */
  trilha: Badge[];
}

/** A mesma chave da tela de hoje (TelaConquistas): o que a pessoa já viu colado. */
export const CHAVE_ALBUM_VISTO = "conquistas-album-visto";

const lerVisto = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

export function useConquistasNova(): EstadoConquistasNova {
  const { get } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const vistoCru = get<unknown>(CHAVE_ALBUM_VISTO, undefined);

  return useMemo(() => {
    const novosSeq = adesivosDaSequenciaNovos(seq.recorde).map((b) => ({ ...b, unlocked: b.unlocked || b.id in conq.desbloqueadas }));
    const adesivos = [...conq.adesivos, ...novosSeq];
    const desbloqueadas = { ...conq.desbloqueadas };
    const folha = ordenarParaFolha(adesivos, desbloqueadas);
    const colados = folha.filter((b) => b.unlocked);
    const visto = lerVisto(vistoCru);
    const novos = visto ? colados.filter((b) => !visto.includes(b.id)) : [];
    const colecoes: ColecaoNova[] = CATEGORIAS.map((c) => {
      const dela = ordenarParaFolha(adesivos.filter((b) => b.category === c.id), desbloqueadas);
      const abertos = dela.filter((b) => b.unlocked).length;
      return { id: c.id, label: c.label, emoji: c.emoji, rota: c.rota, adesivos: dela, abertos, total: dela.length, frase: fraseDaColecao(abertos, dela.length), proximo: dela.find((b) => !b.unlocked) ?? null };
    }).filter((c) => c.total > 0);
    // a trilha: só os marcos, do 2 ao 100
    const trilha = adesivos.filter((b) => marcoDoAdesivo(b.id) !== null).sort((a, b) => marcoDoAdesivo(a.id)! - marcoDoAdesivo(b.id)!);
    return {
      seq,
      nome: perfil.nome,
      membroDesde: perfil.membroDesde,
      adesivos,
      folha,
      desbloqueadas,
      abertos: colados.length,
      total: adesivos.length,
      novos,
      ultimo: colados[0] ?? null,
      premio: proximoPremio(seq.dias, seq.hojeFeito, adesivos),
      colecoes,
      trilha,
    };
  }, [seq, conq.adesivos, conq.desbloqueadas, perfil.nome, perfil.membroDesde, vistoCru]);
}

/** "3 raros · 12 comuns" — pro rodapé da coleção. */
export const resumoRaridadesCurto = (adesivos: Badge[]): string => {
  const n: Record<string, number> = {};
  for (const b of adesivos) if (b.unlocked) n[raridadeDe(b)] = (n[raridadeDe(b)] ?? 0) + 1;
  const partes = [
    n.lendario ? `${n.lendario} lendário${n.lendario > 1 ? "s" : ""}` : "",
    n.epico ? `${n.epico} épico${n.epico > 1 ? "s" : ""}` : "",
    n.raro ? `${n.raro} raro${n.raro > 1 ? "s" : ""}` : "",
    n.comum ? `${n.comum} ${n.comum > 1 ? "comuns" : "comum"}` : "",
  ].filter(Boolean);
  return partes.join(" · ");
};
