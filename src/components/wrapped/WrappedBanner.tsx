import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { construirRetroMes, mesAnterior, nomeDaPessoa, type Leitor } from "@/lib/retrospectiva";
import { MonthlyWrapped } from "./MonthlyWrapped";
import { CHAVE_DO_TEMA, lerTema } from "./temas";
import { foilCss } from "./prancheta";
import { Espiral, P3, creme, kicker, linho, serif, vinheta } from "./pecas-planner";

/**
 * Entrada da retrospectiva no topo do Dashboard: aparece quando o mês
 * anterior tem dados. O X dispensa só o mês atual — quando a próxima
 * retrospectiva ficar pronta, o banner volta.
 *
 * (26/09) Lê pelo store e refaz quando ele muda: no dia 1º, com Finanças na
 * tela, o arquivamento do mês espera a pessoa sair dela — o banner lia só a
 * chave arquivada e sumia justo no dia em que a retrospectiva fica pronta.
 * (26/09, temas) Na pele do tema padrão: uma lombada do planner (linho
 * grafite, espiral, o mês em foil). É um objeto escuro — igual no claro e no
 * escuro, como a capa do planner das Conquistas.
 */
export const WrappedBanner = () => {
  const { user } = useAuth();
  const { get } = useUserData();
  const [open, setOpen] = useState(false);
  const [dismissedMonth, setDismissedMonth] = usePersistedState<string>("wrapped-banner-dismissed", "");

  const retro = useMemo(() => {
    // convidado sem conta continua sem banner (como antes); a demo, com as seeds, mostra
    const emDemo = typeof window !== "undefined" && !!(window as unknown as { __PREVIEW_SEEDS__?: unknown }).__PREVIEW_SEEDS__;
    if (!user?.id && !emDemo) return null;
    const { ano, mesIdx } = mesAnterior();
    const ler: Leitor = (chave) => get<unknown>(chave, undefined);
    return construirRetroMes(ano, mesIdx, user?.id ?? null, undefined, { ler });
  }, [user?.id, get]);

  if (!retro || dismissedMonth === retro.mes) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full overflow-hidden"
        style={{ borderRadius: 14, background: P3.mesa, color: P3.creme }}
        data-testid="wrapped-banner"
      >
        <div aria-hidden style={{ position: "absolute", left: 12, top: 0, right: 0, bottom: 0, borderRadius: "3px 14px 14px 3px", ...linho() }} />
        <div aria-hidden style={{ ...vinheta, left: 12 }} />
        <Espiral n={3} passo={24} topo={8} esquerda={12} w={10} h={18} caixa={24} />
        <div className="relative flex items-center gap-2" style={{ padding: "11px 10px 11px 30px" }}>
          <button
            onClick={() => { trackEvent("wrapped_open", { month: retro.mes, origem: "banner", tema: lerTema(get<unknown>(CHAVE_DO_TEMA, null)) }); setOpen(true); }}
            className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
          >
            <span className="flex-1 leading-tight min-w-0">
              <span className="block" style={kicker(9.5)}>Retrospectiva</span>
              <span className="block" style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>Sua retrospectiva de {retro.mes.toLowerCase()} tá pronta</span>
              <span className="block" style={{ ...serif, fontSize: 13, color: creme(0.6), marginTop: 1 }}>
                {/* o respiro do itálico (paddingRight) sai de volta na margem: sem espaço antes da vírgula */}
                <span style={{ ...foilCss, paddingRight: 2, marginRight: -2 }}>{retro.mes}</span>, página por página.
              </span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: P3.ouroTxt }} />
          </button>
          <button
            onClick={() => { trackEvent("wrapped_dismiss", { month: retro.mes }); setDismissedMonth(retro.mes); }}
            aria-label="Dispensar retrospectiva"
            className="shrink-0 grid place-items-center w-7 h-7 rounded-full p-0"
            style={{ color: creme(0.55), background: "rgba(255,255,255,.06)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {open && <MonthlyWrapped retro={retro} nome={nomeDaPessoa((chave) => get<unknown>(chave, undefined), user?.user_metadata)} onClose={() => setOpen(false)} />}
    </>
  );
};
