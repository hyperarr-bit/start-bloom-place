import { useState } from "react";
import { Settings2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useFinanceCards } from "@/lib/finance-cards";
import { rotuloVencimento } from "@/lib/finance-fatura";

/**
 * Fechamento e vencimento de UM cartão, editados no lugar onde o cartão já
 * aparece com número do lado: a linha dele em "TOTAL POR CARTÃO NO MÊS"
 * (InstallmentTracker). Não há tela de "gerenciar cartões" no app — o
 * CardSelect só cria — e inventar uma só pra dois números seria esconder o
 * recurso de novo (a lição do "Parcelar", 08/08).
 *
 * Avaliação 4★ (set/2026): "seria interessante ter como adicionar a data de
 * vencimento do cartão de crédito". O que o fechamento muda na conta está
 * em lib/finance-fatura.ts.
 */
export const CartaoConfig = ({ card, label }: { card: string; label: string }) => {
  const { configOf, setConfig } = useFinanceCards();
  const cfg = configOf(card);
  const [aberto, setAberto] = useState(false);
  const [fecha, setFecha] = useState(cfg?.closingDay ? String(cfg.closingDay) : "");
  const [vence, setVence] = useState(cfg?.dueDay ? String(cfg.dueDay) : "");

  const abrir = () => {
    setFecha(cfg?.closingDay ? String(cfg.closingDay) : "");
    setVence(cfg?.dueDay ? String(cfg.dueDay) : "");
    setAberto(true);
  };

  const salvar = () => {
    const f = parseInt(fecha, 10);
    const v = parseInt(vence, 10);
    const ok = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
    if (fecha && !ok(f)) { toast.error("Dia de fechamento precisa ser de 1 a 31."); return; }
    if (vence && !ok(v)) { toast.error("Dia de vencimento precisa ser de 1 a 31."); return; }
    setConfig(card, { closingDay: ok(f) ? f : undefined, dueDay: ok(v) ? v : undefined });
    setAberto(false);
    toast.success(ok(f) ? `${label}: compras depois do dia ${f} vão pra fatura do mês seguinte.` : `${label}: sem fechamento — gasto conta no mês da compra.`);
  };

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        aria-label={`Fechamento e vencimento do cartão ${label}`}
        title="Fechamento e vencimento da fatura"
        className="inline-flex items-center gap-1 h-7 px-1.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        {cfg ? (cfg.closingDay ? `fecha dia ${cfg.closingDay}` : rotuloVencimento(cfg)) : "fechamento"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <label className="text-[10px] text-muted-foreground flex items-center gap-1">
        fecha dia
        <Input type="number" inputMode="numeric" min={1} max={31} value={fecha} onChange={(e) => setFecha(e.target.value)}
          placeholder="—" className="h-7 w-12 text-xs text-center px-1" autoFocus />
      </label>
      <label className="text-[10px] text-muted-foreground flex items-center gap-1">
        vence dia
        <Input type="number" inputMode="numeric" min={1} max={31} value={vence} onChange={(e) => setVence(e.target.value)}
          placeholder="—" className="h-7 w-12 text-xs text-center px-1" />
      </label>
      <button onClick={salvar} aria-label="Salvar fechamento e vencimento" className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setAberto(false)} aria-label="Cancelar" className="h-7 w-7 rounded-md border border-border text-muted-foreground grid place-items-center">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
