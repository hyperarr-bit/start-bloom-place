/** Histórico autenticado do webhook; separado de acesso e de conversões da Meta. */
const texto = (v: unknown, max = 300): string | null => typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
const numero = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
const lista = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.map(x => texto(x)).filter((x): x is string => !!x))].slice(0, 100) : [];
const data = (v: unknown): string | null => {
  const n = numero(v); if (n === null || n < 0 || n > 8640000000000000) return null;
  return new Date(n).toISOString();
};

export function linhaEventoRevenueCat(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>, id = texto(e.id), type = texto(e.type, 80);
  if (!id || !type || type === "TEST") return null;
  const app = texto(e.app_user_id), original = texto(e.original_app_user_id), aliases = lista(e.aliases);
  const from = lista(e.transferred_from), to = lista(e.transferred_to);
  const ids = [...new Set([app, original, ...aliases, ...from, ...to].filter((x): x is string => !!x))];
  const attrs = e.subscriber_attributes && typeof e.subscriber_attributes === "object" ? e.subscriber_attributes as Record<string, { value?: unknown }> : {};
  const own: Record<string, string> = {};
  for (const k of ["core_device_id", "core_turma"]) { const v = texto(attrs[k]?.value, 80); if (v) own[k] = v; }
  // Payload mínimo: não arquiva e-mail, telefone, IP nem atributos arbitrários.
  const payload = { v: 1, transferred_from: from, transferred_to: to, core_attributes: own,
    is_family_share: e.is_family_share === true, takehome_percentage: numero(e.takehome_percentage),
    commission_percentage: numero(e.commission_percentage), tax_percentage: numero(e.tax_percentage) };
  return { id, type, user_id: null, app_user_id: app, original_app_user_id: original, aliases,
    ids_anonimos: ids.filter(x => x.startsWith("$RCAnonymousID:")),
    environment: texto(e.environment, 30), store: texto(e.store, 40), product_id: texto(e.product_id), period_type: texto(e.period_type, 30),
    event_at: data(e.event_timestamp_ms), purchased_at: data(e.purchased_at_ms), expiration_at: data(e.expiration_at_ms),
    grace_period_expiration_at: data(e.grace_period_expiration_at_ms), motivo: texto(e.cancel_reason ?? e.expiration_reason, 100),
    price: numero(e.price), price_in_purchased_currency: numero(e.price_in_purchased_currency), currency: texto(e.currency, 8),
    transaction_id: texto(e.transaction_id), original_transaction_id: texto(e.original_transaction_id),
    is_trial_conversion: typeof e.is_trial_conversion === "boolean" ? e.is_trial_conversion : null,
    country_code: texto(e.country_code, 8), offer_code: texto(e.offer_code), origem: "webhook", payload };
}
