/**
 * SEGURANÇA (21/10): o JS do build carrega o env do Vite inteiro ou uma variável de QA?
 *
 * Quando o código usa `import.meta.env` como VALOR (ex.: `import.meta.env as Record<…>`), o Vite cola o objeto env
 * INTEIRO no bundle — todas as VITE_* do ambiente e dos .env, inclusive VITE_PORTA_QA_EMAIL/SENHA (a conta de QA da
 * Porta). O preparar-loja chama isto em cada .js do binário de loja e aborta se der true.
 * Testado em src/test/seguranca/env-no-bundle.test.ts.
 */
export function jsComEnvVazado(js) {
  return /BASE_URL\s*:\s*"\/"\s*,[^}]{0,400}MODE\s*:/.test(js) || /VITE_PORTA_QA|VITE_[A-Z0-9_]*SENHA|CORE_ADMIN_/.test(js);
}
