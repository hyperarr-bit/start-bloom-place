import { GoalsBoardV2 } from "@/components/hiperfoco/GoalsBoardV2";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões de METAS / Dev. Pessoal (roxo). Abas vivas: Metas, Humor & score, Sobre mim. */
const cartoesDesenvolvimento = (): ConfigCartoes => ({
  moduleId: "desenvolvimento",
  classe: "ct-desenvolvimento",
  nome: "Metas",
  agora: {
    titulo: "Faz isso agora",
    texto: "Escreve 1 meta — a que mais importa este mês.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-goal"]',
    antes: () => abrirAba("METAS"),
    apoio: "Só o nome. Etapas e prazo você põe quando quiser.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["🎯 METAS", "😊 HUMOR & SCORE", "🧠 SOBRE MIM"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("desenvolvimento")} largura={470} altura={210} dedinho={{ x: "22%", y: "28%" }} legenda="Em METAS: o quadro das suas metas, com etapas e progresso — toca em Criar.">
        <div className="p-3"><GoalsBoardV2 /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Carta pro futuro", "Respiração", "Desafio de 30 dias"] },
});
export default cartoesDesenvolvimento;
