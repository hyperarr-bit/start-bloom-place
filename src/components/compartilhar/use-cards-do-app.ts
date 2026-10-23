import { useContext, useMemo } from "react";
import { UserDataContext } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { CHAVE_MOSTRAR_VALORES, type Insignia } from "@/components/conquistas/insignias";
import { compartilharV2Ligado } from "./chave";
import { cardDaInsignia, cardsDoApp, type CardsDoApp } from "./dados-do-app";
import type { DadosCard } from "./tipos";

/**
 * Os cards que a pessoa pode postar HOJE (29/09), lidos do mesmo storage do
 * app — só com a chave COMPARTILHAR_V2 ligada (desligada: {} e nenhuma conta).
 *
 *  - `useCardsDoApp()` — os cards de hoje (com o mínimo);
 *  - `useCardDaConquista(heroi)` — o card da insígnia do mês (o planner).
 */

export const useCardsDoApp = (): { cards: CardsDoApp; valoresLigados: boolean; ligado: boolean } => {
  // o contexto direto (e não useUserData): fora do provedor — um teste, uma folha solta — é "sem cards", nunca um erro
  const ctx = useContext(UserDataContext);
  const ligado = compartilharV2Ligado() && !!ctx;
  const get = ctx?.get;
  const loaded = !!ctx?.loaded;
  const valoresLigados = !!get && get<unknown>(CHAVE_MOSTRAR_VALORES, false) === true;
  const hoje = localDayKey();
  // `get` muda de identidade quando os dados mudam: recalcula junto
  const cards = useMemo(() => (ligado && loaded && get ? cardsDoApp(get, hoje, valoresLigados) : {}), [ligado, loaded, get, hoje, valoresLigados]);
  return { cards, valoresLigados, ligado };
};

export const useCardDaConquista = (heroi: Insignia | null, mesIdx: number, ano: number): DadosCard | null => {
  const { cards, valoresLigados, ligado } = useCardsDoApp();
  return useMemo(() => (ligado && heroi ? cardDaInsignia(heroi, cards, { mesIdx, ano, valoresLigados }) : null), [ligado, heroi, cards, mesIdx, ano, valoresLigados]);
};

