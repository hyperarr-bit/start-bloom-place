import { ehDia, somarDias } from "@/lib/sequencia";

/**
 * "Hoje falta 1 coisa pra manter: …" (26/09) — a sugestão é a ação do módulo
 * que a pessoa MAIS usa, medida pelo dado que ela deixou: em quantos dias dos
 * últimos 30 cada módulo tem registro. (A lista `core-dias-anotados` guarda só
 * o dia, não o módulo — por isso a conta vem das próprias chaves.)
 */

export interface AcaoDoDia {
  id: "gasto" | "habito" | "treino" | "humor" | "refeicao" | "qualquer";
  texto: string;
  rota: string;
}

export const ACAO_PADRAO: AcaoDoDia = { id: "qualquer", texto: "anotar qualquer coisa do seu dia", rota: "/home" };

type Leitor = <T>(key: string, fallback: T) => T;

const JANELA = 30;

/** Dias (da janela) em que um registro por dia tem conteúdo. */
const diasDeRegistro = (reg: unknown, desde: string, hoje: string, ok: (v: unknown) => boolean = (v) => !!v): Set<string> => {
  const out = new Set<string>();
  if (!reg || typeof reg !== "object" || Array.isArray(reg)) return out;
  for (const [dia, v] of Object.entries(reg as Record<string, unknown>)) {
    if (ehDia(dia) && dia >= desde && dia <= hoje && ok(v)) out.add(dia);
  }
  return out;
};

const contar = (get: Leitor, id: AcaoDoDia["id"], desde: string, hoje: string): number => {
  switch (id) {
    case "gasto": {
      const gastos = get<unknown[]>("finance-expenses", []);
      if (!Array.isArray(gastos)) return 0;
      const dias = new Set<string>();
      for (const g of gastos) {
        const dia = (g as { date?: unknown })?.date;
        if (typeof dia === "string" && ehDia(dia.slice(0, 10)) && dia.slice(0, 10) >= desde && dia.slice(0, 10) <= hoje) dias.add(dia.slice(0, 10));
      }
      // gasto sem data (formato antigo) ainda prova que o módulo é usado
      return dias.size || (gastos.length > 0 ? 1 : 0);
    }
    case "habito": {
      const n = diasDeRegistro(get("heatmap-log", {}), desde, hoje, (v) => (typeof v === "number" ? v > 0 : v === true)).size;
      if (n) return n;
      const grade = get<Record<string, unknown>>("rotina-habits-checked", {});
      const marcou = grade && typeof grade === "object" && Object.values(grade).some((l) => Array.isArray(l) && l.some(Boolean));
      return marcou ? 1 : 0;
    }
    case "treino": {
      const log = get<unknown[]>("saude-workout-log", []);
      return Array.isArray(log) ? new Set(log.filter((d): d is string => ehDia(d) && d >= desde && d <= hoje)).size : 0;
    }
    case "humor": {
      const a = diasDeRegistro(get("mood-log", {}), desde, hoje);
      const b = diasDeRegistro(get("core-mood-log", {}), desde, hoje);
      return new Set([...a, ...b]).size;
    }
    case "refeicao": {
      const n = diasDeRegistro(get("dieta-diary-v2", {}), desde, hoje, (v) => {
        const meals = (v as { meals?: Record<string, { followed?: boolean; note?: string }> })?.meals;
        return !!meals && Object.values(meals).some((m) => m?.followed || !!m?.note);
      }).size;
      if (n) return n;
      const plano = get<Record<string, unknown>>("saude-meals", {});
      return plano && typeof plano === "object" && Object.keys(plano).length > 0 ? 1 : 0;
    }
    default:
      return 0;
  }
};

const CANDIDATAS: AcaoDoDia[] = [
  { id: "gasto", texto: "registrar um gasto", rota: "/financas" },
  { id: "habito", texto: "marcar um hábito", rota: "/rotina" },
  { id: "treino", texto: "marcar o treino", rota: "/treino" },
  { id: "humor", texto: "anotar como você está", rota: "/rotina" },
  { id: "refeicao", texto: "marcar uma refeição", rota: "/dieta" },
];

/** A ação do módulo mais usado nos últimos 30 dias (empate: a ordem acima). */
export function acaoMaisUsada(get: Leitor, hoje: string): AcaoDoDia {
  const desde = somarDias(hoje, -(JANELA - 1));
  let melhor = ACAO_PADRAO;
  let pontos = 0;
  for (const c of CANDIDATAS) {
    let n = 0;
    try { n = contar(get, c.id, desde, hoje); } catch { n = 0; }
    if (n > pontos) { melhor = c; pontos = n; }
  }
  return melhor;
}
