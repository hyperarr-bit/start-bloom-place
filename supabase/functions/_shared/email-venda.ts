/**
 * VENDA DA WEB (/assinar, 15/10) — parte PURA das funções de dinheiro: o nome do produto e o e-mail de boas-vindas
 * de quem comprou o ANUAL (Pix `a97`/`a69` ou cartão na Cakto), o MENSAL no cartão ou o MÊS pré-pago no Pix (`w25`).
 *
 * Por que existe: os e-mails antigos dizem "acesso vitalício" e "a senha que você criou no cadastro". Quem compra
 * na /assinar tem 1 ano (ou 1 mês) e NÃO tem senha (a conta nasce no pagamento, só com nome + e-mail): entra no app
 * com "Entrar sem senha — receber código por e-mail". Testado no vitest (src/test/venda-web-servidor.test.ts).
 */
import { eh2027 } from "./pacote-2027.ts";
import { OFERTA_CASAL, OFERTA_VITALICIO_HOJE, ehPlanoHoje, temKit } from "./ofertas-hoje.ts";
export const OFERTA_PIX_ANUAL = "a97";
/** 16/10: o PRESENTE do funil do app na web (/assinatura) — o mesmo anual por R$ 69,90 (6990), 365 dias. */
export const OFERTA_PIX_ANUAL_69 = "a69";
/** 18/10: o FUNIL WEB NOVO (/hoje) — as ofertas moram em ./ofertas-hoje.ts. Os PLANOS (h279/h279k = 1º ano;
 *  h149/h149k = 30 dias) levam as boas-vindas da venda; os upsells (hv47, hv27, hc199) não levam e-mail próprio. */
export const ehOfertaHoje = ehPlanoHoje;
/** As ofertas de Pix que são o ANUAL da venda da web (1 ano, não vitalício). */
export const OFERTAS_PIX_ANUAIS: readonly string[] = [OFERTA_PIX_ANUAL, OFERTA_PIX_ANUAL_69, "h279", "h279k"];
/** O mês pré-pago do Pix (R$ 24,90, 30 dias, NÃO renova): o degrau 3 do /assinatura e a 2ª coluna antiga da web. */
export const OFERTA_PIX_MES = "w25";
/** Todas as ofertas de 30 dias pré-pagos no Pix (w25 e o h149 do /hoje). */
export const OFERTAS_PIX_MES: readonly string[] = [OFERTA_PIX_MES, "h149", "h149k"];
const ehMesDaVenda = (offer: string | null | undefined): boolean => !!offer && OFERTAS_PIX_MES.includes(offer);
/** 18/10: + "lifetime" (o /hoje com o upsell "CORE pra sempre": as boas-vindas dizem o acesso FINAL da conta). */
export type PeriodoVenda = "annual" | "monthly" | "monthly_prepaid" | "lifetime";

export const ehAnualDaVenda = (offer: string | null | undefined): boolean => !!offer && OFERTAS_PIX_ANUAIS.includes(offer);

/**
 * O e-mail de boas-vindas da venda vale pra esta oferta de Pix? Devolve o período (anual / mês pré-pago) ou null
 * (as outras ofertas seguem com o e-mail antigo). 16/10: o `w25` passou a ter o e-mail da venda — o antigo dizia
 * "acesso vitalício" e "a senha que você criou" pra quem pagou 30 dias (e a conta do funil novo nem tem senha).
 */
export function periodoDoEmailVenda(offer: string | null | undefined): PeriodoVenda | null {
  // 20/10: o plano vitalício do /hoje (hv279) — é plano do /hoje, então TEM que ter período (os chamadores usam `!`)
  if (offer === OFERTA_VITALICIO_HOJE) return "lifetime";
  if (ehAnualDaVenda(offer)) return "annual";
  if (ehMesDaVenda(offer)) return "monthly_prepaid";
  return null;
}

/** O planName da UTMify por oferta de Pix (antes: "annual" só pro a97, "lifetime" pra todo o resto — até o mês). */
export function planoUtmify(offer: string | null | undefined): string {
  if (eh2027(offer)) return "pacote_2027"; // 21/10: o upsell "Seu 2027" (u2027) não é plano
  if (ehAnualDaVenda(offer)) return "annual";
  if (ehMesDaVenda(offer)) return "monthly_prepaid";
  if (offer === OFERTA_CASAL) return "casal";
  return "lifetime";
}

/** O nome que vai pra CAPI (content_name) e pra UTMify — mantém os antigos ("CORE Vitalício") pra quem não é venda. */
export function nomeDoProduto(args: { offer?: string | null; periodo?: string | null; downsell?: boolean }): string {
  if (eh2027(args.offer)) return "CORE Seu 2027"; // 21/10: o upsell "Seu 2027 já organizado" (u2027, R$ 19,90)
  // 18/10 (/hoje): os upsells têm nome próprio (o hc199 não é plano de quem pagou; hv47/hv27 = vitalício do upsell)
  if (args.offer === OFERTA_CASAL) return "CORE a dois";
  if (args.offer === "hv47" || args.offer === "hv27") return "CORE pra sempre";
  if (temKit(args.offer)) return ehAnualDaVenda(args.offer) ? "CORE Anual + Kit" : "CORE 1 mês + Kit";
  if (ehAnualDaVenda(args.offer) || args.periodo === "annual") return "CORE Anual";
  if (args.periodo === "monthly") return "CORE Mensal";
  if (ehMesDaVenda(args.offer) || args.periodo === "monthly_prepaid") return "CORE 1 mês";
  return args.downsell ? "CORE Vitalício (oferta)" : "CORE Vitalício";
}

export function assuntoVenda(periodo: PeriodoVenda): string {
  if (periodo === "lifetime") return "Seu CORE pra sempre tá ativo ✅";
  if (periodo === "annual") return "Seu plano anual do CORE tá ativo ✅";
  if (periodo === "monthly_prepaid") return "Seus 30 dias de CORE tão ativos ✅";
  return "Sua assinatura mensal do CORE tá ativa ✅";
}

/** O bloco das lojas (já com o e-mail escapado). Botões de tabela: funcionam no Gmail/Outlook sem imagem. */
const blocoLojas = (e: string): string => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#faf7f9;border:1px solid #efe6ec;border-radius:14px;"><tr><td style="padding:16px 16px 14px;">
      <div style="font-size:15px;font-weight:800;color:#16121c;margin:0 0 4px;">Seu CORE também no celular</div>
      <div style="font-size:13.5px;line-height:1.45;color:#5b5560;margin:0 0 12px;">O CORE é um app da App Store e da Google Play. Baixe e entre com este e-mail: <b style="color:#16121c;">${e}</b></div>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:0 8px 0 0;"><a href="${URL_APP_STORE_EMAIL}" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#63743; App Store</a></td>
        <td><a href="${URL_PLAY_EMAIL}" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#9654; Google Play</a></td>
      </tr></table>
    </td></tr></table>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** dd/mm/aaaa em Brasília (null se não houver data ou for o "+100 anos" do vitalício). */
export function dataBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getUTCFullYear() > 2100) return null;
  const b = new Date(d.getTime() - 3 * 3600e3);
  return `${String(b.getUTCDate()).padStart(2, "0")}/${String(b.getUTCMonth() + 1).padStart(2, "0")}/${b.getUTCFullYear()}`;
}

/** Os links das lojas no e-mail (os mesmos do site: LojasCard / e-mail antigo). */
export const URL_APP_STORE_EMAIL = "https://apps.apple.com/br/app/id6806913181";
export const URL_PLAY_EMAIL = "https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Demail%26utm_campaign%3Dweb_hoje_email";

/**
 * `hoje: true` (18/10, o funil /hoje): o dono pediu deixar CLARO que o CORE é app da App Store e da Google Play (na era
 * do vitalício, a maior parte dos reembolsos era "pensei que era da loja"). Entra o bloco "Seu CORE também no celular"
 * com os dois botões das lojas + "entre com este e-mail", e a linha do anual diz que nada é cobrado sozinho.
 */
export function htmlVenda(args: { email: string; nome?: string | null; periodo: PeriodoVenda; fim?: string | null; hoje?: boolean }): string {
  const e = esc(args.email);
  const primeiro = esc(String(args.nome ?? "").trim().split(/\s+/)[0] || "");
  const ate = dataBr(args.fim);
  const plano = args.periodo === "lifetime"
    ? "Seu acesso ao CORE é <b>pra sempre</b>. Nada é cobrado sozinho."
    : args.periodo === "annual"
    ? `Seu <b>plano anual</b> está ativo${ate ? ` — acesso até <b>${ate}</b>` : ""}.${args.hoje ? " Nada é cobrado sozinho: daqui a 1 ano a gente avisa e você decide se renova." : ""}`
    : args.periodo === "monthly_prepaid"
      // 16/10: o Pix do mês NÃO renova (um cliente se confundiu com o mensal vencido) — o e-mail diz isso com todas as letras
      ? `Seus <b>30 dias de CORE</b> estão ativos${ate ? ` — acesso até <b>${ate}</b>` : ""}. Sem renovação automática: pra continuar, é só pagar de novo.`
      : `Sua <b>assinatura mensal</b> está ativa. Renova todo mês no cartão; cancele quando quiser.`;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 12px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d22d80;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 12px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#d22d80;text-transform:uppercase;">Pagamento confirmado</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">${primeiro ? `${primeiro}, seu` : "Seu"} CORE está liberado.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 14px;color:#5b5560;">${plano}</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#5b5560;">Sua conta: <b style="color:#16121c;">${e}</b></p>
    ${args.hoje ? blocoLojas(e) : ""}
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

/**
 * 18/10 (/hoje, upsell "Organize a vida a dois"): o e-mail de quem GANHOU o acesso. Sem nome de quem deu (a conta
 * de quem comprou ainda não tem nome nesse momento) e sem senha: entra com o código do e-mail, no app ou no site.
 */
export function assuntoParceiro(): string {
  return "Você ganhou acesso ao CORE ✅";
}
export function htmlParceiro(args: { email: string; fim?: string | null; vitalicio?: boolean }): string {
  const e = esc(args.email);
  const ate = dataBr(args.fim);
  const acesso = args.vitalicio
    ? "Seu acesso é <b>pra sempre</b>."
    : `Seu acesso vale${ate ? ` até <b>${ate}</b>` : ""}. Nada é cobrado de você.`;
  const passo = (n: number, t: string) => `<tr><td style="vertical-align:top;padding:0 12px 12px 0;"><div style="width:26px;height:26px;border-radius:13px;background:#d22d80;color:#fff;font-weight:900;font-size:13px;line-height:26px;text-align:center;">${n}</div></td><td style="vertical-align:top;padding:3px 0 12px;font-size:15px;line-height:1.45;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#d22d80;text-transform:uppercase;">Presente pra vocês dois</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 8px;">Alguém organizou a vida a dois com o CORE — e incluiu você.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px;color:#5b5560;">${acesso}</p>
    ${blocoLojas(e)}
    <p style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:0 0 10px;">Como entrar</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${passo(1, "Abra o CORE e toque em <b>“Entrar”</b> (não em “Começar”).")}
      ${passo(2, `Digite <b>${e}</b> e toque em <b>“Entrar sem senha — receber código por e-mail”</b>. Use o código que chegar.`)}
    </table>
    <p style="font-size:12.5px;color:#8a838f;line-height:1.5;margin:16px 0 0;">No computador, é o mesmo CORE em coreaplicativo.com.br.</p>
  </div>
</div></body></html>`;
}
