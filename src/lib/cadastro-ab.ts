/**
 * TESTE A/B DA TELA DE CADASTRO DO /inicio (20/09, ordem do dono).
 *
 * O que os dados de 20/09 mostraram: no navegador do Instagram (onde o Google
 * some e a tela é "e-mail e senha, leva 10 segundos") 40 pessoas chegaram no
 * cadastro → 25 criaram conta → 7 pagaram. No navegador normal (botão
 * "Continuar com Google" em cima, divisor "ou com e-mail", formulário embaixo)
 * 13 chegaram → 11 saíram sem tocar em nada, e só 3 no dia clicaram no Google.
 *
 * Hipótese: a tela "Google OU um formulário de 3 campos" lê como duas tarefas;
 * a tela "e-mail e senha, 10 segundos" lê como uma. Em vez de trocar por
 * palpite, metade vê cada versão e a gente mede cadastro → conta → pagamento.
 *
 *   padrao        = como hoje (Google em cima, e-mail embaixo)
 *   email_primeiro = formulário em cima com "leva 10 segundos"; Google vira um
 *                    link discreto embaixo (some no navegador embutido, como já era)
 *
 * SIGNUP_AB_FORCE: null = sorteio 50/50 por navegador (fica gravado, a pessoa
 * sempre vê a mesma); "padrao" ou "email_primeiro" = todo mundo vê essa.
 */
export type VarianteCadastro = "padrao" | "email_primeiro";

export const SIGNUP_AB_FORCE: VarianteCadastro | null = null;

const CHAVE = "core-cadastro-ab";

export function varianteCadastro(): VarianteCadastro {
  if (SIGNUP_AB_FORCE) return SIGNUP_AB_FORCE;
  try {
    const guardada = localStorage.getItem(CHAVE);
    if (guardada === "padrao" || guardada === "email_primeiro") return guardada;
    const sorteada: VarianteCadastro = Math.random() < 0.5 ? "padrao" : "email_primeiro";
    localStorage.setItem(CHAVE, sorteada);
    return sorteada;
  } catch {
    return "padrao";
  }
}
