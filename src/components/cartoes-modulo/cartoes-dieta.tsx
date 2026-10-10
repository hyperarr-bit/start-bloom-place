import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniCardapio } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da DIETA (verde). Abas vivas: Cardápio (N), Diário. */
const cartoesDieta = (): ConfigCartoes => ({
  moduleId: "dieta",
  classe: "ct-dieta",
  nome: "Dieta",
  agora: {
    titulo: "Faz isso agora",
    texto: "Toca no dia de hoje e põe 1 refeição.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="first-day"]',
    apoio: "Pode ser o que você já comeu — o cardápio nasce do seu dia real.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Duas abas bastam pra começar:",
    abas: ["🍽️ CARDÁPIO", "📊 DIÁRIO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("dieta")} largura={620} altura={210} dedinho={{ x: "50%", y: "40%" }} legenda="Em CARDÁPIO: cada dia tem suas refeições; toca numa pra escrever o que vai comer.">
        <MiniCardapio />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Jejum", "Receitas", "Lista de compras"] },
});
export default cartoesDieta;
