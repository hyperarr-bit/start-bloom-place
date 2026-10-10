import { GoalsBoardV2 } from "@/components/hiperfoco/GoalsBoardV2";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, quadrosDigitar, quadrosMarcar } from "./blocos";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-purple-100 text-purple-900";
const BOTAO = "bg-purple-600";

/** Os 5 cartões de METAS / Dev. Pessoal (roxo). Ordem: Metas, Humor & score, Sobre mim; Carta, Respiração e 30 dias pra depois. */
const cartoesDesenvolvimento = (): ConfigCartoes => ({
  moduleId: "desenvolvimento",
  classe: "ct-desenvolvimento",
  nome: "Metas",
  agora: {
    texto: "Escreve 1 meta — a que mais importa este mês.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-goal"]',
    antes: () => abrirAba("METAS"),
    apoio: "Só o nome. Etapas e prazo você põe quando quiser.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={200} intervalo={1400}
        quadros={quadrosDigitar(["Ler 2 livros", "Guardar R$ 500"], "Correr 5 km", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="METAS" emoji="🎯" cor={COR} corBotao={BOTAO} placeholder="Nova meta…" itens={["Ler 2 livros", "Guardar R$ 500"]} caixa subtitulos={{ "Ler 2 livros": "1 de 2 · até 31/10", "Guardar R$ 500": "R$ 320 · até 31/10" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "O quadro de metas",
      texto: "Cada meta com etapas e progresso — o quadro de verdade, com exemplos.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("desenvolvimento")} largura={470} altura={210} dedinho={{ x: "22%", y: "28%" }}>
          <div className="p-3"><GoalsBoardV2 /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Humor & score",
      texto: "Como você está hoje, num toque — e o score do dia junta tudo.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={190} intervalo={1300} quadros={quadrosMarcar([[], [3], [3]], [{ x: "8%", y: "70%" }, { x: "8%", y: "70%" }, { x: "8%", y: "70%" }])}>
          <MiniLinhas titulo="COMO VOCÊ ESTÁ HOJE" emoji="😊" cor={COR} corBotao={BOTAO} itens={["😡 Péssimo", "😔 Ruim", "😐 Neutro", "🙂 Bom", "🤩 Ótimo"]} rodape="Score do dia: 72 · humor registrado ✓" />
        </Miniatura>
      ),
    },
    {
      titulo: "Sobre mim",
      texto: "O que te move, seus pontos fortes e seus valores — pra reler quando precisar.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170}>
          <MiniLinhas titulo="SOBRE MIM" emoji="🧠" cor={COR} corBotao={BOTAO} caixa={false} itens={["O que me motiva", "Pontos fortes", "Meus valores"]} subtitulos={{ "O que me motiva": "família, liberdade, aprender", "Pontos fortes": "disciplina, foco, empatia", "Meus valores": "honestidade, constância" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Carta pro futuro", "Respiração", "Desafio de 30 dias"] },
});
export default cartoesDesenvolvimento;
