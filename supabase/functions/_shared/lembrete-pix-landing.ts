/**
 * LEMBRETE DO PIX NÃO PAGO DA LANDING (/organizar, 29/10) — 2 e-mails por pedido, só pra quem tem e-mail.
 *
 * Por quê (relatório lp-analise/pix, 29/10): 10 de 19 Pix da landing ficaram sem pagar e NENHUM recebeu lembrete — o
 * pix-pendente-email lê `pix_generated` (a landing grava `pix_order_created`) e a conta anônima da landing não tinha
 * e-mail. Com o braço "email" do AB_CHECKOUT (e-mail antes do Pix) quase todo Pix passa a ter pra quem mandar.
 *
 *   t12   ~12 min depois de gerar (todo pagamento real saiu em até 6 min; o QR vale 30): "ainda vale por N minutos",
 *         com o copia-e-cola e o botão que REABRE o mesmo Pix na página (/organizar?r=t12&pedido=…&pix=…&vence=…).
 *         Só sai até 25 min (com menos de ~5 min de validade o e-mail chegaria com o código morto).
 *   t20h  ~20 h depois (o mesmo horário do dia seguinte, quando a pessoa volta ao Instagram): "seu CORE ficou separado",
 *         link pra /organizar gerar outro em 1 toque. Janela até 26 h (o cron pode atrasar).
 *
 * Travas: 1x por (toque, pedido) — webhook_events `ln-lembrete:<toque>:<pedido>` (chave primária; reservada ANTES de
 * mandar e solta se o envio falhar); só o pedido MAIS NOVO de cada conta; para se pagou (linha com o pedido, qualquer
 * linha viva da conta criada depois do Pix, vitalício vivo, ou a Asaas já diz pago); sem e-mail (conta nem destino) não
 * manda; e-mail de teste não manda. Nada de e-mail/nome no log nem em analytics_events (só order_id, toque, oferta).
 * Medição: analytics_events `landing_lembrete_enviado {order_id, toque, offer, via, com_codigo}`; o link leva
 * utm_source=lembrete_pix&utm_content=<toque> (a página grava `landing_lembrete_volta` e o pedido novo leva a utm no
 * source_url); a Resend recebe as tags lembrete=<toque>.
 *
 * O copia-e-cola: o asaas-pix guarda o payload do QR da landing em webhook_events `ln-qr:<pedido>` (só service_role).
 * Sem ele (pedido de antes do deploy), o t12 sai sem o código — só com o botão.
 *
 * Roda dentro do cron que já existe do pix-pendente-email (a cada 10 min — com o de 15 min do pix-reconcile o t12
 * chegaria com até 27 min de Pix, quase vencido). Sem Deno aqui: testado no vitest (src/test/lembrete-pix-landing.test.ts).
 */
import { ehOfertaLanding, PRECOS_LANDING } from "./ofertas-landing.ts";
import { temVitalicioAtivo } from "./landing-travas.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

const MIN = 60_000;
const HORA = 60 * MIN;
/** O QR estático da Asaas vence em 30 min (asaas-pix EXPIRA_SEGUNDOS). */
export const VALIDADE_PIX_MS = 30 * MIN;

export type Toque = "t12" | "t20h";
export const JANELAS: Record<Toque, { de: number; ate: number }> = {
  t12: { de: 12 * MIN, ate: 25 * MIN },
  t20h: { de: 20 * HORA, ate: 26 * HORA },
};
/** Até onde o cron precisa olhar pra trás. */
export const JANELA_BUSCA_MS = JANELAS.t20h.ate;

export const chaveLembrete = (toque: Toque, orderId: string): string => `ln-lembrete:${toque}:${orderId}`;
export const chaveQr = (orderId: string): string => `ln-qr:${orderId}`;

/** Qual toque cabe nesta idade do Pix (null = nenhum). */
export function toqueDaIdade(idadeMs: number): Toque | null {
  for (const t of ["t12", "t20h"] as Toque[]) {
    if (idadeMs >= JANELAS[t].de && idadeMs < JANELAS[t].ate) return t;
  }
  return null;
}

export const reaisDe = (centavos: number): string => `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;

/** O que a pessoa estava comprando, na voz da página. */
export function descricaoDaOferta(offer: string, centavos: number): { curta: string; longa: string } {
  const v = reaisDe(centavos);
  if (offer === "LN_ano279") return { curta: `1 ano por ${v}`, longa: `1 ano inteiro de CORE por ${v}, pagamento único, sem renovação automática` };
  return { curta: `pra sempre por ${v}`, longa: `o CORE pra sempre por ${v}, pagamento único — nunca mais paga` };
}

/** O link de volta pra /organizar (t12 com o Pix vivo pra reabrir; t20h só volta pra gerar outro). */
export function linkDeVolta(args: { toque: Toque; orderId: string; offer: string; qrCode: string | null; criadoEm: number; site?: string }): string {
  const u = new URL("/organizar", args.site ?? "https://www.coreaplicativo.com.br");
  u.searchParams.set("r", args.toque);
  u.searchParams.set("pedido", args.orderId);
  if (args.toque === "t12" && args.qrCode) {
    u.searchParams.set("pix", args.qrCode);
    u.searchParams.set("vence", String(args.criadoEm + VALIDADE_PIX_MS));
    u.searchParams.set("o", args.offer);
  }
  u.searchParams.set("utm_source", "lembrete_pix");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "landing_pix");
  u.searchParams.set("utm_content", args.toque);
  return u.toString();
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export type Mensagem = { assunto: string; html: string };

/** Os 2 e-mails (textos curtos, no tom da landing — base: lp-analise/pix/RELATORIO.md, P2). */
export function mensagemDoLembrete(args: {
  toque: Toque; offer: string; centavos: number; link: string; qrCode: string | null; minutosRestantes: number;
}): Mensagem {
  const { curta, longa } = descricaoDaOferta(args.offer, args.centavos);
  const valor = reaisDe(args.centavos);
  const casca = (kicker: string, corpo: string) => `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;color:#1c1a1f;">
<div style="max-width:520px;margin:0 auto;padding:28px 18px;">
  <div style="font-size:15px;font-weight:900;letter-spacing:.14em;color:#1c1a1f;margin:0 0 14px 4px;">CORE</div>
  <div style="background:#fff;border-radius:20px;padding:26px 22px;border:1px solid #ebe8ee;">
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;color:#d6338a;text-transform:uppercase;">${kicker}</div>
    ${corpo}
  </div>
  <p style="font-size:11.5px;color:#9a95a0;text-align:center;line-height:1.5;margin:16px 8px 0;">Você recebeu este e-mail porque gerou um Pix no CORE. Se já pagou, pode ignorar.<br>CORE · CNPJ 55.041.112/0001-82 · contato@coreaplicativo.com.br</p>
</div></body></html>`;
  const botao = (txt: string) => `<a href="${escHtml(args.link)}" style="display:block;text-align:center;background:#262626;color:#fff;text-decoration:none;font-weight:750;font-size:16.5px;padding:16px 18px;border-radius:16px;margin:20px 0 6px;">${txt}</a>`;
  const garantia = `<p style="font-size:14px;line-height:1.5;color:#6b6670;margin:16px 0 0;">Assim que cair, o acesso chega aqui neste e-mail. <b style="color:#1c1a1f;">7 dias de garantia:</b> não gostou, devolvemos 100% no Pix.</p>`;

  if (args.toque === "t12") {
    const min = Math.max(1, Math.floor(args.minutosRestantes));
    const codigo = args.qrCode
      ? `<p style="font-size:15px;line-height:1.5;margin:14px 0 8px;">O código ainda vale por uns ${min} minutos. É só copiar e colar no app do banco, em Pix → Copia e Cola:</p>
    <div style="padding:12px 14px;border-radius:12px;background:#f7f5f8;font:500 12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#3d3a40;word-break:break-all;">${escHtml(args.qrCode)}</div>`
      : `<p style="font-size:15px;line-height:1.5;margin:14px 0 0;">O código ainda vale por uns ${min} minutos.</p>`;
    return {
      assunto: `Seu Pix de ${valor} ainda vale por ${min} minutos`,
      html: casca("Seu Pix ficou esperando", `
    <h1 style="font-size:23px;line-height:1.2;font-weight:850;letter-spacing:-.02em;margin:10px 0 0;">Oi! O Pix do seu CORE ficou esperando.</h1>
    <p style="font-size:15px;line-height:1.5;color:#3d3a40;margin:10px 0 0;">É ${escHtml(longa)}.</p>
    ${codigo}
    ${botao("Abrir meu Pix")}
    ${garantia}`),
    };
  }
  return {
    assunto: "Seu CORE ficou separado",
    html: casca("Seu CORE ficou separado", `
    <h1 style="font-size:23px;line-height:1.2;font-weight:850;letter-spacing:-.02em;margin:10px 0 0;">Você chegou até o Pix do CORE e parou ali.</h1>
    <p style="font-size:15px;line-height:1.5;color:#3d3a40;margin:10px 0 0;">Seu plano continua separado: ${escHtml(curta)}, pagamento único.</p>
    ${botao("Gerar meu Pix de novo")}
    <p style="font-size:13px;color:#9a95a0;text-align:center;margin:0;">Leva 2 segundos.</p>
    <p style="font-size:14px;line-height:1.5;color:#6b6670;margin:18px 0 0;">Se foi algum problema no banco ou na página, é só responder este e-mail.</p>`),
  };
}

/* ───────────────────────── Asaas: o QR já foi pago? ───────────────────────── */

type Buscar = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
const PAGOS_ASAAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

/** true = pago na Asaas · false = não · null = não deu pra saber (a conferência no banco continua valendo). */
export async function pixPagoNaAsaas(buscar: Buscar, apiKey: string, qrCodeId: string): Promise<boolean | null> {
  try {
    const r = await buscar(`https://api.asaas.com/v3/payments?pixQrCodeId=${encodeURIComponent(qrCodeId)}&limit=10`, {
      headers: { access_token: apiKey, "User-Agent": "CORE/1.0 (Supabase Edge)" },
    });
    if (!r.ok) return null;
    const out = (await r.json().catch(() => ({}))) as { data?: Array<{ status?: string }> };
    return (out?.data ?? []).some((p) => PAGOS_ASAAS.has(String(p?.status)));
  } catch { return null; }
}

/* ───────────────────────── a passada do cron ───────────────────────── */

type Pedido = { user_id?: string | null; created_at?: string; event_data?: Record<string, unknown> | null };
const VIVA = new Set(["active", "past_due", "cancel_scheduled"]);
export const EH_EMAIL_DE_TESTE = (email?: string | null): boolean => !!email && /(^|[+.])teste|testeghg|jv20101958/i.test(email);

export type ResultadoLembretes = {
  candidatos: number; enviados: number; t12: number; t20h: number;
  pagos: number; semEmail: number; jaAvisados: number; testes: number; falhas: number;
};

export async function varrerLembretesLanding(admin: ClienteMin, deps: {
  pedidos: Pedido[];
  agora?: number;
  site?: string;
  emailDaConta: (uid: string) => Promise<string | null>;
  destino: (uid: string) => Promise<string | null>;
  pagoNaAsaas: (orderId: string) => Promise<boolean | null>;
  enviar: (para: string, m: Mensagem, tags: Record<string, string>) => Promise<boolean>;
  ehTeste?: (email: string) => boolean;
}): Promise<ResultadoLembretes> {
  const agora = deps.agora ?? Date.now();
  const res: ResultadoLembretes = { candidatos: 0, enviados: 0, t12: 0, t20h: 0, pagos: 0, semEmail: 0, jaAvisados: 0, testes: 0, falhas: 0 };

  // só o pedido MAIS NOVO de cada conta (quem gerou 2 Pix não recebe lembrete do velho)
  const ordenados = [...deps.pedidos]
    .filter((p) => p.user_id && ehOfertaLanding(String(p.event_data?.offer ?? "")) && p.event_data?.order_id && Number.isFinite(Date.parse(String(p.created_at))))
    .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)));
  const vistos = new Set<string>();
  for (const p of ordenados) {
    const uid = String(p.user_id);
    if (vistos.has(uid)) continue;
    vistos.add(uid);
    const criadoEm = Date.parse(String(p.created_at));
    const toque = toqueDaIdade(agora - criadoEm);
    if (!toque) continue;
    const orderId = String(p.event_data!.order_id);
    const offer = String(p.event_data!.offer);
    const centavos = Number(p.event_data?.amount_cents) || PRECOS_LANDING[offer] || 2790;
    res.candidatos++;
    try {
      // já avisado neste toque? (a reserva abaixo também segura; assim não gasta as outras consultas)
      const { data: marca } = await admin.from("webhook_events").select("id").eq("id", chaveLembrete(toque, orderId));
      if (Array.isArray(marca) ? marca.length : marca) { res.jaAvisados++; continue; }

      // pagou? (este pedido creditado, qualquer acesso vivo da conta criado depois do Pix, ou vitalício vivo)
      const { data: doPedido } = await admin.from("subscriptions").select("id").eq("abacatepay_billing_id", orderId);
      if (Array.isArray(doPedido) && doPedido.length) { res.pagos++; continue; }
      const { data: daConta } = await admin.from("subscriptions")
        .select("status, plan, billing_period, current_period_end, created_at").eq("user_id", uid);
      const linhas = (Array.isArray(daConta) ? daConta : []) as Array<{ status?: string; created_at?: string; plan?: string; billing_period?: string; current_period_end?: string | null }>;
      if (temVitalicioAtivo(linhas as never, agora) || linhas.some((l) => VIVA.has(String(l.status)) && Date.parse(String(l.created_at)) >= criadoEm)) { res.pagos++; continue; }
      if ((await deps.pagoNaAsaas(orderId)) === true) { res.pagos++; continue; }

      // pra quem? o e-mail da conta (braço "email" / pagou logada) ou o destino da tela do QR (e-mail opcional com conta)
      const daContaEmail = await deps.emailDaConta(uid);
      const email = daContaEmail ?? (await deps.destino(uid));
      if (!email) { res.semEmail++; continue; }
      if ((deps.ehTeste ?? EH_EMAIL_DE_TESTE)(email)) { res.testes++; continue; }

      let qrCode: string | null = null;
      if (toque === "t12") {
        const { data: qr } = await admin.from("webhook_events").select("id, event").eq("id", chaveQr(orderId));
        const ev = String((Array.isArray(qr) ? qr[0] : qr)?.event ?? "");
        qrCode = /^000201/.test(ev) ? ev : null;
      }
      const link = linkDeVolta({ toque, orderId, offer, qrCode, criadoEm, site: deps.site });
      const m = mensagemDoLembrete({ toque, offer, centavos, link, qrCode, minutosRestantes: (criadoEm + VALIDADE_PIX_MS - agora) / MIN });

      // 1x por (toque, pedido): reserva ANTES de mandar; solta se o envio falhar (o próximo cron tenta de novo)
      const { error: dup } = await admin.from("webhook_events").insert({ id: chaveLembrete(toque, orderId), source: "landing", event: "lembrete_pix" });
      if (dup) { res.jaAvisados++; continue; }
      const foi = await deps.enviar(email, m, { lembrete: toque, oferta: offer });
      if (!foi) {
        await admin.from("webhook_events").delete().eq("id", chaveLembrete(toque, orderId));
        res.falhas++;
        continue;
      }
      await admin.from("analytics_events").insert({
        user_id: uid, event_name: "landing_lembrete_enviado",
        event_data: { order_id: orderId, toque, offer, via: daContaEmail ? "conta" : "destino", com_codigo: !!qrCode },
      }).then(() => {}, () => {});
      res.enviados++; res[toque]++;
    } catch {
      res.falhas++;
    }
  }
  return res;
}
