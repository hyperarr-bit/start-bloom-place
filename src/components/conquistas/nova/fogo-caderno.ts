import { FAIXAS, type Faixa } from "@/lib/fogo-sequencia";
import { CORE_FIRE_COLORS, type CoreFireTone } from "@/components/fogo/core-fire/core-fire-data";

/**
 * A PALETA DO CADERNO (discos da semana na folha, cartão da sequência das Conquistas, faixas, "Faltam N dias pro fogo …").
 * 26/10 (tarde, dono): segue as figurinhas novas da família de pedra e a chama do Codex — o `meio` e o `claro` de cada
 * faixa SÃO o corpo e o miolo do CoreFire do mesmo marco (core-fire-data), então chama, figurinha e cartão batem:
 * âmbar 1–2 · petróleo 3–6 · violeta 7–13 · magenta 14–29 · ouro suave 30–99 · ouro luminoso 100+.
 * O `escuro` é o tom de TEXTO (disco de hoje, rótulos) — ≥ 4,5:1 sobre o `fundo` claro; no escuro o texto é o `claro`.
 *
 * Os ÍNDICES continuam os das faixas salvas (0…4, `conquistas-fogo-caderno-visto`): 3 dias muda a cor DENTRO da
 * faixa inicial (índice 0) — não remapeia o histórico nem cria outra festa de subida. 7/14/30/100 = 1/2/3/4.
 */
const paleta = (indice: number, id: Faixa["id"], cor: string, tom: CoreFireTone, escuro: string, fundo: string): Faixa => {
  const { body: meio, inner: claro } = CORE_FIRE_COLORS[tom];
  return {
    ...FAIXAS[indice], id, nome: `fogo ${cor}`, rotulo: `FOGO ${cor.toUpperCase()}`,
    claro, meio, escuro, brilho: `${meio}38`, cabecalho: [meio, escuro],
    borda: fundo, bordaEscuro: `${meio}55`, hojeFundo: fundo,
    hojeFundoEscuro: `${meio}20`, hojeTexto: escuro, hojeTextoEscuro: claro,
    // o desenho antigo (`Fogo`, com degradê e contorno) ainda lê estes dois se alguém o usar com a paleta do caderno
    chamaBase: meio, chamaContorno: escuro,
  };
};

export const FOGOS_CADERNO: Faixa[] = [
  paleta(0, "ambar", "âmbar", "amber", "#7a4d0c", "#fff5d5"),
  { ...paleta(0, "petroleo", "petróleo", "petrol", "#245e69", "#e7f3f1"), min: 3 },
  paleta(1, "violeta", "violeta", "violet", "#62408a", "#f2eafa"),
  paleta(2, "magenta", "magenta", "home", "#8a2a5d", "#fbedf4"),
  paleta(3, "ouro", "ouro", "gold", "#7a5317", "#faf1d8"),
  paleta(4, "dourado", "ouro luminoso", "gold-bright", "#7a5317", "#fcf4dc"),
];

const APAGADO: Faixa = {
  ...FOGOS_CADERNO[0], nome: "fogo apagado", claro: CORE_FIRE_COLORS.gray.inner, meio: CORE_FIRE_COLORS.gray.body, escuro: "#8a867f",
  borda: "#eeebe4", bordaEscuro: "#424955", hojeFundo: "#f1efeb", hojeFundoEscuro: "#333944",
  hojeTexto: "#6d706f", hojeTextoEscuro: "#cbc8c1", chamaBase: CORE_FIRE_COLORS.gray.body, chamaContorno: "#8a867f",
};

export const fogoDoCaderno = (dias: number): Faixa => {
  if (!Number.isFinite(dias) || dias <= 0) return APAGADO;
  return [...FOGOS_CADERNO].reverse().find(f => dias >= f.min) ?? FOGOS_CADERNO[0];
};

export const proximoFogoDoCaderno = (dias: number): Faixa | null =>
  FOGOS_CADERNO.find(f => f.min > (Number.isFinite(dias) ? Math.max(0, dias) : 0)) ?? null;

export const CHAVE_FOGO_CADERNO = "conquistas-fogo-caderno-visto";
