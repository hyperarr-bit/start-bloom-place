/**
 * AS TRAVAS DA LANDING (/organizar, 29/10) — o lado do servidor.
 *
 * Caso real (29/10 11h38 → 11h50, iPhone, navegador do Instagram): pagou o vitalício, criou a conta, tocou em "Abrir
 * meu CORE", a conta sumiu do aparelho, a página voltou na oferta e ela pagou de novo. Daqui saem três coisas:
 *
 *   1. jaTemOCore        no `create` do Pix da landing: a sessão (anônima ou logada), o e-mail que a página mandou ou o
 *                        e-mail de destino guardado da tela do Pix já tem o CORE pra sempre ativo? → a função NÃO gera
 *                        Pix e devolve `ja_tem` (a página mostra "Você já tem o CORE").
 *   2. registrarPagoEmDobro
 *                        um Pix PAGO de quem já tinha o vitalício não sobrescreve mais a linha (grant-pix com
 *                        `protegerVitalicio`): fica um evento `pix_pago_em_dobro` + um chamado no /admin → Suporte, 1x
 *                        por pedido, com o pedido a devolver.
 *   3. guardarNomeDoPagador / alertarPagoSemEmail
 *                        Pix da landing pago sem e-mail na conta: o webhook guarda o NOME do pagador que a Asaas devolve
 *                        (em webhook_events, tabela só do service_role — nada de PII em analytics_events nem no log) e o
 *                        pix-reconcile (cron, 15 min) abre o chamado "Pix pago sem e-mail" se a pessoa não deu o e-mail
 *                        em 10 min, 1x por pedido.
 *
 * Sem Deno: o banco é uma interface mínima (o mesmo jeito do grant-pix.ts) — testado no vitest
 * (src/test/landing-travas.test.ts) com linhas no formato das tabelas de verdade.
 */
import { ehOfertaLanding, PRECOS_LANDING } from "./ofertas-landing.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type LinhaAcesso = {
  status?: string | null;
  plan?: string | null;
  billing_period?: string | null;
  current_period_end?: string | null;
  abacatepay_billing_id?: string | null;
};

const VIVA = new Set(["active", "past_due", "cancel_scheduled"]);

/** Alguma linha VITALÍCIA viva (Pix, Cakto, loja — qualquer uma: quem comprou o vitalício no app também já tem). */
export function temVitalicioAtivo(linhas: LinhaAcesso[] | null | undefined, agora: number = Date.now()): boolean {
  return (linhas ?? []).some((l) => {
    if (!VIVA.has(String(l.status ?? ""))) return false;
    if (l.billing_period !== "lifetime" && l.plan !== "lifetime") return false;
    const fim = l.current_period_end ? Date.parse(l.current_period_end) : NaN;
    return !Number.isFinite(fim) || fim > agora;
  });
}

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type MotivoJaTem = "conta" | "email";

/**
 * A pessoa já tem o CORE pra sempre? Confere a conta da sessão e as contas dos e-mails conhecidos (o da sessão, o que a
 * página mandou, o destino da tela do Pix). `acharConta` é injetado (listUsers no Deno; falso no teste). E-mail sem
 * conta não conta. Erro de leitura = "não sei" = deixa gerar (nunca trava uma venda por falha nossa).
 */
export async function jaTemOCore(admin: ClienteMin, args: {
  userId: string;
  emails: Array<string | null | undefined>;
  acharConta: (email: string) => Promise<string | null>;
  agora?: number;
}): Promise<{ jaTem: false } | { jaTem: true; via: MotivoJaTem }> {
  const ler = async (uid: string): Promise<LinhaAcesso[]> => {
    try {
      const { data } = await admin.from("subscriptions").select("status, plan, billing_period, current_period_end, abacatepay_billing_id").eq("user_id", uid);
      return Array.isArray(data) ? data as LinhaAcesso[] : [];
    } catch { return []; }
  };
  if (temVitalicioAtivo(await ler(args.userId), args.agora)) return { jaTem: true, via: "conta" };
  const vistos = new Set<string>();
  for (const bruto of args.emails) {
    const e = String(bruto ?? "").trim().toLowerCase();
    if (!EMAIL_OK.test(e) || vistos.has(e)) continue;
    vistos.add(e);
    let conta: string | null = null;
    try { conta = await args.acharConta(e); } catch { conta = null; }
    if (!conta || conta === args.userId) continue;
    if (temVitalicioAtivo(await ler(conta), args.agora)) return { jaTem: true, via: "email" };
  }
  return { jaTem: false };
}

/* ───────────────────────── 1 pedido = 1 aviso (webhook_events, chave primária) ───────────────────────── */

export const chaveDobro = (orderId: string): string => `pix-dobro:${orderId}`;
export const chaveSemEmail = (orderId: string): string => `ln-sem-email:${orderId}`;
export const chavePagador = (orderId: string): string => `ln-pagador:${orderId}`;

async function reservarUmaVez(admin: ClienteMin, id: string, event: string): Promise<boolean> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id, source: "landing", event });
    return !error;
  } catch { return false; }
}

export const reais = (centavos: number | null | undefined): string =>
  `R$ ${((Number(centavos) || 0) / 100).toFixed(2).replace(".", ",")}`;

/** "29/10 11:50" no horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export function horaBrasilia(iso: string | Date | null | undefined): string {
  const t = iso instanceof Date ? iso.getTime() : Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "?";
  const d = new Date(t - 3 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * Pix PAGO de quem já tinha o vitalício (a linha NÃO foi tocada): evento consultável + chamado no /admin → Suporte,
 * 1x por pedido. Devolve true se registrou agora (false = já estava registrado, ou falhou a trava).
 */
export async function registrarPagoEmDobro(admin: ClienteMin, args: {
  userId: string; orderId: string; amountCents: number | null; pedidoAnterior: string | null; offer?: string | null; agora?: Date;
}): Promise<boolean> {
  if (!args.orderId || !args.userId) return false;
  if (!(await reservarUmaVez(admin, chaveDobro(args.orderId), "pago_em_dobro"))) return false;
  const quando = horaBrasilia(args.agora ?? new Date());
  try {
    await admin.from("analytics_events").insert({
      user_id: args.userId, event_name: "pix_pago_em_dobro",
      event_data: { order_id: args.orderId, pedido_anterior: args.pedidoAnterior, amount_cents: args.amountCents, offer: args.offer ?? null },
    });
  } catch { /* o chamado abaixo é o que importa */ }
  try {
    await admin.from("support_tickets").insert({
      user_id: args.userId, source: "pix_em_dobro", status: "open",
      message: [
        `Pix pago em dobro · ${reais(args.amountCents)} · ${quando}`,
        "A conta já tinha o CORE pra sempre; este pagamento não mudou nada na conta. Devolver pelo Asaas.",
        `Pedido a devolver: ${args.orderId}`,
        args.pedidoAnterior ? `Pedido que já valia: ${args.pedidoAnterior}` : null,
      ].filter(Boolean).join("\n"),
    });
  } catch { /* noop */ }
  return true;
}

/* ───────────────────────── o nome do pagador (Asaas) ───────────────────────── */

type Buscar = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** O nome que o banco do pagador mandou (a Asaas cria o customer sozinha no Pix do QR estático). null se não achar. */
export async function nomeDoPagadorAsaas(buscar: Buscar, apiKey: string, args: { customerId?: string | null; qrCodeId?: string | null }): Promise<string | null> {
  const headers = { access_token: apiKey, "User-Agent": "CORE/1.0 (Supabase Edge)" };
  const base = "https://api.asaas.com/v3";
  try {
    let customer = args.customerId ?? null;
    if (!customer && args.qrCodeId) {
      const r = await buscar(`${base}/payments?pixQrCodeId=${encodeURIComponent(args.qrCodeId)}&limit=10`, { headers });
      const out = (await r.json().catch(() => ({}))) as { data?: Array<{ customer?: string; status?: string }> };
      customer = (out?.data ?? []).find((p) => p?.customer)?.customer ?? null;
    }
    if (!customer) return null;
    const r = await buscar(`${base}/customers/${encodeURIComponent(customer)}`, { headers });
    if (!r.ok) return null;
    const c = (await r.json().catch(() => ({}))) as { name?: unknown };
    const nome = typeof c?.name === "string" ? c.name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    return nome || null;
  } catch { return null; }
}

/** Guarda o nome do pagador junto do pedido (webhook_events `ln-pagador:<pedido>`, coluna event). 1x por pedido. */
export async function guardarNomeDoPagador(admin: ClienteMin, orderId: string, nome: string | null): Promise<boolean> {
  if (!orderId || !nome) return false;
  return reservarUmaVez(admin, chavePagador(orderId), nome);
}

export async function lerNomeDoPagador(admin: ClienteMin, orderId: string): Promise<string | null> {
  try {
    const { data } = await admin.from("webhook_events").select("id, event").eq("id", chavePagador(orderId));
    const e = String((Array.isArray(data) ? data[0] : data)?.event ?? "").trim();
    return e || null;
  } catch { return null; }
}

/** Quanto tempo a pessoa tem pra dar o e-mail na página antes de virar chamado (7 de 9 dão em 6–15 s). */
export const ESPERA_EMAIL_MS = 10 * 60_000;

/**
 * Pix da landing PAGO e a conta continua sem e-mail: chamado "Pix pago sem e-mail · R$ X · horário · nome do pagador",
 * 1x por pedido. Quem chama já conferiu que a conta não tem e-mail nem destino.
 */
export async function alertarPagoSemEmail(admin: ClienteMin, args: {
  userId: string; orderId: string; amountCents: number | null; pagoEm: string | null; nome: string | null;
}): Promise<boolean> {
  if (!args.orderId || !args.userId) return false;
  if (!(await reservarUmaVez(admin, chaveSemEmail(args.orderId), "pago_sem_email"))) return false;
  try {
    await admin.from("support_tickets").insert({
      user_id: args.userId, source: "pix_sem_email", status: "open",
      message: [
        `Pix pago sem e-mail · ${reais(args.amountCents)} · ${horaBrasilia(args.pagoEm)} · ${args.nome ? `pagador: ${args.nome}` : "pagador sem nome na Asaas"}`,
        "Pagou na landing (/organizar) e não deixou e-mail: a pessoa não tem como entrar. Se ela escrever, liberar com admin-suporte transferir_pix (nunca liberar_vitalicio).",
        `Pedido: ${args.orderId}`,
      ].join("\n"),
    });
  } catch { /* noop */ }
  try {
    await admin.from("analytics_events").insert({
      user_id: args.userId, event_name: "landing_pago_sem_email_alerta",
      event_data: { order_id: args.orderId, amount_cents: args.amountCents, tem_nome: !!args.nome },
    });
  } catch { /* noop */ }
  return true;
}

/**
 * A passada do pix-reconcile: pedidos da landing (pix_order_created com oferta LN_*) criados entre 48 h e 10 min atrás,
 * creditados (linha ativa com o pedido) e sem e-mail na linha → confere a conta (sem e-mail, sem destino) → chamado.
 * Devolve quantos chamados abriu.
 */
export async function varrerPagosSemEmail(admin: ClienteMin, args: {
  pedidos: Array<{ user_id?: string | null; created_at?: string; event_data?: Record<string, unknown> | null }>;
  agora?: number;
  emailDaConta: (uid: string) => Promise<string | null>;
  temDestino: (uid: string) => Promise<boolean>;
  nomeNaAsaas: (orderId: string) => Promise<string | null>;
}): Promise<number> {
  const agora = args.agora ?? Date.now();
  const alvo = new Map<string, number>();
  for (const p of args.pedidos) {
    const oid = String(p.event_data?.order_id ?? "");
    const offer = String(p.event_data?.offer ?? "");
    const t = Date.parse(String(p.created_at ?? ""));
    if (!oid || !ehOfertaLanding(offer) || !Number.isFinite(t)) continue;
    if (agora - t < ESPERA_EMAIL_MS || agora - t > 48 * 3600_000) continue;
    alvo.set(oid, Number(p.event_data?.amount_cents) || PRECOS_LANDING[offer] || 0);
  }
  if (!alvo.size) return 0;
  let linhas: Array<{ user_id: string; abacatepay_billing_id: string; customer_email: string | null; status: string; current_period_start: string | null; amount_cents: number | null }> = [];
  try {
    const { data } = await admin.from("subscriptions")
      .select("user_id, abacatepay_billing_id, customer_email, status, current_period_start, amount_cents")
      .in("abacatepay_billing_id", [...alvo.keys()]);
    linhas = Array.isArray(data) ? data : [];
  } catch { return 0; }
  let abertos = 0;
  for (const l of linhas) {
    if (l.status !== "active" || l.customer_email) continue;
    const oid = l.abacatepay_billing_id;
    // já avisado? (a trava do alertar segura também, mas assim não gasta a consulta à Asaas)
    try {
      const { data } = await admin.from("webhook_events").select("id").eq("id", chaveSemEmail(oid));
      if (Array.isArray(data) ? data.length : data) continue;
    } catch { /* segue: a trava do alertar decide */ }
    if (await args.emailDaConta(l.user_id)) continue;
    if (await args.temDestino(l.user_id)) continue;
    const nome = (await lerNomeDoPagador(admin, oid)) ?? (await args.nomeNaAsaas(oid));
    if (await alertarPagoSemEmail(admin, { userId: l.user_id, orderId: oid, amountCents: l.amount_cents ?? alvo.get(oid) ?? null, pagoEm: l.current_period_start, nome })) abertos++;
  }
  return abertos;
}
