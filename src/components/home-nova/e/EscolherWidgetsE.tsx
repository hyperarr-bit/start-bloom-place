import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { WIDGET_CATALOG, type ActiveWidget, type WidgetId } from "@/hooks/use-home-widgets";
import { Interruptor, Segmentos } from "./PersonalizarPendenciasE";

/**
 * "WIDGETS" NO ESTILO DA HOME NOVA (rodada 2, 26/10) — a mesma lista `core-home-widgets-v2` e as mesmas ações
 * (ligar/desligar, pequeno/grande) do WidgetPicker de hoje, numa folha de baixo limpa: por categoria, uma linha
 * por widget (emoji, nome, o que mostra) com um interruptor; ligado, o tamanho em pílulas. Usada na página 3 da
 * Home e em Você › Personalizar início › Widgets.
 */
const CATEGORIAS: Record<string, string> = { produtividade: "Produtividade", "saúde": "Saúde", "finanças": "Finanças", "bem-estar": "Bem-estar" };

interface ListaProps {
  activeWidgets: ActiveWidget[];
  onToggle: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
}

export function ListaDeWidgets({ activeWidgets, onToggle, onToggleSize }: ListaProps) {
  const categorias = [...new Set(WIDGET_CATALOG.map((w) => w.category))];
  const ativo = (id: WidgetId) => activeWidgets.find((w) => w.id === id);
  return (
    <div className="space-y-5" data-testid="hn-widgets-lista">
      {categorias.map((cat) => (
        <section key={cat}>
          <h4 className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{CATEGORIAS[cat] ?? cat}</h4>
          <ul className="space-y-1">
            {WIDGET_CATALOG.filter((w) => w.category === cat).map((w) => {
              const a = ativo(w.id);
              const ligado = !!a;
              const grande = a?.size === "large";
              return (
                <li key={w.id} data-testid={`widget-${w.id}`} data-ligado={ligado ? "1" : "0"} className="rounded-[18px]" style={{ background: ligado ? "hsl(var(--muted) / 0.35)" : "transparent" }}>
                  <div className="flex items-center gap-3 min-h-[56px] px-2 py-1.5">
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 text-[18px] leading-none bg-card" style={{ boxShadow: "var(--hn-sombra)" }} aria-hidden>{w.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate">{w.label}</span>
                      <span className="block text-[12px] text-muted-foreground leading-tight line-clamp-1">{w.description}</span>
                    </span>
                    <Interruptor ligado={ligado} onChange={() => onToggle(w.id)} rotulo={`Mostrar ${w.label}`} />
                  </div>
                  {ligado && (
                    <div className="px-2 pb-2.5">
                      <Segmentos rotulo={`Tamanho de ${w.label}`} opcoes={[["pequeno", "Pequeno"], ["grande", "Grande"]] as const} ativa={grande ? "grande" : "pequeno"} aoEscolher={(v) => { if ((v === "grande") !== grande) onToggleSize(w.id); }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface Props extends ListaProps {
  aberta: boolean;
  onFechar: () => void;
}

export function EscolherWidgetsE({ aberta, onFechar, activeWidgets, onToggle, onToggleSize }: Props) {
  const semMovimento = useReducedMotion();
  const n = activeWidgets.length;
  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-label="Widgets da Home" data-testid="hn-widgets-folha" data-folha="widgets-escolher"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={semMovimento ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-1 mb-3">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Widgets</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">{n === 0 ? "Os resumos da página 3 da Home" : `${n} ${n === 1 ? "ligado" : "ligados"} · a página 3 da Home`}</p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" data-testid="hn-widgets-fechar" className="w-9 h-9 -mr-1 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>
            <ListaDeWidgets activeWidgets={activeWidgets} onToggle={onToggle} onToggleSize={onToggleSize} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
