import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { Plus, Trash2, TrendingUp, Pencil, Check, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { format } from "date-fns";

interface PetExpense {
  id: string;
  petId: string;
  category: string;
  description: string;
  value: number;
  date: string;
}

// As 6 de sempre continuam FIXAS no código: são o padrão de quem acabou de
// abrir o app e não podem depender de nada gravado.
const CATEGORIAS_PADRAO = ["Ração", "Veterinário", "Banho/Tosa", "Medicamento", "Brinquedo", "Outro"];

export const PetExpenses = () => {
  const { get, set } = useUserData();
  const pets = get<any[]>("pet-list", []);
  const expenses = get<PetExpense[]>("pet-expenses", []);
  // Só as criadas pela pessoa vão pro banco — as padrão ficam fora da chave
  // pra que renomear/remover uma delas no futuro não exija migração de dados.
  const categoriasCustom = get<string[]>("pet-expense-categories", []);
  const categories = [...CATEGORIAS_PADRAO, ...categoriasCustom.filter(c => !CATEGORIAS_PADRAO.includes(c))];

  const [petId, setPetId] = useState("");
  const [category, setCategory] = useState("Ração");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localDayKey());
  const [novaCat, setNovaCat] = useState("");
  const [mostrarNovaCat, setMostrarNovaCat] = useState(false);

  const addExpense = () => {
    const v = parseFloat(value);
    if (!v || v <= 0) return;
    const updated = [...expenses, { id: Date.now().toString(), petId, category, description: description.trim(), value: v, date }];
    set("pet-expenses", updated);
    setDescription(""); setValue("");
  };

  const removeExpense = (id: string) => set("pet-expenses", expenses.filter(e => e.id !== id));

  /* ---------- categorias que a pessoa cria ---------- */

  const addCategoria = () => {
    const nome = novaCat.trim();
    if (!nome) return;
    // Compara ignorando acento e caixa: "racao" e "Ração" como duas categorias
    // diferentes quebraria o resumo do mês em dois pedaços da mesma coisa.
    const existente = categories.find(c => c.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
    if (!existente) set("pet-expense-categories", [...categoriasCustom, nome]);
    setCategory(existente || nome); // já deixa selecionada pro gasto que ela ia lançar
    setNovaCat("");
    setMostrarNovaCat(false);
  };

  // Trava dura: gasto já lançado ficaria órfão de categoria no extrato/resumo.
  const categoriaEmUso = (cat: string) => expenses.some(e => e.category === cat);

  const removeCategoria = (cat: string) => {
    if (categoriaEmUso(cat)) return;
    set("pet-expense-categories", categoriasCustom.filter(c => c !== cat));
    if (category === cat) setCategory(CATEGORIAS_PADRAO[0]);
  };

  // Um gasto antigo pode estar numa categoria que não existe mais na lista
  // (apagada quando ainda estava vazia). Sem isso o select da edição abriria
  // mostrando outra categoria e salvaria a errada sem a pessoa perceber.
  const opcoesCom = (cat: string) => categories.includes(cat) ? categories : [...categories, cat];

  /* ---------- edição na própria linha (padrão do IncomeTable) ---------- */

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ category: "", description: "", value: "", date: "" });

  const comecarEdicao = (e: PetExpense) => {
    setEditandoId(e.id);
    setRascunho({ category: e.category, description: e.description || "", value: String(e.value), date: e.date });
  };

  const salvarEdicao = () => {
    const v = parseFloat(rascunho.value);
    if (!Number.isFinite(v) || v <= 0) return;
    set("pet-expenses", expenses.map(e => e.id !== editandoId ? e : {
      ...e, // mantém id e petId
      category: rascunho.category,
      description: rascunho.description.trim(),
      value: v,
      date: rascunho.date || e.date,
    }));
    setEditandoId(null);
  };

  // Mês pelo fuso LOCAL: com toISOString, das 21h do dia 30 em diante o mês
  // virava antes da hora e o gasto lançado (que usa localDayKey) sumia do
  // extrato. É a regra fixada depois do bug de datas de julho.
  const currentMonth = localDayKey().slice(0, 7);
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalMonth = monthExpenses.reduce((s, e) => s + e.value, 0);

  // O resumo sai dos GASTOS, não da lista de categorias: montado a partir da
  // lista, um gasto numa categoria que saiu de lá (ou que veio de versão antiga
  // do app) simplesmente não aparecia — a soma por categoria não fechava com o
  // total do mês e parecia dinheiro sumido.
  const byCat = Array.from(new Set(monthExpenses.map(e => e.category || "Outro")))
    .map(cat => ({ cat, total: monthExpenses.filter(e => (e.category || "Outro") === cat).reduce((s, e) => s + e.value, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="mt-3 space-y-3">
      {/* Summary */}
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <p className="text-[10px] text-muted-foreground">Gastos este mês</p>
        <p className="text-xl font-bold">R$ {totalMonth.toFixed(2)}</p>
        {byCat.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {byCat.map(c => (
              <span key={c.cat} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">
                {c.cat}: R$ {c.total.toFixed(0)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-200">Gastos</span>
          </div>
          <span className="text-[10px] text-blue-600 dark:text-blue-300">{expenses.length}</span>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 space-y-1.5">
          {/* A tabela de 5 colunas saiu: com lápis e lixeira de 36px (o mínimo
              pro dedo) não sobrava largura nenhuma pro texto num celular. Vira
              a linha de duas alturas do IncomeTable — o que importa em cima,
              o resto embaixo em cinza. */}
          {monthExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => {
            const pet = pets.find((p: any) => p.id === e.petId);

            if (editandoId === e.id) {
              return (
                <div key={e.id} className="border border-primary/40 bg-background/70 rounded-lg p-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Editando · {pet?.name || "sem pet"}</p>
                  <select value={rascunho.category} onChange={ev => setRascunho({ ...rascunho, category: ev.target.value })} className="h-9 w-full text-[11px] bg-background border border-input rounded-md px-2">
                    {opcoesCom(rascunho.category).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input autoFocus placeholder="Descrição" value={rascunho.description} onChange={ev => setRascunho({ ...rascunho, description: ev.target.value })} className="h-9 text-[11px]" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input type="number" inputMode="decimal" placeholder="R$" value={rascunho.value} onChange={ev => setRascunho({ ...rascunho, value: ev.target.value })} className="h-9 text-[11px]" />
                    <CampoData rotulo="Data" value={rascunho.date} onChange={ev => setRascunho({ ...rascunho, date: ev.target.value })} className="h-9 text-[11px]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={salvarEdicao} className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="h-9 px-3 rounded-md border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            const rotulo = e.description || e.category;
            return (
              <div key={e.id} className="flex items-center gap-0.5 bg-background/60 rounded-lg px-2 py-1">
                {/* ações sempre visíveis: o group-hover de antes era invisível no celular */}
                <button onClick={() => comecarEdicao(e)} aria-label={`Editar gasto ${rotulo}`} className="flex items-center gap-2 flex-1 min-w-0 text-left min-h-9">
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs truncate">{rotulo}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {[pet?.name, e.category, format(new Date(e.date), "dd/MM")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-destructive shrink-0">-R${e.value.toFixed(0)}</span>
                </button>
                <button onClick={() => comecarEdicao(e)} aria-label={`Editar gasto ${rotulo}`} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => removeExpense(e.id)} aria-label={`Apagar gasto ${rotulo}`} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {monthExpenses.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum gasto este mês</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select value={petId} onChange={e => setPetId(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                {/* idem PetHealth: placeholder virava "pet fantasma" na lista */}
                <option value="" disabled hidden>Selecione o pet</option>
                {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={category} onChange={e => setCategory(e.target.value)} className="h-7 text-[11px] bg-background border border-input rounded-md px-2">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Categoria da pessoa, não a nossa: "Adestramento", "Areia",
                "Plano de saúde"… quem não achava a sua jogava tudo em "Outro"
                e o resumo do mês virava um bolo só. */}
            {!mostrarNovaCat ? (
              <button
                onClick={() => setMostrarNovaCat(true)}
                className="w-full h-9 flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                <Plus className="w-3 h-3" /> Nova categoria
              </button>
            ) : (
              <div className="rounded-md border border-dashed border-primary/40 bg-background/60 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    placeholder="Ex: Adestramento"
                    value={novaCat}
                    onChange={e => setNovaCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCategoria()}
                    className="h-9 text-[11px] flex-1"
                  />
                  <button onClick={addCategoria} aria-label="Salvar categoria" className="w-9 h-9 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setMostrarNovaCat(false); setNovaCat(""); }} aria-label="Cancelar nova categoria" className="w-9 h-9 shrink-0 rounded-md border border-border text-muted-foreground flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {categoriasCustom.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {categoriasCustom.map(c => {
                      const emUso = categoriaEmUso(c);
                      return (
                        <span key={c} className="inline-flex items-center h-9 rounded-full border border-border bg-background pl-3 text-[10px]">
                          {c}
                          {emUso ? (
                            // Apagar com gasto lançado deixaria o extrato apontando
                            // pra uma categoria inexistente — some do resumo e vira
                            // mais um caso de "meu dado sumiu".
                            <span className="px-2 text-[9px] text-muted-foreground">em uso</span>
                          ) : (
                            <button onClick={() => removeCategoria(c)} aria-label={`Apagar categoria ${c}`} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} className="h-7 text-[11px]" />
              <Input type="number" placeholder="R$" value={value} onChange={e => setValue(e.target.value)} className="h-7 text-[11px]" />
              <div className="relative">
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-7 text-[11px] appearance-none [&::-webkit-date-and-time-value]:text-left" />
              </div>
            </div>
            <button onClick={addExpense} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar gasto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
