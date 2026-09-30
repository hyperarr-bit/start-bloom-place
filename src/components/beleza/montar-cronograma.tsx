/**
 * SEU CRONOGRAMA EM 4 PERGUNTAS (28/09, Onda 1 — CABELO). O mesmo jeito das 3
 * perguntas da pele: aparece na própria aba, sem folha nem "começar".
 *  1. curvatura (aceita duas: raiz ondulada e pontas cacheadas é comum);
 *  2. química (a que mais pesa na reconstrução);
 *  3. frequência: "lavo N vezes por semana" OU "a cada N dias" — o pedido das
 *     avaliações ("não contar os dias de lavar pelo dia da semana");
 *  4. o teste de porosidade (3 perguntas → calculatePorosity, que já existia sem tela).
 * O último toque grava o perfil e o cronograma (lib/beleza-cabelo → gerarCronograma).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BOTAO_PILULA, CartaoBeleza, ROTULO_BZ, Serif } from "./kit";
import {
  OPCOES_CURVATURA, OPCOES_QUIMICA, PERGUNTAS_POROSIDADE,
  type Curvatura, type Frequencia, type Quimica,
} from "@/lib/beleza-cabelo";
import type { RespostasCapilares } from "./use-cabelo";

/** O fio desenhado: reto, onda, cacho, crespo (sem emoji que não existe pra isso). */
export function FioIcone({ curvatura, className }: { curvatura: Curvatura; className?: string }) {
  const d: Record<Curvatura, string> = {
    liso: "M12 3v18",
    ondulado: "M12 3c-3 3 3 6 0 9s3 6 0 9",
    cacheado: "M12 3c-4 0-4 4 0 4s4 4 0 4-4 4 0 4 4 4 0 4",
    crespo: "M12 3l-3 2.5 3 2.5-3 2.5 3 2.5-3 2.5 3 2.5-3 2.5",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("w-6 h-6", className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d[curvatura]} />
    </svg>
  );
}

const TOTAL = 4;

function Opcao({ ativa, onClick, icone, rotulo, dica, testId, seta = true }: { ativa: boolean; onClick: () => void; icone: ReactNode; rotulo: string; dica?: string; testId?: string; seta?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn("w-full flex items-center gap-3 px-3 min-h-[58px] text-left transition-colors active:bg-bz-blush", ativa ? "bg-bz-dica" : "bg-bz-cartao")}
      data-testid={testId}
    >
      <span className={cn("w-10 h-10 shrink-0 grid place-items-center rounded-full text-[19px] leading-none", ativa ? "bg-bz-rose text-bz-acento" : "bg-bz-blush text-bz-rose-tinta")} aria-hidden="true">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug text-bz-tinta">{rotulo}</span>
        {dica && <span className="block text-[12px] text-bz-suave leading-snug">{dica}</span>}
      </span>
      {seta && <ChevronRight className="w-4 h-4 shrink-0 text-bz-suave" aria-hidden="true" />}
    </button>
  );
}

export function MontarCronograma({ onPronto, onCancelar }: { onPronto: (r: RespostasCapilares) => void; onCancelar?: () => void }) {
  const [passo, setPasso] = useState(0);
  const [curvaturas, setCurvaturas] = useState<Curvatura[]>([]);
  const [quimica, setQuimica] = useState<Quimica | null>(null);
  const [modo, setModo] = useState<"semana" | "intervalo">("semana");
  const [vezes, setVezes] = useState(3);
  const [intervalo, setIntervalo] = useState(3);
  const [poro, setPoro] = useState<(number | null)[]>([null, null, null]);

  const alternarCurva = (c: Curvatura) =>
    setCurvaturas((atual) => (atual.includes(c) ? atual.filter((x) => x !== c) : atual.length >= 2 ? [atual[1], c] : [...atual, c]));
  const frequencia: Frequencia = modo === "semana" ? { porSemana: vezes } : { intervaloDias: intervalo };
  const prontoPoro = poro.every((x) => x !== null);
  const terminar = () => {
    if (!quimica || !curvaturas.length || !prontoPoro) return;
    onPronto({ curvaturas, quimica, frequencia, porosidade: poro as [number, number, number] });
  };

  const titulos = ["Qual é a curvatura do seu cabelo?", "Tem química no cabelo?", "Com que frequência você lava?", "Como seu cabelo se comporta?"];

  return (
    <CartaoBeleza data-card="montar-cronograma" data-testid="montar-cronograma">
      <div className="bg-bz-rose text-bz-rose-tinta px-2 pt-3 pb-3.5">
        <div className="flex items-start gap-1.5">
          {passo > 0 ? (
            <button type="button" onClick={() => setPasso((p) => p - 1)} aria-label="Pergunta anterior" className="w-10 h-10 -mt-0.5 shrink-0 grid place-items-center rounded-full bg-bz-cartao/60">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-2 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-[.16em] opacity-80">4 PERGUNTAS · 30 SEGUNDOS</p>
            <h2 className="mt-0.5 text-[21px] leading-[1.1] font-bold tracking-tight">
              Seu <Serif className="text-[25px] font-normal">cronograma</Serif>
            </h2>
            <p className="text-[12px] opacity-85 mt-0.5">4 semanas de hidratação, nutrição e reconstrução</p>
          </div>
          <span className="shrink-0 pr-2 pt-0.5 text-[13px] font-extrabold tabular-nums" data-testid="pergunta-cabelo-n">{passo + 1}/{TOTAL}</span>
        </div>
        <div className="mt-3 mx-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => <span key={k} className={cn("h-1.5 rounded-full", k <= passo ? "bg-bz-acento" : "bg-bz-cartao/70")} />)}
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className={ROTULO_BZ}>PERGUNTA {passo + 1} DE {TOTAL}{passo === 3 ? " · TESTE DE POROSIDADE" : ""}</p>
        <h3 className="mt-1 text-[19px] font-bold leading-snug text-bz-tinta">{titulos[passo]}</h3>
        {passo === 0 && <p className="mt-1 text-[12px] text-bz-suave">Pode marcar duas (raiz ondulada e pontas cacheadas, por exemplo).</p>}
      </div>

      {passo === 0 && (
        <>
          <div className="mx-4 mb-3 rounded-2xl border border-bz-linha overflow-hidden divide-y divide-bz-linha">
            {OPCOES_CURVATURA.map((o) => (
              <Opcao key={o.id} ativa={curvaturas.includes(o.id)} onClick={() => alternarCurva(o.id)} icone={<FioIcone curvatura={o.id} />} rotulo={o.rotulo} dica={o.dica} testId={`curva-${o.id}`} seta={false} />
            ))}
          </div>
          <div className="px-4 pb-4">
            <button type="button" disabled={!curvaturas.length} onClick={() => setPasso(1)} className={cn(BOTAO_PILULA, "w-full")} data-testid="continuar-curva">
              Continuar
            </button>
          </div>
        </>
      )}

      {passo === 1 && (
        <div className="mx-4 mb-4 rounded-2xl border border-bz-linha overflow-hidden divide-y divide-bz-linha">
          {OPCOES_QUIMICA.map((o) => (
            <Opcao key={o.id} ativa={quimica === o.id} onClick={() => { setQuimica(o.id); setPasso(2); }} icone={o.emoji} rotulo={o.rotulo} dica={o.dica} testId={`quimica-${o.id}`} />
          ))}
        </div>
      )}

      {passo === 2 && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex rounded-full bg-bz-blush p-0.5" role="group" aria-label="Como você conta">
            {(["semana", "intervalo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={modo === m}
                className={cn("flex-1 h-10 rounded-full text-[12px] font-extrabold tracking-[.06em] transition-colors", modo === m ? "bg-bz-cartao text-bz-rose-tinta shadow-[0_2px_8px_-4px_hsl(var(--bz-sombra)/0.5)]" : "bg-transparent text-bz-suave")}
                data-testid={`modo-${m}`}
              >
                {m === "semana" ? "VEZES POR SEMANA" : "A CADA N DIAS"}
              </button>
            ))}
          </div>
          {/* 4 por linha: no celular de 360 cabe com alvo de toque ≥ 40 px */}
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={modo === "semana" ? "Vezes por semana" : "Intervalo em dias"}>
            {(modo === "semana" ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7]).map((n) => {
              const ativo = (modo === "semana" ? vezes : intervalo) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => (modo === "semana" ? setVezes(n) : setIntervalo(n))}
                  aria-pressed={ativo}
                  className={cn("h-11 rounded-full text-[15px] font-extrabold tabular-nums border transition-colors", ativo ? "bg-bz-acento text-bz-acento-tinta border-bz-acento" : "bg-bz-cartao text-bz-tinta border-bz-linha-forte")}
                  data-testid={`freq-${n}`}
                >
                  {modo === "semana" ? `${n}×` : n}
                </button>
              );
            })}
          </div>
          <p className="text-[14px] text-bz-tinta" data-testid="frase-frequencia">
            {modo === "semana" ? <>Lavo <b>{vezes} {vezes === 1 ? "vez" : "vezes"} por semana</b></> : <>Lavo <b>a cada {intervalo} dias</b></>}
          </p>
          <button type="button" onClick={() => setPasso(3)} className={cn(BOTAO_PILULA, "w-full")} data-testid="continuar-frequencia">Continuar</button>
        </div>
      )}

      {passo === 3 && (
        <div className="px-4 pb-4 space-y-4">
          {PERGUNTAS_POROSIDADE.map((q, i) => (
            <div key={q.pergunta}>
              <p className="text-[13.5px] font-semibold text-bz-tinta mb-1.5">{q.pergunta}</p>
              <div className="rounded-2xl border border-bz-linha overflow-hidden divide-y divide-bz-linha" role="group" aria-label={q.pergunta}>
                {q.opcoes.map((texto, k) => {
                  const ativo = poro[i] === k + 1;
                  return (
                    <button
                      key={texto}
                      type="button"
                      onClick={() => setPoro((p) => p.map((x, j) => (j === i ? k + 1 : x)))}
                      aria-pressed={ativo}
                      className={cn("w-full min-h-[44px] px-3 text-left text-[13px] flex items-center gap-2 transition-colors", ativo ? "bg-bz-dica text-bz-dica-tinta font-semibold" : "bg-bz-cartao text-bz-tinta")}
                      data-testid={`poro-${i}-${k + 1}`}
                    >
                      <span className={cn("w-4 h-4 shrink-0 rounded-full border-2", ativo ? "border-bz-acento bg-bz-acento" : "border-bz-linha-forte")} aria-hidden="true" />
                      {texto}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" disabled={!prontoPoro} onClick={terminar} className={cn(BOTAO_PILULA, "w-full")} data-testid="montar-cronograma-pronto">
            Montar meu cronograma
          </button>
        </div>
      )}

      {onCancelar && (
        <button type="button" onClick={onCancelar} className="w-full h-11 border-t border-bz-linha bg-transparent text-[13px] font-semibold text-bz-suave active:bg-bz-blush">
          Cancelar — manter meu cronograma
        </button>
      )}
    </CartaoBeleza>
  );
}
