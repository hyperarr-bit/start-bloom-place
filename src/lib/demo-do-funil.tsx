/**
 * O FUNIL-DEMO (/experimente, 14/10) avisa os módulos de que estão nele.
 *
 * Regra do dono: na demo do anúncio, nada de cartão de chamada no topo (Retrospectiva "tá pronta", Desafio da
 * semana, "Dicas para começar"…) — só aparece o que a pessoa tocar. Os componentes que são chamada perguntam
 * aqui e somem. Fora do funil-demo não existe provedor (null): o app, o /preview e os outros funis seguem iguais.
 */
import { createContext, useContext } from "react";

export interface DemoDoFunil {
  /** a pessoa pediu algo que só existe com conta (ou fora dos 5 módulos): vai pra conta do funil */
  abrirConta: (origem: "modulo", destino?: string) => void;
}

const Contexto = createContext<DemoDoFunil | null>(null);
export const DemoDoFunilProvider = Contexto.Provider;
/** null fora do funil-demo. */
export const useDemoDoFunil = (): DemoDoFunil | null => useContext(Contexto);
