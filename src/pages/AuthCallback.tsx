import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { persistLeadSource } from "@/lib/lead-source";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const errorDesc = params.get("error_description");

        if (errorDesc) {
          toast({ title: "Erro ao confirmar conta", description: errorDesc, variant: "destructive" });
          navigate("/auth", { replace: true });
          return;
        }

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            toast({ title: "Erro ao confirmar conta", description: error.message, variant: "destructive" });
            navigate("/auth", { replace: true });
            return;
          }
        }

        /* Veio do funil? A flag agora carrega O CAMINHO do funil (17/08):
         * "/inicio", "/comecar"… — o valor legado "true" vira /comecar pra
         * não quebrar aba antiga. Dois defeitos consertados aqui, achados na
         * investigação do "User already registered" (23 sessões/semana, 8
         * morriam):
         *   1. usuário EXISTENTE vindo do funil ia pro app ("/") em vez da
         *      OFERTA — a pessoa estava a um passo de pagar e a gente a
         *      mandava passear no app;
         *   2. quem voltava, voltava pro /comecar fixo — funil VELHO — mesmo
         *      tendo saído do /inicio (o que vende hoje).
         * Tutorial só arma pra conta nova, como antes. */
        let funnelPath: string | null = null;
        try {
          const flag = localStorage.getItem("funnel-oauth-pending");
          if (flag) funnelPath = flag === "true" ? "/comecar" : flag;
          localStorage.removeItem("funnel-oauth-pending");
        } catch { /* noop */ }

        const { data: u } = await supabase.auth.getUser();
        const createdAt = u?.user?.created_at ? new Date(u.user.created_at).getTime() : 0;
        const isNewUser = createdAt > 0 && Date.now() - createdAt < 10 * 60 * 1000;
        if (isNewUser && u?.user?.id) await persistLeadSource(supabase, u.user.id);

        if (funnelPath) {
          if (isNewUser) {
            trackEvent("signup_completed", { method: "google" });
            trackEvent("funnel_click", { cta: "signup_success", method: "google" });
            try { localStorage.setItem("force-new-user-tutorial", "true"); } catch { /* noop */ }
          } else {
            trackEvent("funnel_click", { cta: "signup_success", via: "existing_callback" });
          }
          const destino = `${funnelPath}?step=offer`;
          window.history.replaceState({}, "", destino);
          navigate(destino, { replace: true });
          return;
        }

        // Limpa o hash e vai pra Home
        window.history.replaceState({}, "", "/");
        navigate("/", { replace: true });
      } catch (err: any) {
        toast({ title: "Erro ao confirmar conta", description: err?.message ?? "Tente novamente.", variant: "destructive" });
        navigate("/auth", { replace: true });
      }
    };
    run();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Confirmando sua conta...</p>
    </div>
  );
};

export default AuthCallback;
