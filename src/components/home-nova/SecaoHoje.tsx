import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, LayoutGrid, ListChecks, SlidersHorizontal, X } from "lucide-react";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { type PendenciasDeHoje, type PendingItem } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { WIDGET_CATALOG, type ActiveWidget, type WidgetId } from "@/hooks/use-home-widgets";
import { WidgetPicker } from "@/components/home/WidgetPicker";
import { PersonalizarPendencias } from "@/components/home/PersonalizarPendencias";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, type PendenciasPrefs } from "@/lib/home-pendencias";
import { trackEvent } from "@/lib/analytics";

// os mesmos widgets da Home de hoje (pages/Home.tsx), com a moldura trocada pelo CSS .hn-widget
import { FinancesWidget } from "@/components/home/widgets/FinancesWidget";
import { WorkoutWidget } from "@/components/home/widgets/WorkoutWidget";
import { CaloriesWidget } from "@/components/home/widgets/CaloriesWidget";
import { HealthWidget } from "@/components/home/widgets/HealthWidget";
import { HabitsWidget } from "@/components/home/widgets/HabitsWidget";
import { ReadingWidget } from "@/components/home/widgets/ReadingWidget";
import { WeekProgressWidget } from "@/components/home/widgets/WeekProgressWidget";
import { BudgetRemainingWidget } from "@/components/home/widgets/BudgetRemainingWidget";
import { HabitStreaksWidget } from "@/components/home/widgets/HabitStreaksWidget";
import { MotivationalQuoteWidget } from "@/components/home/widgets/MotivationalQuoteWidget";
import { QuickNotesWidget } from "@/components/home/widgets/QuickNotesWidget";
import { FocusTimerWidget } from "@/components/home/widgets/FocusTimerWidget";
import { MacroBalanceWidget } from "@/components/home/widgets/MacroBalanceWidget";
import { SleepLogWidget } from "@/components/home/widgets/SleepLogWidget";
import { CountdownWidget } from "@/components/home/widgets/CountdownWidget";
import { WeekCalendarWidget } from "@/components/home/widgets/WeekCalendarWidget";
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { PetWidget } from "@/components/home/widgets/PetWidget";
import { RelacoesWidget } from "@/components/home/widgets/RelacoesWidget";
import { SkincareWidget } from "@/components/home/widgets/SkincareWidget";
import { CuidadosWidget } from "@/components/home/widgets/CuidadosWidget";
import { DEPOIS_DA_SAIDA_MS } from "./e/folha-arrasto";

type WidgetComponent = React.FC<{ size?: "small" | "large" }>;
const WIDGETS: Record<WidgetId, WidgetComponent> = {
  finances: FinancesWidget, workout: WorkoutWidget, calories: CaloriesWidget, health: HealthWidget, habits: HabitsWidget,
  reading: ReadingWidget, "week-progress": WeekProgressWidget as WidgetComponent, "budget-remaining": BudgetRemainingWidget as WidgetComponent,
  "habit-streaks": HabitStreaksWidget as WidgetComponent, "motivational-quote": MotivationalQuoteWidget as WidgetComponent,
  "quick-notes": QuickNotesWidget as WidgetComponent, "focus-timer": FocusTimerWidget as WidgetComponent,
  "macro-balance": MacroBalanceWidget as WidgetComponent, "sleep-log": SleepLogWidget as WidgetComponent,
  countdown: CountdownWidget as WidgetComponent, "week-calendar": WeekCalendarWidget as WidgetComponent,
  tasks: TasksWidget as WidgetComponent, pet: PetWidget as WidgetComponent, relacoes: RelacoesWidget as WidgetComponent,
  skincare: SkincareWidget as WidgetComponent, cuidados: CuidadosWidget as WidgetComponent,
};

/**
 * SEÇÃO "HOJE" (mockup 25/10) — as Pendências de hoje e os widgets num bloco só, com UMA porta de
 * personalização. Antes eram dois blocos soltos: o pontilhado "Adicionar widget" e um cabeçalho
 * "PENDÊNCIAS DE HOJE · 5 pendentes ▾ · ⚙".
 *
 *  - título grande "Hoje" (como as seções do Cal AI), e à direita "Personalizar" — que abre uma folhinha com
 *    as duas coisas que a pessoa pode mexer aqui: Widgets da Home (o WidgetPicker de sempre) e Pendências
 *    (o PersonalizarPendencias de sempre);
 *  - a lista das pendências vira um cartão sem bordas internas: emoji num disco, o texto, a seta. Mostra até 5
 *    pendentes; o resto (e as feitas) fica atrás de uma linha "mais N · M feitas";
 *  - tocar numa pendência faz o MESMO de hoje: abre a ação rápida (agora na folha do "+") ou vai pro módulo;
 *  - os widgets escolhidos entram logo abaixo, com a mesma moldura.
 */
const MAX_PENDENTES = 5;

interface Props {
  data: LifeHubData;
  pendencias: PendenciasDeHoje;
  widgets: ActiveWidget[];
  onToggleWidget: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
  /** abre a folha do "+" já numa ação (humor, gasto…) */
  onAcao: (id: ActionId) => void;
}

const Linha = ({ item, feita, onClick }: { item: PendingItem; feita?: boolean; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={feita ? "hn-pendencia-feita" : "hn-pendencia"}
    className={`w-full min-h-[48px] flex items-center gap-3 pl-1.5 pr-2 rounded-2xl text-left transition-colors active:bg-muted/60 ${feita ? "opacity-60" : ""}`}
  >
    <span className={`w-9 h-9 rounded-xl grid place-items-center text-[17px] leading-none shrink-0 ${feita ? "bg-success/10" : "bg-muted/80"}`} aria-hidden>
      {feita ? <Check className="w-4 h-4 text-success" strokeWidth={3} /> : item.emoji}
    </span>
    <span className={`flex-1 min-w-0 text-[15px] font-medium truncate ${feita ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>{item.label}</span>
    {!feita && (item.route || item.action) && <ChevronRight className="w-4 h-4 text-muted-foreground/55 shrink-0" aria-hidden />}
  </button>
);

const Aviso = ({ emoji, texto, onClick }: { emoji: string; texto: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="w-full min-h-[44px] flex items-center gap-3 pl-1.5 pr-2 rounded-2xl text-left active:bg-muted/60">
    <span className="w-9 h-9 rounded-xl grid place-items-center text-[17px] leading-none shrink-0 bg-warning/12" aria-hidden>{emoji}</span>
    <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{texto}</span>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-warning shrink-0">aviso</span>
  </button>
);

/** Rodapé de um grupo de widgets: pequenos em pares, grandes na largura toda (a mesma regra da Home de hoje). */
const GradeDeWidgets = ({ widgets }: { widgets: ActiveWidget[] }) => {
  const linhas: ActiveWidget[][] = [];
  let par: ActiveWidget[] = [];
  widgets.forEach((w) => {
    if (w.size === "small") { par.push(w); if (par.length === 2) { linhas.push(par); par = []; } }
    else { if (par.length) { linhas.push(par); par = []; } linhas.push([w]); }
  });
  if (par.length) linhas.push(par);
  return (
    <div className="space-y-3" data-testid="hn-widgets">
      {linhas.map((linha) => (
        <div key={linha.map((w) => w.id).join("-")} className={`grid gap-3 ${linha.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {linha.map((w) => { const C = WIDGETS[w.id]; return C ? <div key={w.id} className="hn-widget min-w-0"><C size={w.size} /></div> : null; })}
        </div>
      ))}
    </div>
  );
};

/** A folhinha "Personalizar": duas linhas, cada uma abre a tela de sempre. */
const FolhaPersonalizar = ({ aberta, onFechar, widgetsAtivos, ocultos, onWidgets, onPendencias }: {
  aberta: boolean; onFechar: () => void; widgetsAtivos: number; ocultos: number; onWidgets: () => void; onPendencias: () => void;
}) => {
  const Opcao = ({ Icone, titulo, detalhe, onClick, testid }: { Icone: typeof LayoutGrid; titulo: string; detalhe: string; onClick: () => void; testid: string }) => (
    <button type="button" onClick={onClick} data-testid={testid} className="w-full min-h-[60px] flex items-center gap-3.5 px-3 rounded-2xl text-left active:bg-muted/60">
      <span className="w-11 h-11 rounded-2xl bg-muted grid place-items-center shrink-0"><Icone className="w-5 h-5 text-foreground" strokeWidth={2} aria-hidden /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold">{titulo}</span>
        <span className="block text-[12.5px] text-muted-foreground truncate">{detalhe}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
    </button>
  );
  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className="fixed inset-0 z-[70] bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="dialog" aria-label="Personalizar a seção Hoje" data-testid="hn-folha-personalizar"
            className="fixed inset-x-0 bottom-0 z-[71] rounded-t-[28px] bg-card px-3 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" aria-hidden />
            <div className="flex items-center justify-between px-3 mb-1">
              <h3 className="text-[17px] font-bold">Personalizar</h3>
              <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-2 rounded-full grid place-items-center bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <Opcao Icone={LayoutGrid} titulo="Widgets da Home" detalhe={widgetsAtivos ? `${widgetsAtivos} ${widgetsAtivos === 1 ? "ativo" : "ativos"} · adicionar, tirar, tamanho` : "Resumos dos módulos na sua tela inicial"} onClick={onWidgets} testid="hn-personalizar-widgets" />
            <Opcao Icone={ListChecks} titulo="Pendências de hoje" detalhe={ocultos ? `${ocultos} ${ocultos === 1 ? "tipo oculto" : "tipos ocultos"} · o que entra na lista e no score` : "O que entra na lista e no Score do Dia"} onClick={onPendencias} testid="hn-personalizar-pendencias" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const SecaoHoje = ({ data, pendencias, widgets, onToggleWidget, onToggleSize, onAcao }: Props) => {
  const navigate = useNavigate();
  const { set } = useUserData();
  const [aberta, setAberta] = useState(false);
  const [personalizar, setPersonalizar] = useState(false);
  const [picker, setPicker] = useState(false);
  const [prefsAbertas, setPrefsAbertas] = useState(false);
  const prefs: PendenciasPrefs = data.pendenciasPrefs ?? PREFS_PADRAO;
  const { pending, done, avisoTreino, avisoConta } = pendencias;
  const visiveis = aberta ? pending : pending.slice(0, MAX_PENDENTES);
  const escondidas = pending.length - visiveis.length;

  const tocar = (item: PendingItem) => {
    trackEvent("home_pendencia", { tipo: item.tipo ?? "compromisso", destino: item.action ?? item.route ?? null });
    if (item.action) onAcao(item.action);
    else if (item.route) navigate(item.route);
  };

  let rodape: ReactNode = null;
  if (escondidas > 0 || done.length > 0) {
    const partes: string[] = [];
    if (escondidas > 0) partes.push(`mais ${escondidas} ${escondidas === 1 ? "pendente" : "pendentes"}`);
    if (done.length > 0) partes.push(`${done.length} ${done.length === 1 ? "feita" : "feitas"}`);
    rodape = (
      <button type="button" onClick={() => setAberta((a) => !a)} data-testid="hn-pendencias-mais" className="w-full min-h-[44px] px-2 flex items-center justify-center gap-1 text-[13px] font-semibold text-muted-foreground">
        {aberta ? "Mostrar menos" : partes.join(" · ")}
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${aberta ? "-rotate-90" : "rotate-90"}`} aria-hidden />
      </button>
    );
  }

  return (
    <section data-testid="hn-hoje">
      <div className="flex items-end justify-between mb-3 px-1">
        <h2 className="text-[20px] font-bold tracking-tight leading-none">Hoje</h2>
        <button
          type="button"
          onClick={() => setPersonalizar(true)}
          data-testid="hn-personalizar"
          className="min-h-[36px] -mr-1 px-2.5 rounded-full flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground active:bg-muted/60"
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={2.2} aria-hidden />
          Personalizar
        </button>
      </div>

      <div className="hn-card p-2" data-testid="hn-pendencias">
        {pending.length === 0 ? (
          <div className="min-h-[56px] flex items-center gap-3 pl-1.5 pr-2">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-[17px] bg-success/10" aria-hidden>🎉</span>
            <span className="text-[15px] font-medium">Tudo feito por hoje</span>
          </div>
        ) : (
          visiveis.map((item, i) => <Linha key={`p-${item.tipo ?? i}`} item={item} onClick={() => tocar(item)} />)
        )}
        {avisoConta && (
          <Aviso emoji="📅" texto={`${avisoConta.dias === 0 ? "Vence hoje" : avisoConta.dias === 1 ? "Vence amanhã" : `Vence em ${avisoConta.dias} dias`}: ${avisoConta.nome}`} onClick={() => navigate("/financas")} />
        )}
        {avisoTreino && <Aviso emoji="🏋️" texto="Configurar treino da semana" onClick={() => navigate("/treino")} />}
        <AnimatePresence initial={false}>
          {aberta && done.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              {done.map((item, i) => <Linha key={`d-${item.tipo ?? i}`} item={item} feita onClick={() => item.route && navigate(item.route)} />)}
            </motion.div>
          )}
        </AnimatePresence>
        {rodape}
      </div>

      {widgets.length > 0 && <div className="mt-3"><GradeDeWidgets widgets={widgets} /></div>}

      <FolhaPersonalizar
        aberta={personalizar}
        onFechar={() => setPersonalizar(false)}
        widgetsAtivos={widgets.length}
        ocultos={prefs.ocultos.length}
        onWidgets={() => { setPersonalizar(false); window.setTimeout(() => setPicker(true), DEPOIS_DA_SAIDA_MS); }}
        onPendencias={() => { setPersonalizar(false); window.setTimeout(() => setPrefsAbertas(true), DEPOIS_DA_SAIDA_MS); }}
      />
      <WidgetPicker open={picker} onOpenChange={setPicker} activeWidgets={widgets} onToggle={onToggleWidget} onToggleSize={onToggleSize} />
      <PersonalizarPendencias open={prefsAbertas} onOpenChange={setPrefsAbertas} prefs={prefs} onChange={(p) => set(CHAVE_PENDENCIAS_PREFS, p)} porModulo={data.pendenciasPorModulo} />
    </section>
  );
};

/** Quantos widgets existem no catálogo (pra textos da folha). */
export const TOTAL_WIDGETS = WIDGET_CATALOG.length;
