import { localDayKey, parseLocalDay } from "@/lib/utils";
import type { Compromisso } from "@/lib/compromissos";

/**
 * CUIDADOS COM DATA (28/09, Onda 1 da Beleza): unha, sobrancelha, cera, laser, raiz.
 *
 * Por quê: na Play BR, o Espaçolaser (#6 de Beleza) e o Booksy (#8) somam ~1 mi de
 * avaliações; depilação teve +33,7% de agendamentos no último ano. Mas cada rede
 * lembra só do próprio horário — nenhum app da CLIENTE junta salão, laser e casa com
 * intervalo, pacote e gasto. Nas avaliações de salão: lembrete configurável (19),
 * agenda do celular (7), histórico (5), intervalo/saldo do pacote (4).
 *
 * O CORE registra, lembra e soma o gasto — não agenda no salão:
 *  - a PRÓXIMA data sai do intervalo (editável) a partir da última vez;
 *  - FEITO recalcula e oferece, com 1 toque (nunca sozinho), lançar em Finanças · Beleza;
 *  - MARQUEI HORÁRIO vira compromisso da Rotina (origem "beleza"), com o aviso da casa;
 *  - sem horário, um aviso N dias antes, às 09:00 — DESLIGADO até a pessoa ligar.
 *
 * Chave NOVA `beleza-cuidados` (lista). Nenhuma chave existente muda. PURO.
 */

export const CHAVE_CUIDADOS = "beleza-cuidados";

export type TipoCuidado = "unha" | "unha-gel" | "sobrancelha" | "cera" | "laser" | "raiz" | "outro";

export interface Cuidado {
  id: string;
  tipo: TipoCuidado;
  nome: string;
  /** de quantos em quantos dias */
  intervaloDias: number;
  /** a última vez ("YYYY-MM-DD") */
  ultima?: string;
  /** horário marcado (MARQUEI HORÁRIO) — vira a próxima data e um compromisso da Rotina */
  horario?: { data: string; hora: string; compromissoId: string };
  /** onde / com quem (texto livre) */
  local?: string;
  /** o último preço (R$) — sugestão pro próximo lançamento */
  preco?: number;
  /** laser/depilação por pacote: "sessão 3 de 10" */
  pacote?: { total: number; feitas: number };
  /** aviso SEM horário marcado: N dias antes, às 09:00 (nasce desligado) */
  avisoLigado?: boolean;
  avisoDiasAntes: number;
  historico: { data: string; preco?: number; local?: string }[];
}

/**
 * Os modelos do "+ cuidado", com o intervalo padrão do DONO (28/09) — editável.
 * Laser vem com pacote de sessões.
 */
export const MODELOS: { tipo: Exclude<TipoCuidado, "outro">; nome: string; emoji: string; intervaloDias: number; pacote?: boolean }[] = [
  { tipo: "unha", nome: "Unha", emoji: "💅", intervaloDias: 7 },
  { tipo: "unha-gel", nome: "Unha em gel", emoji: "💖", intervaloDias: 21 },
  { tipo: "sobrancelha", nome: "Sobrancelha", emoji: "✏️", intervaloDias: 21 },
  { tipo: "cera", nome: "Depilação com cera", emoji: "🍯", intervaloDias: 28 },
  { tipo: "laser", nome: "Depilação a laser", emoji: "⚡", intervaloDias: 45, pacote: true },
  { tipo: "raiz", nome: "Retoque de raiz", emoji: "🎨", intervaloDias: 35 },
];

export const EMOJI_DO_TIPO: Record<TipoCuidado, string> = {
  unha: "💅", "unha-gel": "💖", sobrancelha: "✏️", cera: "🍯", laser: "⚡", raiz: "🎨", outro: "🌷",
};

export const AVISO_DIAS_PADRAO = 2;
export const HORA_DO_AVISO = 9;

/* ------------------------------------------------------------ datas */

const somarDias = (dia: string, n: number): string => {
  const d = parseLocalDay(dia);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
};
const diasEntre = (de: string, ate: string): number =>
  Math.round((parseLocalDay(ate).getTime() - parseLocalDay(de).getTime()) / 86_400_000);
const ehDia = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ------------------------------------------------------------ ler */

const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Só o que dá pra usar; dado torto fica de fora (nunca derruba, nunca regrava). */
export const cuidadosValidos = (v: unknown): Cuidado[] =>
  lista<Cuidado>(v).filter((c) => !!c && typeof c === "object" && typeof c.id === "string" && typeof c.nome === "string" && Number(c.intervaloDias) > 0)
    .map((c) => ({ ...c, historico: lista<Cuidado["historico"][number]>(c.historico), avisoDiasAntes: Number.isFinite(c.avisoDiasAntes) ? c.avisoDiasAntes : AVISO_DIAS_PADRAO }));

/** Um cuidado novo a partir de um modelo (ou "outro", com nome livre). */
export const novoCuidado = (tipo: TipoCuidado, id: string, nome?: string, intervaloDias?: number): Cuidado => {
  const m = MODELOS.find((x) => x.tipo === tipo);
  return {
    id,
    tipo,
    nome: (nome ?? m?.nome ?? "Cuidado").trim(),
    intervaloDias: Math.max(1, Math.round(intervaloDias ?? m?.intervaloDias ?? 30)),
    avisoLigado: false,
    avisoDiasAntes: AVISO_DIAS_PADRAO,
    historico: [],
    ...(m?.pacote ? { pacote: { total: 10, feitas: 0 } } : {}),
  };
};

/* ------------------------------------------------------------ a próxima data */

/** A próxima: o horário marcado, se tem; senão a última + o intervalo. Sem "última", não há próxima. */
export const proximaDoCuidado = (c: Cuidado): string | undefined =>
  (c.horario && ehDia(c.horario.data) ? c.horario.data : undefined) ?? (ehDia(c.ultima) ? somarDias(c.ultima, c.intervaloDias) : undefined);

/** Dias até a próxima (negativo = passou). */
export const faltaDoCuidado = (c: Cuidado, hoje: string): number | undefined => {
  const p = proximaDoCuidado(c);
  return p ? diasEntre(hoje, p) : undefined;
};

/** "hoje", "amanhã", "2 dias", "venceu ontem", "venceu há 3 dias" */
export const textoDaFalta = (n: number | undefined): string => {
  if (n === undefined) return "—";
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n > 1) return `${n} dias`;
  if (n === -1) return "venceu ontem";
  return `venceu há ${-n} dias`;
};

/** "sessão 3 de 10" — a sessão que vem (o pacote todo feito: "pacote completo"). */
export const textoDoPacote = (p: Cuidado["pacote"]): string => {
  if (!p || !(p.total > 0)) return "";
  return p.feitas >= p.total ? `pacote completo (${p.total})` : `sessão ${p.feitas + 1} de ${p.total}`;
};

/** A lista na ordem da tabela: o que vence primeiro no topo; sem data, no fim. */
export const ordenarCuidados = (l: Cuidado[], hoje: string): Cuidado[] =>
  [...l].sort((a, b) => {
    const fa = faltaDoCuidado(a, hoje);
    const fb = faltaDoCuidado(b, hoje);
    if (fa === undefined && fb === undefined) return a.nome.localeCompare(b.nome);
    if (fa === undefined) return 1;
    if (fb === undefined) return -1;
    return fa - fb || a.nome.localeCompare(b.nome);
  });

/* ------------------------------------------------------------ FEITO */

/**
 * Marca feito num dia: vira a "última" (se for a mais recente), entra no histórico,
 * conta uma sessão do pacote e, se o horário marcado era até esse dia, ele se cumpriu.
 */
export const marcarFeito = (c: Cuidado, dia: string, dados: { preco?: number; local?: string } = {}): Cuidado => {
  const preco = dados.preco && dados.preco > 0 ? Math.round(dados.preco * 100) / 100 : undefined;
  const local = dados.local?.trim() || c.local?.trim() || undefined;
  const historico = [...c.historico, { data: dia, ...(preco ? { preco } : {}), ...(local ? { local } : {}) }]
    .sort((a, b) => a.data.localeCompare(b.data));
  const ultima = !c.ultima || dia >= c.ultima ? dia : c.ultima;
  const cumpriuHorario = c.horario && c.horario.data <= dia;
  const { horario, ...resto } = c;
  return {
    ...resto,
    ...(cumpriuHorario ? {} : horario ? { horario } : {}),
    ultima,
    historico,
    ...(preco ? { preco } : {}),
    ...(local ? { local } : {}),
    ...(c.pacote ? { pacote: { ...c.pacote, feitas: Math.min(c.pacote.total, c.pacote.feitas + 1) } } : {}),
  };
};

/** Quanto foi gasto num mês ("YYYY-MM") com este cuidado — "R$ 180 com unha em setembro". */
export const gastoNoMes = (c: Cuidado, mes: string): { total: number; vezes: number } =>
  c.historico.filter((h) => h.data.startsWith(mes)).reduce((t, h) => ({ total: t.total + (h.preco ?? 0), vezes: t.vezes + 1 }), { total: 0, vezes: 0 });

/** O gasto só vai pro balde de Finanças do MÊS CORRENTE (o de `finance-expenses`). */
export const noMesCorrente = (dia: string, hoje: string = localDayKey()): boolean => dia.slice(0, 7) === hoje.slice(0, 7);

/* ------------------------------------------------------------ MARQUEI HORÁRIO */

/** O compromisso da Rotina que o horário marcado vira (origem "beleza", ref = o cuidado). */
export const compromissoDoCuidado = (c: Cuidado, data: string, hora: string, aviso: number, id: string): Compromisso => {
  const sessao = c.pacote ? textoDoPacote(c.pacote) : "";
  return {
    id,
    titulo: sessao ? `${c.nome} · ${sessao}` : c.nome,
    data,
    hora,
    aviso,
    ...(c.local?.trim() ? { local: c.local.trim() } : {}),
    origem: "beleza",
    ref: c.id,
  };
};

/** Id de um item cru da lista de compromissos (item torto → undefined). */
const idDoItem = (x: unknown): unknown => (x && typeof x === "object" ? (x as { id?: unknown }).id : undefined);

/**
 * O cuidado com o horário, e a lista de compromissos com ele (troca o anterior do mesmo cuidado, sem duplicar).
 *
 * `rotina-compromissos` é chave da ROTINA (e do app antigo): a escrita parte da lista CRUA,
 * como veio — item que não passa em `compromissosValidos` (sem hora, de uma versão futura…)
 * continua lá. Filtrar antes de gravar apagaria compromisso da pessoa (30/09, integração).
 */
export function marcarHorario(c: Cuidado, compromissosBrutos: unknown, data: string, hora: string, aviso: number, novoId: string): { cuidado: Cuidado; compromissos: unknown[] } {
  const cru: unknown[] = Array.isArray(compromissosBrutos) ? compromissosBrutos : [];
  const anterior = c.horario?.compromissoId;
  const id = anterior && cru.some((x) => idDoItem(x) === anterior) ? anterior : novoId;
  const comp = compromissoDoCuidado(c, data, hora, aviso, id);
  const outros = cru.filter((x) => idDoItem(x) !== id);
  return { cuidado: { ...c, horario: { data, hora, compromissoId: id } }, compromissos: [...outros, comp] };
}

/** A lista crua de compromissos sem o de `id` (o resto, inclusive item torto, fica como estava). */
export const semCompromisso = (compromissosBrutos: unknown, id: string): unknown[] =>
  (Array.isArray(compromissosBrutos) ? compromissosBrutos : []).filter((x) => idDoItem(x) !== id);

/* ------------------------------------------------------------ aviso sem horário */

export type AvisoDeCuidado = { quando: Date; title: string; body: string; id: number };

const TETO = 24;
const HORIZONTE = 60;

/** O texto do aviso ("✏️ Sobrancelha em 2 dias"). Também é a prévia da tela. */
export const textoDoAvisoDeCuidado = (c: Cuidado, proxima: string, diasAntes: number): { title: string; body: string } => {
  const quando = diasAntes <= 0 ? "hoje" : diasAntes === 1 ? "amanhã" : `em ${diasAntes} dias`;
  const d = parseLocalDay(proxima).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");
  return {
    title: `${EMOJI_DO_TIPO[c.tipo] ?? "🌷"} ${c.nome} ${quando}`,
    body: `A próxima é ${d}${c.pacote ? ` (${textoDoPacote(c.pacote)})` : ""}. Já marcou horário?`,
  };
};

/**
 * Os avisos a agendar: um por cuidado com aviso LIGADO e SEM horário marcado (com
 * horário, quem avisa é o compromisso da Rotina), N dias antes da próxima, às 09:00,
 * só no futuro, nos próximos 60 dias. PURA.
 */
export function planejarCuidados(l: Cuidado[], base: number, agora = new Date()): AvisoDeCuidado[] {
  const hoje = localDayKey(agora);
  const avisos: Omit<AvisoDeCuidado, "id">[] = [];
  for (const c of l) {
    if (!c.avisoLigado || c.horario) continue;
    const proxima = proximaDoCuidado(c);
    if (!proxima) continue;
    const antes = Math.max(0, Math.round(c.avisoDiasAntes ?? AVISO_DIAS_PADRAO));
    const dia = somarDias(proxima, -antes);
    if (diasEntre(hoje, dia) > HORIZONTE) continue;
    const q = parseLocalDay(dia);
    q.setHours(HORA_DO_AVISO, 0, 0, 0);
    if (q.getTime() <= agora.getTime()) continue;
    avisos.push({ quando: q, ...textoDoAvisoDeCuidado(c, proxima, antes) });
  }
  return avisos.sort((a, b) => a.quando.getTime() - b.quando.getTime()).slice(0, TETO).map((a, i) => ({ ...a, id: base + i }));
}

export const algumAvisoDeCuidado = (l: Cuidado[]): boolean => l.some((c) => c.avisoLigado && !c.horario);
