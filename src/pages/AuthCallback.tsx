import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
