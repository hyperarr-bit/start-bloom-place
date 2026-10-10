/**
 * ASSINANTE DO MOCK DA LOJA (10/10) — SÓ no build de TESTE (`RC_MOCK=1`, que só o
 * `npm run loja -- --teste` liga).
 *
 * O bug que isto conserta (dono, Simulador, 10/10): com o build de mock a compra
 * "passa" na loja simulada (src/dev/rc-plugin-mock.ts), mas o servidor NUNCA recebe
 * o webhook do RevenueCat — então, depois de criar a conta, o `isSubscribed` do
 * use-auth (tabela subscriptions) fica false e a pessoa cai no gate/paywall de
 * dentro do app, sem chegar na Missão/tour. O mock agora grava
 * `localStorage.__rc_mock_assinante = "1"` (+ produto e hora) ao concluir uma compra,
 * e o use-auth, QUANDO O BUILD É DE MOCK, trata isso como assinante (subLoaded true,
 * isSubscribed true, teste normal de 3 dias a partir da compra pra Missão/lembretes).
 *
 * "Quando o build é de mock" = a constante global `__RC_MOCK__`, que o vite.config.ts
 * define como true SÓ com RC_MOCK=1 no ambiente (false em qualquer outro build; nos
 * testes do vitest ela nem existe). O build de PRODUÇÃO já aborta se RC_MOCK existir
 * (scripts/preparar-loja.mjs) e, por cima, confere que o JS final não carrega a
 * marca `__rc_mock_assinante` — o esbuild elimina este caminho morto quando
 * `__RC_MOCK__` é false. Sem a constante, `assinaturaDoMock()` é SEMPRE null
 * (src/test/rc-mock-assinante.test.ts).
 */
declare const __RC_MOCK__: boolean | undefined;

export const CHAVE_MOCK_ASSINANTE = "__rc_mock_assinante";
export const CHAVE_MOCK_PRODUTO = "__rc_mock_produto";
export const CHAVE_MOCK_COMPRA_EM = "__rc_mock_compra_em";
/** O teste do anual do iPhone (3 dias) — o mesmo da oferta introdutória do mock. */
export const DIAS_DO_TESTE_MOCK = 3;

export type AssinaturaDoMock = {
  produto: string;
  compraEm: number;
  /** anual com oferta introdutória = teste de 3 dias; mensal cobra na hora */
  emTeste: boolean;
  fimMs: number;
  billingPeriod: "annual" | "monthly" | "lifetime";
};

/** Este build é o de TESTE (loja simulada)? Fora dele, sempre false (sem a constante = ReferenceError = false). */
export const buildDeMock = (): boolean => typeof __RC_MOCK__ !== "undefined" && __RC_MOCK__ === true;

/**
 * A compra que o mock concluiu neste aparelho, ou null. Null também fora do build de
 * mock — mesmo com a marca gravada no localStorage (um localStorage vazado nunca vira
 * acesso num binário de loja).
 */
export function assinaturaDoMock(agora: number = Date.now()): AssinaturaDoMock | null {
  // a constante direto aqui (não via buildDeMock): com `__RC_MOCK__` definido como false o
  // rollup/esbuild veem `if (true) return null` e tiram o resto — a marca some do JS de produção
  // (sem try/catch em volta: `typeof` não lança sem a constante, e um `try { return null }` não é
  // morto pelo minificador — a marca ficava no JS de produção)
  if (typeof __RC_MOCK__ === "undefined" || __RC_MOCK__ !== true) return null;
  try {
    if (localStorage.getItem(CHAVE_MOCK_ASSINANTE) !== "1") return null;
    const produto = localStorage.getItem(CHAVE_MOCK_PRODUTO) || "core_anual_97";
    const compraEm = Number(localStorage.getItem(CHAVE_MOCK_COMPRA_EM)) || agora;
    const anual = /^core_anual/.test(produto);
    const vitalicio = /^core_vitalicio/.test(produto);
    const emTeste = anual; // só o anual do iPhone tem a oferta introdutória no mock
    const dias = emTeste ? DIAS_DO_TESTE_MOCK : anual || vitalicio ? 365 : 30;
    return {
      produto, compraEm, emTeste,
      fimMs: compraEm + dias * 86_400_000,
      billingPeriod: vitalicio ? "lifetime" : anual ? "annual" : "monthly",
    };
  } catch {
    return null;
  }
}

/** Dia do teste (1 = dia da compra) e horas que faltam — o que o use-auth expõe pro app. */
export function diasDoTesteDoMock(a: AssinaturaDoMock, agora: number = Date.now()): { trialDay: number; trialHoursLeft: number } {
  const trialDay = Math.max(1, Math.floor((agora - a.compraEm) / 86_400_000) + 1);
  const trialHoursLeft = Math.max(0, Math.round((a.fimMs - agora) / 3_600_000));
  return { trialDay, trialHoursLeft };
}
