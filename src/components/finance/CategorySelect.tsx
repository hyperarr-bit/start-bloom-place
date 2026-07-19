import { useState } from "react";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinanceCategories } from "@/lib/finance-categories";

const CREATE = "__create__";

/**
 * Seletor de categoria com "➕ Criar categoria…" (pedido de cliente 19/07).
 * Escolher o item de criar abre um diálogo no padrão da casa (NameEditDialog)
 * com pré-visualização do badge na cor que a categoria vai ganhar; criada,
 * já sai selecionada. Lista sincroniza ao vivo em todas as telas (a lib lê
 * direto do store). `kind` decide variável x fixo.
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
  const { variableCats, fixedCats, addCustom, nextPalette } = useFinanceCategories();
  const cats = kind === "fixed" ? fixedCats : variableCats;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const handleChange = (v: string) => {
    if (v === CREATE) { setName(""); setCreating(true); return; }
    onValueChange(v);
  };

  const confirmCreate = () => {
    const { value: novo, error } = addCustom(name);
    if (error || !novo) { toast.error(error ?? "Não consegui criar a categoria."); return; }
    onValueChange(novo);
    setCreating(false);
    toast.success(`Categoria "${name.trim()}" criada ✅`);
  };

  const nomePreview = name.trim() || "Sua categoria";

  return (
    <>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {cats.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={CREATE} className="text-primary font-semibold">+ Criar categoria…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4" />
              Nova categoria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jogos, Igreja, Investimento…"
              maxLength={24}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
            />
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">Vai aparecer assim:</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${nextPalette.color}`}>
                {nomePreview}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={confirmCreate} disabled={name.trim().length < 2}>
                Criar categoria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
