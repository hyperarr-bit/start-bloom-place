import { ComecoPronto } from "@/components/pet/comeco-pronto";
import { PetDeHoje } from "@/components/pet/pet-de-hoje";
import { usePet } from "@/components/pet/use-pet";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniBarras, MiniChips, MiniLinhas, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-amber-100 text-amber-900";
const BOTAO = "bg-amber-500";

/** A aba HOJE do Pet de verdade, por cima do store de exemplo (o Mel e o Tom da demo). */
const MiniPet = () => {
  const dados = usePet();
  const pet = dados.pets[0];
  return (
    <div className="tema-pet p-3 text-foreground">
      {pet ? <PetDeHoje pet={pet} dados={dados} onRemedio={() => {}} /> : <ComecoPronto dados={dados} onCriado={() => {}} primeiro />}
    </div>
  );
};

/** Os 5 cartões do PET (caramelo). Ordem: Hoje, Saúde, Gastos; Diário e Carteirinha completa pra depois. */
const cartoesPet = (): ConfigCartoes => ({
  moduleId: "pet",
  classe: "ct-pet",
  nome: "Pet",
  agora: {
    texto: "Diz quem é o seu pet: cachorro, gato ou outro.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="pet-especie"], [data-testid="selos"]',
    apoio: "Em 3 toques ele ganha RG, a rotina do dia e a carteirinha de vacinas.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={260} intervalo={1300} quadros={quadrosValor([0, 1, 0], { x: "12%", y: "48%" })}>
        <MiniChips titulo="QUEM É O SEU PET?" emoji="🐾" cor={COR} corAcesa={BOTAO} chips={["🐶 Cachorro", "🐱 Gato", "🐾 Outro"]} abaixo={<p className="text-[11px] text-muted-foreground">Depois: o nome e o aniversário. Pronto.</p>} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "A rotina do dia",
      texto: "Ração, passeio, remédio — pra marcar com um toque.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("pet")} largura={470} altura={210} dedinho={{ x: "30%", y: "60%" }}>
          <MiniPet />
        </Miniatura>
      ),
    },
    {
      titulo: "Saúde: vacinas e remédios",
      texto: "A carteirinha com as datas — o app avisa quando vence.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniLinhas titulo="CARTEIRINHA" emoji="💉" cor={COR} corBotao={BOTAO} caixa={false} itens={["V10 · 12/03", "Antirrábica · vence 20/11", "Vermífugo · a cada 3 meses"]} subtitulos={{ "V10 · 12/03": "em dia ✓", "Antirrábica · vence 20/11": "aviso 7 dias antes", "Vermífugo · a cada 3 meses": "próximo: 02/12" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Gastos do pet",
      texto: "Ração, veterinário, banho — quanto ele custa por mês.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={260}>
          <MiniBarras titulo="GASTOS DO MÊS" emoji="💸" cor={COR} corBarra={BOTAO} unidade="R$ " barras={[{ rotulo: "Ração", valor: 180 }, { rotulo: "Veterinário", valor: 120 }, { rotulo: "Banho", valor: 60 }]} rodape="Total: R$ 360" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Diário com fotos", "Carteirinha completa"] },
});
export default cartoesPet;
