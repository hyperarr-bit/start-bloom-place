import { Badge, fracaoDe } from "@/components/gamification/types";
import { ehDia, MARCOS_SEQUENCIA } from "@/lib/sequencia";

/**
 * CONQUISTAS QUE NÃO VOLTAM ATRÁS (26/09).
 *
 * Antes, toda insígnia era recalculada do dado do mês a cada abertura: no dia
 * 1º a taxa de poupança zerava, "Poupador" trancava de novo e o nível CAÍA —
 * a pessoa via a medalha que tinha ganhado sumir. Agora o desbloqueio é
 * gravado em `conquistas-desbloqueadas` ({ id: "AAAA-MM-DD" }): uma vez
 * conquistado, fica; XP e nível vêm desse conjunto.
 */

export const CHAVE_DESBLOQUEADAS = "conquistas-desbloqueadas";
/** O que já foi comemorado ({ adesivos: ids, marcos: [7, 30…] }) — cada momento aparece UMA vez. */
export const CHAVE_VISTAS = "conquistas-vistas";

export const XP_MESTRE = 200;
export const XP_DIAMANTE = 2000;

/** Adesivos da sequência nova (dias com algo anotado): 7, 30 e 100 dias. */
export const buildBadgesSequencia = (recorde: number): Badge[] =>
  MARCOS_SEQUENCIA.map((n) => ({
    id: `sequencia-${n}`,
    name: `${n} Dias Seguidos`,
    description: `Anote algo no app ${n} dias seguidos`,
    icon: "🔥",
    category: "sequencia" as const,
    color: "green",
    xp: n === 7 ? 100 : 200,
    unlocked: recorde >= n,
    progresso: { atual: Math.min(Math.max(0, recorde), n), alvo: n },
  }));

/** A insígnia máxima é do APP INTEIRO: medida pelo XP das outras. */
const mestre = (xpDasOutras: number, gravado: boolean): Badge => ({
  id: "master",
  name: "Mestre do CORE",
  description: "Chegue ao nível Diamante",
  icon: "👑",
  category: "geral",
  color: "green",
  xp: XP_MESTRE,
  unlocked: gravado || xpDasOutras >= XP_DIAMANTE,
  progresso: { atual: Math.min(xpDasOutras, XP_DIAMANTE), alvo: XP_DIAMANTE },
  formato: "xp",
});

/** Só { id: "AAAA-MM-DD" } válidos — lixo no storage não abre adesivo. */
export const lerDesbloqueadas = (v: unknown): Record<string, string> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [id, dia] of Object.entries(v as Record<string, unknown>)) if (id && ehDia(dia)) out[id] = dia;
  return out;
};

export interface ResultadoConquistas {
  /** Todas (inclui a do Mestre), com `unlocked` já somando o que está gravado. */
  adesivos: Badge[];
  /** Gravadas + as que abriram agora (id → dia). */
  desbloqueadas: Record<string, string>;
  /** Abriram agora e ainda não estavam gravadas (é o que precisa ser escrito). */
  novas: string[];
  /** XP do conjunto desbloqueado. */
  xp: number;
}

/**
 * Junta o que o dado de hoje abre com o que já foi gravado. Gravado vence:
 * a insígnia que abriu em agosto continua aberta em setembro mesmo que a conta
 * do mês não bata mais.
 */
export function mesclarDesbloqueios(calculadas: Badge[], gravadasCru: unknown, hoje: string): ResultadoConquistas {
  const gravadas = lerDesbloqueadas(gravadasCru);
  const base = calculadas
    .filter((b) => b.id !== "master")
    .map((b) =>
      gravadas[b.id] && !b.unlocked
        ? { ...b, unlocked: true, progresso: b.progresso ? { atual: b.progresso.alvo, alvo: b.progresso.alvo } : undefined }
        : b,
    );
  const xpDasOutras = base.filter((b) => b.unlocked).reduce((s, b) => s + b.xp, 0);
  const m = mestre(xpDasOutras, !!gravadas.master);
  const adesivos = [...base, m];
  const novas = adesivos.filter((b) => b.unlocked && !gravadas[b.id]).map((b) => b.id);
  const desbloqueadas = { ...gravadas };
  for (const id of novas) desbloqueadas[id] = hoje;
  return { adesivos, desbloqueadas, novas, xp: xpDasOutras + (m.unlocked ? m.xp : 0) };
}

/**
 * Ordem da folha de adesivos: os conquistados na ordem em que foram colados
 * (a folha vai enchendo), depois os que faltam — primeiro os que já
 * começaram, do mais perto pro mais longe; os não começados pelo mais fácil.
 */
export function ordenarParaFolha(adesivos: Badge[], desbloqueadas: Record<string, string>): Badge[] {
  const pos = new Map(adesivos.map((b, i) => [b.id, i]));
  const abertos = adesivos
    .filter((b) => b.unlocked)
    .sort((a, b) => (desbloqueadas[a.id] || "").localeCompare(desbloqueadas[b.id] || "") || pos.get(a.id)! - pos.get(b.id)!);
  const faltam = adesivos
    .filter((b) => !b.unlocked)
    .sort((a, b) => {
      const fa = fracaoDe(a), fb = fracaoDe(b);
      if ((fa > 0) !== (fb > 0)) return fa > 0 ? -1 : 1;
      if (fa !== fb) return fb - fa;
      return a.xp - b.xp || pos.get(a.id)! - pos.get(b.id)!;
    });
  return [...abertos, ...faltam];
}

/** O próximo a abrir: o mais perto entre os começados; senão o mais fácil. */
export const proximoAdesivo = (adesivos: Badge[]): Badge | null =>
  ordenarParaFolha(adesivos, {}).find((b) => !b.unlocked) ?? null;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v >= 100 ? 0 : 2 });

/** "R$ 80" · "R$ 1,2 mil" · "R$ 12 mil" — cabe no círculo do adesivo que falta. */
export const brlCurto = (v: number): string => {
  const n = Math.max(0, v);
  if (n >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: n < 10000 ? 1 : 0 })} mil`;
  return `R$ ${Math.round(n)}`;
};

/** O que vai dentro do círculo tracejado ("3/7", "R$ 80", "12%"); null = cadeado. */
export const rotuloProgresso = (b: Badge): string | null => {
  if (!b.progresso) return null;
  const { atual, alvo } = b.progresso;
  switch (b.formato) {
    case "reais": return brlCurto(atual);
    case "porcento": return `${Math.max(0, Math.round(atual))}%`;
    case "xp": return `${Math.floor(atual)} xp`;
    default: return `${Math.floor(Math.max(0, atual))}/${alvo}`;
  }
};

/** "mais 4 dias seguidos" · "faltam R$ 920" · a descrição (sim/não e recordes). */
export const textoFalta = (b: Badge, diasDeSequencia = 0): string => {
  const desc = b.description.charAt(0).toLowerCase() + b.description.slice(1);
  if (!b.progresso) return desc;
  const { atual, alvo } = b.progresso;
  if (b.category === "sequencia") {
    const n = Math.max(1, alvo - Math.max(0, diasDeSequencia));
    return `mais ${n} ${n === 1 ? "dia seguido" : "dias seguidos"} anotando`;
  }
  switch (b.formato) {
    case "reais": return `faltam ${brl(Math.max(0, alvo - atual))}`;
    case "porcento":
      return atual >= alvo
        ? "anotar pelo menos 5 gastos do mês pra taxa valer"
        : `poupança do mês em ${Math.max(0, Math.round(atual))}% — a meta é ${alvo}%`;
    case "xp": return `faltam ${Math.max(0, Math.ceil(alvo - atual))} XP`;
    default: {
      if (!b.unidade) return desc;
      const n = Math.max(1, Math.ceil(alvo - atual));
      return `mais ${n} ${n === 1 ? b.unidade[0] : b.unidade[1]}`;
    }
  }
};
