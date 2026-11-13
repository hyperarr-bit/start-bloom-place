import { useEffect, useReducer, useRef, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Package, Pencil, AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { CHAVE_DEPENDENTES } from "@/lib/saude-dependentes";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { isNativeShell } from "@/lib/native-shell";
import { remedioVezesLigado } from "@/lib/remedio-vezes";
import { abrirAjusteDeAlarmeExato, estadoAlarmeExato, pedirPermissao, temPermissao, type EstadoAlarmeExato } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo, type Leitor } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";
import { avisarApagado } from "@/lib/desfazer";
import { marcadaPelaCaixa } from "@/lib/remedio-caixa";
import {
  OPCOES_VEZES, agruparRemedios, doseADesmarcar, doseDaHora, doseQueChegou, dosesDoGrupoAgora, ehDia, gerarHorarios, inicioEscolhido, momentoDoInicio, montarLinhas, mudarHorarios, novosExistem, raizDoId, rotuloDosHorarios,
  trocaDoGrupo, tratamentoTerminou, ultimasDosesDoGrupo, type DoseMarcavel, type GrupoDeRemedio, type Remedio as Supplement, type VezesAoDia,
} from "@/lib/remedios";

/* O tipo da linha (`Remedio`, lib/remedios) é o de sempre — id, name, time,
 * stock, dosesPerDay, quem — mais `grupo`, `ate` e `inicio` (07/11), opcionais:
 * um remédio de 8 em 8 h são 3 linhas normais ligadas pelo `grupo`, e o app
 * antigo continua lendo e marcando cada linha. */

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

/* A CAIXA DESFAZ O QUE ELA MARCOU (07/11, crítica de fora): o 2º toque desfaz a dose que a caixa
   marcou por último (lib/remedio-caixa). A memória mora fora do componente (2ª rodada): num useRef
   ela sumia ao trocar de tela entre os 2 toques. Esquece quando a pílula mexe no grupo, ou quando
   a caixa desmarca — aí vale o relógio (lib/remedios, doseADesmarcar).
   Ela serve SÓ pra escolher qual desmarcar; "ficou pra trás" sai do registro (rodada 3, 08/11). */

/* ESTOQUE EDITÁVEL (25/09, cliente: "como alterar a quantidade de
 * medicamentos"). Todo remédio nascia com 30 e o número só descia marcando
 * "tomado" — caixa de 60 ou caixa nova não tinha como acertar sem apagar e
 * recadastrar. Agora: "Qtd" no cadastro e toque no número pra corrigir. */
const ESTOQUE_PADRAO = 30;
const soDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 4);
const lerEstoque = (v: string): number | null => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(9999, n) : null;
};
/** "2026-11-12" → "12/11" */
const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** "hoje 08:00" / "amanhã 09:00" / "10/11 08:00" — o começo do tratamento, na fileira de edição */
const comecoEmTexto = (inicio: Date, agora: Date) => `${diaEmTexto(inicio, agora)} ${horaEmTexto(inicio)}`;
/** "hoje" / "amanhã" / "10/11" */
const diaEmTexto = (quando: Date, agora: Date) => {
  const dia = localDayKey(quando);
  const amanha = localDayKey(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  return dia === localDayKey(agora) ? "hoje" : dia === amanha ? "amanhã" : diaCurto(dia);
};
const horaEmTexto = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
/** "amanhã, às 07:00" — o dia e a hora, pros avisos curtos (10/11, I4) */
const diaEHoraEmTexto = (quando: Date, agora: Date) => `${diaEmTexto(quando, agora)}, às ${horaEmTexto(quando)}`;
/** 1× ao dia: a caixa não marca a 1ª dose de um horário mudado com mais de 3 h de antecedência (10/11, I2) */
const ANTECEDENCIA_DOSE_NOVA_MS = 3 * 3600_000;

const EstoqueEditavel = ({ nome, valor, baixo, onSalvar }: { nome: string; valor: number; baixo: boolean; onSalvar: (n: number) => void }) => {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const salvar = () => {
    const n = lerEstoque(rascunho);
    if (n !== null && n !== valor) onSalvar(n); // vazio ou inválido não zera nada
    setEditando(false);
  };
  if (editando) {
    return (
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        value={rascunho}
        aria-label={`Estoque de ${nome}`}
        onChange={e => setRascunho(soDigitos(e.target.value))}
        onFocus={e => e.currentTarget.select()}
        onBlur={salvar}
        onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
        className="w-14 h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid="estoque-input"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setRascunho(String(valor)); setEditando(true); }}
      aria-label={`Alterar estoque de ${nome} (${valor})`}
      title="Toque pra alterar a quantidade"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 border border-dashed border-transparent hover:border-border transition-colors ${baixo ? "text-[10px] font-semibold text-[hsl(var(--saude-yellow))]" : "text-xs text-muted-foreground"}`}
      data-testid="estoque-botao"
    >
      {baixo && <Package className="w-3 h-3" />}
      {valor}
      <Pencil className="w-2.5 h-2.5 opacity-40" aria-hidden />
    </button>
  );
};

/* DESMARCAR DEVOLVE SÓ O QUE O MARCAR TIROU (26/09, varredura): com estoque 0,
 * marcar "tomado" não tira nada (não existe estoque negativo), mas desmarcar
 * somava 1 — tomar e destomar por engano criava um comprimido do nada. Quem foi
 * marcado hoje SEM baixa fica anotado nesta chave à parte (só o dia de hoje):
 * o log de "tomado" é lido pelos lembretes e pela Home e não muda de formato. */
export const CHAVE_SEM_BAIXA = "core-saude-supplement-sem-baixa";
type SemBaixa = { dia: string; ids: string[] };

const nameColors = [
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
];

const campoPequeno = "h-8 rounded-lg border border-input bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

export const PharmacyChecklist = () => {
  const today = todayStr();
  const { get } = useUserData();
  const [supplements, setSupplements] = usePersistedState<Supplement[]>("core-saude-supplements", []);
  const [supplementLog, setSupplementLog] = usePersistedState<Record<string, string[]>>("core-saude-supplement-log", {});
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [newQuem, setNewQuem] = useState("");
  const [newStock, setNewStock] = useState(String(ESTOQUE_PADRAO));
  /* 07/11 (pedido de cliente): "Quantas vezes" + primeira dose + "até quando".
     Os horários são gerados da primeira dose (08:00 de 8 em 8 → 08:00, 16:00,
     00:00) e ficam editáveis antes de salvar; mexer na primeira dose ou no
     "quantas vezes" gera de novo. */
  const [newVezes, setNewVezes] = useState<VezesAoDia>(1);
  /* 07/11 (4ª rodada): "Quantas vezes" e "Até quando" atrás da chave (lib/remedio-vezes) — ligada no
     app das lojas, DESLIGADA no site até a build nova estar na loja: o app antigo do celular avisaria
     um tratamento com fim todo dia, pra sempre. Sem ela, o cadastro é o de sempre (1 horário). */
  const vezesLigado = remedioVezesLigado();
  const [horariosEditados, setHorariosEditados] = useState<string[] | null>(null);
  const [newAte, setNewAte] = useState("");
  /** "Começa hoje/amanhã" (07/11, 4ª rodada): null = a sugestão; senão o DIA que a pessoa tocou
      ("AAAA-MM-DD", guardado na hora do toque — 08/11, F3: "amanhã" escolhido às 23:58 e o + às
      00:01 virava depois de amanhã) */
  const [diaDoComeco, setDiaDoComeco] = useState<string | null>(null);
  /** o grupo com os horários/data abertos pra editar na tabela */
  const [editando, setEditando] = useState<string | null>(null);
  /* O COMEÇO DE QUANDO A FILEIRA ABRIU (só de tratamento que ainda não começou): o campo de hora
     manda valores no meio da digitação (2,0,0,0 passa por 02:00 antes de 20:00), e "Começa amanhã
     08:00" digitado 23:00 às 22:15 virava hoje 23:00 se a conta partisse do valor do meio. O começo
     sai sempre deste. Não guarda marca nenhuma: mudar o horário não mexe no registro (08/11). */
  const comecoAoAbrir = useRef<{ chave: string; inicio?: string } | null>(null);
  // 07/11: alarme exato do Android (ver `estadoAlarmeExato`) — "indisponivel" no iPhone e na web
  const [alarmeExato, setAlarmeExato] = useState<EstadoAlarmeExato>("indisponivel");
  const [dependentes, setDependentes] = usePersistedState<string[]>(CHAVE_DEPENDENTES, []);
  const [semBaixa, setSemBaixa] = usePersistedState<SemBaixa>(CHAVE_SEM_BAIXA, { dia: "", ids: [] });
  /** a dose foi marcada no dia em que ela acontece? (a das 00:00 tomada às 23:50 mora no dia seguinte) */
  const foiTomada = (d: { id: string; dia: string }) => (supplementLog[d.dia] || []).includes(d.id);
  const grupos = agruparRemedios(supplements);
  const horariosGerados = gerarHorarios(newTime, newVezes);
  const horarios = horariosEditados ?? (horariosGerados.length ? horariosGerados : [newTime]);
  const comeco = newVezes > 1 && horarios.length > 1 ? inicioEscolhido(horarios[0], horarios, diaDoComeco ?? undefined) : undefined;

  /** as linhas que andam juntas com esta: o grupo inteiro, ou só ela */
  const mesmoGrupo = (linha: Supplement) => (s: Supplement) => (linha.grupo ? s.grupo === linha.grupo : s.id === linha.id);

  /** `dia`: o dia em que a dose acontece (lib/remedios, dosesDoGrupoAgora) — o registro vai pra ele */
  const toggleTaken = (id: string, dia: string = today) => {
    // `id` pode ser o de antes de uma troca de horário (lib/remedios, mudarHorarios: idAntes)
    const linha = supplements.find(s => s.id === id || s.idAntes === id);
    if (!linha) return;
    const juntas = mesmoGrupo(linha);
    const doDia = supplementLog[dia] || [];
    const semBaixaDoDia = semBaixa?.dia === dia && Array.isArray(semBaixa.ids) ? semBaixa.ids : [];
    const alreadyTaken = doDia.includes(id);
    const newTaken = alreadyTaken ? doDia.filter(x => x !== id) : [...doDia, id];
    setSupplementLog(prev => ({ ...prev, [dia]: newTaken }));
    // o estoque de um remédio de 8 em 8 é um só: as linhas do grupo sobem e descem juntas (vale a menor)
    const semEstoque = Math.min(...supplements.filter(juntas).map(s => s.stock ?? 0)) <= 0;
    if (!alreadyTaken && semEstoque) {
      setSemBaixa({ dia, ids: [...semBaixaDoDia.filter(x => x !== id), id] });
    } else if (!alreadyTaken) {
      setSupplements(prev => prev.map(s => juntas(s) ? { ...s, stock: Math.max(0, s.stock - 1) } : s));
    } else if (semBaixaDoDia.includes(id)) {
      setSemBaixa({ dia, ids: semBaixaDoDia.filter(x => x !== id) }); // não tirou, não devolve
    } else {
      setSupplements(prev => prev.map(s => juntas(s) ? { ...s, stock: s.stock + 1 } : s));
    }
  };

  /* 07/11: no Android 14 o alarme EXATO nasce negado pro app e o lembrete das
     8h pode chegar às 10h. A central já avisa; aqui o aviso aparece onde a
     pessoa acabou de pedir o lembrete — e, ao liberar, os avisos são REFEITOS:
     o que já estava armado continua inexato até ser agendado de novo. */
  const conferirAlarmeExato = async () => {
    try { setAlarmeExato(await estadoAlarmeExato()); } catch { /* sem plugin */ }
  };
  const temRemedio = supplements.length > 0;
  useEffect(() => {
    // depende de "tem remédio": a lista pode chegar um instante depois da montagem (hidratação)
    if (isNativeShell() && temRemedio) void conferirAlarmeExato();
  }, [temRemedio]); // eslint-disable-line react-hooks/exhaustive-deps

  /* A caixa e as doses seguem o RELÓGIO (07/11): com o card aberto, a tela se
     refaz a cada minuto, pra dose destacada ser a da hora.
     A TELA REFAZ A CONTA AO VOLTAR PRO APP (08/11, crítica de fora, rodada 3): o relógio
     vale pra TODO remédio (o de 1× ao dia não tinha nenhum — aberto na Saúde à noite, de
     manhã mostrava o ✓ de ONTEM e a pessoa pulava a dose), e voltar pro app ou pra aba
     (visibilitychange, focus, pageshow) refaz na hora: com o app suspenso, o relógio de
     1 min pode demorar até 1 min depois de abrir, e é nesse minuto que a pessoa, vinda
     do aviso das 08:00, toca. Mesmo cuidado da tarefa da Casa (CleaningRoutine). */
  const [, passarMinuto] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!temRemedio) return;
    const t = window.setInterval(passarMinuto, 60_000);
    return () => window.clearInterval(t);
  }, [temRemedio]);
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") passarMinuto(); };
    const refazer = () => passarMinuto();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", refazer);
    window.addEventListener("pageshow", refazer);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", refazer);
      window.removeEventListener("pageshow", refazer);
    };
  }, []);

  /* Notificação na hora do remédio (07/09, avaliação da Play: "adicionem
     notificação pra tomar remédio"). A permissão do Android é pedida AQUI, no
     cadastro — o momento em que a pessoa acabou de dizer "me lembra às 8h" —
     e não na abertura do app: no Android 13+ a recusa é definitiva, então a
     única chance é gasta quando faz sentido (mesma regra do PedirLembreteRotina).
     Se já foi negada, pedirPermissao devolve false sem incomodar.

     O useLembretes reagenda sozinho a cada mudança de dado, mas ele roda no
     render seguinte — ANTES da permissão chegar no primeiro cadastro. Por isso
     o reagendamento explícito aqui, com um leitor que já enxerga a lista nova
     (o `get` deste render ainda tem a lista antiga). */
  const rearmarLembretes = async (lista: Supplement[], pedir: boolean) => {
    if (!isNativeShell()) return;
    if (pedir) {
      const ok = await pedirPermissao();
      trackEvent("lembrete_remedio_permissao", { concedida: ok, total: lista.length });
      if (!ok) return;
    } else if (!(await temPermissao())) return;
    const leitor: Leitor = (k, fb) => (k === "core-saude-supplements" ? (lista as unknown as typeof fb) : get(k, fb));
    try { await reagendarTudo(leitor, lerPrefs(get<unknown>(CHAVE_PREFS, undefined))); } catch { /* sem plugin */ }
    await conferirAlarmeExato();
  };

  const liberarAlarmeExato = async () => {
    const estado = await abrirAjusteDeAlarmeExato();
    setAlarmeExato(estado);
    if (estado === "granted") void rearmarLembretes(listaAtual.current, false);
  };

  const addSupplement = () => {
    if (!newName.trim()) return;
    const quem = newQuem.trim();
    const stock = lerEstoque(newStock) ?? ESTOQUE_PADRAO;
    const ate = vezesLigado && ehDia(newAte) && newAte >= today ? newAte : undefined; // data no passado = sem fim
    // o dia escolhido em "Começa" já passou (escolhido antes da meia-noite, + bem depois): não grava
    // um começo que a pessoa não viu — volta a sugestão e avisa; o próximo + grava o que está na tela
    const comecoNaHora = vezesLigado && newVezes > 1 && horarios.length > 1 ? inicioEscolhido(horarios[0], horarios, diaDoComeco ?? undefined) : undefined;
    if (comecoNaHora?.passou) {
      setDiaDoComeco(null);
      toast(`O dia escolhido pra começar já passou. Agora começa ${comecoNaHora.amanha ? "amanhã" : "hoje"} ${horarios[0]}. Confira e toque no + de novo.`, { id: "remedio-comeco-passou", duration: 5000 });
      return;
    }
    const novas = montarLinhas({ name: newName.trim(), quem, stock }, vezesLigado ? horarios : [newTime], ate, Date.now(), comecoNaHora?.inicio);
    const lista = [...supplements, ...novas];
    setSupplements(lista);
    if (quem && !dependentes.includes(quem)) setDependentes([...dependentes, quem]);
    setNewName("");
    setNewQuem("");
    setNewStock(String(ESTOQUE_PADRAO));
    setNewVezes(1);
    setHorariosEditados(null);
    setNewAte("");
    setDiaDoComeco(null);
    if (novas.length > 1 || ate) trackEvent("remedio_vezes_cadastro", { vezes: novas.length, ate: !!ate });
    void rearmarLembretes(lista, true);
  };

  const escolherVezes = (vezes: VezesAoDia) => { setNewVezes(vezes); setHorariosEditados(null); };
  const mudarPrimeiraDose = (time: string) => { setNewTime(time); setHorariosEditados(null); };
  const editarHorarioNovo = (i: number, time: string) => {
    if (!time) return;
    if (i === 0) { mudarPrimeiraDose(time); return; } // a 1ª dose é a de cima de antes: gera as outras de novo
    setHorariosEditados(horarios.map((h, j) => (j === i ? time : h)));
  };

  // lista mais recente pro "Desfazer" do toast, que roda segundos depois
  const listaAtual = useRef(supplements);
  listaAtual.current = supplements;

  /* APAGAR COM DESFAZER (26/09, varredura): um toque na lixeira sumia com o
     remédio, o horário e o estoque, sem volta. Agora apaga já e o toast
     oferece desfazer — volta no mesmo lugar e o lembrete é reagendado.
     07/11: um remédio de 8 em 8 sai (e volta) inteiro, com as 3 linhas. */
  const removeGrupo = (g: GrupoDeRemedio) => {
    const ids = new Set(g.itens.map(s => s.id));
    const pos = supplements.findIndex(s => ids.has(s.id));
    if (pos < 0) return;
    const removidos = supplements.filter(s => ids.has(s.id));
    const lista = supplements.filter(s => !ids.has(s.id));
    setSupplements(lista);
    void rearmarLembretes(lista, false); // cancela o aviso do que foi apagado
    avisarApagado(`${g.nome} apagado`, () => {
      const atual = listaAtual.current;
      if (atual.some(s => ids.has(s.id))) return;
      const volta = [...atual];
      volta.splice(Math.min(pos, volta.length), 0, ...removidos);
      setSupplements(volta);
      void rearmarLembretes(volta, false);
    });
  };

  /** Horário editável na própria linha — antes era só texto, e mudar de 8h
   *  pra 20h exigia apagar e recadastrar (perdendo o estoque).
   *  A PARTIR DE AMANHÃ (decisão do dono, 08/11): o que já foi marcado fica como está e as doses
   *  de hoje seguem os horários de antes até o dia do tratamento virar (lib/remedios,
   *  mudarHorarios). Nenhuma marca de "tomado" muda de lugar. Num remédio de várias doses, a 1ª
   *  dose ajusta as outras, como no cadastro; antes de o tratamento começar, muda na hora. */
  const changeTime = (id: string, time: string) => {
    if (!time) return;
    const linha = supplements.find(s => s.id === id);
    if (!linha) return;
    /* CHAVE DESLIGADA (11/11, crítica da build 1.0.25): a regra "a partir de amanhã" fica atrás da
       REMEDIO_VEZES, junto com o cadastro de várias doses. Com ela off, mudar o horário vale NA HORA,
       como na 1.0.24 e no site de hoje (troca a hora e rearma o aviso). Motivo: a regra nova ainda tem
       erro aberto no 1× ao dia (J1: 00:00 → 20:00 ao meio-dia deixava 44 h sem dose e sem aviso;
       J3: tomado atrasado e mudado logo depois, dose nova 2 h 30 depois do comprimido). Os campos de
       uma troca antiga (horaAntes, antesAte, novoDesde, idAntes) saem da linha, senão a tela e os
       avisos seguiam a troca velha. Nenhuma linha em produção tem esses campos. */
    if (!vezesLigado) {
      if (linha.time === time && !linha.horaAntes) return;
      const lista = supplements.map(s => {
        if (s.id !== id) return s;
        const { horaAntes: _h, idAntes: _i, antesAte: _a, novoDesde: _n, ...resto } = s;
        return { ...resto, time };
      });
      setSupplements(lista);
      void rearmarLembretes(lista, false);
      return;
    }
    const doRemedio = supplements.filter(mesmoGrupo(linha));
    const i = doRemedio.findIndex(s => s.id === id);
    const atuais = doRemedio.map(s => s.time);
    const novos = doRemedio.length > 1 && i === 0 ? gerarHorarios(time, doRemedio.length) : atuais.map((h, j) => (j === i ? time : h));
    if (novos.every((h, j) => h === atuais[j])) return;
    const chave = linha.grupo ? `g:${linha.grupo}` : `i:${raizDoId(linha.id)}`;
    const inicioDeAntes = comecoAoAbrir.current?.chave === chave ? comecoAoAbrir.current.inicio : undefined;
    const { itens, novoDesde, semDoseNova } = mudarHorarios(doRemedio, novos, new Date(), inicioDeAntes);
    const porId = new Map(doRemedio.map((s, j) => [s.id, itens[j]]));
    const lista = supplements.map(s => porId.get(s.id) ?? s);
    setSupplements(lista);
    const comeco = momentoDoInicio(novoDesde);
    // o dia E a hora (10/11, I4): "a partir de amanhã" com a dose nova daqui a 40 min, ou depois de amanhã, enganava
    if (semDoseNova) {
      toast("O tratamento termina antes de os horários novos começarem: até o fim valem os de antes.", { id: `remedio-horario-novo-${chave}`, duration: 5000 });
    } else if (comeco) {
      toast(`Os horários novos valem a partir de ${diaEHoraEmTexto(comeco, new Date())}.`, { id: `remedio-horario-novo-${chave}`, duration: 4000 });
    }
    void rearmarLembretes(lista, false);
  };

  const abrirOuFecharEdicao = (g: GrupoDeRemedio) => {
    const abrir = editando !== g.chave;
    setEditando(abrir ? g.chave : null);
    comecoAoAbrir.current = abrir ? { chave: g.chave, inicio: g.itens.find(s => s.inicio)?.inicio } : null;
  };

  /** "Até quando" do grupo inteiro; vazio = sem fim. */
  const changeAte = (g: GrupoDeRemedio, ate: string) => {
    const ids = new Set(g.itens.map(s => s.id));
    const lista = supplements.map(s => {
      if (!ids.has(s.id)) return s;
      const { ate: _antiga, ...resto } = s;
      return ehDia(ate) ? { ...resto, ate } : resto;
    });
    setSupplements(lista);
    void rearmarLembretes(lista, false);
  };

  const changeStock = (g: GrupoDeRemedio, stock: number) => {
    const ids = new Set(g.itens.map(s => s.id));
    setSupplements(prev => prev.map(s => ids.has(s.id) ? { ...s, stock } : s));
  };

  /** A conta de um remédio num momento: o desenho usa a hora do render; o toque, a hora do toque. */
  const contaDoGrupo = (g: GrupoDeRemedio, agora: Date) => {
    // 07/11: "terminou" só depois da última dose, e a da noite do último dia ainda conta (lib/remedios)
    const encerrado = tratamentoTerminou(g, agora);
    // cada dose na ocorrência que vale agora, com o dia em que ela acontece (é nele que o "tomado" grava)
    const doses: DoseMarcavel[] = encerrado ? ultimasDosesDoGrupo(g) : dosesDoGrupoAgora(g, agora);
    const tomadas = doses.filter(foiTomada);
    const taken = doses.length > 0 && tomadas.length === doses.length;
    // a caixa marca só a dose que JÁ CHEGOU (até agora + 15 min), nunca uma que ainda vem
    // (2ª rodada, 07/11: o 2º toque marcava a das 16:00 às 08:05). Sem nenhuma, ela não grava
    // nada e só diz quando é a próxima; adiantar uma dose é pela pílula do horário.
    const faltam = doses.filter(d => !foiTomada(d));
    const proxima = doseQueChegou(faltam, agora);
    // a pílula com contorno verde: a que a caixa marca ou, se nenhuma chegou, a próxima
    const daVezDose = proxima ?? doseDaHora(faltam, agora);
    const aindaVem = !proxima && !taken ? daVezDose : undefined;
    // desmarcar desfaz a dose que a própria caixa marcou por último (se ela ainda está marcada);
    // sem isso, a marcada que ainda não chegou (a das 00:00 marcada às 23:30), senão a da hora
    const daCaixa = marcadaPelaCaixa.get(g.chave);
    const marcadaAgoraPelaCaixa = daCaixa ? tomadas.find(d => d.id === daCaixa.id && d.dia === daCaixa.dia) : undefined;
    const ultimaTomada = marcadaAgoraPelaCaixa || doseADesmarcar(tomadas, agora);
    // já está marcada uma dose MAIS NOVA deste dia do tratamento, que JÁ CHEGOU: a que sobrou é uma
    // esquecida, que já passou — a caixa não marca ela, só avisa (crítica de fora, rodada 1, 07/11:
    // 1 comprimido virava 2 doses, o estoque descia 2 e o furo sumia). PELO REGISTRO, não pela memória
    // da caixa (rodada 3, 08/11): marcada pela pílula, com o app reaberto ou depois de mexer na 1ª dose,
    // a memória faltava e a caixa marcava a esquecida. Uma dose marcada ADIANTADO (que ainda não chegou)
    // não conta: às 08:05 com a das 16:00 marcada por engano, a caixa ainda marca a das 08:00.
    const ultimaQueChegou = doseQueChegou(doses, agora);
    const ficouPraTras = proxima && ultimaQueChegou && tomadas.some(d => d.quando > proxima.quando && d.quando <= ultimaQueChegou.quando) ? proxima : undefined;
    /* O DIA DESTE DESENHO (08/11, rodada 3): as doses que valem e o dia em que cada uma grava.
       Se no toque ele não bate com o do desenho, o dia do tratamento virou com a tela parada:
       o toque só refaz a tela e não grava (senão tirava o ✓ de ontem, ou marcava a dose velha). */
    const diaDoDesenho = `${encerrado}|${doses.length ? doses.map(d => `${d.id}@${d.dia}`).join(",") : localDayKey(agora)}`;
    return { encerrado, doses, tomadas, taken, proxima, daVezDose, aindaVem, ultimaTomada, ficouPraTras, diaDoDesenho };
  };

  /** A conta da hora do TOQUE (08/11): se o dia do tratamento mudou desde o desenho, devolve nada e refaz a tela. */
  const contaNoToque = (g: GrupoDeRemedio, desenho: ReturnType<typeof contaDoGrupo>) => {
    const conta = contaDoGrupo(g, new Date());
    passarMinuto(); // o desenho segue a hora do toque, grave ou não
    return conta.diaDoDesenho === desenho.diaDoDesenho ? conta : null;
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* Colored header band */}
      <div className="bg-amber-100 dark:bg-amber-900/30 px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-black uppercase tracking-wide text-foreground">Vitaminas e Remédios</h3>
        <span className="text-3xl">💊</span>
      </div>

      {/* Table — LIXEIRA À VISTA (26/09, varredura): a 360 px a tabela passava
          da largura e a lixeira ficava escondida numa rolagem lateral. Colunas
          mais justas cabem no celular; se um nome comprido ainda estourar, a
          coluna da lixeira gruda na direita com o fundo do card. */}
      {grupos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="w-9 pl-3 pr-1 py-3" />
                <th className="text-left px-2 py-3 text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="text-left px-1 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                <th className="text-left pl-2 pr-1 py-3 text-xs font-semibold text-muted-foreground">
                  {/* abaixo de 380 px "Qtd", a palavra do cadastro (07/11, retomada: a 360 px "Estoque" saía cortado) */}
                  <span className="min-[380px]:hidden">Qtd</span><span className="hidden min-[380px]:inline">Estoque</span>
                </th>
                <th className="sticky right-0 bg-card pl-0 pr-1.5 py-3"><span aria-hidden className="absolute inset-0 bg-muted/50" /></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {grupos.flatMap((g, idx) => {
                  const simples = g.itens.length === 1 && !g.ate;
                  const linha = g.itens[0];
                  const agora = new Date();
                  const desenho = contaDoGrupo(g, agora);
                  const { encerrado, doses, tomadas, taken, proxima, daVezDose, aindaVem, ficouPraTras } = desenho;
                  const lowStock = g.estoque <= 5;
                  const color = nameColors[idx % nameColors.length];
                  const rotulo = g.itens.length > 1 ? rotuloDosHorarios(g.itens.map(s => s.time)) : "";
                  const partesDoDetalhe = [rotulo, g.ate ? (encerrado ? `terminou ${diaCurto(g.ate)}` : `até ${diaCurto(g.ate)}`) : ""].filter(Boolean);
                  const detalhe = partesDoDetalhe.join(" · ");
                  const abertoPraEditar = editando === g.chave;
                  const inicioDoGrupo = g.itens.length > 1 ? momentoDoInicio(linha.inicio) : null;
                  const comecoDoGrupo = abertoPraEditar && inicioDoGrupo && inicioDoGrupo.getTime() > agora.getTime() ? comecoEmTexto(inicioDoGrupo, agora) : "";
                  // horário mudado e os novos ainda não começaram (lib/remedios, mudarHorarios): a fileira diz quando começam
                  const troca = abertoPraEditar ? trocaDoGrupo(g) : undefined;
                  const novosEm = troca && novosExistem(g, troca) && troca.novoDesde.getTime() > agora.getTime() ? comecoEmTexto(troca.novoDesde, agora) : "";
                  /* 1× ao dia com horário mudado que ainda não começou (10/11, I4): o campo já mostra o horário
                     novo, então embaixo dele vai a dose de hoje — "hoje 08:00 · 22:00 a partir de amanhã". */
                  const trocaSimples = simples ? trocaDoGrupo(g) : undefined;
                  const doseDeAntes = trocaSimples && doses[0] && doses[0].quando < trocaSimples.novoDesde.getTime() ? doses[0] : undefined;
                  const horarioDeHoje = trocaSimples && novosExistem(g, trocaSimples) && trocaSimples.novoDesde.getTime() > agora.getTime()
                    ? `${doseDeAntes ? `${diaEmTexto(new Date(doseDeAntes.quando), agora)} ${doseDeAntes.time} · ` : ""}${linha.time} a partir de ${diaEmTexto(trocaSimples.novoDesde, agora)}`
                    : "";
                  const linhas = [
                    <motion.tr
                      key={g.chave}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-t border-border/50 transition-colors ${taken ? "bg-[hsl(var(--saude-green)/0.05)]" : "hover:bg-muted/30"} ${encerrado ? "opacity-60" : ""}`}
                      data-testid={`remedio-linha-${g.chave}`}
                    >
                      <td className="pl-3 pr-1 py-3 align-top">
                        {/* remédio de várias doses: a caixa marca a dose da hora (a pílula com contorno verde) e, com todas marcadas, desmarca a última.
                            O quadrado de 20 px é só o desenho: o botão em volta tem 36 px, como a lixeira (07/11, crítica) */}
                        <button
                          onClick={() => {
                            // decide pela hora do TOQUE (08/11); se o dia virou com a tela parada, só refaz a tela
                            const c = contaNoToque(g, desenho);
                            if (!c || c.encerrado) return;
                            if (g.itens.length === 1) {
                              const d = c.doses[0];
                              /* 1ª dose de um horário mudado que ainda está longe (10/11, I2): a caixa não marca —
                                 marcava a das 20:00 às 08:00 e o aviso dela sumia. Só diz quando é. */
                              const trocaAqui = trocaDoGrupo(g);
                              const agoraNoToque = new Date();
                              if (d && trocaAqui && !foiTomada(d) && d.quando >= trocaAqui.novoDesde.getTime() && d.quando - agoraNoToque.getTime() > ANTECEDENCIA_DOSE_NOVA_MS) {
                                toast(`A próxima de ${g.nome} é ${diaEHoraEmTexto(new Date(d.quando), agoraNoToque)}.`, { id: `remedio-ainda-nao-${g.chave}`, duration: 4000 });
                              } else {
                                toggleTaken(d?.id ?? linha.id, d?.dia ?? todayStr()); // a dose da vez: com o horário mudado, pode ser a de antes (id de antes)
                              }
                            }
                            else if (c.taken) {
                              marcadaPelaCaixa.delete(g.chave);
                              if (c.ultimaTomada) toggleTaken(c.ultimaTomada.id, c.ultimaTomada.dia);
                            } else if (c.ficouPraTras) {
                              toast(`A das ${c.ficouPraTras.time} ficou pra trás. Se tomou, toque no horário.`, { id: `remedio-pra-tras-${g.chave}`, duration: 4000 });
                            } else if (c.proxima) {
                              marcadaPelaCaixa.set(g.chave, { id: c.proxima.id, dia: c.proxima.dia });
                              toggleTaken(c.proxima.id, c.proxima.dia);
                            } else if (c.aindaVem) {
                              toast(`A das ${c.aindaVem.time} ainda não chegou. Pra marcar antes, toque no horário.`, { id: `remedio-ainda-nao-${g.chave}`, duration: 4000 });
                            }
                          }}
                          disabled={encerrado}
                          aria-label={g.itens.length === 1
                            ? (taken ? `Desmarcar ${g.nome}` : `Marcar ${g.nome} como tomado`)
                            : (taken ? `Desmarcar ${g.nome}`
                              : aindaVem ? `Próxima dose de ${g.nome} às ${aindaVem.time}`
                              : ficouPraTras ? `A dose de ${g.nome} das ${ficouPraTras.time} ficou pra trás`
                              : `Marcar próxima dose de ${g.nome}${proxima ? ` (${proxima.time})` : ""}`)}
                          className="group w-9 h-9 -mx-2 -mt-1.5 -mb-2 grid place-items-center rounded-lg disabled:cursor-not-allowed"
                          data-testid={`remedio-caixa-${g.chave}`}
                        >
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${taken ? "bg-[hsl(var(--saude-green))] border-[hsl(var(--saude-green))]" : "border-muted-foreground/30 group-hover:border-[hsl(var(--saude-green)/0.5)]"}`}>
                            {taken && <Check className="w-3 h-3 text-white" />}
                          </span>
                        </button>
                        {g.itens.length > 1 && tomadas.length > 0 && !taken && (
                          <span className="block mt-1 text-[10px] font-semibold text-muted-foreground tabular-nums text-center" data-testid="remedio-doses-feitas">{tomadas.length}/{doses.length}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${taken ? "line-through opacity-60" : ""} ${color}`}>
                          {g.nome}
                        </span>
                        {g.quem?.trim() && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" data-testid="remedio-de">
                            👤 {g.quem.trim()}
                          </span>
                        )}
                        {/* o lápis mora aqui, no fim da linha do detalhe (07/11, crítica: na grade das doses ele
                            sobrava sozinho numa 3ª linha e deixava a linha alta) */}
                        {(detalhe || !simples) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-0.5">
                            {/* cada pedaço inteiro ("6 em 6 h", "até 13/11"): quebra entre eles, nunca no meio */}
                            {detalhe && (
                              <span className="text-[10px] text-muted-foreground" data-testid="remedio-detalhe">
                                {partesDoDetalhe.map((t, i) => <span key={i}>{i > 0 && " · "}<span className="whitespace-nowrap">{t}</span></span>)}
                              </span>
                            )}
                            {!simples && (
                              <button
                                type="button"
                                onClick={() => abrirOuFecharEdicao(g)}
                                aria-label={`Editar horários de ${g.nome}`}
                                aria-pressed={abertoPraEditar}
                                className={`h-8 w-8 -my-1.5 shrink-0 rounded-md flex items-center justify-center hover:text-foreground ${abertoPraEditar ? "text-foreground bg-muted" : "text-muted-foreground/60"}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-3 text-xs text-muted-foreground align-top">
                        {simples ? (<>
                          <input
                            type="time"
                            value={linha.time}
                            aria-label={`Horário de ${g.nome}`}
                            onChange={e => changeTime(linha.id, e.target.value)}
                            className="bg-transparent text-xs text-muted-foreground min-w-[5.5rem] w-auto focus:outline-none focus:text-foreground"
                          />
                          {horarioDeHoje && (
                            <span className="block text-[10px] leading-tight text-muted-foreground" data-testid="remedio-horario-hoje">{horarioDeHoje}</span>
                          )}
                        </>) : (
                          /* uma pílula por dose: toque marca aquela dose. 32 px de altura (07/11,
                             crítica: com 24 px o dedo marcava a vizinha e o estoque descia junto).
                             GRADE FIXA de 2 colunas (1 em tela de menos de 380 px, pra tabela caber),
                             largura igual pra todas (48 px abaixo de 380 px, 52 acima) e 8 px entre as linhas
                             (07/11, 3ª rodada): o ✓ largo mudava a arrumação debaixo do dedo; agora
                             marcar só pinta a pílula e põe um selinho no canto, nada se mexe — e a
                             área de toque de 44 px do app não chega na pílula de cima/baixo.
                             Marcada = fundo verde claro com a hora em verde escuro (07/11, retomada:
                             branco sobre verde dava contraste 2,0 no escuro e 2,9 no claro). */
                          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-1 gap-y-2 w-max" data-testid={`remedio-doses-${g.chave}`}>
                            {g.itens.map(s => {
                              // com o horário mudado, a dose de hoje pode ser a de antes (hora e id de antes — lib/remedios, mudarHorarios)
                              const dose = doses.find(d => d.id === s.id || (!!s.idAntes && d.id === s.idAntes));
                              const hora = dose?.time ?? s.time;
                              const t = !!dose && foiTomada(dose);
                              const daVez = !encerrado && !t && daVezDose?.id === s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={encerrado || !dose}
                                  onClick={() => {
                                    // a dose desta pílula pela hora do TOQUE (08/11): com o dia virado desde o desenho,
                                    // a 08:00 desenhada era a de ontem — só refaz a tela e não grava
                                    const c = contaNoToque(g, desenho);
                                    const doseAgora = c && !c.encerrado ? c.doses.find(d => d.id === s.id || (!!s.idAntes && d.id === s.idAntes)) : undefined;
                                    if (!doseAgora) return;
                                    marcadaPelaCaixa.delete(g.chave); // a pílula mexeu: a caixa volta a escolher pelo relógio
                                    toggleTaken(doseAgora.id, doseAgora.dia);
                                  }}
                                  aria-pressed={t}
                                  aria-label={t ? `Desmarcar dose das ${hora} de ${g.nome}` : `Marcar dose das ${hora} de ${g.nome}`}
                                  data-testid={`dose-${s.id}`}
                                  data-da-vez={daVez || undefined}
                                  className={`relative h-8 w-12 min-[380px]:w-[3.25rem] rounded-md border text-[11px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${t ? "bg-[hsl(var(--saude-green)/0.15)] border-[hsl(var(--saude-green))] text-emerald-800 dark:text-emerald-300" : daVez ? "border-[hsl(var(--saude-green))] text-foreground" : "border-border text-muted-foreground hover:border-[hsl(var(--saude-green)/0.5)]"}`}
                                >
                                  {hora}
                                  {t && (
                                    <span aria-hidden className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-card border border-[hsl(var(--saude-green))] grid place-items-center">
                                      <Check className="w-2 h-2 text-[hsl(var(--saude-green))]" strokeWidth={3.5} />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="pl-2 pr-1 py-3 align-top">
                        <EstoqueEditavel nome={g.nome} valor={g.estoque} baixo={lowStock} onSalvar={n => changeStock(g, n)} />
                      </td>
                      {/* célula grudada precisa de fundo opaco: o do card, com o
                          verde de "tomado" por cima (a zebra do escuro, mais
                          específica, troca este fundo igual troca o das vizinhas) */}
                      <td className={`sticky right-0 pl-0 pr-1.5 py-1 align-top ${taken ? "[background:linear-gradient(hsl(var(--saude-green)/0.05),hsl(var(--saude-green)/0.05)),hsl(var(--card))]" : "bg-card"}`}>
                        <button onClick={() => removeGrupo(g)} aria-label={`Apagar ${g.nome}`}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>,
                  ];
                  /* horários e data de fim do grupo, pra corrigir sem recadastrar — numa linha
                     PRÓPRIA embaixo (07/11, crítica: dentro da célula os campos apertavam a
                     coluna do estoque e o número aparecia cortado) */
                  if (abertoPraEditar && !simples) linhas.push(
                    <motion.tr key={`${g.chave}-editar`} className="bg-muted/30">
                      <td colSpan={5} className="px-3 pb-3 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5" data-testid="remedio-editar">
                          <span className="w-full text-[10px] text-muted-foreground">
                            A 1ª dose ajusta as outras
                            {/* enquanto não começou, o começo à vista, só texto (conserto final 07/11: mudar a 1ª
                                dose depois de "Começa amanhã" desfazia a escolha, e esta fileira nem mostrava) */}
                            {comecoDoGrupo && <span data-testid="remedio-editar-comeca"> · começa {comecoDoGrupo}</span>}
                            {novosEm && <span data-testid="remedio-editar-novos"> · os novos valem a partir de {novosEm}</span>}
                          </span>
                          {g.itens.map((s, i) => (
                            <input
                              key={s.id}
                              type="time"
                              value={s.time}
                              aria-label={g.itens.length > 1 ? `Horário de ${g.nome} (${i + 1}ª dose)` : `Horário de ${g.nome}`}
                              onChange={e => changeTime(s.id, e.target.value)}
                              className={`${campoPequeno} w-[5.75rem]`}
                            />
                          ))}
                          {/* sem a chave (site), só mexe no fim de quem já tem — não nasce tratamento com fim aqui */}
                          {(vezesLigado || !!g.ate) && (<>
                            <span className="text-[11px] text-muted-foreground">até</span>
                            <input
                              type="date"
                              value={g.ate ?? ""}
                              aria-label={`Até quando de ${g.nome}`}
                              onChange={e => changeAte(g, e.target.value)}
                              className={`${campoPequeno} w-[8.5rem]`}
                            />
                          </>)}
                          <button type="button" onClick={() => { setEditando(null); comecoAoAbrir.current = null; }} className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold">Pronto</button>
                        </div>
                      </td>
                    </motion.tr>,
                  );
                  return linhas;
                })}
              </AnimatePresence>
              {/* Empty rows for visual padding */}
              {grupos.length < 4 && Array.from({ length: 4 - grupos.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-t border-border/50">
                  <td className="px-3 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-2 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum suplemento e remédio cadastrado</p>
        </div>
      )}

      {/* Add form */}
      <div className="px-4 pb-4 pt-2 space-y-2">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSupplement()}
            placeholder="Novo remédio ou suplemento..."
            className="text-xs h-9 flex-1"
          />
          {/* com 2+ doses o horário mora só na linha "Horários" embaixo (a 1ª de lá é a 1ª dose) — dois 08:00 sem rótulo confundiam */}
          {(newVezes === 1 || !vezesLigado) && (
            <Input
              type="time"
              value={newTime}
              onChange={e => mudarPrimeiraDose(e.target.value)}
              aria-label="Horário"
              className="text-xs h-9 w-24"
            />
          )}
          <button
            onClick={addSupplement}
            aria-label="Adicionar remédio"
            className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* de quem é (22/09): vazio = seu; o nome vai no lembrete ("Hora do Ômega 3 (Mãe)") */}
        <div className="flex gap-2">
          <Input
            value={newQuem}
            onChange={e => setNewQuem(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSupplement()}
            placeholder="Pra quem? (vazio = você · ex.: Filho, Mãe)"
            className="text-xs h-9 flex-1"
            list="saude-dependentes-remedio"
            aria-label="Pra quem é o remédio"
            data-testid="remedio-quem"
          />
          {/* quantidade da caixa (25/09): vira o estoque inicial; vazio = 30 */}
          <label className="flex items-center gap-1.5 h-9 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground flex-shrink-0">
            Qtd
            <input
              type="text"
              inputMode="numeric"
              value={newStock}
              onChange={e => setNewStock(soDigitos(e.target.value))}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => e.key === "Enter" && addSupplement()}
              aria-label="Quantidade em estoque"
              data-testid="remedio-qtd"
              className="w-9 bg-transparent text-foreground focus:outline-none"
            />
          </label>
        </div>
        {/* 07/11: quantas vezes ao dia — o horário de cima é a PRIMEIRA dose; as outras nascem daqui */}
        {vezesLigado && (<>
          <div className="flex items-center gap-2" role="group" aria-label="Quantas vezes por dia">
            <span className="text-[11px] text-muted-foreground shrink-0">Quantas vezes</span>
            <div className="flex-1 grid grid-cols-4 gap-1">
              {OPCOES_VEZES.map(o => (
                <button
                  type="button"
                  key={o.vezes}
                  aria-pressed={newVezes === o.vezes}
                  onClick={() => escolherVezes(o.vezes)}
                  className={`h-8 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${newVezes === o.vezes ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
          {newVezes > 1 && (
            <div className="space-y-1.5" data-testid="remedio-horarios">
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <p className="text-[11px] text-muted-foreground">
                  Horários · {rotuloDosHorarios(horarios)} <span className="opacity-70">(a 1ª dose ajusta as outras)</span>
                </p>
                {/* 07/11 (4ª rodada da crítica): o começo do tratamento à vista, só texto — um toque troca
                    hoje/amanhã. Quem cadastra às 23:30 e começa amanhã não ganha aviso à meia-noite. */}
                {comeco && (
                  <button
                    type="button"
                    onClick={() => {
                      // o DIA, pela hora do toque: hoje ↔ amanhã
                      const agoraDoToque = new Date();
                      const hojeDoToque = localDayKey(agoraDoToque);
                      setDiaDoComeco(comeco.amanha ? hojeDoToque : localDayKey(new Date(agoraDoToque.getFullYear(), agoraDoToque.getMonth(), agoraDoToque.getDate() + 1)));
                    }}
                    aria-label={`Começa ${comeco.amanha ? "amanhã" : "hoje"} às ${horarios[0]}. Tocar muda pra ${comeco.amanha ? "hoje" : "amanhã"}`}
                    className="h-8 -my-1.5 shrink-0 text-[11px] font-semibold text-foreground underline decoration-dotted underline-offset-2"
                    data-testid="remedio-comeca"
                  >
                    Começa {comeco.amanha ? "amanhã" : "hoje"} {horarios[0]}
                  </button>
                )}
              </div>
              <div className={`grid gap-1.5 ${horarios.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {horarios.map((h, i) => (
                  <input
                    key={i}
                    type="time"
                    value={h}
                    aria-label={`${i + 1}ª dose`}
                    onChange={e => editarHorarioNovo(i, e.target.value)}
                    className={`${campoPequeno} w-full min-w-0`}
                  />
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">Até quando <span className="opacity-70">(opcional)</span></span>
            <input
              type="date"
              value={newAte}
              min={today}
              onChange={e => setNewAte(e.target.value)}
              aria-label="Até quando (opcional)"
              data-testid="remedio-ate"
              className={`${campoPequeno} flex-1 min-w-0`}
            />
          </label>
          {/* 07/11 (retomada): o lembrete do celular é agendado pelo app do celular — a versão
              antiga não conhece "até quando" nem o começo do tratamento e avisaria todo dia,
              pra sempre. Só no site, só quando a pessoa usa o que é novo. */}
          {!isNativeShell() && (newVezes > 1 || !!newAte) && (
            <p className="text-[10px] leading-snug text-muted-foreground" data-testid="remedio-aviso-app">
              No celular, atualize o app do CORE pro lembrete seguir estes horários e parar na data.
            </p>
          )}
        </>)}
        {alarmeExato === "denied" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" data-testid="remedio-alarme-exato">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <AlarmClock className="w-3.5 h-3.5 shrink-0" /> O aviso do remédio pode atrasar
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              O Android só entrega na hora certa com <strong className="text-foreground">Alarmes e lembretes</strong> liberado pro CORE.
            </p>
            <button
              type="button"
              onClick={() => void liberarAlarmeExato()}
              className="mt-2 h-8 w-full rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-[.99] transition-transform"
            >
              Liberar na hora certa
            </button>
          </div>
        )}
        <datalist id="saude-dependentes-remedio">
          {dependentes.map(d => <option key={d} value={d} />)}
        </datalist>
      </div>
    </div>
  );
};
