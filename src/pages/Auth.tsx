import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { entrarComGoogle } from "@/lib/auth-nativo";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, CheckCircle, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { isInAppBrowser } from "@/lib/funnel";
import { trackEvent } from "@/lib/analytics";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => searchParams.get("signup") !== "1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const { set: setUserData } = useUserData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    // web igual; app usa Custom Tab + core://auth (ver auth-nativo.ts)
    const { error } = await entrarComGoogle();
    if (error) {
      toast({ title: "Erro ao entrar com Google", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  // Show welcome screen only if user hasn't seen it before
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("core-welcome-done");
  });

  const handleWelcomeComplete = () => {
    localStorage.setItem("core-welcome-done", "true");
    setShowWelcome(false);
    setIsLogin(false); // Go to signup
  };

  const handleWelcomeLogin = () => {
    localStorage.setItem("core-welcome-done", "true");
    setShowWelcome(false);
    setIsLogin(true); // Go to login
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (!isLogin && !name.trim()) {
      toast({ title: "Informe seu nome", description: "Digite seu nome para criar a conta.", variant: "destructive" });
      return;
    }
    
    // SECURITY: senha forte só no signup; no login mantém validação simples
    if (!isLogin) {
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        toast({ title: "Senha fraca", description: "Use no mínimo 8 caracteres, com letras e números.", variant: "destructive" });
        return;
      }
    } else if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message, variant: "destructive" });
      } else {
        trackEvent("login_completed", { method: "password" });
        // raiz decide (RootGate): veterano → hub; recém-chegado do funil →
        // promessa da área. Antes ia direto pra /financas (dívida do pivot).
        navigate("/");
      }
    } else {
      const { error, session } = await signUp(email, password, name.trim());
      if (error) {
        toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      } else {
        trackEvent("signup_completed", { method: "password" });
        try { setUserData("user-name", name.trim()); } catch {}
        try { setUserData("force-new-user-tutorial", "true"); } catch {}
        try { localStorage.setItem("force-new-user-tutorial", "true"); } catch {}
        if (session) {
          navigate("/home");
        } else {
          // Email confirmation required by Supabase — fall back to confirm screen
          setConfirmationSent(true);
        }
      }
    }
    setLoading(false);
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">CORE</h1>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
            >
              <CheckCircle className="w-7 h-7 text-primary" />
            </motion.div>
            <h2 className="text-xl font-bold">Confirme seu e-mail</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>. 
              Verifique sua caixa de entrada e clique no link para ativar sua conta.
            </p>
            <p className="text-xs text-muted-foreground">
              Seu teste grátis de 7 dias começa assim que confirmar o e-mail.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <button
              onClick={() => { setConfirmationSent(false); setIsLogin(true); }}
              className="text-sm text-primary font-medium hover:underline"
            >
              Já confirmei, fazer login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">CORE</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>


        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="seu@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isLogin ? "Entrar" : "Criar conta"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Google — escondido em webview do Instagram/Facebook (OAuth bloqueado lá) */}
        {/* No app das lojas o Google fica fora (25/07): o WebView roda em
            localhost, então getAuthRedirectUrl() manda o callback pro SITE —
            o navegador externo abre, a sessão nasce lá e nunca volta pro app.
            Não há intent-filter de deep link pra trazer de volta. Botão que
            leva pra fora e não retorna é reprovação na revisão; e-mail e senha
            funcionam. Reativar junto com o deep link. */}
        {!isInAppBrowser() && !isNativeShell() && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              className="w-full gap-2"
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

        {/* Forgot password + Toggle */}
        <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
          {isLogin && (
            <Link to="/reset-password" className="text-sm text-primary font-medium hover:underline">
              Esqueci minha senha
            </Link>
          )}
          {isLogin ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Não tem conta? </span>
              <button onClick={() => setIsLogin(false)} className="text-primary font-medium hover:underline">
                Crie agora
              </button>
            </p>
          ) : (
            <p className="text-sm">
              <span className="text-muted-foreground">Já tem conta? </span>
              <button onClick={() => setIsLogin(true)} className="text-primary font-medium hover:underline">
                Faça login
              </button>
            </p>
          )}
        </div>

        {/* Trial info */}
        <AnimatePresence>
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-medium">✨ O que está incluso no teste grátis:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
  <li>• Acesso completo aos 16 módulos</li>
                  {!isNativeShell() && <li>• Por <strong>7 dias</strong>, sem cartão de crédito</li>}
                  <li>• Cancele quando quiser</li>
                  
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
