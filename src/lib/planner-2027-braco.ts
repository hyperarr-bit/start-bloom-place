/**
 * TESTE A/B DOS 2 DESENHOS DO PLANNER 2027 (31/10, pedido do dono: "codex" × "core", meio a meio).
 *
 * O MESMO sorteio nos 2 lados, sem guardar nada: a oferta da /organizar (src/landing/upsell-2027.ts) e o app (o planner em
 * Desenvolvimento Pessoal → Seu 2027, e a oferta do /hoje e /inicio) não dividem armazenamento — então o braço sai de uma
 * conta que os dois sabem fazer sozinhos: o e-mail da compradora, normalizado (sem espaços nas pontas, minúsculas), num
 * hash FNV-1a de 32 bits, misturado no fim (o finalizador do MurmurHash3). Par = "core", ímpar = "codex".
 *   Por que misturar: o último bit do FNV-1a puro é só a paridade de quantas letras de código ímpar o texto tem (o primo
 *   do FNV é ímpar e não mexe nesse bit) — "maria1@gmail.com" e "maria3@gmail.com" cairiam SEMPRE no mesmo lado, e em
 *   1000 e-mails sintéticos deu 43/57. Com a mistura: 50/50. A compradora da /organizar entra no app com o MESMO e-mail da
 * compra, então vê no app o desenho que viu na oferta.
 *
 * Sem e-mail (o link do e-mail aberto noutro navegador; o /hoje com sessão anônima; conta com o apelido pix-…@): a
 * "reserva" — o id da compra na oferta, o id da conta no app. Também meio a meio (não puxa um lado no teste), mas pode não
 * bater com o app; os eventos dizem `braco_planner_via: "reserva"` pra separar na análise.
 *
 * Arquivo sem dependência (a landing lê sem baixar o app).
 */
export type EstiloDoBraco = "codex" | "core";

/** O e-mail como os 2 lados comparam: sem espaços nas pontas, minúsculas. */
export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/** FNV-1a 32 bits (sem sinal) sobre as unidades UTF-16 do texto — simples, estável e igual em todo navegador. */
export function fnv1a32(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** O finalizador do MurmurHash3 (fmix32): espalha todos os bits do hash pelo último. */
export function misturar(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Par = "core", ímpar = "codex" (do hash misturado). */
export const estiloDoHash = (texto: string): EstiloDoBraco => (misturar(fnv1a32(texto)) % 2 === 0 ? "core" : "codex");

/** E-mail que vale pro sorteio: tem cara de e-mail e não é o apelido da sessão anônima (pix-<hex>@coreaplicativo.com.br). */
export function emailDoSorteio(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = normalizarEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(e) || /^pix-[0-9a-f]+@coreaplicativo\.com\.br$/.test(e)) return null;
  return e;
}

export type ViaDoSorteio = "email" | "reserva" | "padrao";

/** O braço de quem tem e-mail (o caminho normal); sem e-mail, pela reserva; sem nada, "codex" (só QA/telas sem conta). */
export function sortearEstilo(quem: { email?: string | null; reserva?: string | null }): { estilo: EstiloDoBraco; via: ViaDoSorteio } {
  const email = emailDoSorteio(quem.email);
  if (email) return { estilo: estiloDoHash(email), via: "email" };
  const reserva = (quem.reserva ?? "").trim();
  if (reserva) return { estilo: estiloDoHash(reserva), via: "reserva" };
  return { estilo: "codex", via: "padrao" };
}
