/**
 * PAGOU DE NOVO NA LOJA (06/11, relatório pix-acesso.md): 14 compradores do Pix compraram na App Store/Play na mesma
 * conta, quase todos 4 a 22 min depois. A pessoa tem o vitalício e nem sabe que está pagando em dobro.
 *
 * Chave LOJA_APOS_PIX_AVISO (ausente = off):
 *   off      nada acontece, nem consulta;
 *   chamado  abre o chamado no /admin com o texto do e-mail pronto, e não manda nada;
 *   on       abre o chamado e manda o e-mail.
 *
 * Só avisa. Nunca cancela, nunca escreve em subscriptions e não toca em nada antes do paywall. 1x por transação da loja.
 * Puro, a não ser pelo cliente passado — testado em src/test/loja-apos-pix.test.ts.
 */
import { horaBrasilia, reais } from "./landing-travas.ts";
import { COLUNAS_DECISAO, linhasProprias, temVitalicioProprio, type LinhaAssinatura } from "./linha-pix.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type ModoAviso = "off" | "chamado" | "on";
export const modoAviso = (v: string | null | undefined): ModoAviso => (v === "on" || v === "chamado" ? v : "off");

export type EventoCompraLoja = {
  type?: string; store?: string; environment?: string; period_type?: string; product_id?: string;
  id?: string; transaction_id?: string; original_transaction_id?: string;
  purchased_at_ms?: number; expiration_at_ms?: number | null; price_in_purchased_currency?: number | null; currency?: string | null;
};

const LOJAS: Record<string, "apple" | "google"> = { APP_STORE: "apple", MAC_APP_STORE: "apple", PLAY_STORE: "google" };
const TIPOS_DE_COMPRA = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);

/** Compra nova de verdade? Renovação, cancelamento e o sandbox (revisão da Apple, testes do dono) ficam de fora. */
export const ehCompraNovaDaLoja = (ev: EventoCompraLoja): boolean =>
  TIPOS_DE_COMPRA.has(String(ev.type ?? "")) && !!LOJAS[String(ev.store ?? "")] && ev.environment !== "SANDBOX";

export const chaveCompraLoja = (ev: EventoCompraLoja): string =>
  `loja-pos-pix:${ev.original_transaction_id || ev.transaction_id || ev.id || ""}`;

/** Vitalício que veio do Pix: linha própria viva com pedido ou forma de pagamento Pix. */
export function pedidoDoVitalicioPix(linhas: LinhaAssinatura[]): { tem: boolean; pedido: string | null; viaPix: boolean } {
  if (!temVitalicioProprio(linhas)) return { tem: false, pedido: null, viaPix: false };
  const vit = linhasProprias(linhas).find((l) =>
    (l.billing_period === "lifetime" || l.plan === "lifetime")
    && ["active", "past_due", "cancel_scheduled"].includes(String(l.status ?? ""))
    && (l.payment_method === "pix" || !!l.abacatepay_billing_id));
  return vit ? { tem: true, pedido: vit.abacatepay_billing_id ?? null, viaPix: vit.payment_method === "pix" } : { tem: false, pedido: null, viaPix: false };
}

const emTeste = (ev: EventoCompraLoja) => ev.period_type === "TRIAL";

export const assuntoAviso = (): string => "Você já tem o CORE pra sempre: não precisa pagar na loja";

/** O texto do e-mail, em linhas. A mesma fonte do HTML e do rascunho que vai no chamado. */
export function linhasDoAviso(ev: EventoCompraLoja, viaPix = true): string[] {
  const apple = LOJAS[String(ev.store ?? "")] === "apple";
  const abertura = [
    "Oi! Aqui é a equipe do CORE.",
    `Vimos que você comprou o CORE ${viaPix ? "pelo Pix" : "pelo site"}, com acesso pra sempre, e depois fez uma compra na mesma conta pela ` + (apple ? "App Store" : "Google Play") + ".",
    "Você não precisa dessa segunda compra. Seu acesso pra sempre continua valendo, com ou sem ela.",
  ];
  if (emTeste(ev)) {
    return [
      ...abertura,
      "Ela ainda está no teste grátis, então dá pra sair sem pagar nada:",
      ...(apple
        ? ["1. Abra os Ajustes do iPhone e toque no seu nome.", "2. Toque em Assinaturas e depois em CORE.", "3. Toque em Cancelar teste."]
        : ["1. Abra o Google Play e toque na sua foto.", "2. Toque em Pagamentos e assinaturas e depois em Assinaturas.", "3. Escolha o CORE e toque em Cancelar assinatura."]),
      "Faça isso o quanto antes pra não haver cobrança. Seu acesso não muda.",
      "Qualquer dúvida, é só responder este e-mail.",
    ];
  }
  return [
    ...abertura,
    "Como pedir o dinheiro de volta:",
    ...(apple
      ? ["1. Entre em reportaproblem.apple.com com o seu ID Apple.", "2. Escolha Solicitar reembolso e informe o motivo.", "3. Selecione a compra do CORE e envie.", "4. Se for assinatura, cancele também em Ajustes, no seu nome, em Assinaturas, pra não renovar.", "Quem decide o reembolso é a Apple, e a resposta costuma levar alguns dias."]
      : ["1. Abra play.google.com/store/account/orderhistory com a sua conta Google.", "2. Ache a compra do CORE e toque em Solicitar reembolso.", "3. Se for assinatura, cancele também em Pagamentos e assinaturas, no Google Play, pra não renovar.", "Quem decide o reembolso é o Google."]),
    "Seu acesso não muda em nada. Qualquer dúvida, é só responder este e-mail.",
  ];
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function htmlAviso(ev: EventoCompraLoja, viaPix = true): string {
  const ps = linhasDoAviso(ev, viaPix).map((l) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px;">${escapar(l)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#211d18;"><table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;"><tr><td style="padding:28px;">${ps}</td></tr></table></body></html>`;
}

export type ResultadoAviso = { r: "fora" | "sem_pix" | "ja_avisado" | "chamado" | "erro"; email?: boolean };

export async function avisarCompraLojaSobrePix(admin: ClienteMin, a: {
  ev: EventoCompraLoja; userId: string; email: string | null; modo: ModoAviso;
  enviar: (para: string, assunto: string, html: string) => Promise<boolean>;
  agora?: Date;
}): Promise<ResultadoAviso> {
  const { ev } = a;
  if (a.modo === "off" || !ehCompraNovaDaLoja(ev)) return { r: "fora" };
  const chave = chaveCompraLoja(ev);
  if (chave === chaveCompraLoja({})) return { r: "fora" };

  const { data, error: erroLeitura } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", a.userId);
  if (erroLeitura) return { r: "erro" };
  const pix = pedidoDoVitalicioPix((data ?? []) as LinhaAssinatura[]);
  if (!pix.tem) return { r: "sem_pix" };

  const { error: dup } = await admin.from("webhook_events").insert({ id: chave, source: "loja_pos_pix", event: String(ev.type) });
  if (dup) return { r: (dup as { code?: string }).code === "23505" ? "ja_avisado" : "erro" };

  let enviado = false;
  if (a.modo === "on" && a.email) enviado = await a.enviar(a.email, assuntoAviso(), htmlAviso(ev, pix.viaPix)).catch(() => false);

  const apple = LOJAS[String(ev.store ?? "")] === "apple";
  const valor = typeof ev.price_in_purchased_currency === "number" && ev.price_in_purchased_currency > 0 && ev.currency === "BRL" ? reais(Math.round(ev.price_in_purchased_currency * 100)) : null;
  const message = [
    `Pagou de novo na loja · ${apple ? "App Store" : "Google Play"} · ${emTeste(ev) ? "teste grátis" : "compra"}${valor ? ` · ${valor}` : ""} · ${horaBrasilia(ev.purchased_at_ms ? new Date(ev.purchased_at_ms) : a.agora ?? new Date())}`,
    `A conta já tem o vitalício ${pix.viaPix ? "do Pix" : "do site"}. Nada foi cancelado: quem cancela ou pede o reembolso é a pessoa, na loja.`,
    pix.pedido ? `Pedido ${pix.viaPix ? "do Pix" : "do site"}: ${pix.pedido}` : null,
    `Produto: ${String(ev.product_id ?? "?").slice(0, 60)}`,
    enviado ? "E-mail com o passo a passo enviado." : !a.email ? "Conta sem e-mail: não dá pra avisar por e-mail." : a.modo === "on" ? "O e-mail falhou. Rascunho abaixo." : "E-mail NÃO enviado (chave em modo chamado). Rascunho abaixo.",
    ...(enviado ? [] : ["", `Assunto: ${assuntoAviso()}`, ...linhasDoAviso(ev, pix.viaPix)]),
  ].filter((l) => l !== null).join("\n");

  const { error } = await admin.from("support_tickets").insert({ user_id: a.userId, source: "loja_pos_pix", status: "open", message });
  if (error) {
    // sem chamado e sem e-mail, o RevenueCat pode tentar de novo; com e-mail enviado, a trava fica (não manda 2 e-mails)
    if (!enviado) await admin.from("webhook_events").delete().eq("id", chave);
    return { r: "erro", email: enviado };
  }
  return { r: "chamado", email: enviado };
}
