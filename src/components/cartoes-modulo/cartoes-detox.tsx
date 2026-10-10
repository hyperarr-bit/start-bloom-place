import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões do DETOX (lima). Abas vivas: Rastreador (N), Diário. */
const cartoesDetox = (): ConfigCartoes => ({
  moduleId: "detox",
  classe: "ct-detox",
  nome: "Detox",
  agora: {
    titulo: "Faz isso agora",
    texto: "Diz 1 coisa que você quer largar.",
    botao: "Fazer agora",
    seletor: 'input[placeholder^="O que quer parar"]',
    apoio: "Redes sociais, açúcar, cigarro — o check-in de cada dia vira sua sequência.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Duas abas bastam pra começar:",
    abas: ["🌿 RASTREADOR", "📓 DIÁRIO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("detox")} largura={470} altura={210} dedinho={{ x: "70%", y: "40%" }} legenda="Em RASTREADOR: cada hábito com o check-in do dia e os dias seguidos.">
        <div className="p-3"><DetoxTracker /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Conquistas", "Stats", "Diário"] },
});
export default cartoesDetox;
