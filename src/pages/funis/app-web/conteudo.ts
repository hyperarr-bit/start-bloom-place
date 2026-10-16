/**
 * O FUNIL DO APP NA WEB — coreaplicativo.com.br/assinatura (16/10, dono: "faz o funil do app mesmo, só o paywall no
 * funil diferente, e bota downsell 69,90 anual e depois 24,90 mensal na web"). As frases, os preços e a escada num
 * lugar só (os testes leem daqui). Puro, sem React.
 *
 * As telas até o paywall são as do iPhone 1.0.15 (funil enxuto do Cal AI + "Seu plano de 3 dias" com cadeado):
 *   welcome (vídeo do app) → porta (qual área) → 2 perguntas (a dor + o número) → sem × com → lembretes → prova →
 *   preparando → resultado → plano de 3 dias → PAYWALL DA WEB (Pix).
 * O paywall é a escada (cada degrau 1x por sessão, nunca em loop):
 *   1. Anual R$ 97,90 no Pix (oferta `a97`, 365 dias) — a principal;
 *   2. recusou (Voltar/X, "Agora não" ou voltou do QR sem pagar) → presente: Anual R$ 69,90 no Pix (`a69`, 365 dias);
 *   3. recusou de novo → Mensal R$ 24,90 no Pix (`w25`, 30 dias, NÃO renova sozinho);
 *   4. recusou o 3º → volta pro anual de 97,90, sem mais oferta.
 * Regras: nunca "sem cartão"; o Pix mensal não renova e a tela DIZ isso; área de transferência só no "Copiar código Pix".
 */
import type { AreaKey } from "@/lib/funnel";

/** O nome do funil nos eventos de passo (`funnel_view {funil}`) — separado do "w" do app. */
export const FUNIL_APP_WEB = "app_web";
/** A variante da venda (user_metadata.venda.variante e os venda_*). */
export const VARIANTE_APP = "app";

/* ------------------------------------------------ as ofertas (as mesmas das funções de dinheiro) */
export type OfertaApp = "a97" | "a69" | "w25";
/** O degrau da escada: o principal (97) e os dois presentes. */
export type Degrau = 97 | 69 | 24;

export const OFERTAS: Record<OfertaApp, {
  oferta: OfertaApp;
  degrau: Degrau;
  plano: "anual" | "mensal";
  /** o valor cobrado (é este número que vai pro pixel/CAPI como `value`) */
  valor: number;
  preco: string;
  /** a linha curta do resumo ("Anual · R$ 97,90") */
  rotulo: string;
  /** o que a pessoa recebe */
  acesso: string;
  /** content_name no pixel/CAPI (a venda-capi aceita só estes) */
  conteudo: string;
}> = {
  a97: { oferta: "a97", degrau: 97, plano: "anual", valor: 97.9, preco: "97,90", rotulo: "Anual", acesso: "1 ano de acesso", conteudo: "core_anual_web" },
  a69: { oferta: "a69", degrau: 69, plano: "anual", valor: 69.9, preco: "69,90", rotulo: "Anual", acesso: "1 ano de acesso", conteudo: "core_anual69_web" },
  w25: { oferta: "w25", degrau: 24, plano: "mensal", valor: 24.9, preco: "24,90", rotulo: "Mensal", acesso: "30 dias de acesso", conteudo: "core_mensal_pix_web" },
};
export const OFERTA_DO_DEGRAU: Record<Degrau, OfertaApp> = { 97: "a97", 69: "a69", 24: "w25" };

/** O próximo degrau depois de recusar `de` — null = acabou a escada. Pula o que já foi visto nesta sessão. */
export function proximoDegrau(de: Degrau, vistos: readonly Degrau[]): 69 | 24 | null {
  const ordem: Array<69 | 24> = de === 97 ? [69, 24] : de === 69 ? [24] : [];
  return ordem.find((d) => !vistos.includes(d)) ?? null;
}

/** 97,90 ÷ 12 → "8,16" (arredonda pra cima no centavo: nunca prometer menos do que cobra) */
export const porMes = (valor: number): string => (Math.ceil((valor / 12) * 100) / 100).toFixed(2).replace(".", ",");

/* ------------------------------------------------ paywall (degrau 97) */
export const PAYWALL_TITULO = "Libere seu plano de 3 dias";
export const PAYWALL_SUB = "Dinheiro, rotina, treino, saúde e metas num app só.";
export const BOTAO_PIX = "Pagar com Pix";
export const PAYWALL_LEGAL = "Pagamento único no Pix. 1 ano de acesso, sem renovação automática.";
export const GARANTIA = "Pagamento seguro · 7 dias de garantia";
export const AGORA_NAO = "Agora não";

/* ------------------------------------------------ presente 1 (degrau 69) */
export const D69_SELO = "Presente · só agora";
export const D69_TITULO = "Espera! Um presente antes de ir";
export const D69_SUB = "O mesmo plano anual, por menos. Esse preço aparece uma vez só, aqui nesta tela.";
export const D69_BOTAO = "Quero por R$ 69,90";
export const D69_LEGAL = "Pagamento único no Pix. 1 ano de acesso, sem renovação automática.";

/* ------------------------------------------------ presente 2 (degrau 24) */
export const D24_SELO = "Comece pequeno";
export const D24_TITULO = "Que tal começar com 1 mês?";
export const D24_SUB = "Use o CORE por 30 dias e veja a diferença na sua rotina.";
export const D24_BOTAO = "Quero 1 mês por R$ 24,90";
/** A frase que o dono pediu (16/10): o Pix mensal NÃO renova — um cliente se confundiu com o mensal vencido. */
export const MENSAL_SEM_RENOVACAO = "30 dias de acesso, sem renovação automática — pra continuar, é só pagar de novo.";

/* ------------------------------------------------ dados / Pix / sucesso */
export const DADOS_TITULO = "Falta só seu nome e e-mail";
export const DADOS_SUB = "É com este e-mail que você entra no app.";

/** O texto do plano no sucesso (com a data do fim do acesso, quando houver). */
export function textoDoPlanoNoSucesso(oferta: OfertaApp, fim: string | null): string {
  if (oferta === "w25") return fim ? `Mensal · 30 dias, até ${fim} · sem renovação automática` : "Mensal · 30 dias de acesso · sem renovação automática";
  return fim ? `Plano anual · acesso até ${fim}` : "Plano anual · 1 ano de acesso";
}

/* ------------------------------------------------ as telas do funil (as do app, ComecarW da 1.0.15) */

/** A porta como pergunta 1 (PORTAS_W do app). "Tudo, sinceramente" segue pelo dinheiro. */
export const PORTAS: Array<{ area: AreaKey; emoji: string; label: string }> = [
  { area: "dinheiro", emoji: "💰", label: "Meu dinheiro" },
  { area: "rotina", emoji: "📅", label: "Minha rotina e hábitos" },
  { area: "corpo", emoji: "💪", label: "Treino e alimentação" },
  { area: "metas", emoji: "🎯", label: "Minhas metas paradas" },
  { area: "dinheiro", emoji: "😵", label: "Tudo, sinceramente" },
];
export const PERGUNTA_PORTA = "Qual área da sua vida tá mais fora de controle hoje?";

/** Os lembretes por área (LEMBRETES_W do app). Na web a tela só conta como o app lembra — sem pedir permissão. */
export const LEMBRETES: Record<AreaKey, { titulo: string; itens: Array<{ emoji: string; t: string }> }> = {
  dinheiro: {
    titulo: "O CORE te avisa antes da conta vencer",
    itens: [
      { emoji: "💸", t: "Conta chegando no vencimento — aviso na véspera" },
      { emoji: "📊", t: "Quanto ainda dá pra gastar no mês" },
      { emoji: "🗓️", t: "Fechamento do teu mês, todo dia 1º" },
    ],
  },
  rotina: {
    titulo: "O CORE te lembra do hábito na hora certa",
    itens: [
      { emoji: "🔁", t: "Hábito do dia ainda aberto — um toque às 21h" },
      { emoji: "📅", t: "Sua agenda de amanhã, na noite anterior" },
      { emoji: "🔥", t: "Sua sequência em risco — antes de quebrar" },
    ],
  },
  corpo: {
    titulo: "O CORE te lembra do treino de hoje",
    itens: [
      { emoji: "💪", t: "Treino do dia, no seu horário" },
      { emoji: "💧", t: "Água ficando pra trás — lembrete leve" },
      { emoji: "🔥", t: "Constância em risco — antes de quebrar" },
    ],
  },
  saude: {
    titulo: "O CORE cuida dos teus lembretes de saúde",
    itens: [
      { emoji: "💧", t: "Água e sono — no ritmo que você definir" },
      { emoji: "❤️", t: "Check-in do teu dia, uma vez só" },
      { emoji: "🔥", t: "Sequência em risco — antes de quebrar" },
    ],
  },
  metas: {
    titulo: "O CORE te cobra a meta (do jeito bom)",
    itens: [
      { emoji: "🎯", t: "Check-in semanal do progresso da meta" },
      { emoji: "📈", t: "Marco batido — comemorar também importa" },
      { emoji: "🔥", t: "Semana sem avanço — cutucada gentil" },
    ],
  },
};
export const LEMBRETES_SUB = "Organizar sozinho falha no dia 3 — por esquecimento, não por preguiça. O lembrete certo é metade do resultado.";

/** A linha do contrato do plano (textoDoContrato do app, lib/onboarding-1tela da 1.0.14). */
export const textoDoContrato = (nome?: string | null): string => {
  const n = (nome ?? "").trim();
  return n ? `Eu, ${n}, vou dar 10 min por dia ao meu CORE por 3 dias.` : "Eu vou dar 10 min por dia ao meu CORE por 3 dias.";
};
/** O cadeado do plano: no app é "quando começar o teste grátis"; na web não tem teste — libera no pagamento. */
export const CADEADO_ROTULO = "Depois dos 3 dias";
export const CADEADO_TEXTO = "Desbloqueia quando você liberar o CORE";
export const BOTAO_PLANO = "Desbloquear meu plano";

/** Os passos da preparação (prepSteps do app). */
export const passosDaPreparacao = (nomeDaArea: string): string[] => [
  "Analisando suas respostas", "Montando sua central", `Preparando o módulo de ${nomeDaArea}`, "Finalizando seu plano personalizado",
];

export const URL_QR_APP_WEB = "https://coreaplicativo.com.br/baixar?origem=venda_app_qr";
