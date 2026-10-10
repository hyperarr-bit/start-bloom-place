import RoomManager from "@/components/casa/RoomManager";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, quadrosDigitar, quadrosMarcar } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-cyan-100 text-cyan-900";
const BOTAO = "bg-cyan-600";

/** Os 5 cartões da CASA (ciano). Ordem: Cômodos, Despensa, Mercado; Manutenção, Co-op e Segurança pra depois. */
const cartoesCasa = (): ConfigCartoes => ({
  moduleId: "casa",
  classe: "ct-casa",
  nome: "Casa",
  agora: {
    texto: "Toca num cômodo e anota 1 tarefa dele.",
    botao: "Fazer agora",
    seletor: 'input[placeholder^="Adicionar item"], input[placeholder^="Nome do cômodo"], [data-spotlight="tab-mercado"]',
    apoio: "A cozinha, a sala e o quarto já estão aqui — é só dizer o que falta fazer.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Lavar a louça", "Limpar o fogão"], "Trocar o pano de prato", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="COZINHA" emoji="🍳" cor={COR} corBotao={BOTAO} placeholder="Adicionar item…" itens={["Lavar a louça", "Limpar o fogão"]} caixa />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Os cômodos de verdade",
      texto: "Cada cômodo com as tarefas dele — e o que já foi feito riscado.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("casa")} largura={470} altura={210} dedinho={{ x: "30%", y: "45%" }}>
          <div className="p-3"><RoomManager /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Despensa → mercado",
      texto: "Marca o que acabou e ele vai pra lista do mercado sozinho.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300} quadros={quadrosMarcar([[], [0], [0, 1]], [{ x: "8%", y: "32%" }, { x: "8%", y: "32%" }, { x: "8%", y: "52%" }])}>
          <MiniLinhas titulo="DESPENSA" emoji="🛒" cor={COR} corBotao={BOTAO} itens={["Arroz", "Café", "Azeite"]} subtitulos={{ Arroz: "acabou", Café: "pouco", Azeite: "ok" }} rodape="O que acabou vai pro MERCADO" />
        </Miniatura>
      ),
    },
    {
      titulo: "Lista do mercado",
      texto: "No mercado é só marcar — o que falta fica em cima.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300} quadros={quadrosMarcar([[], [0], [0, 1]], [{ x: "8%", y: "32%" }, { x: "8%", y: "32%" }, { x: "8%", y: "52%" }])}>
          <MiniLinhas titulo="MERCADO" emoji="🍎" cor={COR} corBotao={BOTAO} itens={["Arroz · 5 kg", "Café · 500 g", "Detergente", "Frutas da semana"]} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Manutenção", "Co-op", "Segurança"] },
});
export default cartoesCasa;
