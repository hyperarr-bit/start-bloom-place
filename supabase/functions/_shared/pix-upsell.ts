/**
 * O PIX DE UPSELL DE 24 H, UM POR COMPRA (31/10, PLANO.md §0 — novidades-guardadas/2026-10-31/upsell-2027-presente).
 *
 * Por que existe (lp-web/ticket/RELATORIO.md): o "Seu 2027" teve 52 pessoas vendo → 20 "Quero" → 3 pagas. Quem matou a
 * venda foi o 2º Pix gerado do zero (15% pagos contra ~50% do Pix principal) e o código que morria em 30 min. Aqui:
 *   · os Pix de upsell DOS CAMINHOS NOVOS (este `garantirPixUpsell`: a /organizar, o e-mail de compra e o dia 3) valem
 *     24 h (`expiraSegundos`). O create antigo do asaas-pix (o /hoje e o /inicio, no ar) segue em 30 min pra TODA oferta,
 *     inclusive u2027/pv149 (crítica r1: o PixHoje mostrava "vale por 1439:59") — o vitalício, os LN_*, o w27 não mudam;
 *   · UM Pix por chave (`garantirPixUpsell`): a página (pré-aquecido ao mostrar a oferta) e o e-mail de compra
 *     confirmada recebem O MESMO código — `u2027:<pedido do vitalício>`. A chave é reservada ANTES de criar o QR
 *     (corrida página × e-mail = 1 QR só) e o registro `pix_order_created` sai com `user_id = dono` (a conta FINAL),
 *     que é o elo que o check, o webhook e o reconcile usam pra creditar o pacote;
 *   · nenhum Pix de upsell manda Purchase pra Meta (`META_PURCHASE_UPSELL = false`, RECOMENDAÇÃO do relatório — ainda
 *     NÃO confirmada pelo dono, que só respondeu "Faz" à ordem 2027 → presente; a pergunta está no BUILD.md): o Purchase do
 *     vitalício continua 1 por comprador e a leitura "Meta = banco" não infla. Só a UTMify recebe (pra receita aparecer
 *     no painel), nos 3 caminhos (o reconcile também, desde a crítica r1). Voltar atrás = trocar pra `true` (o event_id
 *     seria o id do QR do upsell, diferente do do vitalício). Vale também pro /hoje e o /inicio (no ar);
 *   · o bloco do 2027 no e-mail de compra confirmada (`blocoU2027`, secret `UPSELL_2027_EMAIL=on`) e o e-mail curto
 *     "Pronto, seu 2027 tá no seu CORE" (1 por pedido).
 *
 * Sem Deno: o banco é uma interface mínima e o QR da Asaas é injetado (`criarQr`) — testado no vitest com banco falso
 * (src/test/pix-upsell.test.ts). O QR de verdade mora em ./asaas-qr.ts.
 */
import { OFERTA_2027, PRECOS_HOJE, eh2027 } from "./ofertas-hoje.ts";
import { ehOfertaPresente, presentePorPedido } from "./presente.ts";
import { ehOfertaLanding } from "./ofertas-landing.ts";
import { registroDoPedido } from "./registro-pedido.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

/* ───────────────────────── validade ───────────────────────── */

export const EXPIRA_PADRAO_S = 1800; // 30 min — o Pix de venda (vitalício, LN_*, w27…): o mesmo prazo de sempre
export const EXPIRA_UPSELL_S = 86_400; // 24 h — o Pix de upsell (pago depois, no app do banco, às vezes no dia seguinte)
/** Os Pix de upsell (pós-compra): o "Seu 2027" e o presente. */
export const ehPixUpsell = (o: string | null | undefined): boolean => eh2027(o) || ehOfertaPresente(o);
/** O `expirationSeconds` do QR estático da Asaas pra esta oferta. */
export const expiraSegundos = (oferta: string | null | undefined): number => (ehPixUpsell(oferta) ? EXPIRA_UPSELL_S : EXPIRA_PADRAO_S);
/** Pix guardado com menos que isso de validade não é reaproveitado (a pessoa precisa de tempo pra pagar). */
export const REUSO_MIN_MS = 2 * 3600e3;

/**
 * O pix-reconcile consulta este pedido de upsell AGORA? (crítica r1: o Pix pré-aquecido nasce pra todo comprador que VÊ a
 * oferta e vale 24 h — consultar cada um a cada 15 min por 48 h eram 192 consultas na Asaas por pedido, na cota do
 * checkout do vitalício). Nas 2 primeiras horas, sempre (a hora em que quem quis paga); depois, 1 vez por hora (a
 * passada cujo bloco de 15 min é múltiplo de 4). Pedido sem `upsell_chave` (o /hoje, o /inicio): sempre, como antes.
 */
export function consultarUpsellAgora(criadoEm: string, temChave: boolean, agora: number = Date.now()): boolean {
  if (!temChave) return true;
  const t = Date.parse(criadoEm);
  if (!Number.isFinite(t) || agora - t <= 2 * 3600e3) return true;
  return Math.floor(agora / 900e3) % 4 === 0;
}

/* ───────────────────────── pixel ───────────────────────── */

/** RECOMENDAÇÃO (31/10, relatório do upsell): o upsell NÃO manda Purchase pra Meta. CONFIRMAR COM O DONO antes do deploy. */
export const META_PURCHASE_UPSELL = false;
/** Esta oferta manda Purchase pra Meta quando é confirmada? (o vitalício e os planos sempre; os upsells, pela chave) */
export const mandaPurchaseMeta = (oferta: string | null | undefined): boolean => !ehPixUpsell(oferta) || META_PURCHASE_UPSELL;

/* ───────────────────────── preço ───────────────────────── */

/** R$ 19,90 (31/10 tarde, dono). A fonte é o PRECOS_HOJE (as 3 funções espalham o mapa). */
export const PRECO_U2027_CENTAVOS = PRECOS_HOJE[OFERTA_2027];
export const reais = (centavos: number): string => `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;

/* ───────────────────────── um Pix por chave ───────────────────────── */

export const chavePixUpsell = (chave: string): string => `up-qr:${chave}`;
/** A chave do 2027: a compra do vitalício (página e e-mail = o mesmo código). */
export const chaveU2027 = (compra: string): string => `u2027:${compra}`;
/** A chave do presente do dia 3 (o e-mail e a página /presente/dar). */
export const chavePresenteDia3 = (userId: string): string => `pv149-d3:${userId}`;
/**
 * 01/11: a chave do presente NO PÓS-PAGO da /organizar (UPSELL_POS = "presente" no landing.html): 1 Pix por compra do
 * vitalício, 24 h — separada da do dia 3 (o cron do dia 3 já pula quem comprou um presente: `ja_comprou`).
 */
export const chavePresenteLanding = (compra: string): string => `pv149-lp:${compra}`;

export type PixUpsell = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string; dono: string; oferta: string; novo: boolean };
export type QrCriado = { id: string; payload: string; encodedImage?: string | null; expirationDate?: string | null };
/** Cria o QR estático na Asaas (injetado: ./asaas-qr.ts no Deno, falso no teste). null = falhou. */
export type CriarQr = (a: { descricao: string; valorCentavos: number; expiraSegundos: number; ref: string }) => Promise<QrCriado | null>;
export type FalhaPixUpsell = { erro: "ocupado" | "qr" | "ponte" | "reserva" };

/** `anteriores` (crítica r2): os QRs desta chave que foram trocados (menos de 2 h de validade) — continuam pagáveis; quem
 *  confere a página olha eles também (o dia 3: um presente pago pelo código antigo copiado não vira 2º pagamento). Até 3. */
type Guardado = { orderId: string; payload: string; expiresAt: string; dono: string; oferta: string; anteriores?: string[] };
export const MAX_ANTERIORES = 3;
const RESERVA = "reservando:";
/** Uma reserva mais velha que isso é de um create que morreu no meio (a próxima chamada assume). */
export const RESERVA_VELHA_MS = 25_000;

const lerGuardado = (event: unknown): Guardado | null => {
  if (typeof event !== "string" || !event.startsWith("{")) return null;
  try {
    const g = JSON.parse(event) as Partial<Guardado>;
    return g && typeof g.orderId === "string" && typeof g.payload === "string" && typeof g.expiresAt === "string" && typeof g.dono === "string" && typeof g.oferta === "string" ? (g as Guardado) : null;
  } catch { return null; }
};
const reservaDe = (event: unknown): number | null => {
  if (typeof event !== "string" || !event.startsWith(RESERVA)) return null;
  const t = Number(event.slice(RESERVA.length));
  return Number.isFinite(t) ? t : 0;
};

/** "2026-07-21 16:30:00" (Brasília, o formato da Asaas) → ISO com offset. */
export const paraIso = (dataAsaas?: string | null): string | null => {
  if (!dataAsaas) return null;
  const t = String(dataAsaas).trim().replace(" ", "T");
  return /Z|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}-03:00`;
};
const imagemDe = (b?: string | null): string | null =>
  typeof b === "string" && b.length ? (b.startsWith("data:") ? b : `data:image/png;base64,${b}`) : null;

async function lerLinha(admin: ClienteMin, id: string): Promise<{ existe: boolean; event: unknown }> {
  const { data } = await admin.from("webhook_events").select("id, event").eq("id", id);
  const l = Array.isArray(data) ? data[0] : data;
  return l ? { existe: true, event: (l as { event?: unknown }).event } : { existe: false, event: null };
}

/**
 * O Pix de upsell desta chave: devolve o que já existe (mesmo dono e oferta, ≥ 2 h de validade) ou cria UM novo.
 * Corrida (a página pré-aquecendo e o webhook montando o e-mail ao mesmo tempo): quem reserva primeiro cria; o outro
 * espera a reserva virar Pix e devolve o mesmo. Nunca lança.
 */
export async function garantirPixUpsell(admin: ClienteMin, a: {
  chave: string; dono: string; oferta: string; valorCentavos: number; descricao: string; criarQr: CriarQr;
  /** campos extras no pix_order_created (fbp/fbc/IP/UA da página; o e-mail não tem) */
  extraPedido?: Record<string, unknown>;
  agora?: () => number; esperar?: (ms: number) => Promise<void>; tentativas?: number;
}): Promise<PixUpsell | FalhaPixUpsell> {
  const agora = a.agora ?? (() => Date.now());
  const esperar = a.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));
  const id = chavePixUpsell(a.chave);
  try {
    for (let volta = 0; volta < (a.tentativas ?? 12); volta++) {
      const l = await lerLinha(admin, id);
      const g = lerGuardado(l.event);
      if (g && g.dono === a.dono && g.oferta === a.oferta && Date.parse(g.expiresAt) - agora() > REUSO_MIN_MS) {
        return { orderId: g.orderId, qrCode: g.payload, qrCodeBase64: null, expiresAt: g.expiresAt, dono: g.dono, oferta: g.oferta, novo: false };
      }
      const r = reservaDe(l.event);
      if (r !== null && agora() - r < RESERVA_VELHA_MS) { await esperar(400); continue; } // outro caminho está criando
      // o QR que vai ser trocado (mesmo dono e oferta, perto de vencer) ainda pode ser pago: guarda o id
      const anteriores = g && g.dono === a.dono && g.oferta === a.oferta
        ? [g.orderId, ...(Array.isArray(g.anteriores) ? g.anteriores.filter((x) => typeof x === "string") : [])].slice(0, MAX_ANTERIORES)
        : [];
      // reserva: linha nova (insert) ou troca da velha/vencida/de outro dono (update condicionado ao valor lido)
      const marca = `${RESERVA}${agora()}`;
      let reservou = false;
      if (!l.existe) {
        const { error } = await admin.from("webhook_events").insert({ id, source: "upsell", event: marca });
        reservou = !error;
      } else {
        const { data, error } = await admin.from("webhook_events").update({ event: marca }).eq("id", id).eq("event", l.event).select("id");
        reservou = !error && Array.isArray(data) && data.length > 0;
      }
      if (!reservou) continue; // alguém passou na frente: lê de novo
      const soltar = () => admin.from("webhook_events").delete().eq("id", id).eq("event", marca).then(() => {}, () => {});

      const qr = await a.criarQr({ descricao: a.descricao, valorCentavos: a.valorCentavos, expiraSegundos: expiraSegundos(a.oferta), ref: `${a.dono}:${a.oferta}` }).catch(() => null);
      if (!qr?.id || !qr.payload) { await soltar(); return { erro: "qr" }; }
      const { error: pontErr } = await admin.from("analytics_events").insert({
        event_name: "pix_order_created", user_id: a.dono,
        event_data: { order_id: qr.id, offer: a.oferta, amount_cents: a.valorCentavos, gateway: "asaas", upsell_chave: a.chave, ...(a.extraPedido ?? {}) },
      });
      // sem a ponte o pagamento não tem dono (ninguém credita): melhor não entregar o QR
      if (pontErr) { await soltar(); return { erro: "ponte" }; }
      const expiresAt = paraIso(qr.expirationDate) ?? new Date(agora() + expiraSegundos(a.oferta) * 1000).toISOString();
      const guardado: Guardado = { orderId: qr.id, payload: String(qr.payload).slice(0, 1000), expiresAt, dono: a.dono, oferta: a.oferta, ...(anteriores.length ? { anteriores } : {}) };
      await admin.from("webhook_events").update({ event: JSON.stringify(guardado) }).eq("id", id).then(() => {}, () => {});
      return { orderId: qr.id, qrCode: guardado.payload, qrCodeBase64: imagemDe(qr.encodedImage), expiresAt, dono: a.dono, oferta: a.oferta, novo: true };
    }
    return { erro: "ocupado" };
  } catch {
    return { erro: "reserva" };
  }
}

/**
 * 01/11 (presente na /organizar): o presente DESTA chave já foi pago? O QR guardado (ou um dos anteriores, ainda pagáveis)
 * virou um código na tabela presentes, do mesmo dono → { pedido, codigo, de }. A página volta direto pro cartão do WhatsApp
 * (nunca um 2º Pix de presente pra quem já pagou e perdeu a aba). Nunca lança: falha = null (a página segue pro Pix).
 */
export async function presentePagoDaChave(admin: ClienteMin, chave: string, dono: string): Promise<{ pedido: string; codigo: string; de: string | null } | null> {
  try {
    const g = lerGuardado((await lerLinha(admin, chavePixUpsell(chave))).event);
    if (!g || g.dono !== dono) return null;
    const pedidos = [g.orderId, ...(Array.isArray(g.anteriores) ? g.anteriores.filter((x) => typeof x === "string") : [])].slice(0, MAX_ANTERIORES + 1);
    for (const pedido of pedidos) {
      const p = await presentePorPedido(admin, pedido);
      if (p && p.comprador_id === dono) return { pedido, codigo: p.codigo, de: p.de_nome ?? null };
    }
    return null;
  } catch { return null; }
}

/* ───────────────────────── a compra do vitalício → o dono do 2027 ───────────────────────── */

export type CompraDoUpsell =
  | { ok: true; dono: string; pagador: string; oferta: string; jaTemPacote: boolean }
  | { ok: false; motivo: "sem_compra" | "oferta" | "sem_linha" };

/**
 * De quem é o 2027 desta compra? A conta FINAL = a dona da linha VIVA do vitalício hoje (o pix-vincular e o e-mail de
 * destino levam a linha pra outra conta; o pacote tem que ir pra lá, nunca pra anônima). `pagador` = quem gerou o Pix
 * do vitalício (a sessão anônima que pagou). Só compras da landing (LN_*).
 */
export async function compraDoUpsell(admin: ClienteMin, compra: string): Promise<CompraDoUpsell> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(compra)) return { ok: false, motivo: "sem_compra" };
  // o registro do create, pelo helper de segurança (linhas que discordam = ninguém leva)
  const reg = (await registroDoPedido(admin, compra))[0];
  if (!reg?.user_id) return { ok: false, motivo: "sem_compra" };
  const oferta = String((reg.event_data as { offer?: unknown } | null)?.offer ?? "");
  if (!ehOfertaLanding(oferta)) return { ok: false, motivo: "oferta" };
  const { data: subs } = await admin.from("subscriptions").select("user_id, status").eq("abacatepay_billing_id", compra).eq("status", "active").limit(1);
  const linha = (Array.isArray(subs) ? subs[0] : subs) as { user_id?: string } | undefined;
  if (!linha?.user_id) return { ok: false, motivo: "sem_linha" };
  const { data: pac } = await admin.from("user_data").select("value").eq("user_id", linha.user_id).eq("key", "core-pacote-2027").maybeSingle();
  const jaTemPacote = !!(pac as { value?: { comprado?: unknown } } | null)?.value && (pac as { value: { comprado?: unknown } }).value.comprado === true;
  return { ok: true, dono: linha.user_id, pagador: reg.user_id, oferta, jaTemPacote };
}

/** A sessão pode pedir o 2027 desta compra? (é a dona da linha, ou a anônima que pagou e teve a compra levada) */
export const sessaoPodePedir = (c: Extract<CompraDoUpsell, { ok: true }>, sessao: string): boolean => c.dono === sessao || c.pagador === sessao;

/**
 * A conta que recebe o 2027 NA HORA DO PAGAMENTO (crítica r1): o QR guarda o dono do momento em que foi criado, mas a
 * linha do vitalício pode ter ido pra outra conta depois (pix-vincular / e-mail de destino). Pedido com `compra` (os
 * caminhos novos) → a dona ATUAL da linha viva; sem `compra` (o /hoje, o /inicio) ou sem linha → quem está no registro.
 */
export async function donoNaHora(admin: ClienteMin, a: { registrado: string; compra?: unknown }): Promise<string> {
  if (typeof a.compra !== "string" || !a.compra) return a.registrado;
  try {
    const c = await compraDoUpsell(admin, a.compra);
    return c.ok ? c.dono : a.registrado;
  } catch { return a.registrado; }
}

/**
 * O 2027 pago DE NOVO por quem já tinha (2 QRs vivos da mesma compra: o do e-mail e um refeito; raro). O pagamento não
 * muda nada na conta — vira evento `u2027_pago_em_dobro` + chamado no /admin → Suporte (1x por pedido), pro suporte
 * devolver pela Asaas. Só quando o pacote da conta veio de OUTRO pedido (o mesmo pedido confirmado por 2 caminhos não conta).
 */
export const chaveDobro2027 = (orderId: string): string => `u2027-dobro:${orderId}`;
/** Este pedido é um 2º pagamento do 2027 (o pacote da conta veio de OUTRO pedido)? Crítica r2: aí não sai outro "Pronto". */
export async function ehDobro2027(admin: ClienteMin, a: { userId: string; orderId: string }): Promise<boolean> {
  try {
    const { data } = await admin.from("user_data").select("value").eq("user_id", a.userId).eq("key", "core-pacote-2027").maybeSingle();
    const anterior = (data as { value?: { pedido?: unknown } } | null)?.value?.pedido;
    return typeof anterior === "string" && !!anterior && anterior !== a.orderId;
  } catch { return false; }
}
export async function registrarDobro2027(admin: ClienteMin, a: { userId: string; orderId: string; amountCents: number | null }): Promise<boolean> {
  try {
    const { data } = await admin.from("user_data").select("value").eq("user_id", a.userId).eq("key", "core-pacote-2027").maybeSingle();
    const anterior = (data as { value?: { pedido?: unknown } } | null)?.value?.pedido;
    if (typeof anterior !== "string" || !anterior || anterior === a.orderId) return false;
    const { error } = await admin.from("webhook_events").insert({ id: chaveDobro2027(a.orderId), source: "upsell", event: "u2027_dobro" });
    if (error) return false;
    await admin.from("analytics_events").insert({
      user_id: a.userId, event_name: "u2027_pago_em_dobro", event_data: { order_id: a.orderId, pedido_anterior: anterior, amount_cents: a.amountCents },
    }).then(() => {}, () => {});
    await admin.from("support_tickets").insert({
      user_id: a.userId, source: "pix_em_dobro", status: "open",
      message: [
        `Seu 2027 pago em dobro · ${reais(a.amountCents ?? PRECO_U2027_CENTAVOS)}`,
        "A conta já tinha o Seu 2027; este pagamento não mudou nada na conta. Devolver pela Asaas.",
        `Pedido a devolver: ${a.orderId}`,
        `Pedido que já valia: ${anterior}`,
      ].join("\n"),
    }).then(() => {}, () => {});
    return true;
  } catch { return false; }
}

/* ───────────────────────── B. o bloco no e-mail de compra confirmada ───────────────────────── */

/** O secret do servidor: "on" liga o bloco do 2027 no e-mail de compra confirmada. Sem o secret, off. */
export const SECRET_U2027_EMAIL = "UPSELL_2027_EMAIL";
export const blocoLigado = (valor: string | null | undefined): boolean => valor === "on";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const SITE = "https://www.coreaplicativo.com.br";

/** O link que reabre o MESMO Pix na /organizar (o módulo do 2027, src/landing/upsell-2027.ts). */
export function linkU2027(a: { compra: string; pix: Pick<PixUpsell, "orderId" | "qrCode" | "expiresAt">; site?: string; origem?: string }): string {
  const q = new URLSearchParams({
    r: "u2027", compra: a.compra, pedido: a.pix.orderId, pix: a.pix.qrCode, vence: String(Date.parse(a.pix.expiresAt)),
    utm_source: a.origem ?? "email_compra", utm_medium: "email",
  });
  return `${a.site ?? SITE}/organizar?${q.toString()}`;
}

/**
 * A validade escrita a partir do `expiresAt` de verdade (o código pode ser reaproveitado com menos de 24 h — o reuso aceita
 * a partir de 2 h): "Vale por 24 h." (23 h ou mais) ou "Vale até hoje, 18h." / "Vale até amanhã, 9h30." (Brasília).
 */
export function validadeNoEmail(expiresAt: string, agora: number = Date.now()): string {
  const fim = Date.parse(expiresAt);
  if (!Number.isFinite(fim) || fim - agora >= 23 * 3600e3) return "Vale por 24 h.";
  const d = new Date(fim - 3 * 3600e3);
  const hoje = new Date(agora - 3 * 3600e3);
  const mesmoDia = d.getUTCFullYear() === hoje.getUTCFullYear() && d.getUTCMonth() === hoje.getUTCMonth() && d.getUTCDate() === hoje.getUTCDate();
  const mm = d.getUTCMinutes();
  return `Vale até ${mesmoDia ? "hoje" : "amanhã"}, ${d.getUTCHours()}h${mm ? String(mm).padStart(2, "0") : ""}.`;
}

/** Onde o pacote fica (crítica r1: o Android da loja ainda NÃO tem a aba — só o site e o iPhone 1.0.20+). */
export const ONDE_U2027_HTML = "no módulo <b>Desenvolvimento Pessoal</b>, aba <b>Seu 2027</b>. Por enquanto, no site (coreaplicativo.com.br) e no app do iPhone";

/** Crítica r2 (honestidade): o bloco vende pra todo comprador (inclusive Android) — diz onde fica ANTES do pagamento. */
export const NOTA_ONDE_EMAIL = "Por enquanto fica no site e no app do iPhone.";

/** O HTML do bloco (puro). Curto: a pergunta, o preço, "já pagou na página? ignore", o código, o botão, a validade e onde fica. */
export function htmlBlocoU2027(a: { compra: string; pix: Pick<PixUpsell, "orderId" | "qrCode" | "expiresAt">; site?: string; agora?: number }): string {
  const link = linkU2027(a);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;background:#fff7fb;border:1px solid #f3d6e6;border-radius:14px;" data-bloco="u2027"><tr><td style="padding:16px 16px 14px;">
      <div style="font-size:15px;font-weight:800;color:#16121c;margin:0 0 4px;">Quer o seu 2027 organizado?</div>
      <div style="font-size:13.5px;line-height:1.45;color:#5b5560;margin:0 0 10px;">3 metas, quanto gastar e guardar por mês, 12 revisões do mês e o cofrinho de 52 semanas. <b style="color:#16121c;">${reais(PRECO_U2027_CENTAVOS)}, uma vez</b>, sem mensalidade.</div>
      <div style="font-size:12.5px;line-height:1.45;color:#5b5560;margin:0 0 10px;" data-linha="ja-pegou">Já pagou o 2027 na página? Pode ignorar este bloco.</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a838f;text-transform:uppercase;margin:0 0 6px;">Pix copia e cola</div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.4;color:#16121c;background:#fff;border:1px dashed #e2c3d4;border-radius:8px;padding:10px;word-break:break-all;-webkit-user-select:all;user-select:all;">${esc(a.pix.qrCode)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr><td><a href="${esc(link)}" style="display:inline-block;background:#d22d80;color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:11px 18px;border-radius:999px;">Abrir o Pix</a></td></tr></table>
      <div style="font-size:12px;line-height:1.45;color:#8a838f;margin:10px 0 0;">${validadeNoEmail(a.pix.expiresAt, a.agora)} Pagou? A gente avisa por e-mail quando cair. É separado do CORE que você já pagou. ${NOTA_ONDE_EMAIL}</div>
    </td></tr></table>`;
}

/** A marca "o bloco do 2027 desta compra foi montado num e-mail" (a página só diz "o código também foi pro seu e-mail" com ela). */
export const chaveBlocoNoEmail = (compra: string): string => `u2027-email-bloco:${compra}`;
export async function blocoFoiProEmail(admin: ClienteMin, compra: string): Promise<boolean> {
  try { return (await lerLinha(admin, chaveBlocoNoEmail(compra))).existe; } catch { return false; }
}

/**
 * O bloco do 2027 pro e-mail desta compra ("" = sem bloco). Só com a chave ligada, compra da landing (LN_*) e a conta
 * ainda sem o pacote. O Pix é o MESMO da página (garantirPixUpsell, chave u2027:<compra>). Nunca lança: o e-mail de
 * compra confirmada sai de qualquer jeito.
 */
/** Crítica r2 (dinheiro 3): o bloco roda ANTES de responder o `paid` do vitalício (check, boas_vindas, webhook) — teto total. */
export const TETO_BLOCO_MS = 5000;

export async function blocoU2027(admin: ClienteMin, a: {
  ligado: boolean; compra: string; dono: string; offer: string; criarQr: CriarQr; site?: string;
  /** só testes */ tetoMs?: number; esperar?: (ms: number) => Promise<void>;
}): Promise<string> {
  if (!a.ligado || !ehOfertaLanding(a.offer) || !a.dono || !a.compra) return "";
  // crítica r2 (dinheiro 3): o e-mail de compra confirmada (e o `paid: true` da página do vitalício) não espera o QR do upsell
  // mais que TETO_BLOCO_MS. Estourou → o e-mail sai sem o bloco (o Pix, se nascer depois, é o mesmo da página).
  let estourou = false;
  const montar = async (): Promise<string> => {
    try {
      const { data: pac } = await admin.from("user_data").select("value").eq("user_id", a.dono).eq("key", "core-pacote-2027").maybeSingle();
      if ((pac as { value?: { comprado?: unknown } } | null)?.value?.comprado === true) return "";
      const pix = await garantirPixUpsell(admin, {
        chave: chaveU2027(a.compra), dono: a.dono, oferta: OFERTA_2027, valorCentavos: PRECO_U2027_CENTAVOS, descricao: "CORE seu 2027", criarQr: a.criarQr,
        extraPedido: { origem: "email_compra", compra: a.compra },
        tentativas: 2, ...(a.esperar ? { esperar: a.esperar } : {}), // crítica r2: o e-mail não espera a reserva da página por 12 × 400 ms
      });
      if ("erro" in pix || estourou) return "";
      // a marca da página ("o código também foi pro seu e-mail"): gravada quando o bloco sai montado pro e-mail. Se o envio
      // em si falhar, a marca fica (raro: o Resend fora) — aceito, ver BUILD.md (crítica r1, honestidade 5)
      await admin.from("webhook_events").insert({ id: chaveBlocoNoEmail(a.compra), source: "upsell", event: "u2027_bloco" }).then(() => {}, () => {});
      return estourou ? "" : htmlBlocoU2027({ compra: a.compra, pix, site: a.site });
    } catch { return ""; }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const teto = new Promise<string>((ok) => { timer = setTimeout(() => { estourou = true; ok(""); }, a.tetoMs ?? TETO_BLOCO_MS); });
  try { return await Promise.race([montar(), teto]); } finally { if (timer !== undefined) clearTimeout(timer); }
}

/* ───────────────────────── o e-mail "Pronto, seu 2027 tá no seu CORE" ───────────────────────── */

export const chaveEmailPronto2027 = (orderId: string): string => `u2027-email:${orderId}`;
export const assuntoPronto2027 = (): string => "Pronto, seu 2027 tá no seu CORE ✅";

export function htmlPronto2027(a: { email: string }): string {
  const e = esc(a.email);
  const item = (t: string) => `<tr><td style="vertical-align:top;padding:0 10px 8px 0;color:#1f9d55;font-weight:900;">✓</td><td style="vertical-align:top;padding:0 0 8px;font-size:15px;line-height:1.4;color:#16121c;">${t}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f3f5;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:16px;padding:26px 22px;border:1px solid #e9e2e6;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#d22d80;text-transform:uppercase;">Pagamento confirmado</div>
    <h1 style="font-size:22px;line-height:1.25;margin:10px 0 12px;">Pronto, seu 2027 tá no seu CORE.</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">
      ${item("Planejar 2027 em 5 minutos")}${item("12 revisões do mês")}${item("Cofrinho das 52 semanas")}${item("Planner 2027 pra imprimir")}
    </table>
    <p style="font-size:15px;line-height:1.5;margin:0 0 6px;color:#5b5560;">Onde fica: ${ONDE_U2027_HTML.replace(/<b>/g, '<b style="color:#16121c;">')}.</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#5b5560;">Entre com <b style="color:#16121c;">${e}</b>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:0 8px 0 0;"><a href="https://apps.apple.com/br/app/id6806913181" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#63743; App Store</a></td>
      <td><a href="https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer=utm_source%3Dweb%26utm_medium%3Demail%26utm_campaign%3Dweb_u2027_email" style="display:inline-block;background:#16121c;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;">&#9654; Google Play</a></td>
    </tr></table>
    <p style="font-size:12.5px;color:#8a838f;line-height:1.5;margin:16px 0 0;">Foi um pagamento separado de R$ 19,90, uma vez. No computador, é o mesmo CORE em coreaplicativo.com.br.</p>
  </div>
</div></body></html>`;
}

/** Manda o "Pronto" 1x por pedido (reserva antes; solta se o envio falhar). true = saiu agora. */
export async function avisarPronto2027(admin: ClienteMin, a: {
  orderId: string; para: string | null | undefined; enviar: (para: string, assunto: string, html: string) => Promise<boolean>;
}): Promise<boolean> {
  if (!a.para) return false;
  try {
    const id = chaveEmailPronto2027(a.orderId);
    const { error } = await admin.from("webhook_events").insert({ id, source: "upsell", event: "u2027_email" });
    if (error) return false;
    const foi = await a.enviar(a.para, assuntoPronto2027(), htmlPronto2027({ email: a.para })).catch(() => false);
    if (!foi) await admin.from("webhook_events").delete().eq("id", id).then(() => {}, () => {});
    return foi;
  } catch { return false; }
}
