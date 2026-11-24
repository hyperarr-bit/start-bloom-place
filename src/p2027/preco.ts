/**
 * /2027 (23/11) — O PREÇO DA PÁGINA, NUM LUGAR SÓ (centavos).
 *
 * Quem lê daqui: o checkout (src/p2027/payment.ts), a página (main.ts) e o 2027.html — o vite.config.ts troca cada
 * `%PRECO_2027%` do HTML por `precoTexto()` no build e no servidor de desenvolvimento (nenhum preço escrito à mão no HTML).
 *
 * O servidor tem a linha própria "p2027" (supabase/functions/_shared/stripe-ofertas.ts) com o MESMO valor, e em produção a
 * página só deixa pagar se o stripe-lp27-criar devolver este valor (amount, moeda e página "p2027"); senão não cobra nada.
 *
 * MUDAR O PREÇO: mude AQUI e na linha "p2027" de stripe-ofertas.ts. Se a página já vendeu (ou já gerou Pix): a linha ganha chave de
 *   idempotência NOVA (ex.: idem "p2027b") e o preço antigo vai em `aceitaTambem` (ex.: [2790]), como o /organizar em 23/11. Sem isso, o
 *   Pix antigo pago depois da troca cai em "valor" no webhook (pagou e ficou sem acesso) e a aba que já tinha pedido recebe "Não consegui
 *   abrir o pagamento agora". O teste de src/test/stripe-webhook.test.ts quebra se esquecer. Depois, os passos abaixo.
 *
 * SUBIR — nesta ordem, cada passo com ok do dono:
 *   1. Juntar o ramo lp-2027 no main ATUAL (sem push) e olhar o que mais o main leva em supabase/functions/_shared/ desde o último deploy
 *      das funções (git diff <último deploy>..main -- supabase/functions/_shared): cada função publicada leva a SUA cópia do _shared.
 *   2. Publicar as funções a partir desse main (nunca do worktree):
 *        supabase functions deploy stripe-webhook --no-verify-jwt   e   supabase functions deploy stripe-status   (primeiro)
 *        supabase functions deploy stripe-lp27-criar                                                      (depois)
 *      A /2027 NÃO usa o stripe-criar (ele é da /oferta, /organizar, /escolha e /funil-app): não precisa publicar.
 *      Publicar só o criar = o webhook velho ignora a venda ("outra_pagina"/"valor"): ela paga e fica sem acesso, sem e-mail.
 *   3. Site com PAGINA_2027 "off" (push).
 *   4. A prévia (/2027?qa=1) numa aba. Em OUTRA aba (na mesma, a compra simulada da prévia vira "Você já comprou" e o formulário some),
 *      compra REAL em /2027?p2027=on com um e-mail NOVO, que nunca teve acesso (com um e-mail que já tem vitalício o webhook sai em "nada
 *      a creditar" antes do e-mail da compra e o teste parece quebrado): gerar o Pix com o e-mail A → "Corrigir" → pagar com o e-mail B
 *      → conferir que a tela de pago, o e-mail da compra e o acesso no app estão em B (e o stripe_venda com página "p2027" e 2790);
 *      recarregar a aba no meio; e 1 compra no cartão. Devolver as duas.
 *   5. Só então PAGINA_2027 "on" (2027.html) + push.   6. A campanha própria.
 * NUNCA pôr ?p2027=on em link de anúncio (fica gravado na aba e abre a página de verdade mesmo com a chave off).
 * A linha "p2027" NUNCA sai do servidor (nem no rollback: rollback = PAGINA_2027 "off"). Um Pix gerado vale 30 min.
 *
 * Arquivo puro (não toca em window, sem import): o vite.config.ts importa daqui.
 */
export const PRECO_2027_CENTAVOS = 2790;

/** "27,90" (sem R$) */
export const precoTexto = (centavos: number = PRECO_2027_CENTAVOS): string => (centavos / 100).toFixed(2).replace(".", ",");

/** o 2027.html com os %PRECO_2027% trocados pelo preço (usado pelo vite.config.ts e pelos testes) */
export const aplicarPreco = (html: string, centavos: number = PRECO_2027_CENTAVOS): string => html.split("%PRECO_2027%").join(precoTexto(centavos));
