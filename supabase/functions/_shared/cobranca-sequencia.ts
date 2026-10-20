/**
 * SEQUÊNCIA DO CARTÃO RECUSADO NA APP STORE (20/10/2026).
 *
 * Por que: 61% das cobranças da App Store são recusadas, só ~10% se recuperam
 * e 54% nunca mais abrem o app. O e-mail único do BILLING_ISSUE (28/09) levou a
 * recuperação de 0% pra 12–13% — e a maior parte das recuperações acontece
 * entre o 5º e o 12º dia. Então: D0 (o de hoje, no webhook) + D2, D5 e D10
 * (cron), parando na hora em que a assinatura volta, é cancelada/expira ou a
 * pessoa pede pra sair; nunca mais de 1 e-mail por dia.
 *
 * Arquivo PURO (sem Deno, sem banco): a cobranca-recusada importa daqui e o
 * vitest testa a régua inteira (src/test/cobranca-sequencia.test.ts).
 *
 * Marcadores (analytics_events), os mesmos da função:
 *  - `cobranca_recusada_email` {passo: d0|d2|d5|d10, via, dias, ...} — 1 por
 *    envio; é o marcador de idempotência E o dado pra medir a recuperação por
 *    passo. Os antigos (sem `passo`) contam como d0.
 *  - `cobranca_recusada_fim` {motivo, ultimo_passo, dias} — 1 por sequência,
 *    quando ela para (recuperou / cancelou / expirou / saiu).
 *  - `cobranca_recusada_sair` {via} — a pessoa pediu pra não receber mais.
 */

export type Passo = "d0" | "d2" | "d5" | "d10";
export const PASSOS: ReadonlyArray<{ passo: Passo; dia: number }> = [
  { passo: "d0", dia: 0 },
  { passo: "d2", dia: 2 },
  { passo: "d5", dia: 5 },
  { passo: "d10", dia: 10 },
];

export const MARCADOR = "cobranca_recusada_email";
export const MARCADOR_PIX = "cobranca_recusada_pix_email";
export const MARCADOR_FIM = "cobranca_recusada_fim";
export const MARCADOR_SAIR = "cobranca_recusada_sair";

/** Carência de cobrança da Apple configurada na App Store Connect. */
export const CARENCIA_DIAS = 28;
/** Depois disso a sequência não manda mais nada (nem quando a chave é ligada
 *  com recusas antigas na fila — não sai lote de lembrete atrasado). */
export const JANELA_DIAS = 14;
/** Horário de envio do cron (hora de Brasília, inclusive). */
export const HORA_INICIO = 9;
export const HORA_FIM = 20;

/** A chave: só "on" liga (padrão desligado). */
export const sequenciaLigada = (v?: string | null) => String(v ?? "").trim().toLowerCase() === "on";

// Brasil sem horário de verão desde 2019: BRT = UTC−3 fixo.
const BRT_MS = 3 * 3600_000;
const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));

/** Dia do calendário em Brasília, "AAAA-MM-DD". */
export const diaBRT = (d: string | Date) => new Date(toDate(d).getTime() - BRT_MS).toISOString().slice(0, 10);
export const horaBRT = (d: string | Date) => new Date(toDate(d).getTime() - BRT_MS).getUTCHours();
export const dentroDoHorario = (agora: Date) => {
  const h = horaBRT(agora);
  return h >= HORA_INICIO && h <= HORA_FIM;
};

/** Dias de calendário (Brasília) entre o início e agora: recusa às 23h e
 *  agora 01h do dia seguinte = 1. */
export function diasDesde(inicio: string | Date, agora: Date): number {
  const a = Date.parse(diaBRT(inicio) + "T00:00:00Z");
  const b = Date.parse(diaBRT(agora) + "T00:00:00Z");
  return Math.round((b - a) / 86400_000);
}

/** Quantos dias faltam da carência de 28 dias (nunca negativo). */
export const diasRestantesCarencia = (inicio: string | Date, agora: Date) =>
  Math.max(0, CARENCIA_DIAS - diasDesde(inicio, agora));

export type Evento = { event_name: string; created_at: string; event_data?: Record<string, unknown> | null };

export type Historico = {
  /** Quando saiu o D0 desta sequência (o mais recente dentro da janela). */
  inicio: string | null;
  /** Passos já enviados nesta sequência (d0 incluso). */
  enviados: Passo[];
  /** Último e-mail de cobrança de qualquer tipo (Apple ou Pix). */
  ultimoEnvio: string | null;
  /** A sequência já foi encerrada (marcador de fim depois do D0). */
  encerrada: boolean;
  /** Pediu pra sair (em qualquer época). */
  saiu: boolean;
};

const passoDe = (e: Evento): Passo => {
  const p = String(e.event_data?.passo ?? "");
  return (PASSOS.some((x) => x.passo === p) ? p : "d0") as Passo;
};

/** Monta o histórico de UMA pessoa a partir dos marcadores dela. */
export function montarHistorico(eventos: Evento[], saiu = false): Historico {
  const ord = [...eventos].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const envios = ord.filter((e) => e.event_name === MARCADOR);
  const d0s = envios.filter((e) => passoDe(e) === "d0");
  const inicio = d0s.length ? d0s[d0s.length - 1].created_at : null;
  const t0 = inicio ? Date.parse(inicio) : Infinity;
  const enviados = envios.filter((e) => Date.parse(e.created_at) >= t0).map(passoDe);
  const todos = ord.filter((e) => e.event_name === MARCADOR || e.event_name === MARCADOR_PIX);
  return {
    inicio,
    enviados: [...new Set(enviados)],
    ultimoEnvio: todos.length ? todos[todos.length - 1].created_at : null,
    encerrada: ord.some((e) => e.event_name === MARCADOR_FIM && Date.parse(e.created_at) >= t0),
    saiu: saiu || ord.some((e) => e.event_name === MARCADOR_SAIR),
  };
}

export type Decisao =
  | { acao: "enviar"; passo: Passo; dias: number; diasRestantes: number }
  | { acao: "parar"; motivo: MotivoFim; dias: number }
  | { acao: "esperar"; motivo: "sem_d0" | "encerrada" | "fora_da_janela" | "cedo" | "em_dia" | "completa" | "ja_hoje" };

export type MotivoFim = "recuperou" | "cancelou" | "expirou" | "sem_assinatura" | "saiu";

/** O que fazer HOJE com essa pessoa, só pelo histórico (o estado na Apple é
 *  conferido depois, e só de quem tem passo pra receber). */
export function decidirPasso(h: Historico, agora: Date): Decisao {
  if (!h.inicio) return { acao: "esperar", motivo: "sem_d0" };
  if (h.encerrada) return { acao: "esperar", motivo: "encerrada" };
  const dias = diasDesde(h.inicio, agora);
  if (h.saiu) return { acao: "parar", motivo: "saiu", dias };
  if (dias > JANELA_DIAS) return { acao: "esperar", motivo: "fora_da_janela" };
  const devidos = PASSOS.filter((p) => p.passo !== "d0" && p.dia <= dias);
  if (!devidos.length) return { acao: "esperar", motivo: "cedo" };
  const alvo = devidos[devidos.length - 1];
  // Já recebeu este passo ou um posterior: nada. Passo perdido (cron fora do
  // ar) não é reenviado atrasado — vai direto o passo do dia.
  const idx = PASSOS.findIndex((p) => p.passo === alvo.passo);
  if (PASSOS.slice(idx).some((p) => h.enviados.includes(p.passo))) {
    return { acao: "esperar", motivo: h.enviados.includes("d10") ? "completa" : "em_dia" };
  }
  if (h.ultimoEnvio && diaBRT(h.ultimoEnvio) === diaBRT(agora)) return { acao: "esperar", motivo: "ja_hoje" };
  return { acao: "enviar", passo: alvo.passo, dias, diasRestantes: diasRestantesCarencia(h.inicio, agora) };
}

// ─── Estado na Apple (RevenueCat API v2) ─────────────────────────────────────

export type SubRC = { id?: string; status?: string; store?: string; gives_access?: boolean; auto_renewal_status?: string };
export type EstadoApple =
  | { estado: "recusada"; comAcesso: boolean }
  | { estado: Exclude<MotivoFim, "saiu">; comAcesso: boolean };

const RECUSADO = new Set(["in_grace_period", "in_billing_retry"]);
// O id da assinatura no RevenueCat diz a loja: subAap… = App Store.
export const daApple = (s: SubRC) =>
  String(s?.id ?? "").startsWith("subAap") || String(s?.store ?? "").toLowerCase() === "app_store";

/** Recusada = cartão recusado com a renovação ainda ligada (na carência ou na
 *  nova tentativa da Apple). O resto é motivo pra parar a sequência. */
export function classificarEstadoApple(items: SubRC[]): EstadoApple {
  const apple = (items ?? []).filter(daApple);
  const rec = apple.find((x) => RECUSADO.has(String(x?.status)) && x?.auto_renewal_status !== "will_not_renew");
  if (rec) return { estado: "recusada", comAcesso: !!rec.gives_access };
  if (apple.some((x) => RECUSADO.has(String(x?.status)))) return { estado: "cancelou", comAcesso: false };
  const ativa = apple.find((x) => x?.status === "active" || x?.status === "trialing");
  // Ativa = a Apple cobrou (mesmo que a pessoa já tenha desligado a próxima renovação).
  if (ativa) return { estado: "recuperou", comAcesso: true };
  if (apple.some((x) => x?.status === "expired")) return { estado: "expirou", comAcesso: false };
  return { estado: "sem_assinatura", comAcesso: false };
}

// ─── Link de sair da lista ───────────────────────────────────────────────────

const b64url = (buf: ArrayBuffer) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Token do "não quero mais receber": HMAC-SHA256 do user id. */
export async function tokenSair(uid: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`cobranca-sair:${uid}`));
  return b64url(sig).slice(0, 32);
}

export async function tokenSairValido(uid: string, token: string, segredo: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(uid) || !token || !segredo) return false;
  const certo = await tokenSair(uid, segredo);
  if (certo.length !== token.length) return false;
  let dif = 0;
  for (let i = 0; i < certo.length; i++) dif |= certo.charCodeAt(i) ^ token.charCodeAt(i);
  return dif === 0;
}

export const linkSair = (base: string, uid: string, token: string) =>
  `${base}?sair=1&u=${encodeURIComponent(uid)}&t=${encodeURIComponent(token)}`;
