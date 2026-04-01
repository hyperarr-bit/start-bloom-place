import { useState } from "react";
import { Calculator, TrendingUp, Clock, CreditCard, Target, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Simulators = () => {
  // Compound Interest Calculator
  const [compound, setCompound] = useState({ initial: 1000, monthly: 500, rate: 10, years: 10 });
  const calculateCompound = () => {
    const monthlyRate = compound.rate / 100 / 12;
    const months = compound.years * 12;
    let total = compound.initial;
    for (let i = 0; i < months; i++) {
      total = total * (1 + monthlyRate) + compound.monthly;
    }
    const invested = compound.initial + compound.monthly * months;
    return { total: Math.round(total), invested, profit: Math.round(total - invested) };
  };
  const compoundResult = calculateCompound();

  // Time to Save Calculator
  const [timeToSave, setTimeToSave] = useState({ goal: 10000, monthly: 500, rate: 8 });
  const calculateTimeToSave = () => {
    const monthlyRate = timeToSave.rate / 100 / 12;
    let total = 0;
    let months = 0;
    while (total < timeToSave.goal && months < 600) {
      total = total * (1 + monthlyRate) + timeToSave.monthly;
      months++;
    }
    return { months, years: Math.floor(months / 12), remainingMonths: months % 12 };
  };
  const timeResult = calculateTimeToSave();

  // Finance vs Cash Calculator
  const [financing, setFinancing] = useState({ price: 50000, downPayment: 10000, installments: 48, rate: 1.5 });
  const calculateFinancing = () => {
    const principal = financing.price - financing.downPayment;
    const monthlyRate = financing.rate / 100;
    const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, financing.installments)) / 
                (Math.pow(1 + monthlyRate, financing.installments) - 1);
    const totalPaid = financing.downPayment + pmt * financing.installments;
    const interest = totalPaid - financing.price;
    return { pmt: Math.round(pmt), totalPaid: Math.round(totalPaid), interest: Math.round(interest) };
  };
  const financeResult = calculateFinancing();

  // Financial Independence Calculator
  const [independence, setIndependence] = useState({ monthlyExpenses: 5000, currentInvestments: 50000, monthlyContribution: 2000, returnRate: 8 });
  const calculateIndependence = () => {
    const annualExpenses = independence.monthlyExpenses * 12;
    const targetAmount = annualExpenses * 25; // 4% rule
    const monthlyRate = independence.returnRate / 100 / 12;
    let total = independence.currentInvestments;
    let months = 0;
    while (total < targetAmount && months < 1200) {
      total = total * (1 + monthlyRate) + independence.monthlyContribution;
      months++;
    }
    const passiveIncome = (total * (independence.returnRate / 100)) / 12;
    return { 
      targetAmount: Math.round(targetAmount), 
      months, 
      years: Math.floor(months / 12),
      remainingMonths: months % 12,
      passiveIncome: Math.round(passiveIncome),
      currentProgress: Math.min((independence.currentInvestments / targetAmount) * 100, 100)
    };
  };
  const independenceResult = calculateIndependence();

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Compound Interest */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            SIMULADOR DE JUROS COMPOSTOS
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-muted-foreground">Valor inicial (R$)</label>
              <Input
                type="number"
                value={compound.initial}
                onChange={(e) => setCompound({ ...compound, initial: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte mensal (R$)</label>
              <Input
                type="number"
                value={compound.monthly}
                onChange={(e) => setCompound({ ...compound, monthly: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Taxa anual (%)</label>
              <Input
                type="number"
                value={compound.rate}
                onChange={(e) => setCompound({ ...compound, rate: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Período (anos)</label>
              <Input
                type="number"
                value={compound.years}
                onChange={(e) => setCompound({ ...compound, years: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total investido:</span>
              <span>R$ {compoundResult.invested.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Rendimento:</span>
              <span className="text-green-400">+R$ {compoundResult.profit.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-green-500/20">
              <span>Montante final:</span>
              <span className="text-green-400">R$ {compoundResult.total.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>

        {/* Time to Save */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            QUANTO TEMPO PRA JUNTAR?
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-muted-foreground">Meta (R$)</label>
              <Input
                type="number"
                value={timeToSave.goal}
                onChange={(e) => setTimeToSave({ ...timeToSave, goal: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte/mês (R$)</label>
              <Input
                type="number"
                value={timeToSave.monthly}
                onChange={(e) => setTimeToSave({ ...timeToSave, monthly: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Taxa a.a. (%)</label>
              <Input
                type="number"
                value={timeToSave.rate}
                onChange={(e) => setTimeToSave({ ...timeToSave, rate: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Você alcançará sua meta em:</p>
            <p className="text-2xl font-bold text-blue-400">
              {timeResult.years > 0 && `${timeResult.years} ano(s)`} {timeResult.remainingMonths > 0 && `${timeResult.remainingMonths} mês(es)`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">({timeResult.months} meses no total)</p>
          </div>
        </div>

        {/* Finance vs Cash */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-400" />
            FINANCIAR OU PAGAR À VISTA?
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-muted-foreground">Valor do bem (R$)</label>
              <Input
                type="number"
                value={financing.price}
                onChange={(e) => setFinancing({ ...financing, price: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Entrada (R$)</label>
              <Input
                type="number"
                value={financing.downPayment}
                onChange={(e) => setFinancing({ ...financing, downPayment: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Nº parcelas</label>
              <Input
                type="number"
                value={financing.installments}
                onChange={(e) => setFinancing({ ...financing, installments: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Juros/mês (%)</label>
              <Input
                type="number"
                step="0.1"
                value={financing.rate}
                onChange={(e) => setFinancing({ ...financing, rate: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Parcela mensal:</span>
              <span>R$ {financeResult.pmt.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total pago:</span>
              <span>R$ {financeResult.totalPaid.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-orange-500/20">
              <span>Custo dos juros:</span>
              <span className="text-red-400">+R$ {financeResult.interest.toLocaleString("pt-BR")}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              💡 Você pagará {((financeResult.totalPaid / financing.price - 1) * 100).toFixed(1)}% a mais financiando
            </p>
          </div>
        </div>

        {/* Financial Independence */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            INDEPENDÊNCIA FINANCEIRA
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-muted-foreground">Gastos mensais (R$)</label>
              <Input
                type="number"
                value={independence.monthlyExpenses}
                onChange={(e) => setIndependence({ ...independence, monthlyExpenses: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Investimentos atuais (R$)</label>
              <Input
                type="number"
                value={independence.currentInvestments}
                onChange={(e) => setIndependence({ ...independence, currentInvestments: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte mensal (R$)</label>
              <Input
                type="number"
                value={independence.monthlyContribution}
                onChange={(e) => setIndependence({ ...independence, monthlyContribution: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Retorno anual (%)</label>
              <Input
                type="number"
                value={independence.returnRate}
                onChange={(e) => setIndependence({ ...independence, returnRate: Number(e.target.value) })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Meta (regra 4%):</span>
              <span>R$ {independenceResult.targetAmount.toLocaleString("pt-BR")}</span>
            </div>
            <Progress value={independenceResult.currentProgress} className="h-2" />
            <p className="text-xs text-center">
              Você atingirá a independência em{" "}
              <span className="font-bold text-purple-400">
                {independenceResult.years} anos e {independenceResult.remainingMonths} meses
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground text-center">
              Renda passiva projetada: R$ {independenceResult.passiveIncome.toLocaleString("pt-BR")}/mês
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};