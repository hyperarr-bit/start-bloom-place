import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da SAÚDE (vermelho). Abas vivas: Hoje (N), Evolução, Log médico. */
const cartoesSaude = (): ConfigCartoes => ({
  moduleId: "saude",
  classe: "ct-saude",
  nome: "Saúde",
  agora: {
    titulo: "Faz isso agora",
    texto: "Registra 1 copo d'água.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-water"]',
    apoio: "O caminho mais curto do app: um toque e o dia já começou.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["💊 HOJE", "⚖️ EVOLUÇÃO", "🏥 LOG MÉDICO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("saude")} largura={470} altura={200} dedinho={{ x: "80%", y: "70%" }} legenda="Em HOJE: a água, o sono e os suplementos do dia — tudo de um toque.">
        <div className="p-3"><HydrationTracker /></div>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Log médico", "Medidas", "Suplementos"] },
});
export default cartoesSaude;
