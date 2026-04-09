import { useMemo, useEffect, useRef } from "react";
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
  const { get, set, loaded } = useUserData();
  const streakHandled = useRef(false);

  // Handle streak as a side-effect, only after data is loaded
  useEffect(() => {
    if (!loaded || streakHandled.current) return;
    streakHandled.current = true;

    const tStr = todayStr();
    const streakData = get<any>("core-hub-streak", { count: 0, lastDate: "" });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streakData.lastDate === tStr) {
      // already counted today
    } else if (streakData.lastDate === yesterdayStr) {
      set("core-hub-streak", { count: (streakData.count || 0) + 1, lastDate: tStr });
    } else {
      set("core-hub-streak", { count: 1, lastDate: tStr });
    }
  }, [loaded, get, set]);

  return useMemo(() => {
    // Return safe defaults until Supabase data is loaded
    if (!loaded) {
      return {
        dayScore: 0, streak: 0, monthBalance: 0,
        nextBillName: null, nextBillDate: null,
        todayWorkoutGroup: null, workoutDone: false, workoutTime: null,
        caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 4,
        waterGlasses: 0, waterGoal: 8, sleepHours: null,
        supplementsTaken: 0, supplementsTotal: 0,
        currentBook: null, readingProgress: 0, booksReadThisYear: 0,
        tasksCompleted: 0, tasksTotal: 0, habits: [], userName: "",
      };
    }

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

    // Streak — read only, side-effect handled in useEffect above
    const streakData = get<any>("core-hub-streak", { count: 0, lastDate: "" });
    const streak = streakData.count || 0;

    // Day Score — granular, every small action counts
    let scorePoints = 0;
    const scoreMax = 100;

    // Treino (15pts)
    if (workoutDone) scorePoints += 15;
    else if (!todayGroup) scorePoints += 15; // rest day = free

    // Hábitos (20pts)
    if (tasksTotal > 0) {
      scorePoints += Math.round((tasksCompleted / tasksTotal) * 20);
    }

    // Água (15pts)
    scorePoints += Math.min(15, Math.round((waterGlasses / waterGoal) * 15));

    // Refeições (10pts)
    if (mealsTotal > 0) {
      scorePoints += Math.round((mealsLogged / mealsTotal) * 10);
    }

    // Leitura ativa (5pts)
    if (currentBook) scorePoints += 5;

    // Humor registrado (5pts)
    const moodLog = get<Record<string, any>>("core-mood-log", {});
    if (moodLog[tStr]) scorePoints += 5;

    // Gratidão registrada (5pts)
    const gratLog = get<Record<string, string[]>>("core-gratitude-log", {});
    if ((gratLog[tStr] || []).length > 0) scorePoints += 5;

    // Ideia capturada hoje (5pts)
    const thoughtsAll = get<Record<string, any>>("hiperfoco-thoughts", {});
    const todayThoughts = thoughtsAll[tStr] || {};
    const hasThoughtToday = Object.values(todayThoughts).some((arr: any) => Array.isArray(arr) && arr.length > 0);
    if (hasThoughtToday) scorePoints += 5;

    // Peso registrado (5pts)
    const measures = get<any[]>("core-saude-measures", []);
    if (measures.some((m: any) => m.date === tStr)) scorePoints += 5;

    // Suplementos (5pts)
    if (supplements.length > 0) {
      scorePoints += Math.round((supplementsTaken / supplements.length) * 5);
    }

    // Sono registrado (5pts)
    if (sleepHours) scorePoints += 5;

    // Gasto registrado hoje (5pts)
    const todayExpenses = variableExpenses.filter((e: any) => e.date === tStr);
    if (todayExpenses.length > 0) scorePoints += 5;

    const dayScore = Math.min(100, scorePoints);
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
  }, [get, loaded]);
}
