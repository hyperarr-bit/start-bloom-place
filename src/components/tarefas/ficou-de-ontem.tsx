/**
 * "FICOU DE ONTEM" (02/10) — o bloco no topo das tarefas de hoje. As regras
 * moram em lib/ficou-de-ontem; aqui é só o que a pessoa vê e toca.
 *
 * Cara de PLANNER: a mesma faixa colorida em caixa alta das outras listas
 * (âmbar, de "ainda não acabou"), as tarefas agrupadas por dia ("ONTEM · qui
 * 01/10", "HÁ 3 DIAS · seg 29/09") com a hora em azul à esquerda, e três saídas
 * escritas por extenso em cada uma — Trazer pra hoje, Concluir, Apagar —
 * porque o dono pediu clareza, não ícone adivinhável. Nada se move sozinho.
 * Some quando não tem nada.
 */
import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, NotebookText } from "lucide-react";
import { avisarApagado } from "@/lib/desfazer";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { agruparPorDia, tarefasQueFicaram, type ItemFicou } from "@/lib/ficou-de-ontem";
import { detalhesDaTarefa, horaDaTarefa, resumoDosDetalhes, type TarefaDoDia } from "@/lib/tarefas";
import { diaEmMiudo } from "@/hooks/use-marcar-ontem";
import type { useTarefasDoDia } from "./tarefas-do-dia";

type Tarefas = ReturnType<typeof useTarefasDoDia>;
export interface FonteFicou {
  chave: string;
  tarefas: Pick<Tarefas, "lista" | "trazer" | "concluirAntigas" | "apagarAntigas" | "restaurar">;
}

/** Até quantas linhas aparecem antes do "ver as outras" (7 dias podem juntar muita coisa). */
const LINHAS_VISIVEIS = 5;

let vistoNoDia = "";

export function FicouDeOntem({ fontes, envolver }: { fontes: FonteFicou[]; envolver?: boolean }) {
  const hoje = localDayKey();
  const [todas, setTodas] = useState(false);
  const itens = useMemo(
    () => tarefasQueFicaram(fontes.map((f) => ({ chave: f.chave, lista: f.tarefas.lista })), hoje),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hoje, ...fontes.map((f) => f.tarefas.lista)],
  );

  useEffect(() => {
    if (!itens.length || vistoNoDia === hoje) return;
    vistoNoDia = hoje;
    trackEvent("tarefa_ficou_ontem_vista", { n: itens.length });
  }, [itens.length, hoje]);

  if (!itens.length) return null;

  const porFonte = (lista: ItemFicou[]) => fontes.map((f) => ({ f, itens: lista.filter((i) => i.chave === f.chave) })).filter((x) => x.itens.length);

  /** roda a ação em cada lista envolvida e oferece UM Desfazer que devolve tudo */
  const agir = (acao: string, lista: ItemFicou[], rodar: (f: FonteFicou, i: ItemFicou[]) => TarefaDoDia[], texto: string) => {
    const retratos = porFonte(lista).map(({ f, itens: it }) => ({ f, antes: rodar(f, it) }));
    trackEvent("tarefa_ficou_ontem_acao", { acao });
    avisarApagado(texto, () => retratos.forEach(({ f, antes }) => f.tarefas.restaurar(antes)));
  };

  const trazer = (i: ItemFicou) => agir("trazer", [i], (f, it) => f.tarefas.trazer(it), "Trouxe pra hoje");
  const concluir = (i: ItemFicou) => agir("concluir", [i], (f, it) => f.tarefas.concluirAntigas(it), "Marcada como feita no dia dela");
  const apagar = (i: ItemFicou) => agir("apagar", [i], (f, it) => f.tarefas.apagarAntigas(it), "Tarefa apagada");
  const trazerTodas = () =>
    agir("trazer_todas", itens, (f, it) => f.tarefas.trazer(it), `Trouxe ${itens.length} tarefas pra hoje`);

  const grupos = agruparPorDia(itens, hoje);
  let restante = todas ? Infinity : LINHAS_VISIVEIS;
  const escondidas = Math.max(0, itens.length - LINHAS_VISIVEIS);

  const bloco = (
    <div className="rounded-xl border border-amber-300/80 dark:border-amber-700/50 overflow-hidden" data-testid="ficou-de-ontem">
      <div className="bg-amber-200 dark:bg-amber-800/50 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider">↩ FICOU DE ONTEM</span>
        <span className="text-[9px] text-muted-foreground" data-testid="ficou-contagem">
          {itens.length} {itens.length === 1 ? "pendente" : "pendentes"}
        </span>
      </div>
      <div className="bg-card">
        <p className="px-4 pt-2.5 pb-1.5 text-[12px] leading-snug text-muted-foreground">
          Não foram feitas e continuam aqui até você decidir.
        </p>
        {grupos.map((g) => {
          const visiveis = g.itens.slice(0, restante);
          restante -= visiveis.length;
          if (!visiveis.length) return null;
          return (
            <div key={g.dia} data-testid={`grupo-${g.diasAtras}`}>
              <div className="px-4 py-1.5 border-t border-amber-100 dark:border-border bg-amber-50 dark:bg-amber-950/30 flex items-center gap-1.5 text-[10px] font-extrabold tracking-[.12em] text-amber-900 dark:text-amber-200">
                <span>{g.rotulo.toUpperCase()}</span>
                <span className="font-semibold tracking-normal opacity-70">· {diaEmMiudo(g.dia)}</span>
              </div>
              {visiveis.map((i) => <LinhaFicou key={`${i.chave}-${i.ids[0]}`} item={i} onTrazer={() => trazer(i)} onConcluir={() => concluir(i)} onApagar={() => apagar(i)} />)}
            </div>
          );
        })}
        {escondidas > 0 && (
          <button
            type="button"
            onClick={() => setTodas((v) => !v)}
            className="w-full h-10 border-t border-amber-100 dark:border-border text-[12.5px] font-semibold text-muted-foreground active:bg-muted/40"
            data-testid="ficou-ver-mais"
          >
            {todas ? "Mostrar menos" : `Ver as outras ${escondidas}`}
          </button>
        )}
        {itens.length > 1 && (
          <div className="p-2.5 border-t border-amber-100 dark:border-border bg-amber-50/70 dark:bg-amber-950/20">
            <button
              type="button"
              onClick={trazerTodas}
              className="w-full h-11 rounded-lg bg-foreground text-background text-[13.5px] font-bold inline-flex items-center justify-center gap-2 active:scale-[.99] transition"
              data-testid="trazer-todas"
            >
              <CornerDownLeft className="w-4 h-4" aria-hidden="true" /> Trazer todas pra hoje
            </button>
          </div>
        )}
      </div>
    </div>
  );
  /* dentro do card da Home (envolver) o bloco ganha uma moldura de respiro; na lista da Rotina ele já é um card irmão */
  return envolver ? <div className="p-2.5">{bloco}</div> : bloco;
}

function LinhaFicou({ item, onTrazer, onConcluir, onApagar }: {
  item: ItemFicou; onTrazer: () => void; onConcluir: () => void; onApagar: () => void;
}) {
  const t = item.tarefa;
  const hora = horaDaTarefa(t);
  const detalhes = detalhesDaTarefa(t);
  const repetidas = item.ids.length;
  return (
    <div className="px-3.5 pt-2.5 pb-2.5 border-t border-amber-100 dark:border-border" data-testid="item-ficou">
      <div className="flex items-start gap-2">
        {hora && <span className="shrink-0 pt-px text-[13px] font-bold tabular-nums text-sky-700 dark:text-sky-300">{hora}</span>}
        <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug break-words">{t.texto}</p>
        {repetidas > 1 && (
          <span className="shrink-0 mt-px rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold tabular-nums text-muted-foreground" title="A mesma tarefa em vários dias">
            em {repetidas} dias
          </span>
        )}
      </div>
      {detalhes && (
        <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground min-w-0">
          <NotebookText className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate italic">{resumoDosDetalhes(detalhes, 70)}</span>
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onTrazer}
          className="h-10 px-3 shrink-0 whitespace-nowrap rounded-lg bg-foreground text-background text-[12.5px] font-bold inline-flex items-center gap-1.5 active:scale-95 transition"
          aria-label={`Trazer pra hoje: ${t.texto}`}
        >
          <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" /> Trazer pra hoje
        </button>
        <button
          type="button"
          onClick={onConcluir}
          className="h-10 px-3 shrink-0 whitespace-nowrap rounded-lg border border-border bg-card text-[12.5px] font-semibold inline-flex items-center active:scale-95 transition"
          aria-label={`Concluir: ${t.texto}`}
        >
          Concluir
        </button>
        <button
          type="button"
          onClick={onApagar}
          className="ml-auto h-10 px-2 shrink-0 whitespace-nowrap rounded-lg text-[12.5px] font-semibold inline-flex items-center text-muted-foreground active:scale-95 transition active:text-destructive"
          aria-label={`Apagar: ${t.texto}`}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}
