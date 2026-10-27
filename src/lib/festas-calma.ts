import { fluxoEnxutoLigado } from "@/lib/fluxo-enxuto";
import { localDayKey } from "@/lib/utils";

/**
 * CONQUISTAS COM CALMA NOS PRIMEIROS DIAS (1.0.21, FLUXO ENXUTO — dono 27/10: "Conquistas deixa mas tenta não deixar
 * chato aparecer toda hora, porque nos primeiros dias elas podem fazer muitas coisas que dão conquista fácil").
 *
 * O visual das festas (Conquistas 2 / Codex: CelebracaoFigurinha, o toast `.cf-chegada`, os marcos) NÃO muda — só
 * QUANDO e QUANTAS aparecem. A regra, só com o enxuto ligado e só nos 3 primeiros dias da conta (created_at < 72 h):
 *   · no máximo 1 festa por ABERTURA do app e 2 por DIA (o dia local);
 *   · "festa" = um aviso da fila dos Momentos (a 1ª figurinha com envelope, uma figurinha rara em cartão/tela cheia,
 *     ou UM toast que já junta as comuns: "3 figurinhas novas");
 *   · o que passa do limite entra em SILÊNCIO: vira "visto" (nunca mais vira festa) e fica no álbum esperando ser
 *     colado, como as figurinhas que já chegavam em silêncio (as "novas" do álbum mostram);
 *   · as regras de sempre continuam por cima: nunca por cima de uma camada (cadastro, TelaParabens, folha, diálogo,
 *     dose da missão — `outraTelaAberta`), a festa durante a missão espera ela sair, e reabrir o app não repete festa
 *     (`core-festas-mostradas`);
 *   · marcos da sequência (7/30/100) e capas não contam nem são cortados (não existem nos 3 primeiros dias).
 * A contagem do dia fica no aparelho (`core-festas-calma` = { dia, n }), a da abertura em memória.
 */
export const HORAS_DE_CALMA = 72;
export const MAX_FESTAS_POR_ABERTURA = 1;
export const MAX_FESTAS_POR_DIA = 2;
export const CHAVE_FESTAS_CALMA = "core-festas-calma";

/** As chaves dos avisos que já apareceram NESTA abertura (o que está na tela continua na fila). */
const nestaAbertura = new Set<string>();
/** Só testes: simula fechar e abrir o app. */
export const _novaAberturaFestas = (): void => { nestaAbertura.clear(); };

const lerDia = (hoje: string): number => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_FESTAS_CALMA) || "null") as { dia?: unknown; n?: unknown } | null;
    return v && v.dia === hoje && typeof v.n === "number" && Number.isFinite(v.n) ? v.n : 0;
  } catch { return 0; }
};

/** A calma vale pra esta conta? (enxuto ligado + conta com menos de 72 h; sem data de criação = não) */
export function calmaDasFestasVale(criadoEm: string | null | undefined, agora: number = Date.now()): boolean {
  if (!criadoEm || !fluxoEnxutoLigado()) return false;
  const t = new Date(criadoEm).getTime();
  return Number.isFinite(t) && agora - t < HORAS_DE_CALMA * 3600e3 && agora - t > -HORAS_DE_CALMA * 3600e3;
}

/**
 * Decisão pura sobre a fila: o que já apareceu nesta abertura fica; o resto, só até o orçamento (abertura e dia);
 * o que sobra sai da fila e devolve os ids a silenciar. `contaNoLimite(item)` = false deixa passar sem contar.
 */
export function aplicarCalma<T>(
  fila: T[],
  chaveDe: (item: T) => string,
  idsDe: (item: T) => string[],
  contaNoLimite: (item: T) => boolean,
  hoje: string = localDayKey(),
): { fila: T[]; silenciar: string[] } {
  const usadasNaAbertura = nestaAbertura.size;
  let orcamento = Math.max(0, Math.min(MAX_FESTAS_POR_ABERTURA - usadasNaAbertura, MAX_FESTAS_POR_DIA - lerDia(hoje)));
  const out: T[] = [];
  const silenciar: string[] = [];
  for (const item of fila) {
    if (!contaNoLimite(item) || nestaAbertura.has(chaveDe(item))) { out.push(item); continue; }
    if (orcamento > 0) { orcamento -= 1; out.push(item); continue; }
    silenciar.push(...idsDe(item));
  }
  return { fila: out, silenciar };
}

/** O aviso APARECEU (1x por chave por abertura): conta na abertura e no dia. */
export function registrarFestaNaCalma(chave: string, hoje: string = localDayKey()): void {
  if (nestaAbertura.has(chave)) return;
  nestaAbertura.add(chave);
  try { localStorage.setItem(CHAVE_FESTAS_CALMA, JSON.stringify({ dia: hoje, n: lerDia(hoje) + 1 })); } catch { /* storage bloqueado */ }
}
