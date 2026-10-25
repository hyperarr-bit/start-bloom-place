import { BookOpen, CalendarCheck, Check, Droplets, Dumbbell, LayoutGrid, Moon, Plus, Receipt, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ActionId } from "@/components/home/QuickActions";
import { anotarAcaoRapida } from "@/lib/intro-modulo";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { WIDGET_CATALOG, type ActiveWidget, type WidgetId } from "@/hooks/use-home-widgets";
import { localDayKey } from "@/lib/utils";
import { Anel } from "./Anel";
import { TRACO, corDoModulo, corDoTipo, tintaDoModulo, type Tom } from "./paleta";
import { TOM_DO_MODULO, TOM_DO_TIPO, cor } from "./paleta";

/**
 * PÁGINA 3 DO CARROSSEL — "SEUS WIDGETS" (opção E). Os widgets que a pessoa já escolhe hoje (a mesma lista
 * `core-home-widgets-v2`, a mesma tela de escolher), redesenhados no estilo desta Home: cartões de meia
 * largura com número grande + anel, ou um cartão largo (a semana). Cada cartão lê os MESMOS dados do widget
 * de hoje e no mockup não grava nada. RODADA 3: cores da paleta única (a do módulo de origem) e ícones da
 * mesma família, traço 1,75.
 *
 *  - calories  → "0 /2000 kcal" + anel                                   (CaloriesWidget)
 *  - workout   → "Peito" + Feito ✓ / Marcar feito / Descanso            (WorkoutWidget)
 *  - sleep-log → "7,5 h" + registrar                                    (SleepLogWidget)
 *  - reading   → "34 %" + o livro                                       (ReadingWidget)
 *  - habits / health → os anéis de hábitos e água                       (HabitsWidget / HealthWidget)
 *  - finances  → a próxima conta, SEM valor (R$ só dentro do módulo)   (FinancesWidget)
 *  - week-progress → a semana em 7 barrinhas, largo                     (WeekProgressWidget)
 *  - os outros do catálogo → cartão com o emoji e o nome, que abre o módulo
 *
 * Sem widget escolhido: um convite no lugar (como o "Conectar ao Apple Health" do Cal AI). Sempre sobra um
 * azulejo "+ Escolher" enquanto houver vaga na primeira dobra (4 lugares).
 */
interface Props {
  data: LifeHubData;
  widgets: ActiveWidget[];
  onEscolher: () => void;
  /** abre a folha do "+" numa ação (o "Registrar" do Sono) */
  onAcao?: (id: ActionId) => void;
}

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ROTA_DO_WIDGET: Partial<Record<WidgetId, string>> = {
  finances: "/financas", workout: "/treino", calories: "/dieta", health: "/saude", habits: "/rotina", reading: "/biblioteca",
  "budget-remaining": "/financas", "habit-streaks": "/rotina", "quick-notes": "/hiperfoco", "focus-timer": "/hiperfoco",
  "macro-balance": "/dieta", "sleep-log": "/saude", countdown: "/desenvolvimento", "week-calendar": "/rotina?aba=mes",
  tasks: "/rotina", pet: "/pet", relacoes: "/relacionamentos", skincare: "/beleza", cuidados: "/beleza", "week-progress": "/conquistas",
};

const Rotulo = ({ Icone, tom, texto }: { Icone: typeof Dumbbell; tom: Tom; texto: string }) => (
  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
    <Icone className="w-[15px] h-[15px]" strokeWidth={TRACO} style={{ color: cor(tom) }} aria-hidden />
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
        <Rotulo Icone={CalendarCheck} tom={TOM_DO_MODULO.rotina} texto="Sua semana" />
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{feitos} de 7 dias</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {semana.map((d) => (
          <div key={d.dia} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full max-w-[22px] h-[44px] rounded-full overflow-hidden flex items-end" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
              <div className="w-full rounded-full" style={{ height: `${d.valor > 0 ? Math.max(18, d.valor) : 0}%`, background: d.hoje ? corDoModulo("financas") : corDoModulo("rotina") }} />
            </div>
            <span className={`text-[10.5px] leading-none ${d.hoje ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{d.dia}</span>
          </div>
        ))}
      </div>
    </button>
  );
};

const CardWidget = ({ w, data, onAcao }: { w: ActiveWidget; data: LifeHubData; onAcao?: (id: ActionId) => void }) => {
  const navigate = useNavigate();
  const { get, set } = useUserData();
  const ir = (rota?: string) => rota && navigate(rota);
  const def = WIDGET_CATALOG.find((c) => c.id === w.id);
  /* a MESMA gravação do WorkoutWidget/QuickActions: o dia entra ou sai de `saude-workout-log` (sem duplicar) */
  const alternarTreinoDeHoje = () => {
    const hoje = localDayKey();
    const log = get<string[]>("saude-workout-log", []);
    if (log.includes(hoje)) { set("saude-workout-log", log.filter((d) => d !== hoje)); return; }
    anotarAcaoRapida("workout", get, set);
    set("saude-workout-log", [...log, hoje]);
  };
  switch (w.id) {
    case "calories": {
      const semKcal = data.caloriesConsumed <= 0 && data.mealsLogged > 0;
      const c = corDoModulo("dieta");
      return (
        <Medio onClick={() => ir("/dieta")} testid="he-widget-calories">
          <Rotulo Icone={Utensils} tom={TOM_DO_MODULO.dieta} texto="Calorias" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="min-w-0">
              <span className="flex items-baseline gap-1">
                <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{data.caloriesConsumed}</span>
                <span className="text-[12.5px] font-medium text-muted-foreground tabular-nums">/{data.caloriesGoal}</span>
              </span>
              <span className="block mt-1 text-[12px] text-muted-foreground leading-tight">{semKcal ? "sem kcal no cardápio" : "kcal hoje"}</span>
            </span>
            <Anel tamanho={58} espessura={7} valor={data.caloriesConsumed} max={data.caloriesGoal} cor={c} atraso={0.4}>
              <Utensils className="w-5 h-5" strokeWidth={TRACO} style={{ color: c }} aria-hidden />
            </Anel>
          </div>
        </Medio>
      );
    }
    case "workout":
      return (
        <Medio onClick={() => ir("/treino")} testid="he-widget-workout">
          <Rotulo Icone={Dumbbell} tom={TOM_DO_MODULO.treino} texto="Treino" />
          {data.todayWorkoutGroup ? (
            <>
              <span className="mt-2 text-[17px] leading-[1.2] font-bold tracking-tight line-clamp-2">{data.todayWorkoutGroup}</span>
              <span
                role="button" tabIndex={0} data-testid="he-widget-workout-chip" aria-pressed={data.workoutDone}
                onClick={(e) => { e.stopPropagation(); alternarTreinoDeHoje(); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); alternarTreinoDeHoje(); } }}
                className="mt-auto inline-flex items-center gap-1.5 self-start h-8 px-3 rounded-full text-[12.5px] font-semibold"
                style={data.workoutDone ? { background: tintaDoModulo("rotina"), color: corDoModulo("rotina") } : { background: "hsl(var(--muted))" }}
              >
                {data.workoutDone ? <><Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />Feito</> : "Marcar feito"}
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
          <Rotulo Icone={Moon} tom={TOM_DO_TIPO.sono} texto="Sono" />
          <span className="mt-2 flex items-baseline gap-1">
            <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{h ? String(h).replace(".", ",") : "—"}</span>
            <span className="text-[12.5px] font-medium text-muted-foreground">h</span>
          </span>
          <span className="mt-1 text-[12px] text-muted-foreground">{h ? (h >= 7 ? "Noite boa" : h >= 5 ? "Noite regular" : "Pouco sono") : "ontem à noite"}</span>
          <span role="button" tabIndex={0} data-testid="he-widget-sleep-chip" onClick={(e) => { e.stopPropagation(); onAcao?.("sleep"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onAcao?.("sleep"); } }} className="mt-auto inline-flex items-center self-start h-8 px-3 rounded-full text-[12.5px] font-semibold bg-muted text-foreground">{h ? "Ajustar" : "Registrar"}</span>
        </Medio>
      );
    }
    case "reading":
      return (
        <Medio onClick={() => ir("/biblioteca")} testid="he-widget-reading">
          <Rotulo Icone={BookOpen} tom={TOM_DO_MODULO.biblioteca} texto="Leitura" />
          {data.currentBook ? (
            <>
              <span className="mt-2 flex items-baseline gap-1">
                <span className="text-[24px] leading-none font-bold tabular-nums tracking-[-0.02em]">{data.readingProgress}</span>
                <span className="text-[12.5px] font-medium text-muted-foreground">%</span>
              </span>
              <span className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-tight">{data.currentBook}</span>
              <span className="mt-auto h-1.5 w-full rounded-full bg-muted overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${data.readingProgress}%`, background: corDoModulo("biblioteca") }} /></span>
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
      const c = corDoModulo("rotina");
      return (
        <Medio onClick={() => ir("/rotina")} testid="he-widget-habits">
          <Rotulo Icone={CalendarCheck} tom={TOM_DO_MODULO.rotina} texto="Hábitos" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="flex items-baseline gap-1"><span className="text-[24px] leading-none font-bold tabular-nums">{f}</span><span className="text-[12.5px] font-medium text-muted-foreground">/{t}</span></span>
            <Anel tamanho={58} espessura={7} valor={f} max={t} cor={c} atraso={0.4}><CalendarCheck className="w-5 h-5" strokeWidth={TRACO} style={{ color: c }} aria-hidden /></Anel>
          </div>
        </Medio>
      );
    }
    case "health": {
      const c = corDoTipo("agua");
      return (
        <Medio onClick={() => ir("/saude")} testid="he-widget-health">
          <Rotulo Icone={Droplets} tom={TOM_DO_TIPO.agua} texto="Água" />
          <div className="mt-2 flex items-center justify-between gap-2 flex-1">
            <span className="flex items-baseline gap-1"><span className="text-[24px] leading-none font-bold tabular-nums">{Math.min(data.waterGlasses, data.waterGoal)}</span><span className="text-[12.5px] font-medium text-muted-foreground">/{data.waterGoal}</span></span>
            <Anel tamanho={58} espessura={7} valor={data.waterGlasses} max={data.waterGoal} cor={c} atraso={0.4}><Droplets className="w-5 h-5" strokeWidth={TRACO} style={{ color: c }} aria-hidden /></Anel>
          </div>
        </Medio>
      );
    }
    case "finances":
      return (
        <Medio onClick={() => ir("/financas")} testid="he-widget-finances">
          <Rotulo Icone={Receipt} tom={TOM_DO_MODULO.financas} texto="Próxima conta" />
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

export const PaginaWidgets = ({ data, widgets, onEscolher, onAcao }: Props) => {
  const lugares = widgets.reduce((s, w) => s + (w.id === "week-progress" ? 2 : 1), 0);
  return (
    <div className="he-pagina" data-testid="he-pagina-3">
      {widgets.length === 0 ? (
        <section className="hn-card flex-1 p-6 flex flex-col items-center justify-center text-center" data-testid="he-widgets-vazio">
          <span className="w-14 h-14 rounded-2xl bg-muted grid place-items-center" aria-hidden><LayoutGrid className="w-7 h-7 text-foreground" strokeWidth={TRACO} /></span>
          <p className="mt-4 text-[17px] font-bold tracking-tight">Seus widgets</p>
          <p className="mt-1 text-[13px] text-muted-foreground leading-snug max-w-[240px]">Treino, calorias, sono, leitura, a semana… os resumos que você escolher ficam nesta página.</p>
          <button type="button" onClick={onEscolher} className="mt-4 h-10 px-5 rounded-full text-[14px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Escolher</button>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1 content-start" data-testid="hn-widgets">
          {widgets.map((w) => <CardWidget key={w.id} w={w} data={data} onAcao={onAcao} />)}
          {lugares < 4 && (
            <button type="button" onClick={onEscolher} data-testid="he-widgets-escolher" className="rounded-[22px] min-h-[150px] flex flex-col items-center justify-center gap-2 text-muted-foreground bg-foreground/[0.035] dark:bg-white/[0.04] active:bg-foreground/[0.06]">
              <span className="w-10 h-10 rounded-full bg-card grid place-items-center" style={{ boxShadow: "var(--hn-sombra)" }}><Plus className="w-5 h-5" strokeWidth={2.2} aria-hidden /></span>
              <span className="text-[12.5px] font-semibold">Escolher widgets</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
