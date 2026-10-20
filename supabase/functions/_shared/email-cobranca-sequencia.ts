/**
 * TEXTOS DA SEQUÊNCIA DO CARTÃO RECUSADO (D0, D2, D5, D10) — 20/10/2026.
 *
 * Regras do dono: curto, calmo, mínimo; NADA de Pix/site como alternativa
 * (regra da Apple + veto do dono); nunca "a Apple cobra até 24 h antes";
 * assinatura "João, do CORE"; um botão só, "Atualizar pagamento", pra
 * apps.apple.com/account/billing.
 *
 * Arquivo PURO: a cobranca-recusada importa daqui, o vitest testa e os prints
 * pro dono saem da MESMA função — o print é o que a pessoa recebe.
 */
import type { Passo } from "./cobranca-sequencia.ts";

export const URL_PAGAMENTO_APPLE = "https://apps.apple.com/account/billing";

export type DadosEmailSequencia = {
  passo: Passo;
  nome: string;
  comAcesso: boolean;
  /** Dias que faltam da carência de 28 dias (usado no D10). */
  diasRestantes: number;
  /** Link "sair da lista" (assinado). */
  linkSair: string;
};

type Texto = { assunto: string; preheader: string; paragrafos: string[]; depois?: string[] };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

function texto(d: DadosEmailSequencia): Texto {
  const n = d.nome;
  switch (d.passo) {
    case "d0":
      return {
        assunto: n ? `${n}, o pagamento do seu CORE não passou` : "O pagamento do seu CORE não passou",
        preheader: "Dá pra resolver em 1 minuto na App Store.",
        paragrafos: [
          n ? `Oi, ${n}!` : "Oi!",
          "A Apple tentou renovar o seu CORE e o cartão não passou. Acontece bastante: cartão vencido ou sem limite naquele dia.",
          d.comAcesso
            ? "Seu acesso continua liberado enquanto a Apple tenta de novo."
            : "Tudo o que você organizou continua guardado.",
        ],
        depois: ["Ou no iPhone: Ajustes → seu nome → Pagamento e Envio.", "Dúvida? É só responder este e-mail."],
      };
    case "d2":
      return {
        assunto: n ? `${n}, seu CORE continua do jeito que você deixou` : "Seu CORE continua do jeito que você deixou",
        preheader: "Só falta atualizar o cartão na App Store.",
        paragrafos: [
          n ? `Oi, ${n}.` : "Oi.",
          "Passando pra lembrar: o pagamento do CORE na App Store ainda não foi.",
          "Tudo o que você organizou continua lá. Atualizando o cartão, a Apple cobra sozinha.",
        ],
      };
    case "d5":
      return {
        assunto: "Uma dica pro cartão que não passou",
        preheader: "O cartão virtual do seu banco costuma resolver.",
        paragrafos: [
          n ? `Oi, ${n}.` : "Oi.",
          "Se o cartão continua recusando, duas coisas costumam resolver:",
          "• cadastrar o cartão virtual do app do seu banco;<br/>• ou pôr saldo na sua Conta Apple com um cartão-presente.",
        ],
        depois: ["Depois, não precisa fazer nada no app."],
      };
    case "d10": {
      const comPrazo = d.comAcesso && d.diasRestantes > 0;
      return {
        assunto: "Último lembrete sobre o seu CORE",
        preheader: comPrazo ? `A Apple tenta cobrar por mais ${dias(d.diasRestantes)}.` : "Nada do que você organizou se perdeu.",
        paragrafos: [
          n ? `Oi, ${n}.` : "Oi.",
          "Este é o último lembrete, prometo.",
          comPrazo
            ? `A Apple ainda tenta cobrar por mais <b>${dias(d.diasRestantes)}</b>. Depois disso o acesso ao CORE pausa — mas nada do que você organizou se perde.`
            : "Seu acesso está pausado, mas nada do que você organizou se perdeu. Atualizando o cartão, ele volta na hora.",
        ],
        depois: ["Se decidiu parar, tudo bem: não precisa fazer nada."],
      };
    }
  }
}

/** O nome entra escapado; o resto do texto é nosso (pode ter <b>/<br/>). */
const comNome = (d: DadosEmailSequencia): DadosEmailSequencia => ({ ...d, nome: esc(d.nome) });

export const assuntoSequencia = (d: DadosEmailSequencia) => texto(d).assunto;

export function htmlSequencia(d: DadosEmailSequencia): string {
  const t = texto(comNome(d));
  const p = (s: string, extra = "") => `<p style="margin:0 0 14px;${extra}">${s}</p>`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.assunto}</title></head>
<body style="margin:0;padding:0;background:#f6f3f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${t.preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#1e2430;line-height:1.6;font-size:16px;">
  <div style="background:#ffffff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    ${t.paragrafos.map((s) => p(s)).join("\n    ")}
    <p style="margin:24px 0;text-align:center;">
      <a href="${URL_PAGAMENTO_APPLE}" style="display:inline-block;background:#127A56;color:#ffffff;text-decoration:none;padding:15px 30px;border-radius:999px;font-weight:700;font-size:17px;">Atualizar pagamento</a>
    </p>
    ${(t.depois ?? []).map((s) => p(s, "font-size:14px;color:#5b5560;")).join("\n    ")}
    <p style="margin:18px 0 0;">Um abraço,<br/>João, do CORE</p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;line-height:1.5;">Você recebeu este aviso porque assina o CORE pela App Store.<br/><a href="${esc(d.linkSair)}" style="color:#8a838f;">Não quero mais receber estes avisos</a></p>
</div>
</body></html>`;
}

/** Versão em texto puro (entregabilidade). */
export function textoSequencia(d: DadosEmailSequencia): string {
  const t = texto(d);
  const limpa = (s: string) => s.replace(/<br\/>/g, "\n").replace(/<[^>]+>/g, "");
  return [
    ...t.paragrafos.map(limpa).flatMap((s) => [s, ""]),
    `Atualizar pagamento: ${URL_PAGAMENTO_APPLE}`,
    "",
    ...(t.depois ?? []).flatMap((s) => [limpa(s), ""]),
    "Um abraço,",
    "João, do CORE",
    "",
    `Não quer mais receber estes avisos? ${d.linkSair}`,
  ].join("\n");
}
