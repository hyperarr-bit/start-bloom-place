/** Sai da página pra loja (o /baixar faz o 302). Isolado pra os testes trocarem (jsdom não navega). */
export const irPraLoja = (url: string): void => { window.location.href = url; };
