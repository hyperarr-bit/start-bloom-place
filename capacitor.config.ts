import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CORE — app Android (Capacitor). Decisões de 22/07:
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
