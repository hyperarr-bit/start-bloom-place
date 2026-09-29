import { useEffect, useRef, useState } from "react";
import { ExternalLink, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn, dataSegura } from "@/lib/utils";
import {
  CADENCIAS, CIRCULOS, CAMPOS_SUGERIDOS, circuloDe, ehDaPessoa, haQuanto, lerReais, linkSeguro, mesLongo,
  presentesDe, quandoFalta, reais, ROTULO_STATUS, rotuloDoFaz, situacaoDoContato, type Pessoa,
} from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { BotaoAcao, BotaoContorno, FaixaDaFolha, Lacre, Quadradinho } from "./kit";
import { CAMPO, focarNaFolha, FOLHA } from "./kit-estilos";

/**
 * A FICHA de uma pessoa (29/09): tudo o que o módulo sabe dela numa folha só —
 * aniversário e quantos anos faz, de quanto em quanto tempo lembrar de falar,
 * o que lembrar (gostos, tamanho, alergias), as ideias de presente e os
 * momentos juntos. É o "caderninho" que os apps de CRM pessoal vendem, dentro
 * do app que a pessoa já usa pra organizar a vida.
 */

export function FichaPessoa({ pessoaId, onFechar }: { pessoaId: string | null; onFechar: () => void }) {
  const { rel, abrirEdicao } = useNavegacaoRelacoes();
  // ao fechar, a folha ainda desliza: segue mostrando a última pessoa em vez de descer vazia
  const ultima = useRef<Pessoa | null>(null);
  const atual = pessoaId ? rel.pessoas.find((p) => p.id === pessoaId) ?? null : null;
  if (atual) ultima.current = atual;
  const p = atual ?? ultima.current;
  const aberta = !!atual;

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} onOpenAutoFocus={focarNaFolha} data-testid="ficha-pessoa">
        <SheetTitle className="sr-only">{p ? p.name : "Pessoa"}</SheetTitle>
        <SheetDescription className="sr-only">Aniversário, contato, o que lembrar, presentes e momentos.</SheetDescription>
        {p && (
          <>
            <FaixaDaFolha
              titulo={`${CIRCULOS.find((c) => c.id === circuloDe(p))?.rotulo ?? ""}${p.relation ? ` · ${p.relation}` : ""}`}
              onFechar={onFechar}
            />
            <div className="overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <Cabeca p={p} onEditar={() => abrirEdicao(p.id)} />
              <div className="px-4 space-y-4">
                <ManterContato p={p} />
                <OQueLembrar key={`notas-${p.id}`} p={p} />
                <Presentes p={p} />
                <Momentos p={p} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Cabeca({ p, onEditar }: { p: Pessoa; onEditar: () => void }) {
  const { rel, abrirMensagem } = useNavegacaoRelacoes();
  const item = rel.itensDoAno.find((i) => i.origem === "pessoa" && i.pessoaId === p.id);
  const hoje = item?.dias === 0;
  const pertinho = item != null && item.dias <= 1;
  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3.5">
        <Lacre nome={p.name} circulo={circuloDe(p)} tamanho={56} />
        <div className="min-w-0 flex-1">
          <p className="rl-serif text-[32px] leading-[1.05] break-words">{p.name}</p>
          {item ? (
            <p className="mt-1 text-[13px]">
              🎂 <b>{item.dia} de {mesLongo(item.mes)}</b>
              <span className="text-muted-foreground">
                {" · "}{hoje ? "é hoje!" : quandoFalta(item.dias)}{rotuloDoFaz(item) ? ` · ${rotuloDoFaz(item)}` : ""}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">Sem data de aniversário</p>
          )}
        </div>
      </div>
      <div className="mt-3.5 flex gap-2">
        <BotaoAcao className="flex-[1.4]" onClick={() => abrirMensagem(p.id, pertinho ? "parabens" : "oi")}>
          <MessageCircle className="w-4 h-4" /> {pertinho ? "Mandar parabéns" : "Mandar um oi"}
        </BotaoAcao>
        <BotaoContorno className="flex-1" onClick={onEditar}><Pencil className="w-4 h-4" /> Editar</BotaoContorno>
      </div>
    </div>
  );
}

function Bloco({ titulo, children, direita }: { titulo: string; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <section className="rl-cartao">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <h3 className="rl-caps text-[hsl(var(--rl-tinta))]">{titulo}</h3>
        {direita && <span className="ml-auto text-[11px] text-muted-foreground">{direita}</span>}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}

function ManterContato({ p }: { p: Pessoa }) {
  const { rel } = useNavegacaoRelacoes();
  const s = situacaoDoContato(p, rel.momentos);
  const falouHoje = !!rel.conversaDeHoje(p);
  return (
    <Bloco titulo="Manter contato" direita={s.ultimo ? `última conversa ${haQuanto(s.desde ?? 0)}` : "sem conversa anotada"}>
      <p className="rl-mini text-muted-foreground mb-2">Lembrar de falar</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lembrar de falar">
        {CADENCIAS.map((c) => (
          <button key={c.dias} type="button" className="rl-chip border !min-h-[38px] !px-3 !text-[12.5px]" aria-pressed={(p.cadencia ?? 0) === c.dias}
            onClick={() => rel.definirCadencia(p.id, c.dias)}>
            {c.rotulo}
          </button>
        ))}
      </div>
      {s.cadencia > 0 && (
        <p className="mt-2 text-[12px] text-muted-foreground" data-testid="proxima-conversa">
          {s.devido ? "Já está na hora de um oi." : `Próximo lembrete ${quandoFalta(-s.atraso)}.`}
        </p>
      )}
      <button type="button" onClick={() => rel.alternarConversaDeHoje(p)} aria-pressed={falouHoje}
        className="mt-2.5 flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border px-3 text-left text-[13.5px] font-semibold">
        <Quadradinho marcado={falouHoje} />
        <span className="flex-1">Falei com {p.name} hoje</span>
        {falouHoje && <span className="rl-carimbo rl-carimbar">anotado</span>}
      </button>
    </Bloco>
  );
}

function OQueLembrar({ p }: { p: Pessoa }) {
  const { rel } = useNavegacaoRelacoes();
  const [texto, setTexto] = useState(p.notes ?? "");
  const [salvo, setSalvo] = useState(false);
  const sujo = useRef(false);
  const ultimoTexto = useRef(texto);
  ultimoTexto.current = texto;
  const salvar = () => {
    if (!sujo.current) return;
    sujo.current = false;
    rel.editarPessoa(p.id, { notes: ultimoTexto.current.trim() });
    setSalvo(true);
  };
  // fechou a folha com o teclado aberto: o que foi escrito não se perde
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => () => salvarRef.current(), []);
  const campo = useRef<HTMLTextAreaElement>(null);
  /* Campos-sugestão (29/09, pesquisa: Dex/Monica vendem "lembrar do nome da filha
     da colega"): um toque começa uma linha nova com o rótulo, sem virar formulário. */
  const sugerir = (rotulo: string) => {
    const base = texto.replace(/\s+$/, "");
    const novo = `${base}${base ? "\n" : ""}${rotulo}: `;
    setTexto(novo);
    sujo.current = true;
    setSalvo(false);
    requestAnimationFrame(() => { const el = campo.current; if (el) { el.focus(); el.setSelectionRange(novo.length, novo.length); } });
  };
  return (
    <Bloco titulo="O que lembrar" direita={salvo ? "salvo ✓" : undefined}>
      <textarea
        ref={campo}
        aria-label={`O que lembrar sobre ${p.name}`}
        rows={4}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); sujo.current = true; setSalvo(false); }}
        onBlur={salvar}
        placeholder="Gostos, tamanho de roupa, alergias, o nome dos filhos, o que ela contou da última vez…"
        className="w-full resize-none bg-transparent text-[16px] outline-none rl-pautado placeholder:text-muted-foreground/80"
      />
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Começar uma linha">
        {CAMPOS_SUGERIDOS.filter((c) => !texto.includes(`${c}:`)).map((c) => (
          <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sugerir(c)}
            className="rl-chip border !min-h-[36px] !px-2.5 !text-[12px]">
            + {c}
          </button>
        ))}
      </div>
    </Bloco>
  );
}

function Presentes({ p }: { p: Pessoa }) {
  const { rel } = useNavegacaoRelacoes();
  const lista = presentesDe(p, rel.presentes);
  const [ideia, setIdeia] = useState("");
  const [preco, setPreco] = useState("");
  const guardar = () => {
    if (!ideia.trim()) return;
    rel.adicionarPresente({ pessoa: p, person: p.name, idea: ideia, link: "", preco: lerReais(preco) });
    setIdeia(""); setPreco("");
  };
  const total = lista.filter((g) => g.status !== "delivered").reduce((s, g) => s + (g.preco ?? 0), 0);
  return (
    <Bloco titulo="Ideias de presente" direita={total > 0 ? `${reais(total)} em ideias` : lista.length ? `${lista.length}` : undefined}>
      {lista.length > 0 && (
        <ul className="mb-3 divide-y divide-border">
          {lista.map((g) => {
            const link = linkSeguro(g.link);
            return (
              <li key={g.id} className="flex items-center gap-2 py-1.5 min-h-[44px]">
                <button type="button" onClick={() => rel.ciclarPresente(g.id)} className="flex min-h-[44px] flex-1 items-center gap-2.5 text-left"
                  aria-label={`${g.idea}: ${ROTULO_STATUS[g.status]}. Tocar muda pra ${ROTULO_STATUS[g.status === "idea" ? "bought" : g.status === "bought" ? "delivered" : "idea"]}`}>
                  <Quadradinho marcado={g.status !== "idea"} />
                  <span className={cn("flex-1 text-[14px] leading-snug", g.status === "delivered" && "line-through text-muted-foreground")}>{g.idea}</span>
                  {g.preco ? <span className="text-[12px] tabular-nums text-muted-foreground">{reais(g.preco)}</span> : null}
                  {g.status !== "idea" && <span className="rl-carimbo">{ROTULO_STATUS[g.status]}</span>}
                </button>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir o link de ${g.idea}`} className="grid h-11 w-9 place-items-center text-[hsl(var(--rl-tinta))]">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input className={CAMPO} placeholder={`Ideia pra ${p.name}…`} value={ideia} onChange={(e) => setIdeia(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardar()} aria-label="Nova ideia de presente" />
        <input className={cn(CAMPO, "!w-[92px] shrink-0")} placeholder="R$" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} aria-label="Preço (opcional)" />
        <button type="button" onClick={guardar} aria-label="Guardar ideia" className="rl-acao bg-[hsl(var(--rl-acao))] !px-0 w-11 shrink-0"><Plus className="w-5 h-5" /></button>
      </div>
      {lista.length > 0 && <p className="mt-2 text-[11.5px] text-muted-foreground">Toque na ideia: comprado → entregue.</p>}
    </Bloco>
  );
}

function Momentos({ p }: { p: Pessoa }) {
  const { rel } = useNavegacaoRelacoes();
  const lista = rel.momentos.filter((m) => ehDaPessoa(p, m)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const [texto, setTexto] = useState("");
  const guardar = () => {
    if (!texto.trim()) return;
    rel.adicionarMomento({ date: rel.hoje, pessoa: p, person: p.name, description: texto, tipo: "momento" });
    setTexto("");
  };
  return (
    <Bloco titulo="Momentos juntos" direita={lista.length ? undefined : "nenhum ainda"}>
      {lista.length > 0 && (
        <ul className="mb-3 space-y-2">
          {lista.map((m) => (
            <li key={m.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-[46px] shrink-0 text-[11px] font-bold tabular-nums text-[hsl(var(--rl-tinta))]">{dataSegura(m.date, "dd/MM")}</span>
              <span className="flex-1 text-[13.5px] leading-snug">{m.tipo === "conversa" ? "💬 " : m.tipo === "encontro" ? "☕ " : ""}{m.description}</span>
              <button type="button" onClick={() => rel.apagarMomento(m.id)} aria-label="Apagar momento" className="-mt-2 grid h-9 w-9 place-items-center text-muted-foreground p-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input className={CAMPO} placeholder="Um momento de hoje…" value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardar()} aria-label="Novo momento" />
        <button type="button" onClick={guardar} aria-label="Guardar momento" className="rl-acao bg-[hsl(var(--rl-acao))] !px-0 w-11 shrink-0"><Plus className="w-5 h-5" /></button>
      </div>
    </Bloco>
  );
}
