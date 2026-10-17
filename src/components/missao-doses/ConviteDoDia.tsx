import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { somarDias } from "@/lib/sequencia";
import { DOSE_CURTA, MODULOS, dosesFeitas, passoPendente, rotuloDoFeito, sequenciaDaMissao, type DiaDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
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
export function ConviteDoDia({ missao, hoje, aoIr, aoDepois, aoVer }: {
  missao: EstadoMissaoDoses;
  hoje: string;
  aoIr: () => void;
  aoDepois: () => void;
  /** chamado 1x quando a folha aparece (quem chama conta a vista e manda `missao_convite acao=visto`) */
  aoVer?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const pendente = passoPendente(missao);
  const feitas = dosesFeitas(missao);
  useEffect(() => { aoVer?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pendente) return null;
  const cfg = MODULOS[pendente.modulo];
  const anterior = feitas ? rotuloDoFeito(missao, feitas as DiaDaMissao) : null;
  const anteriorCfg = feitas ? MODULOS[missao.modulos[feitas - 1]] : null;
  // a sequência está viva se a última dose foi ONTEM — aí a de hoje fecha os dias seguidos
  const seguidosOntem = sequenciaDaMissao(missao, somarDias(hoje, -1));
  const dia = pendente.n;
  const linhaOntem = anterior && anteriorCfg
    ? anteriorCfg.modulo === "financas" && /^Pode gastar/.test(anterior)
      ? <>Ontem você montou suas Finanças: <b className="text-[#16121c]">{anterior.replace(/^Pode gastar /, "")}</b>.</>
      : <>Ontem: <b className="text-[#16121c]">{anterior}</b> {anteriorCfg.onde}.</>
    : null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[230] flex items-end justify-center px-4 pb-6 pt-10"
      style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 24px)" }}
      role="dialog" aria-modal="true" aria-label={`Dia ${dia} de 3`}
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
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-black/55">Seu plano de 3 dias</span>
        </div>
        <p className="text-[22px] font-black tracking-[-0.02em] leading-tight mt-2.5" data-testid="missao-doses-convite-titulo">
          Dia {dia} de 3 · {cfg.emoji} {cfg.nome} · {DOSE_CURTA[pendente.modulo].seg} s
        </p>
        <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5">
          {dia === 3 && seguidosOntem >= 2 ? <>Faltam {DOSE_CURTA[pendente.modulo].seg} s pros seus 3 dias seguidos. </> : null}
          {linhaOntem}
        </p>
        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-convite-ir" onClick={aoIr}>
          Bora <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" className="md-link" data-testid="missao-doses-convite-depois" onClick={aoDepois}>Agora não</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
