import { BucketList } from "@/components/travel/BucketList";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões de VIAGENS (verde-água). Abas vivas: Destinos, Roteiro, Mala. */
const cartoesViagens = (): ConfigCartoes => ({
  moduleId: "viagens",
  classe: "ct-viagens",
  nome: "Viagens",
  agora: {
    titulo: "Faz isso agora",
    texto: "Anota 1 destino dos seus sonhos.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Destino..."], input[placeholder="Destino"]',
    apoio: "Só o lugar. Roteiro, mala e orçamento vêm quando a viagem ficar de pé.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["🧭 DESTINOS", "🗺️ ROTEIRO", "🎒 MALA"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("viagens")} largura={470} altura={210} dedinho={{ x: "30%", y: "26%" }} legenda="Em DESTINOS: a lista dos lugares que você quer ver — escreve o destino e toca no +.">
        <div className="p-3"><BucketList /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Câmbio", "Rachar conta", "SOS"] },
});
export default cartoesViagens;
