/**
 * Biblioteca — limpeza do dado sujo (pedido de cliente pagante, 10/09).
 *
 * Os quatro casos são REAIS, tirados do print da estante dele: importou
 * por link antes da correção de 09/09 e ficou com lixo da Amazon gravado
 * em lib-books. As funções são puras e idempotentes — a mesma tabela vive
 * copiada dentro da function fetch-book-metadata.
 */
import { describe, it, expect } from "vitest";
import { decodificarEntidades, limparTituloLoja, limparAutor, autorEhLixo, limparLivro, limparLivros } from "@/lib/biblioteca-limpeza";

describe("Casos reais do print (10/09)", () => {
  it("autor 'Seguir' (botão da Amazon) vira campo vazio, nunca o lixo", () => {
    expect(limparAutor("Seguir")).toBe("");
    expect(autorEhLixo("Seguir")).toBe(true);
    expect(autorEhLixo("  ")).toBe(true);
  });

  it("autor 'Carlos Jo&atilde;o Santos Pereira' decodifica a entidade nomeada", () => {
    expect(limparAutor("Carlos Jo&atilde;o Santos Pereira")).toBe("Carlos João Santos Pereira");
  });

  it("título 'Marley &amp; Eu - …' decodifica e NÃO corta o hífen do subtítulo", () => {
    expect(limparTituloLoja("Marley &amp; Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo"))
      .toBe("Marley & Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo");
  });

  it("'… para a sua vida eBook : Prado, Rafa' — o eBook vem ANTES dos dois pontos e sai junto com o autor", () => {
    expect(limparTituloLoja("100 graus - o ponto de ebulição do sucesso: Tudo o que você precisa aprender sobre criar dinheiro e liberdade para a sua vida eBook : Prado, Rafa"))
      .toBe("100 graus - o ponto de ebulição do sucesso: Tudo o que você precisa aprender sobre criar dinheiro e liberdade para a sua vida");
    // o título completo da página da Amazon, como a function recebe
    expect(limparTituloLoja("100 graus - o ponto de ebulição do sucesso: Tudo o que você precisa aprender sobre criar dinheiro e liberdade para a sua vida eBook : Prado, Rafa: Amazon.com.br: Livros"))
      .toBe("100 graus - o ponto de ebulição do sucesso: Tudo o que você precisa aprender sobre criar dinheiro e liberdade para a sua vida");
  });
});

describe("Entidades HTML", () => {
  it("numéricas decimais e hex, nomeadas Latin-1 completas e tipográficas", () => {
    expect(decodificarEntidades("caf&#233; &#xE9; &#XE9;")).toBe("café é é");
    expect(decodificarEntidades("&ccedil;&atilde;&otilde;&eacute;&Ccedil;&uuml;&ntilde;&nbsp;x")).toBe("çãõéÇüñ x");
    expect(decodificarEntidades("A &amp; B &quot;C&quot; &#39;D&#039; &lt;e&gt; &apos;f&apos;")).toBe(`A & B "C" 'D' <e> 'f'`);
    expect(decodificarEntidades("fim&hellip; &ldquo;x&rdquo; &rsquo; &ndash; &mdash; &bull;")).toBe("fim… “x” ’ – — •");
    expect(decodificarEntidades("&#8217;&#8220;&#8221;")).toBe("’“”");
  });

  it("entidade desconhecida ou texto sem & passa intacto; página dupla-codificada resolve", () => {
    expect(decodificarEntidades("&naoexiste; Tom & Jerry")).toBe("&naoexiste; Tom & Jerry");
    expect(decodificarEntidades("sem nada")).toBe("sem nada");
    expect(decodificarEntidades("Jo&amp;atilde;o")).toBe("João");
    expect(decodificarEntidades(undefined as unknown as string)).toBe("");
  });
});

describe("Corte de título da loja", () => {
  it("variações da Amazon: ': eBook', '(Português) Capa comum', '| Amazon.com.br', 'Kindle Edition by', 'Capa comum – data'", () => {
    expect(limparTituloLoja("Hábitos Atômicos: eBook")).toBe("Hábitos Atômicos");
    expect(limparTituloLoja("Hábitos Atômicos: Um Método Fácil (Português) Capa comum – 1 janeiro 2019")).toBe("Hábitos Atômicos: Um Método Fácil");
    expect(limparTituloLoja("Essencialismo | Amazon.com.br")).toBe("Essencialismo");
    expect(limparTituloLoja("Deep Work: Rules for Focused Success Kindle Edition by Cal Newport")).toBe("Deep Work: Rules for Focused Success");
    expect(limparTituloLoja("Sapiens - Capa comum – 5 setembro 2015")).toBe("Sapiens");
    expect(limparTituloLoja("O corpo fala: A linguagem silenciosa da comunicação não verbal | Amazon.com.br")).toBe("O corpo fala: A linguagem silenciosa da comunicação não verbal");
    expect(limparTituloLoja("O Corpo Fala (resumo) eBook : Weil, Pierre, Tompakow, Roland: Amazon.com.br: Livros")).toBe("O Corpo Fala (resumo)");
    expect(limparTituloLoja("O Corpo Fala (Edição em áudio): Pierre Weil, Roland Tompakow: Amazon.com.br: Livros")).toBe("O Corpo Fala");
    expect(limparTituloLoja("Mindset (Portuguese Edition)")).toBe("Mindset");
    expect(limparTituloLoja("Duna by Frank Herbert | Goodreads")).toBe("Duna by Frank Herbert");
    expect(limparTituloLoja("O Hobbit…")).toBe("O Hobbit");
  });

  it("título limpo passa intacto (idempotente)", () => {
    const t = "Marley & Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo";
    expect(limparTituloLoja(t)).toBe(t);
    expect(limparTituloLoja(limparTituloLoja("Sapiens - Capa comum – 5 setembro 2015"))).toBe("Sapiens");
  });
});

describe("Autor", () => {
  it("texto de interface em qualquer língua vira vazio; gente passa", () => {
    for (const lixo of ["Seguir", "Follow", "Create a free account", "Sign in", "Entrar", "Visite a página de James Clear", "Visit Amazon's James Clear Page", "Amazon", "Amazon.com.br", "Goodreads", "Ver mais", ""]) {
      expect(limparAutor(lixo)).toBe("");
    }
    expect(limparAutor("James Clear (Autor)")).toBe("James Clear");
    expect(limparAutor("Amazonas Silva")).toBe("Amazonas Silva");
    expect(limparAutor("Prado, Rafa")).toBe("Prado, Rafa");
  });
});

describe("Livro inteiro", () => {
  const sujo = { id: "1", title: "Marley &amp; Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo", author: "Seguir", synopsis: "Um c&atilde;o &amp; sua fam&iacute;lia", notes: "minha nota", status: "lido" };

  it("limpa título/autor/sinopse e preserva o resto; livro limpo devolve o MESMO objeto", () => {
    const limpo = limparLivro(sujo);
    expect(limpo).toEqual({ ...sujo, title: "Marley & Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo", author: "", synopsis: "Um cão & sua família" });
    expect(limparLivro(limpo)).toBe(limpo);
    expect(sujo.author).toBe("Seguir"); // não muta a entrada
  });

  it("lista: mesmo array se nada mudou; título que o corte esvaziaria fica como estava", () => {
    const limpos = [{ id: "a", title: "Duna", author: "Frank Herbert" }];
    expect(limparLivros(limpos)).toBe(limpos);
    expect(limparLivros([sujo])[0].author).toBe("");
    expect(limparLivro({ title: "eBook: x", author: "" }).title).toBe("eBook: x");
    // livro antigo das seeds (sem synopsis/notes) não ganha campo undefined trocado
    expect(limparLivro({ title: "Mindset", author: "Carol Dweck" })).toEqual({ title: "Mindset", author: "Carol Dweck" });
  });
});
