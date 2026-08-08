import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinanceCards } from "@/lib/finance-cards";

const CREATE = "__create__";

/**
 * Seletor de cartão com "+ Novo cartão…" (pedido de assinante: "tenho cartões
 * de lojas como a Renner e não tem essa opção lá"). Mesmo desenho do
 * CategorySelect de propósito — escolher o item de criar abre o diálogo com
 * pré-visualização do badge na cor que o cartão vai ganhar e, criado, ele já
 * sai selecionado. A lista sincroniza ao vivo nas outras telas porque a lib lê
 * direto do store do useUserData.
 */
export const CardSelect = ({
  value, onValueChange, placeholder = "Cartão", className = "h-8 text-xs w-full",
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const { cards, addCustom, nextPalette } = useFinanceCards();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const handleChange = (v: string) => {
    if (v === CREATE) { setName(""); setCreating(true); return; }
    onValueChange(v);
  };

  const confirmCreate = () => {
    const { value: novo, error } = addCustom(name);
    if (error || !novo) { toast.error(error ?? "Não consegui criar o cartão."); return; }
    onValueChange(novo);
    setCreating(false);
    toast.success(`Cartão "${name.trim()}" criado ✅`);
  };

  const nomePreview = name.trim() || "Seu cartão";

  return (
    <>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {cards.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={CREATE} className="text-primary font-semibold">+ Novo cartão…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              Novo cartão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Renner, Riachuelo, Will, Mercado Pago…"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
            />
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">Vai aparecer assim:</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${nextPalette.color}`}>
                {nomePreview}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Cada cartão vira uma linha própria no resumo <strong>Total por cartão no mês</strong>.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={confirmCreate} disabled={name.trim().length < 2}>
                Criar cartão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
