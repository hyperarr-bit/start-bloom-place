import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_DOMAINS = [
  'amazon.com', 'amazon.com.br', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp',
  'mercadolivre.com.br', 'mercadolibre.com',
  'magazineluiza.com.br', 'magalu.com.br',
  'submarino.com.br',
  'americanas.com.br',
  'casasbahia.com.br',
  'shopee.com.br',
  'aliexpress.com',
  'kabum.com.br',
  'extra.com.br',
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

    console.log('Fetching product metadata from:', url);

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

    // ── Helper: extract meta content ──
    const getMetaContent = (html: string, property: string): string => {
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, 'i'));
      if (metaMatch) return metaMatch[1];

      return '';
    };

    // ── TITLE ──
    let title = getMetaContent(html, 'title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

    // ── IMAGE ──
    let image = getMetaContent(html, 'image')
      || getMetaContent(html, 'image:src');

    // Amazon-specific image patterns
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

    // ASIN-based image fallback
    const asinMatch = url.match(/\/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i)
      || url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    if (!image && asinMatch?.[1]) {
      image = `https://images-na.ssl-images-amazon.com/images/P/${asinMatch[1]}.01.LZZZZZZZ.jpg`;
    }

    // Generic product image fallback
    if (!image) {
      const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*/gi);
      for (const m of imgMatches) {
        const src = m[1];
        if (src && src.startsWith('http') &&
          (src.includes('images-amazon') || src.includes('m.media-amazon') ||
           src.includes('produto') || src.includes('product') || src.includes('cover'))) {
          if (!src.includes('sprite') && !src.includes('icon') && !src.includes('pixel') && !src.includes('1x1')) {
            image = src;
            break;
          }
        }
      }
    }

    // Clean Amazon image URLs for max resolution
    if (image && (image.includes('images-amazon') || image.includes('m.media-amazon'))) {
      image = image.replace(/\._[^.]+_\./, '.');
    }

    // ── PRICE ──
    let price = '';

    price = getMetaContent(html, 'price:amount')
      || getMetaContent(html, 'product:price:amount');

    if (!price) {
      const pricePatterns = [
        /class=["'][^"']*a-price-whole["'][^>]*>([^<]+)</i,
        /id=["']priceblock_ourprice["'][^>]*>([^<]+)</i,
        /id=["']priceblock_dealprice["'][^>]*>([^<]+)</i,
        /class=["'][^"']*price-large["'][^>]*>([^<]+)</i,
        /"priceAmount"\s*:\s*"?([0-9.,]+)"?/i,
        /class=["'][^"']*a-color-price["'][^>]*>\s*(?:R\$\s*)?([0-9.,]+)/i,
        /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
        /data-price=["']([^"']+)["']/i,
        /R\$\s*([0-9]+[.,][0-9]{2})/i,
      ];
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          price = match[1].trim().replace(/[^\d.,]/g, '');
          break;
        }
      }
    }

    if (price && !price.includes(',') && !price.includes('.')) {
      const fractionMatch = html.match(/class=["'][^"']*a-price-fraction["'][^>]*>([^<]+)/i);
      if (fractionMatch?.[1]) {
        price = `${price},${fractionMatch[1].trim()}`;
      }
    }

    let priceNumber = 0;
    if (price) {
      let normalized = price.replace(/\s/g, '');
      if (normalized.includes(',') && normalized.includes('.')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else if (normalized.includes(',')) {
        const parts = normalized.split(',');
        if (parts.length === 2 && parts[1].length === 3) {
          normalized = normalized.replace(',', '');
        } else {
          normalized = normalized.replace(',', '.');
        }
      } else if (normalized.includes('.')) {
        const parts = normalized.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
          normalized = normalized.replace('.', '');
        }
        if (parts.length > 2) {
          normalized = normalized.replace(/\./g, '');
        }
      }
      priceNumber = parseFloat(normalized) || 0;
    }

    const cleanTitle = title
      .replace(/\s*[-–|:]\s*(Amazon|Amazon\.com\.br|Mercado Livre|Magazine Luiza|Submarino|Americanas|Casas Bahia|Shopee|AliExpress).*$/i, '')
      .replace(/\s*\|.*$/, '')
      .trim();

    const result = {
      success: true,
      data: {
        title: cleanTitle,
        image: image || '',
        price: priceNumber,
      },
    };

    console.log('Product metadata extracted:', { title: cleanTitle, hasImage: !!image, price: priceNumber });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching product metadata:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch metadata'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
