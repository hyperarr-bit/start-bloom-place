import { MoreHorizontal, Link2, ArrowUp, Wallet, Gauge, Target } from "lucide-react";
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

  const benefits = [
    {
      icon: Wallet,
      title: "Veja quanto entra e sai",
      desc: "Acompanhe receitas e despesas sem se perder.",
    },
    {
      icon: Gauge,
      title: "Saiba quanto ainda pode gastar",
      desc: "Defina limites e evite passar do ponto.",
    },
    {
      icon: Target,
      title: "Transforme dinheiro em objetivos",
      desc: "Crie desejos e acompanhe suas metas.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-background overflow-x-hidden overflow-y-auto">
      {/* Seta sutil apontando pros 3 pontinhos do TikTok */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-md animate-pulse">
          <ArrowUp className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>

      <div className="max-w-sm mx-auto px-5 pt-6 pb-10 flex flex-col gap-5">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={logoSrc} alt="Core" className="h-7 w-auto" />
        </div>

        {/* Headline */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight leading-tight text-foreground">
            Controle sua vida financeira em um só app
          </h1>
          <p className="text-sm text-muted-foreground leading-snug">
            Receitas, despesas, investimentos, desejos e limites em um painel simples para você saber exatamente para onde seu dinheiro está indo.
          </p>
        </div>

        {/* Benefícios */}
        <div className="space-y-2">
          {benefits.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl border border-border bg-card shadow-sm p-3"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-4 h-4 text-foreground" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Instrução */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Para acessar o Core, abra pelo navegador do celular:
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                1
              </div>
              <p className="text-sm text-foreground">
                Toque nos <MoreHorizontal className="inline w-4 h-4 mx-0.5 -mt-0.5" /> no canto superior direito
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                2
              </div>
              <p className="text-sm text-foreground">
                Escolha <span className="font-semibold">"Abrir no navegador"</span>
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={url}
          className="w-full flex items-center justify-center bg-foreground text-background rounded-full py-3.5 px-6 text-sm font-semibold active:opacity-80 transition-opacity"
        >
          Toque nos 3 pontos para continuar
        </a>

        <p className="text-xs text-muted-foreground text-center leading-snug px-2">
          O TikTok pode limitar o carregamento completo. No navegador do celular, o Core abre normalmente.
        </p>

        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" />
          Copiar link
        </button>
      </div>
    </div>
  );
};
