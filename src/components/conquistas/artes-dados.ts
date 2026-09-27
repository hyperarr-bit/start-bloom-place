import type { Badge, Raridade } from "@/components/gamification/types";
import type { Insignia } from "./insignias";

/**
 * Os dados de hoje que as artes dos Stories (e os vídeos) usam. Num módulo só
 * de tipos pra SeletorDeArte, compartilhar-conquistas e o vídeo lerem sem
 * importar um ao outro.
 */
export interface DadosArtes {
  nome: string;
  membroDesde: string;
  dias: number;
  nivel: string;
  xp: number;
  adesivos: number;
  total: number;
  /** Os mais raros colados (até 6, do mais raro pro mais comum) — a 1ª página do álbum. */
  maisRaros: Badge[];
  /** Com pouco adesivo: os mais perto de colar (silhuetas na 1ª página). */
  proximos: Badge[];
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  /** Toda a coleção, na ordem (o número da figurinha é a posição aqui). */
  figurinhas: Badge[];
  /** "SETEMBRO · 2026" */
  mes: string;
  mesIdx: number;
  ano: number;
  /** A conquista do mês (o herói) — null sem nenhuma faixa. */
  heroi: Insignia | null;
  /** As 3 melhores de áreas diferentes (o Story "Minhas 3 conquistas"). */
  tres: Insignia[];
  /** As candidatas a herói, da melhor pra pior (pra trocar antes de postar). */
  candidatas: Insignia[];
  valoresLigados: boolean;
}

/** As artes que existem em vídeo além de imagem. */
export type ArteComVideo = "conquista" | "tres" | "album";
