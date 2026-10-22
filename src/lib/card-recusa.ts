/**
 * CARD DA RECUSA (1.0.18, dono aprovou 22/10).
 *
 * A faixa do cartão recusado teve 33 vistas e 2 toques (6%) desde 18/10. Na 1ª abertura do app depois que o cartão
 * foi RECUSADO na renovação (carência / billing retry), um card de TELA INTEIRA, UMA VEZ POR RECUSA (gravado no
 * aparelho com o billingIssueDetectedAt — reabrir o app nunca repete; uma recusa nova, com outra data, mostra de
 * novo), com dois caminhos:
 *   · "Atualizar meu cartão"          → a forma de pagamento da Apple (apps.apple.com/account/billing; Android: a Play);
 *   · "Mudar pro mensal de R$ 19,90"  → compra core_mensal_19 (offering `mensal_19`, $rc_monthly) — SÓ iPhone e SÓ
 *     se a offering existir (hoje não existe: o produto ainda não foi criado na Apple). Sem ela, só o 1º botão.
 *   · "Agora não" discreto. Depois do card, nesta abertura, segue a faixa de sempre (AvisoCobrancaRecusada).
 *
 * O QUE A APPLE FAZ NO ANUAL → MENSAL DURANTE O BILLING RETRY (pesquisado 22/10):
 *   core_mensal_19 está no MESMO grupo (CORE Pro 22349268) com groupLevel 2, abaixo dos anuais (nível 1) — é
 *   DOWNGRADE (scripts/asc-mensal-19.mjs). Regra da Apple: "Downgrades of any duration or cross-grades with
 *   different durations go into effect at the next renewal date" (StoreKit › Handling Subscriptions Billing) e
 *   "The subscription continues until the next renewal date, then is renewed at the lower level and price"
 *   (developer.apple.com/app-store/subscriptions). Ou seja: a compra NÃO cobra nem libera nada na hora; ela troca
 *   o produto da próxima renovação (auto_renew_product_id / autoRenewPreference → core_mensal_19). Em billing retry
 *   a "próxima renovação" é justamente a cobrança pendente: as próximas tentativas da Apple (até 60 dias) passam a
 *   ser do mensal, R$ 19,90 — que pode passar onde R$ 97,90 não passou (limite). Quando a cobrança entra, o acesso
 *   (e a nova data de cobrança) começa ali. A Apple não documenta o caso "downgrade DURANTE o retry" com todas as
 *   letras → TESTAR EM SANDBOX antes de ligar (ver o relatório da 1.0.18 / roteiro no fim deste comentário).
 *   Por isso o botão diz "Mudar pro mensal", e não "continuar agora": não promete acesso na hora.
 *
 * CHAVE REMOTA `card_recusa` ("on" | "off") na metadata de QUALQUER offering do RevenueCat (a `current` vence), no
 * padrão de `menu_novo`/`att_momento`. PADRÃO: OFF (o dono liga). A última resposta fica no aparelho
 * (`core-card-recusa`) porque o aviso pode ler antes do getOfferings desta abertura responder.
 * QA: `?card-recusa=on|off|auto` grava uma força neste aparelho (vale também no app, como `?cobranca-v14=`);
 * `recomecar` junto (ex.: `?card-recusa=on,recomecar`) apaga a marca de "já vi".
 *
 * Roteiro de sandbox (aparelho real, conta sandbox, iOS 16.4+):
 *   1. assinar core_anual_97 na sandbox; em Ajustes › App Store › Conta Sandbox, ligar "Allow Purchases & Renewals"
 *      = off (ou usar o App Store Connect › Sandbox › "Billing Problem") pra forçar a renovação a falhar;
 *   2. abrir o app: o card aparece 1x (`card_recusa_view`), reabrir não repete;
 *   3. tocar "Mudar pro mensal": a folha da Apple aparece? o que ela diz (preço, data)? o purchasePackage volta
 *      sucesso, "já assinado" (código 6) ou erro? o customerInfo muda o productIdentifier? (esperado: não muda até a
 *      cobrança entrar; o auto_renew_product_id vira core_mensal_19 — conferir no webhook DID_CHANGE_RENEWAL_PREF);
 *   4. religar as compras/limpar o problema: a cobrança que entra é de R$ 19,90 (mensal) ou R$ 97,90 (anual)?
 *   5. "Atualizar meu cartão" abre a página de pagamento da conta.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoCardRecusa = "on" | "off";
/** A constante local. LIGAR/ROLLBACK sem RevenueCat = trocar aqui + build. Padrão OFF (decisão do dono 22/10). */
export const CARD_RECUSA: ModoCardRecusa = "off";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_CARD_RECUSA = "card_recusa";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho). */
export const CHAVE_CARD_RECUSA_APARELHO = "core-card-recusa";
/** A recusa (billingIssueDetectedAt) cujo card já apareceu neste aparelho (chave do aparelho). */
export const CHAVE_CARD_RECUSA_VISTO = "core-card-recusa-visto";
/** QUANDO (ms) o card apareceu pela última vez (chave do aparelho) — o 2º degrau (lib/mensal-degraus) espera 7 dias. */
export const CHAVE_CARD_RECUSA_VISTO_EM = "core-card-recusa-visto-em";
/** Força de QA (fora dos prefixos varridos). */
export const CHAVE_FORCA_CARD_RECUSA = "card-recusa-force";
export const PARAM_CARD_RECUSA = "card-recusa";

let remoto: ModoCardRecusa | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoCardRecusa | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" ? t : null;
};

/** Decisão pura: a chave em qualquer offering (a `current` vence); null = nenhuma offering disse. */
export function lerCardRecusaRemoto(offerings: unknown): ModoCardRecusa | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoCardRecusa | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_CARD_RECUSA]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_CARD_RECUSA]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarCardRecusaRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerCardRecusaRemoto(offerings);
    // a chave sumiu da metadata = volta pro padrão (off), e a cópia do aparelho também
    remoto = lido ?? CARD_RECUSA;
    if (lido) ls.set(CHAVE_CARD_RECUSA_APARELHO, lido);
    else ls.del(CHAVE_CARD_RECUSA_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarCardRecusaRemoto = (): void => { remoto = undefined; };

/** Grava `?card-recusa=on|off|auto[,recomecar]` deste aparelho. */
export function guardarForcaCardRecusa(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_CARD_RECUSA);
  } catch { return; }
  if (v === null) return;
  const partes = v.toLowerCase().split(",").map((s) => s.trim());
  if (partes.includes("recomecar")) ls.del(CHAVE_CARD_RECUSA_VISTO);
  if (partes.includes("on")) ls.set(CHAVE_FORCA_CARD_RECUSA, "on");
  else if (partes.includes("off")) ls.set(CHAVE_FORCA_CARD_RECUSA, "off");
  else if (partes.includes("auto")) ls.del(CHAVE_FORCA_CARD_RECUSA);
}

/** O modo que vale AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > constante (off). */
export function modoCardRecusa(): ModoCardRecusa {
  const f = modoDe(ls.get(CHAVE_FORCA_CARD_RECUSA));
  if (f) return f;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_CARD_RECUSA_APARELHO)) ?? CARD_RECUSA;
}
export const cardRecusaLigado = (): boolean => isNativeShell() && modoCardRecusa() === "on";

/* ─── 1x por recusa ─── */
/** A marca de uma recusa: o billingIssueDetectedAt (cada recusa nova tem outra data). */
export const marcaDaRecusa = (detectadoEm: string | null | undefined): string => detectadoEm || "sem-data";
export const cardRecusaJaVisto = (detectadoEm: string | null | undefined): boolean =>
  ls.get(CHAVE_CARD_RECUSA_VISTO) === marcaDaRecusa(detectadoEm);
/** Gravado na hora em que o card APARECE: fechar o app com o card na tela não o repete. */
export const marcarCardRecusaVisto = (detectadoEm: string | null | undefined, agora: number = Date.now()): void => {
  ls.set(CHAVE_CARD_RECUSA_VISTO, marcaDaRecusa(detectadoEm));
  ls.set(CHAVE_CARD_RECUSA_VISTO_EM, String(agora));
};
