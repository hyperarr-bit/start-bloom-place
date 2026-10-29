/**
 * CREDITAR UM PEDIDO PAGO — UMA VEZ (15/10, revisão da venda da web).
 *
 * Os 3 caminhos que creditam um Pix da Asaas (o `check` da página no asaas-pix, o asaas-webhook e o pix-reconcile)
 * passam por aqui. Antes cada um lia as linhas e escrevia por conta própria, e o MESMO pedido de uma oferta com prazo
 * (a97, w25) era creditado 2x: o prazo empilhava (2 anos) e saíam 2 boas-vindas/CAPI/UTMify.
 *
 *   1. lê as linhas da pessoa e decide (linha-pix.ts → decidirGrantPix, com o id do pedido):
 *        preservar   → vitalício pagou o mês: nada se toca (como sempre);
 *        ja_creditado → o pedido já está numa linha própria: nada se escreve, nada sai;
 *   2. trava de corrida (trava-grant.ts): só um caminho credita o pedido; quem chega junto relê as linhas —
 *      "ja_creditado" se a linha do pedido já está lá, "em_andamento" se não;
 *   3. escreve (update na linha própria ou insert) com o payload do caminho; erro → solta a trava.
 * Quem chama só manda e-mail/CAPI/UTMify quando volta "creditado" com jaLiberado=false.
 *
 * Sem Deno: o cliente é uma interface mínima — testado no vitest com um banco falso (src/test/pix-um-credito.test.ts),
 * inclusive dois caminhos AO MESMO TEMPO.
 */
import { COLUNAS_DECISAO, decidirGrantPix, pedidoJaCreditado, type Concessao, type LinhaAssinatura } from "./linha-pix.ts";
import { pegarTrava, soltarTrava } from "./trava-grant.ts";
import { registrarPagoEmDobro } from "./landing-travas.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type ResultadoGrant =
  | { r: "creditado"; acao: "atualizar" | "inserir"; jaLiberado: boolean; fim: string }
  | { r: "preservado"; motivo?: "vitalicio_pagou_mes" | "vitalicio_pagou_de_novo" }
  | { r: "ja_creditado" }
  | { r: "em_andamento" }
  | { r: "erro"; msg: string };

export async function creditarPedido(admin: ClienteMin, args: {
  userId: string;
  orderId: string;
  /** a chave da trava: "asaas" nos 3 caminhos da Asaas (tem que ser a MESMA nos 3) */
  gateway: string;
  concessao: Concessao;
  agora: Date;
  /** o payload da linha; recebe o fim decidido (o reconcile usa o próprio, contado da criação do QR) */
  montarPayload: (fim: string) => Record<string, unknown>;
  /** 18/10 (upsells do /hoje): o pedido ganha uma linha SÓ DELE (insere em vez de atualizar a linha própria vigente).
   *  Sem isso o upsell reescrevia a linha do plano: o valor (amount_cents) e o id do pedido do plano sumiam do banco
   *  (a receita do dia ficava menor) e um webhook atrasado do plano creditava de novo (o pedido não estava mais em
   *  linha nenhuma). O fim continua o decidido (vitalício +100 anos; prazo empilha sobre o vigente). */
  linhaNova?: boolean;
  /** 29/10 (landing): quem já tem o vitalício e paga o vitalício de novo NÃO tem a linha reescrita — o pedido vira
   *  `pix_pago_em_dobro` + chamado no /admin → Suporte (1x por pedido), pro suporte devolver. */
  protegerVitalicio?: boolean;
  /** a oferta (só pro registro do pagamento em dobro) */
  offer?: string | null;
}): Promise<ResultadoGrant> {
  const ler = async (): Promise<LinhaAssinatura[]> => {
    const { data } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", args.userId);
    return (data ?? []) as LinhaAssinatura[];
  };
  /* 18/10 (/hoje): o pedido pode já ter sido creditado e a linha MOVIDA pra outra conta (pix-vincular, ou o e-mail de
   * destino da tela do Pix — _shared/destino-hoje.ts). Sem isto, um webhook atrasado acharia a anônima vazia e
   * creditaria de novo (2 linhas do mesmo pedido = receita em dobro). */
  try {
    const { data: emOutra } = await admin.from("subscriptions").select("id, user_id").eq("abacatepay_billing_id", args.orderId);
    if (Array.isArray(emOutra) && emOutra.some((l: { user_id?: string }) => l.user_id && l.user_id !== args.userId)) return { r: "ja_creditado" };
  } catch { /* sem a consulta, segue a regra de sempre */ }
  const decisao = decidirGrantPix(await ler(), args.concessao, args.agora, args.orderId, { protegerVitalicio: args.protegerVitalicio });
  if (decisao.acao === "preservar") {
    if (decisao.motivo === "vitalicio_pagou_de_novo") {
      let amount: number | null = null;
      try { amount = Number(args.montarPayload(new Date(args.agora).toISOString()).amount_cents) || null; } catch { /* noop */ }
      await registrarPagoEmDobro(admin, { userId: args.userId, orderId: args.orderId, amountCents: amount, pedidoAnterior: decisao.pedidoAnterior ?? null, offer: args.offer ?? null, agora: args.agora }).catch(() => false);
    }
    return { r: "preservado", motivo: decisao.motivo };
  }
  if (decisao.acao === "ja_creditado") return { r: "ja_creditado" };

  const trava = await pegarTrava(admin, args.gateway, args.orderId);
  if (trava === "ocupada") return pedidoJaCreditado(await ler(), args.orderId) ? { r: "ja_creditado" } : { r: "em_andamento" };

  const payload = args.montarPayload(decisao.fim);
  const acao: "atualizar" | "inserir" = args.linhaNova ? "inserir" : decisao.acao;
  const { error } = decisao.acao === "atualizar" && acao === "atualizar"
    ? await admin.from("subscriptions").update(payload).eq("id", decisao.linhaId)
    : await admin.from("subscriptions").insert(payload);
  if (error) {
    if (trava === "pegou") await soltarTrava(admin, args.gateway, args.orderId);
    return { r: "erro", msg: String((error as { message?: string }).message ?? error).slice(0, 200) };
  }
  return { r: "creditado", acao, jaLiberado: decisao.jaLiberado, fim: decisao.fim };
}
