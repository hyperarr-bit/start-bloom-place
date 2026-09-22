import { useMemo, useState } from "react";
import { Bell, BellOff, CalendarPlus, Plus, Repeat, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { estadoPermissao, pedirPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo, type Leitor } from "@/lib/reagendar";
import { adicionarAoCalendario } from "@/lib/calendario";
import { trackEvent } from "@/lib/analytics";
import { parseLocalDay } from "@/lib/utils";
import {
  AVISOS, AVISO_PADRAO, CHAVE_COMPROMISSOS, DIAS_CURTOS, avisoDe, indiceSemana, ocorrencias,
  rotuloAviso, rotuloRepeticao, type Compromisso, type Ocorrencia,
} from "@/lib/compromissos";

/**
 * COMPROMISSOS na aba MEU MÊS da Rotina (22/09). O modelo e a conta dos
 * avisos estão em lib/compromissos; aqui é só tela: o que tem no dia
 * escolhido, o formulário de novo compromisso e a lista dos próximos.
 *
 * A permissão de notificação é pedida AQUI, no primeiro compromisso com
 * aviso — no Android 13+ a recusa é definitiva, e pedir na abertura do app
 * é jogar a chance fora (mesma regra dos remédios e das contas a vencer).
 */

const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * Rearma os avisos no sistema com a lista NOVA (o `get` deste render ainda
 * não enxerga a escrita — o leitor sobreposto entrega o valor novo ao
 * reagendador sem esperar o próximo render, como no PharmacyChecklist).
 */
export async function armarAvisosDeCompromissos(get: Leitor, lista: Compromisso[], pedir: boolean): Promise<void> {
  if (!isNativeShell()) return;
  const estado = await estadoPermissao();
  if (estado === "prompt" && pedir) {
    const ok = await pedirPermissao();
    trackEvent("compromisso_permissao", { concedida: ok, total: lista.length });
    if (!ok) return;
  } else if (estado !== "granted") return;
  const leitor: Leitor = (k, fb) => (k === CHAVE_COMPROMISSOS ? (lista as unknown as typeof fb) : get(k, fb));
  try { await reagendarTudo(leitor, lerPrefs(get<unknown>(CHAVE_PREFS, undefined))); } catch { /* sem plugin */ }
}

const diaLongo = (dia: string) =>
  parseLocalDay(dia).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

const diaCurto = (dia: string) =>
  parseLocalDay(dia).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "");

/* ------------------------------------------------------------ formulário */

const FormCompromisso = ({ dia, onSalvar, onCancelar }: { dia: string; onSalvar: (c: Compromisso) => void; onCancelar: () => void }) => {
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("09:00");
  const [repete, setRepete] = useState(false);
  const [dias, setDias] = useState<number[]>([indiceSemana(parseLocalDay(dia))]);
  const [aviso, setAviso] = useState<number>(AVISO_PADRAO);
  const [local, setLocal] = useState("");

  const salvar = () => {
    if (!titulo.trim()) { toast.error("Dá um nome pro compromisso"); return; }
    if (!/^\d{1,2}:\d{2}$/.test(hora)) { toast.error("Escolhe a hora"); return; }
    if (repete && dias.length === 0) { toast.error("Marca pelo menos um dia da semana"); return; }
    onSalvar({
      id: novoId(),
      titulo: titulo.trim(),
      data: dia,
      hora,
      ...(repete ? { repete: [...dias].sort((a, b) => a - b) } : {}),
      aviso,
      ...(local.trim() ? { local: local.trim() } : {}),
    });
  };

  return (
    <div className="mt-2 p-3 rounded-md border border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/20 space-y-2" data-testid="form-compromisso">
      <Input
        placeholder="O quê? (ex.: Médico, Reunião, Jiu-jitsu)"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && salvar()}
        className="h-8 text-xs"
        autoFocus
        aria-label="Nome do compromisso"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground flex flex-col gap-1">
          Hora
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-8 text-xs" aria-label="Hora do compromisso" />
        </label>
        <label className="text-[10px] text-muted-foreground flex flex-col gap-1">
          Avisar
          <select
            value={aviso}
            onChange={(e) => setAviso(Number(e.target.value))}
            className="h-8 text-[11px] rounded-md border border-input bg-background px-1.5"
            aria-label="Antecedência do aviso"
          >
            {AVISOS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <Checkbox checked={repete} onCheckedChange={(v) => setRepete(!!v)} className="h-3.5 w-3.5" />
        Repete toda semana
      </label>
      {repete && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Dias da semana">
          {DIAS_CURTOS.map((d, i) => {
            const on = dias.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDias((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                className={`px-2 h-7 rounded-md text-[11px] font-semibold border transition-colors ${on ? "bg-sky-600 text-white border-sky-600" : "bg-background text-muted-foreground border-border"}`}
                aria-pressed={on}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}
      <Input placeholder="Onde? (opcional)" value={local} onChange={(e) => setLocal(e.target.value)} className="h-8 text-xs" aria-label="Local" />
      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} className="h-8 text-xs flex-1 bg-sky-600 hover:bg-sky-700 text-white">Salvar compromisso</Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} className="h-8 text-xs" aria-label="Cancelar"><X className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------- linha de item */

const LinhaOcorrencia = ({ o, onApagar, mostrarDia }: { o: Ocorrencia; onApagar: (c: Compromisso) => void; mostrarDia?: boolean }) => {
  const [confirmando, setConfirmando] = useState(false);
  const c = o.compromisso;
  const repeticao = rotuloRepeticao(c);
  const minutos = avisoDe(c);
  const noCelular = isNativeShell();

  const calendario = async () => {
    const r = await adicionarAoCalendario({ titulo: c.titulo, data: o.dia, hora: c.hora, local: c.local });
    if (r === "aberto") toast.success("Abrindo o calendário do celular");
    else if (r === "sem-app") toast.error("Não achei um app de calendário no celular");
    else if (r === "erro") toast.error("Não consegui abrir o calendário");
  };

  return (
    <div className="flex items-start gap-2 group" data-testid="compromisso-item">
      <span className="text-xs font-bold tabular-nums text-sky-700 dark:text-sky-300 w-11 shrink-0 pt-0.5">{c.hora}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-snug">
          {mostrarDia && <span className="text-muted-foreground font-normal mr-1.5">{diaCurto(o.dia)}</span>}
          {c.titulo}
        </p>
        <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          {repeticao && <span className="inline-flex items-center gap-0.5"><Repeat className="w-2.5 h-2.5" /> {repeticao}</span>}
          <span className="inline-flex items-center gap-0.5">
            {minutos < 0 ? <BellOff className="w-2.5 h-2.5" /> : <Bell className="w-2.5 h-2.5" />} {rotuloAviso(minutos)}
          </span>
          {c.local && <span>📍 {c.local}</span>}
        </p>
      </div>
      {noCelular && (
        <button type="button" onClick={() => void calendario()} title="Adicionar ao calendário do celular" aria-label="Adicionar ao calendário do celular" className="text-muted-foreground hover:text-foreground p-0.5">
          <CalendarPlus className="w-3.5 h-3.5" />
        </button>
      )}
      {confirmando ? (
        <button type="button" onClick={() => onApagar(c)} className="text-[10px] font-semibold text-red-500 whitespace-nowrap">
          {repeticao ? "apagar a série?" : "apagar?"}
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} aria-label={`Apagar ${c.titulo}`} className="text-red-400 hover:text-red-600 p-0.5 opacity-60 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------ compromissos do dia */

interface PropsDia {
  dia: string;
  lista: Compromisso[];
  onChange: (lista: Compromisso[]) => void;
}

export const CompromissosDoDia = ({ dia, lista, onChange }: PropsDia) => {
  const { get } = useUserData();
  const [abrindo, setAbrindo] = useState(false);
  const doDia = useMemo(() => ocorrencias(lista, parseLocalDay(dia), 1), [lista, dia]);

  const salvar = (c: Compromisso) => {
    const nova = [...lista, c];
    onChange(nova);
    setAbrindo(false);
    trackEvent("compromisso_criado", { repete: !!c.repete?.length, aviso: avisoDe(c) });
    toast.success(c.repete?.length ? `${c.titulo}: toda semana, ${rotuloRepeticao(c)}` : `${c.titulo} marcado pra ${diaLongo(dia)}`);
    void armarAvisosDeCompromissos(get, nova, avisoDe(c) >= 0);
  };

  const apagar = (c: Compromisso) => {
    const nova = lista.filter((x) => x.id !== c.id);
    onChange(nova);
    trackEvent("compromisso_apagado", { repete: !!c.repete?.length });
    void armarAvisosDeCompromissos(get, nova, false);
  };

  return (
    <div className="space-y-2" data-testid="compromissos-do-dia">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">📅 Compromissos — {diaLongo(dia)}</span>
        {!abrindo && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-sky-700 dark:text-sky-300" onClick={() => setAbrindo(true)} data-testid="novo-compromisso">
            <Plus className="w-3 h-3 mr-1" /> Compromisso
          </Button>
        )}
      </div>
      {doDia.length === 0 && !abrindo && (
        <p className="text-[11px] text-muted-foreground">Nada marcado com hora. Toque em + Compromisso — dá pra repetir toda semana e ser avisado antes.</p>
      )}
      {doDia.map((o) => <LinhaOcorrencia key={`${o.compromisso.id}-${o.dia}`} o={o} onApagar={apagar} />)}
      {abrindo && <FormCompromisso dia={dia} onSalvar={salvar} onCancelar={() => setAbrindo(false)} />}
    </div>
  );
};

/* ------------------------------------------------------------- próximos */

export const ProximosCompromissos = ({ lista, onChange, onAbrirDia }: { lista: Compromisso[]; onChange: (lista: Compromisso[]) => void; onAbrirDia: (dia: string) => void }) => {
  const { get } = useUserData();
  const proximos = useMemo(() => {
    const agora = new Date();
    return ocorrencias(lista, agora, 30).filter((o) => o.quando.getTime() >= agora.getTime() - 30 * 60_000).slice(0, 6);
  }, [lista]);

  const apagar = (c: Compromisso) => {
    const nova = lista.filter((x) => x.id !== c.id);
    onChange(nova);
    void armarAvisosDeCompromissos(get, nova, false);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" data-testid="proximos-compromissos">
      <div className="bg-gradient-to-r from-sky-500 to-blue-500 dark:from-sky-800 dark:to-blue-800 px-4 py-3 flex items-center gap-2">
        <Bell className="w-4 h-4 text-white" />
        <span className="font-bold text-sm text-white">PRÓXIMOS COMPROMISSOS</span>
      </div>
      <div className="p-3 space-y-2">
        {proximos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Toque num dia do calendário e adicione um compromisso com hora — consulta, reunião, aula. O CORE avisa antes, no celular.
          </p>
        ) : proximos.map((o) => (
          <div key={`${o.compromisso.id}-${o.dia}`} className="cursor-pointer" onClick={() => onAbrirDia(o.dia)}>
            <LinhaOcorrencia o={o} onApagar={apagar} mostrarDia />
          </div>
        ))}
      </div>
    </div>
  );
};
