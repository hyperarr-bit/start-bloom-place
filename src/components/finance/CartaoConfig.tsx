import { useState } from "react";
import { Settings2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useFinanceCards } from "@/lib/finance-cards";
import { contaNoMesDoVencimento, rotuloVencimento } from "@/lib/finance-fatura";

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
 *
 * NOME (26/09, chamado de 25/09: "não consigo mudar o nome do cartão"): o
 * renameCustom já existia no lib e nenhuma tela chamava. Cartão personalizado
 * ganha o campo de nome aqui mesmo; o `value` não muda, então gasto e parcela
 * já lançados acompanham o nome novo. As 11 bandeiras padrão não se renomeiam.
 */
export const CartaoConfig = ({ card, label }: { card: string; label: string }) => {
  const { configOf, setConfig, renameCustom, custom } = useFinanceCards();
  const cfg = configOf(card);
  const personalizado = custom.some((c) => c.value === card);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(label);
  const [fecha, setFecha] = useState(cfg?.closingDay ? String(cfg.closingDay) : "");
  const [vence, setVence] = useState(cfg?.dueDay ? String(cfg.dueDay) : "");
  /* 07/10: sem fechamento, "conta no mês do vencimento" (gasto vai pro mês
     seguinte). Cartão NOVO nasce ligado (é o que a pessoa espera: "prefiro que
     fique no mês que vai debitar"); cartão que já tinha só o vencimento fica
     como estava até a pessoa marcar — os números do mês não mudam sozinhos. */
  const [noVencimento, setNoVencimento] = useState(cfg ? contaNoMesDoVencimento(cfg) : true);

  const abrir = () => {
    setNome(label);
    setFecha(cfg?.closingDay ? String(cfg.closingDay) : "");
    setVence(cfg?.dueDay ? String(cfg.dueDay) : "");
    setNoVencimento(cfg ? contaNoMesDoVencimento(cfg) : true);
    setAberto(true);
  };

  const salvar = () => {
    const f = parseInt(fecha, 10);
    const v = parseInt(vence, 10);
    const ok = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
    if (fecha && !ok(f)) { toast.error("Dia de fechamento precisa ser de 1 a 31."); return; }
    if (vence && !ok(v)) { toast.error("Dia de vencimento precisa ser de 1 a 31."); return; }
    const nomeNovo = nome.trim().replace(/\s+/g, " ");
    const renomeou = personalizado && nomeNovo !== label;
    if (renomeou) {
      const r = renameCustom(card, nomeNovo);
      if (r.error) { toast.error(r.error); return; }
    }
    const nomeFinal = renomeou ? nomeNovo : label;
    const soVencimento = !ok(f) && ok(v);
    setConfig(card, { closingDay: ok(f) ? f : undefined, dueDay: ok(v) ? v : undefined, mesDoVencimento: soVencimento && noVencimento });
    setAberto(false);
    const fatura = ok(f)
      ? `compras depois do dia ${f} vão pra fatura do mês seguinte.`
      : soVencimento && noVencimento
        ? `sem fechamento — gasto conta no mês seguinte, o do vencimento (dia ${v}).`
        : "sem fechamento — gasto conta no mês da compra.";
    toast.success(renomeou ? `Cartão renomeado para ${nomeFinal}. ${fatura[0].toUpperCase()}${fatura.slice(1)}` : `${nomeFinal}: ${fatura}`);
  };

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        aria-label={personalizado ? `Editar cartão ${label}` : `Fechamento e vencimento do cartão ${label}`}
        title={personalizado ? "Nome, fechamento e vencimento" : "Fechamento e vencimento da fatura"}
        className="inline-flex items-center gap-1 h-7 px-1.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        {cfg ? (cfg.closingDay ? `fecha dia ${cfg.closingDay}` : rotuloVencimento(cfg)) : personalizado ? "editar" : "fechamento"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {personalizado && (
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          nome
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={20} aria-label="Nome do cartão"
            className="h-7 w-28 text-xs px-1.5" autoFocus />
        </label>
      )}
      <label className="text-[10px] text-muted-foreground flex items-center gap-1">
        fecha dia
        <Input type="number" inputMode="numeric" min={1} max={31} value={fecha} onChange={(e) => setFecha(e.target.value)}
          placeholder="—" className="h-7 w-12 text-xs text-center px-1" autoFocus={!personalizado} />
      </label>
      <label className="text-[10px] text-muted-foreground flex items-center gap-1">
        vence dia
        <Input type="number" inputMode="numeric" min={1} max={31} value={vence} onChange={(e) => setVence(e.target.value)}
          placeholder="—" className="h-7 w-12 text-xs text-center px-1" />
      </label>
      {!fecha.trim() && vence.trim() && (
        <label className="text-[10px] text-muted-foreground flex items-center gap-1 basis-full" data-testid="conta-no-vencimento">
          <input type="checkbox" checked={noVencimento} onChange={(e) => setNoVencimento(e.target.checked)} aria-label="Gasto conta no mês do vencimento" className="h-3.5 w-3.5 accent-primary" />
          gasto conta no mês do vencimento (o seguinte)
        </label>
      )}
      <button onClick={salvar} aria-label={personalizado ? "Salvar cartão" : "Salvar fechamento e vencimento"} className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setAberto(false)} aria-label="Cancelar" className="h-7 w-7 rounded-md border border-border text-muted-foreground grid place-items-center">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
