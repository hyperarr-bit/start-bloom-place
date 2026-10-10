/**
 * BUILD DE QA DA 1.0.14 (10/10) — `VITE_V14_QA=1`.
 *
 * As frentes da 1.0.14 nascem TODAS atrás de chave desligada (tour da Home, cartões
 * de boas-vindas, ofertas de saída, onboarding numa tela, dia 1 cheio, cartão
 * recusado, avaliações, módulo oculta pendências, paywall enxuto, recuperação do
 * paywall, paywall curto, plano com cadeado). Pra o dono testar tudo junto no iPhone sem mexer em constante nenhuma,
 * existe UM modo de build:
 *
 *     VITE_V14_QA=1 npm run loja:ios      → build de QA (tudo ligado)
 *     npm run loja:ios                    → build de LOJA (tudo no padrão)
 *
 * Cada lib de chave lê `v14Qa()` na hora de responder "está ligado?": força de QA
 * pelo link (navegador) > esta env > metadata remota (RevenueCat) > constante.
 * Sem a env, nada muda — é o que src/test/v14-qa.test.ts trava. O
 * scripts/preparar-loja.mjs avisa em letras grandes quando a env está ligada,
 * pra essa build nunca ir pra loja por engano.
 */
export const v14Qa = (): boolean => {
  try { return import.meta.env.VITE_V14_QA === "1"; } catch { return false; }
};
