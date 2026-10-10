import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { conteudoDoLembrete, rotuloDeMinutos, type ConteudoDia2 } from "@/lib/lembrete-dia2";
import {
  GATILHOS_AMANHA, QUANDOS_AMANHA, fraseDoPlano, minutosDoPlano, novoPlanoAmanha, quandoSugerido,
  type GatilhoAmanha, type PlanoAmanha, type QuandoAmanha,
} from "@/lib/dia1-cheio";
import { eventoDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * A FOLHA DO PLANO DE AMANHÃ (10/10, chave DIA1_CHEIO, braço B — lib/dia1-cheio).
 *
 * No fim da 1ª sessão (≥1 dose feita ou "Agora não"), uma folha SÓ COM CHIPS:
 * "Quando você abre o CORE amanhã?" (manhã / almoço / noite) e "com o quê?" (café /
 * almoço / antes de dormir — opcional). Nada pra digitar. O que ela marca vira a hora
 * do Lembrete do dia 2 (combinarHora, em quem chama), com o conteúdo concreto do
 * que ela fez hoje — a prévia aparece aqui embaixo, como a notificação vai chegar.
 * A permissão de notificação é pedida por quem chama, logo depois do "Combinado"
 * (ligada a este plano, nunca solta).
 */
export function PlanoDeAmanha({ missao, hoje = localDayKey(), aoCombinar, aoPular }: {
  missao: EstadoMissaoDoses;
  hoje?: string;
  aoCombinar: (plano: PlanoAmanha, previa: ConteudoDia2) => void;
  aoPular: () => void;
}) {
  const { get } = useUserData();
  const [quando, setQuando] = useState<QuandoAmanha>(() => quandoSugerido());
  const [gatilho, setGatilho] = useState<GatilhoAmanha | null>(null);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    trackEvent("plano_amanha_folha", eventoDaMissao({ acao: "view", doses: Object.keys(missao.feitos).length }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hora = minutosDoPlano(quando);
  const amanha = somarDias(hoje, 1);
  const [y, m, d] = amanha.split("-").map(Number);
  const previa = conteudoDoLembrete(get, { missao, amanha: new Date(y, m - 1, d, Math.floor(hora / 60), hora % 60), hoje });
  const plano = novoPlanoAmanha(quando, gatilho ?? undefined, hoje);

  const combinar = () => {
    if (indo) return;
    setIndo(true);
    aoCombinar(plano, previa);
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[245] flex items-end justify-center" style={{ background: "rgba(15,12,20,.45)" }} data-camada-guia="plano-amanha" data-testid="plano-amanha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-labelledby="plano-amanha-titulo">
      <motion.div
        initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-[440px] rounded-t-3xl bg-white text-[#16121c] shadow-2xl px-5 pt-5"
        style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 18px)" }}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: "#16121c" }}><Bell className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p id="plano-amanha-titulo" className="text-[19px] font-black tracking-[-0.02em] leading-tight">Quando você abre o CORE amanhã?</p>
            <p className="text-[13px] text-[#4f5a64] mt-1 leading-snug">Quem combina a hora volta no dia 2 — e é o dia 2 que decide. Um toque só.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quando">
          {QUANDOS_AMANHA.map((q) => {
            const on = quando === q.id;
            return (
              <button key={q.id} type="button" role="radio" aria-checked={on} data-testid={`plano-amanha-quando-${q.id}`} data-marcado={on ? "" : undefined} onClick={() => setQuando(q.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 text-[13px] font-extrabold ${on ? "border-[#16121c] bg-[#16121c] text-white" : "border-black/10 bg-white text-[#16121c]"}`}>
                <span className="text-[22px] leading-none" aria-hidden>{q.emoji}</span>
                <span>{q.rotulo}</span>
                <span className={`text-[11px] font-semibold ${on ? "text-white/70" : "text-[#4f5a64]"}`}>{rotuloDeMinutos(q.min)}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#4f5a64] mt-4">Com o quê? <span className="font-semibold normal-case tracking-normal">(opcional)</span></p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Gatilho">
          {GATILHOS_AMANHA.map((g) => {
            const on = gatilho === g.id;
            return (
              <button key={g.id} type="button" aria-pressed={on} data-testid={`plano-amanha-gatilho-${g.id}`} data-marcado={on ? "" : undefined} onClick={() => setGatilho(on ? null : g.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 min-h-[40px] text-[13.5px] font-bold ${on ? "border-[#16121c] bg-[#16121c] text-white" : "border-[#16121c] bg-white text-[#16121c]"}`}>
                {on && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}<span aria-hidden>{g.emoji}</span> {g.rotulo}
              </button>
            );
          })}
        </div>

        {/* a prévia: a notificação como ela vai chegar, com o que a pessoa fez HOJE */}
        <div className="mt-4 rounded-2xl border border-black/10 px-3.5 py-3 text-left" style={{ background: "#FFF8D6" }} data-testid="plano-amanha-previa">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>{fraseDoPlano(plano)} · {rotuloDeMinutos(hora)}</span>
          <span className="block text-[14.5px] font-extrabold leading-snug mt-0.5">{previa.title}</span>
          <span className="block text-[12.5px] text-[#4f5a64] leading-snug mt-0.5">{previa.body}</span>
        </div>

        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="plano-amanha-combinado" disabled={indo} onClick={combinar}>
          Combinado, {fraseDoPlano(plano).replace(/^Amanhã /, "amanhã ")}
        </button>
        <button type="button" className="md-link mt-1" data-testid="plano-amanha-pular" onClick={aoPular}>Sem lembrete</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
