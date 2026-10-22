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
import { MODULOS, diaDaMissao, dosesFeitas, eventoDaMissao, type DiaDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { Check } from "lucide-react";
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
/** 1.0.18 (dias23): a linha de cada dose feita no resumo — "R$ 61 por dia" (Finanças), senão o rótulo do feito. */
export function linhaDoFeitoNoResumo(m: EstadoMissaoDoses, n: DiaDaMissao): string | null {
  const f = m.feitos[n];
  if (!f) return null;
  const porDia = /^Pode gastar (R\$ [\d.,]+ por dia)$/.exec(String(f.rotulo ?? "").trim());
  return porDia ? porDia[1] : String(f.rotulo ?? "").trim() || "feito";
}

export function ConstruiuEm3Dias({ missao, aoContinuar, aoAbrir = false, aoVer }: {
  missao: EstadoMissaoDoses;
  aoContinuar: () => void;
  /** 1.0.18 (chave `dias23`): abriu SOZINHO ao abrir o app no dia 3 (não depois da 3ª dose) — mostra também o que
   *  cada dose fez e manda `dia3_construiu_view` */
  aoAbrir?: boolean;
  /** chamado 1x quando a tela aparece (quem chama conta a vista) */
  aoVer?: () => void;
}) {
  const dados = useLifeHubData();
  const reduzir = !!useReducedMotion();
  const seq = useSequencia();
  const conq = useConquistas();
  const { get } = useUserData();
  const pend = useMemo(() => pendenciasDeHoje(dados, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()), [dados, get]);
  const scoreAntes = missao.scoreNoInicio ?? 0;
  useEffect(() => {
    trackEvent("missao_doses_fim", eventoDaMissao({ score_antes: scoreAntes, score_hoje: dados.dayScore, sequencia: seq.dias, adesivos: conq.abertos, pendencias_amanha: pend.pending.length, modulos: missao.modulos }));
    aoVer?.();
    if (aoAbrir) trackEvent("dia3_construiu_view", eventoDaMissao({ dia_do_teste: diaDaMissao(missao), doses: dosesFeitas(missao), sequencia: seq.dias, adesivos: conq.abertos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* 1.0.17 (dono: "minimalista"): o título e 3 números grandes — dias seguidos, score de hoje, adesivos — e um botão.
     A tela entra devagar (fade 420 ms); os números chegam um depois do outro (60 ms), o confete por último. */
  const numerosDeSempre: Array<{ id: string; valor: number; rotulo: string }> = [
    { id: "sequencia", valor: seq.dias, rotulo: seq.dias === 1 ? "dia seguido" : "dias seguidos" },
    { id: "score", valor: Math.round(dados.dayScore ?? 0), rotulo: "score de hoje" },
    { id: "adesivos", valor: conq.abertos, rotulo: conq.abertos === 1 ? "adesivo" : "adesivos" },
  ];
  /* 1.0.18 (dias23): aberto na ABERTURA do dia 3 (antes de qualquer registro de hoje), a sequência e o score de hoje podem
     estar em 0 — nada de "0 dias seguidos" na tela do que ela construiu. Os números são os dela: módulos montados,
     adesivos e, só quando está viva (≥ 2), a sequência. */
  const feitas = dosesFeitas(missao);
  const numeros = aoAbrir
    ? [
      ...(seq.dias >= 2 ? [numerosDeSempre[0]] : []),
      { id: "modulos", valor: feitas, rotulo: feitas === 1 ? "módulo montado" : "módulos montados" },
      ...(conq.abertos > 0 ? [numerosDeSempre[2]] : []),
    ]
    : numerosDeSempre;
  return (
    <motion.div className="fixed inset-0 z-[240] overflow-y-auto bg-background text-foreground" data-camada-guia="missao-doses-fim" data-testid="missao-doses-fim" style={{ paddingTop: "var(--app-safe-top)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={entrada(reduzir, MOV.calmo)}>
      <Confete atraso={reduzir ? 0 : 0.9} />
      <div className="min-h-full max-w-[420px] mx-auto flex flex-col px-6 pt-[14vh]">
        <span className="flex gap-1.5" role="img" aria-label={aoAbrir ? `${feitas} de 3 feitos` : "3 de 3 dias feitos"}>{[1, 2, 3].map((i) => <Quadradinho key={i} marcado={!aoAbrir || i <= feitas} tam={18} />)}</span>
        <h1 className="text-[30px] font-black tracking-[-0.03em] leading-[1.1] mt-4 text-balance" data-testid="missao-doses-fim-titulo">Você construiu isso em 3{"\u00a0"}dias</h1>
        <div className={`grid ${numeros.length === 2 ? "grid-cols-2" : numeros.length === 1 ? "grid-cols-1" : "grid-cols-3"} gap-3 mt-8`} data-testid="missao-doses-fim-numeros">
          {numeros.map((x, i) => (
            <motion.div key={x.id} initial={reduzir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.calmo, 0.3 + i * 0.06)}
              className="rounded-2xl border border-border bg-card px-3 py-4 text-center" data-testid={`missao-doses-fim-${x.id}`}>
              <div className="text-[34px] font-black tracking-tight leading-none tabular-nums">{x.valor}</div>
              <div className="text-[12px] text-muted-foreground mt-1.5 leading-tight">{x.rotulo}</div>
            </motion.div>
          ))}
        </div>
        {aoAbrir && dosesFeitas(missao) > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card divide-y divide-border/70" data-testid="missao-doses-fim-modulos">
            {([1, 2, 3] as DiaDaMissao[]).filter((n) => missao.feitos[n]).map((n) => {
              const cfg = MODULOS[missao.modulos[n - 1]];
              return (
                <div key={n} className="flex items-center gap-3 px-4 py-3" data-testid={`missao-doses-fim-modulo-${cfg.modulo}`}>
                  <span className="w-9 h-9 rounded-xl grid place-items-center text-[18px] shrink-0" style={{ background: cfg.cor }} aria-hidden>{cfg.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-extrabold leading-tight">{cfg.nome}</span>
                    <span className="block text-[13px] text-muted-foreground leading-tight mt-0.5 truncate">{linhaDoFeitoNoResumo(missao, n)}</span>
                  </span>
                  <Check className="w-5 h-5 text-[#1a8f5a] shrink-0" aria-hidden />
                </div>
              );
            })}
          </div>
        )}
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
