/**
 * A OFERTA "ANUAL" DO /inicio (26/10, campanha nova da Meta — link /inicio?oferta=anual) — o lado do servidor.
 * O lado do site: src/lib/oferta-anual.ts (os MESMOS valores).
 *
 *   OFB_anual27  "CORE Anual"              R$ 27,90 · 365 dias (billing_period annual) · NÃO renova sozinho
 *   OFB_up47     "CORE Vitalicio upgrade"  R$ 47,90 · VITALÍCIO (+100 anos) numa LINHA NOVA — upsell de quem pagou o anual
 *   OFB_down27   "CORE Vitalicio upgrade"  R$ 27,90 · o MESMO vitalício — downsell (aparece 1x, depois do "não" do up47)
 *
 * O nome da oferta é o que vai no externalReference do QR (`<user_id>:OFB_anual27`) e no pix_order_created — é a
 * marcação no Asaas. A descrição vai SEM acento de propósito (como todas as outras: o texto entra no payload do Pix e
 * app de banco antigo estraga acento).
 *
 * Entra nas 3 funções que creditam Pix da Asaas (asaas-pix `check`, asaas-webhook, pix-reconcile) pelos mapas do
 * ./ofertas-hoje.ts (PRECOS_HOJE / CONCESSAO_HOJE / DESCRICAO_HOJE espalham estes) — oferta nova = as 3 de uma vez.
 * A Cakto NÃO vende estas ofertas (ela só conhece a oferta de 27,90 do vitalício, w27): o checkout manda pra Asaas.
 *
 * Upgrade em LINHA NOVA (`linhaNova`, como o hv47/hv27 do /hoje): o anual comprado continua na linha dele (valor e
 * pedido preservados pra receita e pra trava "1 pedido = 1 crédito"); o check-subscription pega a linha que vence por
 * último (a vitalícia).
 */
export const OFERTA_ANUAL_INICIO = "OFB_anual27";
export const OFERTA_UP_VITALICIO_INICIO = "OFB_up47";
export const OFERTA_DOWN_VITALICIO_INICIO = "OFB_down27";

export const PRECOS_ANUAL_INICIO: Record<string, number> = {
  [OFERTA_ANUAL_INICIO]: 2790,
  [OFERTA_UP_VITALICIO_INICIO]: 4790,
  [OFERTA_DOWN_VITALICIO_INICIO]: 2790,
};

export const CONCESSAO_ANUAL_INICIO: Record<string, { plano: string; periodo: string; dias: number | null; linhaNova?: boolean }> = {
  [OFERTA_ANUAL_INICIO]: { plano: "core-pro", periodo: "annual", dias: 365 },
  [OFERTA_UP_VITALICIO_INICIO]: { plano: "lifetime", periodo: "lifetime", dias: null, linhaNova: true },
  [OFERTA_DOWN_VITALICIO_INICIO]: { plano: "lifetime", periodo: "lifetime", dias: null, linhaNova: true },
};

export const DESCRICAO_ANUAL_INICIO: Record<string, string> = {
  [OFERTA_ANUAL_INICIO]: "CORE Anual",
  [OFERTA_UP_VITALICIO_INICIO]: "CORE Vitalicio upgrade",
  [OFERTA_DOWN_VITALICIO_INICIO]: "CORE Vitalicio upgrade",
};

export const ehAnualDoInicio = (o: string | null | undefined): boolean => o === OFERTA_ANUAL_INICIO;
export const ehUpgradeDoInicio = (o: string | null | undefined): boolean => o === OFERTA_UP_VITALICIO_INICIO || o === OFERTA_DOWN_VITALICIO_INICIO;
export const ehOfertaAnualDoInicio = (o: string | null | undefined): boolean => ehAnualDoInicio(o) || ehUpgradeDoInicio(o);
