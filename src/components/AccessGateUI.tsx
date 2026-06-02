import { MoreHorizontal, Link2, Hand, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import coreLogo from "@/assets/core-logo.png";
import coreLogoBlack from "@/assets/core-logo-black.png";
import { useTheme } from "@/hooks/use-theme";

export const AccessGateUI = () => {
  const { mode } = useTheme();
  const url = `${window.location.origin}/`;
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
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-background flex flex-col items-center justify-center px-6 py-10 overflow-x-hidden overflow-y-auto">
      {/* Halo + botão circular apontando pros 3 pontinhos */}
      <div className="absolute top-0 right-0 pointer-events-none overflow-hidden w-40 h-40">
        <div className="relative w-40 h-40 -translate-y-16 translate-x-16 rounded-full bg-primary/15">
          <div className="absolute bottom-10 left-10 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg animate-[arrow-nudge_1.4s_ease-in-out_infinite]">
            <ArrowUp className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      <div className="max-w-sm w-full flex flex-col items-center text-center gap-6">
        <img src={logoSrc} alt="Core" className="h-12 w-auto" />

        <h1 className="text-xl font-bold tracking-tight leading-snug">
          Para acessar o site do Core e organizar suas finanças, siga esses 2 passos:
        </h1>


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
