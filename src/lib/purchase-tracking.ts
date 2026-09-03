import { supabase } from "@/integrations/supabase/client";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePurchaseConversion } from "@/lib/google-ads";
import { trackEvent } from "@/lib/analytics";

/**
 * Disparo confiável do Purchase (Meta + Google) pro Pix in-app.
 *
 * Problema 1 (medido 14/07): `pix_confirmed` = 0 mesmo com vendas. Quem paga
 * SAI do app pra abrir o banco; ao voltar, o webhook já gravou a assinatura e
 * o app recarrega SEM paywall — a tela de "pagamento confirmado" (que
 * disparava o pixel) é pulada. Solução: marca de intenção ao gerar o QR +
 * rescue no app quando vira assinante.
 *
 * Problema 2 (caso real da alinecsouza06, 14/07): ela gerou o Pix do DOWNSELL
 * (14,90), copiou, depois gerou outro do LIFETIME (27,90) — e pagou o
 * primeiro. Marca "último gerado vence" disparou 27,90 pra uma venda de
 * 14,90. Solução: guardamos TODOS os Pix gerados e, na hora de disparar,
 * lemos qual pedido o webhook gravou na assinatura (abacatepay_billing_id =
 * order id da Cakto) e casamos o certo.
 *
 * Problema 3 (caso real de 11/08, e o motivo desta revisão): a Meta contou
 * 2 compras num dia de 1 venda, e R$47,80 onde entraram R$19,90. O usuário
 * 0c8dcc53 pagou o pedido edeb2c33 (downsell, 19,90); o pixel disparou com
 * 05461621 — pedido LIFETIME de OUTRA conta (1bde700e), gerado no MESMO
 * aparelho. Três defeitos somados:
 *
 *   a) o localStorage é do APARELHO, não da conta. Duas sessões no mesmo
 *      celular misturam pedidos, e nada marcava de quem era cada um.
 *   b) a consulta da assinatura não filtrava por user_id — lia "a última
 *      assinatura que der pra ver", que pode não ser a de quem está logado.
 *   c) sem match, caía no "último gerado vence". Fallback é a hora ERRADA de
 *      adivinhar: o event_id sai diferente do que o CAPI mandou, a Meta não
 *      deduplica e conta duas vezes — com o valor do pedido errado.
 *
 * Agora: filtra por dono, consulta escopada em user_id, e SEM fallback. Se
 * não dá pra afirmar qual pedido foi pago, o pixel NÃO dispara — o Purchase
 * server-side (CAPI do cakto-webhook) sempre tem o pedido certo e cobre o
 * caso sozinho. Não disparar custa zero; disparar errado polui a receita que
 * o ROAS mínimo usa pra decidir entrega.
 *
 * Marca-única + eventID = orderId ⇒ Meta deduplica se dois caminhos correrem.
 */

const KEY = "pix-purchase-pending";

type PendingOffer = "lifetime" | "downsell" | "w97";

/* O VALOR VEM DAQUI, NÃO DE UM TERNÁRIO (31/08). O cabeçalho deste arquivo
 * conta o estrago de disparar o preço errado: R$47,80 de pixel onde entraram
 * R$19,90. Quando a oferta w97 (funil W na web, R$97,90) entrou, o ternário
 * antigo `lifetime ? 27,9 : 19,9` teria carimbado 19,90 em TODA venda de
 * 97,90 — o mesmo bug, cinco vezes maior. Mapa explícito: oferta nova sem
 * preço aqui quebra o build em vez de mentir pro pixel. */
const VALOR_DA_OFERTA: Record<PendingOffer, number> = {
  lifetime: 97.9, // 03/09: a web virou preço único — ver PIX_PRICES no PixCheckout

  downsell: 19.9,
  w97: 97.9,
};
type Pending = { offer: PendingOffer; orderId: string | null; at: number; uid?: string | null };

const readPending = (): Pending[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.offer) return [parsed]; // formato antigo (objeto único)
    return [];
  } catch {
    return [];
  }
};

/**
 * Gerou Pix há pouco tempo? (04/08)
 *
 * O portão do app decide "mostrar paywall" com dois estados só: assinante ou
 * não. Mas existe um TERCEIRO, e ele é frequente: pagou agora e o crédito
 * ainda não chegou. Medido em 04/08 — 9 de 21 pagantes (43%) viram o paywall
 * DEPOIS de pagar, porque chegaram no app dentro da janela de confirmação
 * (mediana 54s, p90 3,4min). O paywall estava tecnicamente certo e
 * comercialmente desastroso: quem acabou de pagar vê "assine agora".
 *
 * Esta marca já existia pro pixel; agora ela também responde "tem pagamento
 * em confirmação". Janela curta de propósito: passou disso, é abandono real e
 * o paywall volta a ser a resposta certa.
 */
export function temPixEmConfirmacao(janelaMin = 12): boolean {
  const limite = janelaMin * 60 * 1000;
  return readPending().some((x) => Date.now() - (x.at ?? 0) <= limite);
}

const writePending = (list: Pending[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-5))); } catch { /* ignore */ }
};

export function markPixPurchasePending(p: { offer: PendingOffer; orderId: string | null }) {
  const list = readPending().filter((x) => !x.orderId || x.orderId !== p.orderId);
  list.push({ ...p, at: Date.now(), uid: null });
  // grava JÁ, síncrono: temPixEmConfirmacao pode ser consultado no próximo
  // render (o portão do app), e um await aqui abriria janela pra mostrar
  // paywall pra quem acabou de gerar o Pix.
  writePending(list);
  // ...e carimba o dono logo em seguida. getSession é local (não vai na rede);
  // getUser iria. Sem isso, dois logins no mesmo aparelho viram um pedido só.
  supabase.auth.getSession().then(({ data }) => {
    const uid = data?.session?.user?.id ?? null;
    if (!uid) return;
    const atual = readPending();
    const i = atual.findIndex((x) => x.orderId === p.orderId && x.uid == null);
    if (i < 0) return;
    atual[i] = { ...atual[i], uid };
    writePending(atual);
  }).catch(() => { /* fica sem dono; o fire trata isso */ });
}

/**
 * Dispara Purchase (uma vez) SE der pra provar qual pedido foi pago.
 *
 * A prova é o cruzamento de três coisas: a marca é desta conta, o pedido está
 * na janela de 24h (Pix expira muito antes — evita disparo tardio num login
 * futuro) e o order id bate com o `abacatepay_billing_id` que o webhook gravou
 * na assinatura DESTA conta. Faltou qualquer uma, não dispara.
 *
 * A marca é limpa ANTES do disparo, de propósito: se algo falhar não repete em
 * loop. O custo é que um skip não tem segunda chance — e tudo bem, porque o
 * Purchase server-side (CAPI) não depende desta função pra acontecer.
 */
export async function firePixPurchaseOnce(source: "checkout" | "rescue"): Promise<boolean> {
  const list = readPending();
  if (!list.length) return false;
  // limpa ANTES de disparar — se algo falhar, não repete em loop
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }

  const recentes = list.filter((x) => Date.now() - (x.at ?? 0) <= 24 * 60 * 60 * 1000);
  if (!recentes.length) return false;

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id ?? null;
  if (!uid) return false; // sem saber quem é, não dá pra afirmar nada

  // Pedidos de OUTRA conta no mesmo aparelho saem daqui. Os sem dono (marca
  // antiga, ou o carimbo não chegou a rodar) continuam elegíveis — mas só
  // vencem pelo match com a assinatura, nunca por chute.
  const fresh = recentes.filter((x) => x.uid == null || x.uid === uid);
  if (!fresh.length) return false;

  /* O pedido pago é o que o webhook gravou na assinatura DESTA conta —
   * medido 11/08: 416 de 416 vendas Pix web desde 01/08 têm o campo
   * preenchido (100%), então exigir o match não custa disparo nenhum. Sem
   * isso um Pix gerado e NÃO pago viraria Purchase quando a pessoa virasse
   * assinante por outra via (loja, cortesia). */
  let chosen: Pending | null = null;
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("abacatepay_billing_id")
      .eq("user_id", uid)
      .limit(5);
    const pagos = new Set((data ?? []).map((r) => r.abacatepay_billing_id).filter(Boolean));
    chosen = fresh.find((x) => x.orderId && pagos.has(x.orderId)) ?? null;
  } catch { /* sem a consulta não dá pra afirmar — cai no skip abaixo */ }

  // SEM FALLBACK. Antes aqui tinha "último gerado vence" e foi ele que mandou
  // o pedido de outra conta pra Meta em 11/08. Preferimos perder o disparo do
  // browser: o CAPI do webhook manda o Purchase com o order_id certo.
  if (!chosen) {
    trackEvent("pix_purchase_skipped", {
      source,
      motivo: "pedido_pago_nao_confirmado",
      candidatos: fresh.length,
      sem_dono: fresh.filter((x) => x.uid == null).length,
    });
    return false;
  }

  const value = VALOR_DA_OFERTA[chosen.offer];
  fireMetaEvent(
    "Purchase",
    { value, currency: "BRL", content_name: chosen.offer },
    chosen.orderId ?? undefined,
  );
  firePurchaseConversion({ billingPeriod: "lifetime", transactionId: chosen.orderId ?? undefined });
  trackEvent("pix_purchase_fired", {
    offer: chosen.offer,
    source,
    order_id: chosen.orderId,
    ambiguous: fresh.length > 1,
  });
  return true;
}
