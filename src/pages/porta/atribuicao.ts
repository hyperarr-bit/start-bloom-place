/**
 * ATRIBUIÇÃO DA PORTA iPHONE (/comece, 10/10).
 *
 * O motivo da Porta: a conta nasce NO SITE, com a campanha gravada nela, antes
 * da App Store apagar o rastro. Este arquivo cuida de três coisas:
 *
 *   1. CAPTURA na 1ª carga: utm_*, fbclid, fbc (`fb.1.<ts>.<fbclid>` ou o
 *      cookie `_fbc`), `_fbp`, c_id/as_id/ad_id/pl (parâmetros do anúncio),
 *      a hora do clique e um `porta_session_id`.
 *   2. PERSISTÊNCIA à prova do Instagram: o navegador dele ZERA storage e
 *      cookies com a página viva (memória atribuicao_web_zerada_instagram,
 *      24/09). A cópia que vale é a do HEAP (sobrevive à zerada); localStorage,
 *      sessionStorage e um cookie próprio são re-semeados a cada leitura.
 *   3. O PACOTE que vai pra conta (`user_metadata.porta`), escrito UMA vez:
 *      nunca sobrescreve a 1ª atribuição da conta.
 *
 * Nada aqui importa Supabase nem React: é puro e testável.
 */

export const CHAVE_ATTR = "porta-attr-v1";
export const CHAVE_SESSAO = "porta-sessao-v1";
export const COOKIE_ATTR = "core_porta";

export type AtribuicaoPorta = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  /** `fb.1.<ts>.<fbclid>` — o elo com o clique que a Meta usa sem ATT */
  fbc: string;
  /** cookie `_fbp` do pixel (pode nascer depois da 1ª carga; relido na conta) */
  fbp: string;
  c_id: string;
  as_id: string;
  ad_id: string;
  pl: string;
  /** hora do clique (ms): a do `_fbc` se ele já existia, senão a da 1ª carga com fbclid/utm */
  ts: number;
  /** a URL de chegada (caminho + query, cortada) */
  landing: string;
  referrer: string;
  /** de onde veio a 1ª captura: "url" (o clique), "cookie_fbc" (só o _fbc sobrou), "nenhuma" */
  origem: "url" | "cookie_fbc" | "nenhuma";
};

const CAMPOS_URL = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "c_id", "as_id", "ad_id", "pl"] as const;
/** os parâmetros que dizem "isto é um clique de anúncio/campanha" */
const SINAIS = ["utm_source", "utm_campaign", "fbclid", "ad_id", "c_id"] as const;

let memoriaAttr: AtribuicaoPorta | null = null;
let memoriaSessao: string | null = null;

/** só pros testes: zera a memória do heap (simula página nova) */
export function _zerarMemoriaPorta(): void {
  memoriaAttr = null;
  memoriaSessao = null;
}

const corta = (s: unknown, n = 200): string => String(s ?? "").slice(0, n);

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
};
const ss = {
  get(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
};

function lerCookie(nome: string, cookie?: string): string {
  try {
    const c = cookie ?? (typeof document !== "undefined" ? document.cookie : "");
    const m = c.match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function gravarCookie(valor: string): void {
  try {
    // 30 dias, só o nosso domínio; SameSite=Lax pra sobreviver à volta do OAuth
    document.cookie = `${COOKIE_ATTR}=${encodeURIComponent(valor)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
  } catch { /* noop */ }
}

/** `_fbc` = fb.1.<ts>.<fbclid> → {fbclid, ts} */
export function partesDoFbc(fbc: string): { fbclid: string; ts: number } | null {
  const p = String(fbc || "").split(".");
  if (p.length < 4 || p[0] !== "fb") return null;
  const ts = Number(p[2]);
  const fbclid = p.slice(3).join(".");
  return fbclid && Number.isFinite(ts) ? { fbclid, ts } : null;
}

const temSinal = (a: Partial<AtribuicaoPorta> | null | undefined): boolean => !!a && SINAIS.some((k) => !!a[k]);

function valida(raw: string | null): AtribuicaoPorta | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as AtribuicaoPorta;
    return o && typeof o === "object" && "utm_source" in o ? o : null;
  } catch {
    return null;
  }
}

function guardar(a: AtribuicaoPorta): void {
  memoriaAttr = a;
  const j = JSON.stringify(a);
  ls.set(CHAVE_ATTR, j);
  ss.set(CHAVE_ATTR, j);
  gravarCookie(j);
}

/** A cópia guardada mais confiável: heap → localStorage → sessionStorage → cookie próprio. */
function guardada(cookie?: string): AtribuicaoPorta | null {
  return memoriaAttr ?? valida(ls.get(CHAVE_ATTR)) ?? valida(ss.get(CHAVE_ATTR)) ?? valida(lerCookie(COOKIE_ATTR, cookie) || null);
}

/**
 * Captura (ou relê) a atribuição. Chamada na 1ª carga da /comece e de novo
 * antes de gravar na conta. Regras:
 *   · a URL traz sinal de campanha → É o clique: vale ela (novo clique troca o antigo, como a Meta);
 *   · sem sinal na URL → a cópia guardada (heap primeiro), re-semeada no storage;
 *   · nada guardado → só o `_fbc` (se for de menos de 7 dias) ou vazio.
 * `fbp` é sempre relido do cookie (o pixel o cria depois da 1ª pintura).
 */
export function capturarAtribuicao(opts: { search?: string; cookie?: string; agora?: number; referrer?: string; caminho?: string } = {}): AtribuicaoPorta {
  const agora = opts.agora ?? Date.now();
  const search = opts.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const caminho = opts.caminho ?? (typeof window !== "undefined" ? window.location.pathname : "/comece");
  const referrer = opts.referrer ?? (typeof document !== "undefined" ? document.referrer : "");
  let p: URLSearchParams;
  try { p = new URLSearchParams(search); } catch { p = new URLSearchParams(); }
  const daUrl: Record<string, string> = {};
  for (const k of CAMPOS_URL) daUrl[k] = corta(p.get(k) ?? "", k === "utm_campaign" || k === "utm_content" ? 200 : 120);

  const cookieFbc = lerCookie("_fbc", opts.cookie);
  const cookieFbp = lerCookie("_fbp", opts.cookie);
  const antes = guardada(opts.cookie);

  if (temSinal(daUrl)) {
    // mesmo clique (mesmo fbclid) relido numa página nova: mantém a hora e o fbc da 1ª carga
    const mesmoClique = antes && antes.fbclid && antes.fbclid === daUrl.fbclid;
    const doCookie = partesDoFbc(cookieFbc);
    let fbc = "";
    let ts = agora;
    if (daUrl.fbclid) {
      if (mesmoClique && antes) { fbc = antes.fbc; ts = antes.ts; }
      else if (doCookie && doCookie.fbclid === daUrl.fbclid) { fbc = cookieFbc; ts = doCookie.ts; }
      else fbc = `fb.1.${agora}.${daUrl.fbclid}`;
    } else if (mesmoClique && antes) {
      ts = antes.ts;
    }
    const a: AtribuicaoPorta = {
      ...(daUrl as Pick<AtribuicaoPorta, (typeof CAMPOS_URL)[number]>),
      fbc,
      fbp: cookieFbp || antes?.fbp || "",
      ts,
      landing: corta(`${caminho}${search}`, 400),
      referrer: corta(referrer, 200),
      origem: "url",
    };
    guardar(a);
    return a;
  }

  if (antes) {
    // a origem fica a da 1ª captura ("url" = veio do clique): é ela que vai pra conta
    const a: AtribuicaoPorta = { ...antes, fbp: cookieFbp || antes.fbp || "" };
    guardar(a);
    return a;
  }

  const doCookie = partesDoFbc(cookieFbc);
  const recente = doCookie && agora - doCookie.ts < 7 * 86_400_000;
  const a: AtribuicaoPorta = {
    utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
    fbclid: recente ? doCookie!.fbclid : "",
    fbc: recente ? cookieFbc : "",
    fbp: cookieFbp,
    c_id: "", as_id: "", ad_id: "", pl: "",
    ts: recente ? doCookie!.ts : agora,
    landing: corta(`${caminho}${search}`, 400),
    referrer: corta(referrer, 200),
    origem: recente ? "cookie_fbc" : "nenhuma",
  };
  guardar(a);
  return a;
}

/** A atribuição guardada (sem capturar de novo); null se nunca houve captura. */
export function lerAtribuicao(): AtribuicaoPorta | null {
  const a = guardada();
  if (a && !memoriaAttr) memoriaAttr = a;
  if (a) {
    // re-semeia o que o Instagram apagou
    const j = JSON.stringify(a);
    if (!ls.get(CHAVE_ATTR)) ls.set(CHAVE_ATTR, j);
    if (!ss.get(CHAVE_ATTR)) ss.set(CHAVE_ATTR, j);
  }
  return a;
}

/** O id da sessão da Porta: heap → sessionStorage → o da URL (`ps`, quem veio do Instagram pro navegador) → novo.
 *  `nova` = acabou de nascer (dispara o porta_view). */
export function sessaoDaPorta(daUrl?: string | null): { id: string; nova: boolean } {
  if (memoriaSessao) {
    if (!ss.get(CHAVE_SESSAO)) ss.set(CHAVE_SESSAO, memoriaSessao);
    return { id: memoriaSessao, nova: false };
  }
  const salvo = ss.get(CHAVE_SESSAO);
  if (salvo) { memoriaSessao = salvo; return { id: salvo, nova: false }; }
  if (daUrl && /^[a-z0-9-]{8,64}$/i.test(daUrl)) { memoriaSessao = daUrl; ss.set(CHAVE_SESSAO, daUrl); return { id: daUrl, nova: false }; }
  let id: string;
  try { id = crypto.randomUUID(); } catch { id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
  memoriaSessao = id;
  ss.set(CHAVE_SESSAO, id);
  return { id, nova: true };
}

/** Os campos do anúncio que vão em TODO evento da Porta (o resto, utm_*, o trackEvent já junta). */
export function idsDoAnuncio(a: AtribuicaoPorta | null, sessao: string): Record<string, string> {
  return {
    porta_session_id: sessao,
    ...(a?.ad_id ? { ad_id: a.ad_id } : {}),
    ...(a?.as_id ? { as_id: a.as_id } : {}),
    ...(a?.c_id ? { c_id: a.c_id } : {}),
    ...(a?.utm_content ? { utm_content: a.utm_content } : {}),
  };
}

/** O que a Porta grava na conta (`user_metadata.porta`). */
export type PortaNaConta = {
  v: 1;
  attr: Omit<AtribuicaoPorta, "origem"> & { origem: AtribuicaoPorta["origem"] };
  /** p2/p3 = ids das opções; atrapalha/gasto/consistencia = o TEXTO da opção, como o app guarda */
  respostas: { area: string; rota: string; p2: string | null; p3: string | null; [chave: string]: string | null };
  criado_em: string;
  /** o eventID do CompleteRegistration do pixel (pra deduplicar com a CAPI depois) */
  event_id: string;
  porta_session_id: string;
  metodo: string;
};

export function montarPorta(args: {
  attr: AtribuicaoPorta;
  respostas: PortaNaConta["respostas"];
  eventId: string;
  sessao: string;
  metodo: string;
  agora?: number;
}): PortaNaConta {
  return {
    v: 1,
    attr: { ...args.attr, fbp: args.attr.fbp || lerCookie("_fbp") },
    respostas: args.respostas,
    criado_em: new Date(args.agora ?? Date.now()).toISOString(),
    event_id: args.eventId,
    porta_session_id: args.sessao,
    metodo: args.metodo,
  };
}

/**
 * Decide o que fazer com a conta depois da sessão:
 *   · a conta já tem `porta` desta MESMA sessão → foi o signUp desta
 *     página que a criou (o `data` só vale na criação): conta nova, nada a gravar;
 *   · tem `porta` de outra sessão → conta que já passou pela Porta: NUNCA sobrescreve;
 *   · não tem `porta` → grava (Google, Apple, conta que já existia e entrou com a senha).
 * `existente`: conta que já existia antes desta visita (criada há mais de 10 min).
 */
export function decidirGravacao(
  user: { created_at?: string | null; user_metadata?: Record<string, unknown> | null },
  sessao: string,
  agora: number = Date.now(),
): { gravar: boolean; existente: boolean } {
  const atual = (user.user_metadata as { porta?: { porta_session_id?: string } } | null | undefined)?.porta;
  const criada = user.created_at ? Date.parse(user.created_at) : NaN;
  const recente = Number.isFinite(criada) && agora - criada < 10 * 60 * 1000;
  if (atual && typeof atual === "object") {
    if (atual.porta_session_id === sessao) return { gravar: false, existente: false };
    return { gravar: false, existente: true };
  }
  return { gravar: true, existente: !recente };
}
