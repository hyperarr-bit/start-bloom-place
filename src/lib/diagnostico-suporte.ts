import { plataformaApp } from "@/lib/native-shell";

/**
 * FICHA TÉCNICA DO CHAMADO (07/09).
 *
 * Pedido literal de uma cliente pagante, por DM: "faz em algum local suporte
 * e coloca um formulário pra gente por o bug e anexar o print". O print ela
 * manda; o resto NÃO dá pra pedir — quem escreve "não está salvando" não sabe
 * (nem tem obrigação de saber) a versão do app, se está no navegador ou na
 * Play, nem o modelo do aparelho. E é justamente isso que decide se o bug é
 * de uma build antiga, de um WebView velho ou do código de hoje.
 *
 * Então a ficha vai junto, montada aqui, sem perguntar nada. O mesmo caminho
 * que o `capturarDispositivoApp` do analytics já usa: versão pelo plugin do
 * Capacitor quando existe, senão a constante do build (__APP_VERSION__, lida
 * do build.gradle — ver vite.config.ts).
 */

/** Última tela de módulo aberta. Gravada pelo use-module-tracker. */
export const CHAVE_ULTIMO_MODULO = "core-ultimo-modulo";

export interface DiagnosticoSuporte {
  /** "1.0.95 (96)" — versão do binário, não do que a pessoa acha que tem. */
  versao: string;
  /** "app Android (Play)" | "app iPhone (App Store)" | "navegador" */
  plataforma: string;
  /** user-agent cru: é o que diz o modelo e a versão do WebView. */
  aparelho: string;
  /** id do último módulo aberto ("" quando a pessoa nem entrou em um). */
  modulo: string;
  /** rota de onde o chamado saiu. */
  tela: string;
  idioma: string;
}

const PLATAFORMA: Record<string, string> = {
  android: "app Android (Play)",
  ios: "app iPhone (App Store)",
  web: "navegador",
};

/** Versão do build da web — a constante some fora do Vite (ex.: vitest). */
const versaoDoBuild = (): string =>
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export const montarDiagnostico = async (): Promise<DiagnosticoSuporte> => {
  const plataforma = plataformaApp();
  let versao = versaoDoBuild();
  try {
    // Dentro da loja a versão que vale é a do binário instalado: a pessoa
    // pode estar com uma build de duas semanas atrás e o bug já ter morrido.
    if (plataforma !== "web") {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (info?.version) versao = `${info.version}${info.build ? ` (${info.build})` : ""}`;
    }
  } catch {
    /* sem plugin (web/emulador): fica a versão do build */
  }
  let modulo = "";
  try {
    modulo = sessionStorage.getItem(CHAVE_ULTIMO_MODULO) || "";
  } catch {
    /* storage bloqueado: o chamado vale sem isso */
  }
  return {
    versao,
    plataforma: PLATAFORMA[plataforma] ?? plataforma,
    aparelho: (navigator.userAgent || "").slice(0, 400),
    modulo,
    tela: typeof window !== "undefined" ? window.location.pathname : "",
    idioma: navigator.language || "pt-BR",
  };
};
