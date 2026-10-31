/**
 * CARREGAR UM PEDAÇO DO CÓDIGO (chunk) COM UMA 2ª CHANCE (30/10).
 *
 * Caso real (29/10 23h55, iPhone Safari, lp-web/funil §2b): depois de um deploy, a página velha (em cache) pediu o chunk
 * do Pix pelo nome antigo → a Vercel devolveu HTML ("'text/html' is not a valid JavaScript MIME type") → "Não consegui
 * gerar o Pix". A pessoa tocou de novo e pagou na 2ª. Aqui:
 *   1. o import falhou → espera um pouco e tenta DE NOVO (a rede piscou);
 *   2. falhou de novo → UMA recarga da página (o HTML novo traz os nomes novos dos chunks; o estado da oferta/Pix mora
 *      no localStorage, então a página volta onde estava). A marca em sessionStorage impede laço: na 2ª vez só propaga
 *      o erro (a página mostra "tenta de novo").
 * Sem DOM obrigatório: tudo injetável (o teste cobre as três saídas).
 */

export const CHAVE_RECARGA = "landing-recarregou-chunk";

export type OpcoesRetry = {
  /** quantos ms entre a 1ª e a 2ª tentativa */
  esperaMs?: number;
  espera?: (ms: number) => Promise<void>;
  /** pode recarregar a página se as 2 tentativas falharem? (o pré-aquecimento NÃO; o toque em pagar SIM) */
  recarregar?: boolean;
  recarregarPagina?: () => void;
  jaRecarregou?: () => boolean;
  marcarRecarga?: () => void;
  /** 1 = a 1ª tentativa falhou; 2 = a 2ª também; "recarga" = vai recarregar */
  aoFalhar?: (tentativa: 1 | 2 | "recarga", erro: unknown) => void;
};

const esperaPadrao = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const leRecarga = (): boolean => { try { return sessionStorage.getItem(CHAVE_RECARGA) === "1"; } catch { return true; } };
const marcaRecarga = () => { try { sessionStorage.setItem(CHAVE_RECARGA, "1"); } catch { /* sem storage: não recarrega (leRecarga devolve true) */ } };
const recarregaPadrao = () => { try { location.reload(); } catch { /* noop */ } };

export async function carregarComRetry<T>(carrega: () => Promise<T>, o: OpcoesRetry = {}): Promise<T> {
  const espera = o.espera ?? esperaPadrao;
  try {
    return await carrega();
  } catch (e1) {
    o.aoFalhar?.(1, e1);
    await espera(o.esperaMs ?? 700);
    try {
      return await carrega();
    } catch (e2) {
      o.aoFalhar?.(2, e2);
      const ja = (o.jaRecarregou ?? leRecarga)();
      if (o.recarregar && !ja) {
        (o.marcarRecarga ?? marcaRecarga)();
        o.aoFalhar?.("recarga", e2);
        (o.recarregarPagina ?? recarregaPadrao)();
      }
      throw e2;
    }
  }
}

/** A página chegou viva depois da recarga: apaga a marca (a próxima falha de verdade pode recarregar de novo). */
export function limparMarcaDeRecarga(): void {
  try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* noop */ }
}
