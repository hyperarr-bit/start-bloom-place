import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronRight, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LifeHubData } from "@/hooks/use-life-hub-data";
import { abrirAcaoRapida, type ActionId } from "@/components/home/QuickActions";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_COMPROMISSOS, proximosDeHoje, type Compromisso } from "@/lib/compromissos";

interface NextHoursTimelineProps {
  data: LifeHubData;
}

interface PendingItem {
  label: string;
  done: boolean;
  emoji: string;
  priority: number;
  route?: string;
  /** Em vez de navegar, abre a ação rápida (o mesmo formulário do botão lá em cima). */
  action?: ActionId;
}

export const NextHoursTimeline = ({ data }: NextHoursTimelineProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { get } = useUserData();
  const items: PendingItem[] = [];

  /* COMPROMISSOS DE HOJE (22/09, chamado: "tarefas criadas em Rotina não
     aparecem no dashboard"). O que tem hora vem PRIMEIRO — é a única linha
     desta lista que perde sentido se passar. Só os que ainda não passaram;
     o de 15h ainda aparece até 15h30. Toque abre o Meu mês. */
  proximosDeHoje(get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()).forEach((o, i) => {
    items.push({
      label: `${o.compromisso.hora} · ${o.compromisso.titulo}${o.compromisso.local ? ` · ${o.compromisso.local}` : ""}`,
      done: false,
      emoji: "📅",
      priority: -10 + i * 0.01,
      route: "/rotina?aba=mes",
    });
  });

  // Habits - always show
  const pendingHabits = data.habits.filter(h => !h.done);
  const doneHabits = data.habits.filter(h => h.done);
  if (data.habits.length > 0) {
    if (pendingHabits.length > 0) {
      items.push({
        label: pendingHabits.length === 1
          ? `Hábito pendente: ${pendingHabits[0].name}`
          : `${pendingHabits.length} hábitos pendentes`,
        done: false,
        emoji: "✅",
        priority: 1,
        route: "/rotina",
      });
    } else {
      items.push({
        label: `${doneHabits.length} hábito${doneHabits.length > 1 ? "s" : ""} concluído${doneHabits.length > 1 ? "s" : ""}`,
        done: true,
        emoji: "✅",
        priority: 10,
        route: "/rotina",
      });
    }
  } else {
    items.push({
      label: "Adicionar hábitos diários",
      done: false,
      emoji: "✅",
      priority: 1,
      route: "/rotina",
    });
  }

  // Workout - always show
  if (data.todayWorkoutGroup) {
    items.push({
      label: data.workoutDone
        ? `Treino de ${data.todayWorkoutGroup} concluído`
        : `Treino de ${data.todayWorkoutGroup} hoje`,
      done: data.workoutDone,
      emoji: "🏋️",
      priority: data.workoutDone ? 11 : 2,
      route: "/treino",
    });
  } else if (data.workoutStatus === "descanso") {
    // Dia de descanso NÃO é pendência: o plano existe, hoje só não treina.
    // Antes caía em "Configurar treino da semana" e a pessoa que tinha
    // configurado tudo via a cobrança todo dia de folga (cliente, 11/09).
    items.push({
      label: "Hoje é descanso",
      done: true,
      emoji: "😴",
      priority: 11,
      route: "/treino",
    });
  }
  /* Plano de treino VAZIO (13/09): o score dá os 15 pontos (sem plano não há
     o que cobrar), então "Configurar treino da semana" como PENDÊNCIA
     contradizia o próprio score — 100 pontos com "1 pendente". Vira aviso,
     fora da contagem, junto da conta a vencer. */
  const avisoTreino = !data.todayWorkoutGroup && data.workoutStatus !== "descanso";

  // Water - always show
  const waterRemaining = data.waterGoal - data.waterGlasses;
  if (waterRemaining > 0) {
    items.push({
      label: `Faltam ${waterRemaining} copo${waterRemaining > 1 ? "s" : ""} de água`,
      done: false,
      emoji: "💧",
      priority: 4,
      route: "/saude",
    });
  } else {
    items.push({
      label: "Meta de água atingida!",
      done: true,
      emoji: "💧",
      priority: 12,
      route: "/saude",
    });
  }

  // Meals
  const remaining = data.mealsTotal - data.mealsLogged;
  if (remaining > 0) {
    items.push({
      label: `${remaining} ${remaining > 1 ? "refeições" : "refeição"} para registrar`,
      done: false,
      emoji: "🍽️",
      priority: 3,
      route: "/dieta",
    });
  } else if (data.mealsTotal > 0) {
    items.push({
      label: "Todas as refeições registradas",
      done: true,
      emoji: "🍽️",
      priority: 13,
      route: "/dieta",
    });
  } else {
    items.push({
      label: "Registrar refeições do dia",
      done: false,
      emoji: "🍽️",
      priority: 3,
      route: "/dieta",
    });
  }

  // Supplements
  if (data.supplementsTotal > 0) {
    const supRemaining = data.supplementsTotal - data.supplementsTaken;
    if (supRemaining > 0) {
      items.push({
        label: `${supRemaining} suplemento${supRemaining > 1 ? "s" : ""} pendente${supRemaining > 1 ? "s" : ""}`,
        done: false,
        emoji: "💊",
        priority: 5,
        route: "/saude",
      });
    } else {
      items.push({
        label: "Suplementos tomados",
        done: true,
        emoji: "💊",
        priority: 14,
      });
    }
  }

  // Reading
  if (data.currentBook) {
    if (data.readingProgress < 100) {
      items.push({
        label: data.leuHoje
          ? `Leitura de hoje feita · "${data.currentBook}" (${data.readingProgress}%)`
          : `Continuar "${data.currentBook}" (${data.readingProgress}%)`,
        done: !!data.leuHoje,
        emoji: "📖",
        priority: data.leuHoje ? 12 : 6,
        route: "/biblioteca",
      });
    }
  }

  /* CONTA A VENCER NÃO É PENDÊNCIA DO DIA (13/09). Ela entrava na lista e no
     "N pendentes" — e não entra no score: quem fechava os 12 registros via
     100 pontos com "1 pendente" na cara, pra sempre, porque sempre há uma
     conta a vencer em algum dia do mês. Agora é um AVISO à parte, fora da
     contagem, e só aparece quando vence em até 3 dias (é quando importa).
     Pagou (checkbox em Finanças) → some. Lista vazia ⇔ score 100 volta a
     ser verdade. */
  const avisoConta = data.nextBillName && data.nextBillDaysUntil != null && data.nextBillDaysUntil <= 3
    ? { nome: data.nextBillName, dias: data.nextBillDaysUntil }
    : null;

  /*
   * REGISTROS DO DIA QUE O SCORE COBRA (10/09). Cliente pagante zerou esta
   * lista e o Score do Dia ficou em 95: os seis blocos de 5 pontos que são
   * registro diário (humor, gasto, peso, sono, gratidão, ideia) não apareciam
   * aqui — ela não tinha como saber o que faltava. Cada um vira uma linha
   * enquanto não foi feito e a versão riscada depois, igual às de cima. As
   * flags vêm do hook (`registrosHoje`), as MESMAS que somam os pontos — não
   * recalcula nada, então lista vazia ⇔ score 100 (src/test/pendencias-score).
   * Ordem = a da fileira de Ações rápidas (todas pesam 5, o peso não
   * desempata; assim o olho casa a linha com o botão que ela abre). Suplemento
   * e leitura NÃO entram: sem cadastro o score já dá o bloco como cumprido.
   * O toque abre o formulário da ação rápida em vez de navegar — gasto
   * inclusive ("Registrar Gasto", que é o que o score conta).
   */
  const reg = data.registrosHoje;
  if (reg) {
    const registros: { feito: boolean; pendente: string; concluido: string; emoji: string; action: ActionId }[] = [
      { feito: reg.humor, pendente: "Check de humor", concluido: "Humor registrado", emoji: "🙂", action: "mood" },
      { feito: reg.gasto, pendente: "Registrar um gasto", concluido: "Gasto registrado", emoji: "💸", action: "expense" },
      { feito: reg.peso, pendente: "Pesar hoje", concluido: "Peso registrado", emoji: "⚖️", action: "weight" },
      { feito: reg.sono, pendente: "Registrar sono", concluido: "Sono registrado", emoji: "🌙", action: "sleep" },
      { feito: reg.ideia, pendente: "Anotar uma ideia", concluido: "Ideia anotada", emoji: "💡", action: "idea" },
      { feito: reg.gratidao, pendente: "Anotar uma gratidão", concluido: "Gratidão anotada", emoji: "🙏", action: "gratitude" },
    ];
    registros.forEach((r, i) => {
      items.push({
        label: r.feito ? r.concluido : r.pendente,
        done: r.feito,
        emoji: r.emoji,
        // depois de todas as linhas que já existiam (pendentes 1–7, feitas 10–14)
        priority: (r.feito ? 30 : 20) + i,
        action: r.action,
      });
    });
  }

  // Sort by priority
  items.sort((a, b) => a.priority - b.priority);

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-2.5"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Pendências de hoje
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {pending.length} pendente{pending.length > 1 ? "s" : ""}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5">
              {pending.map((item, i) => (
                <motion.button
                  key={`p-${i}`}
                  onClick={() => item.action ? abrirAcaoRapida(item.action) : item.route && navigate(item.route)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all text-left group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-xs font-medium flex-1">{item.label}</span>
                  {(item.route || item.action) && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </motion.button>
              ))}

              {avisoTreino && (
                <button
                  type="button"
                  onClick={() => navigate("/treino")}
                  data-testid="aviso-treino"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-border bg-muted/30 text-left"
                >
                  <span className="text-sm">🏋️</span>
                  <span className="text-[11px] font-medium flex-1">Configurar treino da semana</span>
                  <span className="text-[10px] text-muted-foreground">dica</span>
                </button>
              )}
              {avisoConta && (
                <button
                  type="button"
                  onClick={() => navigate("/financas")}
                  data-testid="aviso-conta"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-amber-300/70 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 text-left"
                >
                  <span className="text-sm">📅</span>
                  <span className="text-[11px] font-medium flex-1">
                    {avisoConta.dias === 0 ? "Vence hoje" : avisoConta.dias === 1 ? "Vence amanhã" : `Vence em ${avisoConta.dias} dias`}: {avisoConta.nome}
                  </span>
                  <span className="text-[10px] text-muted-foreground">aviso</span>
                </button>
              )}

              {done.length > 0 && (
                <div className="pt-1">
                  {done.map((item, i) => (
                    <motion.div
                      key={`d-${i}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl opacity-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      transition={{ delay: 0.03 * (pending.length + i) }}
                    >
                      <span className="text-sm">{item.emoji}</span>
                      <span className="text-[11px] line-through text-muted-foreground flex-1">{item.label}</span>
                      <span className="text-[10px] text-emerald-600 font-medium">✓</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
