/**
 * Programa de afiliados — o que a WEB conhece (09/10/2026).
 *
 * A conta de verdade (comissão, trava semanal, calendário do Pix, idempotência
 * do webhook) mora em supabase/functions/_shared/afiliados.ts e roda no
 * servidor. Aqui só os tipos do que a função `afiliados` devolve e os textos
 * que as telas mostram. O painel público recebe agregados — nunca nome,
 * e-mail ou id de cliente — e este arquivo não tem onde guardar isso.
 */

export type SituacaoLinha = "em_teste" | "prevista" | "paga" | "segurada" | "reembolsada" | "nao_pagou";

export interface LinhaPainel {
  /** "YYYY-MM-DD" (Brasília) da cobrança, ou do começo do teste */
  dia: string;
  comissao_cents: number;
  situacao: SituacaoLinha;
  pagamento_dia: string | null;
}

export interface PainelAfiliada {
  nome: string;
  codigo: string;
  link: string;
  pausado: boolean;
  dias_carencia: number;
  usaram: number;
  em_teste: number;
  pagaram: number;
  reembolsadas: number;
  nao_pagaram: number;
  a_receber_cents: number;
  ja_recebido_cents: number;
  segurado_cents: number;
  proximo_pagamento: { dia: string; valor_cents: number };
  linhas: LinhaPainel[];
}

/* ---------------------------------------------------------------- admin */

export interface AfiliadaAdmin {
  id: string;
  nome: string;
  codigo: string;
  email: string | null;
  /** mascarada pelo servidor ("***1234") */
  pix_chave: string;
  pix_tipo: string;
  token_painel: string;
  limite_semanal_cents: number;
  pausado: boolean;
  criado_em: string;
  link_painel: string;
  link_resgate: string;
}
export interface VendaAdmin {
  id: string;
  afiliado_id: string;
  plataforma: "ios" | "android";
  produto: string;
  valor_bruto_cents: number | null;
  valor_liquido_cents: number | null;
  comissao_cents: number;
  status: "em_teste" | "pago" | "reembolsado" | "recusado";
  motivo: string | null;
  cobrado_em: string | null;
  pagamento_id: string | null;
  criado_em: string;
}
export interface PagamentoAdmin {
  id: string;
  afiliado_id: string;
  valor_cents: number;
  asaas_transfer_id: string | null;
  asaas_status: string | null;
  status: "enviando" | "enviado" | "falhou" | "segurado";
  motivo: string | null;
  erro: string | null;
  vendas_ids: string[];
  semana: string | null;
  criado_em: string;
}
export interface DadosAdminAfiliados {
  afiliados: AfiliadaAdmin[];
  vendas: VendaAdmin[];
  pagamentos: PagamentoAdmin[];
  proxima_segunda: string;
}
export interface NovaAfiliada {
  nome: string;
  codigo: string;
  email: string;
  pix_chave: string;
  pix_tipo: string;
  limite_semanal_cents: number;
}

/* ---------------------------------------------------------------- textos */

export const reais = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "2026-10-12" → "13/10" */
export const diaCurto = (dia: string | null | undefined): string => {
  if (!dia) return "—";
  const [, m, d] = dia.slice(0, 10).split("-");
  return `${d}/${m}`;
};

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** "2026-10-12" → "segunda, 13/10" */
export const diaComSemana = (dia: string): string => {
  const d = new Date(`${dia.slice(0, 10)}T12:00:00Z`);
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${diaCurto(dia)}`;
};

/** A frase da linha do painel — a única coisa que a afiliada vê de cada venda. */
export function textoSituacao(l: LinhaPainel): string {
  switch (l.situacao) {
    case "paga": return `paga em ${diaCurto(l.pagamento_dia)}`;
    case "prevista": return `Pix previsto pra ${diaCurto(l.pagamento_dia)}`;
    case "segurada": return "em conferência";
    case "em_teste": return "em teste grátis";
    case "nao_pagou": return "não virou assinatura";
    case "reembolsada": return "reembolsada";
  }
}

export const ROTULO_STATUS_VENDA: Record<VendaAdmin["status"], string> = {
  em_teste: "em teste", pago: "pagou", reembolsado: "reembolsado", recusado: "não pagou",
};
export const ROTULO_STATUS_PAGAMENTO: Record<PagamentoAdmin["status"], string> = {
  enviando: "enviando — conferir no Asaas", enviado: "Pix enviado", falhou: "falhou", segurado: "segurado",
};
export const ROTULO_MOTIVO: Record<string, string> = {
  cartao_recusado: "cartão recusado", nao_pagou: "teste acabou sem pagar", cancelou_no_teste: "cancelou no teste", reembolso: "reembolso",
};

/* ---------------------------------------------------------------- exemplo (dev + testes) */

export const PAINEL_EXEMPLO: PainelAfiliada = {
  nome: "Bia",
  codigo: "BIA",
  link: "https://apps.apple.com/redeem?ctx=offercodes&id=6806913181&code=BIA",
  pausado: false,
  dias_carencia: 7,
  usaram: 23,
  em_teste: 6,
  pagaram: 11,
  reembolsadas: 1,
  nao_pagaram: 5,
  a_receber_cents: 16060,
  ja_recebido_cents: 28105,
  segurado_cents: 0,
  proximo_pagamento: { dia: "2026-10-12", valor_cents: 8030 },
  linhas: [
    { dia: "2026-10-08", comissao_cents: 0, situacao: "em_teste", pagamento_dia: null },
    { dia: "2026-10-08", comissao_cents: 0, situacao: "em_teste", pagamento_dia: null },
    { dia: "2026-10-07", comissao_cents: 4015, situacao: "prevista", pagamento_dia: "2026-10-19" },
    { dia: "2026-10-06", comissao_cents: 4015, situacao: "prevista", pagamento_dia: "2026-10-19" },
    { dia: "2026-10-05", comissao_cents: 4015, situacao: "prevista", pagamento_dia: "2026-10-12" },
    { dia: "2026-10-04", comissao_cents: 4015, situacao: "prevista", pagamento_dia: "2026-10-12" },
    { dia: "2026-10-03", comissao_cents: 0, situacao: "nao_pagou", pagamento_dia: null },
    { dia: "2026-09-30", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-10-06" },
    { dia: "2026-09-29", comissao_cents: 0, situacao: "reembolsada", pagamento_dia: null },
    { dia: "2026-09-28", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-10-06" },
    { dia: "2026-09-27", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-10-06" },
    { dia: "2026-09-24", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-09-29" },
    { dia: "2026-09-23", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-09-29" },
    { dia: "2026-09-22", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-09-29" },
    { dia: "2026-09-21", comissao_cents: 4015, situacao: "paga", pagamento_dia: "2026-09-29" },
  ],
};
