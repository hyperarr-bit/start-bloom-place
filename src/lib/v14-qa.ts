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

/**
 * BUILD DE LOJA DA 1.0.14 (10/10, dono: "sem A/B, na tora, liga tudo") — `VITE_V14_LOJA=1`.
 * Liga as MESMAS chaves que o QA, no app das lojas, MENOS o que depende de produto que ainda não
 * existe (OFERTA_MENSAL_19 — `core_mensal_19` não foi criado na Apple) e sem as forças de QA (o tour
 * continua só pra conta nova). Só entra no binário quando o build nativo é feito com a env: o site
 * (Vercel) não tem a env e fica igual. As constantes de cada lib continuam "off".
 *
 *     VITE_V14_LOJA=1 npm run loja:ios     → 1.0.14 de loja, novidades ligadas
 */
export const v14Loja = (): boolean => {
  try { return import.meta.env.VITE_V14_LOJA === "1"; } catch { return false; }
};
/** QA ou loja: "as novidades da 1.0.14 estão ligadas neste binário". */
export const v14Ligada = (): boolean => v14Qa() || v14Loja();
