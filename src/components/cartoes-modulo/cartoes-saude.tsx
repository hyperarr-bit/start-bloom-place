import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniBarras, MiniLinhas, MiniMeta, quadrosMarcar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-red-100 text-red-900";
const BOTAO = "bg-red-600";

/** Os 6 cartões da SAÚDE (vermelho). Ordem: Hoje (N), Evolução, Log médico; Medidas e Documentos pra depois. */
const cartoesSaude = (): ConfigCartoes => ({
  moduleId: "saude",
  classe: "ct-saude",
  nome: "Saúde",
  agora: {
    texto: "Registra 1 copo d'água.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="add-water"]',
    apoio: "O caminho mais curto do app: um toque e o dia já começou.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1200} quadros={quadrosValor([3, 4, 5], { x: "84%", y: "30%" })}>
        <MiniMeta titulo="ÁGUA DE HOJE" emoji="💧" cor={COR} corBarra={BOTAO} valor={3} alvo={8} unidade="copos" legenda="+ 1 copo por toque · meta de 8 (2 litros)" />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Hoje, de verdade",
      texto: "Água, sono e suplementos do dia — tudo num card só.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("saude")} largura={470} altura={200} dedinho={{ x: "80%", y: "70%" }}>
          <div className="p-3"><HydrationTracker /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Sono e suplementos",
      texto: "Horas dormidas e cada suplemento marcado — o score cobra os dois.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260} intervalo={1200} quadros={quadrosMarcar([[0], [0, 1], [0, 1, 2]], [{ x: "8%", y: "32%" }, { x: "8%", y: "52%" }, { x: "8%", y: "72%" }])}>
          <MiniLinhas titulo="HOJE" emoji="🌙" cor={COR} corBotao={BOTAO} itens={["Dormi 7h30", "Vitamina D", "Ômega 3"]} subtitulos={{ "Dormi 7h30": "meta: 8h", "Vitamina D": "manhã", "Ômega 3": "almoço" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Evolução do peso",
      texto: "Pesa quando quiser (todo dia ou 1x por semana) e vê a linha descer.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniBarras titulo="EVOLUÇÃO" emoji="⚖️" cor={COR} corBarra={BOTAO} barras={[{ rotulo: "Agosto", valor: 74.2 }, { rotulo: "Setembro", valor: 73.1 }, { rotulo: "Outubro", valor: 72.4 }]} rodape="em kg · −1,8 kg em 2 meses" />
        </Miniatura>
      ),
    },
    {
      titulo: "Log médico",
      texto: "Consultas, exames e remédios com data — pra não esquecer o retorno.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniLinhas titulo="LOG MÉDICO" emoji="🏥" cor={COR} corBotao={BOTAO} caixa={false} itens={["Clínico geral · 12/09", "Exame de sangue · 20/09", "Retorno · 15/11"]} subtitulos={{ "Clínico geral · 12/09": "pressão 12/8 · tudo ok", "Exame de sangue · 20/09": "resultado guardado", "Retorno · 15/11": "aviso 1 dia antes" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Medidas", "Documentos"] },
});
export default cartoesSaude;
