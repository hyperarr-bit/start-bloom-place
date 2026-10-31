import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import {
  CHAVE_AVISO_PRESENTE, SUB_AVISO, avisoEscondido, avisoLigadoAqui, compraQueLiberaAviso, gravarMarcaDoAparelho, lerMarcaDoAparelho,
  type LinhaDoAviso, type MarcaAviso,
} from "@/lib/presente-aviso";
import { tokenDia3 } from "./api";

/**
 * O AVISO DO PRESENTE na página Você (31/10) — uma linha discreta logo abaixo da conta/plano, nunca na Home. Mora nos
 * 3 lugares que são "a página Você": a aba Você (as 2 caras, pages/Voce.tsx) e o menu do avatar da Home clássica
 * (AccountDrawer, MenuNovo) — no site com a Home clássica a aba Você nem existe.
 * Regras e chave em src/lib/presente-aviso.ts (PRESENTE_AVISO, padrão "off"). Some no × ou no toque (pra sempre) e
 * sozinho 7 dias depois da 1ª vez. Eventos: presente_aviso_view · presente_aviso_toque · presente_aviso_fechar.
 */
export function AvisoPresente({ estilo }: { estilo: "classico" | "e" | "menu" }) {
  const { user } = useAuth();
  const { get, set } = useUserData();
  const navigate = useNavigate();
  const ligado = avisoLigadoAqui();
  const marcaConta = get<MarcaAviso | null>(CHAVE_AVISO_PRESENTE, null);
  const [marcaAparelho, setMarcaAparelho] = useState<MarcaAviso | null>(() => lerMarcaDoAparelho());
  const escondido = avisoEscondido(marcaConta) || avisoEscondido(marcaAparelho);
  const [elegivel, setElegivel] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState(false);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!ligado || !uid || escondido) return;
    let vivo = true;
    void (async () => {
      try {
        const { data } = await supabase.from("subscriptions").select("status, payment_method, billing_period, plan, amount_cents, created_at").eq("user_id", uid);
        if (vivo) setElegivel(compraQueLiberaAviso((data ?? []) as LinhaDoAviso[]));
      } catch { /* sem aviso */ }
    })();
    return () => { vivo = false; };
  }, [ligado, uid, escondido]);

  const mostrar = ligado && !!uid && !escondido && elegivel;

  /* a 1ª vez que aparece: guarda o dia (some sozinho 7 dias depois) — conta + aparelho */
  const contou = useRef(false);
  useEffect(() => {
    if (!mostrar || contou.current) return;
    contou.current = true;
    trackEvent("presente_aviso_view", { estilo });
    if (!marcaConta?.vistoEm && !marcaAparelho?.vistoEm) {
      const m: MarcaAviso = { vistoEm: new Date().toISOString() };
      set(CHAVE_AVISO_PRESENTE, m, { system: true });
      gravarMarcaDoAparelho(m);
    }
  }, [mostrar, estilo, marcaConta?.vistoEm, marcaAparelho?.vistoEm, set]);

  if (!mostrar) return null;

  const esconder = (via: "fechar" | "toque") => {
    const m: MarcaAviso = { ...(marcaConta ?? marcaAparelho ?? {}), fechado: new Date().toISOString(), via };
    set(CHAVE_AVISO_PRESENTE, m, { system: true });
    gravarMarcaDoAparelho(m);
    setMarcaAparelho(m);
  };

  const abrir = async () => {
    if (abrindo) return;
    setAbrindo(true);
    setErro(false);
    trackEvent("presente_aviso_toque", { estilo });
    const t = await tokenDia3();
    setAbrindo(false);
    if (!t) { setErro(true); return; }
    esconder("toque");
    // só no site (avisoLigadoAqui): o Pix nunca roda dentro do app da loja
    navigate(`/presente/dar?t=${encodeURIComponent(t)}&utm_source=app_voce&utm_medium=aviso`);
  };

  const fechar = () => { trackEvent("presente_aviso_fechar", { estilo }); esconder("fechar"); };

  const linha = (
    <div className="flex items-center" data-testid="aviso-presente" data-estilo={estilo}>
      <button type="button" onClick={() => { void abrir(); }} disabled={abrindo} data-testid="aviso-presente-abrir"
        className="flex-1 min-w-0 min-h-[52px] flex items-center gap-3 pl-4 pr-1 text-left disabled:opacity-60">
        <span className="text-[18px] leading-none shrink-0" aria-hidden>🎁</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">Leve alguém junto</span>
          <span className="block text-[12px] leading-snug text-muted-foreground">{erro ? "Não abriu agora. Toque pra tentar de novo." : SUB_AVISO}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
      </button>
      <button type="button" onClick={fechar} aria-label="Fechar o aviso do presente" data-testid="aviso-presente-fechar"
        className="w-11 h-11 mr-1 shrink-0 grid place-items-center rounded-full text-muted-foreground/70 hover:bg-muted/50 active:bg-muted/70">
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
  if (estilo === "e") return <div className="hn-card mt-3 overflow-hidden">{linha}</div>;
  return <section className={`bg-card rounded-2xl border ${estilo === "menu" ? "border-border/70" : "border-border/60"} overflow-hidden`}>{linha}</section>;
}
