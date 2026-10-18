import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniBarras, MiniMeta, MiniSemana, quadrosDigitar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-indigo-100 text-indigo-900";
const BOTAO = "bg-indigo-600";

/** Os 5 cartões de ESTUDOS (índigo). Ordem: Estudos (cursos), Método, Grade; Caderno, Tarefas e provas pra depois. */
const cartoesEstudos = (): ConfigCartoes => ({
  moduleId: "estudos",
  classe: "ct-estudos",
  nome: "Estudos",
  agora: {
    texto: "Adiciona 1 curso que você está fazendo.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Adicionar curso..."], input[placeholder="Nome do curso..."]',
    apoio: "Só o nome. Depois de cada aula você toca em \"Aprendi hoje\" e o Caderno guarda.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Inglês B2", "Excel do zero"], "Python pra dados", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="CURSOS EM ANDAMENTO" emoji="📝" cor={COR} corBotao={BOTAO} placeholder="Adicionar curso…" itens={["Inglês B2", "Excel do zero"]} subtitulos={{ "Inglês B2": "12 de 20 aulas", "Excel do zero": "7 de 20 aulas", "Python pra dados": "0 de 30 aulas" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Aulas e progresso",
      texto: "Cada aula feita enche a barra do curso.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniBarras titulo="PROGRESSO" emoji="📈" cor={COR} corBarra={BOTAO} barras={[{ rotulo: "Inglês B2", valor: 60 }, { rotulo: "Excel", valor: 35 }, { rotulo: "Python", valor: 10 }]} rodape="em % das aulas" />
        </Miniatura>
      ),
    },
    {
      titulo: "Método: pomodoro e revisão",
      texto: "25 min de foco, 5 de pausa — e a revisão espaçada te lembra na hora certa.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1200} quadros={quadrosValor([1, 2, 3])}>
          <MiniMeta titulo="POMODORO DE HOJE" emoji="🍅" cor={COR} corBarra={BOTAO} valor={2} alvo={4} unidade="blocos" legenda="Revisão de Inglês: hoje · Excel: em 3 dias" />
        </Miniatura>
      ),
    },
    {
      titulo: "Grade de matérias",
      texto: "Qual matéria em qual dia — a semana de estudo num olhar.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniSemana titulo="GRADE" emoji="🎓" cor={COR} corMarca={BOTAO} linhas={["Inglês", "Excel", "Python"]} marcados={[0, 2, 8, 10, 16, 18]} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Caderno", "Tarefas e provas", "Grade completa"] },
});
export default cartoesEstudos;
