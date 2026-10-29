import { toast } from "sonner";
import { localDayKey } from "@/lib/utils";
import { CHAVE_ACOES_CONQUISTAS, registrarAcao } from "@/lib/conquistas-acoes";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { CHAVE_MACROS, type MacrosPlano, entradaDoPlano, idDoPlano } from "@/lib/dieta-macros";
import { etiquetar, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { lancarGasto } from "@/lib/finance-lancar";
import { numeroBR } from "@/lib/data-normalizers";
import { marcarCheckin } from "@/lib/detox";
import { anotarAcaoRapida } from "@/lib/intro-modulo";
import { gravarHumorNasTres } from "@/lib/humor-do-dia";
import { avisoDaTarefa, avisoJaPassou, diaDoAviso, horaDaTarefa, horaDoAviso, rotuloDoDia } from "@/lib/tarefas";

/**
 * AS GRAVAÇÕES DAS AÇÕES RÁPIDAS (26/10) — o que o QuickActions.tsx da Home de hoje fazia dentro de cada
 * formulário, agora como funções puras de (leitura, gravação): as MESMAS chaves, validações, avisos (toasts),
 * "Desfazer"/"Ver …" e o `anotarAcaoRapida` do tutorial — um lugar só, usado pelos dois lados:
 *   · o QuickActions da Home de hoje (a fileira + os formulários inline), byte a byte no comportamento;
 *   · os formulários NOVOS do "+" da Home nova (home-nova/e/FolhaAcaoE), que só trocam a interface.
 * `aoGravar` é chamado logo depois de gravar e antes do toast — é onde o QuickActions marca o ✓ e a conquista.
 */
export type Leitura = <T>(chave: string, padrao: T) => T;
export type Gravacao = (chave: string, valor: unknown, opcoes?: { system?: boolean }) => void;
export interface ContextoAcao {
  get: Leitura;
  set: Gravacao;
  navigate: (rota: string) => void;
  /** a meta de copos do dia (use-life-hub-data.waterGoal) — só pro aviso da água */
  waterGoal?: number;
}

export const hojeStr = (): string => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)
export const vibrar = (): void => { try { if (navigator.vibrate) navigator.vibrate(30); } catch { /* noop */ } };

/** A conquista "ação rápida" do dia (o que o ✓ do QuickActions grava). */
export const marcarAcaoRapidaFeita = (get: Leitura, set: Gravacao): void => {
  set(CHAVE_ACOES_CONQUISTAS, registrarAcao(get(CHAVE_ACOES_CONQUISTAS, {} as Record<string, unknown>), "acao-rapida", hojeStr()), { system: true });
};

export const CATEGORIAS_DE_GASTO = ["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Outros"] as const;
/** Receita não tem categoria, tem DESCRIÇÃO (é o que a tabela RECEITAS mostra). */
export const TIPOS_DE_GANHO = ["Recebimento", "Salário", "Freela", "Venda", "Extra"] as const;
export const HUMORES = [
  { emoji: "😡", label: "Péssimo", value: 1 },
  { emoji: "😔", label: "Ruim", value: 2 },
  { emoji: "😐", label: "Neutro", value: 3 },
  { emoji: "🙂", label: "Bom", value: 4 },
  { emoji: "🤩", label: "Ótimo", value: 5 },
] as const;
export const EMOJI_DA_REFEICAO: Record<string, string> = { "Café da Manhã": "🌅", "Almoço": "🍽️", "Lanche": "🍎", "Janta": "🌙", "Pré-Treino": "⚡", "Pós-Treino": "💪", "Ceia": "🌙", "Café da Tarde": "☕" };

/** ÁGUA: +1 copo nas DUAS chaves (16/08: as duas partem do mesmo `current`, senão desincronizam e o contador pula). */
export function gravarAgua(ctx: ContextoAcao, aoGravar?: () => void): { proximo: number; copoMl: number; faltam: number } {
  const { get, set } = ctx;
  const tStr = hojeStr();
  const waterLog = get<Record<string, number>>("core-saude-water", {});
  const waterLogModulo = get<Record<string, number>>("water-log", {});
  const current = Math.max(waterLog[tStr] || 0, Number(waterLogModulo[tStr]) || 0);
  const proximo = Math.min(20, current + 1);
  anotarAcaoRapida("water", get, set); // 1.0.17: o tutorial da Saúde ainda aparece na 1ª abertura
  set("core-saude-water", { ...waterLog, [tStr]: proximo });
  set("water-log", { ...waterLogModulo, [tStr]: proximo });
  const copoMl = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  vibrar();
  aoGravar?.();
  const faltam = (ctx.waterGoal ?? 8) - proximo;
  // 1.0.22 (28/10): 102 de 475 pagantes que registram água pelo "+" nunca abriram a Saúde — o aviso leva lá
  toast.success(`💧 ${proximo * copoMl}ml — ${faltam > 0 ? `faltam ${faltam} copos` : "meta batida! 🎉"}`, { action: { label: "Ver Saúde", onClick: () => ctx.navigate("/saude") } });
  return { proximo, copoMl, faltam };
}

/** TREINO: marca o dia (sem duplicar); escreve SEMPRE (o set re-dispara core:activation — review 16/08); Desfazer tira o dia (07/10). */
export function gravarTreino(ctx: ContextoAcao, aoGravar?: () => void): { jaTinha: boolean } {
  const { get, set, navigate } = ctx;
  const tStr = hojeStr();
  const log = get<string[]>("saude-workout-log", []);
  const jaTinha = log.includes(tStr);
  anotarAcaoRapida("workout", get, set);
  set("saude-workout-log", jaTinha ? [...log] : [...log, tStr]);
  vibrar();
  aoGravar?.();
  toast.success("💪 Treino do dia registrado!", {
    duration: 6000,
    action: jaTinha
      ? { label: "Ver Treino", onClick: () => navigate("/treino") }
      : { label: "Desfazer", onClick: () => set("saude-workout-log", get<string[]>("saude-workout-log", []).filter((d) => d !== tStr)) },
    cancel: jaTinha ? undefined : { label: "Ver Treino", onClick: () => navigate("/treino") },
  });
  return { jaTinha };
}

const CATEGORIA_DO_GASTO: Record<string, string> = { "Alimentação": "alimentacao", "Transporte": "transporte", "Lazer": "lazer", "Saúde": "saude", "Educação": "educacao", "Compras": "outros", "Outros": "outros" };

/** GASTO: numeroBR (26/09: "1.250,50" virava 1,25) + o mesmo caminho do "Lançar em Finanças" (lib/finance-lancar). */
export function gravarGasto(ctx: ContextoAcao, { valorTexto, categoria }: { valorTexto: string; categoria: string }, aoGravar?: () => void): boolean {
  const { get, set } = ctx;
  const amount = numeroBR(valorTexto);
  if (!Number.isFinite(amount) || amount <= 0) { toast.error("Informe um valor válido"); return false; }
  anotarAcaoRapida("expense", get, set);
  if (!lancarGasto(get, set, { descricao: categoria, valor: amount, categoria: CATEGORIA_DO_GASTO[categoria] || "outros", data: hojeStr() })) {
    toast.error("Não deu pra lançar daqui. Abre Finanças e lança por lá.");
    return false;
  }
  vibrar();
  aoGravar?.();
  toast.success(`💸 ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em ${categoria}`);
  return true;
}

/** GANHO (09/09): `finance-incomes`, no formato da tabela RECEITAS, etiquetado com o perfil ativo. */
export function gravarGanho(ctx: ContextoAcao, { valorTexto, tipo }: { valorTexto: string; tipo: string }, aoGravar?: () => void): boolean {
  const { get, set, navigate } = ctx;
  const amount = numeroBR(valorTexto);
  if (!Number.isFinite(amount) || amount <= 0) { toast.error("Informe um valor válido"); return false; }
  const incomes = get<unknown[]>("finance-incomes", []);
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  set("finance-incomes", [...incomes, etiquetar({ id: crypto.randomUUID(), description: tipo, value: amount, date: hojeStr() }, perfil)]);
  vibrar();
  aoGravar?.();
  toast.success(`💰 ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — ${tipo}`, { action: { label: "Ver Finanças", onClick: () => navigate("/financas") } });
  return true;
}

export function gravarPeso(ctx: ContextoAcao, { pesoTexto }: { pesoTexto: string }, aoGravar?: () => void): boolean {
  const { get, set } = ctx;
  const weight = parseFloat(pesoTexto.replace(",", "."));
  if (!weight || weight <= 0) { toast.error("Informe um peso válido"); return false; }
  const measures = get<Array<Record<string, unknown>>>("core-saude-measures", []);
  measures.push({ date: hojeStr(), weight, id: crypto.randomUUID() });
  set("core-saude-measures", measures);
  vibrar();
  aoGravar?.();
  toast.success(`⚖️ ${weight}kg registrado!`);
  return true;
}

export function gravarIdeia(ctx: ContextoAcao, { texto }: { texto: string }, aoGravar?: () => void): boolean {
  const { get, set, navigate } = ctx;
  if (!texto.trim()) { toast.error("Digite sua ideia"); return false; }
  const dateKey = hojeStr();
  const allDays = get<Record<string, Record<string, unknown>>>("hiperfoco-thoughts", {});
  const dayData = { ...(allDays[dateKey] || {}) } as Record<string, unknown>;
  const hour = new Date().getHours();
  const thoughts = [...((dayData[hour] as unknown[]) || [])];
  thoughts.push({ id: crypto.randomUUID(), text: texto.trim(), tags: ["ideia"], hour });
  dayData[hour] = thoughts;
  anotarAcaoRapida("idea", get, set);
  set("hiperfoco-thoughts", { ...allDays, [dateKey]: dayData });
  vibrar();
  aoGravar?.();
  toast.success("💡 Ideia capturada!", { action: { label: "Ver em Mente", onClick: () => navigate("/hiperfoco") } });
  return true;
}

export function gravarGratidao(ctx: ContextoAcao, { texto }: { texto: string }, aoGravar?: () => void): boolean {
  const { get, set } = ctx;
  if (!texto.trim()) { toast.error("Pelo que você é grato?"); return false; }
  const tStr = hojeStr();
  const gratLog = get<Record<string, string[]>>("core-gratitude-log", {});
  const todayEntries = [...(gratLog[tStr] || []), texto.trim()];
  set("core-gratitude-log", { ...gratLog, [tStr]: todayEntries });
  vibrar();
  aoGravar?.();
  toast.success("🙏 Gratidão registrada!");
  return true;
}

export function gravarHumor(ctx: ContextoAcao, { value, emoji }: { value: number; emoji: string }, aoGravar?: () => void): void {
  const { get, set, navigate } = ctx;
  const tStr = hojeStr();
  /* 1.0.22 (28/10): o humor do "+" gravava SÓ em `core-mood-log`, que módulo nenhum mostrava. Agora grava o mesmo
     valor nas 3 chaves do humor (cada uma no seu formato — lib/humor-do-dia): aparece no "Como você está hoje?" da
     Rotina (e no histórico) e no Dev. Pessoal › Humor, inclusive no app antigo, que lê só a sua chave. */
  gravarHumorNasTres(get, set, tStr, value, { emoji });
  vibrar();
  aoGravar?.();
  toast.success(`${emoji} Humor registrado!`, { action: { label: "Ver na Rotina", onClick: () => navigate("/rotina") } });
}

export function gravarSono(ctx: ContextoAcao, { horasTexto }: { horasTexto: string }, aoGravar?: () => void): boolean {
  const { get, set, navigate } = ctx;
  const hours = parseFloat(horasTexto.replace(",", "."));
  if (!hours || hours <= 0 || hours > 24) { toast.error("Informe horas válidas (1-24)"); return false; }
  const tStr = hojeStr();
  const sleepLog = get<Record<string, number>>("core-saude-sleep", {});
  anotarAcaoRapida("sleep", get, set);
  set("core-saude-sleep", { ...sleepLog, [tStr]: hours });
  vibrar();
  aoGravar?.();
  toast.success(`🌙 ${hours}h de sono registradas!`, { action: { label: "Ver Saúde", onClick: () => navigate("/saude") } });
  return true;
}

/** As refeições PLANEJADAS de hoje no cardápio (saude-meals), com as kcal e os macros anotados lá. */
export function refeicoesDeHoje(get: Leitura): { tipo: string; comida: string; kcal: number; macros?: MacrosPlano[string][string] }[] {
  const weekDayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const todayDay = weekDayNames[new Date().getDay()];
  const mealPlan = get<Record<string, Record<string, string>>>("saude-meals", {});
  const todayPlan = mealPlan[todayDay.toUpperCase()] || mealPlan[todayDay] || {};
  const kcalPlan = get<Record<string, Record<string, number>>>("saude-meals-kcal", {});
  const kcalHoje = kcalPlan[todayDay.toUpperCase()] || kcalPlan[todayDay] || {};
  const macrosPlan = get<MacrosPlano>(CHAVE_MACROS, {});
  const macrosHoje = macrosPlan[todayDay.toUpperCase()] || macrosPlan[todayDay] || {};
  return Object.entries(todayPlan)
    .filter(([, food]) => food && String(food).trim())
    .map(([tipo, comida]) => ({ tipo, comida: String(comida), kcal: Number(kcalHoje[tipo]) || 0, macros: macrosHoje[tipo] }));
}

/** REFEIÇÃO (18/09): id determinístico por refeição do plano — registrar aqui e marcar "segui" no diário escrevem a MESMA entrada. */
export function gravarRefeicao(ctx: ContextoAcao, { mealType, food, kcalTexto }: { mealType: string; food: string; kcalTexto: string }, aoGravar?: () => void): void {
  const { get, set, navigate } = ctx;
  const tStr = hojeStr();
  const dietLog = get<Record<string, Record<string, unknown>>>("core-dieta-log", {});
  const dayMeals = { ...(dietLog[tStr] || {}) };
  const calories = Math.max(0, Math.round(Number(String(kcalTexto).replace(",", ".")) || 0));
  const weekDayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const hojeNome = weekDayNames[new Date().getDay()];
  const macrosPlan = get<MacrosPlano>(CHAVE_MACROS, {});
  const macros = macrosPlan[hojeNome.toUpperCase()]?.[mealType] || macrosPlan[hojeNome]?.[mealType];
  dayMeals[idDoPlano(mealType)] = entradaDoPlano(mealType, food, calories, macros);
  set("core-dieta-log", { ...dietLog, [tStr]: dayMeals });
  vibrar();
  aoGravar?.();
  toast.success(calories > 0 ? `🍽️ ${mealType} registrado (${calories} kcal)!` : `🍽️ ${mealType} registrado!`, { action: { label: "Ver Dieta", onClick: () => navigate("/dieta") } });
}

/** TAREFA (28/09): grava nas tarefas de hoje da Rotina (o hook `useTarefasDoDia(CHAVE_TAREFAS_ROTINA)` é de quem monta a folha). */
export function gravarTarefa<C, T extends { dia: string }>(
  ctx: ContextoAcao,
  tarefas: { adicionar: (c: C) => T },
  c: C,
  aoGravar?: () => void,
): T {
  const t = tarefas.adicionar(c);
  const aviso = avisoDaTarefa(t as unknown as Parameters<typeof avisoDaTarefa>[0]);
  const hora = horaDaTarefa(t as unknown as Parameters<typeof horaDaTarefa>[0]);
  vibrar();
  aoGravar?.();
  // 28/10: tarefa pra outro dia — o toast diz pra quando (ela não aparece na lista de hoje)
  const hoje = localDayKey();
  const futura = t.dia > hoje;
  const diaAviso = diaDoAviso(t as unknown as Parameters<typeof diaDoAviso>[0]) || t.dia;
  toast.success(futura ? `Tarefa anotada pra ${rotuloDoDia(t.dia, hoje)}` : "Tarefa anotada", {
    description: hora && aviso >= 0 && !avisoJaPassou(diaAviso, hora, aviso)
      ? `🔔 O aviso toca às ${horaDoAviso(hora, aviso)}${diaAviso > hoje ? ` de ${rotuloDoDia(diaAviso, hoje)}` : ""}`
      : futura ? "Ela aparece na lista no dia dela." : undefined,
    action: { label: "Ver na Rotina", onClick: () => ctx.navigate("/rotina") },
  });
  return t;
}

/** DETOX (26/09, 28/09): lista de datas por hábito, pelo ID (ou posição em hábito antigo). */
export function gravarDetox(ctx: ContextoAcao, { chave, nome }: { chave: string; nome: string }, aoGravar?: () => void): void {
  const { get, set, navigate } = ctx;
  const habits = get<unknown[]>("detox-habits", []);
  anotarAcaoRapida("detox", get, set);
  set("detox-habits", marcarCheckin((Array.isArray(habits) ? habits : []) as Parameters<typeof marcarCheckin>[0], chave, hojeStr()));
  vibrar();
  aoGravar?.();
  toast.success(`🛡️ Check-in: ${nome}`, { action: { label: "Ver Detox", onClick: () => navigate("/detox") } });
}
