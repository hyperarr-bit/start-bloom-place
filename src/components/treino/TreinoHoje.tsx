/**
 * HOJE (26/09, mockup p1): a folha do dia. Faixa na cor do dia, o exercício
 * da vez ABERTO como tabela de séries e os outros FECHADOS como linhas do
 * planner (chip pastel, alvo "3 × 12 · 14 kg", quadradinho). O aberto é o
 * próximo não concluído — tocar numa linha abre ela.
 */
import { useEffect, useState } from "react";
import { ClipboardList, Minus, PencilLine, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatarKg,
  quandoFoi,
  textoDaUltimaVez,
  type ExercicioDoPlano,
  type Serie,
  type SerieDaSessao,
  type SugestaoDeCarga,
} from "@/lib/treino-series";
import { lerNumero } from "@/lib/treino-numeros";
import { carimboDoPlano } from "@/lib/treino-constancia";
import { Chip, COR_DO_DIA, Pautado, PostIt, Quadradinho, textoDoDia, tomDoDia, type TomDoDia } from "./planner";
import { TabelaDeSeries } from "./TabelaDeSeries";

export interface AcoesDoHoje {
  alternarSerie: (chave: string, i: number) => void;
  valor: (chave: string, i: number, campo: "carga" | "reps", v: number) => void;
  subir: (chave: string, nova: number) => void;
  maisSerie: (chave: string) => void;
  menosSerie: (chave: string) => void;
  marcarExercicio: (chave: string, feito: boolean) => void;
  obs: (indice: number, texto: string) => void;
  cardio: (indice: number, campo: "duracao" | "distancia", v: string) => void;
  adicionarExercicio: (dia: string, nome: string) => void;
  nota: (texto: string) => void;
  /** treinar o plano de outro dia hoje (null = voltar pro de hoje) */
  escolherDia: (dia: string | null) => void;
  /** a aba 📋 PLANO (modelos prontos e o plano da semana) */
  abrirPlano: () => void;
}

export interface PropsDoHoje {
  hoje: string;
  hojeNome: string;
  /** dia do plano sendo feito */
  dia: string;
  descanso: boolean;
  exercicios: ExercicioDoPlano[];
  musculos: string[];
  chaves: string[];
  series: Record<string, SerieDaSessao[]>;
  ultimas: Record<string, { data: string; series: Serie[] } | null>;
  sugestoes: Record<string, SugestaoDeCarga | null>;
  feitas: number;
  total: number;
  rotuloTotal: string;
  minutos: number;
  nota: string;
  /** dias com treino montado (pro "treinar mesmo assim") */
  outrosDias: { dia: string; rotulo: string }[];
  /** hoje é descanso: o 1º dia de treino ainda vazio (o tutorial ancora nele) */
  diaParaMontar: string | null;
  spotlightDia: string | null;
  podeTrocar: boolean;
  acoes: AcoesDoHoje;
}

/** "3 × 12 · 14 kg" a partir das séries (o que está valendo hoje). */
const alvoDaLinha = (lista: SerieDaSessao[]): string => {
  if (!lista.length) return "";
  const feitas = lista.filter((s) => s.feito).length;
  if (feitas > 0 && feitas < lista.length) return `${feitas} de ${lista.length} séries`;
  const reps = new Set(lista.map((s) => s.reps));
  const cargas = new Set(lista.map((s) => s.carga));
  const r = lista[0].reps;
  const c = Math.max(...lista.map((s) => s.carga));
  const kg = c > 0 ? ` · ${cargas.size > 1 ? "até " : ""}${formatarKg(c)} kg` : "";
  if (reps.size === 1 && r > 0) return `${lista.length} × ${r}${kg}`;
  return `${lista.length} séries${kg}`;
};

function AdicionarExercicio({ dia, spotlight, onAdicionar, tom, rotulo }: { dia: string; spotlight: boolean; onAdicionar: (dia: string, nome: string) => void; tom: TomDoDia; rotulo?: string }) {
  const [nome, setNome] = useState("");
  const enviar = () => {
    const n = nome.trim();
    if (!n) return;
    onAdicionar(dia, n);
    setNome("");
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); enviar(); }}
      className={cn("flex items-center gap-2 pl-3.5 pr-2 py-1.5 border-t", tom.linha)}
      data-spotlight={spotlight ? "add-exercise" : undefined}
    >
      <Plus className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder={rotulo ?? "Novo exercício..."}
        aria-label={`Novo exercício de ${dia.toLowerCase()}`}
        className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="Adicionar exercício"
        disabled={!nome.trim()}
        className={cn(
          "w-10 h-10 shrink-0 rounded-lg grid place-items-center active:scale-95 transition",
          nome.trim() ? "bg-foreground text-background" : "border border-border text-muted-foreground",
        )}
      >
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
}

export function TreinoHoje(p: PropsDoHoje) {
  const { hoje, hojeNome, dia, descanso, exercicios, chaves, series, acoes } = p;
  const tom = tomDoDia(hojeNome);
  const [abertoManual, setAbertoManual] = useState<{ chave: string; completoAoAbrir: boolean } | null>(null);
  const [ativas, setAtivas] = useState<Record<string, number | undefined>>({});
  const [obsAberta, setObsAberta] = useState<string | null>(null);

  const completo = (k: string) => {
    const l = series[k] ?? [];
    return l.length > 0 && l.every((s) => s.feito);
  };
  const primeiroAberto = chaves.find((k, i) => exercicios[i]?.tipo !== "cardio" && !completo(k)) ?? null;
  const aberto = abertoManual && chaves.includes(abertoManual.chave) ? abertoManual.chave : primeiroAberto;

  // Abriu um incompleto e terminou ele: a folha segue pro próximo sozinha.
  useEffect(() => {
    if (abertoManual && !abertoManual.completoAoAbrir && completo(abertoManual.chave)) setAbertoManual(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, abertoManual]);

  const temTreino = exercicios.length > 0 && !descanso;
  const carimbo = carimboDoPlano({ muscles: p.musculos, exercises: exercicios });
  const pct = p.total > 0 ? Math.round((p.feitas / p.total) * 100) : 0;
  const titulo = p.musculos.length ? p.musculos.join(" + ") : exercicios.length ? `${exercicios.length} exercício${exercicios.length > 1 ? "s" : ""}` : "";
  const nadaFeito = p.feitas === 0;

  return (
    <div className="space-y-3" data-testid="treino-hoje">
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        {/* faixa do dia: a cor do dia da semana, igual no app todo */}
        <div className={cn(COR_DO_DIA[hojeNome], textoDoDia(hojeNome), "px-4 py-3 flex items-center gap-3")}>
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold tracking-wide">
              {hojeNome} · {descanso ? "DESCANSO" : "HOJE"}
            </h2>
            {temTreino && (
              <p className="text-[13px] opacity-90 mt-0.5 leading-snug">
                <span aria-hidden="true">{carimbo.emoji === "✓" ? "💪" : carimbo.emoji} </span>
                {titulo}
                {p.minutos > 0 && <span className="tabular-nums"> · ~{p.minutos} min</span>}
                {dia !== hojeNome && (
                  <>
                    {" · "}treino de {dia.toLowerCase()}
                    {p.podeTrocar && nadaFeito && (
                      <button type="button" onClick={() => acoes.escolherDia(null)} className="ml-1.5 underline underline-offset-2 font-semibold">
                        trocar
                      </button>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
          {temTreino && p.total > 0 && (
            <div className="ml-auto shrink-0 text-right">
              <p className="text-[13px] font-bold tabular-nums" data-testid="contagem-series">
                {p.feitas}/{p.total} {p.rotuloTotal}
              </p>
              <div className="mt-1.5 w-24 h-1.5 rounded-full relative overflow-hidden" aria-hidden="true">
                <span className="absolute inset-0 bg-current opacity-30" />
                <span className="relative block h-full rounded-full bg-current transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {descanso ? (
          <div className="px-4 py-4 space-y-3">
            <p className="text-[13.5px] leading-snug">😴 Hoje é dia de descanso. Descanso não quebra a sequência — o que conta é fechar a semana.</p>
            {p.outrosDias.length > 0 && (
              <div>
                <p className="text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground">QUER TREINAR MESMO ASSIM?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.outrosDias.map((o) => (
                    <button
                      key={o.dia}
                      type="button"
                      onClick={() => acoes.escolherDia(o.dia)}
                      className="h-10 pl-2 pr-3 rounded-lg border border-border bg-card text-[12.5px] font-semibold inline-flex items-center gap-2 active:scale-95 transition"
                    >
                      <i className={cn("w-1.5 h-5 rounded", COR_DO_DIA[o.dia])} aria-hidden="true" />
                      <span className="font-extrabold">{o.dia.slice(0, 3)}</span>
                      <span className="text-muted-foreground font-medium">{o.rotulo}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : exercicios.length === 0 ? (
          <div className="px-4 pt-4 pb-3 space-y-1">
            <p className="text-[13.5px] font-semibold">Monte o treino de hoje</p>
            <p className="text-[12.5px] text-muted-foreground">
              Adicione o primeiro exercício — ou{" "}
              <button type="button" onClick={acoes.abrirPlano} className="underline underline-offset-2 font-semibold text-foreground inline-flex items-center gap-1">
                use um modelo pronto <ClipboardList className="w-3 h-3" aria-hidden="true" />
              </button>
              .
            </p>
          </div>
        ) : (
          <div>
            {exercicios.map((ex, i) => {
              const k = chaves[i];
              const lista = series[k] ?? [];
              const feito = completo(k);
              const parcial = !feito && lista.some((s) => s.feito);
              const primeira = i === 0;

              if (ex.tipo === "cardio") {
                return (
                  <div key={k} className={cn("pl-3.5 pr-2 py-1.5", !primeira && cn("border-t", tom.linha))} data-testid={`cardio-${k}`}>
                    <div className="flex items-center gap-2 min-h-[40px]">
                      <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
                      <Chip indice={i} riscado={feito}>{ex.name}</Chip>
                      <span className="ml-auto" />
                      <Quadradinho marcado={feito} onClick={() => acoes.marcarExercicio(k, !feito)} rotulo={`${feito ? "Desmarcar" : "Marcar"} ${ex.name}`} />
                    </div>
                    <div className="ml-6 mb-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <span aria-hidden="true">🏃</span>
                      <input
                        value={ex.duracao ?? ""}
                        onChange={(e) => acoes.cardio(i, "duracao", e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={`Minutos de ${ex.name}`}
                        className="w-12 h-9 rounded-md border border-border bg-background text-center text-foreground font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span>min ·</span>
                      <input
                        value={ex.distancia ?? ""}
                        onChange={(e) => acoes.cardio(i, "distancia", e.target.value)}
                        placeholder="km/qtd"
                        aria-label={`Distância ou quantidade de ${ex.name}`}
                        className="w-20 h-9 rounded-md border border-border bg-background text-center text-foreground font-semibold outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                );
              }

              if (k !== aberto) {
                return (
                  <div key={k} className={cn("flex items-center gap-1 pl-3.5 pr-2 min-h-[52px]", !primeira && cn("border-t", tom.linha))} data-testid={`linha-${k}`}>
                    <button
                      type="button"
                      onClick={() => setAbertoManual({ chave: k, completoAoAbrir: feito })}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left py-2"
                      aria-label={`Abrir ${ex.name}`}
                    >
                      <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
                      <Chip indice={i} riscado={feito}>{ex.name}</Chip>
                      <span className="ml-auto shrink-0 pl-1 text-[12px] text-muted-foreground tabular-nums">{alvoDaLinha(lista)}</span>
                    </button>
                    <Quadradinho
                      marcado={feito}
                      parcial={parcial}
                      tom={tom}
                      onClick={() => acoes.marcarExercicio(k, !feito)}
                      rotulo={`${feito ? "Desmarcar" : "Marcar"} ${ex.name} inteiro`}
                    />
                  </div>
                );
              }

              const ultima = p.ultimas[k];
              const sug = p.sugestoes[k];
              const mostrarPostIt = !!sug && lista.some((s) => !s.feito && s.carga < sug.nova);
              const planSets = Math.round(lerNumero(ex.sets)) || 1;
              const podeTirar = lista.length > planSets && !lista[lista.length - 1]?.feito;
              const temCinza = lista.some((s) => !s.feito && !s.ok);
              const ativaManual = ativas[k];
              const ativa = ativaManual != null && ativaManual < lista.length ? ativaManual : lista.findIndex((s) => !s.feito);
              return (
                <div key={k} className={cn("px-2 min-[400px]:px-3.5 pt-3.5 pb-3", !primeira && cn("border-t", tom.linha))} data-testid="exercicio-aberto">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1.5 min-[400px]:pl-0">
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
                    <Chip indice={i}>{ex.name}</Chip>
                    {ultima && (
                      <span className="ml-auto text-[11.5px] text-muted-foreground">
                        última: <b className="text-foreground/80 tabular-nums">{textoDaUltimaVez(ultima.series)}</b>
                      </span>
                    )}
                  </div>

                  {mostrarPostIt && sug && (
                    <PostIt
                      className="mt-3 ml-5 mr-1"
                      testId="postit-progressao"
                      acao={
                        <button
                          type="button"
                          onClick={() => acoes.subir(k, sug.nova)}
                          className="shrink-0 h-9 px-3 rounded-md bg-amber-900 text-amber-50 text-[12px] font-bold active:scale-95 transition"
                        >
                          Subir
                        </button>
                      }
                    >
                      {quandoFoi(sug.data, hoje)} você fechou <b>{sug.fechou}</b>. Sobe pra <b className="tabular-nums">{formatarKg(sug.nova)} kg</b>?
                    </PostIt>
                  )}

                  <div className="mt-3">
                    <TabelaDeSeries
                      nome={ex.name}
                      series={lista}
                      tom={tom}
                      ativa={ativa >= 0 ? ativa : null}
                      onAtivar={(j) => setAtivas((a) => ({ ...a, [k]: j }))}
                      onAlternar={(j) => {
                        setAtivas((a) => ({ ...a, [k]: undefined }));
                        acoes.alternarSerie(k, j);
                      }}
                      onValor={(j, campo, v) => acoes.valor(k, j, campo, v)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1.5 ml-1 text-[12.5px] font-semibold text-muted-foreground">
                    <button type="button" onClick={() => acoes.maisSerie(k)} className="inline-flex items-center gap-1 h-9">
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />série
                    </button>
                    {podeTirar && (
                      <button type="button" onClick={() => acoes.menosSerie(k)} className="inline-flex items-center gap-1 h-9">
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />série
                      </button>
                    )}
                    <button type="button" onClick={() => setObsAberta(obsAberta === k ? null : k)} className="inline-flex items-center gap-1 h-9" aria-expanded={obsAberta === k}>
                      <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />anotar
                    </button>
                    {temCinza && (
                      <span className="ml-auto text-[11.5px] font-medium">cinza = {ultima ? "o que você fez da última vez" : "o alvo do plano"}</span>
                    )}
                  </div>
                  {obsAberta === k ? (
                    <input
                      autoFocus
                      value={ex.obs}
                      onChange={(e) => acoes.obs(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") setObsAberta(null); }}
                      placeholder="Execução, dor, ajuste de banco…"
                      aria-label={`Anotação de ${ex.name}`}
                      className="mt-1 w-full h-10 rounded-md border border-amber-200 bg-amber-50 px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    ex.obs && <p className="mt-0.5 ml-1 text-[12px] text-amber-700">💬 {ex.obs}</p>
                  )}
                </div>
              );
            })}
            <AdicionarExercicio dia={dia} tom={tom} spotlight={p.spotlightDia === dia} onAdicionar={acoes.adicionarExercicio} />
          </div>
        )}

        {/* dia vazio (ou descanso com dia de treino ainda sem nada): onde o tutorial ancora */}
        {!descanso && exercicios.length === 0 && (
          <AdicionarExercicio dia={dia} tom={tom} spotlight={p.spotlightDia === dia} onAdicionar={acoes.adicionarExercicio} rotulo="Ex.: Supino reto" />
        )}
        {descanso && p.diaParaMontar && (
          <div className={cn("border-t", tom.linha)}>
            <p className="px-4 pt-3 text-[12.5px] text-muted-foreground">
              Monte o treino de <b className="text-foreground">{p.diaParaMontar.toLowerCase()}</b> — um exercício já conta:
            </p>
            <AdicionarExercicio dia={p.diaParaMontar} tom={tom} spotlight={p.spotlightDia === p.diaParaMontar} onAdicionar={acoes.adicionarExercicio} rotulo="Ex.: Agachamento" />
          </div>
        )}
      </div>

      {temTreino && (
        <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-2">
          <p className="text-[11.5px] font-extrabold tracking-[.12em] text-foreground/80">📝 NOTAS DA SESSÃO</p>
          <Pautado
            value={p.nota}
            onChange={(e) => acoes.nota(e.target.value)}
            rows={Math.min(6, Math.max(2, Math.ceil(p.nota.length / 42) + 1))}
            placeholder="Sono, energia, dor, o que ajustar…"
            aria-label="Notas da sessão"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
