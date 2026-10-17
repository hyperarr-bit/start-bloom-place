import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { eventoDaMissao } from "@/lib/missao-doses";

/**
 * AS DICAS DE 1 BALÃO DOS DIAS 2 E 3 (1.0.16, braço A — desenho 8 seção 7c). Depois da dose do dia, na
 * Home: dia 2 no SCORE ("ele junta tudo que você faz no dia"), dia 3 nos WIDGETS ("põe o CORE na tela do
 * iPhone" — só a dica, nunca abre folha). Um balão, um "Entendi", 1x por dia (quem chama grava).
 * Sem o alvo na tela (Home diferente), aparece embaixo, solto.
 */
const TEXTOS: Record<2 | 3, { alvo: string; titulo: string; texto: string }> = {
  2: { alvo: '[data-tour="score"]', titulo: "Seu score do dia", texto: "Ele junta tudo que você faz no dia — o que você fez hoje já está nele." },
  3: { alvo: '[data-tour="adicionar-widget"]', titulo: "Quer ver isso sem abrir o app?", texto: "Põe o CORE na tela do iPhone: segura a tela de início, toca no + e procura CORE." },
};

export function DicaDoDia({ dia, aoFechar }: { dia: 2 | 3; aoFechar: () => void }) {
  const t = TEXTOS[dia];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    trackEvent("missao_dica_dia", eventoDaMissao({ dia, acao: "view" }));
    const el = document.querySelector(t.alvo);
    try { (el as HTMLElement | null)?.scrollIntoView?.({ block: "center" }); } catch { /* jsdom */ }
    const medir = () => { const e = document.querySelector(t.alvo); setRect(e ? e.getBoundingClientRect() : null); };
    const id = window.setTimeout(medir, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const top = rect ? Math.min(vh - 190, rect.bottom + 12) : vh - 220;
  return createPortal(
    <motion.div className="fixed inset-0 z-[220] pointer-events-none" data-camada-guia="missao-dica" data-testid="missao-dica" data-dia={dia} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {rect && <div className="absolute rounded-2xl pointer-events-none" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 2px #fff, 0 0 0 9999px rgba(15,12,20,.45)" }} />}
      <div className="absolute left-1/2 -translate-x-1/2 w-[92%] max-w-[340px] pointer-events-auto rounded-2xl bg-accent text-accent-foreground px-4 py-3.5 shadow-2xl" style={{ top }}>
        <p className="text-[16px] font-bold leading-tight">{t.titulo}</p>
        <p className="text-[13px] leading-snug opacity-90 mt-1">{t.texto}</p>
        <button type="button" className="mt-3 w-full h-10 rounded-full text-[14px] font-extrabold bg-white text-accent" data-testid="missao-dica-entendi"
          onClick={() => { trackEvent("missao_dica_dia", eventoDaMissao({ dia, acao: "entendi" })); aoFechar(); }}>Entendi</button>
      </div>
    </motion.div>,
    document.body,
  );
}
