import { supabase } from "@/integrations/supabase/client";

// Persistent session id for the tab
const SESSION_KEY = "core_session_id";
const UTM_KEY = "core_utm";

const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

/** Captura UTM params da URL atual e persiste pra ficarem disponíveis durante toda a sessão (mesmo após o cadastro). */
export const captureLandingMeta = () => {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      // ID do clique do Meta Ads — repassado até o checkout da Cakto pra
      // fechar a atribuição da compra com o anúncio exato.
      fbclid: params.get("fbclid") || "",
      // ttclid = o fbclid do TikTok (16/08). Sem ele o Events API casa a
      // compra só por e-mail/IP e a atribuição ao ANÚNCIO se perde — mesmo
      // buraco que a gente tapou na Meta em 12/08.
      ttclid: params.get("ttclid") || "",
      // IDs de clique do Google Ads. gclid é o padrão; gbraid/wbraid são os
      // equivalentes que o Google manda no iOS/Safari quando não pode usar gclid.
      gclid: params.get("gclid") || "",
      gbraid: params.get("gbraid") || "",
      wbraid: params.get("wbraid") || "",
      referrer: document.referrer || "",
      path: window.location.pathname,
    };
    // Só persiste se vier algo de novo (não sobrescreve UTM original com vazio)
    const existing = localStorage.getItem(UTM_KEY);
    if (!existing || utm.utm_source || utm.fbclid || utm.ttclid || utm.gclid || utm.gbraid || utm.wbraid) {
      localStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
    return utm;
  } catch {
    return {};
  }
};

/**
 * Install Referrer da Play (06/08). O 1º dia de campanha rodou CEGO: todo
 * evento do app chega com utm vazio, então R$79 de anúncio e instalação
 * orgânica são indistinguíveis. A Play entrega os utm do link da campanha
 * via Install Referrer — uma vez por instalação. Emite `install_referrer`
 * sempre (mesmo orgânico, ex.: "utm_source=google-play&utm_medium=organic")
 * e funde utm_* no core_utm quando a campanha mandou algo e ainda não há
 * fonte gravada. Só roda no shell; na web o plugin rejeita e fica o silêncio.
 */
const REFERRER_FLAG = "core_install_referrer_done";
export const captureInstallReferrer = async () => {
  try {
    if (localStorage.getItem(REFERRER_FLAG)) return;
    const { InstallReferrer } = await import("@capgo/capacitor-install-referrer");
    const res = (await InstallReferrer.getReferrer()) as { referrer?: string };
    // flag só depois de resolver: falha transitória do serviço da Play
    // (raro, mas existe) tenta de novo no próximo boot.
    localStorage.setItem(REFERRER_FLAG, "1");
    const bruto = String(res?.referrer || "");
    /*
     * INTEIRO, sem cortar (13/08). O `slice(0, 400)` daqui cortava o referrer
     * no meio do payload criptografado: dentro de `utm_content.source.data` a
     * Meta manda campanha, conjunto e ad_id cifrados, e esse blob sozinho
     * passa de 400 caracteres. Resultado: com a chave de descriptografia em
     * mãos, NENHUM referrer abria — o JSON chegava sem fechamento. Meses de
     * instalação sem saber de qual anúncio vieram, e o dado não volta.
     * 2000 é folga sobre o maior referrer real (~700) sem virar campo aberto.
     */
    trackEvent("install_referrer", { referrer: bruto.slice(0, 2000) });
    if (!bruto.includes("utm_")) return;
    const p = new URLSearchParams(bruto);
    const existing = JSON.parse(localStorage.getItem(UTM_KEY) || "{}");
    if (existing.utm_source) return; // atribuição da web (funil→app) vence
    localStorage.setItem(UTM_KEY, JSON.stringify({
      ...existing,
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
      utm_content: p.get("utm_content") || "",
      gclid: existing.gclid || p.get("gclid") || "",
    }));
  } catch {
    // web / emulador sem Play Services: nada a fazer
  }
};

/**
 * FICHA DO APARELHO pro CAPI de app da Meta (08/08).
 *
 * A Meta EXIGE `extinfo` em evento de app — um array de 16 posições com
 * pacote, versão, SO, modelo, locale, fuso e tela. Quem manda o evento é o
 * servidor (revenuecat-webhook), porque a compra fecha com o app FECHADO:
 * a Patricia gerou o Pix às 16h e pagou 7h41 do dia seguinte; evento
 * disparado pelo celular teria perdido a venda. Então o app só deixa a
 * ficha gravada aqui, e o servidor monta o extinfo na hora da compra.
 *
 * Campos que o WebView não sabe (operadora, disco) vão vazios — a Meta
 * aceita parcial desde que a estrutura venha completa.
 */
export const capturarDispositivoApp = async () => {
  try {
    const ua = navigator.userAgent;
    let versao = "", build = "", pacote = "br.com.coreaplicativo.app";
    try {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      versao = info.version ?? "";
      build = info.build ?? "";
      pacote = info.id ?? pacote;
    } catch { /* sem plugin: segue com o que dá pra ler do UA */ }
    // GAID (12/08): o servidor anexa como `madid` no Purchase do CAPI — é o
    // que deixa a Meta casar a compra com o clique no anúncio. Vem do plugin
    // nativo MetaAds; fora do app (ou com opt-out do usuário) fica vazio.
    // `anonId` é o identificador que a PRÓPRIA Meta deu a este aparelho (o
    // mesmo que o SDK usou pra registrar instalação e abertura). Mandado no
    // Purchase do servidor, amarra a compra ao aparelho que a Meta viu clicar
    // no anúncio — e funciona mesmo pra quem desligou o ID de publicidade.
    let gaid = "", anonId = "";
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const MetaAds = registerPlugin<{ idPublicidade(): Promise<{ gaid: string; anonId?: string }> }>("MetaAds");
      const r = await MetaAds.idPublicidade();
      gaid = r.gaid ?? "";
      anonId = r.anonId ?? "";
    } catch { /* web / build antigo sem o plugin */ }
    trackEvent("app_device_info", {
      ...(gaid ? { gaid } : {}),
      ...(anonId ? { anon_id: anonId } : {}),
      pacote,
      versao,
      build,
      os: /Android (\d+(?:\.\d+)?)/.exec(ua)?.[1] ?? "",
      modelo: /Android [^;]+; ([^)]+?)(?: Build\/[^)]*)?\)/.exec(ua)?.[1] ?? "",
      locale: navigator.language || "pt-BR",
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      tela_l: window.screen?.width ?? 0,
      tela_a: window.screen?.height ?? 0,
      densidade: window.devicePixelRatio ?? 1,
      nucleos: navigator.hardwareConcurrency ?? 0,
    });
  } catch {
    // telemetria nunca derruba o app
  }
};

/** Parâmetros de atribuição (fbclid + gclid + utm) pra repassar ao checkout. */
export const getAttributionParams = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const m = JSON.parse(localStorage.getItem(UTM_KEY) || "{}");
    const out: Record<string, string> = {};
    for (const k of ["fbclid", "ttclid", "gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      if (m[k]) out[k] = m[k];
    }
    return out;
  } catch {
    return {};
  }
};

const getStoredMeta = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) || "{}");
  } catch {
    return {};
  }
};

interface TrackOptions {
  trialDay?: number;
}

/**
 * Fire-and-forget event tracking. Never blocks UI.
 * Funciona pra usuários logados E anônimos (visitantes pré-cadastro).
 */
export const trackEvent = (
  eventName: string,
  data: Record<string, unknown> = {},
  opts: TrackOptions = {},
) => {
  try {
    const meta = getStoredMeta();
    const payload = { ...meta, ...data };

    supabase.auth.getUser().then(({ data: u }) => {
      const userId = u?.user?.id ?? null;
      (supabase as any)
        .from("analytics_events")
        .insert({
          user_id: userId,
          event_name: eventName,
          event_data: payload,
          trial_day: opts.trialDay ?? null,
          session_id: getSessionId(),
        })
        .then(() => {});
    });
  } catch {
    // swallow
  }
};

/**
 * trackEvent que SOBREVIVE à navegação (13/08). O trackEvent normal morre
 * quando a página descarrega no instante seguinte — foi por isso que o
 * abandono da roleta nunca chegava ao banco: quem sai VOLTANDO derruba o
 * fetch junto. `keepalive: true` entrega o POST mesmo com a página morrendo
 * (limite de 64KB, muito acima do nosso payload). Usar só em evento de
 * despedida (unmount/saída); o caminho normal continua no trackEvent — o
 * keepalive tem cota por origem e não deve virar padrão.
 * getSession (local) em vez de getUser (rede): na despedida não há tempo.
 */
export const trackEventBeacon = (eventName: string, data: Record<string, unknown> = {}) => {
  try {
    const meta = getStoredMeta();
    const corpo = (userId: string | null) => JSON.stringify({
      user_id: userId,
      event_name: eventName,
      event_data: { ...meta, ...data },
      trial_day: null,
      session_id: getSessionId(),
    });
    const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
    const manda = (uid: string | null) => {
      fetch("https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "return=minimal" },
        body: corpo(uid),
      }).catch(() => { /* despedida é melhor-esforço */ });
    };
    // getSession lê do storage local — resolve no mesmo tick na prática; se
    // ainda assim a página morrer antes, manda anônimo em vez de nada.
    let mandou = false;
    supabase.auth.getSession().then(({ data }) => {
      if (mandou) return;
      mandou = true;
      manda(data?.session?.user?.id ?? null);
    }).catch(() => { if (!mandou) { mandou = true; manda(null); } });
    setTimeout(() => { if (!mandou) { mandou = true; manda(null); } }, 60);
  } catch { /* swallow */ }
};

/**
 * Marks a one-time activation action for the current user.
 * Idempotent — calling twice does nothing extra.
 * Also emits a `key_action_completed` analytics event the FIRST time.
 */
export const markActivation = async (
  actionKey: string,
  metadata: Record<string, unknown> = {},
) => {
  try {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;

    const { data: existing } = await (supabase as any)
      .from("user_activations")
      .select("id")
      .eq("user_id", userId)
      .eq("action_key", actionKey)
      .maybeSingle();

    if (existing) return; // already activated

    const { error } = await (supabase as any)
      .from("user_activations")
      .insert({ user_id: userId, action_key: actionKey, metadata });

    if (!error) {
      trackEvent("key_action_completed", { action_key: actionKey, ...metadata });
    }
  } catch {
    // swallow — analytics must never break UX
  }
};
