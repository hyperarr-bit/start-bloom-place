import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { horaSugeridaDaMissao } from "@/lib/lembrete-dia2";
import { DOSE_CURTA, MODULOS, eventoDaMissao, passoPendente, type EstadoMissaoDoses, type Lembrete } from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * "PLANO DE AMANHÃ" DO BRAÇO A (1.0.16, desenho 8 seção 4.2 passo 6) — a ÚLTIMA coisa do dia 1:
 * depois da dose 1, da comemoração pequena e do tour curto da Home. Folha de baixo:
 * "Amanhã a gente monta sua Rotina em 20 s. Que horas te lembro?" · 8h · 12h · 20h (já marcado o
 * mais perto da hora de agora) · "Combinado" · link "Sem lembrete". A hora vira a do Lembrete do
 * dia 2 (combinarHora, em quem chama) e é AQUI que a permissão de notificação é pedida (1x).
 */
const HORAS: Array<Exclude<Lembrete, "sem">> = ["8h", "12h", "20h"];

export function PlanoDeAmanhaA({ missao, aoCombinar, aoSemLembrete }: {
  missao: EstadoMissaoDoses;
  aoCombinar: (l: Lembrete) => void;
  aoSemLembrete: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const sugerida = horaSugeridaDaMissao();
  const [hora, setHora] = useState<Exclude<Lembrete, "sem">>(sugerida === "sem" ? "20h" : sugerida);
  const proxima = passoPendente(missao);
  const cfg = proxima ? MODULOS[proxima.modulo] : null;
  useEffect(() => {
    trackEvent("plano_amanha_folha", eventoDaMissao({ acao: "view", indice: proxima?.n ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const verbo = cfg?.modulo === "financas" ? "monta suas Finanças" : cfg?.modulo === "saude" ? "marca sua água" : cfg ? `monta sua ${cfg.nome}` : "continua";
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10" style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 24px)" }}
      role="dialog" aria-modal="true" aria-label="Plano de amanhã" data-camada-guia="missao-doses-plano" data-testid="plano-amanha-a"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-[380px] rounded-3xl bg-white p-5 text-[#16121c] shadow-2xl">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-black/55">Plano de amanhã</p>
        <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-1.5" data-testid="plano-amanha-a-titulo">
          Amanhã a gente {verbo}{cfg ? ` em ${DOSE_CURTA[cfg.modulo].seg} s` : ""}. Que horas te lembro?
        </p>
        <div className="flex gap-2 mt-4" role="radiogroup" aria-label="Hora do lembrete">
          {HORAS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={hora === h} className="md-hora flex-1" data-marcada={hora === h ? "" : undefined} data-testid={`plano-a-hora-${h}`} onClick={() => setHora(h)}>{h}</button>
          ))}
        </div>
        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="plano-a-combinado" onClick={() => aoCombinar(hora)}>Combinado</button>
        <button type="button" className="md-link" data-testid="plano-a-sem" onClick={aoSemLembrete}>Sem lembrete</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
