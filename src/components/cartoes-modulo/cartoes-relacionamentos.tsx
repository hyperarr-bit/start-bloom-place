import { TemaRelacoes } from "@/components/relacoes/kit";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniPessoas } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões de RELAÇÕES (rosa). Abas vivas: Pessoas, Datas, Momentos. */
const cartoesRelacionamentos = (): ConfigCartoes => ({
  moduleId: "relacionamentos",
  classe: "ct-relacionamentos",
  nome: "Relações",
  agora: {
    titulo: "Faz isso agora",
    texto: "Guarda 1 pessoa com o dia do aniversário.",
    botao: "Fazer agora",
    seletor: '[data-testid="comeco-pronto"], [data-testid="lista-pessoas"]',
    apoio: "O ano é opcional. O app lembra na véspera e no dia.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["💌 PESSOAS", "📅 DATAS", "✨ MOMENTOS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("relacionamentos")} largura={620} altura={210} dedinho={{ x: "40%", y: "86%" }} legenda="Em PESSOAS: a ficha de cada uma — o que lembrar, ideias de presente, e quando falou pela última vez.">
        <TemaRelacoes><MiniPessoas /></TemaRelacoes>
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Presentes", "Momentos", "Avisos"] },
});
export default cartoesRelacionamentos;
