/**
 * PIX PAGO QUE NÃO VIROU ACESSO (06/11, relatório pix-acesso.md).
 *
 * O que os dados mostraram (02–04/11, 8 casos de 133 a 929 min): a passada do pix-reconcile MORRIA por volta da 140ª
 * consulta. Os 6 pedidos atrasados foram creditados na passada em que chegaram à posição 136–141 da fila, e a fila, do
 * mais velho pro mais novo, tinha até 444. Pedido novo só era visto quando os mais velhos saíam da janela de 48 h, e as
 * últimas passadas (presente, "sem e-mail", linha "Fim") nunca rodavam. No webhook, reconfirmação falha = evento perdido.
 *
 * Aqui mora o que é regra (puro, testado em src/test/pix-recuperacao.test.ts):
 *   · a agenda da varredura: até 2 h toda passada, até 48 h 1x por hora, até 7 dias 1x por dia (chave PIX_RESGATE_ANTIGO);
 *   · o orçamento da passada: para antes do limite da função e para na hora com 429 (a Asaas pede pra não insistir);
 *   · a fila de pendências: `pix-pend:<pedido>` em webhook_events, gravada pelo webhook quando o crédito falha;
 *   · os alarmes: chamado no /admin 1x por pedido, push pro dono.
 * Nada aqui credita: quem credita continua sendo só creditarPedido (grant-pix.ts).
 */
import { horaBrasilia, reais } from "./landing-travas.ts";
import { CORTE_MARCA_MS } from "./trava-grant.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

const HORA = 3600_000;
export const JANELA_RECENTE_MS = 2 * HORA;
export const JANELA_NORMAL_MS = 48 * HORA;
export const JANELA_ANTIGA_MS = 168 * HORA;
/** O cron roda a cada 15 min: é o "número da passada" das agendas por hora e por dia. */
export const PASSADA_MS = 900_000;
/** A passada morria perto de 150 s. Com 100 s ela termina, grava o "Fim" e roda as etapas de depois. */
export const ORCAMENTO_MS = 100_000;
export const MAX_ERROS_SEGUIDOS = 5;
/** Pendência sem solução depois disto vira alarme (1 passada e meia: a varredura já teve chance). */
export const ALARME_PENDENTE_MS = 20 * 60_000;

export const chaveLigada = (v: string | null | undefined): boolean => v === "on";

function numeroDoPedido(orderId: string): number {
  let h = 2166136261;
  for (let i = 0; i < orderId.length; i++) { h ^= orderId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Este pedido entra nesta passada? Depois das 2 h o QR de 30 min já venceu: sobra só quem pagou e não foi creditado, e
 * consultar todos a cada 15 min era o que enchia a fila. Cada pedido cai numa passada diferente, pra carga ficar espalhada.
 */
export function consultarNestaPassada(a: {
  orderId: string; criadoEm: string; agora: number;
  /** pendência do webhook: sempre entra */
  forcado?: boolean;
  antigoLigado?: boolean;
}): boolean {
  if (a.forcado) return true;
  const idade = a.agora - Date.parse(a.criadoEm);
  if (!Number.isFinite(idade) || idade <= JANELA_RECENTE_MS) return true;
  const giro = numeroDoPedido(a.orderId) + Math.floor(a.agora / PASSADA_MS);
  if (idade <= JANELA_NORMAL_MS) return giro % 4 === 0;
  if (!a.antigoLigado || idade > JANELA_ANTIGA_MS) return false;
  return giro % 96 === 0;
}

/** Pendência primeiro, depois do mais novo pro mais velho. */
export const maisUrgente = (a: { criadoEm: string; forcado?: boolean }, b: { criadoEm: string; forcado?: boolean }): number =>
  Number(!!b.forcado) - Number(!!a.forcado) || (Date.parse(b.criadoEm) || 0) - (Date.parse(a.criadoEm) || 0);

/** Quem tem pendência vem primeiro; depois quem tem o pedido mais novo. Dentro da pessoa a ordem não muda (o crédito
 *  continua caindo no mesmo pedido de antes). */
export function ordenarFila<T extends { criadoEm: string; forcado?: boolean }>(fila: Array<[string, T[]]>): Array<[string, T[]]> {
  const nota = (ordens: T[]) => Math.max(...ordens.map((o) => Date.parse(o.criadoEm) || 0));
  const forcada = (ordens: T[]) => (ordens.some((o) => o.forcado) ? 1 : 0);
  return [...fila].sort(([, a], [, b]) => forcada(b) - forcada(a) || nota(b) - nota(a));
}

export type MotivoParada = "tempo" | "cota_429" | "erros_seguidos";

export function criarOrcamento(a: { relogio?: () => number; limiteMs?: number; maxErros?: number; /** dryRun por páginas: pula as N primeiras consultas */ pular?: number } = {}) {
  const relogio = a.relogio ?? Date.now;
  const inicio = relogio();
  const limite = a.limiteMs ?? ORCAMENTO_MS;
  const maxErros = a.maxErros ?? MAX_ERROS_SEGUIDOS;
  let seguidos = 0;
  let erros = 0;
  let puladas = 0;
  let parou: MotivoParada | null = null;
  let saltar = a.pular ?? 0;
  return {
    /** false = esta consulta fica pra próxima passada (e entra na conta de `puladas`). */
    podeConsultar(): boolean {
      if (saltar > 0) { saltar--; return false; }
      if (!parou && relogio() - inicio > limite) parou = "tempo";
      if (parou) { puladas++; return false; }
      return true;
    },
    registrar(v: { erro?: boolean; status?: string }) {
      if (!v.erro) { seguidos = 0; return; }
      erros++; seguidos++;
      if (v.status === "http_429") parou = "cota_429";
      else if (seguidos >= maxErros) parou ??= "erros_seguidos";
    },
    estado: () => ({ parou, erros, puladas }),
  };
}

type Buscar = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
export const STATUS_PAGOS_ASAAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const TENTATIVAS = 3;
const TEMPO_POR_TENTATIVA_MS = 2200;

/**
 * A TRAVA 2 do webhook, sem confundir "não sei" com "não pagou": `erro` preenchido = a Asaas não respondeu, e o pedido
 * segue em aberto. 3 tentativas cabem nos 10 s do webhook. Com 429 não insiste (a documentação da Asaas pede isso).
 */
export async function reconfirmarAsaas(buscar: Buscar, apiKey: string, qrCodeId: string, pausaMs = 400): Promise<{ erro: string | null; pago: { value?: unknown; customer?: unknown; status?: string } | null }> {
  const url = `https://api.asaas.com/v3/payments?pixQrCodeId=${encodeURIComponent(qrCodeId)}&limit=10`;
  let erro = "sem_resposta";
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      const res = await buscar(url, { headers: { access_token: apiKey, "User-Agent": "CORE/1.0 (Supabase Edge)" }, signal: AbortSignal.timeout?.(TEMPO_POR_TENTATIVA_MS) });
      const out = (await res.json().catch(() => null)) as { data?: Array<{ status?: string }> } | null;
      if (res.ok && out) return { erro: null, pago: (out.data ?? []).find((p) => STATUS_PAGOS_ASAAS.has(String(p?.status))) ?? null };
      erro = `http_${res.status}`;
      if (res.status === 429) break;
    } catch { erro = "rede"; }
    if (i < TENTATIVAS - 1 && pausaMs) await new Promise((r) => setTimeout(r, pausaMs * (i + 1)));
  }
  return { erro, pago: null };
}

/* ───────────────────────── a fila de pendências (webhook_events, só service_role) ───────────────────────── */

export const chavePendencia = (orderId: string): string => `pix-pend:${orderId}`;
export const FONTE_PENDENCIA = "pix_pendente";

export type Pendencia = { orderId: string; motivo: string; desde: string };

/** Marca o pedido pra varredura. Se já está marcado, mantém a data da 1ª falha. Nunca lança. */
export async function marcarPendente(admin: ClienteMin, orderId: string, motivo: string): Promise<void> {
  if (!orderId) return;
  try { await admin.from("webhook_events").insert({ id: chavePendencia(orderId), source: FONTE_PENDENCIA, event: motivo.slice(0, 80) }); } catch { /* noop */ }
}

export async function lerPendencias(admin: ClienteMin): Promise<Pendencia[]> {
  try {
    const { data } = await admin.from("webhook_events").select("id, event, processed_at").eq("source", FONTE_PENDENCIA).limit(200);
    return ((data ?? []) as Array<{ id: string; event: string | null; processed_at: string }>)
      .map((l) => ({ orderId: l.id.slice(chavePendencia("").length), motivo: String(l.event ?? ""), desde: l.processed_at }));
  } catch { return []; }
}

export async function resolverPendencia(admin: ClienteMin, orderId: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", chavePendencia(orderId)); } catch { /* noop */ }
}

/** Solta a trava do evento da Asaas: a entrega seguinte do MESMO evento volta a ser processada. Nunca lança. */
export async function soltarEvento(admin: ClienteMin, eventId: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", `asaas:${eventId}`); } catch { /* noop */ }
}

/* ───────────────────────── resposta ≠ 200 pro webhook (chave ASAAS_WEBHOOK_REENVIO, desligada) ───────────────────────── */

export const FONTE_REENVIO = "asaas_reenvio";
/** A fila da Asaas pausa com 15 falhas seguidas: nunca passa de 5 respostas de erro por hora. */
export const MAX_REENVIOS_HORA = 5;

/** Pode responder erro pra Asaas reenviar? Na dúvida, não: a pendência já garante a varredura. */
export async function podePedirReenvio(admin: ClienteMin, ligado: boolean, agora: number = Date.now()): Promise<boolean> {
  if (!ligado) return false;
  try {
    const desde = new Date(agora - HORA).toISOString();
    const { data, error } = await admin.from("webhook_events").select("id").eq("source", FONTE_REENVIO).gte("processed_at", desde).limit(MAX_REENVIOS_HORA);
    if (error || !Array.isArray(data) || data.length >= MAX_REENVIOS_HORA) return false;
    const { error: e2 } = await admin.from("webhook_events").insert({ id: `asaas-reenvio:${agora}:${numeroDoPedido(String(Math.random()))}`, source: FONTE_REENVIO, event: "503" });
    return !e2;
  } catch { return false; }
}

/* ───────────────────────── alarmes ───────────────────────── */

export const chaveAlarme = (orderId: string): string => `pix-sem-credito:${orderId}`;
export const chaveAlarmeVarredura = (agora: number): string => `pix-varredura-alarme:${Math.floor(agora / (6 * HORA))}`;
export const CHAVE_VARREDURA_ATIVA = "pix-varredura:ativa";
/** Passada que começou há mais que isto e não apagou a marca morreu no meio. */
export const VARREDURA_MORTA_MS = 10 * 60_000;

async function reservar(admin: ClienteMin, id: string, event: string): Promise<boolean> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id, source: "pix_alarme", event });
    return !error;
  } catch { return false; }
}

type Avisar = (titulo: string, corpo: string, chave: string) => Promise<unknown>;

/** O que fazer com o chamado. A varredura não resolve os motivos "conferir": sem a pessoa, ficam parados. */
export function orientacaoDoChamado(motivo: string, orderId: string): string[] {
  if (motivo === "trava_antiga_conferir" || motivo === "pedido_antigo_conferir") {
    return [
      `A varredura NÃO vai creditar este pedido sozinha (${motivo}): ele tem uma trava de antes da marca e nenhuma linha, então pode já ter valido.`,
      "1. No Asaas: se o pedido não está pago ou foi reembolsado, marcar Resolvido.",
      "2. No /admin, nesta conta e no e-mail do pagador: se a pessoa já tem acesso, marcar Resolvido (o crédito saiu e a linha foi reescrita).",
      `3. Pago e sem acesso: admin-suporte liberar_vitalicio com o uid desta conta, cents do pedido e billing=${orderId}. O billing é obrigatório: é ele que impede crédito duplo. Oferta com prazo: depois, ajustar_concessao.`,
    ];
  }
  if (motivo === "valor_menor") {
    return [
      "A pessoa pagou menos que a oferta, e a varredura não credita isso.",
      "Conferir o valor no Asaas e devolver, ou combinar com a pessoa.",
    ];
  }
  return [
    `O acesso não saiu e a varredura segue tentando. Motivo: ${motivo}.`,
    "Conferir o pedido no Asaas. Se estiver pago e na conta errada, usar admin-suporte transferir_pix (nunca liberar_vitalicio).",
  ];
}

/**
 * Pagamento sem crédito: chamado no /admin → Suporte (support_tickets.user_id é obrigatório, então pedido sem dono só
 * dá push) + evento + push pro dono, 1x por pedido. Devolve true se avisou agora.
 */
export async function alarmarSemCredito(admin: ClienteMin, a: {
  orderId: string; userId: string | null; motivo: string; amountCents?: number | null; agora?: number; avisar?: Avisar;
}): Promise<boolean> {
  if (!a.orderId || !(await reservar(admin, chaveAlarme(a.orderId), "pix_sem_credito"))) return false;
  const quando = horaBrasilia(new Date(a.agora ?? Date.now()));
  const titulo = `Pix sem crédito · ${reais(a.amountCents)} · ${quando}`;
  if (a.userId) {
    try {
      await admin.from("support_tickets").insert({
        user_id: a.userId, source: "pix_sem_credito", status: "open",
        message: [
          titulo,
          ...orientacaoDoChamado(a.motivo, a.orderId),
          `Pedido: ${a.orderId}`,
        ].join("\n"),
      });
    } catch { /* o evento e o push abaixo ainda avisam */ }
  }
  try {
    await admin.from("analytics_events").insert({
      user_id: a.userId, event_name: "pix_sem_credito_alerta",
      event_data: { order_id: a.orderId, motivo: a.motivo, amount_cents: a.amountCents ?? null },
    });
  } catch { /* noop */ }
  await a.avisar?.(titulo, a.motivo, chaveAlarme(a.orderId))?.catch?.(() => null);
  return true;
}

/** A varredura com problema (erro da Asaas, tempo esgotado, passada morta): evento + push, no máximo 1 a cada 6 h. */
export async function alarmarVarredura(admin: ClienteMin, a: {
  motivo: string; detalhes?: Record<string, unknown>; agora?: number; avisar?: Avisar;
}): Promise<boolean> {
  const agora = a.agora ?? Date.now();
  const chave = chaveAlarmeVarredura(agora);
  if (!(await reservar(admin, chave, a.motivo.slice(0, 80)))) return false;
  try {
    await admin.from("analytics_events").insert({ user_id: null, event_name: "pix_varredura_alerta", event_data: { motivo: a.motivo, ...a.detalhes } });
  } catch { /* noop */ }
  await a.avisar?.("Varredura do Pix com problema", a.motivo, chave)?.catch?.(() => null);
  return true;
}

/**
 * Começo da passada. A marca `pix-varredura:ativa` é a trava: enquanto ela diz "em_curso" (há menos de 10 min), ninguém
 * mais varre, e chave primária resolve quem chega junto. A anon key é pública, então quem entra por ela (o cron) ainda
 * respeita 10 min desde o começo da última passada. Marca "em_curso" mais velha que isso = a anterior morreu no meio.
 * Erro de leitura ou gravação nunca segura a varredura.
 */
export async function abrirVarredura(admin: ClienteMin, agora: number = Date.now(), opts: { respeitarIntervalo?: boolean } = {}): Promise<{ pular: boolean; anteriorMorreu: boolean }> {
  let anteriorMorreu = false;
  try {
    const { data } = await admin.from("webhook_events").select("id, event, processed_at").eq("id", CHAVE_VARREDURA_ATIVA).maybeSingle();
    if (data) {
      const idade = agora - Date.parse(String(data.processed_at));
      const emCurso = data.event === "em_curso";
      if (idade <= VARREDURA_MORTA_MS && (emCurso || opts.respeitarIntervalo)) return { pular: true, anteriorMorreu: false };
      anteriorMorreu = emCurso;
      // marca vencida que não sai não pode parar a varredura pra sempre: segue sem trava (e o alarme, se era passada morta)
      const { error: erroApagar } = await admin.from("webhook_events").delete().eq("id", CHAVE_VARREDURA_ATIVA).eq("processed_at", data.processed_at);
      if (erroApagar) return { pular: false, anteriorMorreu };
    }
    const { error } = await admin.from("webhook_events").insert({ id: CHAVE_VARREDURA_ATIVA, source: "pix_alarme", event: "em_curso" });
    if ((error as { code?: string } | null)?.code === "23505") {
      if (!data) return { pular: true, anteriorMorreu: false };
      // a mesma marca vencida continua lá (o delete não pegou nada): segue. Marca nova = outra passada ganhou.
      const { data: agoraNaMarca } = await admin.from("webhook_events").select("processed_at").eq("id", CHAVE_VARREDURA_ATIVA).maybeSingle();
      if (agoraNaMarca?.processed_at === data.processed_at) return { pular: false, anteriorMorreu };
      return { pular: true, anteriorMorreu: false };
    }
  } catch { /* segue varrendo */ }
  return { pular: false, anteriorMorreu };
}

/** Fim da passada: a marca fica, com a hora do começo, e é ela que conta o intervalo. */
export async function fecharVarredura(admin: ClienteMin): Promise<void> {
  try { await admin.from("webhook_events").update({ event: "fim" }).eq("id", CHAVE_VARREDURA_ATIVA); } catch { /* noop */ }
}

/* ───────────────────────── conferir quando a conta sem acesso abre o app (chave PIX_CHECK_AO_ABRIR, desligada) ───────────────────────── */

export const INTERVALO_ABRIR_MS = 2 * 60_000;
/** Teto de todas as contas juntas: cada pedido gasta até MAX_PEDIDOS_POR_CONTA consultas (500 por hora no pior caso). */
export const TETO_ABRIR_MINUTO = 10;
export const TETO_ABRIR_HORA = 100;
export const MAX_PEDIDOS_POR_CONTA = 5;
export const chaveAbrir = (userId: string, agora: number): string => `pix-abrir:${userId}:${Math.floor(agora / INTERVALO_ABRIR_MS)}`;

/**
 * A conta sem acesso tem Pix das últimas 2 h? Pede a varredura SÓ dessa conta (a mesma função de sempre: um caminho de
 * crédito a mais seria um lugar a mais pra errar Purchase e e-mail). No máximo 1 pedido a cada 2 min por conta, com teto
 * global por minuto e por hora, pra um pico (ou abuso) nunca comer a cota da Asaas.
 * Devolve true se a varredura creditou. Qualquer erro = false: o check-subscription nunca falha por causa disto.
 */
export async function conferirPixAoAbrir(admin: ClienteMin, a: {
  ligado: boolean; userId: string; varrer: (userId: string) => Promise<boolean>; agora?: number;
}): Promise<boolean> {
  if (!a.ligado) return false;
  const agora = a.agora ?? Date.now();
  try {
    const { data } = await admin.from("analytics_events").select("id")
      .eq("user_id", a.userId).eq("event_name", "pix_order_created")
      .gte("created_at", new Date(agora - JANELA_RECENTE_MS).toISOString()).limit(1);
    if (!Array.isArray(data) || !data.length) return false;
    const { data: recentes } = await admin.from("webhook_events").select("processed_at").eq("source", "pix_abrir")
      .gte("processed_at", new Date(agora - HORA).toISOString()).limit(TETO_ABRIR_HORA);
    if (!Array.isArray(recentes) || recentes.length >= TETO_ABRIR_HORA) return false;
    if (recentes.filter((r: { processed_at: string }) => agora - Date.parse(r.processed_at) < 60_000).length >= TETO_ABRIR_MINUTO) return false;
    const { error } = await admin.from("webhook_events").insert({ id: chaveAbrir(a.userId, agora), source: "pix_abrir", event: "check" });
    if (error) return false;
    return await a.varrer(a.userId);
  } catch { return false; }
}

/**
 * Pedido com mais de 48 h, sem linha e com trava de antes do corte sem a marca "creditado": pode ter sido
 * creditado e a linha apagada numa transferência. Não credita sozinho; vira alarme. Na dúvida (erro de leitura), segura.
 */
export async function antigoPrecisaDeOlho(admin: ClienteMin, chaveDaTrava: string, orderId: string): Promise<boolean> {
  try {
    const { data: linhas, error: e1 } = await admin.from("subscriptions").select("id").eq("abacatepay_billing_id", orderId).limit(1);
    if (e1) return true;
    if (Array.isArray(linhas) && linhas.length) return false; // creditarPedido devolve ja_creditado
    const { data, error } = await admin.from("webhook_events").select("id, event, processed_at").eq("id", chaveDaTrava).maybeSingle();
    if (error) return true;
    if (!data || data.event === "creditado") return false;
    return !(Date.parse(String(data.processed_at)) >= CORTE_MARCA_MS); // depois do corte, sem marca = caminho morto
  } catch { return true; }
}
