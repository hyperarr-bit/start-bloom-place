/**
 * Rastreio do Raio-X. Reusa o pixel/CAPI da venda (mesmo event_id) e a atribuição da Porta.
 * Nunca manda valor exato nem descrição de extrato: só faixa.
 */
import { trackEvent } from "@/lib/analytics";
import { capturarAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import { cookiesDaMeta, eventoMeta, novoEventId } from "@/pages/venda/rastreio";
import { supabase } from "@/integrations/supabase/client";
import type { VendaNaConta } from "@/pages/venda/conta";
import { PRECO } from "./conteudo";
import { faixaDeValor, type ResumoRaiox } from "./estimativa";
import type { VarianteDemo } from "./estado";

export { cookiesDaMeta, novoEventId };

export type VendaRaiox = VendaNaConta & {
  variante: "raiox";
  variante_demo: VarianteDemo;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  fbc: string;
  ad_id: string;
  adset_id: string;
  campaign_id: string;
  clicked_at: string;
};

export function idsDaCampanha(search: string, attr: AtribuicaoPorta): { ad_id: string; adset_id: string; campaign_id: string } {
  let p: URLSearchParams;
  try { p = new URLSearchParams(search); } catch { p = new URLSearchParams(); }
  const adset_id = (p.get("adset") || p.get("adset_id") || p.get("as_id") || attr.as_id || "").slice(0, 120);
  const ad_id = (p.get("ad_id") || attr.ad_id || p.get("utm_content") || attr.utm_content || "").slice(0, 200);
  const campaign_id = (p.get("campaign_id") || p.get("c_id") || attr.c_id || p.get("utm_campaign") || attr.utm_campaign || "").slice(0, 200);
  return { ad_id, adset_id, campaign_id };
}

export function capturar(search?: string): AtribuicaoPorta {
  return capturarAtribuicao({ search: search ?? (typeof window !== "undefined" ? window.location.search : ""), caminho: "/raio-x" });
}

/** Lead também (o helper da venda só tipa ViewContent e InitiateCheckout). O corpo do CAPI é o mesmo. */
export function eventoRaiox(evento: "ViewContent" | "InitiateCheckout" | "Lead", eventId: string, params: Record<string, unknown>, fbc?: string | null): void {
  if (evento === "Lead") {
    try {
      if (typeof window !== "undefined" && typeof window.fbq === "function") {
        window.fbq("track", "Lead", params, { eventID: eventId });
      }
    } catch { /* pixel bloqueado */ }
    try {
      const c = cookiesDaMeta();
      void supabase.functions.invoke("venda-capi", {
        body: {
          evento, event_id: eventId, url: window.location.href.slice(0, 500),
          fbp: c.fbp, fbc: c.fbc || fbc || null,
          valor: typeof params.value === "number" ? params.value : null,
          conteudo: typeof params.content_name === "string" ? params.content_name : null,
        },
      }).catch(() => { /* fica o do navegador */ });
    } catch { /* noop */ }
    return;
  }
  eventoMeta(evento, eventId, params, fbc);
}

export async function hashEmail(email: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (let i = 0; i < norm.length; i++) h = (Math.imul(h, 31) + norm.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
}

export function payloadResultado(resumo: ResumoRaiox): { vazou_faixa: string; n_vazamentos: number; fonte: ResumoRaiox["fonte"] } {
  return { vazou_faixa: faixaDeValor(resumo.vazou_mes), n_vazamentos: resumo.vazamentos.length, fonte: resumo.fonte };
}

export function dispararView(attr: AtribuicaoPorta, ids: { ad_id: string; adset_id: string; campaign_id: string }, variante: VarianteDemo): void {
  trackEvent("raiox_view", {
    utm_source: attr.utm_source, utm_medium: attr.utm_medium, utm_campaign: attr.utm_campaign,
    utm_content: attr.utm_content, utm_term: attr.utm_term, fbclid: attr.fbclid,
    ad_id: ids.ad_id, campaign_id: ids.campaign_id, adset_id: ids.adset_id, variante_demo: variante,
  });
  eventoRaiox("ViewContent", novoEventId("vc"), { content_name: "raiox", content_category: "raiox" }, attr.fbc || null);
}

export function dispararCheckout(variante: VarianteDemo, fbc: string | null): void {
  trackEvent("raiox_pagar_click", { metodo: "pix", variante_demo: variante });
  eventoRaiox("InitiateCheckout", novoEventId("ic"), { content_name: "core_anual_web", value: PRECO, currency: "BRL", content_category: "pix" }, fbc);
}

export function montarVenda(args: {
  attr: AtribuicaoPorta;
  ids: { ad_id: string; adset_id: string; campaign_id: string };
  variante: VarianteDemo;
  respostas: Record<string, string | null>;
  sessao: string;
}): VendaRaiox {
  return {
    v: 1,
    variante: "raiox",
    variante_demo: args.variante,
    attr: args.attr,
    respostas: args.respostas,
    plano: "anual",
    metodo: "pix",
    venda_session_id: args.sessao,
    criado_em: new Date().toISOString(),
    utm_source: args.attr.utm_source,
    utm_medium: args.attr.utm_medium,
    utm_campaign: args.attr.utm_campaign,
    utm_content: args.attr.utm_content,
    utm_term: args.attr.utm_term,
    fbclid: args.attr.fbclid,
    fbc: args.attr.fbc,
    ad_id: args.ids.ad_id,
    adset_id: args.ids.adset_id,
    campaign_id: args.ids.campaign_id,
    clicked_at: new Date(args.attr.ts || Date.now()).toISOString(),
  };
}

/** O que a conta guarda do Raio-X. Sem descrição de lançamento. */
export function montarMeta(args: {
  respostas: Record<string, number | undefined>;
  resumo: ResumoRaiox | null;
  escolha: string | null;
  fonte: "estimativa" | "extrato";
  quando: string;
}): Record<string, unknown> {
  return {
    respostas: args.respostas,
    vazamentos: (args.resumo?.vazamentos ?? []).map((v) => ({ chave: v.chave, mes: v.mes, ano: v.ano, fonte: v.fonte })),
    escolha: args.escolha,
    mes: args.resumo?.vazou_mes ?? 0,
    fonte: args.fonte,
    quando: args.quando,
  };
}
