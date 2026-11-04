/**
 * O corpo do hotmart-iniciar (04/11) → a linha `hotmart_order_created` (puro; testado em src/test/hotmart-webhook.test.ts).
 * Só aceita a ref no formato da página (uuid); o resto é cortado no tamanho e o que não é texto some.
 */
export type InicioHotmart = {
  ref: string; fbp: string | null; fbc: string | null; fbclid: string | null; url: string | null;
  landing_session_id: string | null; landing_device_id: string | null; preco_centavos: number | null; atrib: Record<string, string>;
};

const t = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const ATRIB = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl", "tem_fbclid"];
const SITES = ["https://www.coreaplicativo.com.br/", "https://coreaplicativo.com.br/"];

export function validarInicio(body: unknown): InicioHotmart | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const ref = t(b.ref, 64);
  if (!ref || !/^[A-Za-z0-9-]{8,64}$/.test(ref)) return null;
  const atribBruto = (b.atrib && typeof b.atrib === "object" ? b.atrib : {}) as Record<string, unknown>;
  const atrib: Record<string, string> = {};
  for (const k of ATRIB) { const v = t(atribBruto[k], 200); if (v) atrib[k] = v; }
  const url = t(b.url, 500);
  const preco = Number(b.preco_centavos);
  return {
    ref, fbp: t(b.fbp, 120), fbc: t(b.fbc, 400), fbclid: t(b.fbclid, 300),
    url: url && SITES.some((s) => url.startsWith(s)) ? url : null,
    landing_session_id: t(b.landing_session_id, 64), landing_device_id: t(b.landing_device_id, 64),
    preco_centavos: Number.isInteger(preco) && preco > 0 && preco < 1_000_000 ? preco : null, atrib,
  };
}

export function linhaDoPedidoHotmart(p: InicioHotmart, args: { userId: string | null; ip: string | null; ua: string | null }) {
  return {
    event_name: "hotmart_order_created",
    user_id: args.userId,
    session_id: p.landing_session_id,
    event_data: {
      ref: p.ref, gateway: "hotmart", pagina: "vida",
      ...(p.fbp ? { fbp: p.fbp } : {}), ...(p.fbc ? { fbc: p.fbc } : {}), ...(p.fbclid ? { fbclid: p.fbclid } : {}),
      ...(p.url ? { source_url: p.url.slice(0, 300) } : {}),
      // a Meta exige IP + user agent juntos pro evento de site (o webhook é chamado pela Hotmart: só existem aqui)
      ...(args.ip && args.ua ? { client_ip: args.ip, user_agent: args.ua.slice(0, 400) } : {}),
      ...(p.landing_session_id ? { landing_session_id: p.landing_session_id } : {}),
      ...(p.landing_device_id ? { landing_device_id: p.landing_device_id } : {}),
      ...(p.preco_centavos ? { preco_centavos: p.preco_centavos } : {}),
      ...p.atrib,
    },
  };
}

/* ───────── G (revisão 04/11): limite por IP + consultas baratas ───────── */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
/** Até 20 pedidos por IP a cada 10 min (uma pessoa toca 1–3×; o resto é robô/abuso). */
export const LIMITE_POR_IP = 20;
export const JANELA_IP_MS = 10 * 60_000;

/** O IP ainda pode gravar pedido? Conta pelo índice parcial (event_data->>'client_ip', created_at) da migração
 *  20261104120000. Sem IP ou erro de leitura = deixa (nunca trava uma venda por falha nossa). */
export async function ipPodeIniciar(admin: ClienteMin, ip: string | null, agoraMs: number = Date.now()): Promise<boolean> {
  if (!ip) return true;
  try {
    const { count, error } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "hotmart_order_created").eq("event_data->>client_ip", ip)
      .gte("created_at", new Date(agoraMs - JANELA_IP_MS).toISOString());
    if (error || typeof count !== "number") return true;
    return count < LIMITE_POR_IP;
  } catch { return true; }
}

/** A ref já foi gravada? (toque duplo / reenvio = 1 linha só) — pelo índice parcial (event_data->>'ref'). */
export async function refJaExiste(admin: ClienteMin, ref: string): Promise<boolean> {
  try {
    const { data } = await admin.from("analytics_events").select("id").eq("event_name", "hotmart_order_created").eq("event_data->>ref", ref).limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}
