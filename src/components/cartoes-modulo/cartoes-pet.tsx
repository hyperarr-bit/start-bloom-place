import { ComecoPronto } from "@/components/pet/comeco-pronto";
import { PetDeHoje } from "@/components/pet/pet-de-hoje";
import { usePet } from "@/components/pet/use-pet";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import type { ConfigCartoes } from "./CartoesDoModulo";

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

/** Os 3 cartões do PET (caramelo). Abas vivas: Hoje, Saúde, Gastos. */
const cartoesPet = (): ConfigCartoes => ({
  moduleId: "pet",
  classe: "ct-pet",
  nome: "Pet",
  agora: {
    titulo: "Faz isso agora",
    texto: "Diz quem é o seu pet: cachorro, gato ou outro.",
    botao: "Fazer agora",
    seletor: '[data-spotlight="pet-especie"], [data-testid="selos"]',
    apoio: "Em 3 toques ele ganha RG, a rotina do dia e a carteirinha de vacinas.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["☀️ HOJE", "💉 SAÚDE", "💸 GASTOS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("pet")} largura={470} altura={210} dedinho={{ x: "30%", y: "60%" }} legenda="Em HOJE: a rotina do dia do seu pet — ração, passeio, remédio — pra marcar com um toque.">
        <MiniPet />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Gastos", "Diário com fotos", "Carteirinha completa"] },
});
export default cartoesPet;
