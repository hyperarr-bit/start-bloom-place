/**
 * EVOLUÇÃO (26/09, mockup p3) — no lugar de RESUMO, PROGRESSÃO e RECORDES.
 * ESTA SEMANA · RECORDES DO MÊS (automáticos; os anotados à mão continuam em
 * "Anotados por você") · CARGA POR EXERCÍCIO (30 dias, minigráfico em SVG, sem
 * recharts) · e a série de volume de cada treino (o conserto da avaliação 2★:
 * "não temos como ver os dias anteriores").
 */
import { useMemo, useState } from "react";
import { Plus, Trash2, TrendingUp, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SerieHistorico } from "@/components/historico/SerieHistorico";
import { cn, parseLocalDay } from "@/lib/utils";
import { formatarVolume } from "@/lib/treino-numeros";
import { epley, formatarKg, formatarKgInteiro, textoDaSerie, type EntradaDoHistorico } from "@/lib/treino-series";
import { detalheDoExercicio, type CargaDoExercicio, type RecordeDoMes, type ResumoDaSemana } from "@/lib/treino-evolucao";
import { Chip } from "./planner";

export interface RecordeAnotado {
  id: string;
  exercise: string;
  record: string;
  date: string;
}

const dm = (data: string) => {
  const d = parseLocalDay(data);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Minigrafico({ pontos, destaque }: { pontos: number[]; destaque: boolean }) {
  const w = 120;
  const h = 34;
  const p = 4;
  if (!pontos.length) return null;
  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const xs = pontos.map((_, i) => (pontos.length === 1 ? w - p : p + (i * (w - 2 * p)) / (pontos.length - 1)));
  const ys = pontos.map((v) => (max === min ? h / 2 : h - p - ((v - min) / (max - min)) * (h - 2 * p)));
  const ultimo = pontos.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" aria-hidden="true">
      <polyline
        fill="none"
        className={destaque ? "stroke-blue-500" : "stroke-muted-foreground"}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")}
      />
      {destaque && <circle cx={xs[ultimo]} cy={ys[ultimo]} r={3.2} className="fill-blue-500" />}
    </svg>
  );
}

const textoDoGanho = (r: RecordeDoMes) => (r.ganhoKg > 0 ? `+${formatarKg(r.ganhoKg)}` : r.ganhoReps > 0 ? `+${r.ganhoReps} reps` : "");

function TabelaDeRecordes({ lista }: { lista: RecordeDoMes[] }) {
  // Progressão linear bate recorde em quase todo exercício todo mês: a tabela
  // mostra os 3 mais recentes e o resto fica a um toque.
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? lista : lista.slice(0, 3);
  return (
    <>
    <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
      <colgroup>
        <col />
        <col className="w-[42%]" />
        <col className="w-[62px]" />
      </colgroup>
      <thead>
        <tr className="text-[10px] font-extrabold tracking-[.12em] text-amber-900 h-8 bg-amber-50">
          <th className="text-left pl-4 border-b border-r border-amber-200 font-extrabold">EXERCÍCIO</th>
          <th className="px-2 border-b border-r border-amber-200 font-extrabold">MELHOR</th>
          <th className="border-b border-amber-200 font-extrabold">DATA</th>
        </tr>
      </thead>
      <tbody>
        {visiveis.map((r, i) => {
          const b = cn(i < visiveis.length - 1 && "border-b", "border-amber-200");
          return (
            <tr key={r.exercicio} className="h-12" data-testid={`recorde-${r.exercicio}`}>
              <td className={cn(b, "border-r pl-3 pr-2 py-1.5")}>
                <Chip indice={i} className="text-[13px] inline-block max-w-full align-middle">{r.exercicio}</Chip>
              </td>
              <td className={cn(b, "border-r px-1 py-1 tabular-nums")}>
                <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                  <b className="whitespace-nowrap">{textoDaSerie(r.melhor)}</b>
                  {textoDoGanho(r) && (
                    <span className="rounded bg-green-100 text-green-700 text-[11px] font-bold px-1.5 py-0.5 whitespace-nowrap">{textoDoGanho(r)}</span>
                  )}
                </div>
              </td>
              <td className={cn(b, "text-center text-muted-foreground tabular-nums")}>{dm(r.data)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {lista.length > 3 && (
      <button type="button" onClick={() => setTodos((t) => !t)} className="w-full h-10 border-t border-amber-200 text-[12.5px] font-semibold text-amber-800">
        {todos ? "mostrar menos" : `ver todos (${lista.length})`}
      </button>
    )}
    </>
  );
}

export function TreinoEvolucao({
  resumo,
  meta,
  recordes,
  anteriores,
  nomeDoMes,
  cargas,
  historico,
  prs,
  onPrs,
  hoje,
  volumePorDia,
  onAvisarApagado,
}: {
  resumo: ResumoDaSemana;
  meta: number;
  recordes: RecordeDoMes[];
  /** recordes do mês passado — mostrados quando este mês ainda não tem nenhum */
  anteriores: { nome: string; lista: RecordeDoMes[] } | null;
  nomeDoMes: string;
  cargas: CargaDoExercicio[];
  historico: EntradaDoHistorico[];
  prs: RecordeAnotado[];
  onPrs: (prs: RecordeAnotado[]) => void;
  hoje: string;
  volumePorDia: Record<string, number>;
  onAvisarApagado: (texto: string, desfazer: () => void) => void;
}) {
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [novoEx, setNovoEx] = useState("");
  const [novoRec, setNovoRec] = useState("");
  const vol = formatarVolume(resumo.volume);
  const [volNum, volUnid] = vol.endsWith(" mil") ? [vol.slice(0, -4), "mil kg"] : [vol, "kg"];
  const v = resumo.variacao;
  const det = useMemo(() => (detalhe ? detalheDoExercicio(historico, detalhe) : null), [detalhe, historico]);
  const visiveis = todas ? cargas : cargas.slice(0, 6);

  return (
    <div className="space-y-3.5" data-testid="treino-evolucao">
      {/* ESTA SEMANA */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-foreground text-background dark:bg-muted dark:text-foreground min-h-[44px] px-4 flex items-center">
          <h2 className="text-[13px] font-extrabold tracking-wide">ESTA SEMANA</h2>
          <span className="ml-auto text-[12px] opacity-70">{resumo.rotulo}</span>
        </div>
        <div className="grid grid-cols-[1fr_1.3fr_1.6fr] divide-x divide-border text-center">
          <div className="py-3 px-1">
            <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">TREINOS</p>
            <p className="text-[20px] font-extrabold tabular-nums mt-1" data-testid="evolucao-treinos">
              {resumo.treinos}<span className="text-muted-foreground text-[14px]">/{meta}</span>
            </p>
          </div>
          <div className="py-3 px-1">
            <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">VOLUME</p>
            <p className="text-[20px] font-extrabold tabular-nums mt-1">
              {volNum}<span className="text-muted-foreground text-[13px]"> {volUnid}</span>
            </p>
          </div>
          <div className="py-3 px-1">
            <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground leading-tight">VS. SEMANA PASSADA</p>
            <p className={cn("text-[20px] font-extrabold tabular-nums mt-1", v == null ? "text-muted-foreground" : v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "")}>
              {v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`}
            </p>
          </div>
        </div>
      </div>

      {/* RECORDES DO MÊS */}
      <div className="rounded-2xl border border-amber-200 overflow-hidden bg-card" data-testid="recordes-do-mes">
        <div className="bg-amber-400 text-amber-950 min-h-[44px] px-4 flex items-center gap-2">
          <Trophy className="w-[18px] h-[18px]" aria-hidden="true" />
          <h2 className="text-[13px] font-extrabold tracking-wide">RECORDES DO MÊS</h2>
          <span className="ml-auto text-[12px] font-bold">automático</span>
        </div>
        {recordes.length > 0 ? (
          <TabelaDeRecordes lista={recordes} />
        ) : (
          <>
            <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
              Nenhum recorde em {nomeDoMes} ainda — quando uma série passar a melhor que você já fez, ela aparece aqui sozinha.
            </p>
            {anteriores && anteriores.lista.length > 0 && (
              <>
                <p className="px-4 pb-1 text-[10px] font-extrabold tracking-[.12em] text-amber-900">EM {anteriores.nome.toUpperCase()}</p>
                <TabelaDeRecordes lista={anteriores.lista} />
              </>
            )}
          </>
        )}

        {prs.length > 0 && (
          <div className="border-t border-amber-200">
            <p className="px-4 pt-2.5 pb-1 text-[10px] font-extrabold tracking-[.12em] text-amber-900">ANOTADOS POR VOCÊ</p>
            <ul>
              {prs.map((pr, i) => (
                <li key={pr.id} className={cn("flex items-start gap-2 px-4 py-1.5", i > 0 && "border-t border-amber-100")}>
                  <div className="flex-1 min-w-0">
                    <input
                      value={pr.exercise}
                      onChange={(e) => onPrs(prs.map((x) => (x.id === pr.id ? { ...x, exercise: e.target.value } : x)))}
                      aria-label="Exercício"
                      className="w-full h-8 bg-transparent text-[13px] font-bold outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={pr.record}
                        onChange={(e) => onPrs(prs.map((x) => (x.id === pr.id ? { ...x, record: e.target.value } : x)))}
                        aria-label="Recorde"
                        className="w-28 h-8 bg-transparent text-[13px] font-bold text-amber-700 outline-none"
                      />
                      <input
                        type="date"
                        value={pr.date}
                        onChange={(e) => onPrs(prs.map((x) => (x.id === pr.id ? { ...x, date: e.target.value } : x)))}
                        aria-label="Data do recorde"
                        className="h-8 bg-transparent text-[11.5px] text-muted-foreground outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Apagar recorde ${pr.exercise}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      const antes = prs;
                      onPrs(prs.filter((x) => x.id !== pr.id));
                      onAvisarApagado("Recorde apagado", () => onPrs(antes));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-amber-200 px-4 py-1.5">
          {anotando ? (
            <form
              className="flex items-center gap-2 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!novoEx.trim()) return;
                onPrs([...prs, { id: Date.now().toString(), exercise: novoEx.trim(), record: novoRec.trim(), date: hoje }]);
                setNovoEx("");
                setNovoRec("");
                setAnotando(false);
              }}
            >
              <input autoFocus value={novoEx} onChange={(e) => setNovoEx(e.target.value)} placeholder="Exercício" aria-label="Exercício do recorde" className="flex-1 min-w-0 h-9 rounded-md border border-border bg-background px-2 text-[13px]" />
              <input value={novoRec} onChange={(e) => setNovoRec(e.target.value)} placeholder="Recorde" aria-label="Recorde" className="w-24 h-9 rounded-md border border-border bg-background px-2 text-[13px]" />
              <button type="submit" aria-label="Salvar recorde" className="w-9 h-9 shrink-0 rounded-md bg-foreground text-background grid place-items-center">
                <Plus className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAnotando(true)} className="h-9 text-[12.5px] font-semibold text-amber-800 inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> anotar um recorde à mão
            </button>
          )}
        </div>
      </div>

      {/* CARGA POR EXERCÍCIO */}
      <div className="rounded-2xl border border-blue-100 overflow-hidden bg-card" data-testid="carga-por-exercicio">
        <div className="bg-blue-500 text-white min-h-[44px] px-4 flex items-center gap-2">
          <TrendingUp className="w-[18px] h-[18px]" aria-hidden="true" />
          <h2 className="text-[13px] font-extrabold tracking-wide">CARGA POR EXERCÍCIO</h2>
          <span className="ml-auto text-[12px] font-semibold opacity-85">30 dias</span>
        </div>
        {cargas.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-muted-foreground">Conclua um treino com carga e a evolução de cada exercício aparece aqui.</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <tbody>
              {visiveis.map((c, i) => {
                const b = cn(i < visiveis.length - 1 && "border-b", "border-blue-100");
                const va = c.variacao;
                const subiu = va.tipo === "subiu";
                return (
                  <tr key={c.nome} className="h-[60px] cursor-pointer" onClick={() => setDetalhe(c.nome)} data-testid={`carga-${c.nome}`}>
                    <td className={cn(b, "border-r pl-3 pr-2 py-2 w-[46%] min-[400px]:w-[40%]")}>
                      <button type="button" className="text-left max-w-full" onClick={(e) => { e.stopPropagation(); setDetalhe(c.nome); }} aria-label={`Ver todas as sessões de ${c.nome}`}>
                        <Chip indice={i} className="text-[13px] inline-block max-w-full align-middle">{c.nome}</Chip>
                      </button>
                      <p className={cn("text-[11.5px] font-bold mt-1 ml-0.5", subiu ? "text-green-600" : va.tipo === "desceu" ? "text-red-600" : "text-muted-foreground")}>
                        {va.tipo === "subiu" && `↑ ${formatarKg(va.kg)} kg`}
                        {va.tipo === "desceu" && `↓ ${formatarKg(va.kg)} kg`}
                        {va.tipo === "igual" && (va.semanas >= 1 ? `= há ${va.semanas} semana${va.semanas === 1 ? "" : "s"}` : "= mesma carga")}
                      </p>
                    </td>
                    <td className={cn(b, "border-r px-2")}>
                      <Minigrafico pontos={c.pontos.map((x) => x.carga)} destaque={subiu} />
                    </td>
                    <td className={cn(b, "text-right pr-4 pl-1 w-[64px] whitespace-nowrap")}>
                      <b className="text-[16px] tabular-nums">{formatarKg(c.atual)}</b> <span className="text-muted-foreground text-[11px]">kg</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {cargas.length > 6 && (
          <button type="button" onClick={() => setTodas((t) => !t)} className="w-full h-10 border-t border-blue-100 text-[12.5px] font-semibold text-blue-700">
            {todas ? "mostrar menos" : `ver todos (${cargas.length})`}
          </button>
        )}
        <p className="px-4 py-2.5 border-t border-blue-100 text-[11.5px] text-muted-foreground">Toque num exercício pra ver todas as séries e o seu 1RM estimado.</p>
      </div>

      {/* volume de cada treino, navegável (7 dias / 30 dias / por mês) */}
      <div className="rounded-2xl border border-border bg-card px-4 pt-4 pb-3">
        <h2 className="text-[12px] font-extrabold tracking-[.1em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" aria-hidden="true" /> VOLUME DE CADA TREINO
        </h2>
        <SerieHistorico
          registros={volumePorDia}
          cor="hsl(142 71% 45%)"
          id="treino-volume"
          unidade="kg"
          // "4.500" e não "4,5k": a média sai como `${fmt}${unidade}` (11/09)
          formatar={(n) => Math.round(n).toLocaleString("pt-BR")}
        />
      </div>

      <Sheet open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalhe(null); }}>
        <SheetContent side="bottom" className="p-0 gap-0 rounded-t-2xl max-h-[88vh] overflow-y-auto" data-testid="detalhe-exercicio">
          <div className="px-4 pt-4 pb-3 pr-12 border-b border-border">
            <SheetTitle className="text-[16px] font-extrabold">{detalhe}</SheetTitle>
            <SheetDescription className="text-[12px]">Todas as sessões, da mais nova pra mais antiga.</SheetDescription>
          </div>
          {det && (
            <div className="px-4 py-3 space-y-3">
              {det.rm && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <p className="text-[10px] font-extrabold tracking-[.12em] text-amber-900">1RM ESTIMADO (EPLEY)</p>
                  <p className="text-[26px] font-extrabold tabular-nums leading-tight" data-testid="rm-estimado">{formatarKg(det.rm.valor)} kg</p>
                  <p className="text-[11.5px] text-muted-foreground">da série {textoDaSerie(det.rm.serie)} em {dm(det.rm.data)}</p>
                  <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                    {[100, 90, 80, 70, 60].map((pct) => (
                      <div key={pct} className="rounded-md bg-card border border-amber-100 py-1">
                        <p className="text-[10px] text-muted-foreground">{pct}%</p>
                        <p className="text-[12px] font-bold tabular-nums">{Math.round((det.rm!.valor * pct) / 100)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr className="bg-muted/60 text-[10px] font-extrabold tracking-[.1em] text-muted-foreground h-8">
                      <th className="text-left pl-3 border-b border-r border-border font-extrabold w-[64px]">DATA</th>
                      <th className="text-left pl-2 border-b border-r border-border font-extrabold">SÉRIES</th>
                      <th className="px-2 border-b border-border font-extrabold">1RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {det.sessoes.map((s, i) => {
                      const b = cn(i < det.sessoes.length - 1 && "border-b", "border-border");
                      const rm = Math.max(...s.series.map((x) => epley(x.carga, x.reps)));
                      return (
                        <tr key={s.data}>
                          <td className={cn(b, "border-r pl-3 py-2 tabular-nums text-muted-foreground align-top")}>{dm(s.data)}</td>
                          <td className={cn(b, "border-r pl-2 pr-1 py-2 tabular-nums")}>
                            {s.series.map((x) => (x.carga > 0 ? `${formatarKg(x.carga)}×${x.reps}` : `${x.reps}`)).join(" · ")}
                            {s.obs && <p className="text-[11px] text-amber-700 mt-0.5">💬 {s.obs}</p>}
                          </td>
                          <td className={cn(b, "text-center tabular-nums font-semibold")}>{rm > 0 ? rm : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11.5px] text-muted-foreground pb-2">
                Volume da última sessão: <b className="text-foreground tabular-nums">{formatarKgInteiro(det.sessoes[0]?.volume ?? 0)} kg</b>
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
