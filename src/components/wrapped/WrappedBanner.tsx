import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { MonthlyWrapped, buildWrappedData } from "./MonthlyWrapped";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Entrada da retrospectiva no topo do Dashboard: aparece quando o mês
 * anterior tem dados. O X dispensa só o mês atual — quando a próxima
 * retrospectiva ficar pronta, o banner volta.
 */
export const WrappedBanner = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissedMonth, setDismissedMonth] = usePersistedState<string>("wrapped-banner-dismissed", "");

  const data = useMemo(() => {
    const prevIdx = (new Date().getMonth() + 11) % 12;
    return buildWrappedData(MONTHS[prevIdx], user?.id ?? null);
  }, [user?.id]);

  if (!data || dismissedMonth === data.month) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full flex items-center gap-3 rounded-xl p-3.5 text-left text-white"
        style={{ background: "linear-gradient(120deg, #1c1917 30%, #D22D80 160%)" }}
      >
        <button
          onClick={() => { trackEvent("wrapped_open", { month: data.month }); setOpen(true); }}
          className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15 text-xl shrink-0">🎁</span>
          <span className="flex-1 leading-tight min-w-0">
            <span className="block text-sm font-bold">Sua retrospectiva de {data.month} tá pronta</span>
            <span className="block text-[11px] text-white/60 mt-0.5">Como foi seu mês em números — estilo wrapped</span>
          </span>
          <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
        </button>
        <button
          onClick={() => { trackEvent("wrapped_dismiss", { month: data.month }); setDismissedMonth(data.month); }}
          aria-label="Dispensar retrospectiva"
          className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>
      </motion.div>

      {open && <MonthlyWrapped data={data} onClose={() => setOpen(false)} />}
    </>
  );
};
