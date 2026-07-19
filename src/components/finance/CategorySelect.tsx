import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinanceCategories } from "@/lib/finance-categories";

const CREATE = "__create__";

/**
 * Seletor de categoria com "➕ Criar categoria…" (pedido de cliente 19/07).
 * Escolher o item de criar abre um diálogo curto (nome) em vez de setar valor;
 * criada, já seleciona a nova. Lista vem do useFinanceCategories (padrão +
 * personalizadas). `kind` decide variável x fixo.
 */
export const CategorySelect = ({
  value, onValueChange, kind, placeholder = "Categoria", className = "h-8 text-xs w-full",
}: {
  value: string;
  onValueChange: (v: string) => void;
  kind: "variable" | "fixed";
  placeholder?: string;
  className?: string;
}) => {
  const { variableCats, fixedCats, addCustom } = useFinanceCategories();
  const cats = kind === "fixed" ? fixedCats : variableCats;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const handleChange = (v: string) => {
    if (v === CREATE) { setName(""); setCreating(true); return; }
    onValueChange(v);
  };

  const confirmCreate = () => {
    const { value, error } = addCustom(name);
    if (error || !value) { toast.error(error ?? "Não consegui criar a categoria."); return; }
    onValueChange(value);
    setCreating(false);
    toast.success("Categoria criada ✅");
  };

  return (
    <>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {cats.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={CREATE} className="text-primary font-medium">➕ Criar categoria…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-base">Nova categoria</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmCreate(); }}
            placeholder="Ex: Igreja, Jogos, Investimento…"
            maxLength={24}
            className="h-10"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button size="sm" onClick={confirmCreate} className="gap-1"><Plus className="w-3.5 h-3.5" /> Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
