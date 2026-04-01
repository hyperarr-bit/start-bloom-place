import { useMemo } from "react";
import { useUserData } from "@/hooks/use-user-data";

export interface LifeHubData {
  dayScore: number;
  streak: number;
  monthBalance: number;
  nextBillName: string | null;
  nextBillDate: string | null;
  todayWorkoutGroup: string | null;
  workoutDone: boolean;
  workoutTime: string | null;
  caloriesConsumed: number;
  caloriesGoal: number;
  mealsLogged: number;
  mealsTotal: number;
  waterGlasses: number;
  waterGoal: number;
  sleepHours: number | null;
  supplementsTaken: number;
  supplementsTotal: number;
  currentBook: string | null;
  readingProgress: number;
  booksReadThisYear: number;
  tasksCompleted: number;
  tasksTotal: number;
  habits: { name: string; done: boolean }[];
  userName: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const weekDayMap: Record<number, string> = {
  0: "DOMINGO", 1: "SEGUNDA", 2: "TERÇA", 3: "QUARTA",
  4: "QUINTA", 5: "SEXTA", 6: "SÁBADO"
};

export function useLifeHubData(): LifeHubData {
  const { get, set } = useUserData();

  return useMemo(() => {
    const tStr = todayStr();

    // Finance — read from the same keys used by the Finanças module
    const incomes = get<any[]>("finance-incomes", []);
    const variableExpenses = get<any[]>("finance-expenses", []);
    const fixedExpenses = get<any[]>("finance-fixed-expenses", []);
    const totalIncome = incomes.reduce((s: number, i: any) => s + (Number(i.value) || Number(i.amount) || 0), 0);
    const totalVariableExpense = variableExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
    const totalFixedExpense = fixedExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
    const monthBalance = totalIncome - totalVariableExpense - totalFixedExpense;

    const dueDays = get<any[]>("finance-dueDays", []);
    const today = new Date().getDate();
    let nextBill: any = null;
    dueDays.forEach((d: any) => {
      const unpaid = (d.bills || []).filter((b: any) => !b.paid);
      unpaid.forEach((b: any) => {
        const daysUntil = d.day >= today ? d.day - today : 30 - today + d.day;
        if (!nextBill || daysUntil < nextBill._daysUntil) {
          nextBill = { ...b, _daysUntil: daysUntil, _day: d.day };
        }
      });
    });

    // Workout — read from actual keys used by Treino page
    const workoutPlan = get<any>("saude-workouts-v2", {});
    const activeDays = get<string[]>("treino-active-days", []);
    const todayDayName = weekDayMap[new Date().getDay()];
    const todayPlan = workoutPlan[todayDayName];

    // Support both old (muscle: string) and new (muscles: string[]) format
    let todayGroup: string | null = null;
    if (todayPlan) {
      if (todayPlan.muscles && todayPlan.muscles.length > 0) {
        todayGroup = todayPlan.muscles.join(" + ");
      } else if (todayPlan.muscle && todayPlan.muscle !== "Descanso") {
        todayGroup = todayPlan.muscle;
      }
    }
    // Only show if it's an active day
    if (!activeDays.includes(todayDayName)) todayGroup = null;

    const workoutLog = get<string[]>("saude-workout-log", []);
    const workoutDone = workoutLog.includes(tStr);

    // Diet
    const dietMeals = get<any[]>("core-dieta-meals", []);
    const caloriesGoal = get<number>("core-dieta-calories-goal", 2000);
    const todayLog = get<any>("core-dieta-log", {});
    const todayMeals = todayLog[tStr] || {};
    const mealsTotal = dietMeals.length || 4;
    const mealsLogged = Object.keys(todayMeals).length;
    const caloriesConsumed: number = Object.values(todayMeals).reduce<number>((s, m: any) => s + (Number(m?.calories) || 0), 0);

    // Health
    const waterLog = get<any>("core-saude-water", {});
    const waterGlasses = waterLog[tStr] || 0;
    const waterGoal = get<number>("core-saude-water-goal", 8);
    const sleepLog = get<any>("core-saude-sleep", {});
    const sleepHours = sleepLog[tStr] || null;
    const supplements = get<any[]>("core-saude-supplements", []);
    const supplementLog = get<any>("core-saude-supplement-log", {});
    const todaySups = supplementLog[tStr] || [];
    const supplementsTaken = Array.isArray(todaySups) ? todaySups.length : 0;

    // Library
    const books = get<any[]>("lib-books", []);
    const currentBook = books.find((b: any) => b.status === "lendo");
    const booksRead = books.filter((b: any) => b.status === "lido").length;

    // Tasks / Habits
    const habits = get<any[]>("core-rotina-habits", []);
    const habitLog = get<any>("core-rotina-habit-log", {});
    const todayHabits = habitLog[tStr] || {};
    const mappedHabits = habits.slice(0, 5).map((h: any) => ({
      name: typeof h === "string" ? h : h.name || "Hábito",
      done: !!todayHabits[h.id || h.name || h],
    }));
    const tasksTotal = mappedHabits.length;
    const tasksCompleted = mappedHabits.filter(h => h.done).length;

    // Streak
    const streakData = get<any>("core-hub-streak", { count: 0, lastDate: "" });
    let streak = streakData.count || 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streakData.lastDate === tStr) {
      // already counted
    } else if (streakData.lastDate === yesterdayStr) {
      streak += 1;
      set("core-hub-streak", { count: streak, lastDate: tStr });
    } else if (streakData.lastDate !== tStr) {
      streak = 1;
      set("core-hub-streak", { count: 1, lastDate: tStr });
    }

    // Day Score
    let scorePoints = 0;
    let scoreMax = 0;

    scoreMax += 25;
    if (workoutDone) scorePoints += 25;
    else if (!todayGroup) scorePoints += 25;

    if (tasksTotal > 0) {
      scoreMax += 25;
      scorePoints += Math.round((tasksCompleted / tasksTotal) * 25);
    }

    scoreMax += 15;
    scorePoints += Math.min(15, Math.round((waterGlasses / waterGoal) * 15));

    if (mealsTotal > 0) {
      scoreMax += 20;
      scorePoints += Math.round((mealsLogged / mealsTotal) * 20);
    }

    scoreMax += 15;
    if (currentBook) scorePoints += 15;

    const dayScore = scoreMax > 0 ? Math.round((scorePoints / scoreMax) * 100) : 0;
    const userName = get<string>("core-user-name", "");

    return {
      dayScore, streak, monthBalance,
      nextBillName: nextBill?.name || null, nextBillDate: nextBill?._day ? `dia ${nextBill._day}` : null,
      todayWorkoutGroup: todayGroup, workoutDone, workoutTime: null,
      caloriesConsumed, caloriesGoal, mealsLogged, mealsTotal,
      waterGlasses, waterGoal, sleepHours,
      supplementsTaken, supplementsTotal: supplements.length,
      currentBook: currentBook?.title || null, readingProgress: currentBook?.progress || 0,
      booksReadThisYear: booksRead,
      tasksCompleted, tasksTotal, habits: mappedHabits, userName,
    };
  }, [get, set]);
}
