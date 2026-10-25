import { idDoAparelho } from "@/lib/dia1-cheio";

/**
 * HOME NOVA — OPÇÃO E (1.0.19, 26/10): a Home do carrossel do dia (src/components/home-nova/e), aprovada pelo
 * dono depois de 6 rodadas de mockup (novidades-guardadas/2026-10-25/home-nova/E). Para todo mundo continua a
 * Home de hoje; quem a vê é decidido por uma CHAVE REMOTA, no padrão de `dias23` / `sino_paywall`:
 *
 * `home_nova` na metadata de QUALQUER offering do RevenueCat (a `current` vence):
 *   · "off" (ou ausente, ou RevenueCat que nunca respondeu) → a Home de hoje, byte a byte;
 *   · "admin" → liga SÓ para contas com papel de admin (a mesma checagem do /admin, lib/admin) — é como o dono
 *     testa no TestFlight com os dados reais dele sem mudar nada para os clientes;
 *   · "on" → todos;
 *   · "ab" → sorteio 50/50 determinístico pelo id do aparelho (FNV-1a com sal próprio, como o do sino), estável
 *     entre aberturas; os eventos levam `home_nova: "nova" | "atual"` (camposHomeNova).
 * A última resposta fica no aparelho (`core-home-nova`); o braço sorteado em `core-home-nova-braco`; a resposta
 * da checagem de admin em `core-home-nova-admin` (por conta, pra 2ª abertura não esperar a consulta).
 * QA: `?home-nova=on|off|auto` (guarda em `forcar-home-nova` neste aparelho/navegador; "auto" desfaz).
 *
 * A FORÇA da cor dos módulos (rodada 6 do mockup) mora em SUAVIDADE_HOME_NOVA: "mais" (70 % pro lado da rodada 4,
 * a escolhida) · "suave" (50 %, reserva) · "forte" (v5). Trocar = uma palavra aqui.
 */
export type ModoHomeNova = "off" | "admin" | "on" | "ab";
export type BracoHomeNova = "nova" | "atual";
export type SuavidadeHomeNova = "forte" | "suave" | "mais";

export const CHAVE_REMOTA_HOME_NOVA = "home_nova";
export const CHAVE_HOME_NOVA_APARELHO = "core-home-nova";
export const CHAVE_BRACO_HOME_NOVA = "core-home-nova-braco";
export const CHAVE_ADMIN_HOME_NOVA = "core-home-nova-admin";
/** O dia em que o fogo da pílula já acendeu (o pulso toca 1x por dia). */
export const CHAVE_FOGO_ACESO_HOME_NOVA = "core-home-nova-fogo";
/** Força de QA — fora dos prefixos que as vassouras do cache apagam ("home-" é varrido; lib/chaves-do-aparelho). */
export const CHAVE_FORCA_HOME_NOVA = "forcar-home-nova";
export const PARAM_HOME_NOVA = "home-nova";
/** A barra de vidro pede pra abrir a folha do "+" (a folha mora na Home). */
export const EVENTO_HOME_NOVA_MAIS = "home-nova:mais";

/* O "+" tocado FORA da Home (Conquistas, Você): a barra leva pra Home e a folha tem que abrir ao chegar. Em memória
 * (não no estado da navegação: um state no histórico reabriria a folha ao voltar pra essa entrada). */
let maisPendente = false;
export const pedirMaisNaHome = (): void => { maisPendente = true; };
/** A Home consome o pedido ao montar (1x). */
export const consumirMaisPendente = (): boolean => { const v = maisPendente; maisPendente = false; return v; };
/** ROLLBACK/AJUSTE da força da cor = trocar aqui ("mais" é a aprovada; "suave" a reserva). */
export const SUAVIDADE_HOME_NOVA: SuavidadeHomeNova = "mais";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoHomeNova | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "off" || t === "admin" || t === "on" || t === "ab" ? t : null;
};
const bracoDe = (v: unknown): BracoHomeNova | null => (v === "nova" || v === "atual" ? v : null);

/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoHomeNova | undefined;
/** Em memória: a resposta da checagem de admin desta abertura (null = ainda não sabe / não precisou). */
let adminAtual: boolean | null = null;

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "off". */
export function lerHomeNovaRemoto(offerings: unknown): ModoHomeNova {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoHomeNova | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_HOME_NOVA]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_HOME_NOVA]) ?? lido;
  return lido ?? "off";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarHomeNovaRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    remoto = lerHomeNovaRemoto(offerings);
    ls.set(CHAVE_HOME_NOVA_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarHomeNova = (): void => { remoto = undefined; adminAtual = null; maisPendente = false; };

/** Guarda `?home-nova=` (on|off grava a força; auto desfaz). */
export function guardarForcaHomeNova(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = (p.get(PARAM_HOME_NOVA) ?? "").toLowerCase();
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_HOME_NOVA, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_HOME_NOVA);
}

/** A força de QA deste aparelho, se houver. */
export function forcaHomeNova(): "on" | "off" | null {
  const f = ls.get(CHAVE_FORCA_HOME_NOVA);
  return f === "on" || f === "off" ? f : null;
}

/** O modo AQUI: o que o RevenueCat disse nesta abertura > a última resposta do aparelho > "off". (A força de QA é tratada em homeNovaLigada.) */
export function modoHomeNova(): ModoHomeNova {
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_HOME_NOVA_APARELHO)) ?? "off";
}

/** Sorteio 50/50 determinístico pelo id (FNV-1a 32 bits, sal próprio — não compartilha braço com o sino nem com o dia 1). */
export function sortearBracoHomeNova(id: string): BracoHomeNova {
  let h = 0x811c9dc5;
  const s = `home-nova:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "nova" : "atual";
}

/** O braço deste aparelho no modo "ab" (gravado na 1ª vez, estável entre aberturas). */
export function bracoHomeNova(): BracoHomeNova {
  const gravado = bracoDe(ls.get(CHAVE_BRACO_HOME_NOVA));
  if (gravado) return gravado;
  const sorteado = sortearBracoHomeNova(idDoAparelho());
  ls.set(CHAVE_BRACO_HOME_NOVA, sorteado);
  return sorteado;
}

/** O modo "admin" precisa da checagem de admin (sem força de QA por cima)? */
export const homeNovaPrecisaDeAdmin = (): boolean => forcaHomeNova() === null && modoHomeNova() === "admin";

/** A resposta da checagem de admin guardada neste aparelho PARA ESTA conta (null = nunca checou). */
export function lerAdminGuardado(userId: string | null | undefined): boolean | null {
  if (!userId) return null;
  const v = ls.get(CHAVE_ADMIN_HOME_NOVA);
  if (v === `${userId}:1`) return true;
  if (v === `${userId}:0`) return false;
  return null;
}
export function guardarAdmin(userId: string, ok: boolean): void {
  ls.set(CHAVE_ADMIN_HOME_NOVA, `${userId}:${ok ? "1" : "0"}`);
  adminAtual = ok;
}
/** O hook avisa o que descobriu (pra quem decide sem React: rotas, eventos). */
export const informarAdminHomeNova = (ok: boolean | null): void => { adminAtual = ok; };
export const adminHomeNovaConhecido = (): boolean | null => adminAtual;

/**
 * A decisão: a Home nova está ligada AQUI? força de QA (on|off) > modo remoto:
 * off → não · on → sim · admin → só se `admin` for true · ab → o braço sorteado é "nova".
 */
export function homeNovaLigada(admin: boolean | null): boolean {
  const f = forcaHomeNova();
  if (f) return f === "on";
  const modo = modoHomeNova();
  if (modo === "off") return false;
  if (modo === "on") return true;
  if (modo === "admin") return admin === true;
  return bracoHomeNova() === "nova";
}

/** A mesma decisão sem React (rotas, barra): usa a resposta de admin desta abertura ou a guardada pra conta. */
export function homeNovaLigadaSincrona(userId?: string | null): boolean {
  try { return homeNovaLigada(adminAtual ?? lerAdminGuardado(userId)); } catch { return false; }
}

/** Os campos dos eventos: com a chave em qualquer modo que não "off", qual Home a pessoa vê. */
export function camposHomeNova(userId?: string | null): { home_nova?: BracoHomeNova } {
  try {
    if (forcaHomeNova() === null && modoHomeNova() === "off") return {};
    return { home_nova: homeNovaLigadaSincrona(userId) ? "nova" : "atual" };
  } catch { return {}; }
}
