import { AVISOS, TETO_AVISOS, fraseDoAviso, instanteDe } from "@/lib/compromissos";

/**
 * TAREFA COM HORÁRIO E DETALHES (28/09) — três chamados na mesma semana:
 *   "fazer o app notificar na hora que deve tomar o remédio, beber água, coisas
 *    da rotina… avisar sobre as tarefas que precisam ser lembradas naquele
 *    horário específico" (22/09)
 *   "busco hábitos e tarefas com lembretes e notificações, não tem isso aqui?" (26/09)
 *   "tenho muitas demandas no meu dia… tem alguma ferramenta que eu possa pôr
 *    alarme e também descrever mais coisas a não ser somente tópicos? Ali em
 *    tarefas de hoje." (28/09)
 *
 * A tarefa do dia (Rotina › tarefas de hoje, Carreira › Meu dia — as duas
 * listas do BlocoDeFases, que o widget da Home junta) ganha três campos
 * OPCIONAIS: `hora`, `aviso` e `detalhes`. Tarefa antiga, sem nenhum deles,
 * continua exatamente como era. Nada de migração: as listas são JSON em
 * user_data e os campos novos só existem em quem os preencher.
 *
 * O aviso é o MESMO sistema dos compromissos (lib/compromissos): a mesma lista
 * de antecedências (menos "1 dia antes" — a tarefa é do dia), o mesmo instante
 * local montado por partes, o mesmo teto do iOS, a mesma série limpa-e-refeita
 * na faixa do tipo (notificacoes → agendarTarefas). Marcar como feita muda o
 * dado, o useLembretes reagenda sem ela e o aviso pendente some do sistema.
 *
 * Tudo aqui é PURO (recebe `agora`/`hoje`) pra ser testável sem plugin.
 */

export type TarefaDoDia = {
  id: string;
  texto: string;
  feito: boolean;
  /** "YYYY-MM-DD" */
  dia: string;
  /** "HH:MM" — opcional; sem hora, a tarefa é a de sempre (sem aviso). */
  hora?: string;
  /** Minutos antes da hora pra avisar; -1 = sem aviso; ausente (com hora) = na hora. */
  aviso?: number;
  /** Texto livre, várias linhas: passo a passo, telefone, o que levar. */
  detalhes?: string;
};

/** As duas listas de "tarefas de hoje" (BlocoDeFases): Rotina e Carreira. */
export const CHAVE_TAREFAS_ROTINA = "rotina-day-tasks";
export const CHAVE_TAREFAS_CARREIRA = "career-day-tasks";

/** Pra onde o toque no aviso leva: o módulo onde a lista mora. */
export const ROTA_DAS_TAREFAS: Record<string, string> = {
  [CHAVE_TAREFAS_ROTINA]: "/rotina",
  [CHAVE_TAREFAS_CARREIRA]: "/carreira",
};

/** Quem põe horário numa tarefa quer ser lembrado NAQUELE horário: o padrão é "Na hora". */
export const AVISO_PADRAO_TAREFA = 0;

/** As antecedências dos compromissos, sem "1 dia antes" — a tarefa é de hoje. */
export const AVISOS_TAREFA = AVISOS.filter((a) => a.valor < 1440);

const RE_HORA = /^(\d{1,2}):(\d{2})$/;

/** "9:05" → "09:05"; hora impossível ou lixo → null. */
export const normalizarHora = (h: unknown): string | null => {
  if (typeof h !== "string") return null;
  const m = RE_HORA.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${m[2]}`;
};

type Parcial = Partial<TarefaDoDia> | null | undefined;

export const horaDaTarefa = (t: Parcial): string | null => normalizarHora(t?.hora);

/** Antecedência valendo, em minutos — -1 quando não tem hora ou a pessoa pediu sem aviso. */
export const avisoDaTarefa = (t: Parcial): number => {
  if (!horaDaTarefa(t)) return -1;
  const a = t?.aviso;
  if (typeof a !== "number" || !Number.isInteger(a)) return AVISO_PADRAO_TAREFA;
  return a < 0 ? -1 : a;
};

export const detalhesDaTarefa = (t: Parcial): string => (typeof t?.detalhes === "string" ? t.detalhes.trim() : "");

const ehDia = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Só o que dá pra mostrar: id, texto e dia legíveis. Dado torto fica de fora, nunca derruba. */
export const tarefasValidas = (lista: unknown): TarefaDoDia[] =>
  (Array.isArray(lista) ? lista : []).filter((t): t is TarefaDoDia => {
    if (!t || typeof t !== "object") return false;
    const x = t as Partial<TarefaDoDia> & { id?: unknown };
    return (typeof x.id === "string" || typeof x.id === "number") && typeof x.texto === "string" && x.texto.trim() !== "" && ehDia(x.dia);
  });

/** Ordem de planner: primeiro as com hora (pela hora), depois as sem hora, na ordem em que foram criadas. */
export const ordenarPorHora = <T extends { hora?: string }>(lista: T[]): T[] => {
  const comHora = lista.filter((t) => normalizarHora(t.hora));
  const semHora = lista.filter((t) => !normalizarHora(t.hora));
  comHora.sort((a, b) => (normalizarHora(a.hora) as string).localeCompare(normalizarHora(b.hora) as string));
  return [...comHora, ...semHora];
};

/** Detalhes em uma linha (lista e notificação): as linhas viram " · ", corta com reticências (sem "sexta.…"). */
export const resumoDosDetalhes = (detalhes: string, max = 90): string => {
  const uma = detalhes.split(/\n+/).map((l) => l.trim()).filter(Boolean).join(" · ");
  return uma.length > max ? `${uma.slice(0, max - 1).replace(/[\s·.,;:!?-]+$/, "")}…` : uma;
};

/** "14:30" — a hora em que o aviso toca (hora da tarefa menos a antecedência), no mesmo dia. */
export const horaDoAviso = (hora: string, minutos: number): string => {
  const h = normalizarHora(hora);
  if (!h || minutos < 0) return "";
  const [hh, mm] = h.split(":").map(Number);
  const total = Math.max(0, hh * 60 + mm - minutos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** O que a lista e a ficha dizem do aviso: "Avisa às 14:30 (30 min antes)", "Avisa às 15:00, na hora". */
export const textoDoAviso = (hora: string, minutos: number): string => {
  if (minutos < 0) return "Sem aviso";
  const quando = horaDoAviso(hora, minutos);
  if (minutos === 0) return `Avisa às ${quando}, na hora`;
  const antes = AVISOS.find((a) => a.valor === minutos)?.rotulo ?? `${minutos} min antes`;
  return `Avisa às ${quando} (${antes})`;
};

/**
 * A hora (ou o aviso) já passou HOJE? O formulário avisa na hora de salvar —
 * "a tarefa fica anotada, sem aviso" — em vez de prometer um aviso que o
 * sistema nunca vai tocar (o planejamento pula instante no passado).
 */
export const avisoJaPassou = (dia: string, hora: string, minutos: number, agora = new Date()): boolean => {
  const h = normalizarHora(hora);
  if (!h || minutos < 0 || !ehDia(dia)) return false;
  return instanteDe(dia, h).getTime() - minutos * 60_000 <= agora.getTime();
};

/* ------------------------------------------------------------- avisos */

/** Só o que o aviso precisa. É também o que entra na assinatura do useLembretes. */
export type TarefaAgendavel = { id: string; texto: string; dia: string; hora: string; aviso: number; detalhes: string; rota: string };

/**
 * As tarefas que podem virar aviso: pendentes, de hoje em diante, com hora e
 * antecedência. As listas crescem pra sempre (o BlocoDeFases guarda os dias
 * velhos pro fechamento do mês), então o filtro por dia vem antes de tudo.
 */
export function tarefasAgendaveis(fontes: { chave: string; lista: unknown }[], hoje: string): TarefaAgendavel[] {
  const out: TarefaAgendavel[] = [];
  for (const { chave, lista } of fontes) {
    for (const t of tarefasValidas(lista)) {
      if (t.feito || t.dia < hoje) continue;
      const aviso = avisoDaTarefa(t);
      if (aviso < 0) continue;
      out.push({
        id: String(t.id),
        texto: t.texto.trim(),
        dia: t.dia,
        hora: horaDaTarefa(t) as string,
        aviso,
        detalhes: detalhesDaTarefa(t),
        rota: ROTA_DAS_TAREFAS[chave] ?? "/home",
      });
    }
  }
  return out;
}

export type AvisoDeTarefa = { quando: Date; title: string; body: string; largeBody?: string; rota: string; id: number };

/**
 * Os avisos a agendar, já com id na faixa do tipo (`base + i`): um por tarefa,
 * na antecedência escolhida, só os que ainda estão no futuro. A série é limpa
 * e refeita a cada mudança (igual aos compromissos), então o id não precisa
 * ser estável — precisa ser único. Título = a tarefa; corpo = o começo dos
 * detalhes (a pessoa escreveu justamente pra ler na hora); sem detalhes, o
 * "quando" com as palavras do compromisso ("Agora, às 15:00").
 */
export function planejarTarefas(lista: TarefaAgendavel[], base: number, agora = new Date()): AvisoDeTarefa[] {
  const ordenadas = lista
    .map((t) => ({ t, inicio: instanteDe(t.dia, t.hora) }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.t.texto.localeCompare(b.t.texto));
  const avisos: AvisoDeTarefa[] = [];
  for (const { t, inicio } of ordenadas) {
    const quando = new Date(inicio.getTime() - t.aviso * 60_000);
    if (quando.getTime() <= agora.getTime()) continue;
    const antes = t.aviso > 0 ? `Às ${t.hora} · ` : "";
    avisos.push({
      quando,
      title: `⏰ ${t.texto}`,
      body: t.detalhes ? `${antes}${resumoDosDetalhes(t.detalhes)}` : fraseDoAviso(t.hora, t.aviso),
      // Android mostra o texto inteiro ao expandir a notificação (estilo "big text")
      ...(t.detalhes ? { largeBody: `${t.aviso > 0 ? `Às ${t.hora}\n` : ""}${t.detalhes.slice(0, 600)}` } : {}),
      rota: t.rota,
      id: 0,
    });
    if (avisos.length >= TETO_AVISOS) break;
  }
  return avisos.map((a, i) => ({ ...a, id: base + i }));
}
