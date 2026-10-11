/**
 * PORTA → APP SEM DIGITAR NADA (10/10) — as partes PURAS do `porta-handoff`.
 *
 * A pessoa cria a conta no site (/comece) e baixa o app. Pra o app abrir JÁ
 * LOGADO, o site pede um CÓDIGO de uso único (24 h, 1 uso, ligado ao user_id)
 * e o entrega ao app por dois caminhos: `core://porta?c=<código>` (botão
 * "Abrir o CORE" na volta da loja) e a área de transferência
 * (`https://coreaplicativo.com.br/p/<código>`, copiado no toque em "Baixar").
 * O app troca o código por um token_hash de magic link e faz `verifyOtp`.
 *
 * O CÓDIGO: 10 caracteres de um alfabeto de 32 SEM os ambíguos (sem I, O, 0, 1)
 * = 32^10 ≈ 1,1 × 10^15 combinações. Com o limite de 20 erros por IP por hora
 * no resgate, adivinhar é inviável. No banco fica só o SHA-256 (hex) — quem lê
 * a tabela não consegue entrar em conta nenhuma.
 *
 * Sem Deno nem Supabase aqui: testado no vitest (src/test/porta-handoff-funcao.test.ts)
 * e importado pela função (`../_shared/porta-handoff.ts`).
 */

/** 32 símbolos: A–Z sem I e O, 2–9 (sem 0 e 1). */
export const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 10;
export const VALIDADE_MS = 24 * 3600_000;
/** Erros de resgate por IP por hora antes de responder "limite". */
export const LIMITE_ERROS_POR_HORA = 20;

const RE_CODIGO = new RegExp(`^[${ALFABETO}]{${TAMANHO_CODIGO}}$`);

/**
 * Gera um código a partir de bytes aleatórios (crypto.getRandomValues).
 * 256 é múltiplo de 32, então `byte % 32` não tem viés.
 */
export function gerarCodigo(bytes?: Uint8Array): string {
  const b = bytes ?? crypto.getRandomValues(new Uint8Array(TAMANHO_CODIGO));
  if (b.length < TAMANHO_CODIGO) throw new Error("bytes insuficientes");
  let s = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return s;
}

/** Maiúsculo, só letras e números (link colado com espaço ou minúsculas ainda vale). */
export function normalizarCodigo(v: unknown): string {
  return String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export function codigoValido(v: unknown): boolean {
  return RE_CODIGO.test(normalizarCodigo(v));
}

/** SHA-256 em hex — é o que mora em porta_handoff.codigo_hash. */
export async function hashCodigo(codigo: string): Promise<string> {
  const dados = new TextEncoder().encode(normalizarCodigo(codigo));
  const h = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** O IP do pedido (1º do x-forwarded-for; o Supabase põe o do cliente na frente). */
export function ipDoPedido(h: { get(n: string): string | null }): string {
  const xff = h.get("x-forwarded-for") ?? "";
  const primeiro = xff.split(",")[0]?.trim();
  return primeiro || h.get("cf-connecting-ip") || h.get("x-real-ip") || "sem-ip";
}

/** Pode tentar mais um resgate? (erros da última hora deste IP) */
export function dentroDoLimite(errosNaUltimaHora: number): boolean {
  return errosNaUltimaHora < LIMITE_ERROS_POR_HORA;
}

/** O link que o site copia e o app reconhece na área de transferência. */
export const BASE_LINK = "https://coreaplicativo.com.br/p/";
export const linkDoCodigo = (codigo: string): string => `${BASE_LINK}${codigo}`;
