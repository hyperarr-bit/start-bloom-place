import { isNativeShell } from "./native-shell";

/**
 * Barra de status do app da loja (26/07).
 *
 * O CSS já estava pronto há tempos: `--app-safe-top` e o `.app-safe-top-guard`
 * pintam a área da barra com a cor do app. Só que sem overlay o webview começa
 * ABAIXO da barra do sistema, `env(safe-area-inset-top)` devolve 0, o guard
 * fica com altura zero — e quem aparece no topo é a barra cinza do Android,
 * destacada do app. Era a "faixa branca em cima" que o dono fotografou.
 *
 * setOverlaysWebView(true) faz o app desenhar POR BAIXO das barras (como o
 * Instagram). A partir daí os insets passam a reportar valores reais e todo o
 * CSS que já existia entra em ação sozinho.
 *
 * O estilo do ÍCONE precisa acompanhar o tema, e o tema aqui é do app (classe
 * .dark no html), não do sistema — por isso quem chama é o use-theme, e não
 * um valor fixo no styles.xml.
 *
 * Convenção do plugin (contraintuitiva): Style.Light = fundo claro, ícone
 * escuro. Style.Dark = fundo escuro, ícone claro.
 */
export async function aplicarBarraDeStatus(modo: "light" | "dark"): Promise<void> {
  if (!isNativeShell()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: modo === "dark" ? Style.Dark : Style.Light });
  } catch {
    // Barra de status nunca derruba o app: se o plugin falhar, o pior caso
    // é voltar ao visual de antes.
  }
}
