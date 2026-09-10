/**
 * Biblioteca — limpeza do que veio sujo da importação por link.
 *
 * PEDIDO DE CLIENTE PAGANTE (10/09, print da estante no computador): os
 * livros que ele importou ANTES da correção de 09/09 ficaram gravados com
 * lixo da Amazon dentro de `lib-books`, e o print mostra tudo isso na cara:
 *
 *   - autor "Seguir" (o botão de seguir o autor, não uma pessoa);
 *   - autor "Carlos Jo&atilde;o Santos Pereira" (entidade HTML crua);
 *   - título "Marley &amp; Eu - Vida E Amor Ao Lado Do Pior Cao Do Mundo";
 *   - título "100 graus - o ponto de ebulição do sucesso: Tudo o que você
 *     precisa aprender sobre criar dinheiro e liberdade para a sua vida
 *     eBook : Prado, Rafa" (o "eBook" vem ANTES dos dois pontos, e o corte
 *     antigo da function só pegava ": eBook").
 *
 * Tudo aqui é função PURA e idempotente: roda na LEITURA de `lib-books`
 * (Biblioteca.tsx) sem gravar de volta sozinha, e a mesma tabela/corte vive
 * copiada dentro da function `fetch-book-metadata` (Deno não importa de src)
 * pra importação nova já sair limpa. Sem migração de banco.
 */

/* ── Entidades HTML ────────────────────────────────────────────────────── */

/** Tabela COMPLETA de Latin-1 (ISO-8859-1, &nbsp; a &yuml;) + as básicas de
 *  XML/HTML + tipográficas que Amazon/Goodreads mandam (&hellip;, &rsquo;,
 *  &ldquo;…). Só quatro (&amp; &quot; &lt; &gt;) era o que a function tinha
 *  e por isso "Jo&atilde;o" passou. */
const ENTIDADES_NOMEADAS: Record<string, string> = {
  // básicas
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  // Latin-1: 160–255, na ordem da tabela ISO-8859-1
  nbsp: " ", iexcl: "¡", cent: "¢", pound: "£", curren: "¤", yen: "¥", brvbar: "¦", sect: "§",
  uml: "¨", copy: "©", ordf: "ª", laquo: "«", not: "¬", shy: "­", reg: "®", macr: "¯",
  deg: "°", plusmn: "±", sup2: "²", sup3: "³", acute: "´", micro: "µ", para: "¶", middot: "·",
  cedil: "¸", sup1: "¹", ordm: "º", raquo: "»", frac14: "¼", frac12: "½", frac34: "¾", iquest: "¿",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ", Ccedil: "Ç",
  Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  ETH: "Ð", Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", times: "×",
  Oslash: "Ø", Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý", THORN: "Þ", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  eth: "ð", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", divide: "÷",
  oslash: "ø", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", thorn: "þ", yuml: "ÿ",
  // tipográficas comuns em título/sinopse
  hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  bull: "•", trade: "™", euro: "€", ensp: " ", emsp: " ", thinsp: " ", zwnj: "‌", zwj: "‍",
  OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ", fnof: "ƒ", circ: "ˆ", tilde: "˜", dagger: "†", Dagger: "‡", permil: "‰", lsaquo: "‹", rsaquo: "›",
};

const RE_ENTIDADE = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;
// cópia SEM /g pro .test(): regex global guarda lastIndex entre chamadas
const RE_TEM_ENTIDADE = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/;

const decodificarUmaVez = (s: string): string =>
  s.replace(RE_ENTIDADE, (tudo, corpo: string) => {
    if (corpo[0] === "#") {
      const cp = corpo[1] === "x" || corpo[1] === "X" ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return tudo;
      // controles C1 (128–159) chegam de página Windows-1252 como &#150; = "–"
      try { return String.fromCodePoint(cp); } catch { return tudo; }
    }
    return corpo in ENTIDADES_NOMEADAS ? ENTIDADES_NOMEADAS[corpo] : tudo;
  });

/** Decodifica TODAS as entidades HTML: numéricas (&#233; / &#xE9;) e nomeadas
 *  (tabela acima). Passa no máximo DUAS vezes: página dupla-codificada manda
 *  "&amp;atilde;" (visto em og:title da Amazon), e uma vez só devolveria
 *  "&atilde;" na tela. Nunca lança; texto sem entidade volta igual. */
export const decodificarEntidades = (s: string): string => {
  if (typeof s !== "string" || !s.includes("&")) return typeof s === "string" ? s : "";
  const uma = decodificarUmaVez(s);
  return RE_TEM_ENTIDADE.test(uma) ? decodificarUmaVez(uma) : uma;
};

/* ── Título ────────────────────────────────────────────────────────────── */

/** Palavras de edição que a Amazon cola no título da página. */
const EDICAO = "eBook|Kindle(?:\\s+Edition)?|Edi[cç][aã]o\\s+Kindle|Paperback|Hardcover|Audiobook|Audible|Capa\\s+(?:comum|dura|mole|flex[ií]vel)|Espiral|Brochura";

/** Tira do título o lixo de loja, em qualquer ordem que a Amazon monte:
 *   - "… eBook : Prado, Rafa"           (edição ANTES dos dois pontos — caso
 *                                        real, o corte antigo não pegava)
 *   - "…: eBook", "…: Capa comum – 1 janeiro 2020"
 *   - "… (Português) Capa comum", "… (Portuguese Edition)"
 *   - "… | Amazon.com.br", "…: Amazon.com.br: Livros", " - Goodreads"
 *   - reticências que o Goodreads põe no og:title cortado. */
export const limparTituloLoja = (titulo: string): string => {
  let t = decodificarEntidades(titulo || "").replace(/\s+/g, " ").trim();
  // "eBook : Autor, Nome" / "Kindle Edition by …": edição seguida de ":" ou "by"
  t = t.replace(new RegExp(`\\s*[-–|:]?\\s*(?:${EDICAO})\\s*(?::|\\bby\\b|\\bpor\\b|$).*$`, "i"), "");
  // ": eBook", "- Capa comum – data", "| Kindle"
  t = t.replace(new RegExp(`\\s*[-–|:]\\s*(?:${EDICAO})\\b.*$`, "i"), "");
  // "(Português) Capa comum", "(Portuguese Edition)", "(Edição em Português)"
  t = t.replace(/\s*\((?:Portugu[eê]s|Portuguese|English|Ingl[eê]s|Espanhol|Spanish|Edi[cç][aã]o\s+em\s+[^)]+|[^()]+\s+Edition)\)\s*.*$/i, "");
  // nome da loja no fim, com qualquer separador
  t = t.replace(/\s*[-–|:]\s*(?:Amazon(?:\.com(?:\.br)?)?|Goodreads|Google Books|Saraiva|Magazine Luiza|Submarino|Americanas|Livraria Cultura|Travessa|Estante Virtual)\b.*$/i, "");
  t = t.replace(/\s*[-–|:]\s*Idioma\s.*$/i, "");
  t = t.replace(/\s*[-–|:]\s*(?:Livros|Books)\s*$/i, "");
  t = t.replace(/…\s*$/, "").replace(/\s*[-–|:]\s*$/, "");
  return t.trim();
};

/* ── Autor ─────────────────────────────────────────────────────────────── */

/** Texto de botão/menu que as páginas devolvem no lugar do autor (o "Seguir"
 *  da Amazon é o 1º <a> do byline; Goodreads manda "Create a free account").
 *  Prefixo pras frases ("Visite a página de…"), palavra inteira pra nomes
 *  curtos ("Amazon" sozinho é lixo; "Amazonas Silva" é gente). */
const RE_AUTOR_LIXO = /^(?:seguir|follow|create a free account|sign in|sign up|entrar|log ?in|cadastr|ver mais|see more|see all|visit(?:e|ar)?\b|amazon\b|goodreads\b|livros$|books$|kindle$|autor$|author$|desconhecido$|unknown$)/i;

/** Autor é lixo de interface (ou vazio depois da limpeza)? */
export const autorEhLixo = (autor: string): boolean => {
  const a = decodificarEntidades(autor || "").trim();
  return !a || RE_AUTOR_LIXO.test(a);
};

/** Autor limpo: entidades decodificadas, "(Autor)" no fim fora, e lixo de
 *  interface vira "" — campo vazio é melhor que "Seguir" na estante. */
export const limparAutor = (autor: string): string => {
  const a = decodificarEntidades(autor || "").replace(/\s+/g, " ").replace(/\s*\((?:Autor|Author|Escritor|Editor|Tradutor|Translator)\)\s*$/i, "").trim();
  return autorEhLixo(a) ? "" : a;
};

/* ── Livro inteiro ─────────────────────────────────────────────────────── */

/** O mínimo que a limpeza toca; o resto do livro passa intacto. */
export interface LivroLimpavel {
  title?: string;
  author?: string;
  synopsis?: string;
  notes?: string;
}

/** Livro com título/autor/sinopse limpos. Devolve o MESMO objeto quando nada
 *  muda (identidade preservada → memo barato e nenhuma escrita à toa).
 *  Anotações NÃO passam pelo corte de título — são texto da pessoa; só
 *  decodificam entidade, porque a cliente de 09/09 colava sinopse ali. */
export const limparLivro = <T extends LivroLimpavel>(livro: T): T => {
  if (!livro || typeof livro !== "object") return livro;
  const title = typeof livro.title === "string" ? limparTituloLoja(livro.title) || livro.title.trim() : livro.title;
  const author = typeof livro.author === "string" ? limparAutor(livro.author) : livro.author;
  const synopsis = typeof livro.synopsis === "string" ? decodificarEntidades(livro.synopsis) : livro.synopsis;
  const notes = typeof livro.notes === "string" ? decodificarEntidades(livro.notes) : livro.notes;
  if (title === livro.title && author === livro.author && synopsis === livro.synopsis && notes === livro.notes) return livro;
  return { ...livro, title, author, synopsis, notes };
};

/** Lista inteira; devolve o MESMO array se nenhum livro mudou. */
export const limparLivros = <T extends LivroLimpavel>(livros: T[]): T[] => {
  if (!Array.isArray(livros)) return livros;
  let mudou = false;
  const saida = livros.map(l => { const n = limparLivro(l); if (n !== l) mudou = true; return n; });
  return mudou ? saida : livros;
};
