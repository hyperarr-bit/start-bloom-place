import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da MENTE / Hiperfoco (violeta). Abas vivas: Dia, Metas, Ideias. */
const cartoesHiperfoco = (): ConfigCartoes => ({
  moduleId: "hiperfoco",
  classe: "ct-hiperfoco",
  nome: "Mente",
  agora: {
    titulo: "Faz isso agora",
    texto: "Anota 1 pensamento que está rodando na cabeça.",
    botao: "Fazer agora",
    seletor: 'textarea[placeholder="O que está pensando?"], input[placeholder="O que está pensando?"]',
    apoio: "Tira da cabeça, põe aqui. Depois você acha pela busca.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["💭 DIA", "🎯 METAS", "💡 IDEIAS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("hiperfoco")} largura={470} altura={210} dedinho={{ x: "40%", y: "30%" }} legenda="Em DIA: escreve o pensamento e toca em salvar — a lista do dia cresce embaixo.">
        <div className="p-3"><ThoughtCapture /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Estratégia", "Timeline", "Sonhos"] },
});
export default cartoesHiperfoco;
