import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { trialCartaoAtivo } from "@/lib/teste-gratis";
import { ACOES_DE_VALOR, noIPhone, pedirAvaliacaoDeValor, registrarDiaDeUso } from "@/lib/avaliacao";

/**
 * CONVITE DE AVALIAÇÃO NO MOMENTO DE VALOR — iPhone (23/09, ordem do dono).
 *
 * Escuta o `core:activation` que o use-user-data solta a cada dado salvo
 * (gasto, treino, hábito, conta, água…) e, se a pessoa PAGA (fora do trial),
 * já usou o app em 2+ dias e não foi convidada na última semana, pede a nota.
 * Regras em lib/avaliacao.ts → reservarConviteDeValor. No Android não faz nada.
 *
 * 1.0.16 (17/10, dono): a folha ConviteAvaliacao saiu daqui (43 vistas, 41
 * "Agora não") — agora é a caixinha nativa da Apple direto
 * (`pedirAvaliacaoDeValor`), nas mesmas regras e no mesmo momento.
 */
export const ConviteDeValor = () => {
  const { user, isSubscribed, subLoaded } = useAuth();

  // conta o dia de uso: ao abrir e ao voltar pro app (quem deixa aberto de um dia pro outro).
  // 10/10: nas DUAS lojas — a trava de 2+ dias da missão (pedirAvaliacaoPorMissao) vale no Android também.
  useEffect(() => {
    registrarDiaDeUso();
    const aoVoltar = () => { if (document.visibilityState === "visible") registrarDiaDeUso(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  useEffect(() => {
    if (!noIPhone() || !user || !subLoaded) return;
    let timer: number | undefined;
    const ouvir = (e: Event) => {
      const acao = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (!acao || !(acao in ACOES_DE_VALOR)) return;
      window.clearTimeout(timer);
      // deixa o salvar terminar; no meio de uma digitação, espera a próxima ação
      timer = window.setTimeout(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        // 26/09: o 1º ✓ do Treino (first_workout) abria a folha de avaliação no
        // meio da série. No Treino não pede; a reserva fica pra próxima ação.
        if (window.location.pathname.startsWith("/treino")) return;
        // 1.0.16: no meio de uma dose da missão (<html data-missao-dose>) ou com qualquer guia na tela (tour,
        // cartões, convite, festa da dose), a caixinha não abre por cima — a reserva fica pra próxima ação. Visto
        // no harness: criar o 1º hábito na dose do dia 2 abria a folha da nota no "2 de 2 · marcar".
        if (document.documentElement.hasAttribute("data-missao-dose") || document.querySelector("[data-camada-guia]")) return;
        void pedirAvaliacaoDeValor(acao, { pagante: isSubscribed, emTrial: trialCartaoAtivo() });
      }, 1500);
    };
    window.addEventListener("core:activation", ouvir);
    return () => { window.removeEventListener("core:activation", ouvir); window.clearTimeout(timer); };
  }, [user, isSubscribed, subLoaded]);

  return null;
};
