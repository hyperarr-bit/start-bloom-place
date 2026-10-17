import { useEffect, useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { CATEGORIAS, raridadeDe, type Badge, type BadgeCategoria, type Raridade } from "@/components/gamification/types";
import { ordenarParaFolha } from "@/lib/conquistas-registro";
import { montarAlbumPorModulo, paginaDaFigurinha, type PaginaAlbum } from "../album-paginas";
import { anoDeMembro, useConquistas, usePerfilConquistas, useSequencia, type Sequencia } from "../use-conquistas";
import { fraseDaColecao, idDoMarco, marcoDoAdesivo, proximoPremio, quandoCurto, type ProximoPremio } from "./recompensas";

/**
 * O estado da CONQUISTAS 2 (16/10): a sequência de sempre + os adesivos de
 * sempre (os 3 novos da sequência já vêm de buildBadgesSequencia) + o próximo
 * prêmio + o ÁLBUM POR MÓDULO + as figurinhas novas esperando pra ser coladas.
 * Lê as MESMAS chaves do app (`core-dias-anotados`, `conquistas-desbloqueadas`,
 * `conquistas-album-visto`): quem já tem adesivo e sequência vê tudo igual aqui.
 *
 * Grava só o que a tela antiga grava: a linha de base do "visto" na 1ª vez
 * (`conquistas-album-visto`, em silêncio) — e, pelo `colar`, cada figurinha
 * que a pessoa cola no álbum.
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
  /** A página do álbum desta coleção. */
  pagina: number;
}

export interface EstadoConquistasNova {
  seq: Sequencia;
  nome: string;
  membroDesde: string;
  ano: number;
  /** Todos os adesivos (com os 3 novos da sequência no meio). */
  adesivos: Badge[];
  /** Na ordem da folha: colados primeiro (mais recente antes), depois os mais perto. */
  folha: Badge[];
  desbloqueadas: Record<string, string>;
  abertos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  /** Colados desde a última visita ao álbum (a chave `conquistas-album-visto` de hoje): esperam pra ser colados. */
  pendentes: Badge[];
  /** O último colado (pra "Colado hoje"/"Último adesivo"). */
  ultimo: Badge | null;
  premio: ProximoPremio;
  colecoes: ColecaoNova[];
  /** Os adesivos da sequência em ordem de marco (a trilha). */
  trilha: Badge[];
  /** O álbum por módulo (a 1ª página são os mais raros). */
  paginas: PaginaAlbum[];
  /** A pílula "AMANHÃ"/"HOJE"/"EM N DIAS" na vaga vazia do próximo prêmio. */
  destaques: Record<string, string>;
  /** A página que tem a 1ª figurinha pendente (ou a página de "faltam menos"). */
  paginaDasNovas: number;
  /** A página com menos figurinhas faltando (a que mais convida a completar). */
  paginaMaisPerto: { indice: number; faltam: number; titulo: string } | null;
  registroPronto: boolean;
  /** Grava o "visto" de uma figurinha colada (e a tira das pendentes). */
  colar: (id: string) => void;
}

/** A mesma chave da tela de hoje (TelaConquistas): o que a pessoa já viu colado. */
export const CHAVE_ALBUM_VISTO = "conquistas-album-visto";

const lerVisto = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

export function useConquistasNova(): EstadoConquistasNova {
  const { get, set, loaded } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const vistoCru = get<unknown>(CHAVE_ALBUM_VISTO, undefined);
  const visto = useMemo(() => lerVisto(vistoCru), [vistoCru]);

  // a linha de base (1ª vez desta versão): tudo que já está colado entra como visto, em silêncio — igual à tela de hoje
  const coladasTxt = useMemo(() => conq.adesivos.filter((b) => b.unlocked).map((b) => b.id).join(","), [conq.adesivos]);
  useEffect(() => {
    if (!loaded || !conq.registroPronto || visto) return;
    set(CHAVE_ALBUM_VISTO, coladasTxt ? coladasTxt.split(",") : [], { system: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, conq.registroPronto, !!visto, coladasTxt]);

  return useMemo(() => {
    const adesivos = conq.adesivos;
    const desbloqueadas = conq.desbloqueadas;
    const folha = ordenarParaFolha(adesivos, desbloqueadas);
    const colados = folha.filter((b) => b.unlocked);
    const pendentes = visto ? colados.filter((b) => !visto.includes(b.id)) : [];
    const paginas = montarAlbumPorModulo(adesivos, desbloqueadas);
    const colecoes: ColecaoNova[] = CATEGORIAS.map((c) => {
      const dela = ordenarParaFolha(adesivos.filter((b) => b.category === c.id), desbloqueadas);
      const abertos = dela.filter((b) => b.unlocked).length;
      return { id: c.id, label: c.label, emoji: c.emoji, rota: c.rota, adesivos: dela, abertos, total: dela.length, frase: fraseDaColecao(abertos, dela.length), proximo: dela.find((b) => !b.unlocked) ?? null, pagina: Math.max(0, paginas.findIndex((p) => p.modulo === c.id)) };
    }).filter((c) => c.total > 0);
    const trilha = adesivos.filter((b) => marcoDoAdesivo(b.id) !== null).sort((a, b) => marcoDoAdesivo(a.id)! - marcoDoAdesivo(b.id)!);
    const premio = proximoPremio(seq.dias, seq.hojeFeito, adesivos);
    const destaques: Record<string, string> = premio.adesivo ? { [idDoMarco(premio.marco)]: quandoCurto(premio) } : {};
    const paginaDasNovas = pendentes.length ? paginaDaFigurinha(paginas, pendentes[0].id) : 0;
    // a página mais perto de fechar: a de um módulo (fora o "CORE", que é só o Mestre), com algo já colado, com menos vagas vazias
    const candidatas = paginas.map((p, i) => ({ indice: i, faltam: p.total - p.abertos, abertos: p.abertos, titulo: p.titulo, modulo: p.modulo })).filter((p) => p.modulo && p.modulo !== "geral" && p.faltam > 0).sort((a, b) => (b.abertos > 0 ? 1 : 0) - (a.abertos > 0 ? 1 : 0) || a.faltam - b.faltam);
    const paginaMaisPerto = candidatas[0] ? { indice: candidatas[0].indice, faltam: candidatas[0].faltam, titulo: candidatas[0].titulo } : null;
    const colar = (id: string) => {
      const atual = lerVisto(get<unknown>(CHAVE_ALBUM_VISTO, undefined)) ?? [];
      if (atual.includes(id)) return;
      set(CHAVE_ALBUM_VISTO, [...atual, id], { system: true });
    };
    return {
      seq,
      nome: perfil.nome,
      membroDesde: perfil.membroDesde,
      ano: anoDeMembro(perfil.membroDesde),
      adesivos,
      folha,
      desbloqueadas,
      abertos: colados.length,
      total: adesivos.length,
      porRaridade: conq.porRaridade,
      pendentes,
      ultimo: colados[colados.length - 1] ?? null,
      premio,
      colecoes,
      trilha,
      paginas,
      destaques,
      paginaDasNovas,
      paginaMaisPerto,
      registroPronto: conq.registroPronto,
      colar,
    };
  }, [seq, conq.adesivos, conq.desbloqueadas, conq.porRaridade, conq.registroPronto, perfil.nome, perfil.membroDesde, visto, get, set]);
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
