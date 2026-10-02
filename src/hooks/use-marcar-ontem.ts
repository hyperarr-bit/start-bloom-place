import { useCallback } from "react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import {
  CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, diasAtras, diasEfetivos, diasRetroativos, registrarDiaRetroativo, textoDias,
} from "@/lib/sequencia";

/** "qui 01/10" — o dia em miúdo, pra a pessoa ver ONDE a marca caiu. */
export const diaEmMiudo = (dia: string): string => {
  const [a, m, d] = dia.split("-").map(Number);
  const sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(a, m - 1, d).getDay()];
  return `${sem} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

/**
 * MARCAR OUTRO DIA (02/10, três chamados: Treino, Beleza e hábitos — "esqueci de
 * marcar na hora"). Uma função só pra os módulos: roda a escrita dentro do
 * escopo do dia (useUserData.comDia), pra a sequência anotar ONTEM/ANTEONTEM em
 * vez de hoje, e conta o que a pessoa vê:
 *
 *  - hoje: roda e pronto (o caminho de sempre);
 *  - ontem/anteontem, MARCANDO: a anotação entra naquele dia; o toast diz que a
 *    sequência se refez ("🔥 Ontem entrou na sequência · 6 dias seguidos") ou,
 *    se o dia já estava anotado, só onde a marca caiu; evento `marcou_ontem`;
 *  - DESMARCAR, ou dia fora da janela de 2 dias: roda a escrita e não anota dia
 *    nenhum (nem hoje) — desmarcar não conta como "fiz alguma coisa".
 *
 * Nunca dá adesivo por conta própria: as conquistas saem da lista de dias
 * (determinística), então o mesmo dia entrando duas vezes é a mesma lista.
 */
export function useMarcarOntem() {
  const { get, comDia } = useUserData();

  return useCallback(<T,>(modulo: string, dia: string, marcando: boolean, fn: () => T): T => {
    const hoje = localDayKey();
    const atras = diasAtras(dia, hoje);
    if (atras === 0) return fn();
    if (!marcando || atras === null) return comDia ? comDia(null, fn) : fn();

    const lista = get<unknown>(CHAVE_DIAS_ANOTADOS, undefined);
    const hub = get<unknown>(CHAVE_HUB_STREAK, null);
    const nova = registrarDiaRetroativo(lista, dia, hoje, hub);
    const resultado = comDia ? comDia(dia, fn) : fn();

    const rotulo = diasRetroativos(hoje).find((d) => d.dia === dia)?.rotulo ?? "outro dia";
    const dias = calcularSequencia(nova ?? diasEfetivos(lista, hub, hoje), hoje).dias;
    try {
      toast(
        nova
          ? `🔥 ${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} entrou na sequência${dias > 1 ? ` · ${textoDias(dias)}` : ""}`
          : `✓ Marcado em ${rotulo} (${diaEmMiudo(dia)})`,
        { id: "marcou-ontem", duration: 2600 },
      );
    } catch { /* sem toaster (teste/tela isolada): a marca já está na tela */ }
    trackEvent("marcou_ontem", { modulo, dias_atras: atras as number });
    return resultado;
  }, [get, comDia]);
}
