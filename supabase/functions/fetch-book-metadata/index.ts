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

    // Try to extract ASIN from Amazon URLs for direct API approach
    const asinMatch = url.match(/\/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i)
      || url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);

    // Try to extract ISBN
    const isbnMatch = url.match(/(?:isbn[=\/:]?\s*)(\d{10,13})/i)
      || url.match(/\/(\d{13})(?:[/?]|$)/);

    // Fetch the page HTML with a realistic browser user agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

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

    const title = getMetaContent(html, 'title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

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
    if (!image && asinMatch?.[1]) {
      const asin = asinMatch[1];
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

    // Strategy 4: Google Books API fallback using ISBN or title
    if (!image && (isbnMatch?.[1] || title)) {
      try {
        const query = isbnMatch?.[1] ? `isbn:${isbnMatch[1]}` : encodeURIComponent(title.slice(0, 100));
        const gbResp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
        if (gbResp.ok) {
          const gbData = await gbResp.json();
          const volumeInfo = gbData.items?.[0]?.volumeInfo;
          if (volumeInfo?.imageLinks) {
            image = (volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || '')
              .replace('http://', 'https://').replace('&edge=curl', '');
          }
        }
      } catch (e) {
        console.log('Google Books fallback failed:', e);
      }
    }

    // Clean up Amazon image URL - get highest resolution
    if (image && (image.includes('images-amazon') || image.includes('m.media-amazon'))) {
      image = image.replace(/\._[^.]+_\./, '.');
    }

    const description = getMetaContent(html, 'description');

    // Extract author
    let author = getMetaContent(html, 'author')
      || getMetaContent(html, 'book:author');

    // Amazon-specific author extraction
    if (!author) {
      const authorPatterns = [
        /class=["'][^"']*author[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)</i,
        /id=["']bylineInfo["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)</i,
        /class=["']contributorNameID["'][^>]*>([^<]+)</i,
        /by\s+<[^>]*>([^<]+)</i,
      ];
      for (const pattern of authorPatterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          author = match[1].trim();
          break;
        }
      }
    }

    // Clean up title
    const cleanTitle = title
      .replace(/\s*[-–|:]\s*(Amazon|Amazon\.com\.br|Goodreads|Google Books|Saraiva|Magazine Luiza|Submarino).*$/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s*[-–|]\s*Idioma\s.*$/i, '')
      .replace(/:\s*(eBook|Kindle|Paperback|Hardcover|Capa\s+(Comum|Dura)).*$/i, '')
      .trim();

    // Clean up author
    const cleanAuthor = (author || '')
      .replace(/\s*\(.*\)$/, '')
      .trim();

    const result = {
      success: true,
      data: {
        title: cleanTitle,
        author: cleanAuthor,
        cover: image || '',
        description: description?.slice(0, 500),
      },
    };

    console.log('Metadata extracted:', { title: cleanTitle, author: cleanAuthor, hasImage: !!image });

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
