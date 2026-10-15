/**
 * VENDA DA WEB (/assinar, 15/10) — parte PURA das funções de dinheiro: o nome do produto e o e-mail de boas-vindas
 * de quem comprou o ANUAL (Pix `a97` ou cartão na Cakto) ou o MENSAL no cartão.
 *
 * Por que existe: os e-mails antigos dizem "acesso vitalício" e "a senha que você criou no cadastro". Quem compra
 * na /assinar tem 1 ano (ou 1 mês) e NÃO tem senha (a conta nasce no pagamento, só com nome + e-mail): entra no app
 * com "Entrar sem senha — receber código por e-mail". Testado no vitest (src/test/venda-web-servidor.test.ts).
 */
export const OFERTA_PIX_ANUAL = "a97";
export type PeriodoVenda = "annual" | "monthly";

/** O nome que vai pra CAPI (content_name) e pra UTMify — mantém os antigos ("CORE Vitalício") pra quem não é venda. */
export function nomeDoProduto(args: { offer?: string | null; periodo?: string | null; downsell?: boolean }): string {
  if (args.offer === OFERTA_PIX_ANUAL || args.periodo === "annual") return "CORE Anual";
  if (args.periodo === "monthly") return "CORE Mensal";
  if (args.periodo === "monthly_prepaid") return "CORE 1 mês";
  return args.downsell ? "CORE Vitalício (oferta)" : "CORE Vitalício";
}

export function assuntoVenda(periodo: PeriodoVenda): string {
  return periodo === "annual" ? "Seu plano anual do CORE tá ativo ✅" : "Sua assinatura mensal do CORE tá ativa ✅";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** dd/mm/aaaa em Brasília (null se não houver data ou for o "+100 anos" do vitalício). */
export function dataBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() > 2100) return null;
  const b = new Date(d.getTime() - 3 * 3600e3);
  return `${String(b.getUTCDate()).padStart(2, "0")}/${String(b.getUTCMonth() + 1).padStart(2, "0")}/${b.getUTCFullYear()}`;
}

export function htmlVenda(args: { email: string; nome?: string | null; periodo: PeriodoVenda; fim?: string | null }): string {
  const e = esc(args.email);
  const primeiro = esc(String(args.nome ?? "").trim().split(/\s+/)[0] || "");
  const ate = dataBr(args.fim);
  const plano = args.periodo === "annual"
    ? `Seu <b>plano anual</b> está ativo${ate ? ` — acesso até <b>${ate}</b>` : ""}.`
    : `Sua <b>assinatura mensal</b> está ativa. Renova todo mês no cartão; cancele quando quiser.`;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 12px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d22d80;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 12px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#d22d80;text-transform:uppercase;">Pagamento confirmado</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">${primeiro ? `${primeiro}, seu` : "Seu"} CORE está liberado.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 14px;color:#5b5560;">${plano}</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#5b5560;">Sua conta: <b style="color:#16121c;">${e}</b></p>
    <p style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:0 0 10px;">Como entrar no app</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${passo(1, `Baixe o <b>CORE</b>: <a href="https://coreaplicativo.com.br/baixar?origem=venda_email" style="color:#d22d80;font-weight:700;">App Store ou Google Play</a>.`)}
      ${passo(2, "Abra e toque em <b>“Entrar”</b>, logo abaixo do botão Começar. Não toque em “Começar”.")}
      ${passo(3, `Digite <b>${e}</b> e toque em <b>“Entrar sem senha — receber código por e-mail”</b>. Use o código que chegar.`)}
    </table>
    <p style="font-size:13px;color:#5b5560;line-height:1.5;margin:4px 0 0;">Quer ver com fotos? <a href="https://coreaplicativo.com.br/como-entrar" style="color:#d22d80;font-weight:700;">Passo a passo</a></p>
    <p style="font-size:12.5px;color:#8a838f;line-height:1.5;margin:16px 0 0;">No computador, é o mesmo CORE em coreaplicativo.com.br.</p>
  </div>
</div></body></html>`;
}
