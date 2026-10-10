/**
 * O que o APP manda pra atribuição Meta (10/10, CAPI passos 3+4).
 *
 * Puro de propósito: o RevenueCat e o `capturarDispositivoApp` aplicam isto,
 * e o teste trava duas regras que não podem escorregar.
 *  - `$idfa` só no iPhone, e só quando o plugin devolveu um IDFA de verdade
 *    (ele já filtra ATT negado e o id zerado). No Android o GAID fica na
 *    ficha (`gaid`), não neste atributo.
 *  - o corpo do `app-capi-sinal` nunca leva IP. A função lê o header.
 *
 * Isto NÃO liga a integração nativa RevenueCat → Meta. São atributos no
 * webhook; quem envia o evento é o servidor.
 */

export const ID_ANUNCIO_ZERADO = "00000000-0000-0000-0000-000000000000";

export type IdsDoPluginMeta = {
  gaid?: string | null;
  anonId?: string | null;
  idfv?: string | null;
};

/** Id utilizável: vazio e o UUID zerado (opt-out / ATT negado) não entram. */
export const idDeAnuncio = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  if (!s || s.length > 200) return null;
  if (s.toLowerCase() === ID_ANUNCIO_ZERADO) return null;
  return s;
};

/**
 * Atributos que o webhook lê: `$fbAnonId`, e no iPhone `$idfv` / `$idfa`
 * quando o `collectDeviceIdentifiers` não rodou.
 *
 * Com `coletouDispositivo`, o SDK do RevenueCat já gravou `$idfv` e `$idfa`
 * (o `$idfa` só sai com ATT — o próprio SDK lê o identificador de anúncio).
 * `$fbAnonId` ele não conhece: vem do anonymousID da Meta.
 */
export const atributosDeAnuncio = (
  ids: IdsDoPluginMeta,
  opts: { plataforma: "ios" | "android" | "web"; coletouDispositivo: boolean },
): Record<string, string> => {
  const out: Record<string, string> = {};
  const anon = idDeAnuncio(ids.anonId);
  if (anon) out.$fbAnonId = anon;
  if (!opts.coletouDispositivo && opts.plataforma === "ios") {
    const idfv = idDeAnuncio(ids.idfv);
    if (idfv) out.$idfv = idfv;
    // `gaid` no iPhone É o IDFA, e o plugin só preenche com ATT autorizado.
    const idfa = idDeAnuncio(ids.gaid);
    if (idfa) out.$idfa = idfa;
  }
  return out;
};

const SESSAO_OK = /^[A-Za-z0-9_-]{8,80}$/;
const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RC_ANON_OK = /^\$RCAnonymousID:[A-Za-z0-9._:-]{4,120}$/;

/**
 * Corpo do POST `app-capi-sinal`. Só sessão e, se já houver, o id do
 * RevenueCat. IP, user-agent e qualquer outro campo não entram: o IP é
 * lido do header nesta requisição e mora ~10 dias na tabela.
 */
export const corpoDoSinalCapi = (
  sessionId: string,
  rcAppUserId?: string | null,
): Record<string, string> => {
  const body: Record<string, string> = {};
  if (SESSAO_OK.test(sessionId)) body.session_id = sessionId;
  const rc = (rcAppUserId ?? "").trim();
  if (UUID_OK.test(rc) || RC_ANON_OK.test(rc)) body.rc_app_user_id = rc;
  return body;
};
