/**
 * AVISO DE VENDA NO iPHONE DO DONO (29/10) — as regras puras (testadas em src/test/aviso-venda.test.ts).
 *
 * Só avisa quando ENTRA DINHEIRO, uma vez por venda:
 *   · Pix do site: linha de `subscriptions` com payment_method "pix", ativa, amount_cents > 0. Chave = o pedido
 *     (abacatepay_billing_id; os 3 caminhos da Asaas/Abacate gravam o mesmo id), senão o id da linha.
 *   · Apple / Google Play: o marcador `meta_capi_app_enviado` em analytics_events. Ele só nasce quando a cobrança
 *     está CONFIRMADA (meta-backfill-app pergunta ao RevenueCat se houve receita; teste grátis gera
 *     `meta_capi_trial_enviado`, que NÃO avisa). A linha da loja nasce no INÍCIO do teste com o preço cheio e, em
 *     5 de 8 testes do iPhone que pagaram, nunca é reescrita depois da cobrança — por isso a linha sozinha não serve.
 *     Chave = o tx do RevenueCat (o mesmo marcador pode nascer 2x: webhook + cron).
 *   · Renovação da loja: a linha já paga (período ≥ 10 dias) cujo fim anda ≥ 20 dias. Chave = tx + novo fim.
 * E-mails de teste/internos nunca avisam.
 */

export const RE_EMAIL_TESTE = /teste|hyperarr|jv20101958|revisao\.apple|e2e|@example\.|@test\./i;
export const ehEmailTeste = (email?: string | null): boolean => !!email && RE_EMAIL_TESTE.test(email);

const DIA_MS = 86400_000;

export type LinhaSub = {
  id: string;
  user_id?: string | null;
  status?: string | null;
  plan?: string | null;
  billing_period?: string | null;
  payment_method?: string | null;
  amount_cents?: number | null;
  customer_email?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
  abacatepay_billing_id?: string | null;
  revenuecat_subscription_id?: string | null;
};

export type Origem = "pix" | "apple" | "play";
export type Venda = {
  chave: string;
  origem: Origem;
  valor_cents: number;
  plano: string;
  renovacao: boolean;
  quando: string;
};

/** iPhone pelo prefixo do id do RevenueCat (mesma regra do coleta.mjs: subAap… / otpA… = App Store). */
export const lojaDoTx = (tx?: string | null): "apple" | "play" => (/^(subAap|otpA)/.test(tx ?? "") ? "apple" : "play");

export const reais = (cents: number): string =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace(/ /g, " ");

/** "1 ano", "vitalício", "1 mês"… — pelo billing_period e, no Pix (que empilha prazo), pela duração da linha. */
export function rotuloPlano(l: Pick<LinhaSub, "billing_period" | "current_period_start" | "current_period_end" | "created_at">, origem: Origem): string {
  const b = String(l.billing_period ?? "").toLowerCase();
  if (origem !== "pix") {
    if (b.startsWith("annual")) return "anual";
    if (b.startsWith("month")) return "mensal";
    if (b === "lifetime") return "vitalício";
    return b || "assinatura";
  }
  const ini = Date.parse(l.current_period_start ?? l.created_at ?? "");
  const fim = Date.parse(l.current_period_end ?? "");
  const dias = Number.isFinite(ini) && Number.isFinite(fim) ? (fim - ini) / DIA_MS : NaN;
  if (Number.isFinite(dias)) {
    if (dias >= 3650) return "vitalício";
    if (dias >= 330) { const a = Math.round(dias / 365); return a <= 1 ? "1 ano" : `${a} anos`; }
    if (dias >= 25) { const m = Math.round(dias / 30); return m <= 1 ? "1 mês" : `${m} meses`; }
    if (dias > 0) return `${Math.round(dias)} dias`;
  }
  if (b === "lifetime") return "vitalício";
  if (b.startsWith("annual")) return "1 ano";
  if (b.startsWith("month")) return "1 mês";
  return "Pix";
}

export const NOME_ORIGEM: Record<Origem, string> = { pix: "Pix do site", apple: "Apple", play: "Google Play" };

/** Título da notificação: "💰 Venda · R$ 27,90 · Pix do site (1 ano)" / "💰 Venda · R$ 97,90 · Apple anual". */
export function tituloVenda(v: Pick<Venda, "origem" | "valor_cents" | "plano" | "renovacao">): string {
  const rotulo = v.origem === "pix" ? `Pix do site (${v.plano})` : `${NOME_ORIGEM[v.origem]} ${v.plano}`;
  return `💰 ${v.renovacao ? "Renovação" : "Venda"} · ${reais(v.valor_cents)} · ${rotulo}`;
}

export function corpoVenda(totalHojeCents: number, nHoje: number): string {
  return `Hoje: ${nHoje} ${nHoje === 1 ? "venda" : "vendas"} · ${reais(totalHojeCents)}`;
}

/** O que vai dentro do push (o service worker de /vendas mostra isso). */
export function dadosPush(titulo: string, corpo: string, tag: string) {
  return { title: titulo, body: corpo, tag, url: "/vendas", icon: "/icon-192.png", badge: "/icon-192.png" };
}

/** Pix do site: a linha conta como venda? */
export function vendaPix(l: LinhaSub): Venda | null {
  if (l.payment_method !== "pix" || l.status !== "active") return null;
  const cents = Number(l.amount_cents ?? 0);
  if (!(cents > 0) || ehEmailTeste(l.customer_email)) return null;
  return {
    chave: `pix:${l.abacatepay_billing_id || l.id}`,
    origem: "pix",
    valor_cents: cents,
    plano: rotuloPlano(l, "pix"),
    renovacao: false,
    quando: l.created_at ?? new Date().toISOString(),
  };
}

/** Marcador de cobrança confirmada da loja (meta_capi_app_enviado) + a linha do tx. */
export function vendaLoja(marcador: { event_name?: string | null; event_data?: { tx?: string; valor?: number } | null; created_at?: string | null }, l: LinhaSub | null): Venda | null {
  if (marcador.event_name !== "meta_capi_app_enviado") return null;
  const tx = String(marcador.event_data?.tx ?? "");
  if (!tx) return null;
  if (l && (ehEmailTeste(l.customer_email) || l.payment_method !== "play_store")) return null;
  const cents = Number(l?.amount_cents ?? Math.round(Number(marcador.event_data?.valor ?? 0) * 100));
  if (!(cents > 0)) return null;
  const origem = lojaDoTx(tx);
  return {
    chave: `loja:${tx}`,
    origem,
    valor_cents: cents,
    plano: l ? rotuloPlano(l, origem) : "assinatura",
    renovacao: false,
    quando: marcador.created_at ?? new Date().toISOString(),
  };
}

/** Renovação: linha da loja já paga (período ≥ 10 d, não é teste) cujo fim andou ≥ 20 dias. */
export function vendaRenovacao(l: LinhaSub, fimAntigo: string | null | undefined): Venda | null {
  if (l.payment_method !== "play_store" || l.status !== "active" || !l.revenuecat_subscription_id) return null;
  if (ehEmailTeste(l.customer_email)) return null;
  const ini = Date.parse(l.current_period_start ?? "");
  const antes = Date.parse(fimAntigo ?? "");
  const agora = Date.parse(l.current_period_end ?? "");
  if (![ini, antes, agora].every(Number.isFinite)) return null;
  if (antes - ini < 10 * DIA_MS) return null; // o período antigo era o teste grátis — a 1ª cobrança vem pelo marcador
  if (agora - antes < 20 * DIA_MS) return null;
  if (l.billing_period === "lifetime") return null;
  const cents = Number(l.amount_cents ?? 0);
  if (!(cents > 0)) return null;
  const origem = lojaDoTx(l.revenuecat_subscription_id);
  return {
    chave: `renov:${l.revenuecat_subscription_id}:${new Date(agora).toISOString().slice(0, 10)}`,
    origem,
    valor_cents: cents,
    plano: rotuloPlano(l, origem),
    renovacao: true,
    quando: new Date().toISOString(),
  };
}

/** Dia em BRT (UTC−3, sem horário de verão desde 2019) — a régua de todos os scripts de métricas. */
export const diaBRT = (t: number | string | Date): string =>
  new Date((t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t)) - 3 * 3600_000).toISOString().slice(0, 10);
export const inicioDiaBRT = (dia: string): string => `${dia}T03:00:00.000Z`;
export const somaDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
