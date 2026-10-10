import RoomManager from "@/components/casa/RoomManager";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da CASA (ciano). Abas vivas: Cômodos, Despensa, Mercado. */
const cartoesCasa = (): ConfigCartoes => ({
  moduleId: "casa",
  classe: "ct-casa",
  nome: "Casa",
  agora: {
    titulo: "Faz isso agora",
    texto: "Toca num cômodo e anota 1 tarefa dele.",
    botao: "Fazer agora",
    seletor: 'input[placeholder^="Adicionar item"], input[placeholder^="Nome do cômodo"], [data-spotlight="tab-mercado"]',
    apoio: "A cozinha, a sala e o quarto já estão aqui — é só dizer o que falta fazer.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["🚪 CÔMODOS", "🛒 DESPENSA", "🍎 MERCADO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("casa")} largura={470} altura={210} dedinho={{ x: "30%", y: "45%" }} legenda="Em CÔMODOS: cada cômodo com as tarefas dele; na DESPENSA, o que acabou vai direto pro MERCADO.">
        <div className="p-3"><RoomManager /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Manutenção", "Co-op", "Segurança"] },
});
export default cartoesCasa;
