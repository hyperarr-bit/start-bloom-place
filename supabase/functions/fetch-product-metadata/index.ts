const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
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

    // og:price:amount
    price = getMetaContent(html, 'price:amount')
      || getMetaContent(html, 'product:price:amount');

    // Amazon-specific price extraction
    if (!price) {
      const pricePatterns = [
        // Amazon price patterns
        /class=["'][^"']*a-price-whole["'][^>]*>([^<]+)</i,
        /id=["']priceblock_ourprice["'][^>]*>([^<]+)</i,
        /id=["']priceblock_dealprice["'][^>]*>([^<]+)</i,
        /class=["'][^"']*price-large["'][^>]*>([^<]+)</i,
        /"priceAmount"\s*:\s*"?([0-9.,]+)"?/i,
        /class=["'][^"']*a-color-price["'][^>]*>\s*(?:R\$\s*)?([0-9.,]+)/i,
        // Generic price patterns
        /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
        /data-price=["']([^"']+)["']/i,
        // Brazilian price format
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

    // Also try to get the fraction part for Amazon
    if (price && !price.includes(',') && !price.includes('.')) {
      const fractionMatch = html.match(/class=["'][^"']*a-price-fraction["'][^>]*>([^<]+)/i);
      if (fractionMatch?.[1]) {
        price = `${price},${fractionMatch[1].trim()}`;
      }
    }

    // Parse price to number
    let priceNumber = 0;
    if (price) {
      // Handle Brazilian format: 1.299,90 → 1299.90
      let normalized = price.replace(/\s/g, '');
      if (normalized.includes(',') && normalized.includes('.')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else if (normalized.includes(',')) {
        normalized = normalized.replace(',', '.');
      }
      priceNumber = parseFloat(normalized) || 0;
    }

    // Clean title
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
      error: error instanceof Error ? error.message : 'Failed to fetch metadata'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
