/**
 * HOTMART (04/11) — a venda da /vida (a LP v3 num link próprio, R$ 97,90 no checkout da Hotmart). As regras do webhook,
 * sem Deno: o cliente do banco e o resto vêm injetados (testado no vitest: src/test/hotmart-webhook.test.ts).
 *
 * Postback 2.0.0 da Hotmart (developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook — conferido 04/11):
 *   · header X-HOTMART-HOTTOK = o token da conta (o único jeito de saber que veio da Hotmart) → secret HOTMART_HOTTOK;
 *   · corpo { id (do evento), creation_date, event, version: "2.0.0", data: { product{id,name}, buyer{email,name},
 *     purchase{ transaction ("HP…"), status, price{value,currency_value}, full_price{value}, payment{type,installments_number},
 *     origin{sck,src,xcod}, approved_date }, commissions[] } };
 *   · eventos: PURCHASE_APPROVED (pago — inclusive Pix), PURCHASE_COMPLETE (fim da garantia, já pago), PURCHASE_REFUNDED,
 *     PURCHASE_CHARGEBACK, PURCHASE_CANCELED, PURCHASE_PROTEST, PURCHASE_EXPIRED, PURCHASE_DELAYED, PURCHASE_BILLET_PRINTED.
 *
 * O que acontece:
 *   pago     → acha a conta (1º a ref do sck → hotmart_order_created gravado pelo hotmart-iniciar: a conta anônima da sessão,
 *              com os dados dela; 2º o e-mail do comprador; 3º cria a conta com o e-mail, já confirmado). Conta da ref sem e-mail
 *              ganha o e-mail do comprador (se o e-mail já é de outra conta, a compra vai pra outra — e fica no log).
 *              Libera o VITALÍCIO pelo MESMO caminho do Pix da landing (_shared/grant-pix.ts: mesma linha de subscriptions,
 *              mesmas travas; payment_method "hotmart", amount_cents = o valor da Hotmart, abacatepay_billing_id = a transação).
 *              Creditou agora → e-mail da compra (email-venda), aviso de venda pro dono (avisar-venda) e Purchase na CAPI dos 2
 *              pixels (event_id = transação, fbp/fbc/IP/UA do pedido) — 1 de cada por transação (reserva em webhook_events).
 *   estorno  → REFUNDED / CHARGEBACK / CANCELED: a linha da transação vira "canceled" (sem acesso; só a linha dela).
 *   outros   → log e 200.
 * Idempotência: `hotmart:<transação>:<evento>` em webhook_events (chave primária). Erro nosso no meio solta a chave e
 * responde 500 (a Hotmart reenvia). Nada de e-mail/token no log (mascarado).
 */
import { creditarPedido } from "./grant-pix.ts";
import { assuntoVenda, htmlVenda } from "./email-venda.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
type ResultadoAuth = { data?: { user?: { id: string; email?: string | null } | null } | null; error?: { message?: string } | null };
export type AdminHotmart = ClienteMin & {
  auth: { admin: {
    getUserById: (id: string) => Promise<ResultadoAuth>;
    updateUserById: (id: string, attrs: Record<string, unknown>) => Promise<ResultadoAuth>;
    createUser: (attrs: Record<string, unknown>) => Promise<ResultadoAuth>;
  } };
};

export const EVENTOS_PAGO = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
export const EVENTOS_ESTORNO = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"]);
/** os status da compra que são dinheiro na conta (o evento já diz; o status confere) */
const STATUS_PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
/** o nome do registro do pedido (hotmart-iniciar) em analytics_events — só o servidor grava (migração 20261104120000) */
export const EVENTO_PEDIDO_HOTMART = "hotmart_order_created";
export const OFERTA_HOTMART = "HM_vida";
/** 04/11 (revisão A): o produto da /vida na Hotmart. Só ele libera — o "Enviar teste" da Hotmart (produto 0) e qualquer outro
 *  produto da conta são ignorados. O secret HOTMART_PRODUTO_ID só sobrescreve. */
export const PRODUTO_HOTMART_PADRAO = "8885020";
/** 04/11 (revisão E): abaixo disto não é a venda da /vida (R$ 97,90; cupom de até ~50% ainda passa). */
export const VALOR_MINIMO_CENTS = 5000;
const EVENTOS_ESTORNO_LISTA = ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"];
export const GATEWAY_HOTMART = "hotmart";
const SITE = "https://www.coreaplicativo.com.br";

/** Compara o hottok sem vazar tempo. Sem secret configurado = recusa sempre. */
export function hottokOk(recebido: string | null | undefined, secret: string | null | undefined): boolean {
  const a = String(recebido ?? ""), b = String(secret ?? "");
  if (!b || !a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const mascararEmail = (e: string | null | undefined): string | null => {
  const s = String(e ?? "");
  if (!s.includes("@")) return s ? "***" : null;
  const [u, dom] = s.split("@");
  return `${u.slice(0, 2)}***@${dom}`;
};

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texto = (v: unknown, n = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : typeof v === "number" ? String(v).slice(0, n) : null);
const centavos = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

export type CompraHotmart = {
  eventoId: string | null; evento: string; tx: string | null; status: string | null;
  valorCents: number | null; moeda: string | null; email: string | null; nome: string | null;
  sck: string | null; src: string | null; produtoId: string | null; pagamento: string | null; parcelas: number | null;
};

/** O corpo do Postback 2.0 → o que interessa. Nunca lança. O valor é o `price` da compra (o da oferta; o full_price tem juros). */
export function lerCompraHotmart(body: unknown): CompraHotmart {
  const b = (body ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = (b.data ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const p = (d.purchase ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const email = texto(d.buyer?.email, 254)?.toLowerCase() ?? null;
  return {
    eventoId: texto(b.id, 80),
    evento: String(b.event ?? "").toUpperCase().slice(0, 60),
    tx: texto(p.transaction, 80),
    status: texto(p.status, 40)?.toUpperCase() ?? null,
    // o price (o valor da oferta); o full_price (com juros do parcelamento) só se a Hotmart não mandar o price
    valorCents: p.price?.value !== undefined && p.price?.value !== null ? centavos(p.price.value) : centavos(p.full_price?.value),
    moeda: texto(p.price?.currency_value ?? p.full_price?.currency_value, 8)?.toUpperCase() ?? null,
    email: email && EMAIL_OK.test(email) ? email : null,
    nome: texto(d.buyer?.name, 120),
    sck: texto(p.origin?.sck, 100),
    src: texto(p.origin?.src, 100),
    produtoId: texto(d.product?.id, 40),
    pagamento: texto(p.payment?.type, 40),
    parcelas: Number.isFinite(Number(p.payment?.installments_number)) ? Number(p.payment.installments_number) : null,
  };
}

/* ───────────────────────── o registro do pedido (hotmart-iniciar) ───────────────────────── */
export type RegistroHotmart = { userId: string | null; dados: Record<string, unknown> | null; criadoEm: string | null; conflito: boolean };

/**
 * As linhas do pedido (até 10). As que têm conta precisam concordar (senão ninguém leva — mesma trava do Pix,
 * _shared/registro-pedido.ts). Os dados de atribuição (fbp/fbc/IP/UA) vêm da 1ª linha (a com conta, se houver).
 */
export function escolherRegistroHotmart(linhas: Array<{ user_id?: string | null; event_data?: Record<string, unknown> | null; created_at?: string | null }> | null | undefined): RegistroHotmart {
  const todas = (linhas ?? []).filter(Boolean);
  if (!todas.length) return { userId: null, dados: null, criadoEm: null, conflito: false };
  const comDono = todas.filter((l) => typeof l.user_id === "string" && l.user_id);
  const donos = new Set(comDono.map((l) => l.user_id));
  if (donos.size > 1) return { userId: null, dados: null, criadoEm: null, conflito: true };
  const l = comDono[0] ?? todas[0];
  return { userId: comDono[0]?.user_id ?? null, dados: l.event_data ?? null, criadoEm: l.created_at ?? null, conflito: false };
}

export async function registroHotmart(admin: ClienteMin, ref: string | null): Promise<RegistroHotmart> {
  if (!ref || !/^[A-Za-z0-9-]{8,64}$/.test(ref)) return { userId: null, dados: null, criadoEm: null, conflito: false };
  try {
    const { data } = await admin.from("analytics_events").select("user_id, event_data, created_at")
      .eq("event_name", EVENTO_PEDIDO_HOTMART).eq("event_data->>ref", ref).limit(10); // índice parcial (migração 20261104120000)
    return escolherRegistroHotmart(data as never);
  } catch {
    return { userId: null, dados: null, criadoEm: null, conflito: false };
  }
}

/* ───────────────────────── a conta ───────────────────────── */
export type ContaHotmart = { userId: string; email: string | null; via: "ref" | "ref_batizada" | "email" | "email_outra_conta" | "nova"; divergenteDe?: string };

/**
 * 1º a conta da ref (a anônima da sessão; sem e-mail → ganha o do comprador, se ele não for de outra conta);
 * 2º a conta do e-mail; 3º conta nova com o e-mail (já confirmado). Sem ref e sem e-mail → null.
 */
export async function acharContaHotmart(admin: AdminHotmart, args: {
  refUserId: string | null; email: string | null; acharConta: (email: string) => Promise<string | null>;
}): Promise<ContaHotmart | null> {
  const email = args.email;
  if (args.refUserId) {
    const u = await admin.auth.admin.getUserById(args.refUserId).catch(() => null);
    const conta = u?.data?.user ?? null;
    if (conta) {
      const temEmail = (conta.email ?? "").trim().toLowerCase();
      if (!email || temEmail === email) return { userId: conta.id, email: temEmail || null, via: "ref" };
      if (temEmail) {
        // F (revisão): a sessão do navegador é de OUTRA conta (outro e-mail; o token pega o login de qualquer conta do domínio) —
        // a compra vai pro e-mail de quem comprou (acha ou cria) e a divergência fica registrada
        const r = await contaDoEmail(admin, email, args.acharConta);
        return r ? { ...r, divergenteDe: conta.id } : { userId: conta.id, email: temEmail, via: "ref" };
      }
      const outra = await args.acharConta(email).catch(() => null);
      if (outra && outra !== conta.id) return { userId: outra, email, via: "email_outra_conta" };
      const upd = await admin.auth.admin.updateUserById(conta.id, { email, email_confirm: true }).catch((e) => ({ error: { message: String(e) } }));
      if (!upd?.error) return { userId: conta.id, email, via: "ref_batizada" };
      const depois = await args.acharConta(email).catch(() => null); // corrida: o e-mail virou de alguém agora
      if (depois) return { userId: depois, email, via: "email_outra_conta" };
      return { userId: conta.id, email: null, via: "ref" };
    }
  }
  if (!email) return null;
  return contaDoEmail(admin, email, args.acharConta);
}

async function contaDoEmail(admin: AdminHotmart, email: string, acharConta: (email: string) => Promise<string | null>): Promise<ContaHotmart | null> {
  const doEmail = await acharConta(email).catch(() => null);
  if (doEmail) return { userId: doEmail, email, via: "email" };
  const criada = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { origem: "hotmart_vida" } }).catch((e) => ({ error: { message: String(e) } }) as ResultadoAuth);
  if (criada?.data?.user?.id) return { userId: criada.data.user.id, email, via: "nova" };
  const deNovo = await acharConta(email).catch(() => null);
  return deNovo ? { userId: deNovo, email, via: "email" } : null;
}

/* ───────────────────────── a CAPI ───────────────────────── */
const sha = async (v: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** O Purchase da CAPI (os 2 pixels recebem o MESMO corpo): event_id = transação, valor = o da compra, sinais do pedido. */
export async function eventoPurchaseHotmart(args: {
  tx: string; valorCents: number; userId: string; email: string | null; registro: RegistroHotmart; agoraMs?: number;
}): Promise<Record<string, unknown>> {
  const r = (args.registro.dados ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" && (r[k] as string) ? (r[k] as string) : null);
  let fbc = s("fbc");
  const fbclid = s("fbclid");
  if (!fbc && fbclid) {
    const em = Date.parse(args.registro.criadoEm ?? "");
    fbc = `fb.1.${Number.isFinite(em) ? em : (args.agoraMs ?? Date.now())}.${fbclid}`;
  }
  const ip = s("client_ip"), ua = s("user_agent");
  return {
    data: [{
      event_name: "Purchase", event_time: Math.floor((args.agoraMs ?? Date.now()) / 1000), event_id: args.tx,
      action_source: "website", event_source_url: s("source_url") || `${SITE}/vida`,
      user_data: {
        ...(args.email ? { em: [await sha(args.email)] } : {}),
        external_id: [await sha(args.userId)],
        ...(fbc ? { fbc } : {}),
        ...(s("fbp") ? { fbp: s("fbp") } : {}),
        ...(ip && ua ? { client_ip_address: ip, client_user_agent: ua } : {}),
      },
      custom_data: { value: args.valorCents / 100, currency: "BRL", content_name: "CORE vitalício (Hotmart)" },
    }],
  };
}

/* ───────────────────────── o webhook ───────────────────────── */
export type DepsHotmart = {
  admin: AdminHotmart;
  secret: string | null;
  /** o produto aceito (secret HOTMART_PRODUTO_ID); vazio = PRODUTO_HOTMART_PADRAO. Produto ausente/diferente = ignorado. */
  produtoId?: string | null;
  acharConta: (email: string) => Promise<string | null>;
  enviarEmail: (para: string, assunto: string, html: string) => Promise<boolean>;
  /** manda o corpo pros 2 pixels (fetchNosPixels no Deno) */
  mandarCapi: (corpo: Record<string, unknown>) => Promise<boolean>;
  /** o push "💰 Venda" do dono (função avisar-venda, idempotente pela venda) */
  avisarVenda: (linhaId: string) => Promise<void>;
  /** push pros aparelhos do dono (_shared/push-dono.ts) — os alarmes: venda ignorada, e-mail que não sai */
  avisarDono: (titulo: string, corpo: string, tag: string) => Promise<void>;
  log: (passo: string, d?: Record<string, unknown>) => void;
  agora?: () => Date;
};
export type Resposta = { status: number; corpo: Record<string, unknown> };

type Erro = { code?: string; message?: string } | null;
async function reservar(admin: ClienteMin, id: string, event: string): Promise<"ok" | "ja" | "erro"> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id, source: "hotmart", event });
    if (!error) return "ok";
    return (error as Erro)?.code === "23505" ? "ja" : "erro";
  } catch { return "erro"; }
}
async function soltar(admin: ClienteMin, id: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", id); } catch { /* noop */ }
}

export const MAX_TENTATIVAS_EMAIL = 5;
/** Conta mais uma falha do e-mail desta transação (marcas hotmart-email-falha:<tx>:<n> em webhook_events) e devolve o nº dela. */
async function contarFalhaEmail(admin: ClienteMin, tx: string): Promise<number> {
  for (let n = 1; n <= MAX_TENTATIVAS_EMAIL; n++) {
    const r = await reservar(admin, `hotmart-email-falha:${tx}:${n}`, "email_falha");
    if (r === "ok") return n;
    if (r === "erro") return MAX_TENTATIVAS_EMAIL; // sem a tabela: não prende a Hotmart em 500
  }
  return MAX_TENTATIVAS_EMAIL;
}

/** B: algum estorno desta transação já passou por aqui? */
async function jaEstornada(admin: ClienteMin, tx: string): Promise<boolean> {
  for (const ev of EVENTOS_ESTORNO_LISTA) {
    try {
      const { data } = await admin.from("webhook_events").select("id").eq("id", `hotmart:${tx}:${ev}`).maybeSingle();
      if (data) return true;
    } catch { /* sem leitura: segue */ }
  }
  return false;
}

export async function tratarHotmart(deps: DepsHotmart, req: { hottok: string | null; body: unknown }): Promise<Resposta> {
  const { admin, log } = deps;
  if (!hottokOk(req.hottok, deps.secret)) {
    log("hottok recusado", { tem_secret: !!deps.secret, veio: !!req.hottok });
    return { status: 401, corpo: { ok: false } };
  }
  const c = lerCompraHotmart(req.body);
  const base = { evento: c.evento, tx: c.tx, status: c.status, valor: c.valorCents, email: mascararEmail(c.email), sck: c.sck ? `${c.sck.slice(0, 8)}…` : null, pagamento: c.pagamento };
  if (!c.tx || !c.evento) { log("sem transação/evento — ignorado", base); return { status: 200, corpo: { ok: true, ignorado: "sem_transacao" } }; }
  const produto = deps.produtoId || PRODUTO_HOTMART_PADRAO;
  const pago = EVENTOS_PAGO.has(c.evento);
  const estorno = EVENTOS_ESTORNO.has(c.evento);
  if (!pago && !estorno) { log("evento sem ação", base); return { status: 200, corpo: { ok: true, ignorado: "evento" } }; }

  /* revisão 2 (1): um evento PAGO que não libera nunca some em silêncio — alarme em analytics_events + push pro dono, 1× por
   * transação. O "Enviar teste" da Hotmart (produto 0 / e-mail @example.com) só vai pro log. */
  const ignorar = async (motivo: string): Promise<Resposta> => {
    log(`venda ignorada: ${motivo}`, { ...base, produto: c.produtoId });
    const teste = c.produtoId === "0" || /@example\.com$/i.test(c.email ?? "");
    if (!teste && await reservar(admin, `hotmart-ignorada:${c.tx}`, "ignorada") === "ok") {
      try { await admin.from("analytics_events").insert({ event_name: "hotmart_venda_ignorada", user_id: null, event_data: { motivo, tx: c.tx, evento: c.evento, produto: c.produtoId, valor_cents: c.valorCents, moeda: c.moeda, status: c.status, email: mascararEmail(c.email) } }); } catch { /* o push ainda sai */ }
      await deps.avisarDono(`⚠️ Venda Hotmart IGNORADA: ${motivo}`, `Transação ${c.tx} · ${c.valorCents ? `R$ ${(c.valorCents / 100).toFixed(2).replace(".", ",")}` : "sem valor"} · produto ${c.produtoId ?? "?"}`, `hotmart-ignorada:${c.tx}`).catch(() => {});
    }
    return { status: 200, corpo: { ok: true, ignorado: motivo } };
  };
  if (c.produtoId !== produto) {
    if (pago) return ignorar("outro_produto");
    log("estorno de outro produto — ignorado", { ...base, produto: c.produtoId });
    return { status: 200, corpo: { ok: true, ignorado: "outro_produto" } };
  }

  const chave = `hotmart:${c.tx}:${c.evento}`;
  const r = await reservar(admin, chave, c.evento);
  if (r === "ja") { log("repetido — nada a fazer", base); return { status: 200, corpo: { ok: true, duplicado: true } }; }

  try {
    if (estorno) {
      const { error } = await admin.from("subscriptions").update({ status: "canceled" }).eq("abacatepay_billing_id", c.tx).eq("payment_method", GATEWAY_HOTMART);
      if (error) throw new Error(String((error as Erro)?.message ?? error));
      log("estorno — acesso desligado", base);
      return { status: 200, corpo: { ok: true, desligado: true } };
    }

    if (!c.status || !STATUS_PAGO.has(c.status)) return ignorar("status");
    if (!c.valorCents || c.valorCents < VALOR_MINIMO_CENTS || c.moeda !== "BRL") return ignorar("valor");
    // B (revisão): o estorno chegou ANTES (fora de ordem) ou o APPROVED foi reenviado depois do reembolso → não libera
    if (await jaEstornada(admin, c.tx)) return ignorar("estornada");

    const reg = await registroHotmart(admin, c.sck);
    if (reg.conflito) log("ALARME registro do pedido em conflito — vai pelo e-mail", base);
    const conta = await acharContaHotmart(admin, { refUserId: reg.userId, email: c.email, acharConta: deps.acharConta });
    if (!conta) return ignorar("sem_conta");
    log("conta", { ...base, via: conta.via, ref: !!reg.userId });
    if (conta.divergenteDe && await reservar(admin, `hotmart-divergente:${c.tx}`, "divergente") === "ok") { // revisão 2 (4): 1× por transação
      // F (revisão): a sessão do navegador era de outra conta (outro e-mail) — a compra foi pro e-mail do comprador
      try { await admin.from("analytics_events").insert({ event_name: "hotmart_conta_divergente", user_id: conta.divergenteDe, event_data: { tx: c.tx, para: conta.userId, via: conta.via } }); } catch { /* registro é luxo */ }
    }

    const agora = deps.agora ? deps.agora() : new Date();
    const emailConta = conta.email ?? c.email;
    const g = await creditarPedido(admin, {
      userId: conta.userId, orderId: c.tx, gateway: GATEWAY_HOTMART, concessao: { dias: null }, agora,
      protegerVitalicio: true, offer: OFERTA_HOTMART,
      // C (revisão): linha SÓ da transação — nunca reescreve a linha Pix viva da pessoa (ex.: o anual LN_ano279); o reembolso
      // da Hotmart desliga só esta linha
      linhaNova: true,
      montarPayload: (fim) => ({
        user_id: conta.userId, status: "active", plan: "lifetime", billing_period: "lifetime",
        payment_method: GATEWAY_HOTMART, abacatepay_billing_id: c.tx, customer_email: emailConta, amount_cents: c.valorCents,
        current_period_start: agora.toISOString(), current_period_end: fim,
      }),
    });
    if (g.r === "erro" || g.r === "em_andamento") throw new Error(g.r === "erro" ? g.msg : "em_andamento");
    if (g.r === "preservado" || (g.r === "creditado" && g.jaLiberado)) {
      log(g.r === "creditado" ? "creditado, já tinha vitalício — nada sai" : `nada a creditar (${g.r})`, base);
      return { status: 200, corpo: { ok: true, liberado: true, novo: false } };
    }
    if (g.r === "creditado") log("vitalício liberado", { ...base, acao: g.acao });
    else log("transação já creditada — confere o que falta sair (e-mail/Purchase/aviso, 1 de cada)", base);

    /* 1 de cada por TRANSAÇÃO (reserva em webhook_events): roda no crédito E no "já creditado" (o reenvio depois de um e-mail
     * que falhou, ou o PURCHASE_COMPLETE) — o que já saiu não sai de novo. D (revisão): e-mail que falha → 500 + solta a chave
     * do evento (a Hotmart reenvia; o crédito e o Purchase não repetem). */
    let emailFalhou = false;
    if (emailConta && await reservar(admin, `hotmart-email:${c.tx}`, "email") === "ok") {
      const ok = await deps.enviarEmail(emailConta, assuntoVenda("lifetime"), htmlVenda({ email: emailConta, nome: c.nome, periodo: "lifetime", fim: g.r === "creditado" ? g.fim : null, hoje: true })).catch(() => false);
      if (!ok) { await soltar(admin, `hotmart-email:${c.tx}`); emailFalhou = true; }
      log(ok ? "e-mail da compra enviado" : "e-mail da compra FALHOU", { para: mascararEmail(emailConta) });
    }
    // 04/11 (A/B da /vida): a venda com o BRAÇO do pedido (hotmart-iniciar) — o /vendas separa a /vida por braço. 1× por transação.
    if (await reservar(admin, `hotmart-venda:${c.tx}`, "venda") === "ok") {
      const braco = (reg.dados as { braco_vida?: unknown } | null)?.braco_vida;
      // 05/11: falhou → loga (mascarado) e solta a reserva: o próximo reenvio tenta de novo. O crédito não depende disto.
      let erroVenda: string | null = null;
      try {
        const { error } = await admin.from("analytics_events").insert({ event_name: "hotmart_venda", user_id: conta.userId, event_data: { tx: c.tx, pagina: "vida", braco_vida: braco === "v3" || braco === "atual" ? braco : null, valor_cents: c.valorCents, via: conta.via } });
        if (error) erroVenda = String((error as Erro)?.message ?? error);
      } catch (e) { erroVenda = String((e as Error)?.message ?? e); }
      if (erroVenda) {
        await soltar(admin, `hotmart-venda:${c.tx}`);
        log("hotmart_venda não gravou — tenta no próximo reenvio", { tx: c.tx, email: mascararEmail(emailConta), msg: erroVenda.replace(/[^\s@]+@[^\s@]+/g, "***").slice(0, 120) });
      }
    }
    if (await reservar(admin, `hotmart-capi:${c.tx}`, "capi") === "ok") {
      const corpo = await eventoPurchaseHotmart({ tx: c.tx, valorCents: c.valorCents, userId: conta.userId, email: emailConta, registro: reg, agoraMs: agora.getTime() });
      const ok = await deps.mandarCapi(corpo).catch(() => false);
      log(ok ? "Purchase CAPI enviado" : "Purchase CAPI falhou", { tx: c.tx });
    }
    try {
      const { data } = await admin.from("subscriptions").select("id").eq("abacatepay_billing_id", c.tx).eq("user_id", conta.userId).maybeSingle();
      if (data?.id && g.r === "creditado") await deps.avisarVenda(String(data.id)); // o aviso sai no crédito (o reenvio não avisa de novo)
    } catch { /* aviso é luxo */ }
    if (emailFalhou) {
      // revisão 2 (3): até MAX_TENTATIVAS_EMAIL reenvios da Hotmart; depois, 200 + alarme (nunca 500 pra sempre)
      const n = await contarFalhaEmail(admin, c.tx);
      if (n < MAX_TENTATIVAS_EMAIL) throw new Error("email_falhou");
      log("e-mail da compra falhou 5× — desiste e avisa o dono", base);
      if (await reservar(admin, `hotmart-email-alarme:${c.tx}`, "alarme") === "ok") {
        try { await admin.from("analytics_events").insert({ event_name: "hotmart_email_falhou", user_id: conta.userId, event_data: { tx: c.tx, tentativas: n, email: mascararEmail(emailConta) } }); } catch { /* o push ainda sai */ }
        await deps.avisarDono("⚠️ Hotmart: e-mail da compra NÃO saiu", `Transação ${c.tx} · ${mascararEmail(emailConta)} · acesso liberado, mande o acesso à mão`, `hotmart-email:${c.tx}`).catch(() => {});
      }
    }
    return { status: 200, corpo: { ok: true, liberado: true, novo: g.r === "creditado", via: conta.via } };
  } catch (e) {
    await soltar(admin, chave); // a Hotmart reenvia e a gente tenta de novo
    log("ERRO — a Hotmart vai reenviar", { ...base, msg: String((e as Error)?.message ?? e).slice(0, 160) });
    return { status: 500, corpo: { ok: false } };
  }
}
