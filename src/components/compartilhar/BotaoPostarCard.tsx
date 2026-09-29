import { useContext, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Instagram } from "lucide-react";
import { UserDataContext } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { CHAVE_MOSTRAR_VALORES, type Insignia } from "@/components/conquistas/insignias";
import { compartilharV2Ligado } from "./chave";
import { cardDaInsignia, cardsDoApp, type CardsDoApp } from "./dados-do-app";
import { PreviaDoCard } from "./PreviaDoCard";
import type { DadosCard } from "./tipos";

/**
 * O PONTO DE ENTRADA dos cards (29/09), atrás da chave `COMPARTILHAR_V2`
 * (desligada). Com a chave desligada, nada aparece e nada é medido.
 *
 *  - `useCardsDoApp()` — os cards que a pessoa pode postar hoje (com o mínimo);
 *  - `useCardDaConquista(heroi)` — o card da insígnia do mês (o planner);
 *  - `<BotaoPostarCard tipo="treinos" origem="treino-concluido" />` — o botão
 *    discreto "Postar nos Stories" + a prévia, pra pôr no MOMENTO DO ORGULHO
 *    (treino concluído, mês que fechou, livro terminado, marco da sequência).
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

const TITULOS: Partial<Record<keyof CardsDoApp, string>> = {
  treinos: "Meus treinos do mês", treinosTotal: "Meus treinos", azul: "Mês no azul", poupanca: "Guardei do que ganhei",
  livros: "Minhas leituras", livrosAno: "Minhas leituras do ano", sequencia: "Minha sequência", agua: "Minha água",
  sono: "Meu sono", habitos: "Meu hábito do mês", metas: "Minhas metas do mês",
};

interface Props {
  tipo: keyof CardsDoApp;
  origem: string;
  className?: string;
  rotulo?: string;
}

export const BotaoPostarCard = ({ tipo, origem, className, rotulo = "Postar nos Stories" }: Props) => {
  const { cards, ligado } = useCardsDoApp();
  const [aberto, setAberto] = useState(false);
  const dados = cards[tipo];
  if (!ligado || !dados) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => { setAberto(true); trackEvent("card_oferta_toque", { tipo, origem }); }}
        className={className ?? "w-full h-12 rounded-xl border border-border bg-card text-[14px] font-bold inline-flex items-center justify-center gap-2 active:scale-[.99] transition"}
        data-testid={`postar-card-${tipo}`}
      >
        <Instagram className="w-[18px] h-[18px]" aria-hidden /> {rotulo}
      </button>
      <AnimatePresence>
        {aberto && <PreviaDoCard key="previa" dados={dados} origem={origem} titulo={TITULOS[tipo] ?? "Minha conquista"} onFechar={() => setAberto(false)} />}
      </AnimatePresence>
    </>
  );
};
