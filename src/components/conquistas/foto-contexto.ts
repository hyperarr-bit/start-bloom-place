import { createContext } from "react";

/**
 * "Esta renderização é a FOTO do WebKit" (26/09). Na foto (SVG com
 * foreignObject) o WebKit do iPhone desenha box-shadow de cabeça pra baixo e
 * recorta sombra grande; o gerador vira as sombras simples, e quem tem sombra
 * difícil (a capa inteira, as argolas) troca por uma sombra desenhada quando
 * este contexto é verdadeiro. Na tela, e no Android, é sempre falso.
 */
export const FotoWebKit = createContext(false);
