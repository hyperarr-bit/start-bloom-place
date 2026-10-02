import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Confete } from "@/components/demo-guiada/pecas";
import { useUserData } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { useConquistas, useSequencia } from "@/components/conquistas/use-conquistas";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { MODULOS, diaDaSemanaDoPasso, eventoDaMissao, type DiaDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import "./missao-doses.css";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
/** "2026-10-02" → "Sexta" (o dia em que o passo foi feito de verdade). */
const nomeDoDia = (dia: string): string => {
  const nome = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};

/**
 * "O QUE VOCÊ CONSTRUIU EM 3 DIAS" (D8): a missão 100% com o que ela fez em
 * cada dia, o score (do começo → hoje), a sequência com a semana, os adesivos
 * colados e as pendências de amanhã. "Continuar com o meu CORE" fecha e marca
 * como visto (uma vez só).
 */
export function ConstruiuEm3Dias({ missao, aoContinuar }: { missao: EstadoMissaoDoses; aoContinuar: () => void }) {
  const dados = useLifeHubData();
  const seq = useSequencia();
  const conq = useConquistas();
  const { get } = useUserData();
  const hoje = localDayKey();
  const pend = useMemo(() => pendenciasDeHoje(dados, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()), [dados, get]);
  const scoreAntes = missao.scoreNoInicio ?? 0;
  const colados = useMemo(() => conq.adesivos.filter((b) => b.unlocked).slice(-4).reverse(), [conq.adesivos]);
  useEffect(() => {
    trackEvent("missao_doses_fim", eventoDaMissao({ score_antes: scoreAntes, score_hoje: dados.dayScore, sequencia: seq.dias, adesivos: conq.abertos, pendencias_amanha: pend.pending.length, modulos: missao.modulos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a semana: os 7 dias terminando hoje, marcados quando entraram na sequência
  const semana = useMemo(() => {
    const out: Array<{ letra: string; marcado: boolean; hoje: boolean }> = [];
    const d = new Date(`${hoje}T12:00:00`);
    for (let i = 6; i >= 0; i--) {
      const x = new Date(d); x.setDate(d.getDate() - i);
      const k = localDayKey(x);
      out.push({ letra: DIAS[x.getDay()], marcado: seq.lista.includes(k), hoje: i === 0 });
    }
    return out;
  }, [hoje, seq.lista]);

  return (
    <div className="fixed inset-0 z-[240] overflow-y-auto bg-background text-foreground" data-camada-guia="missao-doses-fim" data-testid="missao-doses-fim" style={{ paddingTop: "var(--app-safe-top)" }}>
      <Confete />
      <div className="min-h-full max-w-[420px] mx-auto flex flex-col px-4 pt-6 pb-8">
        <span className="self-center inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: "#1a8f5a" }}>🏆 Missão cumprida · 3 de 3</span>
        <h1 className="text-[27px] font-black tracking-[-0.03em] leading-[1.1] text-center mt-3">O que você construiu em 3 dias</h1>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border bg-card overflow-hidden mt-5" data-testid="missao-doses-fim-missao">
          <div className="md-secao" data-cor="grafite"><span className="inline-flex items-center gap-2"><Quadradinho marcado claro tam={14} /> Sua missão dos 3 dias</span><b>100%</b></div>
          <div className="divide-y divide-border">
            {([1, 2, 3] as DiaDaMissao[]).map((n) => {
              const cfg = MODULOS[missao.modulos[n - 1]];
              const feito = missao.feitos[n];
              return (
                <div key={n} className="md-linha">
                  <Quadradinho marcado tam={18} />
                  <span className="min-w-0 flex-1">
                    <span className="md-linha-rotulo">{feito ? nomeDoDia(feito.dia) : diaDaSemanaDoPasso(n, missao, hoje)} · {cfg.emoji} {cfg.nome}</span>
                    <span className="md-linha-texto" data-feito="">{feito?.rotulo ?? cfg.pedido}</span>
                  </span>
                  <span className="md-pill" data-tom="feito">Feito</span>
                </div>
              );
            })}
          </div>
        </motion.section>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3" data-testid="missao-doses-fim-score">
            <div className="relative w-[64px] h-[64px] shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="27" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                <motion.circle cx="32" cy="32" r="27" fill="none" stroke="#1a8f5a" strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 27} initial={{ strokeDashoffset: 2 * Math.PI * 27 }} animate={{ strokeDashoffset: 2 * Math.PI * 27 * (1 - Math.min(100, dados.dayScore) / 100) }} transition={{ duration: 1, delay: 0.4 }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center leading-none"><div><div className="text-[18px] font-black tabular-nums">{dados.dayScore}</div><div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">score</div></div></div>
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold leading-tight">Score de hoje</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">começo {scoreAntes} → hoje <b className="text-foreground">{dados.dayScore}</b></div>
            </div>
          </motion.section>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-border bg-card p-4" data-testid="missao-doses-fim-sequencia">
            <div className="text-[14px] font-extrabold leading-tight">🔥 {seq.dias} {seq.dias === 1 ? "dia seguido" : "dias seguidos"}</div>
            <div className="flex gap-1 mt-2">
              {semana.map((d, i) => (
                <span key={i} className="w-6 h-7 rounded-md grid place-items-center text-[11px] font-extrabold" style={d.marcado ? { background: "#16121c", color: "#fff" } : d.hoje ? { border: "1.5px solid hsl(var(--accent))", color: "hsl(var(--accent))" } : { border: "1.5px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>{d.letra}</span>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">amanhã vira {seq.dias + 1} — qualquer registro conta</div>
          </motion.section>
        </div>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-2xl border border-border bg-card overflow-hidden mt-3" data-testid="missao-doses-fim-conquistas">
          <div className="md-secao" data-cor="verde"><span>Conquistas</span><b>{conq.abertos} {conq.abertos === 1 ? "adesivo" : "adesivos"} · {conq.xp} XP</b></div>
          <div className="grid grid-cols-4 gap-2 px-3 py-3">
            {colados.length ? colados.map((b) => (
              <div key={b.id} className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full grid place-items-center text-[26px]" style={{ background: "hsl(var(--muted))" }}>{b.icon}</div>
                <div className="text-[10.5px] font-bold leading-tight mt-1 line-clamp-2">{b.name}</div>
              </div>
            )) : <p className="col-span-4 text-[12px] text-muted-foreground text-center py-2">O 1º adesivo vem com o próximo registro.</p>}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-2xl border border-border bg-card overflow-hidden mt-3" data-testid="missao-doses-fim-pendencias">
          <div className="md-secao" data-cor="magenta"><span>Pendências de amanhã</span><b>{pend.pending.length}</b></div>
          <div className="divide-y divide-border">
            {pend.pending.slice(0, 3).map((p, i) => (
              <div key={i} className="md-linha" style={{ padding: "8px 14px" }}>
                <Quadradinho marcado={false} tam={16} />
                <span className="min-w-0 flex-1 text-[13px] font-medium truncate">{p.emoji} {p.label}</span>
              </div>
            ))}
            {pend.avisoConta && (
              <div className="md-linha" style={{ padding: "8px 14px" }}>
                <Quadradinho marcado={false} tam={16} />
                <span className="min-w-0 flex-1 text-[13px] font-medium truncate">📅 Conta que vence: {pend.avisoConta.nome}</span>
                <span className="text-[11px] text-muted-foreground">{pend.avisoConta.dias === 0 ? "hoje" : pend.avisoConta.dias === 1 ? "amanhã" : `em ${pend.avisoConta.dias} d`}</span>
              </div>
            )}
            {pend.pending.length === 0 && !pend.avisoConta && <p className="text-[12px] text-muted-foreground text-center py-3">Nada pendente — amanhã é dia de manter a sequência.</p>}
          </div>
        </motion.section>

        <div className="mt-auto pt-6">
          <button type="button" className="md-botao" data-testid="missao-doses-continuar" onClick={aoContinuar}>
            Continuar com o meu CORE <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
