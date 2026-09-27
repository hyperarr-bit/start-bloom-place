import { useState } from "react";
import { Calculator, TrendingUp, Clock, CreditCard, Target, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { numeroBR } from "@/lib/data-normalizers";

/* SIMULADORES (26/09, varredura). O que mudou e por quê:
 *  - campo apagado virava "0" e, ao digitar 5, "05": o estado era número.
 *    Agora cada campo guarda o TEXTO digitado; a conta lê o número dele.
 *  - aporte 0 dava "50 ano(s) (600 meses)" e, na independência, "100 anos":
 *    era o teto do laço sendo mostrado como resposta. Quando não alcança,
 *    a tela diz que não alcança.
 *  - taxa −50% mostrava "+R$ -49.067": o sinal agora vem do número.
 *  - "Renda passiva projetada" usava o retorno esperado (8%) sobre o total,
 *    enquanto a META é pela regra dos 4% — R$ 10.043 pra quem precisa de
 *    R$ 5.000. A renda passiva agora é a mesma regra da meta (4% a.a.).
 *  - dinheiro sempre com 2 casas e percentual com vírgula. */

/** Número de um campo de texto ("" ou lixo = 0). */
const num = (texto: string) => {
  const n = numeroBR(texto);
  return Number.isFinite(n) ? n : 0;
};

/** Dinheiro com 2 casas e o sinal antes do R$ ("-R$ 49.067,12"). */
export const reais = (v: number) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return `${r < 0 ? "-" : ""}R$ ${Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
/** "+R$ 1.234,00" / "-R$ 49.067,12" */
export const reaisComSinal = (v: number) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return `${r < 0 ? "-" : "+"}R$ ${Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** "2 anos e 3 meses", "1 ano", "7 meses" — sem "ano(s)". */
export const prazoPorExtenso = (meses: number) => {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos > 0 ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const m = resto > 0 ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return a && m ? `${a} e ${m}` : a || m || "0 meses";
};

export const jurosCompostos = (inicial: number, mensal: number, taxaAnual: number, anos: number) => {
  const meses = Math.max(0, Math.round(Math.min(anos, 100) * 12));
  const taxaMes = taxaAnual / 100 / 12;
  let total = inicial;
  for (let i = 0; i < meses; i++) total = total * (1 + taxaMes) + mensal;
  const investido = inicial + mensal * meses;
  return { total, investido, rendimento: total - investido };
};

/** Quanto tempo pra juntar. `alcanca: false` quando o aporte nunca chega lá
 *  (aporte 0 sem rendimento) ou passaria de 50 anos. */
export const tempoParaJuntar = (meta: number, mensal: number, taxaAnual: number, tetoMeses = 600) => {
  if (meta <= 0) return { alcanca: true, meses: 0 };
  const taxaMes = taxaAnual / 100 / 12;
  let total = 0;
  let meses = 0;
  while (total < meta && meses < tetoMeses) {
    total = total * (1 + taxaMes) + mensal;
    meses++;
  }
  return { alcanca: total >= meta, meses };
};

/** Taxa de retirada segura: a meta é 25× o gasto anual, e a renda que ela
 *  paga é 4% a.a. do patrimônio — as duas contas usam a MESMA regra. */
export const REGRA_DOS_4 = 0.04;

export const independenciaFinanceira = (
  gastosMensais: number, investido: number, aporteMensal: number, retornoAnual: number, tetoMeses = 1200,
) => {
  const meta = gastosMensais * 12 * 25;
  const taxaMes = retornoAnual / 100 / 12;
  let total = investido;
  let meses = 0;
  while (total < meta && meses < tetoMeses) {
    total = total * (1 + taxaMes) + aporteMensal;
    meses++;
  }
  const alcanca = meta > 0 && total >= meta;
  return {
    meta,
    meses,
    alcanca,
    jaAlcancou: meta > 0 && investido >= meta,
    // renda passiva do patrimônio projetado pela regra dos 4% (a da meta)
    rendaPassiva: alcanca ? (total * REGRA_DOS_4) / 12 : 0,
    progresso: meta > 0 ? Math.min((investido / meta) * 100, 100) : 0,
  };
};

export const Simulators = () => {
  // Compound Interest Calculator
  const [compound, setCompound] = useState({ initial: "1000", monthly: "500", rate: "10", years: "10" });
  const juros = jurosCompostos(num(compound.initial), num(compound.monthly), num(compound.rate), num(compound.years));

  // Time to Save Calculator
  const [timeToSave, setTimeToSave] = useState({ goal: "10000", monthly: "500", rate: "8" });
  const tempo = tempoParaJuntar(num(timeToSave.goal), num(timeToSave.monthly), num(timeToSave.rate));

  // Finance vs Cash Calculator
  const [financing, setFinancing] = useState({ price: "", downPayment: "", installments: "", rate: "" });
  const calculateFinancing = () => {
    const price = num(financing.price);
    const downPayment = num(financing.downPayment);
    const installments = Math.round(num(financing.installments));
    const principal = price - downPayment;
    const monthlyRate = num(financing.rate) / 100;
    if (principal <= 0 || installments <= 0 || monthlyRate < 0) {
      return { pmt: 0, totalPaid: 0, interest: 0 };
    }
    // juros zero = parcelas iguais sem acréscimo (antes dava parcela R$ 0)
    const pmt = monthlyRate === 0
      ? principal / installments
      : principal * (monthlyRate * Math.pow(1 + monthlyRate, installments)) / (Math.pow(1 + monthlyRate, installments) - 1);
    const totalPaid = downPayment + pmt * installments;
    return { pmt, totalPaid, interest: totalPaid - price };
  };
  const financeResult = calculateFinancing();
  const precoBem = num(financing.price);

  // Financial Independence Calculator
  const [independence, setIndependence] = useState({ monthlyExpenses: "5000", currentInvestments: "50000", monthlyContribution: "2000", returnRate: "8" });
  const indep = independenciaFinanceira(
    num(independence.monthlyExpenses), num(independence.currentInvestments),
    num(independence.monthlyContribution), num(independence.returnRate),
  );

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
                inputMode="decimal"
                value={compound.initial}
                onChange={(e) => setCompound({ ...compound, initial: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte mensal (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={compound.monthly}
                onChange={(e) => setCompound({ ...compound, monthly: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Taxa anual (%)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={compound.rate}
                onChange={(e) => setCompound({ ...compound, rate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Período (anos)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={compound.years}
                onChange={(e) => setCompound({ ...compound, years: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total investido:</span>
              <span>{reais(juros.investido)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Rendimento:</span>
              <span className={juros.rendimento < 0 ? "text-red-400" : "text-green-400"}>{reaisComSinal(juros.rendimento)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-green-500/20">
              <span>Montante final:</span>
              <span className="text-green-400">{reais(juros.total)}</span>
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
                inputMode="decimal"
                value={timeToSave.goal}
                onChange={(e) => setTimeToSave({ ...timeToSave, goal: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte/mês (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={timeToSave.monthly}
                onChange={(e) => setTimeToSave({ ...timeToSave, monthly: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Taxa a.a. (%)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={timeToSave.rate}
                onChange={(e) => setTimeToSave({ ...timeToSave, rate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center" data-testid="resultado-tempo">
            {num(timeToSave.goal) <= 0 ? (
              <p className="text-xs text-muted-foreground">Digite a meta pra ver em quanto tempo chega lá.</p>
            ) : tempo.alcanca ? (
              <>
                <p className="text-xs text-muted-foreground mb-1">Você alcançará sua meta em:</p>
                <p className="text-2xl font-bold text-blue-400">{prazoPorExtenso(tempo.meses)}</p>
                <p className="text-xs text-muted-foreground mt-1">({tempo.meses} {tempo.meses === 1 ? "mês" : "meses"} no total)</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-blue-400">
                  {num(timeToSave.monthly) <= 0 ? "Com esse aporte, não chega na meta." : "Com esse aporte, leva mais de 50 anos."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Aumente o aporte mensal pra ver o prazo.</p>
              </>
            )}
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
                inputMode="decimal"
                placeholder="0"
                value={financing.price}
                onChange={(e) => setFinancing({ ...financing, price: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Entrada (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={financing.downPayment}
                onChange={(e) => setFinancing({ ...financing, downPayment: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Nº parcelas</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={financing.installments}
                onChange={(e) => setFinancing({ ...financing, installments: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Juros/mês (%)</label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="0"
                value={financing.rate}
                onChange={(e) => setFinancing({ ...financing, rate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Parcela mensal:</span>
              <span>{reais(financeResult.pmt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total pago:</span>
              <span>{reais(financeResult.totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-orange-500/20">
              <span>Custo dos juros:</span>
              <span className="text-red-400">{reaisComSinal(financeResult.interest)}</span>
            </div>
            {precoBem > 0 && financeResult.totalPaid > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                💡 Você pagará {((financeResult.totalPaid / precoBem - 1) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% a mais financiando
              </p>
            )}
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
                inputMode="decimal"
                value={independence.monthlyExpenses}
                onChange={(e) => setIndependence({ ...independence, monthlyExpenses: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Investimentos atuais (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={independence.currentInvestments}
                onChange={(e) => setIndependence({ ...independence, currentInvestments: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Aporte mensal (R$)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={independence.monthlyContribution}
                onChange={(e) => setIndependence({ ...independence, monthlyContribution: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Retorno anual (%)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={independence.returnRate}
                onChange={(e) => setIndependence({ ...independence, returnRate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2" data-testid="resultado-independencia">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Meta (regra 4%):</span>
              <span>{reais(indep.meta)}</span>
            </div>
            <Progress value={indep.progresso} className="h-2" />
            {indep.meta <= 0 ? (
              <p className="text-xs text-center text-muted-foreground">Digite seus gastos mensais pra calcular a meta.</p>
            ) : indep.jaAlcancou ? (
              <p className="text-xs text-center">
                <span className="font-bold text-purple-400">Você já chegou lá</span> — seus investimentos cobrem a meta.
              </p>
            ) : indep.alcanca ? (
              <p className="text-xs text-center">
                Você atingirá a independência em{" "}
                <span className="font-bold text-purple-400">{prazoPorExtenso(indep.meses)}</span>
              </p>
            ) : (
              <p className="text-xs text-center">
                <span className="font-bold text-purple-400">Com esse aporte, não chega na meta</span> em 100 anos. Aumente o aporte ou o retorno.
              </p>
            )}
            {indep.alcanca && (
              <p className="text-[10px] text-muted-foreground text-center">
                Renda passiva projetada: {reais(indep.rendaPassiva)}/mês (4% a.a. do patrimônio)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
