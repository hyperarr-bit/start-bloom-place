import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ofertaLigada } from "@/lib/ofertas-saida";
import { textoDoContrato } from "@/lib/onboarding-1tela";
import { COMPROMISSOS_POR_AREA, DEPOIS_DO_TESTE_POR_AREA, DIAS_POR_AREA, compromissoComoChip } from "./compromissos";

const FUNIL = "w";

/** 1.0.18 (dono 21/10): o botão era "Fechado" — cara de contrato; 4% de quem chegava aqui fechava o app
 *  sem tocar em nada. Mesmo lugar, mesmo estilo, mesma ação e mesmos eventos (o testid e o
 *  `cta=plano_3_dias_fechado` ficam, pra série de hoje continuar comparável). */
export const TEXTO_BOTAO_PLANO = "Começar meu Dia 1";

/**
 * "SEU PLANO DE 3 DIAS" (10/10, chave ONBOARDING_1TELA) — a tela ÚNICA que
 * substitui os 3 "Claro!" + o contrato assinado no dedo, depois da demo.
 *
 *   · os 3 compromissos da rota já MARCADOS (chips com ✓; tocar desmarca);
 *   · 1 linha de contrato ("Eu vou dar 10 min por dia ao meu CORE por 3 dias");
 *   · um botão "Começar meu Dia 1" (até a 1.0.17, "Fechado"). Nada pra digitar, nada pra desenhar.
 *
 * Eventos (as séries de hoje continuam comparáveis): no "Fechado", um
 * `funnel_quiz_answer step=compromisso_N answer=claro|nao` por chip e
 * `funnel_click cta=contrato_assinou` (ou `contrato_pulou`, se desmarcou todos —
 * a pessoa "fechou" sem se comprometer com nada), + `funnel_click
 * cta=plano_3_dias_fechado` com quantos ficaram marcados.
 *
 * PLANO COM CADEADO (10/10, chave PLANO_CADEADO em lib/ofertas-saida, desligada;
 * dono: "na tora, testa tudo" — sem A/B). Ligada, a MESMA tela vira a revelação:
 * card da área com Dia 1 / Dia 2 / Dia 3 na linguagem dela (DIAS_POR_AREA), os
 * compromissos e o contrato compactos, um bloco "Depois do teste" BORRADO com
 * cadeado ("Desbloqueia quando começar o teste grátis") e o botão "Desbloquear
 * meu plano" — que emite os MESMOS eventos do "Fechado" + `funnel_click
 * cta=desbloquear_plano` e segue pro paywall (curto). Com a chave off, a tela é a
 * de hoje byte a byte (src/test/plano-cadeado.test.tsx).
 */
export function PlanoDe3Dias({ area, nome, onDone }: { area: AreaKey; nome?: string | null; onDone: () => void }) {
  const itens = COMPROMISSOS_POR_AREA[area] ?? COMPROMISSOS_POR_AREA.dinheiro;
  const [marcados, setMarcados] = useState<boolean[]>(() => itens.map(() => true));
  const [indo, setIndo] = useState(false);
  /* a chave do cadeado: força de QA / build de QA / constante respondem na hora; a metadata
   * do RevenueCat chega com as offerings — no shell, a gente puxa aqui (também aquece o
   * paywall que vem logo depois). Com a chave off, nada visível muda. */
  const [cadeado, setCadeado] = useState(() => ofertaLigada("cadeado"));
  useEffect(() => {
    if (!isNativeShell()) return;
    let vivo = true;
    void (async () => {
      try {
        const rc = await import("@/lib/revenuecat");
        await rc.initRevenueCat();
        await rc.prefetchAnualIos();
        if (vivo) setCadeado(ofertaLigada("cadeado"));
      } catch { /* a tela de sempre */ }
    })();
    return () => { vivo = false; };
  }, []);
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
    if (cadeado) trackEvent("funnel_click", { cta: "desbloquear_plano", funil: FUNIL, area, marcados: n });
    onDone();
  };

  if (cadeado) {
    const dias = DIAS_POR_AREA[area] ?? DIAS_POR_AREA.dinheiro;
    const depois = DEPOIS_DO_TESTE_POR_AREA[area] ?? DEPOIS_DO_TESTE_POR_AREA.dinheiro;
    const info = AREAS[area] ?? AREAS.dinheiro;
    return (
      <div className="w-full flex-1 flex flex-col pt-2" data-testid="plano-3-dias" data-cadeado="">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Seu plano</p>
        <h1 className="text-[26px] font-black tracking-[-0.02em] leading-[1.1] mt-1">Seu plano de 3 dias</h1>

        {/* o card da área: o que ela faz em cada dia */}
        <div className="mt-3.5 rounded-2xl border-2 border-[#16121c] bg-white p-3.5" data-testid="plano-3-dias-dias">
          <div className="flex items-center gap-2">
            <span className="text-[18px] leading-none" aria-hidden>{info.emoji}</span>
            <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#16121c]">{info.nome}</span>
          </div>
          <ol className="mt-2.5 space-y-2">
            {dias.map((t, i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 * i, duration: 0.25 }}
                className="grid grid-cols-[44px_1fr] gap-2.5 items-start"
              >
                <span className="mt-[1px] rounded-md bg-[#16121c] text-white text-[10.5px] font-extrabold tracking-wide text-center py-[3px]">DIA {i + 1}</span>
                <span className="text-[14px] font-semibold leading-snug text-[#16121c]">{t}</span>
              </motion.li>
            ))}
          </ol>
        </div>

        {/* compromissos compactos (os mesmos chips, marcados; tocar desmarca) */}
        <div className="mt-3 space-y-1.5" role="group" aria-label="Compromissos">
          {itens.map((it, i) => {
            const on = marcados[i];
            return (
              <button
                key={it.p}
                type="button"
                role="checkbox"
                aria-checked={on}
                data-testid={`plano-3-dias-chip-${i + 1}`}
                data-marcado={on ? "" : undefined}
                onClick={() => alternar(i)}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${on ? "border-[#16121c]/60 bg-white" : "border-border bg-card"}`}
              >
                <span className={`grid place-items-center w-5 h-5 rounded-md shrink-0 ${on ? "bg-[#16121c] text-white" : "border-2 border-border bg-white"}`} aria-hidden>
                  {on && <Check className="w-3 h-3" strokeWidth={3.5} />}
                </span>
                <span className="text-[15px] leading-none shrink-0" aria-hidden>{it.emoji}</span>
                <span className={`font-semibold text-[13px] leading-snug flex-1 ${on ? "" : "text-muted-foreground line-through"}`}>{compromissoComoChip(it.p)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 rounded-xl px-3 py-2 border border-black/10" style={{ background: "#FFF8D6" }} data-testid="plano-3-dias-contrato">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Combinado comigo · </span>
          <span className="text-[13px] font-extrabold leading-snug text-[#16121c]">“{textoDoContrato(nome)}”</span>
        </div>

        {/* o cadeado: o que vem depois do teste, borrado */}
        <div className="mt-3 relative rounded-2xl border border-border bg-card p-3.5 overflow-hidden" data-testid="plano-3-dias-cadeado">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Depois do teste</div>
          <p className="text-[12px] text-muted-foreground mt-0.5">O que o CORE monta pra você nos próximos 30 dias</p>
          <ul className="mt-2 space-y-1.5 select-none" aria-hidden style={{ filter: "blur(4px)" }}>
            {depois.map((t) => (
              <li key={t} className="text-[13.5px] font-semibold text-[#16121c] leading-snug">{t}</li>
            ))}
          </ul>
          <div className="absolute inset-x-0 bottom-0 pt-8 pb-3 bg-gradient-to-t from-card via-card/95 to-transparent grid place-items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-border px-3 py-1.5 text-[11.5px] font-bold text-foreground shadow-sm">
              <Lock className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Desbloqueia quando começar o teste grátis
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4 pb-1">
          <button
            type="button"
            onClick={fechado}
            disabled={indo}
            data-testid="plano-3-dias-fechado"
            className="w-full rounded-full py-4 text-[16px] font-extrabold text-white active:scale-[0.99] transition-transform disabled:opacity-60 inline-flex items-center justify-center gap-2"
            style={{ background: "#16121c" }}
          >
            <Lock className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Desbloquear meu plano
          </button>
        </div>
      </div>
    );
  }

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
          {TEXTO_BOTAO_PLANO}
        </button>
      </div>
    </div>
  );
}
