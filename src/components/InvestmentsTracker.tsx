import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { dataSegura, localDayKey } from "@/lib/utils";
import { numeroBR } from "@/lib/data-normalizers";
import { avisarApagado } from "@/lib/desfazer";
import { Plus, Trash2, TrendingUp, TrendingDown, PiggyBank, Percent, Calendar, Wallet, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Investment {
  id: string;
  name: string;
  type: "renda_fixa" | "renda_variavel" | "cripto" | "imoveis" | "outros";
  investedAmount: number;
  currentValue: number;
  monthlyContribution: number;
  expectedReturn: number; // % anual esperada (ex: 12.5)
  startDate: string;
  broker?: string;
}

interface InvestmentsTrackerProps {
  investments: Investment[];
  setInvestments: (investments: Investment[]) => void;
}

const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
  renda_fixa: { label: "Renda Fixa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "📊" },
  renda_variavel: { label: "Renda Variável", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "📈" },
  cripto: { label: "Criptomoedas", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "₿" },
  imoveis: { label: "Imóveis/FIIs", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "🏠" },
  outros: { label: "Outros", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: "💼" },
};

/* Formatação (26/09, varredura): dinheiro sempre com 2 casas e o sinal antes
   do R$ ("-R$ 500,00", não "R$ -500,00"); percentual com vírgula ("13,5%",
   não "13.5%"). */
const brl = (v: number) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const reais = (v: number) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return `${r < 0 ? "-" : ""}R$ ${brl(r)}`;
};
/** "+R$ 900,00" / "-R$ 400,00" — pra retorno, que pode ser as duas coisas. */
export const reaisComSinal = (v: number) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return `${r < 0 ? "-" : "+"}R$ ${brl(r)}`;
};
export const pct = (v: number, casas = 1) =>
  `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
/** Taxa a.a. sem ",0" sobrando: "12% a.a.", "13,5% a.a." */
const taxa = (v: number) => `${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.`;

// Juros compostos: FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
const futureValue = (pv: number, pmt: number, rateAnnual: number, years: number) => {
  if (rateAnnual === 0) return pv + pmt * years * 12;
  const monthlyRate = rateAnnual / 100 / 12;
  const months = years * 12;
  const fvPrincipal = pv * Math.pow(1 + monthlyRate, months);
  const fvContributions = pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return fvPrincipal + fvContributions;
};

export const InvestmentsTracker = ({ investments, setInvestments }: InvestmentsTrackerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [newInvestment, setNewInvestment] = useState<Partial<Investment>>({
    type: "renda_fixa",
    monthlyContribution: 0,
    expectedReturn: 10,
  });

  const addInvestment = () => {
    if (!newInvestment.name || !newInvestment.investedAmount) return;
    const investment: Investment = {
      id: Date.now().toString(),
      name: newInvestment.name,
      type: newInvestment.type || "renda_fixa",
      investedAmount: newInvestment.investedAmount,
      currentValue: newInvestment.currentValue || newInvestment.investedAmount,
      monthlyContribution: newInvestment.monthlyContribution || 0,
      expectedReturn: newInvestment.expectedReturn ?? 10,
      startDate: newInvestment.startDate || localDayKey(),
      broker: newInvestment.broker,
    };
    setInvestments([...investments, investment]);
    setNewInvestment({ type: "renda_fixa", monthlyContribution: 0, expectedReturn: 10 });
    setShowForm(false);
  };

  /* Apagar com "Desfazer" (26/09, varredura): um toque na lixeira levava o
     investimento — aportado, rentabilidade, histórico — sem volta. O desfazer
     devolve o registro inteiro, sobre a lista mais recente. */
  const ultimo = useRef({ lista: investments, gravar: setInvestments });
  useEffect(() => { ultimo.current = { lista: investments, gravar: setInvestments }; });

  const deleteInvestment = (id: string) => {
    const pos = investments.findIndex((i) => i.id === id);
    if (pos < 0) return;
    const apagado = investments[pos];
    setInvestments(investments.filter((i) => i.id !== id));
    avisarApagado(`Investimento apagado: ${apagado.name} (${reais(apagado.currentValue)})`, () => {
      const { lista, gravar } = ultimo.current;
      if (lista.some((i) => i.id === id)) return;
      gravar([...lista.slice(0, pos), apagado, ...lista.slice(pos)]);
    });
  };

  /**
   * Editar o investimento (27/07).
   *
   * Já dava pra mexer no valor atual e na rentabilidade — mas NÃO no nome, no
   * tipo, na corretora, no aporte mensal nem no valor investido. Quem digitou
   * o aportado errado (o número que define todo o retorno calculado) não tinha
   * saída além de apagar e recadastrar.
   */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({
    name: "", type: "renda_fixa" as Investment["type"], investedAmount: "",
    monthlyContribution: "", broker: "",
  });

  const comecarEdicao = (i: Investment) => {
    setEditandoId(i.id);
    setRascunho({
      name: i.name,
      type: i.type,
      investedAmount: String(i.investedAmount ?? 0),
      monthlyContribution: String(i.monthlyContribution ?? 0),
      broker: i.broker ?? "",
    });
  };

  const salvarEdicao = () => {
    const aportado = parseFloat(rascunho.investedAmount);
    if (!rascunho.name.trim() || !Number.isFinite(aportado) || aportado < 0) return;
    setInvestments(investments.map((i) => i.id !== editandoId ? i : {
      ...i,
      name: rascunho.name.trim(),
      type: rascunho.type,
      investedAmount: aportado,
      monthlyContribution: Math.max(0, parseFloat(rascunho.monthlyContribution) || 0),
      broker: rascunho.broker.trim() || undefined,
    }));
    setEditandoId(null);
  };

  const updateCurrentValue = (id: string, value: number) => {
    setInvestments(investments.map((i) => (i.id === id ? { ...i, currentValue: value } : i)));
  };

  const updateExpectedReturn = (id: string, value: number) => {
    setInvestments(investments.map((i) => (i.id === id ? { ...i, expectedReturn: value } : i)));
  };

  const addContribution = (id: string, amount: number) => {
    setInvestments(
      investments.map((i) =>
        i.id === id
          ? { ...i, investedAmount: i.investedAmount + amount, currentValue: i.currentValue + amount }
          : i
      )
    );
  };

  /* OS TRÊS CAMPOS DA LINHA (26/09, varredura). Eram inputs soltos com
     `defaultValue`: o aporte de R$ 500 somava no card (15.600), mas o campo
     "valor atual" continuava mostrando 15100 — e tocar nele e sair gravava o
     15100 por cima, e o aporte sumia. Agora são controlados por rascunho:
     sem rascunho mostram o valor SALVO (sempre o de agora), e sair do campo
     só grava se o número mudou. O aporte, que antes só ia com Enter, ganhou
     o botão "+" (Enter continua valendo). */
  const [campos, setCampos] = useState<Record<string, string>>({});
  const chaveCampo = (id: string, qual: "atual" | "taxa" | "aporte") => `${id}:${qual}`;
  const escrever = (chave: string, v: string) => setCampos((c) => ({ ...c, [chave]: v }));
  const soltar = (chave: string) => setCampos((c) => {
    const { [chave]: _descartado, ...resto } = c;
    return resto;
  });

  const salvarValorAtual = (inv: Investment) => {
    const chave = chaveCampo(inv.id, "atual");
    const texto = campos[chave];
    if (texto === undefined) return;
    soltar(chave);
    if (!texto.trim()) return; // apagou e saiu: fica o valor salvo
    const v = numeroBR(texto);
    if (!Number.isFinite(v) || v < 0) { toast.error("Valor atual inválido."); return; }
    if (v !== inv.currentValue) updateCurrentValue(inv.id, v);
  };

  const salvarTaxa = (inv: Investment) => {
    const chave = chaveCampo(inv.id, "taxa");
    const texto = campos[chave];
    if (texto === undefined) return;
    soltar(chave);
    if (!texto.trim()) return;
    const v = numeroBR(texto);
    if (!Number.isFinite(v)) { toast.error("Rentabilidade inválida."); return; }
    // 0% é valor de verdade (o `|| anterior` de antes não deixava zerar)
    if (v !== (inv.expectedReturn ?? 10)) updateExpectedReturn(inv.id, v);
  };

  const lancarAporte = (inv: Investment) => {
    const chave = chaveCampo(inv.id, "aporte");
    const texto = campos[chave] ?? "";
    if (!texto.trim()) { toast.error("Digite o valor do aporte."); return; }
    const v = numeroBR(texto);
    if (!Number.isFinite(v) || v <= 0) { toast.error("O aporte precisa ser maior que zero."); return; }
    addContribution(inv.id, v);
    soltar(chave);
  };

  const totalInvested = investments.reduce((sum, i) => sum + i.investedAmount, 0);
  const totalCurrentValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalReturn = totalCurrentValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const monthlyContributions = investments.reduce((sum, i) => sum + i.monthlyContribution, 0);

  // Projeções com juros compostos reais por investimento
  const projection5y = investments.reduce((sum, inv) => {
    const rate = inv.expectedReturn ?? 10;
    return sum + futureValue(inv.currentValue, inv.monthlyContribution, rate, 5);
  }, 0);

  const projection10y = investments.reduce((sum, inv) => {
    const rate = inv.expectedReturn ?? 10;
    return sum + futureValue(inv.currentValue, inv.monthlyContribution, rate, 10);
  }, 0);

  // Média ponderada da taxa para renda passiva
  const weightedRate = totalCurrentValue > 0
    ? investments.reduce((sum, inv) => sum + (inv.expectedReturn ?? 10) * inv.currentValue, 0) / totalCurrentValue
    : 6;
  const passiveIncome = (totalCurrentValue * (weightedRate / 100)) / 12;

  // Group by type
  const byType = investments.reduce((acc, inv) => {
    if (!acc[inv.type]) acc[inv.type] = { invested: 0, current: 0 };
    acc[inv.type].invested += inv.investedAmount;
    acc[inv.type].current += inv.currentValue;
    return acc;
  }, {} as Record<string, { invested: number; current: number }>);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-muted-foreground">Total Investido</span>
          </div>
          <p className="text-lg font-bold">R$ {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-muted-foreground">Valor Atual</span>
          </div>
          <p className="text-lg font-bold text-purple-400">
            R$ {totalCurrentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            {totalReturn >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-muted-foreground">Rentabilidade</span>
          </div>
          <p className={`text-lg font-bold ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {reaisComSinal(totalReturn)}
          </p>
          <p className={`text-[10px] ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {returnPercentage >= 0 ? "+" : ""}{pct(returnPercentage, 2)}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-muted-foreground">Aportes Mensais</span>
          </div>
          <p className="text-lg font-bold text-orange-400">
            R$ {monthlyContributions.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Portfolio Distribution */}
      {Object.keys(byType).length > 0 && (
        <div className="bg-card rounded-lg border border-border p-3">
          <h4 className="text-xs font-bold mb-3">DISTRIBUIÇÃO DA CARTEIRA</h4>
          <div className="space-y-2">
            {Object.entries(byType).map(([type, data]) => {
              const percentage = (data.current / totalCurrentValue) * 100;
              const typeInfo = typeLabels[type] || typeLabels.outros;
              const returnVal = data.current - data.invested;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm w-6">{typeInfo.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{typeInfo.label}</span>
                      <span className="text-muted-foreground">{pct(percentage, 1)}</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                  <span className={`text-xs w-24 text-right ${returnVal >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {reaisComSinal(returnVal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investments List */}
      <div className="bg-card rounded-lg border border-border">
        <div className="table-header-dark flex items-center justify-between px-4">
          <span className="text-xs font-bold">MEUS INVESTIMENTOS</span>
          <Button data-spotlight="add-investment" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Input
                placeholder="Nome do investimento"
                value={newInvestment.name || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                className="h-8 text-xs"
              />
              <select
                value={newInvestment.type}
                onChange={(e) => setNewInvestment({ ...newInvestment, type: e.target.value as any })}
                className="h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                {Object.entries(typeLabels).map(([key, info]) => (
                  <option key={key} value={key}>{info.icon} {info.label}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Valor investido"
                value={newInvestment.investedAmount || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, investedAmount: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                placeholder="Valor atual"
                value={newInvestment.currentValue || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, currentValue: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Input
                type="number"
                placeholder="Aporte mensal (R$)"
                value={newInvestment.monthlyContribution || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, monthlyContribution: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                placeholder="Rentabilidade esperada (% a.a.)"
                value={newInvestment.expectedReturn !== undefined && newInvestment.expectedReturn !== 10 ? newInvestment.expectedReturn : ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, expectedReturn: e.target.value === "" ? undefined : (parseFloat(e.target.value) || 0) })}
                className="h-8 text-xs"
              />
              <CampoData
                rotulo="Data início"
                value={newInvestment.startDate || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, startDate: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Corretora (opcional)"
                value={newInvestment.broker || ""}
                onChange={(e) => setNewInvestment({ ...newInvestment, broker: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={addInvestment} className="h-7 text-xs">
              Salvar Investimento
            </Button>
          </div>
        )}

        <div className="divide-y divide-border">
          {investments.length === 0 ? (
            <div className="p-8 text-center">
              <PiggyBank className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum investimento cadastrado</p>
              <p className="text-xs text-muted-foreground">Comece a acompanhar seus investimentos</p>
            </div>
          ) : (
            investments.map((inv) => {
              const returnVal = inv.currentValue - inv.investedAmount;
              const returnPct = inv.investedAmount > 0 ? (returnVal / inv.investedAmount) * 100 : 0;
              const typeInfo = typeLabels[inv.type] || typeLabels.outros;
              return (
                <div key={inv.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground border border-border">
                          {taxa(inv.expectedReturn ?? 10)}
                        </span>
                        {inv.broker && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {inv.broker}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{inv.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs flex-wrap">
                        <span className="text-muted-foreground">
                          Investido: R$ {(inv.investedAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={returnVal >= 0 ? "text-green-400" : "text-red-400"}>
                          Retorno: {reaisComSinal(returnVal)} ({pct(returnPct, 2)})
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">
                        R$ {inv.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {/* dia LOCAL (26/09): `new Date("2025-06-01")` é meia-noite UTC
                          e no Brasil virava "Desde 31/05/2025" */}
                      {dataSegura(inv.startDate, "dd/MM/yyyy") !== "—" && (
                        <p className="text-[10px] text-muted-foreground">
                          Desde {dataSegura(inv.startDate, "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Editar ${inv.name}`}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => comecarEdicao(inv)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Apagar ${inv.name}`}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteInvestment(inv.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {editandoId === inv.id && (
                    <div className="mt-2 p-2.5 rounded-lg bg-primary/[0.05] border border-primary/20 space-y-2">
                      <Input
                        autoFocus
                        value={rascunho.name}
                        onChange={(e) => setRascunho({ ...rascunho, name: e.target.value })}
                        placeholder="Nome do investimento"
                        className="h-8 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={rascunho.type} onValueChange={(v) => setRascunho({ ...rascunho, type: v as Investment["type"] })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(typeLabels).map(([v, t]) => (
                              <SelectItem key={v} value={v} className="text-xs">{t.icon} {t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={rascunho.broker}
                          onChange={(e) => setRascunho({ ...rascunho, broker: e.target.value })}
                          placeholder="Corretora"
                          className="h-8 text-xs"
                        />
                        <label className="text-[10px] text-muted-foreground">
                          Valor investido
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={rascunho.investedAmount}
                            onChange={(e) => setRascunho({ ...rascunho, investedAmount: e.target.value })}
                            className="h-8 text-xs mt-0.5"
                          />
                        </label>
                        <label className="text-[10px] text-muted-foreground">
                          Aporte mensal
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={rascunho.monthlyContribution}
                            onChange={(e) => setRascunho({ ...rascunho, monthlyContribution: e.target.value })}
                            className="h-8 text-xs mt-0.5"
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={salvarEdicao} className="h-8 flex-1 text-xs">Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditandoId(null)} className="h-8 text-xs">Cancelar</Button>
                      </div>
                    </div>
                  )}

                  {/* Rótulo curto em cada campo (26/09): "15100" e "12" soltos
                      não diziam o que eram. */}
                  <div className="mt-2 flex items-end gap-2">
                    <label className="flex-1 min-w-0 text-[10px] text-muted-foreground">
                      Valor atual (R$)
                      <Input
                        type="number"
                        inputMode="decimal"
                        aria-label={`Valor atual de ${inv.name}`}
                        className="h-8 text-xs mt-0.5"
                        value={campos[chaveCampo(inv.id, "atual")] ?? String(inv.currentValue ?? "")}
                        onChange={(e) => escrever(chaveCampo(inv.id, "atual"), e.target.value)}
                        onBlur={() => salvarValorAtual(inv)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                    </label>
                    <label className="w-16 shrink-0 text-[10px] text-muted-foreground">
                      Rent. % a.a.
                      <Input
                        type="number"
                        inputMode="decimal"
                        aria-label={`Rentabilidade esperada de ${inv.name} (% ao ano)`}
                        className="h-8 text-xs mt-0.5"
                        value={campos[chaveCampo(inv.id, "taxa")] ?? String(inv.expectedReturn ?? 10)}
                        onChange={(e) => escrever(chaveCampo(inv.id, "taxa"), e.target.value)}
                        onBlur={() => salvarTaxa(inv)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                    </label>
                    <div className="w-28 shrink-0 text-[10px] text-muted-foreground">
                      Novo aporte (R$)
                      <div className="flex items-center gap-1 mt-0.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="R$"
                          aria-label={`Novo aporte em ${inv.name}`}
                          className="h-8 text-xs flex-1 min-w-0"
                          value={campos[chaveCampo(inv.id, "aporte")] ?? ""}
                          onChange={(e) => escrever(chaveCampo(inv.id, "aporte"), e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") lancarAporte(inv); }}
                        />
                        <button
                          type="button"
                          onClick={() => lancarAporte(inv)}
                          aria-label={`Adicionar aporte em ${inv.name}`}
                          className="h-8 w-8 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Financial Independence Calculator */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h4 className="text-xs font-bold mb-3 flex items-center gap-2">
          <Percent className="w-4 h-4" />
          SIMULADOR DE INDEPENDÊNCIA FINANCEIRA
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Se continuar aportando</p>
            <p className="text-sm font-bold">{reais(monthlyContributions)}/mês</p>
            <p className="text-[10px] text-muted-foreground">Taxa média: {pct(weightedRate, 1)} a.a.</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Em 5 anos terá</p>
            <p className="text-sm font-bold text-green-400">
              {reais(projection5y)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Em 10 anos terá</p>
            <p className="text-sm font-bold text-green-400">
              {reais(projection10y)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Renda passiva potencial</p>
            <p className="text-sm font-bold text-purple-400">
              {reais(passiveIncome)}/mês
            </p>
            <p className="text-[10px] text-muted-foreground">({pct(weightedRate, 1)} a.a.)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
