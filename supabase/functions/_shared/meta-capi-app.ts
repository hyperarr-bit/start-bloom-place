/**
 * Atribuição Meta do app — regras puras (10/10/2026).
 *
 * Sem Deno e sem rede: o `meta-backfill-app` e o `revenuecat-webhook` aplicam
 * isto, e o vitest trava o dedup. O bug de agosto (StartTrial ×36–96) nasceu
 * de marcador lido com erro e tratado como "não enviado". Aqui, erro de
 * leitura é "não manda".
 *
 * event_id estável = original_transaction_id do RevenueCat (o mesmo do teste
 * até a cobrança e até o TRANSFER anônimo→conta). StartTrial e Purchase
 * usam esse id com NOMES diferentes — a Meta deduplica por (event_name,
 * event_id), então os dois não colidem entre si, e o TRANSFER não cria um
 * segundo StartTrial.
 *
 * Campos da CAPI de app (não hashear ip, ua, anon_id, madid, vendor_id):
 * - user_data.anon_id  ← $fbAnonId (install id do SDK)
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 * - user_data.madid    ← $idfa (iOS) ou GAID (Android). Não hashear.
 * - user_data.client_ip_address + client_user_agent SÓ EM PAR (um sozinho
 *   a Meta descarta — o mesmo contrato de cakto-webhook / pix-reconcile)
 * - app_data.vendor_id ← $idfv (Identifier for Vendor)
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/app-data
 * - exemplo de payload de app:
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/app-events
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const JANELA_VARREDURA_MS = 7 * 86_400_000;
/** LGPD aprovada em 10/10: IP do aparelho só pelo prazo em que a Meta ainda aceita o evento. */
export const RETENCAO_IP_MS = 10 * 86_400_000;
export const MARCADOR_TRIAL = "meta_capi_trial_enviado";
export const MARCADOR_COMPRA = "meta_capi_app_enviado";

/** Mesma regra do meta-backfill-app: conta de teste não entra na Meta. */
export const EMAIL_TESTE = /(^|[+.])teste|testeghg|jv20101958/i;

const ID_ZERADO = /^0{8}-0{4}-0{4}-0{4}-0{12}$/i;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

/**
 * Espelho do mapa do revenuecat-webhook (chave MAIS LONGA). Trial do RC vem
 * com preço 0 — o valor que a Meta recebe é o do catálogo, não o do evento.
 * Produto desconhecido NÃO vira 159,90 (isso já envenenou campanha).
 */
const CATALOGO: Record<string, { billing: string; cents: number }> = {
  "core_mensal:coremensalpix": { billing: "monthly_prepaid", cents: 1990 },
  "core_mensal:coremensalvista": { billing: "monthly_prepaid", cents: 2490 },
  "core_anual:coreanual97": { billing: "annual_prepaid", cents: 9790 },
  "core_anual:coreanualvista": { billing: "annual_prepaid", cents: 15990 },
  core_anual_97: { billing: "annual", cents: 9790 },
  core_anual_69: { billing: "annual", cents: 6990 },
  core_anual: { billing: "annual", cents: 15990 },
  core_mensal: { billing: "monthly", cents: 2490 },
  core_vitalicio_19: { billing: "lifetime", cents: 1990 },
  core_vitalicio_97: { billing: "lifetime", cents: 9790 },
  core_vitalicio: { billing: "lifetime", cents: 2790 },
};

export const catalogoDoProduto = (productId: string | null | undefined): { billing: string; cents: number } | null => {
  const id = String(productId ?? "");
  const chave = Object.keys(CATALOGO).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return chave ? CATALOGO[chave] : null;
};

export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export const ehEmailTeste = (email: string | null | undefined): boolean =>
  !!email && EMAIL_TESTE.test(email);

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
};

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];

const unico = (xs: Array<string | null | undefined>): string[] => {
  const out: string[] = [];
  for (const x of xs) {
    const s = str(x);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
};

/** Valor de subscriber_attributes: string crua ou `{ value }` (formato do RC). */
export const valorAtributo = (attrs: unknown, chave: string): string | null => {
  if (!attrs || typeof attrs !== "object") return null;
  const v = (attrs as Record<string, unknown>)[chave];
  if (typeof v === "string") return str(v);
  if (v && typeof v === "object" && "value" in v) return str((v as { value?: unknown }).value);
  return null;
};

export const emailDeAtributos = (attrs: unknown): string | null => {
  const e = valorAtributo(attrs, "$email") ?? valorAtributo(attrs, "email");
  return e ? e.toLowerCase() : null;
};

const idUtil = (v: string | null): string | null => {
  if (!v) return null;
  if (ID_ZERADO.test(v)) return null;
  return v;
};

/**
 * $fbAnonId → anon_id (user_data). $idfa → madid (user_data). $idfv →
 * vendor_id (app_data). GAID da ficha entra como madid quando não há IDFA.
 * IDFA zerado (ATT negado) não apaga um GAID que já exista.
 */
export interface SinaisAparelho {
  anon_id: string | null;
  madid: string | null;
  vendor_id: string | null;
}

export const sinaisDeAtributos = (
  attrs: unknown,
  ficha?: { anon_id?: string | null; gaid?: string | null } | null,
): SinaisAparelho => {
  const fb = idUtil(valorAtributo(attrs, "$fbAnonId") ?? valorAtributo(attrs, "fbAnonId"));
  const idfa = idUtil(valorAtributo(attrs, "$idfa") ?? valorAtributo(attrs, "idfa"));
  const idfv = idUtil(valorAtributo(attrs, "$idfv") ?? valorAtributo(attrs, "idfv"));
  const gaid = idUtil(str(ficha?.gaid ?? null));
  const anonFicha = idUtil(str(ficha?.anon_id ?? null));
  return {
    anon_id: fb ?? anonFicha,
    madid: idfa ?? gaid,
    vendor_id: idfv,
  };
};

export const ipValido = (ip: string | null | undefined): boolean => {
  const s = str(ip);
  if (!s || s.length > 45) return false;
  if (s === "0.0.0.0" || s === "::" || s === "127.0.0.1" || s === "::1") return false;
  if (IPV4.test(s)) return true;
  return s.includes(":") && /^[0-9a-f:]+$/i.test(s);
};

/**
 * Meta: client_ip_address e client_user_agent só valem juntos.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */
export const parIpUa = (
  ip: string | null | undefined,
  ua: string | null | undefined,
): { client_ip_address: string; client_user_agent: string } | null => {
  const u = str(ua);
  if (!u || u.length < 8 || !ipValido(ip)) return null;
  return { client_ip_address: str(ip) as string, client_user_agent: u.slice(0, 400) };
};

/** x-forwarded-for (primeiro salto = cliente) e, na falta, cf-connecting-ip. Igual ao cakto-pix. */
export const ipDoCabecalho = (xff: string | null | undefined, cf: string | null | undefined): string | null => {
  const bruto = str(xff) ?? str(cf) ?? "";
  const primeiro = bruto.split(",")[0]?.trim() ?? "";
  return ipValido(primeiro) ? primeiro : null;
};

export const expiraIp = (agora = Date.now()): string => new Date(agora + RETENCAO_IP_MS).toISOString();

export interface LinhaSinal {
  user_id?: string | null;
  rc_app_user_id?: string | null;
  session_id?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
  expira_em?: string | null;
}

/** O mais recente NÃO expirado que tenha o par. Linha sem prazo não serve (retenção). */
export const escolherSinal = (linhas: LinhaSinal[], agora = Date.now()): { client_ip_address: string; client_user_agent: string } | null => {
  const vivas = linhas
    .filter((l) => {
      const exp = l.expira_em ? Date.parse(l.expira_em) : NaN;
      return Number.isFinite(exp) && exp > agora && !!parIpUa(l.client_ip, l.user_agent);
    })
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  const top = vivas[0];
  return top ? parIpUa(top.client_ip, top.user_agent) : null;
};

export interface EventoAppRC {
  event_type?: string | null;
  type?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  store?: string | null;
  period_type?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  purchased_at?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  price_cents?: number | null;
  price_in_purchased_currency?: number | null;
  price?: number | null;
  currency?: string | null;
  is_trial_conversion?: boolean | null;
  subscriber_attributes?: Record<string, unknown> | null;
  environment?: string | null;
  rc_event_id?: string | null;
  id?: string | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  user_id?: string | null;
}

/** Aceita a coluna plana desta migration ou um jsonb `payload`/`raw`/`event` no formato do webhook. */
export const normalizarEvento = (row: Record<string, unknown>): EventoAppRC => {
  const blob = [row.payload, row.raw, row.event].find((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown> | undefined;
  const base: Record<string, unknown> = { ...(blob ?? {}), ...row };
  const ms = typeof base.purchased_at_ms === "number" ? base.purchased_at_ms : null;
  const purchased = str(base.purchased_at) ?? (ms ? new Date(ms).toISOString() : null);
  return {
    event_type: str(base.event_type) ?? str(base.type),
    type: str(base.type) ?? str(base.event_type),
    app_user_id: str(base.app_user_id),
    original_app_user_id: str(base.original_app_user_id),
    aliases: arr(base.aliases),
    product_id: str(base.product_id),
    store: str(base.store),
    period_type: str(base.period_type),
    transaction_id: str(base.transaction_id),
    original_transaction_id: str(base.original_transaction_id),
    purchased_at: purchased,
    purchased_at_ms: ms,
    price_cents: typeof base.price_cents === "number" ? base.price_cents : null,
    price_in_purchased_currency: typeof base.price_in_purchased_currency === "number" ? base.price_in_purchased_currency : null,
    price: typeof base.price === "number" ? base.price : null,
    currency: str(base.currency),
    is_trial_conversion: base.is_trial_conversion === true,
    subscriber_attributes: (base.subscriber_attributes && typeof base.subscriber_attributes === "object")
      ? base.subscriber_attributes as Record<string, unknown>
      : null,
    environment: str(base.environment),
    rc_event_id: str(base.rc_event_id) ?? str(base.id),
    id: str(base.id) ?? str(base.rc_event_id),
    transferred_from: arr(base.transferred_from),
    transferred_to: arr(base.transferred_to),
    user_id: ehUuid(base.user_id) ? base.user_id : null,
  };
};

export const idsDoAssinante = (ev: EventoAppRC): { userId: string | null; anonimo: boolean; appUserId: string } => {
  const ids = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_to ?? [])];
  const userId = ev.user_id && ehUuid(ev.user_id) ? ev.user_id : (ids.find((x): x is string => ehUuid(x)) ?? null);
  const appUserId = str(ev.app_user_id) ?? str(ev.original_app_user_id) ?? userId ?? "";
  return { userId, anonimo: !userId, appUserId };
};

/** original_transaction_id primeiro: é o que não muda no TRANSFER. */
export const chavesDedup = (ev: Pick<EventoAppRC, "original_transaction_id" | "transaction_id" | "rc_event_id" | "id">): string[] =>
  unico([ev.original_transaction_id, ev.transaction_id, ev.rc_event_id, ev.id]);

export const eventIdEstavel = (ev: Pick<EventoAppRC, "original_transaction_id" | "transaction_id" | "rc_event_id" | "id">): string | null =>
  chavesDedup(ev)[0] ?? null;

const plataformaDaLoja = (store: string | null | undefined): "ios" | "android" | null => {
  const s = String(store ?? "").toUpperCase();
  if (s === "APP_STORE" || s === "MAC_APP_STORE") return "ios";
  if (s === "PLAY_STORE") return "android";
  return null;
};

export type ClasseApp =
  | { tipo: "ignorar"; motivo: string }
  | {
      tipo: "trial" | "purchase";
      eventId: string;
      chaves: string[];
      cents: number;
      billing: string;
      quando: string;
      anonimo: boolean;
      userId: string | null;
      appUserId: string;
      produto: string;
      email: string | null;
      plataforma: "ios" | "android";
      atributos: Record<string, unknown> | null;
    };

export const classificarEventoApp = (bruto: EventoAppRC | Record<string, unknown>): ClasseApp => {
  const ev = "event_type" in bruto || "app_user_id" in bruto ? bruto as EventoAppRC : normalizarEvento(bruto as Record<string, unknown>);
  const tipoEv = String(ev.event_type ?? ev.type ?? "").toUpperCase();
  if (!tipoEv || tipoEv === "TEST") return { tipo: "ignorar", motivo: "teste_ou_vazio" };
  if (String(ev.environment ?? "").toUpperCase() === "SANDBOX") return { tipo: "ignorar", motivo: "sandbox" };
  if (tipoEv === "TRANSFER" || tipoEv === "CANCELLATION" || tipoEv === "EXPIRATION" || tipoEv === "BILLING_ISSUE") {
    return { tipo: "ignorar", motivo: tipoEv.toLowerCase() };
  }
  const plataforma = plataformaDaLoja(ev.store);
  if (!plataforma) return { tipo: "ignorar", motivo: "loja" };
  const eventId = eventIdEstavel(ev);
  if (!eventId) return { tipo: "ignorar", motivo: "sem_transaction_id" };
  const email = emailDeAtributos(ev.subscriber_attributes);
  if (ehEmailTeste(email)) return { tipo: "ignorar", motivo: "email_teste" };
  const cat = catalogoDoProduto(ev.product_id);
  if (!cat) return { tipo: "ignorar", motivo: "produto_desconhecido" };
  const periodo = String(ev.period_type ?? "").toUpperCase();
  const precoEvento = typeof ev.price_in_purchased_currency === "number"
    ? ev.price_in_purchased_currency
    : (typeof ev.price === "number" ? ev.price : (typeof ev.price_cents === "number" ? ev.price_cents / 100 : null));
  const quem = idsDoAssinante(ev);
  const base = {
    eventId,
    chaves: chavesDedup(ev),
    cents: cat.cents,
    billing: cat.billing,
    quando: ev.purchased_at ?? new Date().toISOString(),
    anonimo: quem.anonimo,
    userId: quem.userId,
    appUserId: quem.appUserId,
    produto: String(ev.product_id ?? ""),
    email,
    plataforma,
    atributos: ev.subscriber_attributes ?? null,
  };
  const trial = periodo === "TRIAL" || periodo === "INTRO" || precoEvento === 0 || precoEvento === null;
  if (tipoEv === "INITIAL_PURCHASE") {
    return trial ? { tipo: "trial", ...base } : { tipo: "purchase", ...base };
  }
  if (tipoEv === "NON_RENEWING_PURCHASE") return { tipo: "purchase", ...base };
  if (tipoEv === "RENEWAL") {
    if (precoEvento !== null && precoEvento <= 0 && !ev.is_trial_conversion) return { tipo: "ignorar", motivo: "renewal_sem_valor" };
    if (ev.is_trial_conversion || (precoEvento !== null && precoEvento > 0)) return { tipo: "purchase", ...base };
    return { tipo: "ignorar", motivo: "renewal_sem_valor" };
  }
  return { tipo: "ignorar", motivo: `tipo_${tipoEv.toLowerCase()}` };
};

/** Linha pra `revenuecat_events`. null = não gravar (TEST / vazio). Idempotente pela rc_event_id. */
export const linhaRevenueCat = (bruto: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  const ev = (bruto?.event && typeof bruto.event === "object" ? bruto.event : bruto) as Record<string, unknown> | null | undefined;
  if (!ev || typeof ev !== "object") return null;
  const tipo = str(ev.type) ?? str(ev.event_type);
  if (!tipo || tipo.toUpperCase() === "TEST") return null;
  const norm = normalizarEvento(ev);
  const quem = idsDoAssinante(norm);
  const moeda = String(norm.currency ?? "").toUpperCase();
  const preco = typeof norm.price_in_purchased_currency === "number"
    ? norm.price_in_purchased_currency
    : (typeof norm.price === "number" ? norm.price : null);
  const priceCents = moeda === "BRL" && preco !== null ? Math.round(preco * 100) : (typeof norm.price_cents === "number" ? norm.price_cents : null);
  const purchasedMs = typeof ev.purchased_at_ms === "number" ? ev.purchased_at_ms : null;
  const expirationMs = typeof ev.expiration_at_ms === "number" ? ev.expiration_at_ms : null;
  const rcEventId = str(ev.id) ?? str(ev.rc_event_id);
  return {
    rc_event_id: rcEventId,
    event_type: tipo,
    app_user_id: norm.app_user_id,
    original_app_user_id: norm.original_app_user_id,
    aliases: norm.aliases ?? [],
    product_id: norm.product_id,
    store: norm.store,
    period_type: norm.period_type,
    transaction_id: norm.transaction_id,
    original_transaction_id: norm.original_transaction_id,
    purchased_at: purchasedMs ? new Date(purchasedMs).toISOString() : norm.purchased_at,
    expiration_at: expirationMs ? new Date(expirationMs).toISOString() : null,
    price_cents: priceCents,
    currency: norm.currency,
    is_trial_conversion: norm.is_trial_conversion === true,
    subscriber_attributes: norm.subscriber_attributes ?? {},
    transferred_from: norm.transferred_from ?? [],
    transferred_to: norm.transferred_to ?? [],
    environment: norm.environment,
    anonimo: quem.anonimo,
    user_id: quem.userId,
  };
};

export interface MarcadorCapi {
  event_name: string;
  tx: string;
  chaves?: string[];
}

export const marcadorDoTipo = (tipo: "trial" | "purchase"): string =>
  tipo === "trial" ? MARCADOR_TRIAL : MARCADOR_COMPRA;

/** true se QUALQUER chave já está num marcador desse evento. Erro de leitura não entra aqui — quem lê o banco usa decidirReenvio. */
export const jaEnviado = (marcadores: MarcadorCapi[], eventName: string, chaves: string[]): boolean => {
  const set = new Set(chaves.filter(Boolean));
  if (!set.size) return false;
  return marcadores.some((m) => {
    if (m.event_name !== eventName) return false;
    if (set.has(m.tx)) return true;
    return (m.chaves ?? []).some((c) => set.has(c));
  });
};

/**
 * Erro ao ler o marcador = não manda. Foi o furo do ×36–96: maybeSingle
 * estourava, o erro era ignorado e o cron reenviava para sempre.
 */
export const decidirReenvio = (opts: { jaMarcado: boolean; erroLeitura: boolean; forcar?: boolean }): "enviar" | "pular" => {
  if (opts.forcar) return "enviar";
  if (opts.erroLeitura || opts.jaMarcado) return "pular";
  return "enviar";
};

/**
 * Cron com a chave anônima NÃO liga envio por body. Só admin (cron=false)
 * com `enviar: true`, ou o env META_VARREDURA_ENVIAR=1 (operador, de propósito).
 */
export const varreduraPodeEnviar = (opts: { cron: boolean; bodyEnviar: boolean; envEnviar: boolean }): boolean => {
  if (opts.envEnviar) return true;
  return !opts.cron && opts.bodyEnviar;
};

/** Fora do ar até o operador ver a lista. Auto-log do SDK ainda cobre o anônimo. */
export const cronEnviaAnonimos = (env: string | undefined | null): boolean =>
  env === "1" || env === "true";

export interface AssinaturaLoja {
  user_id: string | null;
  customer_email?: string | null;
  amount_cents?: number | null;
  revenuecat_subscription_id: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
  billing_period?: string | null;
}

export interface FaltanteCapi {
  fonte: "subscriptions" | "revenuecat_events";
  tipo: "trial" | "purchase";
  tx: string;
  produto: string | null;
  quando: string | null;
  anonimo: boolean;
  confirmar_cobranca?: boolean;
}

const periodoCurto = (ini: string | null | undefined, fim: string | null | undefined): { curto: boolean; venceu: boolean } => {
  const a = ini ? Date.parse(ini) : NaN;
  const b = fim ? Date.parse(fim) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return { curto: false, venceu: false };
  const curto = b - a < 10 * 86_400_000;
  return { curto, venceu: b <= Date.now() };
};

/**
 * Chaves do MESMO começo de assinatura. O `sub…` da tabela e o
 * original_transaction_id do webhook são ids diferentes; casar os dois pelo
 * usuário inteiro juntaria um upgrade (outra assinatura) no mesmo saco e o
 * marcador de uma apagaria a outra. A compra original fica a poucos minutos
 * do `current_period_start` — 24 h separa isso da conversão do teste (3–7 dias).
 */
export const chavesDaAssinatura = (eventos: EventoAppRC[], userId: string, inicioIso: string | null | undefined): string[] => {
  const inicio = inicioIso ? Date.parse(inicioIso) : NaN;
  const anons = new Set<string>();
  for (const ev of eventos) {
    const ids = unico([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])]);
    if (!ids.includes(userId)) continue;
    for (const id of ids) if (id.startsWith("$RCAnonymousID")) anons.add(id);
  }
  const chaves: string[] = [];
  for (const ev of eventos) {
    const ids = unico([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])]);
    if (!ids.includes(userId) && !ids.some((id) => anons.has(id))) continue;
    const quando = ev.purchased_at ? Date.parse(ev.purchased_at) : NaN;
    if (Number.isFinite(inicio) && Number.isFinite(quando) && Math.abs(quando - inicio) > 24 * 3_600_000) continue;
    if (!Number.isFinite(quando)) continue;
    for (const c of chavesDedup(ev)) if (!chaves.includes(c)) chaves.push(c);
  }
  return chaves;
};

/**
 * user CORE → chaves de transação dos eventos anônimos que chegaram nele
 * (aliases ou TRANSFER). É o que impede o StartTrial do `sub…` depois que o
 * mesmo teste já saiu com o original_transaction_id.
 */
export const chavesPorUsuarioCore = (eventos: EventoAppRC[]): Map<string, string[]> => {
  const porId = new Map<string, string[]>();
  const add = (id: string | null | undefined, chaves: string[]) => {
    const k = str(id);
    if (!k || !chaves.length) return;
    const arrAtual = porId.get(k) ?? [];
    for (const c of chaves) if (!arrAtual.includes(c)) arrAtual.push(c);
    porId.set(k, arrAtual);
  };
  for (const ev of eventos) {
    const chaves = chavesDedup(ev);
    const ids = unico([
      ev.app_user_id, ev.original_app_user_id,
      ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? []),
    ]);
    for (const id of ids) add(id, chaves);
  }
  for (const ev of eventos) {
    const uuids = unico([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_to ?? [])]).filter(ehUuid);
    const anons = unico([...(ev.transferred_from ?? []), ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])])
      .filter((id) => id.startsWith("$RCAnonymousID"));
    for (const uid of uuids) {
      for (const anon of anons) add(uid, porId.get(anon) ?? []);
    }
  }
  const out = new Map<string, string[]>();
  for (const [id, chaves] of porId) if (ehUuid(id)) out.set(id, chaves);
  return out;
};

const dentro = (iso: string | null | undefined, desdeMs: number): boolean => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && t >= desdeMs;
};

/**
 * O que a varredura mostra e o que o envio anônimo pode mandar.
 * Assinatura com conta continua dona do event_id histórico (`sub…`): o
 * evento anônimo ligado a ela não vira uma segunda linha.
 */
export const listarFaltantes = (opts: {
  assinaturas: AssinaturaLoja[];
  eventos: Array<EventoAppRC | Record<string, unknown>>;
  marcadores: MarcadorCapi[];
  agora?: number;
  janelaMs?: number;
}): FaltanteCapi[] => {
  const agora = opts.agora ?? Date.now();
  const desde = agora - (opts.janelaMs ?? JANELA_VARREDURA_MS);
  const eventos = opts.eventos.map((e) => ("app_user_id" in e && "event_type" in e ? e as EventoAppRC : normalizarEvento(e as Record<string, unknown>)));
  const faltantes: FaltanteCapi[] = [];
  const vistos = new Set<string>();
  const push = (f: FaltanteCapi) => {
    const k = `${f.tipo}:${f.tx}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    faltantes.push(f);
  };

  for (const a of opts.assinaturas) {
    if (ehEmailTeste(a.customer_email)) continue;
    const tx = str(a.revenuecat_subscription_id);
    if (!tx || !a.user_id) continue;
    if (!dentro(a.created_at, desde) && !dentro(a.current_period_start, desde)) continue;
    const relacionadas = unico([tx, ...chavesDaAssinatura(eventos, a.user_id, a.current_period_start ?? a.created_at)]);
    const per = periodoCurto(a.current_period_start, a.current_period_end);
    const quando = a.current_period_start ?? a.created_at ?? null;
    if (per.curto) {
      if (!jaEnviado(opts.marcadores, MARCADOR_TRIAL, relacionadas)) {
        push({ fonte: "subscriptions", tipo: "trial", tx, produto: a.billing_period ?? null, quando, anonimo: false });
      }
      if (per.venceu && !jaEnviado(opts.marcadores, MARCADOR_COMPRA, relacionadas)) {
        push({
          fonte: "subscriptions", tipo: "purchase", tx, produto: a.billing_period ?? null, quando, anonimo: false,
          confirmar_cobranca: true,
        });
      }
    } else if (!jaEnviado(opts.marcadores, MARCADOR_COMPRA, relacionadas)) {
      push({ fonte: "subscriptions", tipo: "purchase", tx, produto: a.billing_period ?? null, quando, anonimo: false });
    }
  }

  for (const ev of eventos) {
    const quandoEv = ev.purchased_at;
    if (!dentro(quandoEv, desde)) continue;
    const classe = classificarEventoApp(ev);
    if (classe.tipo === "ignorar") continue;
    const nome = marcadorDoTipo(classe.tipo);
    const dono = classe.userId
      ? opts.assinaturas.find((a) => a.user_id === classe.userId && str(a.revenuecat_subscription_id))
      : undefined;
    const chavesDono = unico([
      ...classe.chaves,
      ...(classe.userId ? chavesDaAssinatura(eventos, classe.userId, classe.quando) : []),
      ...(dono?.revenuecat_subscription_id ? [dono.revenuecat_subscription_id] : []),
    ]);
    if (jaEnviado(opts.marcadores, nome, chavesDono)) continue;
    // TRANSFER: o marcador pode estar no `sub…` e o evento ainda no original_transaction_id.
    // Se alguma assinatura carregada é dona dessas chaves, a linha dela representa o buraco.
    let coberto = false;
    for (const s of opts.assinaturas) {
      if (!s.user_id || !str(s.revenuecat_subscription_id)) continue;
      const rel = chavesDaAssinatura(eventos, s.user_id, s.current_period_start ?? s.created_at);
      if (!classe.chaves.some((c) => rel.includes(c))) continue;
      const txSub = str(s.revenuecat_subscription_id) as string;
      if (jaEnviado(opts.marcadores, nome, unico([txSub, ...rel, ...classe.chaves]))) coberto = true;
      else if (dentro(s.created_at, desde) || dentro(s.current_period_start, desde)) coberto = true;
      if (coberto) break;
    }
    if (coberto) continue;
    if (!classe.anonimo && dono) continue;
    push({
      fonte: "revenuecat_events",
      tipo: classe.tipo,
      tx: classe.eventId,
      produto: classe.produto,
      quando: classe.quando,
      anonimo: classe.anonimo,
    });
  }
  return faltantes;
};

/** Envio pelo caminho anônimo: sem conta, sem marcador, e nenhuma assinatura já dona dessas chaves. */
export const deveEnviarComoAnonimo = (
  classe: ClasseApp,
  marcadores: MarcadorCapi[],
  assinaturas: AssinaturaLoja[],
  eventos: EventoAppRC[] = [],
): boolean => {
  if (classe.tipo === "ignorar" || !classe.anonimo) return false;
  if (ehEmailTeste(classe.email)) return false;
  const nome = marcadorDoTipo(classe.tipo);
  if (jaEnviado(marcadores, nome, classe.chaves)) return false;
  for (const a of assinaturas) {
    if (!a.user_id || !a.revenuecat_subscription_id) continue;
    const rel = chavesDaAssinatura(eventos, a.user_id, a.current_period_start ?? a.created_at);
    if (classe.chaves.some((c) => rel.includes(c))) return false;
  }
  return true;
};
