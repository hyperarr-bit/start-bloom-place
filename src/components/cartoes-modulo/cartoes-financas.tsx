import { useState } from "react";
import { ExpenseTable } from "@/components/ExpenseTable";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** A tabela de gastos REAL, reduzida, com os gastos de exemplo da demo em memória. */
const MiniGastos = () => {
  const [gastos, setGastos] = useState<any[]>(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const s = getSeedsForModule("financas")["finance-expenses"];
    return Array.isArray(s) ? s.slice(0, 4) : [];
  });
  return <div className="p-3"><ExpenseTable expenses={gastos} setExpenses={setGastos} /></div>;
};

/** Os 3 cartões de FINANÇAS (âmbar). `irParaFinanceiro` abre a aba onde mora o "+ Novo gasto". */
export const cartoesFinancas = ({ irParaFinanceiro }: { irParaFinanceiro: () => void }): ConfigCartoes => ({
  moduleId: "financas",
  classe: "ct-financas",
  nome: "Finanças",
  agora: {
    titulo: "Faz isso agora",
    texto: "Anota 1 gasto de hoje — qualquer um, até o café.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-expense"]',
    antes: irParaFinanceiro,
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três lugares bastam pra começar:",
    abas: ["💰 MEU FINANCEIRO", "📊 DASHBOARD", "📅 MEU MÊS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("financas")} largura={470} altura={200} dedinho={{ x: "20%", y: "20%" }} legenda="Em MEU FINANCEIRO: escreve o gasto, o valor, e toca no +. O mês soma sozinho.">
        <MiniGastos />
      </Miniatura>
    ),
  },
  depois: {
    titulo: "O que não precisa hoje",
    itens: ["Investimentos", "Limites por categoria", "Simuladores"],
  },
});

/** Pelo registro (sem a página por perto): a aba abre pelo rótulo. */
export default (): ConfigCartoes => cartoesFinancas({ irParaFinanceiro: () => abrirAba("MEU FINANCEIRO") });
