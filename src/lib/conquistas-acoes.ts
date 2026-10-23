/** Evidências que não podem ser reconstruídas só pelo estado atual.
 * Escritas de sistema e abertura de telas não passam por este registro. */
export const CHAVE_ACOES_CONQUISTAS = "conquistas-acoes-caderno";
export type RegistroAcoes = Record<string, string[]>;
export const mapa = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
export const itens = (v: unknown): Record<string, any>[] => Array.isArray(v) ? v.filter(x => x && typeof x === "object" && !Array.isArray(x)) : [];
export const texto = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;
export const numero = (v: unknown): number => (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v)) ? Number(v) : 0;
export const diaValido = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  // Confere a data do calendário (31/02 não existe) sem toISOString — a trava de datas-locais.
  const [a, m, dd] = v.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, dd, 12));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === dd;
};
export function registrarAcao(registro: unknown, acao: string, dia: string): RegistroAcoes {
  const r: RegistroAcoes = {};
  for (const [k, v] of Object.entries(mapa(registro))) {
    if (Array.isArray(v)) r[k] = [...new Set(v.filter(diaValido))].sort().slice(-400);
  }
  if (diaValido(dia)) r[acao] = [...new Set([...(r[acao] ?? []), dia])].sort().slice(-400);
  return r;
}
const nomesHabitos = (v: unknown) => Array.isArray(v) ? v.map(x => typeof x === "string" ? x.trim() : String(x?.name ?? x?.nome ?? "").trim()).filter(Boolean) : [];
// Check de exercício não é personalização do plano.
const desenhoPlano = (v: unknown) => Object.entries(mapa(v)).map(([dia, d]) => [dia, itens(d?.exercises).map(e => [e.name, e.sets, e.reps, e.carga, e.tipo, e.duracao])]);
const CHAVES_OBSERVADAS = new Set(["finance-wishlist", "saude-workouts-v2", "rotina-schedule", "saude-meals", "saude-fast-start", "rotina-habits"]);
export function acoesDaEscrita(chave: string, anterior: unknown, proximo: unknown): string[] {
  if (!CHAVES_OBSERVADAS.has(chave)) return [];
  if (JSON.stringify(anterior) === JSON.stringify(proximo)) return [];
  if (chave === "finance-wishlist") {
    const antes = new Map(itens(anterior).map(i => [i.id, numero(i.savedAmount)]));
    return itens(proximo).some(i => texto(i.name) && numero(i.savedAmount) > (antes.get(i.id) ?? 0)) ? ["poupar"] : [];
  }
  if (chave === "saude-workouts-v2") return JSON.stringify(desenhoPlano(anterior)) !== JSON.stringify(desenhoPlano(proximo)) && Object.values(mapa(proximo)).some(d => itens(d?.exercises).some(e => texto(e.name))) ? ["plano-treino"] : [];
  if (chave === "rotina-schedule") return Object.values(mapa(proximo)).some(v => Object.values(mapa(v)).some(texto)) ? ["agenda-rotina"] : [];
  if (chave === "saude-meals") return Object.values(mapa(proximo)).some(v => Object.values(mapa(v)).some(texto)) ? ["plano-refeicoes"] : [];
  if (chave === "saude-fast-start") return texto(proximo) && Number.isFinite(Date.parse(proximo as string)) ? ["jejum"] : [];
  if (chave === "rotina-habits") {
    const antes = new Set(nomesHabitos(anterior));
    // Guardar o nome permite exigir que o hábito criado seja efetivamente marcado.
    return nomesHabitos(proximo).filter(n => !antes.has(n)).map(n => `habito:${n}`);
  }
  return [];
}
