/**
 * LEMBRETE DA PORTA (v4, 12/10) — as partes PURAS da ação "lembretes" do porta-handoff.
 *
 * 12/10 (iPhone, até 11h36): 15 contas criadas na /comece → só 5 entraram no app. Quem cria a conta e não
 * entra já custou ~R$ 7,50 e já está a 1 toque do teste. Então, por e-mail (com um código NOVO no botão
 * "Entrar no CORE" → core://entrar?h=…):
 *
 *   · 1º lembrete: conta criada há 60–120 min (o cron roda a cada 15 min; cada conta passa ~4 vezes pela
 *     janela, e o registro porta_lembrete_enviado {n:1} garante 1 envio só);
 *   · 2º lembrete: conta criada ONTEM (dia de Brasília), mandado de manhã — das 9h às 12h de Brasília (o
 *     cron das 9h manda; se ele falhar, os seguintes até o meio-dia cobrem).
 *
 * Só pra quem: tem user_metadata.porta, tem e-mail (que não é de teste), é do iPhone (o link core://entrar só
 * existe no app de iPhone; o app Android não resgata código), NÃO tem sinal de app (código resgatado no app,
 * assinatura, porta_parabens_visto, ficha do aparelho numa sessão dela) e não recebeu esse lembrete.
 *
 * Testado no vitest (src/test/porta-lembretes.test.ts).
 */
import { ehEmailDeTeste } from "./email-porta.ts";

export const LEMBRETE1_DE_MIN = 60;
export const LEMBRETE1_ATE_MIN = 120;
/** Janela de envio do 2º lembrete, em horas de Brasília [de, ate). */
export const LEMBRETE2_HORA_DE = 9;
export const LEMBRETE2_HORA_ATE = 12;
/** Brasília = UTC−3 o ano inteiro (sem horário de verão desde 2019). */
const BRT_MS = -3 * 3600_000;
/** Teto por rodada do cron (cada conta custa ~6 consultas). */
export const MAX_POR_RODADA = 60;

export type NumeroLembrete = 1 | 2;
export type Janela = { de: Date; ate: Date };

/** Hora de Brasília (0–23) de um instante. */
export const horaBrasilia = (agora: Date): number => new Date(agora.getTime() + BRT_MS).getUTCHours();

/** 00:00 de Brasília do dia de `agora`, como instante UTC. */
export function inicioDoDiaBrasilia(agora: Date): Date {
  const local = new Date(agora.getTime() + BRT_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BRT_MS);
}

/**
 * Em que intervalo de criação de conta este lembrete procura agora. null = não é hora (2º lembrete fora da
 * manhã de Brasília).
 */
export function janelaDoLembrete(n: NumeroLembrete, agora: Date): Janela | null {
  if (n === 1) return { de: new Date(agora.getTime() - LEMBRETE1_ATE_MIN * 60_000), ate: new Date(agora.getTime() - LEMBRETE1_DE_MIN * 60_000) };
  const h = horaBrasilia(agora);
  if (h < LEMBRETE2_HORA_DE || h >= LEMBRETE2_HORA_ATE) return null;
  const hoje = inicioDoDiaBrasilia(agora);
  return { de: new Date(hoje.getTime() - 86_400_000), ate: hoje };
}

export type SinaisDaConta = {
  /** auth.users.created_at */
  criadaEm: string | null | undefined;
  temPorta: boolean;
  email: string | null | undefined;
  /** iPhone (pediu código no porta-handoff, ou o porta_view da sessão dela diz "ios") */
  ehIos: boolean;
  /** já entrou no app (código resgatado, assinatura, evento do app, sessão nativa) */
  temApp: boolean;
  /** já recebeu ESTE lembrete (porta_lembrete_enviado {n}) */
  jaRecebeu: boolean;
};

export type Decisao = { manda: true } | { manda: false; motivo: string };

/** As checagens baratas (sem banco): dá pra parar antes das consultas caras. */
export function filtroBasico(janela: Janela, c: Pick<SinaisDaConta, "criadaEm" | "temPorta" | "email">): Decisao {
  if (!c.temPorta) return { manda: false, motivo: "sem_porta" };
  if (!c.email) return { manda: false, motivo: "sem_email" };
  if (ehEmailDeTeste(c.email)) return { manda: false, motivo: "email_teste" };
  const t = c.criadaEm ? Date.parse(c.criadaEm) : NaN;
  if (!Number.isFinite(t) || t < janela.de.getTime() || t >= janela.ate.getTime()) return { manda: false, motivo: "fora_da_janela" };
  return { manda: true };
}

/** A decisão inteira. A ordem dos motivos é a ordem em que a função consulta o banco. */
export function decidirLembrete(janela: Janela, c: SinaisDaConta): Decisao {
  const b = filtroBasico(janela, c);
  if (!b.manda) return b;
  if (!c.ehIos) return { manda: false, motivo: "nao_ios" };
  if (c.temApp) return { manda: false, motivo: "ja_entrou_no_app" };
  if (c.jaRecebeu) return { manda: false, motivo: "ja_recebeu" };
  return { manda: true };
}

/** Eventos que só o APP manda (com o user_id): entrou no app. */
export const EVENTOS_DO_APP = ["porta_parabens_visto", "porta_parabens_continuar", "app_device_info", "webview_info"];
/** Eventos da Porta que marcam uma conta criada (o site manda porta_conta_criada; o "criar" grava porta_email_enviado). */
export const EVENTOS_DE_CONTA = ["porta_conta_criada", "porta_email_enviado"];
/** Comparação de segredo em tempo constante (o cron manda no header x-cron-secret). */
export function segredoConfere(recebido: string, esperado: string): boolean {
  if (!esperado || recebido.length !== esperado.length) return false;
  let d = 0;
  for (let i = 0; i < esperado.length; i++) d |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return d === 0;
}
