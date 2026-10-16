import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { MODULOS, diaDaMissao, dosesFeitas, eventoDaMissao, passoPendente, rotuloDoFeito, type DiaDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * O CONVITE DO DIA (16/10, 1.0.16 — braço A, "uma dose por dia").
 *
 * No app a Home não ganha card (dono 03/10: "nada de card novo no topo da Home"). Na 1.0.10 a dose
 * do dia 2 só aparecia pra quem tocava no Lembrete do dia 2 ou entrava SOZINHA no módulo certo — e
 * 47% nunca reabriam. Quem reabre num dia novo encontra, UMA vez por dia, esta folha de baixo:
 * "Dia 2 da missão · 📅 Rotina · Marca 1 hábito — 20 s" + "Bora" (abre o módulo, o passo entra
 * lá) e "Agora não" (some até amanhã; o passo continua no módulo e no lembrete). A decisão fica
 * na missão (`convites[dia]`, chave `missao-doses`, que nenhuma vassoura leva): fechar e reabrir o
 * app, ou sair e entrar na conta, não a repete no mesmo dia.
 */
export function ConviteDoDia({ missao, hoje, aoIr, aoDepois }: {
  missao: EstadoMissaoDoses;
  hoje: string;
  aoIr: () => void;
  aoDepois: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const pendente = passoPendente(missao);
  const dia = diaDaMissao(missao, hoje);
  const feitas = dosesFeitas(missao);
  useEffect(() => {
    if (pendente) trackEvent("missao_convite_dia", eventoDaMissao({ acao: "view", dia_relogio: dia, indice: pendente.n, modulo: pendente.modulo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!pendente) return null;
  const cfg = MODULOS[pendente.modulo];
  const anterior = feitas ? rotuloDoFeito(missao, feitas as DiaDaMissao) : null;
  const anteriorCfg = feitas ? MODULOS[missao.modulos[feitas - 1]] : null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[230] flex items-end justify-center px-4 pb-6 pt-10"
      style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 24px)" }}
      role="dialog" aria-modal="true" aria-label={`Dia ${dia} da missão`}
      data-camada-guia="missao-doses-convite" data-testid="missao-doses-convite" data-dia={dia}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <motion.div
        initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative w-full max-w-[380px] rounded-3xl bg-white p-5 text-left text-[#16121c] shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1" role="img" aria-label={`${feitas} de 3 feitos`}>
            {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitas} tam={16} />)}
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-black/55">Dia {dia} da missão</span>
        </div>
        <p className="text-[22px] font-black tracking-[-0.02em] leading-tight mt-2.5" data-testid="missao-doses-convite-titulo">
          {cfg.emoji} {cfg.nome}: {cfg.pedido.toLowerCase()}
        </p>
        <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5">
          {anterior && anteriorCfg
            ? <>Ontem: <b className="text-[#16121c]">{anterior}</b> {anteriorCfg.onde}. Hoje é o passo {pendente.n} de 3 — uns 20 segundos.</>
            : <>O passo {pendente.n} de 3 — uns 20 segundos.</>}
        </p>
        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-convite-ir" onClick={aoIr}>
          Bora, 20 s <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" className="md-link" data-testid="missao-doses-convite-depois" onClick={aoDepois}>Agora não</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
