import { useState } from "react";
import { Plus, Trash2, Tag, Camera, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptViewer } from "@/components/finance/ReceiptViewer";
import { toast } from "sonner";

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod: string;
  cardName?: string;
  tags?: string[];
  receiptUrl?: string;
}

interface ExpenseTableProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
}

const categories = [
  { value: "alimentacao", label: "Alimentação", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  { value: "restaurante", label: "Restaurante", color: "bg-amber-100/80 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { value: "mercado", label: "Mercado", color: "bg-lime-100/80 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300" },
  { value: "transporte", label: "Transporte", color: "bg-blue-100/80 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  { value: "combustivel", label: "Combustível", color: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  { value: "lazer", label: "Lazer", color: "bg-purple-100/80 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300" },
  { value: "entretenimento", label: "Entretenimento", color: "bg-violet-100/80 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { value: "saude", label: "Saúde", color: "bg-green-100/80 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  { value: "farmacia", label: "Farmácia", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { value: "vestuario", label: "Vestuário", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "beleza", label: "Beleza", color: "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  { value: "educacao", label: "Educação", color: "bg-teal-100/80 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  { value: "eletronicos", label: "Eletrônicos", color: "bg-red-100/80 text-red-600 dark:bg-red-500/15 dark:text-red-300" },
  { value: "servicos", label: "Serviços", color: "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" },
  { value: "delivery", label: "Delivery", color: "bg-yellow-100/80 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300" },
  { value: "presente", label: "Presente", color: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" },
  { value: "casa", label: "Casa", color: "bg-stone-100/80 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300" },
  { value: "pets", label: "Pets", color: "bg-slate-200/80 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  { value: "filhos", label: "Filhos", color: "bg-blue-200/80 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300" },
  { value: "viagem", label: "Viagem", color: "bg-pink-100/80 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  { value: "outros", label: "Outros", color: "bg-gray-100/80 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300" },
];

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
];

const cardOptions = [
  { value: "nubank", label: "Nubank", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "inter", label: "Inter", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "itau", label: "Itaú", color: "bg-blue-600/15 text-blue-700 dark:text-blue-300" },
  { value: "bradesco", label: "Bradesco", color: "bg-red-600/15 text-red-700 dark:text-red-300" },
  { value: "santander", label: "Santander", color: "bg-red-500/15 text-red-600 dark:text-red-300" },
  { value: "c6", label: "C6 Bank", color: "bg-gray-800/15 text-gray-700 dark:text-gray-300" },
  { value: "bb", label: "Banco do Brasil", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "caixa", label: "Caixa", color: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  { value: "neon", label: "Neon", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { value: "picpay", label: "PicPay", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "outro", label: "Outro", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

const tagColors = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
];

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return tagColors[Math.abs(hash) % tagColors.length];
};

const isCardPayment = (method: string) => method === "credito" || method === "debito";

export const ExpenseTable = ({ expenses, setExpenses }: ExpenseTableProps) => {
  const [newExpense, setNewExpense] = useState({
    description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "",
  });
  const [newTag, setNewTag] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const addExpense = () => {
    if (newExpense.description && newExpense.value) {
      setExpenses([
        ...expenses,
        {
          id: Date.now().toString(),
          description: newExpense.description,
          category: newExpense.category || "outros",
          value: parseFloat(newExpense.value),
          date: newExpense.date || new Date().toISOString().split("T")[0],
          paymentMethod: newExpense.paymentMethod || "pix",
          cardName: isCardPayment(newExpense.paymentMethod) ? (newExpense.cardName || "outro") : undefined,
          tags: newTags.length > 0 ? newTags : undefined,
        },
      ]);
      setNewExpense({ description: "", category: "", value: "", date: "", paymentMethod: "", cardName: "" });
      setNewTags([]);
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !newTags.includes(tag)) {
      setNewTags([...newTags, tag]);
      setNewTag("");
    }
  };

  const removeNewTag = (tag: string) => setNewTags(newTags.filter(t => t !== tag));

  const handleReceiptUpload = async (expenseId: string, file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login para anexar comprovantes"); return; }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${expenseId}.${ext}`;

      const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
      if (error) { toast.error("Erro ao enviar comprovante"); return; }

      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);

      setExpenses(expenses.map(e =>
        e.id === expenseId ? { ...e, receiptUrl: urlData.publicUrl } : e
      ));
      toast.success("Comprovante anexado!");
    } catch {
      toast.error("Erro ao enviar comprovante");
    }
  };

  const getCategoryStyle = (v: string) => categories.find((c) => c.value === v)?.color || "bg-gray-100/80 text-gray-700";
  const getCategoryLabel = (v: string) => categories.find((c) => c.value === v)?.label || v;
  const getCardStyle = (v: string) => cardOptions.find((c) => c.value === v)?.color || "bg-gray-500/15 text-gray-700";
  const getCardLabel = (v: string) => cardOptions.find((c) => c.value === v)?.label || v;
  const getPaymentLabel = (v: string) => paymentMethods.find((p) => p.value === v)?.label || v;

  // All unique tags
  const allTags = [...new Set(expenses.flatMap(e => e.tags || []))];

  const filteredExpenses = filterTag
    ? expenses.filter(e => e.tags?.includes(filterTag))
    : expenses;

  const total = filteredExpenses.reduce((sum, e) => sum + e.value, 0);

  return (
    <>
      <div className="bg-card rounded-lg overflow-hidden border border-border animate-fade-in">
        <div className="bg-income py-2 px-4 flex items-center justify-between">
          <span className="font-bold text-sm text-income-foreground tracking-wide">CUSTOS VARIÁVEIS</span>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-income-foreground/60" />
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="bg-transparent text-[10px] text-income-foreground border-0 outline-none cursor-pointer"
              >
                <option value="">Todas</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Descrição</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Categoria</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Valor</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Data</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Pagamento</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground text-xs">Cartão</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum gasto variável cadastrado</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Adicione compras, restaurantes, lazer, presentes...</p>
                  </td>
                </tr>
              )}
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span>{expense.description}</span>
                      {expense.tags && expense.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {expense.tags.map(tag => (
                            <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full ${getTagColor(tag)}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`category-badge ${getCategoryStyle(expense.category)}`}>
                      {getCategoryLabel(expense.category)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {expense.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                    {new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-muted-foreground">{getPaymentLabel(expense.paymentMethod)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {expense.cardName ? (
                      <span className={`category-badge ${getCardStyle(expense.cardName)}`}>
                        {getCardLabel(expense.cardName)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {expense.receiptUrl ? (
                        <button onClick={() => setViewingReceipt(expense.receiptUrl!)} className="text-green-500 hover:text-green-400 transition-colors">
                          <Image className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <label className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleReceiptUpload(expense.id, file);
                            }}
                          />
                        </label>
                      )}
                      <button onClick={() => deleteExpense(expense.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20">
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <Input placeholder="+ Novo gasto" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0" />
                    {/* Tags input */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {newTags.map(tag => (
                        <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${getTagColor(tag)}`}>
                          {tag}
                          <button onClick={() => removeNewTag(tag)} className="hover:opacity-70">×</button>
                        </span>
                      ))}
                      <input
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                        placeholder="+ tag"
                        className="bg-transparent text-[10px] text-muted-foreground outline-none w-12 placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input type="number" placeholder="0" value={newExpense.value} onChange={(e) => setNewExpense({ ...newExpense, value: e.target.value })} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 text-right focus-visible:ring-0" />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0" />
                </td>
                <td className="px-3 py-2">
                  <Select value={newExpense.paymentMethod} onValueChange={(v) => setNewExpense({ ...newExpense, paymentMethod: v, cardName: isCardPayment(v) ? newExpense.cardName : "" })}>
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Forma" /></SelectTrigger>
                    <SelectContent>{paymentMethods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  {isCardPayment(newExpense.paymentMethod) ? (
                    <Select value={newExpense.cardName} onValueChange={(v) => setNewExpense({ ...newExpense, cardName: v })}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none"><SelectValue placeholder="Cartão" /></SelectTrigger>
                      <SelectContent>{cardOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={addExpense} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>
                  TOTAL {filterTag && <span className="text-[10px]">(tag: {filterTag})</span>}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" colSpan={5}>
                  R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {viewingReceipt && (
        <ReceiptViewer url={viewingReceipt} onClose={() => setViewingReceipt(null)} />
      )}
    </>
  );
};
