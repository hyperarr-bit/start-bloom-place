import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { PendenciasDeHoje, PendingItem } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { trackEvent } from "@/lib/analytics";
import { LinhaDoseDeHoje, useDoseDeHoje } from "@/components/missao-doses/LinhaDoseDeHoje";
import { Disco, LinhaPendencia, avisosDasPendencias } from "./PaginaPendencias";
import { Alca, useFolhaArrastavel, CLASSE_FUNDO_FOLHA, propsDaFolha } from "./folha-arrasto";
import { TRACO, cor, tinta } from "./paleta";

/**
 * "VER TODAS" DAS PENDÊNCIAS (rodada 3, 26/10 — BUG: abria a folha do score). A lista COMPLETA do dia, na mesma
 * folha de baixo da E: a dose da missão, tudo que falta (sem o corte de 5 linhas da página 2), os avisos (conta a
 * vencer, treino da semana) e, no fim, o que já foi feito. Tocar numa linha leva a resolver (o formulário do "+" ou
 * o módulo), como na página. Arrastar pra baixo ou o X fecha.
 */
interface Props {
  aberta: boolean;
  onFechar: () => void;
  pendencias: PendenciasDeHoje;
  onAcao: (id: ActionId) => void;
  onPersonalizar: () => void;
}

export const FolhaPendencias = ({ aberta, onFechar, pendencias, onAcao, onPersonalizar }: Props) => {
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento);
  const dose = useDoseDeHoje();
  const { pending, done } = pendencias;
  const avisos = avisosDasPendencias(pendencias);

  const tocar = (item: PendingItem) => {
    trackEvent("home_pendencia", { tipo: item.tipo ?? "compromisso", destino: item.action ?? item.route ?? null, origem: "todas" });
    onFechar();
    if (item.action) { const a = item.action; window.setTimeout(() => onAcao(a), 220); }
    else if (item.route) navigate(item.route);
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className={CLASSE_FUNDO_FOLHA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-label="Pendências de hoje" data-testid="he-folha-pendencias"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(!!semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-1.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-2">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Pendências de hoje</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5" data-testid="he-pendencias-resumo">
                  {pending.length === 0 ? "Tudo feito por hoje" : `${pending.length} ${pending.length === 1 ? "pendente" : "pendentes"}`}{done.length > 0 ? ` · ${done.length} ${done.length === 1 ? "feita" : "feitas"}` : ""}
                </p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Fechar" data-testid="he-pendencias-fechar" className="w-9 h-9 -mr-1 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>

            <div data-testid="he-pendencias-lista">
              {dose && <div className="px-1 pb-1.5"><LinhaDoseDeHoje dose={dose} /></div>}
              {pending.map((item, i) => <LinhaPendencia key={`p-${item.tipo ?? i}`} item={item} onClick={() => tocar(item)} />)}
              {avisos.map((a) => (
                <button key={a.texto} type="button" onClick={() => { onFechar(); navigate(a.route); }} data-testid={a.alerta ? "hn-aviso-conta" : "hn-aviso"} className="w-full h-[44px] flex items-center gap-2.5 pl-1.5 pr-1.5 rounded-xl text-left active:bg-muted/60">
                  <Disco Icone={a.Icone} tom={a.tom} />
                  <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{a.texto}</span>
                  <span className="h-6 px-2 rounded-full grid place-items-center text-[10.5px] font-bold uppercase tracking-wider shrink-0" style={{ color: cor(a.tom), background: tinta(a.tom) }}>{a.selo}</span>
                </button>
              ))}
              {done.length > 0 && (
                <>
                  <p className="px-2 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Feitas</p>
                  {done.map((item, i) => <LinhaPendencia key={`d-${item.tipo ?? i}`} item={item} feita />)}
                </>
              )}
            </div>

            <button type="button" onClick={() => { onFechar(); window.setTimeout(onPersonalizar, 220); }} data-testid="he-pendencias-personalizar" className="mt-2 w-full h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground active:bg-muted/50">
              <SlidersHorizontal className="w-4 h-4" strokeWidth={TRACO} aria-hidden /> Personalizar o que aparece <ChevronRight className="w-4 h-4 text-muted-foreground/60" strokeWidth={2} aria-hidden />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
