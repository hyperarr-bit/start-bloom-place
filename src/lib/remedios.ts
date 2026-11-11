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
  /** 08/11: horário mudado — o de antes, que vale até o fim do dia `antesAte` (ver `mudarHorarios`) */
  horaAntes?: string;
  /** 08/11: o último dia (do tratamento) com os horários de antes ("AAAA-MM-DD") */
  antesAte?: string;
  /** 08/11: o momento da 1ª dose com os horários novos ("AAAA-MM-DDTHH:MM") */
  novoDesde?: string;
  /** 08/11: o id que a linha tinha, quando a dose de antes e a nova caem no mesmo dia do calendário */
  idAntes?: string;
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
 * Nunca ONTEM (07/11, 4ª rodada da crítica): às 06:00, um 12 em 12 com 1ª dose
 * 20:00 começava ontem 20:00 e a dose das 08:00 de hoje já aparecia devida; agora
 * é hoje 20:00. É a SUGESTÃO do cadastro — a pessoa vê "Começa hoje/amanhã" e troca.
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
  const dia = [hoje, somarDias(hoje, 1)]
    .find((d) => Math.abs(momentoDe(d, primeira).getTime() - agora.getTime()) <= meioDia) ?? hoje;
  return `${dia}T${primeira}`;
}

/**
 * "Começa hoje 08:00" / "Começa amanhã 08:00" (07/11, 4ª rodada da crítica): o
 * cadastro mostra o começo calculado e um toque troca entre hoje e amanhã. Quem
 * cadastra às 23:30 um 8 em 8 desde 08:00 e só vai começar amanhã escolhe
 * "amanhã" — e não recebe aviso à meia-noite de uma dose que não vai tomar.
 * `dia` ausente = a sugestão (`inicioDoCadastro`).
 *
 * O que a pessoa escolhe é o DIA ("AAAA-MM-DD"), guardado na hora do toque, não
 * "amanhã" (crítica de fora, 08/11, F3): "amanhã" escolhido às 23:58 e o + tocado
 * às 00:01 virava DEPOIS de amanhã — um dia inteiro sem aviso. `amanha` só diz como
 * mostrar ("hoje"/"amanhã") comparando esse dia com o de agora. Um dia que já passou
 * não vale: volta a sugestão (`passou: true`, pra tela avisar).
 */
export function inicioEscolhido(primeira: string, horarios: string[], dia?: string, agora: Date = new Date()): { inicio: string; amanha: boolean; passou: boolean } | undefined {
  const sugerido = inicioDoCadastro(primeira, agora, horarios);
  if (!sugerido) return undefined;
  const hoje = localDayKey(agora);
  const diaDeAmanha = somarDias(hoje, 1);
  const passou = ehDia(dia) && dia < hoje;
  const escolhido = ehDia(dia) && !passou ? dia : sugerido.slice(0, 10);
  return { inicio: `${escolhido}T${primeira}`, amanha: escolhido === diaDeAmanha, passou };
}

/**
 * Mudou a hora da 1ª dose na edição (as outras são geradas de novo a partir dela,
 * como no cadastro — `horarios` é a lista nova). O `inicio` acompanha:
 *  - tratamento que AINDA NÃO começou: o DIA que a pessoa escolheu fica, se a hora
 *    nova nesse dia ainda não passou — quem escolheu "Começa amanhã 08:00" e acerta
 *    pra 09:00 (ou 21:00) continua começando AMANHÃ (conserto final 07/11: refazia
 *    como cadastro agora e saía aviso de madrugada; crítica do conserto final: a
 *    "ocorrência mais perto" levava 21:00, 22:00 e 23:00 pra hoje à noite). O dia
 *    vizinho só ganha quando a troca atravessa a meia-noite por poucas horas (até 3 h):
 *    às 23:00, 00:30 de amanhã → 23:30 começa hoje 23:30. Se a hora nova no dia
 *    escolhido já passou, vale a ocorrência mais perto do início antigo entre as que
 *    AINDA VÊM (08/11, F4) — nunca um começo no passado;
 *  - já começado: a data fica e só a hora muda (07/11, retomada). Com a hora
 *    velha, adiantar 08:00 → 07:00 deixava a 1ª dose "antes do início do dia".
 */
const VIRADA_PERTO_MIN = 3 * 60;
export function inicioAoMudarPrimeira(inicio: unknown, hora: string, agora: Date = new Date(), _horarios: string[] = []): string | undefined {
  const quando = momentoDoInicio(inicio);
  if (!quando || !ehHora(hora)) return undefined;
  if (quando.getTime() > agora.getTime()) {
    const diaAntigo = String(inicio).slice(0, 10);
    const distancia = (d: string) => Math.abs(momentoDe(d, hora).getTime() - quando.getTime());
    const aindaVem = (d: string) => momentoDe(d, hora).getTime() > agora.getTime();
    const vizinhos = [somarDias(diaAntigo, -1), somarDias(diaAntigo, 1)];
    const cruzouAMeiaNoite = vizinhos.find((d) => distancia(d) <= VIRADA_PERTO_MIN * 60_000 && distancia(d) < distancia(diaAntigo) && aindaVem(d));
    if (cruzouAMeiaNoite) return `${cruzouAMeiaNoite}T${hora}`;
    if (aindaVem(diaAntigo)) return `${diaAntigo}T${hora}`;
    /* Só entre as ocorrências que AINDA VÊM (crítica de fora, 08/11, F4): um tratamento que não
       começou nunca passa a ter começado no passado. "Começa hoje 20:00" cadastrado às 10:00 e a 1ª
       dose mudada pra 08:00 às 10:30: hoje 08:00 e amanhã 08:00 ficavam a 12 h do início antigo, o
       empate ia pra hoje (que já passou) e caía no "cadastro agora" — começava hoje 08:00, antes do
       próprio cadastro, com dose devida e aviso hoje. Agora: amanhã 08:00. */
    const futuros = [diaAntigo, ...vizinhos, somarDias(diaAntigo, 2)].filter(aindaVem);
    const dia = futuros.reduce((melhor, d) => (distancia(d) < distancia(melhor) ? d : melhor));
    return `${dia}T${hora}`;
  }
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
 * A dose DA VEZ (07/11): a mais recente que já chegou; se nenhuma chegou, a
 * próxima. É a pílula destacada; a caixa usa `doseQueChegou` (só a que chegou). Pela ordem de cadastro, às 00:10 a caixa marcava a
 * das 08:00, e o aviso dela sumia sem ela ter sido tomada.
 *
 * "Já chegou" inclui a que vence em até 15 min (menos, se as doses estão a menos
 * de 30 min uma da outra) — conserto final 07/11: às 23:55, com a das 16:00
 * esquecida, a caixa marcava a das 16:00 e o aviso das 00:00 tocava 5 minutos
 * depois de a pessoa tomar. Era 1 h, e aí às 15:05, com a das 08:00 esquecida, o
 * toque marcava a das 16:00 (que ainda vinha), o aviso dela sumia e a pessoa podia
 * pular uma dose (crítica do conserto final). Quem quer marcar a outra toca a pílula.
 *
 * Com `quando` (o momento daquela dose, de `dosesDoGrupoAgora`) a conta é pelo
 * momento de verdade, não pela hora do relógio: às 23:50 a das 00:00 é a de
 * daqui a 10 minutos (amanhã), e às 07:55 do 1º dia a das 00:00 nem existe.
 */
const FOLGA_DA_CAIXA_MIN = 15;
function dosesPelaFolga<T extends { time: string; quando?: number }>(doses: T[], agora: Date): { chegou?: T; proxima?: T } {
  const hoje = localDayKey(agora);
  const quandoDe = (d: T) => d.quando ?? (ehHora(d.time) ? momentoDe(hoje, d.time).getTime() : 0);
  const emOrdem = [...doses].sort((a, b) => quandoDe(a) - quandoDe(b));
  const intervalos = emOrdem.slice(1).map((d, i) => quandoDe(d) - quandoDe(emOrdem[i])).filter((x) => x > 0);
  const folga = Math.min(FOLGA_DA_CAIXA_MIN * 60_000, intervalos.length ? Math.floor(Math.min(...intervalos) / 2) : Infinity);
  const t = agora.getTime() + folga;
  return { chegou: [...emOrdem].reverse().find((d) => quandoDe(d) <= t), proxima: emOrdem.find((d) => quandoDe(d) > t) };
}
export function doseDaHora<T extends { time: string; quando?: number }>(doses: T[], agora: Date = new Date()): T | undefined {
  const { chegou, proxima } = dosesPelaFolga(doses, agora);
  return chegou ?? proxima;
}

/**
 * A dose que a CAIXA marca (crítica de fora, 2ª rodada, 07/11 — decisão do dono):
 * só uma que JÁ CHEGOU (até agora + a folga de 15 min). Sem nenhuma, `undefined`
 * — nunca a próxima. Com `doseDaHora` (que cai na próxima), um 2º toque de quem
 * achou que o 1º não pegou marcava a das 16:00 às 08:05, e às 23:55 um toque só
 * marcava a das 02:00 de um 6 em 6: o aviso sumia e dava pra pular uma dose de
 * antibiótico. Marcar adiantado continua possível, mas só pela pílula do horário.
 */
export function doseQueChegou<T extends { time: string; quando?: number }>(doses: T[], agora: Date = new Date()): T | undefined {
  return dosesPelaFolga(doses, agora).chegou;
}

/**
 * A dose que a caixa DESMARCA (crítica de fora, 07/11). Com a folga de 15 min,
 * `doseDaHora` das tomadas às 23:30 é a das 16:00 — e o 2º toque, pra desfazer a
 * das 00:00 que o 1º acabou de marcar, tirava a das 16:00: o aviso das 00:00
 * sumia e a caixa pedia a das 16:00 de novo (2× a das 16:00, nenhuma das 00:00).
 * Desfaz primeiro a dose marcada que ainda não chegou (a mais cedo delas, a que a
 * caixa marcaria); só sem nenhuma assim vale a da hora.
 */
export function doseADesmarcar<T extends { time: string; quando?: number }>(tomadas: T[], agora: Date = new Date()): T | undefined {
  const t = agora.getTime();
  const quandoDe = (d: T) => d.quando ?? (ehHora(d.time) ? momentoDe(localDayKey(agora), d.time).getTime() : 0);
  const aindaVem = tomadas.filter((d) => quandoDe(d) > t).sort((a, b) => quandoDe(a) - quandoDe(b));
  return aindaVem[0] ?? doseDaHora(tomadas, agora);
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

/**
 * O id de sempre de uma linha: o id que `mudarHorarios` dá pras doses novas é "id~xxxx" (08/11).
 * A chave do remédio na tela sai daqui, pra a linha não sumir e voltar (nem a fileira de edição
 * fechar no meio da digitação) quando o id muda.
 */
export const raizDoId = (id: unknown): string => String(id ?? "").split("~")[0];

/** As linhas da chave viram uma lista de grupos (remédio simples = grupo de 1), na ordem de cadastro. */
export function agruparRemedios(lista: Remedio[]): GrupoDeRemedio[] {
  const grupos = new Map<string, Remedio[]>();
  for (const r of Array.isArray(lista) ? lista : []) {
    if (!r || typeof r !== "object") continue;
    const chave = typeof r.grupo === "string" && r.grupo ? `g:${r.grupo}` : `i:${raizDoId(r.id)}`;
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
 * Quanto antes da 1ª dose o dia do tratamento já vira: no MEIO do caminho entre a
 * última dose do dia (a da noite) e a 1ª — metade da folga entre elas, sem teto.
 * Em 8 em 8 desde 08:00 vira às 04:00; em 6 em 6, às 05:00; em 12 em 12 desde
 * 20:00, às 14:00. Com 07:30 e 08:00, às 07:20 a das 07:30 ainda é a de hoje à noite.
 * (Crítica de fora, rodada 2, 07/11: com teto de 1 h, às 06:30 a tela ainda era a de
 * ONTEM, e quem tomava a das 08:00 adiantado e tocava a pílula ou a caixa desmarcava
 * a dose de ontem — estoque +1, histórico sem uma dose tomada, aviso das 08:00
 * tocando: 2 comprimidos em 1 h e meia.) `ANTECEDENCIA_MIN` segue só pra quando não
 * há folga (horas iguais).
 */
const ANTECEDENCIA_MIN = 60;
function antecedenciaMin(horas: string[], primeira: string): number {
  const p = minutosDe(primeira);
  const folgas = horas.filter(ehHora).map((h) => (p - minutosDe(h) + 24 * 60) % (24 * 60)).filter((d) => d > 0);
  return folgas.length ? Math.floor(Math.min(...folgas) / 2) : ANTECEDENCIA_MIN;
}

/**
 * O DIA DA DOSE DE UM REMÉDIO DE 1× AO DIA (crítica de fora, 08/11, F2 e A3): o dia do
 * calendário da ocorrência da vez, que não é sempre o de hoje.
 *  - ONTEM, se a de ontem está mais perto do relógio que a de hoje (até 12 h pra trás —
 *    a mesma virada no meio do caminho do grupo): o remédio das 23:00 esquecido e tomado
 *    às 00:30 é o de ontem. Gravava em hoje: o aviso das 23:00 de hoje sumia e a caixa
 *    ficava ✓ o dia inteiro — a pessoa pulava a dose (anticoncepcional, remédio da noite).
 *  - AMANHÃ, se a de amanhã vem em até 3 h e está mais perto que a de hoje: o das 00:30
 *    tomado às 23:50 é o de daqui a 40 min (A3). Gravava em hoje, e o aviso das 00:30
 *    tocava depois de a pessoa tomar.
 *  - senão, a de hoje. Pra frente o limite é 3 h, e não 12 h, de propósito: o das 08:00
 *    olhado às 22:00 continua mostrando o ✓ de hoje (rodada 3, B1). Com 12 h, às 20:01 a
 *    caixa já seria a de amanhã, em aberto, e quem conferisse "já tomei hoje?" tomaria 2.
 * O registro continua no dia do calendário em que a dose acontece (formato igual); o
 * plano dos avisos já lê isso pelo tomadoHoje e pelo tomadoAmanha. Nunca passa do `ate`.
 */
const AMANHA_PERTO_MIN = 3 * 60;
function diaDaDoseUnica(hora: string, agora: Date, ate?: string): string {
  const hoje = localDayKey(agora);
  const t = agora.getTime();
  const longe = (d: string) => Math.abs(momentoDe(d, hora).getTime() - t);
  const ontem = somarDias(hoje, -1);
  const amanha = somarDias(hoje, 1);
  if (longe(ontem) < longe(hoje)) return ontem;
  const ateValido = !ehDia(ate) || amanha <= ate;
  if (ateValido && momentoDe(amanha, hora).getTime() - t <= AMANHA_PERTO_MIN * 60_000 && longe(amanha) < longe(hoje)) return amanha;
  return hoje;
}

/**
 * As doses que existem agora, pra marcar — cada linha UMA vez, a do DIA DO
 * TRATAMENTO de agora (07/11, 3ª rodada da crítica).
 *
 * Remédio simples (1 linha): a de hoje — ou a de ontem/amanhã perto da meia-noite
 * (`diaDaDoseUnica`, 08/11).
 * Grupo (8 em 8…): o dia do tratamento começa na 1ª dose (a hora atual da 1ª
 * linha) e vira no meio do caminho entre a dose da noite e ela (`antecedenciaMin`).
 * Em 8 em 8 desde as 08:00, das 04:00 de hoje às 04:00 de amanhã as pílulas são
 * 08:00 e 16:00 de hoje e 00:00 de amanhã — às
 * 23:50 a das 00:00 é a de daqui a 10 minutos (grava em amanhã), e às 00:10
 * continua sendo ela, já marcada. Antes do `inicio` o dia é o do início (às
 * 07:55 do 1º dia a das 00:00 é a da noite, não a de hoje); depois do `ate`,
 * o último dia (a dose da noite dele vale até a hora da 1ª dose).
 */
export function dosesDoGrupoAgora(g: GrupoDeRemedio, agora: Date = new Date()): DoseMarcavel[] {
  // horário mudado (08/11, simplificação): até o dia do tratamento virar valem os horários de antes
  const troca = trocaDoGrupo(g);
  if (!troca) return dosesSemTroca(g, agora);
  const antigo = grupoComHorasDeAntes(g);
  if (diaDaConta(antigo, agora) <= troca.antesAte) return dosesSemTroca(antigo, agora);
  return dosesSemTroca(g, agora, troca.novoDesde);
}

/**
 * O dia da conta de agora: o dia do tratamento (grupo) ou o dia da dose (1 linha).
 * Antes do `inicio` é o dia do início; depois do `ate`, o último dia.
 */
function diaDaConta(g: GrupoDeRemedio, agora: Date): string {
  if (g.itens.length <= 1) {
    const s = g.itens[0];
    return s && ehHora(s.time) ? diaDaDoseUnica(s.time, agora, g.ate) : localDayKey(agora);
  }
  const primeira = primeiraDe(g);
  const p = ehHora(primeira) ? primeira : "00:00";
  const inicioGravado = g.itens.find((s) => ehInicio(s.inicio))?.inicio;
  const antes = antecedenciaMin(g.itens.map((s) => s.time), p);
  let dia = localDayKey(new Date(agora.getTime() - (minutosDe(p) - antes) * 60_000));
  if (ehInicio(inicioGravado) && dia < inicioGravado.slice(0, 10)) dia = inicioGravado.slice(0, 10);
  if (ehDia(g.ate) && dia > g.ate) dia = g.ate;
  return dia;
}

/** A conta de sempre, com os horários das linhas. `desde`: antes dele não há dose (o começo dos horários novos). */
function dosesSemTroca(g: GrupoDeRemedio, agora: Date, desde?: Date): DoseMarcavel[] {
  if (tratamentoTerminou(g, agora)) return [];
  const primeira = primeiraDe(g);
  const hoje = localDayKey(agora);
  const t0 = desde?.getTime() ?? -Infinity;
  if (g.itens.length <= 1) {
    return g.itens
      .filter((s) => doseVale({ time: s.time, ate: g.ate }, primeira, agora))
      .map((s) => {
        if (!ehHora(s.time)) return { ...s, dia: hoje, quando: 0 };
        let dia = diaDaDoseUnica(s.time, agora, g.ate);
        // antes do começo dos horários novos não há dose: a da vez é a 1ª do horário novo
        while (momentoDe(dia, s.time).getTime() < t0) dia = diaSeguinte(dia);
        return { ...s, dia, quando: momentoDe(dia, s.time).getTime() };
      });
  }
  let dia = diaDaConta(g, agora);
  if (desde) {
    // o dia do tratamento da 1ª dose nova (a dose da noite é do dia anterior)
    const p = primeiraDe(g);
    const hDesde = horaDoRelogio(desde);
    const diaDoDesde = ehHora(p) && hDesde < p ? somarDias(localDayKey(desde), -1) : localDayKey(desde);
    if (dia < diaDoDesde && !(ehDia(g.ate) && diaDoDesde > g.ate)) dia = diaDoDesde;
  }
  return dosesDoDiaDoTratamento(g, dia).filter((d) => d.quando >= t0);
}

/**
 * As doses de UM dia do tratamento (o dia da 1ª dose), com as horas atuais do
 * grupo: a mesma conta de `dosesDoGrupoAgora`, mas com o dia dado em vez de
 * tirado do relógio. A dose da noite (hora antes da 1ª) cai no dia seguinte do
 * calendário; o que fica antes do `inicio` não existe.
 */
function dosesDoDiaDoTratamento(g: GrupoDeRemedio, dia: string): DoseMarcavel[] {
  const primeira = primeiraDe(g);
  const p = ehHora(primeira) ? primeira : "00:00";
  const inicio = momentoDoInicio(g.itens.find((s) => ehInicio(s.inicio))?.inicio)?.getTime() ?? -Infinity;
  const out: DoseMarcavel[] = [];
  for (const s of g.itens) {
    if (!ehHora(s.time)) continue;
    const doDia = s.time < p ? diaSeguinte(dia) : dia; // a dose da noite acontece no dia seguinte do calendário
    const quando = momentoDe(doDia, s.time).getTime();
    if (quando >= inicio) out.push({ ...s, dia: doDia, quando });
  }
  return out;
}

/**
 * MUDAR O HORÁRIO VALE A PARTIR DE AMANHÃ (decisão do dono, 08/11 — simplificação).
 * Mudar a hora de um remédio (a 1ª dose de um grupo, outra dose dele, ou o horário de um
 * remédio de 1 linha) não mexe em NENHUMA marca de "tomado": as doses do dia do tratamento
 * de agora seguem os horários de antes até o dia virar, e os horários novos começam depois.
 * Antes, a marca andava junto com a dose (`moverMarcasDoGrupo`, 07/11 e 08/11) — e cada
 * rodada da crítica achava um jeito novo de a marca cair na dose errada.
 *
 * Como fica gravado (campos novos, todos opcionais; o app antigo ignora e vê os horários
 * novos na hora, como sempre viu). Em cada linha:
 *  - `time`: o horário NOVO (é o que a fileira de edição e o app antigo mostram);
 *  - `horaAntes`: o horário de antes, que vale até o fim do dia `antesAte`;
 *  - `antesAte`: o último dia do tratamento com os horários de antes ("AAAA-MM-DD");
 *  - `novoDesde`: o momento da 1ª dose com os horários novos ("AAAA-MM-DDTHH:MM");
 *  - `idAntes` (só às vezes): o id que a linha tinha (o novo é "id~xxxx", ver `raizDoId`). O registro de "tomado" é "id no dia do
 *    calendário"; quando a dose de antes e a dose nova da mesma linha caem no MESMO dia do
 *    calendário (8 em 8: 08:00 → 07:00 faz a das 00:00 virar 23:00 — no dia seguinte há a
 *    00:00 de antes e a 23:00 nova), a linha ganha um id novo pras doses novas, e a marca da
 *    dose de antes fica onde está, no id de antes. Nenhuma marca muda de lugar.
 *
 * Quando começam os horários novos (`novoDesde`): na 1ª dose nova depois da virada do dia do
 * tratamento de antes e a mais de meio intervalo da última dose de antes (8 em 8 → 4 h; 1× ao
 * dia → 12 h) — nunca 2 comprimidos colados na troca. 8 em 8 desde 08:00, às 15:00 mudado pra
 * 07:00: hoje 08:00, 16:00 e 00:00; amanhã 07:00, 15:00 e 23:00.
 */
export type TrocaDeHorario = { antesAte: string; novoDesde: Date };
const temTroca = (s: Partial<Remedio> | undefined): boolean =>
  !!s && ehHora(s.horaAntes) && ehDia(s.antesAte) && ehInicio(s.novoDesde);

/** A troca de horário gravada no grupo (todas as linhas com os campos), ou nada. */
export function trocaDoGrupo(g: GrupoDeRemedio): TrocaDeHorario | undefined {
  if (!g.itens.length || !g.itens.every(temTroca)) return undefined;
  const novoDesde = momentoDoInicio(g.itens[0].novoDesde);
  return novoDesde ? { antesAte: String(g.itens[0].antesAte), novoDesde } : undefined;
}

/** O grupo com as horas (e os ids) de antes da troca. */
function grupoComHorasDeAntes(g: GrupoDeRemedio): GrupoDeRemedio {
  return { ...g, itens: g.itens.map((s) => ({ ...s, id: s.idAntes ?? s.id, time: String(s.horaAntes) })) };
}

/** Metade do menor intervalo entre duas doses seguidas (a volta da meia-noite conta): 8 em 8 → 4 h; 1 horário → 12 h. */
function meioIntervaloMin(horas: string[]): number {
  const m = [...new Set(horas.filter(ehHora).map(minutosDe))].sort((a, b) => a - b);
  if (m.length < 2) return 12 * 60;
  const folgas = m.map((x, i) => (i + 1 < m.length ? m[i + 1] - x : m[0] + 24 * 60 - x));
  return Math.floor(Math.min(...folgas) / 2);
}

const semCamposDaTroca = (s: Remedio): Remedio => {
  const { horaAntes: _h, idAntes: _i, antesAte: _a, novoDesde: _n, ...resto } = s;
  return resto;
};
const textoDoMomento = (x: Date) => `${localDayKey(x)}T${horaDoRelogio(x)}`;

/**
 * Mudar os horários de UM remédio (as linhas dele, na ordem; `novos` = o horário novo de cada
 * linha). Devolve as linhas pra gravar e, se os horários novos ficaram pra depois, quando
 * começam (`novoDesde`, pra tela avisar).
 *  - Tratamento que ainda não começou (`inicio` no futuro): muda na hora, e o começo acompanha
 *    a 1ª dose (`inicioAoMudarPrimeira`) — não há dose de hoje pra proteger. `inicioDeAntes`: o
 *    começo de quando a fileira de edição abriu, pra conta não depender dos valores no meio da
 *    digitação.
 *  - Já começado: os horários de antes valem até o dia do tratamento de agora virar (ou o de
 *    hoje, se for depois: às 02:00 a das 00:00 de ontem à noite ainda é do dia de ontem, e
 *    "a partir de amanhã" é o dia de amanhã de verdade).
 *  - Mudar de novo antes de os horários novos começarem (digitando, ou a roda do iPhone passando
 *    por valores no meio, ou abrindo a fileira de novo): a conta parte sempre dos horários de
 *    antes; voltar pra eles desfaz a troca.
 */
export function mudarHorarios(itens: Remedio[], novos: string[], agora: Date = new Date(), inicioDeAntes?: string): { itens: Remedio[]; novoDesde?: string } {
  const g0 = agruparRemedios(itens)[0];
  if (!g0 || novos.length !== itens.length || !novos.every(ehHora)) return { itens };
  // a troca que ainda não começou continua sendo a mesma: parte dos horários (e ids) de antes
  const troca = trocaDoGrupo(g0);
  const ativa = !!troca && agora.getTime() < troca.novoDesde.getTime();
  const base = itens.map((s) => (ativa ? { ...semCamposDaTroca(s), id: s.idAntes ?? s.id, time: String(s.horaAntes) } : semCamposDaTroca(s)));
  if (novos.every((h, i) => h === base[i].time)) return { itens: base };
  const antigo: GrupoDeRemedio = { ...g0, itens: base };
  const varias = base.length > 1;

  // ainda não começou: muda já (sem dose de hoje pra proteger)
  const inicio = varias ? momentoDoInicio(base.find((s) => ehInicio(s.inicio))?.inicio) : null;
  if (inicio && inicio.getTime() > agora.getTime()) {
    const daqui = ehInicio(inicioDeAntes) && momentoDoInicio(inicioDeAntes)!.getTime() > agora.getTime() ? inicioDeAntes : base[0].inicio;
    const novoInicio = novos[0] !== base[0].time ? inicioAoMudarPrimeira(daqui, novos[0], agora, novos) : undefined;
    return { itens: base.map((s, i) => ({ ...s, time: novos[i], ...(novoInicio ? { inicio: novoInicio } : {}) })) };
  }

  // o último dia com os horários de antes: o dia do tratamento de agora, ou hoje (o que vier depois)
  const hoje = localDayKey(agora);
  const diaAgora = troca && ativa ? troca.antesAte : diaDaConta(antigo, agora);
  const antesAte = ativa && troca ? troca.antesAte : diaAgora > hoje ? diaAgora : hoje;
  const pAntes = primeiraDe(antigo);
  const dosesDeAntes = varias
    ? dosesDoDiaDoTratamento(antigo, antesAte)
    : base.filter((s) => ehHora(s.time)).map((s) => ({ ...s, dia: antesAte, quando: momentoDe(antesAte, s.time).getTime() }));
  if (!dosesDeAntes.length) return { itens: base.map((s, i) => ({ ...s, time: novos[i] })) };
  const ultima = Math.max(...dosesDeAntes.map((d) => d.quando));
  // a virada do dia de antes: o 1º momento (de 5 em 5 min) depois da última dose em que o dia da conta já é o
  // seguinte — de 5 em 5 min ela sai no máximo 5 min DEPOIS da virada de verdade, nunca antes
  const semFim: GrupoDeRemedio = { ...antigo, ate: undefined };
  let virada = ultima + 12 * 3600_000;
  for (let t = ultima + 5 * 60_000; t <= ultima + 48 * 3600_000; t += 5 * 60_000) {
    if (diaDaConta(semFim, new Date(t)) > antesAte) { virada = t; break; }
  }
  const limite = Math.max(virada, ultima + meioIntervaloMin(novos) * 60_000 + 1);
  // a 1ª dose nova depois do limite (de qualquer linha)
  const candidatas = novos.flatMap((h) => [-1, 0, 1, 2, 3].map((n) => momentoDe(somarDias(antesAte, n), h).getTime()));
  const novoDesde = Math.min(...candidatas.filter((q) => q >= limite));
  // cada linha: o dia do calendário da última dose de antes e o da 1ª dose nova
  const out = base.map((s, i) => {
    const ultimoDiaAntes = varias && s.time < pAntes ? diaSeguinte(antesAte) : antesAte;
    const primeiraNova = [-1, 0, 1, 2, 3].map((n) => somarDias(antesAte, n)).find((d) => momentoDe(d, novos[i]).getTime() >= novoDesde);
    const colide = primeiraNova !== undefined && primeiraNova <= ultimoDiaAntes;
    const atual = itens[i];
    const id = !colide ? s.id : ativa && atual.idAntes && atual.id !== s.id ? atual.id : `${raizDoId(s.id)}~${agora.getTime().toString(36)}`;
    return {
      ...s,
      id,
      time: novos[i],
      horaAntes: s.time,
      antesAte,
      novoDesde: textoDoMomento(new Date(novoDesde)),
      ...(colide ? { idAntes: s.id } : {}),
    };
  });
  return { itens: out, novoDesde: textoDoMomento(new Date(novoDesde)) };
}

/**
 * As linhas pro plano dos avisos (lib/reagendar): as em vigor (`dosesEmVigor`) e, na linha com
 * horário mudado, DUAS — a de antes (id de antes, até o dia da última dose de antes) e a nova
 * (a partir de `novoDesde`, pelo `inicio`). O plano dos avisos não muda.
 */
export function linhasDosAvisos<T extends { id?: string; time?: string; ate?: string; grupo?: string; inicio?: string; horaAntes?: string; idAntes?: string; antesAte?: string; novoDesde?: string }>(lista: T[], agora: Date = new Date()): T[] {
  const primeiraAntes = new Map<string, string>();
  for (const r of lista) if (r?.grupo && !primeiraAntes.has(r.grupo) && ehHora(r.horaAntes)) primeiraAntes.set(r.grupo, r.horaAntes);
  return dosesEmVigor(lista, agora).flatMap((r) => {
    if (!temTroca(r as Partial<Remedio>)) return [r];
    const horaAntes = String(r.horaAntes);
    const antesAte = String(r.antesAte);
    const pAntes = r.grupo ? primeiraAntes.get(r.grupo) : undefined;
    const ultimoDiaAntes = pAntes && horaAntes < pAntes ? diaSeguinte(antesAte) : antesAte;
    const ate = ehDia(r.ate) && r.ate < ultimoDiaAntes ? r.ate : ultimoDiaAntes;
    const novoDesde = String(r.novoDesde);
    return [
      { ...r, id: r.idAntes ?? r.id, time: horaAntes, ate },
      { ...r, inicio: ehInicio(r.inicio) && r.inicio > novoDesde ? r.inicio : novoDesde },
    ];
  });
}

/** Tratamento encerrado: a última ocorrência de cada linha (o dia em que ela foi registrada, se foi). */
export function ultimasDosesDoGrupo(g: GrupoDeRemedio): DoseMarcavel[] {
  const primeira = primeiraDe(g);
  return g.itens.map((s) => {
    const dia = ultimoDiaDaDose({ time: s.time, ate: g.ate }, primeira) ?? (ehDia(g.ate) ? g.ate : localDayKey());
    return { ...s, dia, quando: ehHora(s.time) ? momentoDe(dia, s.time).getTime() : 0 };
  });
}

/**
 * As linhas de um cadastro: uma por horário; com 2+ horários, todas levam o mesmo `grupo` e o `inicio` (a 1ª dose).
 * `inicio`: o que a pessoa escolheu em "Começa hoje/amanhã" (`inicioEscolhido`); sem ele, a sugestão.
 */
export function montarLinhas(
  base: { name: string; quem?: string; stock: number },
  horarios: string[],
  ate?: string,
  agora: number = Date.now(),
  inicioDaPessoa?: string,
): Remedio[] {
  const lista = horarios.length ? horarios : [""];
  const grupo = lista.length > 1 ? String(agora) : undefined;
  const inicio = !grupo ? undefined : ehInicio(inicioDaPessoa) ? inicioDaPessoa : inicioDoCadastro(lista[0], new Date(agora), lista);
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
