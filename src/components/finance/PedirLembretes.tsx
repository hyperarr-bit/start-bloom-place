import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { agendarContas, agendarRetrospectiva, pedirPermissao, temPermissao } from "@/lib/notificacoes";
import { trackEvent } from "@/lib/analytics";

const CHAVE_JA_PERGUNTOU = "lembretes-contas-perguntado";

/**
 * Convite pra ligar os lembretes de conta a vencer (26/07).
 *
 * O MOMENTO é o produto aqui. No Android 13+ a recusa é definitiva — o
 * sistema não mostra o diálogo de novo. Pedir na abertura do app é queimar a
 * única chance com alguém que ainda não sabe pro que serve.
 *
 * Então isto só aparece quando: está no app da loja, a pessoa JÁ TEM conta
 * cadastrada (ou seja, o lembrete tem o que lembrar) e ela ainda não foi
 * perguntada. Depois disso, some pra sempre — quem quiser ligar depois vai
 * pelos ajustes do Android.
 */
export const PedirLembretes = ({ dueDays }: { dueDays: { day?: number; bills?: { paid?: boolean }[] }[] }) => {
  const { get, set, loaded } = useUserData();
  const [visivel, setVisivel] = useState(false);
  const [ligando, setLigando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const contasAbertas = (dueDays ?? []).reduce(
    (n, d) => n + (Array.isArray(d?.bills) ? d.bills.filter((b) => !b?.paid).length : 0),
    0,
  );

  useEffect(() => {
    if (!isNativeShell() || !loaded) return;
    if (contasAbertas === 0) return;                          // nada a lembrar ainda
    if (get<string>(CHAVE_JA_PERGUNTOU, "") === "true") return;
    let vivo = true;
    temPermissao().then((tem) => {
      if (!vivo) return;
      if (tem) { set(CHAVE_JA_PERGUNTOU, "true"); return; }   // já autorizou antes
      setVisivel(true);
      trackEvent("lembretes_convite_visto", { contas: contasAbertas });
    });
    return () => { vivo = false; };
  }, [loaded, contasAbertas, get, set]);

  const dispensar = () => {
    set(CHAVE_JA_PERGUNTOU, "true");
    trackEvent("lembretes_convite_dispensado", {});
    setVisivel(false);
  };

  const ligar = async () => {
    setLigando(true);
    const ok = await pedirPermissao();
    set(CHAVE_JA_PERGUNTOU, "true");
    trackEvent("lembretes_permissao", { concedida: ok });
    if (ok) {
      // liga os dois de uma vez: a permissão é única no Android, e quem
      // aceitou "me avise" não vai querer ser perguntado de novo por causa da
      // retrospectiva. Desligar cada um é papel da central, no menu.
      const quantos = await agendarContas(dueDays);
      const retro = await agendarRetrospectiva();
      trackEvent("lembretes_agendados", { contas: quantos, retrospectiva: retro });
      setPronto(true);
      setTimeout(() => setVisivel(false), 2200);
    } else {
      setVisivel(false);
    }
    setLigando(false);
  };

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
        >
          {pronto ? (
            <p className="flex items-center justify-center gap-2 py-1 text-sm font-semibold text-primary">
              <Check className="h-4 w-4" strokeWidth={3} /> Pronto — te aviso na véspera
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight">Quer que eu te avise antes de vencer?</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                    Um aviso às 9h da véspera, com o nome das contas do dia. Sem spam: um por dia, no máximo.
                  </p>
                </div>
                <button onClick={dispensar} aria-label="Agora não" className="-mr-1 -mt-1 p-1 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1 h-10 font-semibold" onClick={ligar} disabled={ligando}>
                  {ligando ? "Ativando…" : "Quero ser avisado"}
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
