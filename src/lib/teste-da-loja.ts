/**
 * O TESTE GRÁTIS DA LOJA — os fatos que mais de uma tela lê (17/10, 1.0.16). Folha: não importa nada. O paywall
 * (DIAS_DE_TESTE_PADRAO), o marcador do teste (lib/teste-gratis), o pedido do aviso do teste (lib/notificacoes) e as
 * boas-vindas da missão leem daqui — uma chave, um nome.
 *
 * Por que existe (revisão pré-build da 1.0.16): as boas-vindas da missão diziam "Seus 3 dias grátis começaram" pra
 * TODO mundo que entrava na missão — também quem pagou no site, assinou o mensal (cobra hoje) ou entrou com o código
 * de 7 dias da App Store. `diasDoTesteDaLoja()` diz se a pessoa está num teste da loja AGORA e de quantos dias ele é;
 * sem teste, null (e a tela fala do acesso, sem número).
 */

/** Dias grátis de RESERVA enquanto a loja não respondeu (ou a duração não se lê) — o número de verdade é o da loja:
 *  a oferta introdutória (rc.diasTrialIos()) no paywall; o fim real do teste depois da compra. Nenhum teste da loja
 *  é mais curto que isto. */
export const DIAS_DE_TESTE_PADRAO = 3;

/** O marcador do teste da loja: o fim REAL do período grátis (ms), gravado no boot por quem a loja diz que está em
 *  TESTE (revenuecat.conferirTrialCartao → teste-gratis.marcarTrialCartaoAte) — o código de 7 dias da App Store, o
 *  teste do Google, a reinstalação. Chave do aparelho (chaves-do-aparelho.ts). */
export const CHAVE_TRIAL_CARTAO = "core-trial-cartao-fim";
/** O evento da janela quando o marcador nasce — o boot pode responder DEPOIS da 1ª tela. */
export const EVENTO_TRIAL_CARTAO = "core:trial-cartao";
/** O pedido do aviso do teste (lib/notificacoes): gravado NA HORA da compra em teste do iPhone, com o início
 *  (`inicioMs`, desde a 1.0.16) e o fim (`fimMs`). Chave do aparelho. */
export const CHAVE_LEMBRETE_TESTE = "core-lembrete-teste";

const DIA_MS = 86_400_000;
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** Só o fim é conhecido: os dias que faltam, pra cima — e nunca menos que a reserva (a tela que lê isto vem logo
 *  depois de entrar; "faltam 2 dias" de um teste de 3 não é "seus 2 dias grátis"). */
const pelosQueFaltam = (fim: number, agora: number): number => Math.max(DIAS_DE_TESTE_PADRAO, Math.ceil((fim - agora) / DIA_MS));

/**
 * De quantos dias é o teste grátis da loja em que a pessoa está AGORA — ou null (sem teste: pagou no site, assinou o
 * mensal, vitalício, código de acesso do site, ou o teste já acabou). Na ordem:
 *   1) a compra em teste feita neste aparelho (o pedido do aviso: início → fim) — os dias exatos dela, já na 1ª
 *      tela depois da compra (o marcador do boot pode chegar uns instantes depois);
 *   2) o teste que a loja confirmou no boot (o marcador, só o fim) — o código de 7 dias, o teste do Google.
 * Nunca lança: storage bloqueado ou JSON estranho = null.
 */
export function diasDoTesteDaLoja(agora: number = Date.now()): number | null {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_LEMBRETE_TESTE) ?? "null") as { fimMs?: unknown; inicioMs?: unknown } | null;
    const fim = numero(p?.fimMs);
    if (fim !== null && fim > agora) {
      const inicio = numero(p?.inicioMs);
      if (inicio === null || inicio >= fim) return pelosQueFaltam(fim, agora); // pedido de antes da 1.0.16 (sem início)
      const dias = Math.round((fim - inicio) / DIA_MS);
      return dias >= 1 ? dias : DIAS_DE_TESTE_PADRAO; // < 1 dia = o relógio acelerado da sandbox da Apple
    }
  } catch { /* pedido ilegível: segue pro marcador */ }
  try {
    const fim = Number(localStorage.getItem(CHAVE_TRIAL_CARTAO));
    if (Number.isFinite(fim) && fim > agora) return pelosQueFaltam(fim, agora);
  } catch { /* sem storage */ }
  return null;
}
