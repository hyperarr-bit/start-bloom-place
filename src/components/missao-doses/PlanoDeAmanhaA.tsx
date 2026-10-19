import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { doseCurta, emSegundos, MODULOS, eventoDaMissao, passoPendente, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao } from "@/lib/missao-doses";
import "./missao-doses.css";
import { lembretesSoNoApp } from "@/lib/missao-web";
import { BaixarAppPopup } from "@/missao/BaixarAppPopup";

/**
 * "PLANO DE AMANHÃ" DO BRAÇO A (1.0.16, desenho 8 seção 4.2 passo 6) — a ÚLTIMA coisa do dia 1:
 * depois da dose 1, da comemoração pequena e do tour curto da Home. Folha de baixo:
 * "Amanhã a gente monta sua Rotina em 20 s. Que horas te lembro?" · 8h · 12h · 20h (já marcado o
 * mais perto da hora de agora) · "Combinado" · link "Sem lembrete". A hora vira a do Lembrete do
 * dia 2 (combinarHora, em quem chama) e é AQUI que a permissão de notificação é pedida (1x).
 * Segue o tema do app (claro/escuro).
 */
const HORAS: Array<Exclude<Lembrete, "sem">> = ["8h", "12h", "20h"];
const MINUTOS: Record<Exclude<Lembrete, "sem">, number> = { "8h": 8 * 60, "12h": 12 * 60, "20h": 20 * 60 };

/** O chip que começa marcado: o mais perto da hora de AGORA (quem abre à noite costuma abrir à noite). */
export function horaMaisPerto(agora: Date = new Date()): Exclude<Lembrete, "sem"> {
  const min = agora.getHours() * 60 + agora.getMinutes();
  return HORAS.reduce((melhor, h) => (Math.abs(MINUTOS[h] - min) < Math.abs(MINUTOS[melhor] - min) ? h : melhor));
}

/** "Amanhã a gente monta sua Rotina em 20 s." — a frase da dose de amanhã, do jeito que se fala. */
export function fraseDeAmanha(modulo: ModuloDaMissao | null | undefined, n = 2): string {
  if (!modulo) return "Amanhã tem mais um passo do seu plano.";
  const cfg = MODULOS[modulo];
  const seg = doseCurta(modulo, n).seg;
  switch (modulo) {
    // 1.0.16: o quiz é só a 1ª dose — em 2º/3º, Finanças é o gasto de hoje
    case "financas": return n === 1 ? `Amanhã a gente monta suas Finanças em ${emSegundos(seg)}.` : `Amanhã é 1 gasto nas suas Finanças: ${emSegundos(seg)}.`;
    case "rotina": return `Amanhã a gente monta sua Rotina em ${emSegundos(seg)}.`;
    case "saude": return `Amanhã é a vez da sua Saúde: 1 copo d'água, ${emSegundos(seg)}.`;
    case "treino": return `Amanhã a gente escolhe o seu treino em ${emSegundos(seg)}.`;
    case "desenvolvimento": return `Amanhã a gente escolhe a sua primeira meta em ${emSegundos(seg)}.`;
    default: return `Amanhã é a vez de ${cfg.emoji} ${cfg.nome}: ${emSegundos(seg)}.`;
  }
}

export function PlanoDeAmanhaA({ missao, aoCombinar, aoSemLembrete }: {
  missao: EstadoMissaoDoses;
  aoCombinar: (l: Lembrete) => void;
  aoSemLembrete: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [hora, setHora] = useState<Exclude<Lembrete, "sem">>(() => horaMaisPerto());
  const proxima = passoPendente(missao);
  // 18/10 (funil da missão na WEB): "que horas te lembro?" vira o pop-up "Baixe o app pra receber os lembretes" —
  // o navegador não manda notificação. "Agora não" = "Sem lembrete" (a missão segue)
  const [soNoApp] = useState(lembretesSoNoApp);
  useEffect(() => {
    // na web quem conta a vista é o pop-up (missao_web_lembrete_popup) — ele espera a oferta sair
    if (!soNoApp) trackEvent("plano_amanha_folha", eventoDaMissao({ acao: "view", indice: proxima?.n ?? null, sugerida: hora }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (soNoApp) return <BaixarAppPopup contexto="plano_amanha" depoisDaOferta onAgoraNao={aoSemLembrete} />;
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10" style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label="Plano de amanhã" data-camada-guia="missao-doses-plano" data-testid="plano-amanha-a"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="md-tema w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 shadow-2xl">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Plano de amanhã</p>
        <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-1.5" data-testid="plano-amanha-a-titulo">
          {fraseDeAmanha(proxima?.modulo, proxima?.n)} Que horas te lembro?
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
