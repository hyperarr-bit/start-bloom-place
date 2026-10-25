import { Apple, BookOpen, CalendarCheck, Check, Droplets, Dumbbell, LayoutGrid, Moon, Plus, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { WIDGET_CATALOG, type ActiveWidget, type WidgetId } from "@/hooks/use-home-widgets";
import { localDayKey } from "@/lib/utils";
import { Anel } from "./Anel";

/**
 * PÁGINA 3 DO CARROSSEL — "SEUS WIDGETS" (opção E, 25/10). Os widgets que a pessoa já escolhe hoje
 * (a mesma lista `core-home-widgets-v2`, a mesma tela de escolher), redesenhados no estilo desta Home:
 * cartões de meia largura com número grande + anel, ou um cartão largo (a semana). Cada cartão lê os
 * MESMOS dados do widget de hoje (hub e as chaves da semana) e no mockup não grava nada.
 *
 *  - calories  → "0 /2000 kcal" + anel com a maçã                 (CaloriesWidget)
 *  - workout   → "Peito" + Feito ✓ / Marcar feito / Descanso       (WorkoutWidget)
 *  - sleep-log → "7,5 h" + registrar                               (SleepLogWidget)
 *  - reading   → "34 %" + o livro                                  (ReadingWidget)
 *  - habits / health → os anéis de hábitos e água                  (HabitsWidget / HealthWidget)
 *  - finances  → a próxima conta, SEM valor (R$ só dentro do módulo) (FinancesWidget)
 *  - week-progress → a semana em 7 barrinhas, largo                (WeekProgressWidget)
 *  - os outros do catálogo → cartão com o emoji e o nome, que abre o módulo
 *
 * Sem widget escolhido: um convite no lugar (como o "Conectar ao Apple Health" do Cal AI). Sempre
 * sobra um azulejo "+ Escolher" enquanto houver vaga na primeira dobra (4 lugares).
 */
interface Props {
  data: LifeHubData;
  widgets: ActiveWidget[];
  onEscolher: () => void;
}

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ROTA_DO_WIDGET: Partial<Record<WidgetId, string>> = {
  finances: "/financas", workout: "/treino", calories: "/dieta", health: "/saude", habits: "/rotina", reading: "/biblioteca",
  "budget-remaining": "/financas", "habit-streaks": "/rotina", "quick-notes": "/hiperfoco", "focus-timer": "/hiperfoco",
  "macro-balance": "/dieta", "sleep-log": "/saude", countdown: "/desenvolvimento", "week-calendar": "/rotina?aba=mes",
  tasks: "/rotina", pet: "/pet", relacoes: "/relacionamentos", skincare: "/beleza", cuidados: "/beleza", "week-progress": "/conquistas",
};

const Rotulo = ({ Icone, cor, texto }: { Icone: typeof Dumbbell; cor: string; texto: string }) => (
  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
    <Icone className="w-[15px] h-[15px]" strokeWidth={2.3} style={{ color: `var(--he-c-${cor})` }} aria-hidden />
    {texto}
  </span>
);

const Medio = ({ children, onClick, testid }: { children: React.ReactNode; onClick?: () => void; testid: string }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="hn-card !rounded-[22px] p-4 min-h-[150px] flex flex-col text-left active:scale-[0.98] transition-transform">
    {children}
  </button>
);

/** A mesma conta de WeekProgressWidget (hábitos 40 · água 20 · treino 20 · sono 10 · humor 10), só leitura. */
function useScoresDaSemana(): { dia: string; valor: number; hoje: boolean }[] {
  const { get } = useUserData();
  const hoje = new Date();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const habitsBrutos = get<unknown[]>("rotina-habits", get<unknown[]>("core-rotina-habits", []));
  const habits = Array.isArray(habitsBrutos) ? habitsBrutos : [];
  const habitLog = get<Record<string, unknown>>("rotina-habit-log", {});
  const habitLogLegado = get<Record<string, unknown>>("core-rotina-habit-log", {});
  const waterLog = get<Record<string, number>>("core-saude-water", {});
  const waterGoal = Math.max(1, Number(get<number>("core-saude-water-goal", 8)) || 8);
  const workoutLog = get<string[]>("saude-workout-log", []);
  const sleepLog = get<Record<string, number>>("sleep-log", {});
  const sleepLogSaude = get<Record<string, number>>("core-saude-sleep", {});
  const moodLog = get<Record<string, unknown>>("mood-log", {});
  const moodLogLegado = get<Record<string, unknown>>("core-mood-log", {});
  const feitos = (k: string): number => {
    const v = habitLog[k] ?? habitLogLegado[k];
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).filter(Boolean).length;
    return 0;
  };
  const chaveHoje = localDayKey(hoje);
  return DIAS.map((dia, i) => {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    const k = localDayKey(d);
    if (k > chaveHoje) return { dia, valor: 0, hoje: false };
    let s = 0;
    if (habits.length > 0) s += Math.round((Math.min(feitos(k), habits.length) / habits.length) * 40);
    s += Math.min(20, Math.round(((waterLog[k] || 0) / waterGoal) * 20));
    if (workoutLog.includes(k)) s += 20;
    if (sleepLog[k] || sleepLogSaude[k]) s += 10;
    if (moodLog[k] || moodLogLegado[k]) s += 10;
    return { dia, valor: Math.min(100, s), hoje: k === chaveHoje };
  });
}

const CardSemana = ({ onClick }: { onClick: () => void }) => {
  const semana = useScoresDaSemana();
  const feitos = semana.filter((d) => d.valor > 0).length;
  return (
    <button type="button" onClick={onClick} data-testid="he-widget-week-progress" className="hn-card !rounded-[22px] p-4 col-span-2 flex flex-col text-left active:scale-[0.99] transition-transform">
      <div className="flex items-center justify-between">
        <Rotulo Icone={CalendarCheck} cor="emerald" texto="Sua semana" />
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{feitos} de 7 dias</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {semana.map((d) => (
          <div key={d.dia} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full max-w-[22px] h-[44px] rounded-full overflow-hidden flex items-end" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
              <div className="w-full rounded-full" style={{ height: `${d.valor > 0 ? Math.max(18, d.valor) : 0}%`, background: d.hoje ? "hsl(var(--score-ring, var(--warning)))" : "var(--he-c-emerald)" }} />
            </div>
            <span className={`text-[10.5px] leading-none ${d.hoje ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{d.dia}</span>
          </div>
        ))}
      </div>
    </button>
  );
};

const CardWidget = ({ w, data }: { w: ActiveWidget; data: LifeHubData }) => {
  const navigate = useNavigate();
  const ir = (rota?: string) => rota && navigate(rota);
  const def = WIDGET_CATALOG.find((c) => c.id === w.id);
  switch (w.id) {
    case "calories": {
      const semKcal = data.caloriesConsumed <= 0 && data.mealsLogged > 0;
      return (
        <Medio onClick={() => ir("/dieta")} testid="he-widget-calories">
          <Rotulo Icone={Apple} cor="green" texto="Calorias" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="min-w-0">
              <span className="flex items-baseline gap-1">
                <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{data.caloriesConsumed}</span>
                <span className="text-[12.5px] font-medium text-muted-foreground tabular-nums">/{data.caloriesGoal}</span>
              </span>
              <span className="block mt-1 text-[12px] text-muted-foreground leading-tight">{semKcal ? "sem kcal no cardápio" : "kcal hoje"}</span>
            </span>
            <Anel tamanho={58} espessura={7} valor={data.caloriesConsumed} max={data.caloriesGoal} cor="var(--he-c-green)" atraso={0.4}>
              <Apple className="w-5 h-5" strokeWidth={2.2} style={{ color: "var(--he-c-green)" }} aria-hidden />
            </Anel>
          </div>
        </Medio>
      );
    }
    case "workout":
      return (
        <Medio onClick={() => ir("/treino")} testid="he-widget-workout">
          <Rotulo Icone={Dumbbell} cor="blue" texto="Treino" />
          {data.todayWorkoutGroup ? (
            <>
              <span className="mt-2 text-[17px] leading-[1.2] font-bold tracking-tight line-clamp-2">{data.todayWorkoutGroup}</span>
              <span className={`mt-auto inline-flex items-center gap-1.5 self-start h-8 px-3 rounded-full text-[12.5px] font-semibold ${data.workoutDone ? "bg-success/12 text-success" : "bg-muted text-foreground"}`}>
                {data.workoutDone ? <><Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />Feito</> : "Marcar feito"}
              </span>
            </>
          ) : (
            <>
              <span className="mt-2 text-[20px] leading-tight font-bold tracking-tight">{data.workoutStatus === "descanso" ? "Descanso" : "Sem plano"}</span>
              <span className="mt-1 text-[12px] text-muted-foreground">{data.workoutStatus === "descanso" ? "Hoje o corpo recupera" : "Monte seu treino da semana"}</span>
            </>
          )}
        </Medio>
      );
    case "sleep-log": {
      const h = data.sleepHours;
      return (
        <Medio onClick={() => ir("/saude")} testid="he-widget-sleep-log">
          <Rotulo Icone={Moon} cor="indigo" texto="Sono" />
          <span className="mt-2 flex items-baseline gap-1">
            <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{h ? String(h).replace(".", ",") : "—"}</span>
            <span className="text-[12.5px] font-medium text-muted-foreground">h</span>
          </span>
          <span className="mt-1 text-[12px] text-muted-foreground">{h ? (h >= 7 ? "Noite boa" : h >= 5 ? "Noite regular" : "Pouco sono") : "ontem à noite"}</span>
          <span className="mt-auto inline-flex items-center self-start h-8 px-3 rounded-full text-[12.5px] font-semibold bg-muted text-foreground">{h ? "Ajustar" : "Registrar"}</span>
        </Medio>
      );
    }
    case "reading":
      return (
        <Medio onClick={() => ir("/biblioteca")} testid="he-widget-reading">
          <Rotulo Icone={BookOpen} cor="orange" texto="Leitura" />
          {data.currentBook ? (
            <>
              <span className="mt-2 flex items-baseline gap-1">
                <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{data.readingProgress}</span>
                <span className="text-[12.5px] font-medium text-muted-foreground">%</span>
              </span>
              <span className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-tight">{data.currentBook}</span>
              <span className="mt-auto h-1.5 w-full rounded-full bg-muted overflow-hidden"><span className="block h-full rounded-full bg-orange-500" style={{ width: `${data.readingProgress}%` }} /></span>
            </>
          ) : (
            <>
              <span className="mt-2 text-[20px] leading-tight font-bold tracking-tight">Sem livro</span>
              <span className="mt-1 text-[12px] text-muted-foreground">Comece um na Biblioteca</span>
            </>
          )}
        </Medio>
      );
    case "habits": {
      const t = data.habits.length;
      const f = data.habits.filter((x) => x.done).length;
      return (
        <Medio onClick={() => ir("/rotina")} testid="he-widget-habits">
          <Rotulo Icone={CalendarCheck} cor="emerald" texto="Hábitos" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="flex items-baseline gap-1"><span className="text-[24px] leading-none font-bold tabular-nums">{f}</span><span className="text-[12.5px] font-medium text-muted-foreground">/{t}</span></span>
            <Anel tamanho={58} espessura={7} valor={f} max={t} cor="var(--he-c-emerald)" atraso={0.4}><CalendarCheck className="w-5 h-5" strokeWidth={2.2} style={{ color: "var(--he-c-emerald)" }} aria-hidden /></Anel>
          </div>
        </Medio>
      );
    }
    case "health":
      return (
        <Medio onClick={() => ir("/saude")} testid="he-widget-health">
          <Rotulo Icone={Droplets} cor="cyan" texto="Água" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="flex items-baseline gap-1"><span className="text-[24px] leading-none font-bold tabular-nums">{Math.min(data.waterGlasses, data.waterGoal)}</span><span className="text-[12.5px] font-medium text-muted-foreground">/{data.waterGoal}</span></span>
            <Anel tamanho={58} espessura={7} valor={data.waterGlasses} max={data.waterGoal} cor="var(--he-c-cyan)" atraso={0.4}><Droplets className="w-5 h-5" strokeWidth={2.2} style={{ color: "var(--he-c-cyan)" }} aria-hidden /></Anel>
          </div>
        </Medio>
      );
    case "finances":
      return (
        <Medio onClick={() => ir("/financas")} testid="he-widget-finances">
          <Rotulo Icone={Receipt} cor="amber" texto="Próxima conta" />
          {data.nextBillName ? (
            <>
              <span className="mt-2 text-[18px] leading-tight font-bold tracking-tight line-clamp-2">{data.nextBillName}</span>
              <span className="mt-1 text-[12px] text-muted-foreground">{data.nextBillDaysUntil === 0 ? "vence hoje" : data.nextBillDaysUntil === 1 ? "vence amanhã" : `vence em ${data.nextBillDaysUntil} dias`}</span>
            </>
          ) : (
            <span className="mt-2 text-[18px] leading-tight font-bold tracking-tight">Nada a vencer</span>
          )}
          <span className="mt-auto text-[12px] font-semibold text-muted-foreground">Ver saldo do mês ›</span>
        </Medio>
      );
    case "week-progress":
      return <CardSemana onClick={() => ir(ROTA_DO_WIDGET["week-progress"])} />;
    default:
      return (
        <Medio onClick={() => ir(ROTA_DO_WIDGET[w.id])} testid={`he-widget-${w.id}`}>
          <span className="text-[24px] leading-none" aria-hidden>{def?.emoji ?? "▫️"}</span>
          <span className="mt-2 text-[15px] font-bold leading-tight">{def?.label ?? w.id}</span>
          <span className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-tight">{def?.description}</span>
        </Medio>
      );
  }
};

export const PaginaWidgets = ({ data, widgets, onEscolher }: Props) => {
  const lugares = widgets.reduce((s, w) => s + (w.id === "week-progress" ? 2 : 1), 0);
  return (
    <div className="he-pagina" data-testid="he-pagina-3">
      {widgets.length === 0 ? (
        <section className="hn-card flex-1 p-6 flex flex-col items-center justify-center text-center" data-testid="he-widgets-vazio">
          <span className="w-14 h-14 rounded-2xl bg-muted grid place-items-center" aria-hidden><LayoutGrid className="w-7 h-7 text-foreground" strokeWidth={1.8} /></span>
          <p className="mt-4 text-[17px] font-bold tracking-tight">Seus widgets</p>
          <p className="mt-1 text-[13px] text-muted-foreground leading-snug max-w-[240px]">Treino, calorias, sono, leitura, a semana… os resumos que você escolher ficam nesta página.</p>
          <button type="button" onClick={onEscolher} className="mt-4 h-10 px-5 rounded-full text-[14px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Escolher</button>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1 content-start" data-testid="hn-widgets">
          {widgets.map((w) => <CardWidget key={w.id} w={w} data={data} />)}
          {lugares < 4 && (
            <button type="button" onClick={onEscolher} data-testid="he-widgets-escolher" className="rounded-[22px] min-h-[150px] flex flex-col items-center justify-center gap-2 text-muted-foreground bg-foreground/[0.035] dark:bg-white/[0.04] active:bg-foreground/[0.06]">
              <span className="w-10 h-10 rounded-full bg-card grid place-items-center" style={{ boxShadow: "var(--hn-sombra)" }}><Plus className="w-5 h-5" strokeWidth={2.4} aria-hidden /></span>
              <span className="text-[12.5px] font-semibold">Escolher widgets</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
