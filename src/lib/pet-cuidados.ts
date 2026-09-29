/**
 * CARTEIRINHA DO PET (29/09) — o plano de cuidados e a conta das datas.
 *
 * Dois lugares, de propósito:
 *  - `pet-health` (a chave de SEMPRE) guarda o que ACONTECEU: cada vacina
 *    aplicada, vermífugo dado, consulta feita — { date, nextDate }. É o que o
 *    app antigo mostra, e ele continua mostrando tudo (inclusive o que o app
 *    novo registrar), com o alerta de "próximos vencimentos" funcionando.
 *  - `pet-cuidados` (chave NOVA) guarda o PLANO: o que acompanhar e de quanto
 *    em quanto tempo (V10 todo ano, vermífugo a cada 3 meses, remédio às 8h e
 *    20h até sexta). O app antigo não lê — e não precisa.
 *
 * A carteirinha é a SOMA dos dois: cada cuidado do plano com o histórico dele,
 * mais o que só existe no histórico (quem registrou vacina antes de hoje vê a
 * carteirinha cheia, sem migração nenhuma e sem nada ser gravado ao abrir).
 *
 * Orientação geral de intervalos com fonte no relatório do módulo; o texto da
 * tela diz sempre que o calendário certo é o do veterinário.
 */
import { localDayKey } from "@/lib/utils";
import { diasEntre, ehDia, especieDe, faixaEtaria, novoId, somarDias, type FaixaEtaria, type Pet } from "@/lib/pet";

export type TipoCuidado = "vacina" | "vermifugo" | "antipulgas" | "remedio" | "consulta" | "banho" | "outro";
/** Os 3 tipos que o app antigo conhece em `pet-health`. Os novos entram como texto (ele só não mostra o rótulo). */
export type TipoAntigo = "vaccine" | "deworming" | "visit";

export interface Cuidado {
  id: string;
  petId: string;
  tipo: TipoCuidado;
  nome: string;
  /** repetir a cada N dias (365 = todo ano); sem isso é dose única */
  intervaloDias?: number;
  /** série inicial de filhote: N doses com `intervaloSerie` dias entre elas, depois `intervaloDias` */
  doses?: number;
  intervaloSerie?: number;
  /** data MARCADA (consulta agendada, dose com data certa) — vale até a próxima aplicação */
  proxima?: string;
  /** remédio diário: horários "HH:MM" */
  horarios?: string[];
  /** remédio: último dia do tratamento */
  ate?: string;
  /** remédio: "1 comprimido", "5 gotas" */
  dose?: string;
  obs?: string;
  /** nasceu do começo pronto e ainda não tem data */
  sugerido?: boolean;
  arquivado?: boolean;
  criadoEm?: string;
}

/** Item de `pet-health` (formato de sempre + campos opcionais). */
export interface Registro {
  id: string;
  petId: string;
  type: TipoAntigo | TipoCuidado;
  name: string;
  /** dia em que foi aplicado/feito */
  date: string;
  /** próxima data prevista ("" = sem próxima) */
  nextDate: string;
  cuidadoId?: string;
  obs?: string;
}

export type StatusCuidado = "atrasado" | "hoje" | "logo" | "em-dia" | "sem-data" | "feito" | "tratamento" | "encerrado";

export interface LinhaDaCarteirinha {
  chave: string;
  petId: string;
  tipo: TipoCuidado;
  nome: string;
  cuidado?: Cuidado;
  /** histórico deste cuidado, do mais recente pro mais antigo */
  registros: Registro[];
  ultima?: string;
  proxima?: string;
  intervaloDias?: number;
  /** "2ª de 3" na série de filhote */
  doseDaSerie?: { atual: number; total: number };
  status: StatusCuidado;
  diasAte?: number;
}

/* ─────────────────────────────── rótulos ─────────────────────────────── */

export const TIPOS: Record<TipoCuidado, { rotulo: string; etiqueta: string; emoji: string; antigo?: TipoAntigo; grupo: GrupoCarteirinha }> = {
  vacina: { rotulo: "Vacina", etiqueta: "VACINA", emoji: "💉", antigo: "vaccine", grupo: "vacinas" },
  vermifugo: { rotulo: "Vermífugo", etiqueta: "VERMÍFUGO", emoji: "🪱", antigo: "deworming", grupo: "parasitas" },
  antipulgas: { rotulo: "Antipulgas e carrapatos", etiqueta: "ANTIPULGAS", emoji: "🛡️", grupo: "parasitas" },
  remedio: { rotulo: "Remédio", etiqueta: "REMÉDIO", emoji: "💊", grupo: "remedios" },
  consulta: { rotulo: "Consulta", etiqueta: "CONSULTA", emoji: "🩺", antigo: "visit", grupo: "consultas" },
  banho: { rotulo: "Banho e tosa", etiqueta: "BANHO", emoji: "🛁", grupo: "consultas" },
  outro: { rotulo: "Outro cuidado", etiqueta: "CUIDADO", emoji: "🐾", grupo: "consultas" },
};

export type GrupoCarteirinha = "vacinas" | "parasitas" | "remedios" | "consultas";
export const GRUPOS: { id: GrupoCarteirinha; titulo: string }[] = [
  { id: "vacinas", titulo: "Vacinas" },
  { id: "parasitas", titulo: "Vermes, pulgas e carrapatos" },
  { id: "remedios", titulo: "Remédios" },
  { id: "consultas", titulo: "Consultas e outros cuidados" },
];

const DE_ANTIGO: Record<string, TipoCuidado> = { vaccine: "vacina", deworming: "vermifugo", visit: "consulta" };
export const tipoDoRegistro = (t: unknown): TipoCuidado =>
  typeof t === "string" ? (DE_ANTIGO[t] ?? (t in TIPOS ? (t as TipoCuidado) : "outro")) : "outro";
export const tipoPraGravar = (t: TipoCuidado): Registro["type"] => TIPOS[t].antigo ?? t;

/** Intervalos que a tela oferece (em dias). */
export const INTERVALOS: { dias: number; rotulo: string }[] = [
  { dias: 7, rotulo: "toda semana" },
  { dias: 15, rotulo: "a cada 15 dias" },
  { dias: 30, rotulo: "todo mês" },
  { dias: 60, rotulo: "a cada 2 meses" },
  { dias: 90, rotulo: "a cada 3 meses" },
  { dias: 120, rotulo: "a cada 4 meses" },
  { dias: 180, rotulo: "a cada 6 meses" },
  { dias: 240, rotulo: "a cada 8 meses" },
  { dias: 365, rotulo: "todo ano" },
];
export const rotuloIntervalo = (dias?: number): string => {
  if (!dias) return "dose única";
  const achado = INTERVALOS.find((i) => i.dias === dias);
  if (achado) return achado.rotulo;
  if (dias % 30 === 0) return `a cada ${dias / 30} meses`;
  // Bravecto é "a cada 12 semanas" (84 dias) — é assim que a bula e o vet falam
  if (dias % 7 === 0 && dias <= 180) return dias === 7 ? "toda semana" : `a cada ${dias / 7} semanas`;
  return `a cada ${dias} dias`;
};

/* ─────────────────────────────── leitura segura ─────────────────────────────── */

const txt = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const normNome = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ehHora = (h: unknown): h is string => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

export function cuidadosValidos(bruto: unknown): Cuidado[] {
  if (!Array.isArray(bruto)) return [];
  const out: Cuidado[] = [];
  for (const c of bruto) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const id = txt(o.id), petId = txt(o.petId), nome = txt(o.nome).trim();
    if (!id || !petId || !nome) continue;
    const tipo = (typeof o.tipo === "string" && o.tipo in TIPOS ? o.tipo : "outro") as TipoCuidado;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);
    out.push({
      ...(o as Partial<Cuidado>),
      id, petId, nome, tipo,
      intervaloDias: n(o.intervaloDias),
      doses: n(o.doses),
      intervaloSerie: n(o.intervaloSerie),
      proxima: ehDia(o.proxima) ? o.proxima : undefined,
      ate: ehDia(o.ate) ? o.ate : undefined,
      horarios: Array.isArray(o.horarios) ? [...new Set(o.horarios.filter(ehHora))].sort() : undefined,
    });
  }
  return out;
}

export function registrosValidos(bruto: unknown): Registro[] {
  if (!Array.isArray(bruto)) return [];
  const out: Registro[] = [];
  for (const r of bruto) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = txt(o.id), name = txt(o.name).trim();
    if (!id || !name || !ehDia(o.date)) continue;
    out.push({
      ...(o as Partial<Registro>),
      id,
      petId: txt(o.petId),
      type: (typeof o.type === "string" ? o.type : "visit") as Registro["type"],
      name,
      date: o.date,
      nextDate: ehDia(o.nextDate) ? o.nextDate : "",
    });
  }
  return out;
}

/* ─────────────────────────────── a carteirinha ─────────────────────────────── */

/**
 * O app antigo só tinha Vacina / Vermífugo / Consulta — quem dava Bravecto ou
 * NexGard registrava como "Vermífugo". Pelo nome, isso é antipulgas.
 */
const ANTIPULGAS = /(pulga|carrapat|bravecto|nexgard|simparic|credeli|frontline|revolution|advocate|seresto|scalibor|capstar|comfortis|effipro|leevre|nexgard)/;

/** O tipo que a carteirinha mostra pra um registro (corrige o antipulgas antigo gravado como vermífugo). */
export function tipoEfetivo(r: Pick<Registro, "type" | "name">): TipoCuidado {
  const t = tipoDoRegistro(r.type);
  return t === "vermifugo" && ANTIPULGAS.test(normNome(r.name)) ? "antipulgas" : t;
}

/**
 * A "família" de um cuidado: V10 e V-10 são a mesma vacina, e a sugestão
 * "V8 ou V10" do começo pronto é a mesma linha da V10 registrada antes.
 * Vermífugo e antipulgas: uma linha por pet, qualquer que seja a marca.
 */
export function familiaDe(tipo: TipoCuidado, nome: string): string {
  const n = normNome(nome);
  if (tipo === "vacina") {
    if (/\bv ?(8|10|11|12)\b|polivalente|multipla|octupla|dectupla|v8 ou v10/.test(n)) return "vacina:polivalente-cao";
    if (/\bv ?(3|4|5)\b|triplice|quadrupla|quintupla|v4 ou v5/.test(n)) return "vacina:polivalente-gato";
    if (/raiva|rabica|antirab|anti rab/.test(n)) return "vacina:raiva";
    return `vacina:${n}`;
  }
  if (tipo === "vermifugo" || tipo === "antipulgas") return tipo;
  if (tipo === "consulta" && /check|rotina|anual|revisao/.test(n)) return "consulta:checkup";
  return `${tipo}:${n}`;
}

const combina = (r: Registro, c: Cuidado) =>
  r.cuidadoId ? r.cuidadoId === c.id : (r.petId === c.petId && familiaDe(tipoEfetivo(r), r.name) === familiaDe(c.tipo, c.nome));

const ORDEM_STATUS: Record<StatusCuidado, number> = { atrasado: 0, hoje: 1, logo: 2, tratamento: 3, "sem-data": 4, "em-dia": 5, feito: 6, encerrado: 7 };

export function statusDe(proxima: string | undefined, hoje: string): { status: StatusCuidado; diasAte?: number } {
  if (!proxima) return { status: "sem-data" };
  const d = diasEntre(hoje, proxima);
  return { status: d < 0 ? "atrasado" : d === 0 ? "hoje" : d <= 7 ? "logo" : "em-dia", diasAte: d };
}

function montarLinha(petId: string, tipo: TipoCuidado, nome: string, regs: Registro[], hoje: string, c?: Cuidado): LinhaDaCarteirinha {
  const registros = [...regs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const ult = registros[0];
  const base: LinhaDaCarteirinha = { chave: c ? c.id : `hist:${familiaDe(tipo, nome)}`, petId, tipo, nome, cuidado: c, registros, ultima: ult?.date, status: "sem-data" };

  // remédio de todo dia (com horários): não tem "próxima data", tem tratamento em andamento
  if (c && c.tipo === "remedio" && c.horarios?.length) {
    return { ...base, status: c.ate && c.ate < hoje ? "encerrado" : "tratamento" };
  }

  // intervalo: o do plano; sem plano, o que o último registro sugeria (nextDate − date)
  let intervalo = c?.intervaloDias;
  if (!intervalo && ult?.nextDate) {
    const d = diasEntre(ult.date, ult.nextDate);
    if (d > 0) intervalo = d;
  }

  let proxima: string | undefined;
  let doseDaSerie: LinhaDaCarteirinha["doseDaSerie"];
  const feitas = registros.length;
  if (c?.doses && c.doses > 1 && feitas < c.doses) {
    // série de filhote: a próxima dose vem `intervaloSerie` depois da última
    doseDaSerie = { atual: feitas + 1, total: c.doses };
    if (c.proxima && (!ult || c.proxima > ult.date)) proxima = c.proxima;
    else if (ult) proxima = somarDias(ult.date, c.intervaloSerie ?? 21);
  } else if (c?.proxima && (!ult || c.proxima > ult.date)) {
    // data marcada à mão (consulta agendada, vet pediu antes) vale até a próxima aplicação
    proxima = c.proxima;
  } else if (ult && c?.intervaloDias) {
    // o PLANO manda: trocou o antipulgas de mensal pra trimestral, a próxima já muda
    proxima = somarDias(ult.date, c.intervaloDias);
  } else if (ult?.nextDate) {
    proxima = ult.nextDate;
  } else if (ult && intervalo) {
    proxima = somarDias(ult.date, intervalo);
  }

  if (!proxima) {
    return { ...base, intervaloDias: intervalo, doseDaSerie, status: ult ? (intervalo ? "sem-data" : "feito") : "sem-data" };
  }
  return { ...base, intervaloDias: intervalo, doseDaSerie, proxima, ...statusDe(proxima, hoje) };
}

/** Todas as linhas da carteirinha de um pet: plano + histórico solto. */
export function linhasDaCarteirinha(petId: string, cuidadosBrutos: unknown, registrosBrutos: unknown, hoje: string = localDayKey()): LinhaDaCarteirinha[] {
  const cuidados = cuidadosValidos(cuidadosBrutos).filter((c) => c.petId === petId && !c.arquivado);
  const regs = registrosValidos(registrosBrutos).filter((r) => r.petId === petId);
  const usados = new Set<string>();
  const linhas: LinhaDaCarteirinha[] = [];

  for (const c of cuidados) {
    const meus = regs.filter((r) => !usados.has(r.id) && combina(r, c));
    meus.forEach((r) => usados.add(r.id));
    linhas.push(montarLinha(petId, c.tipo, c.nome, meus, hoje, c));
  }

  // o que só existe no histórico (inclusive de cuidado que saiu do plano): agrupa pela
  // família — V10 de 2025 e V-10 de 2026 viram UMA linha, com os dois registros
  const soltos = new Map<string, Registro[]>();
  for (const r of regs) {
    if (usados.has(r.id)) continue;
    const chave = familiaDe(tipoEfetivo(r), r.name);
    soltos.set(chave, [...(soltos.get(chave) ?? []), r]);
  }
  for (const grupo of soltos.values()) {
    const maisNovo = [...grupo].sort((a, b) => b.date.localeCompare(a.date))[0];
    linhas.push(montarLinha(petId, tipoEfetivo(maisNovo), maisNovo.name, grupo, hoje));
  }

  return linhas.sort((a, b) =>
    ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
    || (a.proxima ?? "9999").localeCompare(b.proxima ?? "9999")
    || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Os que pedem atenção primeiro (atrasado, hoje, esta semana) e depois o próximo em dia. */
export function proximosCuidados(linhas: LinhaDaCarteirinha[], max = 3): LinhaDaCarteirinha[] {
  const urgentes = linhas.filter((l) => l.status === "atrasado" || l.status === "hoje" || l.status === "logo");
  const emDia = linhas.filter((l) => l.status === "em-dia").sort((a, b) => (a.proxima ?? "").localeCompare(b.proxima ?? ""));
  return [...urgentes, ...emDia].slice(0, max);
}

/** "venceu há 2 dias" · "hoje" · "amanhã" · "em 5 dias" · "12/03/2027" */
export function quandoTexto(l: Pick<LinhaDaCarteirinha, "status" | "diasAte" | "proxima">): string {
  if (!l.proxima || l.diasAte === undefined) return l.status === "feito" ? "feito" : "sem data";
  const d = l.diasAte;
  if (d < 0) return d === -1 ? "venceu ontem" : `venceu há ${-d} dias`;
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d <= 30) return `em ${d} dias`;
  const [a, m, dia] = l.proxima.split("-");
  return `${dia}/${m}/${a}`;
}

/**
 * "Feito hoje" (ou na data escolhida): o registro novo pra `pet-health` e, se
 * o plano tinha data marcada ou era sugestão, o cuidado atualizado.
 */
export function registrarAplicacao(
  linha: LinhaDaCarteirinha,
  dia: string,
  extra: { obs?: string } = {},
): { registro: Registro; cuidado?: Cuidado } {
  const c = linha.cuidado;
  // na série de filhote, a próxima é a dose seguinte; na última dose, o reforço
  let proxima = "";
  if (c?.doses && c.doses > 1 && linha.registros.length + 1 < c.doses) proxima = somarDias(dia, c.intervaloSerie ?? 21);
  else if (c?.intervaloDias) proxima = somarDias(dia, c.intervaloDias);
  else if (!c && linha.intervaloDias) proxima = somarDias(dia, linha.intervaloDias);

  const registro: Registro = {
    id: novoId("r"),
    petId: linha.petId,
    type: tipoPraGravar(linha.tipo),
    name: linha.nome,
    date: dia,
    nextDate: proxima,
    ...(c ? { cuidadoId: c.id } : {}),
    ...(extra.obs?.trim() ? { obs: extra.obs.trim() } : {}),
  };
  const cuidado = c && (c.proxima || c.sugerido) ? { ...c, proxima: undefined, sugerido: false } : undefined;
  return { registro, cuidado };
}

/** Troca um cuidado na lista (ou acrescenta), sem mexer nos outros. */
export function comCuidado(bruto: unknown, cuidado: Cuidado): Cuidado[] {
  const lista = Array.isArray(bruto) ? (bruto as Cuidado[]) : [];
  const i = lista.findIndex((c) => c?.id === cuidado.id);
  if (i < 0) return [...lista, cuidado];
  const nova = [...lista];
  nova[i] = cuidado;
  return nova;
}

/* ─────────────────────────────── remédio de todo dia ─────────────────────────────── */

export interface DoseDoDia {
  id: string;
  cuidadoId: string;
  label: string;
  hora: string;
}

/** As doses de hoje dos remédios com horário (id `rem:<cuidado>:<HH:MM>` em `pet-routine-<dia>`). */
export function dosesDoDia(petId: string, cuidadosBrutos: unknown, hoje: string = localDayKey()): DoseDoDia[] {
  return cuidadosValidos(cuidadosBrutos)
    .filter((c) => c.petId === petId && !c.arquivado && c.tipo === "remedio" && c.horarios?.length)
    .filter((c) => !c.ate || c.ate >= hoje)
    .filter((c) => !ehDia(c.criadoEm?.slice(0, 10)) || (c.criadoEm as string).slice(0, 10) <= hoje)
    .flatMap((c) => (c.horarios ?? []).map((hora) => ({
      id: `rem:${c.id}:${hora}`,
      cuidadoId: c.id,
      label: c.dose ? `${c.nome} · ${c.dose}` : c.nome,
      hora,
    })))
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

/* ─────────────────────────────── começo pronto ─────────────────────────────── */

export interface Sugestao {
  tipo: TipoCuidado;
  nome: string;
  intervaloDias?: number;
  doses?: number;
  intervaloSerie?: number;
  /** o porquê, em uma linha, pra tela */
  nota: string;
}

/**
 * O básico da carteirinha por espécie e fase da vida (orientação geral — a
 * tela sempre diz pra confirmar com o veterinário). Fontes no relatório do
 * módulo: diretrizes de vacinação da WSAVA (filhote a cada 2–4 semanas até 16
 * semanas; raiva a partir de 12 semanas), prática brasileira de reforço anual
 * da polivalente (componente de leptospirose), ESCCAP pro vermífugo (filhote
 * todo mês até 6 meses; adulto ao menos 4× por ano), AAHA/AAFP pro check-up
 * (anual; idoso a cada 6 meses).
 */
export function sugerirCuidados(pet: Pick<Pet, "species" | "birthday" | "faixa" | "porte">, hoje: string = localDayKey()): Sugestao[] {
  const esp = especieDe(pet.species);
  const fase: FaixaEtaria = faixaEtaria(pet, hoje);
  const filhote = fase === "filhote";
  if (esp !== "cao" && esp !== "gato") {
    return [{ tipo: "consulta", nome: "Check-up", intervaloDias: 365, nota: "Uma visita por ano ao veterinário de exóticos/silvestres." }];
  }
  const polivalente = esp === "cao"
    ? { nome: "V8 ou V10", nota: filhote ? "Filhote: 3 doses com 3 a 4 semanas entre elas, depois 1 reforço por ano." : "Reforço 1 vez por ano." }
    : { nome: "V4 ou V5", nota: filhote ? "Filhote: 2 a 3 doses com 3 a 4 semanas entre elas, depois reforço anual." : "Reforço 1 vez por ano (V5 inclui a leucemia felina)." };
  const lista: Sugestao[] = [
    { tipo: "vacina", nome: polivalente.nome, intervaloDias: 365, ...(filhote ? { doses: 3, intervaloSerie: 21 } : {}), nota: polivalente.nota },
    { tipo: "vacina", nome: "Antirrábica", intervaloDias: 365, nota: filhote ? "A partir de 12 semanas de vida, depois todo ano." : "Uma dose por ano." },
    { tipo: "vermifugo", nome: "Vermífugo", intervaloDias: filhote ? 30 : 90, nota: filhote ? "Filhote: todo mês até os 6 meses." : "Adulto: a cada 3 meses (ou como o vet indicar)." },
    { tipo: "antipulgas", nome: "Antipulgas e carrapatos", intervaloDias: 30, nota: "Começa mensal; muda conforme o produto (Bravecto 12 semanas, coleira até 8 meses…)." },
  ];
  if (!filhote) lista.push({ tipo: "consulta", nome: "Check-up", intervaloDias: fase === "idoso" ? 180 : 365, nota: fase === "idoso" ? "Idoso: a cada 6 meses." : "Uma consulta de rotina por ano." });
  return lista;
}

/** As sugestões escolhidas viram cuidados do plano (sem data: `sugerido`). */
export function cuidadosDasSugestoes(petId: string, sugestoes: Sugestao[], agora: Date = new Date()): Cuidado[] {
  return sugestoes.map((s, i) => ({
    id: novoId(`c${i}`),
    petId,
    tipo: s.tipo,
    nome: s.nome,
    ...(s.intervaloDias ? { intervaloDias: s.intervaloDias } : {}),
    ...(s.doses ? { doses: s.doses, intervaloSerie: s.intervaloSerie } : {}),
    sugerido: true,
    criadoEm: agora.toISOString(),
  }));
}
