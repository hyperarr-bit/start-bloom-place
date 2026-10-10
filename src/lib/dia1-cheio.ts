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
 */
import { localDayKey } from "@/lib/utils";
import { v14Ligada } from "@/lib/v14-qa";

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

/** O modo que vale AQUI: força de QA > build de QA (VITE_V14_QA → "on") > constante. */
export function modoDia1Cheio(modo: ModoDia1Cheio = DIA1_CHEIO): ModoDia1Cheio {
  const f = forcaDia1Cheio();
  if (f) return f;
  if (v14Ligada()) return "on";
  return modo;
}

/** O teste está ligado AQUI ("ab" ou "on")? */
export function dia1CheioLigado(modo: ModoDia1Cheio = DIA1_CHEIO): boolean {
  return modoDia1Cheio(modo) !== "off";
}

/** Modo "on": o braço de todo mundo é B, sem sorteio (null nos outros modos). */
export const bracoFixo = (modo: ModoDia1Cheio = DIA1_CHEIO): BracoDia1 | null => (modoDia1Cheio(modo) === "on" ? "B" : null);

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
