/**
 * /2027 (23/11) — O PREÇO DA PÁGINA, NUM LUGAR SÓ (centavos).
 *
 * Quem lê daqui: o checkout (src/p2027/payment.ts), a página (main.ts) e o 2027.html — o vite.config.ts troca cada
 * `%PRECO_2027%` do HTML por `precoTexto()` no build e no servidor de desenvolvimento (nenhum preço escrito à mão no HTML).
 *
 * O servidor tem a linha própria "p2027" (supabase/functions/_shared/stripe-ofertas.ts) com o MESMO valor, e em produção a
 * página só deixa pagar se o stripe-lp27-criar devolver este valor (amount, moeda e página "p2027"); senão não cobra nada.
 *
 * SUBIR / MUDAR O PREÇO — nesta ordem, cada passo com ok do dono:
 *   1. Mude AQUI e na linha "p2027" de stripe-ofertas.ts. Se a página já vendeu (ou já gerou Pix): a linha ganha chave de
 *      idempotência NOVA (ex.: idem "p2027b") e o preço antigo vai em `aceitaTambem` (ex.: [2790]), como o /organizar em 23/11.
 *      Sem isso, o Pix antigo pago depois da troca cai em "valor" no webhook (pagou e ficou sem acesso) e a aba que já tinha
 *      pedido recebe "Não consegui abrir o pagamento agora". O teste de src/test/stripe-webhook.test.ts quebra se esquecer.
 *   2. Publique as funções a partir do MAIN já juntado (nunca do worktree) — cada função leva a SUA cópia do _shared:
 *        supabase functions deploy stripe-webhook --no-verify-jwt   e   supabase functions deploy stripe-status   (primeiro)
 *        supabase functions deploy stripe-lp27-criar                                                      (depois)
 *        supabase functions deploy stripe-criar                    (usa o mesmo código compartilhado; fica igual)
 *      Publicar só o criar = o webhook velho ignora a venda ("outra_pagina"/"valor"): ela paga e fica sem acesso, sem e-mail.
 *   3. Só então o site (push).
 * A linha "p2027" NUNCA sai do servidor (nem no rollback: rollback = PAGINA_2027 "off"). Um Pix gerado vale 30 min.
 *
 * Arquivo puro (não toca em window, sem import): o vite.config.ts importa daqui.
 */
export const PRECO_2027_CENTAVOS = 2790;

/** "27,90" (sem R$) */
export const precoTexto = (centavos: number = PRECO_2027_CENTAVOS): string => (centavos / 100).toFixed(2).replace(".", ",");

/** o 2027.html com os %PRECO_2027% trocados pelo preço (usado pelo vite.config.ts e pelos testes) */
export const aplicarPreco = (html: string, centavos: number = PRECO_2027_CENTAVOS): string => html.split("%PRECO_2027%").join(precoTexto(centavos));
