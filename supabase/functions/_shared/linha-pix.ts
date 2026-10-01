/**
 * EM QUAL LINHA O PIX ESCREVE (01/10/2026).
 *
 * A armadilha que este arquivo fecha: todo grant de Pix fazia
 * `select … eq(user_id).maybeSingle()` e, achando UMA linha, dava UPDATE nela.
 * Pra quem já tinha a linha da App Store/Google Play (`payment_method =
 * 'play_store'`, `revenuecat_subscription_id = subAap…`), o update virava essa
 * linha em pix/vitalício — mas o `revenuecat_subscription_id` ficava. Horas
 * depois o revenuecat-webhook/revenuecat-sync faz upsert POR ESSA CHAVE e
 * devolve a linha pra play_store/anual com o fim da carência; no fim da
 * carência vira "canceled" e quem pagou R$ 97,90 no Pix perde o acesso.
 * (E com 2+ linhas o `maybeSingle()` dá erro → existing null → INSERT, o que
 * por acaso era o certo — a regra dependia de um acidente.)
 *
 * REGRA: linha da loja é do RevenueCat — o Pix nunca a toca. O Pix escreve na
 * linha PRÓPRIA da pessoa (pix/cakto/web/codigo…) ou insere uma nova. O
 * check-subscription dá acesso pela linha de fim mais distante, então o
 * vitalício (+100 anos) vence a da loja sem precisar mexer nela.
 *
 * Função PURA, sem Deno nem Supabase: testada no vitest (src/test/linha-pix.test.ts)
 * e importada pelas edge functions (`../_shared/linha-pix.ts`).
 */

export type LinhaAssinatura = {
  id: string;
  status?: string | null;
  plan?: string | null;
  billing_period?: string | null;
  payment_method?: string | null;
  current_period_end?: string | null;
  revenuecat_subscription_id?: string | null;
};

/** O que o `select` precisa trazer pra `decidirGrantPix` decidir. */
export const COLUNAS_DECISAO =
  "id, status, plan, billing_period, payment_method, current_period_end, revenuecat_subscription_id";

/** Linha da loja = do RevenueCat. O `revenuecat_subscription_id` entra na
 *  conta porque é a chave do upsert dele: uma linha que já foi "virada" pelo
 *  bug antigo (payment_method pix, mas com subAap…) continua sendo dele. */
export const ehDaLoja = (l: LinhaAssinatura): boolean =>
  l.payment_method === "play_store" || !!l.revenuecat_subscription_id;

export const linhasProprias = (linhas: LinhaAssinatura[]): LinhaAssinatura[] =>
  linhas.filter((l) => !ehDaLoja(l));

const VIVA = new Set(["active", "past_due", "cancel_scheduled"]);
const viva = (l: LinhaAssinatura) => VIVA.has(String(l.status ?? ""));
const fimMs = (l: LinhaAssinatura) => (l.current_period_end ? new Date(l.current_period_end).getTime() : 0);
const vitalicia = (l: LinhaAssinatura) => l.billing_period === "lifetime" || l.plan === "lifetime";

/** Já tem vitalício PRÓPRIO vivo (pix/cakto/web)? Linha da loja não conta —
 *  o vitalício comprado dentro do app é do RevenueCat e não muda o que o Pix
 *  faz aqui. É o antigo `jaLiberado`: decide se CAPI/UTMify/boas-vindas
 *  disparam de novo. */
export const temVitalicioProprio = (linhas: LinhaAssinatura[]): boolean =>
  linhasProprias(linhas).some((l) => viva(l) && vitalicia(l));

/** A linha própria em que o Pix escreve: a viva de fim mais distante; senão
 *  qualquer própria (vencida/cancelada vira a nova); senão nenhuma → inserir. */
export const linhaParaEscrever = (linhas: LinhaAssinatura[]): LinhaAssinatura | null => {
  const proprias = linhasProprias(linhas);
  const vivas = proprias.filter(viva).sort((a, b) => fimMs(b) - fimMs(a));
  return vivas[0] ?? proprias[0] ?? null;
};

export type Concessao = { dias: number | null };

export type DecisaoGrant =
  | { acao: "preservar"; motivo: "vitalicio_pagou_mes"; jaLiberado: true }
  | { acao: "atualizar"; linhaId: string; jaLiberado: boolean; fim: string }
  | { acao: "inserir"; jaLiberado: false; fim: string };

/**
 * Decide o grant de um Pix pago.
 *  - vitalício próprio que pagou o MÊS: nada se toca (caso de reembolso);
 *  - vitalício: fim = agora + 100 anos;
 *  - mês pré-pago EMPILHA sobre o período próprio vigente (pagar de novo antes
 *    de vencer não encurta);
 *  - escreve na linha própria (`atualizar`) ou cria uma (`inserir`) — nunca na
 *    linha da loja.
 */
export function decidirGrantPix(
  linhas: LinhaAssinatura[],
  concessao: Concessao,
  agora: Date = new Date(),
): DecisaoGrant {
  const jaLiberado = temVitalicioProprio(linhas);
  const vitalicio = concessao.dias === null;
  if (jaLiberado && !vitalicio) return { acao: "preservar", motivo: "vitalicio_pagou_mes", jaLiberado: true };

  const fim = new Date(agora);
  if (vitalicio) fim.setFullYear(fim.getFullYear() + 100);
  else {
    const vigente = Math.max(0, ...linhasProprias(linhas).filter(viva).map(fimMs));
    fim.setTime(Math.max(vigente, agora.getTime()));
    fim.setDate(fim.getDate() + (concessao.dias ?? 30));
  }

  const alvo = linhaParaEscrever(linhas);
  if (alvo) return { acao: "atualizar", linhaId: alvo.id, jaLiberado, fim: fim.toISOString() };
  return { acao: "inserir", jaLiberado: false, fim: fim.toISOString() };
}
