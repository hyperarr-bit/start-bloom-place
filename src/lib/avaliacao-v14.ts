/**
 * AVALIAÇÕES NA 1.0.14 (10/10) — a chave do que é VISÍVEL pro cliente.
 *
 * Medido: o iPhone pediu avaliação 0× em 2 semanas; o Android, ~570×. As
 * travas do iPhone (só pagante, 2+ dias, só nos momentos do Android) estão
 * certas — o que falta é MOMENTO: os de uso (conta paga, sequência…) quase não
 * acontecem nos 3 dias do teste. A missão em doses acontece: é onde a pessoa
 * nova volta no dia 2 e termina algo. Os motivos novos (`missao_dose_concluida`,
 * `missao_completa`, `plano_amanha_definido`) e o botão "Avaliar o CORE" no
 * menu nascem atrás desta chave, DESLIGADA (rollback = "off").
 *
 * O que NÃO depende da chave (protege, não muda nada visível): as travas novas
 * de momento ruim — aviso de cobrança / cancelamento / presente de 69,90 nas
 * últimas 24 h, ou erro na sessão (lib/momento-ruim).
 *
 * QA: `?avaliacao-v14=on` liga só neste aparelho (`off` força, `auto` desfaz).
 */
export type ModoAvaliacaoV14 = "off" | "on";
/** A chave da versão. ROLLBACK = "off". */
export const AVALIACAO_V14: ModoAvaliacaoV14 = "off";

export const CHAVE_FORCA_AVALIACAO_V14 = "avaliacao-v14-force";
export const PARAM_QA_AVALIACAO_V14 = "avaliacao-v14";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export function guardarForcaDaAvaliacaoV14(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_QA_AVALIACAO_V14);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_AVALIACAO_V14, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_AVALIACAO_V14);
}

export const avaliacaoV14Ligada = (): boolean => {
  const f = ls.get(CHAVE_FORCA_AVALIACAO_V14);
  if (f === "on" || f === "off") return f === "on";
  return (AVALIACAO_V14 as ModoAvaliacaoV14) === "on";
};
