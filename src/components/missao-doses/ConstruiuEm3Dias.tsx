import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { entrada, MOV } from "@/lib/movimento";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Confete } from "@/components/demo-guiada/pecas";
import { useUserData } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { useConquistas, useSequencia } from "@/components/conquistas/use-conquistas";
import { trackEvent } from "@/lib/analytics";
import { eventoDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import "./missao-doses.css";

/**
 * "O QUE VOCÊ CONSTRUIU EM 3 DIAS" (D8): a missão 100% com o que ela fez em
 * cada dia, o score (do começo → hoje), a sequência com a semana, os adesivos
 * colados e as pendências de amanhã. "Continuar com o meu CORE" fecha e marca
 * como visto (uma vez só).
 *
 * 17/10 (revisão tela a tela, #39): a tela é mais alta que um iPhone de 390×844 — o botão ficava no fim do
 * conteúdo e saía cortado embaixo. Agora ele fica COLADO embaixo (sticky, no fluxo: rolado até o fim, nada fica
 * atrás dele), com um degradê do fundo por cima do que rola por baixo e a área segura de baixo. O título equilibra
 * as 2 linhas ("O que você construiu / em 3 dias" — nada de "dias" sozinho).
 */
export function ConstruiuEm3Dias({ missao, aoContinuar }: { missao: EstadoMissaoDoses; aoContinuar: () => void }) {
  const dados = useLifeHubData();
  const reduzir = !!useReducedMotion();
  const seq = useSequencia();
  const conq = useConquistas();
  const { get } = useUserData();
  const pend = useMemo(() => pendenciasDeHoje(dados, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()), [dados, get]);
  const scoreAntes = missao.scoreNoInicio ?? 0;
  useEffect(() => {
    trackEvent("missao_doses_fim", eventoDaMissao({ score_antes: scoreAntes, score_hoje: dados.dayScore, sequencia: seq.dias, adesivos: conq.abertos, pendencias_amanha: pend.pending.length, modulos: missao.modulos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* 1.0.17 (dono: "minimalista"): o título e 3 números grandes — dias seguidos, score de hoje, adesivos — e um botão.
     A tela entra devagar (fade 420 ms); os números chegam um depois do outro (60 ms), o confete por último. */
  const numeros: Array<{ id: string; valor: number; rotulo: string }> = [
    { id: "sequencia", valor: seq.dias, rotulo: seq.dias === 1 ? "dia seguido" : "dias seguidos" },
    { id: "score", valor: Math.round(dados.dayScore ?? 0), rotulo: "score de hoje" },
    { id: "adesivos", valor: conq.abertos, rotulo: conq.abertos === 1 ? "adesivo" : "adesivos" },
  ];
  return (
    <motion.div className="fixed inset-0 z-[240] overflow-y-auto bg-background text-foreground" data-camada-guia="missao-doses-fim" data-testid="missao-doses-fim" style={{ paddingTop: "var(--app-safe-top)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={entrada(reduzir, MOV.calmo)}>
      <Confete atraso={reduzir ? 0 : 0.9} />
      <div className="min-h-full max-w-[420px] mx-auto flex flex-col px-6 pt-[14vh]">
        <span className="flex gap-1.5" role="img" aria-label="3 de 3 dias feitos">{[1, 2, 3].map((i) => <Quadradinho key={i} marcado tam={18} />)}</span>
        <h1 className="text-[30px] font-black tracking-[-0.03em] leading-[1.1] mt-4 text-balance" data-testid="missao-doses-fim-titulo">Você construiu isso em 3{"\u00a0"}dias</h1>
        <div className="grid grid-cols-3 gap-3 mt-8" data-testid="missao-doses-fim-numeros">
          {numeros.map((x, i) => (
            <motion.div key={x.id} initial={reduzir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.calmo, 0.3 + i * 0.06)}
              className="rounded-2xl border border-border bg-card px-3 py-4 text-center" data-testid={`missao-doses-fim-${x.id}`}>
              <div className="text-[34px] font-black tracking-tight leading-none tabular-nums">{x.valor}</div>
              <div className="text-[12px] text-muted-foreground mt-1.5 leading-tight">{x.rotulo}</div>
            </motion.div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="md-fim-rodape" data-testid="missao-doses-fim-rodape">
          <button type="button" className="md-botao md-botao-56" data-testid="missao-doses-continuar" onClick={aoContinuar}>
            Continuar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
