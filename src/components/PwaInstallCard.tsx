import { useState } from "react";
import { Smartphone, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackEvent } from "@/lib/analytics";

const DISMISS_KEY = "pwa-install-dismissed";

/** Convite pra instalar o CORE na tela inicial. Some sozinho quando: já roda
 *  instalado, não tem como instalar (desktop sem prompt), ou foi dispensado
 *  (variante home). Nunca aparece em superfície de venda — só pós-login. */
export const PwaInstallCard = ({ variant }: { variant: "home" | "welcome" }) => {
  const { canInstall, promptInstall, instalado, iosSafari } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "true"; } catch { return false; }
  });

  if (instalado) return null;
  if (variant === "home" && dismissed) return null;
  if (!canInstall && !iosSafari) return null; // sem caminho de instalação aqui

  const dispensar = () => {
    try { localStorage.setItem(DISMISS_KEY, "true"); } catch { /* noop */ }
    setDismissed(true);
    trackEvent("pwa_card_dismissed");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative">
      {variant === "home" && (
        <button
          onClick={dispensar}
          aria-label="Dispensar"
          className="absolute top-2.5 right-2.5 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Smartphone className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Instale o CORE no seu celular</p>
          {canInstall ? (
            <>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">
                Abre direto da tela inicial, como um app.
              </p>
              <Button size="sm" className="h-9 rounded-lg" onClick={promptInstall}>
                Instalar app
              </Button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <p className="flex items-center gap-1.5">
                1. Toque em <Share className="w-3.5 h-3.5 inline text-foreground" /> <strong className="text-foreground">Compartilhar</strong>
              </p>
              <p className="flex items-center gap-1.5">
                2. <SquarePlus className="w-3.5 h-3.5 inline text-foreground" /> <strong className="text-foreground">Adicionar à Tela de Início</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
