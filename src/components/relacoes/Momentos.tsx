import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { CampoData } from "@/components/ui/campo-data";
import { cn, dataSegura, mesAtualExtenso, parseLocalDay } from "@/lib/utils";
import { circuloDe, ehDaPessoa, ehDiaValido, mesCurto, type TipoMomento } from "@/lib/relacoes";
import { useNavegacaoRelacoes } from "./contexto";
import { BotaoAcao, Lacre, Rotulo, Secao } from "./kit";
import { CAMPO } from "./kit-estilos";

/**
 * MOMENTOS (29/09): o diário de gente. Agora com três jeitos — momento,
 * conversa, encontro — e todos contam como "a última vez que vocês se
 * falaram" no manter contato. A lista vira cartões-postais por mês.
 */

const TIPOS: { id: TipoMomento; emoji: string; rotulo: string }[] = [
  { id: "momento", emoji: "✨", rotulo: "Momento" },
  { id: "conversa", emoji: "💬", rotulo: "Conversa" },
  { id: "encontro", emoji: "☕", rotulo: "Encontro" },
];
const EMOJI: Record<TipoMomento, string> = { momento: "✨", conversa: "💬", encontro: "☕" };

export function AbaMomentos() {
  const { rel } = useNavegacaoRelacoes();
  const porMes = useMemo(() => {
    const ordenados = [...rel.momentos].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const grupos: { chave: string; titulo: string; itens: typeof ordenados }[] = [];
    for (const m of ordenados) {
      const chave = ehDiaValido(m.date) ? m.date.slice(0, 7) : "sem-data";
      let g = grupos.find((x) => x.chave === chave);
      if (!g) {
        g = { chave, titulo: chave === "sem-data" ? "Sem data" : mesAtualExtenso(parseLocalDay(`${chave}-01`)), itens: [] };
        grupos.push(g);
      }
      g.itens.push(m);
    }
    return grupos;
  }, [rel.momentos]);

  return (
    <div className="space-y-4">
      <NovoMomento />
      {porMes.map((g) => (
        <Secao key={g.chave} titulo={g.titulo} direita={`${g.itens.length}`} card="MOMENTOS">
          <ul className="border-t border-border divide-y divide-border" data-testid="momentos-do-mes">
            {g.itens.map((m) => {
              const pessoa = rel.pessoas.find((p) => ehDaPessoa(p, m));
              return (
                <li key={m.id} className="flex items-start gap-3 px-3.5 py-3">
                  <span className="flex w-[42px] shrink-0 flex-col items-center rounded-md border border-[hsl(var(--rl-tinta)/0.3)] py-1">
                    <span className="rl-serif text-[20px] leading-none text-[hsl(var(--rl-lacre))]">{ehDiaValido(m.date) ? dataSegura(m.date, "dd") : "—"}</span>
                    <span className="rl-mini text-[hsl(var(--rl-tinta))]">{ehDiaValido(m.date) ? mesCurto(Number(m.date.slice(5, 7))) : ""}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    {(pessoa || m.person) && (
                      <p className="flex items-center gap-1.5">
                        {pessoa && <Lacre nome={pessoa.name} circulo={circuloDe(pessoa)} tamanho={18} />}
                        <span className="rl-serif text-[18px] leading-tight">com {pessoa?.name ?? m.person}</span>
                      </p>
                    )}
                    <p className="text-[14px] leading-snug">
                      <span aria-hidden="true">{EMOJI[m.tipo ?? "momento"]} </span>{m.description || "—"}
                    </p>
                  </div>
                  <button type="button" onClick={() => rel.apagarMomento(m.id)} aria-label="Apagar momento" className="-mr-2 -mt-1 grid h-11 w-9 place-items-center text-muted-foreground p-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Secao>
      ))}
      {!porMes.length && (
        <p className="px-1 text-center text-[13px] text-muted-foreground leading-snug">
          Um almoço de domingo, uma ligação boa, o dia da surpresa: os momentos com as suas pessoas moram aqui.
        </p>
      )}
    </div>
  );
}

function NovoMomento() {
  const { rel } = useNavegacaoRelacoes();
  const [tipo, setTipo] = useState<TipoMomento>("momento");
  const [pessoaId, setPessoaId] = useState("");
  const [data, setData] = useState(rel.hoje);
  const [texto, setTexto] = useState("");
  const guardar = () => {
    if (!texto.trim()) { toast.error(tipo === "conversa" ? "Escreve do que vocês falaram" : "Escreve o que aconteceu"); return; }
    const pessoa = rel.pessoas.find((p) => p.id === pessoaId);
    rel.adicionarMomento({ date: ehDiaValido(data) ? data : rel.hoje, pessoa, person: pessoa?.name ?? "", description: texto, tipo });
    setTexto("");
    toast.success("Guardado", { duration: 2000 });
  };
  return (
    <Secao titulo="Novo momento" card="NOVO MOMENTO">
      <div className="space-y-3 px-3.5 pb-3.5" data-testid="form-momento">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" className={cn("rl-chip border !min-h-[40px] !px-3")} aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}>
              <span aria-hidden="true">{t.emoji}</span> {t.rotulo}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Rotulo htmlFor="rl-mo-pessoa">Com quem</Rotulo>
            <select id="rl-mo-pessoa" className="rl-select" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Ninguém</option>
              {rel.pessoas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Rotulo>Quando</Rotulo>
            <CampoData rotulo="Data" value={data} onChange={(e) => setData(e.target.value)} className="h-11 text-[16px]" aria-label="Data do momento" />
          </div>
        </div>
        <textarea
          rows={2}
          className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={tipo === "conversa" ? "Do que vocês falaram?" : tipo === "encontro" ? "Onde foram, o que fizeram…" : "O que aconteceu?"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="O que aconteceu"
        />
        <BotaoAcao className="w-full" onClick={guardar}><Plus className="w-4 h-4" /> Guardar</BotaoAcao>
      </div>
    </Secao>
  );
}
