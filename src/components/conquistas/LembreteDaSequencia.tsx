import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { pedirPermissao, temPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs, rotuloHora } from "@/lib/prefs-notificacoes";
import { trackEvent } from "@/lib/analytics";

/**
 * "Me lembrar se eu esquecer" no próprio card da SEQUÊNCIA (26/09).
 *
 * Diário nasce desligado (regra da casa); o melhor lugar pra pedir o sim é
 * aqui, olhando pros dias seguidos. Só avisa à noite e só se o dia ainda
 * estiver vazio — anotar qualquer coisa cancela o aviso do dia.
 */
export const LembreteDaSequencia = () => {
  const { get, set, loaded } = useUserData();
  const [ligando, setLigando] = useState(false);
  const [ligadoAgora, setLigadoAgora] = useState(false);

  if (!isNativeShell() || !loaded) return null;
  const prefs = lerPrefs(get(CHAVE_PREFS, {}));
  if (prefs.sequencia && !ligadoAgora) return null;

  if (ligadoAgora) {
    return (
      <p className="mt-2 text-[11.5px] font-medium flex items-center gap-1.5" data-testid="sequencia-lembrete-ligado">
        <Check className="w-3.5 h-3.5 text-success" /> Lembrete ligado · {rotuloHora(prefs.horaSequencia)}, só se o dia estiver vazio
      </p>
    );
  }

  const ligar = async () => {
    if (ligando) return;
    setLigando(true);
    trackEvent("sequencia_lembrete_ligar", {});
    const ok = (await temPermissao()) || (await pedirPermissao());
    if (!ok) {
      setLigando(false);
      toast.error("Libere as notificações do CORE nas configurações do celular pra receber o lembrete.");
      return;
    }
    const novas = { ...prefs, sequencia: true };
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
      type="button"
      onClick={() => void ligar()}
      disabled={ligando}
      className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      <Bell className="w-3.5 h-3.5" /> Me lembrar às {rotuloHora(prefs.horaSequencia)} se eu esquecer
    </button>
  );
};
