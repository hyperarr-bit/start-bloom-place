import { idDoAparelho } from "@/lib/dia1-cheio";
import { isIOS, isNativeShell } from "@/lib/native-shell";

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
 * 12/11 noite (dono): SÓ o iPhone. No Android (e no site) é sempre "on" = o paywall de hoje (vitalício 97,90 + mensal
 * 24,90 e o resgate de hoje), qualquer que seja a chave. A última resposta fica no aparelho (`core-paywall-teste`): reabrir o app antes de o
 * RevenueCat responder mostra o mesmo paywall da última vez. QA: `?paywall-teste=on|off|auto`.
 */

/** Os produtos NOVOS (outra frente cria na Apple/Play/RevenueCat). Um lugar só: trocar aqui troca o app inteiro. */
export const PRODUTOS_SEM_TESTE = {
  /** 12/11 noite (dono): o anual sem teste é R$ 97,90 (não 99,90). NUNCA o core_anual_97 — ele tem 3 dias grátis presos
   *  no produto. O core_anual_99 sai do app (o produto continua na loja). */
  anual: "core_anual_97_direto",
  mensal: "core_mensal_34",
  /** o presente de saída: 69,90/ano SEM oferta introdutória (cobra na hora) */
  presente: "core_anual_69_direto",
  /** 12/11 (dono, A/B `paywall_oferta`, só iPhone): o plano grande do braço "vitalicio" — R$ 97,90, pagamento único
   *  (NON_CONSUMABLE na Apple, o mesmo produto do Android). Pacote `vitalicio` da offering `sem_teste`. */
  vitalicio: "core_vitalicio_97",
} as const;
export type PlanoSemTeste = keyof typeof PRODUTOS_SEM_TESTE;
/** 12/11 (dono): o mensal com renovação do ANDROID (funil, gate, /planos) = o mesmo core_mensal_34, pelo plano-base da Play. */
export const ID_MENSAL_ANDROID = `${PRODUTOS_SEM_TESTE.mensal}:coremensal34` as const;

/** A offering do RevenueCat onde os três moram (procurada primeiro; depois qualquer offering; depois a loja direto). */
export const OFFERING_SEM_TESTE = "sem_teste";

/** RESERVA de texto enquanto a loja não respondeu — o preço de verdade é sempre o priceString da loja. */
export const PRECOS_RESERVA_SEM_TESTE: Record<PlanoSemTeste, { preco: string; valor: number }> = {
  anual: { preco: "R$ 97,90", valor: 97.9 },
  mensal: { preco: "R$ 34,90", valor: 34.9 },
  presente: { preco: "R$ 69,90", valor: 69.9 },
  vitalicio: { preco: "R$ 97,90", valor: 97.9 },
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
    registrarPaywallVisualRemoto(offerings);
    registrarPaywallOfertaRemota(offerings);
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

/** O app do iPhone? (12/11 noite, dono: o Android — e o site — ficam EXATAMENTE como hoje: o paywall sem teste é só do iPhone.) */
const noIphone = (): boolean => { try { return isNativeShell() && isIOS(); } catch { return false; } };

/** O modo que vale AQUI: fora do iPhone "on" (o de hoje, sempre) > força de QA > RevenueCat desta abertura > última
 *  resposta do aparelho > padrão ("off"). */
export function modoPaywallTeste(): ModoPaywallTeste {
  // só testes: o setup da suíte fixa "on" (o paywall de hoje); os testes da chave apagam o global
  const g = modoDe((globalThis as { __PAYWALL_TESTE__?: unknown }).__PAYWALL_TESTE__);
  if (g) return g;
  if (!noIphone()) return "on";
  const f = modoDe(ls.get(CHAVE_FORCA_PAYWALL_TESTE));
  if (f) return f;
  if (remota) return remota;
  return modoDe(ls.get(CHAVE_PAYWALL_TESTE_APARELHO)) ?? PAYWALL_TESTE_PADRAO;
}

/** O app nativo mostra o paywall COM teste (o de hoje)? false = o paywall novo, sem teste. */
export const paywallComTeste = (): boolean => modoPaywallTeste() === "on";

/* ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * A/B DO VISUAL DO PAYWALL SEM TESTE (12/11 noite, dono) — SÓ no iPhone. Os dois braços vendem o mesmo: anual 97,90
 * (core_anual_97_direto), mensal 34,90 e o presente 69,90 na saída, tudo sem teste.
 *   · "android"  = o desenho do paywall do Android (PaywallW, modo semTeste);
 *   · "enxovaly" = o PaywallSemTeste (foto no topo, estrutura da Enxovaly).
 * CHAVE REMOTA `paywall_visual` na metadata de qualquer offering (a `current` vence): "android" | "enxovaly" | "ab".
 * Padrão (sem a chave) = "android" desde 12/11 (antes "ab"). Com "ab": sorteio 50/50 estável por aparelho (FNV-1a do id do aparelho, sal "paywall-visual:"),
 * gravado em `core-paywall-visual-braco`. No Android é sempre "android" (lá o paywall sem teste nem aparece).
 * QA: `?paywall-visual=android|enxovaly|auto` (grava em `paywall-visual-force`, fora dos prefixos varridos).
 * Todo evento dos dois paywalls leva `paywall_visual`.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export type VisualPaywall = "android" | "enxovaly";
export type ModoPaywallVisual = VisualPaywall | "ab";
export const CHAVE_REMOTA_PAYWALL_VISUAL = "paywall_visual";
/** A última resposta do RevenueCat pro modo (chave do aparelho). */
export const CHAVE_PAYWALL_VISUAL_APARELHO = "core-paywall-visual";
/** O braço sorteado neste aparelho (chave do aparelho; estável entre aberturas). */
export const CHAVE_PAYWALL_VISUAL_BRACO = "core-paywall-visual-braco";
export const CHAVE_FORCA_PAYWALL_VISUAL = "paywall-visual-force";
export const PARAM_PAYWALL_VISUAL = "paywall-visual";
/** 12/11 (dono): o A/B do visual ACABOU — todo iPhone vê o desenho do Android. A chave continua pra trocar pelo
 *  RevenueCat ("enxovaly" ou "ab" voltam o outro desenho / o sorteio). O A/B agora é da OFERTA (`paywall_oferta`). */
export const PAYWALL_VISUAL_PADRAO: ModoPaywallVisual = "android";

const visualDe = (v: unknown): VisualPaywall | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "android" || s === "enxovaly" ? s : null;
};
const modoVisualDe = (v: unknown): ModoPaywallVisual | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "ab" ? "ab" : visualDe(s);
};

let remotaVisual: ModoPaywallVisual | null = null;

/** Decisão pura: o `paywall_visual` das offerings (a `current` vence); null = ninguém disse. */
export function lerChaveRemotaPaywallVisual(offerings: unknown): ModoPaywallVisual | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoPaywallVisual | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    lido = modoVisualDe(off?.metadata?.[CHAVE_REMOTA_PAYWALL_VISUAL]) ?? lido;
  }
  return modoVisualDe(o?.current?.metadata?.[CHAVE_REMOTA_PAYWALL_VISUAL]) ?? lido;
}

/** Chamado junto do registrarPaywallTesteRemoto (cada getOfferings que respondeu). Só iPhone. Sem a chave = "ab". */
export function registrarPaywallVisualRemoto(offerings: unknown): void {
  try {
    if (!noIphone() || !offerings || typeof offerings !== "object") return;
    remotaVisual = lerChaveRemotaPaywallVisual(offerings) ?? PAYWALL_VISUAL_PADRAO;
    ls.set(CHAVE_PAYWALL_VISUAL_APARELHO, remotaVisual);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarPaywallVisual = (): void => { remotaVisual = null; };

/** Guarda `?paywall-visual=android|enxovaly|auto` (QA) neste aparelho. */
export function guardarForcaPaywallVisual(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_PAYWALL_VISUAL); } catch { return; }
  const t = (v ?? "").trim().toLowerCase();
  if (visualDe(t)) ls.set(CHAVE_FORCA_PAYWALL_VISUAL, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_PAYWALL_VISUAL);
}

/** Sorteio determinístico pelo id do aparelho (FNV-1a 32 bits, sal próprio "paywall-visual:"): 50/50. */
export function sortearVisualPaywall(id: string): VisualPaywall {
  let h = 0x811c9dc5;
  const s = `paywall-visual:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 8) % 2) === 0 ? "android" : "enxovaly";
}

/** O braço deste aparelho: Android/site = "android" · força de QA > RevenueCat (fixo) > aparelho (fixo) > sorteio gravado. */
export function visualDoPaywall(): VisualPaywall {
  if (!noIphone()) return "android";
  guardarForcaPaywallVisual();
  const f = visualDe(ls.get(CHAVE_FORCA_PAYWALL_VISUAL));
  if (f) return f;
  const m = remotaVisual ?? modoVisualDe(ls.get(CHAVE_PAYWALL_VISUAL_APARELHO)) ?? PAYWALL_VISUAL_PADRAO;
  if (m !== "ab") return m;
  const gravado = visualDe(ls.get(CHAVE_PAYWALL_VISUAL_BRACO));
  if (gravado) return gravado;
  const sorteado = sortearVisualPaywall(idDoAparelho());
  ls.set(CHAVE_PAYWALL_VISUAL_BRACO, sorteado);
  return sorteado;
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * A/B DA OFERTA DO PAYWALL SEM TESTE (12/11, dono) — SÓ no iPhone. O visual é o mesmo nos dois braços (o desenho do
 * Android, PaywallW semTeste — funil, gate e "Ver planos"); muda só o plano grande:
 *   · "anual"     = anual R$ 97,90/ano (core_anual_97_direto), "R$ 8,16/mês · Economize 77%";
 *   · "vitalicio" = vitalício R$ 97,90, pagamento único (core_vitalicio_97, NON_CONSUMABLE na Apple), como o Android.
 * Nos dois: mensal 34,90 (core_mensal_34) e, na saída, o presente 69,90/ano (core_anual_69_direto) — o mesmo, pra
 * comparar só o plano grande.
 * CHAVE REMOTA `paywall_oferta` na metadata de qualquer offering do RevenueCat (a `current` vence): "anual" |
 * "vitalicio" | "ab". Padrão (sem a chave) = "ab": sorteio 50/50 estável por aparelho (FNV-1a do id do aparelho, sal
 * "paywall-oferta:"), gravado em `core-paywall-oferta-braco`.
 * PÔR O VENCEDOR EM 100% SEM BUILD: `paywall_oferta` = "anual" ou "vitalicio" — a chave remota (desta abertura, ou a
 * última gravada no aparelho) vence o braço sorteado e gravado (o braço gravado fica guardado, só não manda mais).
 * Quem já comprou não vê paywall, então não é afetado.
 * QA: `?paywall-oferta=anual|vitalicio|auto` (grava em `paywall-oferta-force`, fora dos prefixos varridos).
 * Fora do iPhone: sempre "anual", sem sortear nem gravar nada — no Android a chave não vale (lá o vitalício é de sempre).
 * Todo evento do paywall, da folha e da compra leva `paywall_oferta`.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export type OfertaPaywall = "anual" | "vitalicio";
export type ModoPaywallOferta = OfertaPaywall | "ab";
export const CHAVE_REMOTA_PAYWALL_OFERTA = "paywall_oferta";
/** A última resposta do RevenueCat pro modo (chave do aparelho). */
export const CHAVE_PAYWALL_OFERTA_APARELHO = "core-paywall-oferta";
/** O braço sorteado neste aparelho (chave do aparelho; estável entre aberturas). */
export const CHAVE_PAYWALL_OFERTA_BRACO = "core-paywall-oferta-braco";
export const CHAVE_FORCA_PAYWALL_OFERTA = "paywall-oferta-force";
export const PARAM_PAYWALL_OFERTA = "paywall-oferta";
export const PAYWALL_OFERTA_PADRAO: ModoPaywallOferta = "ab";

const ofertaDe = (v: unknown): OfertaPaywall | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "anual" || s === "vitalicio" ? s : s === "vitalício" ? "vitalicio" : null;
};
const modoOfertaDe = (v: unknown): ModoPaywallOferta | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "ab" ? "ab" : ofertaDe(s);
};

let remotaOferta: ModoPaywallOferta | null = null;

/** Decisão pura: o `paywall_oferta` das offerings (a `current` vence); null = ninguém disse. */
export function lerChaveRemotaPaywallOferta(offerings: unknown): ModoPaywallOferta | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoPaywallOferta | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    lido = modoOfertaDe(off?.metadata?.[CHAVE_REMOTA_PAYWALL_OFERTA]) ?? lido;
  }
  return modoOfertaDe(o?.current?.metadata?.[CHAVE_REMOTA_PAYWALL_OFERTA]) ?? lido;
}

/** Chamado junto do registrarPaywallTesteRemoto (cada getOfferings que respondeu). Só iPhone. Sem a chave = "ab". */
export function registrarPaywallOfertaRemota(offerings: unknown): void {
  try {
    if (!noIphone() || !offerings || typeof offerings !== "object") return;
    remotaOferta = lerChaveRemotaPaywallOferta(offerings) ?? PAYWALL_OFERTA_PADRAO;
    ls.set(CHAVE_PAYWALL_OFERTA_APARELHO, remotaOferta);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarPaywallOferta = (): void => { remotaOferta = null; };

/** Guarda `?paywall-oferta=anual|vitalicio|auto` (QA) neste aparelho. */
export function guardarForcaPaywallOferta(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_PAYWALL_OFERTA); } catch { return; }
  const t = (v ?? "").trim().toLowerCase();
  const o = ofertaDe(t);
  if (o) ls.set(CHAVE_FORCA_PAYWALL_OFERTA, o);
  else if (t === "auto") ls.del(CHAVE_FORCA_PAYWALL_OFERTA);
}

/** Sorteio determinístico pelo id do aparelho (FNV-1a 32 bits, sal próprio "paywall-oferta:"): 50/50. */
export function sortearOfertaPaywall(id: string): OfertaPaywall {
  let h = 0x811c9dc5;
  const s = `paywall-oferta:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 8) % 2) === 0 ? "anual" : "vitalicio";
}

/** O braço deste aparelho: fora do iPhone = "anual" · força de QA > RevenueCat (fixo) > última resposta do aparelho
 *  (fixo) > sorteio gravado. */
export function ofertaDoPaywall(): OfertaPaywall {
  if (!noIphone()) return "anual";
  guardarForcaPaywallOferta();
  const f = ofertaDe(ls.get(CHAVE_FORCA_PAYWALL_OFERTA));
  if (f) return f;
  const m = remotaOferta ?? modoOfertaDe(ls.get(CHAVE_PAYWALL_OFERTA_APARELHO)) ?? PAYWALL_OFERTA_PADRAO;
  if (m !== "ab") return m;
  const gravado = ofertaDe(ls.get(CHAVE_PAYWALL_OFERTA_BRACO));
  if (gravado) return gravado;
  const sorteado = sortearOfertaPaywall(idDoAparelho());
  ls.set(CHAVE_PAYWALL_OFERTA_BRACO, sorteado);
  return sorteado;
}

/* `folha_apple_resultado` e os eventos da compra nascem no revenuecat.ts, sem saber de paywall: o paywall sem teste
 * anota aqui o braço em exposição (null ao sair). */
let ofertaDaFolha: OfertaPaywall | null = null;
export const anotarOfertaDaFolha = (o: OfertaPaywall | null): void => { ofertaDaFolha = o; };
export const camposDaOfertaNaFolha = (): { paywall_oferta?: OfertaPaywall } => (ofertaDaFolha ? { paywall_oferta: ofertaDaFolha } : {});
