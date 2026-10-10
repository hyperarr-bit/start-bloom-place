import { Miniatura } from "./Miniatura";
import { MiniPlanoDeTreino } from "./replicas";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões do TREINO (azul). Abas vivas: Plano (N), Hoje, Semana. */
const cartoesTreino = (): ConfigCartoes => ({
  moduleId: "treino",
  classe: "ct-treino",
  nome: "Treino",
  agora: {
    titulo: "Faz isso agora",
    texto: "Escolhe um modelo pronto de treino.",
    botao: "Fazer agora",
    seletor: '[data-testid="plano-semana"], [data-spotlight="add-exercise"], [data-testid="plano-do-dia"]',
    antes: () => abrirAba("PLANO"),
    apoio: "Dois toques e a semana inteira fica montada — você só ajusta.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["📋 PLANO", "🏋️ HOJE", "📅 SEMANA"],
    miniatura: (
      <Miniatura sementes={{}} largura={620} altura={200} dedinho={{ x: "18%", y: "80%" }} legenda="Em PLANO: toca num modelo e a semana nasce pronta; em HOJE você marca cada série.">
        <MiniPlanoDeTreino />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Evolução", "Recordes", "Carga por exercício"] },
});
export default cartoesTreino;
