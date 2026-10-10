import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { AreaKey } from "@/lib/funnel";
import { textoDoContrato } from "@/lib/onboarding-1tela";
import { COMPROMISSOS_POR_AREA, compromissoComoChip } from "./compromissos";

const FUNIL = "w";

/**
 * "SEU PLANO DE 3 DIAS" (10/10, chave ONBOARDING_1TELA) — a tela ÚNICA que
 * substitui os 3 "Claro!" + o contrato assinado no dedo, depois da demo.
 *
 *   · os 3 compromissos da rota já MARCADOS (chips com ✓; tocar desmarca);
 *   · 1 linha de contrato ("Eu vou dar 10 min por dia ao meu CORE por 3 dias");
 *   · um botão "Fechado". Nada pra digitar, nada pra desenhar.
 *
 * Eventos (as séries de hoje continuam comparáveis): no "Fechado", um
 * `funnel_quiz_answer step=compromisso_N answer=claro|nao` por chip e
 * `funnel_click cta=contrato_assinou` (ou `contrato_pulou`, se desmarcou todos —
 * a pessoa "fechou" sem se comprometer com nada), + `funnel_click
 * cta=plano_3_dias_fechado` com quantos ficaram marcados.
 */
export function PlanoDe3Dias({ area, nome, onDone }: { area: AreaKey; nome?: string | null; onDone: () => void }) {
  const itens = COMPROMISSOS_POR_AREA[area] ?? COMPROMISSOS_POR_AREA.dinheiro;
  const [marcados, setMarcados] = useState<boolean[]>(() => itens.map(() => true));
  const [indo, setIndo] = useState(false);
  const alternar = (i: number) => {
    setMarcados((m) => m.map((v, k) => (k === i ? !v : v)));
    trackEvent("funnel_click", { cta: marcados[i] ? "plano_3_dias_desmarcou" : "plano_3_dias_marcou", funil: FUNIL, area, indice: i + 1 });
  };
  const fechado = () => {
    if (indo) return;
    setIndo(true);
    marcados.forEach((sim, i) => trackEvent("funnel_quiz_answer", { step: `compromisso_${i + 1}`, answer: sim ? "claro" : "nao", area, funil: FUNIL, tela: "plano_3_dias" }));
    const n = marcados.filter(Boolean).length;
    trackEvent("funnel_click", { cta: n > 0 ? "contrato_assinou" : "contrato_pulou", funil: FUNIL, tela: "plano_3_dias" });
    trackEvent("funnel_click", { cta: "plano_3_dias_fechado", funil: FUNIL, area, marcados: n });
    onDone();
  };
  return (
    <div className="w-full flex-1 flex flex-col pt-2" data-testid="plano-3-dias">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Seu plano</p>
      <h1 className="text-[26px] font-black tracking-[-0.02em] leading-[1.1] mt-1">Seu plano de 3 dias</h1>
      <p className="text-[13.5px] text-muted-foreground mt-2 leading-snug">
        É o que a gente combina agora. Dez minutos por dia, três dias — e o CORE te guia em cada um.
      </p>

      <div className="mt-5 space-y-2.5" role="group" aria-label="Compromissos">
        {itens.map((it, i) => {
          const on = marcados[i];
          return (
            <motion.button
              key={it.p}
              type="button"
              role="checkbox"
              aria-checked={on}
              data-testid={`plano-3-dias-chip-${i + 1}`}
              data-marcado={on ? "" : undefined}
              onClick={() => alternar(i)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, duration: 0.25 }}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${on ? "border-[#16121c] bg-white" : "border-border bg-card"}`}
            >
              <span className={`grid place-items-center w-7 h-7 rounded-lg shrink-0 ${on ? "bg-[#16121c] text-white" : "border-2 border-border bg-white"}`} aria-hidden>
                {on && <Check className="w-4 h-4" strokeWidth={3.5} />}
              </span>
              <span className="text-xl leading-none shrink-0" aria-hidden>{it.emoji}</span>
              <span className={`font-semibold text-[15px] leading-snug flex-1 ${on ? "" : "text-muted-foreground line-through"}`}>{compromissoComoChip(it.p)}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl px-4 py-3.5 border border-black/10" style={{ background: "#FFF8D6" }} data-testid="plano-3-dias-contrato">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Combinado comigo</span>
        <p className="text-[15.5px] font-extrabold leading-snug mt-1 text-[#16121c]">“{textoDoContrato(nome)}”</p>
      </div>

      <div className="mt-auto pt-5 pb-1">
        <button
          type="button"
          onClick={fechado}
          disabled={indo}
          data-testid="plano-3-dias-fechado"
          className="w-full rounded-full py-4 text-[16px] font-extrabold text-white active:scale-[0.99] transition-transform disabled:opacity-60"
          style={{ background: "#16121c" }}
        >
          Fechado
        </button>
      </div>
    </div>
  );
}
