/**
 * INDIQUE E GANHE da web (23/11/2026) — as regras, puras + o que grava no banco (cliente injetado; testado no vitest:
 * src/test/indique.test.ts e src/test/stripe-webhook.test.ts).
 *
 * Todo comprador do vitalício da /oferta (R$ 67,90, Stripe) pode pegar um LINK PESSOAL no pós-pago
 * (coreaplicativo.com.br/oferta?ref=CODIGO). Quem compra por ele paga o MESMO preço; quem indicou ganha 50% do valor pago
 * (R$ 33,95). A comissão fica "a liberar" 7 dias (janela de reembolso) e sai no Pix semanal do programa de afiliados
 * (função `afiliados`, pagar_semana, Asaas, trava semanal de R$ 500). Reaproveita as tabelas de 09/10: quem indica é uma
 * linha em `afiliados` (origem "comprador"); cada venda é uma linha em `afiliado_vendas` (plataforma "web", transaction_id =
 * id do PaymentIntent — a mesma chave do reembolso).
 *
 * ATRIBUIÇÃO: o ?ref= da /oferta vai pela página (memória + localStorage + cookie, último clique) pro stripe-criar, que grava
 * metadata[indicador] no PaymentIntent. O webhook lê dali — o navegador do Instagram pode zerar o storage, a metadata não.
 *
 * TRAVAS (autoindicação): mesmo e-mail (normalizado: +apelido e pontos do Gmail), mesma conta, mesmo cartão (digital da
 * Stripe), mesmo CPF (só quando o checkout pede CPF), chave Pix = e-mail de quem comprou, e quem já tinha o vitalício → `recusado`
 * com o motivo, comissão 0. Mesmo aparelho ou mesmo IP → conta, mas o Pix fica SEGURADO pro dono revisar. Reembolso/contestação
 * → `reembolsado`. Carência: Pix 7 dias, cartão 30 (contestação). O 1º Pix de cada link sai só com o ok do dono (/admin).
 */
import { LIMITE_SEMANAL_PADRAO_CENTS, normalizarCodigo } from "./afiliados.ts";
import { cpfValido, soDigitosCpf } from "./cpf.ts";
import { COMISSAO_FIXA_PLANOS_CENTS, OFERTAS_STRIPE } from "./stripe-ofertas.ts";

export const PCT_INDIQUE = 0.5;
/** o preço da /oferta: o MESMO da tabela que o stripe-criar cobra (nunca um número solto) */
export const PRECO_OFERTA_CENTS = OFERTAS_STRIPE.oferta.centavos;
export const SITE = "https://www.coreaplicativo.com.br";
/** sem 0/O, 1/I/L — fácil de ditar por áudio */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const comissaoWebCents = (valorPagoCents: number): number => Math.max(0, Math.round(valorPagoCents * PCT_INDIQUE));
/**
 * O VALOR POR AMIGA que toda tela e e-mail mostram (17/11, dono: "o valor exibido e o pago nunca podem discordar"). É a MESMA conta
 * que o webhook usa pra gravar a comissão (comissaoWebCents do valor pago); a página, o painel e o e-mail importam DAQUI.
 */
export const COMISSAO_POR_AMIGA_CENTS = comissaoWebCents(PRECO_OFERTA_CENTS);
export const reaisBr = (c: number): string => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
export const normalizarIndicador = normalizarCodigo;
export const linkIndique = (codigo: string): string => `${SITE}/oferta?ref=${encodeURIComponent(codigo)}`;
export const linkPainelIndique = (token: string): string => `${SITE}/indique/${token}`;

/** código novo de 6 letras/números (o banco garante que é único: em conflito, chama de novo) */
export function gerarCodigo(rand: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO[rand(ALFABETO.length)];
  return s;
}

/** sha-256 hex do e-mail normalizado — pra comparar com a chave Pix sem guardar o e-mail de quem comprou pelo link */
export async function hashEmail(email: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ───────── Pix de quem indica ───────── */
export type TipoPix = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
/** confere e normaliza a chave (o formato que o Asaas aceita em pixAddressKey). null = inválida */
export function validarPix(tipo: unknown, chave: unknown): { tipo: TipoPix; chave: string } | null {
  const t = String(tipo ?? "").toUpperCase();
  const c = String(chave ?? "").trim();
  if (t === "CPF") { const d = soDigitosCpf(c); return c.replace(/\D/g, "").length === 11 && cpfValido(d) ? { tipo: "CPF", chave: d } : null; }
  if (t === "CNPJ") { const d = c.replace(/\D/g, ""); return d.length === 14 && !/^(\d)\1+$/.test(d) ? { tipo: "CNPJ", chave: d } : null; }
  if (t === "EMAIL") { const e = c.toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 77 ? { tipo: "EMAIL", chave: e } : null; }
  if (t === "PHONE") {
    let d = c.replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
    return /^[1-9]{2}9\d{8}$/.test(d) || /^[1-9]{2}[2-5]\d{7}$/.test(d) ? { tipo: "PHONE", chave: d } : null;
  }
  if (t === "EVP") { const e = c.toLowerCase(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(e) ? { tipo: "EVP", chave: e } : null; }
  return null;
}
export const finalPix = (chave: string | null | undefined): string | null => (chave ? (chave.length <= 4 ? "••••" : `•••${chave.slice(-4)}`) : null);

/* ───────── a decisão da venda (pura) ───────── */
/**
 * Carência ("a liberar"): Pix 10 dias; cartão 30 dias (contestação/chargeback chega depois — revisão 23/11 A1).
 * Críticas da subida 17/11: a garantia da página é de 7 dias; com 7 de carência, um pedido no 7º dia que o suporte só devolve depois
 * do Pix de segunda saía pago E devolvido. 10 dias cobrem a demora do suporte.
 */
export const DIAS_LIBERA_PIX = 10;
export const DIAS_LIBERA_CARTAO = 30;
export const diasParaLiberar = (metodo: string | null | undefined): number => (metodo === "pix" ? DIAS_LIBERA_PIX : DIAS_LIBERA_CARTAO);

/** e-mail comparável: minúsculo, sem "+apelido" e, no Gmail, sem pontos ("ana.b+1@gmail.com" = "anab@gmail.com") */
export function emailComparavel(e: string | null | undefined): string | null {
  const s = String(e ?? "").trim().toLowerCase();
  const i = s.lastIndexOf("@");
  if (i < 1) return null;
  let local = s.slice(0, i).split("+")[0];
  let dom = s.slice(i + 1);
  if (dom === "googlemail.com") dom = "gmail.com";
  if (dom === "gmail.com") local = local.replace(/\./g, "");
  return local ? `${local}@${dom}` : null;
}

export type QuemIndica = {
  id: string; pausado: boolean; email: string | null; comprador_email: string | null; comprador_user_id: string | null;
  aparelho: string | null; pix_chave: string | null; pix_tipo: string | null;
  /** IP e digital do cartão da COMPRA de quem indica (gravados no indique_link) */
  ip?: string | null; cartao_fp?: string | null;
};
export type VendaWeb = {
  pi: string; valorCents: number; email: string | null; userId: string | null; aparelho: string | null; cpf: string | null;
  /** a conta já tinha o vitalício (creditarPedido "preservado") — pagou de novo, não é cliente novo */
  jaEraCliente: boolean;
  /** "pix" | "card" (da cobrança na Stripe); sem saber = trata como cartão (carência longa) */
  metodo?: string | null;
  /** digital do cartão (payment_method_details.card.fingerprint) e IP do checkout */
  cartaoFp?: string | null; ip?: string | null;
  /** 18/11 (/escolha): comissão FIXA (no lugar dos 50% do valor pago) e o nome do produto no afiliado_vendas */
  comissaoFixaCents?: number; produto?: string;
};
/**
 * pago + motivo "revisar_*" = conta, mas o Pix dessa semana fica SEGURADO pro dono olhar (mesmo aparelho ou mesmo IP pode ser
 * a amiga comprando no celular de quem indicou — não dá pra recusar no escuro).
 */
export type Decisao = { status: "pago" | "recusado"; motivo: string | null; comissao_cents: number; liberaDias: number };

const igual = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function decidirIndicacao(q: QuemIndica, v: VendaWeb): Decisao {
  const liberaDias = diasParaLiberar(v.metodo);
  const trava = (motivo: string): Decisao => ({ status: "recusado", motivo, comissao_cents: 0, liberaDias });
  const ev = emailComparavel(v.email);
  if (ev && (ev === emailComparavel(q.comprador_email) || ev === emailComparavel(q.email))) return trava("autoindicacao_email");
  if (v.userId && v.userId === q.comprador_user_id) return trava("autoindicacao_conta");
  if (v.cartaoFp && v.cartaoFp === q.cartao_fp) return trava("autoindicacao_cartao");
  const cpf = v.cpf ? soDigitosCpf(v.cpf) : "";
  if (cpf && q.pix_tipo === "CPF" && cpf === q.pix_chave) return trava("autoindicacao_cpf");
  if (q.pix_tipo === "EMAIL" && ev && ev === emailComparavel(q.pix_chave)) return trava("autoindicacao_pix");
  if (v.jaEraCliente) return trava("ja_era_cliente");
  if (v.valorCents <= 0) return trava("sem_valor");
  const comissao = typeof v.comissaoFixaCents === "number" && v.comissaoFixaCents > 0 ? Math.round(v.comissaoFixaCents) : comissaoWebCents(v.valorCents);
  if (v.aparelho && v.aparelho === q.aparelho) return { status: "pago", motivo: "revisar_aparelho", comissao_cents: comissao, liberaDias };
  if (v.ip && v.ip === q.ip) return { status: "pago", motivo: "revisar_ip", comissao_cents: comissao, liberaDias };
  return { status: "pago", motivo: null, comissao_cents: comissao, liberaDias };
}

/* ───────── banco (cliente injetado) ───────── */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
type Erro = { code?: string; message?: string } | null;
const COLUNAS_QUEM = "id, pausado, email, comprador_email, comprador_user_id, aparelho, ip, cartao_fp, pix_chave, pix_tipo";

/**
 * Grava a venda indicada (1× por PaymentIntent). Só códigos de COMPRADOR (origem "comprador") — o código de influenciadora da
 * App Store não vale na web. Erro de banco → lança (quem chama, o webhook, transforma em alarme pro dono sem segurar a compra).
 */
export async function registrarIndicacaoWeb(admin: ClienteMin, indicador: string | null | undefined, v: VendaWeb, agora: Date): Promise<{ r: "sem_indicador" | "codigo_desconhecido" | "ja" | "gravada" | "estornada"; status?: string; motivo?: string | null }> {
  const codigo = normalizarIndicador(indicador);
  if (!codigo) return { r: "sem_indicador" };
  const { data: q, error: e1 } = await admin.from("afiliados").select(COLUNAS_QUEM).eq("codigo", codigo).eq("origem", "comprador").maybeSingle();
  if (e1) throw new Error(`indique_ler: ${(e1 as Erro)?.message ?? e1}`);
  if (!q) return { r: "codigo_desconhecido" };
  const { data: ja, error: e2 } = await admin.from("afiliado_vendas").select("id").eq("transaction_id", v.pi).maybeSingle();
  if (e2) throw new Error(`indique_ler_venda: ${(e2 as Erro)?.message ?? e2}`);
  if (ja) return { r: "ja" };
  const d = decidirIndicacao(q as QuemIndica, v);
  const { error } = await admin.from("afiliado_vendas").insert({
    afiliado_id: (q as QuemIndica).id, user_id: v.userId, plataforma: "web", transaction_id: v.pi, transaction_id_cobranca: v.pi,
    produto: v.produto ?? (v.metodo === "pix" ? "web_oferta_pix" : "web_oferta_cartao"), valor_bruto_cents: v.valorCents, valor_liquido_cents: v.valorCents,
    comissao_cents: d.comissao_cents, status: d.status, motivo: d.motivo, cobrado_em: agora.toISOString(),
    libera_em: new Date(agora.getTime() + d.liberaDias * 86400e3).toISOString(),
    comprador_email_hash: v.email ? await hashEmail(emailComparavel(v.email) ?? v.email) : null,
  });
  if (error && (error as Erro)?.code !== "23505") throw new Error(`indique_gravar: ${(error as Erro)?.message ?? error}`);
  if (error) return { r: "ja" };
  // revisão 23/11 B7: o estorno pode ter corrido ANTES desta linha existir (e não achou nada pra cancelar) — a marca do estorno decide
  const { data: estorno } = await admin.from("webhook_events").select("id").eq("id", `stripe-estorno:${v.pi}`).maybeSingle();
  if (estorno) {
    await admin.from("afiliado_vendas").update({ status: "reembolsado", motivo: "reembolso" }).eq("transaction_id", v.pi);
    return { r: "estornada", status: "reembolsado", motivo: "reembolso" };
  }
  return { r: "gravada", status: d.status, motivo: d.motivo };
}

/**
 * Reembolso / contestação do PaymentIntent `pi`:
 *  - a venda indicada por ele vira `reembolsado` (comissão não entra no Pix; se o Pix já saiu, fica marcado pro dono ver);
 *  - se `pi` é a COMPRA de quem indica, o link dela é pausado (pediu o dinheiro de volta = sai do programa) — a não ser que
 *    a mesma conta tenha OUTRA compra vitalícia ativa (o estorno de uma compra em dobro não pune ninguém).
 */
export async function cancelarIndicacaoWeb(
  admin: ClienteMin, pi: string, opts: { parcial?: boolean } = {},
): Promise<{ venda: "nenhuma" | "cancelada" | "ja_paga"; pausou: boolean; comissao_cents?: number; afiliado_id?: string }> {
  const { data: v, error: e1 } = await admin.from("afiliado_vendas").select("id, status, pagamento_id, comissao_cents, afiliado_id").eq("transaction_id", pi).eq("plataforma", "web").maybeSingle();
  if (e1) throw new Error(`indique_estorno_ler: ${(e1 as Erro)?.message ?? e1}`);
  let venda: "nenhuma" | "cancelada" | "ja_paga" = "nenhuma";
  let extra: { comissao_cents?: number; afiliado_id?: string } = {};
  if (v && (v as { status: string }).status !== "reembolsado") {
    const x = v as { id: string; status: string; pagamento_id: string | null; comissao_cents?: number; afiliado_id?: string };
    let jaSaiu = false;
    if (x.pagamento_id) {
      const { data: pg } = await admin.from("afiliado_pagamentos").select("status").eq("id", x.pagamento_id).maybeSingle();
      jaSaiu = ["enviado", "enviando"].includes(String((pg as { status?: string } | null)?.status ?? ""));
    }
    // críticas 17/11: QUALQUER devolução (inteira ou parcial) cancela a comissão — a regra mais simples, e nunca paga 50% de uma
    // venda que rendeu menos. Se o Pix já saiu, a venda vira dívida: o próximo Pix do mesmo link desconta (descontarDividas).
    const motivo = jaSaiu ? MOTIVO_DIVIDA : opts.parcial ? "reembolso_parcial" : "reembolso";
    const { error } = await admin.from("afiliado_vendas").update({ status: "reembolsado", motivo }).eq("id", x.id);
    if (error) throw new Error(`indique_estorno: ${(error as Erro)?.message ?? error}`);
    venda = jaSaiu ? "ja_paga" : "cancelada";
    extra = { comissao_cents: Number(x.comissao_cents ?? 0), afiliado_id: x.afiliado_id };
  }
  // estorno PARCIAL da compra de quem indica não tira ninguém do programa (ela continua com o CORE)
  if (opts.parcial) return { venda, pausou: false, ...extra };
  const { data: quem, error: e3 } = await admin.from("afiliados").select("id, comprador_user_id").eq("comprador_pi", pi).maybeSingle();
  if (e3) throw new Error(`indique_pausar_ler: ${(e3 as Erro)?.message ?? e3}`);
  let pausou = false;
  if (quem) {
    const q = quem as { id: string; comprador_user_id: string | null };
    let outraCompra = false;
    if (q.comprador_user_id) {
      const { data: outras } = await admin.from("subscriptions").select("id").eq("user_id", q.comprador_user_id).eq("status", "active").eq("plan", "lifetime").neq("abacatepay_billing_id", pi).limit(1);
      outraCompra = Array.isArray(outras) && outras.length > 0;
    }
    if (!outraCompra) {
      const { error } = await admin.from("afiliados").update({ pausado: true }).eq("id", q.id);
      if (error) throw new Error(`indique_pausar: ${(error as Erro)?.message ?? error}`);
      pausou = true;
    }
  }
  return { venda, pausou, ...extra };
}

/* ───────── críticas da subida 17/11: dívida, reprocessar e limite por IP ───────── */

/** a venda devolvida DEPOIS de o Pix da comissão sair (dívida de quem indicou) e a mesma venda depois de descontada num Pix */
export const MOTIVO_DIVIDA = "reembolso_depois_do_pix";
export const MOTIVO_DIVIDA_DESCONTADA = "reembolso_descontado";

export type PlanoComDivida = { afiliado_id: string; total_cents: number; vendas_ids: string[]; decisao: string; motivo: string | null };
export type Divida = { id: string; afiliado_id: string; comissao_cents: number };
/**
 * Desconta do Pix desta semana as comissões devolvidas DEPOIS de um Pix (MOTIVO_DIVIDA) do MESMO link. Mexe nos planos no lugar
 * e devolve os ids das dívidas que entraram (quem chama marca MOTIVO_DIVIDA_DESCONTADA depois de criar o pagamento).
 *  - dívida < total: o Pix sai com o desconto; as dívidas entram em vendas_ids (o /admin e o liberar_pagamento enxergam o desconto);
 *  - dívida ≥ total: a semana fica SEGURADA (motivo "divida_reembolso") pro dono decidir — nada sai sozinho.
 */
export function descontarDividas(planos: PlanoComDivida[], dividas: Divida[]): string[] {
  const usadas: string[] = [];
  for (const p of planos) {
    if (p.decisao === "pausado") continue;
    const minhas = dividas.filter((d) => d.afiliado_id === p.afiliado_id && d.comissao_cents > 0);
    if (!minhas.length) continue;
    const total = minhas.reduce((s, d) => s + d.comissao_cents, 0);
    if (total >= p.total_cents) { p.decisao = "segurar"; p.motivo = "divida_reembolso"; continue; }
    p.total_cents -= total;
    p.vendas_ids = [...p.vendas_ids, ...minhas.map((d) => d.id)];
    p.motivo = p.motivo ? `${p.motivo}+desconto_reembolso` : "desconto_reembolso";
    usadas.push(...minhas.map((d) => d.id));
  }
  return usadas;
}
/** o valor de um pagamento refeito (liberar_pagamento): as vendas que seguem pagas − as dívidas que foram descontadas nele */
export function valorComDesconto(vendas: Array<{ status: string; motivo?: string | null; comissao_cents: number }>): number {
  let s = 0;
  for (const v of vendas) {
    if (v.status === "pago") s += v.comissao_cents;
    else if (v.status === "reembolsado" && v.motivo === MOTIVO_DIVIDA_DESCONTADA) s -= v.comissao_cents;
  }
  return s;
}

/** o PaymentIntent lido na Stripe (com latest_charge expandido) — o que o reprocessar precisa */
export type PiParaReprocessar = {
  id?: string; status?: string; amount?: number; amount_received?: number; currency?: string; receipt_email?: string | null;
  metadata?: Record<string, string> | null;
  latest_charge?: { payment_method_details?: { type?: string; card?: { fingerprint?: string | null } | null } | null } | string | null;
};
/**
 * REPROCESSAR a comissão de uma venda da /oferta (críticas 17/11): o banco falhou na hora do webhook (alarme "comissão NÃO gravou")
 * e o reenvio da Stripe volta "duplicado". Lê o PI na Stripe (quem chama) e grava pela MESMA registrarIndicacaoWeb — idempotente
 * (índice único em transaction_id): rodar 2× não paga 2×. Usado pela action admin indique_reprocessar e pelo pagar_semana.
 */
export async function reprocessarIndicacaoWeb(admin: ClienteMin, j: PiParaReprocessar | null, agora: Date): Promise<{ r: string; status?: string; motivo?: string | null }> {
  if (!j || typeof j.id !== "string") return { r: "sem_pi" };
  const md = j.metadata ?? {};
  if (j.status !== "succeeded") return { r: "nao_pago" };
  const pagina = md.pagina ?? "oferta";
  // 18/11: e o vitalício da /escolha (comissão fixa). O mensal da /escolha não passa por aqui (a comissão dele é do 2º pagamento).
  if (pagina !== "oferta" && pagina !== OFERTAS_STRIPE.planos.pagina) return { r: "outra_pagina" };
  if (!md.indicador) return { r: "sem_indicador" };
  const { data: subs, error } = await admin.from("subscriptions").select("user_id, customer_email").eq("abacatepay_billing_id", j.id).eq("payment_method", "stripe").limit(1);
  if (error) throw new Error(`reprocessar_ler: ${(error as Erro)?.message ?? error}`);
  const sub = ((subs ?? []) as Array<{ user_id?: string | null; customer_email?: string | null }>)[0];
  // sem a linha DESTA compra: ou o webhook ignorou a venda, ou a conta já tinha o vitalício ("preservado") — o dono olha à mão
  if (!sub?.user_id) return { r: "sem_linha_da_compra" };
  const lc = j.latest_charge && typeof j.latest_charge === "object" ? j.latest_charge : null;
  const metodo = lc?.payment_method_details?.type ?? null;
  const fp = lc?.payment_method_details?.card?.fingerprint;
  const t = (x: unknown, n: number) => (typeof x === "string" && x.trim() && x.length <= n ? x.trim() : null);
  return await registrarIndicacaoWeb(admin, md.indicador, {
    pi: j.id, valorCents: Number(j.amount_received || j.amount || 0), email: (sub.customer_email ?? t(md.email, 254) ?? j.receipt_email ?? null),
    userId: sub.user_id, aparelho: t(md.aparelho, 64), cpf: t(md.cpf, 14), jaEraCliente: false, metodo,
    cartaoFp: typeof fp === "string" ? fp : null, ip: t(md.ip, 64),
    ...(pagina === OFERTAS_STRIPE.planos.pagina ? { comissaoFixaCents: COMISSAO_FIXA_PLANOS_CENTS, produto: "web_planos_vitalicio" } : {}),
  }, agora);
}

/**
 * Limite por IP (críticas 17/11): o indique_link consulta a Stripe com a MESMA chave do checkout — sem limite, um robô estoura o
 * limite da Stripe e derruba o stripe-criar (as vendas). Cada chamada grava 1 linha em webhook_events (id = prefixo:hash do IP:janela:
 * aleatório; o IP nunca vai cru pro banco) e conta as da janela. Banco fora → deixa passar (a venda nunca depende disto).
 */
export async function ipDentroDoLimite(
  admin: ClienteMin, prefixo: string, ip: string | null, limite: number, janelaMs: number, agoraMs: number = Date.now(),
  aleatorio: () => string = () => crypto.getRandomValues(new Uint32Array(2)).join(""),
): Promise<boolean> {
  if (!ip) return true;
  const h = (await hashEmail(`ip:${ip}`)).slice(0, 16);
  const janela = Math.floor(agoraMs / janelaMs);
  const base = `${prefixo}:${h}:${janela}`;
  try {
    const { error } = await admin.from("webhook_events").insert({ id: `${base}:${aleatorio()}`, source: "indique", event: prefixo });
    if (error) return true;
    const { count, error: e2 } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).like("id", `${base}:%`);
    if (e2 || typeof count !== "number") return true;
    return count <= limite;
  } catch { return true; }
}
/** o IP de quem chama (o mesmo jeito do stripe-criar: o 1º do x-forwarded-for) */
export const ipDaRequisicao = (h: { get(n: string): string | null }): string | null => {
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || (h.get("x-real-ip") ?? "").trim();
  return ip && ip.length <= 64 ? ip : null;
};

/* ───────── quem pode pegar o link pelo app (17/11, subida) ───────── */

/**
 * O CAMINHO no app até a entrada (o mesmo texto no pós-pago, no painel, nos e-mails e no aviso "Novo"). No site, a aba Você
 * (Home nova) e o menu da sua inicial no topo (Home clássica) são a mesma página "Você" — os dois mostram a linha.
 */
export const CAMINHO_NO_APP = "Você → Indique e ganhe";
/**
 * Críticas da subida 17/11 (persona): quem comprou no iPhone usa o app da App Store, onde o indique NÃO aparece — "Você → Indique e
 * ganhe" mandava procurar o que não existe. O caminho principal agora é um ENDEREÇO que funciona sem login, em qualquer aparelho
 * (a página /indique: digita o e-mail e recebe o painel). O caminho dentro do CORE vira a 2ª linha, só pro computador.
 */
export const ENDERECO_RECUPERAR = "coreaplicativo.com.br/indique";
export const FRASE_RECUPERAR = `Perdeu o link? Entre em ${ENDERECO_RECUPERAR} e digite seu e-mail.`;
export const FRASE_CAMINHO = `ou, no computador: ${CAMINHO_NO_APP}`;

/** a chave do link de quem indica pela CONTA (cliente pagante que não comprou na /oferta): mora em comprador_pi (índice único) */
export const chaveLinkDaConta = (userId: string): string => `conta:${userId}`;

export type LinhaAssinatura = {
  status?: string | null; payment_method?: string | null; billing_period?: string | null; plan?: string | null;
  amount_cents?: number | null; current_period_start?: string | null; current_period_end?: string | null;
};
const STATUS_PAGANTE = ["active", "past_due", "cancel_scheduled"];
/** o teste grátis das lojas (3 dias) chega como "active" com o período de teste: início → fim em menos de 8 dias */
const DIAS_MAX_TESTE_LOJA = 8;

/**
 * CLIENTE PAGANTE? (a entrada "Indique e ganhe" do app na web e o indique_conta usam ESTA regra — web, Pix, cartão, loja).
 * Conta: assinatura viva (active/past_due/cancel_scheduled, vitalício ou com fim no futuro) que custou dinheiro.
 * NÃO conta: código grátis (payment_method "codigo" ou valor 0) e o teste grátis da loja (play_store, não vitalício, período
 * de menos de 8 dias — o RevenueCat grava o teste como "active"; depois da 1ª cobrança o início fica e o fim vai pra 1 mês/1 ano).
 */
export function ehPagante(linhas: LinhaAssinatura[] | null | undefined, agora: Date = new Date()): boolean {
  return (linhas ?? []).some((l) => {
    if (!l || !STATUS_PAGANTE.includes(String(l.status ?? ""))) return false;
    if (l.payment_method === "codigo") return false;
    if (typeof l.amount_cents === "number" && l.amount_cents <= 0) return false;
    const vitalicio = l.billing_period === "lifetime" || l.plan === "lifetime";
    const fim = l.current_period_end ? new Date(l.current_period_end).getTime() : null;
    if (!vitalicio && fim != null && Number.isFinite(fim) && fim <= agora.getTime()) return false;
    if (!vitalicio && l.payment_method === "play_store" && fim != null && l.current_period_start) {
      const ini = new Date(l.current_period_start).getTime();
      if (Number.isFinite(ini) && fim - ini < DIAS_MAX_TESTE_LOJA * 86400e3) return false;
    }
    return true;
  });
}

/** O PaymentIntent prova a compra de quem pede o link: mesma ref da aba, /oferta, pago. */
export function compraValeLink(pi: { id?: unknown; status?: unknown; metadata?: Record<string, unknown> | null } | null, ref: string): boolean {
  if (!pi || typeof pi.id !== "string") return false;
  const md = pi.metadata ?? {};
  // 18/11: o vitalício da /escolha também dá link (o mensal não: o link é de quem comprou o vitalício)
  const pagina = md.pagina ?? "oferta";
  return pi.status === "succeeded" && md.ref === ref && (pagina === "oferta" || pagina === OFERTAS_STRIPE.planos.pagina);
}

/**
 * O LINK PELA CONTA (17/11, subida) — a entrada "Indique e ganhe" do app NA WEB vale pra QUALQUER cliente pagante logado (web,
 * Pix, cartão ou loja), não só pra quem comprou na /oferta. 1 link por conta (comprador_pi = "conta:<uid>", o mesmo índice único
 * das compras). A prova é o login (o JWT, conferido por quem chama). Sem aparelho/IP/cartão da compra: as travas de
 * autoindicação que valem aqui são a conta e o e-mail (e a chave Pix ≠ e-mail de quem comprou).
 */
export type LinkDaConta = { codigo: string; token_painel: string; pausado?: boolean; novo: boolean };
const COLUNAS_SUB_PAGANTE = "status, payment_method, billing_period, plan, amount_cents, current_period_start, current_period_end";

/** um link de quem indica que esta conta JÁ tem (da /oferta ou pela conta), não pausado — o mais antigo */
export async function linkJaDaConta(admin: ClienteMin, userId: string): Promise<LinkDaConta | null> {
  const { data } = await admin.from("afiliados").select("codigo, token_painel, pausado").eq("origem", "comprador").eq("comprador_user_id", userId).eq("pausado", false).order("criado_em", { ascending: true }).limit(1);
  const l = ((data ?? []) as Array<{ codigo: string; token_painel: string; pausado: boolean }>)[0];
  return l ? { ...l, novo: false } : null;
}

export async function linkDaContaPagante(
  admin: ClienteMin, userId: string, email: string | null, agora: Date, gerar: { codigo: () => string; token: () => string },
): Promise<LinkDaConta | "nao_pagante" | null> {
  const chave = chaveLinkDaConta(userId);
  const { data: ja } = await admin.from("afiliados").select("codigo, token_painel, pausado").eq("comprador_pi", chave).maybeSingle();
  if (ja) return { ...(ja as { codigo: string; token_painel: string; pausado: boolean }), novo: false };
  const { data: subs, error: e1 } = await admin.from("subscriptions").select(COLUNAS_SUB_PAGANTE).eq("user_id", userId);
  if (e1) return null;
  if (!ehPagante((subs ?? []) as LinhaAssinatura[], agora)) return "nao_pagante";
  const em = String(email ?? "").trim().toLowerCase() || null;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { data, error } = await admin.from("afiliados").insert({
      nome: "Indicação web", codigo: gerar.codigo(), email: null, pix_chave: null, pix_tipo: null, token_painel: gerar.token(), origem: "comprador",
      comprador_pi: chave, comprador_user_id: userId, comprador_email: em, aparelho: null, ip: null, cartao_fp: null, limite_semanal_cents: LIMITE_SEMANAL_PADRAO_CENTS,
    }).select("codigo, token_painel").single();
    if (!error && data) return { ...(data as { codigo: string; token_painel: string }), novo: true };
    if ((error as Erro)?.code !== "23505") return null;
    // conflito: outra aba criou o link desta conta ao mesmo tempo → devolve o dela; senão foi o código → sorteia outro
    const { data: corrida } = await admin.from("afiliados").select("codigo, token_painel, pausado").eq("comprador_pi", chave).maybeSingle();
    if (corrida) return { ...(corrida as { codigo: string; token_painel: string; pausado: boolean }), novo: false };
  }
  return null;
}

/** A mensagem pronta do WhatsApp (o mesmo texto na página e no painel). */
export const mensagemWhatsapp = (link: string): string =>
  `Tô usando o CORE pra organizar minha vida (finanças, rotina, treino, tudo num app só). Tá valendo muito. Se quiser, é por aqui: ${link}`;

/**
 * 17/11: o bloco "Indique e ganhe" do e-mail de ACESSO da /oferta (o que todo comprador já recebe; entra depois dos passos de entrar).
 * Não tem link pessoal (a compra acabou de acontecer): leva pra /indique, onde ela digita o e-mail e recebe o painel. Env INDIQUE_EMAIL.
 */
export function blocoIndiqueEmail(): string {
  return `<div style="margin:18px 0 0;padding:16px 16px 14px;border-radius:16px;background:#fdeef5;border:1px solid #f4c6dc;">` +
    `<p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c42a73;">Indique e ganhe</p>` +
    `<p style="margin:6px 0 0;font-size:18px;font-weight:900;line-height:1.2;color:#17111c;">Ganhe ${reaisBr(COMISSAO_POR_AMIGA_CENTS)} por amiga</p>` +
    `<p style="margin:6px 0 0;font-size:14px;line-height:1.45;color:#3d3545;">50% de cada compra feita pelo seu link, <b>sem limite de amigas</b>. Ela paga o mesmo preço; você recebe no Pix.</p>` +
    `<p style="margin:12px 0 0;"><a href="${SITE}/indique?utm_source=email&amp;utm_medium=acesso" style="display:inline-block;background:#17111c;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 18px;border-radius:999px;">Pegar meu link</a></p>` +
    `<p style="margin:12px 0 0;font-size:13px;line-height:1.45;color:#3d3545;" data-caminho="indique">Perdeu o link? Entre em <a href="${SITE}/indique" style="color:#c42a73;font-weight:700;">${ENDERECO_RECUPERAR}</a> e digite seu e-mail. ${FRASE_CAMINHO.charAt(0).toUpperCase()}${FRASE_CAMINHO.slice(1)}.</p></div>`;
}
