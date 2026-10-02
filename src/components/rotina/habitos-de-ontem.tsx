/**
 * HÁBITOS DE ONTEM (02/10) — "como marcar um exercício feito ontem? esqueci de
 * marcar na hora" e "quero voltar no dia 28/09 e marcar os itens que esqueci".
 * A grade HÁBITOS DIÁRIOS só vai até a semana corrente (na segunda-feira, o
 * domingo some) e não deixava claro que dava pra marcar um dia que passou.
 *
 * Um pé discreto no card — "ESQUECEU? ONTEM 2/4 · ANTEONTEM 0/4" — abre uma
 * folha de baixo na cor do dia, com os hábitos daquele dia e o quadradinho de
 * sempre. A tela de hoje não muda. Quem grava é a página (alternarHabitoNaData):
 * a grade, o log por data, o heatmap e a sequência.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Quadradinho } from "@/components/treino/planner";
import { cn } from "@/lib/utils";
import { diasRetroativos } from "@/lib/sequencia";
import { diaEmMiudo } from "@/hooks/use-marcar-ontem";
import { AvisoOutroDia, FolhaDeOutroDia, SeletorDeOutroDia } from "@/components/ontem/folha-de-outro-dia";

export function HabitosDeOntem({
  nomes, hoje, marcados, onAlternar,
}: {
  nomes: string[];
  hoje: string;
  /** quais hábitos estão marcados num dia, na ordem de `nomes` */
  marcados: (dia: string) => boolean[];
  onAlternar: (dia: string, indice: number) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  // a folha fecha devagar: segue mostrando o último dia em vez de descer vazia
  const [ultimo, setUltimo] = useState<string>(diasRetroativos(hoje)[0].dia);
  const dias = diasRetroativos(hoje);
  const escolher = (dia: string) => { setUltimo(dia); setAberto(dia); };
  const dia = aberto ?? ultimo;
  const rotulo = dias.find((d) => d.dia === dia)?.rotulo ?? "ontem";
  const feitosDoDia = marcados(dia);
  const feitos = feitosDoDia.filter(Boolean).length;
  const [semana, data] = diaEmMiudo(dia).split(" ");

  return (
    <>
      <div
        className="px-3 py-2 flex items-center gap-2 bg-green-50/70 border-b border-green-100 dark:bg-[hsl(var(--rt-card-2))] dark:border-[hsl(var(--rt-border))]"
        data-testid="esqueceu-de-marcar"
      >
        <span className="shrink-0 text-[10px] font-extrabold tracking-[.12em] text-green-900/80 dark:text-[hsl(var(--rt-text-soft))]">ESQUECEU?</span>
        {dias.map((d) => {
          const m = marcados(d.dia);
          const n = m.filter(Boolean).length;
          return (
            <button
              key={d.dia}
              type="button"
              onClick={() => escolher(d.dia)}
              data-testid={`habitos-${d.rotulo}`}
              aria-label={`Marcar hábitos de ${d.rotulo}, ${diaEmMiudo(d.dia)}: ${n} de ${m.length} feitos`}
              className="h-10 px-2.5 rounded-lg border border-green-200 bg-card text-[11px] font-extrabold tracking-[.08em] inline-flex items-center gap-1.5 active:scale-95 transition dark:border-[hsl(var(--rt-border))]"
            >
              {d.rotulo.toUpperCase()}
              <span className="font-bold tabular-nums text-muted-foreground tracking-normal">{n}/{m.length}</span>
            </button>
          );
        })}
      </div>

      <FolhaDeOutroDia
        aberta={aberto !== null}
        onFechar={() => setAberto(null)}
        dia={dia}
        titulo={`${semana.toUpperCase()} · HÁBITOS DE ${rotulo.toUpperCase()}`}
        sub={<span className="tabular-nums">{feitos}/{nomes.length} marcados · {data}</span>}
        testId="folha-habitos-ontem"
      >
        <div className="px-4 pt-4 space-y-3">
          <SeletorDeOutroDia hoje={hoje} atual={dia} onEscolher={escolher} />
          <AvisoOutroDia rotulo={rotulo} dia={dia} />
        </div>
        <div className="mt-3" role="group" aria-label={`Hábitos de ${rotulo}`}>
          {nomes.map((nome, i) => (
            <div key={nome} className="min-h-[52px] flex items-center gap-2 pl-4 pr-2 border-t border-green-100" data-testid="habito-de-ontem">
              <span className={cn("min-w-0 flex-1 text-[14.5px] leading-snug break-words", feitosDoDia[i] ? "line-through text-muted-foreground font-medium" : "font-semibold")}>{nome}</span>
              <Quadradinho comoCaixa marcado={!!feitosDoDia[i]} onClick={() => onAlternar(dia, i)} rotulo={`${feitosDoDia[i] ? "Desmarcar" : "Marcar"} ${nome} em ${rotulo}`} />
            </div>
          ))}
        </div>
        <div className="px-4 pt-3 border-t border-green-100">
          <Button onClick={() => setAberto(null)} className="w-full h-11 text-[14px] font-bold">Pronto</Button>
        </div>
      </FolhaDeOutroDia>
    </>
  );
}
