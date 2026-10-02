import type { CapaId } from "@/components/conquistas/CapaPlanner";

/**
 * O FOGO QUE EVOLUI + AS CAPAS QUE O TEMPO LIBERA (02/10, dono: "sequência
 * tipo Duolingo: o fogo muda de cor e desbloqueia capas com o tempo, SEM
 * adicionar bloco na página").
 *
 * Tudo aqui é PURO (sem React, sem storage). Quem lê e grava é o card da
 * sequência e a orquestra dos momentos.
 *
 *  - o fogo olha os dias SEGUIDOS de agora: perdeu a sequência, volta pro
 *    laranja sem drama (nenhum aviso, nenhum vermelho);
 *  - a capa olha o RECORDE: o que já foi liberado nunca é tirado.
 *
 * Calibração (02/10, 6 dias de sequência nova no ar): 4 pessoas bateram 7
 * dias, ninguém 30 — o 7 é o 1º protetor e vira a 1ª troca de cor (a pessoa
 * vê o fogo mudar na primeira semana); 14 e 30 são as capas; 100 é o marco
 * lendário que já existe.
 */

export type FaixaId = "laranja" | "vermelho" | "roxo" | "azul" | "dourado";

export interface Faixa {
  id: FaixaId;
  /** 0…4 */
  indice: number;
  /** "fogo laranja" (nas frases). */
  nome: string;
  /** "FOGO LARANJA" (no selo). */
  rotulo: string;
  /** Primeiro dia seguido desta faixa. */
  min: number;
  /** A chama: miolo claro, meio, borda escura e o brilho atrás. */
  claro: string;
  meio: string;
  escuro: string;
  brilho: string;
  /** A faixa de cima do card (degradê) e a cor do texto nela. */
  cabecalho: [string, string];
  textoCabecalho: string;
  /** Borda do card no claro e no escuro. */
  borda: string;
  bordaEscuro: string;
  /** Fundo e texto do disco de "hoje" (claro / escuro). */
  hojeFundo: string;
  hojeFundoEscuro: string;
  hojeTexto: string;
  hojeTextoEscuro: string;
}

export const FAIXAS: Faixa[] = [
  {
    id: "laranja", indice: 0, nome: "fogo laranja", rotulo: "FOGO LARANJA", min: 1,
    claro: "#fde68a", meio: "#f97316", escuro: "#c2410c", brilho: "rgba(249,115,22,.55)",
    cabecalho: ["#fb923c", "#f43f5e"], textoCabecalho: "#ffffff",
    borda: "#fed7aa", bordaEscuro: "#5a3a25", hojeFundo: "#fff7ed", hojeFundoEscuro: "rgba(230,162,118,.12)", hojeTexto: "#ea580c", hojeTextoEscuro: "#E6A276",
  },
  {
    id: "vermelho", indice: 1, nome: "fogo vermelho", rotulo: "FOGO VERMELHO", min: 7,
    claro: "#fecaca", meio: "#ef4444", escuro: "#991b1b", brilho: "rgba(239,68,68,.6)",
    cabecalho: ["#ef4444", "#be123c"], textoCabecalho: "#ffffff",
    borda: "#fecaca", bordaEscuro: "#5c2a2a", hojeFundo: "#fef2f2", hojeFundoEscuro: "rgba(248,150,150,.12)", hojeTexto: "#b91c1c", hojeTextoEscuro: "#F59E9E",
  },
  {
    id: "roxo", indice: 2, nome: "fogo roxo", rotulo: "FOGO ROXO", min: 14,
    claro: "#e9d5ff", meio: "#a855f7", escuro: "#6b21a8", brilho: "rgba(168,85,247,.6)",
    cabecalho: ["#a855f7", "#6d28d9"], textoCabecalho: "#ffffff",
    borda: "#e9d5ff", bordaEscuro: "#43305e", hojeFundo: "#faf5ff", hojeFundoEscuro: "rgba(196,160,250,.13)", hojeTexto: "#7e22ce", hojeTextoEscuro: "#C4A6FA",
  },
  {
    id: "azul", indice: 3, nome: "fogo azul", rotulo: "FOGO AZUL", min: 30,
    claro: "#bae6fd", meio: "#3b82f6", escuro: "#1e40af", brilho: "rgba(59,130,246,.62)",
    cabecalho: ["#38bdf8", "#2563eb"], textoCabecalho: "#ffffff",
    borda: "#bfdbfe", bordaEscuro: "#2d3f61", hojeFundo: "#eff6ff", hojeFundoEscuro: "rgba(125,170,250,.13)", hojeTexto: "#1d4ed8", hojeTextoEscuro: "#8CB4F8",
  },
  {
    id: "dourado", indice: 4, nome: "fogo dourado", rotulo: "FOGO DOURADO", min: 100,
    claro: "#fff7cc", meio: "#f0b429", escuro: "#a16207", brilho: "rgba(245,196,50,.7)",
    cabecalho: ["#fde68a", "#d9a826"], textoCabecalho: "#3f2c02",
    borda: "#f6e0a0", bordaEscuro: "#5c4a1c", hojeFundo: "#fffbeb", hojeFundoEscuro: "rgba(240,205,110,.14)", hojeTexto: "#92600a", hojeTextoEscuro: "#E8C46A",
  },
];

/** A faixa do fogo pros dias seguidos de agora (0 dias = laranja, a tela mostra apagado). */
export const faixaDoFogo = (dias: number): Faixa => {
  const d = Number.isFinite(dias) ? Math.max(0, Math.floor(dias)) : 0;
  let achada = FAIXAS[0];
  for (const f of FAIXAS) if (d >= f.min) achada = f;
  return achada;
};

export const faixaPorId = (id: unknown): Faixa | null => FAIXAS.find((f) => f.id === id) ?? null;

/** A próxima faixa, ou null no topo. */
export const proximaFaixa = (dias: number): Faixa | null => FAIXAS[faixaDoFogo(dias).indice + 1] ?? null;

/** Quantos dias seguidos faltam pra próxima faixa (null no topo). */
export const diasParaProximaFaixa = (dias: number): number | null => {
  const p = proximaFaixa(dias);
  return p ? Math.max(1, p.min - Math.max(0, Math.floor(dias))) : null;
};

/** "faltam 3 dias pro fogo roxo" · "amanhã o fogo fica roxo" · null no topo. */
export const fraseDaProximaFaixa = (dias: number): string | null => {
  const p = proximaFaixa(dias);
  const faltam = diasParaProximaFaixa(dias);
  if (!p || faltam === null) return null;
  const cor = p.nome.replace("fogo ", "");
  return faltam === 1 ? `amanhã o fogo fica ${cor}` : `faltam ${faltam} dias pro ${p.nome}`;
};

/** Guarda a última faixa VISTA (0…4): a animação de subir toca só quando a de agora é maior. */
export const CHAVE_FOGO_VISTO = "conquistas-fogo-visto";

export const lerFaixaVista = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < FAIXAS.length ? v : null;

/**
 * O que fazer com a faixa de agora × a última vista:
 *  - "subiu": animação + evento `sequencia_faixa`;
 *  - "desceu": perdeu a sequência — volta quieto (sem animação, sem evento);
 *  - "igual": nada.
 * Sem nada gravado (1ª vez) é "igual": quem já está no roxo não ganha festa atrasada — só grava.
 */
export const mudancaDeFaixa = (agora: number, vista: number | null): "subiu" | "desceu" | "igual" => {
  if (vista === null) return "igual";
  return agora > vista ? "subiu" : agora < vista ? "desceu" : "igual";
};

/* ------------------------------------------------------------------ capas */

/** Capas que o tempo libera: o RECORDE de dias seguidos que a pessoa precisa ter alcançado. */
export const REQUISITO_DA_CAPA: Partial<Record<CapaId, number>> = {
  bordo: 14,
  noite: 30,
};

export const CAPAS_TRAVAVEIS = Object.keys(REQUISITO_DA_CAPA) as CapaId[];

export const diasPraCapa = (id: CapaId): number => REQUISITO_DA_CAPA[id] ?? 0;

/** A capa está liberada? As de saída sempre; as outras pelo recorde. */
export const capaLiberada = (id: CapaId, recorde: number): boolean => Math.max(0, Math.floor(recorde || 0)) >= diasPraCapa(id);

/** Quantos dias seguidos ainda faltam (0 = liberada). */
export const faltamPraCapa = (id: CapaId, recorde: number): number => Math.max(0, diasPraCapa(id) - Math.max(0, Math.floor(recorde || 0)));

/** "libera com 14 dias seguidos" */
export const requisitoEmTexto = (id: CapaId): string => `libera com ${diasPraCapa(id)} dias seguidos`;

/** "Capa Bordô: libera com 14 dias seguidos — faltam 9." */
export const fraseDaCapaTravada = (nome: string, id: CapaId, recorde: number): string => {
  const faltam = faltamPraCapa(id, recorde);
  return `${nome}: ${requisitoEmTexto(id)} — ${faltam === 1 ? "falta 1 dia" : `faltam ${faltam} dias`}.`;
};

/** As capas travaveis já liberadas, da mais fácil pra mais difícil. */
export const capasLiberadas = (recorde: number): CapaId[] => CAPAS_TRAVAVEIS.filter((id) => capaLiberada(id, recorde));

/** Liberadas que a pessoa ainda não viu comemorar. */
export const capasNovas = (recorde: number, vistas: readonly string[]): CapaId[] => capasLiberadas(recorde).filter((id) => !vistas.includes(id));

/** Guarda as capas cuja festa já passou (lista de ids). */
export const CHAVE_CAPAS_VISTAS = "conquistas-capas-vistas";

export const lerCapasVistas = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);
