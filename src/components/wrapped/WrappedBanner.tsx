import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { MonthlyWrapped, buildWrappedData } from "./MonthlyWrapped";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Entrada da retrospectiva no topo do Dashboard: aparece quando o mês
 * anterior tem dados. Some sozinho pra quem acabou de chegar (sem histórico).
 */
export const WrappedBanner = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    const prevIdx = (new Date().getMonth() + 11) % 12;
    return buildWrappedData(MONTHS[prevIdx], user?.id ?? null);
  }, [user?.id]);

  if (!data) return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => { trackEvent("wrapped_open", { month: data.month }); setOpen(true); }}
        className="w-full flex items-center gap-3 rounded-xl p-3.5 text-left text-white active:scale-[0.99] transition-transform"
        style={{ background: "linear-gradient(120deg, #1c1917 30%, #D22D80 160%)" }}
      >
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15 text-xl shrink-0">🎁</span>
        <span className="flex-1 leading-tight">
          <span className="block text-sm font-bold">Sua retrospectiva de {data.month} tá pronta</span>
          <span className="block text-[11px] text-white/60 mt-0.5">Como foi seu mês em números — estilo wrapped</span>
        </span>
        <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
      </motion.button>

      {open && <MonthlyWrapped data={data} onClose={() => setOpen(false)} />}
    </>
  );
};
