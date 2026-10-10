import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  CATALOGO_PENDENCIAS, DIAS_CURTOS, comPeso, estaOculto, ocultar, religar, rotuloDoPeso,
  type PendenciasPrefs, type TipoPendencia,
} from "@/lib/home-pendencias";

/**
 * A FOLHA "PERSONALIZAR PENDÊNCIAS" (10/10, chamado: "como configurar as
 * pendências do dia na página inicial? … registrar o peso eu prefiro
 * semanalmente; também não gostaria que aparecesse anotar as refeições").
 *
 * Uma linha por TIPO de pendência automática com um interruptor (ligado =
 * aparece); o peso ainda escolhe "todo dia" ou "1x por semana" e o dia. É a
 * mesma folha de baixo do menu da conta (AccountDrawer) — nada novo no visual.
 * Compromissos, tarefas e contas a vencer não estão aqui: são da pessoa.
 */
export function PersonalizarPendencias({ open, onOpenChange, prefs, onChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: PendenciasPrefs;
  onChange: (p: PendenciasPrefs) => void;
}) {
  const alternar = (tipo: TipoPendencia, mostrar: boolean) => onChange(mostrar ? religar(prefs, tipo) : ocultar(prefs, tipo));
  const ocultos = prefs.ocultos.length;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 z-[300] rounded-t-[28px] border-x-0 border-b-0 max-h-[85dvh] overflow-y-auto pb-[max(1.25rem,var(--app-safe-bottom))]"
        overlayClassName="z-[290]"
        data-testid="personalizar-pendencias"
      >
        <div className="pt-3 pb-1 flex justify-center" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>
        <SheetHeader className="px-5 pt-4 pb-3 text-left">
          <SheetTitle className="text-sm font-semibold">Personalizar pendências</SheetTitle>
          <SheetDescription className="text-[11px] leading-snug">
            Desligue o que você não quer ver em Pendências de hoje. O que está desligado sai da lista e do Score do Dia — o score só cobra o que fica ligado.
            {ocultos > 0 && <span className="block mt-1 text-foreground font-medium">{ocultos} {ocultos === 1 ? "tipo oculto" : "tipos ocultos"}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 space-y-1">
          {CATALOGO_PENDENCIAS.map((c) => {
            const ligado = !estaOculto(prefs, c.tipo);
            return (
              <div key={c.tipo} className="rounded-xl border border-border/50 bg-card" data-testid={`pref-${c.tipo}`}>
                <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                  <span className="text-sm">{c.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-medium ${ligado ? "" : "text-muted-foreground line-through"}`}>{c.nome}</span>
                    <span className="block text-[10px] text-muted-foreground leading-snug">
                      {c.tipo === "peso" && ligado ? rotuloDoPeso(prefs) : c.descricao}
                    </span>
                  </span>
                  <Switch checked={ligado} onCheckedChange={(v) => alternar(c.tipo, v)} aria-label={`Mostrar ${c.nome}`} className="scale-90" />
                </label>
                {c.tipo === "peso" && ligado && (
                  <div className="px-3 pb-2.5 space-y-2" data-testid="peso-frequencia">
                    <div className="flex gap-1.5">
                      {([["diaria", "Todo dia"], ["semanal", "1x por semana"]] as const).map(([f, rotulo]) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => onChange(comPeso(prefs, f))}
                          aria-pressed={prefs.peso.frequencia === f}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${prefs.peso.frequencia === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                        >
                          {rotulo}
                        </button>
                      ))}
                    </div>
                    {prefs.peso.frequencia === "semanal" && (
                      <div className="flex gap-1" role="group" aria-label="Dia da pesagem">
                        {DIAS_CURTOS.map((d, i) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onChange(comPeso(prefs, "semanal", i))}
                            aria-pressed={prefs.peso.diaSemana === i}
                            aria-label={`Pesar ${d}`}
                            className={`flex-1 py-1 rounded-md text-[10px] font-semibold border ${prefs.peso.diaSemana === i ? "bg-primary/15 border-primary/40 text-primary" : "border-border/60 text-muted-foreground"}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {prefs.peso.frequencia === "semanal" && (
                      <p className="text-[10px] text-muted-foreground leading-snug">Só aparece nesse dia, e só se você ainda não pesou na semana.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="px-5 pt-3 text-[10px] text-muted-foreground leading-snug">
          Compromissos, tarefas e contas a vencer que você criou sempre aparecem — são seus.
        </p>
      </SheetContent>
    </Sheet>
  );
}
