/**
 * "TESTE INICIADO" E A 1ª COBRANÇA DA PORTA COMO EVENTO DE SITE (v4, 12/10) — parte PURA.
 *
 * A campanha da Porta (/comece) é de SITE: a Meta otimiza pelo que o pixel do site (998037194527241) recebe.
 * Hoje ele só recebe CompleteRegistration (o cadastro) — e cadastro barato não é teste (11/10: 87% do gasto foi
 * em Android, que nem tem teste). O teste e a cobrança acontecem no APP, e chegam ao servidor pelo webhook do
 * RevenueCat. Aqui se decide e se monta o evento que o revenuecat-webhook manda pra CAPI do SITE:
 *
 *   · conta COM user_metadata.porta (app_user_id do RevenueCat = uid do Supabase — o app faz logIn com ele);
 *   · INITIAL_PURCHASE com period_type TRIAL → StartTrial;
 *   · a 1ª cobrança paga do anual (RENEWAL com is_trial_conversion, ou INITIAL_PURCHASE pago direto) → Purchase
 *     com o valor em BRL (97,90 no core_anual_97);
 *   · action_source "website", event_source_url = a página de chegada da Porta (porta.attr.landing);
 *   · user_data: em + external_id em SHA-256 (o MESMO external_id da CAPI do cadastro) + fbc/fbp do clique.
 *     SEM IP/user agent (o brief da Porta: só com ok do dono);
 *   · event_id determinístico (porta_trial_<id do evento RC> / porta_pago_<id>): reenvio do RevenueCat não
 *     duplica na Meta. 1x por conta é o webhook que garante (analytics_events porta_capi_trial / porta_capi_pago).
 *
 * Desligado sem PORTA_CAPI_TRIAL="on" — e aí o webhook não faz NADA a mais. Testado no vitest
 * (src/test/porta-capi.test.ts).
 */
import { brutoCents, type EventoRC } from "./afiliados.ts";

export const SITE_PORTA = "https://coreaplicativo.com.br";
export const PAGINA_PORTA = `${SITE_PORTA}/comece`;
/** A Meta recusa evento com mais de 7 dias; a conversão do teste chega ~3 dias depois, mas um reenvio atrasado não pode sumir. */
const LIMITE_IDADE_S = Math.floor(6.5 * 86400);

export type EventoRCPorta = EventoRC & { id?: string | null };
export type PortaDaConta = {
  attr?: { landing?: string; fbc?: string; fbp?: string } | null;
} | null | undefined;

export type TipoCapiPorta = "trial" | "pago";
export const MARCADOR: Record<TipoCapiPorta, string> = { trial: "porta_capi_trial", pago: "porta_capi_pago" };

/** O landing guardado é caminho + query ("/comece?utm…"); a Meta quer a URL inteira. */
export function urlDaPagina(landing: string | null | undefined): string {
  const l = String(landing ?? "").trim();
  if (/^https?:\/\//i.test(l)) return l.slice(0, 800);
  if (l.startsWith("/")) return `${SITE_PORTA}${l}`.slice(0, 800);
  return PAGINA_PORTA;
}

/** Puro: este evento do RevenueCat vira evento de site da Porta? Qual? */
export function tipoDoEvento(ev: EventoRCPorta): TipoCapiPorta | null {
  const tipo = String(ev.type ?? "").toUpperCase();
  const periodo = String(ev.period_type ?? "").toUpperCase();
  const produto = String(ev.product_id ?? "");
  const preco = typeof ev.price_in_purchased_currency === "number" ? ev.price_in_purchased_currency : typeof ev.price === "number" ? ev.price : null;
  if (tipo === "INITIAL_PURCHASE" && periodo === "TRIAL") return "trial";
  if (!produto.startsWith("core_anual")) return null;
  if (tipo === "RENEWAL" && ev.is_trial_conversion === true && (preco === null || preco > 0)) return "pago";
  if (tipo === "INITIAL_PURCHASE" && periodo !== "TRIAL" && preco !== null && preco > 0) return "pago";
  return null;
}

export type DecisaoCapi = { manda: false; motivo: string } | { manda: true; tipo: TipoCapiPorta };

/** Puro: decide se manda (a chave, a conta da Porta, o tipo e se já foi). */
export function decidirCapiPorta(args: { ligado: boolean; ev: EventoRCPorta; porta: PortaDaConta; jaEnviado: boolean }): DecisaoCapi {
  if (!args.ligado) return { manda: false, motivo: "desligado" };
  if (!args.porta || typeof args.porta !== "object") return { manda: false, motivo: "sem_porta" };
  const tipo = tipoDoEvento(args.ev);
  if (!tipo) return { manda: false, motivo: "evento_fora" };
  if (args.jaEnviado) return { manda: false, motivo: "ja_enviado" };
  return { manda: true, tipo };
}

const sha256 = async (v: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Puro (menos o hash): o evento que vai pro /events do pixel do site. */
export async function montarEventoCapiPorta(args: {
  tipo: TipoCapiPorta; ev: EventoRCPorta; uid: string; email: string | null | undefined; porta: NonNullable<PortaDaConta>; agoraMs?: number;
}): Promise<Record<string, unknown>> {
  const { tipo, ev, uid, email, porta } = args;
  const agoraS = Math.floor((args.agoraMs ?? Date.now()) / 1000);
  const quando = Math.floor(Number(ev.purchased_at_ms ?? ev.event_timestamp_ms ?? (args.agoraMs ?? Date.now())) / 1000);
  const idRC = String(ev.id || ev.transaction_id || ev.original_transaction_id || "").trim() || `${uid}_${tipo}`;
  const a = porta.attr ?? {};
  const userData: Record<string, unknown> = { external_id: [await sha256(uid)] };
  if (email) userData.em = [await sha256(email)];
  if (a.fbc) userData.fbc = a.fbc;
  if (a.fbp) userData.fbp = a.fbp;
  const cents = tipo === "pago" ? brutoCents(ev) ?? 9790 : null;
  return {
    event_name: tipo === "trial" ? "StartTrial" : "Purchase",
    event_time: Math.min(agoraS, Math.max(quando, agoraS - LIMITE_IDADE_S)),
    event_id: `porta_${tipo}_${idRC}`,
    action_source: "website",
    event_source_url: urlDaPagina(a.landing),
    user_data: userData,
    custom_data: tipo === "trial"
      ? { content_name: "porta_iphone", currency: "BRL" }
      : { content_name: "porta_iphone", currency: "BRL", value: (cents as number) / 100 },
  };
}
