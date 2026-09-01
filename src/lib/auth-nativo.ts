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

/** Callback do Supabase. O projeto tem domínio de auth PRÓPRIO — deduzir do
 *  `SUPABASE_URL` (…supabase.co) dá um endereço que a Apple não reconhece. */
const SUPABASE_CALLBACK = "https://registro.coreaplicativo.com.br/auth/v1/callback";

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

/**
 * ENTRAR COM APPLE (30/08) — exigência da regra 4.8, não escolha de produto.
 *
 * A Apple obriga: app que oferece login social de TERCEIRO (o nosso é o
 * Google) tem que oferecer também uma opção equivalente que limite os dados
 * a nome+e-mail e permita esconder o e-mail. Sign in with Apple é a resposta
 * padrão. Sem isso, reprovação na primeira revisão.
 *
 * Reusa o MESMO caminho do Google — signInWithOAuth + Browser.open + volta
 * por `core://auth` — porque esse caminho já foi medido dentro do binário e
 * as três armadilhas dele (redirect indo pro site, webview embutida barrada,
 * token no fragmento) já estão resolvidas ali em cima. Um fluxo nativo
 * próprio (ASAuthorization) seria uma segunda implementação de login pra
 * manter, com os mesmos bugs pra redescobrir.
 *
 * PRÉ-REQUISITOS que NÃO são código — sem eles o botão abre e falha:
 *  1. Apple Developer → Identifiers → **Services ID** pro Sign in with Apple,
 *     + uma **chave .p8** (Keys → Sign in with Apple), guardando Key ID e
 *     Team ID.
 *  2. Supabase → Authentication → Providers → **Apple**: ligar e preencher
 *     Services ID (client id) e o segredo gerado a partir da .p8.
 *  3. Xcode → alvo App → Signing & Capabilities → **+ Sign in with Apple**.
 *  4. `core://auth` já está nas Redirect URLs do Supabase (o Google usa).
 */
export async function entrarComApple(): Promise<{ error: { message: string } | null }> {
  if (!isNativeShell()) {
    // Web: o fluxo de navegador é o único que existe, e ali funciona.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    return { error: error ? { message: error.message } : null };
  }

  /*
   * NO iPHONE, FLUXO NATIVO — e isto foi conserto de bug, não preferência.
   *
   * A primeira versão reusava o caminho do Google (signInWithOAuth +
   * Browser.open + volta por core://auth). No aparelho do dono o login
   * ABRIA e nunca voltava: o navegador ficava carregando pra sempre e o app
   * seguia deslogado.
   *
   * A investigação descartou, uma a uma, todas as suspeitas de configuração:
   *  · Services ID e Return URL — a Apple devolve a tela de login (HTTP 200);
   *  · `core://auth` — está na lista de Redirect URLs do Supabase;
   *  · o client secret — testado direto contra appleid.apple.com/auth/token:
   *    a Apple respondeu `invalid_grant` (código falso), NÃO `invalid_client`,
   *    ou seja aceitou a credencial.
   * Sobrou o único elo não testável de fora: a volta do navegador pro app.
   * O `Browser.open` do Capacitor usa SFSafariViewController, que no iOS
   * bloqueia redirecionamento pra esquema próprio (`core://`). No Android o
   * Custom Tab permite — por isso o Google sempre funcionou lá.
   *
   * O fluxo nativo não tem esse elo: a folha do sistema devolve o
   * identityToken na própria chamada, e o Supabase troca por sessão com
   * `signInWithIdToken`. Sem navegador, sem redirect, sem esquema.
   * É também o que a Apple espera num app iOS — Face ID, sem sair do app.
   */
  try {
    const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
    /* clientId = o BUNDLE, não o Services ID. No fluxo nativo o token que a
     * Apple assina sai com `aud` igual ao bundle do app; o Services ID só
     * vale pro fluxo web. O Supabase valida essa audiência contra a lista de
     * Client IDs do provedor — por isso os DOIS estão cadastrados lá
     * (`br.com.coreaplicativo.signin,br.com.coreaplicativo.app`). Trocar um
     * pelo outro aqui faz o Supabase recusar um token perfeitamente válido. */
    const res = await SignInWithApple.authorize({
      clientId: "br.com.coreaplicativo.app",
      redirectURI: SUPABASE_CALLBACK,
      scopes: "email name",
      state: "core",
    });
    const idToken = res?.response?.identityToken;
    if (!idToken) return { error: { message: "A Apple não devolveu o token." } };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: idToken,
    });
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (e) {
    const m = (e as { message?: string })?.message ?? "";
    // Cancelar é decisão, não falha: não vira mensagem de erro na tela.
    if (/cancel/i.test(m)) return { error: null };
    return { error: { message: "Não consegui abrir o login da Apple." } };
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
