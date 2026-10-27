/**
 * CHAVES DO APARELHO — a fonte única das duas vassouras do cache (14/10).
 *
 * Chamado de 14/10 ("toda vez que eu entro aparece o tutorial"): a vassoura do cache por
 * conta (`purgeUserLocalCache`, use-user-data) roda em TODA abertura do app — o efeito de
 * troca de usuário nasce com `lastUserIdRef = null` — e apaga do localStorage tudo que
 * começa com `u:`, `finance-`, `home-`, `core-`, `life-`, `module-`, `daily-`, `offline-`
 * e `nudge-`. A do logout (`purgeLocalUserCache`, use-auth) faz o mesmo. Isso é certo pro
 * DADO DA CONTA (gravado por useUserData/usePersistedState, sobe pro user_data e volta na
 * hidratação), e errado pro que é do APARELHO: "já vi", contadores, braços de A/B, marcas
 * de aviso armado — gravado direto no localStorage e nunca sincronizado. Cada lista
 * separada (havia duas, uma em cada hook) esquecia uma chave nova e a tela voltava.
 *
 * Regra: chave nova gravada DIRETO no localStorage com um desses prefixos tem que entrar
 * AQUI — em CHAVES_DO_APARELHO (fica) ou em CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS
 * (pode sair). O teste src/test/chaves-do-aparelho-guarda.test.ts varre o código e falha
 * se achar uma chave sem classificação.
 *
 * Este arquivo não importa nada: use-auth e use-user-data importam ele, e um ciclo entre
 * os dois hooks é justamente o que a lista inline evitava.
 */

/** Prefixos que as duas vassouras apagam (cache por conta + chaves antigas sem namespace). */
export const PREFIXOS_VARRIDOS = ["u:", "finance-", "home-", "core-", "life-", "module-", "daily-", "offline-", "nudge-"] as const;

/** Chaves do APARELHO: sobrevivem à abertura do app, ao logout e à troca de conta. */
export const CHAVES_DO_APARELHO: ReadonlySet<string> = new Set<string>([
  "core-vidro-antigo", // rodada 4: o vidro ANTIGO da barra como alternativa (lib/vidro-calai; o Cal AI é o padrão) — só admin
  // preferências e marcas antigas (as listas inline desde 07–08/2026)
  "core-welcome-done",
  "theme",
  "vite-ui-theme",
  "finance-keys-migrated-v2",
  "core-pwa", // "este aparelho é o app instalado" — sem ela, logar mandava o PWA pro funil
  "core-gw-arm", // braço do A/B de gateway
  "core-boas-vindas-visto", // comemoração pós-compra, 1x (antes de um location.href, não dá pra sincronizar)
  "core-trial-cartao-fim", // v61: trial do cartão e Missão dos 3 dias nascem anônimos, antes do login
  "core-missao",
  "core-lembrete-hora",
  "core-theme-mode", // tema escuro e paleta (reviews ★4/★3 de 20/08)
  "core-theme-palette",
  "core-funnel-area", // área escolhida no funil antigo
  // 18/10 (funil da missão na web): o estado do funil da convidada (área, sessão, festa, pagou, e-mail). PRECISA sobreviver
  // à troca de conta — o "Pagar com Pix" cria a sessão anônima (a vassoura roda) e a camada da oferta lê esta chave
  "core-missao-web",
  // ofertas de saída: 1x por lugar, por aparelho (07–10/10)
  "core-save-offer-visto",
  "core-presente69-cancelou-visto",
  "core-presente69-bloqueio-visto",
  "core-presente69-x-paywall-visto",
  "core-mensal19-mensal-paywall-visto",
  "core-mensal19-cancelou-visto",
  "core-mensal19-bloqueio-visto",
  "core-mensal19-recusa-visto", // 22/10: lugar "recusa" do mensal 19 (reservada; o card da recusa marca por recusa em core-card-recusa-visto)
  "ofertas-saida-force",
  // lembrete do dia 2 / 1ª semana e notificações já contadas (03/10)
  "core-dia2",
  "core-notif-entregues",
  // 14/10 (af0e444f): o tutorial voltava a cada abertura
  "core-home-tour-done",
  "core-home-tour-vistas", // 1.0.16: aberturas em que o tour apareceu sem chegar ao fim (2 = a última)
  // 14/10: festas (adesivo/marco/capa) que JÁ apareceram neste aparelho — fechar o app com a festa aberta não a repete
  "core-festas-mostradas",
  "core-dia1-braco",
  "core-missao-1-por-dia", // 1.0.16: a última resposta do RevenueCat pro teste "missão 1 por dia" (metadata missao_1_por_dia)
  "core-dias23", // 1.0.18: a última resposta do RevenueCat pros dias 2 e 3 do teste (metadata dias23: on|off, lib/dias23)
  "core-tour-home-quando", // 1.0.17: a última resposta do RevenueCat pra QUANDO o tour curto entra (metadata tour_home_quando: dia1|dia2)
  "core-tour-home-remoto", // 1.0.16: a última resposta do RevenueCat pro tour da Home (metadata tour_home: curto|longo|off)
  "core-device-id",
  "core-aviso-cobranca-notif",
  // 14/10 — auditoria das chaves gravadas direto no localStorage (1.0.14 e antes):
  "core-cartoes-dica-deslizar", // a dica "deslize" dos cartões do módulo, 1x
  "core-dia-100-visto", // festa do dia 100 (anel cheio), 1x por dia
  "core-area-landed", // web: a raiz "/" pousa no módulo do funil UMA vez; depois é a Home
  "core-funil-w-area", // área da porta do funil W: Missão em doses, ação do dia, lembrete do dia 2
  "core-dias-de-uso", // dias distintos de uso: avaliação ("usou em 2+ dias") e a turma do aparelho
  "core-avaliacao-ultima", // travas do pedido de nota: 1 a cada 90 dias, 3 na vida do aparelho
  "core-avaliacao-total",
  "core-avaliacao-valor-recusas", // 2 "Agora não" → nunca mais
  "core-avaliacao-convite-em", // 1 semana entre convites
  "core-avaliacao-convite-valor",
  "core-avaliacao-convite-teste-dia2", // 1.0.18: o pedido do teste que voltou no dia 2 já foi reservado (lib/avaliacao)
  "core-avaliacao-teste-dia2", // 1.0.18: a última resposta do RevenueCat pro pedido do teste no dia 2 (metadata avaliacao_teste_dia2: on|off)
  "avaliacao-teste-dia2-force", // 1.0.18: força de QA do pedido do teste no dia 2 (?avaliacao-teste-dia2=on|off|auto)
  "core-avaliacao-convite-funil",
  "core-avaliacao-primeiro-gasto",
  "core-avaliacao-plano-pronto",
  "core-avaliacao-momento-ruim", // 24 h sem pedir nota depois de cobrança recusada/cancelamento/presente
  "core-contas-pagas", // contadores de momento de valor (pedido de nota "na 2ª vez")
  "core-extratos-importados",
  "core-att-status", // o ATT do iPhone já foi pedido (e o estado que vai nos eventos)
  "core-att-momento", // 1.0.18: a última resposta do RevenueCat pra QUANDO o ATT é pedido (metadata att_momento: auto3s|comecar|ab)
  "core-menu-novo", // 1.0.18: a última resposta do RevenueCat pro menu novo da conta (metadata menu_novo: todos|off)
  "core-card-recusa", // 1.0.18: a última resposta do RevenueCat pro card da recusa (metadata card_recusa: on|off)
  "core-card-recusa-visto", // 1.0.18: a recusa (billingIssueDetectedAt) cujo card já apareceu — 1x por recusa, reabrir não repete
  "card-recusa-force", // 1.0.18: força de QA do card da recusa (?card-recusa=on|off|auto)
  "core-card-recusa-visto-em", // 1.0.18: QUANDO o card da recusa apareceu (o 2º degrau espera 7 dias depois dele)
  "core-recusa-degrau2", // 1.0.18: a última resposta do RevenueCat pro 2º degrau da recusa (metadata recusa_degrau2: on|off)
  "core-recusa-degrau2-visto", // 1.0.18: a recusa (billingIssueDetectedAt) cujo 2º degrau já apareceu — 1x por recusa, reabrir não repete
  "core-motivos-folha", // 1.0.18: a última resposta do RevenueCat pra folha "O que te fez parar?" (metadata motivos_folha: off|on|ab)
  "core-motivos-braco", // 1.0.18: o braço sorteado no modo "ab" do motivos_folha (com|sem), estável entre aberturas
  "core-menu-novo-aviso", // 1.0.18: o aviso "modo escuro e cores agora ficam no menu › Aparência" já resolvido (visto|nao-precisa), 1x por aparelho
  "core-att-braco", // 1.0.18: o braço sorteado no modo "ab" do att_momento (auto3s|comecar), estável entre aberturas
  "core-sino-paywall", // 1.0.18: a última resposta do RevenueCat pra tela do sino antes do paywall (metadata sino_paywall: off|on|ab)
  "core-sino-braco", // 1.0.18: o braço sorteado no modo "ab" do sino_paywall (com|sem), estável entre aberturas
  "core-sino-visto", // 1.0.18: a tela do sino já apareceu neste aparelho (nunca repete: voltar, reabrir, deep link)
  "core-lembrete-teste", // pedido do aviso de 36 h do teste (texto de uso desde 16/10), armado quando a permissão vier
  "core-semana-pagante", // 16/10: semana do pagante (começo + último agendamento dos 7 avisos depois do pagamento)
  "core-folha-aberta-em", // saída do app: hora do último toque em comprar
  "core-saida-vista", // saída do app: última morte já reportada (senão reporta a mesma a cada abertura)
  "core-renderer-visto",
  "core-cadastro-ab", // braço do A/B da tela de cadastro
  "core-w-braco", // braço do A/B do paywall do funil W
  "core-compromisso-visto", // tela do compromisso do funil, 1x
  "core-como-pagou", // "como você pagou?", respondida 1x
  "core-batismo-pendente", // web: compra sem conta ainda deve e-mail e senha (guarda o id do anônimo)
  "core-compra-anonima", // web: prova da compra anônima, 24 h, pra trazer o Pix pra conta em que entrou
  "core-codigo-pendente", // código promocional validado antes do cadastro, resgatado depois
  "core-montar-financas", // 1.0.16: "Vamos montar suas Finanças" feito/pulado (+ vistas); a mesma chave vai pra conta
  "core-montar-rotina", // 1.0.16: "Rotina pronta em 3 toques" feito/pulado (+ vistas, rascunho, 1º quadradinho); a mesma chave vai pra conta
  "core-skan-trial-sdk", // 1.0.19 (varredura 26/10): a última resposta do RevenueCat pra chave skan_trial_sdk (on|off, padrão off) — o StartTrial pelo SDK da Meta (lib/skan-trial-sdk)
  "core-skan-trial-enviado", // 1.0.19: ids das transações cujo StartTrial já saiu pelo SDK da Meta (lib/meta-inicio-teste-ios) — nunca repetir
  "core-back-variante", // 21/10: o texto do BACK dos funis web (a|b) sorteado no aparelho — braço de A/B, não pode trocar (lib/back-funil)
  "core-home-nova", // 1.0.19: a última resposta do RevenueCat pra Home nova (metadata home_nova: off|admin|on|ab, lib/home-nova)
  "core-home-nova-braco", // 1.0.19: o braço sorteado no modo "ab" da home_nova (nova|atual), estável entre aberturas
  "core-home-nova-admin", // 1.0.19: a resposta da checagem de admin pra conta ("<uid>:1|0"), pra 2ª abertura não esperar a consulta
  "core-home-nova-fogo", // 1.0.19: o dia em que o fogo da pílula da Home nova já acendeu (o pulso toca 1x por dia)
  "core-home-nova-score-100", // 1.0.19 (26/10): o dia em que o card do score da Home nova já fez a festinha do 100 (estrela âmbar, 1x por dia)
  "core-home-nova-origem-aparelho", // 1.0.19 (26/10): o espelho da origem da conta ("<uid>:nova|antiga", lib/home-nova) — modo "novas"
  "core-home-nova-dica-mais", // 1.0.19 (26/10): a dica do "+" já tocada/aparições (lib/dica-mais) — nunca volta; a mesma chave vai pra conta
  "core-fluxo-enxuto", // 1.0.21 (27/10): a última resposta do RevenueCat pro fluxo enxuto (metadata fluxo_enxuto: on|off|ab, lib/fluxo-enxuto)
  "core-fluxo-enxuto-braco", // 1.0.21: o braço sorteado no "ab" do fluxo enxuto (enxuto|atual), estável entre aberturas
  "core-festas-calma", // 1.0.21: as festas de conquista já mostradas HOJE nos 3 primeiros dias da conta ({ dia, n }, lib/festas-calma)
]);

/** Famílias de chaves do aparelho (prefixo + id). */
export const PREFIXOS_DO_APARELHO: readonly string[] = [
  "core-cartoes-vistos-", // "já vi os cartões" de cada módulo (14/10)
  "core-intro-vista-", // "já vi a intro" de cada módulo (16/10, lib/intro-modulo): terminou, feita ou pulada — a missão lê (continuação)
  "core-intro-aberta-", // a intro do módulo já APARECEU neste aparelho (fechou o app no meio): a 2ª aparição é a última
  "core-conhecer-feito-", // o passeio "Conhecer mais" do módulo foi feito neste aparelho (17/10, lib/conhecer-mais)
  "core-conhecer-lembrete-", // o lembrete do passeio (3ª abertura) já apareceu: nunca mais sozinho
  "core-conhecer-aberturas-", // quantas vezes o módulo foi aberto neste aparelho (o lembrete é na 3ª)
  "core-conhecer-aberto-", // o passeio do módulo já foi ABERTO neste aparelho (17/10): a lâmpada do cabeçalho some depois de usada
  "core-financas-painel-", // 1.0.16: conta <id> é do painel limpo de Finanças (lib/financas-painel-limpo); a conta guarda o mesmo
  // 17/10: escrita feita antes de a conta chegar do servidor, guardada até ser juntada
  // (`core-seguradas-<id da conta>:<chave>`, use-user-data). A vassoura da abertura NÃO pode
  // levar — é o que faz o registro sobreviver a fechar o app; quem apaga é o próprio
  // use-user-data (servidor confirmou, saiu da conta, outra conta entrou, "começar do zero").
  "core-seguradas-",
];

/** A chave é do aparelho (nenhuma vassoura apaga)? */
export const ehChaveDoAparelho = (k: string): boolean =>
  CHAVES_DO_APARELHO.has(k) || PREFIXOS_DO_APARELHO.some((p) => k.startsWith(p));

/** A vassoura (abertura do app, logout, troca de conta, "começar do zero") apaga esta chave? */
export const vassouraLeva = (k: string): boolean =>
  !ehChaveDoAparelho(k) && PREFIXOS_VARRIDOS.some((p) => k.startsWith(p));

/**
 * REVISADAS E LIBERADAS PRA VASSOURA — chaves com prefixo varrido que aparecem no código
 * que mexe no localStorage mas PODEM sair. Só existe pro teste-guarda: chave nova que
 * não está nem aqui nem em CHAVES_DO_APARELHO faz o teste falhar até alguém decidir.
 * Terminada em "*" = família montada com template (`prefixo${id}`).
 */
export const CHAVES_REVISADAS_DA_CONTA_OU_TRANSITORIAS: Readonly<Record<string, readonly string[]>> = {
  // DA CONTA: gravadas por useUserData/usePersistedState (sobem pro user_data e voltam na hidratação;
  // no aparelho moram em `u:<id>:<chave>`). Aparecem em arquivos que também mexem no localStorage.
  conta: [
    "core-all-modules-celebrated", "core-onboarding-done", "core-onboarding-reset-v2", "core-user-name",
    "core-dias-anotados", "core-hub-streak", "core-tip-seen-*", "core-demo-conta", "core-home-widgets-v2",
    "core-home-resumos", // os 3 cards da página 1 da Home nova (lib/home-resumos, gravado por useUserData.set)
    "core-cor-antes-home-nova", // a cor do tema de antes da Home nova (HomeE guarda; pages/Home devolve e apaga com a chave off)
    "core-home-nova-origem", // 26/10: o marcador de origem da conta { tipo: nova|antiga } (OrigemDaContaNaSessao grava; lib/home-nova)
    "core-home-widgets-e", // os widgets da Home nova (lib/home-widgets-e: ids na ordem da escolha, até 6)
    "core-intro-vistas", // lista de módulos com intro vista NESTA CONTA (lib/intro-modulo, gravada por useUserData.set)
    "core-intro-feitas", // lista de módulos com intro FEITA nesta conta (a missão lê pra não repetir a 1ª ação)
    "core-intro-acao-rapida", // 1.0.17: módulos cujo único dado veio da ação rápida da Home (a intro ainda aparece)
    "core-conhecer-feitos", // lista de módulos com o passeio "Conhecer mais" feito nesta conta (lib/conhecer-mais)
    "core-escolhas-proprias", // 1.0.17: as opções que a pessoa ESCREVEU no "+ Outro" (EscolhaRapida), por lista — na conta (useUserData)
    "core-mood-log", "core-rotina-habit-log", "core-saude-sleep", "core-saude-supplement-log",
    "core-saude-water", "core-saude-water-goal", "core-dieta-log", "core-dieta-meals", "core-gratitude-log",
    "finance-*", "finance-categorization-rules", "finance-dueDays", "finance-expenses", "finance-fixed-expenses",
    "finance-incomes", "finance-installments", "finance-notes", "finance-perfil-ativo", "finance-perfis", "finance-sem-gasto",
    "finance-ultima-importacao", "finance-dueDays-mes", "finance-fixed-expenses-mes", "finance-investments",
    "core-financas-painel", // 1.0.16: { limpo: true } do painel limpo (a cópia do aparelho é a família core-financas-painel-<id>)
    "core-kit-primeiro-mes", // o kit pago: só o SERVIDOR grava no user_data da conta (21/10, lib/conteudo-pago); o app lê pelo useUserData
  ],
  // SÓ NO sessionStorage (a vassoura só mexe no localStorage) ou nem é chave de storage.
  sessao_ou_nao_storage: [
    "core-back-qa", "core-back-qa-v", "core-back-usados", // 21/10: BACK dos funis web — força de QA e "já usado" por etapa, só no sessionStorage (lib/back-funil)
    "core-demo-guarda", "core-demo-volta", "core-demo-tour", "core-pwa-open-sent",
    "core-lembretes", // id do canal de notificação do Android
    // 1.0.19 (lib/home-nova): NÃO são chaves de storage — "home-nova" é o parâmetro da URL (?home-nova=on|off|auto),
    // "home-nova:mais" é o nome do evento da barra de vidro, "home-nova:*" é o sal do sorteio do braço (FNV)
    "home-nova", "home-nova:mais", "home-nova:*", "home-nova:origem",
    "core-vidro-calai", // rodada 4: a chave da rodada 3 (vidro Cal AI opcional) que lib/vidro-calai só APAGA — a vassoura pode apagar também
  ],
  // FUNIL ANTES DA CONTA: progresso/respostas que só valem até o cadastro (a área fica: core-funil-w-area).
  funil_antes_da_conta: [
    "core-funil-w-respostas", "core-funil-w-passo", "core-funil-w-pos-compra", "core-funil-w-plano",
    "core-teste-dor", "core-lembrete-intencao",
  ],
  // UMA VIAGEM PELO LOGIN: gravadas antes de sair pro Google/Apple e lidas (e apagadas) na volta, no
  // primeiro render — antes do efeito da vassoura.
  ida_e_volta_do_login: ["core-pos-compra-oauth", "core-auth-next"],
  // LEGADO DO TESTE DE CONVIDADO (Android v53, nada grava desde 18/08): depois do login quem manda é
  // a assinatura; limpar no login é o comportamento que já vale.
  legado_teste_convidado: ["core-teste-inicio", "core-guia-semente"],
  // DE PROPÓSITO SÓ ATÉ A PRÓXIMA ABERTURA / QA: o "Agora não" do aviso de cobrança (modo antigo),
  // a fila offline (ninguém enfileira) e as forças de QA do paywall.
  transitorias: [
    "core-aviso-cobranca-fechado-ate", "core-offline-queue",
    "core-debug-loja", "core-debug-pix-vence", "core-debug-resgate-pix",
  ],
};
