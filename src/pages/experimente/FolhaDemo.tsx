import { ArrowRight, X } from "lucide-react";
import { FOLHA_BOTAO, FOLHA_FECHAR, FOLHA_TEXTO, FOLHA_TITULO } from "./conteudo";

/**
 * A FOLHA DE BAIXO do funil-demo: "Gostou? Crie sua conta grátis e continue no app."
 * NÃO bloqueia a demo: sem fundo escuro, sem foco preso; o container é transparente ao toque
 * (pointer-events-none) e só o cartão recebe toque. Quem decide QUANDO aparece é a página
 * (30 s ou a 2ª troca de módulo, 1x por sessão).
 */
export function FolhaDemo({ onCriar, onFechar, titulo = FOLHA_TITULO, texto = FOLHA_TEXTO, botao = FOLHA_BOTAO }: {
  onCriar: () => void;
  onFechar: (via: "botao" | "x") => void;
  /** 16/10: o /liberar passa as frases dele (sem elas, as do /experimente) */
  titulo?: string;
  texto?: string;
  botao?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] px-3 pointer-events-none"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      data-testid="demo-folha-area"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="demo-folha-titulo"
        data-testid="demo-folha"
        className="relative mx-auto max-w-md pointer-events-auto rounded-[20px] border border-border bg-card text-card-foreground px-5 pt-5 pb-4 shadow-[0_18px_50px_-12px_rgba(22,18,28,.45)] animate-in slide-in-from-bottom-6 fade-in duration-300"
      >
        <button
          type="button" onClick={() => onFechar("x")} aria-label="Fechar"
          className="absolute right-2.5 top-2.5 grid place-items-center w-9 h-9 rounded-full text-muted-foreground active:bg-secondary"
          data-testid="demo-folha-x"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
        <p id="demo-folha-titulo" className="pr-8 text-[19px] font-extrabold tracking-[-0.02em] leading-[1.25] text-balance">{titulo}</p>
        <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{texto}</p>
        <button
          type="button" onClick={onCriar} data-testid="demo-folha-criar"
          className="mt-4 w-full h-[50px] rounded-[12px] bg-foreground text-background text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[.985] transition-transform"
        >
          {botao} <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onFechar("botao")} data-testid="demo-folha-fechar" className="mt-1 w-full h-10 text-[14px] font-medium text-muted-foreground">
          {FOLHA_FECHAR}
        </button>
      </div>
    </div>
  );
}
