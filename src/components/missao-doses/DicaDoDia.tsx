import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { eventoDaMissao } from "@/lib/missao-doses";

/**
 * AS DICAS DE 1 BALÃO DOS DIAS 2 E 3 (1.0.16, braço A — desenho 8 seção 7c). Depois da dose do dia, na
 * Home, um balão só, um "Entendi", 1x por dia (quem chama grava). Nunca abre folha por cima. O véu deixa o
 * toque passar (a Home continua dela): quem chama conta cada APARIÇÃO (`aoVer`, ao montar) — sem o "Entendi",
 * a 2ª é a última (revisão pré-build, 17/10: antes ela voltava a cada abertura e a cada volta à Home).
 *   · dia 2, no SCORE: "Seu score foi de X pra Y hoje" (X = o score quando a dose abriu, Y = agora) — no dia 2
 *     o score já tem história; sem X (ou sem subida), o texto sem número;
 *   · dia 3, no "Adicionar widget": os widgets da HOME do CORE. (O desenho falava em "pôr o CORE na tela do
 *     iPhone", mas o app não tem widget de tela de início no iOS — a dica não pode mandar procurar o que não
 *     existe. Ela aponta pro que existe: o widget dentro do app.)
 * Sem o alvo na tela (Home diferente), o balão aparece embaixo, solto.
 */
const ALVOS: Record<2 | 3, string> = { 2: '[data-tour="score"]', 3: '[data-tour="adicionar-widget"]' };

export function textoDaDica(dia: 2 | 3, scoreAntes?: number | null, scoreAgora?: number | null): { titulo: string; texto: string } {
  // 1.0.17 (dono: "minimalista"): título de uma linha + no máximo uma frase curta
  if (dia === 3) return { titulo: "Escolha o que aparece aqui.", texto: "Em “Adicionar widget”." };
  const antes = typeof scoreAntes === "number" ? Math.round(scoreAntes) : null;
  const agora = typeof scoreAgora === "number" ? Math.round(scoreAgora) : null;
  if (antes !== null && agora !== null && agora > antes) {
    return { titulo: `Seu score foi de ${antes} pra ${agora}.`, texto: "Cada registro soma." };
  }
  return { titulo: "Seu score do dia.", texto: "Cada registro soma." };
}

export function DicaDoDia({ dia, aoFechar, aoVer, scoreAntes }: {
  dia: 2 | 3;
  aoFechar: () => void;
  /** chamado 1x quando o balão aparece: quem chama conta a vista e devolve qual é (1, 2) — vai no `view` */
  aoVer?: () => number | void;
  scoreAntes?: number;
}) {
  const reduzir = !!useReducedMotion();
  const dados = useLifeHubData();
  // o texto é decidido UMA vez (o número não pula enquanto ela lê)
  const [t] = useState(() => textoDaDica(dia, scoreAntes, dados.dayScore));
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const vez = aoVer?.();
    trackEvent("missao_dica_dia", eventoDaMissao({ dia, acao: "view", score_antes: scoreAntes ?? null, score_agora: Math.round(dados.dayScore ?? 0), ...(typeof vez === "number" ? { vez } : {}) }));
    const el = document.querySelector(ALVOS[dia]);
    try { (el as HTMLElement | null)?.scrollIntoView?.({ block: "center", behavior: reduzir ? "auto" : "smooth" }); } catch { /* jsdom */ }
    const medir = () => { const e = document.querySelector(ALVOS[dia]); setRect(e ? e.getBoundingClientRect() : null); };
    const id = window.setTimeout(medir, 400);
    const relogio = window.setInterval(medir, 500); // a rolagem suave termina depois: segue o alvo
    return () => { window.clearTimeout(id); window.clearInterval(relogio); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const ALTURA = 190;
  const cabeAbaixo = rect ? rect.bottom + 12 + ALTURA <= vh - 8 : true;
  const top = rect ? (cabeAbaixo ? rect.bottom + 12 : Math.max(8, rect.top - ALTURA - 12)) : vh - 220;
  return createPortal(
    <motion.div className="fixed inset-0 z-[220] pointer-events-none" data-camada-guia="missao-dica" data-testid="missao-dica" data-dia={dia} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {rect && <div className="absolute rounded-2xl pointer-events-none" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 2px #fff, 0 0 0 9999px rgba(15,12,20,.45)" }} />}
      <div className="absolute left-1/2 -translate-x-1/2 w-[92%] max-w-[340px] pointer-events-auto rounded-2xl bg-accent text-accent-foreground px-4 py-3.5 shadow-2xl" style={{ top }} role="dialog" aria-label={t.titulo}>
        <p className="text-[16px] font-bold leading-tight" data-testid="missao-dica-titulo">{t.titulo}</p>
        <p className="text-[13px] leading-snug opacity-90 mt-1">{t.texto}</p>
        <button type="button" className="mt-3 w-full h-10 rounded-full text-[14px] font-extrabold bg-white text-accent" data-testid="missao-dica-entendi"
          onClick={() => { trackEvent("missao_dica_dia", eventoDaMissao({ dia, acao: "entendi" })); aoFechar(); }}>Entendi</button>
      </div>
    </motion.div>,
    document.body,
  );
}
