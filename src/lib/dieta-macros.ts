/* =========================== MACROS (18/09) ===========================
 * Pedido do dono: "em dietas eu queria botar opção de botar macros como
 * proteína, calorias, carbo e etc, porque tem até um widget que mostra isso
 * na Home mas como não tem como anotar fica em branco".
 *
 * O widget "Macros do Dia" (MacroBalanceWidget) lê `protein/carbs/fat` de
 * cada refeição em `core-dieta-log` desde sempre — só que ninguém escrevia
 * esses campos. O caminho mais curto e que não incha a tela:
 *
 *  1. As gramas vivem numa chave PARALELA ao cardápio, `saude-meals-macros`,
 *     com o mesmo shape das kcal (dia → refeição → {p, c, g}). Mesmo motivo
 *     das CALORIAS (07/09): `saude-meals` tem quatro leitores e um
 *     normalizador; mudar o valor de string pra objeto quebraria todos.
 *  2. A pessoa digita UMA vez, no cardápio, na mesma linha das kcal. Não há
 *     campo de macro na hora de registrar: registrar "segui o almoço" copia
 *     as gramas planejadas pro log do dia. É o que um app de dieta faz — o
 *     plano já tem o número, o registro só confirma.
 *  3. A entrada no log tem id DETERMINÍSTICO (`plano-<refeição>`): marcar no
 *     diário e registrar na Home a mesma refeição escrevem a MESMA entrada,
 *     nunca somam em dobro. Desmarcar no diário apaga a entrada.
 */

export const CHAVE_MACROS = "saude-meals-macros";

/** Gramas de proteína (p), carboidrato (c) e gordura (g) de uma refeição. */
export type Macros = { p: number; c: number; g: number };
export type MacrosPlano = Record<string, Record<string, Macros>>;

/** Uma refeição registrada no dia (`core-dieta-log[data][id]`). */
export type EntradaLog = {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export const ZERO: Macros = { p: 0, c: 0, g: 0 };

/** Aceita "32", "32,5", " 32 g " — devolve 0 pra qualquer lixo ou negativo. */
export const lerGramas = (texto: unknown) => {
  const bruto = String(texto ?? "").trim();
  if (bruto.startsWith("-")) return 0;
  const n = Math.round(Number(bruto.replace(",", ".").replace(/[^\d.]/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const temMacros = (m?: Partial<Macros> | null) =>
  !!m && ((Number(m.p) || 0) > 0 || (Number(m.c) || 0) > 0 || (Number(m.g) || 0) > 0);

/** Normaliza qualquer coisa vinda do storage pra {p,c,g} inteiros. */
export const comoMacros = (m?: Partial<Macros> | null): Macros => ({
  p: lerGramas(m?.p), c: lerGramas(m?.c), g: lerGramas(m?.g),
});

/** Soma das gramas planejadas de um dia do cardápio. */
export const macrosDoPlano = (dia?: Record<string, Partial<Macros> | undefined> | null): Macros =>
  Object.values(dia ?? {}).reduce<Macros>((s, m) => {
    const x = comoMacros(m);
    return { p: s.p + x.p, c: s.c + x.c, g: s.g + x.g };
  }, { ...ZERO });

/** Soma do que foi registrado no dia (`core-dieta-log[data]`) — a MESMA conta
 *  do widget Macros do Dia, pra Dieta e Home mostrarem o mesmo número. */
export const macrosRegistradas = (log?: Record<string, Partial<EntradaLog> | undefined> | null): Macros =>
  Object.values(log ?? {}).reduce<Macros>((s, m) => ({
    p: s.p + (Number(m?.protein) || 0),
    c: s.c + (Number(m?.carbs) || 0),
    g: s.g + (Number(m?.fat) || 0),
  }), { ...ZERO });

/** "P 32g · C 45g · G 12g" — só o que for > 0; vazio quando não há nada. */
export const formatarMacros = (m?: Partial<Macros> | null) => {
  const x = comoMacros(m);
  const partes: string[] = [];
  if (x.p > 0) partes.push(`P ${x.p}g`);
  if (x.c > 0) partes.push(`C ${x.c}g`);
  if (x.g > 0) partes.push(`G ${x.g}g`);
  return partes.join(" · ");
};

/** kcal estimadas pelas gramas (4/4/9) — usado só como sugestão quando a
 *  pessoa preencheu macros e deixou kcal em branco. */
export const kcalDasMacros = (m?: Partial<Macros> | null) => {
  const x = comoMacros(m);
  return x.p * 4 + x.c * 4 + x.g * 9;
};

/** id da entrada do log que representa a refeição PLANEJADA daquele nome. */
export const idDoPlano = (refeicao: string) => `plano-${refeicao}`;

/** Monta a entrada do log a partir do plano (nome, kcal e gramas). */
export const entradaDoPlano = (
  refeicao: string,
  comida: string,
  kcal: number,
  macros?: Partial<Macros> | null,
): EntradaLog => {
  const m = comoMacros(macros);
  const e: EntradaLog = { name: `${refeicao}: ${comida}` };
  // Sem kcal digitada mas com gramas: estima 4/4/9. Quem preenche só os
  // macros também quer ver o widget de Calorias andar (dono, 18/09 à noite).
  const kcalFinal = kcal > 0 ? kcal : kcalDasMacros(m);
  if (kcalFinal > 0) e.calories = kcalFinal;
  if (m.p > 0) e.protein = m.p;
  if (m.c > 0) e.carbs = m.c;
  if (m.g > 0) e.fat = m.g;
  return e;
};

/**
 * Diário → log: marcar "segui" grava a entrada `plano-<refeição>` no dia;
 * desmarcar ou marcar "não segui" apaga só essa entrada (o que a pessoa
 * registrou por fora, com outro id, fica). Devolve o log inteiro novo.
 */
export const sincronizarLogDoDiario = (
  log: Record<string, Record<string, EntradaLog>> | undefined | null,
  data: string,
  refeicao: string,
  seguiu: boolean,
  entrada: EntradaLog,
): Record<string, Record<string, EntradaLog>> => {
  const todo = { ...(log ?? {}) };
  const dia = { ...(todo[data] ?? {}) };
  const id = idDoPlano(refeicao);
  if (seguiu) dia[id] = entrada; else delete dia[id];
  if (Object.keys(dia).length) todo[data] = dia; else delete todo[data];
  return todo;
};
