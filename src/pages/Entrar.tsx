import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { entrarComGoogle, entrarComApple } from "@/lib/auth-nativo";
import { ehApple } from "@/lib/loja";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { getAuthRedirectUrl } from "@/lib/utils";
import { isInAppBrowser } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

/** /entrar — duas plateias, a mesma tela.
 *
 *  WEB: porta de entrada enviada por E-MAIL pela Cakto após a compra. A pessoa
 *  acabou de pagar e criou a conta no tutorial minutos antes; a copy relembra
 *  "use o e-mail e a senha que você criou no tutorial".
 *
 *  APP (25/07): quem baixou da loja NÃO comprou nada e não passou por tutorial
 *  nenhum. A copy de pós-compra ali é confusa — e o rodapé "acesso vitalício,
 *  pagou uma vez" contradiz o modelo de ASSINATURA do app, o tipo de coisa que
 *  reprova na revisão do Play. Por isso todo texto que fala de compra/tutorial
 *  é trocado quando `isNativeShell()`.
 *
 *  Sem prefill de e-mail de propósito (decisão do dono: menos superfície de bug). */

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

/* Glifo oficial da Apple. As diretrizes de marca não deixam substituir por
 * emoji nem por ícone genérico de biblioteca — e o botão tem que ser preto
 * com o logo à esquerda do texto. */
const AppleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

const Entrar = () => {
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const app = isNativeShell();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("email_access_view");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    const { error } = await signIn(email.trim(), password);
    if (error) {
      setFailedOnce(true);
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? app
            ? "E-mail ou senha não bateram. Confere e tenta de novo."
            : "E-mail ou senha não bateram. Confere se é o mesmo e-mail que você usou no tutorial."
          : error.message,
      );
      setLoading(false);
    } else {
      trackEvent("login_completed", { method: "password", source: "email_access" });
      navigate("/home");
    }
  };

  const handleApple = async () => {
    setAppleLoading(true);
    const { error } = await entrarComApple();
    if (error) {
      setErrorMsg("Não foi possível entrar com a Apple. Tente com e-mail e senha.");
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    // entrarComGoogle bifurca: web segue igual, app usa Custom Tab + core://auth
    // (no app o redirect antigo devolvia a pessoa no SITE — ver auth-nativo.ts)
    const { error } = await entrarComGoogle();
    if (error) {
      setErrorMsg("Não foi possível entrar com Google. Tente com e-mail e senha.");
      setGoogleLoading(false);
    }
  };

  // Evita flash do formulário enquanto o auth resolve a sessão salva.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Já está logado (comprou e nem fechou o app): não pede nada, só abre a porta.
  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm text-center space-y-6 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Você já está dentro! 🎉</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sua conta <strong className="text-foreground">{user.email}</strong> já está
              conectada neste aparelho.
            </p>
          </div>
          <Button onClick={() => navigate("/home")} className="w-full gap-2 h-12 text-base font-semibold">
            Abrir meu CORE <ArrowRight className="w-4 h-4" />
          </Button>
          <button
            onClick={async () => { await supabase.auth.signOut(); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Não é você? Entrar com outra conta
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* brilho suave no topo — recepção, não tela genérica de login */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6 relative"
      >
        {/* Marca + boas-vindas */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center text-xl font-extrabold tracking-tight mx-auto shadow-sm">
            C
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-semibold"
          >
            {app ? <Sparkles className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {app ? "Bem-vindo de volta" : "Compra confirmada"}
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              {app ? "Entrar no seu CORE" : "Seu acesso está liberado 🎉"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {app ? (
                <>
                  Use o <strong className="text-foreground">e-mail</strong> e a{" "}
                  <strong className="text-foreground">senha</strong> da sua conta CORE.
                </>
              ) : (
                <>
                  Entre com o <strong className="text-foreground">e-mail</strong> e a{" "}
                  <strong className="text-foreground">senha</strong> que você criou no
                  tutorial, antes do pagamento.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="entrar-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Seu e-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="entrar-email"
                  type="email"
                  placeholder="seu@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="entrar-senha" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sua senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="entrar-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="A senha que você criou"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-destructive leading-snug"
              role="alert"
            >
              {errorMsg}
            </motion.p>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2 h-12 text-base font-semibold">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Entrar no meu CORE
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Quem criou a conta com Google não tem senha — precisa desta porta.
            Escondido em webview (Instagram/Gmail in-app) porque o OAuth quebra lá.

            O BOTÃO VOLTOU PRO APP (28/07). Em 25/07 ele foi escondido aqui com
            a nota "reativar junto com o deep link", porque o callback ia pro
            SITE e a sessão nascia no navegador. O deep link agora existe:
            `core://auth` + Custom Tab (ver auth-nativo.ts), medido dentro do
            APK. Sem esta porta, quem se cadastrava pelo Google no funil ficava
            TRANCADO FORA na volta — sem senha pra tentar o e-mail. */}
        {!isInAppBrowser() && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {ehApple() ? "ou entre com" : "criou a conta com Google?"}
                </span>
              </div>
            </div>

            {/*
              SIGN IN WITH APPLE — regra 4.8. Existe porque o app oferece
              login do Google: nesse caso a Apple exige uma opção equivalente
              que limite os dados a nome+e-mail e permita esconder o e-mail.
              Vem ANTES do Google de propósito — a regra pede prominência ao
              menos igual, e "igual" com o outro em cima é discutível numa
              revisão. Só no iPhone: na web e no Android ninguém pediu isso, e
              a tela de login do Android está no ar funcionando.
            */}
            {ehApple() && (
              <Button
                type="button"
                onClick={handleApple}
                disabled={appleLoading || googleLoading || loading}
                className="w-full gap-2 h-11 bg-black text-white hover:bg-black/90"
              >
                {appleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <AppleIcon />
                    Continuar com a Apple
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleLoading || appleLoading || loading}
              className="w-full gap-2 h-11"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <GoogleIcon />
                  Continuar com Google
                </>
              )}
            </Button>
          </>
        )}

        {/* Socorro pra senha — ganha destaque depois do 1º erro */}
        <div
          className={`rounded-xl border p-4 text-center space-y-1.5 transition-colors ${
            failedOnce
              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
              : "border-border bg-card"
          }`}
        >
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Não lembra a senha?
          </p>
          <Link to="/reset-password" className="text-sm text-primary font-semibold hover:underline">
            Redefinir senha em 1 minuto
          </Link>
        </div>

        {/* No app NÃO pode prometer vitalício: lá o modelo é assinatura, e a
            contradição reprova na revisão do Play. */}
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          {app
            ? "Seus dados ficam salvos na sua conta, em qualquer aparelho."
            : "Acesso vitalício: pagou uma vez, é seu pra sempre."}
        </p>
      </motion.div>
    </div>
  );
};

export default Entrar;
