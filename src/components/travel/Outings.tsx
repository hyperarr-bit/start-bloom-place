import { useMemo, useState } from "react";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Outing, OutingType, OUTING_TYPES, genId, formatCurrency, mesDaChave } from "./types";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { Pencil, Trash2, Check, X } from "lucide-react";

/**
 * PASSEIOS — a aba leve do módulo (pedido de usuária real, 08/2026):
 * "Viagens poderia incluir passeios, pq às vezes é algo simples como uma ida
 * no cinema, ou um jantar fora."
 *
 * POR QUE ABA PRÓPRIA e não dentro de Destinos: destino da bucket list é um
 * SONHO SEM DATA, organizado por prioridade (sonho/planejando/próximo) — um
 * cinema no sábado não é nada disso, e cairia enterrado embaixo de três
 * seções coloridas. Passeio é o oposto do resto do módulo: já aconteceu (ou
 * acontece essa semana), tem dia, e o que interessa é quanto saiu no mês.
 * Misturar os dois faria a pessoa procurar o cinema no meio de "Tóquio".
 *
 * POR QUE POUCOS CAMPOS: o que trava o registro é o formulário. Nome e data
 * bastam; custo, notas e foto são bônus. Só o nome é obrigatório.
 */

type Rascunho = {
  name: string;
  date: string;
  type: OutingType;
  cost: string;
  notes: string;
  photoUrl: string;
};

const TIPOS = Object.entries(OUTING_TYPES) as [OutingType, { label: string; emoji: string }][];

const rascunhoVazio = (): Rascunho => ({
  name: "",
  date: localDayKey(), // já nasce com HOJE: o passeio quase sempre é de hoje
  type: "cinema",
  cost: "",
  notes: "",
  photoUrl: "",
});

const doRascunho = (r: Rascunho, id: string): Outing => ({
  id,
  name: r.name.trim(),
  date: r.date || localDayKey(),
  type: r.type,
  cost: Number(r.cost) || 0,
  notes: r.notes.trim(),
  photoUrl: r.photoUrl,
});

const paraRascunho = (o: Outing): Rascunho => ({
  name: o.name,
  date: o.date,
  type: o.type,
  cost: o.cost ? String(o.cost) : "",
  notes: o.notes || "",
  photoUrl: o.photoUrl || "",
});

/** Campos compartilhados por "adicionar" e "editar" — mesmo formulário nos
 *  dois lugares, senão editar vira um segundo jeito de errar. Componente no
 *  topo do módulo (e não dentro do Outings) pra não remontar a cada tecla e
 *  fazer o input perder o foco. */
const CamposPasseio = ({
  valor,
  aoMudar,
  aoConfirmar,
}: {
  valor: Rascunho;
  aoMudar: (patch: Partial<Rascunho>) => void;
  aoConfirmar: () => void;
}) => (
  <div className="space-y-2">
    <div className="flex gap-2">
      <Input
        placeholder="O que foi? (ex: cinema com a Ana)"
        value={valor.name}
        onChange={e => aoMudar({ name: e.target.value })}
        onKeyDown={e => e.key === "Enter" && aoConfirmar()}
        className="h-9 text-xs flex-1 bg-background/60"
      />
      <div className="w-28 shrink-0">
        <CampoData
          rotulo="Data"
          value={valor.date}
          onChange={e => aoMudar({ date: e.target.value })}
          className="h-9 text-xs bg-background/60"
        />
      </div>
    </div>

    {/* Tipo em chips e não em <select>: 5 opções, alvo grande, um toque só */}
    <div className="flex gap-1.5 flex-wrap">
      {TIPOS.map(([key, cfg]) => (
        <button
          key={key}
          onClick={() => aoMudar({ type: key })}
          aria-pressed={valor.type === key}
          className={`h-9 px-2.5 rounded-lg border text-[11px] flex items-center gap-1 transition-all ${
            valor.type === key
              ? "border-foreground bg-foreground text-background font-medium"
              : "border-border bg-background/50 hover:border-foreground/30"
          }`}
        >
          <span>{cfg.emoji}</span>
          {cfg.label}
        </button>
      ))}
    </div>

    <div className="flex gap-2">
      <Input
        type="number"
        inputMode="decimal"
        placeholder="Custo R$ (opcional)"
        value={valor.cost}
        onChange={e => aoMudar({ cost: e.target.value })}
        onKeyDown={e => e.key === "Enter" && aoConfirmar()}
        className="h-9 text-xs w-32 bg-background/60 tabular-nums"
      />
      <Input
        placeholder="Notas (opcional)"
        value={valor.notes}
        onChange={e => aoMudar({ notes: e.target.value })}
        onKeyDown={e => e.key === "Enter" && aoConfirmar()}
        className="h-9 text-xs flex-1 bg-background/60"
      />
    </div>

    <PhotoPicker
      value={valor.photoUrl || undefined}
      onChange={v => aoMudar({ photoUrl: v })}
      onClear={() => aoMudar({ photoUrl: "" })}
      label="Adicionar foto (opcional)"
    />
  </div>
);

export const Outings = () => {
  const [outings, setOutings] = usePersistedState<Outing[]>("travel-outings", []);
  const [novo, setNovo] = useState<Rascunho>(rascunhoVazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio);

  const adicionar = () => {
    if (!novo.name.trim()) return;
    setOutings(prev => [...prev, doRascunho(novo, genId())]);
    setNovo(rascunhoVazio());
  };

  const comecarEdicao = (o: Outing) => {
    setEditandoId(o.id);
    setRascunho(paraRascunho(o));
  };

  const salvarEdicao = () => {
    if (!rascunho.name.trim()) return;
    setOutings(prev => prev.map(o => (o.id === editandoId ? doRascunho(rascunho, o.id) : o)));
    setEditandoId(null);
  };

  const remover = (id: string) => {
    setOutings(prev => prev.filter(o => o.id !== id));
    if (editandoId === id) setEditandoId(null);
  };

  // Mês pela CHAVE DE DIA LOCAL (localDayKey → "YYYY-MM-DD" → "YYYY-MM").
  // Com toISOString, todo passeio depois das ~21h cairia no mês seguinte no
  // último dia do mês — o mesmo bug que já sumiu com registro aqui (16/07).
  const mesAtual = mesDaChave(localDayKey());
  const { doMes, totalMes, ordenados } = useMemo(() => {
    const doMes = outings.filter(o => mesDaChave(o.date) === mesAtual);
    return {
      doMes,
      totalMes: doMes.reduce((s, o) => s + (o.cost || 0), 0),
      ordenados: [...outings].sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [outings, mesAtual]);

  const nomeDoMes = parseLocalDay(`${mesAtual}-01`).toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-3">
      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-fuchsia-200 dark:bg-fuchsia-800/50 px-2 py-1 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider">🎟️ PASSEIOS EM {nomeDoMes}</span>
          </div>
          <div className="bg-fuchsia-50 dark:bg-fuchsia-950/20 p-2.5 text-center">
            <p className="text-xl font-black">{doMes.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-amber-200 dark:bg-amber-800/50 px-2 py-1 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider">💸 GASTO NO MÊS</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 text-center">
            <p className="text-xl font-black tabular-nums">{formatCurrency(totalMes)}</p>
          </div>
        </div>
      </div>

      {/* Novo passeio */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-fuchsia-200 dark:bg-fuchsia-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">✨ NOVO PASSEIO</span>
        </div>
        <div className="bg-fuchsia-50 dark:bg-fuchsia-950/20 p-3 space-y-2">
          <CamposPasseio
            valor={novo}
            aoMudar={patch => setNovo(p => ({ ...p, ...patch }))}
            aoConfirmar={adicionar}
          />
          <button
            onClick={adicionar}
            aria-label="Adicionar passeio"
            className="h-9 w-full rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.99] transition-transform"
          >
            + Adicionar passeio
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-violet-200 dark:bg-violet-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📆 MEUS PASSEIOS</span>
          <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{outings.length}</span>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/20 divide-y divide-border">
          {ordenados.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">Nenhum passeio ainda</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Cinema, jantar fora, parque, show — o rolê simples também conta.
              </p>
            </div>
          )}

          {ordenados.map(o =>
            editandoId === o.id ? (
              <div key={o.id} className="p-3 bg-background/40 space-y-2">
                <CamposPasseio
                  valor={rascunho}
                  aoMudar={patch => setRascunho(p => ({ ...p, ...patch }))}
                  aoConfirmar={salvarEdicao}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={salvarEdicao}
                    className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
                  >
                    <Check className="w-3.5 h-3.5" /> Salvar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={o.id} className="px-3 py-2 flex items-center gap-2">
                {o.photoUrl ? (
                  <img src={o.photoUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center text-base shrink-0">
                    {OUTING_TYPES[o.type]?.emoji || "✨"}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{o.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {parseLocalDay(o.date).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                    {" • "}
                    {OUTING_TYPES[o.type]?.label || "Outro"}
                    {o.notes ? ` • ${o.notes}` : ""}
                  </p>
                </div>
                {o.cost > 0 && (
                  <span className="text-xs font-bold tabular-nums whitespace-nowrap">{formatCurrency(o.cost)}</span>
                )}
                {/* Ações SEMPRE visíveis: no celular não existe hover — a
                    lixeira escondida atrás de group-hover simplesmente não
                    aparece pra quem usa o app no telefone. */}
                <button
                  onClick={() => comecarEdicao(o)}
                  aria-label={`Editar ${o.name}`}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remover(o.id)}
                  aria-label={`Apagar ${o.name}`}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-background/60 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
