/**
 * O LINK E A MENSAGEM DO PRESENTE (21/10; separado em 01/11) — sem dependências, pra a /organizar (src/landing/upsell-presente.ts)
 * montar o MESMO cartão do WhatsApp da /presente/dar sem baixar o resto de ./presente.ts (que reexporta tudo daqui).
 */
export const SITE = "https://www.coreaplicativo.com.br";
export const linkDoPresente = (codigo: string): string => `${SITE}/presente/${codigo}`;
/** O link curto que aparece no cartão (sem https://www.). */
export const linkCurto = (codigo: string): string => `coreaplicativo.com.br/presente/${codigo}`;

/** A mensagem do WhatsApp — sem "ele/ela": serve pra amigo, amiga, namorado, namorada. */
export function mensagemDoPresente(codigo: string, de: string | null): string {
  const quem = (de ?? "").trim();
  // crítica r2 (honestidade): sem nome, "Ganhei pra você" soava sorteio/coisa grátis
  return `${quem ? `${quem} te deu o CORE pra sempre 💛` : "Um presente pra você: o CORE pra sempre 💛"}\nAbre aqui pra ativar o seu: ${linkDoPresente(codigo)}`;
}
export const urlWhatsApp = (texto: string): string => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** O nome no cartão (o mesmo limite do servidor: 40 letras, sem tag). */
export const nomeLimpo = (v: string): string => v.replace(/[<>{}\\]/g, "").replace(/\s+/g, " ").trimStart().slice(0, 40);
