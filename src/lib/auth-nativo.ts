import { supabase } from "@/integrations/supabase/client";
import { isNativeShell } from "./native-shell";
import { getAuthRedirectUrl } from "./utils";

/**
 * LOGIN COM GOOGLE DENTRO DO APP (28/07).
 *
 * O BUG QUE ISSO CONSERTA. No app, `location.hostname` é "localhost" — e o
 * `getAuthRedirectUrl` trata localhost como ambiente de teste e devolve o
 * endereço do SITE. Resultado medido dentro do APK: quem tocava em "Continuar
 * com Google" ia pro Google, autenticava, e era devolvido no NAVEGADOR, no
 * site. Ficava logado lá e o app seguia deslogado — e, como entrou por Google,
 * não tinha senha pra tentar o caminho do e-mail. Beco sem saída no primeiro
 * botão da tela de cadastro.
 *
 * COMO FUNCIONA AGORA, e por que cada peça existe:
 *
 *  1. `redirectTo: core://auth` — o mesmo esquema dos atalhos do ícone, que já
 *     está declarado no manifesto. É ele que faz o Google devolver PRO APP.
 *
 *  2. `skipBrowserRedirect: true` — sem isso o Supabase navega a WebView
 *     inteira pro Google. Aí caímos na segunda armadilha: o Google BLOQUEIA
 *     OAuth dentro de webview embutida (erro `disallowed_useragent`). Então
 *     pegamos a URL e abrimos nós mesmos.
 *
 *  3. `Browser.open` — abre em Custom Tab (Android) / SFSafariViewController
 *     (iOS). Custom Tab não é webview embutida, é o navegador de verdade com
 *     as credenciais do aparelho: o Google aceita, e quem já está logado no
 *     Gmail entra com um toque.
 *
 *  4. A volta chega em `appUrlOpen` como `core://auth#access_token=...`. O
 *     token vem no FRAGMENTO (depois do #), não na query — é assim que o
 *     Supabase devolve no fluxo implícito, e ler `searchParams` aqui não acha
 *     nada. Ver `sessaoDoLink`.
 *
 * PRÉ-REQUISITO NO SUPABASE: `core://auth` precisa estar na lista de Redirect
 * URLs do projeto (Authentication → URL Configuration). Sem isso o Supabase
 * recusa o redirect e a pessoa volta pro site de novo.
 */

/** O endereço de volta quando o login acontece dentro do app. */
export const RETORNO_NATIVO = "core://auth";

/** É o link de volta do login (e não um atalho de módulo)? */
export function ehRetornoDeLogin(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "core:") return false;
    const alvo = (u.hostname || u.pathname.replace(/^\/+/, "")).toLowerCase();
    return alvo === "auth";
  } catch {
    return false;
  }
}

/**
 * Completa a sessão a partir do link de volta.
 * Devolve true se conseguiu logar.
 */
export async function sessaoDoLink(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    // o Supabase devolve no fragmento: core://auth#access_token=..&refresh_token=..
    const frag = new URLSearchParams((u.hash || "").replace(/^#/, ""));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");

    if (!access_token || !refresh_token) {
      // fluxo PKCE devolve ?code= em vez de token no fragmento
      const code = u.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return !error;
      }
      return false;
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Entra com Google. Na web, exatamente o que sempre foi (o Supabase navega a
 * página); no app, o caminho de Custom Tab + deep link descrito acima.
 */
export async function entrarComGoogle(): Promise<{ error: { message: string } | null }> {
  if (!isNativeShell()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    return { error: error ? { message: error.message } : null };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: RETORNO_NATIVO, skipBrowserRedirect: true },
  });
  if (error) return { error: { message: error.message } };
  if (!data?.url) return { error: { message: "Não consegui abrir o Google." } };

  try {
    // objeto embrulhado pelo mesmo motivo das notificações: devolver o plugin
    // direto de uma função async faz o runtime chamar `.then()` no Proxy
    const mod = await import("@capacitor/browser");
    await mod.Browser.open({ url: data.url, presentationStyle: "popover" });
    return { error: null };
  } catch {
    return { error: { message: "Não consegui abrir o navegador." } };
  }
}

/** Fecha a Custom Tab depois que a sessão entrou (senão ela fica por cima). */
export async function fecharNavegador(): Promise<void> {
  if (!isNativeShell()) return;
  try {
    const mod = await import("@capacitor/browser");
    await mod.Browser.close();
  } catch { /* já fechada */ }
}
