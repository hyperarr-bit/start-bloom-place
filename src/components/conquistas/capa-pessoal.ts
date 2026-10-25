import type { Badge } from "../gamification/types";

export const CHAVE_CAPA_PESSOAL = "conquistas-album-capa-v1";
export const CORES_CAPA = {
  azul: { nome: "Azul tinta", cor: "#304463", clara: "#e6ebf0" },
  coral: { nome: "Coral", cor: "#b95248", clara: "#f6e6df" },
  salvia: { nome: "Sálvia", cor: "#577467", clara: "#e5ede5" },
  lavanda: { nome: "Lavanda", cor: "#80618c", clara: "#eee7f1" },
  petroleo: { nome: "Petróleo", cor: "#386f7b", clara: "#e2eef0" },
  caramelo: { nome: "Caramelo", cor: "#946737", clara: "#f1e6d6" },
} as const;
export type CorCapa = keyof typeof CORES_CAPA;
export interface CapaPessoal { cor: CorCapa; /** null: composição automática; []: só a capa. */ figurinhas: string[] | null }

export function lerCapaPessoal(valor: unknown): CapaPessoal {
  const v = valor && typeof valor === "object" ? valor as Partial<CapaPessoal> : {};
  return {
    cor: typeof v.cor === "string" && Object.prototype.hasOwnProperty.call(CORES_CAPA, v.cor) ? v.cor : "azul",
    figurinhas: Array.isArray(v.figurinhas) ? [...new Set(v.figurinhas.filter((id): id is string => typeof id === "string"))].slice(0, 3) : null,
  };
}

/** A seleção manual permanece estável. A automática usa somente as já coladas. */
export function figurinhasDaCapa(capa: CapaPessoal, adesivos: Badge[], datas: Record<string, string> = {}, pendentes: string[] = []): Badge[] {
  const ganhas = adesivos.filter(b => b.unlocked && !b.arquivada);
  if (capa.figurinhas !== null) return capa.figurinhas.map(id => ganhas.find(b => b.id === id)).filter((b): b is Badge => !!b).slice(0, 3);
  return ganhas.filter(b => !pendentes.includes(b.id)).sort((a, b) => (datas[b.id] ?? "").localeCompare(datas[a.id] ?? "") || a.id.localeCompare(b.id)).slice(0, 3);
}

/** Sugere duas ações reais, priorizando progresso e módulos já usados; uma por módulo. */
export function proximasFigurinhas(adesivos: Badge[]): Badge[] {
  const uso = new Map<string, number>();
  for (const b of adesivos) if (b.unlocked && !b.arquivada) uso.set(b.category, (uso.get(b.category) ?? 0) + 1);
  const preferidas = ["first-expense", "rotina-1", "treino-1", "tarefa-1", "agua-1"];
  const candidatos = adesivos.filter(b => !b.unlocked && !b.arquivada && b.category !== "sequencia" && b.id !== "master");
  const peso = (b: Badge) => {
    const p = b.progresso;
    const fracao = p && p.alvo > 0 ? Math.min(.99, p.atual / p.alvo) : 0;
    return (fracao > 0 ? 100 : 0) + fracao * 30 + Math.min(10, uso.get(b.category) ?? 0) * 3 + (preferidas.includes(b.id) ? 12 - preferidas.indexOf(b.id) : 0) + (p?.alvo === 1 ? 5 : 0);
  };
  candidatos.sort((a, b) => peso(b) - peso(a) || a.id.localeCompare(b.id));
  const categorias = new Set<string>();
  return candidatos.filter(b => { if (categorias.has(b.category)) return false; categorias.add(b.category); return true; }).slice(0, 2);
}
