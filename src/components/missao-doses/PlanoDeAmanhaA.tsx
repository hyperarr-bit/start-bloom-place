import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { MODULOS, dias23NaMissao, diaDaMissao, eventoDaMissao, passoPendente, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao } from "@/lib/missao-doses";
import { useUserData } from "@/hooks/use-user-data";
import { porDiaDasFinancas } from "@/lib/lembrete-dia2";
import { localDayKey } from "@/lib/utils";
import { entrada, MOV } from "@/lib/movimento";
import { EscolhaDeHora } from "./EscolhaDeHora";
import "./missao-doses.css";
import { lembretesSoNoApp } from "@/lib/missao-web";
import { BaixarAppPopup } from "@/missao/BaixarAppPopup";
import { tomDoBotaoDaMissao } from "@/lib/home-nova";
import { FaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";

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

/** 1.0.17 (dono: "minimalista, sem segundos na tela"): "Amanhã: Rotina." — a frase da dose de amanhã, curta. */
export function fraseDeAmanha(modulo: ModuloDaMissao | null | undefined, n = 2): string {
  void n;
  if (!modulo) return "Amanhã tem mais um passo.";
  return `Amanhã: ${MODULOS[modulo].nome}.`;
}

/** 1.0.17 (item 7): "Dia 1 feito 💛" — o dia da dose feita hoje (sem ponto final), o fechamento do dia. */
export function tituloDoDiaFeito(missao: EstadoMissaoDoses, hoje: string = localDayKey()): string {
  const n = ([3, 2, 1] as DiaDaMissao[]).find((d) => missao.feitos[d]?.dia === hoje) ?? 1;
  return `Dia ${n} feito 💛`;
}

export function PlanoDeAmanhaA({ missao, aoCombinar, aoSemLembrete }: {
  missao: EstadoMissaoDoses;
  aoCombinar: (l: Lembrete) => void;
  aoSemLembrete: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [hora, setHora] = useState<Lembrete>(() => horaMaisPerto());
  // 1.0.19: com a Home nova por baixo, o "Combinado" é o botão da E (tinta), não o magenta
  const [tom] = useState(() => tomDoBotaoDaMissao());
  const proxima = passoPendente(missao);
  // 18/10 (funil da missão na WEB): "que horas te lembro?" vira o pop-up "Baixe o app pra receber os lembretes" —
  // o navegador não manda notificação. "Agora não" = "Sem lembrete" (a missão segue)
  const [soNoApp] = useState(lembretesSoNoApp);
  /* 1.0.18 (chave `dias23`, RELATORIO M1): a folha promete o que FICA PRONTO amanhã — com Finanças montada, "quanto dá
     pra gastar amanhã"; sem, "você escolhe o seu 2º módulo" (o dia 2 novo). Desligada: a folha de sempre. */
  const { get } = useUserData();
  const [promessa] = useState<null | "numero" | "escolha">(() => {
    if (!dias23NaMissao(missao)) return null;
    try { return porDiaDasFinancas(get) !== null ? "numero" : "escolha"; } catch { return "escolha"; }
  });
  useEffect(() => {
    // na web quem conta a vista é o pop-up (missao_web_lembrete_popup) — ele espera a oferta sair
    if (!soNoApp) trackEvent("plano_amanha_folha", eventoDaMissao({ acao: "view", indice: proxima?.n ?? null, sugerida: hora }));
    if (!soNoApp && promessa) trackEvent("dia1_promessa_view", eventoDaMissao({ promessa, dia_do_teste: diaDaMissao(missao) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (soNoApp) return <BaixarAppPopup contexto="plano_amanha" depoisDaOferta onAgoraNao={aoSemLembrete} antes={tituloDoDiaFeito(missao)} />;
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10" style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label="Plano de amanhã" data-camada-guia="missao-doses-plano" data-testid="plano-amanha-a"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={entrada(reduzir, MOV.base)}>
      <FaixaDoRelogioTransparente />
      <motion.div initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={entrada(reduzir, MOV.calmo, 0.08)}
        className="md-tema w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 shadow-2xl">
        {/* 1.0.17 (item 7): o fechamento do dia mora AQUI (a festa da dose 1 comemora o módulo; o tour vem no meio) */}
        <p className="text-[24px] font-black tracking-[-0.02em] leading-tight" data-testid="plano-amanha-a-titulo">{tituloDoDiaFeito(missao)}</p>
        {promessa ? (
          <>
            <p className="text-[15px] text-muted-foreground mt-1">Amanhã fica pronto</p>
            <div className="mt-3 rounded-2xl px-4 py-3 bg-[#FFF6D1] text-[#2b2b2f] dark:bg-[rgba(255,211,110,.14)] dark:text-foreground" data-testid="plano-amanha-a-promessa" data-promessa={promessa}>
              <span className="block text-[11px] font-extrabold tracking-[.12em] uppercase text-[#9a5b00] dark:text-[#ffd36e]" data-testid="plano-amanha-a-promessa-hora">Amanhã · {hora === "sem" ? "de manhã" : hora}</span>
              <span className="block text-[17px] font-black tracking-[-0.01em] leading-tight mt-0.5">{promessa === "numero" ? "Quanto dá pra gastar amanhã" : "Você escolhe o seu 2º módulo"}</span>
              <span className="block text-[13px] opacity-70 mt-0.5">{promessa === "numero" ? "com o que você anotou hoje" : "um módulo só seu"}</span>
            </div>
            <p className="text-[15px] text-muted-foreground mt-4">Que horas te aviso?</p>
          </>
        ) : (
          <>
            <p className="text-[16px] font-extrabold leading-snug mt-1.5" data-testid="plano-amanha-a-amanha">{fraseDeAmanha(proxima?.modulo, proxima?.n).replace(/\.$/, "")}</p>
            <p className="text-[15px] text-muted-foreground mt-1">Que horas te lembro?</p>
          </>
        )}
        <div className="mt-4">
          <EscolhaDeHora valor={hora} aoMudar={(h) => setHora(h)} comSem={false} testid="plano-a-hora" />
        </div>
        <button type="button" className="md-botao mt-5" data-tom={tom} data-testid="plano-a-combinado" onClick={() => aoCombinar(hora)}>Combinado</button>
        <button type="button" className="md-link" data-testid="plano-a-sem" onClick={aoSemLembrete}>Sem lembrete</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
