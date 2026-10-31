/**
 * O QR ESTÁTICO DA ASAAS fora do asaas-pix (31/10): a chave Pix da conta (cacheada) e o `POST /pix/qrCodes/static`.
 * Saiu do asaas-pix pra o e-mail de compra confirmada (asaas-webhook, destino-hoje) e o cron gerarem o Pix de upsell
 * SEM sessão — o mesmo código da página (_shared/pix-upsell.ts garantirPixUpsell). O asaas-pix usa daqui também.
 */
import type { CriarQr, QrCriado } from "./pix-upsell.ts";

export const ASAAS_API = "https://api.asaas.com/v3";

/** Headers do Asaas: access_token próprio (NÃO é Bearer) + User-Agent obrigatório pra contas criadas depois de 13/06/2024. */
export const asaasHeaders = (key: string) => ({
  access_token: key,
  "User-Agent": "CORE/1.0 (Supabase Edge)",
  "Content-Type": "application/json",
});

const env = (k: string): string | undefined => (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);

/** A chave Pix da conta (necessária pro QR estático). Cacheada no módulo — a instância vive entre invocações. */
let chavePixCache: string | null = null;
export async function obterChavePix(key: string, log?: (p: string, d?: unknown) => void, signal?: AbortSignal): Promise<string | null> {
  if (chavePixCache) return chavePixCache;
  const envKey = env("ASAAS_PIX_KEY");
  if (envKey) { chavePixCache = envKey; return envKey; }
  try {
    const res = await fetch(`${ASAAS_API}/pix/addressKeys`, { headers: asaasHeaders(key), ...(signal ? { signal } : {}) });
    const out = await res.json().catch(() => ({}));
    const ativa = (out?.data ?? []).find((k: { status?: string }) => k.status === "ACTIVE") ?? (out?.data ?? [])[0];
    if (ativa?.key) { chavePixCache = ativa.key as string; return chavePixCache; }
  } catch (e) {
    log?.("Falha buscando chave Pix", { message: String(e).slice(0, 120) });
  }
  return null;
}

export type RespostaQr = { ok: boolean; status: number; out: Record<string, unknown> };

/** O POST cru (o asaas-pix precisa do status/corpo pro debug). */
export async function postarQrEstatico(apiKey: string, chave: string, a: { descricao: string; valorCentavos: number; expiraSegundos: number; ref: string }, signal?: AbortSignal): Promise<RespostaQr> {
  const res = await fetch(`${ASAAS_API}/pix/qrCodes/static`, {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: asaasHeaders(apiKey),
    body: JSON.stringify({
      addressKey: chave,
      description: a.descricao,
      value: a.valorCentavos / 100, // Asaas trabalha em REAIS, não centavos
      format: "ALL",
      expirationSeconds: a.expiraSegundos,
      allowsMultiplePayments: false, // 1 QR = 1 pagamento = 1 pessoa
      externalReference: a.ref,
    }),
  });
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, out: (out ?? {}) as Record<string, unknown> };
}

/** Crítica r2 (dinheiro 3): o QR de upsell nasce no caminho do e-mail de compra / do `paid` do vitalício — a Asaas travada
 *  não pode segurar isso. 4 s por chamada (o vitalício, que usa o postarQrEstatico direto do asaas-pix, não muda). */
export const TIMEOUT_QR_UPSELL_MS = 4000;
const sinalComTeto = (ms: number): AbortSignal | undefined => {
  try { return (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout?.(ms); } catch { return undefined; }
};

/** O `criarQr` do garantirPixUpsell pra esta conta Asaas. */
export function criarQrAsaas(apiKey: string, log?: (p: string, d?: unknown) => void): CriarQr {
  return async (a) => {
    if (!apiKey) return null;
    const chave = await obterChavePix(apiKey, log, sinalComTeto(TIMEOUT_QR_UPSELL_MS));
    if (!chave) return null;
    const r = await postarQrEstatico(apiKey, chave, a, sinalComTeto(TIMEOUT_QR_UPSELL_MS)).catch(() => null);
    if (!r?.ok || !r.out?.payload || !r.out?.id) {
      log?.("Asaas QR de upsell falhou", { status: r?.status ?? null });
      return null;
    }
    return r.out as unknown as QrCriado;
  };
}
