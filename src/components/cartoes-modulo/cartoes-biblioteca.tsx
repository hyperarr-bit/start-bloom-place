import { Miniatura } from "./Miniatura";
import { MiniAcao, MiniLinhas, MiniMeta, quadrosDigitar, quadrosValor } from "./blocos";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-orange-100 text-orange-900";
const BOTAO = "bg-orange-600";

/** Os 5 cartões da BIBLIOTECA (laranja). Ordem: Lendo agora (N), Estante, Desafio; Insights e Emprestados pra depois. */
const cartoesBiblioteca = (): ConfigCartoes => ({
  moduleId: "biblioteca",
  classe: "ct-biblioteca",
  nome: "Biblioteca",
  agora: {
    texto: "Cola o link do livro que você está lendo.",
    botao: "Fazer agora",
    seletor: 'input[placeholder="Cole o link do livro aqui..."], input[placeholder="Título"]',
    apoio: "Amazon ou Goodreads: a capa e os dados vêm sozinhos.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={200} intervalo={1400}
        quadros={quadrosDigitar(["O Poder do Hábito"], "Essencialismo", { x: "24%", y: "24%" }, { x: "10%", y: "62%" }, { x: "84%", y: "24%" })}>
        <MiniAcao titulo="LENDO AGORA" emoji="📖" cor={COR} corBotao={BOTAO} placeholder="Cole o link do livro aqui…" botao="Importar" itens={["O Poder do Hábito"]} subtitulos={{ "O Poder do Hábito": "Charles Duhigg · página 168 de 400 · 42%", Essencialismo: "Greg McKeown · página 0 de 272" }} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "A página em que você está",
      texto: "Anota a página e a barra anda — a leitura do dia conta no score.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150} intervalo={1200} quadros={quadrosValor([150, 168, 190])}>
          <MiniMeta titulo="O PODER DO HÁBITO" emoji="🔖" cor={COR} corBarra={BOTAO} valor={168} alvo={400} unidade="páginas" legenda="Leitura de hoje feita ✓ · faltam 232 páginas" />
        </Miniatura>
      ),
    },
    {
      titulo: "Estante",
      texto: "Lidos, lendo e quero ler — tudo no lugar.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170}>
          <MiniLinhas titulo="ESTANTE" emoji="📚" cor={COR} corBotao={BOTAO} caixa={false} itens={["Lidos · 7", "Lendo · 2", "Quero ler · 5"]} subtitulos={{ "Lidos · 7": "Sapiens, Atomic Habits, Mindset…", "Lendo · 2": "O Poder do Hábito, Essencialismo", "Quero ler · 5": "Deep Work, Flow…" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Desafio do ano",
      texto: "Uma meta de livros no ano — e o app diz se você está no ritmo.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={150}>
          <MiniMeta titulo="DESAFIO 2026" emoji="🏆" cor={COR} corBarra={BOTAO} valor={7} alvo={12} unidade="livros" legenda="No ritmo: 1 livro por mês" />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Insights", "Emprestados"] },
});
export default cartoesBiblioteca;
