import { useState, useCallback } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, LayoutGrid } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { OnboardingWizard } from "@/components/OnboardingWizard";
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
  const lifeData = useLifeHubData();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize, reorder } = useHomeWidgets();
  const { get, set: setData } = useUserData();
  const [showOnboarding, setShowOnboarding] = useState(() => !get<string>("core-onboarding-done", ""));
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState(false);

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
    setShowOnboarding(false);
  };

  const handleNameChange = useCallback(() => {
    setDataTrigger(d => d + 1);
  }, []);

  const handleWidgetToggle = (id: WidgetId) => {
    if (isActive(id)) removeWidget(id);
    else addWidget(id);
  };

  return (
    <>
      <AnimatePresence>
        {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      </AnimatePresence>

      <div className="min-h-screen bg-background" onClick={() => editingWidgets && setEditingWidgets(false)}>
        <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
          <GreetingHeader data={lifeData} onNameChange={handleNameChange} />

          <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
            <DayScoreRing score={lifeData.dayScore} streak={lifeData.streak} />
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Ações rápidas</h3>
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
