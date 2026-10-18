/**
 * A NORMALIZAÇÃO DAS CHAVES DE MEDIÇÃO — um lugar só (1.0.16).
 *
 * Usada pela medição de cards (12/09, `card_view`), pela medição total (1.0.16, `uso_resumo`) e
 * pelo plugin do Vite que monta o dicionário de textos do código (vite-plugin-medicao-textos.ts,
 * roda no Node). Por isso este arquivo não importa NADA: os dois lados têm que normalizar
 * exatamente igual, senão um texto do código nunca bate com o mesmo texto na tela.
 *
 * "🔁 O QUE VOCÊ REPETE NO DIA" → "O QUE VOCE REPETE NO DIA": sem acento, sem emoji, sem
 * número nem pontuação, caixa alta, no máximo 32 caracteres. Número sair é de propósito:
 * contador, valor em R$ e data nunca entram numa chave.
 */
export const normalizarChave = (texto: string): string =>
  texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 32)
    .trim();

/** Quantas letras o texto tem (qualquer alfabeto). */
export const letrasDe = (texto: string): number => texto.replace(/[^\p{L}]/gu, "").length;

/** Menos letras que isto não é rótulo — e pedaço curto de dado (iniciais "JO") nunca vira chave. */
export const MIN_LETRAS_ROTULO = 3;
