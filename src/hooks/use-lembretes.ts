import { useEffect, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
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
/**
 * 17/10 (desempenho): o `get` muda a CADA escrita da conta (qualquer toque que grava), e cada mudança
 * rodava na hora a leitura de todos os avisos + a assinatura + a pergunta da permissão ao nativo — no
 * perfil da abertura (CPU 4× mais lenta) eram ~100 ms disputando a thread com a 1ª pintura da Home, e
 * depois um tanto em cada toque. Agora espera a tela assentar (ESPERA_MS sem escrita nova) e junta as
 * rajadas numa rodada só — nunca mais que MAX_ESPERA_MS adiada, e na hora se o app for pro 2º plano.
 * Os avisos que precisam sair JÁ (compromisso, tarefa com hora, remédio) continuam rearmados no próprio
 * toque (armarAvisos / PharmacyChecklist), sem passar por aqui.
 */
const ESPERA_MS = 800;
const MAX_ESPERA_MS = 3000;

export function useLembretes() {
  const { get, loaded, isGuest } = useUserData();
  const ultimaAssinatura = useRef<string>("");
  const pendenteDesde = useRef<number | null>(null);

  useEffect(() => {
    if (!isNativeShell() || !loaded) return;
    // 02/09: convidado (instalou, não fez conta) recebia "Sua retrospectiva
    // de Agosto tá pronta" — de um app que nunca usou — e o toque caía na
    // TELA DE LOGIN (/retrospectiva é rota protegida). Sem conta, sem
    // lembrete de uso; o que traz o convidado de volta é o resgate do plano.
    if (isGuest) return;
    let cancelado = false;

    const rodar = async () => {
      /* 30/09: o reagendador (com a conta de avisos de todos os módulos) desce SÓ no app
         da loja — no site este hook não faz nada e o funil não precisa carregar isso. */
      let libs: [typeof import("@/lib/notificacoes"), typeof import("@/lib/reagendar")];
      try {
        libs = await Promise.all([import("@/lib/notificacoes"), import("@/lib/reagendar")]);
      } catch {
        return; // o pedaço não desceu: a próxima mudança de dado tenta de novo
      }
      const [{ temPermissao }, { assinaturaDos, lerDadosDosLembretes, reagendarTudo }] = libs;
      if (cancelado || !(await temPermissao())) return;

      const prefs = lerPrefs(get<unknown>(CHAVE_PREFS, undefined));
      const assinatura = assinaturaDos(lerDadosDosLembretes(get), prefs);
      if (assinatura === ultimaAssinatura.current) return;
      ultimaAssinatura.current = assinatura;

      const contagem = await reagendarTudo(get, prefs);
      if (!cancelado) trackEvent("lembretes_agendados", contagem);
    };

    const desde = pendenteDesde.current ?? Date.now();
    pendenteDesde.current = desde;
    let disparou = false;
    const disparar = () => {
      if (disparou || cancelado) return;
      disparou = true;
      pendenteDesde.current = null;
      window.clearTimeout(relogio);
      document.removeEventListener("visibilitychange", aoSair);
      void rodar();
    };
    const aoSair = () => { if (document.visibilityState === "hidden") disparar(); };
    const relogio = window.setTimeout(disparar, Math.max(0, Math.min(ESPERA_MS, desde + MAX_ESPERA_MS - Date.now())));
    document.addEventListener("visibilitychange", aoSair);

    return () => {
      cancelado = true;
      window.clearTimeout(relogio);
      document.removeEventListener("visibilitychange", aoSair);
    };
  }, [get, loaded]);
}
