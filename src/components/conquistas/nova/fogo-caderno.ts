import { FAIXAS, type Faixa } from "@/lib/fogo-sequencia";

// A paleta antiga continua disponível nas telas que ainda a usam.
const paleta = (indice: number, id: Faixa["id"], cor: string, claro: string, meio: string, escuro: string, fundo: string): Faixa => ({
  ...FAIXAS[indice], id, nome: `fogo ${cor}`, rotulo: `FOGO ${cor.toUpperCase()}`,
  claro, meio, escuro, brilho: `${meio}38`, cabecalho: [meio, escuro],
  borda: fundo, bordaEscuro: `${meio}55`, hojeFundo: fundo,
  hojeFundoEscuro: `${meio}20`, hojeTexto: escuro, hojeTextoEscuro: claro,
});

export const FOGOS_CADERNO: Faixa[] = [
  paleta(0, "salvia", "sálvia", "#dce8d6", "#91aa82", "#4e6953", "#eef2e9"),
  paleta(1, "ambar", "âmbar", "#ffe3a0", "#dba53e", "#94631d", "#f8efdc"),
  paleta(2, "petroleo", "petróleo", "#a7d9d5", "#498b91", "#285c68", "#e7f1f0"),
  paleta(3, "violeta", "violeta", "#ded1fa", "#9876c1", "#65448d", "#f0eafa"),
  paleta(4, "dourado", "dourado", "#fff3bd", "#e3bf58", "#8e661e", "#faf2d9"),
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
