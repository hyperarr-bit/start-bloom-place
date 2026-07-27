import { useEffect, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { agendarContas, temPermissao } from "@/lib/notificacoes";
import { trackEvent } from "@/lib/analytics";

/**
 * Mantém os lembretes de conta a vencer sempre alinhados com o módulo de
 * Finanças (26/07).
 *
 * Roda no app da loja e só faz trabalho quando o dado MUDA de verdade — a
 * assinatura serializada é comparada antes de mexer no agendador, senão cada
 * render reagendaria tudo. Sem permissão, não faz nada e não pede: quem pede
 * é a tela onde a pessoa acabou de criar a primeira conta.
 */
export function useLembretes() {
  const { get, loaded } = useUserData();
  const ultimaAssinatura = useRef<string>("");

  useEffect(() => {
    if (!isNativeShell() || !loaded) return;
    let cancelado = false;

    (async () => {
      if (!(await temPermissao())) return;

      const dueDays = get<{ day?: number; bills?: { name?: string; paid?: boolean }[] }[]>("finance-dueDays", []) ?? [];
      // só o que influencia o agendamento entra na assinatura
      const assinatura = JSON.stringify(
        dueDays
          .map((d) => [d?.day, (d?.bills ?? []).filter((b) => !b?.paid).map((b) => b?.name).sort()])
          .filter(([, naoPagas]) => Array.isArray(naoPagas) && naoPagas.length),
      );
      if (assinatura === ultimaAssinatura.current) return;
      ultimaAssinatura.current = assinatura;

      const quantos = await agendarContas(dueDays);
      if (!cancelado) trackEvent("lembretes_agendados", { tipo: "contas", quantidade: quantos });
    })();

    return () => { cancelado = true; };
  }, [get, loaded]);
}
