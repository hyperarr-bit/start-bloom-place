/**
 * TAREFAS DE HOJE COM HORÁRIO E DETALHES (28/09) — as peças de tela. O modelo
 * e a conta do aviso moram em lib/tarefas; aqui é só o que a pessoa vê e toca,
 * usado igual na Home (widget "Tarefas de hoje") e nos módulos (Rotina e
 * Carreira, BlocoDeFases).
 *
 * Cara de PLANNER (o dono recusou mockup genérico, 26/09): faixa na cor do dia,
 * tabela com grade fina (HORA | TAREFA | FEITO, como a semana do Treino),
 * quadradinho de marcar, hora em azul à esquerda e 🔔 + antecedência embaixo
 * (a linha do compromisso), detalhes em linhas pautadas.
 *
 * Tocar no TEXTO abre a ficha; só o quadradinho marca. Antes, tocar no texto
 * marcava a tarefa — com detalhes pra ler, o toque no texto tem que abrir.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlarmClock, Bell, BellOff, Check, ChevronRight, NotebookText, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { armarAvisos } from "@/lib/armar-avisos";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { cn, localDayKey } from "@/lib/utils";
import { rotuloAviso } from "@/lib/compromissos";
import { FicouDeOntem } from "./ficou-de-ontem";
import {
  apagarTarefas, concluirNoDiaOriginal, restaurarTarefas, tarefasDosItens, trazerParaHoje, type ItemFicou,
} from "@/lib/ficou-de-ontem";
import {
  AVISO_PADRAO_TAREFA, AVISOS_TAREFA, avisoDaTarefa, avisoJaPassou, detalhesDaTarefa, horaDaTarefa, horaDoAviso,
  normalizarHora, ordenarPorHora, resumoDosDetalhes, textoDoAviso, type TarefaDoDia,
} from "@/lib/tarefas";
import { COR_DO_DIA, DIAS_DA_SEMANA, Pautado, Quadradinho, textoDoDia } from "@/components/treino/planner";

/* ------------------------------------------------------------ utilidades */

/** "SEGUNDA" de hoje (índice 0 = segunda, como o resto do app). */
export const nomeDoDiaDeHoje = (d: Date = new Date()) => DIAS_DA_SEMANA[(d.getDay() + 6) % 7];
/** "28/09" */
export const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** O pedaço do tom que a tabela usa (o TomDoDia do Treino serve; a Rotina passa o azul-céu dela). */
export type TomDaTabela = { claro: string; linha: string; titulo: string };

const ROTULO = "text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground";
const PAUTA = { backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 27px, hsl(var(--border)) 27px 28px)" };
const COLUNAS = "grid grid-cols-[3.4rem_minmax(0,1fr)_3rem]";

/* ------------------------------------------------------- estado da lista */

type CamposNovos = Pick<TarefaDoDia, "texto" | "hora" | "aviso" | "detalhes">;

/** Monta a tarefa só com o que existe — campo vazio não vira chave (tarefa sem hora fica igual às antigas). */
const comCampos = <T extends { id: string; feito: boolean; dia: string }>(base: T, c: CamposNovos): TarefaDoDia => {
  const { hora: _h, aviso: _a, detalhes: _d, texto: _t, ...resto } = base as T & Partial<TarefaDoDia>;
  const hora = normalizarHora(c.hora);
  const detalhes = (c.detalhes ?? "").trim();
  return {
    ...(resto as { id: string; feito: boolean; dia: string }),
    texto: c.texto.trim(),
    ...(hora ? { hora, aviso: Number.isInteger(c.aviso) ? (c.aviso as number) : AVISO_PADRAO_TAREFA } : {}),
    ...(detalhes ? { detalhes } : {}),
  };
};

/**
 * Uma lista de "tarefas de hoje" (rotina-day-tasks ou career-day-tasks) com as
 * operações que a tela precisa. Criar/editar tarefa COM aviso arma o
 * agendamento na hora (e pede a permissão no primeiro, como os compromissos);
 * marcar, desmarcar e apagar só mudam o dado — o useLembretes vê a assinatura
 * mudar e refaz a série, que é o que cancela o aviso pendente da tarefa feita.
 */
export function useTarefasDoDia(chave: string) {
  const { get } = useUserData();
  const [lista, setLista] = usePersistedState<TarefaDoDia[]>(chave, []);
  const atual = Array.isArray(lista) ? lista : [];

  const armar = (nova: TarefaDoDia[], t: TarefaDoDia) => {
    if (avisoDaTarefa(t) < 0) return;
    void armarAvisos(get, { [chave]: nova }, true, { nome: "tarefa_permissao", total: nova.length });
  };

  // Forma funcional: o setter do usePersistedState calcula o próximo na hora, a
  // partir do último valor gravado — duas escritas seguidas não se atropelam, e
  // a lista nova já sai pronta pro reagendamento.
  const adicionar = (c: CamposNovos): TarefaDoDia => {
    const t = comCampos({ id: crypto.randomUUID(), feito: false, dia: localDayKey() }, c);
    let nova: TarefaDoDia[] = [];
    setLista((prev) => (nova = [...(Array.isArray(prev) ? prev : []), t]));
    armar(nova, t);
    trackEvent("tarefa_criada", { lista: chave, hora: !!t.hora, aviso: avisoDaTarefa(t), detalhes: !!t.detalhes });
    return t;
  };

  const salvar = (id: string, c: CamposNovos) => {
    let t: TarefaDoDia | null = null;
    let nova: TarefaDoDia[] = [];
    setLista((prev) => (nova = (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? (t = comCampos(x, c)) : x))));
    if (!t) return;
    armar(nova, t);
    trackEvent("tarefa_editada", { lista: chave, hora: !!(t as TarefaDoDia).hora, aviso: avisoDaTarefa(t), detalhes: !!(t as TarefaDoDia).detalhes });
  };

  const alternar = (id: string) => setLista((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? { ...x, feito: !x.feito } : x)));
  const apagar = (id: string) => setLista((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id));

  /*
   * "FICOU DE ONTEM" (02/10): as três saídas do bloco e o desfazer. Cada uma devolve
   * o retrato das tarefas ANTES do gesto (pro Desfazer devolver só elas). Trazer
   * pra hoje reagenda o aviso se ele já estava armado no aparelho (sem pedir
   * permissão: quem decide isso é quem cria a tarefa com horário).
   */
  const rearmar = (nova: TarefaDoDia[]) => {
    if (nova.some((t) => t.dia >= localDayKey() && avisoDaTarefa(t) >= 0)) void armarAvisos(get, { [chave]: nova }, false, { nome: "tarefa_permissao", total: nova.length });
  };
  const aplicar = (muda: (prev: unknown) => TarefaDoDia[], itens: ItemFicou[]): TarefaDoDia[] => {
    const antes = tarefasDosItens(atual, itens);
    let nova: TarefaDoDia[] = [];
    setLista((prev) => (nova = muda(prev)));
    rearmar(nova);
    return antes;
  };
  const trazer = (itens: ItemFicou[]) => aplicar((prev) => trazerParaHoje(prev, itens, localDayKey()), itens);
  const concluirAntigas = (itens: ItemFicou[]) => aplicar((prev) => concluirNoDiaOriginal(prev, itens), itens);
  const apagarAntigas = (itens: ItemFicou[]) => aplicar((prev) => apagarTarefas(prev, itens), itens);
  const restaurar = (originais: TarefaDoDia[]) => {
    let nova: TarefaDoDia[] = [];
    setLista((prev) => (nova = restaurarTarefas(prev, originais)));
    rearmar(nova);
  };

  return { chave, lista: atual, adicionar, salvar, alternar, apagar, trazer, concluirAntigas, apagarAntigas, restaurar };
}

/* ------------------------------------------------------------ a tabela */

export function CabecalhoDaTabela({ tom }: { tom: TomDaTabela }) {
  return (
    <div className={cn(COLUNAS, "border-b text-[10px] font-extrabold tracking-[.12em]", tom.claro, tom.titulo, tom.linha)} aria-hidden="true">
      <span className={cn("px-2.5 py-1.5 border-r", tom.linha)}>HORA</span>
      <span className="px-3 py-1.5">TAREFA</span>
      <span className={cn("py-1.5 text-center border-l", tom.linha)}>FEITO</span>
    </div>
  );
}

/** Uma linha da lista: o que a tabela precisa saber, venha a tarefa de onde vier. */
export interface LinhaVisivel {
  key: string;
  texto: string;
  feito: boolean;
  /** "HH:MM" normalizada (horaDaTarefa) — ausente = tarefa sem horário */
  hora?: string;
  /** antecedência valendo; -1 = sem aviso */
  aviso?: number;
  detalhes?: string;
  /** "Rotina", "Carreira", "Casa" — de onde a tarefa vem (só na Home, que junta tudo) */
  origem?: string;
  /** "urgência", "atrasada", "vez de Bia"… */
  detalhe?: string;
  /** sem ele a linha é só leitura (rotação da Casa muda de dono, não "fica feita") */
  onAlternar?: () => void;
  onAbrir: () => void;
}

export function LinhaDeTarefa({ l, tom, primeira }: { l: LinhaVisivel; tom: TomDaTabela; primeira?: boolean }) {
  const aviso = l.hora ? l.aviso ?? -1 : -1;
  const meta = [l.origem, l.detalhe].filter(Boolean).join(" · ");
  return (
    <div className={cn(COLUNAS, "min-h-[52px]", !primeira && cn("border-t", tom.linha))} data-testid="linha-tarefa">
      <div
        className={cn(
          "border-r px-2.5 pt-[15px] text-[13px] font-bold tabular-nums leading-none",
          tom.linha,
          l.feito ? "text-muted-foreground line-through" : "text-sky-700 dark:text-sky-300",
        )}
      >
        {l.hora ?? ""}
      </div>
      <button type="button" onClick={l.onAbrir} className="min-w-0 text-left px-3 py-2 active:bg-muted/40 transition-colors" aria-label={`Abrir ${l.texto}`}>
        <span className={cn("block text-[14px] leading-snug truncate", l.feito ? "line-through text-muted-foreground font-medium" : "font-semibold")}>{l.texto}</span>
        {(meta || (aviso >= 0 && !l.feito)) && (
          <span className="mt-0.5 flex items-center gap-x-1.5 text-[11.5px] text-muted-foreground min-w-0">
            {aviso >= 0 && !l.feito && (
              <span className="inline-flex items-center gap-0.5 shrink-0 text-sky-700 dark:text-sky-300" data-testid="aviso-da-linha">
                <Bell className="w-3 h-3" aria-hidden="true" /> {rotuloAviso(aviso)}
              </span>
            )}
            {aviso >= 0 && !l.feito && meta && <span aria-hidden="true">·</span>}
            {meta && <span className="truncate">{meta}</span>}
          </span>
        )}
        {l.detalhes && !l.feito && (
          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground min-w-0" data-testid="detalhes-da-linha">
            <NotebookText className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate italic">{resumoDosDetalhes(l.detalhes, 70)}</span>
          </span>
        )}
      </button>
      <div className={cn("border-l grid place-items-center", tom.linha)}>
        {l.onAlternar ? (
          <Quadradinho comoCaixa marcado={l.feito} onClick={l.onAlternar} rotulo={`Concluir ${l.texto}`} />
        ) : (
          <button type="button" onClick={l.onAbrir} aria-label={`Abrir ${l.texto}`} className="w-10 h-10 grid place-items-center text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- faixa das folhas */

export function FaixaDaFolha({ titulo, sub, onFechar, dia = nomeDoDiaDeHoje() }: { titulo: ReactNode; sub: ReactNode; onFechar: () => void; dia?: string }) {
  return (
    <div className={cn(COR_DO_DIA[dia], textoDoDia(dia), "pl-4 pr-2 py-3 flex items-start gap-2")}>
      <div className="min-w-0 flex-1">
        <SheetTitle className="text-[15px] font-extrabold tracking-wide text-current leading-tight">{titulo}</SheetTitle>
        <SheetDescription className="text-[12.5px] text-current opacity-90 mt-0.5">{sub}</SheetDescription>
      </div>
      <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mt-1 shrink-0 grid place-items-center rounded-full hover:bg-white/15">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Folha de baixo do app (a do Conquistas). Sem o X padrão (`semFechar`): o X mora na faixa do dia. */
export const FOLHA = "rounded-t-3xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col";

/* ------------------------------------------------------------ formulário */

export function FormTarefa({
  inicial,
  rotuloSalvar = "Salvar tarefa",
  onSalvar,
}: {
  inicial?: Partial<CamposNovos>;
  rotuloSalvar?: string;
  onSalvar: (c: CamposNovos) => void;
}) {
  const [texto, setTexto] = useState(inicial?.texto ?? "");
  const [hora, setHora] = useState(normalizarHora(inicial?.hora) ?? "");
  const [aviso, setAviso] = useState<number>(Number.isInteger(inicial?.aviso) ? (inicial?.aviso as number) : AVISO_PADRAO_TAREFA);
  const [detalhes, setDetalhes] = useState(inicial?.detalhes ?? "");

  const hoje = localDayKey();
  const passou = !!hora && avisoJaPassou(hoje, hora, aviso);
  const dica = !hora
    ? "Sem horário, ela fica na lista do dia, sem aviso."
    : aviso < 0
      ? "Sem aviso: o horário fica só anotado."
      : passou
        ? "Esse horário já passou hoje. A tarefa fica anotada, sem aviso."
        : `O aviso toca às ${horaDoAviso(hora, aviso)}.`;

  const salvar = () => {
    if (!texto.trim()) { toast.error("Escreve o que precisa fazer"); return; }
    onSalvar({ texto, hora: hora || undefined, aviso: hora ? aviso : undefined, detalhes });
  };

  return (
    <div className="px-4 pt-4 space-y-3.5" data-testid="form-tarefa">
      <label className="block">
        <span className={ROTULO}>O QUE PRECISA FAZER</span>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          placeholder="Ex.: Ligar pro fornecedor"
          aria-label="O que precisa fazer"
          className="mt-1 h-11 text-[15px]"
          autoFocus={!inicial?.texto}
        />
      </label>

      <div>
        <div className="grid grid-cols-2 rounded-xl border border-border overflow-hidden">
          <label className="block px-3 pt-2 pb-1.5 border-r border-border">
            <span className={cn(ROTULO, "inline-flex items-center gap-1")}><AlarmClock className="w-3 h-3" aria-hidden="true" /> HORÁRIO</span>
            <span className="flex items-center gap-1">
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                aria-label="Horário da tarefa"
                className={cn("h-9 min-w-0 flex-1 bg-transparent outline-none text-[17px] font-bold tabular-nums", hora ? "text-sky-700 dark:text-sky-300" : "text-muted-foreground")}
              />
              {hora && (
                <button type="button" onClick={() => setHora("")} aria-label="Tirar o horário" className="w-7 h-7 shrink-0 grid place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          </label>
          <label className="block px-3 pt-2 pb-1.5">
            <span className={cn(ROTULO, "inline-flex items-center gap-1")}>
              {hora && aviso < 0 ? <BellOff className="w-3 h-3" aria-hidden="true" /> : <Bell className="w-3 h-3" aria-hidden="true" />} AVISAR
            </span>
            {hora ? (
              <select
                value={aviso}
                onChange={(e) => setAviso(Number(e.target.value))}
                aria-label="Quando avisar"
                className="h-9 w-full bg-transparent outline-none text-[14px] font-semibold"
              >
                {AVISOS_TAREFA.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
              </select>
            ) : (
              <span className="h-9 flex items-center text-[13px] text-muted-foreground">escolha o horário</span>
            )}
          </label>
        </div>
        <p className={cn("mt-1.5 text-[11.5px]", passou ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} data-testid="dica-do-aviso">{dica}</p>
        {/* 28/09 (dono): no site o aviso não toca — dizer antes, pra ninguém confiar num alarme que não vem */}
        {hora && aviso >= 0 && !passou && !isNativeShell() && (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground" data-testid="aviso-so-no-app">No site o aviso não toca — ele toca no app do celular.</p>
        )}
      </div>

      <div>
        <span className={cn(ROTULO, "inline-flex items-center gap-1")}><NotebookText className="w-3 h-3" aria-hidden="true" /> DETALHES</span>
        <Pautado
          value={detalhes}
          onChange={(e) => setDetalhes(e.target.value)}
          rows={4}
          placeholder="Passo a passo, telefone, endereço, o que levar…"
          aria-label="Detalhes da tarefa"
          className="mt-0.5 min-h-[112px]"
        />
      </div>

      <Button onClick={salvar} className="w-full h-11 text-[14px] font-bold">{rotuloSalvar}</Button>
    </div>
  );
}

/* ------------------------------------------------------- nova tarefa */

export function FolhaNovaTarefa({
  aberta,
  onFechar,
  textoInicial,
  onSalvar,
  onde = "Rotina",
}: {
  aberta: boolean;
  onFechar: () => void;
  textoInicial?: string;
  onSalvar: (c: CamposNovos) => void;
  /** onde a tarefa vai morar (aparece na faixa) */
  onde?: string;
}) {
  const hoje = localDayKey();
  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} data-testid="folha-nova-tarefa">
        <FaixaDaFolha titulo={`${nomeDoDiaDeHoje()} · NOVA TAREFA`} sub={`Tarefa de hoje, ${diaCurto(hoje)} · ${onde}`} onFechar={onFechar} />
        <div className="overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* o conteúdo da folha só existe aberta (o Radix desmonta ao fechar): cada abertura é um formulário novo */}
          <FormTarefa inicial={{ texto: textoInicial }} onSalvar={(c) => { onSalvar(c); onFechar(); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------- a ficha */

export interface FichaAberta {
  texto: string;
  feito: boolean;
  /** de onde vem, pra faixa: "Rotina", "Carreira · trabalho", "Rotina · urgência" */
  onde: string;
  /** tarefa de hoje (Rotina/Carreira): tem hora, aviso, detalhes, editar e apagar */
  tarefa?: TarefaDoDia;
  onAlternar?: () => void;
  onSalvar?: (c: CamposNovos) => void;
  onApagar?: () => void;
  /** item que não é tarefa do dia (urgência, Foco, limpeza): só marcar e abrir o módulo */
  abrirModulo?: { rotulo: string; ir: () => void };
}

export function FichaDaTarefa({ ficha: fichaAtual, onFechar }: { ficha: FichaAberta | null; onFechar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [apagando, setApagando] = useState(false);
  // Ao fechar, a folha ainda desliza pra baixo: segue mostrando a última ficha em vez de descer vazia
  const ultima = useRef<FichaAberta | null>(fichaAtual);
  if (fichaAtual) ultima.current = fichaAtual;
  const ficha = fichaAtual ?? ultima.current;
  const aberta = !!fichaAtual;
  const chave = ficha?.tarefa?.id ?? ficha?.texto ?? "";
  // outra tarefa, ou a mesma reaberta: começa sempre na leitura, sem "Apagar?" armado
  useEffect(() => { setEditando(false); setApagando(false); }, [chave, aberta]);

  const t = ficha?.tarefa;
  const hora = horaDaTarefa(t);
  const aviso = avisoDaTarefa(t);
  const detalhes = detalhesDaTarefa(t);
  const hoje = localDayKey();
  const passou = !!hora && !ficha?.feito && avisoJaPassou(t?.dia ?? hoje, hora, Math.max(0, aviso));

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} data-testid="ficha-tarefa">
        {ficha && (
          <>
            <FaixaDaFolha
              titulo={`${nomeDoDiaDeHoje()} · ${diaCurto(t?.dia ?? hoje)}`}
              sub={editando ? "Editando a tarefa" : `Tarefa de hoje · ${ficha.onde}`}
              onFechar={onFechar}
            />
            <div className="overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {editando && ficha.onSalvar ? (
                <FormTarefa
                  inicial={{ texto: t?.texto ?? ficha.texto, hora: hora ?? undefined, aviso: t && Number.isInteger(t.aviso) ? t.aviso : undefined, detalhes }}
                  rotuloSalvar="Salvar alterações"
                  onSalvar={(c) => { ficha.onSalvar?.(c); setEditando(false); }}
                />
              ) : (
                <div className="px-4 pt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    {hora && (
                      <span className={cn("text-[24px] font-extrabold tabular-nums leading-none pt-0.5", ficha.feito ? "text-muted-foreground line-through" : "text-sky-700 dark:text-sky-300")} data-testid="ficha-hora">
                        {hora}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[18px] font-bold leading-snug break-words", ficha.feito && "line-through text-muted-foreground")}>{ficha.texto}</p>
                      {hora && (
                        <p className={cn("mt-1 text-[12.5px] inline-flex items-center gap-1", passou ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")} data-testid="ficha-aviso">
                          {aviso < 0 ? <BellOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Bell className="w-3.5 h-3.5" aria-hidden="true" />}
                          {ficha.feito ? "Feita — o aviso não vem mais" : passou ? "O horário já passou" : textoDoAviso(hora, aviso)}
                        </p>
                      )}
                      {ficha.feito && !hora && <p className="mt-1 text-[12.5px] text-muted-foreground">Feita ✓</p>}
                    </div>
                  </div>

                  {t && (
                    <div>
                      <span className={cn(ROTULO, "inline-flex items-center gap-1")}><NotebookText className="w-3 h-3" aria-hidden="true" /> DETALHES</span>
                      {detalhes ? (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-[28px] text-foreground/90" style={PAUTA} data-testid="ficha-detalhes">
                          {detalhes}
                        </p>
                      ) : (
                        <button type="button" onClick={() => setEditando(true)} className="mt-0.5 block w-full text-left text-[13.5px] leading-[28px] min-h-[84px] text-muted-foreground" style={PAUTA}>
                          Toque pra escrever o passo a passo, um telefone, o que levar…
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {ficha.onAlternar && (
                      <Button
                        onClick={() => { ficha.onAlternar?.(); onFechar(); }}
                        variant={ficha.feito ? "outline" : "default"}
                        className="flex-1 h-11 text-[14px] font-bold"
                        data-testid="ficha-marcar"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> {ficha.feito ? "Desmarcar" : "Marcar como feita"}
                      </Button>
                    )}
                    {ficha.onSalvar && (
                      <Button variant="outline" onClick={() => setEditando(true)} className="h-11 px-3.5" aria-label="Editar tarefa">
                        <Pencil className="w-4 h-4 mr-1.5" /> Editar
                      </Button>
                    )}
                    {ficha.onApagar && (apagando ? (
                      <Button variant="outline" onClick={() => { ficha.onApagar?.(); onFechar(); }} className="h-11 px-3 text-destructive border-destructive/40 font-bold">
                        Apagar?
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setApagando(true)} className="h-11 w-11 p-0 text-muted-foreground" aria-label="Apagar tarefa">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ))}
                  </div>
                  {ficha.abrirModulo && (
                    <button type="button" onClick={() => { ficha.abrirModulo?.ir(); onFechar(); }} className="w-full h-10 inline-flex items-center justify-center gap-1 text-[13px] font-semibold text-muted-foreground">
                      {ficha.abrirModulo.rotulo} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* --------------------------------------------------- linha de adicionar */

/** "＋ Nova tarefa   ⏰ horário e detalhes" — o pé da tabela, abre a folha. */
export function LinhaNovaTarefa({ onAbrir, linha }: { onAbrir: () => void; linha: string }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn("w-full flex items-center gap-2 px-3 h-12 border-t text-[13.5px] font-semibold text-muted-foreground active:bg-muted/40 transition-colors", linha)}
      data-testid="nova-tarefa"
    >
      <Plus className="w-4 h-4" aria-hidden="true" /> Nova tarefa
      <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium">
        <AlarmClock className="w-3.5 h-3.5" aria-hidden="true" /> horário e detalhes
      </span>
    </button>
  );
}

/* ------------------------------------------------- a lista inteira do dia */

/** A tabela das tarefas no azul-céu (o cabeçalho do card já era sky). */
export const TOM_CEU: TomDaTabela = { claro: "bg-sky-50", linha: "border-sky-100", titulo: "text-sky-900" };

/**
 * "TAREFAS DE HOJE" dos módulos: a tabela, o campo rápido (+), o ⏰ que abre a
 * folha com horário/aviso/detalhes e a ficha. Recebe a lista pronta porque o
 * BlocoDeFases também usa as mesmas tarefas nos fechamentos da semana e do mês
 * (dois hooks na mesma chave não se enxergam na hora).
 */
export function ListaTarefasDeHoje({ tarefas, placeholder = "Nova tarefa...", onde }: {
  tarefas: ReturnType<typeof useTarefasDoDia>;
  placeholder?: string;
  onde: string;
}) {
  const [novaTarefa, setNovaTarefa] = useState("");
  const [criando, setCriando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const hoje = localDayKey();
  const tarefasHoje = tarefas.lista.filter((t) => t.dia === hoje);
  const feitasHoje = tarefasHoje.filter((t) => t.feito).length;
  const addTarefa = () => {
    if (!novaTarefa.trim()) return;
    tarefas.adicionar({ texto: novaTarefa });
    setNovaTarefa("");
  };
  const tarefaAberta = aberta ? tarefasHoje.find((t) => t.id === aberta) : undefined;
  const ficha: FichaAberta | null = tarefaAberta ? {
    texto: tarefaAberta.texto, feito: !!tarefaAberta.feito, onde, tarefa: tarefaAberta,
    onAlternar: () => tarefas.alternar(tarefaAberta.id),
    onSalvar: (c) => tarefas.salvar(tarefaAberta.id, c),
    onApagar: () => tarefas.apagar(tarefaAberta.id),
  } : null;

  return (
    <>
      {/* 02/10: o que ficou sem fazer nos últimos 7 dias, no topo — a pessoa decide (trazer, concluir, apagar) */}
      <FicouDeOntem fontes={[{ chave: tarefas.chave, tarefas }]} />
      {/* Tarefas de hoje — tabela de planner (28/09): HORA | TAREFA | FEITO, as com
          horário primeiro. Tocar no texto abre a ficha (detalhes, editar, apagar);
          o ⏰ ao lado do + abre a folha com horário, aviso e detalhes. */}
      <div className="rounded-xl border border-border overflow-hidden" data-testid="tarefas-de-hoje">
        <div className="bg-sky-200 dark:bg-sky-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">✅ TAREFAS DE HOJE</span>
          <span className="text-[9px] text-muted-foreground">{feitasHoje}/{tarefasHoje.length}</span>
        </div>
        <div className="bg-card">
          {tarefasHoje.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma tarefa hoje ainda.</p>
          ) : (
            <>
              <CabecalhoDaTabela tom={TOM_CEU} />
              {[false, true].flatMap((feita) => ordenarPorHora(tarefasHoje.filter((t) => !!t.feito === feita).map((t) => ({ ...t, hora: horaDaTarefa(t) ?? undefined }))))
                .map((t, i) => (
                  <LinhaDeTarefa
                    key={t.id}
                    tom={TOM_CEU}
                    primeira={i === 0}
                    l={{
                      key: t.id, texto: t.texto, feito: !!t.feito, hora: t.hora, aviso: avisoDaTarefa(t), detalhes: detalhesDaTarefa(t),
                      detalhe: t.veioDe ? `veio de ${diaCurto(t.veioDe)}` : undefined,
                      onAlternar: () => tarefas.alternar(t.id), onAbrir: () => setAberta(t.id),
                    }}
                  />
                ))}
            </>
          )}
          <div className="flex gap-2 p-2.5 border-t border-sky-100 bg-sky-50">
            <Input placeholder={placeholder} value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTarefa()} className="h-9 text-xs" />
            <Button size="sm" variant="outline" className="h-9 px-2.5 bg-card" onClick={() => setCriando(true)} aria-label="Tarefa com horário ou detalhes">
              <AlarmClock className="w-4 h-4" />
            </Button>
            <Button size="sm" className="h-9" onClick={addTarefa} aria-label="Adicionar tarefa"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
      <FolhaNovaTarefa
        aberta={criando}
        onFechar={() => setCriando(false)}
        textoInicial={novaTarefa}
        onde={onde}
        onSalvar={(c) => { tarefas.adicionar(c); setNovaTarefa(""); }}
      />
      <FichaDaTarefa ficha={ficha} onFechar={() => setAberta(null)} />
    </>
  );
}

/** A lista sozinha, dona das próprias tarefas — a Rotina de quem não usa o bloco de fases (28/09). */
export function TarefasDeHoje({ chave, placeholder, onde }: { chave: string; placeholder?: string; onde: string }) {
  const tarefas = useTarefasDoDia(chave);
  return <ListaTarefasDeHoje tarefas={tarefas} placeholder={placeholder} onde={onde} />;
}
