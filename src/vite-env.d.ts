/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
/** Versão do iPhone (MARKETING_VERSION (CURRENT_PROJECT_VERSION) do project.pbxproj). */
declare const __APP_VERSION_IOS__: string;
/** 10/10: true só no build de TESTE da loja (RC_MOCK=1) — ver src/lib/rc-mock.ts. */
declare const __RC_MOCK__: boolean | undefined;

/** 1.0.16 — o dicionário de textos do código (um texto normalizado por linha), gerado no build por
 *  vite-plugin-medicao-textos.ts. A medição total só usa texto de tela numa chave se ele estiver aqui. */
declare module "virtual:medicao-textos" {
  const textos: string;
  export default textos;
}
