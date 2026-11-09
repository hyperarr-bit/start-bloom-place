/** Pontes próprias de medição; não concedem acesso nem provam receita. */
export const ATRIBUICAO_KEY = "landing-atribuicao-v2";
const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl"] as const;
const VALIDADE = 30 * 86400000;
type StorageLeituraEscrita = Pick<Storage, "getItem" | "setItem">;

export function capturarAtribuicao(busca: string, storage: StorageLeituraEscrita | null, agora = Date.now(), forçado = false): Record<string, string> {
  const params = new URLSearchParams(busca), atual: Record<string, string> = {};
  for (const k of CAMPOS) { const v = params.get(k); if (v) atual[k] = v.slice(0, 200); }
  if (params.get("fbclid")) atual.tem_fbclid = "1";
  // Não mistura campos de anúncios distintos. Visita forçada de QA não alimenta visitas reais.
  if (Object.keys(atual).length) {
    const salvo = { campos: atual, em: agora };
    if (!forçado) try { storage?.setItem(ATRIBUICAO_KEY, JSON.stringify(salvo)); } catch { /* storage opcional */ }
    return { ...atual, atrib_origem: "url", atrib_em: new Date(agora).toISOString() };
  }
  if (!forçado) try {
    const salvo = JSON.parse(storage?.getItem(ATRIBUICAO_KEY) || "null");
    if (salvo && Number.isFinite(salvo.em) && agora >= salvo.em && agora - salvo.em < VALIDADE) {
      const campos: Record<string, string> = {};
      for (const k of [...CAMPOS, "tem_fbclid"]) if (typeof salvo.campos?.[k] === "string") campos[k] = salvo.campos[k].slice(0, 200);
      if (Object.keys(campos).length) return { ...campos, atrib_origem: "retorno_30d", atrib_em: new Date(salvo.em).toISOString() };
    }
  } catch { /* JSON inválido/modo privado não impede a landing */ }
  return { atrib_origem: "sem_sinal" };
}

export type ContextoLoja = { clickId: string; lp: string; pix: string; onde: string; path: string; forçado: boolean };
const aposCompra = (onde: string) => ["pos_compra", "ja_tem", "stripe_pago", "presente_pago", "2027_pago"].includes(onde);
/** Provider confirmado no gerador do App Store Connect em 09/11/2026. Métrica agregada, sem ID pessoal. */
export function linkAppleAtribuido(href: string, c: ContextoLoja): string {
  const u = new URL(href);
  if (u.origin !== "https://apps.apple.com" || !/\/id6806913181\/?$/.test(u.pathname)) return href;
  u.searchParams.set("pt", "129384060");
  u.searchParams.set("ct", c.forçado ? "core_lp_qa" : `core_lp_${c.lp === "v2" ? "v2" : "atual"}_${aposCompra(c.onde) ? "pos" : "pre"}`);
  u.searchParams.set("mt", "8");
  return u.toString();
}
export function linkPlayAtribuido(href: string, c: ContextoLoja): string {
  const u = new URL(href);
  if (u.origin !== "https://play.google.com" || u.pathname !== "/store/apps/details" || u.searchParams.get("id") !== "br.com.coreaplicativo.app") return href;
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(c.clickId)) return href;
  const ref = new URLSearchParams(u.searchParams.get("referrer") || "");
  const pago = aposCompra(c.onde);
  // Versões Android antigas interpretam web_* como pós-compra: nunca usar isso antes do pagamento.
  if (!pago && /^web_/.test(ref.get("utm_campaign") || "")) ref.set("utm_campaign", "landing_pre_compra");
  if (!ref.has("utm_source")) ref.set("utm_source", "web");
  ref.set("core_link_id", c.clickId);
  ref.set("core_lp", c.lp === "v2" ? "v2" : "atual");
  ref.set("core_pix", ["atual", "b"].includes(c.pix) ? c.pix : "unknown");
  ref.set("core_etapa", pago ? "pos_compra" : "pre_compra");
  ref.set("core_path", c.path.split("?")[0].slice(0, 60));
  ref.set("core_medicao", "2");
  if (c.forçado) ref.set("core_qa", "1"); else ref.delete("core_qa");
  u.searchParams.set("referrer", ref.toString());
  return u.toString();
}

export function ondeLinkLoja(a: HTMLAnchorElement): string {
  if (a.closest(".u27-pronto-lojas")) return "2027_pago";
  if (a.closest('[data-testid="oferta-pago"]')) return "stripe_pago";
  if (a.closest('[data-testid="oferta-recebido"]')) return "stripe_pendente";
  if (a.closest("#lp-pix")) return a.closest('[data-fase="ja_tem"]') ? "ja_tem" : "pos_compra";
  if (a.closest("#lpo")) return "prova";
  return "como";
}
