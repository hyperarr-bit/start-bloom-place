/**
 * OS PIXELS DA META QUE RECEBEM A VENDA DA WEB (19/10, conta de anúncios nova "iris").
 *
 * O pixel de sempre (META_PIXEL_ID + META_CAPI_TOKEN, conta Street Store) continua sendo o principal. Com
 * META_PIXEL_ID_2 + META_CAPI_TOKEN_2 configurados, o MESMO evento (mesmo event_id) vai também pro 2º pixel — cada
 * pixel deduplica o navegador × servidor sozinho, então nada conta em dobro. Sem o 2º, nada muda.
 *
 * `fetchNosPixels(init)` tem a cara do `fetch(url, init)` que cada função já fazia: devolve a resposta do PRINCIPAL
 * (os logs e os testes de cada função seguem iguais) e manda pro 2º em paralelo, sem nunca derrubar o principal.
 */
export type PixelMeta = { id: string; token: string };

const env = (k: string): string | undefined => {
  try { return (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k) ?? undefined; } catch { return undefined; }
};

export function pixelsDaMeta(ler: (k: string) => string | undefined = env): PixelMeta[] {
  const lista: PixelMeta[] = [];
  const id1 = ler("META_PIXEL_ID"), t1 = ler("META_CAPI_TOKEN");
  if (id1 && t1) lista.push({ id: id1, token: t1 });
  const id2 = ler("META_PIXEL_ID_2"), t2 = ler("META_CAPI_TOKEN_2");
  if (id2 && t2 && id2 !== id1) lista.push({ id: id2, token: t2 });
  return lista;
}

export const urlDoPixel = (p: PixelMeta) => `https://graph.facebook.com/v19.0/${p.id}/events?access_token=${p.token}`;

export async function fetchNosPixels(init: RequestInit, ler: (k: string) => string | undefined = env, f: typeof fetch = fetch): Promise<Response> {
  const pixels = pixelsDaMeta(ler);
  if (!pixels.length) return new Response(JSON.stringify({ error: "sem_pixel" }), { status: 400 });
  const extras = pixels.slice(1).map((p) =>
    f(urlDoPixel(p), init)
      .then(async (r) => { if (!r.ok) console.log(`[META-PIXELS] 2º pixel recusou - ${JSON.stringify({ status: r.status, corpo: (await r.text().catch(() => "")).slice(0, 160) })}`); })
      .catch((e) => console.log(`[META-PIXELS] 2º pixel falhou - ${String(e).slice(0, 120)}`)));
  const principal = await f(urlDoPixel(pixels[0]), init);
  await Promise.all(extras);
  return principal;
}
