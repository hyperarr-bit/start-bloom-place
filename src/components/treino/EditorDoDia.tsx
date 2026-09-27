/**
 * Editor de um dia do plano (26/09): a SEMANA virou tabela e tocar num dia
 * abre esta folha — o mesmo editor de antes (músculos, exercícios com
 * séries × reps × carga-alvo, força/cardio, remover com Desfazer, copiar pra
 * outros dias com Desfazer), agora num lugar só em vez de sete cartões.
 */
import { useState } from "react";
import { Copy, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ExercicioDoPlano } from "@/lib/treino-series";
import { Chip, COR_DO_DIA, DIAS_DA_SEMANA, textoDoDia, tomDoDia } from "./planner";

export const GRUPOS_MUSCULARES = [
  "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Glúteos",
  "Abdômen", "Quadríceps", "Posterior", "Panturrilha", "Cardio", "Full Body",
];

export const EMOJI_DO_MUSCULO: Record<string, string> = {
  Peito: "🏋️", Costas: "💪", Ombros: "🏋️", "Bíceps": "💪", "Tríceps": "💪",
  Pernas: "🦵", "Glúteos": "🍑", "Abdômen": "🔥", "Quadríceps": "🦵",
  Posterior: "🦵", Panturrilha: "🦵", Cardio: "🏃", "Full Body": "🏋️",
};

export interface AcoesDoEditor {
  ativo: (dia: string, ativo: boolean) => void;
  musculo: (dia: string, musculo: string) => void;
  exercicio: (dia: string, indice: number, mudanca: Partial<ExercicioDoPlano>) => void;
  adicionar: (dia: string, nome: string) => void;
  remover: (dia: string, indice: number) => void;
  copiar: (dia: string, destinos: string[]) => void;
}

const campo = "h-9 rounded-md border border-border bg-background text-center text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring placeholder:font-normal placeholder:text-muted-foreground";

export function EditorDoDia({
  dia,
  hojeNome,
  musculos,
  exercicios,
  ativo,
  onFechar,
  acoes,
  spotlight,
}: {
  dia: string | null;
  hojeNome: string;
  musculos: string[];
  exercicios: ExercicioDoPlano[];
  ativo: boolean;
  onFechar: () => void;
  acoes: AcoesDoEditor;
  spotlight: boolean;
}) {
  const [novo, setNovo] = useState("");
  const [removendo, setRemovendo] = useState(false);
  const [obsAberta, setObsAberta] = useState<number | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [destinos, setDestinos] = useState<string[]>([]);
  const aberto = !!dia;
  const d = dia ?? "SEGUNDA";
  const tom = tomDoDia(d);
  const outros = DIAS_DA_SEMANA.filter((x) => x !== d);

  const fechar = () => {
    setRemovendo(false);
    setCopiando(false);
    setDestinos([]);
    setObsAberta(null);
    setNovo("");
    onFechar();
  };
  const adicionar = () => {
    const n = novo.trim();
    if (!n) return;
    acoes.adicionar(d, n);
    setNovo("");
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => { if (!v) fechar(); }}>
      <SheetContent
        side="bottom"
        className="p-0 gap-0 rounded-t-2xl max-h-[92vh] overflow-y-auto [&>button:last-child]:hidden"
        data-testid="editor-do-dia"
      >
        <div className={cn(COR_DO_DIA[d], textoDoDia(d), "sticky top-0 z-10 px-4 py-3 flex items-center gap-2")}>
          <div className="min-w-0">
            <SheetTitle className="text-[16px] font-extrabold tracking-wide text-inherit">
              {d}{d === hojeNome ? " · HOJE" : ""}
            </SheetTitle>
            <SheetDescription className="text-[12.5px] opacity-90 text-inherit">
              {exercicios.length ? `${exercicios.length} exercício${exercicios.length > 1 ? "s" : ""}` : "Monte o treino do dia"}
            </SheetDescription>
          </div>
          {/* COPIAR PRA OUTROS DIAS (22/09, chamado: "no treino senti a falta de
              ter como copiar para outro dia da semana igual tem na dieta") */}
          <button
            type="button"
            onClick={() => { setCopiando((c) => !c); setDestinos([]); }}
            className="ml-auto h-9 px-2.5 rounded-lg bg-white/20 inline-flex items-center gap-1 text-[12px] font-bold"
            aria-label={`Copiar treino de ${d} para outros dias`}
            data-testid={`copiar-treino-${d}`}
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar
          </button>
          <button type="button" onClick={fechar} className="w-9 h-9 rounded-lg grid place-items-center hover:bg-white/15" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {copiando && (
          <div className="px-4 py-3 bg-muted/50 border-b border-border space-y-2" data-testid="painel-copiar-treino">
            <p className="text-[11px] font-extrabold tracking-[.1em] text-muted-foreground">COPIAR PARA</p>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer min-h-[32px]">
              <Checkbox checked={destinos.length === outros.length} onCheckedChange={(v) => setDestinos(v ? outros : [])} />
              Todos
            </label>
            <div className="grid grid-cols-2 gap-1">
              {outros.map((x) => (
                <label key={x} className="flex items-center gap-2 text-[12.5px] cursor-pointer min-h-[32px]">
                  <Checkbox checked={destinos.includes(x)} onCheckedChange={(v) => setDestinos((p) => (v ? [...p, x] : p.filter((y) => y !== x)))} />
                  {x}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!destinos.length}
              onClick={() => { acoes.copiar(d, destinos); setCopiando(false); setDestinos([]); }}
              className="w-full h-10 rounded-lg bg-foreground text-background text-[13px] font-bold disabled:opacity-40"
            >
              Copiar ({destinos.length})
            </button>
          </div>
        )}

        <div className="px-4 py-3 space-y-4">
          <label className="flex items-center justify-between gap-3 min-h-[40px]">
            <span>
              <span className="block text-[13.5px] font-semibold">Dia de treino</span>
              <span className="block text-[11.5px] text-muted-foreground">{ativo ? "Conta na sua semana" : "Desligado = descanso"}</span>
            </span>
            <Switch checked={ativo} onCheckedChange={(v) => acoes.ativo(d, v)} aria-label={`${d} é dia de treino`} />
          </label>

          <div>
            <p className="text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground mb-1.5">GRUPOS MUSCULARES</p>
            <div className="flex flex-wrap gap-1.5">
              {GRUPOS_MUSCULARES.map((m) => {
                const sel = musculos.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => acoes.musculo(d, m)}
                    aria-pressed={sel}
                    className={cn(
                      "h-8 px-2.5 rounded-md text-[12px] border transition",
                      sel ? cn(tom.botao, "border-transparent font-semibold") : "border-border text-muted-foreground bg-card",
                    )}
                  >
                    {EMOJI_DO_MUSCULO[m] ?? "💪"} {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center mb-1.5">
              <p className="text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground">EXERCÍCIOS</p>
              {exercicios.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRemovendo((r) => !r)}
                  className={cn("ml-auto h-8 px-2 rounded-md text-[12px] font-semibold inline-flex items-center gap-1", removendo ? "text-foreground" : "text-red-600")}
                  aria-label={removendo ? "Pronto" : "Remover exercícios"}
                >
                  {removendo ? "Pronto" : <><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remover</>}
                </button>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground mb-2">
              <b className="text-blue-700">🏋️ Força</b> é o padrão (séries × reps × carga) — toque nele pra virar{" "}
              <b className="text-orange-600">🏃 Cardio</b> (tempo + distância).
            </p>
            <div className={cn("rounded-lg border overflow-hidden", tom.linha)}>
              {exercicios.length === 0 && <p className="px-3 py-4 text-[12.5px] text-muted-foreground text-center">Nenhum exercício ainda.</p>}
              {exercicios.map((ex, i) => {
                const cardio = ex.tipo === "cardio";
                return (
                  <div key={`${ex.name}-${i}`} className={cn("px-2.5 py-2", i > 0 && cn("border-t", tom.linha))}>
                    <div className="flex items-center gap-2 min-h-[36px]">
                      <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}</span>
                      <Chip indice={i} className="text-[13px]">{ex.name}</Chip>
                      <button
                        type="button"
                        onClick={() => setObsAberta(obsAberta === i ? null : i)}
                        className="w-9 h-9 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label={`Anotação de ${ex.name}`}
                      >
                        <MessageSquare className={cn("w-3.5 h-3.5", ex.obs && "text-amber-500")} />
                      </button>
                      {removendo && (
                        <button
                          type="button"
                          onClick={() => acoes.remover(d, i)}
                          aria-label={`Remover ${ex.name}`}
                          className="ml-auto w-9 h-9 shrink-0 rounded-md bg-red-50 text-red-600 grid place-items-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 ml-6 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => acoes.exercicio(d, i, { tipo: cardio ? undefined : "cardio" })}
                        className={cn(
                          "h-9 px-2 rounded-md border text-[11.5px] font-semibold inline-flex items-center gap-1",
                          cardio ? "border-orange-300 bg-orange-100 text-orange-700" : "border-blue-300 bg-blue-100 text-blue-700",
                        )}
                        aria-label={`Tipo de ${ex.name}: ${cardio ? "cardio" : "força"}. Toque pra alternar`}
                      >
                        {cardio ? "🏃 Cardio" : "🏋️ Força"}
                      </button>
                      {cardio ? (
                        <>
                          <input value={ex.duracao ?? ""} onChange={(e) => acoes.exercicio(d, i, { duracao: e.target.value })} placeholder="min" inputMode="decimal" aria-label={`Minutos de ${ex.name}`} className={cn(campo, "w-14")} />
                          <span>min ·</span>
                          <input value={ex.distancia ?? ""} onChange={(e) => acoes.exercicio(d, i, { distancia: e.target.value })} placeholder="km/qtd" aria-label={`Distância de ${ex.name}`} className={cn(campo, "w-20")} />
                        </>
                      ) : (
                        <>
                          <input value={ex.sets} onChange={(e) => acoes.exercicio(d, i, { sets: e.target.value })} placeholder="S" inputMode="numeric" aria-label={`Séries de ${ex.name}`} className={cn(campo, "w-11")} />
                          <span>×</span>
                          <input value={ex.reps} onChange={(e) => acoes.exercicio(d, i, { reps: e.target.value })} placeholder="R" aria-label={`Repetições de ${ex.name}`} className={cn(campo, "w-12")} />
                          <span>×</span>
                          <input value={ex.carga} onChange={(e) => acoes.exercicio(d, i, { carga: e.target.value })} placeholder="kg" inputMode="decimal" aria-label={`Carga de ${ex.name}`} className={cn(campo, "w-[4.5rem]")} />
                        </>
                      )}
                    </div>
                    {obsAberta === i && (
                      <input
                        autoFocus
                        value={ex.obs}
                        onChange={(e) => acoes.exercicio(d, i, { obs: e.target.value })}
                        placeholder="Execução, dores, ajustes…"
                        aria-label={`Anotação de ${ex.name}`}
                        className="mt-1.5 ml-6 w-[calc(100%-1.5rem)] h-9 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-[12.5px] outline-none"
                      />
                    )}
                    {ex.obs && obsAberta !== i && <p className="mt-1 ml-6 text-[11.5px] text-amber-700">💬 {ex.obs}</p>}
                  </div>
                );
              })}
              <form
                onSubmit={(e) => { e.preventDefault(); adicionar(); }}
                className={cn("flex items-center gap-2 px-2.5 py-1.5", exercicios.length > 0 && cn("border-t", tom.linha))}
                data-spotlight={spotlight ? "add-exercise" : undefined}
              >
                <Plus className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  placeholder="+ Novo exercício..."
                  aria-label={`Novo exercício de ${d.toLowerCase()}`}
                  className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!novo.trim()}
                  aria-label="Adicionar exercício"
                  className={cn("w-10 h-10 shrink-0 rounded-lg grid place-items-center", novo.trim() ? "bg-foreground text-background" : "border border-border text-muted-foreground")}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          <button type="button" onClick={fechar} className="w-full h-12 rounded-xl bg-foreground text-background text-[14px] font-bold">
            Pronto
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
