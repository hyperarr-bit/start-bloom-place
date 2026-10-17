import { localDayKey } from "@/lib/utils";
import { marcadosDoDia, nomesDosHabitos } from "@/lib/rotina-habitos";

/**
 * O LEMBRETE DE MANHÃ DA ROTINA (1.0.16, 17/10 — "Rotina pronta em 3 toques", 3ª pergunta).
 *
 * "Quer um lembrete de manhã?" → Sim: UM aviso por dia, 15 minutos depois da hora em que a pessoa
 * acorda (acordou às 7h → 07:15), com os hábitos do dia: "☀️ Bom dia! Sua rotina de hoje" ·
 * "Beber água · Treinar · Estudar · Dormir cedo". O toque abre a Rotina.
 *
 * Mesma infraestrutura dos outros diários (o skincare é o molde): notificação LOCAL do app, série
 * limpa e refeita a cada mudança na faixa própria (notificacoes → BASES.rotinaManha = 1820000,
 * ids 1820000–1820010: um por dia, 11 dias), texto congelado no agendamento. Então:
 *  - HOJE é o único dia de que sabemos mais: o que já foi marcado sai do aviso ("Falta: Treinar ·
 *    Estudar"); tudo marcado = o aviso de hoje não existe. Marcar muda o dado → o useLembretes reagenda.
 *  - os dias seguintes levam a lista inteira (verdade em qualquer cenário).
 *  - sem hábito nenhum (apagou todos), nada é agendado.
 *
 * O "1 aviso por dia" do teste: este é aviso de USO que a pessoa PEDIU (como skincare, remédio,
 * compromisso), não um dos avisos que o app manda sozinho no teste (dia 2, aviso do teste, semana do
 * pagante — esses seguem 1 por dia entre eles). Fica no horário da manhã DELA, nunca mais de 1 por dia,
 * e em :15 de propósito — os outros diários tocam em hora cheia ou na meia (limite 08:00, skincare
 * 07:30, fechamento 21:00): dois no mesmo minuto chegam empilhados.
 *
 * Nasce DESLIGADO (todo diário nasce assim): só liga com o "Sim" da pergunta ou na central de
 * notificações (que também desliga e muda a hora). Chave NOVA (`rotina-lembrete-manha-prefs`): nada de
 * campo novo no `notif-prefs` — o app antigo relê aquele objeto com os campos que conhece e, ao gravar
 * qualquer interruptor, apagaria os daqui. O sufixo `-prefs` deixa a chave fora dos dias anotados.
 */

export const CHAVE_LEMBRETE_ROTINA_MANHA = "rotina-lembrete-manha-prefs";

export type LembreteRotinaManha = { ligado: boolean; hora: string };
export const LEMBRETE_MANHA_PADRAO: LembreteRotinaManha = { ligado: false, hora: "07:15" };
/** O aviso chega quando a pessoa já pegou o celular, antes do 1º item depois do despertar (A+30). */
export const MINUTOS_DEPOIS_DE_ACORDAR = 15;

const RE_HORA = /^(\d{1,2}):(\d{2})$/;
const normalizar = (h: unknown): string | null => {
  if (typeof h !== "string") return null;
  const m = RE_HORA.exec(h.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

/** "07:00" → "07:15" (passa da meia-noite sem quebrar). */
export function horaDoLembreteDaManha(acordar: string): string {
  const h = normalizar(acordar) ?? "07:00";
  const [hh, mm] = h.split(":").map(Number);
  const t = (((hh * 60 + mm + MINUTOS_DEPOIS_DE_ACORDAR) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Normaliza o que veio do storage — dado torto nunca derruba, só volta pro padrão. */
export const lerLembreteRotinaManha = (bruto: unknown): LembreteRotinaManha => {
  const b = (bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {}) as Partial<Record<keyof LembreteRotinaManha, unknown>>;
  return { ligado: b.ligado === true, hora: normalizar(b.hora) ?? LEMBRETE_MANHA_PADRAO.hora };
};

/* ------------------------------------------------------------ o que o aviso precisa saber */

type Leitor = <T>(key: string, fallback: T) => T;

export interface DadosRotinaManha {
  prefs: LembreteRotinaManha;
  /** os hábitos da Rotina, na ordem da tabela */
  habitos: string[];
  /** os que já estão marcados HOJE (a mesma regra da tabela: grade desta semana, senão o log por data) */
  feitosHoje: string[];
}

/** Lê de uma vez o que o aviso precisa (o `get` do useUserData ou o leitor sobreposto da central). */
export function lerDadosRotinaManha(get: Leitor, hoje: string = localDayKey()): DadosRotinaManha {
  const habitos = nomesDosHabitos(get<unknown>("rotina-habits", []));
  const checked = get<unknown>("rotina-habits-checked", {});
  const habitLog = get<unknown>("rotina-habit-log", {});
  const marcados = marcadosDoDia({
    nomes: habitos,
    checked: (checked && typeof checked === "object" ? checked : {}) as Record<string, boolean[]>,
    semana: String(get<unknown>("rotina-habits-week", "") ?? ""),
    habitLog: (habitLog && typeof habitLog === "object" ? habitLog : {}) as Record<string, string[]>,
    dia: hoje,
    hoje,
  });
  return {
    prefs: lerLembreteRotinaManha(get<unknown>(CHAVE_LEMBRETE_ROTINA_MANHA, undefined)),
    habitos,
    feitosHoje: habitos.filter((_, i) => marcados[i]),
  };
}

/* ------------------------------------------------------------ o texto e o plano */

/** "Beber água · Treinar · Estudar · Ler e mais 2" — no máximo 4 nomes. */
const listar = (nomes: string[]): string => {
  const vis = nomes.slice(0, 4);
  const resto = nomes.length - vis.length;
  return `${vis.join(" · ")}${resto > 0 ? ` e mais ${resto}` : ""}`;
};

/** O aviso de UM dia (também é a prévia da central). Null = não tem o que lembrar. */
export function textoDaManha(habitos: string[], feitos: string[] = []): { title: string; body: string } | null {
  if (!habitos.length) return null;
  const faltam = habitos.filter((h) => !feitos.includes(h));
  if (!faltam.length) return null;
  return {
    title: "☀️ Bom dia! Sua rotina de hoje",
    body: faltam.length < habitos.length ? `Falta: ${listar(faltam)}` : listar(faltam),
  };
}

export type AvisoDaManha = { quando: Date; title: string; body: string; id: number };

/** A mesma janela dos outros diários: 10 dias à frente sobrevivem a uma semana sem abrir o app. */
const HORIZONTE_DIAS = 10;

/**
 * Os avisos a agendar, com id na faixa (`base + i`): um por dia, na hora escolhida, nos próximos 10 dias,
 * só no futuro. PURA (recebe `agora`) pra ser testável sem plugin.
 */
export function planejarRotinaManha(d: DadosRotinaManha, base: number, agora: Date = new Date()): AvisoDaManha[] {
  if (!d.prefs.ligado || !d.habitos.length) return [];
  const [h, m] = d.prefs.hora.split(":").map(Number);
  const hoje = localDayKey(agora);
  const avisos: Omit<AvisoDaManha, "id">[] = [];
  for (let k = 0; k <= HORIZONTE_DIAS; k++) {
    const quando = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + k, h, m, 0, 0);
    if (quando.getTime() <= agora.getTime()) continue;
    const texto = textoDaManha(d.habitos, localDayKey(quando) === hoje ? d.feitosHoje : []);
    if (texto) avisos.push({ quando, ...texto });
  }
  return avisos.map((a, i) => ({ ...a, id: base + i }));
}
