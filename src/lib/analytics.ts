import { supabase } from "@/integrations/supabase/client";
import { plataformaApp } from "@/lib/native-shell";

// Persistent session id for the tab
const SESSION_KEY = "core_session_id";
const UTM_KEY = "core_utm";

/*
 * MEMÓRIA DA PÁGINA (25/09). No navegador do Instagram o storage inteiro da
 * página (sessionStorage, localStorage e cookies) às vezes é ZERADO com a
 * página viva, segundos depois da chegada do anúncio: a sessão da chegada
 * morria com 1 evento e o resto do funil (quiz, demo, cadastro, Pix) seguia
 * numa sessão nova, sem campanha. Foram 47–82 visitas de anúncio por dia em
 * 22–24/09 (1 em cada 4 que passava da 1ª tela) e 13 das 26 vendas web "sem
 * sinal" de 20–24/09 — o fbclid no cookie do Pix provou que eram do anúncio.
 * O heap do JS sobrevive à zerada: estas cópias re-semeiam o storage.
 */
let sessaoMemoria: string | null = null;
let metaMemoria: Record<string, string> | null = null;

const CHAVES_DE_ATRIBUICAO = ["utm_source", "utm_campaign", "fbclid", "ttclid", "gclid", "gbraid", "wbraid"] as const;
const temAtribuicao = (m: Record<string, unknown> | null | undefined): boolean =>
  !!m && CHAVES_DE_ATRIBUICAO.some((k) => !!m[k]);

const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr";
  let id: string | null = null;
  try { id = sessionStorage.getItem(SESSION_KEY); } catch { /* storage bloqueado */ }
  if (!id) {
    id = sessaoMemoria ?? crypto.randomUUID();
    try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* noop */ }
  }
  sessaoMemoria = id;
  return id;
};

/** fbclid do cookie `_fbc` (fb.1.<ts>.<fbclid>) — último recurso quando storage
 *  e memória perderam a campanha: é o que o Pix já manda pra CAPI, e liga a
 *  sessão à chegada do anúncio (mesmo fbclid) na análise. */
const fbclidDoCookie = (): { fbclid: string; criado: number } | null => {
  try {
    const m = document.cookie.match(/(?:^|;\s*)_fbc=([^;]+)/);
    const partes = m ? decodeURIComponent(m[1]).split(".") : [];
    const fbclid = partes.length >= 4 ? partes.slice(3).join(".") : "";
    const criado = Number(partes[2]);
    return fbclid && Number.isFinite(criado) ? { fbclid, criado } : null;
  } catch {
    return null;
  }
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
    // cópia na memória da página (ver sessaoMemoria): a da URL se trouxe
    // campanha, senão a que já estava guardada
    if (temAtribuicao(utm)) metaMemoria = utm;
    else if (!metaMemoria && existing) {
      try { const salvo = JSON.parse(existing); if (temAtribuicao(salvo)) metaMemoria = salvo; } catch { /* noop */ }
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
/** O referrer BRUTO guardado (contém o payload cifrado da Meta com o ad_id). */
const REFERRER_RAW = "core_install_referrer_raw";
/** Já carimbamos a origem neste usuário? (guarda o id pra não repetir) */
const ORIGEM_FLAG = "core_origem_vinculada";

/**
 * CARIMBA A ORIGEM NO USUÁRIO (31/08).
 *
 * O funil W vende ANTES do cadastro: na hora da compra não existe user_id, e
 * o referrer ficou lá atrás numa sessão anônima. Quando a pessoa finalmente
 * cria a conta, temos as duas pontas na mão pela primeira vez — é o momento
 * de emitir um evento que já nasce COM user_id carregando o referrer.
 *
 * Com isso o relatório passa a ligar venda→anúncio por user_id (junção
 * direta), em vez de depender de casar sessão ou GAID. Uma vez por usuário:
 * a flag guarda o id, então trocar de conta no mesmo aparelho recarimba.
 */
export const vincularOrigem = async (userId: string) => {
  try {
    if (!userId) return;
    if (localStorage.getItem(ORIGEM_FLAG) === userId) return;
    let bruto = localStorage.getItem(REFERRER_RAW) || "";
    // última chance: a Play guarda o referrer por 90 dias, então se o
    // localStorage foi limpo (ou é aparelho antigo), relê agora — é aqui que
    // a origem vale mais, porque é o único instante com user_id na mão.
    if (!bruto) {
      try {
        bruto = await lerReferrerDaPlay();
        if (bruto) localStorage.setItem(REFERRER_RAW, bruto.slice(0, 2000));
      } catch { /* sem Play Services */ }
    }
    localStorage.setItem(ORIGEM_FLAG, userId);
    // sem referrer guardado ainda vale registrar: separa "não sabemos"
    // (orgânico de verdade) de "instalou antes desta versão".
    // o trackEvent já funde os utm guardados no payload — não repetir aqui
    trackEvent("origem_usuario", { referrer: bruto.slice(0, 2000), tem_referrer: !!bruto });
  } catch { /* nunca derruba o login */ }
};
/** Lê o referrer da Play. A API devolve o mesmo valor durante 90 DIAS (não é
 *  "uma vez por instalação" como se pensava aqui) — então dá pra reconsultar
 *  quando faltar, em vez de depender do que sobrou no localStorage. */
const lerReferrerDaPlay = async (): Promise<string> => {
  if (plataformaApp() !== "android") return "";
  const { InstallReferrer } = await import("@capgo/capacitor-install-referrer");
  const res = (await InstallReferrer.getReferrer()) as { referrer?: string };
  return String(res?.referrer || "");
};

/**
 * INSTALOU VINDO DO SITE DEPOIS DE PAGAR? (18/09)
 *
 * Caso real de hoje: pagou R$27,90 no Pix às 06:59, tocou no card "O CORE
 * também é app de celular", instalou pela Play, caiu na welcome, tocou em
 * "Começar" e pagou DE NOVO R$97,90 na folha do Google às 07:02. O referrer
 * da Play já dizia `utm_campaign=web_pos_compra` — o app sabia e não usou.
 * A welcome lê isto e põe o "Entrar" na frente, com o aviso.
 */
export const instalouVindoDoSite = (): boolean => {
  try { return /utm_campaign=web_/.test(localStorage.getItem(REFERRER_RAW) ?? ""); } catch { return false; }
};

export const captureInstallReferrer = async () => {
  try {
    if (localStorage.getItem(REFERRER_FLAG)) {
      /*
       * REMENDO DA BASE JÁ INSTALADA (31/08). A flag existe desde a v49 em
       * todo aparelho que já rodou o app — então o `return` seco aqui deixava
       * o REFERRER_RAW novo eternamente vazio justo pra base que dá o dinheiro
       * de hoje. Como a Play guarda o referrer por 90 dias, dá pra reler uma
       * vez e preencher. Sem emitir evento de novo: só preenche o que falta.
       */
      if (!localStorage.getItem(REFERRER_RAW)) {
        try {
          const antigo = await lerReferrerDaPlay();
          if (antigo) localStorage.setItem(REFERRER_RAW, antigo.slice(0, 2000));
        } catch { /* sem Play Services: fica como estava */ }
      }
      return;
    }
    // 30/08: Install Referrer é serviço da PLAY. No iPhone o plugin rejeita e
    // a flag (que só é gravada DEPOIS de resolver) nunca fecha — ou seja, uma
    // tentativa perdida a cada boot, pra sempre. Sai fora antes.
    // Atribuição de instalação no iOS é outro assunto (SKAdNetwork/ATT), e
    // não existe ainda — evento de app no iOS chega sem utm de campanha.
    if (plataformaApp() !== "android") return;
    const bruto = await lerReferrerDaPlay();
    // flag só depois de resolver: falha transitória do serviço da Play
    // (raro, mas existe) tenta de novo no próximo boot.
    localStorage.setItem(REFERRER_FLAG, "1");
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
    /*
     * GUARDA O BRUTO (31/08). Até aqui o referrer era emitido como evento e
     * esquecido — e o evento nasce ANÔNIMO (0% dos 701 de um dia tinham
     * user_id), porque dispara no boot, antes de existir conta. Ligar a venda
     * ao anúncio dependia de ponte: mesma sessão, ou mesmo GAID. Quem instala,
     * fecha o app e volta depois pra comprar perde a sessão; 3% dos aparelhos
     * não expõem GAID; e o evento só dispara 1× por instalação. Resultado
     * medido em 31/08: 25% da receita do dia sem origem — justo o número que
     * decide qual campanha morre. Guardando o bruto, a origem passa a viajar
     * com a pessoa e é carimbada no login (vincularOrigem).
     */
    try { localStorage.setItem(REFERRER_RAW, bruto.slice(0, 2000)); } catch { /* cota cheia: segue sem */ }
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
    // 30/08: a ficha nasceu só-Android e lia o UA com regex de Android — num
    // iPhone `os` e `modelo` saíam VAZIOS e nada dizia qual loja era. O
    // servidor monta o extinfo com "a2" (Android) fixo, então uma compra de
    // iPhone iria pra Meta rotulada como Android: dado errado, não faltante.
    // Gravar a plataforma aqui é o que permite o servidor ramificar pra "i2"
    // quando o iOS entrar em campanha (hoje ainda não entra — sem SDK/ATT).
    const ios = plataformaApp() === "ios";
    trackEvent("app_device_info", {
      ...(gaid ? { gaid } : {}),
      ...(anonId ? { anon_id: anonId } : {}),
      plataforma: plataformaApp(),
      pacote,
      versao,
      build,
      os: ios
        ? (/OS (\d+[_.]\d+(?:[_.]\d+)?)/.exec(ua)?.[1]?.replace(/_/g, ".") ?? "")
        : (/Android (\d+(?:\.\d+)?)/.exec(ua)?.[1] ?? ""),
      // O WebView do iOS mente o modelo de propósito: todo iPhone se diz
      // "iPhone" (e iPad, "iPad") — não existe "iPhone 15 Pro" no UA. Isso é
      // o máximo honesto que dá pra ler sem plugin nativo de device.
      modelo: ios
        ? (/\((iPhone|iPad|iPod)/.exec(ua)?.[1] ?? "iPhone")
        : (/Android [^;]+; ([^)]+?)(?: Build\/[^)]*)?\)/.exec(ua)?.[1] ?? ""),
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
    const m = getStoredMeta();
    const out: Record<string, string> = {};
    for (const k of ["fbclid", "ttclid", "gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      if (m[k]) out[k] = m[k];
    }
    return out;
  } catch {
    return {};
  }
};

/** Clique de 7 dias, igual à janela da Meta: `_fbc` mais velho que isso é
 *  de outra visita e não pode carimbar esta. */
const FBC_VALIDADE_MS = 7 * 86_400_000;

/** core_utm com a rede da memória da página (ver sessaoMemoria): storage
 *  zerado → devolve a cópia da memória e re-semeia o storage, pra próxima
 *  página (a demo é navegação cheia) já nascer com a campanha. Sem memória
 *  (página nova), o fbclid do `_fbc` recente liga a sessão ao anúncio. */
const getStoredMeta = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  let salvo: Record<string, string> = {};
  try { salvo = JSON.parse(localStorage.getItem(UTM_KEY) || "{}"); } catch { salvo = {}; }
  if (temAtribuicao(salvo)) {
    if (!metaMemoria) metaMemoria = salvo;
    return salvo;
  }
  let recuperado = metaMemoria;
  if (!recuperado) {
    const c = fbclidDoCookie();
    if (c && Date.now() - c.criado < FBC_VALIDADE_MS) {
      recuperado = { fbclid: c.fbclid, atribuicao: "cookie_fbc" };
      metaMemoria = recuperado;
    }
  }
  if (!recuperado) return salvo;
  const junto = { ...salvo, ...recuperado };
  try { localStorage.setItem(UTM_KEY, JSON.stringify(junto)); } catch { /* noop */ }
  return junto;
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
    // Logado manda com o token da sessão: a policy do anon só aceita
    // user_id NULO, então um evento logado com a chave anon era recusado em
    // silêncio (revisão 02/09).
    const manda = (uid: string | null, token: string | null = null) => {
      fetch("https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${token || KEY}`, Prefer: "return=minimal" },
        body: corpo(uid),
      }).catch(() => { /* despedida é melhor-esforço */ });
    };
    // getSession lê do storage local — resolve no mesmo tick na prática; se
    // ainda assim a página morrer antes, manda anônimo em vez de nada.
    let mandou = false;
    supabase.auth.getSession().then(({ data }) => {
      if (mandou) return;
      mandou = true;
      manda(data?.session?.user?.id ?? null, data?.session?.access_token ?? null);
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
