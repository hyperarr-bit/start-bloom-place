import { AlertCircle, MoreHorizontal, ExternalLink, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useIsTikTokBrowser } from "@/hooks/use-in-app-browser";

export const TikTokBrowserGate = () => {
  const { isTikTok } = useIsTikTokBrowser();
  if (!isTikTok) return null;

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}/financas`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: "Cole no Safari ou Chrome." });
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      {/* Seta animada apontando pros 3 pontinhos */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1 animate-bounce">
        <ArrowUpRight className="w-8 h-8 text-amber-500" />
        <span className="text-[10px] text-muted-foreground font-medium">3 pontinhos</span>
      </div>

      <div className="max-w-sm w-full flex flex-col items-center text-center gap-4 mt-8">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-amber-500" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-lg font-bold tracking-tight">Abra no seu navegador</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O navegador do TikTok não funciona bem com o app. Em 2 cliques você abre direto no Safari/Chrome.
          </p>
        </div>

        <div className="w-full bg-card border border-border rounded-lg p-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <MoreHorizontal className="w-4 h-4" />
            </div>
            <div className="flex-1 pt-1">
              <p className="text-xs font-semibold">Passo 1</p>
              <p className="text-xs text-muted-foreground">Toque nos 3 pontinhos no canto superior direito.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="flex-1 pt-1">
              <p className="text-xs font-semibold">Passo 2</p>
              <p className="text-xs text-muted-foreground">Escolha "Abrir no navegador" (ou "Open in browser").</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Ou copie o link e cole no navegador
        </button>
      </div>
    </div>
  );
};
