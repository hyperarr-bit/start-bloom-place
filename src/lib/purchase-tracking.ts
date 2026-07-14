import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePurchaseConversion } from "@/lib/google-ads";
import { trackEvent } from "@/lib/analytics";

/**
 * Disparo confiável do Purchase (Meta + Google) pro Pix in-app.
 *
 * Problema real (medido 14/07): `pix_confirmed` = 0 mesmo com vendas. Quem
 * paga SAI do app pra abrir o banco; ao voltar, o webhook já gravou a
 * assinatura e o app recarrega SEM paywall — a tela de "pagamento confirmado"
 * (que disparava o pixel) é pulada. Então o Purchase nunca saía do browser.
 *
 * Solução: ao gerar o QR marcamos uma intenção pendente. O Purchase dispara
 * no primeiro dos dois que acontecer — a tela de confirmação (raro) OU o
 * app detectando "acabou de virar assinante" com a intenção pendente (comum).
 * Marca-única + eventID = orderId ⇒ o Meta deduplica se os dois correrem.
 */

const KEY = "pix-purchase-pending";

type Pending = { offer: "lifetime" | "downsell"; orderId: string | null; at: number };

export function markPixPurchasePending(p: { offer: "lifetime" | "downsell"; orderId: string | null }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() } satisfies Pending));
  } catch { /* ignore */ }
}

/**
 * Se existe intenção pendente, dispara Purchase (uma vez) e limpa a marca.
 * `source` só entra no evento interno pra sabermos por onde fechou.
 * Ignora marcas com mais de 24h (Pix expira muito antes; evita disparo tardio
 * num login futuro).
 */
export function firePixPurchaseOnce(source: "checkout" | "rescue"): boolean {
  let pending: Pending | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    pending = JSON.parse(raw) as Pending;
  } catch {
    return false;
  }
  if (!pending) return false;
  // limpa ANTES de disparar — se algo falhar, não repete em loop
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }

  if (Date.now() - (pending.at ?? 0) > 24 * 60 * 60 * 1000) return false;

  const value = pending.offer === "lifetime" ? 27.9 : 14.9;
  fireMetaEvent(
    "Purchase",
    { value, currency: "BRL", content_name: pending.offer },
    pending.orderId ?? undefined,
  );
  firePurchaseConversion({ billingPeriod: "lifetime", transactionId: pending.orderId ?? undefined });
  trackEvent("pix_purchase_fired", { offer: pending.offer, source, order_id: pending.orderId });
  return true;
}
