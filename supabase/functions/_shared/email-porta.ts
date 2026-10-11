/**
 * E-MAIL "SEU PLANO ESTÁ SALVO — ENTRE NO CORE" DA PORTA iPHONE (10/10) — parte PURA.
 *
 * Sai logo depois da conta criada na /comece, de dentro do `porta-handoff` ("criar"): o MESMO
 * código de uso único que o site mostra no "Abrir o CORE" vai no botão "Entrar no CORE"
 * (`core://entrar?h=<código>` — o app troca por sessão e abre já logado). Embaixo, o link de
 * reserva em https (a página /abrir?h=…, porque alguns apps de e-mail não abrem link core://) e
 * os 3 passos manuais (baixar → Entrar → o jeito que a conta foi criada), pra quando o app ainda
 * não está instalado ou o código venceu (24 h, 1 uso). Nada de preço; nada de "grátis".
 *
 * Testado no vitest (src/test/porta-handoff-funcao.test.ts) — é daqui que sai o print do e-mail.
 */
export const SITE = "https://coreaplicativo.com.br";
export const ASSUNTO_PORTA = "Seu plano está salvo — entre no CORE";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const linkDoApp = (codigo: string): string => `core://entrar?h=${encodeURIComponent(codigo)}`;
export const linkDeReserva = (codigo: string): string => `${SITE}/abrir?h=${encodeURIComponent(codigo)}`;

/** Contas internas/de revisão não recebem. */
export const ehEmailDeTeste = (email?: string | null): boolean =>
  !!email && /(^|[+.])teste|testeghg|jv20101958|revisao\.apple|portaqa/i.test(email);

export function htmlPorta({ email, metodo, codigo }: { email: string; metodo: string; codigo: string | null }): string {
  const e = esc(email);
  // o passo 3 é o jeito que a conta foi criada na Porta (senha, Apple ou Google)
  const passo3 = metodo === "google"
    ? `Toque em <b>“Continuar com Google”</b> e escolha <b>${e}</b>.`
    : metodo === "apple"
      ? `Toque em <b>“Continuar com a Apple”</b>.`
      : `Digite <b>${e}</b> e a sua senha e toque em <b>“Entrar no meu CORE”</b>.`;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 14px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d22d80;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 14px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  const botao = codigo
    ? `<a href="${esc(linkDoApp(codigo))}" style="display:block;text-align:center;background:#16121c;color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 18px;border-radius:999px;margin:6px 0 10px;">Entrar no CORE</a>
    <p style="font-size:12.5px;color:#5b5560;line-height:1.5;margin:0 0 20px;text-align:center;">Com o app instalado, o botão abre o CORE já na sua conta.<br>Não abriu? <a href="${esc(linkDeReserva(codigo))}" style="color:#d22d80;font-weight:700;">Toque aqui</a></p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ASSUNTO_PORTA)}</title></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#8a838f;text-transform:uppercase;">Seu plano está salvo</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 6px;">Falta só entrar no app.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#5b5560;">Sua conta: <b style="color:#16121c;">${e}</b></p>
    ${botao}
    <p style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:0 0 10px;">${codigo ? "Ainda não tem o app?" : "Como entrar"}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${passo(1, `Baixe o <b>CORE</b> no celular: <a href="${SITE}/baixar?origem=porta_email" style="color:#d22d80;font-weight:700;">App Store</a>.`)}
      ${passo(2, "Abra o app e toque em <b>“Entrar”</b>, logo abaixo do botão Começar. Não toque em “Começar”.")}
      ${passo(3, passo3)}
    </table>
    <p style="font-size:13px;color:#5b5560;line-height:1.5;margin:4px 0 0;">Quer ver com fotos? <a href="${SITE}/como-entrar" style="color:#d22d80;font-weight:700;">Passo a passo</a></p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;">Você recebeu este e-mail porque salvou um plano no CORE agora há pouco.</p>
</div></body></html>`;
}
