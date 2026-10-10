import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniCalendario, MiniMeta, MiniSemana, quadrosDigitar, quadrosMarcar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-emerald-100 text-emerald-900";
const BOTAO = "bg-emerald-600";

/** Os 5 cartões da ROTINA (esmeralda). Ordem: Minha semana (N), Meu mês, Foco; Diário, Revisão e Rituais pra depois. */
const cartoesRotina = (): ConfigCartoes => ({
  moduleId: "rotina",
  classe: "ct-rotina",
  nome: "Rotina",
  agora: {
    texto: "Cria 1 hábito — pode ser \"beber água\".",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-habit"]',
    apoio: "Ele já aparece na sua semana e você marca com um toque por dia.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={200} intervalo={1400}
        quadros={quadrosDigitar(["Meditar", "Alongar"], "Beber água", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="HÁBITOS DIÁRIOS" emoji="✅" cor={COR} corBotao={BOTAO} placeholder="Novo hábito…" itens={["Meditar", "Alongar"]} caixa />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Marca a semana",
      texto: "Cada quadradinho é um hábito num dia — a linha da semana cresce sozinha.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170} intervalo={1200}
          quadros={quadrosMarcar([[0, 1, 7, 8], [0, 1, 7, 8, 14], [0, 1, 7, 8, 14, 15]], [{ x: "36%", y: "58%" }, { x: "36%", y: "58%" }, { x: "44%", y: "58%" }])}>
          <MiniSemana titulo="MINHA SEMANA" emoji="📅" cor={COR} corMarca={BOTAO} linhas={["Meditar", "Alongar", "Beber água"]} />
        </Miniatura>
      ),
    },
    {
      titulo: "Meu mês: compromissos",
      texto: "Dentista, aniversário, prova — com hora, e o aviso antes.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={210}>
          <MiniCalendario titulo="MEU MÊS" emoji="📆" cor={COR} corMarca={BOTAO} marcados={[3, 12, 18]} legendas={{ 3: "Academia · 7h", 12: "Dentista · 15h", 18: "Aniversário da Lu" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Foco: 25 minutos",
      texto: "O pomodoro conta o tempo e guarda quantos blocos você fez.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150} intervalo={1200} quadros={quadrosValor([10, 18, 25])}>
          <MiniMeta titulo="FOCO" emoji="🧠" cor={COR} corBarra={BOTAO} valor={18} alvo={25} unidade="min" legenda="25 de foco, 5 de pausa — 3 blocos hoje" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Diário", "Revisão da semana", "Rituais"] },
});
export default cartoesRotina;
