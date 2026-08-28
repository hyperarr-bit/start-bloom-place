import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { estadoPermissao, pedirPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";

const CHAVE_JA_PERGUNTOU = "lembrete-rotina-perguntado";
/** Abaixo disto não há o que proteger — e o convite vira propaganda. */
const SEQUENCIA_MINIMA = 3;

/**
 * Convite pro lembrete de fechamento do dia (27/07).
 *
 * O PROBLEMA QUE ELE RESOLVE. Os quatro lembretes diários nascem desligados,
 * de propósito — ligar notificação diária sozinho no app de alguém é como se
 * perde um usuário na primeira semana. Só que assim ninguém descobre que
 * existem: ficam numa tela de ajustes que quase ninguém abre.
 *
 * O MOMENTO É O PRODUTO. Não perguntamos "quer receber lembretes?" — isso é
 * pedir permissão pra incomodar. Perguntamos quando a pessoa TEM ALGO A
 * PERDER: uma sequência de 3+ dias viva. Aí a oferta não é notificação, é
 * proteção de uma coisa que ela construiu. É o mesmo raciocínio do convite de
 * contas a vencer, que pede permissão só depois de existir conta cadastrada.
 *
 * E é decisivo: no Android 13+ a recusa é DEFINITIVA. Só existe uma chance —
 * então ela é gasta no melhor momento possível, não na abertura do app.
 *
 * Aparece uma vez só. Quem dispensar liga depois em Menu → Notificações.
 */
export const PedirLembreteRotina = ({ sequencia }: { sequencia: number }) => {
  const { get, set, loaded } = useUserData();
  const [visivel, setVisivel] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!isNativeShell() || !loaded) return;
    // v83.4 (print do dono): na DEMO do funil (/preview) a sequência de 41
    // dias é DADO DE EXEMPLO — pedir notificação ali é queimar a única
    // chance do Android 13+ com um turista. Mesma regra do PedirLembretes.
    try { if (window.location.pathname.startsWith("/preview")) return; } catch { /* noop */ }
    if (sequencia < SEQUENCIA_MINIMA) return;
    if (get<string>(CHAVE_JA_PERGUNTOU, "") === "true") return;
    // já ligou o lembrete de rotina por conta própria? não tem o que oferecer
    if (lerPrefs(get<unknown>(CHAVE_PREFS, undefined)).rotina) return;

    let vivo = true;
    estadoPermissao().then((estado) => {
      if (!vivo) return;
      // BLOQUEADO no sistema: o convite não teria como funcionar, e insistir
      // com quem já disse não é caminho pra ser desinstalado. Queima a chance
      // de propósito.
      if (estado === "denied") {
        set(CHAVE_JA_PERGUNTOU, "true");
        return;
      }
      // INDISPONÍVEL é outra coisa: o plugin não respondeu. Pode ser falha
      // passageira — só não mostra agora, SEM marcar como perguntado. Marcar
      // aqui mataria o convite pra sempre por causa de um tropeço de uma
      // abertura só.
      if (estado === "indisponivel") return;
      setVisivel(true);
      trackEvent("lembrete_rotina_convite_visto", { sequencia });
    });
    return () => { vivo = false; };
  }, [loaded, sequencia, get, set]);

  const dispensar = () => {
    set(CHAVE_JA_PERGUNTOU, "true");
    trackEvent("lembrete_rotina_convite_dispensado", { sequencia });
    setVisivel(false);
  };

  const ligar = async () => {
    setLigando(true);
    const ok = await pedirPermissao();
    set(CHAVE_JA_PERGUNTOU, "true");
    trackEvent("lembrete_rotina_permissao", { concedida: ok, sequencia });
    if (ok) {
      const prefs = { ...lerPrefs(get<unknown>(CHAVE_PREFS, undefined)), rotina: true };
      set(CHAVE_PREFS, prefs);
      await reagendarTudo(get, prefs);
      setPronto(true);
      setTimeout(() => setVisivel(false), 2400);
    } else {
      setVisivel(false);
    }
    setLigando(false);
  };

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4"
        >
          {pronto ? (
            <p className="flex items-center justify-center gap-2 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <Check className="h-4 w-4" strokeWidth={3} /> Combinado — te aviso às 21h
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-lg">
                  🔥
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight">
                    {sequencia} dias seguidos. Quer ajuda pra não quebrar?
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                    Um toque às 21h, só nos dias em que você ainda não marcou nada.
                    Marcou cedo? O aviso do dia nem chega.
                  </p>
                </div>
                <button onClick={dispensar} aria-label="Agora não" className="-mr-1 -mt-1 p-1 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1 h-10 font-semibold" onClick={ligar} disabled={ligando}>
                  <Flame className="mr-1.5 h-4 w-4" />
                  {ligando ? "Ativando…" : "Proteger minha sequência"}
                </Button>
                <Button size="sm" variant="ghost" className="h-10" onClick={dispensar}>
                  Agora não
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
