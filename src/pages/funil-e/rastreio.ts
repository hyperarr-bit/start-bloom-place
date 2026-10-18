/**
 * RASTREIO DO SOMA-ASSINATURAS (/funil-e) — eventos próprios `funile_*` no
 * analytics + Meta (pixel e, pros 2 eventos de venda, a MESMA CAPI do
 * /assinar). Reaproveita eventoMeta/novoEventId/cookiesDaMeta do
 * src/pages/venda/rastreio.ts.
 *
 * Regra de ouro (a mesma do raio-x): NUNCA valores do somatório pro Meta —
 * o resultado dela fica no analytics (trackEvent) e o Meta só vê
 * ViewContent / Lead / InitiateCheckout(97,90) / Purchase(97,90, pelo
 * servidor). O Lead aqui é SÓ no pixel (a venda-capi valida prefixo
 * venda_vc|venda_ic e recusaria).
 */
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { eventoMeta, novoEventId, cookiesDaMeta } from "@/pages/venda/rastreio";

export { eventoMeta, novoEventId, cookiesDaMeta };

/* ------------------------------------------------ a sessão do funil (separada da /assinar) */
export const CHAVE_SESSAO_FUNILE = "funile-sessao-v1";
let memoriaSessao: string | null = null;
/** só pros testes */
export function _zerarSessaoFunile(): void { memoriaSessao = null; }
export function sessaoDaFunile(): { id: string; nova: boolean } {
  if (memoriaSessao) return { id: memoriaSessao, nova: false };
  try {
    const s = sessionStorage.getItem(CHAVE_SESSAO_FUNILE);
    if (s) { memoriaSessao = s; return { id: s, nova: false }; }
  } catch { /* noop */ }
  let id: string;
  try { id = crypto.randomUUID(); } catch { id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
  memoriaSessao = id;
  try { sessionStorage.setItem(CHAVE_SESSAO_FUNILE, id); } catch { /* noop */ }
  return { id, nova: true };
}

/* ------------------------------------------------ Lead (só no pixel; a CAPI da venda não cobre este evento) */
declare global {
  interface Window { fbq?: (...args: unknown[]) => void; }
}
/** O marco "viu o próprio número" — alimenta público de remarketing e a régua do conceito. Sem valor. */
export function pixelLead(params: Record<string, unknown>, eventId: string): void {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") window.fbq("track", "Lead", params, { eventID: eventId });
  } catch { /* noop */ }
  try {
    const c = cookiesDaMeta();
    void supabase.functions.invoke("venda-capi", {
      body: { evento: "Lead", event_id: eventId, url: window.location.href.slice(0, 500), fbp: c.fbp, fbc: c.fbc || null, valor: null, conteudo: "funil_e_somatorio" },
    }).catch(() => { /* a venda-capi recusa Lead hoje; o pixel cobre */ });
  } catch { /* noop */ }
}

/** trackEvent com o prefixo do funil já colado (errar o nome do evento é errar a régua). */
export const funile = (nome: string, dados: Record<string, unknown> = {}) => trackEvent(`funile_${nome}`, dados);
