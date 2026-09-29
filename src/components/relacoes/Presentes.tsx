import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  circuloDe, ehDaPessoa, lerReais, linkSeguro, presentesDe, quandoFalta, reais, ROTULO_STATUS, type Pessoa, type Presente,
} from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { BotaoAcao, Lacre, Quadradinho, Rotulo, Secao } from "./kit";
import { CAMPO } from "./kit-estilos";

/**
 * PRESENTES (29/09): as ideias guardadas ao longo do ano ("ela comentou que
 * queria…") agrupadas por pessoa, na ordem do próximo aniversário — quando a
 * data chega, a ideia já está lá. Cada ideia: ideia → comprado → entregue
 * (o mesmo ciclo de antes, agora com quadradinho e carimbo), preço opcional.
 */

export function AbaPresentes() {
  const { rel } = useNavegacaoRelacoes();
  const proxima = rel.itensDoAno.find((i) => i.tipo === "aniversario" && i.pessoaId && i.origem === "pessoa" && i.dias <= 60);
  const pessoaProxima = proxima ? rel.pessoas.find((p) => p.id === proxima.pessoaId) : undefined;

  // grupos: quem está na lista (pela ordem do aniversário), depois nomes digitados que não estão, depois sem ninguém
  const grupos = useMemo(() => {
    const ordemDias = new Map(rel.itensDoAno.filter((i) => i.origem === "pessoa").map((i) => [i.pessoaId, i.dias]));
    const comPessoa = rel.pessoas
      .map((p) => ({ chave: p.id, pessoa: p as Pessoa | undefined, nome: p.name, itens: presentesDe(p, rel.presentes) }))
      .filter((g) => g.itens.length)
      .sort((a, b) => (ordemDias.get(a.chave) ?? 999) - (ordemDias.get(b.chave) ?? 999));
    const soltos = rel.presentes.filter((g) => !rel.pessoas.some((p) => ehDaPessoa(p, g)));
    const porNome = new Map<string, Presente[]>();
    for (const g of soltos) porNome.set(g.person.trim() || "", [...(porNome.get(g.person.trim() || "") ?? []), g]);
    const outros = [...porNome.entries()].map(([nome, itens]) => ({ chave: `nome-${nome}`, pessoa: undefined, nome: nome || "Sem pessoa", itens }));
    return [...comPessoa, ...outros];
  }, [rel.pessoas, rel.presentes, rel.itensDoAno]);

  return (
    <div className="space-y-4">
      {pessoaProxima && proxima && <ProximaOcasiao pessoa={pessoaProxima} dias={proxima.dias} />}
      <Secao titulo="Ideias por pessoa" direita={rel.presentes.length ? `${rel.presentes.length} ${rel.presentes.length === 1 ? "ideia" : "ideias"}` : undefined} card="PRESENTES">
        {grupos.length ? (
          <div className="border-t border-border divide-y divide-border">
            {grupos.map((g) => <Grupo key={g.chave} pessoa={g.pessoa} nome={g.nome} itens={g.itens} />)}
          </div>
        ) : (
          <p className="px-3.5 pb-4 text-[13px] text-muted-foreground leading-snug">
            Ouviu “eu queria tanto um…”? Guarda aqui na hora. Quando o aniversário chegar, a ideia já está pronta.
          </p>
        )}
        <div className="border-t border-border px-3.5 py-3.5"><FormPresente /></div>
      </Secao>
    </div>
  );
}

function ProximaOcasiao({ pessoa, dias }: { pessoa: Pessoa; dias: number }) {
  const { rel, abrirFicha } = useNavegacaoRelacoes();
  const lista = presentesDe(pessoa, rel.presentes);
  const comprados = lista.filter((g) => g.status !== "idea").length;
  return (
    <Secao titulo="Próxima ocasião" direita={quandoFalta(dias)} card="PROXIMA OCASIAO">
      <button type="button" onClick={() => abrirFicha(pessoa.id)} className="flex w-full items-center gap-3 px-3.5 pb-3.5 text-left">
        <Lacre nome={pessoa.name} circulo={circuloDe(pessoa)} tamanho={40} />
        <span className="min-w-0 flex-1">
          <span className="rl-serif block text-[24px] leading-tight">{pessoa.name}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {lista.length
              ? `${lista.length} ${lista.length === 1 ? "ideia" : "ideias"} · ${comprados ? `${comprados} ${comprados === 1 ? "comprado" : "comprados"}` : "nada comprado ainda"}`
              : "Nenhuma ideia guardada ainda — toque pra abrir a ficha"}
          </span>
        </span>
        <span className="rl-carimbo">aniversário</span>
      </button>
    </Secao>
  );
}

function Grupo({ pessoa, nome, itens }: { pessoa?: Pessoa; nome: string; itens: Presente[] }) {
  const { rel, abrirFicha } = useNavegacaoRelacoes();
  const item = pessoa ? rel.itensDoAno.find((i) => i.origem === "pessoa" && i.pessoaId === pessoa.id) : undefined;
  const total = itens.filter((g) => g.status !== "delivered").reduce((s, g) => s + (g.preco ?? 0), 0);
  return (
    <div className="px-3.5 py-3" data-testid="grupo-presentes">
      <button type="button" disabled={!pessoa} onClick={() => pessoa && abrirFicha(pessoa.id)} className="flex w-full items-center gap-2.5 text-left">
        {pessoa ? <Lacre nome={pessoa.name} circulo={circuloDe(pessoa)} tamanho={28} /> : <span className="h-7 w-7 rounded-full border border-dashed border-border" />}
        <span className="rl-serif flex-1 truncate text-[21px] leading-tight">{nome}</span>
        <span className="text-right text-[11px] text-muted-foreground">
          {item ? `aniversário ${quandoFalta(item.dias)}` : ""}{item && total ? " · " : ""}{total ? reais(total) : ""}
        </span>
      </button>
      <ul className="mt-1.5">
        {itens.map((g) => {
          const link = linkSeguro(g.link);
          return (
            <li key={g.id} className="flex items-center gap-1 min-h-[44px]">
              <button type="button" onClick={() => rel.ciclarPresente(g.id)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label={`${g.idea}: ${ROTULO_STATUS[g.status]}. Tocar muda`}>
                <Quadradinho marcado={g.status !== "idea"} />
                <span className={cn("min-w-0 flex-1 line-clamp-2 text-[14px] leading-snug", g.status === "delivered" && "line-through text-muted-foreground")}>{g.idea}</span>
                {g.preco ? <span className="text-[12px] tabular-nums text-muted-foreground">{reais(g.preco)}</span> : null}
                {g.status !== "idea" && <span className="rl-carimbo shrink-0">{ROTULO_STATUS[g.status]}</span>}
              </button>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir o link de ${g.idea}`} className="grid h-11 w-9 place-items-center text-[hsl(var(--rl-tinta))]">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button type="button" onClick={() => rel.apagarPresente(g.id)} aria-label={`Apagar ${g.idea}`} className="-mr-2 grid h-11 w-9 place-items-center text-muted-foreground p-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FormPresente() {
  const { rel } = useNavegacaoRelacoes();
  const [pessoaId, setPessoaId] = useState("");
  const [outro, setOutro] = useState("");
  const [ideia, setIdeia] = useState("");
  const [preco, setPreco] = useState("");
  const [link, setLink] = useState("");
  const guardar = () => {
    if (!ideia.trim()) { toast.error("Escreve a ideia"); return; }
    const pessoa = rel.pessoas.find((p) => p.id === pessoaId);
    rel.adicionarPresente({ pessoa, person: pessoa?.name ?? outro, idea: ideia, link, preco: lerReais(preco) });
    setIdeia(""); setPreco(""); setLink("");
    toast.success("Ideia guardada", { duration: 2000 });
  };
  return (
    <div className="space-y-3" data-testid="form-presente">
      <p className="rl-caps text-[hsl(var(--rl-tinta))]">Guardar uma ideia</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Rotulo htmlFor="rl-pr-pessoa">Pra quem</Rotulo>
          <select id="rl-pr-pessoa" className="rl-select" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
            <option value="">Outra pessoa</option>
            {rel.pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <Rotulo htmlFor="rl-pr-preco">Preço</Rotulo>
          <input id="rl-pr-preco" className={CAMPO} inputMode="decimal" placeholder="Opcional" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </div>
      </div>
      {!pessoaId && (
        <input className={CAMPO} placeholder="Nome (opcional)" value={outro} onChange={(e) => setOutro(e.target.value)} aria-label="Nome de quem vai ganhar" />
      )}
      <input className={CAMPO} placeholder="A ideia: livro da Taylor, vale de massagem…" value={ideia} onChange={(e) => setIdeia(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && guardar()} aria-label="Ideia de presente" />
      <input className={CAMPO} placeholder="Link da loja (opcional)" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link" inputMode="url" />
      <BotaoAcao className="w-full" onClick={guardar}><Plus className="w-4 h-4" /> Guardar ideia</BotaoAcao>
    </div>
  );
}
