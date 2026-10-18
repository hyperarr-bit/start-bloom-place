import { useEffect, useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { CATEGORIAS, raridadeDe, type Badge, type BadgeCategoria, type Raridade } from "@/components/gamification/types";
import { ORDEM_RARIDADE, montarAlbum, paginaDaFigurinha, type PaginaAlbum } from "../album-paginas";
import { CHAVE_ALBUM_VISTO, ordenarParaFolha } from "@/lib/conquistas-registro";
import { anoDeMembro, useConquistas, usePerfilConquistas, useSequencia, type Sequencia } from "../use-conquistas";
import { fraseDaColecao, idDoMarco, marcoDoAdesivo, proximoPremio, quandoCurto, type ProximoPremio } from "./recompensas";

/**
 * O estado da CONQUISTAS 2 (16/10): a sequência de sempre + os adesivos de
 * sempre (os 3 novos da sequência já vêm de buildBadgesSequencia) + o próximo
 * prêmio + o ÁLBUM (por RARIDADE, o aprovado em 02/10 — dono 16/10: "igual ao de
 * hoje") + as figurinhas novas esperando pra ser coladas.
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
  /** A página do álbum onde mora o próximo adesivo desta coleção (0 = capa/mais raros). */
  pagina: number;
}

/** Uma página de raridade do álbum, pros chips "PÁGINAS DO ÁLBUM". */
export interface PaginaDeRaridade {
  raridade: Raridade;
  /** "Lendárias" · "Épicas" · "Raras" · "Comuns" */
  titulo: string;
  /** "lendárias" · … (pra "faltam 2 figurinhas na página das raras") */
  plural: string;
  indice: number;
  abertos: number;
  total: number;
}
export const TITULO_RARIDADE: Record<Raridade, { titulo: string; plural: string }> = {
  lendario: { titulo: "Lendárias", plural: "lendárias" },
  epico: { titulo: "Épicas", plural: "épicas" },
  raro: { titulo: "Raras", plural: "raras" },
  comum: { titulo: "Comuns", plural: "comuns" },
};

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
  /** O álbum de hoje (02/10): "os mais raros" e depois as seções por raridade, com vaga fixa. */
  paginas: PaginaAlbum[];
  /** As 4 páginas de raridade (a 1ª de cada), na ordem do álbum. */
  paginasDeRaridade: PaginaDeRaridade[];
  /** A pílula "AMANHÃ"/"HOJE"/"EM N DIAS" na vaga vazia do próximo prêmio. */
  destaques: Record<string, string>;
  /** A página que tem a 1ª figurinha pendente (ou a página de "faltam menos"). */
  paginaDasNovas: number;
  /** A PÁGINA de raridade com menos vagas vazias (a que mais convida a completar); `parte` quando a seção tem 2 páginas. */
  paginaMaisPerto: { indice: number; faltam: number; titulo: string; plural: string; parte?: number } | null;
  registroPronto: boolean;
  /** Grava o "visto" de uma figurinha colada (e a tira das pendentes). */
  colar: (id: string) => void;
}

/** A mesma chave da tela de hoje (TelaConquistas): o que a pessoa já viu colado (mora no registro). */
export { CHAVE_ALBUM_VISTO };

const lerVisto = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

export function useConquistasNova(): EstadoConquistasNova {
  const { get, set, loaded } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const vistoCru = get<unknown>(CHAVE_ALBUM_VISTO, undefined);
  const visto = useMemo(() => lerVisto(vistoCru), [vistoCru]);

  // a linha de base (1ª vez desta versão): tudo que já está colado entra como visto, em silêncio — igual à tela de hoje.
  // Só pra quem JÁ tinha registro e nunca abriu o álbum: a conta nova ganha a base `[]` junto com o registro
  // (useConquistas, 17/10 #95) — senão a 1ª figurinha entrava aqui como "vista" e nunca pedia pra ser colada.
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
    const paginas = montarAlbum(adesivos, desbloqueadas);
    const colecoes: ColecaoNova[] = CATEGORIAS.map((c) => {
      const dela = ordenarParaFolha(adesivos.filter((b) => b.category === c.id), desbloqueadas);
      const abertos = dela.filter((b) => b.unlocked).length;
      return { id: c.id, label: c.label, emoji: c.emoji, rota: c.rota, adesivos: dela, abertos, total: dela.length, frase: fraseDaColecao(abertos, dela.length), proximo: dela.find((b) => !b.unlocked) ?? null, pagina: (() => { const prox = dela.find((b) => !b.unlocked) ?? dela[0]; return prox ? paginaDaFigurinha(paginas, prox.id) : 0; })() };
    }).filter((c) => c.total > 0);
    const trilha = adesivos.filter((b) => marcoDoAdesivo(b.id) !== null).sort((a, b) => marcoDoAdesivo(a.id)! - marcoDoAdesivo(b.id)!);
    const premio = proximoPremio(seq.dias, seq.hojeFeito, adesivos);
    const destaques: Record<string, string> = premio.adesivo ? { [idDoMarco(premio.marco)]: quandoCurto(premio) } : {};
    const paginaDasNovas = pendentes.length ? paginaDaFigurinha(paginas, pendentes[0].id) : 0;
    const paginasDeRaridade: PaginaDeRaridade[] = ORDEM_RARIDADE.map((r) => {
      const indice = paginas.findIndex((p) => p.raridade === r);
      const p = paginas[indice];
      return p ? { raridade: r, ...TITULO_RARIDADE[r], indice, abertos: p.abertos, total: p.total } : null;
    }).filter((x): x is PaginaDeRaridade => !!x);
    // a página mais perto de fechar: qualquer página de raridade (contando as vagas DELA), com algo já colado, com menos vagas vazias
    const candidatas = paginas
      .map((p, indice) => ({ indice, raridade: p.raridade, parte: p.parte?.[0], coladas: p.vagas.filter((b) => b.unlocked).length, faltam: p.vagas.filter((b) => !b.unlocked).length }))
      .filter((p) => p.raridade && p.faltam > 0)
      .sort((a, b) => (b.coladas > 0 ? 1 : 0) - (a.coladas > 0 ? 1 : 0) || a.faltam - b.faltam);
    const paginaMaisPerto = candidatas[0] ? { indice: candidatas[0].indice, faltam: candidatas[0].faltam, ...TITULO_RARIDADE[candidatas[0].raridade!], parte: candidatas[0].parte } : null;
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
      paginasDeRaridade,
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
