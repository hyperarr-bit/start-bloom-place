import { useRef, useState } from "react";
import { Upload, Loader2, FileCheck2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { pedirAvaliacaoSePuder } from "@/lib/avaliacao";
import {
  parseExtrato, suggestCategory, suggestPaymentMethod, ruleTokenOf, type ParsedTx,
} from "@/lib/extrato-parser";

const CATEGORY_OPTIONS = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "restaurante", label: "Restaurante" },
  { value: "mercado", label: "Mercado" },
  { value: "transporte", label: "Transporte" },
  { value: "combustivel", label: "Combustível" },
  { value: "lazer", label: "Lazer" },
  { value: "entretenimento", label: "Entretenimento" },
  { value: "saude", label: "Saúde" },
  { value: "farmacia", label: "Farmácia" },
  { value: "vestuario", label: "Vestuário" },
  { value: "beleza", label: "Beleza" },
  { value: "educacao", label: "Educação" },
  { value: "eletronicos", label: "Eletrônicos" },
  { value: "servicos", label: "Serviços" },
  { value: "delivery", label: "Delivery" },
  { value: "presente", label: "Presente" },
  { value: "casa", label: "Casa" },
  { value: "pets", label: "Pets" },
  { value: "filhos", label: "Filhos" },
  { value: "viagem", label: "Viagem" },
  { value: "assinaturas", label: "Assinaturas" },
  { value: "academia", label: "Academia" },
  { value: "outros", label: "Outros" },
];

interface ReviewRow extends ParsedTx {
  key: string;
  include: boolean;
  duplicate: boolean;
  category: string;        // só para saídas
  suggested: string;       // categoria sugerida (pra saber se o usuário corrigiu)
}

interface Props {
  expenses: any[];
  incomes: any[];
  setExpenses: (v: any[]) => void;
  setIncomes: (v: any[]) => void;
}

/**
 * Importar extrato do banco (OFX/CSV) com revisão e auto-categorização.
 * Correções de categoria viram regra aprendida (finance-categorization-rules):
 * na próxima importação, o mesmo estabelecimento já vem certo.
 */
export const ImportExtrato = ({ expenses, incomes, setExpenses, setIncomes }: Props) => {
  const { get, set } = useUserData();
  const { isSubscribed } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setBusy(false);
      const parsed = parseExtrato((e.target?.result as string) || "");
      if (parsed.length === 0) {
        toast.error("Não achei lançamentos nesse arquivo. Exporta como OFX ou CSV no app do banco.");
        return;
      }
      const learned = get<Record<string, string>>("finance-categorization-rules", {});
      const existingKeys = new Set(
        [...expenses, ...incomes].map((t: any) => `${t.date}|${Math.abs(Number(t.value) || 0).toFixed(2)}`),
      );
      const review = parsed.map((tx, i) => {
        const duplicate = existingKeys.has(`${tx.date}|${Math.abs(tx.amount).toFixed(2)}`);
        const suggested = tx.amount < 0 ? suggestCategory(tx.description, learned) : "";
        return {
          ...tx,
          key: `${i}-${tx.date}-${tx.amount}`,
          include: !duplicate,
          duplicate,
          category: suggested,
          suggested,
        };
      });
      trackEvent("extrato_parsed", { count: review.length, duplicates: review.filter((r) => r.duplicate).length });
      setRows(review);
    };
    reader.readAsText(file);
  };

  const doImport = () => {
    if (!rows) return;
    const included = rows.filter((r) => r.include);
    const outgoing = included.filter((r) => r.amount < 0);
    const incoming = included.filter((r) => r.amount > 0);

    // Aprende as correções: categoria escolhida ≠ sugerida → vira regra
    const learned = { ...get<Record<string, string>>("finance-categorization-rules", {}) };
    let learnedCount = 0;
    for (const r of outgoing) {
      if (r.category && r.category !== r.suggested) {
        learned[ruleTokenOf(r.description)] = r.category;
        learnedCount++;
      }
    }
    if (learnedCount > 0) set("finance-categorization-rules", learned);

    const stamp = Date.now();
    if (outgoing.length > 0) {
      setExpenses([
        ...expenses,
        ...outgoing.map((r, i) => ({
          id: `${stamp}-e${i}`,
          date: r.date,
          value: Math.abs(r.amount),
          description: r.description.slice(0, 60),
          category: r.category || "outros",
          paymentMethod: suggestPaymentMethod(r.description),
        })),
      ]);
    }
    if (incoming.length > 0) {
      setIncomes([
        ...incomes,
        ...incoming.map((r, i) => ({
          id: `${stamp}-i${i}`,
          date: r.date,
          value: r.amount,
          description: r.description.slice(0, 60),
        })),
      ]);
    }

    trackEvent("extrato_imported", { expenses: outgoing.length, incomes: incoming.length, learned: learnedCount });
    toast.success(
      `${outgoing.length} gasto${outgoing.length !== 1 ? "s" : ""} e ${incoming.length} receita${incoming.length !== 1 ? "s" : ""} importados` +
        (learnedCount > 0 ? ` · ${learnedCount} regra${learnedCount > 1 ? "s" : ""} aprendida${learnedCount > 1 ? "s" : ""}` : ""),
    );
    setRows(null);

    /*
     * MOMENTO DE VALOR (14/08) — é aqui que o app entrega o "uau": o mês
     * inteiro categorizado sem digitar nada. Pedir avaliação logo depois pega
     * a pessoa com a prova na tela, e não no meio de uma tarefa.
     *
     * Atrasado 1,2s de propósito: primeiro ela vê o toast com o resultado; a
     * caixa do Google entrando por cima do próprio resultado apagaria a razão
     * de dar cinco estrelas. Quem pagou é convidado na primeira importação;
     * quem não pagou, só a partir da segunda (`vezes`) — nota de quem mal
     * usou não ajuda ninguém. Todas as travas (cota, 90 dias, 3 na vida,
     * só no app) moram em pedirAvaliacaoSePuder.
     */
    const importacoes = Number(localStorage.getItem("core-extratos-importados") ?? 0) + 1;
    try { localStorage.setItem("core-extratos-importados", String(importacoes)); } catch { /* modo privado */ }
    setTimeout(() => {
      void pedirAvaliacaoSePuder("extrato_importado", { pagante: isSubscribed, vezes: importacoes });
    }, 1200);
  };

  const fmtBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const includedCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <>
      <input type="file" accept=".ofx,.csv,.txt" ref={fileRef} onChange={handleFile} className="hidden" />
      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
        Importar extrato
      </Button>

      <Sheet open={!!rows} onOpenChange={(o) => !o && setRows(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88dvh] flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-accent" />
              Revisar importação
            </SheetTitle>
            <p className="text-xs text-muted-foreground !mt-1">
              Categoria já sugerida — corrige o que precisar, que eu aprendo pra próxima.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
            {rows?.map((r, idx) => (
              <div
                key={r.key}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                  r.include ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                }`}
              >
                <Checkbox
                  checked={r.include}
                  onCheckedChange={(v) =>
                    setRows(rows.map((x, i) => (i === idx ? { ...x, include: !!v } : x)))
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate leading-tight">{r.description}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {fmtBR(r.date)}
                    {r.duplicate && <span className="ml-1.5 text-amber-500 font-semibold">· já existe</span>}
                  </p>
                </div>
                {r.amount < 0 ? (
                  <select
                    value={r.category}
                    onChange={(e) =>
                      setRows(rows.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)))
                    }
                    className="h-8 max-w-[110px] text-[11px] rounded-md border border-input bg-background px-1.5"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] font-bold uppercase text-emerald-500 shrink-0">receita</span>
                )}
                <span className={`text-[13px] font-bold tabular-nums shrink-0 ${r.amount < 0 ? "text-red-400" : "text-emerald-500"}`}>
                  {r.amount < 0 ? "-" : "+"}R$ {Math.abs(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button onClick={doImport} disabled={includedCount === 0} className="w-full h-12 font-bold">
              Importar {includedCount} lançamento{includedCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
