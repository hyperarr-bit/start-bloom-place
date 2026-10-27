/**
 * DIA 1 CHEIO + PLANO DE AMANHÃ (10/10/2026, pra 1.0.14) — a chave e o braço.
 *
 * O dado (iPhone, 10/10): ~50% dos testes não voltam depois da 1ª hora e só
 * 12,6% deles pagam; quem volta no dia 2 paga 39–44% × 15–17%; quem paga usa
 * 2–3 módulos (quem sai, 1). A Missão em doses da 1.0.10 entrega 1 módulo por
 * dia (~40 s) — metade nunca vê o 2º módulo.
 *
 * O TESTE (só pra conta nova no app das lojas, sorteio 50/50 local):
 *   · Braço A = a missão em doses da 1.0.10, como está (nada muda).
 *   · Braço B = as 3 doses liberadas no dia 1, em sequência: ao concluir uma,
 *     "Bora a próxima? 20 s" + "Agora não". Os dias 2 e 3 viram "aprofundar"
 *     (1 uso real por módulo já visto). "Agora não" no meio → notificação local
 *     de +3 h ("Sua próxima dose de 20 s está pronta"), na faixa da missão.
 *   · PLANO DE AMANHÃ (B): no fim da 1ª sessão (≥1 dose ou "Agora não"), uma
 *     folha só com chips — "Quando você abre o CORE amanhã?" (manhã / almoço /
 *     noite) + "com o quê?" (café / almoço / antes de dormir, opcional). Isso é
 *     a hora do Lembrete do dia 2 (lib/lembrete-dia2), com conteúdo concreto do
 *     que a pessoa fez ("Ontem você anotou 1 gasto — 20 s pra anotar o de hoje").
 *     A permissão de notificação é pedida AÍ, ligada ao plano (uma vez).
 *
 * MÉTRICA PRINCIPAL: % dos testes que voltam entre 20 e 48 h (meta 25% → 32%),
 * lida por `variante` nos eventos da missão (missao_dose_concluida,
 * missao_completa, missao_agora_nao, plano_amanha_definido e os
 * `missao_doses_*` de sempre, que também ganham `variante` com a chave ligada).
 *
 * A CHAVE TEM 3 VALORES (dono 10/10: "dia 1 cheio pra TODO MUNDO, sem 50/50"):
 *   · "off" — a missão de hoje, byte a byte (nenhum braço sorteado, nenhum campo
 *     `variante`, nenhum evento novo — travado em src/test/dia1-cheio.test.tsx);
 *   · "ab"  — o teste 50/50 acima (braço em `core-dia1-braco`, sorteio pelo id);
 *   · "on"  — TODO MUNDO no braço B, sem sorteio. `variante: "B"` continua nos
 *     eventos — é por ela que a turma da 1.0.14 se lê contra as turmas da 1.0.10.
 * Padrão "off". A missão guarda uma cópia do braço (`braco`) pra sobreviver ao logout.
 *
 * QA pelo link: `?dia1-cheio=on|ab|off|auto`; `?dia1-cheio=a|b` liga o 50/50 E
 * força o braço (apaga o sorteio deste aparelho). Na build `VITE_V14_QA=1`
 * (lib/v14-qa) a chave vale "on".
 *
 * ─── 1.0.16 (16/10) — MISSÃO 1 POR DIA × DIA 1 CHEIO, pelo RevenueCat ───────────────────────
 * O dado (682 testes): metade dos cancelamentos sai nas primeiras 24 h, 90% até 48 h; quem usa
 * o app em 3 dias diferentes paga 38% × 15% de quem usa 1 dia. Na 1.0.14/1.0.15 (build de loja
 * VITE_V14_LOJA=1 → modo "on" = TODO MUNDO no braço B) a missão fecha no dia 1 pra 54 de 55
 * pessoas (as 3 doses em ~10 min) e 47% nunca reabrem. O teste da 1.0.16:
 *   · Braço A = UMA DOSE POR DIA: dose 1 hoje (+ "amanhã · <módulo> · te lembro às…", que é o
 *     plano de amanhã do A e a hora do Lembrete do dia 2); a dose 2 só abre AMANHÃ e a 3 depois
 *     (`doseLiberadaHoje`): sem "Quero fazer o toque de amanhã agora". Quem reabre num dia novo
 *     encontra a dose do dia (o convite "Dia N da missão" na Home, 1x por dia, e o passo ao
 *     entrar no módulo; o toque no Lembrete do dia 2 abre o módulo da dose).
 *   · Braço B = o de hoje (as 3 doses no dia 1 + "Arrumar sua Home"; dias 2–3 "aprofundar").
 *
 * QUEM LIGA: a metadata `missao_1_por_dia` em QUALQUER offering do RevenueCat (a `current`
 * vence), SÓ NO iPHONE:
 *   · ausente / "off" → o de hoje (modo da build: "on" na loja = todos no B);
 *   · "ab"            → 50/50 pelo id do aparelho (sortearBraco), gravado em `core-dia1-braco`;
 *   · "on"            → TODO MUNDO no braço A (uma por dia).
 * RevenueCat inalcançável e nunca respondido neste aparelho → o de hoje. A última resposta do
 * RevenueCat fica no aparelho (`core-missao-1-por-dia`, chave do aparelho) — a missão nasce na
 * 1ª Home, às vezes antes do getOfferings da abertura responder; sem a cópia, essa pessoa caía
 * no B fora do sorteio. O braço é da MISSÃO (`missao.braco`): desligar a metadata no meio não
 * muda o braço de quem já começou — só de quem começa depois.
 * Eventos: `variante` ("A"/"B", como desde a 1.0.14) + `braco` ("um_por_dia" | "dia1_cheio")
 * + `missao_1_por_dia` (o modo remoto que valia quando o evento saiu) — eventoDaMissao.
 */
import { localDayKey } from "@/lib/utils";
import { v14Ligada } from "@/lib/v14-qa";
import { modo1012 } from "@/lib/modo-1012";
import { plataformaApp } from "@/lib/native-shell";

export type ModoDia1Cheio = "off" | "ab" | "on";
export const DIA1_CHEIO: ModoDia1Cheio = "off";

export type BracoDia1 = "A" | "B";
export const CHAVE_BRACO_DIA1 = "core-dia1-braco";
export const PARAM_DIA1_CHEIO = "dia1-cheio";
export const CHAVE_FORCA_DIA1_CHEIO = "dia1-cheio-force";
/** O identificador local do aparelho que o sorteio usa quando não há `device_id` gravado. */
export const CHAVE_ID_LOCAL = "core-device-id";
/** Chaves onde um id de aparelho já pode existir (de outras frentes) — a primeira que tiver valor manda. */
const CHAVES_DEVICE_ID = ["device_id", "core_device_id", CHAVE_ID_LOCAL];

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export function guardarForcaDia1Cheio(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try {
    p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
  } catch { return; }
  const v = (p.get(PARAM_DIA1_CHEIO) ?? "").toLowerCase();
  if (v === "on" || v === "off" || v === "ab") ls.set(CHAVE_FORCA_DIA1_CHEIO, v);
  else if (v === "auto") { ls.del(CHAVE_FORCA_DIA1_CHEIO); }
  else if (v === "a" || v === "b") { ls.set(CHAVE_FORCA_DIA1_CHEIO, "ab"); ls.set(CHAVE_BRACO_DIA1, v.toUpperCase()); }
}

export const forcaDia1Cheio = (): ModoDia1Cheio | null => {
  const f = ls.get(CHAVE_FORCA_DIA1_CHEIO);
  return f === "on" || f === "off" || f === "ab" ? f : null;
};

/* ───────────── 1.0.16: a chave remota `missao_1_por_dia` (RevenueCat) ───────────── */

export type ModoUmPorDia = "off" | "ab" | "on";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_UM_POR_DIA = "missao_1_por_dia";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho: sobrevive à abertura e ao logout). */
export const CHAVE_UM_POR_DIA_APARELHO = "core-missao-1-por-dia";
/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let umPorDiaRemoto: ModoUmPorDia | undefined;

const modoUmPorDiaDe = (v: unknown): ModoUmPorDia | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "ab" || t === "off" ? t : null;
};

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente em todas = "off" (o de hoje). */
export function lerUmPorDiaRemoto(offerings: unknown): ModoUmPorDia {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoUmPorDia | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoUmPorDiaDe(off?.metadata?.[CHAVE_REMOTA_UM_POR_DIA]) ?? lido;
  lido = modoUmPorDiaDe(o?.current?.metadata?.[CHAVE_REMOTA_UM_POR_DIA]) ?? lido;
  return lido ?? "off";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu. */
export function registrarUmPorDiaRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return; // não respondeu de verdade: fica como estava
    umPorDiaRemoto = lerUmPorDiaRemoto(offerings);
    ls.set(CHAVE_UM_POR_DIA_APARELHO, umPorDiaRemoto);
    tourHomeRemoto = lerTourHomeRemoto(offerings);
    if (tourHomeRemoto) ls.set(CHAVE_TOUR_HOME_APARELHO, tourHomeRemoto); else ls.del(CHAVE_TOUR_HOME_APARELHO);
    tourQuandoRemoto = lerTourQuandoRemoto(offerings);
    if (tourQuandoRemoto) ls.set(CHAVE_TOUR_QUANDO_APARELHO, tourQuandoRemoto); else ls.del(CHAVE_TOUR_QUANDO_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarUmPorDiaRemoto = (): void => { umPorDiaRemoto = undefined; tourHomeRemoto = undefined; tourQuandoRemoto = undefined; };

/* ───────────── 1.0.17: `tour_home_quando` (RevenueCat) — QUANDO o tour curto entra ───────────── */
/**
 * Decisão do dono (19/10): o tour curto fica no DIA 1, mas nunca colado na festa — festa → passagem calma → a Home
 * parada ~1,5 s sem outra camada → o tour; o "Plano de amanhã" só depois dele (uma camada por vez). A hora vai por
 * chave REMOTA, pra comparar as turmas:
 *   · "dia1" (ou ausente) → no dia 1, depois da dose e do respiro;
 *   · "dia2" → nunca no dia 1: num dia seguinte, depois da dose daquele dia.
 * Lida em qualquer offering (a `current` vence), como `tour_home`; a última resposta fica no aparelho
 * (`core-tour-home-quando`). Vai nos eventos do tour e da missão como `tour_quando`.
 */
export type QuandoTourHome = "dia1" | "dia2";
export const CHAVE_REMOTA_TOUR_QUANDO = "tour_home_quando";
export const CHAVE_TOUR_QUANDO_APARELHO = "core-tour-home-quando";
let tourQuandoRemoto: QuandoTourHome | null | undefined;
const quandoTourDe = (v: unknown): QuandoTourHome | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "dia1" || t === "dia2" ? t : null;
};
export function lerTourQuandoRemoto(offerings: unknown): QuandoTourHome | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: QuandoTourHome | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = quandoTourDe(off?.metadata?.[CHAVE_REMOTA_TOUR_QUANDO]) ?? lido;
  return quandoTourDe(o?.current?.metadata?.[CHAVE_REMOTA_TOUR_QUANDO]) ?? lido;
}
/** Quando o tour curto entra AQUI: o que o RevenueCat disse nesta abertura, senão a última resposta do aparelho, senão "dia1". */
export function tourHomeQuando(): QuandoTourHome {
  if (tourQuandoRemoto) return tourQuandoRemoto;
  if (tourQuandoRemoto === null) return "dia1";
  return quandoTourDe(ls.get(CHAVE_TOUR_QUANDO_APARELHO)) ?? "dia1";
}

/* ───────────── 1.0.16: `tour_home` (RevenueCat) — qual tour da Home ───────────── */
/**
 * `tour_home` em qualquer offering (a `current` vence), só iPhone:
 *   · "curto" → o tour de 3 passos "faz isso" (o do braço A) pra todo mundo;
 *   · "longo" → o tour de 5 passos da 1.0.14/1.0.15 (o do braço B) pra todo mundo;
 *   · "off"   → nenhum tour;
 *   · ausente → SEGUE O BRAÇO (A = curto, B/sem braço = longo). Ver tour-home.varianteDoTour.
 * A última resposta fica no aparelho (`core-tour-home-remoto`), como a do `missao_1_por_dia`.
 */
export type ModoTourHome = "curto" | "longo" | "off";
export const CHAVE_REMOTA_TOUR_HOME = "tour_home";
export const CHAVE_TOUR_HOME_APARELHO = "core-tour-home-remoto";
let tourHomeRemoto: ModoTourHome | null | undefined;
const modoTourDe = (v: unknown): ModoTourHome | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "curto" || t === "longo" || t === "off" ? t : null;
};
export function lerTourHomeRemoto(offerings: unknown): ModoTourHome | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoTourHome | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoTourDe(off?.metadata?.[CHAVE_REMOTA_TOUR_HOME]) ?? lido;
  return modoTourDe(o?.current?.metadata?.[CHAVE_REMOTA_TOUR_HOME]) ?? lido;
}
/** O que o RevenueCat disse sobre o tour (null = nada: segue o braço). Só iPhone. */
export function modoTourHomeRemoto(): ModoTourHome | null {
  if (plataformaApp() !== "ios") return null;
  if (tourHomeRemoto !== undefined) return tourHomeRemoto;
  return modoTourDe(ls.get(CHAVE_TOUR_HOME_APARELHO));
}

/**
 * O modo do teste "1 por dia" AQUI: só no app do iPhone; o que o RevenueCat disse nesta abertura,
 * senão a última resposta guardada no aparelho, senão "off" (RevenueCat nunca respondeu = o de hoje).
 */
export function modoUmPorDia(): ModoUmPorDia {
  if (modo1012()) return "on"; // 1.0.21 modo 1.0.12: UMA dose por dia pra todo mundo (a metadata não muda)
  if (plataformaApp() !== "ios") return "off";
  if (umPorDiaRemoto) return umPorDiaRemoto;
  return modoUmPorDiaDe(ls.get(CHAVE_UM_POR_DIA_APARELHO)) ?? "off";
}

/** O modo que vale AQUI: força de QA > metadata `missao_1_por_dia` ("ab"/"on") > build de QA/loja (→ "on") > constante. */
export function modoDia1Cheio(modo: ModoDia1Cheio = DIA1_CHEIO): ModoDia1Cheio {
  if (modo1012()) return "ab"; // 1.0.21 modo 1.0.12: o teste ligado com o braço A fixo (bracoFixo)
  const f = forcaDia1Cheio();
  if (f) return f;
  // 1.0.16: o teste remoto liga o sorteio (ou, em "on", o braço A pra todos — bracoFixo)
  if (modoUmPorDia() !== "off") return "ab";
  if (v14Ligada()) return "on";
  return modo;
}

/** O teste está ligado AQUI ("ab" ou "on")? */
export function dia1CheioLigado(modo: ModoDia1Cheio = DIA1_CHEIO): boolean {
  return modoDia1Cheio(modo) !== "off";
}

/**
 * Braço sem sorteio: modo "on" → B pra todo mundo; metadata `missao_1_por_dia: "on"` (sem força de
 * QA) → A pra todo mundo. null nos outros casos (sorteio, ou chave desligada).
 */
export const bracoFixo = (modo: ModoDia1Cheio = DIA1_CHEIO): BracoDia1 | null => {
  if (modo1012()) return "A";
  const m = modoDia1Cheio(modo);
  if (m === "on") return "B";
  if (m === "ab" && !forcaDia1Cheio() && modoUmPorDia() === "on") return "A";
  return null;
};

/** O braço já sorteado neste aparelho (sem sortear). */
export const bracoGravado = (): BracoDia1 | null => {
  const b = ls.get(CHAVE_BRACO_DIA1);
  return b === "A" || b === "B" ? b : null;
};

const uuid = (): string => {
  try { if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID(); } catch { /* sem crypto */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** O id do aparelho pro sorteio: um `device_id` que já exista, senão um uuid local (gravado uma vez). */
export function idDoAparelho(): string {
  for (const k of CHAVES_DEVICE_ID) {
    const v = ls.get(k);
    if (v && v.trim()) return v.trim();
  }
  const novo = uuid();
  ls.set(CHAVE_ID_LOCAL, novo);
  return novo;
}

/** Sorteio 50/50 determinístico pelo id (FNV-1a 32 bits; a paridade decide). */
export function sortearBraco(id: string): BracoDia1 {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h & 1) === 0 ? "A" : "B";
}

/**
 * O braço desta pessoa: null com a chave desligada (nada muda); "B" pra todo mundo
 * no modo "on"; no "ab", o gravado ou o sorteio pelo id do aparelho — gravado em
 * `core-dia1-braco` na 1ª vez.
 */
export function bracoDia1(): BracoDia1 | null {
  if (!dia1CheioLigado()) return null;
  const fixo = bracoFixo();
  if (fixo) return fixo;
  const b = bracoGravado();
  if (b) return b;
  const sorteado = sortearBraco(idDoAparelho());
  ls.set(CHAVE_BRACO_DIA1, sorteado);
  return sorteado;
}

/* ------------------------------------------------------------------ o plano de amanhã */

export type QuandoAmanha = "manha" | "almoco" | "noite";
export type GatilhoAmanha = "cafe" | "almoco" | "dormir";

export const QUANDOS_AMANHA: Array<{ id: QuandoAmanha; rotulo: string; emoji: string; min: number }> = [
  { id: "manha", rotulo: "De manhã", emoji: "🌤️", min: 8 * 60 },
  { id: "almoco", rotulo: "No almoço", emoji: "🍽️", min: 12 * 60 },
  { id: "noite", rotulo: "À noite", emoji: "🌙", min: 20 * 60 },
];
export const GATILHOS_AMANHA: Array<{ id: GatilhoAmanha; rotulo: string; emoji: string }> = [
  { id: "cafe", rotulo: "Com o café", emoji: "☕" },
  { id: "almoco", rotulo: "Depois do almoço", emoji: "🥗" },
  { id: "dormir", rotulo: "Antes de dormir", emoji: "🛏️" },
];

export interface PlanoAmanha { quando: QuandoAmanha; gatilho?: GatilhoAmanha; dia: string }

/** O chip que começa marcado: o mais perto da hora de agora (quem abre de noite costuma abrir de noite). */
export function quandoSugerido(agora: Date = new Date()): QuandoAmanha {
  const min = agora.getHours() * 60 + agora.getMinutes();
  return QUANDOS_AMANHA.reduce((melhor, q) => (Math.abs(q.min - min) < Math.abs(melhor.min - min) ? q : melhor)).id;
}

/** A hora do plano em minutos desde 0h (a hora que o Lembrete do dia 2 vai usar). */
export const minutosDoPlano = (quando: QuandoAmanha): number => QUANDOS_AMANHA.find((q) => q.id === quando)?.min ?? 20 * 60;

/** O gatilho combina com a hora? ("almoço" só faz sentido no almoço, etc.) — só pra sugerir, nunca trava. */
export const gatilhoSugerido = (quando: QuandoAmanha): GatilhoAmanha => (quando === "manha" ? "cafe" : quando === "almoco" ? "almoco" : "dormir");

export const novoPlanoAmanha = (quando: QuandoAmanha, gatilho?: GatilhoAmanha, hoje: string = localDayKey()): PlanoAmanha =>
  gatilho ? { quando, gatilho, dia: hoje } : { quando, dia: hoje };

/** O texto curto do plano, pra confirmação ("Amanhã à noite, antes de dormir"). */
export function fraseDoPlano(p: PlanoAmanha): string {
  const q = p.quando === "manha" ? "de manhã" : p.quando === "almoco" ? "no almoço" : "à noite";
  const g = p.gatilho === "cafe" ? ", com o café" : p.gatilho === "almoco" ? ", depois do almoço" : p.gatilho === "dormir" ? ", antes de dormir" : "";
  return `Amanhã ${q}${g}`;
}
