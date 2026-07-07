/**
 * Conversão de Compra do Google Ads.
 *
 * Disparada UMA vez, só quando o check-subscription confirma a assinatura
 * ativa após o retorno do checkout (?success=true) — nunca em page load comum.
 * Isso evita o mesmo problema do admin: contar como "venda" quem só abriu o app.
 */

// Rótulo da ação de conversão "Compra" (Google Ads → Conversões).
const CONVERSION_SEND_TO = "AW-18254888989/wQvkCITR78McEJ2AzoBE";

// Valor por plano. billing_period só distingue mensal/anual (não regular vs
// oferta limitada), então é um valor representativo — bom o bastante pro
// Google entender que anual vale mais que mensal no lance por valor.
const PLAN_VALUE: Record<string, number> = {
  annual: 46.8,
  monthly: 14.9,
};

const FIRED_KEY = "core_gads_purchase_fired";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const firePurchaseConversion = (opts: {
  billingPeriod?: string | null;
  transactionId?: string | null;
}) => {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  // Dedupe por assinatura: a mesma compra (mesmo fim de período) não dispara
  // 2x se a tela de sucesso recarregar; uma compra nova (período diferente) sim.
  const marker = opts.transactionId || "once";
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(FIRED_KEY) || "[]");
    if (fired.includes(marker)) return;
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired, marker].slice(-20)));
  } catch {
    /* localStorage indisponível: segue e dispara mesmo assim */
  }

  const value = opts.billingPeriod ? PLAN_VALUE[opts.billingPeriod] : undefined;
  window.gtag("event", "conversion", {
    send_to: CONVERSION_SEND_TO,
    transaction_id: opts.transactionId || "",
    ...(value ? { value, currency: "BRL" } : {}),
  });
};
