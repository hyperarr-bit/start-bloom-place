import { lazy, Suspense } from "react";
import { compartilharV2Ligado } from "./chave";
import type { PropsBotaoPostarCard } from "./BotaoPostarCardLigado";

/**
 * O PONTO DE ENTRADA dos cards (29/09), atrás da chave `COMPARTILHAR_V2`
 * (desligada). Com a chave desligada: nada aparece, nada é medido e NADA é
 * baixado (a parte pesada — os cards, as contas, a prévia — é um pedaço à
 * parte que só carrega com ela ligada).
 *
 *   <BotaoPostarCard tipo="treinos" origem="treino-concluido" />
 *
 * O botão discreto "Postar nos Stories" + a prévia, pra pôr no MOMENTO DO
 * ORGULHO (treino concluído, mês que fechou, livro terminado, marco da
 * sequência). Só aparece quando o card tem o mínimo (ver dados-do-app.ts).
 */
const Ligado = lazy(() => import("./BotaoPostarCardLigado"));

export const BotaoPostarCard = (p: PropsBotaoPostarCard) =>
  compartilharV2Ligado() ? <Suspense fallback={null}><Ligado {...p} /></Suspense> : null;

