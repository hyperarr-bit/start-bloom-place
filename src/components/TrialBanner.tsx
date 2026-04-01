import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const TrialBanner = () => {
  const { user, trialExpired, isSubscribed } = useAuth();
  const navigate = useNavigate();
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!user || isSubscribed) return;

    const fetchTrialTime = async () => {
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("created_at")
        .eq("id", user.id)
        .single();

      if (profile) {
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const remaining = 24 - (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        setHoursLeft(Math.max(0, remaining));
      }
    };

    fetchTrialTime();
    const interval = setInterval(fetchTrialTime, 60000);
    return () => clearInterval(interval);
  }, [user, isSubscribed]);

  if (isSubscribed || !user) return null;

  if (trialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center px-4"
      >
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">Seu trial expirou</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Suas 24h gratuitas acabaram. Assine para continuar organizando sua vida com o CORE.
          </p>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => navigate("/planos")}>
              Ver planos a partir de R$14,90/mês
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (hoursLeft !== null && hoursLeft < 24) {
    const hours = Math.floor(hoursLeft);
    const minutes = Math.floor((hoursLeft - hours) * 60);
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        className="bg-primary/5 border-b border-primary/20"
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Trial gratuito: <strong>{hours}h {minutes}min</strong> restantes</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/planos")}>
            Assinar agora
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
};
