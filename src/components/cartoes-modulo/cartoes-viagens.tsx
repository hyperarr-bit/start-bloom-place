import { BucketList } from "@/components/travel/BucketList";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, quadrosDigitar, quadrosMarcar } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-teal-100 text-teal-900";
const BOTAO = "bg-teal-600";

/** Os 5 cartões de VIAGENS (verde-água). Ordem: Destinos, Roteiro, Mala; Câmbio, Rachar e SOS pra depois. */
const cartoesViagens = (): ConfigCartoes => ({
  moduleId: "viagens",
  classe: "ct-viagens",
  nome: "Viagens",
  agora: {
    texto: "Anota 1 destino dos seus sonhos.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Destino..."], input[placeholder="Destino"]',
    apoio: "Só o lugar. Roteiro, mala e orçamento vêm quando a viagem ficar de pé.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={200} intervalo={1400}
        quadros={quadrosDigitar(["Lisboa", "Chapada dos Veadeiros"], "Japão", { x: "24%", y: "24%" }, { x: "10%", y: "76%" }, { x: "86%", y: "24%" })}>
        <MiniAcao titulo="DESTINOS" emoji="🧭" cor={COR} corBotao={BOTAO} placeholder="Destino…" itens={["Lisboa", "Chapada dos Veadeiros"]} subtitulos={{ Lisboa: "Portugal · abril", "Chapada dos Veadeiros": "Goiás · feriado", Japão: "sonho" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "A lista de verdade",
      texto: "Os lugares que você quer ver, com país e quando.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("viagens")} largura={470} altura={210} dedinho={{ x: "30%", y: "26%" }}>
          <div className="p-3"><BucketList /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Roteiro dia a dia",
      texto: "O que fazer em cada dia — e o app ordena pela hora.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170}>
          <MiniLinhas titulo="ROTEIRO · LISBOA" emoji="🗺️" cor={COR} corBotao={BOTAO} caixa={false} itens={["Dia 1 · Alfama e Castelo", "Dia 2 · Belém", "Dia 3 · Sintra"]} subtitulos={{ "Dia 1 · Alfama e Castelo": "elétrico 28 · pastel de nata", "Dia 2 · Belém": "Mosteiro · Torre", "Dia 3 · Sintra": "Pena · Quinta da Regaleira" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Mala",
      texto: "A lista do que levar — marca enquanto arruma.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={190} intervalo={1300} quadros={quadrosMarcar([[], [0], [0, 1]], [{ x: "8%", y: "32%" }, { x: "8%", y: "32%" }, { x: "8%", y: "52%" }])}>
          <MiniLinhas titulo="MALA" emoji="🎒" cor={COR} corBotao={BOTAO} itens={["Passaporte", "Carregador", "Tênis confortável", "Protetor solar"]} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Câmbio", "Rachar conta", "SOS"] },
});
export default cartoesViagens;
