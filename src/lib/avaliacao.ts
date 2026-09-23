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
  // número que ainda não existia.
  // VOLTOU EM 03/09, com a trava que faltava: o `primeiro_gasto` só alcançou
  // 5 aparelhos em 2 dias (exige conta criada + 1º gasto no mesmo dia) e as
  // avaliações ficaram em 1–2/dia. O funil é o único lugar com volume — mas
  // agora quem chama a caixa do Google é a PESSOA, tocando na folha de
  // convite. Quem recusa não gasta a janela de 90 dias, que era a única
  // objeção legítima do commit que matou o gatilho.
  | "plano_pronto"
  // iPhone (23/09): convite depois de uma ação de valor de quem PAGA e VOLTOU
  // (2+ dias de uso). Ver `reservarConviteDeValor`.
  | "momento_valor";

const lerNumero = (chave: string): number => {
  try {
    return Number(localStorage.getItem(chave) ?? 0) || 0;
  } catch {
    return 0;
  }
};

/** iPhone? Lê o global do Capacitor direto (mesmo motivo do native-shell: nada
 *  de import novo no caminho da web, e os testes antigos mockam o native-shell). */
export const noIPhone = (): boolean => {
  try {
    const c = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    return c?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
};

/* ─────────────────────────────────────────────────────────────────────────
 * iPHONE: NOTA SÓ DE QUEM PAGA E VOLTOU (23/09, ordem do dono).
 *
 * Medido 17–23/09: 1.659 pedidos de avaliação no iPhone, 1.608 (97%) no
 * "plano pronto" do funil — ninguém ali tinha pago nem usado o app, e 1.560
 * nunca pagaram. O cliente que usa foi pedido 51 vezes. As notas baixas
 * vinham de quem instalou pelo anúncio, fez o quiz, foi pedido pra avaliar e
 * caiu no paywall.
 *
 * Regra nova, SÓ no iPhone (o Android segue como estava):
 *   - nada de pedido no funil nem da caixinha automática da Apple;
 *   - o único caminho é a NOSSA folha (ConviteAvaliacao, motivo
 *     "momento_valor"), e o toque em "Deixar minha nota" abre a tela de
 *     avaliar da App Store (sempre abre; a caixinha só quando a Apple quer);
 *   - só aparece pra quem PAGA (fora do trial), usou o app em 2+ dias
 *     diferentes, e ACABOU de concluir uma ação de valor (lançar gasto,
 *     treino, hábito, conta, água…);
 *   - uma semana entre convites, 90 dias depois de um pedido real, e depois
 *     de 2 "Agora não" nunca mais.
 * ───────────────────────────────────────────────────────────────────────── */
const CHAVE_DIAS_DE_USO = "core-dias-de-uso";
const CHAVE_RECUSAS_VALOR = "core-avaliacao-valor-recusas";
const MAX_RECUSAS_VALOR = 2;
export const DIAS_MINIMOS_PRA_CONVIDAR = 2;

/** Ações que contam como "acabei de conseguir algo" → rótulo da folha. */
export const ACOES_DE_VALOR: Record<string, string> = {
  first_transaction: "Gasto lançado",
  first_bill: "Conta registrada",
  first_income: "Receita lançada",
  first_fixed_expense: "Gasto fixo salvo",
  first_workout: "Treino registrado",
  first_habit: "Hábito marcado",
  first_water_log: "Água registrada",
  first_meal: "Refeição registrada",
  first_task: "Tarefa salva",
  first_schedule: "Rotina atualizada",
  first_goal: "Meta salva",
  first_investment: "Investimento salvo",
};

const hojeLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const lerDias = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_DIAS_DE_USO) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Marca hoje como dia de uso (distintos, últimos 60). Devolve quantos dias. */
export function registrarDiaDeUso(agora = new Date()): number {
  const hoje = hojeLocal(agora);
  const dias = lerDias();
  if (!dias.includes(hoje)) {
    dias.push(hoje);
    try { localStorage.setItem(CHAVE_DIAS_DE_USO, JSON.stringify(dias.slice(-60))); } catch { /* modo privado */ }
  }
  return Math.min(dias.length, 60);
}

export const diasDeUso = (): number => lerDias().length;

/** A regra pura — sem efeito colateral, testável. */
export function deveConvidarNoMomentoDeValor(o: {
  iphone: boolean; acao: string | null | undefined; pagante: boolean; emTrial: boolean; dias: number;
  podePedir: boolean; conviteRecente: boolean; recusas: number;
}): boolean {
  if (!o.iphone) return false;
  if (!o.acao || !(o.acao in ACOES_DE_VALOR)) return false;
  if (!o.pagante || o.emTrial) return false;
  if (o.dias < DIAS_MINIMOS_PRA_CONVIDAR) return false;
  if (!o.podePedir || o.conviteRecente) return false;
  return o.recusas < MAX_RECUSAS_VALOR;
}

/** Reserva o convite de momento de valor (marca a semana ANTES de a folha abrir). */
export function reservarConviteDeValor(acao: string | null | undefined, { pagante, emTrial }: { pagante: boolean; emTrial: boolean }): boolean {
  const ok = deveConvidarNoMomentoDeValor({
    iphone: noIPhone(), acao, pagante, emTrial, dias: diasDeUso(),
    podePedir: podePedirAvaliacao(), conviteRecente: conviteRecente(), recusas: lerNumero(CHAVE_RECUSAS_VALOR),
  });
  if (ok) marcarConvite("core-avaliacao-convite-valor");
  return ok;
}

/** "Agora não" no convite de valor — depois de 2, não convida mais. */
export function registrarRecusaDeValor(): void {
  try { localStorage.setItem(CHAVE_RECUSAS_VALOR, String(lerNumero(CHAVE_RECUSAS_VALOR) + 1)); } catch { /* noop */ }
}

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
const CHAVE_CONVITE_FUNIL = "core-avaliacao-convite-funil";
/** Carimbo do último convite MOSTRADO (qualquer motivo). A cota do Google já
 *  é protegida por `podePedirAvaliacao`, mas ela só conta pedido REAL — duas
 *  folhas seguidas em dias diferentes passariam pelas duas e viveriam como
 *  insistência. Uma semana entre convites resolve sem tabela nova. */
const CHAVE_CONVITE_EM = "core-avaliacao-convite-em";
const ESPERA_ENTRE_CONVITES_MS = 7 * 24 * 3600_000;

const conviteRecente = (): boolean => {
  const quando = lerNumero(CHAVE_CONVITE_EM);
  return quando > 0 && Date.now() - quando < ESPERA_ENTRE_CONVITES_MS;
};

const marcarConvite = (chave: string) => {
  try {
    localStorage.setItem(chave, "1");
    localStorage.setItem(CHAVE_CONVITE_EM, String(Date.now()));
  } catch { /* modo privado */ }
};

/**
 * Reserva o convite do FIM DO FUNIL — uma vez por aparelho.
 *
 * Onde: o passo em que o plano aparece montado, antes de qualquer preço. É o
 * pico da jornada e o único ponto do app com volume de verdade (o funil vê
 * ~300 pessoas/dia; o primeiro gasto, 2–5).
 *
 * O que este portão NÃO faz, e é o ponto: não gasta a janela de 90 dias. A
 * folha só CONVIDA; `pedirAvaliacaoSePuder` (e portanto a cota) só roda se a
 * pessoa tocar em "Deixar minha nota". Quem toca em "Agora não" continua
 * inteiro pros momentos de valor de quem vira usuário de verdade.
 */
export function reservarConviteDoFunil(): boolean {
  if (noIPhone()) return false; // 23/09: no iPhone, nada de pedido no funil
  if (!podePedirAvaliacao()) return false;
  if (lerNumero(CHAVE_CONVITE_FUNIL)) return false;
  if (conviteRecente()) return false;
  marcarConvite(CHAVE_CONVITE_FUNIL);
  return true;
}

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
  // iPhone (23/09): o 1º gasto é no dia da compra, muitas vezes no trial —
  // lá o convite é só o de momento de valor (paga + 2 dias de uso).
  if (noIPhone()) return false;
  if (!podePedirAvaliacao()) return false;
  if (lerNumero(CHAVE_PRIMEIRO_GASTO)) return false;
  if (conviteRecente()) return false;
  if (jaLancouGastoAntes(userId, gastoId)) return false;
  marcarConvite(CHAVE_PRIMEIRO_GASTO);
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
  { pagante = false, vezes = 1, forte = false, tocouParaAvaliar = false }: { pagante?: boolean; vezes?: number; forte?: boolean; tocouParaAvaliar?: boolean } = {},
): Promise<boolean> {
  if (!pagante && !forte && vezes < 2) return false;
  /* iPHONE (23/09): nada de caixinha automática (plano pronto, conta paga,
   * sequência, retrospectiva…). O único caminho é a pessoa tocar em "Deixar
   * minha nota" na folha de momento de valor — ver reservarConviteDeValor. */
  if (noIPhone() && !tocouParaAvaliar) return false;
  /* iPHONE, TOQUE EXPLÍCITO (18/09): a caixinha da Apple (SKStoreReviewController)
   * é uma SUGESTÃO — a Apple decide se mostra, no máximo 3× por ano, e não
   * avisa quando não mostra. 454 pedidos em 7 dias no iPhone renderam poucas
   * notas. Quando a pessoa TOCOU em "Deixar minha nota", ela quer avaliar:
   * abre a página de avaliação da App Store direto (permitido: é ação dela). */
  if (tocouParaAvaliar) {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.getPlatform() === "ios") {
        trackEvent("app_avaliacao_pedida", { motivo, pagante, vezes, ordem: lerNumero(CHAVE_TOTAL) + 1, loja_direto: true });
        try { localStorage.setItem(CHAVE_ULTIMA, String(Date.now())); } catch { /* noop */ }
        window.location.href = "itms-apps://itunes.apple.com/app/id6806913181?action=write-review";
        return true;
      }
    } catch { /* cai na caixinha */ }
  }
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

/* v106 (05/09): pedido DIRETO no "plano pronto", uma vez por aparelho — a folha de convite (vc98) convertia 6%. Portado do v105. */
const CHAVE_PLANO_PRONTO = "core-avaliacao-plano-pronto";

/**
 * O pedido DIRETO no "plano pronto" (v105, 05/09) — a caixa do Google, sem
 * folha nossa na frente. Uma vez por aparelho.
 *
 * A EVIDÊNCIA (por que a folha de convite perdeu): na central, a folha
 * ConviteAvaliacao na variante do plano teve 107 vistas, 4 aceites (3,7%) e
 * 99 recusas em 03–04/09. O pedido direto no MESMO momento, enquanto viveu
 * (27–29/08), colheu 63 avaliações em 3 dias. A folha protegia a janela de
 * 90 dias de quem recusava — mas 96% recusavam, e a janela protegida não
 * virou avaliação em lugar nenhum (o primeiro_gasto segue em 1–2/dia).
 *
 * As travas: `podePedirAvaliacao()` (só no shell, nunca em /preview, 3 na
 * vida, 90 dias) e a chave do aparelho — marcada ANTES de abrir, pra fechar
 * o app com a caixa na tela não fazê-la voltar. Quando as travas comuns
 * barram, a chance do aparelho NÃO é gasta: o momento pode voltar a valer
 * quando a janela abrir.
 *
 * Devolve `true` só quando a caixa foi realmente pedida.
 */
export async function pedirAvaliacaoPlanoPronto(): Promise<boolean> {
  if (noIPhone()) return false; // 23/09: 97% das notas do iPhone vinham daqui, de quem nunca usou
  if (!podePedirAvaliacao()) return false;
  if (lerNumero(CHAVE_PLANO_PRONTO)) return false;
  try { localStorage.setItem(CHAVE_PLANO_PRONTO, "1"); } catch { /* modo privado */ }
  return pedirAvaliacaoSePuder("plano_pronto", { forte: true });
}
