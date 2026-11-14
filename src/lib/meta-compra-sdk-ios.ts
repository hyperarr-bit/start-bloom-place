/**
 * "COMPRAR" PELO SDK DA META NO iPHONE (14/11, dono: "no iOS não tem um Comprar tipo Android que pega tudo… fazer isso").
 *
 * O problema: numa campanha de app do iPhone a Meta só deixa otimizar evento que sai do SDK DENTRO do aparelho
 * (é ele que alimenta o SKAdNetwork e a medição agregada). A compra do iPhone sai só do SERVIDOR (CAPI de app) desde
 * 20/09 — de propósito: com teste grátis, um Purchase pelo aparelho no início do teste contava "compra de R$ 0" e
 * ensinava a campanha a buscar quem não paga. Resultado em 13/11: na campanha de iPhone o "Comprar" fica cinza e só
 * o "Assinar" (que o SDK registra sozinho) aparece — e o "Assinar" não enxerga o vitalício (compra única).
 *
 * Com o paywall SEM teste (1.0.26) toda compra é paga na hora, então o motivo acabou. Isto manda `Purchase` pelo SDK
 * (`MetaAds.logCompra`, já existe no AppDelegate desde 18/09) com o valor REAL do produto, logo depois de a folha da
 * Apple fechar com sucesso no `comprarSemTeste` (anual 97,90, mensal 34,90, presente 69,90 e vitalício 97,90).
 *
 * UMA VEZ POR COMPRA, NO APARELHO QUE COMPROU:
 *   · só iPhone nativo; só quando a loja NÃO diz que entrou em teste (teste continua indo pelo StartTrial);
 *   · a transação tem que ser NOVA (menos de 1 h): comprar de novo o que já está ativo devolve a transação antiga;
 *   · valor > 0 (nunca "compra de R$ 0");
 *   · o id da transação fica guardado no aparelho (`core-meta-compra-enviada`) e nunca se repete.
 *
 * DEDUPLICAÇÃO COM O SERVIDOR — PONTO EM ABERTO: o aparelho manda fb_order_id = id da transação da Apple; o servidor
 * manda o Purchase com event_id = id do RevenueCat ("sub…"/"otp…"), que o aparelho não conhece. Enquanto o servidor
 * não usar o id da Apple, a Meta pode contar a compra do iPhone 2× nos RELATÓRIOS (SDK + servidor). A otimização da
 * campanha de iPhone usa o do SDK; o relatório de compras do iPhone na Meta fica inflado até casar.
 *
 * CHAVE REMOTA `meta_compra_sdk` (metadata de qualquer offering do RevenueCat, a `current` vence), no padrão de
 * `skan_trial_sdk`: "on" | "off". Padrão SEM a chave = "on" (o dono pediu pra fazer; desligar = "off" na metadata,
 * sem build). A última resposta fica no aparelho (`core-meta-compra-sdk`).
 * QA: `?meta-compra-sdk=on|off|auto` (guarda em `meta-compra-sdk-force`, fora dos prefixos que as vassouras apagam).
 */
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";

export type ModoMetaCompraSdk = "on" | "off";
/** O padrão sem resposta / sem a chave. */
export const META_COMPRA_SDK: ModoMetaCompraSdk = "on";
export const CHAVE_REMOTA_META_COMPRA_SDK = "meta_compra_sdk";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho — lib/chaves-do-aparelho). */
export const CHAVE_META_COMPRA_SDK_APARELHO = "core-meta-compra-sdk";
/** Ids das transações cujo Purchase já saiu pelo SDK (chave do aparelho — nunca repetir). */
export const CHAVE_META_COMPRA_ENVIADA = "core-meta-compra-enviada";
export const CHAVE_FORCA_META_COMPRA_SDK = "meta-compra-sdk-force";
export const PARAM_META_COMPRA_SDK = "meta-compra-sdk";
/** Transação mais velha que isto não é "a compra que acabou de acontecer". */
export const FRESCOR_MAXIMO_MS = 60 * 60 * 1000;
const GUARDA_NO_MAXIMO = 20;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};
const modoDe = (v: unknown): ModoMetaCompraSdk | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" ? t : null;
};

let remoto: ModoMetaCompraSdk | undefined;

/** Decisão pura: a chave em qualquer offering (a `current` vence); null = nenhuma offering disse. */
export function lerMetaCompraSdkRemoto(offerings: unknown): ModoMetaCompraSdk | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoMetaCompraSdk | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_META_COMPRA_SDK]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_META_COMPRA_SDK]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarMetaCompraSdkRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerMetaCompraSdkRemoto(offerings);
    remoto = lido ?? META_COMPRA_SDK;
    if (lido) ls.set(CHAVE_META_COMPRA_SDK_APARELHO, lido);
    else ls.del(CHAVE_META_COMPRA_SDK_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}

/** Guarda `?meta-compra-sdk=on|off|auto` (QA) neste aparelho. */
export function guardarForcaMetaCompraSdk(busca: string = typeof location !== "undefined" ? location.search : ""): void {
  try {
    const v = new URLSearchParams(busca).get(PARAM_META_COMPRA_SDK);
    if (v === "auto") ls.del(CHAVE_FORCA_META_COMPRA_SDK);
    else if (modoDe(v)) ls.set(CHAVE_FORCA_META_COMPRA_SDK, modoDe(v)!);
  } catch { /* noop */ }
}

/** Ligado? Força de QA > resposta desta abertura > última resposta guardada > padrão. */
export function metaCompraSdkLigado(): boolean {
  const forca = modoDe(ls.get(CHAVE_FORCA_META_COMPRA_SDK));
  const modo = forca ?? remoto ?? modoDe(ls.get(CHAVE_META_COMPRA_SDK_APARELHO)) ?? META_COMPRA_SDK;
  return modo === "on";
}

/** Só testes. */
export const _zerarMetaCompraSdk = (): void => { remoto = undefined; };

type Entitlement = { periodType?: string; latestPurchaseDateMillis?: number | null; productIdentifier?: string };
type ResultadoDaCompra = {
  productIdentifier?: string;
  customerInfo?: { entitlements?: { active?: Record<string, Entitlement> } };
  transaction?: { transactionIdentifier?: string; productIdentifier?: string; purchaseDate?: string } | null;
};
type ProdutoDaLoja = { identifier?: string; price?: number; currencyCode?: string } | null | undefined;

export type CompraNoSdk = { valor: number; moeda: string; produto: string; pedido: string };
export type DecisaoCompraNoSdk =
  | { mandar: true; evento: CompraNoSdk }
  | { mandar: false; motivo: "em_teste" | "sem_transacao" | "transacao_velha" | "ja_enviado" | "sem_valor" };

const lerEnviados = (): string[] => {
  try {
    const v = JSON.parse(ls.get(CHAVE_META_COMPRA_ENVIADA) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const marcarEnviado = (tx: string): void => {
  ls.set(CHAVE_META_COMPRA_ENVIADA, JSON.stringify([...lerEnviados().filter((x) => x !== tx), tx].slice(-GUARDA_NO_MAXIMO)));
};

/** Decisão pura: este resultado da folha é uma compra PAGA que acabou de acontecer e ainda não foi mandada? */
export function decidirCompraNoSdk(resultado: unknown, produto: ProdutoDaLoja, agora: number = Date.now()): DecisaoCompraNoSdk {
  const r = (resultado ?? {}) as ResultadoDaCompra;
  const ativos = Object.values(r.customerInfo?.entitlements?.active ?? {});
  // Entrou em teste: não é compra paga (o teste tem o caminho dele, lib/meta-inicio-teste-ios).
  if (ativos.some((e) => e?.periodType === "TRIAL")) return { mandar: false, motivo: "em_teste" };
  const tx = String(r.transaction?.transactionIdentifier ?? "").trim();
  if (!tx) return { mandar: false, motivo: "sem_transacao" };
  const quando = r.transaction?.purchaseDate ? Date.parse(r.transaction.purchaseDate) : NaN;
  if (!Number.isFinite(quando) || agora - quando > FRESCOR_MAXIMO_MS) return { mandar: false, motivo: "transacao_velha" };
  if (lerEnviados().includes(tx)) return { mandar: false, motivo: "ja_enviado" };
  const valor = Number(produto?.price ?? 0);
  if (!(valor > 0)) return { mandar: false, motivo: "sem_valor" };
  const id = r.transaction?.productIdentifier || r.productIdentifier || produto?.identifier || "";
  return { mandar: true, evento: { valor, moeda: produto?.currencyCode || "BRL", produto: id, pedido: tx } };
}

export type DesfechoCompraNoSdk = "enviado" | "nao_ios" | "desligado" | "sem_sdk" | "erro" | Extract<DecisaoCompraNoSdk, { mandar: false }>["motivo"];

/** Chamado logo depois de `registrarResultadoDaFolha("sucesso")` no comprarSemTeste. Nunca lança. */
export async function registrarCompraNoSdk(resultado: unknown, produto: ProdutoDaLoja, origem: string): Promise<DesfechoCompraNoSdk> {
  try {
    if (plataformaApp() !== "ios") return "nao_ios";
    if (!metaCompraSdkLigado()) return "desligado";
    const d = decidirCompraNoSdk(resultado, produto);
    if (d.mandar === false) {
      const { motivo } = d as Extract<DecisaoCompraNoSdk, { mandar: false }>;
      trackEvent("meta_sdk_compra", { ok: false, motivo, origem });
      return motivo;
    }
    const { registerPlugin } = await import("@capacitor/core");
    const MetaAds = registerPlugin<{ logCompra(o: CompraNoSdk): Promise<{ ok: boolean }> }>("MetaAds");
    // Marca ANTES de chamar: o pior caso de um erro aqui é perder 1 evento, nunca mandar 2 vezes.
    marcarEnviado(d.evento.pedido);
    const r = await MetaAds.logCompra(d.evento);
    const ok = !!r?.ok;
    trackEvent("meta_sdk_compra", { ok, origem, produto: d.evento.produto, valor: d.evento.valor, tx: d.evento.pedido });
    return ok ? "enviado" : "sem_sdk";
  } catch {
    return "erro";
  }
}
