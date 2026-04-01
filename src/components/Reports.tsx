import { useState, useRef } from "react";
import { FileText, Download, Upload, FileSpreadsheet, Printer, Calendar, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Income {
  id: string;
  description: string;
  value: number;
  date: string;
}

interface Expense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  paymentMethod: string;
}

interface ReportsProps {
  incomes: Income[];
  expenses: Expense[];
  totalIncome: number;
  totalExpenses: number;
  totalDebts: number;
  totalInvestments: number;
  setIncomes: (incomes: Income[]) => void;
  setExpenses: (expenses: Expense[]) => void;
}

const categoryLabels: Record<string, string> = {
  vestuario: "Vestuário",
  restaurante: "Restaurante",
  educacao: "Educação",
  presente: "Presentes",
  lazer: "Lazer",
  eletrodomesticos: "Eletrodomésticos",
  mercado: "Mercado",
  transporte: "Transporte",
  saude: "Saúde",
  outros: "Outros",
};

export const Reports = ({
  incomes,
  expenses,
  totalIncome,
  totalExpenses,
  totalDebts,
  totalInvestments,
  setIncomes,
  setExpenses,
}: ReportsProps) => {
  const [importType, setImportType] = useState<"income" | "expense">("expense");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, e) => {
    const cat = e.category || "outros";
    acc[cat] = (acc[cat] || 0) + e.value;
    return acc;
  }, {} as Record<string, number>);

  // Export to CSV
  const exportToCSV = (type: "incomes" | "expenses" | "all") => {
    let csvContent = "";
    
    if (type === "incomes" || type === "all") {
      csvContent += "RECEITAS\nDescrição,Valor,Data\n";
      incomes.forEach((i) => {
        csvContent += `"${i.description}",${i.value},"${i.date}"\n`;
      });
      csvContent += "\n";
    }
    
    if (type === "expenses" || type === "all") {
      csvContent += "DESPESAS\nDescrição,Categoria,Valor,Data,Forma de Pagamento\n";
      expenses.forEach((e) => {
        csvContent += `"${e.description}","${e.category}",${e.value},"${e.date}","${e.paymentMethod}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financas_${type}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Import CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (importType === "income") {
        const newIncomes: Income[] = [];
        lines.forEach((line, index) => {
          if (index === 0) return; // Skip header
          const [description, value, date] = line.split(",").map((s) => s.replace(/"/g, "").trim());
          if (description && value) {
            newIncomes.push({
              id: Date.now().toString() + index,
              description,
              value: parseFloat(value) || 0,
              date: date || new Date().toISOString().split("T")[0],
            });
          }
        });
        setIncomes([...incomes, ...newIncomes]);
      } else {
        const newExpenses: Expense[] = [];
        lines.forEach((line, index) => {
          if (index === 0) return; // Skip header
          const parts = line.split(",").map((s) => s.replace(/"/g, "").trim());
          const [description, category, value, date, paymentMethod] = parts;
          if (description && value) {
            newExpenses.push({
              id: Date.now().toString() + index,
              description,
              category: category || "outros",
              value: parseFloat(value) || 0,
              date: date || new Date().toISOString().split("T")[0],
              paymentMethod: paymentMethod || "Outros",
            });
          }
        });
        setExpenses([...expenses, ...newExpenses]);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Print report
  const printReport = () => {
    const printContent = document.getElementById("monthly-report");
    if (!printContent) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Financeiro - ${currentMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .positive { color: green; }
            .negative { color: red; }
            .summary { display: flex; gap: 20px; margin: 20px 0; }
            .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; flex: 1; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-xs font-bold mb-3">📥 IMPORTAR / EXPORTAR DADOS</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as any)}
              className="h-9 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="expense">Despesas</option>
              <option value="income">Receitas</option>
            </select>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar CSV
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToCSV("incomes")}>
              <Download className="w-4 h-4 mr-1" /> Receitas
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToCSV("expenses")}>
              <Download className="w-4 h-4 mr-1" /> Despesas
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToCSV("all")}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Tudo
            </Button>
          </div>
          <Button size="sm" onClick={printReport} className="ml-auto">
            <Printer className="w-4 h-4 mr-1" /> Imprimir Relatório
          </Button>
        </div>
      </div>

      {/* Monthly Report Preview */}
      <div id="monthly-report" className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Relatório Financeiro</h2>
            <p className="text-sm text-muted-foreground capitalize">{currentMonth}</p>
          </div>
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-lg font-bold text-green-400">R$ {totalIncome.toLocaleString("pt-BR")}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-lg font-bold text-red-400">R$ {totalExpenses.toLocaleString("pt-BR")}</p>
          </div>
          <div className={`${balance >= 0 ? "bg-blue-500/10 border-blue-500/30" : "bg-orange-500/10 border-orange-500/30"} border rounded-lg p-3`}>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-lg font-bold ${balance >= 0 ? "text-blue-400" : "text-orange-400"}`}>
              {balance >= 0 ? "+" : ""}R$ {balance.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Taxa Poupança</p>
            <p className="text-lg font-bold text-purple-400">{savingsRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Despesas por Categoria
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, value]) => (
                <div key={cat} className="flex items-center justify-between bg-muted/30 rounded p-2">
                  <span className="text-xs">{categoryLabels[cat] || cat}</span>
                  <span className="text-xs font-medium">R$ {value.toLocaleString("pt-BR")}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Transactions Tables */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Incomes Table */}
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Receitas ({incomes.length})
            </h3>
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.slice(0, 10).map((i) => (
                    <tr key={i.id} className="border-t border-border/50">
                      <td className="p-2">{i.description}</td>
                      <td className="p-2 text-right text-green-400">R$ {i.value.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Table */}
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              Despesas ({expenses.length})
            </h3>
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 10).map((e) => (
                    <tr key={e.id} className="border-t border-border/50">
                      <td className="p-2">{e.description}</td>
                      <td className="p-2 text-muted-foreground">{categoryLabels[e.category] || e.category}</td>
                      <td className="p-2 text-right text-red-400">R$ {e.value.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          <p>Relatório gerado em {new Date().toLocaleDateString("pt-BR")} • Finanças em Ordem</p>
        </div>
      </div>

      {/* Import Guide */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-xs font-bold mb-2">📋 FORMATO DO CSV PARA IMPORTAÇÃO</h4>
        <div className="text-xs text-muted-foreground space-y-2">
          <p><strong>Receitas:</strong> Descrição, Valor, Data</p>
          <code className="block bg-muted/30 p-2 rounded text-[10px]">
            Salário,5000,2025-03-05<br />
            Freelance,1500,2025-03-10
          </code>
          <p className="mt-2"><strong>Despesas:</strong> Descrição, Categoria, Valor, Data, Forma de Pagamento</p>
          <code className="block bg-muted/30 p-2 rounded text-[10px]">
            Almoço,restaurante,45.90,2025-03-06,Cartão de Crédito<br />
            Uber,transporte,25.00,2025-03-06,Pix
          </code>
        </div>
      </div>
    </div>
  );
};