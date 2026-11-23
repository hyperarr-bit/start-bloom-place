/**
 * /dia — a porta do pedaço pesado (pixel, medição, atribuição e a chamada do checkout: src/dia/payment.ts).
 * O main.ts só chega aqui por import(), depois que a imagem do topo terminou: assim o <head> do dia.html não ganha os
 * modulepreload de client/analytics disputando a rede com a 1ª imagem. O nome começa com "dia-" de propósito: o pedaço gerado
 * (assets/dia-carga-*.js, com a chave pública da Stripe e os ids de pixel) cai na regra que tira a /dia do binário das lojas
 * (scripts/preparar-loja.mjs).
 */
export * from './payment';
