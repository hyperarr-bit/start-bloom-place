/** Metadata declarada pelo cliente: nunca usada para acesso, valor ou autorização. */
export function limparAtribuicaoLanding(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  const id = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(v) ? v : null;
  const sid = id(x.landing_session_id), did = id(x.landing_device_id);
  if (!sid || !did || !["atual", "v2"].includes(String(x.braco_lp))) return null;
  const atrib: Record<string, string> = {};
  if (x.atrib && typeof x.atrib === "object") for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl", "atrib_origem", "atrib_em"]) {
    const v = (x.atrib as Record<string, unknown>)[k]; if (typeof v === "string") atrib[k] = v.slice(0, 200);
  }
  return { landing_medicao_v: 2, landing_session_id: sid, landing_device_id: did,
    braco_lp: x.braco_lp, braco_pix: ["atual", "b"].includes(String(x.braco_pix)) ? x.braco_pix : "unknown",
    forçado: x.forçado === true, atrib };
}
