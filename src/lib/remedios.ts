/**
 * REMÉDIO DE 8 EM 8 / 12 EM 12 HORAS (07/11, pedido de cliente) — a conta pura.
 *
 * Um remédio "3× ao dia" vira TRÊS linhas normais em `core-saude-supplements`
 * (uma por horário), ligadas por `grupo`. O formato da chave não muda: o app
 * antigo continua lendo linhas comuns — vê "Amoxicilina 08:00", "Amoxicilina
 * 16:00" e "Amoxicilina 00:00", marca cada uma e baixa o estoque dela. O app
 * novo mostra o grupo como UMA linha, com os horários pra marcar, e anda o
 * estoque das linhas juntas.
 *
 * `ate` (opcional) é o último dia do tratamento: depois dele (e da dose da noite
 * dele, ver `ultimoDiaDaDose`) o lembrete para (lib/notificacoes planejarRemedios)
 * e a linha aparece como "terminou".
 *
 * `inicio` (07/11, 3ª rodada da crítica; só em grupo de 2+ horários) é o
 * momento da 1ª dose ("AAAA-MM-DDTHH:MM"). Antes dele não existe dose: quem
 * cadastra às 10:00 um 8 em 8 com 1ª dose às 20:00 não recebe aviso às 12:00.
 * O app antigo ignora o campo.
 *
 * Onde o DIA DO TRATAMENTO começa (ver `ultimoDiaDaDose`) é a hora ATUAL da 1ª
 * linha do grupo, não a hora gravada no `inicio` (07/11, retomada): quem adiantava
 * a 1ª dose de 08:00 pra 07:00 depois de começado ficava com a das 07:00 tratada
 * como "dose da noite" — gravava no dia seguinte e o aviso da manhã sumia todo dia.
 *
 * O DIA DO REGISTRO DE "TOMADO": cada dose é gravada em
 * `core-saude-supplement-log` no dia do calendário em que ela ACONTECE. A das
 * 00:00 marcada às 23:50 vai pro dia seguinte, o mesmo dia em que ela fica
 * quando marcada às 00:10 — e o aviso das 00:00 sai da fila (lib/reagendar
 * passa o "tomado de amanhã"). O formato da chave não muda.
 *
 * Por que não o "repetir" do sistema de notificações: ele não sabe que a
 * pessoa já tomou (o aviso de hoje some pra quem marcou) nem conhece a data
 * de fim — e cada dia é um aviso só, com os nomes do mesmo horário juntos.
 */

import { localDayKey } from "@/lib/utils";

export type VezesAoDia = 1 | 2 | 3 | 4;

export interface Remedio {
  id: string;
  name: string;
  time: string;
  stock: number;
  dosesPerDay: number;
  /** De quem é (22/09). Ausente = seu. */
  quem?: string;
  /** 07/11: as linhas de um remédio de N vezes ao dia dividem este id. */
  grupo?: string;
  /** 07/11: último dia do tratamento ("AAAA-MM-DD"). Sem isso, é pra sempre. */
  ate?: string;
  /** 07/11: momento da 1ª dose ("AAAA-MM-DDTHH:MM"), só em grupo de 2+ horários. Antes dele, nada. */
  inicio?: string;
}

export const OPCOES_VEZES: ReadonlyArray<{ vezes: VezesAoDia; rotulo: string }> = [
  { vezes: 1, rotulo: "1× ao dia" },
  { vezes: 2, rotulo: "12 em 12" },
  { vezes: 3, rotulo: "8 em 8" },
  { vezes: 4, rotulo: "6 em 6" },
];

export const ehHora = (h: unknown): h is string => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
export const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const ehInicio = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v);

const minutosDe = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const horaDe = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "08:00" de 8 em 8 → ["08:00", "16:00", "00:00"] — passa da meia-noite e segue (a dose das 0h é a de hoje à noite). */
export function gerarHorarios(primeira: string, vezes: number): string[] {
  if (!ehHora(primeira)) return [];
  const n = Math.min(4, Math.max(1, Math.round(vezes) || 1));
  const passo = (24 * 60) / n;
  const inicio = minutosDe(primeira);
  return Array.from({ length: n }, (_, i) => horaDe((inicio + Math.round(i * passo)) % (24 * 60)));
}

/** "8 em 8 h" quando os horários são certinhos; senão "3× ao dia". Um horário só = "". */
export function rotuloDosHorarios(horarios: string[]): string {
  const n = horarios.length;
  if (n <= 1) return "";
  const minutos = horarios.filter(ehHora).map(minutosDe).sort((a, b) => a - b);
  const passo = (24 * 60) / n;
  const certinho = minutos.length === n && Number.isInteger(24 / n)
    && minutos.every((m, i) => i === 0 || m - minutos[i - 1] === passo);
  return certinho ? `${24 / n} em ${24 / n} h` : `${n}× ao dia`;
}

/** O tratamento ainda vale neste dia? (sem `ate` = sempre) */
export const remedioValeNoDia = (r: { ate?: string }, dia: string): boolean => !ehDia(r.ate) || r.ate >= dia;

const horaDoRelogio = (agora: Date) => horaDe(agora.getHours() * 60 + agora.getMinutes());
const somarDias = (dia: string, n: number) => {
  const [a, m, d] = dia.split("-").map(Number);
  return localDayKey(new Date(a, m - 1, d + n));
};
const diaSeguinte = (dia: string) => somarDias(dia, 1);
/** "2026-11-07" + "20:00" → o Date local daquele momento */
const momentoDe = (dia: string, hora: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, 0, 0);
};
/** o `inicio` gravado → Date (ou null, se não há ou é inválido) */
export const momentoDoInicio = (inicio: unknown): Date | null =>
  ehInicio(inicio) ? momentoDe(inicio.slice(0, 10), inicio.slice(11, 16)) : null;

/**
 * O `inicio` de um cadastro feito agora: a ocorrência da 1ª dose mais perto do
 * relógio (até 12 h pra trás ou pra frente). 10:00 com 1ª dose 20:00 → hoje 20:00;
 * 10:00 com 1ª dose 08:00 → hoje 08:00 (já começou, como sempre foi); 23:00 com
 * 1ª dose 00:30 → amanhã 00:30 (é a de daqui a pouco, não a de ontem).
 */
export function inicioDoCadastro(primeira: string, agora: Date = new Date(), horarios: string[] = []): string | undefined {
  if (!ehHora(primeira)) return undefined;
  const hoje = localDayKey(agora);
  /* A 1ª dose já passou hoje, mas ainda falta dose deste dia do tratamento
     (07/11, retomada): às 20:30, um 8 em 8 desde as 08:00 começou HOJE — a das
     00:00 desta noite tem aviso e dá pra marcar. Antes, depois das 20:00 o
     tratamento pulava pra amanhã e a dose da madrugada sumia. */
  const t = agora.getTime();
  const aindaFaltaHoje = horarios.some((h) => ehHora(h) && momentoDe(h < primeira ? diaSeguinte(hoje) : hoje, h).getTime() > t);
  if (momentoDe(hoje, primeira).getTime() <= t && aindaFaltaHoje) return `${hoje}T${primeira}`;
  const meioDia = 12 * 3600_000;
  const dia = [somarDias(hoje, -1), hoje, somarDias(hoje, 1)]
    .find((d) => Math.abs(momentoDe(d, primeira).getTime() - agora.getTime()) <= meioDia) ?? hoje;
  return `${dia}T${primeira}`;
}

/**
 * Mudou a hora da 1ª dose na edição (as outras são geradas de novo a partir dela,
 * como no cadastro — `horarios` é a lista nova). O `inicio` acompanha:
 *  - tratamento que AINDA NÃO começou: é refeito como num cadastro agora
 *    (às 23:00, 00:30 → 23:30 começa hoje 23:30, não amanhã);
 *  - já começado: a data fica e só a hora muda (07/11, retomada). Com a hora
 *    velha, adiantar 08:00 → 07:00 deixava a 1ª dose "antes do início do dia".
 */
export function inicioAoMudarPrimeira(inicio: unknown, hora: string, agora: Date = new Date(), horarios: string[] = []): string | undefined {
  const quando = momentoDoInicio(inicio);
  if (!quando || !ehHora(hora)) return undefined;
  if (quando.getTime() > agora.getTime()) return inicioDoCadastro(hora, agora, horarios.length ? horarios : [hora]);
  return `${String(inicio).slice(0, 10)}T${hora}`;
}

/**
 * O DIA DO TRATAMENTO COMEÇA NA 1ª DOSE (07/11). Em "8 em 8" a partir das 08:00,
 * a dose das 00:00 é a última de hoje, não a primeira de amanhã: com `ate` = dia
 * 13 ela cai à 0h do dia 14, e ainda é dose do tratamento. Vale pra toda dose com
 * horário antes da 1ª do grupo. O formato da chave não muda: `ate` continua sendo
 * o dia que a pessoa digitou, e é esta conta que acha a dose da noite.
 */
export function ultimoDiaDaDose(linha: { time?: string; ate?: string }, primeira: string): string | undefined {
  if (!ehDia(linha.ate)) return undefined;
  const daNoiteAnterior = ehHora(linha.time) && ehHora(primeira) && linha.time < primeira;
  return daNoiteAnterior ? diaSeguinte(linha.ate) : linha.ate;
}

/** Esta dose ainda existe agora? No dia seguinte ao `ate`, a dose da noite vale até a hora da 1ª dose. */
function doseVale(linha: { time?: string; ate?: string }, primeira: string, agora: Date): boolean {
  const ultimo = ultimoDiaDaDose(linha, primeira);
  if (!ultimo) return true;
  const dia = localDayKey(agora);
  if (dia > ultimo) return false;
  return !(dia > String(linha.ate) && horaDoRelogio(agora) >= primeira);
}

/**
 * A hora da 1ª dose de cada grupo: a hora ATUAL da primeira linha (a ordem do
 * cadastro), que é a que a pessoa vê e edita. O `inicio` só entra se essa linha
 * estiver sem hora válida. (Antes valia a hora do `inicio`, que não acompanhava a
 * edição depois de começado — 07/11, retomada.)
 */
const primeiraDoGrupo = <T extends { time?: string; grupo?: string; inicio?: string }>(lista: T[]) => {
  const primeiras = new Map<string, string>();
  for (const r of lista) {
    if (!r?.grupo || primeiras.has(r.grupo)) continue;
    primeiras.set(r.grupo, ehHora(r.time) ? r.time : ehInicio(r.inicio) ? r.inicio.slice(11, 16) : String(r.time ?? ""));
  }
  return (r: T) => (r.grupo && primeiras.get(r.grupo)) || String(r.time ?? "");
};
const primeiraDe = (g: GrupoDeRemedio) => primeiraDoGrupo(g.itens)(g.itens[0]);

/** As linhas que ainda valem agora, com o `ate` trocado pelo último dia daquela dose (é o que o plano dos avisos compara). */
export function dosesEmVigor<T extends { time?: string; ate?: string; grupo?: string; inicio?: string }>(lista: T[], agora: Date = new Date()): T[] {
  const primeira = primeiraDoGrupo(lista);
  return lista
    .filter((r) => r && doseVale(r, primeira(r), agora))
    .map((r) => (ehDia(r.ate) ? { ...r, ate: ultimoDiaDaDose(r, primeira(r)) } : r));
}

/**
 * A dose que a caixa da linha marca (07/11): a mais recente que já passou no
 * relógio; se nenhuma passou, a próxima. Pela ordem de cadastro, às 00:10 a
 * caixa marcava a das 08:00, e o aviso dela sumia sem ela ter sido tomada.
 *
 * Com `quando` (o momento daquela dose, de `dosesDoGrupoAgora`) a conta é pelo
 * momento de verdade, não pela hora do relógio: às 23:50 a das 00:00 é a de
 * daqui a 10 minutos (amanhã), e às 07:55 do 1º dia a das 00:00 nem existe.
 */
export function doseDaHora<T extends { time: string; quando?: number }>(doses: T[], agora: Date = new Date()): T | undefined {
  const hoje = localDayKey(agora);
  const quandoDe = (d: T) => d.quando ?? (ehHora(d.time) ? momentoDe(hoje, d.time).getTime() : 0);
  const emOrdem = [...doses].sort((a, b) => quandoDe(a) - quandoDe(b));
  const t = agora.getTime();
  return [...emOrdem].reverse().find((d) => quandoDe(d) <= t) ?? emOrdem.find((d) => quandoDe(d) > t);
}

export interface GrupoDeRemedio {
  /** id do grupo — ou o id da própria linha, quando é um remédio simples */
  chave: string;
  /** as linhas, na ordem em que foram cadastradas (1ª dose, 2ª dose…) */
  itens: Remedio[];
  nome: string;
  quem?: string;
  ate?: string;
  /** o estoque mostrado: as linhas andam juntas; se o app antigo baixou só uma, vale a menor */
  estoque: number;
}

/** As linhas da chave viram uma lista de grupos (remédio simples = grupo de 1), na ordem de cadastro. */
export function agruparRemedios(lista: Remedio[]): GrupoDeRemedio[] {
  const grupos = new Map<string, Remedio[]>();
  for (const r of Array.isArray(lista) ? lista : []) {
    if (!r || typeof r !== "object") continue;
    const chave = typeof r.grupo === "string" && r.grupo ? `g:${r.grupo}` : `i:${r.id}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), r]);
  }
  return [...grupos.entries()].map(([chave, itens]) => ({
    chave,
    itens,
    nome: String(itens[0].name ?? ""),
    quem: itens.find((i) => i.quem?.trim())?.quem,
    ate: itens.find((i) => ehDia(i.ate))?.ate,
    estoque: Math.min(...itens.map((i) => (Number.isFinite(Number(i.stock)) ? Number(i.stock) : 0))),
  }));
}

/** Tratamento encerrado: já passou a última dose dele (a da noite, quando há). */
export function tratamentoTerminou(g: GrupoDeRemedio, agora: Date = new Date()): boolean {
  return !!g.ate && g.itens.every((s) => !doseVale({ time: s.time, ate: g.ate }, primeiraDe(g), agora));
}

/** Uma dose pra marcar: a linha + o dia do registro (o dia em que ela acontece) + o momento dela. */
export type DoseMarcavel = Remedio & { dia: string; quando: number };

/**
 * Quanto antes da 1ª dose o dia do tratamento já vira (tomar a 1ª dose um pouco
 * adiantado): 1 h — ou menos, se a última dose do dia (a da noite) cai a menos de
 * 2 h da 1ª. Com 07:30 e 08:00, às 07:20 a das 07:30 ainda é a de hoje à noite
 * (07/11, retomada: com 1 h fixa ela pulava pro dia seguinte).
 */
const ANTECEDENCIA_MIN = 60;
function antecedenciaMin(horas: string[], primeira: string): number {
  const p = minutosDe(primeira);
  const folgas = horas.filter(ehHora).map((h) => (p - minutosDe(h) + 24 * 60) % (24 * 60)).filter((d) => d > 0);
  return folgas.length ? Math.min(ANTECEDENCIA_MIN, Math.floor(Math.min(...folgas) / 2)) : ANTECEDENCIA_MIN;
}

/**
 * As doses que existem agora, pra marcar — cada linha UMA vez, a do DIA DO
 * TRATAMENTO de agora (07/11, 3ª rodada da crítica).
 *
 * Remédio simples (1 linha): a de hoje, como sempre.
 * Grupo (8 em 8…): o dia do tratamento começa na 1ª dose (a hora atual da 1ª
 * linha) e vira até 1 h antes dela (tomar um pouco adiantado; `antecedenciaMin`). Em 8 em 8 desde as 08:00, das 07:00 de hoje às
 * 07:00 de amanhã as pílulas são 08:00 e 16:00 de hoje e 00:00 de amanhã — às
 * 23:50 a das 00:00 é a de daqui a 10 minutos (grava em amanhã), e às 00:10
 * continua sendo ela, já marcada. Antes do `inicio` o dia é o do início (às
 * 07:55 do 1º dia a das 00:00 é a da noite, não a de hoje); depois do `ate`,
 * o último dia (a dose da noite dele vale até a hora da 1ª dose).
 */
export function dosesDoGrupoAgora(g: GrupoDeRemedio, agora: Date = new Date()): DoseMarcavel[] {
  if (tratamentoTerminou(g, agora)) return [];
  const primeira = primeiraDe(g);
  const hoje = localDayKey(agora);
  if (g.itens.length <= 1) {
    return g.itens
      .filter((s) => doseVale({ time: s.time, ate: g.ate }, primeira, agora))
      .map((s) => ({ ...s, dia: hoje, quando: ehHora(s.time) ? momentoDe(hoje, s.time).getTime() : 0 }));
  }
  const p = ehHora(primeira) ? primeira : "00:00";
  const inicioGravado = g.itens.find((s) => ehInicio(s.inicio))?.inicio;
  const inicio = momentoDoInicio(inicioGravado)?.getTime() ?? -Infinity;
  const antes = antecedenciaMin(g.itens.map((s) => s.time), p);
  let dia = localDayKey(new Date(agora.getTime() - (minutosDe(p) - antes) * 60_000));
  if (ehInicio(inicioGravado) && dia < inicioGravado.slice(0, 10)) dia = inicioGravado.slice(0, 10);
  if (ehDia(g.ate) && dia > g.ate) dia = g.ate;
  const out: DoseMarcavel[] = [];
  for (const s of g.itens) {
    if (!ehHora(s.time)) continue;
    const doDia = s.time < p ? diaSeguinte(dia) : dia; // a dose da noite acontece no dia seguinte do calendário
    const quando = momentoDe(doDia, s.time).getTime();
    if (quando >= inicio) out.push({ ...s, dia: doDia, quando });
  }
  return out;
}

/** Uma marca de "tomado" que saiu de um dia do registro: foi pra `para`, ou sumiu (`null`). */
export interface MarcaMovida { id: string; de: string; para: string | null }

/**
 * MUDOU A HORA, A MARCA VAI JUNTO (07/11, 4ª rodada da crítica). O registro de
 * "tomado" é "id da linha no dia do calendário"; mudar a 1ª dose refaz as horas
 * do grupo, e a mesma linha passa a acontecer noutro dia — ou uma marca velha passa
 * a cair nela. Em 8 em 8 desde 08:00, com 00:00 (de ontem à noite, gravada hoje) e
 * 08:00 tomadas, mudar pra 07:00 às 15:00 fazia a das 23:00 de hoje aparecer
 * tomada e o aviso dela sumia: a pessoa pulava uma dose de antibiótico.
 *
 * Compara as doses do dia do tratamento de agora com as horas velhas (`antes`) e
 * com as novas (`depois`):
 *  - a dose marcada leva a marca pro dia em que ela acontece agora — só se a dose
 *    nova já chegou (ou chega em até 1 h, o "tomar um pouco antes"). Atrasar 08:00
 *    (tomada) pra 20:00 às 15:00 não deixa a das 20:00 marcada: ela ainda vai ser tomada;
 *  - uma marca de OUTRA ocorrência que agora cairia na dose (a das 00:00 de ontem
 *    à noite virando a das 23:00 de hoje) sai.
 * O estoque não muda (o comprimido foi tomado), e o formato da chave é o mesmo.
 */
export function moverMarcasDoGrupo(
  antes: GrupoDeRemedio,
  depois: GrupoDeRemedio,
  log: Record<string, string[]>,
  agora: Date = new Date(),
): { log: Record<string, string[]>; movidas: MarcaMovida[] } {
  const velhas = new Map(dosesDoGrupoAgora(antes, agora).map((d) => [d.id, d]));
  const novas = new Map(dosesDoGrupoAgora(depois, agora).map((d) => [d.id, d]));
  const limite = agora.getTime() + ANTECEDENCIA_MIN * 60_000;
  const out: Record<string, string[]> = { ...log };
  const tem = (dia: string, id: string) => Array.isArray(out[dia]) && out[dia].includes(id);
  const movidas: MarcaMovida[] = [];
  for (const s of depois.itens) {
    const velha = velhas.get(s.id);
    const nova = novas.get(s.id);
    const marcada = !!velha && Array.isArray(log[velha.dia]) && log[velha.dia].includes(s.id);
    const vai = marcada && !!nova && nova.quando <= limite;
    if (marcada && velha && (!vai || velha.dia !== nova?.dia)) {
      out[velha.dia] = out[velha.dia].filter((x) => x !== s.id);
      movidas.push({ id: s.id, de: velha.dia, para: vai && nova ? nova.dia : null });
    }
    if (!nova) continue;
    if (vai && !tem(nova.dia, s.id)) out[nova.dia] = [...(out[nova.dia] ?? []), s.id];
    else if (!vai && tem(nova.dia, s.id)) {
      out[nova.dia] = out[nova.dia].filter((x) => x !== s.id); // a marca de outra dose que cairia nesta
      movidas.push({ id: s.id, de: nova.dia, para: null });
    }
  }
  return { log: out, movidas };
}

/** Tratamento encerrado: a última ocorrência de cada linha (o dia em que ela foi registrada, se foi). */
export function ultimasDosesDoGrupo(g: GrupoDeRemedio): DoseMarcavel[] {
  const primeira = primeiraDe(g);
  return g.itens.map((s) => {
    const dia = ultimoDiaDaDose({ time: s.time, ate: g.ate }, primeira) ?? (ehDia(g.ate) ? g.ate : localDayKey());
    return { ...s, dia, quando: ehHora(s.time) ? momentoDe(dia, s.time).getTime() : 0 };
  });
}

/** As linhas de um cadastro: uma por horário; com 2+ horários, todas levam o mesmo `grupo` e o `inicio` (a 1ª dose). */
export function montarLinhas(
  base: { name: string; quem?: string; stock: number },
  horarios: string[],
  ate?: string,
  agora: number = Date.now(),
): Remedio[] {
  const lista = horarios.length ? horarios : [""];
  const grupo = lista.length > 1 ? String(agora) : undefined;
  const inicio = grupo ? inicioDoCadastro(lista[0], new Date(agora), lista) : undefined;
  const quem = base.quem?.trim();
  return lista.map((time, i) => ({
    id: i === 0 ? String(agora) : `${agora}-${i}`,
    name: base.name,
    time,
    stock: base.stock,
    dosesPerDay: 1,
    ...(quem ? { quem } : {}),
    ...(grupo ? { grupo } : {}),
    ...(ehDia(ate) ? { ate } : {}),
    ...(inicio ? { inicio } : {}),
  }));
}
