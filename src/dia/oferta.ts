/**
 * /dia (23/11) — UM objeto por oferta: preço, os 5 textos que mudam na página (SPEC 3.3) e a linha do servidor (SPEC 3.1/3.2).
 * Rodada de conserto 1: `cedo` (o preço sob o 1º botão) entrou. Rodada 2: o botão do fecho voltou a ser o da SPEC ("Quero
 * experimentar agora", igual nas duas ofertas, por isso não mora aqui) com o `cedo` colado embaixo; `botao` é só o do cartão do preço.
 * São 5 textos em 6 lugares da página (`cedo` aparece 2 vezes).
 * Rodada 3: a chave PRECO_CEDO_DIA (dia.html) decide se o preço aparece ANTES do cartão. Nasce "off" (a copy da SPEC): à mostra
 * ficam os 5 lugares da SPEC 3.3 (frase, número, Compare, botão do preço, linha sob o botão do fecho). Com "on" entram mais 2:
 * `fato` (a célula do meio da faixa de fatos da 1ª tela) e o `cedo` sob o 1º botão. `prefixoDaAba` é a regra única do nome
 * da aba do pedido (o checkout guarda `<prefixo>-stripe-ref`; o main.ts olha a mesma chave pra reabrir o Pix na recarga).
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
  textos: { fato: string; cedo: string; frase: string; numero: string; compare: string; botao: string };
};

export const OFERTAS: Record<ChaveOferta, OfertaDia> = {
  "27": {
    chave: "27", precoCentavos: 2790, valor: 27.9, pagina: "lp27", storagePrefix: "dia",
    textos: { fato: "R$ 27,90, 1 vez só", cedo: "R$ 27,90, uma vez", frase: "Menos que um lanche.", numero: "27,90", compare: "R$ 27,90, uma vez", botao: "Quero meu acesso por R$ 27,90" },
  },
  "67": {
    chave: "67", precoCentavos: 6790, valor: 67.9, pagina: "oferta", storagePrefix: "dia67",
    textos: { fato: "R$ 67,90, 1 vez só", cedo: "R$ 67,90, uma vez", frase: "Paga uma vez. Usa pra sempre.", numero: "67,90", compare: "R$ 67,90, uma vez", botao: "Quero meu acesso por R$ 67,90" },
  },
};

export const ofertaDe = (chave: string | null | undefined): OfertaDia => OFERTAS[chave === "67" ? "67" : "27"];
export const topoDe = (chave: string | null | undefined): ChaveTopo => (chave === "gesto" ? "gesto" : "lista");
/** PRECO_CEDO_DIA (html[data-cedo]): só "on" liga; qualquer outra coisa é a copy da SPEC */
export const cedoDe = (chave: string | null | undefined): "on" | "off" => (chave === "on" ? "on" : "off");
/** o prefixo das chaves do pedido nesta aba (sessionStorage): separado por oferta e, na prévia, do pedido de verdade */
export const prefixoDaAba = (of: OfertaDia, qa: boolean): string => (qa ? `${of.storagePrefix}-qa` : of.storagePrefix);

/**
 * A parte do pedido ao checkout compartilhado que depende só da oferta. É o caminho PADRÃO dele (camada por cima, layout "novo"
 * da /pra-sempre e /completo): sem montarEm, sem "cakto", sem pixCopiaPrimeiro, sem bracoPreco, sem presente, sem indique.
 * À vista (1 parcela), sem CPF, Pix e cartão, e o pago vai direto pro caminho do app com as duas lojas (posApp).
 */
export function opcoesDaOferta(of: OfertaDia, qa: boolean): Pick<OpcoesCheckout, "precoCentavos" | "parcelasMax" | "producao" | "pedeCpf" | "somentePix" | "layout" | "storagePrefix" | "pagina" | "trocaCartao" | "medirCarteira" | "posApp"> {
  return {
    precoCentavos: of.precoCentavos, parcelasMax: 1, producao: !qa, pedeCpf: false, somentePix: false, layout: "novo",
    storagePrefix: prefixoDaAba(of, qa), pagina: of.pagina, trocaCartao: false, medirCarteira: false, posApp: true,
  };
}
