import { useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, PiggyBank, Percent, Calendar, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
      startDate: newInvestment.startDate || new Date().toISOString().split("T")[0],
      broker: newInvestment.broker,
    };
    setInvestments([...investments, investment]);
    setNewInvestment({ type: "renda_fixa", monthlyContribution: 0, expectedReturn: 10 });
    setShowForm(false);
  };

  const deleteInvestment = (id: string) => {
    setInvestments(investments.filter((i) => i.id !== id));
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
          <p className="text-lg font-bold">R$ {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-muted-foreground">Valor Atual</span>
          </div>
          <p className="text-lg font-bold text-purple-400">
            R$ {totalCurrentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
            {totalReturn >= 0 ? "+" : ""}R$ {totalReturn.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className={`text-[10px] ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {returnPercentage >= 0 ? "+" : ""}{returnPercentage.toFixed(2)}%
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-muted-foreground">Aportes Mensais</span>
          </div>
          <p className="text-lg font-bold text-orange-400">
            R$ {monthlyContributions.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                      <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                  <span className={`text-xs w-24 text-right ${returnVal >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {returnVal >= 0 ? "+" : ""}R$ {returnVal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
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
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowForm(!showForm)}>
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
              <div className="relative">
                <Input
                  type="date"
                  value={newInvestment.startDate || ""}
                  onChange={(e) => setNewInvestment({ ...newInvestment, startDate: e.target.value })}
                  className={`h-8 text-xs w-full ${!newInvestment.startDate ? "text-muted-foreground" : ""}`}
                />
                {!newInvestment.startDate && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    Data início
                  </span>
                )}
              </div>
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
                          {(inv.expectedReturn ?? 10).toFixed(1)}% a.a.
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
                          Investido: R$ {(inv.investedAmount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={returnVal >= 0 ? "text-green-400" : "text-red-400"}>
                          Retorno: {returnVal >= 0 ? "+" : ""}R$ {returnVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({returnPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">
                        R$ {inv.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Desde {new Date(inv.startDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteInvestment(inv.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Atualizar valor atual"
                      className="h-6 text-[10px] flex-1"
                      onBlur={(e) => updateCurrentValue(inv.id, parseFloat(e.target.value) || inv.currentValue)}
                      defaultValue={inv.currentValue}
                    />
                    <Input
                      type="number"
                      placeholder="Rent. esperada (% a.a.)"
                      className="h-6 text-[10px] w-24"
                      defaultValue={inv.expectedReturn ?? 10}
                      onBlur={(e) => updateExpectedReturn(inv.id, parseFloat(e.target.value) || inv.expectedReturn)}
                    />
                    <Input
                      type="number"
                      placeholder="Novo aporte"
                      className="h-6 text-[10px] w-28"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat((e.target as HTMLInputElement).value) || 0;
                          if (val > 0) {
                            addContribution(inv.id, val);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
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
            <p className="text-sm font-bold">R$ {monthlyContributions.toLocaleString("pt-BR")}/mês</p>
            <p className="text-[10px] text-muted-foreground">Taxa média: {weightedRate.toFixed(1)}% a.a.</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Em 5 anos terá</p>
            <p className="text-sm font-bold text-green-400">
              R$ {projection5y.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Em 10 anos terá</p>
            <p className="text-sm font-bold text-green-400">
              R$ {projection10y.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Renda passiva potencial</p>
            <p className="text-sm font-bold text-purple-400">
              R$ {passiveIncome.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/mês
            </p>
            <p className="text-[10px] text-muted-foreground">({weightedRate.toFixed(1)}% a.a.)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
