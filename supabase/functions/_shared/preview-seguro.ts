/**
 * PREVIEW DE E-MAIL SÓ PRA CAIXA DO DONO (revisão de segurança 21/10).
 *
 * recovery-emails e pix-pendente-email aceitam `{ preview: "<e-mail>" }` pra o dono ver a régua. As duas são
 * chamáveis com a anon key pública (uma com verify_jwt=false, a outra só com a anon key), então o `preview` mandava
 * e-mail do domínio verificado do CORE pra QUALQUER endereço — spam com a nossa marca, e o Resend pode suspender a
 * conta (aí param boas-vindas e todo e-mail de compra). Agora o preview só sai pras caixas da equipe.
 * Sem Deno: testado no vitest (src/test/seguranca/preview-seguro.test.ts).
 */
export const DESTINOS_DE_PREVIEW = ["jv20101958@gmail.com", "hyperarr@gmail.com", "contato@coreaplicativo.com.br"];

/** O destino do preview, se for uma caixa da equipe; senão null (quem chama responde 403). */
export function destinoDePreview(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  return DESTINOS_DE_PREVIEW.includes(e) ? e : null;
}
