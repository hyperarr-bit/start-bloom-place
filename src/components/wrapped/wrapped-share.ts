import type { ReactElement } from "react";
import { compartilharImagem, type ResultadoCompartilhar } from "@/lib/compartilhar";
import { gerarPng } from "@/components/conquistas/gerar-imagem";
import { trackEvent } from "@/lib/analytics";

/**
 * O card da retrospectiva vira imagem (26/09, sistema de temas).
 *
 * A arte dos Stories é um componente de 1080×1920 ("Setembro, fechado." com
 * a página do planner; ou a capa da revista; ou a página de recortes) — o
 * MESMO componente do card da tela, no formato "stories". Quem fotografa é o
 * gerador das Conquistas (`gerarPng`): monta a arte fora da tela numa raiz
 * própria, espera fonte e anéis de texto, acerta as sombras que o WebKit
 * inverte na foto e tira o PNG em 1080×1920 (pixelRatio 1).
 *
 * Privacidade: o card não tem R$ a menos que a pessoa ligue "Mostrar valores
 * em R$", e o texto dela (diário, gratidão) nunca entra — ver
 * `conteudoDoCard` em lib/retrospectiva.
 */

export const STORIES_DA_RETRO = { largura: 1080, altura: 1920 };

/** PNG 1080×1920 da arte; null se o aparelho não conseguiu desenhar. */
export const fotografarCard = async (arte: ReactElement): Promise<Blob | null> => {
  const blob = await gerarPng(arte, STORIES_DA_RETRO);
  if (!blob) trackEvent("wrapped_card_erro", { erro: "sem-imagem" });
  return blob;
};

/** "Salvar" e "Postar nos Stories" abrem o compartilhar do sistema (no app, a folha nativa). */
export const compartilharCard = async (arte: ReactElement, mes: string, destino: "salvar" | "stories"): Promise<ResultadoCompartilhar | "sem-imagem"> => {
  const blob = await fotografarCard(arte);
  if (!blob) return "sem-imagem";
  return compartilharImagem(
    blob,
    `core-retrospectiva-${mes.toLowerCase()}.png`,
    `Minha retrospectiva de ${mes}`,
    destino === "stories" ? "retrospectiva-stories" : "retrospectiva-salvar",
  );
};
