import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniLendoAgora } from "./replicas";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da BIBLIOTECA (laranja). Abas vivas: Lendo agora (N), Estante, Desafio. */
const cartoesBiblioteca = (): ConfigCartoes => ({
  moduleId: "biblioteca",
  classe: "ct-biblioteca",
  nome: "Biblioteca",
  agora: {
    titulo: "Faz isso agora",
    texto: "Cola o link do livro que você está lendo.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Cole o link do livro aqui..."], input[placeholder="Título"]',
    apoio: "Amazon ou Goodreads: a capa e os dados vêm sozinhos.",
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas bastam pra começar:",
    abas: ["📖 LENDO AGORA", "📚 ESTANTE", "🏆 DESAFIO"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("biblioteca")} largura={620} altura={210} dedinho={{ x: "30%", y: "22%" }} legenda="Em LENDO AGORA: cola o link, e cada livro mostra a página em que você está.">
        <MiniLendoAgora />
      </Miniatura>
    ),
  },
  depois: { titulo: "O que não precisa hoje", itens: ["Insights", "Emprestados", "Meta do ano"] },
});
export default cartoesBiblioteca;
