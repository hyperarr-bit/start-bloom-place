import { toast } from "sonner";

/**
 * Apagar com "Desfazer" (26/09, varredura). Em vários módulos um toque na
 * lixeira apagava na hora, sem volta (recorde, remédio, receita, livro,
 * investimento, desejo com dinheiro guardado…). Padrão da casa pra item que
 * a pessoa digitou: apaga já e oferece desfazer por alguns segundos. Pra item
 * que carrega histórico junto (hábito, curso, desafio), o "apagar?" em dois
 * toques (EntradaAprendizado, Compromissos) continua sendo o certo.
 */
export const avisarApagado = (texto: string, desfazer: () => void) =>
  toast(texto, { action: { label: "Desfazer", onClick: desfazer }, duration: 6000 });

/** Apaga por um setter funcional e oferece Desfazer com o estado de antes. */
export const apagarComDesfazer = <T,>(setter: (fn: (prev: T) => T) => void, apagar: (prev: T) => T, texto: string) => {
  let antes: { v: T } | null = null;
  setter((prev) => { antes = { v: prev }; return apagar(prev); });
  avisarApagado(texto, () => { const a = antes; if (a) setter(() => a.v); });
};
