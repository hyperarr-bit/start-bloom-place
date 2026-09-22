import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, CalendarClock, Check, ExternalLink, MessageCircleQuestion, MessageSquareText, Play, Plus, Repeat, RotateCcw, Timer, Trash2, X } from "lucide-react";
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
import { misturarCursos, type Aprendizado, type AprendizadoComCurso, type AprendizadosPorCurso } from "./aprendizados";
import { contarVencendoEm, frenteDoCartao, paraRevisarHoje, type Resposta, type Revisoes } from "./revisao";
import { RevisaoDoDia } from "./RevisaoDoDia";
import {
  CHAVE_SESSOES, PERGUNTAS_SOCRATICAS, aprendizadoDeFeynman, blocoParaCompromisso, blocosDeEstudo, cartoesDaSessao, cartoesSocraticos,
  comoSessoes, compromissoDeRevisaoDiaria, intervalosDasRespostas, lembreteDiario, proximoPasso, resumoDaSemana, revisaoDeAmanha, type SessaoEstudo,
} from "./metodo-contas";

/**
 * MÉTODO — as técnicas de estudo que funcionam, cada uma utilizável AQUI (22/09).
 *
 * v1 (manhã de 22/09) era uma lista de texto explicando as 5 técnicas + uma
 * sessão guiada. Um cliente mandou print perguntando "como abre essa parte?"
 * — a lista parecia clicável e não era. v2 (noite, dono: "deixar mais claro,
 * o usuário poder usar mesmo as 6 nessa aba"): cada técnica é um botão que
 * abre a ferramenta ali mesmo, e a sessão guiada fica no topo pra quem quer
 * as técnicas em sequência. A 6ª é o Socrático (pedido de cliente).
 * Contas puras em metodo-contas.ts.
 */

const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diaMais = (n: number) => { const d = new Date(); return localDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };

type IdFerramenta = "blocos" | "pomodoro" | "recall" | "feynman" | "revisao" | "socratico";

/* Classes literais por técnica (o Tailwind só gera o que aparece escrito). */
const FERRAMENTAS: { id: IdFerramenta; nome: string; curto: string; como: string; Icone: typeof Timer; icone: string; status: string; anel: string; barra: string }[] = [
  { id: "blocos", nome: "Time Blocking", curto: "Quando estudar", como: "Marque dias e hora pra estudar. Vira compromisso com aviso no celular — estudar deixa de depender de vontade.",
    Icone: CalendarClock, icone: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300", status: "text-sky-700 dark:text-sky-300", anel: "ring-sky-500", barra: "bg-sky-500" },
  { id: "pomodoro", nome: "Pomodoro", curto: "Foco de 25 minutos", como: "25 minutos de foco total, 5 de pausa. Curto o bastante pra começar, longo o bastante pra render.",
    Icone: Timer, icone: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", status: "text-red-700 dark:text-red-300", anel: "ring-red-500", barra: "bg-red-500" },
  { id: "recall", nome: "Active Recall", curto: "Tente lembrar antes de reler", como: "Antes de abrir o material, responda seus cartões de cabeça. Errar tentando fixa mais do que reler acertando.",
    Icone: Brain, icone: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", status: "text-amber-700 dark:text-amber-300", anel: "ring-amber-500", barra: "bg-amber-500" },
  { id: "feynman", nome: "Feynman", curto: "Explique com suas palavras", como: "Explique o que estudou como se fosse pra alguém de 12 anos. Onde travar é o que ainda falta aprender.",
    Icone: MessageSquareText, icone: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300", status: "text-violet-700 dark:text-violet-300", anel: "ring-violet-500", barra: "bg-violet-500" },
  { id: "revisao", nome: "Repetição espaçada", curto: "Revise pra não esquecer", como: "Cada cartão volta em intervalos crescentes (1, 3, 7, 14, 30 dias). Você revisa só o que está pra esquecer.",
    Icone: Repeat, icone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", status: "text-emerald-700 dark:text-emerald-300", anel: "ring-emerald-500", barra: "bg-emerald-500" },
  { id: "socratico", nome: "Socrático", curto: "Pergunte até entender", como: "Seis perguntas, uma de cada vez, sobre um tema. Responder mostra o que você entendeu de verdade — e o que falta.",
    Icone: MessageCircleQuestion, icone: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300", status: "text-pink-700 dark:text-pink-300", anel: "ring-pink-500", barra: "bg-pink-500" },
];

interface Props {
  cursos: { id: string; name: string }[];
  mapa: AprendizadosPorCurso;
  revisoes: Revisoes;
  onResponder: (id: string, r: Resposta) => void;
  onRegistrar: (cursoId: string, a: Aprendizado) => void;
  pomodoro: { tempo: number; rodando: boolean; concluidos: number; iniciar: () => void; pausar: () => void; definir: (min: number) => void };
  onIrParaCursos?: () => void;
  /** Leva pra outra aba do módulo (ex.: "pomodoro", "caderno"). */
  onIrPara?: (aba: string) => void;
}

/* ─────────────────────────── peças reaproveitadas ─────────────────────────── */

/** Cartões um de cada vez: frente → mostrar → Não / Quase / Lembrei. */
function QuizRecall({ fila, revisoes, onResponder, vazio, fim }: {
  fila: AprendizadoComCurso[];
  revisoes: Revisoes;
  onResponder: (id: string, r: Resposta, acertou: boolean) => void;
  vazio: React.ReactNode;
  fim: (feitos: number, acertos: number) => React.ReactNode;
}) {
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const cartao = fila[indice];
  const responder = (r: Resposta) => {
    if (!cartao) return;
    onResponder(cartao.id, r, r === "sim");
    setFeitos((n) => n + 1);
    if (r === "sim") setAcertos((n) => n + 1);
    setVirado(false);
    setIndice((i) => i + 1);
  };
  // Atalhos do Anki no PC: espaço mostra, 1/2/3 respondem. Nunca dentro de campo de texto.
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => {});
  teclaRef.current = (e: KeyboardEvent) => {
    const alvo = e.target as HTMLElement | null;
    if (!cartao || (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) || alvo?.isContentEditable) return;
    if (!virado && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setVirado(true); return; }
    if (virado && e.key === "1") responder("nao");
    else if (virado && e.key === "2") responder("quase");
    else if (virado && e.key === "3") responder("sim");
  };
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => teclaRef.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);
  if (fila.length === 0) return <>{vazio}</>;
  if (!cartao) return <>{fim(feitos, acertos)}</>;
  const { deixa, pergunta } = frenteDoCartao(cartao);
  const volta = intervalosDasRespostas(revisoes[cartao.id]);
  return (
    <div className="space-y-2.5">
      <div className="h-1 rounded-full bg-muted overflow-hidden" aria-hidden><div className="h-full bg-amber-500 transition-all" style={{ width: `${(indice / fila.length) * 100}%` }} /></div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{deixa}</p>
        <p className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">{indice + 1} de {fila.length}</p>
      </div>
      <p className="text-[15px] font-semibold leading-snug">{pergunta}</p>
      {!virado ? (
        <button type="button" onClick={() => setVirado(true)} className="w-full rounded-xl bg-foreground text-background text-sm font-semibold py-3">Mostrar resposta<span className="hidden md:inline text-[11px] font-normal opacity-60 ml-2">espaço</span></button>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-sm whitespace-pre-wrap">{cartao.aprendi}</p>
            {cartao.porque && <p className="text-xs text-muted-foreground mt-1">{cartao.porque}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => responder("nao")} className="rounded-xl border border-border bg-card py-2 flex flex-col items-center leading-tight"><span className="text-sm font-semibold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Não</span><span className="text-[10.5px] text-muted-foreground">volta {volta.nao}</span></button>
            <button type="button" onClick={() => responder("quase")} className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 py-2 flex flex-col items-center leading-tight"><span className="text-sm font-semibold">Quase</span><span className="text-[10.5px] opacity-75">volta em {volta.quase}</span></button>
            <button type="button" onClick={() => responder("sim")} className="rounded-xl bg-green-600 text-white py-2 flex flex-col items-center leading-tight"><span className="text-sm font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Lembrei</span><span className="text-[10.5px] opacity-85">volta em {volta.sim}</span></button>
          </div>
          <p className="hidden md:block text-[10.5px] text-muted-foreground text-center">Teclado: 1 Não · 2 Quase · 3 Lembrei</p>
        </div>
      )}
    </div>
  );
}

/** Anel do Pomodoro que esvazia com o tempo (como o Forest). */
function AnelPomodoro({ tempo, rodando, tamanho }: { tempo: number; rodando: boolean; tamanho: number }) {
  const total = tempo > 5 * 60 ? Math.max(25 * 60, tempo) : 5 * 60;
  const r = 44, c = 2 * Math.PI * r;
  const fracao = Math.min(1, Math.max(0, tempo / total));
  const mm = `${Math.floor(tempo / 60).toString().padStart(2, "0")}:${(tempo % 60).toString().padStart(2, "0")}`;
  return (
    <div className="relative mx-auto" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" className="stroke-red-100 dark:stroke-red-950" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-red-500 transition-[stroke-dashoffset] duration-1000 ease-linear" strokeDasharray={c} strokeDashoffset={c * (1 - fracao)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-black font-mono tabular-nums">{mm}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rodando ? "foco" : "pausado"}</p>
      </div>
    </div>
  );
}

/** Explicação de Feynman: tema + explicação + "consegui / travei". */
function FormFeynman({ onSalvar, rotuloSalvar, testid }: {
  onSalvar: (tema: string, explicacao: string, travei: boolean, onde: string) => void;
  rotuloSalvar: string;
  testid: string;
}) {
  const [tema, setTema] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [travei, setTravei] = useState<boolean | null>(null);
  const [onde, setOnde] = useState("");
  const salvar = () => {
    if (!tema.trim()) { toast.error("Escreva o que você estudou"); return; }
    if (!explicacao.trim()) { toast.error("Escreva a explicação com suas palavras"); return; }
    if (travei === null) { toast.error("Conseguiu explicar ou travou?"); return; }
    onSalvar(tema, explicacao, travei, onde);
    setTema(""); setExplicacao(""); setTravei(null); setOnde("");
  };
  return (
    <div className="space-y-2">
      <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="O que você estudou? (ex.: present perfect)" className="h-10 text-sm" aria-label="Tema" />
      <Textarea value={explicacao} onChange={(e) => setExplicacao(e.target.value)} placeholder="Explique com suas palavras, simples, como pra alguém de 12 anos…" className="text-sm min-h-[100px]" aria-label="Explicação" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={travei === false} onClick={() => setTravei(false)} className={`rounded-xl border text-sm font-semibold py-2.5 ${travei === false ? "bg-green-600 text-white border-green-600" : "bg-card border-border"}`}>Consegui explicar</button>
        <button type="button" aria-pressed={travei === true} onClick={() => setTravei(true)} className={`rounded-xl border text-sm font-semibold py-2.5 ${travei === true ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border"}`}>Travei em algo</button>
      </div>
      {travei && <Input value={onde} onChange={(e) => setOnde(e.target.value)} placeholder="Onde travou?" className="h-10 text-sm" aria-label="Onde travou" />}
      <p className="text-[11px] text-muted-foreground">Vira um cartão de revisão pra amanhã{travei ? " e um lembrete pra revisar o ponto onde travou" : ""}.</p>
      <Button className="w-full h-11" onClick={salvar} data-testid={testid}>{rotuloSalvar}</Button>
    </div>
  );
}

/* ──────────────────────────────── a aba ──────────────────────────────── */

export const Metodo = ({ cursos, mapa, revisoes, onResponder, onRegistrar, pomodoro, onIrParaCursos, onIrPara }: Props) => {
  const { get } = useUserData();
  const [compromissos, setCompromissos] = usePersistedState<Compromisso[]>(CHAVE_COMPROMISSOS, []);
  const [sessoesBrutas, setSessoes] = usePersistedState<SessaoEstudo[]>(CHAVE_SESSOES, []);
  const sessoes = useMemo(() => comoSessoes(sessoesBrutas), [sessoesBrutas]);
  const hoje = localDayKey();
  const nomes = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c.name])), [cursos]);
  const todosCartoes = useMemo(() => misturarCursos(mapa, nomes), [mapa, nomes]);
  const semana = resumoDaSemana(sessoes);
  const semCurso = cursos.length === 0;

  // um curso escolhido vale pra aba inteira (sessão, recall, Feynman, socrático, bloco novo)
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? "");
  const curso = cursos.find((c) => c.id === cursoId) ?? cursos[0];

  const [aberta, setAberta] = useState<IdFerramenta | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const abrir = (id: IdFerramenta) => {
    const nova = aberta === id ? null : id;
    setAberta(nova);
    if (nova) trackEvent("estudos_metodo_ferramenta", { ferramenta: nova });
  };
  useEffect(() => {
    if (aberta) painelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [aberta]);

  const gravarCompromissos = (nova: Compromisso[], pedirPermissao: boolean) => {
    setCompromissos(nova);
    void armarAvisosDeCompromissos(get, nova, pedirPermissao);
  };

  /* ---------------------------------------------------- blocos de tempo */
  const blocos = blocosDeEstudo(compromissos);
  const [formBloco, setFormBloco] = useState(false);
  const [bHora, setBHora] = useState("19:00");
  const [bDias, setBDias] = useState<number[]>([0, 2, 4]);
  const [bAviso, setBAviso] = useState(30);
  const salvarBloco = () => {
    if (!curso) { toast.error("Cadastre um curso em Estudos primeiro"); return; }
    if (!/^\d{1,2}:\d{2}$/.test(bHora)) { toast.error("Escolhe a hora"); return; }
    if (!bDias.length) { toast.error("Marca pelo menos um dia"); return; }
    const novo = blocoParaCompromisso({ cursoId: curso.id, cursoNome: curso.name, hora: bHora, dias: bDias, aviso: bAviso }, novoId());
    gravarCompromissos([...compromissos, novo], bAviso >= 0);
    trackEvent("estudos_bloco_criado", { dias: bDias.length, aviso: bAviso });
    toast.success(`Estudar ${curso.name}: ${[...bDias].sort((a, b) => a - b).map((d) => DIAS_CURTOS[d]).join(", ")} às ${bHora}`);
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
  const BlocoLembrete = (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input type="checkbox" checked={!!lembrete} onChange={(e) => ligarLembrete(e.target.checked)} className="h-4 w-4" data-testid="lembrete-diario" />
        Lembrete diário de revisão
      </label>
      <div className="flex items-center gap-2">
        <Input type="time" value={lembreteHora} onChange={(e) => setLembreteHora(e.target.value)} className="h-9 w-28 text-sm" aria-label="Hora do lembrete de revisão" />
        {lembrete && lembrete.hora !== lembreteHora && <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => ligarLembrete(true)}>Trocar hora</Button>}
      </div>
    </div>
  );

  /* ------------------------------------------------------ Feynman salvo */
  const registrarFeynman = (tema: string, explicacao: string, travei: boolean, onde: string) => {
    if (!curso) return;
    onRegistrar(curso.id, aprendizadoDeFeynman(tema, explicacao, travei, onde, novoId(), hoje));
    if (travei) {
      const horaRevisao = blocos.find((b) => b.ref === curso.id)?.hora ?? "19:00";
      gravarCompromissos([...compromissos, revisaoDeAmanha(curso.name, tema, horaRevisao, novoId())], true);
    }
    trackEvent("estudos_feynman", { travei });
  };

  /* ------------------------------------------------------ sessão guiada */
  const [etapa, setEtapa] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [filaSessao, setFilaSessao] = useState<AprendizadoComCurso[]>([]);
  const [recallSessao, setRecallSessao] = useState({ feitos: 0, acertos: 0 });
  const [pomodorosNoInicio, setPomodorosNoInicio] = useState(0);
  const [feynmanSessao, setFeynmanSessao] = useState<{ tema: string; travei: boolean } | null>(null);
  const comecar = () => {
    if (!curso) { toast.error("Cadastre um curso em Estudos primeiro"); return; }
    setFilaSessao(cartoesDaSessao(mapa, curso.id, curso.name, revisoes, hoje));
    setRecallSessao({ feitos: 0, acertos: 0 });
    setPomodorosNoInicio(pomodoro.concluidos);
    setFeynmanSessao(null);
    setAberta(null);
    setEtapa(1);
    trackEvent("estudos_sessao_inicio", { curso: curso.id });
  };
  const pomodorosDaSessao = Math.max(0, pomodoro.concluidos - pomodorosNoInicio);
  const terminar = () => {
    if (!curso) return;
    const sessao: SessaoEstudo = {
      id: novoId(), data: hoje, cursoId: curso.id, cursoNome: curso.name,
      recall: recallSessao, pomodoros: pomodorosDaSessao, tema: feynmanSessao?.tema.trim() || undefined, travei: feynmanSessao?.travei === true,
    };
    setSessoes([...sessoes, sessao]);
    trackEvent("estudos_sessao_fim", { cartoes: recallSessao.feitos, acertos: recallSessao.acertos, pomodoros: pomodorosDaSessao, travei: feynmanSessao?.travei === true });
    toast.success("Sessão registrada");
    setEtapa(0);
  };

  /* --------------------------------------------------- recall avulso */
  const [rodadaRecall, setRodadaRecall] = useState(0);
  const filaRecall = useMemo(
    () => (curso ? cartoesDaSessao(mapa, curso.id, curso.name, revisoes, hoje, 10) : []),
    // a fila congela por rodada: responder não deve embaralhar o cartão da vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curso?.id, rodadaRecall],
  );

  /* ------------------------------------------------------- socrático */
  const [socTema, setSocTema] = useState("");
  const [socPasso, setSocPasso] = useState(-1); // -1 = escolhendo o tema; 0..5 = pergunta; 6 = fim
  const [socRespostas, setSocRespostas] = useState<string[]>([]);
  const iniciarSocratico = () => {
    if (!curso) { toast.error("Cadastre um curso em Estudos primeiro"); return; }
    if (!socTema.trim()) { toast.error("Escreva o tema"); return; }
    setSocRespostas([]); setSocPasso(0);
    trackEvent("estudos_socratico_inicio");
  };
  const salvarSocratico = () => {
    if (!curso) return;
    const cartoes = cartoesSocraticos(socTema, socRespostas, novoId(), hoje);
    cartoes.forEach((c) => onRegistrar(curso.id, c));
    trackEvent("estudos_socratico_fim", { respostas: cartoes.length });
    toast.success(cartoes.length ? `${cartoes.length} ${cartoes.length === 1 ? "cartão novo" : "cartões novos"} em ${curso.name}` : "Nada salvo");
    setSocTema(""); setSocRespostas([]); setSocPasso(-1);
  };

  /* ----------------------------------------------------- status dos botões */
  const venceHoje = paraRevisarHoje(todosCartoes, revisoes, hoje).length;
  const venceAmanha = contarVencendoEm(todosCartoes, revisoes, diaMais(1));
  const venceEm3 = contarVencendoEm(todosCartoes, revisoes, diaMais(3));
  const nFeynman = todosCartoes.filter((a) => a.referencia === "Feynman").length;
  const nSocratico = todosCartoes.filter((a) => (a.referencia ?? "").startsWith("Socrático")).length;
  const mm = `${Math.floor(pomodoro.tempo / 60).toString().padStart(2, "0")}:${(pomodoro.tempo % 60).toString().padStart(2, "0")}`;
  const status: Record<IdFerramenta, string> = {
    blocos: blocos.length ? `${blocos.length} ${blocos.length === 1 ? "bloco marcado" : "blocos marcados"}` : "Nenhum horário ainda",
    pomodoro: pomodoro.rodando ? `⏱ ${mm} rodando` : pomodoro.concluidos ? `${pomodoro.concluidos} feitos` : "Pronto pra começar",
    recall: filaRecall.length ? `${filaRecall.length} ${filaRecall.length === 1 ? "cartão" : "cartões"} pra testar` : "Sem cartões ainda",
    feynman: nFeynman ? `${nFeynman} ${nFeynman === 1 ? "explicação" : "explicações"}` : "Nenhuma ainda",
    revisao: venceHoje ? `${venceHoje} pra revisar hoje` : todosCartoes.length ? "Em dia ✓" : "Sem cartões ainda",
    socratico: nSocratico ? `${nSocratico} ${nSocratico === 1 ? "resposta" : "respostas"}` : "Nenhuma ainda",
  };
  const ferramenta = FERRAMENTAS.find((f) => f.id === aberta);
  const passo = proximoPasso({ temCurso: !semCurso, venceHoje, blocos: blocos.length, sessoesHoje: sessoes.filter((x) => x.data === hoje).length });
  const seguirPasso = () => {
    trackEvent("estudos_proximo_passo", { acao: passo.acao });
    if (passo.acao === "cursos") onIrParaCursos?.();
    else if (passo.acao === "sessao") comecar();
    else { setAberta(passo.acao); if (passo.acao === "blocos") setFormBloco(true); }
  };

  const semCartoes = (
    <p className="text-sm text-muted-foreground">
      Ainda não tem cartões de {curso?.name ?? "este curso"}. Registre o que aprendeu (Feynman ou Socrático aqui, ou "Aprendi hoje" no curso) e amanhã já tem o que testar.
    </p>
  );

  return (
    <div className="space-y-4" data-testid="metodo">
      {/* ─────────────── topo: curso + sessão guiada ─────────────── */}
      <section className="rounded-2xl border border-border overflow-hidden bg-card" data-testid="sessao">
        <div className="bg-violet-200 dark:bg-violet-800/60 px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="text-sm font-black uppercase tracking-wider">🎯 Método de estudo</span>
          {etapa > 0 && <span className="text-[11px] font-bold">{["", "Recall", "Pomodoro", "Feynman", "Revisões"][etapa]} · {etapa} de 4</span>}
        </div>

        {semCurso ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">O método precisa de um curso ou matéria pra começar.</p>
            {onIrParaCursos && <Button size="sm" variant="outline" className="h-9" onClick={onIrParaCursos}>Cadastrar em Estudos</Button>}
          </div>
        ) : etapa === 0 ? (
          <div className="p-4 space-y-3">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-3 py-2.5 flex items-center gap-3" data-testid="proximo-passo">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Próximo passo</p>
                <p className="text-[13px] leading-snug">{passo.texto}</p>
              </div>
              <Button size="sm" className="h-9 shrink-0 bg-violet-600 hover:bg-violet-700 text-white" onClick={seguirPasso}>{passo.botao}</Button>
            </div>
            <p className="text-sm leading-snug">Seis técnicas que fazem você <b>lembrar</b> do que estudou. Toque numa aqui embaixo pra usar agora, ou faça a sessão guiada (~30 min).</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={curso?.id} onChange={(e) => setCursoId(e.target.value)} className="h-11 sm:w-56 text-sm rounded-xl border border-input bg-background px-3" aria-label="Curso">
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button className="h-11 flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold" onClick={comecar} data-testid="comecar-sessao">
                <Play className="w-4 h-4 mr-1.5 fill-current" /> Começar sessão guiada
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Sessão guiada: Recall → Pomodoro → Feynman → Revisão.</p>
            <p className="text-[11px] text-muted-foreground">
              Esta semana: <b className="text-foreground">{semana.sessoes}</b> {semana.sessoes === 1 ? "sessão" : "sessões"} · {semana.pomodoros} 🍅 · {semana.cartoes} cartões{semana.cartoes ? ` (${semana.lembrados} lembrados)` : ""}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 rounded-full ${n <= etapa ? "bg-violet-600" : "bg-muted"}`} />)}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{curso?.name}</p>

            {etapa === 1 && (
              <div className="space-y-3" data-testid="etapa-recall">
                <p className="text-xs text-muted-foreground">Antes de abrir o material: o que você lembra?</p>
                <QuizRecall
                  fila={filaSessao}
                  revisoes={revisoes}
                  onResponder={(id, r, ok) => { onResponder(id, r); setRecallSessao((s) => ({ feitos: s.feitos + 1, acertos: s.acertos + (ok ? 1 : 0) })); }}
                  vazio={<div className="space-y-2">{semCartoes}<Button className="w-full h-11" onClick={() => setEtapa(2)} data-testid="ir-pomodoro">Ir pro Pomodoro</Button></div>}
                  fim={(f, a) => <div className="space-y-2"><p className="text-sm">Recall feito: {a} de {f} lembrados.</p><Button className="w-full h-11" onClick={() => setEtapa(2)} data-testid="ir-pomodoro">Ir pro Pomodoro</Button></div>}
                />
                {filaSessao.length > 0 && <button type="button" onClick={() => setEtapa(2)} className="text-[11px] text-muted-foreground underline underline-offset-2">Pular pro Pomodoro</button>}
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-3 text-center" data-testid="etapa-pomodoro">
                <AnelPomodoro tempo={pomodoro.tempo} rodando={pomodoro.rodando} tamanho={150} />
                <div className="flex justify-center gap-2">
                  {!pomodoro.rodando ? <Button onClick={pomodoro.iniciar} className="bg-red-500 hover:bg-red-600 text-white">▶ Iniciar</Button> : <Button variant="outline" onClick={pomodoro.pausar}>⏸ Pausar</Button>}
                  <Button variant="ghost" onClick={() => pomodoro.definir(25)}>🔄 25 min</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Estude {curso?.name}. Acabou o tempo, respira 5 minutos. Pomodoros nesta sessão: <b>{pomodorosDaSessao}</b></p>
                <Button className="w-full h-11" variant="outline" onClick={() => setEtapa(3)} data-testid="ir-feynman">Terminei de estudar → Feynman</Button>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-2" data-testid="etapa-feynman">
                <p className="text-xs text-muted-foreground">Explique o que estudou como se fosse pra alguém de 12 anos. Onde travar é o que ainda falta.</p>
                <FormFeynman
                  testid="salvar-feynman"
                  rotuloSalvar="Salvar e ver as revisões"
                  onSalvar={(tema, exp, travei, onde) => { registrarFeynman(tema, exp, travei, onde); setFeynmanSessao({ tema, travei }); setEtapa(4); }}
                />
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-3" data-testid="etapa-revisoes">
                <p className="text-sm">Recall: <b>{recallSessao.acertos} de {recallSessao.feitos}</b> · Pomodoros: <b>{pomodorosDaSessao}</b> · Feynman: <b>{feynmanSessao?.travei ? "travou (revisão amanhã)" : "explicou"}</b></p>
                <p className="text-xs text-muted-foreground">Repetição espaçada: {venceAmanha ? `amanhã voltam ${venceAmanha} ${venceAmanha === 1 ? "cartão" : "cartões"}` : "amanhã não volta cartão"}{venceEm3 ? `, em 3 dias mais ${venceEm3}` : ""}.</p>
                {BlocoLembrete}
                <Button className="w-full h-11" onClick={terminar} data-testid="terminar-sessao">Concluir sessão</Button>
              </div>
            )}

            <button type="button" onClick={() => setEtapa(0)} className="text-[11px] text-muted-foreground underline underline-offset-2">Sair da sessão</button>
          </div>
        )}
      </section>

      {/* ─────────────── as 6 técnicas ─────────────── */}
      {etapa === 0 && (
        <>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">As 6 técnicas · toque pra usar</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5" data-testid="ferramentas">
              {FERRAMENTAS.map((f) => {
                const on = aberta === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => abrir(f.id)}
                    aria-pressed={on}
                    aria-label={f.nome}
                    data-testid={`ferramenta-${f.id}`}
                    className={`text-left rounded-2xl border bg-card p-3 flex flex-col gap-2 min-h-[118px] transition-shadow active:scale-[0.99] ${on ? `ring-2 ${f.anel} border-transparent shadow-md` : "border-border hover:shadow-sm"}`}
                  >
                    <span className={`w-9 h-9 rounded-xl grid place-items-center ${f.icone}`}><f.Icone className="w-[18px] h-[18px]" /></span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold leading-tight">{f.nome}</span>
                      <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">{f.curto}</span>
                    </span>
                    <span className={`mt-auto text-[11px] font-semibold ${f.status}`}>{status[f.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {ferramenta && (
            <section ref={painelRef} className="rounded-2xl border border-border bg-card overflow-hidden scroll-mt-24" data-testid={`painel-${ferramenta.id}`}>
              <div className={`h-1 ${ferramenta.barra}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${ferramenta.icone}`}><ferramenta.Icone className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold leading-tight">{ferramenta.nome}</h3>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{ferramenta.como}</p>
                  </div>
                  <button type="button" onClick={() => setAberta(null)} aria-label="Fechar" className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted shrink-0"><X className="w-4 h-4" /></button>
                </div>

                {semCurso && ferramenta.id !== "pomodoro" ? (
                  <p className="text-sm text-muted-foreground">Cadastre um curso ou matéria primeiro — é nele que os cartões e horários ficam.</p>
                ) : (
                  <>
                    {/* 1 · Time Blocking */}
                    {ferramenta.id === "blocos" && (
                      <div className="space-y-2" data-testid="blocos">
                        {blocos.map((b) => (
                          <div key={b.id} className="flex items-center gap-2.5 text-sm rounded-xl bg-background border border-border px-3 py-2.5" data-testid="bloco-item">
                            <span className="font-bold tabular-nums text-sky-700 dark:text-sky-300">{b.hora}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block truncate font-medium">{b.titulo}</span>
                              <span className="block text-[11px] text-muted-foreground">{(b.repete ?? []).map((d) => DIAS_CURTOS[d]).join(", ")} · {rotuloAviso(b.aviso ?? 60)}</span>
                            </span>
                            <button type="button" onClick={() => apagarBloco(b.id)} aria-label={`Apagar ${b.titulo}`} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                        {!formBloco ? (
                          <Button variant="outline" className="w-full h-11" onClick={() => setFormBloco(true)} data-testid="novo-bloco"><Plus className="w-4 h-4 mr-1" /> Marcar horário de estudo</Button>
                        ) : (
                          <div className="rounded-xl border border-border bg-background p-3 space-y-2.5" data-testid="form-bloco">
                            <p className="text-xs font-semibold">Estudar {curso?.name}</p>
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias do bloco">
                              {DIAS_CURTOS.map((d, i) => {
                                const on = bDias.includes(i);
                                return <button key={d} type="button" aria-pressed={on} onClick={() => setBDias((p) => (on ? p.filter((x) => x !== i) : [...p, i]))} className={`px-2.5 h-9 rounded-lg text-xs font-semibold border ${on ? "bg-sky-600 text-white border-sky-600" : "bg-card text-muted-foreground border-border"}`}>{d}</button>;
                              })}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-[11px] text-muted-foreground flex flex-col gap-1">Hora<Input type="time" value={bHora} onChange={(e) => setBHora(e.target.value)} className="h-10 text-sm" aria-label="Hora do bloco" /></label>
                              <label className="text-[11px] text-muted-foreground flex flex-col gap-1">Avisar
                                <select value={bAviso} onChange={(e) => setBAviso(Number(e.target.value))} className="h-10 text-sm rounded-md border border-input bg-background px-2" aria-label="Aviso do bloco">
                                  {AVISOS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
                                </select>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <Button className="h-10 flex-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={salvarBloco}>Salvar bloco</Button>
                              <Button variant="ghost" className="h-10" onClick={() => setFormBloco(false)} aria-label="Cancelar"><X className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">Os horários aparecem também na Rotina → Meu mês.</p>
                      </div>
                    )}

                    {/* 2 · Pomodoro */}
                    {ferramenta.id === "pomodoro" && (
                      <div className="space-y-3 text-center">
                        <AnelPomodoro tempo={pomodoro.tempo} rodando={pomodoro.rodando} tamanho={170} />
                        <div className="flex justify-center gap-2">
                          {!pomodoro.rodando ? <Button onClick={pomodoro.iniciar} className="bg-red-500 hover:bg-red-600 text-white h-11 px-6">▶ Iniciar</Button> : <Button variant="outline" className="h-11 px-6" onClick={pomodoro.pausar}>⏸ Pausar</Button>}
                          <Button variant="ghost" className="h-11" onClick={() => pomodoro.definir(25)}>🔄 25 min</Button>
                          <Button variant="ghost" className="h-11" onClick={() => pomodoro.definir(5)}>☕ 5 min</Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Pomodoros feitos: <b>{pomodoro.concluidos}</b>. O tempo continua rodando se você trocar de aba.</p>
                        {onIrPara && <button type="button" onClick={() => onIrPara("pomodoro")} className="text-xs font-semibold underline underline-offset-2 inline-flex items-center gap-1">Abrir a aba Pomodoro <ExternalLink className="w-3 h-3" /></button>}
                      </div>
                    )}

                    {/* 3 · Active Recall */}
                    {ferramenta.id === "recall" && (
                      <div data-testid="recall-avulso">
                        <QuizRecall
                          key={`${curso?.id}-${rodadaRecall}`}
                          fila={filaRecall}
                          revisoes={revisoes}
                          onResponder={(id, r) => onResponder(id, r)}
                          vazio={semCartoes}
                          fim={(f, a) => (
                            <div className="space-y-2">
                              <p className="text-sm">Pronto: {a} de {f} lembrados. Os que você errou voltam antes.</p>
                              <Button variant="outline" className="w-full h-10" onClick={() => setRodadaRecall((n) => n + 1)}>Testar de novo</Button>
                            </div>
                          )}
                        />
                      </div>
                    )}

                    {/* 4 · Feynman */}
                    {ferramenta.id === "feynman" && (
                      <FormFeynman
                        testid="salvar-feynman-avulso"
                        rotuloSalvar="Salvar explicação"
                        onSalvar={(tema, exp, travei, onde) => { registrarFeynman(tema, exp, travei, onde); toast.success(travei ? "Salvo — revisão marcada pra amanhã" : "Explicação salva como cartão"); }}
                      />
                    )}

                    {/* 5 · Repetição espaçada */}
                    {ferramenta.id === "revisao" && (
                      <div className="space-y-3" data-testid="revisao-avulsa">
                        {todosCartoes.length ? <RevisaoDoDia mapa={mapa} cursos={cursos} revisoes={revisoes} onResponder={onResponder} /> : semCartoes}
                        <p className="text-xs text-muted-foreground">Próximos: amanhã {venceAmanha} · em 3 dias {venceEm3}. Todos os cursos juntos.</p>
                        {BlocoLembrete}
                      </div>
                    )}

                    {/* 6 · Socrático */}
                    {ferramenta.id === "socratico" && (
                      <div className="space-y-3" data-testid="socratico">
                        {socPasso === -1 && (
                          <div className="space-y-2">
                            <Input value={socTema} onChange={(e) => setSocTema(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") iniciarSocratico(); }} placeholder="Sobre o que você quer pensar? (ex.: juros compostos)" className="h-10 text-sm" aria-label="Tema do socrático" />
                            <Button className="w-full h-11 bg-pink-600 hover:bg-pink-700 text-white" onClick={iniciarSocratico} data-testid="comecar-socratico">Começar as perguntas</Button>
                          </div>
                        )}
                        {socPasso >= 0 && socPasso < PERGUNTAS_SOCRATICAS.length && (() => {
                          const p = PERGUNTAS_SOCRATICAS[socPasso];
                          const resp = socRespostas[socPasso] ?? "";
                          const setResp = (v: string) => setSocRespostas((arr) => { const n = [...arr]; n[socPasso] = v; return n; });
                          return (
                            <div className="space-y-2" data-testid="socratico-pergunta">
                              <div className="grid grid-cols-6 gap-1" aria-hidden>
                                {PERGUNTAS_SOCRATICAS.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i <= socPasso ? "bg-pink-500" : "bg-muted"}`} />)}
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-700 dark:text-pink-300">{socPasso + 1} de {PERGUNTAS_SOCRATICAS.length} · {p.tipo}</p>
                              <p className="text-[15px] font-semibold leading-snug">{p.pergunta(socTema.trim())}</p>
                              <p className="text-[11px] text-muted-foreground">{p.dica}</p>
                              <Textarea value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Sua resposta…" className="text-sm min-h-[90px]" aria-label="Resposta" autoFocus />
                              <div className="flex gap-2">
                                {socPasso > 0 && <Button variant="ghost" className="h-10" onClick={() => setSocPasso((n) => n - 1)}>Voltar</Button>}
                                <Button variant="outline" className="h-10" onClick={() => setSocPasso((n) => n + 1)}>Pular</Button>
                                <Button className="h-10 flex-1" disabled={!resp.trim()} onClick={() => setSocPasso((n) => n + 1)}>{socPasso === PERGUNTAS_SOCRATICAS.length - 1 ? "Terminar" : "Próxima"}</Button>
                              </div>
                            </div>
                          );
                        })()}
                        {socPasso >= PERGUNTAS_SOCRATICAS.length && (
                          <div className="space-y-2" data-testid="socratico-fim">
                            <p className="text-sm font-semibold">{socTema.trim()} — suas respostas</p>
                            {PERGUNTAS_SOCRATICAS.map((p, i) => (socRespostas[i] ?? "").trim() ? (
                              <div key={i} className="rounded-xl border border-border bg-background px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{p.tipo}</p>
                                <p className="text-sm whitespace-pre-wrap">{socRespostas[i]}</p>
                              </div>
                            ) : null)}
                            <p className="text-[11px] text-muted-foreground">Cada resposta vira um cartão de {curso?.name} e volta na repetição espaçada.</p>
                            <div className="flex gap-2">
                              <Button variant="ghost" className="h-10" onClick={() => setSocPasso(-1)}>Descartar</Button>
                              <Button className="h-10 flex-1 bg-pink-600 hover:bg-pink-700 text-white" onClick={salvarSocratico} data-testid="salvar-socratico">Salvar como cartões</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {sessoes.length > 0 && etapa === 0 && (
        <div className="rounded-2xl border border-border bg-card p-3" data-testid="historico-sessoes">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Últimas sessões</p>
          {[...sessoes].reverse().slice(0, 5).map((s) => (
            <p key={s.id} className="text-xs py-0.5"><span className="text-muted-foreground tabular-nums">{dataCurta(s.data)}</span> · {s.cursoNome}{s.tema ? ` · ${s.tema}` : ""} · {s.recall.acertos}/{s.recall.feitos} lembrados · {s.pomodoros} 🍅{s.travei ? " · travou" : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
};
