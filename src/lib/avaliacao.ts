import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { userKeyOf } from "@/components/finance/storage-keys";

/**
 * PEDIDO DE AVALIAÇÃO NA PLAY (14/08).
 *
 * Por que existe: o app nunca pediu avaliação. Estava esperando a pessoa sair
 * sozinha, achar a ficha na Play Store e escrever — o que quase ninguém faz.
 * Resultado: um punhado de avaliações, e as duas com texto eram 3 estrelas
 * reclamando de bug (copo de água e "áreas não clicáveis"), ambas consertadas
 * nesta mesma versão. Com tão poucas notas, cada uma pesa muito.
 *
 * REGRAS DO GOOGLE QUE ESTE ARQUIVO RESPEITA (elas não são sugestão — quebrar
 * derruba o app da loja):
 *
 *  1. NÃO perguntar nada antes ("está gostando?", "daria 5 estrelas?"). O
 *     filtro de sentimento que todo mundo faz é proibido. Aqui o pedido é
 *     direto e sem pergunta.
 *  2. NÃO ter botão fixo de "avaliar". A cota do Google pode simplesmente não
 *     exibir a caixa, e um botão que às vezes não faz nada é experiência
 *     quebrada. Por isso este módulo não exporta nada para pôr em menu.
 *  3. NÃO insistir. O Google já limita por cota, mas a cota é opaca e não
 *     avisa quando estourou — então a trava é nossa: um pedido a cada 90
 *     dias, no máximo 3 na vida do aparelho.
 *
 * A ESTRATÉGIA: pedir em MOMENTO DE VALOR, nunca no meio de uma tarefa e
 * nunca logo após a compra (aí a pessoa pagou mas ainda não recebeu nada).
 * Ver `pedirAvaliacaoSePuder` para os gatilhos.
 */

const CHAVE_ULTIMA = "core-avaliacao-ultima";
const CHAVE_TOTAL = "core-avaliacao-total";
const DIAS_ENTRE_PEDIDOS = 90;
const MAXIMO_NA_VIDA = 3;

/** Momentos em que vale pedir — todos são "acabei de conseguir algo". */
export type MotivoAvaliacao =
  | "desafio_concluido"
  | "sequencia_habito"
  | "extrato_importado"
  | "meta_batida"
  // Conta marcada como paga no calendário de finanças — o módulo onde os
  // pagantes passam 3× mais tempo que em qualquer outro (301 min/14d).
  | "conta_paga"
  // Retrospectiva do mês aberta e assistida — função citada nominalmente
  // na avaliação 5★ do Rafael C. ("sensação muito boa").
  | "retrospectiva"
  // Primeiro gasto lançado na vida do aparelho (02/09): a primeira coisa
  // concreta que o app entregou. Nunca dispara sozinho — vem SEMPRE depois
  // da folha ConviteAvaliacao, e só se a pessoa tocou em "Deixar minha
  // nota". Ver `reservarConvitePrimeiroGasto`.
  | "primeiro_gasto"
  // MORTO NO FUNIL EM 28/08: a aposta BitePal de pedir no pico do funil
  // disparou 985 pedidos em 48h pra quem nunca tinha usado o app e queimava
  // a janela de 90 dias do aparelho ANTES da pessoa virar pagante.
  // CORREÇÃO DA PREMISSA (02/09, com o Console já atualizado): não rendeu
  // "~1 avaliação" — rendeu 63 em 3 dias (27–29/08, média 4,9; 76% das de
  // agosto). O Console atrasa 1–2 dias e a decisão foi tomada olhando um
  // número que ainda não existia. O gatilho segue morto pelo motivo que
  // continua válido (pedir antes de usar fere a diretriz do In-App Review);
  // o volume voltou pelo `primeiro_gasto`. (O tipo fica: o ComecarRadar web
  // ainda referencia.)
  | "plano_pronto";

const lerNumero = (chave: string): number => {
  try {
    return Number(localStorage.getItem(chave) ?? 0) || 0;
  } catch {
    return 0;
  }
};

/**
 * As travas que valem pra QUALQUER pedido — sem efeito colateral nenhum.
 *
 * Existe separada porque a folha de convite (ConviteAvaliacao) precisa saber
 * ANTES de aparecer se o toque no botão vai dar em alguma coisa: botão que
 * às vezes não faz nada é exatamente a experiência quebrada que a regra 2
 * evita. (A cota do próprio Google continua opaca — mas num aparelho que
 * nunca foi perguntado ela está inteira.)
 */
export function podePedirAvaliacao(): boolean {
  // Só no app da loja: na web a caixa não existe (e o plugin rejeita).
  if (!isNativeShell()) return false;
  // Na DEMO do funil os módulos são os REAIS (/preview) — sem este guard, o
  // turista de 30s marcando a conta de exemplo seria convidado a avaliar: o
  // exato erro do pedido-no-funil que morreu em 28/08.
  try { if (window.location.pathname.startsWith("/preview")) return false; } catch { /* noop */ }
  if (lerNumero(CHAVE_TOTAL) >= MAXIMO_NA_VIDA) return false;
  const ultima = lerNumero(CHAVE_ULTIMA);
  const dias = ultima ? (Date.now() - ultima) / 86_400_000 : Infinity;
  return dias >= DIAS_ENTRE_PEDIDOS;
}

const CHAVE_PRIMEIRO_GASTO = "core-avaliacao-primeiro-gasto";

/**
 * Esta pessoa já lançou algum gasto — no mês corrente ou em qualquer mês
 * arquivado (`finance-{ano}-{mes}-expenses`), variável ou fixo, em qualquer
 * perfil (PF/PJ)? Lê o localStorage direto: é a mesma fonte que a tela lê,
 * hidratada do servidor no login — quem já usava o CORE em outro aparelho
 * chega aqui com o histórico e NÃO é tratado como novato.
 *
 * @param exceto id do gasto que acabou de ser salvo — dependendo de quando o
 *   estado persiste, ele já pode estar no disco na hora desta leitura, e um
 *   gasto não pode ser "anterior" a si mesmo.
 */
export function jaLancouGastoAntes(userId: string | null | undefined, exceto?: string): boolean {
  const prefixo = userKeyOf(userId, "finance-");
  if (!prefixo) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!chave || !chave.startsWith(prefixo)) continue;
      if (!/^(\d{4}-[^-]+-)?(fixed-)?expenses$/.test(chave.slice(prefixo.length))) continue;
      const lista = JSON.parse(localStorage.getItem(chave) ?? "null");
      if (Array.isArray(lista) && lista.some((g) => g && g.id !== exceto)) return true;
    }
  } catch { /* JSON estranho ou modo privado: na dúvida, não é novato */ return true; }
  return false;
}

/**
 * Reserva a única chance de convidar no primeiro gasto — uma por aparelho.
 *
 * Devolve `true` só quando vale mostrar a folha: app da loja, cota nossa
 * livre, conta logada, nunca convidado antes neste aparelho e nenhum gasto
 * anterior em nenhum mês. Marca a chance como usada ANTES de a folha abrir —
 * fechar o app com ela na tela não pode fazê-la voltar na reabertura.
 *
 * O que NÃO faz: gastar a janela de 90 dias. Essa só é consumida se a pessoa
 * tocar em "Deixar minha nota" (aí `pedirAvaliacaoSePuder` grava). Quem
 * recusa continua elegível pros momentos de valor de sempre.
 */
export function reservarConvitePrimeiroGasto(userId: string | null | undefined, gastoId?: string): boolean {
  if (!userId) return false;
  if (!podePedirAvaliacao()) return false;
  if (lerNumero(CHAVE_PRIMEIRO_GASTO)) return false;
  if (jaLancouGastoAntes(userId, gastoId)) return false;
  try { localStorage.setItem(CHAVE_PRIMEIRO_GASTO, "1"); } catch { /* modo privado */ }
  return true;
}

/**
 * Pede a avaliação se — e só se — for uma boa hora.
 *
 * Devolve `true` quando o pedido foi realmente disparado. Nunca lança: se o
 * plugin falhar (build antiga, Play Services fora), a chamada é silenciosa.
 * O chamador não deve mudar de tela por causa disso; a caixa do Google aparece
 * por cima e some sozinha.
 *
 * @param pagante quem já comprou tem prioridade — passou pelo produto inteiro
 *   e tem opinião formada. Quem está no gratuito só é convidado depois de dois
 *   momentos de valor (`vezes`), pra não pedir nota de quem mal usou.
 * @param forte pico único da jornada (ex.: diagnóstico do funil) — dispensa a
 *   regra das duas vezes, porque esse momento só acontece uma vez e é
 *   exatamente onde os concorrentes colhem as avaliações deles.
 */
export async function pedirAvaliacaoSePuder(
  motivo: MotivoAvaliacao,
  { pagante = false, vezes = 1, forte = false }: { pagante?: boolean; vezes?: number; forte?: boolean } = {},
): Promise<boolean> {
  if (!pagante && !forte && vezes < 2) return false;
  // shell, /preview, 3 na vida, 90 dias — as travas comuns moram numa função
  // só, pra folha de convite conferir as mesmas antes de aparecer.
  if (!podePedirAvaliacao()) return false;
  const total = lerNumero(CHAVE_TOTAL);

  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    // Grava ANTES de abrir: se a pessoa fechar o app com a caixa na tela, o
    // pedido já aconteceu do ponto de vista dela — sem isso, reabrir o app
    // dispararia de novo e viraria a insistência que a regra 3 evita.
    try {
      localStorage.setItem(CHAVE_ULTIMA, String(Date.now()));
      localStorage.setItem(CHAVE_TOTAL, String(total + 1));
    } catch { /* modo privado: segue, o Google ainda tem a cota dele */ }

    trackEvent("app_avaliacao_pedida", { motivo, pagante, vezes, ordem: total + 1 });
    await InAppReview.requestReview();
    return true;
  } catch {
    // Plugin ausente ou Play Services indisponível. Sem alarde: avaliação
    // nunca pode atrapalhar o que a pessoa estava fazendo.
    return false;
  }
}
