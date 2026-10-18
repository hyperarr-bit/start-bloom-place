import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, MiniMeta, quadrosDigitar, quadrosMarcar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-green-100 text-green-900";
const BOTAO = "bg-green-600";

/**
 * Os 5 cartões da DIETA (verde) — o exemplo do dono: o mais importante é o CARDÁPIO,
 * então o 1º mostra uma refeição sendo adicionada. Ordem do diagnóstico: Cardápio (N),
 * Diário, meta de calorias, Receitas/Lista; Jejum e Substitutos ficam pra depois.
 */
const cartoesDieta = (): ConfigCartoes => ({
  moduleId: "dieta",
  classe: "ct-dieta",
  nome: "Dieta",
  agora: {
    texto: "Seu cardápio da semana: toca no dia de hoje e põe 1 refeição.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="first-day"]',
    apoio: "Pode ser o que você já comeu — o cardápio nasce do seu dia real.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Café da manhã · Pão integral com ovo"], "Almoço · Arroz, feijão e frango", { x: "28%", y: "24%" }, { x: "28%", y: "62%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="SEGUNDA · CARDÁPIO" emoji="🍽️" cor={COR} corBotao={BOTAO} placeholder="Almoço: o que vai comer?" itens={["Café da manhã · Pão integral com ovo"]} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Diário: marca o que comeu",
      texto: "Cada refeição marcada fecha o dia — e conta no score.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300}
          quadros={quadrosMarcar([[0], [0, 1], [0, 1, 2]], [{ x: "8%", y: "44%" }, { x: "8%", y: "58%" }, { x: "8%", y: "72%" }])}>
          <MiniLinhas titulo="DIÁRIO DE HOJE" emoji="📊" cor={COR} corBotao={BOTAO} itens={["Café da manhã", "Almoço", "Lanche da tarde", "Jantar"]} subtitulos={{ "Café da manhã": "Pão integral com ovo · 350 kcal", Almoço: "Arroz, feijão e frango · 700 kcal", "Lanche da tarde": "Iogurte com banana · 200 kcal", Jantar: "Sopa de legumes · 400 kcal" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Meta de calorias",
      texto: "Automática (a soma do seu cardápio) ou fixa — você escolhe.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300} quadros={quadrosValor([650, 1250, 1650])}>
          <MiniMeta titulo="META DE CALORIAS" emoji="🔥" cor={COR} corBarra={BOTAO} valor={1250} alvo={1800} unidade="kcal" legenda="Automática · soma do cardápio de hoje. Toca em Fixa pra escolher um número." />
        </Miniatura>
      ),
    },
    {
      titulo: "Receitas e lista de compras",
      texto: "As receitas da semana viram a lista do mercado — marca o que já pegou.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300} quadros={quadrosMarcar([[], [0], [0, 1]], [{ x: "8%", y: "44%" }, { x: "8%", y: "44%" }, { x: "8%", y: "58%" }])}>
          <MiniLinhas titulo="LISTA DE COMPRAS" emoji="🛒" cor={COR} corBotao={BOTAO} itens={["Frango · 1 kg", "Arroz integral", "Banana · 6", "Iogurte natural"]} rodape="Sai das receitas da semana" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Jejum", "Substitutos"] },
});
export default cartoesDieta;
