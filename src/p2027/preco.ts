/**
 * /2027 (23/11) — O PREÇO DA PÁGINA, NUM LUGAR SÓ (centavos).
 *
 * Quem lê daqui: o checkout (src/p2027/payment.ts), a página (main.ts) e o 2027.html — o vite.config.ts troca cada
 * `%PRECO_2027%` do HTML por `precoTexto()` no build e no servidor de desenvolvimento (nenhum preço escrito à mão no HTML).
 *
 * O servidor tem a linha própria "p2027" (supabase/functions/_shared/stripe-ofertas.ts) com o MESMO valor, e em produção a
 * página só deixa pagar se o stripe-lp27-criar devolver este valor (amount, moeda e página). Mudou aqui? Mude lá também e
 * suba as funções ANTES do site, senão o pagamento trava com "Não consegui abrir o pagamento agora" (nunca cobra outro valor).
 *
 * Arquivo puro (não toca em window, sem import): o vite.config.ts importa daqui.
 */
export const PRECO_2027_CENTAVOS = 2790;

/** "27,90" (sem R$) */
export const precoTexto = (centavos: number = PRECO_2027_CENTAVOS): string => (centavos / 100).toFixed(2).replace(".", ",");

/** o 2027.html com os %PRECO_2027% trocados pelo preço (usado pelo vite.config.ts e pelos testes) */
export const aplicarPreco = (html: string, centavos: number = PRECO_2027_CENTAVOS): string => html.split("%PRECO_2027%").join(precoTexto(centavos));
