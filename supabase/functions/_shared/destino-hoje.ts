/**
 * O E-MAIL OPCIONAL DA TELA DO PIX DO /hoje (18/10) — a rede de quem paga e fecha a aba antes do pós-compra.
 *
 * Na tela do Pix existe um campo discreto "Quer receber o acesso por e-mail? (opcional)". A página tenta primeiro pôr
 * o e-mail NA PRÓPRIA conta anônima (updateUser; autoconfirm) — aí a compra já é daquela conta e as boas-vindas saem
 * pelo caminho normal. Quando o e-mail JÁ TEM conta, isso não dá: a página chama `email_pedido` (asaas-pix) e o
 * endereço fica guardado como DESTINO da sessão anônima em webhook_events (`hoje-destino:<uid anônimo>`, coluna
 * `event`; tabela só do service_role — nada de e-mail em analytics_events).
 *
 * Quando um pedido do /hoje é creditado (check da página, asaas-webhook ou pix-reconcile) — ou quando o destino é
 * salvo DEPOIS de já ter sido creditado — `encaminharParaDestino`:
 *   1. lê o destino; sem destino, ou a anônima já tem e-mail próprio → nada (caminho normal);
 *   2. acha a conta do e-mail (nunca cria 2ª conta; sem conta, nada — a página teria posto o e-mail na anônima);
 *   3. MOVE todas as linhas de Pix ativas da anônima pra essa conta (a anônima é descartável: só tem esta compra);
 *   4. manda as boas-vindas do /hoje pro e-mail (1x por pedido do plano, a mesma reserva das boas-vindas), com as
 *      lojas e "entre com este e-mail → Entrar sem senha (código)".
 * Dar acesso a um e-mail que não é seu não tira nada de ninguém (é presente), então o e-mail não precisa de prova
 * aqui; a pessoa que pagou continua podendo entrar nessa conta só com o código do e-mail.
 *
 * Testado no vitest com um banco falso (src/test/funil-hoje-servidor.test.ts).
 */
import { reservarBoasVindas, soltarBoasVindas } from "./boas-vindas-hoje.ts";
import { assuntoVenda, htmlVenda, periodoDoEmailVenda } from "./email-venda.ts";
import { ehPlanoHoje } from "./ofertas-hoje.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; auth: { admin: { getUserById: (id: string) => Promise<any>; listUsers: (o: { page: number; perPage: number }) => Promise<any> } } };

export const chaveDestino = (uidAnonimo: string): string => `hoje-destino:${uidAnonimo}`;
export const EMAIL_DESTINO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Guarda (ou troca) o e-mail de destino da sessão anônima. */
export async function salvarDestino(admin: Admin, uidAnonimo: string, email: string): Promise<boolean> {
  const limpo = email.trim().toLowerCase();
  if (!uidAnonimo || !EMAIL_DESTINO_OK.test(limpo)) return false;
  const id = chaveDestino(uidAnonimo);
  const { error } = await admin.from("webhook_events").insert({ id, source: "hoje", event: limpo });
  if (!error) return true;
  const { error: e2 } = await admin.from("webhook_events").update({ event: limpo }).eq("id", id);
  return !e2;
}

export async function lerDestino(admin: Admin, uidAnonimo: string): Promise<string | null> {
  const { data } = await admin.from("webhook_events").select("id, event").eq("id", chaveDestino(uidAnonimo));
  const e = String((Array.isArray(data) ? data[0] : data)?.event ?? "").trim().toLowerCase();
  return EMAIL_DESTINO_OK.test(e) ? e : null;
}

export async function acharConta(admin: Admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const lista = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const achado = lista.find((u) => (u.email ?? "").toLowerCase() === email);
    if (achado) return achado.id;
    if (lista.length < 1000) return null;
  }
  return null;
}

export type ResultadoDestino =
  | { r: "sem_destino" } | { r: "anonima_tem_email" } | { r: "sem_conta" } | { r: "sem_linha" }
  | { r: "movido"; para: string; linhas: number; email: boolean };

/**
 * Leva a compra da sessão anônima pra conta do e-mail de destino (se houver) e manda o acesso por e-mail.
 * `pedidoPlano`/`offer`: o pedido que acabou de ser creditado (o e-mail só sai pro pedido do PLANO).
 * `enviar` é injetado (Resend no Deno; falso no teste) e devolve se o e-mail saiu.
 */
export async function encaminharParaDestino(admin: Admin, args: {
  uidAnonimo: string; orderId: string; offer: string;
  enviar: (para: string, assunto: string, html: string) => Promise<boolean>;
}): Promise<ResultadoDestino> {
  const destino = await lerDestino(admin, args.uidAnonimo);
  if (!destino) return { r: "sem_destino" };
  const { data: u } = await admin.auth.admin.getUserById(args.uidAnonimo);
  if (u?.user?.email) return { r: "anonima_tem_email" };
  const para = await acharConta(admin, destino);
  if (!para) return { r: "sem_conta" };

  const { data: linhas } = await admin.from("subscriptions")
    .select("id, status, payment_method, current_period_end, billing_period, plan, abacatepay_billing_id")
    .eq("user_id", args.uidAnonimo).eq("payment_method", "pix").eq("status", "active");
  const todas = (linhas ?? []) as Array<{ id: string; current_period_end: string | null; billing_period: string | null; plan: string | null }>;
  if (!todas.length) return { r: "sem_linha" };
  for (const l of todas) await admin.from("subscriptions").update({ user_id: para, customer_email: destino }).eq("id", l.id);
  await admin.from("analytics_events").insert({
    user_id: para, event_name: "compra_vinculada",
    event_data: { de: args.uidAnonimo, via: "hoje_email_pix", linhas: todas.length, order_id: args.orderId },
  }).then(() => {}, () => {});

  let mandou = false;
  if (ehPlanoHoje(args.offer) && await reservarBoasVindas(admin, args.orderId)) {
    const vit = todas.find((l) => l.billing_period === "lifetime" || l.plan === "lifetime");
    const maior = [...todas].sort((a, b) => Date.parse(String(b.current_period_end)) - Date.parse(String(a.current_period_end)))[0];
    const periodo = vit ? "lifetime" : periodoDoEmailVenda(args.offer)!;
    mandou = await args.enviar(destino, assuntoVenda(periodo), htmlVenda({ email: destino, periodo, fim: maior?.current_period_end ?? null, hoje: true }));
    if (!mandou) await soltarBoasVindas(admin, args.orderId);
  }
  return { r: "movido", para, linhas: todas.length, email: mandou };
}
