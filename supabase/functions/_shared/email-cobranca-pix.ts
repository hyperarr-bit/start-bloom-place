/**
 * E-MAIL "A APPLE NÃO CONSEGUIU COBRAR — DÁ PRA FICAR PELO PIX" (01/10/2026).
 *
 * Quem recebe: teste grátis do iPhone, cartão recusado pela Apple, ainda na
 * carência (ou na tentativa de cobrança). O e-mail de 28/09 só pedia pra
 * atualizar o cartão na App Store e recuperou 0 de 23+. Este oferece a saída
 * que o dono escolheu: R$ 97,90 UMA VEZ no Pix e o CORE é da pessoa pra
 * sempre (no lugar de R$ 97,90 todo ano na Apple). Honesto até o fim: depois
 * do Pix, cancelar a renovação na Apple pra não pagar duas vezes; e, se a
 * Apple cobrar mesmo assim, responder o e-mail que a gente devolve.
 *
 * Arquivo PURO (sem Deno): a cobranca-recusada importa daqui, o vitest testa
 * o conteúdo (src/test/email-cobranca-pix.test.ts) e o preview/print sai da
 * mesma função — o que o dono vê no print é o que a pessoa recebe.
 */

export const PRECO_PIX = "97,90";
export const URL_ASSINATURAS_APPLE = "https://apps.apple.com/account/subscriptions";
export const URL_PAGAMENTO_APPLE = "https://apps.apple.com/account/billing";

export type DadosEmailPix = {
  nome: string;
  comAcesso: boolean;
  email: string;
  /** Link que entra logado e cai em /planos?oferta=w97 (ou o /entrar com e-mail preenchido). */
  link: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const assuntoEmailPix = (nome: string) =>
  nome ? `${nome}, a Apple não conseguiu cobrar o seu CORE` : "A Apple não conseguiu cobrar o seu CORE";

export function htmlEmailPix(d: DadosEmailPix): string {
  const oi = d.nome ? `Oi, ${esc(d.nome)}!` : "Oi!";
  const guardado = d.comAcesso
    ? "Tudo o que você organizou continua guardado e o seu acesso segue aberto por enquanto — a Apple vai tentar cobrar de novo nos próximos dias."
    : "Tudo o que você organizou continua guardado, do jeitinho que você deixou.";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assuntoEmailPix(d.nome))}</title></head>
<body style="margin:0;padding:0;background:#f6f3f5;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#1e2430;line-height:1.6;font-size:16px;">
  <div style="background:#ffffff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <p style="margin:0 0 14px;">${oi}</p>
    <p style="margin:0 0 14px;">A Apple tentou cobrar a sua assinatura do CORE e o cartão não passou. Acontece bastante: cartão vencido, sem limite naquele dia ou bloqueado pra compra online.</p>
    <p style="margin:0 0 14px;">${guardado}</p>
    <p style="margin:0 0 6px;">Agora dá pra ficar com o CORE sem depender do cartão, pagando no Pix:</p>
    <div style="background:#fdf2f8;border-radius:12px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#1e2430;">R$ ${PRECO_PIX} <span style="font-size:15px;font-weight:600;color:#5b5560;">uma vez</span></p>
      <p style="margin:4px 0 0;font-size:14px;color:#5b5560;">e é seu <b>pra sempre</b> — no lugar de R$ ${PRECO_PIX} todo ano na Apple. Sem renovação, sem cobrança depois.</p>
    </div>
    <p style="margin:0 0 18px;text-align:center;">
      <a href="${esc(d.link)}" style="display:inline-block;background:#127A56;color:#ffffff;text-decoration:none;padding:15px 30px;border-radius:999px;font-weight:800;font-size:17px;">Pagar no Pix</a>
    </p>
    <p style="margin:0 0 18px;font-size:13px;color:#5b5560;">O botão entra direto na sua conta. Se ele pedir pra entrar, use o e-mail <b>${esc(d.email)}</b> — dá pra entrar com um código que chega no e-mail, sem precisar da senha.</p>

    <div style="border:1px solid #f0d9a8;background:#fff8e6;border-radius:12px;padding:14px 16px;margin:0 0 18px;font-size:14px;">
      <p style="margin:0 0 6px;font-weight:700;">Pra você não pagar duas vezes</p>
      <p style="margin:0 0 6px;">Depois do Pix, cancele a renovação na Apple: <b>Ajustes → toque no seu nome → Assinaturas → CORE → Cancelar assinatura</b> (ou por este link: <a href="${URL_ASSINATURAS_APPLE}" style="color:#1e2430;">apps.apple.com/account/subscriptions</a>).</p>
      <p style="margin:0;">Se a Apple cobrar mesmo assim, responda este e-mail que a gente resolve.</p>
    </div>

    <p style="margin:0 0 6px;font-size:14px;color:#5b5560;">Prefere continuar pela Apple mesmo? Então é só <a href="${URL_PAGAMENTO_APPLE}" style="color:#1e2430;">atualizar a forma de pagamento</a> (Ajustes → seu nome → Pagamento e Envio) e ela cobra sozinha.</p>
    <p style="margin:18px 0 0;">Qualquer dúvida, é só responder este e-mail.</p>
    <p style="margin:14px 0 0;">Um abraço,<br/>João, do CORE</p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;">Você recebeu este e-mail porque a cobrança da sua assinatura do CORE na App Store não passou.</p>
</div>
</body></html>`;
}

/** Versão em texto puro (entregabilidade e leitores sem HTML). */
export function textoEmailPix(d: DadosEmailPix): string {
  const oi = d.nome ? `Oi, ${d.nome}!` : "Oi!";
  return [
    oi,
    "",
    "A Apple tentou cobrar a sua assinatura do CORE e o cartão não passou. Acontece bastante: cartão vencido, sem limite naquele dia ou bloqueado pra compra online.",
    d.comAcesso
      ? "Tudo o que você organizou continua guardado e o seu acesso segue aberto por enquanto."
      : "Tudo o que você organizou continua guardado.",
    "",
    `Agora dá pra ficar com o CORE pagando no Pix: R$ ${PRECO_PIX} uma vez e é seu pra sempre (no lugar de R$ ${PRECO_PIX} todo ano na Apple).`,
    `Pagar no Pix: ${d.link}`,
    `Se pedir pra entrar, use o e-mail ${d.email} (dá pra entrar com um código que chega no e-mail, sem senha).`,
    "",
    "Pra não pagar duas vezes: depois do Pix, cancele a renovação na Apple em Ajustes → seu nome → Assinaturas → CORE → Cancelar assinatura,",
    `ou em ${URL_ASSINATURAS_APPLE}. Se a Apple cobrar mesmo assim, responda este e-mail que a gente resolve.`,
    "",
    `Prefere continuar pela Apple? É só atualizar a forma de pagamento: ${URL_PAGAMENTO_APPLE}`,
    "",
    "Qualquer dúvida, é só responder este e-mail.",
    "",
    "Um abraço,",
    "João, do CORE",
  ].join("\n");
}
