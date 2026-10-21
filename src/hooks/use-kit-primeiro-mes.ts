import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { CHAVE_DESAFIOS, useSemanaCorrente } from "@/hooks/use-fechamento-desafio";
import { trackEvent } from "@/lib/analytics";
import { lerDesafios } from "@/components/challenges/challenges";
import {
  CHAVE_KIT, CHAVE_KIT_PROGRESSO, desafioDoKitParaAplicar, inicioDaCompra, kitLiberado, lerProgresso,
  type KitCompra, type ProgressoDoKit,
} from "@/lib/kit-primeiro-mes";
import { areaDoKit } from "@/lib/plano-30-areas";

/** O kit da conta: `null` = não comprou (nada do kit aparece). */
export const useKitPrimeiroMes = () => {
  const { get, set, loaded } = useUserData();
  const bruto = get<unknown>(CHAVE_KIT, null);
  const kit: KitCompra | null = kitLiberado(bruto) ? bruto : null;
  const progresso: ProgressoDoKit | null = kit ? lerProgresso(get<unknown>(CHAVE_KIT_PROGRESSO, null), inicioDaCompra(kit)) : null;
  /** Gravação de SISTEMA: marcar o plano não é anotação do dia nem ativação. */
  const salvarProgresso = (p: ProgressoDoKit) => set(CHAVE_KIT_PROGRESSO, p, { system: true });
  return { kit, progresso, salvarProgresso, loaded };
};

/**
 * OS DESAFIOS DAS 4 SEMANAS DO KIT (18/10). Na abertura do app (e quando a
 * semana vira com ele aberto), quem tem o kit recebe o desafio da semana já
 * escolhido no card "Desafio da semana" — 1x por segunda: se a pessoa já
 * escolheu outro nesta semana, ou trocou depois, o kit não insiste. Roda
 * DEPOIS do fechamento da semana passada (useFechamentoDoDesafio): com um
 * desafio de semana antiga ainda ativo, espera.
 */
export const useDesafioDoKit = () => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  const semana = useSemanaCorrente();

  useEffect(() => {
    if (!loaded || !user?.id) return;
    const bruto = get<unknown>(CHAVE_KIT, null);
    if (!kitLiberado(bruto)) return;
    // 21/10: os desafios das 4 semanas são de Finanças — só o plano da área Dinheiro (compra sem área = Dinheiro)
    if (areaDoKit(bruto) !== "dinheiro") return;
    const progresso = lerProgresso(get<unknown>(CHAVE_KIT_PROGRESSO, null), inicioDaCompra(bruto));
    const r = desafioDoKitParaAplicar(lerDesafios(get<unknown>(CHAVE_DESAFIOS, undefined)), progresso, new Date());
    if (!r) return;
    if (r.estado) {
      set(CHAVE_DESAFIOS, r.estado, { system: true });
      avisarEscritaDeFora(CHAVE_DESAFIOS, r.estado);
      trackEvent("kit_desafio_aplicado", { challenge: r.estado.active?.key ?? "" });
    }
    set(CHAVE_KIT_PROGRESSO, r.progresso, { system: true });
  }, [loaded, user?.id, semana, get, set]);
};
