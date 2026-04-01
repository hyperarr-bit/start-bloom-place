import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WIDGET_CATALOG, WidgetId, ActiveWidget } from "@/hooks/use-home-widgets";
import { motion } from "framer-motion";
import { Plus, Check, Maximize2, Minimize2 } from "lucide-react";

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeWidgets: ActiveWidget[];
  onToggle: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
}

const categoryLabels: Record<string, string> = {
  produtividade: "📋 Produtividade",
  saúde: "💪 Saúde",
  finanças: "💰 Finanças",
  "bem-estar": "🧘 Bem-estar",
};

export const WidgetPicker = ({ open, onOpenChange, activeWidgets, onToggle, onToggleSize }: WidgetPickerProps) => {
  const categories = [...new Set(WIDGET_CATALOG.map(w => w.category))];
  const getActive = (id: WidgetId) => activeWidgets.find(w => w.id === id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Adicionar Widgets</DialogTitle>
          <p className="text-xs text-muted-foreground">Personalize sua Home com informações úteis</p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {categories.map(cat => (
            <div key={cat}>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {categoryLabels[cat] || cat}
              </h4>
              <div className="space-y-1.5">
                {WIDGET_CATALOG.filter(w => w.category === cat).map(widget => {
                  const active = getActive(widget.id);
                  const isActive = !!active;
                  return (
                    <motion.div
                      key={widget.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        isActive
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/50 bg-card hover:bg-muted/50"
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <button
                        onClick={() => onToggle(widget.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className="text-lg">{widget.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{widget.label}</p>
                          <p className="text-[10px] text-muted-foreground">{widget.description}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isActive && (
                          <button
                            onClick={() => onToggleSize(widget.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                            title={active.size === "small" ? "Expandir" : "Reduzir"}
                          >
                            {active.size === "small" ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => onToggle(widget.id)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isActive ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
