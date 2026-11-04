/**
 * CPF (04/11, /oferta — nota fiscal). Puro e sem Deno: o checkout da página (src/landing/stripe-checkout.ts) e o stripe-criar
 * usam o MESMO código. Dado pessoal: só vai pra metadata[cpf] do PaymentIntent (pelo atualizar do stripe-criar) — nunca pra
 * analytics_events, logs, pixel ou CAPI. A nota fiscal é emitida lendo de lá (Stripe → PaymentIntent → metadata.cpf).
 */
export const soDigitosCpf = (s: string | null | undefined): string => String(s ?? "").replace(/\D/g, "").slice(0, 11);

/** 000.000.000-00 enquanto digita (aceita colar com ou sem pontuação) */
export function mascararCpf(s: string | null | undefined): string {
  const d = soDigitosCpf(s);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** os 2 dígitos verificadores batem? (11 dígitos, não todos iguais) */
export function cpfValido(s: string | null | undefined): boolean {
  const d = soDigitosCpf(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
