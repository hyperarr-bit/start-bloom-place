/**
 * Dados do aparelho que o app manda pro `revenuecat-sync` depois da compra
 * (iOS 1.0.17, 20/10) — pra o CAPI do StartTrial/Purchase casar mais.
 *
 * REGRA DA APPLE, aplicada AQUI e de novo no servidor: o IDFA só sai do
 * aparelho com o ATT "authorized". Sem aceite vai só o status e as versões
 * (nada que identifique o aparelho). IP e user-agent nunca vão no corpo — o
 * servidor lê dos headers da própria requisição, e só guarda com o aceite.
 *
 * O status é o ATUAL do sistema (plugin MetaAds.idPublicidade → `att`), não o
 * guardado no pedido: a pessoa pode ter mudado nos Ajustes. Build sem o campo
 * cai no `core-att-status` guardado; sem nada, "unknown" (= sem aceite).
 *
 * Só iPhone. Android/web → null (o corpo do sync fica como era).
 * Regras do servidor: supabase/functions/_shared/meta-dados-aparelho.ts.
 */
import { plataformaApp } from "@/lib/native-shell";
import { versaoDoApp } from "@/lib/aparelho";

const ATT_VALIDOS = ["authorized", "denied", "restricted", "notDetermined"] as const;
type AttConhecido = typeof ATT_VALIDOS[number];
export type AttAparelho = AttConhecido | "unknown";

const ZERADO = "00000000-0000-0000-0000-000000000000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CorpoAparelho {
  plataforma: "ios";
  att: AttAparelho;
  app_versao?: string;
  app_build?: string;
  os_versao?: string;
  /** Só com att "authorized". */
  idfa?: string;
}

const attDe = (v: unknown): AttConhecido | null =>
  typeof v === "string" && (ATT_VALIDOS as readonly string[]).includes(v) ? v as AttConhecido : null;

/** Puro (testado): monta o corpo; o IDFA só entra com o ATT autorizado AGORA. */
export const montarCorpoAparelho = (o: {
  plataforma: string;
  attNativo?: unknown;
  attGuardado?: unknown;
  idfa?: unknown;
  appVersao?: string | null;
  appBuild?: string | null;
  osVersao?: string | null;
}): CorpoAparelho | null => {
  if (o.plataforma !== "ios") return null;
  // O nativo manda quando responde; o guardado é só reserva de build sem o campo.
  const att: AttAparelho = attDe(o.attNativo) ?? (o.attNativo == null ? attDe(o.attGuardado) : null) ?? "unknown";
  const corpo: CorpoAparelho = { plataforma: "ios", att };
  if (o.appVersao) corpo.app_versao = o.appVersao.slice(0, 32);
  if (o.appBuild) corpo.app_build = o.appBuild.slice(0, 32);
  if (o.osVersao) corpo.os_versao = o.osVersao.slice(0, 32);
  if (att === "authorized" && typeof o.idfa === "string") {
    const id = o.idfa.trim();
    if (UUID.test(id) && id !== ZERADO) corpo.idfa = id;
  }
  return corpo;
};

export const versaoDoIosNoUA = (ua: string): string =>
  /OS (\d+[_.]\d+(?:[_.]\d+)?)/.exec(ua)?.[1]?.replace(/_/g, ".") ?? "";

/** Lê o plugin (com teto de 1,5 s) e monta o corpo. Nunca lança; fora do iPhone devolve null. */
export async function lerCorpoAparelho(): Promise<CorpoAparelho | null> {
  try {
    const plataforma = plataformaApp();
    if (plataforma !== "ios") return null;
    let attNativo: unknown = undefined;
    let idfa: unknown = undefined;
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const MetaAds = registerPlugin<{ idPublicidade(): Promise<{ gaid?: string; att?: string }> }>("MetaAds");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const r = await Promise.race([
        MetaAds.idPublicidade(),
        new Promise<null>((res) => { timer = setTimeout(() => res(null), 1500); }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (r) { attNativo = r.att; idfa = r.gaid; }
    } catch { /* build sem o plugin: segue só com o guardado */ }
    let attGuardado: string | null = null;
    try { attGuardado = localStorage.getItem("core-att-status"); } catch { /* modo privado */ }
    const v = versaoDoApp();
    return montarCorpoAparelho({
      plataforma,
      attNativo,
      attGuardado,
      idfa,
      appVersao: v.app_versao || null,
      appBuild: v.app_build || null,
      osVersao: versaoDoIosNoUA(typeof navigator !== "undefined" ? navigator.userAgent : "") || null,
    });
  } catch {
    return null;
  }
}
