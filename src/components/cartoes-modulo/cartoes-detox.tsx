import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniBarras, MiniSemana, quadrosDigitar, quadrosMarcar } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-lime-100 text-lime-900";
const BOTAO = "bg-lime-600";

/** Os 5 cartões do DETOX (lima). Ordem: Rastreador (N), a sequência, Stats; Conquistas e Diário pra depois. */
const cartoesDetox = (): ConfigCartoes => ({
  moduleId: "detox",
  classe: "ct-detox",
  nome: "Detox",
  agora: {
    texto: "Diz 1 coisa que você quer largar.",
    botao: "Fazer agora",
    seletor: 'input[placeholder^="O que quer parar"]',
    apoio: "Redes sociais, açúcar, cigarro — o check-in de cada dia vira sua sequência.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={170} intervalo={1400}
        quadros={quadrosDigitar(["Açúcar"], "Redes sociais à noite", { x: "24%", y: "24%" }, { x: "10%", y: "62%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="RASTREADOR" emoji="🌿" cor={COR} corBotao={BOTAO} placeholder="O que quer parar?" itens={["Açúcar"]} caixa subtitulos={{ Açúcar: "4 dias seguidos", "Redes sociais à noite": "começa hoje" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "O rastreador de verdade",
      texto: "Cada hábito com o check-in do dia e os dias seguidos.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("detox")} largura={470} altura={210} dedinho={{ x: "70%", y: "40%" }}>
          <div className="p-3"><DetoxTracker /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "O check-in vira sequência",
      texto: "Um toque por dia — a semana mostra o que você segurou.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150} intervalo={1200} quadros={quadrosMarcar([[0, 1, 2, 7, 8], [0, 1, 2, 3, 7, 8], [0, 1, 2, 3, 7, 8, 9]], [{ x: "52%", y: "42%" }, { x: "52%", y: "42%" }, { x: "44%", y: "58%" }])}>
          <MiniSemana titulo="SEQUÊNCIA" emoji="🔥" cor={COR} corMarca={BOTAO} linhas={["Açúcar", "Redes"]} />
        </Miniatura>
      ),
    },
    {
      titulo: "Stats",
      texto: "Dias limpos, melhor sequência, recaídas — sem julgamento.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150}>
          <MiniBarras titulo="DIAS LIMPOS" emoji="📈" cor={COR} corBarra={BOTAO} barras={[{ rotulo: "Açúcar", valor: 12 }, { rotulo: "Redes", valor: 5 }]} rodape="melhor sequência: 12 dias" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Conquistas", "Diário"] },
});
export default cartoesDetox;
