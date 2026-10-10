import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniCursos } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões de ESTUDOS (índigo). Abas vivas: Estudos, Método, Grade. */
const cartoesEstudos = (): ConfigCartoes => ({
  moduleId: "estudos",
  classe: "ct-estudos",
  nome: "Estudos",
  agora: {
    titulo: "Faz isso agora",
    texto: "Adiciona 1 curso que você está fazendo.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Adicionar curso..."], input[placeholder="Nome do curso..."]',
    apoio: "Só o nome. Depois de cada aula você toca em \"Aprendi hoje\" e o Caderno guarda.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["📝 ESTUDOS", "🎯 MÉTODO", "🎓 GRADE"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("estudos")} largura={620} altura={210} dedinho={{ x: "40%", y: "78%" }} legenda="Em ESTUDOS: seus cursos em andamento, com a barra de aulas — escreve o nome e toca no +.">
        <MiniCursos />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Caderno", "Tarefas e provas", "Grade completa"] },
});
export default cartoesEstudos;
