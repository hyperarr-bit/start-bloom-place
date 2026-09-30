/**
 * MEU MÊS — o cronograma em 4 semanas (28/09, Onda 1). Grade de SEG a DOM com a
 * letra da etapa nos dias de lavar: H (babosa), N (mel), R (ameixa); ✓ nas feitas.
 * Editável sem refazer as perguntas: tocar numa lavagem prevista muda o dia dela;
 * os dias de lavar (ou o "a cada N dias") mudam logo abaixo. "Refazer cronograma"
 * fica sempre à mão.
 */
import { useState } from "react";
import { CalendarHeart, Minus, Plus, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn, localDayKey, parseLocalDay } from "@/lib/utils";
import { DIAS_CURTOS } from "@/lib/beleza-rotina";
import {
  ETAPAS, diaDaSemanaDe, lavagensDoPlano, resumoDaSequencia, somarDias, type DiaDaAgenda, type Etapa,
} from "@/lib/beleza-cabelo";
import { BOTAO_PILULA, CartaoBeleza, FaixaBeleza, LetraDaEtapa, ROTULO_BZ, Serif, TEMA_BELEZA, TOM_DA_ETAPA } from "./kit";
import type { Cabelo } from "./use-cabelo";

const diaLongo = (dia: string) => parseLocalDay(dia).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");

export function MeuMesCabelo({ c, onAbrirDia, onRefazer }: { c: Cabelo; onAbrirDia: (dia: string) => void; onRefazer: () => void }) {
  const [movendo, setMovendo] = useState<DiaDaAgenda | null>(null);
  const [novoDia, setNovoDia] = useState("");
  const plano = c.plano;
  if (!plano) return null;

  // 4 semanas: a passada (o que ela fez, com ✓) + esta + as 2 próximas
  const segunda = somarDias(c.hoje, -diaDaSemanaDe(c.hoje) - 7);
  const dias = Array.from({ length: 28 }, (_, i) => somarDias(segunda, i));
  const feitas = new Map(lavagensDoPlano(plano, c.lavagens).map((l) => [l.data, l.etapa as Etapa]));
  const fora = new Set(c.lavagens.filter((l) => !l.noPlano).map((l) => l.data));
  const previstas = new Map(c.agenda.map((a) => [a.dia, a]));
  const movidas = new Set(Object.values(plano.trocas ?? {}));
  const total = plano.sequencia.length;
  const feitasNoCiclo = c.estado?.feitasNoCiclo ?? 0;

  const toque = (dia: string) => {
    const p = previstas.get(dia);
    if (p) { setMovendo(p); setNovoDia(p.dia); return; }
    if (dia <= c.hoje) onAbrirDia(dia);
  };

  const ritmo = plano.ritmo;
  const alternarDia = (d: number) => {
    if (ritmo.tipo !== "semana") return;
    const novos = ritmo.dias.includes(d) ? ritmo.dias.filter((x) => x !== d) : [...ritmo.dias, d].sort();
    if (novos.length) c.mudarRitmo({ tipo: "semana", dias: novos });
  };

  return (
    <CartaoBeleza data-card="meu-mes-cabelo" data-testid="meu-mes-cabelo">
      <FaixaBeleza
        icone={<CalendarHeart className="w-4 h-4 text-bz-acento" />}
        titulo="MEU MÊS"
        direita={<span data-testid="ciclo-cabelo">ciclo {c.estado?.ciclo ?? 1} · {feitasNoCiclo} de {total}</span>}
      />
      <div className="grid grid-cols-7 border-t border-bz-linha" aria-hidden="true">
        {DIAS_CURTOS.map((d, k) => (
          <span key={d} className={cn("py-2 text-center text-[9.5px] font-extrabold tracking-[.06em]", k === diaDaSemanaDe(c.hoje) ? "text-bz-acento" : "text-bz-suave")}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7" role="group" aria-label="As 4 semanas do cronograma">
        {dias.map((dia) => {
          const feita = feitas.get(dia);
          const prevista = previstas.get(dia);
          const hoje = dia === c.hoje;
          const passado = dia < c.hoje;
          const etapa = feita ?? prevista?.etapa;
          const rotulo = `${diaLongo(dia)}${feita ? `: ${ETAPAS[feita].rotulo.toLowerCase()} feita` : prevista ? `: ${ETAPAS[prevista.etapa].rotulo.toLowerCase()} prevista` : fora.has(dia) ? ": lavagem fora do plano" : ""}`;
          const acionavel = !!prevista || (passado || hoje);
          return (
            <button
              key={dia}
              type="button"
              disabled={!acionavel}
              onClick={() => toque(dia)}
              aria-label={rotulo}
              className={cn(
                "relative h-14 border-t border-bz-linha flex flex-col items-center justify-center gap-0.5 bg-transparent disabled:cursor-default",
                hoje && "bg-bz-hoje",
              )}
              data-testid={prevista ? "dia-previsto" : feita ? "dia-feito" : undefined}
            >
              <span className={cn("text-[10.5px] font-bold tabular-nums leading-none", hoje ? "text-bz-acento" : passado ? "text-bz-suave/70" : "text-bz-suave")}>
                {parseLocalDay(dia).getDate()}
              </span>
              {etapa ? (
                <span className={cn("relative inline-grid place-items-center w-7 h-7 rounded-full text-[12px] font-extrabold", TOM_DA_ETAPA[etapa], movidas.has(dia) && "outline outline-2 outline-dashed outline-offset-1 outline-bz-acento/60")}>
                  {ETAPAS[etapa].letra}
                  {feita && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-bz-acento text-bz-acento-tinta text-[8px] grid place-items-center" aria-hidden="true">✓</span>}
                </span>
              ) : fora.has(dia) ? (
                <span className="w-2 h-2 rounded-full bg-bz-base" aria-hidden="true" />
              ) : (
                <span className="h-7" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-bz-linha space-y-2.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-bz-suave" aria-label="Legenda">
          {(["hidratacao", "nutricao", "reconstrucao"] as Etapa[]).map((e) => (
            <span key={e} className="inline-flex items-center gap-1"><LetraDaEtapa etapa={e} tamanho="sm" /> {ETAPAS[e].rotulo.toLowerCase()}</span>
          ))}
        </p>
        <p className="text-[12px] text-bz-suave leading-snug" data-testid="resumo-cronograma">
          O ciclo: {resumoDaSequencia(plano.sequencia)}. Toque numa lavagem pra mudar o dia.
        </p>

        <div>
          <p className={ROTULO_BZ}>{ritmo.tipo === "semana" ? "Dias de lavar" : "Intervalo"}</p>
          {ritmo.tipo === "semana" ? (
            <div className="mt-1.5 flex gap-1" role="group" aria-label="Dias de lavar">
              {DIAS_CURTOS.map((d, k) => {
                const on = ritmo.dias.includes(k);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => alternarDia(k)}
                    aria-pressed={on}
                    className={cn("flex-1 h-10 rounded-full text-[10.5px] font-extrabold border transition-colors", on ? "bg-bz-rose-tinta text-bz-cartao border-bz-rose-tinta" : "bg-bz-cartao text-bz-suave border-bz-linha-forte")}
                    data-testid={`dia-de-lavar-${k}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" aria-label="Menos dias" onClick={() => c.mudarRitmo({ tipo: "intervalo", dias: Math.max(1, ritmo.dias - 1) })} className="w-10 h-10 rounded-full grid place-items-center bg-bz-blush text-bz-tinta"><Minus className="w-4 h-4" /></button>
              <span className="text-[14px] font-bold text-bz-tinta tabular-nums">a cada {ritmo.dias} {ritmo.dias === 1 ? "dia" : "dias"}</span>
              <button type="button" aria-label="Mais dias" onClick={() => c.mudarRitmo({ tipo: "intervalo", dias: Math.min(14, ritmo.dias + 1) })} className="w-10 h-10 rounded-full grid place-items-center bg-bz-blush text-bz-tinta"><Plus className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
      <button type="button" onClick={onRefazer} className="w-full h-11 border-t border-bz-linha bg-transparent text-[13px] font-semibold text-bz-suave inline-flex items-center justify-center gap-1.5 active:bg-bz-blush" data-testid="refazer-cronograma">
        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Refazer cronograma
      </button>

      <Sheet open={!!movendo} onOpenChange={(o) => !o && setMovendo(null)}>
        <SheetContent side="bottom" className={cn(TEMA_BELEZA, "rounded-t-3xl bg-bz-cartao border-bz-linha p-0")}>
          {movendo && (
            <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className={cn(TOM_DA_ETAPA[movendo.etapa], "px-4 pt-4 pb-3 rounded-t-3xl")}>
                <SheetTitle className="text-[11.5px] font-extrabold tracking-[.14em] uppercase text-current">Lavagem prevista · {ETAPAS[movendo.etapa].rotulo}</SheetTitle>
                <SheetDescription asChild>
                  <p className="mt-0.5"><Serif className="text-[24px] leading-tight">{diaLongo(movendo.dia)}</Serif></p>
                </SheetDescription>
              </div>
              <div className="px-4 pt-3 space-y-3">
                <label className="block">
                  <span className={ROTULO_BZ}>Mudar pra</span>
                  <input
                    type="date"
                    value={novoDia}
                    min={localDayKey()}
                    onChange={(e) => setNovoDia(e.target.value)}
                    className="mt-1.5 w-full h-11 px-4 rounded-full border border-bz-linha-forte bg-bz-cartao text-bz-tinta text-[14px] font-bold"
                    aria-label="Novo dia da lavagem"
                    data-testid="novo-dia-lavagem"
                  />
                </label>
                <button
                  type="button"
                  className={cn(BOTAO_PILULA, "w-full h-11")}
                  disabled={!novoDia || novoDia === movendo.dia}
                  onClick={() => { c.moverLavagem(movendo.dia, novoDia); setMovendo(null); }}
                  data-testid="mover-lavagem"
                >
                  Mudar o dia
                </button>
                <p className="text-[12px] text-bz-suave">Só esta lavagem muda; o resto do cronograma segue igual.</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </CartaoBeleza>
  );
}
