import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniBarras, MiniChips, MiniLinhas, quadrosDigitar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-slate-200 text-slate-900";
const BOTAO = "bg-slate-700";

/** Os 5 cartões da CARREIRA (grafite). Ordem: Meu dia, Skills, Vagas; Rede, Prep. de entrevista e Portfólio pra depois. */
const cartoesCarreira = (): ConfigCartoes => ({
  moduleId: "carreira",
  classe: "ct-carreira",
  nome: "Carreira",
  agora: {
    texto: "Anota 1 tarefa do trabalho pra hoje.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Adicionar uma tarefa..."], input[placeholder="Nova fase..."]',
    apoio: "O Meu Dia junta tarefas e fases do trabalho num lugar só.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Responder e-mails", "Reunião de equipe · 14h"], "Fechar o relatório", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="MEU DIA" emoji="🗓️" cor={COR} corBotao={BOTAO} placeholder="Adicionar uma tarefa…" itens={["Responder e-mails", "Reunião de equipe · 14h"]} caixa />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "As fases do seu dia",
      texto: "Manhã de foco, reuniões, fechamento — cada tarefa na fase certa.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1200} quadros={quadrosValor([0, 1, 2], { x: "30%", y: "46%" })}>
          <MiniChips titulo="FASES" emoji="⏱️" cor={COR} corAcesa={BOTAO} chips={["Manhã · foco", "Tarde · reuniões", "Fim · fechamento"]} abaixo={<p className="text-[11px] text-muted-foreground">A fase acesa é a de agora.</p>} />
        </Miniatura>
      ),
    },
    {
      titulo: "Skills",
      texto: "O que você domina e o que quer aprender, com nível.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniBarras titulo="SKILLS" emoji="⚡" cor={COR} corBarra={BOTAO} barras={[{ rotulo: "Excel", valor: 80 }, { rotulo: "Inglês", valor: 60 }, { rotulo: "Liderança", valor: 45 }]} rodape="em % do nível que você quer" />
        </Miniatura>
      ),
    },
    {
      titulo: "Vagas que você acompanha",
      texto: "Onde aplicou, em que etapa está, quando é a entrevista.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniLinhas titulo="VAGAS" emoji="💼" cor={COR} corBotao={BOTAO} caixa={false} itens={["Analista Sr · Nubank", "Coordenador · iFood", "Gerente · Natura"]} subtitulos={{ "Analista Sr · Nubank": "aplicado · 02/10", "Coordenador · iFood": "entrevista · 14/10 às 10h", "Gerente · Natura": "salvo" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Rede de contatos", "Prep. de entrevista", "Portfólio"] },
});
export default cartoesCarreira;
