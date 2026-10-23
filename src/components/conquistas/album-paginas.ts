import { CATEGORIAS, RARIDADE_LABEL, RARIDADE_PLURAL, fracaoDe, raridadeDe, type Badge, type BadgeCategoria, type Raridade } from "@/components/gamification/types";
import { ordenarParaFolha } from "@/lib/conquistas-registro";
import { ordenarParaAlbumEditorial } from "./album-curadoria";

/**
 * ÁLBUM DE ADESIVOS (27/09, dono: "no lugar das insígnias podiam ser os
 * próprios adesivos — ninguém liga pra insígnia; começando pelos mais raros,
 * em várias páginas"). O planner aberto vira o álbum, como um álbum de
 * figurinhas: a 1ª página são OS MAIS RAROS que a pessoa já colou (lendário
 * → épico → raro → comum, e dentro da raridade o mais recente primeiro); as
 * seguintes são a coleção por raridade, com VAGA FIXA pra cada adesivo — o
 * que falta aparece como silhueta no lugar dele, e é a vaga vazia que dá
 * vontade de completar. Quem tem pouco adesivo vê, na 1ª página, os 3 mais
 * perto de colar (com o progresso) e uma frase pra começar.
 *
 * Tudo aqui é conta pura sobre os adesivos de verdade (use-conquistas):
 * nada inventa adesivo nem posição.
 */

export const ORDEM_RARIDADE: Raridade[] = ["lendario", "epico", "raro", "comum"];
export const TITULO_SECAO: Record<Raridade, string> = { lendario: "LENDÁRIOS", epico: "ÉPICOS", raro: "RAROS", comum: "COMUNS" };
/** "figurinha épica", "figurinha rara" — a raridade no feminino (o álbum fala de FIGURINHAS). */
export const RARIDADE_FEM: Record<Raridade, string> = { comum: "Comum", raro: "Rara", epico: "Épica", lendario: "Lendária" };
/** Quantos adesivos a página "OS MAIS RAROS" mostra. */
export const MAIS_RAROS = 6;
/**
 * Vagas por página das seções, no MÁXIMO (4 × 4; 02/10, álbum 3D: "mais
 * figurinhas por página"). Uma seção que não cabe numa página é dividida em
 * páginas PARELHAS (21 raros = 11 + 10, não 16 + 5): nenhuma página fica
 * quase vazia.
 */
export const VAGAS_POR_PAGINA = 16;
/** Com menos que isto colado, a 1ª página mostra os próximos a colar. */
export const POUCOS = 3;
export const PROXIMOS_NO_ALBUM = 3;

const peso = (r: Raridade) => ORDEM_RARIDADE.length - ORDEM_RARIDADE.indexOf(r);

export interface PaginaAlbum {
  id: string;
  tipo: "mais-raros" | "secao";
  titulo: string;
  raridade?: Raridade;
  /** (16/10, Conquistas 2) a página é de um MÓDULO (Finanças, Rotina…), não de uma raridade. */
  modulo?: BadgeCategoria;
  modulos?: BadgeCategoria[];
  /** Conquistados e total do que a página representa (a coleção inteira na 1ª; a seção nas outras). */
  abertos: number;
  total: number;
  /** [2, 3] quando a seção ocupa mais de uma página. */
  parte?: [number, number];
  /** As vagas desta página: adesivo colado (unlocked) ou a silhueta no lugar dele. */
  vagas: Badge[];
  /** Só na 1ª página com pouco adesivo: os mais perto de colar (silhuetas com progresso). */
  proximos: Badge[];
}

/** Os conquistados do mais raro pro mais comum; na mesma raridade, o colado mais recentemente primeiro. */
export const maisRaros = (adesivos: Badge[], desbloqueadas: Record<string, string> = {}, n = MAIS_RAROS): Badge[] => {
  const pos = new Map(adesivos.map((b, i) => [b.id, i]));
  return adesivos
    .filter((b) => b.unlocked)
    .sort(
      (a, b) =>
        peso(raridadeDe(b)) - peso(raridadeDe(a)) ||
        (desbloqueadas[b.id] || "").localeCompare(desbloqueadas[a.id] || "") ||
        pos.get(a.id)! - pos.get(b.id)!,
    )
    .slice(0, n);
};

/** Começados primeiro. Sem nenhuma conquista nem progresso, oferece ações que a pessoa pode fazer hoje. */
export const proximosDoAlbum = (adesivos: Badge[], n = PROXIMOS_NO_ALBUM): Badge[] => {
  const proximos = ordenarParaFolha(adesivos, {}).filter((b) => !b.unlocked);
  if (adesivos.some((b) => b.unlocked || fracaoDe(b) > 0)) return proximos.slice(0, n);
  const primeirosPassos = ["first-expense", "rotina-1", "treino-1"]
    .map((id) => proximos.find((b) => b.id === id))
    .filter((b): b is Badge => !!b);
  const priorizados = new Set(primeirosPassos.map((b) => b.id));
  return [...primeirosPassos, ...proximos.filter((b) => !priorizados.has(b.id))].slice(0, n);
};

export function montarAlbum(adesivos: Badge[], desbloqueadas: Record<string, string> = {}, maxPorPagina = VAGAS_POR_PAGINA): PaginaAlbum[] {
  const abertos = adesivos.filter((b) => b.unlocked).length;
  const raros = maisRaros(adesivos, desbloqueadas);
  const primeira: PaginaAlbum = {
    id: "mais-raros",
    tipo: "mais-raros",
    titulo: raros.length ? "OS MAIS RAROS" : "COMEÇANDO O ÁLBUM",
    abertos,
    total: adesivos.length,
    vagas: raros,
    proximos: raros.length < POUCOS ? proximosDoAlbum(adesivos) : [],
  };
  const secoes: PaginaAlbum[] = [];
  for (const r of ORDEM_RARIDADE) {
    const da = adesivos.filter((b) => raridadeDe(b) === r);
    if (!da.length) continue;
    const n = Math.ceil(da.length / Math.max(1, maxPorPagina));
    const porPagina = Math.ceil(da.length / n);
    const abertosDa = da.filter((b) => b.unlocked).length;
    for (let i = 0; i < n; i++) {
      secoes.push({
        id: `${r}-${i + 1}`,
        tipo: "secao",
        titulo: TITULO_SECAO[r],
        raridade: r,
        abertos: abertosDa,
        total: da.length,
        parte: n > 1 ? [i + 1, n] : undefined,
        vagas: da.slice(i * porPagina, (i + 1) * porPagina),
        proximos: [],
      });
    }
  }
  return [primeira, ...secoes];
}

/**
 * O ÁLBUM POR MÓDULO (16/10, Conquistas 2 — dono: "dar um foco maior no álbum
 * em si"): a mesma 1ª página "Os mais raros" e, depois, UMA PÁGINA POR MÓDULO
 * (Sequência, Finanças, Rotina…) na ordem do catálogo — cada figurinha na sua
 * vaga fixa, as que faltam em silhueta, "faltam N pra completar a página".
 * Um módulo com mais de 16 figurinhas vira páginas parelhas, como as seções.
 */
export function montarAlbumPorModulo(adesivos: Badge[], desbloqueadas: Record<string, string> = {}, maxPorPagina = VAGAS_POR_PAGINA): PaginaAlbum[] {
  const [primeira] = montarAlbum(adesivos, desbloqueadas);
  const paginas: PaginaAlbum[] = [primeira];
  for (const c of CATEGORIAS) {
    const da = adesivos.filter((b) => b.category === c.id);
    if (!da.length) continue;
    const n = Math.ceil(da.length / Math.max(1, maxPorPagina));
    const porPagina = Math.floor(da.length / n);
    const extras = da.length % n;
    const abertosDa = da.filter((b) => b.unlocked).length;
    for (let i = 0; i < n; i++) {
      const inicio = i * porPagina + Math.min(i, extras);
      const tamanho = porPagina + (i < extras ? 1 : 0);
      paginas.push({
        id: `${c.id}-${i + 1}`,
        tipo: "secao",
        titulo: c.label.toUpperCase(),
        modulo: c.id,
        abertos: abertosDa,
        total: da.length,
        parte: n > 1 ? [i + 1, n] : undefined,
        vagas: da.slice(inicio, inicio + tamanho),
        proximos: [],
      });
    }
  }
  return paginas;
}

/** A página onde mora a figurinha `id` (ou 0). */
export const paginaDaFigurinha = (paginas: PaginaAlbum[], id: string): number => {
  // as páginas de seção/módulo primeiro: a 1ª ("os mais raros") repete as coladas
  const i = paginas.findIndex((p, k) => k > 0 && p.vagas.some((b) => b.id === id));
  return i > 0 ? i : 0;
};

/** "1 lendário · 3 épicos · 5 raros · 6 comuns" (sem os zeros). */
export const resumoRaridades = (porRaridade: Record<Raridade, { abertos: number; total: number }>): string => {
  const partes = ORDEM_RARIDADE.filter((r) => (porRaridade[r]?.abertos ?? 0) > 0).map((r) => {
    const n = porRaridade[r].abertos;
    return `${n} ${n === 1 ? RARIDADE_LABEL[r].toLowerCase() : RARIDADE_PLURAL[r]}`;
  });
  return partes.length ? partes.join(" · ") : "nenhum adesivo colado ainda";
};

/** "2 de 14 · faltam 12" — o contador de uma página de seção; "15 de 65" na 1ª. */
export const contagemDaPagina = (p: PaginaAlbum): string => {
  const base = `${p.abertos} de ${p.total}`;
  return p.tipo === "secao" && p.total > p.abertos ? `${base} · faltam ${p.total - p.abertos}` : base;
};

/** O título com a parte ("ÉPICOS · 1/2"). */
export const tituloDaPagina = (p: PaginaAlbum): string => (p.parte ? `${p.titulo} · ${p.parte[0]}/${p.parte[1]}` : p.titulo);

/** Miolo editorial: cinco espaços no máximo, capítulos estáveis e nenhuma duplicata entre eles. */
export function montarAlbumEditorial(adesivos: Badge[], desbloqueadas: Record<string, string> = {}): PaginaAlbum[] {
  const ordenados = ordenarParaAlbumEditorial(adesivos);
  const paginas = montarAlbumPorModulo(ordenados, desbloqueadas, 5);
  // A abertura editorial tem duas fileiras de duas artes. O álbum legado
  // continua com seis destaques; todas as figurinhas seguem no seu módulo.
  paginas[0] = { ...paginas[0], vagas: paginas[0].vagas.slice(0, 4) };
  const pequenas = paginas.filter(p => p.modulo === "carreira" || p.modulo === "geral");
  const vagas = pequenas.flatMap(p => p.vagas);
  if (vagas.length && vagas.length <= 5) {
    const indice = paginas.findIndex(p => p === pequenas[0]);
    paginas.splice(indice, pequenas.length, {id:"carreira-core",tipo:"secao",titulo:"Carreira & CORE",modulo:"carreira",modulos:["carreira","geral"],abertos:vagas.filter(b=>b.unlocked).length,total:vagas.length,vagas,proximos:[]});
  }
  return paginas;
}
