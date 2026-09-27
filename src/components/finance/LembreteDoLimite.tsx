import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { pedirPermissao, temPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs, rotuloHora } from "@/lib/prefs-notificacoes";
import { trackEvent } from "@/lib/analytics";

/**
 * "Me avisar todo dia" no próprio card do QUANTO POSSO GASTAR HOJE (26/09).
 *
 * O lembrete diário nasce desligado (regra da casa: diário só com o sim da
 * pessoa). O melhor lugar pra pedir esse sim é aqui, com o número na frente
 * dela — na central de notificações ninguém procura. Ligou, some o convite.
 */
export const LembreteDoLimite = () => {
  const { get, set, loaded } = useUserData();
  const [ligando, setLigando] = useState(false);
  const [ligadoAgora, setLigadoAgora] = useState(false);

  if (!isNativeShell() || !loaded) return null;
  try { if (window.location.pathname.startsWith("/preview")) return null; } catch { /* noop */ }
  const prefs = lerPrefs(get(CHAVE_PREFS, {}));
  if (prefs.limite && !ligadoAgora) return null;

  if (ligadoAgora) {
    return (
      <p className="mt-3 text-[11px] font-medium text-muted-foreground flex items-center gap-1.5" data-testid="limite-ligado">
        <Check className="w-3.5 h-3.5 text-green-500" /> Aviso diário ligado · {rotuloHora(prefs.horaLimite)}
      </p>
    );
  }

  const ligar = async () => {
    if (ligando) return;
    setLigando(true);
    trackEvent("limite_lembrete_ligar", {});
    const ok = (await temPermissao()) || (await pedirPermissao());
    if (!ok) {
      setLigando(false);
      toast.error("Libere as notificações do CORE nas configurações do celular pra receber o aviso.");
      return;
    }
    const novas = { ...prefs, limite: true };
    set(CHAVE_PREFS, novas);
    try {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(get, novas);
    } catch { /* o hook de lembretes reagenda na próxima mudança */ }
    setLigando(false);
    setLigadoAgora(true);
  };

  return (
    <button
      onClick={() => void ligar()}
      disabled={ligando}
      className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      <Bell className="w-3.5 h-3.5" /> Me avisar todo dia às {rotuloHora(prefs.horaLimite)}
    </button>
  );
};
