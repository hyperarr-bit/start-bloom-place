/**
 * TREINO CONCLUÍDO (26/09, mockup p4): a página do dia "carimbada". Faixa do
 * dia, a tabela EXERCÍCIO | SÉRIES | MELHOR SÉRIE, o adesivo de NOVO RECORDE
 * quando alguma série bateu o recorde anterior, os totais e a nota. Confete
 * leve uma vez (parado pra quem pediu menos movimento). O "Postar nos Stories"
 * do mockup fica pra depois — por ora só "Fechar".
 */
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatarKgInteiro, textoDaSerie, type LinhaDoResumo } from "@/lib/treino-series";
import { COR_DO_DIA, textoDoDia, tomDoDia } from "./planner";

export interface ResumoDoTreino {
  diaNome: string;
  /** "26 DE SETEMBRO" */
  dataTexto: string;
  titulo: string;
  minutos: number | null;
  linhas: LinhaDoResumo[];
  volume: number;
  vsUltima: number | null;
  sequencia: number;
  nota: string;
  recorde: boolean;
}

const CORES = ["#a855f7", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899"];
const PEDACOS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: 2 + ((i * 37) % 95),
  atraso: (i % 6) * 0.08,
  dur: 1.8 + (i % 4) * 0.25,
  giro: (i % 2 ? 1 : -1) * (120 + ((i * 47) % 200)),
  cor: CORES[i % CORES.length],
  w: 6 + (i % 3) * 2,
  h: 10 + (i % 4) * 2,
}));

function Confete() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-x-0 top-0 h-[55vh] z-[60] pointer-events-none overflow-hidden" aria-hidden="true">
      {PEDACOS.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-[2px]"
          style={{ left: `${p.x}%`, width: p.w, height: p.h, background: p.cor }}
          initial={{ y: -30, rotate: 0, opacity: 0 }}
          animate={{ y: "52vh", rotate: p.giro, opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.15 + p.atraso, duration: p.dur, ease: "easeIn" }}
        />
      ))}
    </div>,
    document.body,
  );
}

export function TreinoConcluido({ resumo, aberto, onFechar }: { resumo: ResumoDoTreino | null; aberto: boolean; onFechar: () => void }) {
  const semMovimento = useReducedMotion();
  if (!resumo) return null;
  const tom = tomDoDia(resumo.diaNome);
  const vs = resumo.vsUltima;
  return (
    <>
      {aberto && !semMovimento && <Confete />}
      <Sheet open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="p-0 gap-0 border-0 rounded-t-3xl overflow-hidden max-h-[92vh] overflow-y-auto [&>button:last-child]:hidden"
          data-testid="treino-concluido"
        >
          <div className={cn(COR_DO_DIA[resumo.diaNome], textoDoDia(resumo.diaNome), "relative px-5 pt-5 pb-4 pr-28")}>
            <p className="text-[12px] font-extrabold tracking-[.16em] opacity-80">
              {resumo.diaNome} · {resumo.dataTexto}
            </p>
            <SheetTitle className="text-[24px] leading-tight font-extrabold mt-1 text-inherit">Treino concluído ✓</SheetTitle>
            <p className="text-[13.5px] opacity-90 mt-0.5">
              {[resumo.titulo, resumo.minutos ? `${resumo.minutos} min` : ""].filter(Boolean).join(" · ")}
            </p>
            {resumo.recorde && (
              // adesivo colado torto, como num planner
              <motion.div
                initial={semMovimento ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 8 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 14 }}
                className="absolute right-4 top-3 w-[84px] h-[84px] rounded-full bg-amber-300 border-[3px] border-white grid place-items-center text-center shadow-[0_2px_0_rgba(0,0,0,.08),0_8px_18px_-10px_rgba(0,0,0,.45)]"
                data-testid="adesivo-recorde"
              >
                <div>
                  <div className="text-[22px] leading-none" aria-hidden="true">🏆</div>
                  <div className="text-[9.5px] font-extrabold tracking-wider text-amber-950 mt-1 leading-tight">NOVO<br />RECORDE</div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-5 pt-5">
            <div className={cn("rounded-xl overflow-hidden border", tom.linha)}>
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className={cn(tom.claro, tom.titulo, "text-[10px] font-extrabold tracking-[.12em] h-8")}>
                    <th className={cn("text-left pl-3 border-b border-r font-extrabold", tom.linha)}>EXERCÍCIO</th>
                    <th className={cn("px-2 border-b border-r font-extrabold", tom.linha)}>SÉRIES</th>
                    <th className={cn("px-2 border-b font-extrabold", tom.linha)}>MELHOR SÉRIE</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.linhas.map((l, i) => {
                    const ultima = i === resumo.linhas.length - 1;
                    const b = cn(!ultima && "border-b", tom.linha);
                    return (
                      <tr key={l.nome} className="h-11">
                        <td className={cn(b, "border-r pl-3 pr-2 py-2 font-semibold leading-snug")}>{l.nome}</td>
                        <td className={cn(b, "border-r text-center tabular-nums")}>{l.cardio ? "—" : l.series}</td>
                        <td className={cn(b, "text-center tabular-nums px-2", l.recorde && "font-bold")}>
                          {l.cardio
                            ? [l.cardio.duracao ? `${l.cardio.duracao} min` : "", l.cardio.distancia ?? ""].filter(Boolean).join(" · ") || "feito"
                            : l.melhor ? textoDaSerie(l.melhor) : "—"}
                          {l.recorde && <span className="ml-1" aria-label="recorde">🏆</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 mt-3 rounded-xl border border-border text-center divide-x divide-border">
              <div className="py-2.5 px-1">
                <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">VOLUME</p>
                <p className="text-[17px] font-extrabold tabular-nums">{formatarKgInteiro(resumo.volume)} kg</p>
              </div>
              <div className="py-2.5 px-1">
                <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">VS. ÚLTIMA</p>
                <p className={cn("text-[17px] font-extrabold tabular-nums", vs == null ? "text-muted-foreground" : vs > 0 ? "text-green-600" : vs < 0 ? "text-red-600" : "")}>
                  {vs == null ? "—" : `${vs > 0 ? "+" : vs < 0 ? "−" : ""}${Math.abs(vs)}%`}
                </p>
              </div>
              <div className="py-2.5 px-1">
                <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">SEQUÊNCIA</p>
                <p className="text-[17px] font-extrabold tabular-nums">
                  {resumo.sequencia > 0 ? <>🔥 {resumo.sequencia} sem</> : "—"}
                </p>
              </div>
            </div>

            {resumo.nota && (
              <p
                className="mt-3 text-[13px] leading-[28px] text-muted-foreground"
                style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 27px, hsl(var(--border)) 27px 28px)" }}
              >
                📝 {resumo.nota}
              </p>
            )}

            <div className="py-4">
              <button
                type="button"
                onClick={onFechar}
                className="w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-bold active:scale-[.99] transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
