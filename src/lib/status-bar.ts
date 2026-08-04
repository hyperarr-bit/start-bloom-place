import { isNativeShell } from "./native-shell";

/**
 * Barra de status do app da loja (26/07, revisto 27/07 com o APK no emulador).
 *
 * O CSS já estava pronto há tempos: `--app-safe-top` e o `.app-safe-top-guard`
 * pintam a área da barra com a cor do app. Só que sem edge-to-edge o webview
 * começa ABAIXO da barra do sistema, `env(safe-area-inset-top)` devolve 0, o
 * guard fica com altura zero — e quem aparece no topo é a barra do Android,
 * destacada do app. Era a "faixa branca em cima" que o dono fotografou.
 *
 * QUEM manda no edge-to-edge mudou:
 *  - Android ≤14: `setOverlaysWebView(true)` (o que fazíamos).
 *  - Android 15+: o método NÃO FUNCIONA MAIS (a própria tipagem do plugin diz
 *    "Not available on Android 15+"). Quem decide é o Capacitor: ele só passa
 *    os insets pro CSS quando o `<meta viewport>` tem `viewport-fit=cover`
 *    (nosso index.html já tem) E o WebView do aparelho é ≥ 140. Abaixo disso
 *    ele aplica os insets como padding no próprio WebView — daí a faixa.
 * Mantemos a chamada porque ela ainda serve os aparelhos antigos; nos novos
 * ela é inofensiva e o edge-to-edge acontece sozinho.
 *
 * Convenção do plugin (contraintuitiva): Style.Light = fundo claro, ícone
 * escuro. Style.Dark = fundo escuro, ícone claro.
 */
export async function aplicarBarraDeStatus(modo: "light" | "dark"): Promise<void> {
  if (!isNativeShell()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {}); // no-op no Android 15+
    await StatusBar.setStyle({ style: modo === "dark" ? Style.Dark : Style.Light });
    await compensarInsetQueNaoVeio();
  } catch {
    // Barra de status nunca derruba o app: se o plugin falhar, o pior caso
    // é voltar ao visual de antes.
  }
}

/**
 * O buraco entre o overlay e o env() (04/08).
 *
 * Em Android ≤14 o setOverlaysWebView acima FUNCIONA — o app passa a
 * desenhar atrás da status bar. Mas quem deveria avisar o CSS de quanto
 * recuar é o env(safe-area-inset-top)... que em WebView < 140 devolve 0
 * (bug antigo do Chromium, só corrigido lá). O Capacitor também não
 * compensa nesses aparelhos. Resultado: conteúdo embaixo do relógio — o
 * que o dono fotografou no aparelho de WebView velho. Esse defeito SEMPRE
 * existiu nesse perfil de aparelho; ficou invisível enquanto a tela
 * branca não deixava o app nem abrir.
 *
 * A compensação: mede um elemento-sonda com padding env(). Se o env()
 * devolveu nada e o plugin sabe a altura real da barra, grava a altura
 * direto na var que todo o layout já consome. Em WebView novo a sonda
 * mede > 0 e nada muda.
 */
async function compensarInsetQueNaoVeio(): Promise<void> {
  try {
    const sonda = document.createElement("div");
    sonda.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
    document.body.appendChild(sonda);
    const medido = sonda.getBoundingClientRect().height;
    sonda.remove();
    if (medido > 0) return; // env() funciona — o CSS se vira sozinho

    const { StatusBar } = await import("@capacitor/status-bar");
    const info = await StatusBar.getInfo();
    if (info.height && info.height > 0) {
      document.documentElement.style.setProperty("--app-safe-top", `${Math.round(info.height)}px`);
    }
  } catch {
    // sem medida confiável, fica o comportamento de antes
  }
}

/**
 * Para telas que cobrem a tela inteira com fundo ESCURO independente do tema
 * — hoje só a retrospectiva.
 *
 * Sem isto, num aparelho com edge-to-edge de verdade o relógio e a bateria
 * seguiriam o tema do app: alguém no tema claro veria ícones escuros por cima
 * do roxo da retrospectiva, ou seja, ilegíveis. Devolve a função que restaura
 * o estilo do tema — chamar no cleanup do efeito.
 */
export function barraClaraEnquantoMontado(modoDoTema: "light" | "dark"): () => void {
  void aplicarBarraDeStatus("dark");
  return () => { void aplicarBarraDeStatus(modoDoTema); };
}
