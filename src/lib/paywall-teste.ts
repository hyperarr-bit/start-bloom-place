/**
 * PAYWALL COM OU SEM TESTE GRÁTIS (12/11, 1.0.26 iPhone / Android 138) — a chave e os produtos. A tela sem teste
 * mora em components/paywall/PaywallSemTeste (estrutura do paywall da Enxovaly, identidade do CORE).
 *
 * Decisão do dono (12/11): sem teste grátis. Anual R$ 99,90/ano (marcado, "R$ 8,33/mês") e mensal R$ 34,90/mês.
 * Quem fecha o paywall ou cancela a folha da loja sem pagar ganha o presente de 69,90/ano SEM teste (paga na hora).
 *
 * CHAVE REMOTA `paywall_teste` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `paywall_minimalista`/`titulo_paywall`:
 *   · "off" (ou ausente, ou RevenueCat sem resposta) → o paywall SEM teste (o novo, PaywallSemTeste) — padrão;
 *   · "on"                                            → o fluxo de hoje com o teste de 3 dias, exatamente igual.
 * Vale pro iPhone e pro Android. A última resposta fica no aparelho (`core-paywall-teste`): reabrir o app antes de o
 * RevenueCat responder mostra o mesmo paywall da última vez. QA: `?paywall-teste=on|off|auto`.
 */

/** Os produtos NOVOS (outra frente cria na Apple/Play/RevenueCat). Um lugar só: trocar aqui troca o app inteiro. */
export const PRODUTOS_SEM_TESTE = {
  anual: "core_anual_99",
  mensal: "core_mensal_34",
  /** o presente de saída: 69,90/ano SEM oferta introdutória (cobra na hora) */
  presente: "core_anual_69_direto",
} as const;
export type PlanoSemTeste = keyof typeof PRODUTOS_SEM_TESTE;

/** A offering do RevenueCat onde os três moram (procurada primeiro; depois qualquer offering; depois a loja direto). */
export const OFFERING_SEM_TESTE = "sem_teste";

/** RESERVA de texto enquanto a loja não respondeu — o preço de verdade é sempre o priceString da loja. */
export const PRECOS_RESERVA_SEM_TESTE: Record<PlanoSemTeste, { preco: string; valor: number }> = {
  anual: { preco: "R$ 99,90", valor: 99.9 },
  mensal: { preco: "R$ 34,90", valor: 34.9 },
  presente: { preco: "R$ 69,90", valor: 69.9 },
};

export type ModoPaywallTeste = "on" | "off";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_PAYWALL_TESTE = "paywall_teste";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho — lib/chaves-do-aparelho). */
export const CHAVE_PAYWALL_TESTE_APARELHO = "core-paywall-teste";
/** Força de QA (fora dos prefixos varridos). */
export const CHAVE_FORCA_PAYWALL_TESTE = "paywall-teste-force";
export const PARAM_PAYWALL_TESTE = "paywall-teste";
/** ROLLBACK sem RevenueCat = "on" aqui + build. */
export const PAYWALL_TESTE_PADRAO: ModoPaywallTeste = "off";

const modoDe = (v: unknown): ModoPaywallTeste | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

let remota: ModoPaywallTeste | null = null;

/** Decisão pura: o `paywall_teste` do metadata das offerings (a `current` vence as outras); null = ninguém disse. */
export function lerChaveRemotaPaywallTeste(offerings: unknown): ModoPaywallTeste | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoPaywallTeste | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    lido = modoDe(off?.metadata?.[CHAVE_REMOTA_PAYWALL_TESTE]) ?? lido;
  }
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_PAYWALL_TESTE]) ?? lido;
}

/** revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu. Sem a chave = o padrão ("off"). */
export function registrarPaywallTesteRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    remota = lerChaveRemotaPaywallTeste(offerings) ?? PAYWALL_TESTE_PADRAO;
    ls.set(CHAVE_PAYWALL_TESTE_APARELHO, remota);
    try { window.dispatchEvent(new CustomEvent(EVENTO_PAYWALL_TESTE, { detail: remota })); } catch { /* sem janela */ }
  } catch { /* metadata estranha: fica como estava */ }
}
/** A janela ouve isto quando a resposta do RevenueCat chega (as telas trocam de paywall se a chave mudou). */
export const EVENTO_PAYWALL_TESTE = "core:paywall-teste";
/** Só testes. */
export const _zerarChavePaywallTeste = (): void => { remota = null; };

/** Guarda `?paywall-teste=on|off|auto` (QA) neste aparelho. */
export function guardarForcaPaywallTeste(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_PAYWALL_TESTE); } catch { return; }
  const t = (v ?? "").toLowerCase();
  if (modoDe(t)) ls.set(CHAVE_FORCA_PAYWALL_TESTE, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_PAYWALL_TESTE);
}

/** O modo que vale AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > padrão ("off"). */
export function modoPaywallTeste(): ModoPaywallTeste {
  // só testes: o setup da suíte fixa "on" (o paywall de hoje); os testes da chave apagam o global
  const g = modoDe((globalThis as { __PAYWALL_TESTE__?: unknown }).__PAYWALL_TESTE__);
  if (g) return g;
  const f = modoDe(ls.get(CHAVE_FORCA_PAYWALL_TESTE));
  if (f) return f;
  if (remota) return remota;
  return modoDe(ls.get(CHAVE_PAYWALL_TESTE_APARELHO)) ?? PAYWALL_TESTE_PADRAO;
}

/** O app nativo mostra o paywall COM teste (o de hoje)? false = o paywall novo, sem teste. */
export const paywallComTeste = (): boolean => modoPaywallTeste() === "on";
