import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";
import { ehApple } from "@/lib/loja";

/**
 * "RESTAURAR COMPRAS" fora da welcome (10/10). Até aqui o botão ficava na welcome
 * (AppWelcome) e no paywall; a welcome do funil enxuto (WelcomeCalai) tem UMA linha
 * secundária só — então quem reinstalou e procura a assinatura da loja encontra o
 * botão na tela de Entrar. Mesma lógica de sempre: RevenueCat.restaurar(); achou →
 * recarrega na raiz (a Home abre já liberada); não achou → diz em qual loja procurou.
 * Só faz sentido no app das lojas (quem chama confere isNativeShell()).
 */
export function RestaurarCompras({ origem }: { origem: string }) {
  const [restaurando, setRestaurando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const tentar = async () => {
    if (restaurando) return;
    setRestaurando(true);
    setMsg(null);
    trackEvent("app_welcome_restore", { origem });
    await initRevenueCat();
    const ok = await restaurar();
    setRestaurando(false);
    if (ok) { window.location.href = "/"; return; }
    setMsg(`Nenhuma assinatura encontrada nesta conta ${ehApple() ? "da App Store" : "Google"}.`);
  };
  return (
    <div className="text-center space-y-1" data-testid="restaurar-compras">
      <button
        type="button"
        onClick={tentar}
        disabled={restaurando}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 disabled:opacity-60 py-2 px-3"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden />
        {restaurando ? "Verificando…" : `Restaurar compras da ${ehApple() ? "App Store" : "Google Play"}`}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
