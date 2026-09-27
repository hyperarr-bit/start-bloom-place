/**
 * TREINO — redesenho de 26/09 (mockups p1–p4 e p7 aprovados pelo dono).
 *
 * Seis abas viraram três (o uso real mostrou RESUMO, PROGRESSÃO e RECORDES
 * quase sem abertura): 🏋️ HOJE (a folha do dia, série por série) · 📅 SEMANA
 * (a tabela da semana + a constância nova) · 📈 EVOLUÇÃO. O CONFIG saiu da fila
 * de abas e virou o ⚙️ do cabeçalho.
 *
 * 27/09 (dono: "a parte mais importante — configurar o treino e os exercícios —
 * não faz sentido ser esse botãozinho"): o ⚙️ e a folha "editor do dia" viraram
 * a aba 📋 PLANO, a 2ª da fila (HOJE · PLANO · SEMANA · EVOLUÇÃO). É o único
 * lugar onde o plano se edita: tocar num dia na SEMANA abre esse dia no PLANO.
 * Plano vazio abre direto no PLANO; `?aba=plano` (ou semana/evolucao) também.
 * Na medição a aba continua com o id "config" (a série histórica do /admin).
 *
 * Dados — tudo o que já existia continua lido e gravado do mesmo jeito:
 *  - plano `saude-workouts-v2` (alvo em sets/reps/carga, texto) — o `done` de
 *    cada exercício agora acompanha as séries (todas feitas = done);
 *  - histórico `treino-exercise-history`: uma entrada por exercício feito, com
 *    o resumo de sempre + `series` (novo, opcional);
 *  - `saude-workout-log`, `treino-weekly-volume`, `treino-notas-sessoes`,
 *    `treino-active-days`, `treino-descanso-padrao`, `treino-sound`,
 *    `treino-semana-dos-checks`, `saude-prs`.
 * Chaves novas: `treino-sessao` (a sessão do dia, série por série — se descarta
 * sozinha no dia seguinte), `treino-meta-semanal` (só gravada quando a pessoa
 * muda; o padrão é o nº de dias de treino) e `treino-sessoes` (por data: dia do
 * plano, minutos e músculos — o carimbo do mês e as horas saem daqui).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, Flame } from "lucide-react";
import { toast } from "sonner";
import { localDayKey, mesAtualExtenso, parseLocalDay, semanaAtualId } from "@/lib/utils";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { ProximoPasso } from "@/components/modules/ProximoPasso";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { trackEvent } from "@/lib/analytics";
import { avisarApagado } from "@/lib/desfazer";
import {
  adicionarSerie,
  alternarFeito,
  assinaturaDasSeries,
  chavesDosExercicios,
  concluirTreino,
  definirValor,
  duracaoEstimada,
  marcarExercicio,
  registrarNoHistorico,
  removerUltimaSerie,
  seriesIniciais,
  sessaoNova,
  sessaoValida,
  subirCarga,
  sugestaoDeCarga,
  ultimaVez,
  variacaoPct,
  volumeDaVezAnterior,
  type EntradaDoHistorico,
  type ExercicioDoPlano,
  type SerieDaSessao,
  type SessaoDoTreino,
} from "@/lib/treino-series";
import {
  DIAS,
  grupoEsquecido,
  indiceDoDia,
  metaPadrao,
  nomeDoMes,
  semanasNaMeta,
  type FonteDosTreinos,
  type MetaDaSessao,
} from "@/lib/treino-constancia";
import { cargaPorExercicio, recordesDoMes, resumoDaSemana } from "@/lib/treino-evolucao";
import { TreinoHoje, type AcoesDoHoje } from "@/components/treino/TreinoHoje";
import { RodapeDoTreino, type EstadoDoRodape } from "@/components/treino/RodapeDoTreino";
import { TreinoSemana, linhasDaSemana } from "@/components/treino/TreinoSemana";
import { ConstanciaTreino } from "@/components/treino/ConstanciaTreino";
import { TreinoEvolucao, type RecordeAnotado } from "@/components/treino/TreinoEvolucao";
import { TreinoConcluido, type ResumoDoTreino } from "@/components/treino/TreinoConcluido";
import { TreinoPlano, type AcoesDoPlano } from "@/components/treino/TreinoPlano";
import { tomDoDia } from "@/components/treino/planner";
import { aplicarModelo, exercicioNovo, moverNaLista, planoVazio, type DiaDoPlano } from "@/lib/treino-plano";

type WorkoutPlan = Record<string, DiaDoPlano>;

const defaultWorkoutPlan: WorkoutPlan = {
  SEGUNDA: { muscles: [], exercises: [] },
  TERÇA: { muscles: [], exercises: [] },
  QUARTA: { muscles: [], exercises: [] },
  QUINTA: { muscles: [], exercises: [] },
  SEXTA: { muscles: [], exercises: [] },
  SÁBADO: { muscles: [], exercises: [] },
  DOMINGO: { muscles: [], exercises: [] },
};

/** Dia como pode estar gravado (formato de antes de 07/2026 tinha `muscle` único). */
type DiaGravado = { muscles?: string[]; muscle?: string; exercises?: Partial<ExercicioDoPlano>[] } | null | undefined;

function migratePlan(plan: unknown): WorkoutPlan {
  const result: WorkoutPlan = {};
  const gravado = (plan && typeof plan === "object" ? plan : {}) as Record<string, DiaGravado>;
  for (const day of DIAS) {
    const d = gravado[day];
    if (!d) { result[day] = { muscles: [], exercises: [] }; continue; }
    const muscles = d.muscles
      ? d.muscles
      : d.muscle && d.muscle !== "Descanso"
        ? [d.muscle]
        : [];
    const exercises: ExercicioDoPlano[] = (d.exercises || []).map((ex) => ({
      name: ex.name || "",
      sets: ex.sets || "",
      reps: ex.reps || "",
      carga: ex.carga || "",
      done: ex.done || false,
      obs: ex.obs || "",
      // Cardio (23/07, pedido de usuária): tempo + distância no lugar de
      // S×R×Carga; tipo ausente = musculação (retrocompatível).
      ...(ex.tipo === "cardio" ? { tipo: "cardio" as const } : {}),
      ...(ex.duracao ? { duracao: ex.duracao } : {}),
      ...(ex.distancia ? { distancia: ex.distancia } : {}),
    }));
    result[day] = { muscles, exercises };
  }
  return result;
}

/** Um AudioContext só pro bipe do descanso (26/09: criava um novo a cada bipe). */
let audioDoDescanso: AudioContext | null = null;
const bipeDoDescanso = () => {
  try {
    audioDoDescanso ??= new AudioContext();
    if (audioDoDescanso.state === "suspended") void audioDoDescanso.resume();
    const osc = audioDoDescanso.createOscillator();
    osc.connect(audioDoDescanso.destination);
    osc.frequency.value = 800;
    osc.start();
    setTimeout(() => osc.stop(), 300);
  } catch { /* sem áudio no aparelho */ }
};

type Aba = "hoje" | "plano" | "semana" | "evolucao";
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: "hoje", label: "HOJE", icon: "🏋️" },
  { id: "plano", label: "PLANO", icon: "📋" },
  { id: "semana", label: "SEMANA", icon: "📅" },
  { id: "evolucao", label: "EVOLUÇÃO", icon: "📈" },
];
/** Id da aba no module_analytics: o PLANO segue como "config" (era o ⚙️ e,
 *  antes de 26/09, a aba CONFIG) pra série do /admin não quebrar. */
const ID_NA_MEDICAO: Record<Aba, string> = { hoje: "hoje", plano: "config", semana: "semana", evolucao: "evolucao" };

/** `?aba=plano` (ou `config`, o id antigo), `semana`, `evolucao`, `hoje`. */
const abaDaUrl = (): Aba | null => {
  try {
    const a = new URLSearchParams(window.location.search).get("aba");
    if (a === "config") return "plano";
    return ABAS.some((x) => x.id === a) ? (a as Aba) : null;
  } catch {
    return null;
  }
};

const Treino = () => {
  const navigate = useNavigate();
  const [abaPedida] = useState(abaDaUrl);
  const [activeTab, setActiveTab] = useState<Aba>(() => abaPedida ?? "hoje");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = mesAtualExtenso();
  const today = localDayKey();
  const hojeData = useMemo(() => parseLocalDay(today), [today]);
  const todayDayName = DIAS[indiceDoDia(hojeData)];

  // Garantir que o tutorial encontra o alvo: força aba "hoje" quando há tutorial pendente.
  const { get: getUserData, isGuest, loaded } = useUserData();
  const tutorialPendente = useCallback(() => {
    const forceNewUser = !!getUserData<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    if (!isGuest && !forceNewUser) return false;
    return getUserData<string>("quickstart-target-module", "") === "treino" && !getUserData<string>("spotlight-done-treino", "");
  }, [isGuest, getUserData]);
  useEffect(() => {
    if (tutorialPendente()) setActiveTab("hoje");
  }, [tutorialPendente]);

  /*
   * PLANO VAZIO ABRE NO PLANO (27/09). Decidido UMA vez, com os dados já
   * carregados (antes disso o plano sempre parece vazio) e lendo o store direto
   * (o estado do usePersistedState hidrata no mesmo ciclo). Não vale com
   * tutorial pendente (o alvo dele está no HOJE) nem com `?aba=` na URL. Nada é
   * gravado: abrir o módulo continua sem escrever (escrita = "1º treino").
   */
  const abaInicialDecidida = useRef(false);
  useEffect(() => {
    if (!loaded || abaInicialDecidida.current) return;
    abaInicialDecidida.current = true;
    if (abaPedida) {
      if (abaPedida !== "hoje") reportTab?.(ID_NA_MEDICAO[abaPedida]);
      return;
    }
    if (tutorialPendente()) return;
    if (planoVazio(getUserData<unknown>("saude-workouts-v2", null))) {
      setActiveTab("plano");
      reportTab?.(ID_NA_MEDICAO.plano);
    }
  }, [loaded, abaPedida, tutorialPendente, getUserData, reportTab]);

  const [rawPlan, setRawPlan] = usePersistedState("saude-workouts-v2", defaultWorkoutPlan);
  // Sem nenhum músculo ou exercício em nenhum dia, o módulo abre vazio — o
  // PLANO começa pelos modelos e as outras abas mostram o "Próximo passo".
  const treinoVazio = planoVazio(rawPlan);
  const workoutPlan = useMemo(() => migratePlan(rawPlan), [rawPlan]);
  const setWorkoutPlan = useCallback(
    (p: WorkoutPlan | ((prev: WorkoutPlan) => WorkoutPlan)) => {
      if (typeof p === "function") setRawPlan((prev) => p(migratePlan(prev)));
      else setRawPlan(p);
    },
    [setRawPlan],
  );

  /*
   * ZERA OS CHECKS NA VIRADA DA SEMANA (29/07, bug do dono: "fiz esse treino
   * terça passada mas ainda estava marcado como feito hoje"). O `done` mora
   * no plano, na chave do dia da semana, sem data — então guardo QUAL SEMANA
   * os checks atuais pertencem; semana nova, checks zerados, uma vez só.
   *
   * 26/09: o carimbo só é gravado quando EXISTE ✓ a proteger. Antes o boot do
   * Treino escrevia a chave pra toda conta nova ao abrir o módulo — escrita que
   * conta como "primeiro treino" (ativação) sem ninguém ter feito nada.
   */
  const [semanaDosChecks, setSemanaDosChecks] = usePersistedState<string>("treino-semana-dos-checks", "");
  const semanaAtual = useMemo(() => semanaAtualId(), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!semanaAtual || semanaDosChecks === semanaAtual) return;
    const temCheck = Object.values(workoutPlan).some((d) => d.exercises.some((e) => e.done));
    if (semanaDosChecks) {
      if (temCheck) {
        setRawPlan((prev) => {
          const plano = migratePlan(prev);
          const novo: WorkoutPlan = { ...plano };
          for (const dia of Object.keys(novo)) {
            const exs = novo[dia]?.exercises ?? [];
            if (exs.some((e) => e.done)) novo[dia] = { ...novo[dia], exercises: exs.map((e) => ({ ...e, done: false })) };
          }
          return novo;
        });
      }
      setSemanaDosChecks(semanaAtual);
    } else if (temCheck) {
      setSemanaDosChecks(semanaAtual);
    }
  }, [semanaAtual, semanaDosChecks, workoutPlan, setRawPlan, setSemanaDosChecks]);

  const [activeDays, setActiveDays] = usePersistedState<string[]>("treino-active-days", ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"]);
  // Dias ativos normalizados: MAIÚSCULA + só dias válidos + sem repetição, na
  // ordem da semana (23/07: "Segunda" Title Case ao lado de "SEGUNDA").
  const diasAtivosLimpos = useMemo(
    () => [...new Set((Array.isArray(activeDays) ? activeDays : []).map((d) => String(d).toUpperCase()).filter((d) => DIAS.includes(d)))]
      .sort((a, b) => DIAS.indexOf(a) - DIAS.indexOf(b)),
    [activeDays],
  );
  useEffect(() => {
    if (!Array.isArray(activeDays)) return;
    const sujo = activeDays.length !== diasAtivosLimpos.length || activeDays.some((d, i) => d !== diasAtivosLimpos[i]);
    if (sujo) setActiveDays(diasAtivosLimpos);
  }, [activeDays, diasAtivosLimpos, setActiveDays]);

  const [workoutLog, setWorkoutLog] = usePersistedState<string[]>("saude-workout-log", []);
  const log = useMemo(() => (Array.isArray(workoutLog) ? workoutLog : []), [workoutLog]);
  const [workoutNotes, setWorkoutNotes] = usePersistedState<Record<string, string>>("saude-workout-notes", {});
  // Nota da sessão com DATA (26/09): a de cima é por dia da semana; no Concluir
  // ela desce pra cá e o campo do dia fica limpo.
  const [notasDasSessoes, setNotasDasSessoes] = usePersistedState<Record<string, string>>("treino-notas-sessoes", {});
  const [personalRecords, setPersonalRecords] = usePersistedState<RecordeAnotado[]>("saude-prs", []);
  // descanso escolhido fica salvo (26/09: voltava pra 60 s toda vez)
  const [restTime, setRestTime] = usePersistedState<number>("treino-descanso-padrao", 60);
  const [soundEnabled, setSoundEnabled] = usePersistedState("treino-sound", true);
  const [weeklyVolume, setWeeklyVolume] = usePersistedState<Record<string, number>>("treino-weekly-volume", {});
  const [exerciseHistory, setExerciseHistory] = usePersistedState<EntradaDoHistorico[]>("treino-exercise-history", []);
  const historico = useMemo(() => (Array.isArray(exerciseHistory) ? exerciseHistory : []), [exerciseHistory]);
  const [sessaoSalva, setSessaoSalva] = usePersistedState<SessaoDoTreino | null>("treino-sessao", null);
  const [metaSalva, setMetaSalva] = usePersistedState<number | null>("treino-meta-semanal", null);
  const [sessoesMeta, setSessoesMeta] = usePersistedState<Record<string, MetaDaSessao>>("treino-sessoes", {});
  // Sessão da versão anterior (só o horário de início): quem estava no meio de um
  // treino na atualização continua com o relógio; depois a chave é limpa.
  const [inicioLegado, setInicioLegado] = usePersistedState<string | null>("treino-session-start", null);

  const meta = Math.min(7, Math.max(1, Math.round(Number(metaSalva) || metaPadrao(diasAtivosLimpos))));

  /* ---------------- a sessão de hoje ---------------- */
  const sessaoOk = sessaoValida(sessaoSalva, today, Date.now());
  const sessao: SessaoDoTreino = useMemo(
    () => (sessaoOk ? (sessaoSalva as SessaoDoTreino) : sessaoNova(today, todayDayName)),
    [sessaoOk, sessaoSalva, today, todayDayName],
  );
  // Sessão de outro dia esquecida aberta se descarta sozinha (a regra das 12 h, 26/09).
  useEffect(() => {
    if (sessaoSalva && !sessaoValida(sessaoSalva, today, Date.now())) setSessaoSalva(null);
  }, [sessaoSalva, today, setSessaoSalva]);
  useEffect(() => {
    if (!inicioLegado) return;
    const t = Date.parse(inicioLegado);
    if (!sessaoSalva && Number.isFinite(t) && Date.now() - t < 12 * 3_600_000 && localDayKey(new Date(t)) === today) {
      setSessaoSalva({ ...sessaoNova(today, todayDayName), inicio: inicioLegado });
    }
    setInicioLegado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicioLegado]);

  const diaDoTreino = DIAS.includes(sessao.dia) ? sessao.dia : todayDayName;
  const planoDoDia = workoutPlan[diaDoTreino] ?? { muscles: [], exercises: [] };
  const exercicios = planoDoDia.exercises;
  const chaves = useMemo(() => chavesDosExercicios(exercicios), [exercicios]);
  const ultimas = useMemo(
    () => Object.fromEntries(chaves.map((k, i) => [k, exercicios[i]?.tipo === "cardio" ? null : ultimaVez(historico, exercicios[i].name, sessao.data)])),
    [chaves, exercicios, historico, sessao.data],
  );
  // O ✓ do plano só vale pro dia da semana de hoje e se for DESTA semana (na
  // virada, antes do efeito acima zerar, o ✓ da semana passada ainda está lá).
  const checksValem = diaDoTreino === todayDayName && (!semanaDosChecks || semanaDosChecks === semanaAtual);
  const iniciais = useMemo(
    () => Object.fromEntries(chaves.map((k, i) => [k, seriesIniciais(checksValem ? exercicios[i] : { ...exercicios[i], done: false }, ultimas[k])])),
    [chaves, exercicios, ultimas, checksValem],
  );
  const seriesEfetivas = useMemo(
    () => Object.fromEntries(chaves.map((k) => [k, sessao.series[k] ?? iniciais[k]])) as Record<string, SerieDaSessao[]>,
    [chaves, sessao.series, iniciais],
  );
  const sugestoes = useMemo(
    () => Object.fromEntries(chaves.map((k, i) => [k, sugestaoDeCarga(exercicios[i], ultimas[k])])),
    [chaves, exercicios, ultimas],
  );
  let feitas = 0;
  let total = 0;
  for (const k of chaves) {
    total += seriesEfetivas[k].length;
    feitas += seriesEfetivas[k].filter((s) => s.feito).length;
  }
  const soCardio = exercicios.length > 0 && exercicios.every((e) => e.tipo === "cardio");
  const rotuloTotal = soCardio ? "exercícios" : "séries";

  const hojeAtivo = diasAtivosLimpos.includes(todayDayName);
  const descanso = diaDoTreino === todayDayName && !hojeAtivo && exercicios.length === 0;
  const temTreinoHoje = !descanso && exercicios.length > 0;
  const outrosDias = DIAS.filter((d) => d !== todayDayName && (workoutPlan[d]?.exercises.length ?? 0) > 0).map((d) => ({
    dia: d,
    rotulo: workoutPlan[d].muscles.join(" + ") || `${workoutPlan[d].exercises.length} exercício${workoutPlan[d].exercises.length > 1 ? "s" : ""}`,
  }));
  // Dia que ancora o tutorial: hoje, ou (se hoje é descanso) o primeiro dia ativo vazio.
  const diaVazio = DIAS.find((d) => diasAtivosLimpos.includes(d) && (workoutPlan[d]?.exercises?.length ?? 0) === 0) ?? null;
  const spotlightDay = hojeAtivo ? todayDayName : diaVazio ?? todayDayName;
  const minutosAnteriores = useMemo(
    () => Object.entries(sessoesMeta ?? {})
      .filter(([data, m]) => m?.dia === diaDoTreino && data < sessao.data)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, m]) => Number(m?.minutos) || 0),
    [sessoesMeta, diaDoTreino, sessao.data],
  );
  const minutosEstimados = duracaoEstimada(exercicios, restTime, minutosAnteriores);

  const concluido = !!sessao.fim;
  const seriesParaAssinatura = useMemo(() => ({ ...sessao.series, ...seriesEfetivas }), [sessao.series, seriesEfetivas]);
  const alterado = concluido && sessao.assinatura !== assinaturaDasSeries(seriesParaAssinatura);
  const estadoDoRodape: EstadoDoRodape = concluido
    ? (alterado ? "alterado" : "concluido")
    : !sessao.inicio && feitas === 0 ? "comecar" : "treinando";
  const nota = concluido ? (notasDasSessoes?.[sessao.data] ?? "") : (workoutNotes?.[diaDoTreino] ?? "");

  /* ---------------- descanso (horário de fim, não contador) ---------------- */
  const [descansoAte, setDescansoAte] = useState<number | null>(null);
  useEffect(() => {
    if (!descansoAte) return;
    const t = window.setTimeout(() => {
      // voltou da tela bloqueada muito depois: não bipa atrasado
      if (Date.now() - descansoAte < 3000) {
        if (soundEnabled) bipeDoDescanso();
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
      }
      setDescansoAte(null);
    }, Math.max(0, descansoAte - Date.now()));
    return () => window.clearTimeout(t);
  }, [descansoAte, soundEnabled]);
  const iniciarDescanso = () => setDescansoAte(Date.now() + Math.max(5, Number(restTime) || 60) * 1000);
  const ajustarDescanso = (seg: number) =>
    setDescansoAte((a) => {
      if (!a) return a;
      const n = Math.min(a + seg * 1000, Date.now() + 600_000);
      return n - Date.now() <= 500 ? null : n;
    });

  /* ---------------- ações da sessão ---------------- */
  const mudarSessao = (f: (s: SessaoDoTreino) => SessaoDoTreino) =>
    setSessaoSalva((prev) => f(sessaoValida(prev, today, Date.now()) ? (prev as SessaoDoTreino) : sessaoNova(today, todayDayName)));
  const comInicio = (s: SessaoDoTreino) => (s.inicio ? s : { ...s, inicio: new Date().toISOString() });

  // O `done` do exercício no plano acompanha as séries (é o que versões antigas
  // do app e a virada da semana leem). Treino de OUTRO dia feito hoje não mexe
  // no ✓ daquele dia — senão a sexta abriria já feita depois de um "treinar
  // mesmo assim" na quarta.
  const sincronizarDone = (k: string, feito: boolean) => {
    const idx = chaves.indexOf(k);
    if (diaDoTreino !== todayDayName || idx < 0 || !!exercicios[idx]?.done === feito) return;
    const nome = exercicios[idx].name;
    setWorkoutPlan((prev) => {
      const d0 = prev[diaDoTreino];
      if (!d0?.exercises[idx] || d0.exercises[idx].name !== nome) return prev;
      const exs = [...d0.exercises];
      exs[idx] = { ...exs[idx], done: feito };
      return { ...prev, [diaDoTreino]: { ...d0, exercises: exs } };
    });
  };

  const mudarExercicio = (dia: string, idx: number, mudanca: Partial<ExercicioDoPlano>) =>
    setWorkoutPlan((prev) => {
      const d0 = prev[dia] ?? { muscles: [], exercises: [] };
      if (!d0.exercises[idx]) return prev;
      const exs = [...d0.exercises];
      exs[idx] = { ...exs[idx], ...mudanca };
      if ("tipo" in mudanca && !mudanca.tipo) delete (exs[idx] as Partial<ExercicioDoPlano>).tipo;
      return { ...prev, [dia]: { ...d0, exercises: exs } };
    });

  const adicionarExercicio = (dia: string, nome: string, extra?: Partial<ExercicioDoPlano>) => {
    setWorkoutPlan((prev) => {
      const d0 = prev[dia] ?? { muscles: [], exercises: [] };
      return { ...prev, [dia]: { ...d0, exercises: [...(d0.exercises ?? []), exercicioNovo(nome, extra)] } };
    });
    // dia que recebe exercício vira dia de treino (senão fica "descanso" com treino dentro)
    if (!diasAtivosLimpos.includes(dia)) setActiveDays((prev) => [...new Set([...(prev ?? []), dia])]);
  };

  const acoesDoHoje: AcoesDoHoje = {
    alternarSerie: (k, i) => {
      const lista = seriesEfetivas[k];
      if (!lista?.[i]) return;
      const marcando = !lista[i].feito;
      mudarSessao((s) => {
        const n = alternarFeito(s, k, iniciais[k], i);
        return marcando ? comInicio(n) : n;
      });
      sincronizarDone(k, lista.every((s, j) => (j === i ? marcando : s.feito)));
      // marcar dispara o descanso (menos na última série do treino)
      if (marcando && feitas + 1 < total) iniciarDescanso();
    },
    valor: (k, i, campo, v) => mudarSessao((s) => definirValor(s, k, iniciais[k], i, campo, v)),
    subir: (k, nova) => {
      mudarSessao((s) => subirCarga(s, k, iniciais[k], nova));
      trackEvent("treino_subiu_carga", { carga: nova });
    },
    maisSerie: (k) => mudarSessao((s) => adicionarSerie(s, k, iniciais[k])),
    menosSerie: (k) => mudarSessao((s) => removerUltimaSerie(s, k, iniciais[k])),
    marcarExercicio: (k, feito) => {
      mudarSessao((s) => {
        const n = marcarExercicio(s, k, iniciais[k], feito);
        return feito ? comInicio(n) : n;
      });
      sincronizarDone(k, feito);
    },
    obs: (i, texto) => mudarExercicio(diaDoTreino, i, { obs: texto }),
    cardio: (i, campo, v) => mudarExercicio(diaDoTreino, i, { [campo]: v }),
    adicionarExercicio,
    nota: (texto) => {
      if (concluido) setNotasDasSessoes((prev) => ({ ...(prev ?? {}), [sessao.data]: texto }));
      else setWorkoutNotes((prev) => ({ ...(prev ?? {}), [diaDoTreino]: texto }));
    },
    escolherDia: (d) => {
      if (d == null) setSessaoSalva(null);
      else mudarSessao((s) => ({ ...s, dia: d }));
    },
    abrirPlano: () => abrirNoPlano(diaDoTreino, true),
  };

  /* ---------------- concluir ---------------- */
  const [resumo, setResumo] = useState<ResumoDoTreino | null>(null);
  const [concluidoAberto, setConcluidoAberto] = useState(false);

  const montarResumo = (series: Record<string, SerieDaSessao[]>, logDepois: string[], minutos: number | null, notaTexto: string): ResumoDoTreino => {
    const antes = historico.filter((h) => h && typeof h.date === "string" && h.date < sessao.data);
    const r = concluirTreino({ exercicios, chaves, series, historico: antes, data: sessao.data });
    const anterior = volumeDaVezAnterior(antes, r.entradas.filter((e) => e.tipo !== "cardio").map((e) => e.exercise), sessao.data);
    const d = parseLocalDay(sessao.data);
    return {
      diaNome: DIAS[indiceDoDia(d)],
      dataTexto: `${d.getDate()} DE ${nomeDoMes(d.getMonth()).toUpperCase()}`,
      titulo: planoDoDia.muscles.join(" + ") || `${r.linhas.length} exercício${r.linhas.length === 1 ? "" : "s"}`,
      minutos,
      linhas: r.linhas,
      volume: r.volume,
      vsUltima: anterior ? variacaoPct(r.volume, anterior.volume) : null,
      sequencia: semanasNaMeta(logDepois, meta, hojeData).sequencia,
      nota: notaTexto,
      recorde: r.recordes.length > 0,
    };
  };

  const concluir = () => {
    if (feitas === 0) {
      toast("Marque pelo menos uma série pra concluir o treino.");
      return;
    }
    const data = sessao.data;
    const agora = new Date();
    const series: Record<string, SerieDaSessao[]> = { ...sessao.series, ...seriesEfetivas };
    const antes = historico.filter((h) => h && typeof h.date === "string" && h.date < data);
    const r = concluirTreino({ exercicios, chaves, series, historico: antes, data });
    // Concluir de novo no mesmo dia SUBSTITUI o do dia: sai tudo deste treino
    // naquela data (inclusive o que foi desmarcado depois) e entra o de agora.
    const nomesDoTreino = new Set(exercicios.map((e) => e.name.trim()));
    setExerciseHistory((prev) =>
      registrarNoHistorico(
        (Array.isArray(prev) ? prev : []).filter((h) => !(h?.date === data && nomesDoTreino.has(String(h.exercise ?? "").trim()))),
        r.entradas,
        data,
      ),
    );
    const logDepois = log.includes(data) ? log : [...log, data];
    if (!log.includes(data)) setWorkoutLog((prev) => (Array.isArray(prev) && prev.includes(data) ? prev : [...(Array.isArray(prev) ? prev : []), data]));
    // volume do dia = Σ carga × reps das séries feitas (cardio não soma)
    setWeeklyVolume((prev) => ({ ...(prev ?? {}), [data]: r.volume }));
    const inicio = sessao.inicio ?? agora.toISOString();
    const minutos = sessao.inicio ? Math.min(240, Math.max(1, Math.round((agora.getTime() - Date.parse(sessao.inicio)) / 60_000))) : null;
    setSessoesMeta((prev) => ({ ...(prev ?? {}), [data]: { dia: diaDoTreino, ...(minutos ? { minutos } : {}), musculos: planoDoDia.muscles } }));
    const notaDoDia = (workoutNotes?.[diaDoTreino] ?? "").trim();
    if (notaDoDia) {
      setNotasDasSessoes((prev) => ({ ...(prev ?? {}), [data]: notaDoDia }));
      setWorkoutNotes((prev) => ({ ...(prev ?? {}), [diaDoTreino]: "" }));
    }
    setSessaoSalva({ ...sessao, series, inicio, fim: agora.toISOString(), assinatura: assinaturaDasSeries(series) });
    setDescansoAte(null);
    setResumo(montarResumo(series, logDepois, minutos, notaDoDia || notasDasSessoes?.[data] || ""));
    setConcluidoAberto(true);
    trackEvent("treino_concluido", { series: r.feitas, volume: Math.round(r.volume), recordes: r.recordes.length, de_novo: concluido });
  };

  const verResumo = () => {
    const minutos = sessao.inicio && sessao.fim ? Math.max(1, Math.round((Date.parse(sessao.fim) - Date.parse(sessao.inicio)) / 60_000)) : null;
    setResumo(montarResumo({ ...sessao.series, ...seriesEfetivas }, log, minutos, notasDasSessoes?.[sessao.data] ?? ""));
    setConcluidoAberto(true);
  };

  /* ---------------- semana, constância, evolução ---------------- */
  const { semanas, sequencia } = useMemo(() => semanasNaMeta(log, meta, hojeData), [log, meta, hojeData]);
  const fonte: FonteDosTreinos = useMemo(() => ({ sessoes: sessoesMeta ?? {}, historico, plano: workoutPlan }), [sessoesMeta, historico, workoutPlan]);
  const esquecido = useMemo(
    () => grupoEsquecido({ fonte, diasAtivos: diasAtivosLimpos, log, hoje: today }),
    [fonte, diasAtivosLimpos, log, today],
  );
  const linhas = linhasDaSemana({
    plano: workoutPlan,
    diasAtivos: diasAtivosLimpos,
    hoje: hojeData,
    hojeNome: todayDayName,
    log,
    volumePorDia: weeklyVolume ?? {},
    progressoHoje: { feitas: concluido ? 0 : feitas, total, rotulo: rotuloTotal },
  });
  const resumoSemana = useMemo(() => resumoDaSemana(log, weeklyVolume, hojeData), [log, weeklyVolume, hojeData]);
  const recordesMes = useMemo(() => recordesDoMes(historico, hojeData.getFullYear(), hojeData.getMonth()), [historico, hojeData]);
  const recordesAnteriores = useMemo(() => {
    const d = new Date(hojeData.getFullYear(), hojeData.getMonth() - 1, 1);
    return { nome: nomeDoMes(d.getMonth()), lista: recordesDoMes(historico, d.getFullYear(), d.getMonth()) };
  }, [historico, hojeData]);
  const cargas = useMemo(() => cargaPorExercicio(historico, today), [historico, today]);

  /* ---------------- 📋 PLANO: a semana, o dia aberto, modelos e ajustes ---------------- */
  const [diaDoPlano, setDiaDoPlano] = useState<string>(todayDayName);

  const trocarAba = (id: Aba) => {
    setActiveTab(id);
    reportTab?.(ID_NA_MEDICAO[id]);
  };
  /** A SEMANA e o HOJE mandam pra cá: o dia já aberto e a página no topo —
   *  ou nos modelos prontos, quando o convite foi "use um modelo pronto". */
  const abrirNoPlano = (dia: string, nosModelos = false) => {
    if (DIAS.includes(dia)) setDiaDoPlano(dia);
    trocarAba("plano");
    try { window.scrollTo({ top: 0 }); } catch { /* jsdom */ }
    if (nosModelos) {
      window.setTimeout(() => {
        document.querySelector<HTMLElement>('[data-testid="modelos-prontos"]')?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 60);
    }
  };

  const toggleMuscleForDay = (day: string, muscle: string) => {
    setWorkoutPlan((prev) => {
      const day0 = prev[day] ?? { muscles: [], exercises: [] };
      const current = day0.muscles ?? [];
      const newMuscles = current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle];
      return { ...prev, [day]: { ...day0, muscles: newMuscles } };
    });
  };

  const acoesDoPlano: AcoesDoPlano = {
    escolherDia: (d) => setDiaDoPlano(d),
    ativo: (d, on) => {
      setActiveDays((prev) => (on ? [...new Set([...(prev ?? []), d])] : (prev ?? []).filter((x) => x !== d)));
      if (on) setWorkoutPlan((prev) => (prev[d] ? prev : { ...prev, [d]: { muscles: [], exercises: [] } }));
    },
    musculo: toggleMuscleForDay,
    exercicio: mudarExercicio,
    adicionar: adicionarExercicio,
    mover: (dia, de, para) =>
      setWorkoutPlan((prev) => {
        const d0 = prev[dia] ?? { muscles: [], exercises: [] };
        const lista = moverNaLista(d0.exercises ?? [], de, para);
        return lista === d0.exercises ? prev : { ...prev, [dia]: { ...d0, exercises: lista } };
      }),
    // "Remover exercício": a lixeira apagava SEMPRE o último, sem volta (26/09).
    remover: (dia, i) => {
      const removido = workoutPlan[dia]?.exercises[i];
      if (!removido) return;
      setWorkoutPlan((prev) => {
        const d0 = prev[dia] ?? { muscles: [], exercises: [] };
        return { ...prev, [dia]: { ...d0, exercises: (d0.exercises ?? []).filter((_, j) => j !== i) } };
      });
      avisarApagado(`"${removido.name}" removido`, () => setWorkoutPlan((prev) => {
        const d0 = prev[dia] ?? { muscles: [], exercises: [] };
        const lista = [...(d0.exercises ?? [])];
        lista.splice(Math.min(i, lista.length), 0, removido);
        return { ...prev, [dia]: { ...d0, exercises: lista } };
      }));
    },
    // COPIAR PRA OUTROS DIAS (22/09) — copia músculos + exercícios (zerando os ✓);
    // 26/09: com Desfazer, que antes não tinha.
    copiar: (dia, destinos) => {
      if (!destinos.length) return;
      const planoAntes = workoutPlan;
      const diasAntes = activeDays;
      setWorkoutPlan((prev) => {
        const src = prev[dia] ?? { muscles: [], exercises: [] };
        const u = { ...prev };
        destinos.forEach((t) => {
          u[t] = { ...src, muscles: [...(src.muscles ?? [])], exercises: (src.exercises ?? []).map((e) => ({ ...e, done: false })) };
        });
        return u;
      });
      // dia que recebe um treino vira dia de treino — senão continua "descanso"
      setActiveDays((prev) => Array.from(new Set([...(prev ?? []), ...destinos])));
      trackEvent("treino_copiado", { de: dia, para: destinos.length });
      avisarApagado(
        `Treino de ${dia.toLowerCase()} copiado pra ${destinos.length} dia${destinos.length > 1 ? "s" : ""}`,
        () => { setWorkoutPlan(() => planoAntes); setActiveDays(diasAntes); },
      );
    },
    // MODELO PRONTO (27/09: agora com exercícios nos dias vazios — antes só
    // marcava os grupos e a semana continuava por digitar). Trocava a semana
    // inteira sem aviso nem volta até a varredura de 26/09: segue com Desfazer.
    modelo: (m) => {
      const planoAntes = workoutPlan;
      const diasAntes = activeDays;
      const r = aplicarModelo(workoutPlan, m);
      setWorkoutPlan(() => r.plano);
      setActiveDays(r.diasAtivos);
      setDiaDoPlano(r.diasAtivos.includes(todayDayName) ? todayDayName : r.diasAtivos[0] ?? todayDayName);
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* jsdom */ }
      trackEvent("treino_modelo", { modelo: m.name, dias: r.diasAtivos.length });
      avisarApagado(`Modelo "${m.name}" aplicado`, () => { setWorkoutPlan(() => planoAntes); setActiveDays(diasAntes); });
    },
    meta: (n) => setMetaSalva(n),
    descanso: (s) => setRestTime(s),
    som: (v) => setSoundEnabled(v),
  };

  const [alturaRodape, setAlturaRodape] = useState(0);
  const mostraRodape = activeTab === "hoje" && temTreinoHoje;
  const tomHoje = tomDoDia(todayDayName);

  return (
    <div className="min-h-screen bg-background">
      <SpotlightOverlay
        moduleKey="treino"
        steps={[
          { selector: '[data-spotlight="add-exercise"]', label: "Digite o exercício e toque no + para adicionar o treino de hoje.", advanceOnAction: "first_workout" },
        ]}
      />
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={() => navigate("/home")} aria-label="Voltar" className="w-9 h-9 -ml-2 shrink-0 grid place-items-center rounded-md hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Dumbbell className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
          <h1 className="text-[18px] font-extrabold tracking-tight">TREINO</h1>
          <div className="ml-auto flex items-center gap-1.5">
            {sequencia > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 text-orange-600 text-[12px] font-bold px-2 h-7 whitespace-nowrap"
                title="Semanas seguidas batendo a meta"
                data-testid="sequencia-semanas"
              >
                <Flame className="w-3 h-3" aria-hidden="true" />
                {sequencia} sem
              </span>
            )}
            <span className="hidden min-[425px]:inline text-muted-foreground text-xs whitespace-nowrap">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        {/* 4 abas num celular de 360: largura pela palavra (EVOLUÇÃO é a maior),
            não em colunas iguais — 4 colunas iguais cortavam o EVOLUÇÃO. */}
        <div className="max-w-5xl mx-auto px-4 pb-2.5 flex gap-1.5 min-[400px]:gap-2">
          {ABAS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-spotlight={`tab-${tab.id}`}
              data-active={activeTab === tab.id}
              data-testid={`aba-${tab.id}`}
              onClick={() => trocarAba(tab.id)}
              className={`notion-tab flex-auto justify-center gap-1 min-[400px]:gap-1.5 px-1.5 rounded-lg text-[11px] min-[400px]:text-[12.5px] font-semibold tracking-wide whitespace-nowrap ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span aria-hidden="true" className="max-[339px]:hidden">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main
        className="max-w-5xl mx-auto px-4 py-4"
        style={{ paddingBottom: mostraRodape ? `calc(${alturaRodape + 20}px + var(--teste-banner-h, 0px))` : "calc(2rem + var(--teste-banner-h, 0px))" }}
      >
        <ModuleTip
          moduleId="treino"
          tips={[
            "No 📋 PLANO você monta a semana: modelo pronto, exercícios, séries e carga",
            "Marque cada série no HOJE — o descanso começa sozinho",
            "Recordes e a carga de cada exercício aparecem em 📈 EVOLUÇÃO",
          ]}
        />

        {activeTab === "hoje" && (
          <TreinoHoje
            hoje={today}
            hojeNome={todayDayName}
            dia={diaDoTreino}
            descanso={descanso}
            exercicios={exercicios}
            musculos={planoDoDia.muscles}
            chaves={chaves}
            series={seriesEfetivas}
            ultimas={ultimas}
            sugestoes={sugestoes}
            feitas={feitas}
            total={total}
            rotuloTotal={rotuloTotal}
            minutos={minutosEstimados}
            nota={nota}
            outrosDias={outrosDias}
            diaParaMontar={descanso ? diaVazio : null}
            spotlightDia={spotlightDay}
            podeTrocar={diaDoTreino !== todayDayName}
            acoes={acoesDoHoje}
          />
        )}

        {activeTab === "plano" && (
          <TreinoPlano
            hojeNome={todayDayName}
            dia={diaDoPlano}
            plano={workoutPlan}
            diasAtivos={diasAtivosLimpos}
            vazio={treinoVazio}
            meta={meta}
            descanso={Number(restTime) || 60}
            som={soundEnabled !== false}
            acoes={acoesDoPlano}
          />
        )}

        {activeTab === "semana" && (
          <TreinoSemana linhas={linhas} onAbrirDia={abrirNoPlano}>
            <ConstanciaTreino
              meta={meta}
              onMeta={(n) => setMetaSalva(n)}
              semanas={semanas}
              sequencia={sequencia}
              hoje={today}
              hojeNome={todayDayName}
              log={log}
              fonte={fonte}
              notas={notasDasSessoes ?? {}}
              esquecido={esquecido}
            />
          </TreinoSemana>
        )}

        {activeTab === "evolucao" && (
          <TreinoEvolucao
            resumo={resumoSemana}
            meta={meta}
            recordes={recordesMes}
            anteriores={recordesAnteriores}
            nomeDoMes={nomeDoMes(hojeData.getMonth())}
            cargas={cargas}
            historico={historico}
            prs={Array.isArray(personalRecords) ? personalRecords : []}
            onPrs={setPersonalRecords}
            hoje={today}
            volumePorDia={weeklyVolume ?? {}}
            onAvisarApagado={avisarApagado}
          />
        )}

        {treinoVazio && activeTab !== "plano" && (
          <div className="mt-4">
            <ProximoPasso
              emoji="💪"
              titulo="Monte seu treino da semana"
              passos={[
                "No 📋 PLANO, escolha um modelo pronto — ou monte dia a dia",
                "Ajuste séries, repetições e carga de cada exercício",
                "No HOJE, marque cada série — o descanso começa sozinho",
              ]}
              acao={
                <button type="button" onClick={() => abrirNoPlano(todayDayName)} className="h-10 px-4 rounded-lg bg-foreground text-background text-[13px] font-bold">
                  Montar meu plano
                </button>
              }
            />
          </div>
        )}
      </main>

      {mostraRodape && (
        <RodapeDoTreino
          tom={tomHoje}
          descansoAte={descansoAte}
          onDescanso={ajustarDescanso}
          onPular={() => setDescansoAte(null)}
          inicio={sessao.inicio}
          fim={sessao.fim ?? null}
          feitas={feitas}
          total={total}
          rotuloTotal={rotuloTotal}
          estado={estadoDoRodape}
          estimativa={minutosEstimados}
          onComecar={() => mudarSessao(comInicio)}
          onConcluir={concluir}
          onVerResumo={verResumo}
          onAltura={setAlturaRodape}
        />
      )}

      <TreinoConcluido resumo={resumo} aberto={concluidoAberto} onFechar={() => setConcluidoAberto(false)} />
    </div>
  );
};

export default Treino;
