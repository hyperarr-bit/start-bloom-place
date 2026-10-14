/**
 * AVISO DA CONSULTA (13/10, chamado de cliente que está começando muitos
 * exames e consultas: "o app não me avisa da consulta"). Até aqui a consulta
 * só tinha o botão de mandar pro calendário do telefone — quem não tocava
 * nele não recebia nada.
 *
 * Dois avisos por consulta com data:
 *   - VÉSPERA, às 19h do dia anterior (dá tempo de separar exame, carteirinha,
 *     pedir folga — e não acorda ninguém);
 *   - 2 HORAS ANTES, só quando a consulta tem horário.
 * Consulta sem horário: só a véspera. Consulta que já passou: nada. Aviso cujo
 * momento já passou (marcou hoje às 20h a consulta de amanhã cedo) some
 * sozinho — nunca agenda no passado.
 *
 * Nasce LIGADO, como os remédios: marcar consulta com data já é pedir pra ser
 * lembrado. A permissão é pedida no cadastro (MedicalLog), não na abertura;
 * desliga na central (`CHAVE_AVISO_CONSULTAS`).
 *
 * Faixa de id própria: 1810000–1819999 (BASES.consulta em lib/notificacoes).
 * id = BASE + 2 × (posição da consulta, da mais próxima pra mais distante) +
 * 0 (véspera) ou 1 (2 h antes). A série inteira é limpa e refeita a cada
 * mudança (editar data, apagar consulta) → nada fica órfão no sistema.
 * Teto de 20 avisos: o iPhone descarta acima de 64 pendentes no app inteiro.
 *
 * PURA (recebe `agora`) pra ser testável sem plugin. O instante é montado por
 * partes, no fuso LOCAL — a mesma regra do `instanteDe` de lib/calendario:
 * `new Date("2026-08-14")` é UTC e no Brasil cai no dia anterior, e data
 * errada num lembrete médico é o pior erro que este app pode cometer.
 */
import { nomeComQuem } from "@/lib/saude-dependentes";

export const CHAVE_CONSULTAS = "core-saude-appointments";
/** Interruptor na central. Chave própria, nasce ligado (ausente = ligado). */
export const CHAVE_AVISO_CONSULTAS = "notif-consultas-ligado";

export const HORA_VESPERA = 19;
export const HORAS_ANTES = 2;
export const TETO_AVISOS_CONSULTA = 20;

export interface ConsultaAgendavel {
  id: string;
  doctor: string;
  specialty?: string;
  /** "2026-10-20" */
  date: string;
  /** "14:30" ou "" */
  time?: string;
  address?: string;
  quem?: string;
}

export interface AvisoConsulta { id: number; quando: Date; title: string; body: string; rota: string }

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^(\d{1,2}):(\d{2})$/;

/** "2026-10-20" + "14:30" → Date no fuso local; sem hora válida, `null` no horário. */
export function instanteLocal(data: string, hora?: string, horaPadrao?: number): Date | null {
  const d = RE_DIA.exec(data ?? "");
  if (!d) return null;
  const [ano, mes, dia] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const h = RE_HORA.exec(hora ?? "");
  if (!h && horaPadrao === undefined) return null;
  const hh = h ? Number(h[1]) : (horaPadrao as number);
  const mm = h ? Number(h[2]) : 0;
  if (hh > 23 || mm > 59) return null;
  const out = new Date(ano, mes - 1, dia, hh, mm, 0, 0);
  // 31/02 e afins: o Date transborda pro mês seguinte — dado torto não agenda
  return out.getMonth() === mes - 1 && out.getDate() === dia ? out : null;
}

/** Os dois momentos de aviso de UMA consulta (null = não tem / já passou). */
export function momentosDoAviso(c: Pick<ConsultaAgendavel, "date" | "time">, agora: Date = new Date()): { vespera: Date | null; antes: Date | null } {
  const inicioDoDia = instanteLocal(c.date, undefined, 0);
  if (!inicioDoDia) return { vespera: null, antes: null };
  const comHora = instanteLocal(c.date, c.time);
  // consulta sem horário "acontece" até o fim do dia; com horário, no horário
  const fim = comHora ?? new Date(inicioDoDia.getFullYear(), inicioDoDia.getMonth(), inicioDoDia.getDate(), 23, 59, 0, 0);
  if (fim.getTime() <= agora.getTime()) return { vespera: null, antes: null };
  // dia 0 do Date = último dia do mês anterior: a véspera do dia 1º cai certa
  const vespera = new Date(inicioDoDia.getFullYear(), inicioDoDia.getMonth(), inicioDoDia.getDate() - 1, HORA_VESPERA, 0, 0, 0);
  const antes = comHora ? new Date(comHora.getTime() - HORAS_ANTES * 3600_000) : null;
  return {
    vespera: vespera.getTime() > agora.getTime() ? vespera : null,
    antes: antes && antes.getTime() > agora.getTime() ? antes : null,
  };
}

/** A linha da tela ("🔔 Aviso 1 dia antes e 2 h antes"); null = nenhum aviso vai sair. */
export function rotuloDoAviso(c: Pick<ConsultaAgendavel, "date" | "time">, agora: Date = new Date()): string | null {
  const { vespera, antes } = momentosDoAviso(c, agora);
  if (vespera && antes) return "🔔 Aviso 1 dia antes e 2 h antes";
  if (vespera) return `🔔 Aviso 1 dia antes, às ${HORA_VESPERA}h`;
  if (antes) return "🔔 Aviso 2 h antes";
  return null;
}

/** Só o que tem médico (ou especialidade) e data no formato certo. Dado torto não derruba o reagendador. */
export function consultasValidas(bruto: unknown): ConsultaAgendavel[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .filter((c) => typeof c.date === "string" && RE_DIA.test(c.date) && (typeof c.doctor === "string" && c.doctor.trim() || typeof c.specialty === "string" && c.specialty.trim()))
    .map((c) => ({
      id: String(c.id ?? ""),
      doctor: String(c.doctor ?? "").trim(),
      specialty: typeof c.specialty === "string" ? c.specialty.trim() : "",
      date: String(c.date),
      time: typeof c.time === "string" ? c.time : "",
      address: typeof c.address === "string" ? c.address.trim() : "",
      quem: typeof c.quem === "string" ? c.quem.trim() : "",
    }));
}

const comQuem = (c: ConsultaAgendavel) => {
  const quem = c.doctor ? `com ${c.doctor}` : (c.specialty ? `de ${c.specialty}` : "");
  return nomeComQuem(`consulta ${quem}`.trim(), c.quem);
};

export function planejarAvisosConsulta(consultas: ConsultaAgendavel[], base: number, agora: Date = new Date()): AvisoConsulta[] {
  const futuras = consultas
    // 14/10 (revisor): data/hora impossível ("25:00", 31/02) dava null aqui e o .getTime() derrubava o reagendarTudo
    // inteiro (todos os lembretes depois da consulta deixavam de ser agendados) — agora a consulta inválida só fica de fora
    .map((c) => ({ c, m: momentosDoAviso(c, agora), inicio: instanteLocal(c.date, c.time, 0)?.getTime() ?? NaN }))
    .filter(({ m, inicio }) => Number.isFinite(inicio) && (m.vespera || m.antes))
    .sort((a, b) => a.inicio - b.inicio || a.c.id.localeCompare(b.c.id));

  const avisos: AvisoConsulta[] = [];
  futuras.forEach(({ c, m }, i) => {
    const hora = RE_HORA.test(c.time ?? "") ? c.time! : "";
    const detalhe = [c.doctor && c.specialty ? c.specialty : "", hora ? `às ${hora}` : "", c.address ?? ""].filter(Boolean).join(" · ");
    if (m.vespera) {
      avisos.push({
        id: base + i * 2,
        quando: m.vespera,
        title: `🩺 Amanhã: ${comQuem(c)}`,
        body: `${detalhe ? `${detalhe}. ` : ""}${hora ? "" : "Confira o horário. "}Suas perguntas para o médico estão no CORE, em Saúde.`,
        rota: "/saude?aba=log",
      });
    }
    if (m.antes) {
      const titulo = comQuem(c);
      avisos.push({
        id: base + i * 2 + 1,
        quando: m.antes,
        title: `🩺 Daqui a 2 h: ${titulo}`,
        body: `${[hora ? `Às ${hora}` : "", c.address ?? ""].filter(Boolean).join(" · ")}. Toque pra ver o endereço e as perguntas.`,
        rota: "/saude?aba=log",
      });
    }
  });
  return avisos.sort((a, b) => a.quando.getTime() - b.quando.getTime()).slice(0, TETO_AVISOS_CONSULTA);
}
