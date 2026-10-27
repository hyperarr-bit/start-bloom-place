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
import { tomDoBotaoDaMissao } from "@/lib/home-nova";
import "./missao-doses.css";

/**
 * A FOLHA DO PLANO DE AMANHÃ (10/10, chave DIA1_CHEIO, braço B — lib/dia1-cheio).
 *
 * A ÚLTIMA coisa do dia 1 da missão (depois da festa "Casa arrumada", ou logo depois
 * de um "Agora não"), ainda no contexto da missão. Refeita com o feedback do dono
 * (10/10): a pessoa ainda não conhece o app — a folha abre pelo VALOR dos avisos
 * ("O CORE te avisa do que importa": conta vencendo, hábito do dia, a próxima
 * dose), depois pergunta "Que horas te lembro amanhã?" com 3 chips (manhã / almoço
 * / noite) + "com o quê?" opcional, mostra a notificação como vai chegar (com o
 * registro REAL da dose) e fecha com o botão fixo embaixo ("Combinado, amanhã de
 * manhã") e o link "Sem lembrete" logo acima. Nada de "dia 2" (jargão nosso).
 * O que ela marca vira a hora do Lembrete do dia 2 (combinarHora, em quem chama)
 * e a permissão de notificação é pedida logo depois do "Combinado", ligada ao plano.
 * 17/10 (polimento da 1.0.16): a folha segue o tema do app (era branca no modo escuro), como as do braço A.
 */
const AVISOS: Array<{ emoji: string; texto: string }> = [
  { emoji: "🔔", texto: "Conta vencendo — antes do juros" },
  { emoji: "✅", texto: "Hábito do dia — na hora que você escolher" },
  { emoji: "🎯", texto: "Sua próxima dose da missão — 20\u00a0s" },
];

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
  const frase = fraseDoPlano(plano).replace(/^Amanhã /, "amanhã ");

  const combinar = () => {
    if (indo) return;
    setIndo(true);
    aoCombinar(plano, previa);
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[245] flex flex-col justify-end" style={{ background: "rgba(15,12,20,.45)" }} data-camada-guia="plano-amanha" data-testid="plano-amanha" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-labelledby="plano-amanha-titulo">
      <motion.div
        initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="md-tema w-full rounded-t-3xl bg-card text-card-foreground shadow-2xl flex flex-col max-h-[calc(100dvh-var(--app-safe-top,0px)-24px)]"
      >
        <div className="overflow-y-auto px-5 pt-5 pb-2">
          <div className="max-w-[420px] mx-auto">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background"><Bell className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p id="plano-amanha-titulo" className="text-[19px] font-black tracking-[-0.02em] leading-tight">O CORE te avisa do que importa</p>
                <p className="text-[13px] text-muted-foreground mt-1 leading-snug">Um aviso por dia, só com o que é seu.</p>
              </div>
            </div>

            <ul className="mt-3.5 space-y-1.5" data-testid="plano-amanha-avisos">
              {AVISOS.map((a) => (
                <li key={a.texto} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                  <span className="text-[17px] leading-none" aria-hidden>{a.emoji}</span>
                  <span className="text-[13.5px] font-semibold leading-snug">{a.texto}</span>
                </li>
              ))}
            </ul>

            <p className="text-[15px] font-black tracking-[-0.01em] mt-4">Que horas te lembro amanhã?</p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quando">
              {QUANDOS_AMANHA.map((q) => {
                const on = quando === q.id;
                return (
                  <button key={q.id} type="button" role="radio" aria-checked={on} data-testid={`plano-amanha-quando-${q.id}`} data-marcado={on ? "" : undefined} onClick={() => setQuando(q.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 py-2.5 text-[13px] font-extrabold ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground"}`}>
                    <span className="text-[20px] leading-none" aria-hidden>{q.emoji}</span>
                    <span>{q.rotulo}</span>
                    <span className={`text-[11px] font-semibold ${on ? "text-background/70" : "text-muted-foreground"}`}>{rotuloDeMinutos(q.min)}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mt-3.5">Com o quê? <span className="font-semibold normal-case tracking-normal">(opcional)</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Gatilho">
              {GATILHOS_AMANHA.map((g) => {
                const on = gatilho === g.id;
                return (
                  <button key={g.id} type="button" aria-pressed={on} data-testid={`plano-amanha-gatilho-${g.id}`} data-marcado={on ? "" : undefined} onClick={() => setGatilho(on ? null : g.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 min-h-[38px] text-[13px] font-bold ${on ? "border-foreground bg-foreground text-background" : "border-foreground/70 bg-card text-foreground"}`}>
                    {on && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}<span aria-hidden>{g.emoji}</span> {g.rotulo}
                  </button>
                );
              })}
            </div>

            {/* a prévia: a notificação como ela vai chegar, com o registro REAL de hoje */}
            <div className="mt-3.5 rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-3 text-left bg-[#FFF8D6] text-[#16121c] dark:bg-[#2a2618] dark:text-foreground" data-testid="plano-amanha-previa">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a4b12] dark:text-[#e9c47c]">{fraseDoPlano(plano)} · {rotuloDeMinutos(hora)}</span>
              <span className="block text-[14px] font-extrabold leading-snug mt-0.5">{previa.title}</span>
              <span className="block text-[12.5px] opacity-75 leading-snug mt-0.5">{previa.body}</span>
            </div>
          </div>
        </div>

        {/* o rodapé colado (regra do dono): link acima, pílula de 56 px embaixo, por cima da safe-area */}
        <div className="shrink-0 px-6 pt-2 bg-card" style={{ paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}>
          <div className="max-w-[420px] mx-auto">
            <button type="button" className="md-link mb-1" data-testid="plano-amanha-pular" onClick={aoPular}>Sem lembrete</button>
            <button type="button" className="md-botao md-botao-56" data-tom={tomDoBotaoDaMissao()} data-testid="plano-amanha-combinado" disabled={indo} onClick={combinar}>
              Combinado, {frase}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
