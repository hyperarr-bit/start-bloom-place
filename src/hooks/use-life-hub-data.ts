import { useMemo, useEffect, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { semanaAtualId } from "@/lib/utils";
import { doPerfil, doPerfilDueDays, PERFIL_PESSOAL } from "@/lib/finance-perfil";

/**
 * Os seis registros diários de 5 pontos do Score do Dia (humor, gasto, peso,
 * sono, gratidão, ideia), "feito hoje" ou não. Existem pra que "Pendências de
 * hoje" cobre EXATAMENTE o que o score cobra — cliente pagante (10/09) zerou
 * a lista e o score ficou em 95 sem dizer o que faltava. É a mesma variável
 * que soma os pontos, não um recálculo.
 */
export interface RegistrosHoje {
  humor: boolean;
  gasto: boolean;
  peso: boolean;
  sono: boolean;
  gratidao: boolean;
  ideia: boolean;
}

export interface LifeHubData {
  dayScore: number;
  streak: number;
  monthBalance: number;
  nextBillName: string | null;
  nextBillDate: string | null;
  todayWorkoutGroup: string | null;
  workoutDone: boolean;
  workoutTime: string | null;
  /** "descanso" = hoje não é dia ativo; "vazio" = nenhum dia da semana tem
   *  exercício ou grupo (aí sim "Configurar treino da semana" faz sentido);
   *  "treino" = tem treino hoje. */
  workoutStatus?: "treino" | "descanso" | "vazio";
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
  /** mexeu na página de algum livro hoje (lib-read-log) */
  leuHoje?: boolean;
  booksReadThisYear: number;
  tasksCompleted: number;
  tasksTotal: number;
  habits: { name: string; done: boolean }[];
  userName: string;
  /** Opcional só porque fixtures montam LifeHubData na mão (score-do-dia.test);
   *  o hook preenche SEMPRE. Sem isso a timeline não cria as linhas novas. */
  registrosHoje?: RegistrosHoje;
}

const NADA_REGISTRADO: RegistrosHoje = { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };

// Use LOCAL date (not UTC) — toISOString() shifts to UTC and breaks streak
// counting in the evening for users in negative timezones (e.g. BR UTC-3 after 21h).
const localDateStr = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayStr = () => localDateStr();

const weekDayMap: Record<number, string> = {
  0: "DOMINGO", 1: "SEGUNDA", 2: "TERÇA", 3: "QUARTA",
  4: "QUINTA", 5: "SEXTA", 6: "SÁBADO"
};

export function useLifeHubData(): LifeHubData {
  const { get, set, loaded } = useUserData();
  const streakHandled = useRef(false);

  // Handle streak as a side-effect — wait for Supabase to fully load (not just
  // local cache hydration) so we don't overwrite a fresher server value.
  useEffect(() => {
    if (!loaded || streakHandled.current) return;
    // Defer one tick so the Supabase background refresh in useUserData has a
    // chance to merge in before we read/write streak data.
    const t = setTimeout(() => {
      if (streakHandled.current) return;
      streakHandled.current = true;

      const tStr = todayStr();
      const streakData = get<any>("core-hub-streak", { count: 0, lastDate: "" });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = localDateStr(yesterday);

      if (streakData.lastDate === tStr) {
        // already counted today
      } else if (streakData.lastDate === yesterdayStr) {
        set("core-hub-streak", { count: (streakData.count || 0) + 1, lastDate: tStr });
      } else {
        set("core-hub-streak", { count: 1, lastDate: tStr });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [loaded, get, set]);

  return useMemo(() => {
    // Return safe defaults until Supabase data is loaded
    if (!loaded) {
      return {
        dayScore: 0, streak: 0, monthBalance: 0,
        nextBillName: null, nextBillDate: null,
        todayWorkoutGroup: null, workoutDone: false, workoutTime: null, workoutStatus: "vazio",
        caloriesConsumed: 0, caloriesGoal: 2000, mealsLogged: 0, mealsTotal: 4,
        waterGlasses: 0, waterGoal: 8, sleepHours: null,
        supplementsTaken: 0, supplementsTotal: 0,
        currentBook: null, readingProgress: 0, leuHoje: false, booksReadThisYear: 0,
        tasksCompleted: 0, tasksTotal: 0, habits: [], userName: "",
        registrosHoje: NADA_REGISTRADO,
      };
    }

    const tStr = todayStr();

    // Finance — read from the same keys used by the Finanças module
    // 03/09: a Home soma só o perfil ativo (PF/PJ) — reclamação de cliente
    const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
    const incomes = doPerfil(get<any[]>("finance-incomes", []), perfil);
    const variableExpenses = doPerfil(get<any[]>("finance-expenses", []), perfil);
    const fixedExpenses = doPerfil(get<any[]>("finance-fixed-expenses", []), perfil);
    const totalIncome = incomes.reduce((s: number, i: any) => s + (Number(i.value) || Number(i.amount) || 0), 0);
    const totalVariableExpense = variableExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
    const totalFixedExpense = fixedExpenses.reduce((s: number, e: any) => s + (Number(e.value) || Number(e.amount) || 0), 0);
    const monthBalance = totalIncome - totalVariableExpense - totalFixedExpense;

    const dueDays = doPerfilDueDays(get<any[]>("finance-dueDays", []), perfil);
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

    /* "Configurei tudo nos treinos mas não saiu o 'Configurar treino da
     * semana' das pendências" (cliente pagante, 11/09). Dois descompassos com
     * o próprio módulo Treino (Treino.tsx, getDayStatus): lá um dia está
     * configurado quando tem EXERCÍCIO, e dia fora de `treino-active-days`
     * é "Descanso". Aqui, "configurado" exigia GRUPO MUSCULAR — quem monta
     * os exercícios sem marcar o grupo (caminho normal do formulário) ficava
     * pendente pra sempre; e dia de descanso caía no mesmo "Configurar", como
     * se o plano não existisse. Agora: grupo se tiver, senão "Treino de hoje"
     * com a contagem de exercícios; descanso é descanso; e "Configurar" só
     * quando NENHUM dia da semana tem exercício ou grupo. */
    const diaTemTreino = (d: any): boolean =>
      !!d && ((Array.isArray(d.muscles) && d.muscles.length > 0)
        || (Array.isArray(d.exercises) && d.exercises.length > 0)
        || (typeof d.muscle === "string" && d.muscle !== "" && d.muscle !== "Descanso"));
    const semanaVazia = !Object.values(workoutPlan || {}).some(diaTemTreino);
    const hojeAtivo = activeDays.includes(todayDayName);

    let todayGroup: string | null = null;
    if (hojeAtivo && diaTemTreino(todayPlan)) {
      if (todayPlan.muscles && todayPlan.muscles.length > 0) {
        todayGroup = todayPlan.muscles.join(" + ");
      } else if (todayPlan.muscle && todayPlan.muscle !== "Descanso") {
        todayGroup = todayPlan.muscle;
      } else {
        const n = todayPlan.exercises.length;
        todayGroup = `${n} exercício${n > 1 ? "s" : ""}`;
      }
    }
    const workoutStatus: "treino" | "descanso" | "vazio" =
      todayGroup ? "treino" : semanaVazia ? "vazio" : "descanso";

    const workoutLog = get<string[]>("saude-workout-log", []);
    const workoutDone = workoutLog.includes(tStr);

    // Diet
    const dietMeals = get<any[]>("core-dieta-meals", []);
    const caloriesGoal = get<number>("core-dieta-calories-goal", 2000);
    const todayLog = get<any>("core-dieta-log", {});
    const todayMeals = todayLog[tStr] || {};
    // 4 é o fallback de quem NÃO montou plano nenhum na Dieta. Quem montou
    // um plano de 3 refeições é cobrado por 3 (ver o bloco do score, 10/09).
    const mealsTotal = dietMeals.length || 4;
    // FIX 16/07: o diário REAL da Dieta (dieta-diary-v2) também conta —
    // core-dieta-log só recebia a ação rápida do hub
    const dietaDiary = get<any>("dieta-diary-v2", {});
    const diaryMealsHoje = dietaDiary[tStr]?.meals && typeof dietaDiary[tStr].meals === "object"
      ? Object.values(dietaDiary[tStr].meals).filter((m: any) => m?.followed).length
      : 0;
    const mealsLogged = Math.max(Object.keys(todayMeals).length, diaryMealsHoje);
    const caloriesConsumed: number = Object.values(todayMeals).reduce<number>((s, m: any) => s + (Number(m?.calories) || 0), 0);

    // Health — FIX 16/07 (pendência de água eterna): os MÓDULOS gravam em
    // water-log/sleep-log; as chaves core-saude-* só recebiam as ações
    // rápidas do hub. Lê as duas famílias e fica com o melhor valor do dia.
    const waterLog = get<any>("core-saude-water", {});
    const waterLogModulo = get<any>("water-log", {});
    const waterGlasses = Math.max(Number(waterLog[tStr]) || 0, Number(waterLogModulo[tStr]) || 0);
    const waterGoal = get<number>("core-saude-water-goal", 8);
    const sleepLog = get<any>("core-saude-sleep", {});
    const sleepLogModulo = get<any>("sleep-log", {});
    const sleepHours = sleepLog[tStr] || sleepLogModulo[tStr] || null;
    const supplements = get<any[]>("core-saude-supplements", []);
    const supplementLog = get<any>("core-saude-supplement-log", {});
    const todaySups = supplementLog[tStr] || [];
    const supplementsTaken = Array.isArray(todaySups) ? todaySups.length : 0;

    // Library
    const books = get<any[]>("lib-books", []);
    const currentBook = books.find((b: any) => b.status === "lendo");
    /* "A porcentagem não anda" (cliente, 11/09): a Home lia `progress`, um
     * campo que a Biblioteca NUNCA grava — lá o progresso é currentPage/pages
     * (Biblioteca.tsx, barra do "Lendo agora"). Só a demo tinha `progress`
     * semeado, por isso parecia certo. Agora: páginas quando existem, senão o
     * `progress` (que o widget antigo da Home gravava), senão 0.
     * "Não marca como lido": a linha "Continuar «livro»" nunca ficava feita
     * porque não existia registro diário de leitura. `lib-read-log` guarda os
     * dias em que a pessoa mexeu na página (Biblioteca ou widget). */
    const readingProgress = currentBook
      ? (Number(currentBook.pages) > 0
          ? Math.min(100, Math.round((Number(currentBook.currentPage) || 0) / Number(currentBook.pages) * 100))
          : Math.min(100, Math.max(0, Number(currentBook.progress) || 0)))
      : 0;
    const readLog = get<string[]>("lib-read-log", []);
    const leuHoje = Array.isArray(readLog) && readLog.includes(tStr);
    const booksRead = books.filter((b: any) => b.status === "lido").length;

    // Tasks / Habits — FIX 16/07 ("adicionar hábito" eterno no hub): a fonte
    // real é rotina-habits + rotina-habits-checked (Record<DIA, boolean[]>
    // em MAIÚSCULO, paralelo à lista — convenção da Rotina). As chaves
    // core-rotina-* nunca foram escritas por módulo nenhum.
    const habitsLegado = get<any[]>("core-rotina-habits", []);
    const habits = get<any[]>("rotina-habits", habitsLegado);
    const DIAS_ROTINA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
    const agora = new Date();
    const diaHoje = DIAS_ROTINA[agora.getDay() === 0 ? 6 : agora.getDay() - 1];
    // A grade é indexada por DIA DA SEMANA e nunca zerava: o check de terça
    // PASSADA contava como de hoje ("80% dos hábitos feitos" fantasma —
    // 22/07). Só confia na grade se ela for DESTA semana (carimbo).
    const habitsChecked = get<Record<string, boolean[]>>("rotina-habits-checked", {});
    const semanaDosChecks = get<string>("rotina-habits-week", "");
    const gradeDaSemana = semanaDosChecks === semanaAtualId();
    const checksHoje = gradeDaSemana && Array.isArray(habitsChecked[diaHoje]) ? habitsChecked[diaHoje] : [];
    const habitLog = get<any>("core-rotina-habit-log", {});
    const todayHabits = habitLog[tStr] || {};
    const mappedHabits = habits.slice(0, 5).map((h: any, i: number) => ({
      name: typeof h === "string" ? h : h.name || "Hábito",
      done: !!checksHoje[i] || !!todayHabits[h.id || h.name || h],
    }));
    const tasksTotal = mappedHabits.length;
    const tasksCompleted = mappedHabits.filter(h => h.done).length;

    // Streak — read only, side-effect handled in useEffect above
    const streakData = get<any>("core-hub-streak", { count: 0, lastDate: "" });
    const streak = streakData.count || 0;

    /*
     * SCORE DO DIA — 12 blocos que somam EXATAMENTE 100:
     *   treino 15 + hábitos 20 + água 15 + refeições 10 + leitura 5 + humor 5
     *   + gratidão 5 + ideia 5 + peso 5 + suplementos 5 + sono 5 + gasto 5.
     *
     * "Fiz tudo mas só vai até os 95%" (cliente pagante, 10/09). Ela tinha
     * razão: três blocos só EXISTIAM pra quem tinha cadastro em outro módulo
     * (suplemento na Saúde, livro "lendo" na Biblioteca, plano de 4 refeições
     * na Dieta). Quem não usava aquilo perdia os pontos sem ter o que fazer —
     * o teto real era 95, 90 ou menos, e o app ainda chamava isso de "dia
     * completo". Mesma regra que o FinancialHealth já aplica desde 27/07:
     * quem não usa uma coisa não é penalizado por ela.
     *
     * A régua pra decidir bloco a bloco: a Home cobra isso da pessoa (aparece
     * na timeline/ações rápidas) mesmo sem cadastro?
     *  - SIM → o bloco fica cobrável sempre (água, hábitos, humor, gratidão,
     *    ideia, peso, sono, gasto: qualquer um registra hoje sem configurar
     *    nada antes; e sem hábito a Home mostra "Adicionar hábitos diários"
     *    como pendência, então hábitos continua 0/20 até cadastrar).
     *  - NÃO → sem cadastro, pontuação cheia (suplementos, leitura; treino já
     *    era assim: dia sem treino programado = 15).
     * "Fez tudo o que a tela mostra" tem que dar 100 — o teste
     * src/test/score-do-dia.test.tsx prova nos dois extremos.
     */
    let scorePoints = 0;
    const scoreMax = 100;

    // Treino (15pts) — feito, ou não há treino programado hoje (descanso /
    // sem plano): não existe o que cobrar. Já era assim.
    if (workoutDone) scorePoints += 15;
    else if (!todayGroup) scorePoints += 15; // rest day = free

    // Hábitos (20pts) — cobrável sempre: sem hábito a Home pede pra cadastrar
    // ("Adicionar hábitos diários" fica pendente na timeline), então é a única
    // ausência de cadastro que NÃO vira ponto cheio. É o coração da Rotina.
    if (tasksTotal > 0) {
      scorePoints += Math.round((tasksCompleted / tasksTotal) * 20);
    }

    // Água (15pts) — meta sempre existe (8 copos por padrão), sempre cobrável.
    scorePoints += Math.min(15, Math.round((waterGlasses / waterGoal) * 15));

    // Refeições (10pts) — dividido pelo número REAL do plano: plano de 3
    // refeições, 3 registradas = 10 (antes dava round(3/4*10) = 8, a cliente
    // nunca fechava). Sem plano nenhum continua cobrando 4. O teto de 10
    // evita que 5 registros num plano de 3 valham 17 e mascarem outro bloco.
    if (mealsTotal > 0) {
      scorePoints += Math.min(10, Math.round((mealsLogged / mealsTotal) * 10));
    }

    // Leitura (5pts) — sem livro em leitura não existe o que cobrar: 5.
    // Com livro "lendo", vale pelo `lib-read-log` de hoje (11/09): a linha
    // "Continuar «livro»" das pendências nunca ficava feita e o score dava o
    // ponto de graça — a lista e o número discordavam. Agora os dois leem a
    // mesma coisa: mexeu na página hoje (Biblioteca ou widget) = 5.
    // Voltar ao "vale 5 sempre" é trocar esta linha por `scorePoints += 5`.
    if (!currentBook || leuHoje) scorePoints += 5;

    // Humor registrado (5pts) — registro diário, sem cadastro prévio: sempre
    // cobrável. FIX 16/07: Rotina grava em mood-log e o Dev. Pessoal em
    // dp-mood-log; qualquer um dos três conta
    const moodLog = get<Record<string, any>>("core-mood-log", {});
    const moodRotina = get<Record<string, any>>("mood-log", {});
    const moodDp = get<Record<string, any>>("dp-mood-log", {});
    // As flags `*Hoje` abaixo são as MESMAS que a timeline recebe em
    // `registrosHoje`: o score soma por elas e a pendência aparece por elas.
    const humorHoje = !!(moodLog[tStr] || moodRotina[tStr] || moodDp[tStr]);
    if (humorHoje) scorePoints += 5;

    // Gratidão registrada (5pts) — registro diário, sempre cobrável.
    // FIX 16/07: dp-gratitude (módulo) também
    const gratLog = get<Record<string, string[]>>("core-gratitude-log", {});
    const gratDp = get<Record<string, string[]>>("dp-gratitude", {});
    const gratidaoHoje = (gratLog[tStr] || []).length > 0 || (gratDp[tStr] || []).length > 0;
    if (gratidaoHoje) scorePoints += 5;

    // Ideia capturada hoje (5pts) — registro diário no Hiperfoco, sempre cobrável.
    const thoughtsAll = get<Record<string, any>>("hiperfoco-thoughts", {});
    const todayThoughts = thoughtsAll[tStr] || {};
    const hasThoughtToday = Object.values(todayThoughts).some((arr: any) => Array.isArray(arr) && arr.length > 0);
    if (hasThoughtToday) scorePoints += 5;

    // Peso registrado (5pts) — registro diário na Saúde (medidas), não exige
    // cadastro: qualquer um pesa hoje. Sempre cobrável — a cliente dos 95
    // tinha feito este.
    const measures = get<any[]>("core-saude-measures", []);
    const pesoHoje = measures.some((m: any) => m.date === tStr);
    if (pesoHoje) scorePoints += 5;

    // Suplementos (5pts) — sem suplemento cadastrado na Saúde vale 5. Não é
    // "de graça": é que não existe o que cobrar — a Home nem lista pendência
    // de suplemento pra quem não tem nenhum. Era o `if` que travava a
    // cliente em 95 (10/09). Com cadastro, proporção dos tomados hoje.
    if (supplements.length > 0) {
      scorePoints += Math.min(5, Math.round((supplementsTaken / supplements.length) * 5));
    } else {
      scorePoints += 5;
    }

    // Sono registrado (5pts) — registro diário (Saúde ou ação rápida), sem
    // cadastro prévio: sempre cobrável.
    const sonoHoje = !!sleepHours;
    if (sonoHoje) scorePoints += 5;

    // Gasto registrado hoje (5pts) — registro diário em Finanças, sem cadastro
    // prévio: sempre cobrável. (Segue o perfil ativo, como o saldo acima.)
    const todayExpenses = variableExpenses.filter((e: any) => e.date === tStr);
    const gastoHoje = todayExpenses.length > 0;
    if (gastoHoje) scorePoints += 5;

    const dayScore = Math.min(100, scorePoints);
    const userName = get<string>("core-user-name", "");

    return {
      dayScore, streak, monthBalance,
      nextBillName: nextBill?.name || null, nextBillDate: nextBill?._day ? `dia ${nextBill._day}` : null,
      todayWorkoutGroup: todayGroup, workoutDone, workoutTime: null, workoutStatus,
      caloriesConsumed, caloriesGoal, mealsLogged, mealsTotal,
      waterGlasses, waterGoal, sleepHours,
      supplementsTaken, supplementsTotal: supplements.length,
      currentBook: currentBook?.title || null, readingProgress, leuHoje,
      booksReadThisYear: booksRead,
      tasksCompleted, tasksTotal, habits: mappedHabits, userName,
      registrosHoje: { humor: humorHoje, gasto: gastoHoje, peso: pesoHoje, sono: sonoHoje, gratidao: gratidaoHoje, ideia: hasThoughtToday },
    };
  }, [get, loaded]);
}
