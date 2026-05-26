import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, User, Mail, Lock, Eye, EyeOff, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useUserData } from "@/hooks/use-user-data";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

interface QuickSignupStepProps {
  /** Optional route to navigate to after successful signup. If empty, stays on current page. */
  redirectTo?: string;
  /** Called after the user clicks the "Aproveitar teste grátis" button on the success screen. */
  onFinished?: () => void;
}

const schema = z.object({
  name: z.string().trim().min(1, "Digite seu nome").max(60, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números"),
});

export const QuickSignupStep = ({ redirectTo = "" }: QuickSignupStepProps) => {
  const { set } = useUserData();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successName, setSuccessName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Confira os dados");
      return;
    }

    setLoading(true);
    const cleanName = parsed.data.name;

    // Save name to guest store so the migration carries it to the account.
    set("profile-name", cleanName);

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: cleanName, full_name: cleanName },
        emailRedirectTo: `${window.location.origin}/inicio`,
      },
    });

    if (error) {
      setLoading(false);
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("registered") || msg.includes("exists")) {
        toast.error("Esse e-mail já tem conta. Quer entrar?", {
          action: { label: "Entrar", onClick: () => navigate("/auth") },
        });
      } else if (msg.includes("password")) {
        toast.error("Use pelo menos 8 caracteres, com letras e números.");
      } else {
        toast.error(error.message || "Não rolou criar a conta. Tenta de novo.");
      }
      return;
    }

    trackEvent("quicksignup_completed", { has_session: !!data.session });

    if (!data.session) {
      // Confirmação de e-mail ainda está ativa no Supabase.
      setLoading(false);
      set("quicksignup-pending", "");
      toast.success("Quase lá! Confirme seu e-mail pra entrar.");
      navigate("/auth");
      return;
    }

    // Marca o tutorial como concluído pra não reaparecer
    set("spotlight-done-financas", "true");
    set("quickstart-target-module", "");
    // Mostra tela de sucesso com oferta de 7 dias grátis
    setSuccessName(cleanName);
    setSuccess(true);
    setLoading(false);
  };

  const handleStartTrial = () => {
    set("quicksignup-pending", "");
    toast.success(`Bem-vindo, ${successName}! Seu teste de 7 dias começou.`);
    if (redirectTo) navigate(redirectTo);
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center gap-5 py-2"
      >
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 14 }}
          className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Sparkles className="relative w-10 h-10 text-primary" strokeWidth={2} />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground leading-tight">
            Você ganhou 7 dias grátis 🎉
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Use o CORE completo, sem limites, por 7 dias. Sem cobrança agora — você decide depois se quer continuar.
          </p>
        </div>
        <button
          onClick={handleStartTrial}
          className="w-full py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-2"
        >
          Aproveitar teste grátis <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold leading-tight text-foreground">
          Parabéns! Você desbloqueou o app completo 🎉
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Falta só 1 passo pra salvar tudo que você configurou e começar a usar de verdade.
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground pl-1">Como podemos te chamar?</span>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu primeiro nome"
              maxLength={60}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-card border border-border focus:border-foreground/40 outline-none text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground pl-1">Seu melhor e-mail</span>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-card border border-border focus:border-foreground/40 outline-none text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground pl-1">Crie uma senha</span>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 8 caracteres, com letras e números"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border focus:border-foreground/40 outline-none text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Criando conta...
            </>
          ) : (
            <>
              Criar conta e entrar <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          Sem confirmação por e-mail. Você entra direto.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate("/auth")}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center mt-1"
      >
        Já tem conta? <span className="font-medium text-foreground">Entrar</span>
      </button>
    </motion.form>
  );
};
