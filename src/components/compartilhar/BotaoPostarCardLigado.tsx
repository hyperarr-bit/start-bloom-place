import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Instagram } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { CardsDoApp } from "./dados-do-app";
import { useCardsDoApp } from "./use-cards-do-app";
import { PreviaDoCard } from "./PreviaDoCard";

/**
 * O botão "Postar nos Stories" + a prévia (29/09) — a parte PESADA, que só
 * carrega com a chave COMPARTILHAR_V2 ligada (ver BotaoPostarCard.tsx).
 */

const TITULOS: Partial<Record<keyof CardsDoApp, string>> = {
  treinos: "Meus treinos do mês", treinosTotal: "Meus treinos", azul: "Mês no azul", poupanca: "Guardei do que ganhei",
  livros: "Minhas leituras", livrosAno: "Minhas leituras do ano", sequencia: "Minha sequência", agua: "Minha água",
  sono: "Meu sono", habitos: "Meu hábito do mês", metas: "Minhas metas do mês",
};

export interface PropsBotaoPostarCard {
  tipo: keyof CardsDoApp;
  origem: string;
  className?: string;
  rotulo?: string;
}

const BotaoPostarCardLigado = ({ tipo, origem, className, rotulo = "Postar nos Stories" }: PropsBotaoPostarCard) => {
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

export default BotaoPostarCardLigado;
