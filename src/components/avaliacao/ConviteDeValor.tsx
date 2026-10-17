import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { trialCartaoAtivo } from "@/lib/teste-gratis";
import { ACOES_DE_VALOR, diasDeUso, noIPhone, registrarDiaDeUso, registrarRecusaDeValor, reservarConviteDeValor } from "@/lib/avaliacao";
import type { MomentoDoConvite } from "@/components/avaliacao/ConviteAvaliacao";

const ConviteAvaliacao = lazy(() =>
  import("@/components/avaliacao/ConviteAvaliacao").then((m) => ({ default: m.ConviteAvaliacao })));

/**
 * CONVITE DE AVALIAÇÃO NO MOMENTO DE VALOR — iPhone (23/09, ordem do dono).
 *
 * Escuta o `core:activation` que o use-user-data solta a cada dado salvo
 * (gasto, treino, hábito, conta, água…) e, se a pessoa PAGA (fora do trial),
 * já usou o app em 2+ dias e não foi convidada na última semana, abre a folha
 * ConviteAvaliacao com o que ela acabou de fazer. Regras em
 * lib/avaliacao.ts → reservarConviteDeValor. No Android não faz nada.
 */
export const ConviteDeValor = () => {
  const { user, isSubscribed, subLoaded } = useAuth();
  const [momento, setMomento] = useState<MomentoDoConvite | null>(null);

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
        // cartões, convite, festa da dose), a folha não abre por cima — a reserva fica pra próxima ação. Visto
        // no harness: criar o 1º hábito na dose do dia 2 abria a folha da nota no "2 de 2 · marcar".
        if (document.documentElement.hasAttribute("data-missao-dose") || document.querySelector("[data-camada-guia]")) return;
        if (reservarConviteDeValor(acao, { pagante: isSubscribed, emTrial: trialCartaoAtivo() })) {
          setMomento({ rotulo: ACOES_DE_VALOR[acao], dias: diasDeUso() });
        }
      }, 1500);
    };
    window.addEventListener("core:activation", ouvir);
    return () => { window.removeEventListener("core:activation", ouvir); window.clearTimeout(timer); };
  }, [user, isSubscribed, subLoaded]);

  if (!momento) return null;
  return (
    <Suspense fallback={null}>
      <ConviteAvaliacao momento={momento} pagante onRecusou={registrarRecusaDeValor} onFechar={() => setMomento(null)} />
    </Suspense>
  );
};
