import { supabase } from "@/integrations/supabase/client";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePurchaseConversion } from "@/lib/google-ads";
import { trackEvent } from "@/lib/analytics";

/**
 * Disparo confiável do Purchase (Meta + Google) pro Pix in-app.
 *
 * Problema 1 (medido 14/07): `pix_confirmed` = 0 mesmo com vendas. Quem paga
 * SAI do app pra abrir o banco; ao voltar, o webhook já gravou a assinatura e
 * o app recarrega SEM paywall — a tela de "pagamento confirmado" (que
 * disparava o pixel) é pulada. Solução: marca de intenção ao gerar o QR +
 * rescue no app quando vira assinante.
 *
 * Problema 2 (caso real da alinecsouza06, 14/07): ela gerou o Pix do DOWNSELL
 * (14,90), copiou, depois gerou outro do LIFETIME (27,90) — e pagou o
 * primeiro. Marca "último gerado vence" disparou 27,90 pra uma venda de
 * 14,90. Solução: guardamos TODOS os Pix gerados e, na hora de disparar,
 * lemos qual pedido o webhook gravou na assinatura (abacatepay_billing_id =
 * order id da Cakto) e casamos o certo. Sem match, cai no último gerado.
 *
 * Marca-única + eventID = orderId ⇒ Meta deduplica se dois caminhos correrem.
 */

const KEY = "pix-purchase-pending";

type PendingOffer = "lifetime" | "downsell";
type Pending = { offer: PendingOffer; orderId: string | null; at: number };

const readPending = (): Pending[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.offer) return [parsed]; // formato antigo (objeto único)
    return [];
  } catch {
    return [];
  }
};

export function markPixPurchasePending(p: { offer: PendingOffer; orderId: string | null }) {
  try {
    const list = readPending().filter((x) => !x.orderId || x.orderId !== p.orderId);
    list.push({ ...p, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-5)));
  } catch { /* ignore */ }
}

/**
 * Se existe intenção pendente, dispara Purchase (uma vez) e limpa a marca.
 * Com mais de um Pix gerado, consulta a assinatura recém-gravada pra saber
 * QUAL pedido foi pago (valor certo no gerenciador). Ignora marcas com mais
 * de 24h (Pix expira muito antes; evita disparo tardio num login futuro).
 */
export async function firePixPurchaseOnce(source: "checkout" | "rescue"): Promise<boolean> {
  const list = readPending();
  if (!list.length) return false;
  // limpa ANTES de disparar — se algo falhar, não repete em loop
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }

  const fresh = list.filter((x) => Date.now() - (x.at ?? 0) <= 24 * 60 * 60 * 1000);
  if (!fresh.length) return false;

  let chosen = fresh[fresh.length - 1];
  if (fresh.length > 1) {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("abacatepay_billing_id")
        .order("current_period_end", { ascending: false })
        .limit(1);
      const paidOrderId = data?.[0]?.abacatepay_billing_id;
      const match = paidOrderId ? fresh.find((x) => x.orderId === paidOrderId) : null;
      if (match) chosen = match;
    } catch { /* fica no último gerado */ }
  }

  const value = chosen.offer === "lifetime" ? 27.9 : 14.9;
  fireMetaEvent(
    "Purchase",
    { value, currency: "BRL", content_name: chosen.offer },
    chosen.orderId ?? undefined,
  );
  firePurchaseConversion({ billingPeriod: "lifetime", transactionId: chosen.orderId ?? undefined });
  trackEvent("pix_purchase_fired", {
    offer: chosen.offer,
    source,
    order_id: chosen.orderId,
    ambiguous: fresh.length > 1,
  });
  return true;
}
