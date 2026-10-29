import { fluxoEnxutoLigado } from "@/lib/fluxo-enxuto";
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, LayoutGrid } from "lucide-react";
import { LojasCard } from "@/components/LojasCard";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { useSensoresDeReordenar } from "@/lib/arrastar-reordenar";
import { vibrar } from "@/lib/acoes-rapidas";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { QuickStartOnboarding, ModuleKey } from "@/components/onboarding/QuickStartOnboarding";
import { DailyNudge } from "@/components/onboarding/DailyNudge";

import { GreetingHeader } from "@/components/home/GreetingHeader";
import { DayScoreRing } from "@/components/home/DayScoreRing";
import { CelebracaoDia100 } from "@/components/home/CelebracaoDia100";
import { LinhaSequencia } from "@/components/conquistas/LinhaSequencia";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { RetrospectivaNaHome } from "@/components/wrapped/RetrospectivaNaHome";
import { useSequencia } from "@/components/conquistas/use-conquistas";
// Momentos (adesivo novo, marco de sequência) sob demanda: a arte e o gerador dos Stories não pesam a abertura da Home
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
import { missaoDosesMandaNoApp } from "@/lib/missao-doses";
import { guardarForcasDaUrl, varianteDoTour } from "@/lib/tour-home";
import { TourDaHome, useTourDaHome } from "@/components/home/TourDaHome";
import { useHomeNova } from "@/hooks/use-home-nova";
import { tutorialNestaAbertura } from "@/lib/tutorial-abertura";
import { useTheme, palettes, type ThemePalette } from "@/hooks/use-theme";
import { CHAVE_COR_ANTES_HOME_NOVA, origemJaTentada } from "@/lib/home-nova";
import { contaCarregadaDeVerdade, decidirOrigemDaConta, lerEscolhaDaConta } from "@/components/home-nova/OrigemDaConta";
import { ConviteHomeNova } from "@/components/home-nova/EscolhaDaHome";
import { contarUso } from "@/lib/medicao-total";
import { useLocation, useNavigate } from "react-router-dom";
import { ATRIBUTO_RAIZ } from "@/lib/nav-abas";

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
import { TasksWidget } from "@/components/home/widgets/TasksWidget";
import { PetWidget } from "@/components/home/widgets/PetWidget";
import { RelacoesWidget } from "@/components/home/widgets/RelacoesWidget";
import { SkincareWidget } from "@/components/home/widgets/SkincareWidget";
import { CuidadosWidget } from "@/components/home/widgets/CuidadosWidget";
import { pedirRastreamentoIos } from "@/lib/att-ios";

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
  pet: PetWidget as WidgetComponent,
  relacoes: RelacoesWidget as WidgetComponent,
  skincare: SkincareWidget as WidgetComponent,
  cuidados: CuidadosWidget as WidgetComponent,
};

/* 1.0.19 — a HOME NOVA (opção E, lib/home-nova): só carrega quando a chave `home_nova` liga pra conta; desligada, nada daqui entra no caminho */
/* 1.0.19: a Home nova (opção E) é um pedaço à parte. Ligada DESDE a montagem (chave on/ab/força de QA, ou a resposta
   de admin já guardada no aparelho): entra pelo lazy, com a tela em branco de sempre enquanto carrega. Ligada NO MEIO
   da sessão (modo admin, 1ª abertura depois de ligar a chave — só o dono): a Home de hoje fica na tela até o pedaço
   carregar e aí troca, sem piscar em branco (revisor 26/10). */
let moduloHomeE: typeof import("@/components/home-nova/e/HomeE") | null = null;
const carregarHomeE = () => import("@/components/home-nova/e/HomeE").then((m) => { moduloHomeE = m; return m; });
const HomeE = lazy(() => carregarHomeE().then((m) => ({ default: m.HomeE })));

const HomePage = () => {
  const [data, setDataTrigger] = useState(0);
  // 10/10 — as forças de QA do tour/cartões/módulo-oculta (`?tour-home=on`…): só no navegador, antes do hub ler
  guardarForcasDaUrl();

  // Virada de dia com o app VIVO (celular mantém a aba em memória): sem isso,
  // hub/widgets seguem mostrando "hoje" de ontem — mesmo bug do diário da
  // Dieta (18/07). Re-render ao voltar ao foco/visível + tique de 60s.
  // ATT (20/09, recusa 2.1 "unable to locate the ATT permission request"):
  // o revisor entrou com a conta demo direto pelo login e nunca passou pelo
  // "Começar" da welcome — e o efeito estava no Index (Finanças), não aqui.
  // A Home é a primeira tela de TODO mundo logado. O nativo também pede na
  // primeira abertura (AppDelegate); o sistema só mostra o diálogo uma vez.
  useEffect(() => { void pedirRastreamentoIos("home"); }, []);
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
  // Sequência nova (26/09): dias com algo ANOTADO — o anel e a linha abaixo dele.
  const sequencia = useSequencia();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize, reorder } = useHomeWidgets();
  const { get, set: setData, loaded, isGuest, contaCompleta } = useUserData();
  const { user } = useAuth();
  // 26/10 (home nova garantida): a ORIGEM da conta (nova × antiga) é decidida AQUI MESMO, no render, se ninguém decidiu
  // ainda com a conta desta pessoa carregada — a Home nunca depende da ordem da árvore (OrigemDaContaNaSessao grava)
  if (user?.id && !origemJaTentada(user.id) && contaCarregadaDeVerdade(loaded, contaCompleta)) decidirOrigemDaConta(user, get);
  // 1.0.22 (28/10): a ESCOLHA da Home (Você › Home / o convite) gravada na conta vence a origem — lida aqui no render pelo
  // mesmo motivo (a de outro aparelho chega com a conta; OrigemDaContaNaSessao espelha no aparelho)
  lerEscolhaDaConta(user?.id, get, contaCarregadaDeVerdade(loaded, contaCompleta));
  // 1.0.19: a Home nova pra esta conta? (chave remota `home_nova`, no app o padrão é "novas+admin"; no modo "admin" a
  // checagem roda por trás e, sem resposta, vale "não"). `esperandoOrigem`: a origem desta conta ainda não foi decidida
  // — a tela de carregamento fica (nunca a Home antiga por um quadro pra conta nova)
  const homeNova = useHomeNova(user, loaded);
  // 26/10: a Home nova guarda a cor do tema de antes (core-cor-antes-home-nova) ao forçar o Original; com a chave
  // DESLIGADA a cor volta na próxima abertura e o guardado sai
  const { setPalette } = useTheme();
  const corGuardada = get<unknown>(CHAVE_COR_ANTES_HOME_NOVA, null);
  useEffect(() => {
    if (!loaded || homeNova.ligada || homeNova.esperandoOrigem || typeof corGuardada !== "string" || !corGuardada) return;
    if (corGuardada !== "default" && corGuardada in palettes) setPalette(corGuardada as ThemePalette);
    setData(CHAVE_COR_ANTES_HOME_NOVA, null, { system: true });
  }, [loaded, homeNova.ligada, homeNova.esperandoOrigem, corGuardada, setPalette, setData]);
  /* 26/10 (modo "novas"): a decisão "desde a montagem" é a do 1º render em que a Home APARECE (conta carregada,
     tutorial resolvido) — antes disso a origem da conta nova ainda não é conhecida e a Home antiga piscava */
  const homeNovaDesdeAMontagem = useRef<boolean | null>(null);
  const [homeECarregada, setHomeECarregada] = useState(moduloHomeE !== null);
  useEffect(() => {
    if (!homeNova.ligada || homeECarregada) return;
    let viva = true;
    carregarHomeE().then(() => { if (viva) setHomeECarregada(true); }).catch(() => { /* sem o pedaço fica a Home de hoje */ });
    return () => { viva = false; };
  }, [homeNova.ligada, homeECarregada]);
  // "Sua Home em 5 passos" (TOUR_HOME): relê nos eventos da missão em doses — vem DEPOIS da missão/plano de amanhã.
  // Com a Home nova ligada o tour antigo NÃO entra (aponta pras ações rápidas, que lá viraram o "+").
  const mostrarTour = useTourDaHome(user?.created_at, !!user && !homeNova.ligada && !homeNova.esperandoOrigem);

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
    // 03/10 (1.0.10): a MISSÃO EM DOSES também manda — pra quem é novo no app
    // ela SUBSTITUI o tutorial de módulos (e a Missão do iPhone), nunca duas na
    // tela. Quem veio da 1.0.9 com a Missão antiga em andamento segue como antes.
    // 1.0.21 (FLUXO ENXUTO): o tutorial de módulos (QuickStart + holofote) também nunca monta
    const missaoManda = trialCartaoAtivo() || missaoDosesMandaNoApp(user.created_at) || fluxoEnxutoLigado();
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

  // 28/10 (avaliação 5★ "a tela é muito sensível"): arrastar widget só no modo de editar e só com o dedo PARADO
  // (lib/arrastar-reordenar — antes o PointerSensor pegava o toque com 5 px de movimento e rolar a tela arrastava)
  const sensors = useSensoresDeReordenar();

  // entrar no modo de editar: segurar PARADO (rolar/mexer o dedo cancela — use-long-press)
  const longPressHandlers = useLongPress(() => {
    if (activeWidgets.length > 0) { vibrar(); setEditingWidgets(true); contarUso("widgets-editar-segurar", "widgets"); }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeWidgets.findIndex(w => w.id === active.id);
      const newIndex = activeWidgets.findIndex(w => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) { reorder(oldIndex, newIndex); contarUso("widget-arrastar", "widgets"); }
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
  // 1.0.17: o "Rever tutorial" mora na aba Você — chega aqui como estado da navegação (consumido 1x)
  const location = useLocation();
  const navigate = useNavigate();
  const pedeReverTutorial = !!(location.state as { reverTutorial?: boolean } | null)?.reverTutorial;
  useEffect(() => {
    if (!pedeReverTutorial || !loaded) return;
    handleReplayTutorial();
    navigate(location.pathname, { replace: true, state: null });
  }, [pedeReverTutorial, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechou e reabriu o app no meio do "Ver tutorial" (27/10): a fila que ficou na conta é sobra — apaga em silêncio
  // e a Home abre normal. Sem isso, a reabertura caía direto no seletor do tutorial e o holofote ligava sozinho no
  // próximo módulo da fila que a pessoa abrisse.
  const filaGuardada = get<ModuleKey[]>("tutorial-replay-modules", []);
  const sobraDeFila = loaded && !!user && Array.isArray(filaGuardada) && filaGuardada.length > 0 && !tutorialNestaAbertura();
  useEffect(() => {
    if (!sobraDeFila) return;
    setData("tutorial-replay-modules", []);
    setData("tutorial-replay-pelo-menu", "");
  }, [sobraDeFila, setData]);

  const handleWidgetToggle = (id: WidgetId) => {
    if (isActive(id)) removeWidget(id);
    else addWidget(id);
  };

  if (!loaded || !onboardingResolved || homeNova.esperandoOrigem) {
    return <div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" />;
  }
  if (homeNovaDesdeAMontagem.current === null) homeNovaDesdeAMontagem.current = homeNova.ligada;
  // ligada desde a montagem: o lazy (tela em branco de sempre); ligada no meio da sessão: só depois do pedaço carregar
  const mostrarHomeNova = homeNova.ligada && (homeNovaDesdeAMontagem.current === true || homeECarregada);

  // Tutorial em andamento (fila viva) OU aberto pelo menu: o hub vira a tela
  // do tutorial — é o que faz o "voltar" de um módulo cair na ESCOLHA de
  // módulos (pedido do dono 19/07), com "Encerrar tutorial" sempre à mão.
  const replayQueue = get<ModuleKey[]>("tutorial-replay-modules", []);
  // fila só vale se o tutorial foi aberto NESTA abertura do app (lib/tutorial-abertura) — a sobra é apagada no efeito acima
  const replayPendente = Array.isArray(replayQueue) && replayQueue.length > 0 && tutorialNestaAbertura();
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

  // 1.0.19: a Home nova entra EXATAMENTE onde a Home de hoje entraria (depois do tutorial/replay/carregamento).
  // Pedaço já carregado = monta direto (a troca no meio da sessão não passa pelo fallback); senão o lazy de sempre.
  if (mostrarHomeNova) {
    const Nova = moduloHomeE?.HomeE;
    if (Nova) return <Nova />;
    return (
      <Suspense fallback={<div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" />}>
        <HomeE />
      </Suspense>
    );
  }

  return (
    <>
      <DailyNudge />
      {/* Adesivo novo / marco de sequência (26/09): um de cada vez, uma vez cada */}

      {/* ATRIBUTO_RAIZ: a Home de verdade está na tela (sem tutorial/carregamento) — é o que deixa a barra de abas aparecer */}
      <div className="min-h-dvh bg-background flex flex-col" onClick={() => editingWidgets && setEditingWidgets(false)} {...{ [ATRIBUTO_RAIZ]: "hoje" }}>
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

            {/* "SEU DIA" (missão em doses, 02/10): só com a chave ligada — desligada, não existe nem o nó */}
            <CardSeuDia lifeData={lifeData} sequencia={sequencia} />

            <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm" data-tour="score">
              <DayScoreRing score={lifeData.dayScore} streak={sequencia.dias} mostrarSequencia={false} />
              <LinhaSequencia seq={sequencia} />
              <CelebracaoDia100 score={lifeData.dayScore} streak={sequencia.dias} />
            </div>

            {/* Retrospectiva do mês que fechou, do dia 1 ao 10 (26/09) — some sozinha
                fora da janela e com o X; só pra quem tem conta. */}
            <RetrospectivaNaHome />

            {/* 15/09: era o convite de PWA ("instale na tela inicial") — que fazia
                quem comprou na web achar que o CORE era só um site, e pedia
                reembolso. Agora aponta pras lojas de verdade. */}
            <LojasCard variant="home" />

            <div data-tour="acoes-rapidas">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Ações rápidas</h3>
              <QuickActions />
            </div>

            {/* Widgets */}
            {activeWidgets.length > 0 && (
              <div className="space-y-3" onClick={e => e.stopPropagation()} {...longPressHandlers} data-track-bloco="widgets">
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
                data-tour="adicionar-widget"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Adicionar widget</span>
              </motion.button>
            )}

            <div data-tour="pendencias"><NextHoursTimeline data={lifeData} /></div>
            <div data-tour="modulos"><ModuleDrawer /></div>

            <p className="text-center text-[10px] text-muted-foreground py-2">
              Core © {new Date().getFullYear()} — Organize sua vida
            </p>
          </div>
        </main>
      </div>

      {/* 10/10 — "Sua Home em 5 passos" (TOUR_HOME, lib/tour-home): só pra conta nova sem missão
          ativa/pendente, 1x por aparelho — ver deveMostrarTourHome. Desligada, não existe o nó. */}
      {mostrarTour && (
        <TourDaHome lifeData={lifeData} widgetsAtivos={activeWidgets.map((w) => w.id)} adicionarWidget={addWidget} onFim={() => setDataTrigger((d) => d + 1)} variante={varianteDoTour() ?? "longo"} />
      )}

      {/* 1.0.22 (dono 28/10): "Tem uma Home nova" — folha de baixo, 1x por conta, nunca card no topo (EscolhaDaHome) */}
      <ConviteHomeNova bloqueado={mostrarTour || editingWidgets || showWidgetPicker} ligada={homeNova.ligada} />

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
