import { useState, useCallback, useEffect } from "react";
import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, LayoutGrid } from "lucide-react";
import { PwaInstallCard } from "@/components/PwaInstallCard";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { QuickStartOnboarding, ModuleKey } from "@/components/onboarding/QuickStartOnboarding";
import { DailyNudge } from "@/components/onboarding/DailyNudge";

import { GreetingHeader } from "@/components/home/GreetingHeader";
import { DayScoreRing } from "@/components/home/DayScoreRing";
import { QuickActions } from "@/components/home/QuickActions";
import { ModuleDrawer } from "@/components/home/ModuleDrawer";
import { NextHoursTimeline } from "@/components/home/NextHoursTimeline";
import { WidgetPicker } from "@/components/home/WidgetPicker";
import { SortableWidget } from "@/components/home/SortableWidget";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useHomeWidgets, WidgetId, ActiveWidget } from "@/hooks/use-home-widgets";
import { useLongPress } from "@/hooks/use-long-press";
import { useAuth } from "@/hooks/use-auth";
import { trialCartaoAtivo } from "@/lib/teste-gratis";

// One-time reset key — bump version to replay onboarding for everyone
const ONBOARDING_RESET_KEY = "core-onboarding-reset-v2";

// Widget components
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

type WidgetComponent = React.FC<{ size?: "small" | "large" }>;

const WIDGET_COMPONENTS: Record<WidgetId, WidgetComponent> = {
  finances: FinancesWidget,
  workout: WorkoutWidget,
  calories: CaloriesWidget,
  health: HealthWidget,
  habits: HabitsWidget,
  reading: ReadingWidget,
  "week-progress": WeekProgressWidget as WidgetComponent,
  "budget-remaining": BudgetRemainingWidget as WidgetComponent,
  "habit-streaks": HabitStreaksWidget as WidgetComponent,
  "motivational-quote": MotivationalQuoteWidget as WidgetComponent,
  "quick-notes": QuickNotesWidget as WidgetComponent,
  "focus-timer": FocusTimerWidget as WidgetComponent,
  "macro-balance": MacroBalanceWidget as WidgetComponent,
  "sleep-log": SleepLogWidget as WidgetComponent,
  countdown: CountdownWidget as WidgetComponent,
  "week-calendar": WeekCalendarWidget as WidgetComponent,
};

const HomePage = () => {
  const [data, setDataTrigger] = useState(0);

  // Virada de dia com o app VIVO (celular mantém a aba em memória): sem isso,
  // hub/widgets seguem mostrando "hoje" de ontem — mesmo bug do diário da
  // Dieta (18/07). Re-render ao voltar ao foco/visível + tique de 60s.
  useEffect(() => {
    let ultimoDia = localDayKey();
    const sync = () => {
      const hoje = localDayKey();
      if (hoje !== ultimoDia) { ultimoDia = hoje; setDataTrigger(d => d + 1); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    const id = window.setInterval(sync, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.clearInterval(id);
    };
  }, []);

  const lifeData = useLifeHubData();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize, reorder } = useHomeWidgets();
  const { get, set: setData, loaded, isGuest } = useUserData();
  const { user } = useAuth();

  const ALL_MODULES: ModuleKey[] = ["financas", "rotina", "dieta", "treino", "saude", "metas", "hiperfoco", "estudos", "carreira", "biblioteca", "casa", "beleza", "viagens", "relacionamentos", "pet", "detox"];

  const computePending = (): ModuleKey[] =>
    ALL_MODULES.filter(m => !get<string>(`spotlight-done-${m}`, ""));

  const [pendingModules, setPendingModules] = useState<ModuleKey[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState(false);

  // Re-evaluate welcome/onboarding once data is loaded from Supabase
  useEffect(() => {
    if (!loaded) {
      setOnboardingResolved(false);
      return;
    }

    // Convidado não chega mais no /home (modo guest aposentado 16/07). Se o
    // auth ainda não resolveu, NÃO decide tutorial com estado transitório —
    // era isso que fazia a flag órfã piscar o tutorial de convidado no boot.
    if (!user) {
      setShowOnboarding(false);
      setOnboardingResolved(true);
      return;
    }

    // A flag force-new-user só vale pra conta RECÉM-CRIADA (<48h, fluxo de
    // cadastro — inclusive Google, que só grava no localStorage). Conta
    // veterana com a flag órfã (replay v1 bugado de 19/07, ou tutorial
    // abandonado há dias) é auto-saneada aqui: limpa e segue como veterano.
    const lsFlag = typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true";
    const dbFlag = !!get<string>("force-new-user-tutorial", "");
    const contaNova = !!user.created_at && Date.now() - new Date(user.created_at).getTime() < 48 * 3600e3;
    // Pagante nos 3 dias do trial tem a MISSÃO como tutorial (B1 → holofote
    // → celebração). Os dois sistemas juntos brigam: o cadastro pós-compra
    // arma esta flag pra todo mundo, o quickstart montava por cima do B1 e
    // uma ação DELE creditava o dia 1 da missão (19/08, trial real: dia 1
    // "feito" em 0s e o holofote nunca montou). Missão ativa = missão manda.
    const missaoManda = trialCartaoAtivo();
    const forceNewUser = contaNova && (dbFlag || lsFlag) && !missaoManda;
    if ((dbFlag || lsFlag) && (!contaNova || missaoManda)) {
      try { localStorage.removeItem("force-new-user-tutorial"); } catch { /* ignore */ }
      if (dbFlag) setData("force-new-user-tutorial", "");
    }

    // Tutorial roda no modo convidado OU para um usuário recém-cadastrado (force-new-user-tutorial).
    if (!isGuest && !forceNewUser) {
      if (!get<string>("core-onboarding-done", "")) {
        setData("core-onboarding-done", "true");
      }
      if (!get<string>("core-all-modules-celebrated", "")) {
        setData("core-all-modules-celebrated", "true");
      }
      setShowOnboarding(false);
      setPendingModules([]);
      setOnboardingResolved(true);
      return;
    }

    // Reset onboarding flags only ONCE per activation (guest replay or new-user flag).
    // Without this gate, every Home mount erased `spotlight-done-*`, so finished
    // modules never disappeared from the picker.
    if (forceNewUser || isGuest) {
      const resetKey = forceNewUser ? "force-new-user-reset-done" : ONBOARDING_RESET_KEY;
      const alreadyReset = !!get<string>(resetKey, "");
      if (!alreadyReset) {
        setData("core-onboarding-done", "");
        setData("core-all-modules-celebrated", "");
        ALL_MODULES.forEach(m => setData(`spotlight-done-${m}`, ""));
        setData(resetKey, "true");
      }
    }


    const pending = computePending();
    setPendingModules(pending);

    const onboardingDone = forceNewUser ? false : !!get<string>("core-onboarding-done", "");
    const celebrated = forceNewUser ? false : !!get<string>("core-all-modules-celebrated", "");
    const shouldShow = !onboardingDone || pending.length > 0 || !celebrated;
    setShowOnboarding(shouldShow);
    setOnboardingResolved(true);
  }, [loaded, isGuest, get, setData, user]);

  // A flag do trial pode chegar DEPOIS da decisão acima (sincronização com o
  // RevenueCat no boot é assíncrona): se a missão assumir com o quickstart já
  // em pé, derruba ele e limpa a flag de usuário-novo. Só dispara quando um
  // TRIAL foi detectado — exatamente o caso em que a missão manda.
  useEffect(() => {
    const missaoAssumiu = () => {
      try { localStorage.removeItem("force-new-user-tutorial"); } catch { /* ignore */ }
      setData("force-new-user-tutorial", "");
      setShowOnboarding(false);
    };
    window.addEventListener("core:trial-cartao", missaoAssumiu);
    return () => window.removeEventListener("core:trial-cartao", missaoAssumiu);
  }, [setData]);

  // Auto check-in on app open (only after data loaded)
  useEffect(() => {
    if (!loaded) return;
    const today = localDayKey();
    const lastCheckIn = get<string>("gamification-lastCheckIn", "");
    if (lastCheckIn === today) return;
    setData("gamification-lastCheckIn", today);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const longPressHandlers = useLongPress(() => {
    if (activeWidgets.length > 0) setEditingWidgets(true);
  }, 600);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeWidgets.findIndex(w => w.id === active.id);
      const newIndex = activeWidgets.findIndex(w => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorder(oldIndex, newIndex);
    }
  };

  const handleOnboardingComplete = () => {
    setData("core-onboarding-done", "true");
    setData("force-new-user-tutorial", "");
    try { localStorage.removeItem("force-new-user-tutorial"); } catch {}
    setShowOnboarding(false);
  };

  const handleNameChange = useCallback(() => {
    setDataTrigger(d => d + 1);
  }, []);

  // Rever tutorial v2 (19/07): modo REPLAY auto-contido do QuickStartOnboarding
  // — estado local, zero flags de usuário-novo. A v1 reusava o caminho
  // force-new-user e bugou feio (auto-completava em 1s e reaparecia a cada
  // abertura). O replay só reativa o tour dos módulos que a pessoa escolher.
  const [showReplayTutorial, setShowReplayTutorial] = useState(false);
  // "Veio do menu" precisa sobreviver à ida e volta pro módulo (27/07): esse
  // estado é local da Home, e a Home REMONTA quando a pessoa volta do módulo —
  // aí o mesmo replay passava a se anunciar como estreia ("Por onde você quer
  // começar?" no meio de um 'rever'). A intenção agora fica gravada junto da
  // fila, e some com ela.
  const handleReplayTutorial = useCallback(() => {
    setShowReplayTutorial(true);
    setData("tutorial-replay-pelo-menu", "true");
  }, [setData]);

  const handleWidgetToggle = (id: WidgetId) => {
    if (isActive(id)) removeWidget(id);
    else addWidget(id);
  };

  if (!loaded || !onboardingResolved) {
    return <div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" />;
  }

  // Tutorial em andamento (fila viva) OU aberto pelo menu: o hub vira a tela
  // do tutorial — é o que faz o "voltar" de um módulo cair na ESCOLHA de
  // módulos (pedido do dono 19/07), com "Encerrar tutorial" sempre à mão.
  const replayQueue = get<ModuleKey[]>("tutorial-replay-modules", []);
  const replayPendente = Array.isArray(replayQueue) && replayQueue.length > 0;
  if (showReplayTutorial || (loaded && !!user && replayPendente)) {
    return (
      <AnimatePresence>
        {/* aberturaPeloMenu só quando VEIO do menu: é o que decide se o texto
            fala "rever" ou "começar". A fila (replay) é a mecânica de todos. */}
        <QuickStartOnboarding
          replay
          aberturaPeloMenu={showReplayTutorial || !!get<string>("tutorial-replay-pelo-menu", "")}
          // onComplete também dispara ao ENTRAR num módulo do replay — por isso
          // quem apaga a intenção é o "Encerrar tutorial", não este callback.
          onComplete={() => setShowReplayTutorial(false)}
        />
      </AnimatePresence>
    );
  }

  if (showOnboarding) {
    const contaNova = !!user?.created_at && Date.now() - new Date(user.created_at).getTime() < 48 * 3600e3;
    const forceNewUser = (isGuest || contaNova) &&
      (!!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true"));
    return (
      <AnimatePresence>
        <QuickStartOnboarding
          onComplete={handleOnboardingComplete}
          pendingModules={pendingModules}
          skipWelcome={!!get<string>("core-onboarding-done", "") || forceNewUser}
          forNewUser={forceNewUser}
        />
      </AnimatePresence>
    );
  }

  return (
    <>
      <DailyNudge />

      <div className="min-h-dvh bg-background flex flex-col" onClick={() => editingWidgets && setEditingWidgets(false)}>
        <header className="sticky top-0 z-40 border-b border-border bg-card flex-shrink-0">
          <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-3">
            <GreetingHeader data={lifeData} onNameChange={handleNameChange} onReplayTutorial={handleReplayTutorial} />
          </div>
        </header>
        <main className="flex-1 flex flex-col">
          {/* space-y-8 (26/07): era space-y-6. Medindo a Home em 360dp e em
              430pt o espaçamento saía IDÊNTICO — o aperto não vinha do
              aparelho, vinha do ritmo entre seções, que ficava irregular
              (164px entre umas, 56px entre outras). Respiro maior e igual
              separa os blocos sem inflar o conteúdo. */}
          <div className="flex-1 max-w-lg md:max-w-4xl mx-auto w-full px-4 pt-4 pb-5 space-y-8 flex flex-col justify-center">

            <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
              <DayScoreRing score={lifeData.dayScore} streak={lifeData.streak} />
            </div>

            <PwaInstallCard variant="home" />

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Ações rápidas</h3>
              <QuickActions />
            </div>

            {/* Widgets */}
            {activeWidgets.length > 0 && (
              <div className="space-y-3" onClick={e => e.stopPropagation()} {...longPressHandlers}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={activeWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
                    <WidgetGrid
                      activeWidgets={activeWidgets}
                      editing={editingWidgets}
                      onRemove={removeWidget}
                      onToggleSize={toggleSize}
                    />
                  </SortableContext>
                </DndContext>

                {editingWidgets && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2"
                  >
                    <button
                      onClick={() => setShowWidgetPicker(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                    <button
                      onClick={() => setEditingWidgets(false)}
                      className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                    >
                      Pronto
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {/* Add widget button - always visible when not editing */}
            {!editingWidgets && (
              <motion.button
                onClick={() => setShowWidgetPicker(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Adicionar widget</span>
              </motion.button>
            )}

            <NextHoursTimeline data={lifeData} />
            <ModuleDrawer />

            <p className="text-center text-[10px] text-muted-foreground py-2">
              Core © {new Date().getFullYear()} — Organize sua vida
            </p>
          </div>
        </main>
      </div>

      <WidgetPicker
        open={showWidgetPicker}
        onOpenChange={setShowWidgetPicker}
        activeWidgets={activeWidgets}
        onToggle={handleWidgetToggle}
        onToggleSize={toggleSize}
      />
    </>
  );
};

// Extracted grid component
const WidgetGrid = ({
  activeWidgets,
  editing,
  onRemove,
  onToggleSize,
}: {
  activeWidgets: ActiveWidget[];
  editing: boolean;
  onRemove: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
}) => {
  // Build rows: small widgets pair up, large take full width
  const rows: ActiveWidget[][] = [];
  let smallBuffer: ActiveWidget[] = [];

  activeWidgets.forEach(widget => {
    if (widget.size === "small") {
      smallBuffer.push(widget);
      if (smallBuffer.length === 2) {
        rows.push([...smallBuffer]);
        smallBuffer = [];
      }
    } else {
      if (smallBuffer.length > 0) {
        rows.push([...smallBuffer]);
        smallBuffer = [];
      }
      rows.push([widget]);
    }
  });
  if (smallBuffer.length > 0) rows.push([...smallBuffer]);

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={row.map(w => w.id).join("-")}
          className={`grid gap-3 ${row.length === 2 && row.every(w => w.size === "small") ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {row.map(widget => {
            const Component = WIDGET_COMPONENTS[widget.id];
            if (!Component) return null;
            return (
              <SortableWidget
                key={widget.id}
                id={widget.id}
                size={widget.size}
                editing={editing}
                onRemove={onRemove}
                onToggleSize={onToggleSize}
              >
                <Component size={widget.size} />
              </SortableWidget>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default HomePage;
