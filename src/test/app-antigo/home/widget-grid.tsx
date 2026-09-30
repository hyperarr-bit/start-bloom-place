// @ts-nocheck
// trecho congelado de 78883beb:src/pages/Home.tsx — linhas 23, 25, 33–50, 53–73 e 419–479 (o app das lojas: iPhone 1.0.7/1.0.8, Android 125) — NÃO editar; é o leitor antigo dos testes de compatibilidade.
// É a grade de widgets da Home antiga (WIDGET_COMPONENTS + WidgetGrid). Só o `export` do fim foi acrescentado.
import { SortableWidget } from "@/components/home/SortableWidget";
import { useHomeWidgets, WidgetId, ActiveWidget } from "@/hooks/use-home-widgets";

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
import { TasksWidget } from "@/components/home/widgets/TasksWidget";

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
  tasks: TasksWidget as WidgetComponent,
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

export { WidgetGrid, WIDGET_COMPONENTS };
