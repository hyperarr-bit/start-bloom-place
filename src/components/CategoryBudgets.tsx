import { useState, type ReactNode } from "react";
import { Gauge, Pencil, Check, X, Target, Trash2, Tag, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useFinanceCategories, type FinanceCategory } from "@/lib/finance-categories";
import { doPerfil, nomeDoPerfil, PERFIL_PESSOAL, PERFIL_TODOS, type Perfil } from "@/lib/finance-perfil";

/**
 * LIMITES POR PERFIL (09/09) — cliente pagante: "a divisão de empresa e
 * pessoal não tá tão separado, na parte de ... orçamento".
 *
 * O que estava errado: `finance-category-budgets` era UM mapa de tetos, mas
 * os gastos que chegam aqui já vêm filtrados pelo perfil ativo (Index.tsx).
 * No perfil da empresa, o teto de "alimentação" da casa media o gasto da
 * empresa — número errado com cara de certo.
 *
 * Regra que manda no arquivo: o gasto comparado é SEMPRE do mesmo perfil do
 * teto. Cada perfil tem o seu mapa:
 *   - pessoal  → `finance-category-budgets`, a chave de sempre, intocada
 *                (quem nunca criou empresa não percebe nada; tutorial,
 *                virada de mês e Pergunte ao CORE continuam lendo dali);
 *   - empresas → `finance-category-budgets-perfis`, um único mapa
 *                `{ [idDaEmpresa]: { [categoria]: teto } }`.
 * Uma chave irmã ÚNICA com submapas, e não uma chave por empresa, por dois
 * motivos: `usePersistedState` lê a chave uma vez na montagem e não segue
 * troca de nome (uma chave por empresa exigiria remontar o cartão a cada
 * chip), e "Tudo junto" precisa de todos os mapas ao mesmo tempo.
 *
 * "Tudo junto" mostra um bloco por perfil, cada um com o SEU teto contra o
 * SEU gasto. Somar os tetos foi descartado: compararia um gasto misto com um
 * limite misto, e uma categoria com teto só na casa apareceria "estourada"
 * pelo gasto da empresa. O consolidado é de leitura — pra definir teto,
 * escolhe-se o perfil, porque o teto pertence a um perfil.
 */

interface CategoryBudgetsProps {
  expenses: { category: string; value: number; perfil?: string }[];
  /** Perfil ativo (PF/PJ). Sem a prop: pessoal, o comportamento de sempre. */
  perfil?: string;
  perfis?: Perfil[];
}

type Tetos = Record<string, number>;

const getBarHsl = (pct: number) => {
  // Paleta Apple Health: verde menta -> amarelo dourado -> laranja vivo -> vermelho coral
  const stops = [
    { p: 0,   r: 48,  g: 209, b: 88  }, // #30D158 verde menta
    { p: 70,  r: 48,  g: 209, b: 88  }, // mantém verde até 70%
    { p: 85,  r: 255, g: 214, b: 10  }, // #FFD60A amarelo dourado
    { p: 95,  r: 255, g: 159, b: 10  }, // #FF9F0A laranja vivo
    { p: 100, r: 255, g: 69,  b: 58  }, // #FF453A vermelho coral
    { p: 130, r: 200, g: 40,  b: 35  }, // vermelho mais escuro ao ultrapassar
  ];
  const p = Math.max(0, Math.min(pct, 130));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].p && p <= stops[i + 1].p) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.p - lo.p || 1;
  const t = (p - lo.p) / span;
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

interface BlocoProps {
  /** Só em "Tudo junto": o nome do perfil dono deste bloco. */
  titulo?: string;
  icone?: ReactNode;
  expenses: { category: string; value: number }[];
  budgets: Tetos;
  setBudgets: (t: Tetos) => void;
  categories: FinanceCategory[];
  somenteLeitura: boolean;
  /** Âncora do tutorial — só no bloco pessoal, pra não haver duas. */
  spotlight: boolean;
}

/** Um perfil: os tetos DELE contra os gastos DELE. */
const BlocoDeLimites = ({ titulo, icone, expenses, budgets, setBudgets, categories, somenteLeitura, spotlight }: BlocoProps) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const spentByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.value;
    return acc;
  }, {});

  const activeCats = categories.filter(c => budgets[c.value] || spentByCategory[c.value] || editing === c.value);
  const unsetCats = categories.filter(c => !budgets[c.value] && editing !== c.value);
  const hasBudgets = Object.keys(budgets).length > 0;
  const vazio = !hasBudgets && activeCats.length === 0 && !editing;

  const startEdit = (cat: string) => {
    setEditing(cat);
    setEditValue(budgets[cat]?.toString() || "");
  };

  const saveEdit = (cat: string) => {
    const val = parseFloat(editValue);
    if (val > 0) {
      setBudgets({ ...budgets, [cat]: val });
    }
    setEditing(null);
  };

  const removeLimit = (cat: string) => {
    const next = { ...budgets };
    delete next[cat];
    setBudgets(next);
    setEditValue("");
    setEditing(null);
  };

  return (
    <div className={titulo ? "border-t border-border first:border-t-0" : ""} data-testid={titulo ? `limites-${titulo}` : undefined}>
      {titulo && (
        <div className="px-3 pt-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {icone}
          {titulo}
        </div>
      )}

      {vazio ? (
        titulo ? (
          <p className="px-3 py-2 text-[10px] text-muted-foreground">Sem limites em {titulo}.</p>
        ) : (
          <EmptyState
            icon={Target}
            title="Sem limites definidos"
            description="Defina limites para controlar seus gastos por categoria e acompanhar visualmente"
          />
        )
      ) : (
        <div className="p-3 space-y-3">
          {/* Categories with budgets or spending */}
          {activeCats.map(cat => {
            const spent = spentByCategory[cat.value] || 0;
            const limit = budgets[cat.value] || 0;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const isEditing = editing === cat.value;

            return (
              <div key={cat.value} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveEdit(cat.value)}
                          className="h-6 w-20 text-[11px] px-1.5"
                          placeholder="Limite"
                          autoFocus
                        />
                        <button
                          type="button"
                          onPointerDown={e => { e.preventDefault(); saveEdit(cat.value); }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-green-500 hover:text-green-400 hover:bg-green-500/10 active:bg-green-500/20 touch-manipulation"
                          aria-label="Salvar"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onPointerDown={e => { e.preventDefault(); removeLimit(cat.value); }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 touch-manipulation"
                          aria-label="Remover limite"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          R$ {spent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                          {limit > 0 && <span> / R$ {limit.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>}
                        </span>
                        {!somenteLeitura && (
                          <button onClick={() => startEdit(cat.value)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={`Editar limite de ${cat.label}`}>
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {limit > 0 && (
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getBarHsl(pct) }}
                    />
                  </div>
                )}
                {limit > 0 && pct >= 100 && (
                  <p className="text-[10px] text-red-400 font-medium">
                    ⚠ Limite excedido em R$ {(spent - limit).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add limit for new category */}
      {!somenteLeitura && unsetCats.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-1.5">Adicionar limite:</p>
          <div className="flex flex-wrap gap-1" data-spotlight={spotlight ? "add-limit" : undefined}>
            {unsetCats.map(cat => (
              <button
                key={cat.value}
                onClick={() => startEdit(cat.value)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors hover:opacity-80 ${cat.color}`}
              >
                + {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const CategoryBudgets = ({ expenses, perfil = PERFIL_PESSOAL, perfis = [] }: CategoryBudgetsProps) => {
  // fonte única: categorias padrão + personalizadas (com renomear/excluir)
  const { allCats: categories, custom, renameCustom, removeCustom } = useFinanceCategories();
  const [budgetsPessoal, setBudgetsPessoal] = usePersistedState<Tetos>("finance-category-budgets", {});
  const [budgetsEmpresas, setBudgetsEmpresas] = usePersistedState<Record<string, Tetos>>("finance-category-budgets-perfis", {});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const consolidado = perfil === PERFIL_TODOS;
  const temEmpresas = perfis.length > 0;

  const blocoDe = (p: string) => ({
    perfil: p,
    nome: nomeDoPerfil(p, perfis),
    // `expenses` já chega filtrado pelo perfil ativo; filtrar de novo é
    // idempotente num perfil só e é o que reparte o consolidado.
    expenses: doPerfil(expenses, p),
    budgets: p === PERFIL_PESSOAL ? budgetsPessoal : (budgetsEmpresas[p] ?? {}),
    setBudgets: p === PERFIL_PESSOAL
      ? setBudgetsPessoal
      : (t: Tetos) => setBudgetsEmpresas({ ...budgetsEmpresas, [p]: t }),
  });
  const blocos = consolidado
    ? [PERFIL_PESSOAL, ...perfis.map((x) => x.id)].map(blocoDe)
    : [blocoDe(perfil)];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-bold tracking-wide uppercase">Limites por Categoria</span>
          {/* A aba Limites não tem o seletor de perfil (ele mora em MEU
              FINANCEIRO): sem este aviso a pessoa não sabe de quem são os
              tetos que está vendo. Some pra quem não tem empresa. */}
          {temEmpresas && (
            <span className="ml-auto text-[10px] font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap" data-testid="limites-perfil-ativo">
              {consolidado ? <span>Σ</span> : perfil === PERFIL_PESSOAL ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
              {consolidado ? "Tudo junto" : nomeDoPerfil(perfil, perfis)}
            </span>
          )}
        </div>

        {consolidado && (
          <p className="px-4 py-1.5 text-[10px] text-muted-foreground border-b border-border bg-muted/10">
            Cada perfil com o próprio teto. Para definir ou mudar um limite, escolha Pessoal ou uma empresa.
          </p>
        )}

        {blocos.map((b) => (
          <BlocoDeLimites
            key={b.perfil}
            titulo={consolidado ? b.nome : undefined}
            icone={b.perfil === PERFIL_PESSOAL ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            expenses={b.expenses}
            budgets={b.budgets}
            setBudgets={b.setBudgets}
            categories={categories}
            somenteLeitura={consolidado}
            spotlight={b.perfil === PERFIL_PESSOAL}
          />
        ))}
      </div>

      {/* Suas categorias personalizadas: renomear / excluir */}
      {custom.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold tracking-wide uppercase">Suas categorias</span>
          </div>
          <div className="p-3 space-y-1.5">
            {custom.map(cat => {
              const isRenaming = renaming === cat.value;
              return (
                <div key={cat.value} className="flex items-center justify-between gap-2">
                  {isRenaming ? (
                    <>
                      <Input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const r = renameCustom(cat.value, renameValue);
                            if (r.error) { toast.error(r.error); return; }
                            setRenaming(null);
                          }
                        }}
                        maxLength={24}
                        autoFocus
                        className="h-7 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onPointerDown={e => { e.preventDefault(); const r = renameCustom(cat.value, renameValue); if (r.error) { toast.error(r.error); return; } setRenaming(null); }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-green-500 hover:bg-green-500/10"
                        aria-label="Salvar nome"
                      ><Check className="w-4 h-4" /></button>
                      <button
                        type="button"
                        onPointerDown={e => { e.preventDefault(); setRenaming(null); }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label="Cancelar"
                      ><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setRenaming(cat.value); setRenameValue(cat.label); }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                          aria-label={`Renomear ${cat.label}`}
                        ><Pencil className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => { removeCustom(cat.value); toast.success("Categoria removida"); }}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                          aria-label={`Excluir ${cat.label}`}
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1">
              Excluir tira a categoria da lista, mas os gastos já lançados nela continuam intactos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
