export type BadgeCategoria = "sequencia" | "finance" | "rotina" | "leitura" | "treino" | "dieta" | "saude" | "vida" | "geral";

/** Rótulo, ordem e rota das categorias — a ordem é a de uso real dos módulos. */
export const CATEGORIAS: { id: BadgeCategoria; label: string; emoji: string; rota: string }[] = [
  { id: "sequencia", label: "Sequência", emoji: "🔥", rota: "/home" },
  { id: "finance", label: "Finanças", emoji: "💰", rota: "/financas" },
  { id: "rotina", label: "Rotina", emoji: "📅", rota: "/rotina" },
  { id: "leitura", label: "Leitura", emoji: "📚", rota: "/biblioteca" },
  { id: "treino", label: "Treino", emoji: "🏋️", rota: "/treino" },
  { id: "dieta", label: "Dieta", emoji: "🥗", rota: "/dieta" },
  { id: "saude", label: "Saúde", emoji: "💧", rota: "/saude" },
  { id: "vida", label: "Vida", emoji: "🌱", rota: "/home" },
  { id: "geral", label: "CORE", emoji: "👑", rota: "/home" },
];

export const categoriaDe = (id: BadgeCategoria) => CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[CATEGORIAS.length - 1];

/* ------------------------------------------------------------------------- *
 * Raridade (27/09): pela posição na escada de cada módulo, nunca sorteio.
 * comum 50 XP · raro 100 · épico 200 · lendário 400.
 * ------------------------------------------------------------------------- */

export type Raridade = "comum" | "raro" | "epico" | "lendario";
export const RARIDADES: Raridade[] = ["comum", "raro", "epico", "lendario"];
export const XP_RARIDADE: Record<Raridade, number> = { comum: 50, raro: 100, epico: 200, lendario: 400 };
export const RARIDADE_LABEL: Record<Raridade, string> = { comum: "Comum", raro: "Raro", epico: "Épico", lendario: "Lendário" };
/** "épicos", "lendários" — pro "1 de 14 épicos do CORE". */
export const RARIDADE_PLURAL: Record<Raridade, string> = { comum: "comuns", raro: "raros", epico: "épicos", lendario: "lendários" };
/** O que a raridade dá de visual, em uma frase (detalhe do adesivo trancado). */
export const RARIDADE_VISUAL: Record<Raridade, string> = {
  comum: "adesivo comum",
  raro: "vem com a borda azul",
  epico: "vem com a borda holográfica",
  lendario: "brilha em ouro e ganha faíscas",
};

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategoria;
  unlocked: boolean;
  color: string;
  xp: number;
  /** Raridade declarada; sem ela, cai na conta pelo XP (raridadeDe). */
  raridade?: Raridade;
  /**
   * Quanto falta. Opcional porque nem toda conquista é numérica ("todas as
   * contas pagas" é sim/não). Quando existe, é o que ordena "Próximas
   * conquistas" por PROXIMIDADE em vez de por ordem de declaração.
   */
  progresso?: { atual: number; alvo: number };
  /**
   * Como o adesivo que falta mostra o progresso (26/09): "3/7" (contagem),
   * "R$ 80" (reais), "12%" (porcento), "620 xp" (xp), "5h/10h" (minutos).
   */
  formato?: "contagem" | "reais" | "porcento" | "xp" | "minutos";
  /**
   * Unidade do "falta": ["livro", "livros"] → "mais 1 livro". Sem unidade
   * (sim/não, ou medida por RECORDE de dias seguidos) o "falta" é a descrição.
   */
  unidade?: [string, string];
  /** Onde se conquista, quando não é a rota da categoria (Vida: pet, detox…). */
  rota?: { caminho: string; nome: string };
}

/** Raridade do adesivo: a declarada, ou pelo XP (50 comum · 100 raro · 200 épico · 400 lendário). */
export const raridadeDe = (b: Pick<Badge, "xp" | "raridade">): Raridade =>
  b.raridade ?? (b.xp >= 400 ? "lendario" : b.xp >= 200 ? "epico" : b.xp >= 100 ? "raro" : "comum");

/** 0..1. Sem progresso declarado, só existe trancada (0) ou aberta (1). */
export const fracaoDe = (b: Badge): number =>
  b.unlocked ? 1 : b.progresso && b.progresso.alvo > 0 ? Math.min(1, b.progresso.atual / b.progresso.alvo) : 0;

/* ------------------------------------------------------------------------- *
 * Níveis
 * ------------------------------------------------------------------------- */

export interface Level {
  name: string;
  minXP: number;
  icon: string;
  color: string;
}

/**
 * Escada nova (27/09), rebalanceada pra 65 adesivos com lendário a 400 XP
 * (máximo possível 8.850). Regra dura: NÍVEL NUNCA CAI — quem já era Ouro na
 * escada antiga continua Ouro (piso gravado em `conquistas-nivel-piso`).
 */
export const LEVELS: Level[] = [
  { name: "Bronze", minXP: 0, icon: "🥉", color: "from-amber-700 to-amber-600" },
  { name: "Prata", minXP: 300, icon: "🥈", color: "from-slate-400 to-slate-300" },
  { name: "Ouro", minXP: 800, icon: "🥇", color: "from-yellow-500 to-amber-400" },
  { name: "Platina", minXP: 1600, icon: "💎", color: "from-cyan-400 to-blue-400" },
  { name: "Diamante", minXP: 3000, icon: "👑", color: "from-purple-500 to-pink-400" },
];

/** A escada de antes (até 26/09): serve só pra calcular o piso de quem já tinha nível. */
export const LEVELS_ANTIGOS: { name: string; minXP: number }[] = [
  { name: "Bronze", minXP: 0 },
  { name: "Prata", minXP: 200 },
  { name: "Ouro", minXP: 500 },
  { name: "Platina", minXP: 1000 },
  { name: "Diamante", minXP: 2000 },
];

/** O nível mais alto já alcançado, gravado como nome ("Ouro"). */
export const CHAVE_NIVEL_PISO = "conquistas-nivel-piso";

export const indiceDoNivel = (nome: unknown): number => (typeof nome === "string" ? LEVELS.findIndex((l) => l.name === nome) : -1);

/** Nível só pelo XP, na escada nova (sem piso). */
export const nivelPeloXp = (xp: number): Level => [...LEVELS].reverse().find((l) => xp >= l.minXP) || LEVELS[0];

/** Nível pela escada antiga — o piso de quem migrou. */
export const nivelPelaEscadaAntiga = (xpAntigo: number): Level => {
  const antigo = [...LEVELS_ANTIGOS].reverse().find((l) => xpAntigo >= l.minXP) || LEVELS_ANTIGOS[0];
  return LEVELS[indiceDoNivel(antigo.name)] ?? LEVELS[0];
};

/** Nível efetivo: o do XP ou o piso gravado, o que for MAIOR (nível nunca cai). */
export const getLevel = (xp: number, piso?: unknown): Level => {
  const porXp = nivelPeloXp(xp);
  const iPiso = indiceDoNivel(piso);
  return iPiso > indiceDoNivel(porXp.name) ? LEVELS[iPiso] : porXp;
};

/** O nível seguinte ao efetivo (null no Diamante). */
export const getNextLevel = (xp: number, piso?: unknown): Level | null => {
  const idx = indiceDoNivel(getLevel(xp, piso).name);
  return LEVELS[idx + 1] ?? null;
};
