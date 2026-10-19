/**
 * O QUE A WEB FAZ COM QUEM CHEGA DE FORA — decisão do dono em 01/10/2026:
 *
 *   "Desisti da web" = parar de mandar cliente PAGAR na web. O site continua
 *   normal pra quem já tem conta (o pessoal gosta de usar no navegador), e a
 *   raiz vira uma landing com um objetivo só: baixar o app (App Store /
 *   Google Play). Venda, só pelas lojas.
 *
 * Esta é a chave. Com `VENDA_NA_WEB = false`:
 *   · as rotas de funil/venda da web (/inicio, /comecar, /comecar-v2,
 *     /plano, /direto, /lp, /funil-*, /app fora do shell) levam pra landing
 *     "/" PRESERVANDO os parâmetros (utm, fbclid…) — anúncio antigo ou link
 *     salvo não dá em página quebrada e a atribuição não se perde;
 *   · quem está logado na web SEM acesso vê "Assine no app e use aqui também"
 *     no lugar do paywall com Pix (TrialBanner) e no /planos sem oferta;
 *   · a roleta de desconto do Pix (GlobalWinback) não monta.
 *
 * Rollback = `true` + push: tudo acima volta a ser o que era em 30/09. Os
 * funis NÃO foram apagados — o app usa o funil W na porta (/app) e ele
 * segue intocado; os da web só saíram do caminho.
 *
 * O APP DA LOJA NÃO LÊ ESTA CHAVE: toda bifurcação acontece depois de
 * `isNativeShell()` dizer "não estou no app". No shell nada muda.
 */
export const VENDA_NA_WEB = false;

/**
 * O /inicio VOLTA A VENDER (19/10, decisão do dono) — e SÓ ele.
 *
 *   "Volta o funil do /inicio exatamente como rodava no fim de setembro com a
 *   kenny g (ROAS 1,33, sessão→venda 2,7%, Pix 27,90 vitalício). Nada novo no
 *   funil." Três acréscimos obrigatórios: a compra chega nos DOIS pixels da
 *   Meta, os selos App Store/Google Play na tela de pagamento confirmado, e o
 *   resto do site fica como está.
 *
 * Com `INICIO_VENDE = true` (e VENDA_NA_WEB continuando false):
 *   · /inicio na web renderiza o funil do dia 14 de novo (porta → quiz → demo
 *     /preview → cadastro → paywall ROI 2 → Pix w27 → "Pronto! Os 16 módulos
 *     estão liberados"), com o import EAGER de setembro (sem flash de loading
 *     na URL do anúncio);
 *   · a cerca da demo (seta ← que cai em "/" com o tour ativo) volta a
 *     devolver pro /inicio?step=analise, como em setembro;
 *   · "/" continua a landing de download (inclusive com utm/fbclid — o
 *     anúncio aponta direto pro /inicio), as outras rotas de funil antigas
 *     continuam indo pra landing, a conta logada sem acesso continua vendo
 *     "Assine no app", /hoje e /missao intocados, e o app da loja não lê
 *     esta chave (FunilAposentado decide o nativo antes de tudo).
 *
 * ROLLBACK = `false` + push: o /inicio volta a levar pra landing "/" com a
 * atribuição preservada (o comportamento de 01/10 a 19/10).
 */
export const INICIO_VENDE = true;

/**
 * Porta de entrada do app da loja. TEM NOME PRÓPRIO de propósito (26/07):
 * repontar /inicio na web quebrou o app junto quando os dois compartilhavam a
 * rota. Com a constante, repontar rota de web nunca mais mexe no app.
 */
export const ENTRADA_APP = "/app";

/**
 * Pra onde um link de funil antigo leva na web: a raiz, com a mesma query.
 * `step`/`porta`/`from` eram instruções pro funil e não significam nada na
 * landing — saem, pra URL não ficar com lixo. O resto (utm_*, fbclid, gclid,
 * ttclid, ref…) fica, porque é o que liga a visita ao anúncio.
 */
export function destinoNaLanding(search: string): string {
  const p = new URLSearchParams(search);
  for (const k of ["step", "porta", "from", "funil-a", "funil-b", "d3"]) p.delete(k);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}
