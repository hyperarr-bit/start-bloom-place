import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CORE — app das lojas (Capacitor). Android desde 22/07; iOS adicionado em
 * 30/08 (mesmo appId, mesmo bundle web — namespaces de loja são separados,
 * e manter a string igual evita duas identidades pra mesma marca).
 *
 * O que muda no iPhone e NÃO está aqui, está no código: a chave do RevenueCat
 * é appl_ (src/lib/revenuecat.ts), não há Install Referrer nem SDK da Meta
 * (src/lib/analytics.ts), e a App Store não tem Pix nem plano pré-pago — o
 * catálogo iOS é vitalício (non-consumable) + mensal auto-renovável.
 *
 * Decisões de 22/07:
 *  - webDir "dist": o app EMBARCA o build web (não carrega o site remoto —
 *    wrapper de URL é o que a política 4.3 do Play derruba). Atualizar o app
 *    = novo build + cap sync + novo .aab (ou live-update depois, ex. Capgo).
 *  - appId com o domínio invertido da casa.
 *  - O código web detecta o shell via native-shell.ts e bifurca:
 *    pagamento = ASSINATURA (RevenueCat/Play Billing), nunca Pix in-app
 *    (obrigação do Play Billing no BR até ~09/2027).
 */
const config: CapacitorConfig = {
  appId: "br.com.coreaplicativo.app",
  appName: "CORE",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
