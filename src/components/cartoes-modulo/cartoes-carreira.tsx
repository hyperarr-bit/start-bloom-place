import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniMeuDia } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da CARREIRA (grafite). Abas vivas: Meu dia, Vagas, Skills. */
const cartoesCarreira = (): ConfigCartoes => ({
  moduleId: "carreira",
  classe: "ct-carreira",
  nome: "Carreira",
  agora: {
    titulo: "Faz isso agora",
    texto: "Anota 1 tarefa do trabalho pra hoje.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Adicionar uma tarefa..."], input[placeholder="Nova fase..."]',
    apoio: "O Meu Dia junta tarefas e fases do trabalho num lugar só.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["🗓️ MEU DIA", "💼 VAGAS", "⚡ SKILLS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("carreira")} largura={620} altura={210} dedinho={{ x: "40%", y: "60%" }} legenda="Em MEU DIA: as tarefas de hoje e as fases do seu trabalho — marca o que fez.">
        <MiniMeuDia />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Rede de contatos", "Prep. de entrevista", "Portfólio"] },
});
export default cartoesCarreira;
