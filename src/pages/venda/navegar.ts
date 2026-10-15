import { marcarSaidaDaPagina } from "@/lib/chunk-novo";

/** Sai da página pro checkout da Cakto. Isolado pra os testes trocarem (jsdom não navega).
 *  Marca a saída antes: um import cancelado pela navegação não pode disparar a recarga de "chunk novo" (o replace
 *  dela ganharia da navegação e a pessoa voltaria pro /assinar em vez de ir pro pagamento). */
export const irProCakto = (url: string): void => {
  marcarSaidaDaPagina();
  window.location.href = url;
};
