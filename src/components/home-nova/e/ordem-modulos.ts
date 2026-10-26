import { MODULOS, type Modulo } from "@/lib/modulos";

/**
 * A ORDEM DE FÁBRICA DOS MÓDULOS NA HOME NOVA (dono 26/10: "botar os mais usados em primeiro").
 *
 * Vale só pra quem NUNCA mexeu na ordem (prefs.order vazio): o `ordenar` de use-module-preferences continua mandando —
 * favoritos na frente e, com ordem gravada, a ordem da pessoa. A Home antiga (ModuleDrawer) não muda.
 *
 * Medida em 26/10: dias de uso por pessoa nos últimos 21 dias (module_analytics, sem o admin; cada pessoa conta 1 vez
 * por dia em cada módulo — quem usa muito não pesa mais que os outros). Finanças 2.974 · Rotina 2.151 · Saúde 1.631 ·
 * Treino 1.204 · Dieta 973 · Beleza 786 · Dev. Pessoal 761 · Casa 749 · Biblioteca 660 · Estudos 620 · Mente 536 ·
 * Carreira 498 · Relações 494 · Detox 469 · Pet 380 · Viagens 322. Módulo que não estiver aqui (novo) entra no fim.
 */
export const ORDEM_POR_USO = [
  "financas", "rotina", "saude", "treino",
  "dieta", "beleza", "desenvolvimento", "casa",
  "biblioteca", "estudos", "hiperfoco", "carreira",
  "relacionamentos", "detox", "pet", "viagens",
] as const;

const posicao = new Map<string, number>(ORDEM_POR_USO.map((id, i) => [id, i]));

/** Os módulos na ordem de fábrica da Home nova (os mais usados primeiro). */
export const modulosPorUso = (lista: readonly Modulo[] = MODULOS): Modulo[] =>
  [...lista].sort((a, b) => (posicao.get(a.id) ?? 99) - (posicao.get(b.id) ?? 99));
