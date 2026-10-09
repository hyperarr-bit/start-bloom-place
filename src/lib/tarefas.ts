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
  /** "YYYY-MM-DD" — o dia em que ela nasceu, quando veio do "Ficou de ontem" (02/10). Só informa. */
  veioDe?: string;
  /**
   * 08/10 (chamado: "nas tarefas não tem a data que coloquei no sistema,
   * importante pra prazos"): quando foi criada, ISO. Tarefa antiga não tem —
   * `dataDeCriacao` cai em `veioDe ?? dia`.
   */
  criadaEm?: string;
  /** 08/10 ("elencar o que fazer primeiro"): "alta" = marcada como prioridade. Ausente = normal. */
  prioridade?: "alta";
  /** 08/10: checklist dentro da tarefa. Ausente/vazio = tarefa simples, como sempre. */
  subtarefas?: Subtarefa[];
  /**
   * 09/10 (chamado: "poderia ter um prazo pra terminar a tarefa, um campo com a
   * data limite"): "YYYY-MM-DD" até quando ela precisa ser feita. Tarefa com prazo
   * e pendente aparece TODO dia na lista de hoje até ser feita (sem a janela de 7
   * dias do "Ficou de ontem"), com o selo "vence sexta" / "vence hoje" / "atrasada".
   * Com horário, o aviso toca no DIA DO PRAZO (o mesmo aviso de tarefa, sem
   * permissão nova). `dia` continua sendo o dia em que ela nasceu.
   */
  prazo?: string;
  /** 09/10: "YYYY-MM-DD" em que foi marcada como feita — só pra a tarefa com prazo feita hoje ficar riscada no pé da lista até amanhã. */
  feitoEm?: string;
};

export type Subtarefa = { id: string; texto: string; feito: boolean };

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

/* ---------------------------------------------- 08/10: criação, prioridade, subtarefas, ordem */

/** Só as subtarefas legíveis (id e texto); dado torto fica de fora. */
export const subtarefasDaTarefa = (t: Parcial): Subtarefa[] =>
  (Array.isArray(t?.subtarefas) ? t!.subtarefas! : []).filter(
    (s): s is Subtarefa => !!s && typeof s === "object" && typeof s.id === "string" && typeof s.texto === "string" && s.texto.trim() !== "",
  ).map((s) => ({ id: s.id, texto: s.texto.trim(), feito: !!s.feito }));

export const progressoDasSubtarefas = (t: Parcial): { feitas: number; total: number } => {
  const subs = subtarefasDaTarefa(t);
  return { feitas: subs.filter((s) => s.feito).length, total: subs.length };
};

export const ehPrioridade = (t: Parcial): boolean => t?.prioridade === "alta";

/**
 * "YYYY-MM-DD" em que a tarefa foi criada. Tarefa de antes de 08/10 não tem
 * `criadaEm`: a melhor aproximação é o dia de onde ela veio (Ficou de ontem) ou
 * o próprio dia — uma tarefa criada hoje pra hoje foi criada hoje.
 */
export const dataDeCriacao = (t: Parcial): string => {
  const c = t?.criadaEm;
  if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}/.test(c)) return c.slice(0, 10);
  return (ehDia(t?.veioDe) ? t!.veioDe! : ehDia(t?.dia) ? t!.dia! : "");
};

/* ---------------------------------------------- 09/10: prazo (data limite) */

/** O prazo legível ("YYYY-MM-DD") ou null — dado torto ou ausente é "sem prazo". */
export const prazoDaTarefa = (t: Parcial): string | null => (ehDia(t?.prazo) ? (t!.prazo as string) : null);

/** O dia a que o aviso se refere: o prazo, quando tem; senão o dia da tarefa. */
export const diaDoAviso = (t: Parcial): string => prazoDaTarefa(t) ?? (ehDia(t?.dia) ? (t!.dia as string) : "");

const DIA_DA_SEMANA_MIUDO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dataLocal = (dia: string) => { const [a, m, d] = dia.split("-").map(Number); return new Date(a, m - 1, d); };
/** "07/10" */
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
/** Dias de diferença entre duas chaves "YYYY-MM-DD" (b − a), em dias de calendário. */
const diasEntreDias = (a: string, b: string) => Math.round((dataLocal(b).getTime() - dataLocal(a).getTime()) / 86_400_000);

export interface EstadoDoPrazo {
  prazo: string;
  /** o prazo já passou (e a tarefa segue pendente) */
  atrasada: boolean;
  /** vence hoje */
  hoje: boolean;
  /** negativo = dias de atraso */
  dias: number;
  /** o selo da linha: "atrasada", "vence hoje", "vence amanhã", "vence sexta", "vence 17/10" */
  rotulo: string;
  /** a frase da ficha: "Atrasada — venceu terça, 07/10", "Vence sexta, 10/10 (em 2 dias)" */
  texto: string;
}

/**
 * O que a linha e a ficha dizem do prazo. Tarefa FEITA não está atrasada (o
 * selo some: `null`). Sem prazo: `null`.
 */
export const estadoDoPrazo = (t: Parcial, hoje: string): EstadoDoPrazo | null => {
  const prazo = prazoDaTarefa(t);
  if (!prazo || !ehDia(hoje) || t?.feito) return null;
  const dias = diasEntreDias(hoje, prazo);
  const nomeDia = DIA_DA_SEMANA_MIUDO[dataLocal(prazo).getDay()];
  const quando = `${nomeDia}, ${ddmm(prazo)}`;
  if (dias < 0) {
    const n = -dias;
    return { prazo, atrasada: true, hoje: false, dias, rotulo: "atrasada", texto: `Atrasada — venceu ${quando} (${n === 1 ? "ontem" : `há ${n} dias`})` };
  }
  if (dias === 0) return { prazo, atrasada: false, hoje: true, dias, rotulo: "vence hoje", texto: "Vence hoje" };
  if (dias === 1) return { prazo, atrasada: false, hoje: false, dias, rotulo: "vence amanhã", texto: `Vence amanhã (${quando})` };
  if (dias < 7) return { prazo, atrasada: false, hoje: false, dias, rotulo: `vence ${nomeDia}`, texto: `Vence ${quando} (em ${dias} dias)` };
  return { prazo, atrasada: false, hoje: false, dias, rotulo: `vence ${ddmm(prazo)}`, texto: `Vence ${quando} (em ${dias} dias)` };
};

/**
 * A tarefa entra na lista de HOJE? A de hoje, sempre (feita ou não — a feita
 * fica riscada no pé). A de outro dia só se tem PRAZO e está pendente — ou foi
 * feita hoje (fica riscada até amanhã). A pendente sem prazo de um dia que
 * passou continua no "Ficou de ontem" (7 dias), como antes.
 */
export const apareceHoje = (t: Parcial, hoje: string): boolean => {
  if (!t || !ehDia(t.dia)) return false;
  if (t.dia === hoje) return true;
  if (!prazoDaTarefa(t) || t.dia > hoje) return false;
  return !t.feito || t.feitoEm === hoje;
};

/** Texto limpo e id novo pra cada linha digitada no formulário; linha vazia não vira subtarefa. */
export const montarSubtarefas = (linhas: Array<Partial<Subtarefa> | string>): Subtarefa[] =>
  linhas
    .map((l) => (typeof l === "string" ? { texto: l } : l))
    .filter((l) => typeof l.texto === "string" && l.texto.trim() !== "")
    .map((l) => ({ id: typeof l.id === "string" && l.id ? l.id : `s${Math.random().toString(36).slice(2, 9)}`, texto: (l.texto as string).trim(), feito: !!l.feito }));

/**
 * Sobe/desce uma tarefa SEM HORA entre as suas vizinhas de tela: as do mesmo
 * dia, sem hora e no mesmo estado (pendente/feita) — que é exatamente a ordem
 * que `ordenarPorHora` mostra (as sem hora saem na ordem da lista). Troca de
 * lugar com a vizinha na lista completa (que guarda todos os dias); quem tem
 * hora segue a hora e não se move. Fora dos limites: devolve a mesma lista.
 */
export const moverTarefaNoDia = (lista: TarefaDoDia[], id: string, direcao: -1 | 1): TarefaDoDia[] => {
  const de = lista.findIndex((t) => t.id === id);
  if (de < 0) return lista;
  const alvo = lista[de];
  if (normalizarHora(alvo.hora)) return lista;
  const vizinhas = lista
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.dia === alvo.dia && !normalizarHora(t.hora) && !!t.feito === !!alvo.feito);
  const pos = vizinhas.findIndex(({ i }) => i === de);
  const outra = vizinhas[pos + direcao];
  if (!outra) return lista;
  const nova = [...lista];
  nova[de] = outra.t;
  nova[outra.i] = alvo;
  return nova;
};

/** Posição (1-based) e total da tarefa entre as vizinhas que ela pode trocar de lugar — null quando tem hora. */
export const posicaoNoDia = (lista: TarefaDoDia[], id: string): { i: number; total: number } | null => {
  const alvo = lista.find((t) => t.id === id);
  if (!alvo || normalizarHora(alvo.hora)) return null;
  const vizinhas = lista.filter((t) => t.dia === alvo.dia && !normalizarHora(t.hora) && !!t.feito === !!alvo.feito);
  return { i: vizinhas.findIndex((t) => t.id === id) + 1, total: vizinhas.length };
};

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
      // 09/10: com prazo, o aviso é do DIA DO PRAZO (a tarefa nasceu antes e segue na lista até lá)
      const dia = diaDoAviso(t);
      if (t.feito || dia < hoje) continue;
      const aviso = avisoDaTarefa(t);
      if (aviso < 0) continue;
      out.push({
        id: String(t.id),
        texto: t.texto.trim(),
        dia,
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
