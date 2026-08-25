/**
 * IDENTIFICAÇÃO DA EMPRESA — fonte única.
 *
 * Por que existe (24/08): a inscrição no Apple Developer Program (8Y42K57CWD)
 * foi RECUSADA porque o site "não [era] relacionado à empresa da inscrição".
 * A exigência da Apple é literal:
 *
 *   "é essencial que o site da sua organização esteja ativo, completo e
 *    público, com um nome de domínio associado" + "URL de suporte funcional
 *    e público [...] com suas informações de contato"
 *
 * O site continua sendo sobre o CORE — a empresa aparece no rodapé, na página
 * de suporte e nos textos legais, exatamente como fazem os apps brasileiros
 * que já passaram por essa etapa (Dinzo → Codari Soluções de Tecnologia LTDA;
 * Visor → Visor Tecnologia da Informação LTDA).
 *
 * Dados conferidos na base da Receita em 24/08/2026: situação ATIVA, matriz,
 * razão social batendo letra por letra com o que vai no D-U-N-S. Campo vazio
 * aqui simplesmente NÃO é renderizado — nunca inventar número.
 *
 * O endereço não é capricho: o Decreto 7.962/2013 (art. 2º, I) obriga site
 * que vende a exibir nome empresarial, CNPJ e endereço físico e eletrônico.
 * Como o CORE vende aqui (Pix, R$ 27,90), ele entra. Se em algum momento a
 * decisão for tirar, é apagar esta linha — o resto continua de pé.
 */

export const EMPRESA = {
  /** Razão social exata do contrato social / cartão CNPJ / D-U-N-S. */
  razaoSocial: "NATALIA DE JESUS E SILVA SANTOS LTDA",
  cnpj: "55.041.112/0001-82",
  /** Endereço da matriz no cartão CNPJ, em uma linha. O tipo do logradouro
   *  ("Rua") veio do registro do D&B que a Apple preencheu sozinha na
   *  inscrição — a Receita não guarda esse campo. Manter idêntico ao que
   *  está no D-U-N-S: a Apple compara o site com o cadastro. */
  endereco: "Rua Inácio Magalhães Júnior, 3 — Parque Piauí, Teresina/PI, CEP 64025-050",
  /** Caixa real (Google Workspace no domínio). A Apple testa este e-mail. */
  email: "suporte@coreaplicativo.com.br",
  /** Prazo declarado de resposta — promessa pública, manter honesta. */
  prazoResposta: "até 48 horas úteis",
  site: "https://coreaplicativo.com.br",
} as const;

/** "CORE é um produto de RAZÃO SOCIAL — CNPJ 00.000.000/0001-00" */
export const assinaturaEmpresa = () =>
  `CORE é um produto de ${EMPRESA.razaoSocial}` +
  (EMPRESA.cnpj ? ` — CNPJ ${EMPRESA.cnpj}` : "");
