import { useState } from "react";
import { ExpenseTable } from "@/components/ExpenseTable";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniBarras, MiniCalendario, quadrosDigitar } from "./blocos";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-amber-100 text-amber-900";
const BOTAO = "bg-amber-600";

/** A tabela de gastos REAL, reduzida, com os gastos de exemplo da demo em memória. */
const MiniGastos = () => {
  const [gastos, setGastos] = useState<any[]>(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const s = getSeedsForModule("financas")["finance-expenses"];
    return Array.isArray(s) ? s.slice(0, 4) : [];
  });
  return <div className="p-3"><ExpenseTable expenses={gastos} setExpenses={setGastos} /></div>;
};

/**
 * Os 5 cartões de FINANÇAS (âmbar). Ordem do diagnóstico: Meu financeiro (N), Dashboard
 * (N), Meu mês; Limites, Simuladores e Desejos pra depois. `irParaFinanceiro` abre a aba
 * onde mora o "+ Novo gasto".
 */
export const cartoesFinancas = ({ irParaFinanceiro }: { irParaFinanceiro: () => void }): ConfigCartoes => ({
  moduleId: "financas",
  classe: "ct-financas",
  nome: "Finanças",
  agora: {
    texto: "Anota 1 gasto de hoje — qualquer um, até o café.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-expense"]',
    antes: irParaFinanceiro,
    apoio: "Escreve o gasto, o valor, e toca no +. O mês soma sozinho.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Mercado · R$ 235,00", "Uber · R$ 38,00"], "Café · R$ 12,00", { x: "24%", y: "24%" }, { x: "24%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="CUSTOS VARIÁVEIS" emoji="💸" cor={COR} corBotao={BOTAO} placeholder="+ Novo gasto" itens={["Mercado · R$ 235,00", "Uber · R$ 38,00"]} subtitulos={{ "Mercado · R$ 235,00": "Alimentação · Pix", "Uber · R$ 38,00": "Transporte · Pix", "Café · R$ 12,00": "Alimentação · Pix" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Seus gastos, mês a mês",
      texto: "A tabela de verdade: categoria, forma de pagamento e o total do mês.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("financas")} largura={470} altura={200} dedinho={{ x: "20%", y: "20%" }}>
          <MiniGastos />
        </Miniatura>
      ),
    },
    {
      titulo: "Seu mês num olhar",
      texto: "O Dashboard soma receitas, fixos e variáveis — e diz quanto sobra.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniBarras titulo="DASHBOARD" emoji="📊" cor={COR} corBarra={BOTAO} unidade="R$ " barras={[{ rotulo: "Receitas", valor: 3500 }, { rotulo: "Fixos", valor: 1850 }, { rotulo: "Variáveis", valor: 643 }, { rotulo: "Sobra", valor: 1007 }]} rodape="Saldo do mês: R$ 1.007" />
        </Miniatura>
      ),
    },
    {
      titulo: "Contas que vencem",
      texto: "No Meu mês cada conta cai no dia — e o app te lembra antes.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniCalendario titulo="MEU MÊS" emoji="📅" cor={COR} corMarca={BOTAO} marcados={[5, 10, 20]} legendas={{ 5: "Aluguel · R$ 1.200", 10: "Energia · R$ 178", 20: "Internet · R$ 99" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Limites por categoria", "Simuladores", "Desejos"] },
});

/** Pelo registro (sem a página por perto): a aba abre pelo rótulo. */
export default (): ConfigCartoes => cartoesFinancas({ irParaFinanceiro: () => abrirAba("MEU FINANCEIRO") });
