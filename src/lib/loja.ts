/**
 * A LOJA DA VEZ — textos e mecânica que mudam entre Play e App Store (30/08).
 *
 * Por que existe: o app nasceu só-Android e o nome da loja virou literal
 * espalhado por 8 telas ("pagamento único pelo Google Play · Pix ou cartão",
 * "cancele na Play Store", "o Google não concluiu"). No iPhone cada uma
 * dessas frases é dois problemas ao mesmo tempo:
 *
 *  1. MENTIRA OPERACIONAL. Mandar quem tem iPhone cancelar na Play Store é
 *     mandar a pessoa procurar num app que ela não tem. Isso não vira dúvida,
 *     vira pedido de reembolso.
 *  2. REPROVAÇÃO NA REVISÃO. A regra 3.1.1 da Apple proíbe citar forma de
 *     pagamento de fora da App Store dentro do app. "Pix ou cartão" embaixo
 *     do botão de comprar não é detalhe de copy — é o motivo da recusa, e
 *     cada ida e volta na revisão custa dias.
 *
 * REGRA DESTE ARQUIVO: fora do iOS, tudo aqui devolve exatamente a string
 * que já estava no ar. O Android não muda um caractere — é o funil que está
 * vendendo hoje, e a entrada do iPhone não podia ser a desculpa pra mexer
 * nele. Todo `ehApple() ? novo : <texto de sempre>`.
 */
import { plataformaApp } from "@/lib/native-shell";

export const ehApple = (): boolean => plataformaApp() === "ios";

/** Quem processa a compra. Aparece no legal sob o CTA e nas mensagens de erro. */
export const nomeLoja = (): string => (ehApple() ? "App Store" : "Google Play");

/**
 * "pelo Google Play" × "pela App Store" — a preposição vem junto porque o
 * gênero das duas lojas é DIFERENTE em português (o Google Play, a App
 * Store). Emendar `pela ${nomeLoja()}` num template funciona pra Apple e
 * quebra o Android, que é justamente o texto que está vendendo hoje.
 */
export const pelaLoja = (): string => (ehApple() ? "pela App Store" : "pelo Google Play");

/** Onde a pessoa vai pra cancelar/gerenciar. No Android o caminho real é a
 *  Play Store; na Apple é Ajustes → Apple Account → Assinaturas, mas a loja
 *  também abre — "App Store" é o termo que a pessoa reconhece. */
export const lojaParaCancelar = (): string => (ehApple() ? "App Store" : "Play Store");

/** Dono da folha de pagamento, no meio de frase ("falar com o Google"). */
export const donoDaFolha = (): string => (ehApple() ? "a Apple" : "o Google");

/* As mensagens de erro vêm prontas daqui em vez de montadas na tela porque
 * "o Google" e "a Apple" têm gênero diferente: emendar a variável num
 * template quebra a concordância ("O Apple não concluiu"). Frase inteira por
 * loja é mais longo de ler e impossível de errar. */

/** Falha ao abrir/concluir a folha. */
export const erroFolhaNaoConcluiu = (): string =>
  ehApple()
    ? "A Apple não concluiu o pagamento. Tenta de novo em instantes."
    : "O Google não concluiu o pagamento. Tenta de novo em instantes.";

/** Falha de rede/comunicação com a loja. */
export const erroSemFalarComALoja = (): string =>
  ehApple()
    ? "Não consegui falar com a App Store agora. Tente de novo em instantes."
    : "Não consegui falar com o Google Play agora. Tente de novo em instantes.";

/** Falha ao abrir a folha. */
export const erroSemAbrirALoja = (): string =>
  ehApple()
    ? "Não consegui abrir a App Store agora. Tente de novo em instantes."
    : "Não consegui abrir o Google Play agora. Tente de novo em instantes.";

/**
 * Onde a pessoa gerencia/cancela a assinatura. As duas lojas proíbem o app
 * de processar o cancelamento; o que o app pode e DEVE fazer é levar até lá
 * no clique certo — link genérico de loja faz a pessoa desistir no meio e
 * pedir reembolso pelo suporte.
 */
export const urlGerenciarAssinatura = (pacoteAndroid: string): string =>
  ehApple()
    ? "https://apps.apple.com/account/subscriptions"
    : `https://play.google.com/store/account/subscriptions?package=${pacoteAndroid}`;

/** Confirmação manual ("Já paguei") que não achou nada ainda. No Android a
 *  espera tem causa nomeável (o Pix leva ~1 min pra compensar); na Apple a
 *  compra é síncrona, então não existe minuto nenhum a prometer. */
export const erroPagamentoNaoAchado = (): string =>
  ehApple()
    ? "Ainda não achamos sua compra. Tenta de novo já já."
    : "Ainda não achamos seu pagamento — o Pix pode levar ~1 minuto. Tenta de novo já já.";

/** Binário velho, sem o catálogo novo — o pedido é atualizar na loja certa. */
export const avisoAtualizarApp = (): string =>
  ehApple()
    ? "Atualize o CORE na App Store pra continuar — esta versão ficou sem o catálogo."
    : "Atualize o CORE na Play Store pra continuar — esta versão ficou sem o catálogo.";

/**
 * Formas de pagamento citáveis. String VAZIA no iOS de propósito: a Apple não
 * quer método nenhum nomeado dentro do app, e não existe Pix na App Store.
 * Quem consome tem que tratar o vazio (não emendar " · " fixo).
 */
export const formasDePagamento = (): string => (ehApple() ? "" : "Pix ou cartão");

/** A mesma coisa já com o separador — pra emendar em legal sem deixar " · "
 *  órfão pendurado no fim da frase no iPhone. */
export const sufixoPagamento = (): string => (ehApple() ? "" : " · Pix ou cartão");

/**
 * A ESCADA DE RESGATE do Pix existe? Só no Android.
 *
 * Ela foi desenhada em cima de um fato medido lá: a folha do Google demora
 * 15-25s pra renderizar num aparelho popular, o Pix é o default de quem não
 * tem cartão, e "gerar o código sem pagar" é indistinguível de cancelar. Daí
 * reabrir a folha sozinha na 1ª recusa, avisar que o código vence, e aceitar
 * "Já paguei".
 *
 * Na App Store nada disso tem análogo: a folha é instantânea, autentica no
 * Face ID e cancelar é cancelar — não existe pagamento pendente pra resgatar.
 * Reabrir a folha sozinha ali seria perseguir com um pop-up quem acabou de
 * dizer não, e a própria Apple trata isso como padrão abusivo.
 */
export const temEscadaPix = (): boolean => !ehApple();

/** Legal sob o CTA de compra única. Monta sem emendar separador órfão quando
 *  não há forma de pagamento citável. */
export const legalCompraUnica = (): string =>
  ["pagamento único", pelaLoja(), formasDePagamento(), "sem mensalidade"]
    .filter(Boolean)
    .join(" · ");

/**
 * Disclosure de RENOVAÇÃO, exigida pela regra 3.1.2 da Apple.
 *
 * A Apple obriga o paywall a dizer, na própria tela, que a assinatura
 * **renova sozinha** até a pessoa cancelar. "Cancele quando quiser" NÃO
 * cumpre isso — fala do direito de sair, não do fato de que vai cobrar de
 * novo. É reprovação certa, e é também a frase que gera pedido de reembolso
 * quando a segunda cobrança aparece sem aviso.
 *
 * No Android o mensal da vitrine nasceu PRÉ-PAGO (Pix não renova), então lá
 * "cancele quando quiser" é o texto correto e continua valendo.
 */
export const avisoRenovacao = (): string =>
  ehApple() ? "renova automaticamente até você cancelar" : "cancela quando quiser";

/** Legal sob o CTA de assinatura. */
export const legalAssinatura = (preco: string): string =>
  [`assinatura de ${preco}/mês`, pelaLoja(), formasDePagamento(), "cancela quando quiser"]
    .filter(Boolean)
    .join(" · ");
