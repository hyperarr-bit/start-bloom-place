/**
 * UPSELL DE PRESENTE (21/10) — "Dê o CORE vitalício pra quem você ama por R$ 14,90".
 *
 * Quem acabou de pagar o vitalício (R$ 27,90) no /inicio ou no /hoje vê a oferta; paga um Pix de R$ 14,90 (oferta
 * `pv149`, Asaas) que NÃO credita a conta de quem pagou: o pagamento confirmado vira um CÓDIGO de presente (tabela
 * `presentes`, 1 por pedido) e um link /presente/<código> pra mandar no WhatsApp. Quem abre o link cria a conta e a
 * função `presente-resgatar` dá o vitalício a ELA (linha própria em subscriptions, payment_method "presente",
 * abacatepay_billing_id = o pedido do presente, amount_cents 1490 — a receita do pedido aparece na linha de quem
 * ganhou, como no "vida a dois" hc199).
 *
 * Regras do código: usado 1 vez; quem já tem o CORE pra sempre vê uma mensagem gentil e o código continua valendo;
 * o próprio comprador (a mesma conta, ou a conta pra onde a compra foi levada) não resgata.
 *
 * Os 3 caminhos que confirmam Pix da Asaas (asaas-pix `check`, asaas-webhook, pix-reconcile) chamam
 * `garantirPresente` (idempotente por pedido) + mandam o Purchase 14,90 pra Meta 1x por pedido (`chaveCapiPresente`)
 * + o e-mail com o link 1x por pedido (`chaveEmailPresente`) quando a conta já tem e-mail.
 *
 * Sem Deno: o cliente do banco é uma interface mínima (o mesmo jeito do grant-pix.ts) — testado no vitest com um
 * banco falso (src/test/presente-servidor.test.ts).
 */
import { creditarPedido } from "./grant-pix.ts";
import { temKit } from "./ofertas-hoje.ts";

export const OFERTA_PRESENTE = "pv149";
export const PRECO_PRESENTE_CENTAVOS = 1490;
/** Espalhado no PRECOS_CENTAVOS das 3 funções (como o PRECOS_HOJE). NUNCA entra no CONCESSAO: não credita quem pagou. */
export const PRECOS_PRESENTE: Record<string, number> = { [OFERTA_PRESENTE]: PRECO_PRESENTE_CENTAVOS };
export const DESCRICAO_PRESENTE: Record<string, string> = { [OFERTA_PRESENTE]: "CORE de presente" };
export const ehOfertaPresente = (o: string | null | undefined): boolean => o === OFERTA_PRESENTE;

/** Travas em webhook_events (chave primária = só um caminho manda). */
export const chaveCapiPresente = (orderId: string): string => `presente-capi:${orderId}`;
export const chaveEmailPresente = (orderId: string): string => `presente-email:${orderId}`;
/** A trava do crédito de quem ganhou (creditarPedido usa `grant:<gateway>:<pedido>`). */
export const GATEWAY_PRESENTE = "asaas-presente";

export const SITE_PRESENTE = "https://www.coreaplicativo.com.br";
export const linkDoPresente = (codigo: string): string => `${SITE_PRESENTE}/presente/${codigo}`;

/* ───────────────────────── o DOWNSELL do "Agora não": plano de 30 dias (R$ 9,90) ───────────────────────── */
/*
 * Quem recusa o presente vê "Seu plano de 30 dias pra organizar a vida" — o MESMO conteúdo do Kit Primeiro Mês (o
 * PLANO_30_DIAS de Finanças, a planilha de dívidas e os 4 desafios; aba "KIT 30 DIAS" em Finanças). Só pra área
 * Dinheiro por enquanto (as outras áreas esperam o dono aprovar o conteúdo). Oferta `pk99` = 990, NÃO é assinatura:
 * o pagamento confirmado grava a chave da conta `core-kit-primeiro-mes` em user_data na conta de QUEM PAGOU (a mesma
 * chave que o order bump h279k/h149k gravava pela página) + Purchase 9,90 1x por pedido.
 */
export const OFERTA_PLANO30 = "pk99";
export const PRECO_PLANO30_CENTAVOS = 990;
export const PRECOS_PLANO30: Record<string, number> = { [OFERTA_PLANO30]: PRECO_PLANO30_CENTAVOS };
export const DESCRICAO_PLANO30: Record<string, string> = { [OFERTA_PLANO30]: "CORE plano 30 dias" };
export const ehOfertaPlano30 = (o: string | null | undefined): boolean => o === OFERTA_PLANO30;
export const chaveCapiPlano30 = (orderId: string): string => `plano30-capi:${orderId}`;
/** A chave que o app lê pra liberar o kit (src/lib/kit-primeiro-mes.ts CHAVE_KIT). */
export const CHAVE_KIT_CONTA = "core-kit-primeiro-mes";
/** 21/10 (tarde): o plano é da ÁREA do quiz (src/lib/plano-30-areas.ts AREAS_DO_PLANO). Sem área válida = Dinheiro. */
export const AREAS_PLANO30 = ["dinheiro", "rotina", "corpo", "saude", "metas", "tudo"] as const;
export const areaPlano30 = (v: unknown): string | null => (typeof v === "string" && (AREAS_PLANO30 as readonly string[]).includes(v) ? v : null);

/**
 * Libera o plano de 30 dias na conta de quem pagou. Idempotente: conta que já tem o kit fica como está (o "dia 1" do
 * plano é o da 1ª compra). Nunca lança.
 */
export async function liberarPlano30(admin: ClienteMin, a: { userId: string; orderId: string; agora?: Date; area?: unknown; origem?: string }): Promise<"liberado" | "ja_tinha" | "falhou"> {
  try {
    const { data } = await admin.from("user_data").select("value").eq("user_id", a.userId).eq("key", CHAVE_KIT_CONTA).maybeSingle();
    if ((data as { value?: { comprado?: unknown } } | null)?.value?.comprado === true) return "ja_tinha";
    const { error } = await admin.from("user_data").upsert(
      { user_id: a.userId, key: CHAVE_KIT_CONTA, value: { comprado: true, em: (a.agora ?? new Date()).toISOString(), pedido: a.orderId, origem: a.origem ?? "downsell_presente", ...(areaPlano30(a.area) ? { area: areaPlano30(a.area) } : {}) } },
      { onConflict: "user_id,key" },
    );
    return error ? "falhou" : "liberado";
  } catch { return "falhou"; }
}

/**
 * 21/10 (segurança): o KIT do order bump (h279k/h149k) também nasce no SERVIDOR. Antes a página gravava
 * `core-kit-primeiro-mes` pelo próprio cliente (pages/hoje/conta gravarKit) — e qualquer conta conseguia gravar a mesma
 * chave sem pagar. Agora a migração 20261022130000 tira do cliente a escrita dessa chave e os 3 caminhos que creditam
 * Pix da Asaas chamam isto depois do crédito do plano (idempotente; a área do bump é Dinheiro). Conta anônima que
 * entra numa conta existente: o pix-vincular/destino-hoje copiam o user_data no servidor. Oferta sem kit → "sem_kit".
 */
export async function liberarKitDoBump(admin: ClienteMin, a: { userId: string; orderId: string; offer: string; agora?: Date }): Promise<"liberado" | "ja_tinha" | "falhou" | "sem_kit"> {
  if (!temKit(a.offer)) return "sem_kit";
  return liberarPlano30(admin, { userId: a.userId, orderId: a.orderId, agora: a.agora, area: "dinheiro", origem: "bump" });
}

/* ───────────────────────── o código ───────────────────────── */

/** Sem I, L, O, 0 e 1 (ninguém confunde ao ditar ou digitar). 31^8 ≈ 8,5 × 10^11 códigos. */
export const ALFABETO_PRESENTE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 8;
const RE_CODIGO = new RegExp(`^[${ALFABETO_PRESENTE}]{${TAMANHO_CODIGO}}$`);
export const codigoValido = (c: string | null | undefined): boolean => !!c && RE_CODIGO.test(c);
export const normalizarCodigo = (v: unknown): string => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TAMANHO_CODIGO);

const bytesSeguros = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
};
/** Código aleatório (rejeição: sem viés de módulo). */
export function gerarCodigo(aleatorio: (n: number) => Uint8Array = bytesSeguros): string {
  const limite = 256 - (256 % ALFABETO_PRESENTE.length);
  let out = "";
  while (out.length < TAMANHO_CODIGO) {
    for (const b of aleatorio(TAMANHO_CODIGO * 2)) {
      if (b >= limite) continue;
      out += ALFABETO_PRESENTE[b % ALFABETO_PRESENTE.length];
      if (out.length === TAMANHO_CODIGO) break;
    }
  }
  return out;
}

/** O nome que vai no cartão ("Ana te deu o CORE…"): limpo, até 40 letras, sem tag. Vazio → null. */
export function nomeNoCartao(v: unknown): string | null {
  const s = String(v ?? "").replace(/[<>{}\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return s ? s : null;
}

/* ───────────────────────── o banco ───────────────────────── */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type Presente = {
  codigo: string;
  comprador_id: string;
  pedido: string;
  valor_centavos: number;
  de_nome: string | null;
  criado_em?: string | null;
  resgatado_por: string | null;
  resgatado_em: string | null;
  email_enviado_em?: string | null;
};
export const COLUNAS_PRESENTE = "codigo, comprador_id, pedido, valor_centavos, de_nome, criado_em, resgatado_por, resgatado_em, email_enviado_em";

export async function presentePorPedido(admin: ClienteMin, pedido: string): Promise<Presente | null> {
  const { data } = await admin.from("presentes").select(COLUNAS_PRESENTE).eq("pedido", pedido).maybeSingle();
  return (data as Presente | null) ?? null;
}
export async function presentePorCodigo(admin: ClienteMin, codigo: string): Promise<Presente | null> {
  if (!codigoValido(codigo)) return null;
  const { data } = await admin.from("presentes").select(COLUNAS_PRESENTE).eq("codigo", codigo).maybeSingle();
  return (data as Presente | null) ?? null;
}

/**
 * O pedido pago vira UM presente (idempotente: o check, o webhook e o reconcile podem chegar juntos).
 * `pedido` é UNIQUE na tabela: quem perde a corrida relê e devolve o código de quem ganhou. Colisão de código
 * (improvável) → outro código. Erro desconhecido → null (o próximo caminho tenta de novo).
 */
export async function garantirPresente(admin: ClienteMin, args: {
  orderId: string; compradorId: string; valorCentavos?: number; gerar?: () => string;
}): Promise<{ codigo: string; novo: boolean } | null> {
  const ja = await presentePorPedido(admin, args.orderId);
  if (ja) return { codigo: ja.codigo, novo: false };
  const gerar = args.gerar ?? (() => gerarCodigo());
  for (let i = 0; i < 5; i++) {
    const codigo = gerar();
    const { error } = await admin.from("presentes").insert({
      codigo, comprador_id: args.compradorId, pedido: args.orderId, valor_centavos: args.valorCentavos ?? PRECO_PRESENTE_CENTAVOS,
    });
    if (!error) return { codigo, novo: true };
    if ((error as { code?: string }).code !== "23505") return null;
    const outro = await presentePorPedido(admin, args.orderId);
    if (outro) return { codigo: outro.codigo, novo: false };
  }
  return null;
}

/** Reserva única (webhook_events) — true = este caminho manda. */
export async function reservar(admin: ClienteMin, id: string, evento: string): Promise<boolean> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id, source: "presente", event: evento });
    return !error;
  } catch { return false; }
}
export async function soltar(admin: ClienteMin, id: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", id); } catch { /* noop */ }
}

/* ───────────────────────── o resgate ───────────────────────── */

export type LinhaMin = { status?: string | null; plan?: string | null; billing_period?: string | null; current_period_end?: string | null; abacatepay_billing_id?: string | null };
const VIVA = new Set(["active", "past_due", "cancel_scheduled"]);
/** Já tem o CORE PRA SEMPRE (qualquer linha viva vitalícia: Pix, presente ou loja)? */
export const temPraSempre = (linhas: LinhaMin[]): boolean =>
  linhas.some((l) => VIVA.has(String(l.status ?? "")) && (l.billing_period === "lifetime" || l.plan === "lifetime"));

export type DecisaoResgate = "ok" | "nao_existe" | "usado" | "ja_e_seu" | "proprio" | "sem_email" | "ja_tem";

/** Puro: pode resgatar? A ordem importa (quem já resgatou vê o sucesso de novo, não "usado"). */
export function decidirResgate(a: {
  presente: Pick<Presente, "resgatado_por"> | null; userId: string; userEmail: string | null; doComprador: boolean; linhas: LinhaMin[];
}): DecisaoResgate {
  if (!a.presente) return "nao_existe";
  if (a.presente.resgatado_por === a.userId) return "ja_e_seu";
  if (a.presente.resgatado_por) return "usado";
  if (a.doComprador) return "proprio";
  if (!a.userEmail) return "sem_email";
  if (temPraSempre(a.linhas)) return "ja_tem";
  return "ok";
}

/**
 * Esta conta é do COMPRADOR? A mesma conta; ou o mesmo e-mail; ou a compra do comprador foi levada pra esta conta
 * (pix-vincular / e-mail de destino do /hoje: a linha de um pedido do comprador está aqui).
 */
export async function contaDoComprador(admin: ClienteMin, a: {
  compradorId: string; compradorEmail: string | null; userId: string; userEmail: string | null; linhasDoUsuario: LinhaMin[];
}): Promise<boolean> {
  if (a.userId === a.compradorId) return true;
  if (a.compradorEmail && a.userEmail && a.compradorEmail.trim().toLowerCase() === a.userEmail.trim().toLowerCase()) return true;
  const pedidosDaConta = new Set(a.linhasDoUsuario.map((l) => l.abacatepay_billing_id).filter(Boolean) as string[]);
  if (!pedidosDaConta.size) return false;
  try {
    const { data } = await admin.from("analytics_events").select("event_data")
      .eq("event_name", "pix_order_created").eq("user_id", a.compradorId).limit(50);
    return ((data ?? []) as Array<{ event_data?: { order_id?: string } }>).some((r) => !!r.event_data?.order_id && pedidosDaConta.has(r.event_data.order_id));
  } catch { return false; }
}

export type ResultadoResgate = { r: "ok"; fim: string } | { r: "usado" } | { r: "erro"; msg: string };

/**
 * Dá o vitalício a quem ganhou: 1º marca o código como de quem ganhou (update condicional `resgatado_por is null` — só um
 * resgate ganha a corrida), depois a linha própria pelo creditarPedido (trava + "1 pedido = 1 crédito"). Deu erro
 * no crédito → desfaz a marca (o código volta a valer).
 */
export async function resgatarPresente(admin: ClienteMin, a: {
  presente: Presente; userId: string; userEmail: string; agora?: Date;
}): Promise<ResultadoResgate> {
  const agora = a.agora ?? new Date();
  const { data: marcado, error: errMarca } = await admin.from("presentes")
    .update({ resgatado_por: a.userId, resgatado_em: agora.toISOString() })
    .eq("codigo", a.presente.codigo).is("resgatado_por", null).select("codigo");
  if (errMarca) return { r: "erro", msg: String((errMarca as { message?: string }).message ?? errMarca).slice(0, 160) };
  if (!Array.isArray(marcado) || !marcado.length) return { r: "usado" };
  const desfazer = async () => {
    try { await admin.from("presentes").update({ resgatado_por: null, resgatado_em: null }).eq("codigo", a.presente.codigo).eq("resgatado_por", a.userId); } catch { /* noop */ }
  };
  const g = await creditarPedido(admin, {
    userId: a.userId, orderId: a.presente.pedido, gateway: GATEWAY_PRESENTE, concessao: { dias: null }, agora, linhaNova: true,
    montarPayload: (fim) => ({
      user_id: a.userId, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "presente", abacatepay_billing_id: a.presente.pedido, customer_email: a.userEmail,
      current_period_start: agora.toISOString(), current_period_end: fim, amount_cents: a.presente.valor_centavos || PRECO_PRESENTE_CENTAVOS,
    }),
  });
  if (g.r === "creditado") return { r: "ok", fim: g.fim };
  if (g.r === "ja_creditado") {
    // só vale se a linha do presente está NESTA conta (o creditarPedido também diz "ja_creditado" quando está em outra)
    const { data: minha } = await admin.from("subscriptions").select("id, current_period_end").eq("user_id", a.userId).eq("abacatepay_billing_id", a.presente.pedido);
    const linha = Array.isArray(minha) ? minha[0] as { current_period_end?: string } | undefined : undefined;
    if (linha) return { r: "ok", fim: String(linha.current_period_end ?? "") };
  }
  await desfazer();
  return { r: "erro", msg: g.r === "erro" ? g.msg : g.r };
}

/* ───────────────────────── os e-mails (Equipe CORE, resposta pra contato@) ───────────────────────── */

export const REPLY_TO_PRESENTE = "contato@coreaplicativo.com.br";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const moldura = (miolo: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f2f7;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:22px;padding:26px 22px;border:1px solid #ebe6ef;">
${miolo}
    <p style="font-size:14px;line-height:1.5;margin:20px 0 0;color:#5b5560;">Um abraço,<br>Equipe CORE</p>
  </div>
</div></body></html>`;

/** Pra quem COMPROU: o link do presente (se perder a tela, o link está aqui). */
export const assuntoPresenteComprador = (): string => "Seu presente do CORE está pronto 🎁";
export function htmlPresenteComprador(a: { codigo: string; deNome?: string | null }): string {
  const link = linkDoPresente(a.codigo);
  const msg = `${a.deNome ? `${a.deNome} te deu` : "Ganhei pra você"} o CORE pra sempre 💛 Abre aqui: ${link}`;
  const zap = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  return moldura(`    <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#d6338a;text-transform:uppercase;">Presente pago</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">Agora é só mandar o link 💌</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#5b5560;">Quem abrir cria a conta e ganha o CORE pra sempre. O link vale pra 1 pessoa.</p>
    <div style="background:#fdf2f8;border-radius:16px;padding:14px 16px;text-align:center;font-size:14px;font-weight:700;word-break:break-all;"><a href="${link}" style="color:#16121c;">${esc(link.replace("https://www.", ""))}</a></div>
    <a href="${zap}" style="display:block;margin-top:16px;background:#1faa59;color:#fff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 24px;border-radius:999px;text-align:center;">Enviar no WhatsApp</a>`);
}

/** Pra quem GANHOU (depois do resgate): o acesso + como entrar no app (sem senha: código no e-mail). */
export const assuntoPresenteRecebido = (): string => "Você ganhou o CORE pra sempre 💛";
export function htmlPresenteRecebido(a: { email: string; deNome?: string | null }): string {
  const e = esc(a.email);
  const de = a.deNome ? esc(a.deNome) : null;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 12px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d6338a;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 12px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  return moldura(`    <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#d6338a;text-transform:uppercase;">Presente</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">${de ? `${de} te deu` : "Você ganhou"} o CORE pra sempre 💛</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 6px;color:#5b5560;">Seu acesso é <b style="color:#16121c;">pra sempre</b>. Nada é cobrado de você.</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#5b5560;">Sua conta: <b style="color:#16121c;">${e}</b></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;"><tr>
      <td style="padding:0 8px 0 0;"><a href="https://apps.apple.com/br/app/id6806913181" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#63743; App Store</a></td>
      <td><a href="https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Demail%26utm_campaign%3Dweb_presente_email" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#9654; Google Play</a></td>
    </tr></table>
    <p style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:16px 0 10px;">Como entrar no app</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${passo(1, "Abra o CORE e toque em <b>“Entrar”</b> (não em “Começar”).")}
      ${passo(2, `Digite <b>${e}</b> e toque em <b>“Entrar sem senha — receber código por e-mail”</b>.`)}
    </table>
    <p style="font-size:12.5px;color:#8a838f;line-height:1.5;margin:10px 0 0;">No computador, é o mesmo CORE em coreaplicativo.com.br.</p>`);
}

/**
 * O link por e-mail pra quem comprou — 1x por pedido (reserva em webhook_events; falhou → solta pro próximo caminho).
 * `enviar` recebe o corpo pronto do Resend e devolve true se saiu.
 */
export async function mandarLinkPorEmail(admin: ClienteMin, a: {
  orderId: string; codigo: string; para: string | null; deNome?: string | null; de: string; enviar: (corpo: Record<string, unknown>) => Promise<boolean>;
}): Promise<"enviado" | "ja" | "sem_email" | "falhou"> {
  if (!a.para) return "sem_email";
  if (!(await reservar(admin, chaveEmailPresente(a.orderId), "email"))) return "ja";
  const ok = await a.enviar(corpoResend(a.de, a.para, assuntoPresenteComprador(), htmlPresenteComprador({ codigo: a.codigo, deNome: a.deNome ?? null }))).catch(() => false);
  if (!ok) { await soltar(admin, chaveEmailPresente(a.orderId)); return "falhou"; }
  try { await admin.from("presentes").update({ email_enviado_em: new Date().toISOString() }).eq("pedido", a.orderId); } catch { /* noop */ }
  return "enviado";
}

/** O corpo do Resend (o mesmo remetente das boas-vindas + reply_to contato@). */
export const corpoResend = (de: string, para: string, assunto: string, html: string): Record<string, unknown> =>
  ({ from: de, to: [para], reply_to: REPLY_TO_PRESENTE, subject: assunto, html });
