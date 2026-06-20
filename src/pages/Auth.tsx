import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, CheckCircle, Check, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { useUserData } from "@/hooks/use-user-data";

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error) {
      toast({ title: "Erro ao entrar com Google", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
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
        navigate("/financas");
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
          navigate("/planos");
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
      <div className="lpx min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="font-display text-[24px] font-semibold text-center mb-6">core<span className="text-[#127A56]">.</span></div>
          <div className="rounded-2xl border border-[#E9E1D6] bg-white p-7 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-14 h-14 rounded-full bg-[#E4F0EA] flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-7 h-7 text-[#127A56]" />
            </motion.div>
            <h2 className="font-display text-[22px] font-semibold mb-2">Confirme seu e-mail</h2>
            <p className="text-[#6B6259] text-[14px] leading-relaxed">
              Enviamos um link de confirmação para <strong className="text-[#1B1714]">{email}</strong>. Confirme pra ativar sua conta.
            </p>
            <p className="text-[12.5px] text-[#6B6259] mt-3">
              Depois é só escolher seu plano e começar — com 7 dias de garantia.
            </p>
            <button
              onClick={() => { setConfirmationSent(false); setIsLogin(true); }}
              className="mt-5 text-[14px] text-[#127A56] font-semibold hover:underline"
            >
              Já confirmei, fazer login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="lpx min-h-screen md:grid md:grid-cols-2">
      {/* Painel de marca (desktop) */}
      <div className="hidden md:flex flex-col justify-between bg-[#1B1714] text-white p-12 lg:p-16">
        <div className="font-display text-[24px] font-semibold">core<span className="text-[#E8943B]">.</span></div>
        <div>
          <h2 className="font-display text-[34px] lg:text-[40px] font-semibold leading-[1.08] tracking-[-0.01em] max-w-[15ch]">
            Comece a ver pra onde seu dinheiro vai.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {[
              "16 módulos numa assinatura só",
              "7 dias de garantia — sem risco",
              "Cancele em 1 clique, sem fidelidade",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-white/85 text-[15px]">
                <span className="w-5 h-5 rounded-full bg-[#127A56] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-white/45 text-[12px]">Seus dados são só seus · criptografados</div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="md:hidden font-display text-[24px] font-semibold text-center mb-7">core<span className="text-[#127A56]">.</span></div>

          <h1 className="font-display text-[28px] font-semibold tracking-tight">
            {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
          </h1>
          <p className="text-[14px] text-[#6B6259] mt-1 mb-6">
            {isLogin ? "Entre pra continuar de onde parou." : "Comece hoje — com 7 dias de garantia."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6259]" />
                <Input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 bg-white border-[#DDD4C7]" required autoComplete="name" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6259]" />
              <Input type="email" placeholder="seu@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white border-[#DDD4C7]" required autoComplete="email" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6259]" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 bg-white border-[#DDD4C7]"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6259] hover:text-[#1B1714]">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2 mt-1 bg-[#127A56] hover:bg-[#0E5E42] text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>{isLogin ? "Entrar" : "Criar conta"}<ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#E9E1D6]" /></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wide"><span className="bg-[#FAF6F0] px-2 text-[#6B6259]">ou</span></div>
          </div>

          {/* Google */}
          <Button type="button" variant="outline" onClick={handleGoogleAuth} disabled={googleLoading || loading} className="w-full gap-2 bg-white border-[#DDD4C7] hover:bg-[#FBF8F3] text-[#1B1714]">
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><GoogleIcon />Continuar com Google</>)}
          </Button>

          {/* Forgot + Toggle */}
          <div className="mt-5 text-center space-y-2">
            {isLogin && (
              <Link to="/reset-password" className="block text-[13px] text-[#6B6259] hover:text-[#1B1714]">Esqueci minha senha</Link>
            )}
            {isLogin ? (
              <p className="text-[14px]">
                <span className="text-[#6B6259]">Não tem conta? </span>
                <button onClick={() => setIsLogin(false)} className="text-[#127A56] font-semibold hover:underline">Crie a sua</button>
              </p>
            ) : (
              <p className="text-[14px]">
                <span className="text-[#6B6259]">Já tem conta? </span>
                <button onClick={() => setIsLogin(true)} className="text-[#127A56] font-semibold hover:underline">Faça login</button>
              </p>
            )}
          </div>

          {/* O que você leva (signup) */}
          <AnimatePresence>
            {!isLogin && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-5 rounded-xl border border-[#E9E1D6] bg-white p-4">
                  <p className="text-[12px] font-semibold mb-2">✨ O que você leva:</p>
                  <ul className="text-[12.5px] text-[#6B6259] space-y-1.5">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#127A56] shrink-0" strokeWidth={3} /> Acesso completo aos <strong className="text-[#1B1714] font-semibold">16 módulos</strong>, sem upsell</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#127A56] shrink-0" strokeWidth={3} /> Garantia de 7 dias · cancele quando quiser</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
