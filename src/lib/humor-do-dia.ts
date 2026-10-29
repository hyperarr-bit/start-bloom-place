/**
 * O HUMOR DO DIA É UM SÓ (1.0.22, 28/10, aprovado pelo dono).
 *
 * "Como você está hoje" existia em 3 lugares, cada um com a sua chave, e nenhum enxergava o outro:
 *   · Rotina › Minha Semana (e Diário) — `mood-log`      { [dia]: { mood: 1–5, note, emocoes? } }
 *   · Dev. Pessoal › Humor             — `dp-mood-log`   { [dia]: 1–5 }
 *   · "+" da Home (Check de Humor)     — `core-mood-log` { [dia]: { value: 1–5, emoji, time } }
 * O Humor do "+" é o 2º atalho mais usado (16% dos pagantes) e gravava numa chave que módulo NENHUM mostrava.
 *
 * Regra de ouro (financas_crash_app_antigo_28_09): nenhuma chave muda de formato e nada é migrado/reescrito.
 *  · LEITURA unificada: o humor de um dia é o da 1ª chave que tem registro válido (1–5), na ordem
 *    Rotina → "+" da Home → Dev. Pessoal. A ordem só importa em dia antigo com registros diferentes.
 *  · GRAVAÇÃO espelhada daqui pra frente: quem registra grava o MESMO valor nas 3 chaves, cada uma no formato dela
 *    (o app antigo, que lê só a sua, continua vendo o registro — e as 3 telas concordam).
 * As 3 escalas já são a mesma (1 = pior, 5 = melhor).
 */

export type LeituraHumor = <T>(chave: string, padrao: T) => T;
export type GravacaoHumor = (chave: string, valor: unknown) => void;

export const CHAVE_HUMOR_ROTINA = "mood-log";
export const CHAVE_HUMOR_HOME = "core-mood-log";
export const CHAVE_HUMOR_DP = "dp-mood-log";
/** a ordem de preferência da leitura */
export const CHAVES_DO_HUMOR = [CHAVE_HUMOR_ROTINA, CHAVE_HUMOR_HOME, CHAVE_HUMOR_DP] as const;
export type ChaveDoHumor = (typeof CHAVES_DO_HUMOR)[number];

/** emoji e rótulo do "+" da Home (os mesmos de lib/acoes-rapidas HUMORES) */
export const EMOJI_DO_HUMOR: Record<number, string> = { 1: "😡", 2: "😔", 3: "😐", 4: "🙂", 5: "🤩" };

const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const nota = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : null;
};

/** O valor 1–5 de UM registro de uma das 3 chaves (cada uma no seu formato), ou null. */
export function valorDoRegistro(chave: ChaveDoHumor, registro: unknown): number | null {
  if (registro === null || registro === undefined) return null;
  if (typeof registro === "number" || typeof registro === "string") return nota(registro);
  const r = mapa(registro);
  if (chave === CHAVE_HUMOR_ROTINA) return nota(r.mood ?? r.value);
  if (chave === CHAVE_HUMOR_HOME) return nota(r.value ?? r.mood);
  return nota(r.value ?? r.mood);
}

export interface HumorDoDia {
  valor: number;
  /** de qual chave veio */
  chave: ChaveDoHumor;
}

/** Os 3 mapas lidos de uma vez (útil pra hook com 3 estados). */
export type MapasDoHumor = Partial<Record<ChaveDoHumor, unknown>>;

export function humorDoDiaDosMapas(mapas: MapasDoHumor, dia: string): HumorDoDia | null {
  for (const chave of CHAVES_DO_HUMOR) {
    const v = valorDoRegistro(chave, mapa(mapas[chave])[dia]);
    if (v !== null) return { valor: v, chave };
  }
  return null;
}

export function humorDoDia(get: LeituraHumor, dia: string): HumorDoDia | null {
  return humorDoDiaDosMapas(lerMapas(get), dia);
}

export function lerMapas(get: LeituraHumor): MapasDoHumor {
  const out: MapasDoHumor = {};
  for (const chave of CHAVES_DO_HUMOR) out[chave] = get<unknown>(chave, {});
  return out;
}

/** O histórico unificado { dia: 1–5 } — cada dia pela mesma regra do `humorDoDia`. */
export function historicoDosMapas(mapas: MapasDoHumor): Record<string, number> {
  const dias = new Set<string>();
  for (const chave of CHAVES_DO_HUMOR) for (const d of Object.keys(mapa(mapas[chave]))) dias.add(d);
  const out: Record<string, number> = {};
  for (const d of dias) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const h = humorDoDiaDosMapas(mapas, d);
    if (h) out[d] = h.valor;
  }
  return out;
}

export function historicoDeHumor(get: LeituraHumor): Record<string, number> {
  return historicoDosMapas(lerMapas(get));
}

/** Os 3 mapas com o registro do dia espelhado — cada chave no SEU formato, preservando o resto do registro
 *  (a nota e as emoções da Rotina não se perdem). Função pura: quem chama grava. */
export function espelharHumor(mapas: MapasDoHumor, dia: string, valor: number, extra: { emoji?: string; time?: string } = {}): Record<ChaveDoHumor, Record<string, unknown>> {
  const v = nota(valor) ?? 3;
  const rotina = mapa(mapas[CHAVE_HUMOR_ROTINA]);
  const home = mapa(mapas[CHAVE_HUMOR_HOME]);
  const dp = mapa(mapas[CHAVE_HUMOR_DP]);
  const antesRotina = mapa(rotina[dia]);
  return {
    [CHAVE_HUMOR_ROTINA]: { ...rotina, [dia]: { ...antesRotina, mood: v, note: typeof antesRotina.note === "string" ? antesRotina.note : "" } },
    [CHAVE_HUMOR_HOME]: {
      ...home,
      [dia]: {
        value: v,
        emoji: extra.emoji ?? EMOJI_DO_HUMOR[v],
        time: extra.time ?? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    },
    [CHAVE_HUMOR_DP]: { ...dp, [dia]: v },
  } as Record<ChaveDoHumor, Record<string, unknown>>;
}

/** Grava o humor do dia nas 3 chaves (o "+" da Home, sem hook). */
export function gravarHumorNasTres(get: LeituraHumor, set: GravacaoHumor, dia: string, valor: number, extra: { emoji?: string; time?: string } = {}): void {
  const novos = espelharHumor(lerMapas(get), dia, valor, extra);
  for (const chave of CHAVES_DO_HUMOR) set(chave, novos[chave]);
}
