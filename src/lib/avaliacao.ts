import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

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
  // Pico do funil: a tela "seu mapa da vida está pronto". BitePal e Brainrot
  // disparam a caixinha EXATAMENTE aí (dá pra ver no vídeo dos funis deles,
  // 14/08) — é o segundo de maior empolgação e vem ANTES de qualquer atrito
  // de preço. É como esses apps acumulam milhares de avaliações.
  | "plano_pronto";

const lerNumero = (chave: string): number => {
  try {
    return Number(localStorage.getItem(chave) ?? 0) || 0;
  } catch {
    return 0;
  }
};

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
  // Só no app da loja: na web a caixa não existe (e o plugin rejeita).
  if (!isNativeShell()) return false;
  if (!pagante && !forte && vezes < 2) return false;

  const total = lerNumero(CHAVE_TOTAL);
  if (total >= MAXIMO_NA_VIDA) return false;

  const ultima = lerNumero(CHAVE_ULTIMA);
  const dias = ultima ? (Date.now() - ultima) / 86_400_000 : Infinity;
  if (dias < DIAS_ENTRE_PEDIDOS) return false;

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
