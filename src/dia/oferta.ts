/**
 * /dia (23/11) — UM objeto por oferta: preço, os 5 textos que mudam na página (SPEC 3.3) e a linha do servidor (SPEC 3.1/3.2).
 * Rodada de conserto 1: `cedo` (o preço sob o 1º botão) entrou; `fecho` saiu (o botão do fecho passou a ser o mesmo `botao` do preço).
 * Arquivo puro (não toca em window): a página (payment.ts) e os testes leem daqui.
 *   "27" → linha `lp27` (stripe-lp27-criar, R$ 27,90 fixo no servidor; em produção o checkout recusa se o valor vier diferente).
 *   "67" → linha `oferta` SEM braço de preço (como a /completo): R$ 67,90, pedindo 1 parcela.
 * O dia.html traz os textos do "27" no HTML e os do "67" em data-v67; o teste confere que são estes.
 */
import type { OpcoesCheckout } from "@/landing/stripe-checkout";

export type ChaveOferta = "27" | "67";
export type ChaveTopo = "lista" | "gesto";
export type OfertaDia = {
  chave: ChaveOferta;
  precoCentavos: number;
  /** o `value` do pixel (ViewContent; o Purchase sai do checkout com precoCentavos / 100) */
  valor: number;
  pagina: "lp27" | "oferta";
  storagePrefix: string;
  textos: { cedo: string; frase: string; numero: string; compare: string; botao: string };
};

export const OFERTAS: Record<ChaveOferta, OfertaDia> = {
  "27": {
    chave: "27", precoCentavos: 2790, valor: 27.9, pagina: "lp27", storagePrefix: "dia",
    textos: { cedo: "R$ 27,90, uma vez", frase: "Menos que um lanche.", numero: "27,90", compare: "R$ 27,90, uma vez", botao: "Quero meu acesso por R$ 27,90" },
  },
  "67": {
    chave: "67", precoCentavos: 6790, valor: 67.9, pagina: "oferta", storagePrefix: "dia67",
    textos: { cedo: "R$ 67,90, uma vez", frase: "Paga uma vez. Usa pra sempre.", numero: "67,90", compare: "R$ 67,90, uma vez", botao: "Quero meu acesso por R$ 67,90" },
  },
};

export const ofertaDe = (chave: string | null | undefined): OfertaDia => OFERTAS[chave === "67" ? "67" : "27"];
export const topoDe = (chave: string | null | undefined): ChaveTopo => (chave === "gesto" ? "gesto" : "lista");

/**
 * A parte do pedido ao checkout compartilhado que depende só da oferta. É o caminho PADRÃO dele (camada por cima, layout "novo"
 * da /pra-sempre e /completo): sem montarEm, sem "cakto", sem pixCopiaPrimeiro, sem bracoPreco, sem presente, sem indique.
 * À vista (1 parcela), sem CPF, Pix e cartão, e o pago vai direto pro caminho do app com as duas lojas (posApp).
 */
export function opcoesDaOferta(of: OfertaDia, qa: boolean): Pick<OpcoesCheckout, "precoCentavos" | "parcelasMax" | "producao" | "pedeCpf" | "somentePix" | "layout" | "storagePrefix" | "pagina" | "trocaCartao" | "medirCarteira" | "posApp"> {
  return {
    precoCentavos: of.precoCentavos, parcelasMax: 1, producao: !qa, pedeCpf: false, somentePix: false, layout: "novo",
    storagePrefix: qa ? `${of.storagePrefix}-qa` : of.storagePrefix, pagina: of.pagina, trocaCartao: false, medirCarteira: false, posApp: true,
  };
}
