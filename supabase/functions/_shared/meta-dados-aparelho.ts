/**
 * Dados do aparelho pro CAPI do app (iOS 1.0.17, 20/10/2026) — regras puras.
 *
 * O QUE ISTO RESOLVE: o StartTrial/Purchase do iPhone sai do SERVIDOR
 * (meta-backfill-app, cron de 15 min) só com external_id/e-mail em hash,
 * anon_id e extinfo. A Meta casa pouco. Com IP + user-agent do aparelho e o
 * IDFA (madid) ela casa muito mais — MAS a Apple só deixa usar isso pra
 * anúncio com o aceite do ATT. Então:
 *
 *   · ATT "authorized" → guarda IP, user-agent e IDFA (10 dias) e o CAPI
 *     manda advertiser_tracking_enabled 1 + client_ip_address +
 *     client_user_agent + madid.
 *   · qualquer outra resposta → guarda SÓ o status (sem IP, sem UA, sem
 *     IDFA, mesmo que o app mande) e o CAPI manda advertiser_tracking_enabled
 *     0, sem IP/UA/madid/vendor_id. O resto do payload fica como era.
 *
 * QUEM ESCREVE: `revenuecat-sync` (o app chama logo depois da compra, com a
 * sessão — inclusive no cadastro pós-compra do iPhone). O IP vem do header
 * da requisição (x-forwarded-for, 1º salto), NUNCA do corpo; o UA também.
 * Uma linha por (transação × mudança de status do ATT): o sync roda em toda
 * abertura, então sem isso seria uma linha por boot.
 *
 * QUEM LÊ: `meta-backfill-app` (ramo meta-capi-dados), na hora de montar o
 * evento. Vale a linha MAIS RECENTE da transação — se a pessoa revogou o ATT
 * nos Ajustes, a última linha diz "denied" e o IP não sai.
 *
 * ONDE MORA: tabela própria `meta_dados_aparelho` (migração
 * 20261020120000), sem policy pra anon/authenticated — ninguém forja um
 * "authorized" pela API pública (analytics_events aceita insert do próprio
 * usuário) e o IP não vaza pra telemetria. Retenção de 10 dias (mesma régua
 * da LGPD aprovada em 10/10: a Meta só aceita evento de até 7 dias). O cron
 * da migração apaga a linha vencida.
 *
 * ARQUIVO IGUAL nos ramos v1017-int (escreve) e meta-capi-dados (lê). Mexeu
 * num, copia pro outro.
 *
 * Doc da Meta (app events pela CAPI):
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/app-events
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/app-data
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

export const TABELA_DADOS_APARELHO = "meta_dados_aparelho";
/** IP/UA/IDFA só pelo prazo em que a Meta ainda aceita o evento (+ folga do teste de 7 dias). */
export const RETENCAO_DADOS_MS = 10 * 86_400_000;
/** O sync só grava pra assinatura/compra que começou dentro desta janela (o que o CAPI ainda vai mandar). */
export const JANELA_GRAVAR_MS = 10 * 86_400_000;

export const STATUS_ATT = ["authorized", "denied", "restricted", "notDetermined", "unknown"] as const;
export type StatusAtt = typeof STATUS_ATT[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZERADO = "00000000-0000-0000-0000-000000000000";
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const VERSAO = /^[0-9A-Za-z._ -]{1,32}$/;

const texto = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
};

export const statusAtt = (v: unknown): StatusAtt => {
  const s = texto(v);
  return s && (STATUS_ATT as readonly string[]).includes(s) ? s as StatusAtt : "unknown";
};

/** IDFA utilizável: UUID e não zerado (ATT negado devolve zeros). */
export const idfaValido = (v: unknown): string | null => {
  const s = texto(v);
  if (!s || !UUID.test(s) || s === ZERADO) return null;
  return s;
};

export const ipValido = (ip: unknown): boolean => {
  const s = texto(ip);
  if (!s || s.length > 45) return false;
  if (s === "0.0.0.0" || s === "::" || s === "127.0.0.1" || s === "::1") return false;
  if (IPV4.test(s)) return true;
  return s.includes(":") && /^[0-9a-f:]+$/i.test(s);
};

/** x-forwarded-for (1º salto = o aparelho) e, na falta, cf-connecting-ip. */
export const ipDoCabecalho = (xff: string | null | undefined, cf: string | null | undefined): string | null => {
  const bruto = texto(xff) ?? texto(cf) ?? "";
  const primeiro = bruto.split(",")[0]?.trim() ?? "";
  return ipValido(primeiro) ? primeiro : null;
};

/** A Meta só usa client_ip_address junto com client_user_agent: um sem o outro não vale. */
export const parIpUa = (
  ip: string | null | undefined,
  ua: string | null | undefined,
): { client_ip_address: string; client_user_agent: string } | null => {
  const u = texto(ua);
  if (!u || u.length < 8 || !ipValido(ip)) return null;
  return { client_ip_address: String(ip).trim(), client_user_agent: u.slice(0, 400) };
};

const versao = (v: unknown): string | null => {
  const s = texto(v);
  return s && VERSAO.test(s) ? s : null;
};

// ───────────────────────────── escrita (revenuecat-sync) ─────────────────────────────

export interface DadosAparelhoPedido {
  plataforma: "ios";
  att: StatusAtt;
  app_versao: string | null;
  app_build: string | null;
  os_versao: string | null;
  /** Só com att "authorized". */
  idfa: string | null;
  client_ip: string | null;
  user_agent: string | null;
}

/**
 * Corpo `aparelho` do app + headers → o que pode ser guardado. Só iPhone
 * (Android segue como hoje: GAID na ficha app_device_info). Sem ATT
 * autorizado, IP/UA/IDFA NÃO entram — mesmo que o corpo traga um IDFA.
 */
export const dadosDoPedido = (
  corpo: unknown,
  cab: { xff?: string | null; cf?: string | null; ua?: string | null },
): DadosAparelhoPedido | null => {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  if (c.plataforma !== "ios") return null;
  const att = statusAtt(c.att);
  const base: DadosAparelhoPedido = {
    plataforma: "ios",
    att,
    app_versao: versao(c.app_versao),
    app_build: versao(c.app_build),
    os_versao: versao(c.os_versao),
    idfa: null,
    client_ip: null,
    user_agent: null,
  };
  if (att !== "authorized") return base;
  const par = parIpUa(ipDoCabecalho(cab.xff, cab.cf), cab.ua);
  return {
    ...base,
    idfa: idfaValido(c.idfa),
    client_ip: par?.client_ip_address ?? null,
    user_agent: par?.client_user_agent ?? null,
  };
};

/** Assinatura/compra que o CAPI ainda vai mandar (começou há menos de 10 dias). Sem data = não grava. */
export const dentroDaJanela = (inicioIso: string | null | undefined, agora = Date.now()): boolean => {
  const t = inicioIso ? Date.parse(inicioIso) : NaN;
  return Number.isFinite(t) && t >= agora - JANELA_GRAVAR_MS && t <= agora + 86_400_000;
};

export interface UltimaLinhaDados {
  att?: string | null;
  idfa?: string | null;
  client_ip?: string | null;
}

/**
 * Uma linha por mudança: primeira vez, ATT mudou (aceitou ou revogou), ou
 * continua autorizado e agora chegou o IP/IDFA que faltava.
 */
export const precisaGravar = (ultima: UltimaLinhaDados | null | undefined, dados: DadosAparelhoPedido): boolean => {
  if (!ultima) return true;
  if (statusAtt(ultima.att) !== dados.att) return true;
  if (dados.att !== "authorized") return false;
  if (!ultima.client_ip && dados.client_ip) return true;
  if (!ultima.idfa && dados.idfa) return true;
  return false;
};

export const linhaDadosAparelho = (
  userId: string,
  tx: string,
  dados: DadosAparelhoPedido,
  agora = Date.now(),
): Record<string, unknown> => {
  const autorizado = dados.att === "authorized";
  return {
    user_id: userId,
    tx,
    plataforma: dados.plataforma,
    att: dados.att,
    idfa: autorizado ? dados.idfa : null,
    client_ip: autorizado ? dados.client_ip : null,
    user_agent: autorizado ? dados.user_agent : null,
    app_versao: dados.app_versao,
    app_build: dados.app_build,
    os_versao: dados.os_versao,
    expira_em: new Date(agora + RETENCAO_DADOS_MS).toISOString(),
  };
};

// ───────────────────────────── leitura (meta-backfill-app) ─────────────────────────────

export interface LinhaDadosAparelho {
  tx?: string | null;
  att?: string | null;
  idfa?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  app_versao?: string | null;
  app_build?: string | null;
  os_versao?: string | null;
  created_at?: string | null;
  expira_em?: string | null;
}

/** A linha MAIS RECENTE, não vencida, de qualquer chave da transação (sub… / original_transaction_id). */
export const dadosDaTransacao = (
  linhas: LinhaDadosAparelho[],
  chaves: Array<string | null | undefined>,
  agora = Date.now(),
): LinhaDadosAparelho | null => {
  const set = new Set(chaves.map((c) => texto(c)).filter((c): c is string => !!c));
  if (!set.size) return null;
  const vivas = linhas
    .filter((l) => {
      const tx = texto(l.tx);
      const exp = l.expira_em ? Date.parse(l.expira_em) : NaN;
      return !!tx && set.has(tx) && Number.isFinite(exp) && exp > agora;
    })
    .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0));
  return vivas[0] ?? null;
};

export interface SinaisPrivacidade {
  /** advertiser_tracking_enabled do app_data (0/1, como na doc da Meta). */
  ate: 0 | 1;
  madid: string | null;
  ipUa: { client_ip_address: string; client_user_agent: string } | null;
  vendorId: string | null;
  /** De onde veio a decisão — vai no log, nunca o valor. */
  fonte: "android" | "ios_autorizado" | "ios_sem_aceite" | "ios_sem_dados";
}

/**
 * A regra da Apple aplicada ao evento.
 *
 * Android: como sempre foi (madid do GAID, IP/UA do app_capi_sinais se houver).
 *
 * iPhone — o status do ATT vem da linha desta transação (`dados`) e, na
 * falta, da ficha app_device_info (`attFicha`, propriedade comum desde a 1.0.14):
 *   · authorized → ate 1; madid = IDFA da linha (ou o que já existia); IP/UA SÓ
 *     da linha (não do app_capi_sinais, que é gravado sem olhar o ATT).
 *   · outro status conhecido → ate 0; sem madid, IP/UA e vendor_id.
 *   · nenhum status (build antiga, linha vencida) → o de hoje: madid só se a
 *     ficha trouxe IDFA (o nativo só preenche com ATT aceito na hora da
 *     captura) e ate segue o madid; IP/UA e vendor_id não saem.
 */
export const sinaisPrivacidade = (o: {
  ios: boolean;
  dados: LinhaDadosAparelho | null;
  attFicha?: string | null;
  madidAtual: string | null;
  parSinal?: { client_ip_address: string; client_user_agent: string } | null;
  vendorId?: string | null;
}): SinaisPrivacidade => {
  const madidAtual = texto(o.madidAtual)?.toLowerCase() ?? null;
  if (!o.ios) {
    return { ate: madidAtual ? 1 : 0, madid: madidAtual, ipUa: o.parSinal ?? null, vendorId: o.vendorId ?? null, fonte: "android" };
  }
  const attLinha = o.dados ? statusAtt(o.dados.att) : null;
  const attFicha = texto(o.attFicha) ? statusAtt(o.attFicha) : null;
  const att = attLinha && attLinha !== "unknown" ? attLinha : (attFicha && attFicha !== "unknown" ? attFicha : null);
  if (att === "authorized") {
    const idfa = idfaValido(o.dados?.idfa)?.toLowerCase() ?? null;
    return {
      ate: 1,
      madid: idfa ?? madidAtual,
      ipUa: o.dados ? parIpUa(o.dados.client_ip, o.dados.user_agent) : null,
      vendorId: o.vendorId ?? null,
      fonte: "ios_autorizado",
    };
  }
  if (att) return { ate: 0, madid: null, ipUa: null, vendorId: null, fonte: "ios_sem_aceite" };
  return { ate: madidAtual ? 1 : 0, madid: madidAtual, ipUa: null, vendorId: null, fonte: "ios_sem_dados" };
};

/** extinfo: a ficha vence; a linha do sync preenche versão/build/SO quando a ficha não achou. */
export const versoesParaExtinfo = (
  ficha: { versao?: string; build?: string; os?: string },
  dados: LinhaDadosAparelho | null,
): { versao: string; build: string; os: string } => ({
  versao: texto(ficha.versao) ?? texto(dados?.app_versao) ?? "",
  build: texto(ficha.build) ?? texto(dados?.app_build) ?? "",
  os: texto(ficha.os) ?? texto(dados?.os_versao) ?? "",
});
