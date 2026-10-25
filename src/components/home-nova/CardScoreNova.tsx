import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import type { Sequencia } from "@/components/conquistas/use-conquistas";

/**
 * O CARD DO SCORE (mockup 25/10). O anel continua (as pessoas já o conhecem), menor e com o texto ao
 * lado que COMBINA com o número: o título pela faixa do score (a mesma régua do anel de hoje) e, embaixo,
 * o que o número quer dizer em coisas — "faltam 5 coisas pra fechar o dia" / "tudo feito por hoje".
 * Antes: "Vamos lá! · Score do dia baseado em suas atividades" (genérico, igual pra todo mundo).
 *
 * A última linha é a sequência no dia a dia, SEM a linha divisória de antes: "✓ Dia garantido na
 * sequência" ou "Hoje: marque um hábito ›" (a ação do dia da pessoa, lib/acao-do-dia). O número de dias
 * não se repete aqui — ele mora na pílula do fogo, um palmo acima.
 */
interface Props {
  score: number;
  pendentes: number;
  feitas: number;
  seq: Sequencia;
}

export const tituloDoScore = (score: number): string =>
  score >= 100 ? "Dia completo!" : score >= 70 ? "Quase lá!" : score >= 30 ? "Bom ritmo!" : score > 0 ? "Vamos lá!" : "Dia começando";

export const explicacaoDoScore = (pendentes: number, feitas: number): string => {
  if (pendentes === 0) return feitas > 0 ? "Tudo feito por hoje." : "Nada pendente por aqui.";
  return pendentes === 1 ? "Falta 1 coisa pra fechar o dia" : `Faltam ${pendentes} coisas pra fechar o dia`;
};

export const CardScoreNova = ({ score, pendentes, feitas, seq }: Props) => {
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const raio = 44;
  const circ = 2 * Math.PI * raio;
  const progresso = (Math.max(0, Math.min(100, score)) / 100) * circ;
  const completo = score >= 100;
  const corAnel = score >= 80 ? "hsl(var(--success))" : "hsl(var(--score-ring, var(--warning)))";
  const corSeq = { color: "hsl(var(--score-ring, var(--warning)))" };
  const acao = seq.acao.texto.replace(/\s+(de\s+)?hoje\b\.?$/i, "");

  return (
    <section className="hn-card p-5" data-testid="hn-score" aria-label="Score do dia">
      <div className="flex items-center gap-5">
        <div className="relative w-[104px] h-[104px] shrink-0" data-testid="hn-anel">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 104 104">
            <circle cx="52" cy="52" r={raio} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
            <motion.circle
              cx="52" cy="52" r={raio} fill="none" stroke={corAnel} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - progresso }}
              transition={{ duration: semMovimento ? 0 : 1.1, ease: "easeOut", delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[30px] leading-none font-bold tabular-nums tracking-tight${completo ? " text-success" : ""}`}>{score}</span>
            <span className="text-[10px] mt-1 text-muted-foreground font-semibold uppercase tracking-[0.12em]">pontos</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-bold tracking-tight leading-tight">{tituloDoScore(score)}</p>
          <p className="text-[13.5px] text-muted-foreground leading-snug mt-1 [text-wrap:balance]" data-testid="hn-score-explica">{explicacaoDoScore(pendentes, feitas)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
        data-testid="hn-linha-sequencia"
        className="mt-4 w-full min-h-[44px] -mb-2 flex items-center gap-2 text-left text-[13.5px] whitespace-nowrap overflow-hidden rounded-xl"
      >
        {seq.hojeFeito ? (
          <>
            <span className="w-6 h-6 rounded-full grid place-items-center shrink-0" style={{ background: "hsl(var(--score-ring, var(--warning)) / .14)" }}>
              <Check className="w-3.5 h-3.5" strokeWidth={3} style={corSeq} aria-hidden />
            </span>
            <span className="font-semibold truncate" style={corSeq}>Dia garantido na sequência</span>
          </>
        ) : (
          <>
            <span className="w-6 h-6 rounded-full grid place-items-center shrink-0 bg-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--score-ring, var(--warning)))" }} />
            </span>
            <span className="text-muted-foreground truncate">
              {seq.dias > 0 ? <>Pra garantir hoje: <span className="font-semibold text-foreground">{acao}</span></> : <>Comece sua sequência: <span className="font-semibold text-foreground">{acao}</span></>}
            </span>
          </>
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/60 shrink-0" aria-hidden />
      </button>
    </section>
  );
};
