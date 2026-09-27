import type { Badge, Raridade } from "@/components/gamification/types";
import type { CapaId } from "./CapaPlanner";

/**
 * Os dados de hoje que as 4 artes dos Stories (e os vídeos) usam. Num módulo
 * só de tipos pra SeletorDeArte, compartilhar-conquistas e o vídeo lerem sem
 * importar um ao outro.
 */
export interface DadosArtes {
  capa: CapaId;
  nome: string;
  membroDesde: string;
  dias: number;
  nivel: string;
  xp: number;
  adesivos: number;
  total: number;
  /** "DESDE 2026" da carteirinha. */
  ano: number;
  /** Os mais raros colados (até 6, do mais raro pro mais comum) — a 1ª página do álbum. */
  maisRaros: Badge[];
  /** Com pouco adesivo: os mais perto de colar (silhuetas na 1ª página). */
  proximos: Badge[];
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  /** "SETEMBRO · 2026" */
  mes: string;
}

/** As artes que existem em vídeo além de imagem. */
export type ArteComVideo = "capa" | "album";
