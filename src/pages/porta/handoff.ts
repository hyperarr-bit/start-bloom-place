/**
 * PORTA → APP JÁ LOGADO (10/10) — o lado do SITE.
 *
 * Depois da conta, o site pede um código de uso único à função `porta-handoff`
 * (24 h, 1 uso). Ele chega ao app por dois caminhos:
 *   · ÁREA DE TRANSFERÊNCIA: no toque em "Entendi, baixar o CORE" (gesto da
 *     pessoa) o site copia `https://coreaplicativo.com.br/p/<código>`; o app,
 *     na 1ª abertura, vê que há um link no clipboard e lê (o iOS pergunta
 *     "Permitir colar?"). É o caminho de quem toca "Abrir" na própria App Store.
 *   · LINK: na volta da loja, a tela 7 mostra "Abrir o CORE" →
 *     `core://porta?c=<código>`.
 * Mesmas regras do servidor (supabase/functions/_shared/porta-handoff.ts),
 * repetidas aqui pra o bundle do site não importar de fora do src/.
 */
export const RE_CODIGO_PORTA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
export const codigoDaPortaOk = (c: unknown): c is string => typeof c === "string" && RE_CODIGO_PORTA.test(c);
export const linkDoCodigo = (codigo: string): string => `https://coreaplicativo.com.br/p/${codigo}`;
export const abrirAppComCodigo = (codigo: string): string => `core://porta?c=${encodeURIComponent(codigo)}`;

export type ResultadoCopia = { ok: boolean; metodo: "clipboard_api" | "exec_command" | "nenhum"; erro?: string };

/** Cópia síncrona antiga (textarea + execCommand): reserva quando a Clipboard API não existe ou é recusada. */
function copiarPorExecCommand(texto: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", ""); // sem teclado no iPhone
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length);
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * Copia o texto. TEM que ser chamada DENTRO do toque (antes de a página sair
 * pra loja): a Clipboard API do Safari/WKWebView só escreve com gesto do
 * usuário. A chamada é síncrona no toque; o resultado volta em `aoTerminar`
 * (no Instagram a API pode recusar — aí tenta o execCommand).
 */
export function copiarNoToque(texto: string, aoTerminar: (r: ResultadoCopia) => void): void {
  try {
    const cb = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (cb && typeof cb.writeText === "function") {
      cb.writeText(texto).then(
        () => aoTerminar({ ok: true, metodo: "clipboard_api" }),
        (e: unknown) => {
          const ok = copiarPorExecCommand(texto);
          aoTerminar({ ok, metodo: ok ? "exec_command" : "clipboard_api", erro: String((e as { name?: string })?.name ?? e).slice(0, 80) });
        },
      );
      return;
    }
  } catch (e) {
    const ok = copiarPorExecCommand(texto);
    aoTerminar({ ok, metodo: ok ? "exec_command" : "nenhum", erro: String((e as { name?: string })?.name ?? e).slice(0, 80) });
    return;
  }
  const ok = copiarPorExecCommand(texto);
  aoTerminar({ ok, metodo: ok ? "exec_command" : "nenhum" });
}
