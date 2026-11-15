import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { TEXTO_ENTRADA, compraQueLiberaEntrada, entradaLigadaAqui, type LinhaDaEntrada } from "@/lib/presente-entrada";
import { tokenDia3 } from "./api";

/**
 * A ENTRADA FIXA DO PRESENTE (15/11) — "🎁 Dar o CORE de presente", uma linha discreta e PERMANENTE na página Você do site (as 2 caras
 * da aba Você e o menu do avatar), logo abaixo da conta. Sem ×, sem prazo: ela acha quando quiser. Nunca na Home. Só o site (o iPhone
 * e o Android da loja nunca). O toque pede o token da conta e abre /presente/dar — o servidor decide o preço (24,90 pra quem comprou
 * na /oferta, 14,90 pros demais). Chave PRESENTE_ENTRADA (src/lib/presente-entrada.ts, "off").
 * Eventos: presente_entrada_view {estilo} (1× por montagem) · presente_entrada_toque {estilo}.
 */
export function EntradaPresente({ estilo }: { estilo: "classico" | "e" | "menu" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ligado = entradaLigadaAqui();
  const [elegivel, setElegivel] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState(false);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!ligado || !uid) return;
    let vivo = true;
    void (async () => {
      try {
        const { data } = await supabase.from("subscriptions").select("status, payment_method, billing_period, plan, amount_cents").eq("user_id", uid);
        if (vivo) setElegivel(compraQueLiberaEntrada((data ?? []) as LinhaDaEntrada[]));
      } catch { /* sem entrada */ }
    })();
    return () => { vivo = false; };
  }, [ligado, uid]);

  const mostrar = ligado && !!uid && elegivel;
  useEffect(() => { if (mostrar) trackEvent("presente_entrada_view", { estilo }); }, [mostrar, estilo]);
  if (!mostrar) return null;

  const abrir = async () => {
    if (abrindo) return;
    setAbrindo(true); setErro(false);
    trackEvent("presente_entrada_toque", { estilo });
    const t = await tokenDia3();
    setAbrindo(false);
    if (!t) { setErro(true); return; }
    navigate(`/presente/dar?t=${encodeURIComponent(t)}&utm_source=app_voce&utm_medium=entrada`);
  };

  const linha = (
    <button type="button" onClick={() => { void abrir(); }} disabled={abrindo} data-testid="entrada-presente" data-estilo={estilo}
      className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left disabled:opacity-60">
      <span className="text-[18px] leading-none shrink-0" aria-hidden>🎁</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{TEXTO_ENTRADA}</span>
        {erro && <span className="block text-[12px] leading-snug text-muted-foreground">Não abriu agora. Toque pra tentar de novo.</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
    </button>
  );
  if (estilo === "e") return <div className="hn-card mt-3 overflow-hidden">{linha}</div>;
  return <section className={`bg-card rounded-2xl border ${estilo === "menu" ? "border-border/70" : "border-border/60"} overflow-hidden`}>{linha}</section>;
}
