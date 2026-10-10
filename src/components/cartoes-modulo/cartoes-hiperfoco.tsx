import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, quadrosDigitar, quadrosMarcar } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-violet-100 text-violet-900";
const BOTAO = "bg-violet-600";

/** Os 5 cartões da MENTE / Hiperfoco (violeta). Ordem: Dia, Metas, Ideias; Estratégia, Timeline e Sonhos pra depois. */
const cartoesHiperfoco = (): ConfigCartoes => ({
  moduleId: "hiperfoco",
  classe: "ct-hiperfoco",
  nome: "Mente",
  agora: {
    texto: "Anota 1 pensamento que está rodando na cabeça.",
    botao: "Fazer agora",
    seletor: 'textarea[placeholder="O que está pensando?"], input[placeholder="O que está pensando?"]',
    apoio: "Tira da cabeça, põe aqui. Depois você acha pela busca.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={200} intervalo={1400}
        quadros={quadrosDigitar(["Ligar pro dentista", "Ideia: app de receitas"], "Comprar o presente da Lu", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="DIA" emoji="💭" cor={COR} corBotao={BOTAO} placeholder="O que está pensando?" botao="Salvar" itens={["Ligar pro dentista", "Ideia: app de receitas"]} subtitulos={{ "Ligar pro dentista": "09:12", "Ideia: app de receitas": "11:40", "Comprar o presente da Lu": "agora" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "O captador de verdade",
      texto: "Escreve e salva — a lista do dia cresce embaixo, com a hora.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("hiperfoco")} largura={470} altura={210} dedinho={{ x: "40%", y: "30%" }}>
          <div className="p-3"><ThoughtCapture /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Metas da mente",
      texto: "Pequenas e concretas — marca quando cumprir.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150} intervalo={1300} quadros={quadrosMarcar([[], [0], [0]], [{ x: "8%", y: "32%" }, { x: "8%", y: "32%" }, { x: "8%", y: "32%" }])}>
          <MiniLinhas titulo="METAS" emoji="🎯" cor={COR} corBotao={BOTAO} itens={["Dormir até 23h", "Zerar a caixa de e-mail"]} subtitulos={{ "Dormir até 23h": "5 dias seguidos", "Zerar a caixa de e-mail": "toda sexta" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Ideias guardadas",
      texto: "O que não é pra hoje fica guardado — e volta pela busca.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170}>
          <MiniLinhas titulo="IDEIAS" emoji="💡" cor={COR} corBotao={BOTAO} caixa={false} itens={["App de receitas", "Viagem de bike no litoral", "Curso de fotografia"]} subtitulos={{ "App de receitas": "guardada em 02/10", "Viagem de bike no litoral": "guardada em 28/09", "Curso de fotografia": "guardada em 15/09" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Estratégia", "Timeline", "Sonhos"] },
});
export default cartoesHiperfoco;
