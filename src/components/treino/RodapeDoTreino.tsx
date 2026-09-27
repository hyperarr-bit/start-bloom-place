/**
 * Rodapé fixo do HOJE (26/09, mockup p1): o DESCANSO na cor do dia (tempo
 * grande, −15, +15, Pular), o cronômetro da sessão e "Concluir treino".
 *
 * O relógio mora aqui dentro (intervalo próprio): a página não re-renderiza a
 * cada segundo. O descanso é um HORÁRIO de fim (`descansoAte`), não um contador
 * — tela bloqueada congela o setTimeout do WebView, e na volta o tempo certo sai
 * da conta com o relógio de verdade (o que o conserto de 26/09 fazia na mão).
 *
 * `bottom: var(--teste-banner-h)`: a faixa do teste grátis e a da demo publicam
 * a altura nessa variável; a barra sobe junto e nunca fica por baixo delas.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { horaMinSeg, minSeg, type TomDoDia } from "./planner";

export type EstadoDoRodape = "comecar" | "treinando" | "concluido" | "alterado";

export function RodapeDoTreino({
  tom,
  descansoAte,
  onDescanso,
  onPular,
  inicio,
  fim,
  feitas,
  total,
  rotuloTotal,
  estado,
  onComecar,
  onConcluir,
  onVerResumo,
  onAltura,
  estimativa,
}: {
  estimativa?: number;
  tom: TomDoDia;
  descansoAte: number | null;
  onDescanso: (segundos: number) => void;
  onPular: () => void;
  inicio: string | null;
  fim: string | null;
  feitas: number;
  total: number;
  rotuloTotal: string;
  estado: EstadoDoRodape;
  onComecar: () => void;
  onConcluir: () => void;
  onVerResumo: () => void;
  onAltura: (px: number) => void;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  const correndo = !!descansoAte || (!!inicio && !fim);
  useEffect(() => {
    if (!correndo) return;
    setAgora(Date.now());
    const t = window.setInterval(() => setAgora(Date.now()), descansoAte ? 250 : 1000);
    return () => window.clearInterval(t);
  }, [correndo, descansoAte]);

  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => onAltura(el.offsetHeight);
    publicar();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publicar) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [onAltura]);

  const restante = descansoAte ? Math.max(0, Math.ceil((descansoAte - agora) / 1000)) : 0;
  const t0 = inicio ? Date.parse(inicio) : NaN;
  const t1 = fim ? Date.parse(fim) : agora;
  const decorrido = Number.isFinite(t0) ? Math.max(0, Math.floor((t1 - t0) / 1000)) : 0;

  const botaoDescanso = cn("h-9 px-3 rounded-lg border bg-card text-[13px] font-bold tabular-nums active:scale-95 transition", tom.borda);

  return (
    <div
      ref={ref}
      className="fixed left-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border"
      style={{
        bottom: "var(--teste-banner-h, 0px)",
        // sem faixa embaixo, respeita a barra de gestos do iPhone
        paddingBottom: "max(0px, calc(var(--app-safe-bottom, 0px) - var(--teste-banner-h, 0px)))",
      }}
      data-testid="rodape-treino"
    >
      <div className="max-w-5xl mx-auto">
        {descansoAte && restante > 0 && (
          <div
            className={cn("mx-4 mt-3 rounded-xl border px-3 min-[400px]:px-3.5 h-[58px] flex items-center gap-2.5 min-[400px]:gap-3", tom.borda, tom.claro)}
            role="timer"
            aria-live="off"
            data-testid="descanso"
          >
            <Timer className={cn("w-5 h-5 shrink-0", tom.forte)} aria-hidden="true" />
            <div className="min-w-0">
              <p className={cn("text-[10px] font-extrabold tracking-[.14em]", tom.forte)}>DESCANSO</p>
              <p className={cn("text-[22px] font-extrabold tabular-nums leading-none mt-0.5", tom.titulo)} data-testid="descanso-tempo">
                {minSeg(restante)}
              </p>
            </div>
            <button type="button" onClick={() => onDescanso(-15)} className={cn(botaoDescanso, "ml-auto")} aria-label="Menos 15 segundos">−15</button>
            <button type="button" onClick={() => onDescanso(15)} className={botaoDescanso} aria-label="Mais 15 segundos">+15</button>
            <button type="button" onClick={onPular} className={cn("h-9 px-3.5 rounded-lg text-[13px] font-bold active:scale-95 transition", tom.botao)}>
              Pular
            </button>
          </div>
        )}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 text-[12px] text-muted-foreground leading-tight tabular-nums">
            {inicio ? <p data-testid="cronometro">{horaMinSeg(decorrido)}</p> : <p>{estimativa ? `~${estimativa} min` : " "}</p>}
            <p className="text-foreground text-[14px] font-bold">
              {estado === "concluido" ? "Treino concluído ✓" : `${feitas} de ${total} ${rotuloTotal}`}
            </p>
          </div>
          {estado === "comecar" && (
            <button type="button" onClick={onComecar} className="ml-auto h-12 px-6 rounded-xl bg-foreground text-background text-[15px] font-bold active:scale-[.98] transition">
              Começar treino
            </button>
          )}
          {estado === "treinando" && (
            <button type="button" onClick={onConcluir} className="ml-auto h-12 px-6 rounded-xl bg-foreground text-background text-[15px] font-bold active:scale-[.98] transition">
              Concluir treino
            </button>
          )}
          {estado === "alterado" && (
            <button type="button" onClick={onConcluir} className="ml-auto h-12 px-5 rounded-xl bg-foreground text-background text-[14px] font-bold active:scale-[.98] transition">
              Salvar de novo
            </button>
          )}
          {estado === "concluido" && (
            <button type="button" onClick={onVerResumo} className="ml-auto h-12 px-5 rounded-xl border border-border bg-card text-[14px] font-bold active:scale-[.98] transition">
              Ver resumo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
