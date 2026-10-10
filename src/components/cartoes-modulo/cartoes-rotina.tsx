import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniHabitos } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da ROTINA (esmeralda). Abas vivas: Minha semana (N), Meu mês, Foco. */
const cartoesRotina = (): ConfigCartoes => ({
  moduleId: "rotina",
  classe: "ct-rotina",
  nome: "Rotina",
  agora: {
    titulo: "Faz isso agora",
    texto: "Cria 1 hábito — pode ser \"beber água\".",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-habit"]',
    apoio: "Ele já aparece na sua semana e você marca com um toque por dia.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["📅 MINHA SEMANA", "📆 MEU MÊS", "🧠 FOCO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("rotina")} largura={620} altura={210} dedinho={{ x: "62%", y: "34%" }} legenda="Em MINHA SEMANA: cada quadradinho é um hábito num dia — toca pra marcar feito.">
        <MiniHabitos />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Diário", "Revisão da semana", "Rituais"] },
});
export default cartoesRotina;
