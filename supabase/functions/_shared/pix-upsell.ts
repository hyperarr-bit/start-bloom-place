/**
 * O PIX DE UPSELL DE 24 H, UM POR COMPRA (31/10, PLANO.md §0 — novidades-guardadas/2026-10-31/upsell-2027-presente).
 *
 * Por que existe (lp-web/ticket/RELATORIO.md): o "Seu 2027" teve 52 pessoas vendo → 20 "Quero" → 3 pagas. Quem matou a
 * venda foi o 2º Pix gerado do zero (15% pagos contra ~50% do Pix principal) e o código que morria em 30 min. Aqui:
 *   · os Pix de upsell (`u2027`, `pv149`) valem 24 h (`expiraSegundos`); o resto continua em 30 min (o vitalício, os
 *     LN_*, o w27 — nada muda pra eles);
 *   · UM Pix por chave (`garantirPixUpsell`): a página (pré-aquecido ao mostrar a oferta) e o e-mail de compra
 *     confirmada recebem O MESMO código — `u2027:<pedido do vitalício>`. A chave é reservada ANTES de criar o QR
 *     (corrida página × e-mail = 1 QR só) e o registro `pix_order_created` sai com `user_id = dono` (a conta FINAL),
 *     que é o elo que o check, o webhook e o reconcile usam pra creditar o pacote;
 *   · nenhum Pix de upsell manda Purchase pra Meta (`META_PURCHASE_UPSELL = false`, decisão do dono pela recomendação
 *     do relatório): o Purchase do vitalício continua 1 por comprador e a leitura "Meta = banco" não infla. Só a UTMify
 *     recebe (pra receita aparecer no painel). Voltar atrás = trocar pra `true` (o event_id seria o id do QR do
 *     upsell, diferente do do vitalício);
 *   · o bloco do 2027 no e-mail de compra confirmada (`blocoU2027`, secret `UPSELL_2027_EMAIL=on`) e o e-mail curto
 *     "Pronto, seu 2027 tá no seu CORE" (1 por pedido).
 *
 * Sem Deno: o banco é uma interface mínima e o QR da Asaas é injetado (`criarQr`) — testado no vitest com banco falso
 * (src/test/pix-upsell.test.ts). O QR de verdade mora em ./asaas-qr.ts.
 */
import { OFERTA_2027, PRECOS_HOJE, eh2027 } from "./ofertas-hoje.ts";
import { ehOfertaPresente } from "./presente.ts";
import { ehOfertaLanding } from "./ofertas-landing.ts";
import { registroDoPedido } from "./registro-pedido.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

/* ───────────────────────── validade ───────────────────────── */

export const EXPIRA_PADRAO_S = 1800; // 30 min — o Pix de venda (vitalício, LN_*, w27…): o mesmo prazo de sempre
export const EXPIRA_UPSELL_S = 86_400; // 24 h — o Pix de upsell (pago depois, no app do banco, às vezes no dia seguinte)
/** Os Pix de upsell (pós-compra): o "Seu 2027" e o presente. */
export const ehPixUpsell = (o: string | null | undefined): boolean => eh2027(o) || ehOfertaPresente(o);
/** O `expirationSeconds` do QR estático da Asaas pra esta oferta. */
export const expiraSegundos = (oferta: string | null | undefined): number => (ehPixUpsell(oferta) ? EXPIRA_UPSELL_S : EXPIRA_PADRAO_S);
/** Pix guardado com menos que isso de validade não é reaproveitado (a pessoa precisa de tempo pra pagar). */
export const REUSO_MIN_MS = 2 * 3600e3;

/* ───────────────────────── pixel ───────────────────────── */

/** DECISÃO DO DONO (31/10, recomendação do relatório): o upsell NÃO manda Purchase pra Meta. */
export const META_PURCHASE_UPSELL = false;
/** Esta oferta manda Purchase pra Meta quando é confirmada? (o vitalício e os planos sempre; os upsells, pela chave) */
export const mandaPurchaseMeta = (oferta: string | null | undefined): boolean => !ehPixUpsell(oferta) || META_PURCHASE_UPSELL;

/* ───────────────────────── preço ───────────────────────── */

/** R$ 14,90 (31/10; era 19,90). A fonte é o PRECOS_HOJE (as 3 funções espalham o mapa). */
export const PRECO_U2027_CENTAVOS = PRECOS_HOJE[OFERTA_2027];
export const reais = (centavos: number): string => `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;

/* ───────────────────────── um Pix por chave ───────────────────────── */

export const chavePixUpsell = (chave: string): string => `up-qr:${chave}`;
/** A chave do 2027: a compra do vitalício (página e e-mail = o mesmo código). */
export const chaveU2027 = (compra: string): string => `u2027:${compra}`;
/** A chave do presente do dia 3 (o e-mail e a página /presente/dar). */
export const chavePresenteDia3 = (userId: string): string => `pv149-d3:${userId}`;

export type PixUpsell = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string; dono: string; oferta: string; novo: boolean };
export type QrCriado = { id: string; payload: string; encodedImage?: string | null; expirationDate?: string | null };
/** Cria o QR estático na Asaas (injetado: ./asaas-qr.ts no Deno, falso no teste). null = falhou. */
export type CriarQr = (a: { descricao: string; valorCentavos: number; expiraSegundos: number; ref: string }) => Promise<QrCriado | null>;
export type FalhaPixUpsell = { erro: "ocupado" | "qr" | "ponte" | "reserva" };

type Guardado = { orderId: string; payload: string; expiresAt: string; dono: string; oferta: string };
const RESERVA = "reservando:";
/** Uma reserva mais velha que isso é de um create que morreu no meio (a próxima chamada assume). */
export const RESERVA_VELHA_MS = 25_000;

const lerGuardado = (event: unknown): Guardado | null => {
  if (typeof event !== "string" || !event.startsWith("{")) return null;
  try {
    const g = JSON.parse(event) as Partial<Guardado>;
    return g && typeof g.orderId === "string" && typeof g.payload === "string" && typeof g.expiresAt === "string" && typeof g.dono === "string" && typeof g.oferta === "string" ? (g as Guardado) : null;
  } catch { return null; }
};
const reservaDe = (event: unknown): number | null => {
  if (typeof event !== "string" || !event.startsWith(RESERVA)) return null;
  const t = Number(event.slice(RESERVA.length));
  return Number.isFinite(t) ? t : 0;
};

/** "2026-07-21 16:30:00" (Brasília, o formato da Asaas) → ISO com offset. */
export const paraIso = (dataAsaas?: string | null): string | null => {
  if (!dataAsaas) return null;
  const t = String(dataAsaas).trim().replace(" ", "T");
  return /Z|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}-03:00`;
};
const imagemDe = (b?: string | null): string | null =>
  typeof b === "string" && b.length ? (b.startsWith("data:") ? b : `data:image/png;base64,${b}`) : null;

async function lerLinha(admin: ClienteMin, id: string): Promise<{ existe: boolean; event: unknown }> {
  const { data } = await admin.from("webhook_events").select("id, event").eq("id", id);
  const l = Array.isArray(data) ? data[0] : data;
  return l ? { existe: true, event: (l as { event?: unknown }).event } : { existe: false, event: null };
}

/**
 * O Pix de upsell desta chave: devolve o que já existe (mesmo dono e oferta, ≥ 2 h de validade) ou cria UM novo.
 * Corrida (a página pré-aquecendo e o webhook montando o e-mail ao mesmo tempo): quem reserva primeiro cria; o outro
 * espera a reserva virar Pix e devolve o mesmo. Nunca lança.
 */
export async function garantirPixUpsell(admin: ClienteMin, a: {
  chave: string; dono: string; oferta: string; valorCentavos: number; descricao: string; criarQr: CriarQr;
  /** campos extras no pix_order_created (fbp/fbc/IP/UA da página; o e-mail não tem) */
  extraPedido?: Record<string, unknown>;
  agora?: () => number; esperar?: (ms: number) => Promise<void>; tentativas?: number;
}): Promise<PixUpsell | FalhaPixUpsell> {
  const agora = a.agora ?? (() => Date.now());
  const esperar = a.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const id = chavePixUpsell(a.chave);
  try {
    for (let volta = 0; volta < (a.tentativas ?? 12); volta++) {
      const l = await lerLinha(admin, id);
      const g = lerGuardado(l.event);
      if (g && g.dono === a.dono && g.oferta === a.oferta && Date.parse(g.expiresAt) - agora() > REUSO_MIN_MS) {
        return { orderId: g.orderId, qrCode: g.payload, qrCodeBase64: null, expiresAt: g.expiresAt, dono: g.dono, oferta: g.oferta, novo: false };
      }
      const r = reservaDe(l.event);
      if (r !== null && agora() - r < RESERVA_VELHA_MS) { await esperar(400); continue; } // outro caminho está criando
      // reserva: linha nova (insert) ou troca da velha/vencida/de outro dono (update condicionado ao valor lido)
      const marca = `${RESERVA}${agora()}`;
      let reservou = false;
      if (!l.existe) {
        const { error } = await admin.from("webhook_events").insert({ id, source: "upsell", event: marca });
        reservou = !error;
      } else {
        const { data, error } = await admin.from("webhook_events").update({ event: marca }).eq("id", id).eq("event", l.event).select("id");
        reservou = !error && Array.isArray(data) && data.length > 0;
      }
      if (!reservou) continue; // alguém passou na frente: lê de novo
      const soltar = () => admin.from("webhook_events").delete().eq("id", id).eq("event", marca).then(() => {}, () => {});

      const qr = await a.criarQr({ descricao: a.descricao, valorCentavos: a.valorCentavos, expiraSegundos: expiraSegundos(a.oferta), ref: `${a.dono}:${a.oferta}` }).catch(() => null);
      if (!qr?.id || !qr.payload) { await soltar(); return { erro: "qr" }; }
      const { error: pontErr } = await admin.from("analytics_events").insert({
        event_name: "pix_order_created", user_id: a.dono,
        event_data: { order_id: qr.id, offer: a.oferta, amount_cents: a.valorCentavos, gateway: "asaas", upsell_chave: a.chave, ...(a.extraPedido ?? {}) },
      });
      // sem a ponte o pagamento não tem dono (ninguém credita): melhor não entregar o QR
      if (pontErr) { await soltar(); return { erro: "ponte" }; }
      const expiresAt = paraIso(qr.expirationDate) ?? new Date(agora() + expiraSegundos(a.oferta) * 1000).toISOString();
      const guardado: Guardado = { orderId: qr.id, payload: String(qr.payload).slice(0, 1000), expiresAt, dono: a.dono, oferta: a.oferta };
      await admin.from("webhook_events").update({ event: JSON.stringify(guardado) }).eq("id", id).then(() => {}, () => {});
      return { orderId: qr.id, qrCode: guardado.payload, qrCodeBase64: imagemDe(qr.encodedImage), expiresAt, dono: a.dono, oferta: a.oferta, novo: true };
    }
    return { erro: "ocupado" };
  } catch {
    return { erro: "reserva" };
  }
}

/* ───────────────────────── a compra do vitalício → o dono do 2027 ───────────────────────── */

export type CompraDoUpsell =
  | { ok: true; dono: string; pagador: string; oferta: string; jaTemPacote: boolean }
  | { ok: false; motivo: "sem_compra" | "oferta" | "sem_linha" };

/**
 * De quem é o 2027 desta compra? A conta FINAL = a dona da linha VIVA do vitalício hoje (o pix-vincular e o e-mail de
 * destino levam a linha pra outra conta; o pacote tem que ir pra lá, nunca pra anônima). `pagador` = quem gerou o Pix
 * do vitalício (a sessão anônima que pagou). Só compras da landing (LN_*).
 */
export async function compraDoUpsell(admin: ClienteMin, compra: string): Promise<CompraDoUpsell> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(compra)) return { ok: false, motivo: "sem_compra" };
  // o registro do create, pelo helper de segurança (linhas que discordam = ninguém leva)
  const reg = (await registroDoPedido(admin, compra))[0];
  if (!reg?.user_id) return { ok: false, motivo: "sem_compra" };
  const oferta = String((reg.event_data as { offer?: unknown } | null)?.offer ?? "");
  if (!ehOfertaLanding(oferta)) return { ok: false, motivo: "oferta" };
  const { data: subs } = await admin.from("subscriptions").select("user_id, status").eq("abacatepay_billing_id", compra).eq("status", "active").limit(1);
  const linha = (Array.isArray(subs) ? subs[0] : subs) as { user_id?: string } | undefined;
  if (!linha?.user_id) return { ok: false, motivo: "sem_linha" };
  const { data: pac } = await admin.from("user_data").select("value").eq("user_id", linha.user_id).eq("key", "core-pacote-2027").maybeSingle();
  const jaTemPacote = !!(pac as { value?: { comprado?: unknown } } | null)?.value && (pac as { value: { comprado?: unknown } }).value.comprado === true;
  return { ok: true, dono: linha.user_id, pagador: reg.user_id, oferta, jaTemPacote };
}

/** A sessão pode pedir o 2027 desta compra? (é a dona da linha, ou a anônima que pagou e teve a compra levada) */
export const sessaoPodePedir = (c: Extract<CompraDoUpsell, { ok: true }>, sessao: string): boolean => c.dono === sessao || c.pagador === sessao;

/* ───────────────────────── B. o bloco no e-mail de compra confirmada ───────────────────────── */

/** O secret do servidor: "on" liga o bloco do 2027 no e-mail de compra confirmada. Sem o secret, off. */
export const SECRET_U2027_EMAIL = "UPSELL_2027_EMAIL";
export const blocoLigado = (valor: string | null | undefined): boolean => valor === "on";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const SITE = "https://www.coreaplicativo.com.br";

/** O link que reabre o MESMO Pix na /organizar (o módulo do 2027, src/landing/upsell-2027.ts). */
export function linkU2027(a: { compra: string; pix: Pick<PixUpsell, "orderId" | "qrCode" | "expiresAt">; site?: string; origem?: string }): string {
  const q = new URLSearchParams({
    r: "u2027", compra: a.compra, pedido: a.pix.orderId, pix: a.pix.qrCode, vence: String(Date.parse(a.pix.expiresAt)),
    utm_source: a.origem ?? "email_compra", utm_medium: "email",
  });
  return `${a.site ?? SITE}/organizar?${q.toString()}`;
}

/** O HTML do bloco (puro). Curto: a pergunta, o preço, o código pra copiar, o botão e a validade. */
export function htmlBlocoU2027(a: { compra: string; pix: Pick<PixUpsell, "orderId" | "qrCode" | "expiresAt">; site?: string }): string {
  const link = linkU2027(a);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;background:#fff7fb;border:1px solid #f3d6e6;border-radius:14px;" data-bloco="u2027"><tr><td style="padding:16px 16px 14px;">
      <div style="font-size:15px;font-weight:800;color:#16121c;margin:0 0 4px;">Quer o seu 2027 já organizado?</div>
      <div style="font-size:13.5px;line-height:1.45;color:#5b5560;margin:0 0 10px;">3 metas, orçamento do ano, 12 revisões do mês e o cofrinho de 52 semanas. <b style="color:#16121c;">${reais(PRECO_U2027_CENTAVOS)}, uma vez</b>, sem mensalidade.</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:0 0 6px;">Pix copia e cola</div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.4;color:#16121c;background:#fff;border:1px dashed #e2c3d4;border-radius:8px;padding:10px;word-break:break-all;-webkit-user-select:all;user-select:all;">${esc(a.pix.qrCode)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr><td><a href="${esc(link)}" style="display:inline-block;background:#d22d80;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:11px 18px;border-radius:999px;">Abrir o Pix</a></td></tr></table>
      <div style="font-size:12px;line-height:1.45;color:#8a838f;margin:10px 0 0;">Vale por 24 h. É separado do CORE que você já pagou.</div>
    </td></tr></table>`;
}

/**
 * O bloco do 2027 pro e-mail desta compra ("" = sem bloco). Só com a chave ligada, compra da landing (LN_*) e a conta
 * ainda sem o pacote. O Pix é o MESMO da página (garantirPixUpsell, chave u2027:<compra>). Nunca lança: o e-mail de
 * compra confirmada sai de qualquer jeito.
 */
export async function blocoU2027(admin: ClienteMin, a: {
  ligado: boolean; compra: string; dono: string; offer: string; criarQr: CriarQr; site?: string;
}): Promise<string> {
  try {
    if (!a.ligado || !ehOfertaLanding(a.offer) || !a.dono || !a.compra) return "";
    const { data: pac } = await admin.from("user_data").select("value").eq("user_id", a.dono).eq("key", "core-pacote-2027").maybeSingle();
    if ((pac as { value?: { comprado?: unknown } } | null)?.value?.comprado === true) return "";
    const pix = await garantirPixUpsell(admin, {
      chave: chaveU2027(a.compra), dono: a.dono, oferta: OFERTA_2027, valorCentavos: PRECO_U2027_CENTAVOS, descricao: "CORE seu 2027", criarQr: a.criarQr,
      extraPedido: { origem: "email_compra", compra: a.compra },
    });
    if ("erro" in pix) return "";
    return htmlBlocoU2027({ compra: a.compra, pix, site: a.site });
  } catch { return ""; }
}

/* ───────────────────────── o e-mail "Pronto, seu 2027 tá no seu CORE" ───────────────────────── */

export const chaveEmailPronto2027 = (orderId: string): string => `u2027-email:${orderId}`;
export const assuntoPronto2027 = (): string => "Pronto, seu 2027 tá no seu CORE ✅";

export function htmlPronto2027(a: { email: string }): string {
  const e = esc(a.email);
  const item = (t: string) => `<tr><td style="vertical-align:top;padding:0 10px 8px 0;color:#1f9d55;font-weight:900;">✓</td><td style="vertical-align:top;padding:0 0 8px;font-size:15px;line-height:1.4;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#d22d80;text-transform:uppercase;">Pagamento confirmado</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 12px;">Pronto, seu 2027 tá no seu CORE.</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">
      ${item("Planejar 2027 em 5 minutos")}${item("12 revisões do mês")}${item("Cofrinho das 52 semanas")}${item("Planner 2027 pra imprimir")}
    </table>
    <p style="font-size:15px;line-height:1.5;margin:0 0 6px;color:#5b5560;">Onde fica: <b style="color:#16121c;">Dev. Pessoal → Seu 2027</b>, no app e no site.</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#5b5560;">Entre com <b style="color:#16121c;">${e}</b>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:0 8px 0 0;"><a href="https://apps.apple.com/br/app/id6806913181" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#63743; App Store</a></td>
      <td><a href="https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Demail%26utm_campaign%3Dweb_u2027_email" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#9654; Google Play</a></td>
    </tr></table>
    <p style="font-size:12.5px;color:#8a838f;line-height:1.5;margin:16px 0 0;">Foi um pagamento separado de R$ 14,90, uma vez. No computador, é o mesmo CORE em coreaplicativo.com.br.</p>
  </div>
</div></body></html>`;
}

/** Manda o "Pronto" 1x por pedido (reserva antes; solta se o envio falhar). true = saiu agora. */
export async function avisarPronto2027(admin: ClienteMin, a: {
  orderId: string; para: string | null | undefined; enviar: (para: string, assunto: string, html: string) => Promise<boolean>;
}): Promise<boolean> {
  if (!a.para) return false;
  try {
    const id = chaveEmailPronto2027(a.orderId);
    const { error } = await admin.from("webhook_events").insert({ id, source: "upsell", event: "u2027_email" });
    if (error) return false;
    const foi = await a.enviar(a.para, assuntoPronto2027(), htmlPronto2027({ email: a.para })).catch(() => false);
    if (!foi) await admin.from("webhook_events").delete().eq("id", id).then(() => {}, () => {});
    return foi;
  } catch { return false; }
}
