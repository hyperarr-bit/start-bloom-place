import { useEffect, useState } from "react";
import { Gift, Copy, Share2, Check, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Indique e ganhe: link com o código do usuário (?ref=CODE). Quando o amigo
 * assina, o cakto-webhook dá +30 dias pros dois. Mantido enxuto de propósito:
 * uma frase, o link, dois botões.
 */
export const ReferralSheet = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user || code) return;
    supabase
      .from("profiles")
      .select("referral_code" as any)
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setCode((data as any)?.referral_code ?? null));
  }, [open, user, code]);

  const link = code ? `${window.location.origin}/comecar?ref=${code}` : "";

  const copy = async () => {
    if (!link) return;
    trackEvent("referral_copy", {});
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não consegui copiar — segura no link pra copiar manualmente.");
    }
  };

  const share = async () => {
    if (!link) return;
    trackEvent("referral_share", {});
    const text = "Tô organizando meu dinheiro com o CORE. Cria tua conta pelo meu link que a gente ganha 1 mês grátis cada:";
    if (navigator.share) {
      try { await navigator.share({ text: `${text} ${link}` }); } catch { /* cancelou */ }
    } else {
      copy();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-center space-y-0">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-3 mt-1">
            <Gift className="w-7 h-7" />
          </div>
          <SheetTitle className="text-xl !mt-0">Indique e ganhe</SheetTitle>
        </SheetHeader>

        <div className="max-w-sm mx-auto mt-2 space-y-4 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seu amigo assina pelo seu link, <strong className="text-foreground">vocês dois ganham +30 dias</strong>. Simples assim.
          </p>

          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[13px] font-mono break-all select-all">
            {code ? link : <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={copy} disabled={!code} className="h-11 gap-2 font-semibold">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
            <Button onClick={share} disabled={!code} className="h-11 gap-2 font-bold">
              <Share2 className="w-4 h-4" /> Compartilhar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
