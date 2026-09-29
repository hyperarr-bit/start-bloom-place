import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { CampoData } from "@/components/ui/campo-data";
import { cn, dataSegura, parseLocalDay } from "@/lib/utils";
import {
  diasEntre, ehDiaValido, mesCurto, quandoFalta, rotuloDoFaz, type DataEspecial, type ItemDeData,
} from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { BotaoAcao, BotaoContorno, Quadradinho, Rotulo, Secao } from "./kit";
import { CAMPO } from "./kit-estilos";

/**
 * DATAS (29/09) — a antiga AGENDA + os EVENTOS numa aba só (as duas somadas
 * tinham 150 pessoas e 3–7 s por visita). Em cima, a página de planner que
 * toda agenda de papel tem: "o ano em datas", mês a mês. Depois, a lista do
 * que vem aí com quantos anos cada data completa ("3 anos juntos" é conta,
 * não título — o "1 ano de namoro" gravado no ano passado mentia neste). E
 * os eventos, com o que falta fazer pra cada um.
 */

const TIPOS: { id: DataEspecial["type"]; rotulo: string; exemplo: string }[] = [
  { id: "anniversary", rotulo: "De casal", exemplo: "Namoro, casamento…" },
  { id: "custom", rotulo: "Outra data", exemplo: "Formatura, dia que adotei a Mel…" },
  { id: "birthday", rotulo: "Aniversário", exemplo: "De alguém fora da lista" },
];

const ROTULO_TIPO: Record<ItemDeData["tipo"], string> = { aniversario: "Aniversário", casal: "Data de casal", data: "Data especial" };

/** Quantos dias desde o começo (a data de casal com ano) até hoje. */
const diasJuntos = (ano: number, mes: number, dia: number) => diasEntre(new Date(ano, mes - 1, dia), new Date());

export function AbaDatas() {
  return (
    <div className="space-y-4">
      <AnoEmDatas />
      <ProximasDaLista />
      <Eventos />
    </div>
  );
}

/* ------------------------------------------------------------------ o ano em datas */

function AnoEmDatas() {
  const { rel, abrirFicha } = useNavegacaoRelacoes();
  const mesAtual = new Date().getMonth() + 1;
  const porMes = useMemo(() => {
    const m = new Map<number, ItemDeData[]>();
    for (const i of rel.itensDoAno) m.set(i.mes, [...(m.get(i.mes) ?? []), i]);
    for (const [k, v] of m) m.set(k, v.sort((a, b) => a.dia - b.dia));
    return m;
  }, [rel.itensDoAno]);
  if (!rel.itensDoAno.length) {
    return (
      <Secao titulo="O ano em datas" card="ANO EM DATAS">
        <p className="px-3.5 pb-4 text-[13px] text-muted-foreground leading-snug">
          Os aniversários das suas pessoas e as datas especiais aparecem aqui, mês a mês — como a página de aniversariantes da agenda de papel.
        </p>
      </Secao>
    );
  }
  // começa no mês de agora: o que vem primeiro fica em cima
  const ordem = Array.from({ length: 12 }, (_, k) => ((mesAtual - 1 + k) % 12) + 1);
  return (
    <Secao titulo="O ano em datas" direita={`${rel.itensDoAno.length} ${rel.itensDoAno.length === 1 ? "data" : "datas"}`} card="ANO EM DATAS">
      <div className="grid grid-cols-3 border-t border-border" data-testid="ano-em-datas">
        {ordem.map((mes, k) => {
          const itens = porMes.get(mes) ?? [];
          return (
            <div key={mes} className={cn("min-h-[84px] border-border px-2 py-2", k % 3 !== 2 && "border-r", k < 9 && "border-b")}>
              <p className={cn("rl-mini mb-1", mes === mesAtual ? "text-[hsl(var(--rl-lacre))]" : "text-muted-foreground")}>
                {mesCurto(mes)}{mes === mesAtual ? " · agora" : ""}
              </p>
              <ul className="space-y-0.5">
                {itens.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <button type="button" className="flex w-full items-baseline gap-1 text-left min-h-[24px]" disabled={!i.pessoaId || i.origem !== "pessoa"}
                      onClick={() => i.pessoaId && abrirFicha(i.pessoaId)}>
                      <span className={cn("text-[10.5px] font-bold tabular-nums", i.dias <= 30 ? "text-[hsl(var(--rl-lacre))]" : "text-[hsl(var(--rl-tinta))]")}>{String(i.dia).padStart(2, "0")}</span>
                      <span className="rl-serif truncate text-[15px] leading-tight">{i.titulo}</span>
                    </button>
                  </li>
                ))}
                {itens.length > 4 && <li className="text-[10.5px] text-muted-foreground">+{itens.length - 4}</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

/* ------------------------------------------------------------------ a lista do que vem aí + adicionar */

function ProximasDaLista() {
  const { rel, abrirFicha } = useNavegacaoRelacoes();
  const [nova, setNova] = useState(false);
  return (
    <Secao titulo="Todas as datas" direita="da mais perto pra mais longe" card="TODAS AS DATAS">
      <ul className="divide-y divide-border border-t border-border" data-testid="lista-datas">
        {rel.itensDoAno.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3.5 py-2 min-h-[56px]">
            <span className="flex w-[42px] shrink-0 flex-col items-center rounded-md border border-[hsl(var(--rl-tinta)/0.3)] py-1">
              <span className="rl-serif text-[20px] leading-none text-[hsl(var(--rl-lacre))]">{String(i.dia).padStart(2, "0")}</span>
              <span className="rl-mini text-[hsl(var(--rl-tinta))]">{mesCurto(i.mes)}</span>
            </span>
            <button type="button" className="min-w-0 flex-1 text-left" disabled={!i.pessoaId} onClick={() => i.pessoaId && abrirFicha(i.pessoaId)}>
              <span className="rl-serif block truncate text-[19px] leading-tight">{i.titulo}</span>
              <span className="rl-mini block text-muted-foreground">
                {ROTULO_TIPO[i.tipo]}{rotuloDoFaz(i) ? ` · ${rotuloDoFaz(i)}` : ""}
                {/* o contador "juntos há X dias" (os apps de casal grandes no Brasil vivem disto), só na data de casal com ano */}
                {i.tipo === "casal" && i.ano != null && diasJuntos(i.ano, i.mes, i.dia) > 0 ? ` · ${diasJuntos(i.ano, i.mes, i.dia).toLocaleString("pt-BR")} dias` : ""}
              </span>
            </button>
            <span className={cn("text-right text-[11.5px] font-bold", i.dias <= 30 ? "text-[hsl(var(--rl-lacre))]" : "text-muted-foreground")}>{quandoFalta(i.dias)}</span>
            {i.origem === "data" && (
              <button type="button" onClick={() => rel.apagarData(i.id)} aria-label={`Apagar ${i.titulo}`} className="-mr-2 grid h-11 w-9 place-items-center text-muted-foreground p-0">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
        {!rel.itensDoAno.length && <li className="px-3.5 py-4 text-[13px] text-muted-foreground">Nenhuma data ainda.</li>}
      </ul>
      <div className="px-3.5 py-3.5 border-t border-border">
        {nova ? <FormData onFechar={() => setNova(false)} /> : (
          <BotaoAcao className="w-full" onClick={() => setNova(true)}><Plus className="w-4 h-4" /> Adicionar data especial</BotaoAcao>
        )}
        <p className="mt-2 text-center text-[11.5px] text-muted-foreground">O aniversário de quem está em Pessoas entra sozinho.</p>
      </div>
    </Secao>
  );
}

function FormData({ onFechar }: { onFechar: () => void }) {
  const { rel } = useNavegacaoRelacoes();
  const [tipo, setTipo] = useState<DataEspecial["type"]>("anniversary");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const salvar = () => {
    if (!titulo.trim()) { toast.error("Dá um nome pra data"); return; }
    if (!ehDiaValido(data)) { toast.error("Escolhe a data"); return; }
    const pessoa = rel.pessoas.find((p) => p.id === pessoaId);
    rel.adicionarData({ title: titulo, date: data, type: tipo, pessoa, person: pessoa?.name ?? "" });
    onFechar();
  };
  return (
    <div className="space-y-3" data-testid="form-data">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de data">
        {TIPOS.map((t) => (
          <button key={t.id} type="button" className="rl-chip border !min-h-[40px] !px-3" aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}>{t.rotulo}</button>
        ))}
      </div>
      <div>
        <Rotulo htmlFor="rl-data-titulo">Nome da data</Rotulo>
        <input id="rl-data-titulo" className={CAMPO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={TIPOS.find((t) => t.id === tipo)?.exemplo} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo>Quando começou</Rotulo>
          <CampoData rotulo="Data" value={data} onChange={(e) => setData(e.target.value)} className="h-11 text-[16px]" aria-label="Data" />
        </div>
        <div>
          <Rotulo htmlFor="rl-data-pessoa">Com quem</Rotulo>
          <select id="rl-data-pessoa" className="rl-select" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
            <option value="">Ninguém</option>
            {rel.pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground">Repete todo ano. Com o ano certo, a gente conta quantos anos completa.</p>
      <div className="flex gap-2">
        <BotaoContorno className="flex-1" onClick={onFechar}>Cancelar</BotaoContorno>
        <BotaoAcao className="flex-[2]" onClick={salvar}>Guardar data</BotaoAcao>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ eventos */

const RSVP = {
  confirmed: { rotulo: "Vou", cls: "border-[hsl(var(--rl-ok))] text-[hsl(var(--rl-ok))]" },
  maybe: { rotulo: "Talvez", cls: "border-border text-muted-foreground" },
  declined: { rotulo: "Não vou", cls: "border-[hsl(var(--rl-lacre))] text-[hsl(var(--rl-lacre))]" },
} as const;

function Eventos() {
  const { rel } = useNavegacaoRelacoes();
  const [novo, setNovo] = useState(false);
  const [verPassados, setVerPassados] = useState(false);
  const hoje = parseLocalDay(rel.hoje);
  const ordenados = useMemo(() => [...rel.eventos].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")), [rel.eventos]);
  const futuros = ordenados.filter((e) => !ehDiaValido(e.date) || e.date >= rel.hoje);
  const passados = ordenados.filter((e) => ehDiaValido(e.date) && e.date < rel.hoje).reverse();
  return (
    <Secao titulo="Eventos" direita={futuros.length ? `${futuros.length} pela frente` : undefined} card="EVENTOS">
      <div className="border-t border-border">
        {futuros.map((e) => <CartaoEvento key={e.id} id={e.id} hoje={hoje} />)}
        {!futuros.length && (
          <p className="px-3.5 py-3.5 text-[13px] text-muted-foreground leading-snug">Churrasco, chá de bebê, casamento de alguém: o que levar e o que falta resolver.</p>
        )}
        {passados.length > 0 && (
          <div className="border-t border-border">
            <button type="button" className="min-h-[44px] w-full px-3.5 text-left text-[12.5px] font-semibold text-muted-foreground" onClick={() => setVerPassados(!verPassados)}>
              {verPassados ? "Esconder" : "Ver"} os que já passaram ({passados.length})
            </button>
            {verPassados && passados.map((e) => <CartaoEvento key={e.id} id={e.id} hoje={hoje} passado />)}
          </div>
        )}
      </div>
      <div className="px-3.5 py-3.5 border-t border-border">
        {novo ? <FormEvento onFechar={() => setNovo(false)} /> : (
          <BotaoContorno className="w-full" onClick={() => setNovo(true)}><Plus className="w-4 h-4" /> Adicionar evento</BotaoContorno>
        )}
      </div>
    </Secao>
  );
}

function CartaoEvento({ id, hoje, passado }: { id: string; hoje: Date; passado?: boolean }) {
  const { rel } = useNavegacaoRelacoes();
  const e = rel.eventos.find((x) => x.id === id);
  const [tarefa, setTarefa] = useState("");
  if (!e) return null;
  const feitas = e.tasks.filter((t) => t.done).length;
  const dias = ehDiaValido(e.date) ? diasEntre(hoje, parseLocalDay(e.date)) : null;
  const r = RSVP[e.rsvp];
  const addTarefa = () => { if (!tarefa.trim()) return; rel.adicionarTarefa(e.id, tarefa); setTarefa(""); };
  return (
    <div className={cn("px-3.5 py-3 border-b border-border last:border-b-0", passado && "opacity-70")} data-testid="evento">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="rl-serif text-[21px] leading-tight">{e.name}</p>
          <p className="text-[12px] text-muted-foreground">
            {dataSegura(e.date, "dd/MM/yyyy")}{dias != null && dias >= 0 ? ` · ${quandoFalta(dias)}` : ""}
          </p>
          {e.location && <p className="flex items-center gap-1 text-[12px] text-muted-foreground"><MapPin className="w-3 h-3 shrink-0" />{e.location}</p>}
        </div>
        <button type="button" onClick={() => rel.ciclarRsvp(e.id)} className={cn("min-h-[36px] rounded-full border-[1.5px] px-3 text-[11.5px] font-bold", r.cls)} aria-label={`Presença: ${r.rotulo}. Tocar muda`}>
          {r.rotulo}
        </button>
        <button type="button" onClick={() => rel.apagarEvento(e.id)} aria-label={`Apagar ${e.name}`} className="-mr-2 grid h-9 w-9 place-items-center text-muted-foreground p-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {e.tasks.length > 0 && (
        <ul className="mt-2">
          <li className="rl-mini text-muted-foreground mb-0.5">{feitas}/{e.tasks.length} resolvido</li>
          {e.tasks.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => rel.alternarTarefa(e.id, t.id)} className="flex min-h-[40px] w-full items-center gap-2.5 text-left" aria-pressed={t.done}>
                <Quadradinho marcado={t.done} />
                <span className={cn("text-[13.5px]", t.done && "line-through text-muted-foreground")}>{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!passado && (
        <div className="mt-2 flex gap-2">
          <input className={cn(CAMPO, "!min-h-[40px]")} placeholder="O que falta resolver?" value={tarefa} onChange={(ev) => setTarefa(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && addTarefa()} aria-label={`Nova tarefa de ${e.name}`} />
          <button type="button" onClick={addTarefa} aria-label="Adicionar tarefa" className="rl-contorno border !px-0 w-11 shrink-0"><Plus className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function FormEvento({ onFechar }: { onFechar: () => void }) {
  const { rel } = useNavegacaoRelacoes();
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const salvar = () => {
    if (!nome.trim()) { toast.error("Dá um nome pro evento"); return; }
    if (!ehDiaValido(data)) { toast.error("Escolhe a data do evento"); return; }
    rel.adicionarEvento({ name: nome, date: data, location: local });
    onFechar();
  };
  return (
    <div className="space-y-3" data-testid="form-evento">
      <div>
        <Rotulo htmlFor="rl-ev-nome">Evento</Rotulo>
        <input id="rl-ev-nome" className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Churrasco do Pedro, chá de bebê da Lu…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo>Quando</Rotulo>
          <CampoData rotulo="Data" value={data} onChange={(e) => setData(e.target.value)} className="h-11 text-[16px]" aria-label="Data do evento" />
        </div>
        <div>
          <Rotulo htmlFor="rl-ev-local">Onde</Rotulo>
          <input id="rl-ev-local" className={CAMPO} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="flex gap-2">
        <BotaoContorno className="flex-1" onClick={onFechar}>Cancelar</BotaoContorno>
        <BotaoAcao className="flex-[2]" onClick={salvar}>Guardar evento</BotaoAcao>
      </div>
    </div>
  );
}
