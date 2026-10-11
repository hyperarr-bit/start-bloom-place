/**
 * CompleteRegistration da Porta (/comece) pra Meta CAPI.
 *
 * O pixel da página é o da Street Store, inicializado no index.html
 * (`fbq('init', '998037194527241')`). A CAPI TEM que ir nesse mesmo pixel:
 * outro id não aparece no Events Manager dessa conta e a dedup (mesmo
 * event_id no navegador e no servidor) não junta os dois.
 *
 * Função pura, sem Deno: o vitest cobre o payload e a função porta-capi
 * só faz o HTTP. O desenho é o do sendMetaCapi do asaas-pix / abacate-pix
 * (event_id compartilhado, e-mail sha256, IP+UA juntos, fbp/fbc).
 */

/** Pixel da /comece. Travado pelo teste contra o fbq('init') do index.html. */
export const PIXEL_PORTA = "998037194527241";

/** Conta criada agora (o cliente usa 10 min; aqui 30, com folga de relógio). */
export const JANELA_CONTA_NOVA_MS = 30 * 60 * 1000;
const FOLGA_RELOGIO_MS = 5 * 60 * 1000;

const EVENT_ID = /^porta_cr_[a-z0-9-]{6,60}$/i;
const SINAL = /^fb\.1\.\d{10,13}\.[A-Za-z0-9._-]{4,200}$/;
const TESTE = /^TEST\d{4,8}$/;

export function eventIdDeRegistro(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return EVENT_ID.test(s) ? s : null;
}

/** `_fbp` / `_fbc`. Lixo no user_data faz a Meta descartar o evento inteiro. */
export function sinalMeta(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return SINAL.test(s) ? s : null;
}

/** Código da aba Test Events. Sem ele o evento conta de verdade; com ele, só no teste. */
export function codigoTesteMeta(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return TESTE.test(s) ? s : null;
}

export function contaEhNova(createdAt: string | null | undefined, agora = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  const delta = agora - t;
  return delta < JANELA_CONTA_NOVA_MS && delta > -FOLGA_RELOGIO_MS;
}

export function ipDoCliente(get: (nome: string) => string | null): string | null {
  const bruto = get("x-forwarded-for") ?? get("cf-connecting-ip") ?? "";
  const ip = bruto.split(",")[0]?.trim() ?? "";
  if (!ip || ip.length > 64 || /\s/.test(ip)) return null;
  return ip;
}

export async function sha256(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function urlEventosMeta(pixelId: string): string {
  return `https://graph.facebook.com/v19.0/${pixelId}/events`;
}

export function montarCorpoCapi(args: {
  eventId: string;
  eventTime: number;
  emailHash: string | null;
  externalIdHash: string;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  ua: string | null;
  sourceUrl: string | null;
  testEventCode: string | null;
}): Record<string, unknown> {
  const ip = args.ip?.trim() || "";
  const ua = args.ua?.trim().slice(0, 400) || "";
  const corpo: Record<string, unknown> = {
    data: [{
      event_name: "CompleteRegistration",
      event_time: args.eventTime,
      event_id: args.eventId,
      action_source: "website",
      event_source_url: (args.sourceUrl || "https://coreaplicativo.com.br/comece").slice(0, 400),
      user_data: {
        ...(args.emailHash ? { em: [args.emailHash] } : {}),
        external_id: [args.externalIdHash],
        // A Meta descarta o par se vier só um dos dois.
        ...(ip && ua ? { client_ip_address: ip, client_user_agent: ua } : {}),
        ...(args.fbc ? { fbc: args.fbc } : {}),
        ...(args.fbp ? { fbp: args.fbp } : {}),
      },
      custom_data: { content_name: "porta_iphone", status: true },
    }],
  };
  if (args.testEventCode) corpo.test_event_code = args.testEventCode;
  return corpo;
}
