import { comoMacros, idDoPlano, macrosRegistradas, type EntradaLog, type Macros, type MacrosPlano, ZERO } from "@/lib/dieta-macros";

/**
 * O QUE FOI COMIDO HOJE — uma conta só pra Home e Dieta (09/10).
 *
 * Chamado (iPhone): "coloquei o contador de calorias como widget e, apesar de
 * inserir as refeições, aparece 0/2000". O widget somava só `core-dieta-log`
 * (o que entra pela ação rápida da Home, pela busca TACO e pelo "segui" do
 * diário DESDE 18/09). Refeição marcada no diário da Dieta (`dieta-diary-v2`)
 * sem a entrada correspondente no log — diário marcado no app antigo, ou pela
 * web antes do sync — não contava; e a meta era um 2000 cravado numa chave
 * (`core-dieta-calories-goal`) que nenhuma tela deixa mudar, mesmo com o
 * cardápio da pessoa somando 1.650 kcal no dia.
 *
 * Aqui, puro e testável:
 *  - kcal e macros do dia = o log do dia + as refeições do diário marcadas como
 *    SEGUIDAS que NÃO têm entrada `plano-<refeição>` no log (sem contar duas
 *    vezes: quem marcou depois de 18/09 já está no log com esse id);
 *  - a meta = o total de kcal planejado no cardápio do dia, quando existe;
 *    senão a chave antiga (2000 por padrão). Nada novo é gravado.
 */

export const CHAVE_KCAL = "saude-meals-kcal";
export const CHAVE_META_KCAL_ANTIGA = "core-dieta-calories-goal";
export const META_KCAL_PADRAO = 2000;

/**
 * META DIÁRIA DE CALORIAS EDITÁVEL (10/10). Chamado: "como faço para alterar a
 * meta de calorias diárias?". Até aqui a meta era a soma do cardápio do dia
 * (senão a chave antiga, que nenhuma tela editava). Agora a Dieta (aba
 * CARDÁPIO) escolhe o MODO:
 *  - "auto" (padrão): soma das kcal do cardápio do dia; sem cardápio com kcal,
 *    a chave antiga (2000 por padrão) — exatamente o que sempre foi;
 *  - "fixa": o número que a pessoa digitou, gravado na CHAVE ANTIGA
 *    `core-dieta-calories-goal` (é o que o app antigo das lojas lê como meta)
 *    — vence o cardápio. A flag de modo é uma chave NOVA, que o app antigo
 *    ignora (lá a meta continua sendo a chave antiga, ou seja, o número fixo).
 */
export const CHAVE_META_KCAL_MODO = "dieta-meta-kcal-modo";
export type ModoMetaKcal = "auto" | "fixa";
export const normalizarModoMeta = (v: unknown): ModoMetaKcal => (v === "fixa" ? "fixa" : "auto");

/** A meta do dia pela regra acima (valor torto na chave antiga cai no padrão). */
export const metaDoDia = ({ kcalPlanejadas, metaAntiga, modo }: { kcalPlanejadas: number; metaAntiga?: unknown; modo?: unknown }): number => {
  const antiga = Number(metaAntiga);
  const fixa = antiga > 0 ? Math.round(antiga) : META_KCAL_PADRAO;
  if (normalizarModoMeta(modo) === "fixa") return fixa;
  return kcalPlanejadas > 0 ? kcalPlanejadas : fixa;
};

/** Soma das kcal planejadas de um dia do cardápio (valor torto conta 0). */
export const kcalDoPlano = (dia?: Record<string, unknown> | null) =>
  Object.values(dia ?? {}).reduce<number>((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);

type RegistroDoDiario = { meals?: Record<string, { followed?: boolean; note?: string } | null | undefined> } | undefined | null;

/** As refeições marcadas como "segui" no diário daquele dia. */
export const refeicoesSeguidas = (registro: RegistroDoDiario): string[] => {
  const meals = registro?.meals;
  if (!meals || typeof meals !== "object") return [];
  return Object.entries(meals).filter(([, m]) => !!m && typeof m === "object" && m.followed === true).map(([nome]) => nome);
};

export interface ConsumoDoDia {
  kcal: number;
  macros: Macros;
  /** entradas do log + refeições do diário que não estavam no log */
  refeicoes: number;
  /** kcal planejadas no cardápio do dia (0 = cardápio sem kcal) */
  kcalPlanejadas: number;
  /** a meta que o widget mostra */
  meta: number;
}

/**
 * Soma o dia: log + diário (só o que falta no log). `kcalPlano`/`macrosPlano`
 * são as linhas do cardápio DO DIA DA SEMANA (`saude-meals-kcal[dia]`,
 * `saude-meals-macros[dia]`); `metaAntiga` é o valor de `core-dieta-calories-goal`.
 */
export function consumoDoDia({
  log, diario, kcalPlano, macrosPlano, metaAntiga, modoMeta,
}: {
  log?: Record<string, Partial<EntradaLog> | undefined> | null;
  diario?: RegistroDoDiario;
  kcalPlano?: Record<string, unknown> | null;
  macrosPlano?: MacrosPlano[string] | null;
  metaAntiga?: unknown;
  /** `dieta-meta-kcal-modo` (10/10): "fixa" faz a chave antiga vencer o cardápio. */
  modoMeta?: unknown;
}): ConsumoDoDia {
  const entradas = log && typeof log === "object" ? log : {};
  let kcal = Object.values(entradas).reduce<number>((s, m) => s + (Number(m?.calories) || 0), 0);
  const macros = macrosRegistradas(entradas);
  let refeicoes = Object.keys(entradas).length;
  for (const refeicao of refeicoesSeguidas(diario)) {
    if (entradas[idDoPlano(refeicao)]) continue; // já está no log (sync de 18/09): não soma em dobro
    refeicoes += 1;
    const k = Number(kcalPlano?.[refeicao]);
    if (k > 0) kcal += k;
    const m = comoMacros(macrosPlano?.[refeicao]);
    macros.p += m.p; macros.c += m.c; macros.g += m.g;
  }
  const kcalPlanejadas = kcalDoPlano(kcalPlano);
  const meta = metaDoDia({ kcalPlanejadas, metaAntiga, modo: modoMeta });
  return { kcal: Math.round(kcal), macros: { ...ZERO, ...macros }, refeicoes, kcalPlanejadas, meta };
}

/** "SEGUNDA"… como o cardápio da Dieta indexa (segunda = índice 0 em `getDay()` 1). */
export const nomeDoDiaDieta = (d: Date = new Date()): string =>
  ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][d.getDay()];
