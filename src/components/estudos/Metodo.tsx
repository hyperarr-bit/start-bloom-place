import { useMemo, useState } from "react";
import { Brain, Check, ChevronDown, ChevronUp, Clock, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { AVISOS, CHAVE_COMPROMISSOS, DIAS_CURTOS, rotuloAviso, type Compromisso } from "@/lib/compromissos";
import { armarAvisosDeCompromissos } from "@/components/rotina/Compromissos";
import { misturarCursos, type Aprendizado, type AprendizadosPorCurso } from "./aprendizados";
import { contarVencendoEm, frenteDoCartao, type Resposta, type Revisoes } from "./revisao";
import {
  CHAVE_INTRO_FECHADA, CHAVE_SESSOES, aprendizadoDeFeynman, blocoParaCompromisso, blocosDeEstudo, cartoesDaSessao,
  comoSessoes, compromissoDeRevisaoDiaria, lembreteDiario, resumoDaSemana, revisaoDeAmanha, type SessaoEstudo,
} from "./metodo-contas";

/**
 * MÉTODO — a aba que costura as cinco ferramentas numa sessão (22/09). Ver
 * metodo.ts pro porquê. Aqui é só tela: o card do método, os blocos de
 * tempo (compromissos da Rotina etiquetados "estudos"), a sessão guiada em
 * quatro passos e o lembrete diário de revisão.
 */

const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const PASSOS = [
  { n: 1, t: "Time Blocking", d: "Defina quando estudar. Hora marcada vira compromisso com aviso — estudar deixa de depender de vontade." },
  { n: 2, t: "Pomodoro", d: "25 minutos de foco, 5 de pausa. Curto o bastante pra começar, longo o bastante pra render." },
  { n: 3, t: "Active Recall", d: "Antes de reler, tente lembrar. Errar tentando fixa mais do que reler acertando." },
  { n: 4, t: "Feynman", d: "Explique com suas palavras, como se fosse pra alguém de 12 anos. Onde travar é o que falta aprender." },
  { n: 5, t: "Repetição espaçada", d: "Revise em intervalos crescentes (1, 3, 7, 14, 30 dias). É o que impede o esquecimento." },
];

interface Props {
  cursos: { id: string; name: string }[];
  mapa: AprendizadosPorCurso;
  revisoes: Revisoes;
  onResponder: (id: string, r: Resposta) => void;
  onRegistrar: (cursoId: string, a: Aprendizado) => void;
  pomodoro: { tempo: number; rodando: boolean; concluidos: number; iniciar: () => void; pausar: () => void; definir: (min: number) => void };
  onIrParaCursos?: () => void;
}

export const Metodo = ({ cursos, mapa, revisoes, onResponder, onRegistrar, pomodoro, onIrParaCursos }: Props) => {
  const { get } = useUserData();
  const [compromissos, setCompromissos] = usePersistedState<Compromisso[]>(CHAVE_COMPROMISSOS, []);
  const [sessoesBrutas, setSessoes] = usePersistedState<SessaoEstudo[]>(CHAVE_SESSOES, []);
  const sessoes = useMemo(() => comoSessoes(sessoesBrutas), [sessoesBrutas]);
  const [introFechada, setIntroFechada] = usePersistedState<boolean>(CHAVE_INTRO_FECHADA, false);
  const hoje = localDayKey();
  const nomes = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c.name])), [cursos]);
  const todosCartoes = useMemo(() => misturarCursos(mapa, nomes), [mapa, nomes]);
  const semana = resumoDaSemana(sessoes);

  const gravarCompromissos = (nova: Compromisso[], pedirPermissao: boolean) => {
    setCompromissos(nova);
    void armarAvisosDeCompromissos(get, nova, pedirPermissao);
  };

  /* ---------------------------------------------------- 1. blocos de tempo */
  const blocos = blocosDeEstudo(compromissos);
  const [formBloco, setFormBloco] = useState(false);
  const [bCurso, setBCurso] = useState(cursos[0]?.id ?? "");
  const [bHora, setBHora] = useState("19:00");
  const [bDias, setBDias] = useState<number[]>([0, 2, 4]);
  const [bAviso, setBAviso] = useState(30);
  const cursoAtivo = (id: string) => cursos.find((c) => c.id === id) ?? cursos[0];

  const salvarBloco = () => {
    const c = cursoAtivo(bCurso);
    if (!c) { toast.error("Cadastre um curso em Estudos primeiro"); return; }
    if (!/^\d{1,2}:\d{2}$/.test(bHora)) { toast.error("Escolhe a hora"); return; }
    if (!bDias.length) { toast.error("Marca pelo menos um dia"); return; }
    const novo = blocoParaCompromisso({ cursoId: c.id, cursoNome: c.name, hora: bHora, dias: bDias, aviso: bAviso }, novoId());
    gravarCompromissos([...compromissos, novo], bAviso >= 0);
    trackEvent("estudos_bloco_criado", { dias: bDias.length, aviso: bAviso });
    toast.success(`Estudar ${c.name}: ${bDias.map((d) => DIAS_CURTOS[d]).join(", ")} às ${bHora}`);
    setFormBloco(false);
  };
  const apagarBloco = (id: string) => gravarCompromissos(compromissos.filter((x) => x.id !== id), false);

  /* ------------------------------------------------- lembrete de revisão */
  const lembrete = lembreteDiario(compromissos);
  const [lembreteHora, setLembreteHora] = useState(lembrete?.hora ?? "20:00");
  const ligarLembrete = (ligado: boolean) => {
    const semEle = compromissos.filter((x) => x.id !== lembrete?.id);
    if (!ligado) { gravarCompromissos(semEle, false); return; }
    if (!/^\d{1,2}:\d{2}$/.test(lembreteHora)) { toast.error("Escolhe a hora"); return; }
    gravarCompromissos([...semEle, compromissoDeRevisaoDiaria(lembreteHora, novoId())], true);
    trackEvent("estudos_lembrete_revisao", { hora: lembreteHora });
    toast.success(`Todo dia às ${lembreteHora}: revisão dos flashcards`);
  };

  /* ------------------------------------------------------ sessão guiada */
  const [etapa, setEtapa] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [sCurso, setSCurso] = useState(cursos[0]?.id ?? "");
  const [fila, setFila] = useState<ReturnType<typeof cartoesDaSessao>>([]);
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [pomodorosNoInicio, setPomodorosNoInicio] = useState(0);
  const [tema, setTema] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [travei, setTravei] = useState<boolean | null>(null);
  const [onde, setOnde] = useState("");
  const curso = cursoAtivo(sCurso);

  const comecar = () => {
    if (!curso) { toast.error("Cadastre um curso em Estudos primeiro"); return; }
    setFila(cartoesDaSessao(mapa, curso.id, curso.name, revisoes, hoje));
    setIndice(0); setVirado(false); setFeitos(0); setAcertos(0);
    setPomodorosNoInicio(pomodoro.concluidos);
    setTema(""); setExplicacao(""); setTravei(null); setOnde("");
    setEtapa(1);
    trackEvent("estudos_sessao_inicio", { curso: curso.id });
  };
  const cartao = fila[indice];
  const responderCartao = (r: Resposta) => {
    if (!cartao) return;
    onResponder(cartao.id, r);
    setFeitos((n) => n + 1);
    if (r === "sim") setAcertos((n) => n + 1);
    setVirado(false);
    setIndice((i) => i + 1);
  };
  const pomodorosDaSessao = Math.max(0, pomodoro.concluidos - pomodorosNoInicio);

  const salvarFeynman = () => {
    if (!curso) return;
    if (!tema.trim()) { toast.error("Escreva o que você estudou"); return; }
    if (!explicacao.trim()) { toast.error("Escreva a explicação com suas palavras"); return; }
    if (travei === null) { toast.error("Conseguiu explicar ou travou?"); return; }
    onRegistrar(curso.id, aprendizadoDeFeynman(tema, explicacao, travei, onde, novoId(), hoje));
    if (travei) {
      const horaRevisao = blocos.find((b) => b.ref === curso.id)?.hora ?? "19:00";
      gravarCompromissos([...compromissos, revisaoDeAmanha(curso.name, tema, horaRevisao, novoId())], true);
    }
    trackEvent("estudos_feynman", { travei });
    setEtapa(4);
  };

  const terminar = () => {
    if (!curso) return;
    const sessao: SessaoEstudo = {
      id: novoId(), data: hoje, cursoId: curso.id, cursoNome: curso.name,
      recall: { feitos, acertos }, pomodoros: pomodorosDaSessao, tema: tema.trim() || undefined, travei: travei === true,
    };
    setSessoes([...sessoes, sessao]);
    trackEvent("estudos_sessao_fim", { cartoes: feitos, acertos, pomodoros: pomodorosDaSessao, travei: travei === true });
    toast.success("Sessão registrada");
    setEtapa(0);
  };

  const amanha = localDayKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
  const em3 = localDayKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3));
  const venceAmanha = contarVencendoEm(todosCartoes, revisoes, amanha);
  const venceEm3 = contarVencendoEm(todosCartoes, revisoes, em3);

  const mm = `${Math.floor(pomodoro.tempo / 60).toString().padStart(2, "0")}:${(pomodoro.tempo % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-4" data-testid="metodo">
      {/* ---- o método ---- */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => setIntroFechada(!introFechada)} className="w-full bg-violet-200 dark:bg-violet-800/60 px-4 py-2.5 flex items-center justify-between" aria-expanded={!introFechada}>
          <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Brain className="w-4 h-4" /> Como estudar de verdade</span>
          {introFechada ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {!introFechada && (
          <div className="bg-violet-50/80 dark:bg-violet-950/20 p-4 space-y-2.5" data-testid="metodo-intro">
            <p className="text-xs text-muted-foreground">Se o objetivo é aprender de verdade (não só assistir aula), a combinação que funciona é esta — e a sessão abaixo faz os cinco passos por você.</p>
            {PASSOS.map((p) => (
              <div key={p.n} className="flex gap-2.5">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-[11px] font-bold grid place-items-center shrink-0">{p.n}</span>
                <p className="text-xs leading-snug"><span className="font-bold">{p.t}</span> — {p.d}</p>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Esta semana: <b className="text-foreground">{semana.sessoes}</b> {semana.sessoes === 1 ? "sessão" : "sessões"} · {semana.pomodoros} pomodoros · {semana.cartoes} cartões{semana.cartoes ? ` (${semana.lembrados} lembrados)` : ""}</p>
          </div>
        )}
      </div>

      {cursos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">O método precisa de um curso ou matéria pra começar.</p>
          {onIrParaCursos && <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={onIrParaCursos}>Cadastrar em Estudos</Button>}
        </div>
      )}

      {/* ---- 1. blocos de tempo ---- */}
      <div className="rounded-xl border border-border overflow-hidden" data-testid="blocos">
        <div className="bg-sky-200 dark:bg-sky-800/60 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4" /> 1 · Quando estudar</span>
          {!formBloco && cursos.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setBCurso(cursos[0]?.id ?? ""); setFormBloco(true); }} data-testid="novo-bloco"><Plus className="w-3 h-3 mr-1" /> Bloco</Button>
          )}
        </div>
        <div className="bg-sky-50/80 dark:bg-sky-950/20 p-3 space-y-2">
          {blocos.length === 0 && !formBloco && <p className="text-[11px] text-muted-foreground">Nenhum bloco ainda. Marque dias e hora — vira compromisso com aviso no celular.</p>}
          {blocos.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs rounded-md bg-card border border-border/60 px-2.5 py-2" data-testid="bloco-item">
              <span className="font-bold tabular-nums text-sky-700 dark:text-sky-300">{b.hora}</span>
              <span className="flex-1 min-w-0 truncate">{b.titulo} <span className="text-muted-foreground">· {(b.repete ?? []).map((d) => DIAS_CURTOS[d]).join(", ")} · {rotuloAviso(b.aviso ?? 60)}</span></span>
              <button type="button" onClick={() => apagarBloco(b.id)} aria-label={`Apagar ${b.titulo}`} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {formBloco && (
            <div className="rounded-md border border-border bg-card p-3 space-y-2" data-testid="form-bloco">
              <select value={bCurso} onChange={(e) => setBCurso(e.target.value)} className="h-8 w-full text-xs rounded-md border border-input bg-background px-2" aria-label="Curso do bloco">
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-muted-foreground flex flex-col gap-1">Hora<Input type="time" value={bHora} onChange={(e) => setBHora(e.target.value)} className="h-8 text-xs" aria-label="Hora do bloco" /></label>
                <label className="text-[10px] text-muted-foreground flex flex-col gap-1">Avisar
                  <select value={bAviso} onChange={(e) => setBAviso(Number(e.target.value))} className="h-8 text-[11px] rounded-md border border-input bg-background px-1.5" aria-label="Aviso do bloco">
                    {AVISOS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Dias do bloco">
                {DIAS_CURTOS.map((d, i) => {
                  const on = bDias.includes(i);
                  return <button key={d} type="button" aria-pressed={on} onClick={() => setBDias((p) => (on ? p.filter((x) => x !== i) : [...p, i]))} className={`px-2 h-7 rounded-md text-[11px] font-semibold border ${on ? "bg-sky-600 text-white border-sky-600" : "bg-background text-muted-foreground border-border"}`}>{d}</button>;
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs flex-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={salvarBloco}>Salvar bloco</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setFormBloco(false)} aria-label="Cancelar"><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- sessão guiada (2 → 3 → 4 → 5) ---- */}
      <div className="rounded-xl border border-border overflow-hidden" data-testid="sessao">
        <div className="bg-red-300 dark:bg-red-700/60 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-black uppercase tracking-wider">🍅 Sessão de estudo</span>
          {etapa > 0 && <span className="text-[11px] font-bold">{["", "Recall", "Pomodoro", "Feynman", "Revisões"][etapa]} · {etapa} de 4</span>}
        </div>
        <div className="bg-red-50/80 dark:bg-red-950/20 p-4 space-y-3">
          {etapa === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Recall → Pomodoro → Feynman → revisões agendadas. Uns 30 minutos.</p>
              {cursos.length > 0 && (
                <select value={sCurso} onChange={(e) => setSCurso(e.target.value)} className="h-9 w-full text-xs rounded-md border border-input bg-background px-2" aria-label="Curso da sessão">
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <Button className="w-full bg-red-500 hover:bg-red-600 text-white" onClick={comecar} disabled={cursos.length === 0} data-testid="comecar-sessao">▶ Começar sessão</Button>
            </div>
          )}

          {etapa === 1 && (
            <div className="space-y-3" data-testid="etapa-recall">
              <p className="text-xs text-muted-foreground">Antes de abrir o material: o que você lembra?</p>
              {!cartao ? (
                <div className="space-y-2">
                  <p className="text-xs">{fila.length === 0 ? "Ainda não tem cartões deste curso — registre \"o que aprendi\" no Caderno e a próxima sessão já começa testando." : `Recall feito: ${acertos} de ${feitos} lembrados.`}</p>
                  <Button className="w-full" onClick={() => setEtapa(2)} data-testid="ir-pomodoro">Ir pro Pomodoro</Button>
                </div>
              ) : (() => {
                const { deixa, pergunta } = frenteDoCartao(cartao);
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{deixa} · {indice + 1} de {fila.length}</p>
                    <p className="text-sm font-semibold leading-snug">{pergunta}</p>
                    {!virado ? (
                      <button type="button" onClick={() => setVirado(true)} className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5">Mostrar resposta</button>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-border bg-card px-3 py-2"><p className="text-sm whitespace-pre-wrap">{cartao.aprendi}</p>{cartao.porque && <p className="text-xs text-muted-foreground mt-1">{cartao.porque}</p>}</div>
                        <div className="grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => responderCartao("nao")} className="rounded-lg border border-border bg-card text-sm font-semibold py-2 flex items-center justify-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Não</button>
                          <button type="button" onClick={() => responderCartao("quase")} className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 text-sm font-semibold py-2">Quase</button>
                          <button type="button" onClick={() => responderCartao("sim")} className="rounded-lg bg-green-600 text-white text-sm font-semibold py-2 flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> Lembrei</button>
                        </div>
                      </div>
                    )}
                    <button type="button" onClick={() => setEtapa(2)} className="text-[11px] text-muted-foreground underline underline-offset-2">Pular pro Pomodoro</button>
                  </div>
                );
              })()}
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-3 text-center" data-testid="etapa-pomodoro">
              <div className="w-32 h-32 mx-auto rounded-full border-8 border-red-200 dark:border-red-500/30 flex items-center justify-center">
                <p className="text-2xl font-black font-mono">{mm}</p>
              </div>
              <div className="flex justify-center gap-2">
                {!pomodoro.rodando ? <Button onClick={pomodoro.iniciar} className="bg-red-500 hover:bg-red-600 text-white">▶ Iniciar</Button> : <Button variant="outline" onClick={pomodoro.pausar}>⏸ Pausar</Button>}
                <Button variant="ghost" onClick={() => pomodoro.definir(25)}>🔄 25 min</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Estude {curso?.name}. Acabou o tempo, respira 5 minutos. Pomodoros nesta sessão: <b>{pomodorosDaSessao}</b></p>
              <Button className="w-full" variant="outline" onClick={() => setEtapa(3)} data-testid="ir-feynman">Terminei de estudar → Feynman</Button>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-2" data-testid="etapa-feynman">
              <p className="text-xs text-muted-foreground">Explique o que estudou como se fosse pra alguém de 12 anos. Onde travar é o que ainda falta.</p>
              <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="O que você estudou? (ex.: present perfect)" className="h-9 text-xs" aria-label="Tema" />
              <Textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} placeholder="Com suas palavras…" className="text-xs min-h-[90px]" aria-label="Explicação" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={travei === false} onClick={() => setTravei(false)} className={`rounded-lg border text-sm font-semibold py-2 ${travei === false ? "bg-green-600 text-white border-green-600" : "bg-card border-border"}`}>Consegui explicar</button>
                <button type="button" aria-pressed={travei === true} onClick={() => setTravei(true)} className={`rounded-lg border text-sm font-semibold py-2 ${travei === true ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border"}`}>Travei em algo</button>
              </div>
              {travei && <Input value={onde} onChange={(e) => setOnde(e.target.value)} placeholder="Onde travou?" className="h-9 text-xs" aria-label="Onde travou" />}
              <p className="text-[10.5px] text-muted-foreground">Vira um cartão de revisão amanhã{travei ? " e um lembrete pra revisar" : ""}.</p>
              <Button className="w-full" onClick={salvarFeynman} data-testid="salvar-feynman">Salvar e ver as revisões</Button>
            </div>
          )}

          {etapa === 4 && (
            <div className="space-y-3" data-testid="etapa-revisoes">
              <p className="text-xs">Recall: <b>{acertos} de {feitos}</b> · Pomodoros: <b>{pomodorosDaSessao}</b> · Feynman: <b>{travei ? "travou (revisão amanhã)" : "explicou"}</b></p>
              <p className="text-xs text-muted-foreground">Repetição espaçada: {venceAmanha ? `amanhã voltam ${venceAmanha} ${venceAmanha === 1 ? "cartão" : "cartões"}` : "amanhã não volta cartão"}{venceEm3 ? `, em 3 dias mais ${venceEm3}` : ""}. Eles aparecem em Caderno → Revisar hoje.</p>
              <div className="rounded-md border border-border bg-card p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!lembrete} onChange={(e) => ligarLembrete(e.target.checked)} className="h-4 w-4" data-testid="lembrete-diario" />
                  Lembrete diário de revisão
                </label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={lembreteHora} onChange={(e) => setLembreteHora(e.target.value)} className="h-8 w-28 text-xs" aria-label="Hora do lembrete de revisão" />
                  {lembrete && lembrete.hora !== lembreteHora && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => ligarLembrete(true)}>Trocar hora</Button>}
                </div>
              </div>
              <Button className="w-full" onClick={terminar} data-testid="terminar-sessao">Concluir sessão</Button>
            </div>
          )}
        </div>
      </div>

      {sessoes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3" data-testid="historico-sessoes">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Últimas sessões</p>
          {[...sessoes].reverse().slice(0, 5).map((s) => (
            <p key={s.id} className="text-xs py-0.5"><span className="text-muted-foreground tabular-nums">{dataCurta(s.data)}</span> · {s.cursoNome}{s.tema ? ` · ${s.tema}` : ""} · {s.recall.acertos}/{s.recall.feitos} lembrados · {s.pomodoros} 🍅{s.travei ? " · travou" : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
};
