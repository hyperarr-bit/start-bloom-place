import { RARIDADE_LABEL, RARIDADE_PLURAL, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { ordenarParaFolha } from "@/lib/conquistas-registro";

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
/** Quantos adesivos a página "OS MAIS RAROS" mostra. */
export const MAIS_RAROS = 6;
/** Vagas por página das seções (4 × 3, como a folha). */
export const VAGAS_POR_PAGINA = 12;
/** Com menos que isto colado, a 1ª página mostra os próximos a colar. */
export const POUCOS = 3;
export const PROXIMOS_NO_ALBUM = 3;

const peso = (r: Raridade) => ORDEM_RARIDADE.length - ORDEM_RARIDADE.indexOf(r);

export interface PaginaAlbum {
  id: string;
  tipo: "mais-raros" | "secao";
  titulo: string;
  raridade?: Raridade;
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

/** Os mais perto de colar (a mesma ordem da folha: começados primeiro, do mais perto pro mais longe). */
export const proximosDoAlbum = (adesivos: Badge[], n = PROXIMOS_NO_ALBUM): Badge[] =>
  ordenarParaFolha(adesivos, {}).filter((b) => !b.unlocked).slice(0, n);

export function montarAlbum(adesivos: Badge[], desbloqueadas: Record<string, string> = {}): PaginaAlbum[] {
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
    const n = Math.ceil(da.length / VAGAS_POR_PAGINA);
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
        vagas: da.slice(i * VAGAS_POR_PAGINA, (i + 1) * VAGAS_POR_PAGINA),
        proximos: [],
      });
    }
  }
  return [primeira, ...secoes];
}

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
