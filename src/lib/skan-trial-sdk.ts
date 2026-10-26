/**
 * CHAVE REMOTA `skan_trial_sdk` (varredura 26/10, decisão do dono: opção A) — o "Iniciar teste" pelo SDK da Meta no iPhone
 * (lib/meta-inicio-teste-ios, 1.0.19) fica ATRÁS desta chave.
 *
 * Por quê: o SDK manda StartTrial com event_id = id da transação da Apple, e o servidor (meta-backfill-app, CAPI)
 * manda o MESMO início de teste com outro event_id ("sub…" do RevenueCat) — a Meta conta 2 por pessoa e o custo por
 * teste parece metade do real. Até o servidor casar o event_id (META_STARTTRIAL_ID_DA_LOJA + deploy do backfill), o
 * SDK fica DESLIGADO: o app se comporta como a 1.0.18 nesse ponto (nenhum StartTrial pelo aparelho, nenhum evento).
 *
 * Na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de `card_recusa`:
 *   · "on"                                        → o SDK manda o StartTrial (1x por transação, como na 1.0.19);
 *   · "off", ausente, lixo, RevenueCat sem resposta → desligado (padrão).
 * A última resposta fica no aparelho (`core-skan-trial-sdk`) — a compra pode acontecer antes do getOfferings desta
 * abertura responder; se a chave some da metadata, a cópia do aparelho também some (volta pro padrão).
 *
 * QA: `?skan-trial-sdk=on|off|auto` (guarda neste aparelho, fora dos prefixos que as vassouras apagam).
 */
export type ModoSkanTrialSdk = "on" | "off";
/** O padrão sem resposta / sem a chave. LIGAR sem RevenueCat = trocar aqui + build. */
export const SKAN_TRIAL_SDK: ModoSkanTrialSdk = "off";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_SKAN_TRIAL_SDK = "skan_trial_sdk";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho — lib/chaves-do-aparelho). */
export const CHAVE_SKAN_TRIAL_SDK_APARELHO = "core-skan-trial-sdk";
/** Força de QA. */
export const CHAVE_FORCA_SKAN_TRIAL_SDK = "skan-trial-sdk-force";
export const PARAM_SKAN_TRIAL_SDK = "skan-trial-sdk";

let remoto: ModoSkanTrialSdk | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoSkanTrialSdk | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" ? t : null;
};

/** Decisão pura: a chave em qualquer offering (a `current` vence); null = nenhuma offering disse. */
export function lerSkanTrialSdkRemoto(offerings: unknown): ModoSkanTrialSdk | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoSkanTrialSdk | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_SKAN_TRIAL_SDK]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_SKAN_TRIAL_SDK]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarSkanTrialSdkRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerSkanTrialSdkRemoto(offerings);
    remoto = lido ?? SKAN_TRIAL_SDK;
    if (lido) ls.set(CHAVE_SKAN_TRIAL_SDK_APARELHO, lido);
    else ls.del(CHAVE_SKAN_TRIAL_SDK_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}

/** Guarda `?skan-trial-sdk=on|off|auto` (QA). */
export function guardarForcaSkanTrialSdk(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_SKAN_TRIAL_SDK); } catch { return; }
  const t = (v ?? "").toLowerCase();
  if (modoDe(t)) ls.set(CHAVE_FORCA_SKAN_TRIAL_SDK, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_SKAN_TRIAL_SDK);
}

/** O modo que vale AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > padrão (off). */
export function modoSkanTrialSdk(): ModoSkanTrialSdk {
  return modoDe(ls.get(CHAVE_FORCA_SKAN_TRIAL_SDK)) ?? remoto ?? modoDe(ls.get(CHAVE_SKAN_TRIAL_SDK_APARELHO)) ?? SKAN_TRIAL_SDK;
}
export const skanTrialSdkLigado = (): boolean => modoSkanTrialSdk() === "on";

/** Só testes. */
export const _zerarSkanTrialSdkRemoto = (): void => { remoto = undefined; };
