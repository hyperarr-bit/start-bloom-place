import { useMemo, useState } from "react";
import { CalendarHeart, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn, localDayKey } from "@/lib/utils";
import { feriadosDoMes, textoDoFeriado, type Feriado } from "@/lib/feriados";
import { useMostrarFeriados } from "@/hooks/use-feriados";
import {
  CHAVE_TAREFAS_CARREIRA, CHAVE_TAREFAS_ROTINA, avisoDaTarefa, detalhesDaTarefa, ehPrioridade, estadoDoPrazo, horaDaTarefa,
  posicaoNoDia, progressoDasSubtarefas, tarefasDoDiaMarcado, tarefasValidas, type TarefaDoDia,
} from "@/lib/tarefas";
import {
  CabecalhoDaTabela, FichaDaTarefa, FolhaNovaTarefa, LinhaDeTarefa, TOM_CEU, useTarefasDoDia, type FichaAberta,
} from "@/components/tarefas/tarefas-do-dia";

/**
 * Rotina › Meu mês (28/10): o que o calendário ganhou —
 *  · FERIADOS NACIONAIS (chamados 14/10 e 27/10): marca no dia + "Feriado: …" no dia aberto;
 *    interruptor "Mostrar feriados" sob o calendário (padrão ligado).
 *  · TAREFA PRA OUTRO DIA (chamado 18/10): o dia com tarefa pendente (de hoje em diante) ganha
 *    um ponto; o dia aberto lista as tarefas dele (tocar abre a ficha: editar, mudar o dia,
 *    marcar) e tem "+ Tarefa pra esse dia".
 * Fica aqui pra Rotina.tsx só ganhar as marcas no grid.
 */

/** As marcas do mês: feriados (se ligados) e dias com tarefa pendente de hoje em diante. */
export function useMarcasDoMes(ano: number, mes: number) {
  const [mostrar] = useMostrarFeriados();
  const rotina = useTarefasDoDia(CHAVE_TAREFAS_ROTINA);
  const carreira = useTarefasDoDia(CHAVE_TAREFAS_CARREIRA);
  const hoje = localDayKey();
  const feriados = useMemo(() => (mostrar ? feriadosDoMes(ano, mes) : new Map<string, Feriado>()), [mostrar, ano, mes]);
  const diasComTarefa = useMemo(() => {
    const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}-`;
    const s = new Set<string>();
    for (const t of [...tarefasValidas(rotina.lista), ...tarefasValidas(carreira.lista)]) {
      if (!t.feito && t.dia >= hoje && t.dia.startsWith(prefixo)) s.add(t.dia);
    }
    return s;
  }, [rotina.lista, carreira.lista, ano, mes, hoje]);
  return { feriados, diasComTarefa };
}

/** "Mostrar feriados" — o interruptor, sob o calendário. */
export function InterruptorFeriados() {
  const [mostrar, setMostrar] = useMostrarFeriados();
  return (
    <label className="flex items-center gap-2 pt-2 mt-2 border-t border-border/60 text-[12px] text-muted-foreground" data-testid="interruptor-feriados">
      <CalendarHeart className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
      <span className="flex-1">Mostrar feriados nacionais</span>
      <Switch checked={mostrar} onCheckedChange={setMostrar} aria-label="Mostrar feriados" />
    </label>
  );
}

/** O feriado e as tarefas do dia aberto no calendário. */
export function FeriadoETarefasDoDia({ dia, feriado }: { dia: string; feriado?: Feriado }) {
  const rotina = useTarefasDoDia(CHAVE_TAREFAS_ROTINA);
  const carreira = useTarefasDoDia(CHAVE_TAREFAS_CARREIRA);
  const [aberta, setAberta] = useState<{ id: string; lista: "rotina" | "carreira" } | null>(null);
  const [criando, setCriando] = useState(false);
  const hoje = localDayKey();
  const doDia = [
    ...tarefasDoDiaMarcado(rotina.lista, dia).map((t) => ({ t, lista: "rotina" as const })),
    ...tarefasDoDiaMarcado(carreira.lista, dia).map((t) => ({ t, lista: "carreira" as const })),
  ];
  const fonte = aberta?.lista === "carreira" ? carreira : rotina;
  const t: TarefaDoDia | undefined = aberta ? fonte.lista.find((x) => x.id === aberta.id) : undefined;
  const ficha: FichaAberta | null = t ? {
    texto: t.texto, feito: !!t.feito, onde: aberta?.lista === "carreira" ? "Carreira" : "Rotina", tarefa: t,
    onAlternar: () => fonte.alternar(t.id),
    onSalvar: (c) => fonte.salvar(t.id, c),
    onApagar: () => fonte.apagar(t.id),
    onAlternarSubtarefa: (subId) => fonte.alternarSubtarefa(t.id, subId),
    onMover: (direcao) => fonte.mover(t.id, direcao),
    posicao: posicaoNoDia(fonte.lista, t.id),
  } : null;

  return (
    <div className="space-y-2" data-testid="dia-aberto-extras">
      {feriado && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-rose-700 dark:text-rose-300" data-testid="feriado-do-dia">
          <CalendarHeart className="w-4 h-4 shrink-0" aria-hidden="true" /> {textoDoFeriado(feriado)}
        </p>
      )}
      {doDia.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden bg-card" data-testid="tarefas-do-dia-aberto">
          <CabecalhoDaTabela tom={TOM_CEU} />
          {doDia.map(({ t: x, lista }, i) => (
            <LinhaDeTarefa
              key={`${lista}-${x.id}`}
              tom={TOM_CEU}
              primeira={i === 0}
              l={{
                key: x.id, texto: x.texto, feito: !!x.feito, hora: horaDaTarefa(x) ?? undefined, aviso: avisoDaTarefa(x), detalhes: detalhesDaTarefa(x),
                detalhe: lista === "carreira" ? "carreira" : undefined,
                prioridade: ehPrioridade(x), checklist: progressoDasSubtarefas(x), prazo: estadoDoPrazo(x, hoje),
                onAlternar: () => (lista === "carreira" ? carreira : rotina).alternar(x.id),
                onAbrir: () => setAberta({ id: x.id, lista }),
              }}
            />
          ))}
        </div>
      )}
      {dia >= hoje && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className={cn("inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border bg-card text-[12px] font-bold text-muted-foreground")}
          data-testid="tarefa-pra-esse-dia"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {dia === hoje ? "Tarefa pra hoje" : "Tarefa pra esse dia"}
        </button>
      )}
      <FolhaNovaTarefa aberta={criando} onFechar={() => setCriando(false)} onde="Rotina" diaInicial={dia} onSalvar={(c) => rotina.adicionar(c)} />
      <FichaDaTarefa ficha={ficha} onFechar={() => setAberta(null)} />
    </div>
  );
}
