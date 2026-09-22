/**
 * "PRA QUEM" em Saúde (22/09) — chamado: "pensando em quem tem filho pequeno
 * e/ou pai idoso, se seria possível escolher qual médico e medicação seria
 * meu ou do dependente". Consulta e remédio ganham `quem?: string` (ausente =
 * a própria pessoa — ninguém que já cadastrou vê nada mudar). Os nomes usados
 * ficam nesta chave só pra virar sugestão no campo; não é cadastro de pessoa.
 */
export const CHAVE_DEPENDENTES = "core-saude-dependentes";

/** Nome pra tela/lembrete: "Ômega 3 (Mãe)" — ou só o nome, quando é seu. */
export const nomeComQuem = (nome: string, quem?: string | null) => {
  const q = (quem ?? "").trim();
  return q ? `${nome} (${q})` : nome;
};
