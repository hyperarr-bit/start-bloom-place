import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { EVENTO_DIA2 } from "@/lib/lembrete-dia2";
import { EVENTO_MISSAO_DOSES } from "@/lib/missao-doses";
/* import estático de propósito: lib/notificacoes já mora no pedaço principal (a Missão do
   iPhone importa dela) e um `import()` disparado de dentro de um timer não resolve no
   runner de testes com relógio falso. */
import { registrarEntregues, sincronizarLembreteDia2 } from "@/lib/notificacoes";
import { areaEscolhidaNoFunil } from "@/components/missao/MissaoDoTrial";

/**
 * O LEMBRETE DO DIA 2 / 1ª SEMANA acompanha cada ABERTURA do app (03/10).
 *
 * Por que a cada abertura e não uma vez: a notificação local tem texto fixo e a
 * hora é a da 1ª abertura de HOJE — então toda vez que o app volta pra frente
 * o pendente de hoje é cancelado (ela já voltou) e o de amanhã é refeito com o
 * dado mais novo (o passo de amanhã da missão, o "quanto dá pra gastar", os
 * hábitos). Também reage ao que muda o texto: o estado da missão (fez o passo,
 * combinou a hora) e os registros (core:activation), com um respiro pra não
 * bater no plugin a cada toque. Só no app da loja, só logado — e nunca PEDE
 * permissão (quem pede é a comemoração da missão ou a pré-folha).
 *
 * Na mesma abertura, o que está na bandeja do sistema vira `notif_entregue`
 * (registrarEntregues): hoje não sabemos se as notificações chegam.
 */
export function useLembreteDia2() {
  const { get, loaded, isGuest } = useUserData();
  const { user } = useAuth();
  const getRef = useRef(get);
  getRef.current = get;
  const criadoEm = user?.created_at ?? null;
  const uid = user?.id ?? null;

  // abertura (e volta do segundo plano): registra a hora, refaz o lembrete, conta o que chegou
  useEffect(() => {
    if (!isNativeShell() || !loaded || isGuest || !uid) return;
    let cancelado = false;
    let timer: number | undefined;
    const reagendar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (cancelado) return;
        try {
          void sincronizarLembreteDia2(getRef.current, {
            criadoEm,
            area: areaEscolhidaNoFunil(),
            ligado: lerPrefs(getRef.current<unknown>(CHAVE_PREFS, undefined)).primeiraSemana,
          }).catch(() => { /* o lembrete nunca derruba o app */ });
        } catch { /* idem */ }
      }, 700);
    };
    const abertura = () => {
      reagendar();
      try { void registrarEntregues().catch(() => { /* noop */ }); } catch { /* noop */ }
    };
    abertura();
    const aoVisivel = () => { if (document.visibilityState === "visible") abertura(); };
    document.addEventListener("visibilitychange", aoVisivel);
    window.addEventListener(EVENTO_DIA2, reagendar);
    window.addEventListener(EVENTO_MISSAO_DOSES, reagendar);
    window.addEventListener("core:activation", reagendar);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVisivel);
      window.removeEventListener(EVENTO_DIA2, reagendar);
      window.removeEventListener(EVENTO_MISSAO_DOSES, reagendar);
      window.removeEventListener("core:activation", reagendar);
    };
  }, [loaded, isGuest, uid, criadoEm]);
}
