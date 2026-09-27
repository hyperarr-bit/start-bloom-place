/**
 * ⚙️ do cabeçalho (26/09): a antiga aba CONFIG virou folha — modelos prontos,
 * dias de treino, grupos musculares por dia, descanso padrão e som. Tudo que
 * existia continua aqui; só saiu da fila de abas.
 */
import { Calendar, Check, Copy, Target, Timer, Volume2, VolumeX, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { COR_DO_DIA, DIAS_DA_SEMANA, textoDoDia, textoDoDiaEmBotao } from "./planner";
import { EMOJI_DO_MUSCULO, GRUPOS_MUSCULARES } from "./EditorDoDia";

export interface ModeloDeTreino {
  name: string;
  emoji: string;
  plan: Record<string, string[]>;
}

export const MODELOS: ModeloDeTreino[] = [
  {
    name: "Push / Pull / Legs",
    emoji: "💪",
    plan: {
      SEGUNDA: ["Peito", "Ombros", "Tríceps"], "TERÇA": ["Costas", "Bíceps"], QUARTA: ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"],
      QUINTA: ["Peito", "Ombros", "Tríceps"], SEXTA: ["Costas", "Bíceps"], "SÁBADO": ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], DOMINGO: [],
    },
  },
  {
    name: "Upper / Lower",
    emoji: "🏋️",
    plan: {
      SEGUNDA: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], "TERÇA": ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], QUARTA: [],
      QUINTA: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], SEXTA: ["Quadríceps", "Posterior", "Glúteos", "Panturrilha"], "SÁBADO": [], DOMINGO: [],
    },
  },
  {
    name: "ABC Clássico",
    emoji: "🔥",
    plan: {
      SEGUNDA: ["Peito", "Tríceps"], "TERÇA": ["Costas", "Bíceps"], QUARTA: ["Ombros", "Pernas"],
      QUINTA: ["Peito", "Tríceps"], SEXTA: ["Costas", "Bíceps"], "SÁBADO": ["Ombros", "Pernas"], DOMINGO: [],
    },
  },
  {
    name: "Full Body 3x",
    emoji: "⚡",
    plan: { SEGUNDA: ["Full Body"], "TERÇA": [], QUARTA: ["Full Body"], QUINTA: [], SEXTA: ["Full Body"], "SÁBADO": [], DOMINGO: [] },
  },
];

const titulo = "text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground flex items-center gap-1.5 mb-2";

export function ConfigDoTreino({
  aberto,
  onFechar,
  hojeNome,
  diasAtivos,
  musculosPorDia,
  descanso,
  som,
  onModelo,
  onDia,
  onMusculo,
  onDescanso,
  onSom,
}: {
  aberto: boolean;
  onFechar: () => void;
  hojeNome: string;
  diasAtivos: string[];
  musculosPorDia: Record<string, string[]>;
  descanso: number;
  som: boolean;
  onModelo: (m: ModeloDeTreino) => void;
  onDia: (dia: string) => void;
  onMusculo: (dia: string, musculo: string) => void;
  onDescanso: (seg: number) => void;
  onSom: (ligado: boolean) => void;
}) {
  return (
    <Sheet open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <SheetContent side="bottom" className="p-0 gap-0 rounded-t-2xl max-h-[92vh] overflow-y-auto [&>button:last-child]:hidden" data-testid="config-treino">
        <div className="sticky top-0 z-10 bg-foreground text-background dark:bg-muted dark:text-foreground px-4 py-3 flex items-center gap-2">
          <div className="min-w-0">
            <SheetTitle className="text-[15px] font-extrabold tracking-wide text-inherit">⚙️ CONFIGURAR TREINO</SheetTitle>
            <SheetDescription className="text-[12px] opacity-75 text-inherit">Modelos, dias de treino, músculos e descanso</SheetDescription>
          </div>
          <button type="button" onClick={onFechar} className="ml-auto w-9 h-9 shrink-0 rounded-lg grid place-items-center hover:bg-white/10" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          <section>
            <h3 className={titulo}><Copy className="w-3.5 h-3.5" aria-hidden="true" /> MODELOS PRONTOS</h3>
            <div className="grid grid-cols-1 gap-2">
              {MODELOS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => onModelo(t)}
                  className="text-left px-3 py-2.5 rounded-lg border border-border bg-card hover:border-blue-400 active:scale-[.99] transition"
                >
                  <p className="text-[13.5px] font-bold">{t.emoji} {t.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug [overflow-wrap:anywhere]">
                    {Object.entries(t.plan).filter(([, v]) => v.length > 0).map(([d, v]) => `${d === "SÁBADO" ? "SÁB" : d.slice(0, 3)} ${v.join(" + ")}`).join(" · ")}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className={titulo}><Calendar className="w-3.5 h-3.5" aria-hidden="true" /> DIAS DE TREINO</h3>
            <div className="flex gap-1.5 flex-wrap">
              {DIAS_DA_SEMANA.map((d) => {
                const on = diasAtivos.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDia(d)}
                    aria-pressed={on}
                    className={cn(
                      "h-9 px-3 rounded-lg text-[11px] font-bold border transition",
                      on ? cn(COR_DO_DIA[d], textoDoDiaEmBotao(d), "border-transparent") : "bg-muted/30 text-muted-foreground border-border",
                      d === hojeNome && "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background",
                    )}
                  >
                    {d.slice(0, 3)}
                    {on && <Check className="w-3 h-3 inline ml-1" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className={titulo}><Target className="w-3.5 h-3.5" aria-hidden="true" /> GRUPOS MUSCULARES POR DIA</h3>
            {diasAtivos.length === 0 && <p className="text-[12px] text-muted-foreground">Ligue um dia de treino acima.</p>}
            <div className="space-y-3">
              {diasAtivos.map((d) => (
                <div key={d}>
                  <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded inline-block", COR_DO_DIA[d], textoDoDia(d))}>{d}</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {GRUPOS_MUSCULARES.map((m) => {
                      const sel = musculosPorDia[d]?.includes(m) ?? false;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onMusculo(d, m)}
                          aria-pressed={sel}
                          className={cn("h-8 px-2 rounded-md text-[11px] border transition", sel ? "bg-blue-500 text-white border-blue-500" : "border-border text-muted-foreground")}
                        >
                          {EMOJI_DO_MUSCULO[m] ?? "💪"} {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className={titulo}><Timer className="w-3.5 h-3.5" aria-hidden="true" /> DESCANSO ENTRE SÉRIES</h3>
            <p className="text-[11.5px] text-muted-foreground mb-2">Começa sozinho quando você marca uma série no HOJE.</p>
            <div className="flex flex-wrap gap-2 items-center">
              {[30, 45, 60, 90, 120].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onDescanso(t)}
                  aria-pressed={descanso === t}
                  className={cn("h-9 px-3 rounded-lg text-[12.5px] font-semibold border transition", descanso === t ? "bg-blue-500 text-white border-blue-500" : "border-border")}
                >
                  {t}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => onSom(!som)}
                className="ml-auto h-9 px-3 rounded-lg border border-border inline-flex items-center gap-1.5 text-[12px] font-semibold"
                aria-pressed={som}
                aria-label={som ? "Som do descanso ligado" : "Som do descanso desligado"}
              >
                {som ? <Volume2 className="w-4 h-4 text-blue-500" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                {som ? "Bipe" : "Mudo"}
              </button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
