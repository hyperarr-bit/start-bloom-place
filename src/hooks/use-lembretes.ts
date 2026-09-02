import { useEffect, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { temPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { assinaturaDos, lerDadosDosLembretes, reagendarTudo } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";

/**
 * Mantém TODOS os lembretes alinhados com os dados e com a central
 * (26/07, ampliado 27/07 pra retrospectiva e lembretes diários).
 *
 * Roda no app da loja e só faz trabalho quando algo MUDA de verdade — a
 * assinatura é comparada antes de mexer no agendador, senão cada render
 * reagendaria tudo.
 *
 * Este hook é também o que torna os lembretes diários honestos: o aviso de
 * "fecha o dia" some no instante em que a pessoa marca o hábito, porque
 * marcar muda o dado, mudar o dado muda a assinatura, e a assinatura nova
 * reagenda a série sem o dia de hoje. E marcar hábito, registrar treino ou
 * virar página só acontece com o app aberto — que é quando este hook roda.
 *
 * Sem permissão não faz nada e não pede: quem pede é a tela onde a pessoa
 * acabou de criar a primeira conta, ou a central.
 */
export function useLembretes() {
  const { get, loaded, isGuest } = useUserData();
  const ultimaAssinatura = useRef<string>("");

  useEffect(() => {
    if (!isNativeShell() || !loaded) return;
    // 02/09: convidado (instalou, não fez conta) recebia "Sua retrospectiva
    // de Agosto tá pronta" — de um app que nunca usou — e o toque caía na
    // TELA DE LOGIN (/retrospectiva é rota protegida). Sem conta, sem
    // lembrete de uso; o que traz o convidado de volta é o resgate do plano.
    if (isGuest) return;
    let cancelado = false;

    (async () => {
      if (!(await temPermissao())) return;

      const prefs = lerPrefs(get<unknown>(CHAVE_PREFS, undefined));
      const assinatura = assinaturaDos(lerDadosDosLembretes(get), prefs);
      if (assinatura === ultimaAssinatura.current) return;
      ultimaAssinatura.current = assinatura;

      const contagem = await reagendarTudo(get, prefs);
      if (!cancelado) trackEvent("lembretes_agendados", contagem);
    })();

    return () => { cancelado = true; };
  }, [get, loaded]);
}
