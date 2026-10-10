import { TemaRelacoes } from "@/components/relacoes/kit";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniCalendario, MiniLinhas, quadrosDigitar } from "./blocos";
import { MiniPessoas } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-rose-100 text-rose-900";
const BOTAO = "bg-rose-600";

/** Os 5 cartões de RELAÇÕES (rosa). Ordem: Pessoas, Datas, Momentos; Presentes e Avisos pra depois. */
const cartoesRelacionamentos = (): ConfigCartoes => ({
  moduleId: "relacionamentos",
  classe: "ct-relacionamentos",
  nome: "Relações",
  agora: {
    texto: "Guarda 1 pessoa com o dia do aniversário.",
    botao: "Fazer agora",
    seletor: '[data-testid="comeco-pronto"], [data-testid="lista-pessoas"]',
    apoio: "O ano é opcional. O app lembra na véspera e no dia.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1400}
        quadros={quadrosDigitar(["Mãe", "Lu"], "Rafa", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "84%", y: "24%" })}>
        <MiniAcao titulo="MINHAS PESSOAS" emoji="💌" cor={COR} corBotao={BOTAO} placeholder="Nome da pessoa…" botao="Guardar" itens={["Mãe", "Lu"]} subtitulos={{ Mãe: "família · 🎂 12/03", Lu: "melhor amiga · 🎂 28/07", Rafa: "irmão · 🎂 05/11" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "A ficha de cada pessoa",
      texto: "O que lembrar, ideias de presente e quando falou pela última vez.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("relacionamentos")} largura={620} altura={210} dedinho={{ x: "40%", y: "86%" }}>
          <TemaRelacoes><MiniPessoas /></TemaRelacoes>
        </Miniatura>
      ),
    },
    {
      titulo: "Datas que importam",
      texto: "Aniversários e datas especiais no mês — com aviso antes.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniCalendario titulo="DATAS" emoji="📅" cor={COR} corMarca={BOTAO} marcados={[5, 12, 28]} legendas={{ 5: "🎂 Rafa", 12: "💍 Aniversário de casamento", 28: "🎂 Lu" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Momentos",
      texto: "O jantar, a ligação, o passeio — guardados com quem foi.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniLinhas titulo="MOMENTOS" emoji="✨" cor={COR} corBotao={BOTAO} caixa={false} itens={["Jantar com a Lu", "Ligação pra mãe"]} subtitulos={{ "Jantar com a Lu": "sábado · 📸 2 fotos", "Ligação pra mãe": "domingo · 40 min" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Presentes", "Avisos"] },
});
export default cartoesRelacionamentos;
