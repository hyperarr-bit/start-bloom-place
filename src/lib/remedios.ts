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
 * `ate` (opcional) é o último dia do tratamento: depois dele o lembrete para
 * (lib/notificacoes planejarRemedios) e a linha aparece como "terminou".
 *
 * Por que não o "repetir" do sistema de notificações: ele não sabe que a
 * pessoa já tomou (o aviso de hoje some pra quem marcou) nem conhece a data
 * de fim — e cada dia é um aviso só, com os nomes do mesmo horário juntos.
 */

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
}

export const OPCOES_VEZES: ReadonlyArray<{ vezes: VezesAoDia; rotulo: string }> = [
  { vezes: 1, rotulo: "1× ao dia" },
  { vezes: 2, rotulo: "12 em 12" },
  { vezes: 3, rotulo: "8 em 8" },
  { vezes: 4, rotulo: "6 em 6" },
];

export const ehHora = (h: unknown): h is string => typeof h === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
export const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

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

/** As linhas de um cadastro: uma por horário; com 2+ horários, todas levam o mesmo `grupo`. */
export function montarLinhas(
  base: { name: string; quem?: string; stock: number },
  horarios: string[],
  ate?: string,
  agora: number = Date.now(),
): Remedio[] {
  const lista = horarios.length ? horarios : [""];
  const grupo = lista.length > 1 ? String(agora) : undefined;
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
  }));
}
