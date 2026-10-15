/**
 * FUNIL DE VENDA DA WEB (/assinar, 15/10) — as frases, os preços e a configuração num lugar só (os testes leem
 * daqui). Puro, sem React.
 *
 * Campanha pequena (R$ 100/dia, 3 dias; ROI < 1,2× desliga). Volta a venda direta no site, no visual da Porta v5:
 * quiz (área → dor → número → como organiza) → "seu plano está montado" → PAYWALL (antes da conta) → nome + e-mail
 * → Pix na página (Asaas, oferta `a97`) ou cartão na Cakto → sucesso com a loja e o "entre com este e-mail".
 *
 * Regras: nunca "sem cartão"; área de transferência só no botão "Copiar código Pix" (toque da pessoa); o anual da
 * web é 1 ANO de acesso (não vitalício); mensal só no cartão (Pix mensal não renova e confundia o cliente).
 */
import type { EscolhaPorta } from "@/pages/porta/conteudo";

/* ------------------------------------------------ o topo (no quiz; depois fica só o logo) */
export const SELO_VENDA = "Seu plano de 3 dias";
export const TITULO_VENDA = "Organize sua vida em 3 dias";
export const SUB_VENDA = "4 perguntas rápidas pra montar o seu plano no CORE.";

/* ------------------------------------------------ os planos */
export type PlanoVenda = "anual" | "mensal";
export type MetodoVenda = "pix" | "cartao";

export const PLANOS: Record<PlanoVenda, {
  nome: string;
  /** o valor cobrado (é este número que vai pro pixel/CAPI como `value`) */
  valor: number;
  preco: string;
  /** a linha embaixo do preço */
  periodo: string;
  metodos: MetodoVenda[];
  /** content_name no pixel */
  conteudo: string;
}> = {
  anual: { nome: "Anual", valor: 97.9, preco: "97,90", periodo: "por ano", metodos: ["pix", "cartao"], conteudo: "core_anual_web" },
  mensal: { nome: "Mensal", valor: 24.9, preco: "24,90", periodo: "por mês", metodos: ["cartao"], conteudo: "core_mensal_web" },
};

/** 97,90 ÷ 12 = 8,158… → "8,16" (arredonda pra cima no centavo: nunca prometer menos do que cobra) */
export const porMes = (valor: number): string => (Math.ceil((valor / 12) * 100) / 100).toFixed(2).replace(".", ",");

/** A oferta do Pix anual nas funções de dinheiro (asaas-pix / asaas-webhook / pix-reconcile): 9790, 365 dias. */
export const OFERTA_PIX_ANUAL = "a97" as const;

/* ------------------------------------------------ cartão: a Cakto (checkout hospedado, ela parcela)
 *
 * Os links são PÚBLICOS (pay.cakto.com.br/<código>) — o preço mora na oferta, no painel da Cakto. Ficam em variável
 * de ambiente do build (Vercel), com nome claro; sem a variável, o cartão daquele plano NÃO aparece (o anual segue
 * no Pix; o mensal some). O webhook da Cakto casa a oferta pelo MESMO código (secrets CAKTO_OFFER_WEB_ANUAL /
 * CAKTO_OFFER_WEB_MENSAL) e dá 1 ano / 1 mês. Aceita o código ("abc1234") ou a URL inteira.
 */
export const ENV_CAKTO: Record<PlanoVenda, string> = { anual: "VITE_VENDA_CAKTO_ANUAL", mensal: "VITE_VENDA_CAKTO_MENSAL" };

export function linkDoCakto(plano: PlanoVenda, env: Record<string, unknown> = import.meta.env as Record<string, unknown>): string | null {
  const bruto = String(env[ENV_CAKTO[plano]] ?? "").trim();
  if (!bruto) return null;
  if (/^https:\/\/pay\.cakto\.com\.br\/[A-Za-z0-9_-]+\/?$/.test(bruto)) return bruto.replace(/\/$/, "");
  if (/^[A-Za-z0-9_-]{4,40}$/.test(bruto)) return `https://pay.cakto.com.br/${bruto}`;
  return null; // valor estranho: melhor não oferecer o cartão do que mandar pra um link errado
}

/** Os parâmetros de atribuição que seguem pro checkout da Cakto (o pixel/relatório dela lê; os utm vão pra UTMify). */
const ATTR_PRO_CAKTO = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

/** O link do checkout com o e-mail/nome PRÉ-PREENCHIDOS (o webhook casa a compra com a conta pelo e-mail). */
export function urlDoCakto(base: string, args: { email: string; nome: string; attr?: Partial<Record<string, string>> | null }): string {
  const u = new URL(base);
  const email = args.email.trim().toLowerCase();
  u.searchParams.set("email", email);
  u.searchParams.set("confirmEmail", email);
  if (args.nome.trim()) u.searchParams.set("name", args.nome.trim().slice(0, 80));
  for (const k of ATTR_PRO_CAKTO) {
    const v = args.attr?.[k];
    if (v) u.searchParams.set(k, String(v).slice(0, 200));
  }
  return u.toString();
}

/** A página de obrigado que o dono configura nas DUAS ofertas da Cakto ("redirecionar depois da compra"). */
export const URL_OBRIGADO_CARTAO = "https://coreaplicativo.com.br/assinar?pago=cartao";

/* ------------------------------------------------ ?m= (opcional): a área já escolhida no anúncio → começa na dor */
const AREA_DO_M: Record<string, EscolhaPorta> = {
  dinheiro: "dinheiro", financas: "dinheiro", financa: "dinheiro",
  rotina: "rotina", habitos: "rotina",
  corpo: "corpo", treino: "corpo", dieta: "corpo", academia: "corpo",
  saude: "saude",
  metas: "metas", meta: "metas",
};
export function areaDoM(m: string | null | undefined): EscolhaPorta | null {
  const k = String(m ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return AREA_DO_M[k] ?? null;
}

/* ------------------------------------------------ textos das telas */
export const MONTADO_SELO = "Pronto";
export const MONTADO_TITULO = "Seu plano está montado";
export const MONTADO_CTA = "Ver como liberar";

export const PAYWALL_TITULO = "Libere seu plano no CORE";
export const PAYWALL_SUB = "Tudo o que você precisa pra organizar a vida, num app só.";
export const BENEFICIOS = [
  "Seu plano de 3 dias pronto no app",
  "Dinheiro, rotina, treino, saúde e metas num lugar só",
  "No iPhone, no Android e no computador",
];
export const SELO_ANUAL = "Mais escolhido";
export const BOTAO_PIX = "Pagar com Pix";
export const BOTAO_CARTAO = "Cartão de crédito";
export const LINHA_CARTAO = "No cartão dá pra parcelar.";
export const MENSAL_LINHA = "Renova todo mês. Cancele quando quiser.";
export const GARANTIA = "Pagamento seguro · 7 dias de garantia";

export const DADOS_TITULO = "Falta só seu nome e e-mail";
export const DADOS_SUB = "É com este e-mail que você entra no app.";
export const BOTAO_GERAR_PIX = "Gerar meu Pix";
export const BOTAO_IR_CARTAO = "Ir pro pagamento no cartão";

export const PIX_TITULO = "Pague com Pix pra liberar";
export const BOTAO_COPIAR_PIX = "Copiar código Pix";
export const PIX_ESPERANDO = "Esperando o pagamento…";

export const CARTAO_INDO = "Abrindo o pagamento seguro…";
export const CARTAO_VOLTA_TITULO = "Confirmando seu pagamento";

export const SUCESSO_SELO = "Pagamento confirmado";
export const SUCESSO_TITULO = "Seu CORE está liberado";
export const DICA_ENTRAR_VENDA = "No app, toque em “Entrar” — não em “Começar”.";
export const DICA_CODIGO = "Depois, “Entrar sem senha” e use o código que chegar no seu e-mail.";
