import { MoreHorizontal, ExternalLink, Link2, Hand } from "lucide-react";
import { toast } from "sonner";
import { useIsTikTokBrowser } from "@/hooks/use-in-app-browser";
import coreLogo from "@/assets/core-logo.png";
import coreLogoBlack from "@/assets/core-logo-black.png";
import { useTheme } from "@/hooks/use-theme";

export const TikTokBrowserGate = () => {
  const { isTikTok } = useIsTikTokBrowser();
  const { mode } = useTheme();
  if (!isTikTok) return null;

  const url = `${window.location.origin}/financas`;
  const logoSrc = mode === "dark" ? coreLogo : coreLogoBlack;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: "Cole no Safari ou Chrome." });
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-6">
        <img src={logoSrc} alt="Core" className="h-12 w-auto" />

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo ao Core</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pra ter a melhor experiência, siga esses dois passinhos rápidos:
          </p>
        </div>

        <div className="w-full space-y-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
              1
            </div>
            <p className="text-sm">
              Toque em <MoreHorizontal className="inline w-4 h-4 mx-0.5 -mt-0.5" /> <span className="font-semibold">no canto superior direito</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
              2
            </div>
            <p className="text-sm">
              Depois <span className="font-semibold">"Abrir no navegador"</span>
            </p>
          </div>
        </div>

        <div className="w-full h-px bg-border my-1" />

        <div className="w-full flex flex-col items-center gap-3">
          <a
            href={url}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background rounded-full py-3 px-6 text-sm font-medium active:opacity-80 transition-opacity"
          >
            <Hand className="w-4 h-4" />
            Ou pressione e segure para abrir o link
          </a>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Copiar link
          </button>
        </div>
      </div>
    </div>
  );
};
