/**
 * DESTINO SEGURO DEPOIS DO LOGIN (01/10/2026).
 *
 * O e-mail de cartão recusado (cobranca-recusada, modo pix) manda um link
 * mágico que cai em /auth/callback?next=/planos?oferta=w97. O `next` vem da
 * URL — então é entrada de fora e só pode apontar pra DENTRO do site, numa
 * rota conhecida. Sem isto, qualquer um montaria um link do nosso domínio que
 * loga a pessoa e a joga num site de terceiros (open redirect).
 *
 * Regras: começa com "/" (caminho interno), não começa com "//" (seria outro
 * host), sem esquema/":" ou "\" no caminho, sem espaço/controle, e o caminho
 * tem que ser uma das rotas permitidas (hoje só /planos…).
 */
export const DESTINOS_PERMITIDOS = ["/planos"];
const CHAVE = "core-auth-next";

export function destinoSeguro(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\x00-\x1f\x7f]/.test(s)) return null;
  const caminho = s.split(/[?#]/)[0];
  if (/[:\\]/.test(caminho)) return null;
  if (!DESTINOS_PERMITIDOS.some((p) => caminho === p || caminho.startsWith(`${p}/`))) return null;
  return s;
}

/** Login pelo Google/Apple sai do site e volta no /auth/callback sem a query:
 *  guarda o destino antes de sair; o callback lê (e apaga) na volta. */
export function guardarDestino(next: string | null): void {
  try {
    if (destinoSeguro(next)) localStorage.setItem(CHAVE, next as string);
    else localStorage.removeItem(CHAVE);
  } catch { /* noop */ }
}

export function pegarDestinoGuardado(): string | null {
  try {
    const v = localStorage.getItem(CHAVE);
    localStorage.removeItem(CHAVE);
    return destinoSeguro(v);
  } catch {
    return null;
  }
}

/** /entrar?e=…&next=… — a porta de quem chegou com o link mágico vencido. */
export function urlEntrar(next: string, email?: string | null): string {
  const q = new URLSearchParams();
  if (email && /\S+@\S+\.\S+/.test(email)) q.set("e", email);
  q.set("next", next);
  return `/entrar?${q.toString()}`;
}
