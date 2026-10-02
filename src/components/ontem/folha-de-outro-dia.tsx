/**
 * "ESQUECEU DE MARCAR?" (02/10) — as peças que Treino e hábitos da Rotina dividem:
 * a folha de baixo na cor do dia que está sendo marcado (a mesma faixa de planner
 * das tarefas) e o seletor ONTEM | ANTEONTEM. Beleza usa o seletor do próprio
 * cartão (visual dela).
 *
 * Regras de produto, iguais nos três módulos: até 2 dias pra trás; a marca anota
 * AQUELE dia na sequência (useMarcarOntem); uma faixa/aviso diz que não é hoje.
 */
import type { ReactNode } from "react";
import { History } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { diasRetroativos } from "@/lib/sequencia";
import { diaEmMiudo } from "@/hooks/use-marcar-ontem";
import { FOLHA, FaixaDaFolha } from "@/components/tarefas/tarefas-do-dia";
import { nomeDoDiaDaRotina } from "@/lib/rotina-habitos";

export function FolhaDeOutroDia({
  aberta, onFechar, dia, titulo, sub, children, testId = "folha-outro-dia",
}: {
  aberta: boolean;
  onFechar: () => void;
  /** "YYYY-MM-DD" do dia sendo marcado */
  dia: string;
  titulo: ReactNode;
  sub: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} data-testid={testId}>
        <FaixaDaFolha dia={nomeDoDiaDaRotina(dia)} titulo={titulo} sub={sub} onFechar={onFechar} />
        <div className="overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** ONTEM · qui 01/10 | ANTEONTEM · qua 30/09 — dois botões, o dia em miúdo embaixo. */
export function SeletorDeOutroDia({ hoje, atual, onEscolher }: { hoje: string; atual: string; onEscolher: (dia: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Qual dia marcar">
      {diasRetroativos(hoje).map((d) => (
        <button
          key={d.dia}
          type="button"
          onClick={() => onEscolher(d.dia)}
          aria-pressed={atual === d.dia}
          data-testid={`dia-${d.rotulo}`}
          className={cn(
            "min-h-[44px] rounded-lg px-2 py-1 text-center leading-tight transition-colors",
            atual === d.dia ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          <span className="block text-[11.5px] font-extrabold tracking-[.1em]">{d.rotulo.toUpperCase()}</span>
          <span className="block text-[11px] font-medium">{diaEmMiudo(d.dia)}</span>
        </button>
      ))}
    </div>
  );
}

/** O aviso de que a marca cai em OUTRO dia — âmbar, igual à faixa da Beleza. */
export function AvisoOutroDia({ rotulo, dia, children }: { rotulo: string; dia: string; children?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-[12.5px] leading-snug text-amber-900" data-testid="aviso-outro-dia">
      <History className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
      <span>
        Marcando em <b>{rotulo}</b> ({diaEmMiudo(dia)}). {children ?? "Conta na sua sequência."}
      </span>
    </p>
  );
}
