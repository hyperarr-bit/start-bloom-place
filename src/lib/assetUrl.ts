// Os assets do Lovable (vídeos, fotos) são servidos pelo CDN do Lovable em
// caminhos relativos como /n/assets-v1/... ou /__l5e/assets-v1/...
// Esses caminhos só existem em domínios hospedados no Lovable.
// O domínio coreaplicativo.com.br está hospedado fora do Lovable (Vercel),
// então as URLs precisam ser absolutas apontando para o host do Lovable.
const LOVABLE_ASSET_HOST = "https://coreaplicativo.lovable.app";

export function assetUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/n/assets-v1/") || url.startsWith("/__l5e/assets-v1/")) {
    return LOVABLE_ASSET_HOST + url;
  }
  return url;
}
