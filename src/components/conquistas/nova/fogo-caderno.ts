import { FAIXAS, type Faixa } from "@/lib/fogo-sequencia";

// A paleta antiga continua disponível nas telas que ainda a usam.
const paleta = (indice: number, id: Faixa["id"], cor: string, claro: string, meio: string, escuro: string, fundo: string): Faixa => ({
  ...FAIXAS[indice], id, nome: `fogo ${cor}`, rotulo: `FOGO ${cor.toUpperCase()}`,
  claro, meio, escuro, brilho: `${meio}38`, cabecalho: [meio, escuro],
  borda: fundo, bordaEscuro: `${meio}55`, hojeFundo: fundo,
  hojeFundoEscuro: `${meio}20`, hojeTexto: escuro, hojeTextoEscuro: claro,
});

// A chama usa pigmentos suaves; o texto mantém um tom escuro legível.
// 3 dias varia a cor dentro da faixa inicial (índice 0): não remapeia o
// histórico salvo nem cria outra festa. 7/14/30/100 mantêm índices 1/2/3/4.
export const FOGOS_CADERNO: Faixa[] = [
  { ...paleta(0, "laranja", "laranja", "#f9e9bc", "#e7a65b", "#984411", "#fff1df"), chamaBase: "#d58b3e", chamaContorno: "#bd7839" },
  { ...paleta(0, "laranja", "laranja vivo", "#f7dfab", "#e5974e", "#9c390e", "#ffeddd"), min: 3, chamaBase: "#d17c36", chamaContorno: "#ba6931" },
  { ...paleta(1, "ambar", "amarelo dourado", "#f8edbf", "#e1bd60", "#80510d", "#fff5d5"), chamaBase: "#d2a747", chamaContorno: "#b58c39" },
  { ...paleta(2, "petroleo", "petróleo", "#d1e9e3", "#6aa3a6", "#245e69", "#e7f3f1"), chamaBase: "#50898f", chamaContorno: "#3e717a" },
  { ...paleta(3, "violeta", "violeta", "#e5dbef", "#ad93c6", "#67438d", "#f2eafa"), chamaBase: "#9274ae", chamaContorno: "#76588e" },
  { ...paleta(4, "dourado", "ouro", "#f6eac5", "#d4b36b", "#805819", "#faf1d8"), chamaBase: "#bf964b", chamaContorno: "#a37b38" },
];

const APAGADO: Faixa = {
  ...FOGOS_CADERNO[0], nome: "fogo apagado", claro: "#e7e3dc", meio: "#b8b4ad", escuro: "#8a867f",
  borda: "#eeebe4", bordaEscuro: "#424955", hojeFundo: "#f1efeb", hojeFundoEscuro: "#333944",
  hojeTexto: "#6d706f", hojeTextoEscuro: "#cbc8c1",
};

export const fogoDoCaderno = (dias: number): Faixa => {
  if (!Number.isFinite(dias) || dias <= 0) return APAGADO;
  return [...FOGOS_CADERNO].reverse().find(f => dias >= f.min) ?? FOGOS_CADERNO[0];
};

export const proximoFogoDoCaderno = (dias: number): Faixa | null =>
  FOGOS_CADERNO.find(f => f.min > (Number.isFinite(dias) ? Math.max(0, dias) : 0)) ?? null;

export const CHAVE_FOGO_CADERNO = "conquistas-fogo-caderno-visto";
