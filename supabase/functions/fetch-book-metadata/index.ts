import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_DOMAINS = [
  'amazon.com', 'amazon.com.br', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp',
  'goodreads.com',
  'books.google.com',
  'saraiva.com.br',
  'magazineluiza.com.br',
  'submarino.com.br',
  'americanas.com.br',
  'estantevirtual.com.br',
  'livrariacultura.com.br',
  'travessa.com.br',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * SINOPSE + AUTOR (pedido de cliente pagante, 09/09: "abre um campo abaixo
 * das anotações para a SINOPSE"). A function sempre devolveu `description`
 * (a meta description da página) e o app descartava. Quando o app passou a
 * usar, a sessão de 09/09 mediu o que chegava de verdade:
 *
 *  - Amazon.com.br: meta description = título + "Idioma: Português : Clear,
 *    James: Amazon.com.br: Livros" (descreve a PÁGINA, não o livro) e autor
 *    = "Seguir" (o botão de seguir o autor, primeiro <a> do byline).
 *  - Goodreads: og:description cortada em ~55 caracteres com "…" e autor =
 *    "Create a free account". A sinopse INTEIRA está no JSON da página.
 *  - Google Books sem chave: HTTP 429 "Queries per day" no consumidor
 *    anônimo compartilhado — o fallback de capa também morria em silêncio.
 *
 * Ordem daqui pra frente: (1) o que a própria página embute (bloco da
 * descrição da Amazon, JSON do Goodreads), (2) meta tags quando não são
 * propaganda, (3) Google Books (com GOOGLE_BOOKS_API_KEY se o dono cadastrar;
 * sem chave tolera o 429), (4) Open Library por ISBN, sem chave. E lixo de
 * interface NUNCA vai pro formulário: melhor campo vazio que "Seguir".
 * ══════════════════════════════════════════════════════════════════════ */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Tira tag e entidade HTML (Goodreads manda "&amp;" no título e <i>/<br> na
 *  descrição; Amazon manda <p>/<span> no bloco da descrição). */
const limparTexto = (s: string) => s
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#8217;/g, '’').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

/** Texto de botão/menu que as páginas devolvem no lugar do autor. */
const autorLixo = (s: string) =>
  !s.trim() || /^(seguir|follow|create a free account|entrar|sign in|visite|visit|ver mais|see more|amazon|goodreads)/i.test(s.trim());

/** Descrição que fala da LOJA/página, não do livro. */
const pareceProp = (s: string, tituloLimpo: string) =>
  /compre online|frete gr[áa]tis|\*free\*|on amazon|amazon\.com|melhores ofertas|em at[ée] \d+x|shipping on qualifying|: livros$|idioma\s*[‏:]|goodreads|reviews from the world/i.test(s)
  || (tituloLimpo.length >= 12 && s.toLowerCase().startsWith(tituloLimpo.slice(0, 30).toLowerCase()));

const fetchJson = async (url: string, headers: Record<string, string> = {}, ms = 5000): Promise<any | null> => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'CORE-app-biblioteca/1.0 (https://www.coreaplicativo.com.br)', ...headers }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) { console.log('lookup falhou:', url.slice(0, 80), r.status); return null; }
    return await r.json();
  } catch (e) {
    console.log('lookup erro:', url.slice(0, 80), String(e).slice(0, 120));
    return null;
  }
};

/** Sinopse embutida na própria página — a fonte mais fiel (e em português
 *  na Amazon.com.br, que é onde a cliente compra). */
function sinopseDaPagina(html: string, hostname: string): string {
  const candidatas: string[] = [];
  if (/amazon\./.test(hostname)) {
    const i = html.indexOf('bookDescription_feature_div');
    if (i >= 0) {
      const bloco = html.slice(i, i + 40000);
      // <noscript> traz a descrição completa pra quem não roda JS; o
      // a-expander-content é a versão visível (pode parar no 1º </div>).
      const ns = bloco.match(/<noscript>([\s\S]*?)<\/noscript>/i);
      if (ns) candidatas.push(limparTexto(ns[1]));
      const ex = bloco.match(/class=["'][^"']*a-expander-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (ex) candidatas.push(limparTexto(ex[1]));
    }
  }
  if (/goodreads\./.test(hostname)) {
    // __NEXT_DATA__ → "description":"…" (a do livro é a mais longa; as
    // outras são de séries/autor). JSON.parse desfaz \" e \n.
    for (const m of html.matchAll(/"description":"((?:[^"\\]|\\.){80,})"/g)) {
      try { candidatas.push(limparTexto(JSON.parse('"' + m[1] + '"'))); } catch { /* segue */ }
    }
  }
  return candidatas.filter(s => s.length >= 80).sort((a, b) => b.length - a.length)[0] || '';
}

/** Autor embutido na página, ignorando botão/menu. */
function autorDaPagina(html: string, hostname: string, meta: (p: string) => string): string {
  const candidatos: string[] = [meta('author'), meta('book:author')];
  if (/goodreads\./.test(hostname)) {
    candidatos.push(html.match(/"author":\s*\[?\s*\{[^}]*?"name":"([^"]+)"/)?.[1] || '');
    candidatos.push(html.match(/"__typename":"Contributor"[^}]*?"name":"([^"]+)"/)?.[1] || '');
  }
  if (/amazon\./.test(hostname)) {
    candidatos.push(html.match(/class=["'][^"']*contributorNameID[^"']*["'][^>]*>([^<]+)</i)?.[1] || '');
    // <a>James Clear</a> <span class="contribution">(Autor)</span>
    candidatos.push(html.match(/<a[^>]*>([^<]{2,80})<\/a>\s*(?:<\/span>\s*)?<span[^>]*class=["'][^"']*contribution[^"']*["'][\s\S]{0,200}?\((?:Autor|Author|Escritor)/i)?.[1] || '');
    // todos os <a> dentro de elementos "author" — o 1º costuma ser "Seguir"
    for (const m of html.matchAll(/class=["'][^"']*\bauthor\b[^"']*["'][^>]*>[\s\S]{0,600}?<a[^>]*>([^<]{2,80})</gi)) candidatos.push(m[1]);
  }
  candidatos.push(html.match(/id=["']bylineInfo["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)</i)?.[1] || '');
  candidatos.push(html.match(/by\s+<[^>]*>([^<]+)</i)?.[1] || '');
  const achado = candidatos.map(s => limparTexto(s || '')).find(s => s && !autorLixo(s));
  return achado || '';
}

async function googleBooks(isbn: string, tituloPrincipal: string, autor: string) {
  const q = isbn
    ? `isbn:${isbn}`
    : `intitle:"${tituloPrincipal.slice(0, 80)}"${autor ? ` inauthor:"${autor.slice(0, 60)}"` : ''}`;
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  const j = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1${key ? `&key=${key}` : ''}`);
  const v = j?.items?.[0]?.volumeInfo;
  if (!v) return null;
  return {
    description: typeof v.description === 'string' ? limparTexto(v.description) : '',
    author: Array.isArray(v.authors) ? v.authors.join(', ') : '',
    image: v.imageLinks ? String(v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || '').replace('http://', 'https://').replace('&edge=curl', '') : '',
  };
}

/** Open Library: sem chave, ISBN → obra → descrição. Busca por título só
 *  com autor confirmado — "Hábitos Atômicos" solto devolvia outro livro. */
async function openLibrary(isbn: string, tituloPrincipal: string, autor: string) {
  const fields = 'fields=key,title,author_name,cover_i&limit=1';
  const busca = isbn
    ? await fetchJson(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&${fields}`)
    : autor && tituloPrincipal
      ? await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(tituloPrincipal)}&author=${encodeURIComponent(autor)}&${fields}`)
      : null;
  const doc = busca?.docs?.[0];
  if (!doc?.key) return null;
  const obra = await fetchJson(`https://openlibrary.org${doc.key}.json`);
  const d = obra?.description;
  return {
    description: limparTexto(typeof d === 'string' ? d : (d?.value || '')),
    author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '',
    image: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAllowedUrl(url)) {
      return new Response(JSON.stringify({ success: false, error: 'URL domain not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching metadata from:', url);
    const hostname = new URL(url).hostname.toLowerCase();

    // Try to extract ASIN from Amazon URLs for direct API approach
    const asinMatch = url.match(/\/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i)
      || url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);

    // Try to extract ISBN
    const isbnMatch = url.match(/(?:isbn[=\/:]?\s*)(\d{10,13})/i)
      || url.match(/\/(\d{13})(?:[/?]|$)/);

    // SECURITY: redirect manual + timeout para mitigar SSRF
    const fetchWithGuard = async (target: string, depth = 0): Promise<Response> => {
      if (depth > 3) throw new Error('Too many redirects');
      if (!isAllowedUrl(target)) throw new Error('Redirect target not allowed');
      const r = await fetch(target, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (!loc) return r;
        const next = new URL(loc, target).toString();
        return fetchWithGuard(next, depth + 1);
      }
      return r;
    };
    const response = await fetchWithGuard(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract Open Graph and meta tags
    const getMetaContent = (html: string, property: string): string => {
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'));
      if (metaMatch) return metaMatch[1];

      return '';
    };
    const pegarMeta = (attr: 'property' | 'name', nome: string): string => {
      const m = html.match(new RegExp(`<meta[^>]*${attr}=["']${nome}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${nome}["']`, 'i'));
      return m?.[1] || '';
    };

    const title = getMetaContent(html, 'title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

    // Clean up title (antes das buscas: a query externa usa o título LIMPO —
    // "| Amazon.com.br" trazia livro errado; o Goodreads corta com "…")
    const cleanTitle = limparTexto(title)
      .replace(/\s*[-–|:]\s*(Amazon|Amazon\.com\.br|Goodreads|Google Books|Saraiva|Magazine Luiza|Submarino).*$/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s*[-–|]\s*Idioma\s.*$/i, '')
      .replace(/:\s*(eBook|Kindle|Paperback|Hardcover|Capa\s+(Comum|Dura)).*$/i, '')
      .replace(/…$/, '')
      .trim();
    const tituloPrincipal = (cleanTitle.split(/[:|–]/)[0] || cleanTitle).trim() || cleanTitle;

    // ISBN: da URL, do JSON da página (Goodreads "isbn13") ou o ASIN da
    // Amazon quando é numérico — pra livro, ASIN = ISBN-10.
    const asin = asinMatch?.[1] || '';
    const isbn = isbnMatch?.[1]
      || html.match(/"isbn13"\s*:\s*"(\d{13})"/)?.[1]
      || html.match(/"isbn"\s*:\s*"(\d{9}[\dX])"/i)?.[1]
      || (/^\d{9}[\dX]$/i.test(asin) ? asin : '');

    // ── AUTOR ──
    let author = autorDaPagina(html, hostname, (p) => getMetaContent(html, p));

    // ── SINOPSE ──
    let description = sinopseDaPagina(html, hostname);
    let fonteSinopse = description ? 'pagina' : '';
    // og:description, <meta name="description"> e twitter:description podem
    // diferir (Goodreads corta a og: em ~55 caracteres): fica com a mais longa.
    const metaDescricao = [pegarMeta('property', 'og:description'), pegarMeta('name', 'description'), pegarMeta('name', 'twitter:description')]
      .map(limparTexto).filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
    const metaFraca = !metaDescricao || metaDescricao.length < 120 || /…$/.test(metaDescricao) || pareceProp(metaDescricao, cleanTitle);
    if (!description && metaDescricao && !metaFraca) { description = metaDescricao; fonteSinopse = 'meta'; }

    // ── IMAGE EXTRACTION (multi-strategy) ──
    let image = getMetaContent(html, 'image')
      || getMetaContent(html, 'image:src');

    // Strategy 1: Amazon-specific image patterns
    if (!image) {
      const amazonImgPatterns = [
        /id=["'](?:landingImage|imgBlkFront|ebooksImgBlkFront|main-image)["'][^>]*src=["']([^"']+)["']/i,
        /data-old-hires=["']([^"']+)["']/i,
        /data-a-dynamic-image=["']\{["']([^"']+)["']/i,
        /"hiRes"\s*:\s*"([^"]+)"/i,
        /"mainUrl"\s*:\s*"([^"]+)"/i,
        /"large"\s*:\s*"([^"]+)"/i,
        /class=["'][^"']*a-dynamic-image[^"']*["'][^>]*src=["']([^"']+)["']/i,
      ];
      for (const pattern of amazonImgPatterns) {
        const match = html.match(pattern);
        if (match?.[1] && match[1].startsWith('http')) {
          image = match[1];
          break;
        }
      }
    }

    // Strategy 2: Amazon image from ASIN (construct URL directly)
    if (!image && asin) {
      image = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
    }

    // Strategy 3: Look for any large book-like image in the page
    if (!image) {
      const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*/gi);
      for (const m of imgMatches) {
        const src = m[1];
        if (src && src.startsWith('http') &&
          (src.includes('images-amazon') || src.includes('m.media-amazon') ||
           src.includes('books.google') || src.includes('goodreads') ||
           src.includes('bookcover') || src.includes('cover'))) {
          if (!src.includes('sprite') && !src.includes('icon') && !src.includes('pixel') && !src.includes('1x1')) {
            image = src;
            break;
          }
        }
      }
    }

    // Strategy 4: bases externas, só pro que ainda falta (capa, sinopse ou
    // autor). Google Books primeiro (melhor sinopse quando responde), Open
    // Library depois (sem chave, sempre responde; por ISBN acerta a obra).
    if ((!image || !description || !author) && (isbn || cleanTitle)) {
      const gb = await googleBooks(isbn, tituloPrincipal, author);
      if (gb) {
        if (!image && gb.image) image = gb.image;
        if (!description && gb.description.length >= 80) { description = gb.description; fonteSinopse = 'google-books'; }
        if (!author && gb.author) author = gb.author;
      }
      if (!image || !description || !author) {
        const ol = await openLibrary(isbn, tituloPrincipal, author);
        if (ol) {
          if (!image && ol.image) image = ol.image;
          if (!description && ol.description.length >= 80) { description = ol.description; fonteSinopse = 'open-library'; }
          if (!author && ol.author) author = ol.author;
        }
      }
    }
    // Sobrou só a meta description fraca: vale se não for propaganda de loja.
    if (!description && metaDescricao && !pareceProp(metaDescricao, cleanTitle)) { description = metaDescricao; fonteSinopse = 'meta-fraca'; }

    // Clean up Amazon image URL - get highest resolution
    if (image && (image.includes('images-amazon') || image.includes('m.media-amazon'))) {
      image = image.replace(/\._[^.]+_\./, '.');
    }

    // Clean up author (e lixo de interface que ninguém corrigiu NÃO vai pro
    // formulário como autor)
    const cleanAuthor = autorLixo(author || '') ? '' : (author || '')
      .replace(/\s*\(.*\)$/, '')
      .trim();

    // Sinopse vai gravada dentro de lib-books (chave única do módulo, que a
    // carga inicial pula se passar de 50KB): corta em ~600 caracteres, no fim
    // de uma palavra — a pessoa edita no formulário se quiser mais.
    const cortarSinopse = (s: string, max = 600) => {
      if (s.length <= max) return s;
      const corte = s.slice(0, max);
      const espaco = corte.lastIndexOf(' ');
      return (espaco > max * 0.6 ? corte.slice(0, espaco) : corte).trim() + '…';
    };

    const result = {
      success: true,
      data: {
        title: cleanTitle,
        author: cleanAuthor,
        cover: image || '',
        description: cortarSinopse(description),
      },
    };

    console.log('Metadata extracted:', { title: cleanTitle, author: cleanAuthor, hasImage: !!image, descLen: description.length, fonteSinopse, isbn });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch metadata'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
