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
 *
 * 26/10: a lógica virou o hook `useLembreteDaSequencia` — a folha da sequência unificada (components/fogo) usa o
 * mesmo ligar (mesmo evento `sequencia_lembrete_ligar`, mesma preferência `notif-prefs.sequencia`).
 */
export const useLembreteDaSequencia = () => {
  const { get, set, loaded } = useUserData();
  const [ligando, setLigando] = useState(false);
  const [ligadoAgora, setLigadoAgora] = useState(false);
  const prefs = lerPrefs(get(CHAVE_PREFS, {}));
  /** só no app da loja, com a conta carregada */
  const visivel = isNativeShell() && loaded;
  const ligado = prefs.sequencia || ligadoAgora;

  const ligar = async (): Promise<boolean> => {
    if (ligando) return false;
    setLigando(true);
    trackEvent("sequencia_lembrete_ligar", {});
    const ok = (await temPermissao()) || (await pedirPermissao());
    if (!ok) {
      setLigando(false);
      toast.error("Libere as notificações do CORE nas configurações do celular pra receber o lembrete.");
      return false;
    }
    const novas = { ...prefs, sequencia: true };
    set(CHAVE_PREFS, novas);
    try {
      const { reagendarTudo } = await import("@/lib/reagendar");
      await reagendarTudo(get, novas);
    } catch { /* o hook de lembretes reagenda na próxima mudança */ }
    setLigando(false);
    setLigadoAgora(true);
    return true;
  };

  return { visivel, ligado, ligadoAgora, hora: prefs.horaSequencia, ligando, ligar };
};

export const LembreteDaSequencia = () => {
  const { visivel, ligado, ligadoAgora, hora, ligando, ligar } = useLembreteDaSequencia();

  if (!visivel) return null;
  if (ligado && !ligadoAgora) return null;

  if (ligadoAgora) {
    return (
      <p className="mt-2 text-[11.5px] font-medium flex items-center gap-1.5" data-testid="sequencia-lembrete-ligado">
        <Check className="w-3.5 h-3.5 text-success" /> Lembrete ligado · {rotuloHora(hora)}, só se o dia estiver vazio
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void ligar()}
      disabled={ligando}
      className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      <Bell className="w-3.5 h-3.5" /> Me lembrar às {rotuloHora(hora)} se eu esquecer
    </button>
  );
};
