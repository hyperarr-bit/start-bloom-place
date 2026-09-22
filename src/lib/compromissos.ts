import { localDayKey } from "@/lib/utils";

/**
 * COMPROMISSOS COM HORA (22/09) — dois chamados no mesmo fim de semana:
 *   "não achei opção de agendar tarefas, por exemplo: quero marcar um médico
 *    dia 29/09 às 9hs e ser notificado com antecedência" (14/09)
 *   "quero que me lembre de algo na minha agenda tipo uma reunião… tenho
 *    jiu-jitsu seg, qua e sex, o aplicativo me lembra da aula?" (20/09)
 *
 * Até aqui a Rotina tinha tarefa com data (sem hora) e a grade da semana
 * (sem aviso); a Saúde tinha consulta com hora, mas sem lembrete. Faltava a
 * coisa mais simples de uma agenda: DATA + HORA + AVISO ANTES, com repetição
 * semanal pra aula/treino/reunião fixa.
 *
 * Mora em `rotina-compromissos` (uma lista, sincronizada como o resto). A
 * repetição é expandida na leitura (`ocorrencias`), nunca gravada — uma aula
 * de seg/qua/sex é UM registro, e apagar apaga a série inteira.
 *
 * O aviso vira notificação LOCAL (lib/notificacoes → agendarCompromissos), na
 * antecedência escolhida POR COMPROMISSO (30 min, 1 h, 1 dia…). Tudo aqui é
 * puro (recebe `agora`) pra ser testável sem plugin.
 */

export const CHAVE_COMPROMISSOS = "rotina-compromissos";

/** Índice 0 = segunda … 6 = domingo, como o resto do app. */
export const DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Antecedência do aviso, em minutos. -1 = sem aviso. */
export const AVISOS: { valor: number; rotulo: string }[] = [
  { valor: -1, rotulo: "Sem aviso" },
  { valor: 0, rotulo: "Na hora" },
  { valor: 15, rotulo: "15 min antes" },
  { valor: 30, rotulo: "30 min antes" },
  { valor: 60, rotulo: "1 hora antes" },
  { valor: 120, rotulo: "2 horas antes" },
  { valor: 1440, rotulo: "1 dia antes" },
];
export const AVISO_PADRAO = 60;

export interface Compromisso {
  id: string;
  titulo: string;
  /** "YYYY-MM-DD" — a primeira (ou única) ocorrência. */
  data: string;
  /** "HH:MM" */
  hora: string;
  /** Dias da semana (0=seg … 6=dom) em que repete TODA semana; vazio/ausente = uma vez só. */
  repete?: number[];
  /** Minutos antes do horário pra avisar; -1 = sem aviso; ausente = AVISO_PADRAO. */
  aviso?: number;
  local?: string;
}

export interface Ocorrencia {
  compromisso: Compromisso;
  quando: Date;
  /** "YYYY-MM-DD" da ocorrência */
  dia: string;
}

const ehDia = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehHora = (s: unknown): s is string => typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);

/** Só o que dá pra agendar: título, data e hora legíveis. Dado torto fica de fora, nunca derruba. */
export const compromissosValidos = (lista: unknown): Compromisso[] =>
  (Array.isArray(lista) ? lista : []).filter(
    (c): c is Compromisso => !!c && typeof c === "object" && typeof (c as Compromisso).titulo === "string"
      && (c as Compromisso).titulo.trim() !== "" && ehDia((c as Compromisso).data) && ehHora((c as Compromisso).hora),
  );

/** Instante local de "YYYY-MM-DD" + "HH:MM" — montado por partes, nunca `new Date(string)` (UTC no Brasil vira o dia anterior). */
export const instanteDe = (dia: string, hora: string): Date => {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, 0, 0);
};

/** 0 = segunda … 6 = domingo (JS conta domingo = 0). */
export const indiceSemana = (d: Date) => (d.getDay() + 6) % 7;

export const avisoDe = (c: Compromisso): number =>
  Number.isInteger(c.aviso) ? (c.aviso as number) : AVISO_PADRAO;

/**
 * Todas as ocorrências que caem em [de, de + dias), em ordem. Repetição
 * semanal começa na data cadastrada (a data do cadastro é a âncora: "a partir
 * de 29/09, toda segunda").
 */
export function ocorrencias(lista: Compromisso[], de: Date, dias: number): Ocorrencia[] {
  const inicio = new Date(de.getFullYear(), de.getMonth(), de.getDate(), 0, 0, 0, 0);
  const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + dias, 0, 0, 0, 0);
  const out: Ocorrencia[] = [];
  for (const c of compromissosValidos(lista)) {
    const primeira = instanteDe(c.data, c.hora);
    const repete = Array.isArray(c.repete) ? c.repete.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [];
    if (!repete.length) {
      if (primeira.getTime() >= inicio.getTime() && primeira.getTime() < fim.getTime()) {
        out.push({ compromisso: c, quando: primeira, dia: c.data });
      }
      continue;
    }
    const [h, mi] = c.hora.split(":").map(Number);
    const desde = primeira.getTime() > inicio.getTime()
      ? new Date(primeira.getFullYear(), primeira.getMonth(), primeira.getDate())
      : inicio;
    for (let d = new Date(desde); d.getTime() < fim.getTime(); d.setDate(d.getDate() + 1)) {
      if (!repete.includes(indiceSemana(d))) continue;
      const quando = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi, 0, 0);
      out.push({ compromisso: c, quando, dia: localDayKey(d) });
    }
  }
  return out.sort((a, b) => a.quando.getTime() - b.quando.getTime() || a.compromisso.titulo.localeCompare(b.compromisso.titulo));
}

/** Ocorrências de HOJE que ainda não passaram (com 30 min de tolerância — a reunião das 15h ainda interessa às 15h10). */
export function proximosDeHoje(lista: Compromisso[], agora = new Date()): Ocorrencia[] {
  const limite = agora.getTime() - 30 * 60_000;
  return ocorrencias(lista, agora, 1).filter((o) => o.quando.getTime() >= limite);
}

/** Descrição curta da repetição pra tela: "toda semana · seg, qua, sex". */
export const rotuloRepeticao = (c: Compromisso): string => {
  const r = Array.isArray(c.repete) ? c.repete.filter((n) => n >= 0 && n <= 6).sort((a, b) => a - b) : [];
  if (!r.length) return "";
  if (r.length === 7) return "todo dia";
  if (r.length === 5 && r.every((n) => n <= 4)) return "seg a sex";
  return r.map((n) => DIAS_CURTOS[n]).join(", ");
};

export const rotuloAviso = (minutos: number): string =>
  AVISOS.find((a) => a.valor === minutos)?.rotulo ?? `${minutos} min antes`;

/** O que a notificação diz sobre "quando" — congelado no agendamento, então só verdades que não mudam. */
const corpoDoAviso = (c: Compromisso, minutos: number): string => {
  const onde = c.local?.trim() ? ` · ${c.local.trim()}` : "";
  if (minutos <= 0) return `Agora, às ${c.hora}${onde}`;
  if (minutos < 60) return `Em ${minutos} min, às ${c.hora}${onde}`;
  if (minutos < 1440) return `Em ${minutos === 60 ? "1 hora" : `${Math.round(minutos / 60)} horas`}, às ${c.hora}${onde}`;
  return `Amanhã às ${c.hora}${onde}`;
};

export type AvisoPlanejado = { quando: Date; title: string; body: string; id: number };

/** Teto de avisos pendentes deste tipo: o iOS descarta tudo acima de 64 pendentes no app inteiro. */
export const TETO_AVISOS = 24;

/**
 * Os avisos a agendar, já com id na faixa do tipo (`base + i`): um por
 * ocorrência, nos próximos 60 dias, só os que ainda estão no futuro. Sem
 * aviso (-1) não entra. A série é limpa e refeita a cada mudança, então o id
 * não precisa ser estável — precisa ser único.
 */
export function planejarCompromissos(lista: Compromisso[], base: number, agora = new Date()): AvisoPlanejado[] {
  const avisos: AvisoPlanejado[] = [];
  for (const o of ocorrencias(lista, agora, 60)) {
    const minutos = avisoDe(o.compromisso);
    if (minutos < 0) continue;
    const quando = new Date(o.quando.getTime() - minutos * 60_000);
    if (quando.getTime() <= agora.getTime()) continue;
    avisos.push({
      quando,
      title: `📅 ${o.compromisso.titulo.trim()}`,
      body: corpoDoAviso(o.compromisso, minutos),
      id: 0,
    });
    if (avisos.length >= TETO_AVISOS) break;
  }
  return avisos.map((a, i) => ({ ...a, id: base + i }));
}
