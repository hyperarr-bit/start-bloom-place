/**
 * PAYWALL MINIMALISTA DO iPHONE (17/10, 1.0.16) — só a chave, sem tela. A tela mora no PaywallIOS
 * (layout curto) e a linha do tempo em components/paywall/LinhaDoTempoDoTeste.
 *
 * Pedido do dono (17/10, depois de ver a referência do Blinkist): "minimalismo é melhor, tanto na
 * estrutura do paywall quanto na copy". Ligada, o paywall CURTO (o do funil e o do gate) vira:
 * "Experimente 3 dias grátis" + a linha do tempo do teste (Hoje · Amanhã · Dia 3) + um cartão do
 * plano + "Começar teste grátis" + "Ver plano mensal" + o rodapé legal. Desligada, o paywall curto
 * de hoje, byte a byte (as folhas por cima também: explicação da 2ª folha e presente 69,90).
 * Só vale onde o curto vale: com `paywall_curto` desligado continua o layout longo de sempre.
 *
 * QUEM DECIDE, nesta ordem (a primeira que responder vale):
 *   1. força de QA deste aparelho: `?paywall-minimalista=on|off|auto` (lida pelo PaywallIOS ao abrir)
 *   2. metadata do RevenueCat `paywall_minimalista: "on" | "off"` em QUALQUER offering (a `current`
 *      vence) — revenuecat.ts registra em toda leitura de offerings. Desligar SEM versão nova.
 *   3. a constante abaixo ("on").
 * A chave de QA não tem prefixo varrido ("core-"): sobrevive às vassouras do cache.
 */
export type ModoChave = "on" | "off";
/** ROLLBACK sem RevenueCat = "off" aqui + build. */
export const PAYWALL_MINIMALISTA: ModoChave = "on";

export const CHAVE_REMOTA_PAYWALL_MINIMALISTA = "paywall_minimalista";
export const CHAVE_FORCA_PAYWALL_MINIMALISTA = "paywall-minimalista-force";
export const PARAM_QA_PAYWALL_MINIMALISTA = "paywall-minimalista";

const modoDe = (v: unknown): ModoChave | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

let remota: ModoChave | null = null;

/** Decisão pura: o `paywall_minimalista` do metadata das offerings (a `current` vence as outras). */
export function lerChaveRemotaMinimalista(offerings: unknown): ModoChave | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoChave | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    const m = modoDe(off?.metadata?.[CHAVE_REMOTA_PAYWALL_MINIMALISTA]);
    if (m) lido = m;
  }
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_PAYWALL_MINIMALISTA]) ?? lido;
}

/** revenuecat.ts chama isto com o resultado de cada getOfferings() (registrarChavesDasOfferings). */
export function registrarChavePaywallMinimalista(offerings: unknown): void {
  try { remota = lerChaveRemotaMinimalista(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarRemotaMinimalista = (): void => { remota = null; };

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/** Lê `?paywall-minimalista=on|off|auto` e guarda neste aparelho (o funil muda de passo sem levar a query). */
export function guardarForcaDoMinimalista(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_QA_PAYWALL_MINIMALISTA); } catch { return; }
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_PAYWALL_MINIMALISTA, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_PAYWALL_MINIMALISTA);
}

/** O paywall curto sai minimalista AQUI, agora? força de QA > metadata do RevenueCat > constante. */
export function paywallMinimalistaLigado(): boolean {
  const f = modoDe(ls.get(CHAVE_FORCA_PAYWALL_MINIMALISTA));
  if (f) return f === "on";
  return (remota ?? PAYWALL_MINIMALISTA) === "on";
}
