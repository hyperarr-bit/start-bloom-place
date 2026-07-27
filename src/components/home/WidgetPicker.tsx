import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WIDGET_CATALOG, WidgetId, ActiveWidget } from "@/hooks/use-home-widgets";
import { motion } from "framer-motion";
import { Check, Maximize2, Minimize2 } from "lucide-react";

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWidgets: ActiveWidget[];
  onToggle: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
}

const categoryLabels: Record<string, string> = {
  produtividade: "Produtividade",
  saúde: "Saúde",
  finanças: "Finanças",
  "bem-estar": "Bem-estar",
};

/**
 * Escolher widget (26/07 — bronca do dono: "design verdadeiramente pobre").
 *
 * O que estava errado: era uma LISTA DE CONFIGURAÇÕES. Dez linhas brancas
 * idênticas, cada uma com um "+" cinza de 24px, e a pessoa escolhia o widget
 * SEM NUNCA VER como ele fica na Home — comprando às cegas. Além disso a
 * folha ia de ponta a ponta da tela e cortava no meio do último item.
 *
 * O que mudou:
 *  - virou um cartão flutuante de cantos bem redondos (28px), com margem em
 *    volta, no lugar de painel colado nas bordas
 *  - cada widget virou um AZULEJO com miniatura do formato real (o traço
 *    largo = widget grande, os dois quadrados = pequeno), então dá pra ver o
 *    que se está escolhendo
 *  - ativo é estado visível do azulejo inteiro (borda + tinta + ✓ no canto),
 *    não um "+" que vira "✓"
 *  - o corte no fim virou desvanecimento, pra ficar claro que há mais abaixo
 */
export const WidgetPicker = ({ open, onOpenChange, activeWidgets, onToggle, onToggleSize }: WidgetPickerProps) => {
  const categories = [...new Set(WIDGET_CATALOG.map(w => w.category))];
  const getActive = (id: WidgetId) => activeWidgets.find(w => w.id === id);
  const ativos = activeWidgets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-[380px] rounded-[28px] border-0 p-0 gap-0
                   shadow-[0_24px_70px_-12px_rgba(0,0,0,0.45)] overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 text-center space-y-1">
          <DialogTitle className="text-[19px] font-bold tracking-tight">Widgets da Home</DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            {ativos === 0
              ? "Escolha o que aparece na sua tela inicial"
              : `${ativos} ${ativos === 1 ? "widget ativo" : "widgets ativos"} · toque para adicionar ou tirar`}
          </p>
        </DialogHeader>

        <div className="relative">
          <div className="max-h-[58vh] overflow-y-auto px-5 pb-6 space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70 mb-2.5 px-1">
                  {categoryLabels[cat] || cat}
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {WIDGET_CATALOG.filter(w => w.category === cat).map(widget => {
                    const active = getActive(widget.id);
                    const isActive = !!active;
                    const grande = active?.size !== "small";
                    return (
                      <motion.button
                        key={widget.id}
                        onClick={() => onToggle(widget.id)}
                        whileTap={{ scale: 0.96 }}
                        aria-pressed={isActive}
                        className={`relative text-left rounded-[20px] border p-3 transition-colors ${
                          isActive
                            ? "border-primary bg-primary/[0.07]"
                            : "border-border/60 bg-card hover:bg-muted/40"
                        }`}
                      >
                        {/* miniatura: mostra o formato que o widget terá na Home */}
                        <div
                          className={`mb-2.5 rounded-lg bg-muted/70 p-1.5 flex gap-1 ${
                            isActive ? "bg-primary/10" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {grande ? (
                            <div className="h-6 flex-1 rounded bg-foreground/15" />
                          ) : (
                            <>
                              <div className="h-6 flex-1 rounded bg-foreground/15" />
                              <div className="h-6 flex-1 rounded bg-foreground/[0.07]" />
                            </>
                          )}
                        </div>

                        <div className="flex items-start gap-1.5">
                          <span className="text-base leading-none mt-[1px]">{widget.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-semibold leading-tight truncate">{widget.label}</p>
                            <p className="text-[10.5px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                              {widget.description}
                            </p>
                          </div>
                        </div>

                        {/* Os widgets têm DOIS tamanhos, e antes isso vivia
                            escondido num ícone de 24px. Virou seletor com
                            nome: quem escolhe o widget escolhe o tamanho na
                            mesma tela, sem precisar descobrir. */}
                        {isActive && (
                          <div
                            role="group"
                            aria-label="Tamanho do widget"
                            className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-0.5"
                            onClick={e => e.stopPropagation()}
                          >
                            {([["pequeno", false], ["grande", true]] as const).map(([rotulo, querGrande]) => (
                              <span
                                key={rotulo}
                                role="button"
                                tabIndex={0}
                                aria-pressed={grande === querGrande}
                                onClick={() => { if (grande !== querGrande) onToggleSize(widget.id); }}
                                onKeyDown={e => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (grande !== querGrande) onToggleSize(widget.id);
                                  }
                                }}
                                className={`flex items-center justify-center gap-1 rounded-[6px] py-1 text-[10px] font-semibold capitalize transition-colors ${
                                  grande === querGrande
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {querGrande ? <Maximize2 className="w-2.5 h-2.5" /> : <Minimize2 className="w-2.5 h-2.5" />}
                                {rotulo}
                              </span>
                            ))}
                          </div>
                        )}

                        {isActive && (
                          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* desvanecimento no fim: antes o último item era cortado no meio e
              parecia bug em vez de "role para ver mais" */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
