/**
 * AS OFERTAS DO FUNIL WEB NOVO (/hoje, 18/10) — fonte ÚNICA pras 3 funções que creditam Pix da Asaas
 * (asaas-pix `check`, asaas-webhook, pix-reconcile). Cada função espalha estes mapas no PRECOS_CENTAVOS/CONCESSAO dela
 * (`...PRECOS_HOJE`), então uma oferta nova do /hoje entra nas 3 de uma vez.
 *
 * Planos (decisão do dono, 18/10). Pix gerado SEM e-mail (sessão anônima); o e-mail vem DEPOIS de pagar:
 *   h279   1º ano R$ 27,90 · 365 dias · NÃO renova sozinho ("daqui a 1 ano a gente avisa")
 *   h149   mês R$ 14,90 · 30 dias · sem renovação
 *   h279k  1º ano + Kit Primeiro Mês Organizado (order bump +R$ 9,90) = R$ 37,80 num Pix só · 365 dias
 *   h149k  mês + Kit = R$ 24,80 num Pix só · 30 dias
 *     O bump vai NO MESMO Pix (o botão soma o valor) — dois Pix pra uma decisão seria pedir dois pagamentos. O kit em
 *     si é conteúdo do app: o SERVIDOR grava `core-kit-primeiro-mes` na conta (user_data) quando confirma o Pix
 *     (presente.ts liberarKitDoBump; 21/10 — antes a página gravava pelo cliente) e o app libera.
 * Upsells depois do pagamento (1 tela cada, sempre com "Não, obrigado"):
 *   hv47   "Troque o 1º ano pelo CORE pra sempre" +R$ 47 → VITALÍCIO (+100 anos, como o vitalício de sempre)
 *   hv27   downsell de quem recusou o hv47 (dono, 18/10): "O CORE pra sempre por R$ 27" → o MESMO vitalício (+100 anos),
 *          uma vez só, logo depois do "Não, obrigado" do de 47
 *   hc199  "Organize a vida a dois" +R$ 19,90 → NÃO credita quem pagou: a página pede o e-mail da(o) parceira(o) e a
 *          ação `parceiro` do asaas-pix cria/libera a conta dela(e) até o MESMO fim do plano de quem comprou.
 * hv47/hv27 gravam numa LINHA NOVA (grant-pix `linhaNova`): o plano comprado antes continua na linha dele (valor e
 * pedido preservados pra receita e pra trava de "1 pedido = 1 crédito").
 */
/* 26/10: a oferta "anual" do /inicio (OFB_anual27 / OFB_up47 / OFB_down27) mora em ./ofertas-anual-inicio.ts e entra
 * AQUI nos 3 mapas — é o caminho que já leva uma oferta nova pras 3 funções (asaas-pix, asaas-webhook, pix-reconcile). */
import { CONCESSAO_ANUAL_INICIO, DESCRICAO_ANUAL_INICIO, PRECOS_ANUAL_INICIO } from "./ofertas-anual-inicio.ts";
/* 28/10: as ofertas da LANDING NOVA (/organizar, desligada) moram em ./ofertas-landing.ts e entram aqui (mapas + planos). */
import { CONCESSAO_LANDING, DESCRICAO_LANDING, OFERTAS_PLANO_LANDING, PRECOS_LANDING } from "./ofertas-landing.ts";

export const PRECOS_HOJE: Record<string, number> = {
  h279: 2790, h149: 1490, h279k: 3780, h149k: 2480, hv279: 2790, hv47: 4700, hv27: 2700, hc199: 1990,
  // 21/10: o upsell "Seu 2027 já organizado" (R$ 19,90, uma vez) — NÃO é assinatura: fora do CONCESSAO_HOJE; o pagamento
  // grava o pacote na conta de quem pagou (_shared/pacote-2027.ts). Aqui pra entrar nas 3 funções pelo `...PRECOS_HOJE`.
  u2027: 1990,
  ...PRECOS_ANUAL_INICIO,
  ...PRECOS_LANDING,
};

export type ConcessaoHoje = { plano: string; periodo: string; dias: number | null; linhaNova?: boolean };
/** O que cada oferta concede a QUEM PAGOU. `hc199` fica de fora de propósito (quem ganha é a outra conta). */
export const CONCESSAO_HOJE: Record<string, ConcessaoHoje> = {
  h279: { plano: "core-pro", periodo: "annual", dias: 365 },
  h149: { plano: "web", periodo: "monthly_prepaid", dias: 30 },
  h279k: { plano: "core-pro", periodo: "annual", dias: 365 },
  h149k: { plano: "web", periodo: "monthly_prepaid", dias: 30 },
  hv279: { plano: "lifetime", periodo: "lifetime", dias: null },
  hv47: { plano: "lifetime", periodo: "lifetime", dias: null, linhaNova: true },
  hv27: { plano: "lifetime", periodo: "lifetime", dias: null, linhaNova: true },
  ...CONCESSAO_ANUAL_INICIO,
  ...CONCESSAO_LANDING,
};

export const DESCRICAO_HOJE: Record<string, string> = {
  h279: "CORE 1 ano", h149: "CORE 30 dias", h279k: "CORE 1 ano + kit", h149k: "CORE 30 dias + kit", hv279: "CORE vitalicio",
  hv47: "CORE pra sempre", hv27: "CORE pra sempre", hc199: "CORE a dois", u2027: "CORE seu 2027",
  ...DESCRICAO_ANUAL_INICIO,
  ...DESCRICAO_LANDING,
};

/** Os planos (a compra principal do /hoje) — são eles que levam as boas-vindas. */
export const OFERTAS_PLANO_HOJE: readonly string[] = ["h279", "h149", "h279k", "h149k", "hv279", ...OFERTAS_PLANO_LANDING];
/** 20/10: o plano VITALÍCIO do /hoje (o e-mail de boas-vindas diz "pra sempre"). */
export const OFERTA_VITALICIO_HOJE = "hv279";
/** Os upsells (sem boas-vindas próprias: quem comprou já recebe a do plano). */
export const OFERTAS_UPSELL_HOJE: readonly string[] = ["hv47", "hv27", "hc199"];
export const OFERTA_CASAL = "hc199";
export const OFERTAS_COM_KIT: readonly string[] = ["h279k", "h149k"];

export const ehPlanoHoje = (o: string | null | undefined): boolean => !!o && OFERTAS_PLANO_HOJE.includes(o);
export const ehUpsellHoje = (o: string | null | undefined): boolean => !!o && OFERTAS_UPSELL_HOJE.includes(o);
export const ehOfertaCasal = (o: string | null | undefined): boolean => o === OFERTA_CASAL;
export const temKit = (o: string | null | undefined): boolean => !!o && OFERTAS_COM_KIT.includes(o);

/** Chave da CAPI do casal: o pedido não vira linha de quem pagou, então a trava de "1 crédito" não serve. */
export const chaveCapiCasal = (orderId: string): string => `hoje-casal-capi:${orderId}`;
/** Chave da liberação da(o) parceira(o): 1 pedido = 1 conta liberada. */
export const chaveParceiro = (orderId: string): string => `hoje-casal:${orderId}`;

/** 21/10: o upsell "Seu 2027 já organizado" (R$ 19,90) — conteúdo do app na conta de quem pagou, não acesso. */
export const OFERTA_2027 = "u2027";
export const eh2027 = (o: string | null | undefined): boolean => o === OFERTA_2027;
