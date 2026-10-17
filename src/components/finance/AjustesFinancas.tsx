import { useState } from "react";
import { Building2, ChevronRight, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trackEvent } from "@/lib/analytics";

/**
 * AJUSTES DE FINANÇAS (17/10, 1.0.16) — o ⚙ no fim da fila de abas.
 *
 * Nasceu pra tirar do topo do MEU FINANCEIRO o link "Separar pessoa física e
 * empresa" (dono: "quebra o design" — e quase ninguém tem PJ). Finanças não
 * tinha menu nenhum e o cabeçalho não tem espaço no iPhone (← $ FINANÇAS · mês
 * · ✨ · Dicas · ☀︎ já encosta nos 390 px — o ✨ chega a espremer), então o ⚙
 * fica no fim da fila de abas: visível em qualquer aba, fora do conteúdo.
 *
 * A entrada NÃO tem formulário próprio: fecha a folha e pede ao Index o
 * formulário de sempre da barra de perfis (SeletorDePerfil, no topo do MEU
 * FINANCEIRO) — criar pelo menu é exatamente o que o link fazia, e a pessoa
 * já vê onde a troca Pessoal ↔ empresa vai morar. Quem já tem empresa vê
 * "Adicionar outra empresa", que abre o mesmo formulário (o + da barra).
 *
 * Eventos (sem nome de empresa, só contagem): `financas_pj_menu_abrir`
 * {passo: "menu" (abriu o ⚙) | "formulario" (tocou na entrada), empresas};
 * a criação conta em `financas_pj_criada` {origem: "menu"} no SeletorDePerfil.
 */
export function AjustesFinancas({ empresas, onSepararEmpresa }: {
  /** Quantas empresas a pessoa já tem (só muda o texto da entrada). */
  empresas: number;
  /** Abre o formulário de criar empresa no topo do MEU FINANCEIRO. */
  onSepararEmpresa: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const temEmpresa = empresas > 0;

  const abrir = () => {
    setAberta(true);
    trackEvent("financas_pj_menu_abrir", { passo: "menu", empresas });
  };

  const separar = () => {
    trackEvent("financas_pj_menu_abrir", { passo: "formulario", empresas });
    setAberta(false);
    onSepararEmpresa();
  };

  return (
    <>
      {/* fio fino separando a fila de abas (que rola) do ⚙ (que fica) */}
      <span className="w-px h-6 bg-border shrink-0" aria-hidden="true" />
      {/* Botão comum, NÃO SheetTrigger, de propósito: com Trigger o Radix devolve o foco pra ele quando a
          folha fecha — e roubaria o foco do campo "Nome da empresa" que a entrada acabou de abrir (o
          teclado fecharia). Teste: limpeza-topo-1016 ("com foco"). */}
      <button
        type="button"
        onClick={abrir}
        aria-label="Ajustes de Finanças"
        data-testid="financas-ajustes"
        className="shrink-0 ml-1 w-9 min-h-[44px] grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Settings className="w-[18px] h-[18px]" />
      </button>

      <Sheet open={aberta} onOpenChange={setAberta}>
        <SheetContent
          side="bottom"
          className="p-0 z-[300] rounded-t-[28px] border-x-0 border-b-0 max-h-[85dvh] overflow-y-auto pb-[max(1.25rem,var(--app-safe-bottom))]"
          overlayClassName="z-[290]"
          data-testid="financas-ajustes-folha"
          aria-describedby={undefined}
        >
          <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
          </div>
          <SheetHeader className="px-5 pt-4 pb-3 text-left">
            <SheetTitle className="text-sm font-semibold">Ajustes de Finanças</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-1">
            <button
              type="button"
              onClick={separar}
              data-testid="financas-pj-abrir"
              className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <span className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0" aria-hidden="true">
                <Building2 className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold leading-snug">
                  {temEmpresa ? "Adicionar outra empresa (PJ)" : "Separar as finanças da empresa (PJ)"}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {temEmpresa
                    ? "Você troca entre Pessoal e cada empresa no topo do Meu Financeiro."
                    : "Um perfil só pra empresa, ao lado do Pessoal. O que você já lançou continua no Pessoal."}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
