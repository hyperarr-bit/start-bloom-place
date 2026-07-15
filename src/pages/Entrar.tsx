import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { trackEvent } from "@/lib/analytics";

/** /entrar — porta de entrada enviada por E-MAIL pela Cakto após a compra.
 *  A pessoa acabou de pagar e criou a conta no tutorial minutos antes; esta
 *  tela só relembra: "use o e-mail e a senha que você criou no tutorial".
 *  Sem prefill de e-mail de propósito (decisão do dono: menos superfície de bug). */

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

const Entrar = () => {
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
          ? "E-mail ou senha não bateram. Confere se é o mesmo e-mail que você usou no tutorial."
          : error.message,
      );
      setLoading(false);
    } else {
      trackEvent("login_completed", { method: "password", source: "email_access" });
      navigate("/home");
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
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
            <CheckCircle2 className="w-3.5 h-3.5" />
            Compra confirmada
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              Seu acesso está liberado 🎉
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Entre com o <strong className="text-foreground">e-mail</strong> e a{" "}
              <strong className="text-foreground">senha</strong> que você criou no
              tutorial, antes do pagamento.
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

        {/* Quem criou a conta com Google no tutorial não tem senha — precisa desta porta.
            Escondido em webview (Instagram/Gmail in-app) porque o OAuth quebra lá. */}
        {!isInAppBrowser() && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  criou a conta com Google?
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
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

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Acesso vitalício: pagou uma vez, é seu pra sempre.
        </p>
      </motion.div>
    </div>
  );
};

export default Entrar;
