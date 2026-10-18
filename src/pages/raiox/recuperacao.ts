/**
 * Recuperação — PRONTA NO PAPEL, NÃO ATIVA.
 *
 * Não importar da página. Não agenda e-mail, não chama função.
 * Quando o João ligar (com RAIOX="on"):
 * - Pix gerado e não pago: e-mail em 40 min e em 24 h com QR novo.
 *   O cron pix-pendente-email já existe (supabase/functions/pix-pendente-email) e hoje aponta pra /planos.
 *   Reusar o cano, com template do Raio-X e link /raio-x — sem ativar neste PR.
 * - E-mail dado no resultado e não pagou: e-mail em 1 h "Seu Raio-X de {mês}"
 *   (só a faixa e o maior vazamento, nunca o valor exato nem descrição) e outro em 24 h.
 */
export const RECUPERACAO_RAIOX = {
  ativo: false as const,
  pixNaoPago: [
    { depoisMin: 40, oQue: "e-mail com QR novo" },
    { depoisHoras: 24, oQue: "e-mail com QR novo" },
  ],
  emailSemPagamento: [
    { depoisHoras: 1, oQue: "Seu Raio-X de {mês}: só a faixa e o maior vazamento" },
    { depoisHoras: 24, oQue: "lembrete, sem valor exato e sem descrição" },
  ],
};
