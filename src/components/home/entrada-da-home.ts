import { createContext, useContext } from "react";

/**
 * ENTRADA DA HOME ANTIGA SÓ NA 1ª MONTAGEM DA SESSÃO (07/11, lente "sensação de velocidade").
 *
 * A Home de hoje repetia a coreografia inteira de abertura a cada VOLTA de um módulo: saudação descendo, anel enchendo
 * em 1,2 s (+0,3 s de atraso), número saltando, ações rápidas e módulos entrando um a um — ~1,5 s de tela se mexendo
 * (31 animações medidas na volta de Finanças) pra mostrar o que a pessoa tinha visto 10 segundos antes. A Home nova já
 * resolve isso desde a rodada 3 (home-nova/e/Animacoes.tsx: "voltar pra Início mostra tudo já no lugar — nada pisca").
 * Aqui é o mesmo contrato: a 1ª montagem da sessão anima; as seguintes nascem prontas (`initial={false}` no framer).
 * Fora da Home (preview, demo, outras telas que usem estes componentes) o padrão `true` mantém tudo como era.
 * A comemoração do 100 (CelebracaoDia100, o pulso do anel) não passa por aqui.
 */
let entradaJaTocou = false;
export const marcarEntradaDaHomeAntiga = (): boolean => { const primeira = !entradaJaTocou; entradaJaTocou = true; return primeira; };
/** só pros testes */
export const _zerarEntradaDaHomeAntiga = (): void => { entradaJaTocou = false; };
export const EntradaDaHome = createContext(true);
export const useEntradaDaHome = (): boolean => useContext(EntradaDaHome);
