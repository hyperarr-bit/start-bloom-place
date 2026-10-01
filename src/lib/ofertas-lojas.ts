/**
 * O QUE CADA LOJA OFERECE HOJE — texto de EXIBIÇÃO do site (landing e
 * "Assine no app"). Quem cobra é a loja, pelo preço cadastrado nela; o app
 * lê o preço da loja em tempo real, o site não tem como. Mudou o preço no
 * App Store Connect / Play Console → muda aqui no mesmo commit, senão o site
 * promete uma coisa e a folha cobra outra (reembolso certo).
 *
 * Fonte (01/10/2026): iPhone = `core_anual_97` R$ 97,90/ano com 3 dias grátis
 * (build 20+, ver PaywallIOS) e `core_mensal` R$ 24,90; Android =
 * `core_vitalicio_97` R$ 97,90 pagamento único e `core_mensal` R$ 24,90
 * (ver PaywallW, ANDROID_DUAS_COLUNAS).
 */
export const OFERTA_IOS = {
  diasGratis: 3,
  anual: "R$ 97,90",
  anualPorMes: "R$ 8,16",
  mensal: "R$ 24,90",
} as const;

export const OFERTA_ANDROID = {
  vitalicio: "R$ 97,90",
  mensal: "R$ 24,90",
} as const;

export const URL_APP_STORE = "https://apps.apple.com/br/app/id6806913181";
export const URL_GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app";
