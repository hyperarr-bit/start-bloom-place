import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { CATALOGO_WIDGETS_E, MAX_WIDGETS_E, type IdDoWidgetE } from "@/lib/home-widgets-e";
import { Interruptor } from "./PersonalizarPendenciasE";
import { Alca, useFolhaArrastavel } from "./folha-arrasto";
import { TRACO, cor, tinta } from "./paleta";

/**
 * "WIDGETS" NO ESTILO DA HOME NOVA — RODADA 3 (26/10): o catálogo enxuto de lib/home-widgets-e, uma linha por widget
 * (ícone no disco da cor, nome, o que mostra) com um interruptor; até 6, na ordem da escolha (o número ao lado). Sem
 * pequeno/grande — o card é um só. Usada na página 3 da Home e em Você › Personalizar início › Widgets.
 */
interface ListaProps {
  ativos: IdDoWidgetE[];
  onToggle: (id: IdDoWidgetE) => void;
}

export function ListaDeWidgets({ ativos, onToggle }: ListaProps) {
  const cheio = ativos.length >= MAX_WIDGETS_E;
  return (
    <ul className="space-y-1" data-testid="hn-widgets-lista">
      {CATALOGO_WIDGETS_E.map((w) => {
        const posicao = ativos.indexOf(w.id);
        const ligado = posicao >= 0;
        return (
          <li key={w.id} data-testid={`widget-${w.id}`} data-ligado={ligado ? "1" : "0"} className="rounded-[18px]" style={{ background: ligado ? "hsl(var(--muted) / 0.35)" : "transparent" }}>
            <div className="flex items-center gap-3 min-h-[56px] px-2 py-1.5">
              <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: tinta(w.tom) }} aria-hidden>
                <w.Icone className="w-[18px] h-[18px]" strokeWidth={TRACO} style={{ color: cor(w.tom) }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold truncate">{w.rotulo}</span>
                <span className="block text-[12px] text-muted-foreground leading-tight line-clamp-1">{w.descricao}</span>
              </span>
              {ligado && <span className="w-6 h-6 rounded-full grid place-items-center text-[11.5px] font-bold tabular-nums bg-foreground text-background" aria-label={`posição ${posicao + 1}`}>{posicao + 1}</span>}
              <Interruptor ligado={ligado} disabled={!ligado && cheio} onChange={() => onToggle(w.id)} rotulo={`Mostrar ${w.rotulo}`} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface Props extends ListaProps {
  aberta: boolean;
  onFechar: () => void;
}

export function EscolherWidgetsE({ aberta, onFechar, ativos, onToggle }: Props) {
  const semMovimento = useReducedMotion();
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento); // rodada 3: arrastar pra baixo fecha
  const n = ativos.length;
  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-label="Widgets da Home" data-testid="hn-widgets-folha" data-folha="widgets-escolher"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={semMovimento ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
          >
            <Alca arrasto={arrasto} className="mb-1.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-3">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Widgets</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">{n === 0 ? `A página 3 da Home · até ${MAX_WIDGETS_E}` : `${n} de ${MAX_WIDGETS_E} · a página 3 da Home, na ordem da escolha`}</p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" data-testid="hn-widgets-fechar" className="w-9 h-9 -mr-1 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>
            <ListaDeWidgets ativos={ativos} onToggle={onToggle} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
