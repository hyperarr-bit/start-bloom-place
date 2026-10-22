/**
 * RevenueCat — assinatura do app Android (22/07). Carrega SÓ no shell nativo,
 * por import dinâmico: o bundle web nunca puxa o plugin.
 *
 * IDENTIDADE (correção 25/07 — era bug de dinheiro): o RevenueCat precisa
 * conhecer a pessoa pelo MESMO id do Supabase. Antes a gente configurava
 * anônimo ($RCAnonymousID:…), então a compra ficava pendurada no APARELHO:
 * nenhum servidor conseguia dizer QUAL conta CORE pagou, o webhook não tinha
 * pra quem dar acesso e "Restaurar compras" não atravessava reinstalação.
 * Agora: configure({ appUserID: user.id }) e logIn/logOut acompanhando a
 * sessão do Supabase.
 *
 * GRANT (mesma correção): a compra no RevenueCat NÃO liberava o app, porque
 * o gate (`useAuth().isSubscribed`) só olha a tabela `subscriptions`. Quem
 * assinasse na Play pagava e continuava trancado. Agora todo caminho que
 * ativa entitlement (comprar, restaurar, abrir o app já assinante) chama a
 * edge function `revenuecat-sync`, que confere na API do RevenueCat e grava
 * a linha em `subscriptions`. O webhook `revenuecat-webhook` faz o mesmo do
 * lado do servidor (renovação, cancelamento, reembolso) — o sync do cliente
 * é o reforço pra pessoa não ficar esperando.
 *
 * Estados possíveis (o paywall trata os quatro):
 *  - "pronto": chave configurada + offerings carregadas → compra funciona
 *  - "sem_chave": a chave da loja da vez ausente (VITE_REVENUECAT_ANDROID_KEY
 *    no Android, VITE_REVENUECAT_IOS_KEY no iOS). Paywall mostra os
 *    preços, botão desabilitado com aviso. NUNCA quebra o app.
 *  - "sem_produto": chave ok, mas o RevenueCat não devolveu nenhum pacote —
 *    produtos ainda não publicados na loja. Sem esse estado o configure()
 *    sozinho dizia "pronto" e o botão de assinar ficava ativo falhando calado.
 *  - "erro": plugin falhou (rede etc.) → mesmo tratamento de sem_chave.
 *
 * Os três estados que não são "pronto" caem no mesmo lugar nas telas
 * (`rc !== "pronto"` → botão desabilitado + aviso), então adicionar um novo
 * não exige mexer em paywall nenhum.
 */
import { isNativeShell, plataformaApp } from "@/lib/native-shell";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { marcarTrialCartaoAte, trialCartaoAtivo } from "@/lib/teste-gratis";
import { deviceId, turma } from "@/lib/aparelho";
import { lerCorpoAparelho } from "@/lib/meta-dados-aparelho";
import { registrarChavesRemotas } from "@/lib/ofertas-saida";
import { registrarUmPorDiaRemoto } from "@/lib/dia1-cheio";
import { registrarChaveMontarFinancas } from "@/lib/montar-financas";
import { registrarChavePainelLimpo } from "@/lib/financas-painel-limpo";
import { registrarChaveRemotaConquistas2 } from "@/lib/conquistas2";
import { registrarIntroRemota } from "@/lib/intro-modulo";
import { registrarAttMomentoRemoto } from "@/lib/att-momento";
import { registrarChaveMontarRotina } from "@/lib/montar-rotina";
import { registrarDesafiosRodizioRemoto } from "@/lib/desafios-rodizio";
import { registrarMedicaoTotalRemota } from "@/lib/medicao-total";
import { registrarChavePaywallMinimalista } from "@/lib/paywall-minimalista";
import { registrarMenuNovoRemoto } from "@/lib/menu-novo";
import { registrarSinoRemoto } from "@/lib/sino-paywall";
import { registrarCardRecusaRemoto } from "@/lib/card-recusa";

/** As chaves que viajam no metadata das offerings (um lugar só, chamado em toda leitura de offerings):
 *  ofertas de saída (10/10), Conquistas 2 (16/10, `conquistas2`), a intro do módulo (16/10, `intro_modulo`), o
 *  rodízio dos desafios da semana (17/10, `desafios_rodizio`), o paywall minimalista do iPhone (17/10,
 *  `paywall_minimalista` on|off, lib/paywall-minimalista) e as
 *  do teste da 1.0.16 — `missao_1_por_dia` (ab|on|off) + `tour_home` (curto|longo|off) em lib/dia1-cheio,
 *  `montar_financas` (on|off), `financas_painel_limpo` (on|off), `montar_rotina` (on|off) e a medição total (`medicao_total`,
 *  on|off, lib/medicao-total). Cada uma isolada: uma metadata estranha nunca derruba as outras. */
const registrarChavesDasOfferings = (offerings: unknown): void => {
  const cada: Array<(o: unknown) => void> = [
    registrarChavesRemotas,
    registrarChaveRemotaConquistas2,
    registrarIntroRemota,
    registrarDesafiosRodizioRemoto,
    registrarUmPorDiaRemoto,
    registrarChaveMontarFinancas,
    registrarChavePainelLimpo,
    registrarChaveMontarRotina,
    registrarMedicaoTotalRemota,
    registrarChavePaywallMinimalista,
    registrarAttMomentoRemoto, // 1.0.18: `att_momento` (auto3s|comecar|ab) — quando o ATT é pedido (lib/att-momento)
    registrarCardRecusaRemoto, // 1.0.18: `card_recusa` (on|off, padrão off) — o card de tela inteira do cartão recusado (lib/card-recusa)
    registrarMenuNovoRemoto, // 1.0.18: `menu_novo` (todos|off) — o menu da conta em 3 grupos + topo sem sol/paleta (lib/menu-novo)
    registrarSinoRemoto, // 1.0.18: `sino_paywall` (off|on|ab) — a tela do sino antes do paywall do iPhone (lib/sino-paywall)
  ];
  for (const f of cada) {
    try { f(offerings); } catch { /* uma chave estranha não leva as outras */ }
  }
};

type EstadoRC = "pronto" | "sem_chave" | "sem_produto" | "erro";
let estado: EstadoRC = "sem_chave";
let Purchases: typeof import("@revenuecat/purchases-capacitor").Purchases | null = null;
let configurado = false;
let appUserIdAtual: string | null = null;

const idDoUsuario = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

const temEntitlement = (info: unknown): boolean =>
  Object.keys(
    ((info as { entitlements?: { active?: Record<string, unknown> } })?.entitlements?.active) ?? {}
  ).length > 0;

/**
 * A chave é POR LOJA (30/08, entrada do iPhone). A do RevenueCat carrega a
 * plataforma no prefixo: `goog_` só fala com o Play, `appl_` só com a App
 * Store. Trocar uma pela outra não dá erro no configure() — o SDK sobe, e
 * getOfferings() volta VAZIO. Ou seja: o modo de falha é exatamente o
 * `rc_sem_chave` que já custou um app na loja sem forma de pagamento
 * (ver o cabeçalho do scripts/preparar-loja.mjs). Por isso a escolha é
 * explícita por plataforma, e não uma chave só com fallback.
 */
/* segurança 21/10: leitura NOMEADA de cada variável. `import.meta.env` usado como objeto faz o Vite colar o env
 * INTEIRO no bundle (todas as VITE_*, inclusive a senha da conta de QA da Porta) — trava em src/test/seguranca. */
const chaveDaLoja = (): string | undefined =>
  plataformaApp() === "ios"
    ? (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined)
    : (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined);

export async function initRevenueCat(): Promise<EstadoRC> {
  if (!isNativeShell()) return "sem_chave";
  const key = chaveDaLoja();
  if (!key) { estado = "sem_chave"; return estado; }
  try {
    if (!Purchases) {
      const mod = await import("@revenuecat/purchases-capacitor");
      Purchases = mod.Purchases;
    }
    const uid = await idDoUsuario();

    if (!configurado) {
      // appUserID no configure evita o pulo anônimo→identificado logo no
      // primeiro launch de quem já está logado.
      await Purchases.configure({ apiKey: key, appUserID: uid ?? undefined });
      configurado = true;
      appUserIdAtual = uid;
      /* 10/10 (1.0.14): turma e device_id como ATRIBUTOS do assinante no RevenueCat —
       * é o que deixa cruzar "a turma de 12/10 renovou?" no painel deles e no
       * webhook sem passar pelo nosso banco. Solto e engolido: nunca segura o init.
       * `$fbAnonId` NÃO entra aqui (é do agente da Meta). */
      void (async () => {
        try { await Purchases!.setAttributes({ core_turma: turma(), core_device_id: deviceId() }); }
        catch { /* SDK velho sem o método, ou rede: segue sem */ }
      })();
    } else if (uid !== appUserIdAtual) {
      // trocou de conta dentro do app (ou logou depois do configure)
      if (uid) await Purchases.logIn({ appUserID: uid });
      else await Purchases.logOut();
      appUserIdAtual = uid;
    }

    /* CONFIRMA COMPRA PENDENTE AO ABRIR O APP (01/09 — caso real, com prejuízo).
     *
     * Quem paga com PIX na folha do Google não compra na hora: o Google cria a
     * assinatura em estado PENDENTE e manda a pessoa "abrir o app para
     * confirmar o plano". Quem não confirmar em 3 DIAS tem a compra
     * CANCELADA E ESTORNADA pelo Google, sozinho.
     *
     * Só que abrir o app não confirmava nada: `configure()` + `getOfferings()`
     * não sincronizam compra. Quem confirma é `syncPurchases()`, que manda os
     * recibos do aparelho pro RevenueCat validar — e é a validação que gera o
     * acknowledge no Google. Até aqui isso só acontecia se a pessoa achasse o
     * botão "Restaurar compras" dentro do paywall.
     *
     * O estrago já estava no relatório de compras anuladas da Play: em 29 dias,
     * uma cancelada pelo próprio Google (origem 2) exatamente 3 dias depois da
     * compra, e uma devolvida a pedido de quem alegou "não recebi o item".
     * Pix é o meio padrão de quem não tem cartão, então isso atinge justamente
     * a fatia que mais compra o mensal.
     *
     * Roda solto de propósito: se falhar, o init não pode cair junto — o
     * paywall precisa abrir de qualquer jeito. */
    void (async () => {
      try { await Purchases!.syncPurchases(); }
      catch (e) { console.warn("[RC] syncPurchases no boot falhou:", e); }
    })();

    const offerings = await Purchases.getOfferings();
    // 10/10: as chaves das ofertas de saída viajam no metadata das offerings (ofertas-saida.ts)
    registrarChavesDasOfferings(offerings);
    // configure() aceita qualquer chave bem formada, mesmo sem produto nenhum
    // do outro lado. Só chamo de "pronto" se existir pacote pra comprar.
    const pacotes = offerings?.current?.availablePackages ?? [];
    estado = pacotes.length ? "pronto" : "sem_produto";
  } catch (e) {
    console.warn("[RC] init falhou:", e);
    estado = "erro";
  }
  return estado;
}

export const estadoRevenueCat = () => estado;

/** Chamar quando a sessão do Supabase muda: assinatura tem que seguir a
 *  CONTA, não o aparelho. Sem isso, quem desloga e entra com outro e-mail
 *  no mesmo celular herda o acesso do anterior. */
export async function identificarRevenueCat(userId: string | null): Promise<void> {
  if (!isNativeShell() || !Purchases || !configurado) { appUserIdAtual = userId; return; }
  if (userId === appUserIdAtual) return;
  try {
    if (userId) await Purchases.logIn({ appUserID: userId });
    else await Purchases.logOut();
    appUserIdAtual = userId;
  } catch (e) {
    console.warn("[RC] identificar falhou:", e);
  }
}

/** Manda o servidor conferir o entitlement na API do RevenueCat e gravar o
 *  acesso em `subscriptions` — é isso que destranca o app. Tenta de novo
 *  algumas vezes porque o RevenueCat leva um instante pra registrar a compra
 *  recém-feita do lado dele. */
export async function sincronizarAssinatura(tentativas = 3): Promise<boolean> {
  // Compra ANÔNIMA (cadastro depois da compra, 09/08): sem sessão não existe
  // pra quem gravar linha — o sync de verdade roda no "liberando", depois que
  // a conta nasce. Retornar já evita 3 retries de 401 (~4s de espera morta
  // entre a folha do Google e a tela de cadastro).
  if (!(await idDoUsuario())) return false;
  /* 20/10 (iOS 1.0.17): ATT atual + (SÓ com aceite) IDFA + versões, pro CAPI
   * do teste/compra casar mais. IP/UA o servidor lê dos headers e só guarda
   * com o aceite. Android/web: sem corpo, como sempre. */
  let aparelho: Awaited<ReturnType<typeof lerCorpoAparelho>> = null;
  try { aparelho = await lerCorpoAparelho(); } catch { /* nunca segura o sync */ }
  for (let i = 0; i < tentativas; i++) {
    try {
      const { data, error } = aparelho
        ? await supabase.functions.invoke("revenuecat-sync", { body: { aparelho } })
        : await supabase.functions.invoke("revenuecat-sync");
      if (!error && data?.subscribed) return true;
      if (!error && data?.checked && i === tentativas - 1) return false;
    } catch (e) {
      console.warn("[RC] sync falhou:", e);
    }
    if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return false;
}

/** O tutorial pós-pago (Missão B1 → holofote → celebração) liga pelo
 *  marcador local do trial — que só nascia no callback de sucesso da compra.
 *  Quem virou assinante sem o app SABER que era trial ficava sem tutorial
 *  (19/08: 1 dos 3 trials do dia — v61 de compra implícita; o Android
 *  matando o app na folha produziria o mesmo buraco no v62+). Aqui o
 *  assinante tem o periodType conferido direto no RevenueCat: TRIAL = marca
 *  o fim REAL do período. Chamada pelo use-auth uma vez por sessão, só no
 *  app da loja, só pra quem o banco já diz que é assinante. */
export async function conferirTrialCartao(): Promise<void> {
  if (!isNativeShell()) return;
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const ativos =
      ((customerInfo as unknown as {
        entitlements?: { active?: Record<string, { periodType?: string; expirationDateMillis?: number | null; willRenew?: boolean }> };
      })?.entitlements?.active) ?? {};
    const trial = Object.values(ativos).find((e) => e?.periodType === "TRIAL");
    if (trial && !trialCartaoAtivo()) {
      // fallback 7d (23/08): o único trial da vitrine nova é o anual de 7
      // dias — o fim REAL continua vindo do expirationDateMillis.
      marcarTrialCartaoAte(trial.expirationDateMillis ?? Date.now() + 7 * 86_400_000);
    }
    /* 01/10: o lembrete "acaba amanhã" prometido no paywall segue a verdade da
     * loja — fim real do teste reagenda; cancelou (willRenew false) ou já virou
     * cobrança (sem TRIAL ativo) desarma. Solto: nunca segura o boot.
     * 07/10 (revisão dos usos de willRenew): aqui ele PODE ficar — willRenew
     * false por cartão recusado só existe depois da 1ª tentativa de cobrança,
     * ou seja, com o teste já terminado; desarmar o "acaba amanhã" nesse caso
     * é o certo (quem avisa é o aviso de cobrança recusada). */
    void import("@/lib/notificacoes")
      .then((n) => n.sincronizarLembreteDoTeste({
        emTeste: !!trial,
        vaiRenovar: trial?.willRenew !== false,
        fimMs: typeof trial?.expirationDateMillis === "number" ? trial.expirationDateMillis : null,
      }))
      .catch(() => { /* noop */ });
    /* 16/10 (1.0.16): a SEMANA DO PAGANTE (7 avisos de uso depois do pagamento) nasce
     * aqui — teste com renovação ligada arma pro fim do teste; compra paga recente
     * confirma; teste cancelado desarma. Solto: nunca segura o boot. */
    void import("@/lib/semana-do-pagante")
      .then((m) => m.conferirSemanaDoPagante(ativos as Record<string, import("@/lib/semana-do-pagante").EntitlementDaLoja>))
      .catch(() => { /* noop */ });
  } catch { /* rede de segurança: nunca pode quebrar o boot */ }
}

/**
 * COBRANÇA RECUSADA (26/09). 11 testes do iPhone (turmas 21–23/09) deixaram
 * a renovação ligada e o cartão foi recusado no fim do teste: a loja segue
 * tentando por semanas, e basta a pessoa trocar o cartão pra entrar. Só que
 * ninguém avisava — sem carência ligada ela só vê o acesso sumir.
 *
 * O RevenueCat marca `billingIssueDetectedAt` no entitlement (em `all`, que
 * inclui os inativos; com carência ele continua em `active`). Quem cancelou
 * (`unsubscribeDetectedAt`) não entra: aí não é cartão, é decisão.
 *
 * DEFEITO 20/09→07/10 (aviso_cobranca_view = 0 com 68 pessoas em carência):
 * o filtro exigia `willRenew !== false`. Só que o SDK CALCULA willRenew —
 * purchases-ios EntitlementInfo.willRenewWithExpirationDate:
 *   willRenew = !(promo || vitalício || unsubscribeDetectedAt || billingIssueDetectedAt || prepago)
 * Ou seja: cartão recusado ⇒ willRenew SEMPRE false ⇒ o filtro descartava
 * exatamente todo caso que ele existia pra pegar. willRenew não entra mais
 * na conta: billingIssueDetectedAt presente + unsubscribeDetectedAt ausente.
 */
export type ProblemaDeCobranca = {
  temProblema: boolean;
  comAcesso: boolean;
  url: string | null;
  /** 10/10: quando a loja detectou o cartão recusado (ISO) — base do contador da carência. */
  detectadoEm?: string | null;
  /** 22/10: o produto da assinatura recusada (o card da recusa não oferece o mensal 19 a quem já está nele). */
  produto?: string | null;
};
const SEM_PROBLEMA: ProblemaDeCobranca = { temProblema: false, comAcesso: false, url: null };

/** O formato do entitlement que estas leituras usam (subconjunto do PurchasesEntitlementInfo). */
type EntitlementLido = {
  periodType?: string;
  isActive?: boolean;
  willRenew?: boolean;
  expirationDateMillis?: number | null;
  billingIssueDetectedAt?: string | null;
  unsubscribeDetectedAt?: string | null;
  productIdentifier?: string | null;
};
type InfoLida = {
  managementURL?: string | null;
  entitlements?: { all?: Record<string, EntitlementLido>; active?: Record<string, EntitlementLido> };
} | null | undefined;

export function lerProblemaDeCobranca(info: unknown): ProblemaDeCobranca {
  const i = info as InfoLida;
  const todos = Object.values(i?.entitlements?.all ?? {});
  const e = todos.find((x) => !!x?.billingIssueDetectedAt && !x?.unsubscribeDetectedAt);
  if (!e) return SEM_PROBLEMA;
  return {
    temProblema: true, comAcesso: !!e.isActive, url: i?.managementURL ?? null, detectadoEm: e.billingIssueDetectedAt ?? null,
    ...(e.productIdentifier ? { produto: e.productIdentifier } : {}),
  };
}

export async function problemaDeCobranca(): Promise<ProblemaDeCobranca> {
  if (!isNativeShell()) return SEM_PROBLEMA;
  if (!configurado) { try { await initRevenueCat(); } catch { return SEM_PROBLEMA; } }
  if (!Purchases || !configurado) return SEM_PROBLEMA;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const p = lerProblemaDeCobranca(customerInfo);
    /* 10/10 (1.0.14, atrás de COBRANCA_V14): os avisos locais de +24 h/+72 h
     * acompanham a verdade da loja a cada leitura — arma quando detecta,
     * cancela quando a cobrança entra. Solto: nunca segura o aviso. */
    void import("@/lib/cobranca-recusada")
      .then((m) => m.sincronizarAvisosDeCobranca(p))
      .catch(() => { /* noop */ });
    return p;
  } catch {
    return SEM_PROBLEMA; // rede de segurança: aviso nunca quebra o app
  }
}

/** Trial que a pessoa CANCELOU (acesso ainda vivo): periodType TRIAL +
 *  unsubscribeDetectedAt. É o gatilho da save-offer (22/08, caso raquel:
 *  cancelou o anual 4h antes do débito — churn de preço, não de produto).
 *  07/10: era `willRenew === false`, que o SDK também devolve pra CARTÃO
 *  RECUSADO (ver lerProblemaDeCobranca) — a save-offer disparava pra quem
 *  queria pagar e não conseguiu. Aceita willRenew false só sem billingIssue
 *  (cobre loja que não preencha unsubscribeDetectedAt). 100% cliente. */
export const lerTrialCancelado = (info: unknown): boolean =>
  Object.values((info as InfoLida)?.entitlements?.active ?? {}).some((e) =>
    e?.periodType === "TRIAL" && (!!e?.unsubscribeDetectedAt || (e?.willRenew === false && !e?.billingIssueDetectedAt)));

export async function estadoTrialCancelado(): Promise<boolean> {
  if (!isNativeShell()) return false;
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return lerTrialCancelado(customerInfo);
  } catch {
    return false;
  }
}

/* ─────────────────────────── PRESENTE DE 69,90 (07/10, só iPhone) ───────────────────────────
 *
 * O anual do iPhone é core_anual_97 (R$ 97,90, 3 dias grátis). `core_anual_69`
 * (R$ 69,90, MESMO grupo CORE Pro 22349268, MESMO nível 1, ONE_YEAR) ficou
 * aprovado do teste de preço 01→07/10 e vive na offering `anual_69` do
 * RevenueCat (pacote $rc_annual). Agora ele é o PRESENTE de dois momentos:
 *   "cancelou_teste" — trial cancelado, acesso vivo (no lugar da save-offer do mensal)
 *   "bloqueio"       — perdeu o acesso (trial acabou cancelado / expirou), no gate do app
 * Nunca pra quem está com cartão recusado (esse vê o aviso de cobrança).
 *
 * REGRA DA APPLE: os três produtos do grupo têm groupLevel 1 (crossgrade de
 * mesma duração, entra na hora). CORREÇÃO 08/10, visto em produção (cliente
 * trocou 97 → 69 pela tela de assinaturas da Apple durante o teste): a troca
 * MANTÉM o teste grátis — o RevenueCat registra "renewal R$ 0,00" no produto
 * novo e a 1ª cobrança de R$ 69,90 cai no fim do teste original. O texto de
 * 07/10 ("cobra hoje") estava errado. Quem já usou
 * o teste no grupo não ganha outro: a folha cobra na hora — o texto só
 * promete dias grátis se o StoreKit disser que a conta é elegível.
 *
 * DESLIGAR SEM VERSÃO NOVA: no painel do RevenueCat, metadata da offering
 * `anual_69` com `presente: "off"` (ou apagar/esvaziar a offering).
 *
 * 10/10 (1.0.14, chave OFERTA_X_PAYWALL em ofertas-saida.ts): 3º lugar,
 *   "x_paywall" — fechou o paywall do FUNIL sem iniciar o teste (Voltar). Essa
 *   pessoa nunca assinou: o pacote da `anual_69` traz a oferta introdutória e a
 *   folha dá os 3 dias grátis (StoreKit decide a elegibilidade; o texto segue
 *   `comTrial`). Não depende do customerInfo (lerSituacaoDoPresente), só da chave. */
/* 16/10: 4º lugar, "folha_cancelada" — fechou a folha da Apple do anual 97,90 (com teste)
 *   no paywall do funil: o presente entra no lugar da 2ª chance de mesmo preço (dono: "um
 *   downsell com o mesmo preço do front não faz sentido"). Também só da offering + comTrial;
 *   `presente: "off"` (ou a loja calada) devolve a 2ª chance de sempre. */
export type LugarDoPresente = "cancelou_teste" | "bloqueio" | "x_paywall" | "folha_cancelada";
export type SituacaoDoPresente = { lugar: LugarDoPresente; fimMs: number | null } | null;
const ID_ANUAL_69 = "core_anual_69";
const OFFERING_PRESENTE = "anual_69";

/** Decisão pura, só do customerInfo: onde (se) o presente cabe. */
export function lerSituacaoDoPresente(info: unknown): SituacaoDoPresente {
  if (lerProblemaDeCobranca(info).temProblema) return null;
  const i = info as InfoLida;
  const ativos = Object.values(i?.entitlements?.active ?? {});
  const trial = ativos.find((e) =>
    e?.periodType === "TRIAL" && (!!e?.unsubscribeDetectedAt || (e?.willRenew === false && !e?.billingIssueDetectedAt)));
  if (trial) return { lugar: "cancelou_teste", fimMs: typeof trial.expirationDateMillis === "number" ? trial.expirationDateMillis : null };
  if (ativos.length) return null;
  const todos = Object.values(i?.entitlements?.all ?? {});
  if (!todos.length) return null; // nunca assinou neste grupo: paywall normal (com o teste grátis)
  return { lugar: "bloqueio", fimMs: null };
}

/** Decisão pura, só das offerings: o pacote do presente, ou null se está desligado/ausente. */
export function lerPacoteDoPresente(offerings: unknown): PacoteRC | null {
  const o = (offerings as { all?: Record<string, { metadata?: Record<string, unknown>; availablePackages?: PacoteRC[]; annual?: PacoteRC | null }> } | null)?.all?.[OFFERING_PRESENTE];
  if (!o) return null;
  if (String(o.metadata?.presente ?? "").toLowerCase() === "off") return null;
  const ehO69 = (p?: PacoteRC | null) => !!p?.product?.identifier && (p.product.identifier === ID_ANUAL_69 || p.product.identifier.startsWith(ID_ANUAL_69 + ":"));
  return (o.availablePackages ?? []).find(ehO69) ?? (ehO69(o.annual) ? o.annual! : null);
}

export type Presente69 = {
  preco: string;       // "R$ 69,90"
  /** 16/10: o valor numérico (69.9) — a régua "downsell é MAIS BARATO que a vitrine". null se a loja não disse. */
  valor?: number | null;
  precoMes: string | null; // "R$ 5,82"
  produto: string;     // core_anual_69
  comTrial: boolean;   // a folha vai dar dias grátis pra ESTA conta (StoreKit disse "elegível")
  dias: number;        // dias grátis quando comTrial
  /** 17/10: o que a folha mostra hoje pelo teste ("R$ 0,00", da oferta introdutória) — a linha do tempo
   *  enxuta do paywall minimalista diz "Hoje — R$ 0,00" com ele. null sem teste / loja calada. */
  precoTeste?: string | null;
};
let presente69: { pacote: PacoteRC; dados: Presente69 } | null | undefined;

export async function situacaoDoPresente(): Promise<SituacaoDoPresente> {
  if (!isNativeShell()) return null;
  if (!configurado) { try { await initRevenueCat(); } catch { return null; } }
  if (!Purchases || !configurado) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return lerSituacaoDoPresente(customerInfo);
  } catch {
    return null;
  }
}

/** Carrega (e guarda) o presente da offering `anual_69`. null = desligado, ausente ou loja sem resposta. */
export async function carregarPresente69(): Promise<Presente69 | null> {
  if (presente69 !== undefined) return presente69?.dados ?? null;
  if (!configurado) { try { await initRevenueCat(); } catch { return null; } }
  if (!Purchases || !configurado) return null;
  try {
    const offerings = await Purchases.getOfferings();
    registrarChavesDasOfferings(offerings);
    const pacote = lerPacoteDoPresente(offerings);
    if (!pacote?.product?.priceString) { presente69 = null; return null; }
    const p = pacote.product as { priceString: string; price?: number; currencyCode?: string; introPrice?: IntroAnual };
    let comTrial = false;
    let dias = 0;
    if (p.introPrice) {
      try {
        const r = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [ID_ANUAL_69] });
        // só promete dias grátis com um SIM positivo (2 = elegível); quem já usou o teste no grupo paga hoje
        comTrial = (r as Record<string, { status?: number }> | null)?.[ID_ANUAL_69]?.status === 2;
      } catch { comTrial = false; }
      if (comTrial) {
        const n = Number(p.introPrice.periodNumberOfUnits ?? 0) || 0;
        const u = String(p.introPrice.periodUnit ?? "DAY").toUpperCase();
        dias = u === "WEEK" ? n * 7 : u === "MONTH" ? n * 30 : u === "YEAR" ? n * 365 : n;
      }
    }
    presente69 = {
      pacote,
      dados: {
        preco: p.priceString,
        valor: p.price && p.price > 0 ? p.price : null,
        precoMes: p.price && p.price > 0 ? formatarMoeda(p.price / 12, p.currencyCode || "BRL") : null,
        produto: ID_ANUAL_69,
        comTrial,
        dias,
        precoTeste: comTrial && p.introPrice ? (p.introPrice.priceString || formatarMoeda(Number(p.introPrice.price ?? 0) || 0, p.currencyCode || "BRL")) : null,
      },
    };
    return presente69.dados;
  } catch {
    return null; // sem cache: a próxima abertura tenta de novo
  }
}

/** Compra o presente pelo PACOTE da offering `anual_69` (é o que amarra a
 *  compra à offering no RevenueCat). true = folha fechou com sucesso e o
 *  acesso foi sincronizado; false = cancelou/falhou (motivoUltimaCompra diz qual). */
export async function comprarPresente69(lugar: LugarDoPresente): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: ID_ANUAL_69, oferta: "presente69", lugar, retentou: true });
    return false;
  }
  try {
    if (!presente69) await carregarPresente69();
    if (!presente69) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "produto_ausente", produto: ID_ANUAL_69, oferta: "presente69", lugar });
      return false;
    }
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: ID_ANUAL_69,
      escolhida: presente69.pacote.product?.identifier ?? ID_ANUAL_69,
      preco: presente69.dados.preco,
      trial: presente69.dados.comTrial,
      oferta: "presente69",
      offering: OFFERING_PRESENTE,
      lugar,
      pacote: true,
    });
    const pacote69 = presente69.pacote, P = Purchases as NonNullable<typeof Purchases>;
    const resultado = await folhaComRetentativa(ID_ANUAL_69, () => P.purchasePackage({ aPackage: pacote69 }));
    registrarResultadoDaFolha("sucesso", ID_ANUAL_69);
    // 10/10: no "x_paywall" a compra pode ENTRAR EM TESTE (3 dias) — o paywall do
    // funil lê isto pra armar o lembrete "acaba amanhã", como no comprarAnualIos.
    anotarTrialDaCompra(resultado, presente69.dados.comTrial);
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    return desfechoDaFalha(e, ID_ANUAL_69);
  }
}

/* ─────────────────────────── MENSAL DE 19,90 (10/10, só iPhone, 1.0.14) ───────────────────────────
 *
 * Produto NOVO `core_mensal_19` (R$ 19,90/mês, MESMO grupo CORE Pro 22349268, criado
 * pelo dono com scripts/asc-mensal-19.mjs), na offering `mensal_19` do RevenueCat,
 * pacote $rc_monthly. É o degrau de "prefere ir devagar?" em três lugares:
 *   "mensal_paywall" — escolheu o mensal no paywall do funil e cancelou a folha da Apple
 *                      (chave OFERTA_MENSAL_19): compra na hora, sem teste
 *   "cancelou_teste" — recusou o presente de 69,90 durante o teste (chave SAIDA_TESTE_ESCADA):
 *                      a troca anual→mensal_19 é DOWNGRADE no grupo (groupLevel maior) e a Apple
 *                      aplica no FIM do período atual = fim do teste; nada é cobrado hoje
 *   "bloqueio"       — perdeu o acesso e recusou o 69,90 (mesma chave): compra na hora
 * Preço SEMPRE do priceString da loja. Se a offering não existir (ou vier sem o produto
 * certo, ou com metadata `presente: "off"`), nenhuma dessas telas aparece — chave ou não. */
/* 22/10 (1.0.18): + "recusa" — o card do cartão recusado na renovação (lib/card-recusa, chave `card_recusa`). Também é
 * DOWNGRADE no grupo: vale na próxima renovação, que no billing retry é a cobrança pendente — nada libera na hora. */
export type LugarDoMensal19 = "mensal_paywall" | "cancelou_teste" | "bloqueio" | "recusa";
const ID_MENSAL_19 = "core_mensal_19";
const OFFERING_MENSAL_19 = "mensal_19";

/** Decisão pura, só das offerings: o pacote do mensal 19, ou null (ausente/desligado). */
export function lerPacoteDoMensal19(offerings: unknown): PacoteRC | null {
  const o = (offerings as { all?: Record<string, { metadata?: Record<string, unknown>; availablePackages?: PacoteRC[]; monthly?: PacoteRC | null }> } | null)?.all?.[OFFERING_MENSAL_19];
  if (!o) return null;
  if (String(o.metadata?.presente ?? "").toLowerCase() === "off") return null;
  const ehO19 = (p?: PacoteRC | null) => !!p?.product?.identifier && (p.product.identifier === ID_MENSAL_19 || p.product.identifier.startsWith(ID_MENSAL_19 + ":"));
  return (o.availablePackages ?? []).find(ehO19) ?? (ehO19(o.monthly) ? o.monthly! : null);
}

/** `valor` (16/10): o número (19.9) pra régua "mais barato que o mensal da vitrine"; null se a loja não disse. */
export type Mensal19 = { preco: string; produto: string; valor?: number | null };
let mensal19: { pacote: PacoteRC; dados: Mensal19 } | null | undefined;

/** Carrega (e guarda) o mensal 19 da offering `mensal_19`. null = ausente, desligado ou loja sem resposta. */
export async function carregarMensal19(): Promise<Mensal19 | null> {
  if (mensal19 !== undefined) return mensal19?.dados ?? null;
  if (!configurado) { try { await initRevenueCat(); } catch { return null; } }
  if (!Purchases || !configurado) return null;
  try {
    const offerings = await Purchases.getOfferings();
    registrarChavesDasOfferings(offerings);
    const pacote = lerPacoteDoMensal19(offerings);
    if (!pacote?.product?.priceString) { mensal19 = null; return null; }
    const v = Number((pacote.product as { price?: number }).price ?? 0);
    mensal19 = { pacote, dados: { preco: pacote.product.priceString, produto: ID_MENSAL_19, valor: v > 0 ? v : null } };
    return mensal19.dados;
  } catch {
    return null; // sem cache: a próxima tentativa lê de novo
  }
}

/** Compra o mensal 19 pelo PACOTE da offering `mensal_19`. true = folha fechou e sincronizou. */
export async function comprarMensal19(lugar: LugarDoMensal19): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: ID_MENSAL_19, oferta: "mensal19", lugar, retentou: true });
    return false;
  }
  try {
    if (!mensal19) await carregarMensal19();
    if (!mensal19) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "produto_ausente", produto: ID_MENSAL_19, oferta: "mensal19", lugar });
      return false;
    }
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: ID_MENSAL_19,
      escolhida: mensal19.pacote.product?.identifier ?? ID_MENSAL_19,
      preco: mensal19.dados.preco,
      trial: false,
      oferta: "mensal19",
      offering: OFFERING_MENSAL_19,
      lugar,
      pacote: true,
    });
    const pacote19 = mensal19.pacote, P = Purchases as NonNullable<typeof Purchases>;
    await folhaComRetentativa(ID_MENSAL_19, () => P.purchasePackage({ aPackage: pacote19 }));
    registrarResultadoDaFolha("sucesso", ID_MENSAL_19);
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    return desfechoDaFalha(e, ID_MENSAL_19);
  }
}

/** Só testes: esquece o que foi carregado da loja (presente 69 e mensal 19). */
export const _zerarCacheDasOfertas = (): void => { presente69 = undefined; mensal19 = undefined; };

/** Se o RevenueCat diz que tem assinatura ativa mas o nosso banco não sabe,
 *  conserta sozinho. Roda no boot e a cada checagem de assinatura — é a rede
 *  de segurança pra webhook perdido/atrasado. */
export async function reconciliarSePreciso(): Promise<boolean> {
  if (!isNativeShell()) return false;
  // Pode ser chamada antes de qualquer tela de paywall montar (o gate roda no
  // boot), então inicializa se ainda não inicializou.
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    if (!temEntitlement(customerInfo)) return false;
    return await sincronizarAssinatura(2);
  } catch {
    return false;
  }
}

/**
 * A LOJA JÁ TEM COMPRA DESTE APARELHO, MAS NÃO EXISTE CONTA? (02/09)
 *
 * Cenário medido: a pessoa paga, o Android mata o app com a folha na frente,
 * ela reabre e cai na welcome sem acesso (9 das 25 vendas de hoje não têm
 * evento de sucesso — o app morreu depois do pagamento). O RevenueCat guarda
 * o id anônimo do aparelho entre processos; `syncPurchases` empurra pro
 * servidor dele o recibo que a Play tem; e o entitlement responde "sim".
 * Quem chama (ComecarW, no mount do shell sem usuário) pula direto pro
 * cadastro com "seu pagamento passou". Nunca lança; sem loja = false.
 */
export async function compraNaLojaSemConta(): Promise<boolean> {
  if (!isNativeShell()) return false;
  if (!configurado) { try { await initRevenueCat(); } catch { return false; } }
  if (!Purchases || !configurado) return false;
  try {
    try { await Purchases.syncPurchases(); } catch { /* segue com o que o RC já sabe */ }
    const { customerInfo } = await Purchases.getCustomerInfo();
    return temEntitlement(customerInfo);
  } catch {
    return false;
  }
}

/** Compra o produto (core_anual/core_mensal). Devolve true se a assinatura
 *  ativou E o acesso foi gravado no nosso banco. */
/**
 * POR QUE A COMPRA NÃO FECHOU (03/08) — telemetria que faltava.
 *
 * Em 02-03/08: 17 pessoas tocaram em comprar e 1 concluiu. As outras 16
 * sumiram sem deixar rastro, porque esta função devolvia `false` em QUATRO
 * situações completamente diferentes e nenhuma delas virava evento:
 *   sem_chave/sem_produto  → RevenueCat nem carregou o catálogo
 *   produto_ausente        → o id do Play Console não bate com o do código
 *                            (acontece ao editar/recriar plano base — foi
 *                            exatamente o que mexemos no preço)
 *   cancelou               → a pessoa fechou a folha do Google (normal!)
 *   billing_erro           → a Play recusou
 * Sem separar "quebrou" de "desistiu" não dá pra decidir preço nenhum — a
 * gente testaria oferta num botão possivelmente morto.
 *
 * Só vale a partir do PRÓXIMO BUILD: o app embarca o bundle (webDir "dist"),
 * então deploy no site não alcança quem já instalou.
 */
/** Por que a última tentativa de compra não fechou. "cancelou" é a pessoa
 *  fechando a folha do Google (normal, não avisa nada); o resto é defeito e
 *  a tela precisa dizer alguma coisa — sem isso, tocar em comprar e não ver
 *  NADA acontecer é indistinguível de app quebrado. */
/** O que a Play REALMENTE serviu pra esta conta (preenchido no prefetch).
 *  null = catálogo ainda não consultado — o paywall NÃO rebaixa a promessa
 *  por falha de rede, só com um "não" positivo da loja. */
const trialServidoCache: Record<string, boolean> = {};
export const temTrialServido = (productId: string): boolean | null => {
  for (const [k, v] of Object.entries(trialServidoCache)) if (productId.startsWith(k) || k.startsWith(productId)) return v;
  return null;
};

export type MotivoCompra =
  | "cancelou" | "billing_erro" | "produto_ausente" | "sem_entitlement" | "catalogo" | "pendente"
  // 02/09 — dois erros que viviam escondidos dentro de "billing_erro" e recebiam
  // "tenta de novo em instantes": a Play dizendo que a compra JÁ É da pessoa
  // (pagou, o app morreu na folha, voltou e tocou de novo) e a conta Google
  // que NÃO PODE comprar (sem login na Play, conta de menor, Play velha).
  | "ja_ativo" | "nao_permitido"
  | null;
let ultimoMotivo: MotivoCompra = null;
export const motivoUltimaCompra = (): MotivoCompra => ultimoMotivo;

/* ─────────────────────────────────────────────────────────────────────────────
 * ERRO DA LOJA NA COMPRA, COM RETENTATIVA (1.0.18 — decepções 21/10, item 1): 106 pessoas / 135 sessões em 30 dias
 * tiveram ERRO na compra no iPhone (não é "cancelou"): "Error performing request." 153×, "There was a problem with
 * the App Store." 138×, rede 12× — e só 22 % conseguiram depois; o paywall só mostrava uma linha pequena. Agora:
 *   · erro TRANSITÓRIO (loja fria/ocupada, rede, tempo esgotado) → 1 retentativa automática 1,5 s depois, na mesma
 *     folha (a loja costuma responder na 2ª) — `folhaComRetentativa`, nas 4 folhas do iPhone;
 *   · falhou de novo → o paywall mostra a caixa calma com "Tentar de novo" (PaywallIOS);
 *   · o CÓDIGO do erro vai no evento (separa rede × conta × loja): app_compra_retentativa / app_compra_falhou.
 * Códigos do RevenueCat: 0 UNKNOWN · 2 STORE_PROBLEM · 10 NETWORK · 12/16 BACKEND · 32 PRODUCT_REQUEST_TIMED_OUT ·
 * 35 OFFLINE. Cancelou (1), conta não pode (3), já é sua (6) e pendente (20) nunca repetem.
 * ───────────────────────────────────────────────────────────────────────────── */
export const RETENTATIVA_DA_FOLHA_MS = 1500;
const codigoDoErro = (e: unknown): string | null => { const c = String((e as { code?: string | number })?.code ?? ""); return c || null; };
const mensagemDoErro = (e: unknown): string => String((e as { message?: string })?.message ?? e);
/**
 * O TIPO do erro (medido em 30 dias, só o que não é "cancelou"):
 *   · "loja"      — "There was a problem with the App Store." (113 pessoas, ~3–4/dia; código 2 STORE_PROBLEM): o genérico
 *                   do StoreKit, comum quando a forma de pagamento do ID Apple falha na verificação ou a loja oscila;
 *   · "bloqueado" — "The device or user is not allowed to make the purchase." (33 pessoas; código 3): Tempo de Uso /
 *                   restrição de compras ou conta familiar com "Pedir para comprar" — sem retentativa;
 *   · "rede"      — "A network error has occurred" / "Error performing request" (~19 pessoas; códigos 10/35);
 *   · "cancelou"  — foi ela (código 1); · "outro" — o resto (0/12/16/32 contam como transitórios).
 */
export type TipoErroDaLoja = "cancelou" | "rede" | "loja" | "bloqueado" | "outro";
export function tipoDoErroDaLoja(e: unknown): TipoErroDaLoja {
  const msg = mensagemDoErro(e);
  const codigo = codigoDoErro(e);
  if (codigo === "1" || /cancel/i.test(msg)) return "cancelou";
  if (codigo === "3" || /not allowed to make the purchase/i.test(msg)) return "bloqueado";
  if (codigo === "10" || codigo === "35" || /network|offline|error performing request|connection|timed out|time out/i.test(msg)) return "rede";
  if (codigo === "2" || codigo === "0" || codigo === "12" || codigo === "16" || codigo === "32" || /problem with the app store/i.test(msg)) return "loja";
  return "outro";
}
/** Vale repetir sozinho? Só rede e loja (a loja costuma responder na 2ª); bloqueado/cancelou/pendente nunca. */
export const erroTransitorioDaLoja = (e: unknown): boolean => { const t = tipoDoErroDaLoja(e); return t === "rede" || t === "loja"; };
let ultimoCodigo: string | null = null;
let ultimoTipo: TipoErroDaLoja | null = null;
/** O código / o tipo do erro da última compra que falhou (null = sem código / não falhou). */
export const codigoUltimaFalha = (): string | null => ultimoCodigo;
export const tipoUltimaFalha = (): TipoErroDaLoja | null => ultimoTipo;
/** Abre a folha; erro transitório na 1ª tentativa = espera 1,5 s e abre de novo (uma vez). O que a 2ª devolver, vale. */
async function folhaComRetentativa<T>(produto: string, abrir: () => Promise<T>): Promise<T> {
  marcarFolhaAberta();
  try {
    return await abrir();
  } catch (e) {
    if (!erroTransitorioDaLoja(e)) throw e;
    trackEvent("app_compra_retentativa", { produto, tipo: tipoDoErroDaLoja(e), codigo: codigoDoErro(e), erro: mensagemDoErro(e).slice(0, 160) });
    await new Promise<void>((r) => setTimeout(r, RETENTATIVA_DA_FOLHA_MS));
    marcarFolhaAberta();
    return await abrir();
  }
}

/**
 * DESFECHO COMUM das três folhas (assinatura, pré-pago, vitalício) — 02/09.
 *
 * Antes cada `catch` repetia a mesma triagem e só sabia dois nomes: "cancelou"
 * e "billing_erro". A autópsia de 28/08–02/09 achou dois casos que precisam
 * de resposta própria:
 *  - código 6 "already active": a compra JÁ É desta pessoa. Acontece quando o
 *    app morre com a folha aberta, a Play conclui o pagamento, e ela volta e
 *    toca de novo (4 hoje, 1 ontem). Aqui a resposta certa é RESTAURAR na
 *    hora — se a loja confirmar, a compra "deu certo" do ponto de vista dela.
 *  - código 3 "not allowed": a conta Google não pode comprar. "Tenta de novo"
 *    é mentira; a pessoa precisa arrumar a conta (ou usar outra).
 * Devolve true só quando recuperou a compra (ja_ativo + restaurar ok).
 */
export async function desfechoDaFalha(e: unknown, produto: string): Promise<boolean> {
  const msg = String((e as { message?: string })?.message ?? e);
  const codigo = String((e as { code?: string })?.code ?? "");
  ultimoCodigo = codigo || null; // 1.0.18: o paywall e os eventos levam o código e o tipo
  ultimoTipo = tipoDoErroDaLoja(e);
  registrarResultadoDaFolha(/cancel/i.test(msg) || codigo === "1" ? "cancelou" : "erro", produto);
  // Pix/boleto escolhido NA FOLHA: compra fica pendente, o webhook libera.
  if (codigo === "20" || /pending/i.test(msg)) {
    ultimoMotivo = "pendente";
    trackEvent("app_compra_pendente", { produto });
    return false;
  }
  if (codigo === "6" || /already (active|own|purchased)/i.test(msg)) {
    trackEvent("app_compra_ja_ativa", { produto });
    if (await restaurar()) { ultimoMotivo = null; return true; }
    ultimoMotivo = "ja_ativo";
    trackEvent("app_compra_falhou", { motivo: "ja_ativo", produto, erro: msg.slice(0, 160) });
    return false;
  }
  if (codigo === "3" || /not allowed to make the purchase/i.test(msg)) {
    ultimoMotivo = "nao_permitido";
    trackEvent("app_compra_falhou", { motivo: "nao_permitido", produto, erro: msg.slice(0, 160), codigo: codigo || null, tipo: "bloqueado" });
    return false;
  }
  const cancelou = /cancel/i.test(msg) || codigo === "1";
  ultimoMotivo = cancelou ? "cancelou" : "billing_erro";
  trackEvent("app_compra_falhou", { motivo: ultimoMotivo, produto, erro: msg.slice(0, 160), codigo: codigo || null, tipo: ultimoTipo, transitorio: !cancelou && erroTransitorioDaLoja(e) });
  return false;
}

/** Quando a FOLHA do Google foi aberta de verdade (varredura v81): medir "tempo
 *  na folha" a partir do toque no CTA mentia — o toque ainda paga import,
 *  garantirPronto (que pode re-rodar o init na rede) e prefetch. O carimbo
 *  nasce imediatamente antes do purchase*; a escada do paywall usa ele pra
 *  separar "fechou no Processando" de "trabalhou na folha". */
let folhaAbertaEm: number | null = null;
export const inicioUltimaFolha = (): number | null => folhaAbertaEm;
/** Instante do TOQUE em comprar (o paywall marca). O app_compra_opcao leva
 *  `desde_toque_ms` medido no cliente — o created_at do servidor mentia
 *  (evento fire-and-forget atravessando o background: "p90 de 12s" falso). */
let toqueEm: number | null = null;
export const marcarToqueDeCompra = (t: number = Date.now()): void => { toqueEm = t; };
/** Lê e ZERA: um carimbo vale pra uma folha só — sem isso, um paywall que não
 *  marca (revisão 02/09) herdava o toque de outro e media tempo de dias. */
const consumirToque = (): number | null => { toqueDaFolhaEm = toqueEm; const v = toqueEm ? Date.now() - toqueEm : null; toqueEm = null; return v; };
/** Carimbo da folha em memória E no disco: o `saida-do-app.ts` lê o de disco
 *  no boot seguinte pra saber se a morte do processo veio logo depois. */
const marcarFolhaAberta = () => {
  folhaAbertaEm = Date.now();
  folhaEmAndamento = true;
  try { localStorage.setItem("core-folha-aberta-em", String(folhaAbertaEm)); } catch { /* modo privado */ }
};

/*
 * `folha_apple_resultado` (10/10, 1.0.14) — UM evento por folha da Apple, com o
 * desfecho e o tempo desde o TOQUE em comprar. Hoje o sucesso é app_sheet_success
 * (cada paywall com um payload) e a falha é app_compra_falhou (6 motivos): juntar
 * "quantas folhas abriram × quantas fecharam com dinheiro" exigia casar os dois.
 * Nasce AQUI, onde a compra acontece, pra não mexer em paywall nenhum.
 *   · resultado      sucesso | cancelou | erro
 *   · ms_desde_toque toque no CTA → desfecho (o toque que o paywall marcou; sem
 *                    ele, desde a abertura da folha)
 *   · segunda_chance a folha anterior desta sessão falhou há < 15 min (é a
 *                    pessoa tentando de novo — a "segunda chance" do PaywallIOS)
 * Só no iPhone; a folha do Google segue medida pelos eventos de sempre.
 */
let toqueDaFolhaEm: number | null = null;
let folhaEmAndamento = false;
let ultimaFolhaFalhouEm: number | null = null;
export type ResultadoDaFolha = "sucesso" | "cancelou" | "erro";
export const SEGUNDA_CHANCE_JANELA_MS = 15 * 60e3;
function registrarResultadoDaFolha(resultado: ResultadoDaFolha, produto: string): void {
  if (!folhaEmAndamento) return; // falhou antes de abrir a folha (catálogo, rede): não é folha
  folhaEmAndamento = false;
  if (plataformaApp() !== "ios") return;
  const agora = Date.now();
  const base = toqueDaFolhaEm ?? folhaAbertaEm;
  // 1.0.18: o sucesso vai por beacon — no gate o app recarrega logo depois da compra e o insert normal morria
  // (124 folhas do gate, 48 sem resultado); cancelou/erro seguem no trackEvent de sempre
  (resultado === "sucesso" ? trackEventBeacon : trackEvent)("folha_apple_resultado", {
    resultado,
    produto,
    ms_desde_toque: base ? agora - base : null,
    segunda_chance: ultimaFolhaFalhouEm != null && agora - ultimaFolhaFalhouEm < SEGUNDA_CHANCE_JANELA_MS,
  });
  ultimaFolhaFalhouEm = resultado === "sucesso" ? null : agora;
  toqueDaFolhaEm = null;
}

/** Corrida do boot (raio-x de 26/08): toques em comprar morriam com
 *  "rc_sem_chave" porque o init ainda não tinha terminado (ou falhou por rede)
 *  quando o dedo chegou no botão. O toque é o momento de MAIOR intenção do
 *  funil — aqui se tenta inicializar DE NOVO em vez de desistir. */
async function garantirPronto(): Promise<boolean> {
  if (estado === "pronto" && Purchases) return true;
  try { await initRevenueCat(); } catch { /* estado fica como estiver */ }
  if (estado === "pronto" && Purchases) return true;
  /* v83 (rajada de 28/08: 96 toques em comprar recusados em 17min, 1 aparelho
   * orgânico, 0 vendas): "pronto" exige OFFERINGS de assinatura — que a compra
   * à vista NEM USA (vai por getProducts/purchaseStoreProduct). Se o plugin
   * está CONFIGURADO, a compra pode tentar: quem decide é a loja, com erro
   * próprio e legível, não um guard que barra venda possível por causa de um
   * fetch de offerings que falhou por rede. */
  return configurado && !!Purchases;
}

export type OpcaoAssinatura = { id?: string; freePhase?: unknown; isBasePlan?: boolean };

/**
 * QUAL OPÇÃO DA ASSINATURA COMPRAR — decisão pura, sem loja (04/09).
 *
 * `subscriptionOptions` (plano base × oferta com fase grátis) é um conceito
 * do GOOGLE PLAY. Na App Store o produto não tem opções: o RevenueCat devolve
 * a lista VAZIA e a compra é o próprio pacote. A regra "semTrial sem plano
 * base = FALHA FECHADA" (varredura 23/08) protege o Android de vender teste
 * grátis prometendo cobrança hoje — mas no iPhone ela só sabia dizer
 * `sem_base_plan`, e foi exatamente isso que o revisor da Apple viu em
 * 04/09 (sessão 1b27531a: dois toques na mensal, `servidas: []`, recusa 2.1).
 * A mensal NUNCA foi comprável no iPhone, em nenhum paywall.
 *
 * No Android nada muda: mesma lista, mesma escolha, mesma falha fechada.
 */
export function escolherOpcaoDeCompra(
  opcoes: OpcaoAssinatura[],
  ctx: { semTrial: boolean; naApple: boolean },
): { escolhida?: OpcaoAssinatura; falha?: "sem_base_plan" } {
  const comTrial = ctx.semTrial ? undefined : opcoes.find((o) => !!o?.freePhase && !o?.isBasePlan);
  const baseSemTrial = ctx.semTrial ? opcoes.find((o) => !!o?.isBasePlan) : undefined;
  if (ctx.semTrial && !baseSemTrial) {
    // Apple: não existe plano base — o pacote É o plano, e a Apple não tem
    // trial configurado no CORE. Compra o pacote.
    if (ctx.naApple) return {};
    return { falha: "sem_base_plan" };
  }
  return { escolhida: comTrial ?? baseSemTrial };
}

export async function comprar(productId: string, opts?: { semTrial?: boolean }): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: productId, retentou: true });
    return false;
  }
  try {
    const offerings = await (Purchases as NonNullable<typeof Purchases>).getOfferings();
    const pacotes = offerings?.current?.availablePackages ?? [];
    const alvo = pacotes.find((p) => p.product?.identifier?.startsWith(productId));
    if (!alvo) {
      console.warn("[RC] produto não encontrado:", productId);
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", {
        motivo: "produto_ausente",
        produto: productId,
        // o que a loja REALMENTE oferece — mata a dúvida do id divergente
        disponiveis: pacotes.map((p) => p.product?.identifier).filter(Boolean).slice(0, 8),
      });
      return false;
    }
    /* v61.1 (19/08, foto do dono: folha veio SEM os 3 dias grátis): não
     * confiar mais na escolha IMPLÍCITA do purchasePackage — procurar
     * explicitamente a opção com fase GRÁTIS (coretrial/coretrialmensal) e
     * comprá-la via purchaseSubscriptionOption. A Play só devolve as ofertas
     * que ESTA conta pode usar (ex-assinante não vê trial — by design), e
     * oferta recém-ativada demora horas pra propagar: o evento
     * app_compra_opcao conta EXATAMENTE o que a loja serviu no aparelho,
     * então "não veio trial" deixa de ser adivinhação. */
    type Opcao = { id?: string; freePhase?: unknown; isBasePlan?: boolean };
    const opcoes: Opcao[] = ((alvo.product as { subscriptionOptions?: Opcao[] })?.subscriptionOptions ?? []);
    // semTrial (22/08, save-offer): quem cancelou o trial ANUAL e aceita o
    // mensal tem que pagar AGORA — sem isso o comprar() acharia o
    // coretrialmensal e daria mais 3 dias grátis + nova janela de cancelar,
    // contradizendo a copy ("R$ 24,90/mês") e o objetivo da tela.
    const comTrial = opts?.semTrial ? undefined : opcoes.find((o) => !!o?.freePhase && !o?.isBasePlan);
    /* VARREDURA 23/08 (bytecode do purchases-android 10.13.0): purchasePackage
     * compra a defaultOption do produto = findLongestFreeTrial — ou seja, com
     * semTrial o fallback antigo ainda dava FASE GRÁTIS pra conta elegível
     * (coretrialmensal segue ativa pros APKs velhos). semTrial agora compra o
     * PLANO BASE explicitamente; sem plano base identificável, FALHA FECHADA
     * (produto_ausente) — melhor não vender do que prometer "cobra hoje" e a
     * folha abrir com teste grátis (a foto do dono de 19/08, invertida). */
    const baseSemTrial = opts?.semTrial ? opcoes.find((o) => !!o?.isBasePlan) : undefined;
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: productId,
      servidas: opcoes.map((o) => o?.id).filter(Boolean).slice(0, 6),
      escolhida: comTrial?.id ?? baseSemTrial?.id ?? "package_default",
      temGratis: !!comTrial,
      semTrial: !!opts?.semTrial,
    });
    const decisao = escolherOpcaoDeCompra(opcoes, { semTrial: !!opts?.semTrial, naApple: plataformaApp() === "ios" });
    if (decisao.falha) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: decisao.falha, produto: productId });
      return false;
    }
    const escolhida = decisao.escolhida;
    const P = Purchases as NonNullable<typeof Purchases>;
    // 1.0.18: a folha com 1 retentativa (e o carimbo da folha também no caminho do pacote — o mensal do iPhone
    // comprava sem marcarFolhaAberta e ficava fora do folha_apple_resultado)
    await folhaComRetentativa(productId, () => (escolhida
      ? P.purchaseSubscriptionOption({ subscriptionOption: escolhida as Parameters<NonNullable<typeof Purchases>["purchaseSubscriptionOption"]>[0]["subscriptionOption"] })
      : P.purchasePackage({ aPackage: alvo })));
    registrarResultadoDaFolha("sucesso", productId);
    // Folha fechou com sucesso = dinheiro saiu. Como no vitalício, o acesso
    // NÃO depende do entitlement do RC (quem manda é a linha em
    // `subscriptions` via sync/webhook) — o check de entitlement aqui já
    // derrubou compra real como "sem_entitlement" na era v37.
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    // cancelou / pendente / já é seu / conta não pode / erro da Play — triagem única
    return desfechoDaFalha(e, productId);
  }
}

/**
 * ASSINATURA v53 (16/08) — o app volta a vender core_anual/core_mensal, agora
 * com o teste de 3 dias NOSSO na frente (sem trial do Google). A compra dos
 * dois planos principais vai por offerings/packages (`comprar` acima). O
 * DOWNSELL é diferente: base plan PRÉ-PAGO `core_mensal:coremensalpix`
 * (R$ 19,90 → 30 dias, Pix na folha, renovação manual) — pré-pago não entra
 * em package, então vai por getProducts + purchaseStoreProduct, com pré-busca
 * igual à do vitalício (aparelho fraco = segundos de nada visível sem cache).
 */
const ID_MENSAL_PIX = "core_mensal:coremensalpix";
// 23/08: vitrine nova — mensal À VISTA (24,90, pré-pago irmão do 19,90).
// O 19,90 vira degrau final do resgate; o 24,90 é card da vitrine.
const ID_MENSAL_VISTA = "core_mensal:coremensalvista";
// 23/08 noite (pivô à vista): anual pré-pago P1Y na vitrine + o 97,90 da
// caixa de presente. Tudo compra pelo MESMO botão do 19,90 (purchaseStore-
// Product → folha com Pix → liquida na hora) — o único que já virou dinheiro.
const ID_ANUAL_VISTA = "core_anual:coreanualvista";
const ID_ANUAL_97 = "core_anual:coreanual97";
type IdPrepago = typeof ID_MENSAL_PIX | typeof ID_MENSAL_VISTA | typeof ID_ANUAL_VISTA | typeof ID_ANUAL_97;
const IDS_PREPAGOS: IdPrepago[] = [ID_MENSAL_PIX, ID_MENSAL_VISTA, ID_ANUAL_VISTA, ID_ANUAL_97];
const produtosPrepagos: Partial<Record<IdPrepago, ProdutoRC>> = {};
const precosAssinatura: Partial<Record<"anual" | "mensal" | "mensalPix" | "mensalVista", string>> = {};

/** Preços REAIS da loja (moeda local) pro paywall exibir — APP_PRECOS é só
 *  fallback. Preenchido pela pré-busca; devolve o que já chegou. */
export const precoLoja = (plano: "anual" | "mensal" | "mensalPix" | "mensalVista"): string | null =>
  precosAssinatura[plano] ?? null;

/** Dias de fase GRÁTIS que a loja serviu pra ESTA conta (null = não sabe).
 *  A vitrine promete "N dias grátis" com o N da folha, não do código: o
 *  catálogo muda por API (3→7 dias em 23/08) e APK não acompanha deploy. */
const trialDiasCache: Record<string, number> = {};
export const trialDiasServido = (productId: string): number | null =>
  trialDiasCache[productId] ?? null;

const diasDaFase = (fase: unknown): number | null => {
  const f = fase as { billingPeriod?: { iso8601?: string; value?: number; unit?: string } } | undefined;
  const iso = f?.billingPeriod?.iso8601;
  const m = typeof iso === "string" ? iso.match(/^P(\d+)([DWMY])$/i) : null;
  if (m) {
    const n = Number(m[1]);
    const mult = { D: 1, W: 7, M: 30, Y: 365 }[m[2].toUpperCase() as "D" | "W" | "M" | "Y"];
    return n * (mult ?? 1);
  }
  if (typeof f?.billingPeriod?.value === "number" && f.billingPeriod.value > 0) {
    const mult = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[String(f.billingPeriod.unit ?? "DAY").toUpperCase()] ?? 1;
    return f.billingPeriod.value * mult;
  }
  return null;
};

export async function prefetchAssinaturas(): Promise<void> {
  // v83: basta o plugin CONFIGURADO — "pronto" exigia offerings saudáveis e
  // barrava o prefetch exatamente quando a rede tinha falhado uma vez.
  if (!configurado || !Purchases) return;
  try {
    const offerings = await Purchases.getOfferings();
    for (const p of offerings?.current?.availablePackages ?? []) {
      const id = String(p.product?.identifier ?? "");
      const preco = (p.product as { priceString?: string })?.priceString;
      if (!preco) continue;
      // CTA honesto (21/08): a Play decide o trial POR CONTA — ex-assinante
      // não ganha de novo, e o botão prometia "3 dias grátis" com a folha
      // cobrando NA HORA (foto do dono, 19/08). Anota o que ESTA conta
      // realmente recebeu; o paywall rebaixa a promessa só com um NÃO
      // positivo daqui.
      type Opcao = { freePhase?: unknown; isBasePlan?: boolean };
      const opcoes: Opcao[] = ((p.product as { subscriptionOptions?: Opcao[] })?.subscriptionOptions ?? []);
      const gratis = opcoes.find((o) => !!o?.freePhase && !o?.isBasePlan);
      if (id.startsWith("core_anual")) {
        precosAssinatura.anual = preco;
        trialServidoCache["core_anual"] = !!gratis;
        const dias = gratis ? diasDaFase((gratis as { freePhase?: unknown }).freePhase) : null;
        if (dias) trialDiasCache["core_anual"] = dias;
      } else if (id.startsWith("core_mensal")) {
        precosAssinatura.mensal = preco;
        trialServidoCache["core_mensal"] = !!gratis;
      }
    }
  } catch { /* paywall usa o fallback do APP_PRECOS */ }
  try {
    if (IDS_PREPAGOS.some((id) => !produtosPrepagos[id])) {
      const mod = await import("@revenuecat/purchases-capacitor");
      const { products } = await Purchases.getProducts({
        productIdentifiers: [...IDS_PREPAGOS],
        type: mod.PRODUCT_CATEGORY.SUBSCRIPTION,
      });
      // Vários pré-pagos dividem o MESMO produto (core_mensal/core_anual) —
      // casar pelo id INTEIRO, senão o 19,90 entra no lugar do 24,90.
      for (const p of products ?? []) {
        const id = String(p?.identifier ?? "");
        const alvo = IDS_PREPAGOS.find((i) => id === i || id.startsWith(i));
        if (alvo) produtosPrepagos[alvo] = p;
      }
      const preco = (id: IdPrepago) => (produtosPrepagos[id] as { priceString?: string } | undefined)?.priceString;
      if (preco(ID_MENSAL_PIX)) precosAssinatura.mensalPix = preco(ID_MENSAL_PIX);
      if (preco(ID_MENSAL_VISTA)) precosAssinatura.mensalVista = preco(ID_MENSAL_VISTA);
    }
  } catch { /* sem o pré-pago no catálogo a superfície some, nunca botão morto */ }
}

/** O degrau 19,90 do resgate só é oferecido se o base plan existir no
 *  catálogo da loja (build velha/catálogo antigo → esconde, nunca botão morto). */
export const temMensalPix = (): boolean => !!produtosPrepagos[ID_MENSAL_PIX];
/** Card "1 mês à vista" (24,90) da vitrine — mesma regra de existência. */
export const temMensalVista = (): boolean => !!produtosPrepagos[ID_MENSAL_VISTA];
/** Anual à vista (159,90) — herói da vitrine do pivô 23/08. */
export const temAnualVista = (): boolean => !!produtosPrepagos[ID_ANUAL_VISTA];
/** Caixa de presente (anual 97,90) — só na escada de saída. */
export const temAnual97 = (): boolean => !!produtosPrepagos[ID_ANUAL_97];

async function comprarPrepago(id: IdPrepago): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: id, retentou: true });
    return false;
  }
  try {
    if (!produtosPrepagos[id]) await prefetchAssinaturas();
    const produto = produtosPrepagos[id];
    if (!produto) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "produto_ausente", produto: id });
      return false;
    }
    /* TELEMETRIA DA FOLHA (26/08). `app_compra_opcao` só existia no caminho de
     * ASSINATURA — o prepago vai por purchaseStoreProduct e não passava por
     * lá. Resultado: dos 102 toques em comprar da safra à vista, a gente via
     * as desistências mas não sabia o que a loja tinha servido no aparelho.
     * Sem isso não dá pra separar "achou caro" de "a loja nem ofereceu". */
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: id,
      escolhida: produto?.identifier ?? id,
      preco: produto?.priceString ?? null,
      prepago: true,
    });
    marcarFolhaAberta();
    await Purchases.purchaseStoreProduct({ product: produto });
    registrarResultadoDaFolha("sucesso", id);
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    // cancelou / pendente / já é seu / conta não pode / erro da Play — triagem única
    return desfechoDaFalha(e, id);
  }
}

export const comprarMensalPix = (): Promise<boolean> => comprarPrepago(ID_MENSAL_PIX);
export const comprarMensalVista = (): Promise<boolean> => comprarPrepago(ID_MENSAL_VISTA);
export const comprarAnualVista = (): Promise<boolean> => comprarPrepago(ID_ANUAL_VISTA);
export const comprarAnual97 = (): Promise<boolean> => comprarPrepago(ID_ANUAL_97);

/** Irmã da compraVitaliciaLocal pro mundo assinatura: a pessoa ASSINOU neste
 *  aparelho (folha fechou) mas ainda não tem conta? A reabertura cai direto
 *  no "salvar seu acesso" em vez de paywall pra quem já pagou. */
export async function compraAssinaturaLocal(): Promise<boolean> {
  if (!isNativeShell()) return false;
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const ativos = (customerInfo as unknown as { activeSubscriptions?: string[] })?.activeSubscriptions ?? [];
    return ativos.some((id) => String(id).startsWith("core_"));
  } catch {
    return false;
  }
}

/**
 * Compra do VITALÍCIO (06/08) — produto único `core_vitalicio`, compra única
 * do Play (INAPP), fora do sistema de offerings/packages (que é de
 * assinatura). O acesso NÃO depende do entitlement do RevenueCat: quem manda
 * é a linha em `subscriptions` (webhook NON_RENEWING_PURCHASE + sync leem
 * /customers/{id}/purchases). Por isso: folha do Google fechou com sucesso =
 * compra feita = true, mesmo que o painel do RC ainda não tenha o produto
 * anexado a entitlement nenhum.
 */
/*
 * PRÉ-BUSCA do produto (07/08). O relato do dono no Moto: "cliquei umas 4
 * vezes pro botão ir". O toque disparava DUAS idas à rede (getProducts na
 * Play e só então a folha) — segundos de nada visível num aparelho fraco.
 * Agora o OfferScreen chama prefetchVitalicio() assim que o RC fica pronto:
 * quando o dedo chega no CTA o produto já está em memória e o toque abre a
 * folha direto. O cache não expira — preço só muda com release.
 */
type ProdutoRC = import("@revenuecat/purchases-capacitor").PurchasesStoreProduct;
// 09/08: virou dois produtos (27,90 cheio + 19,90 downsell) — o cache é por
// id e a pré-busca traz os dois numa ida só à Play.
// 27/08 (v81): terceiro irmão, core_vitalicio_97 — o vitalício vira a oferta
// única do paywall. Mesma família = herda todas as guardas startsWith.
/* ANUAL DO iPHONE (18/09): `core_anual_97` — R$ 97,90/ano com 3 dias grátis
 * (oferta introdutória da própria App Store; a folha aplica sozinha pra quem
 * é elegível). Até 01/10 era comprado DIRETO pelo produto, preso ao id.
 *
 * TESTE DE PREÇO 97,90 × 69,90 (01/10, RevenueCat Experiments). O experimento
 * troca a OFFERING por pessoa (50/50): a de controle tem o pacote anual =
 * core_anual_97, a "anual_69" tem o pacote anual = core_anual_69. Por isso o
 * app lê o pacote ANUAL da offering ATUAL (`getOfferings().current`) e compra
 * pelo PACOTE (`purchasePackage`) — é assim que o RevenueCat atribui a compra
 * ao braço certo; comprar pelo produto solto ficaria fora do experimento.
 * Reserva segura: se a offering atual não tiver pacote anual (painel ainda sem
 * o pacote, rede falhou no getOfferings), cai no getProducts(core_anual_97)
 * de sempre — a folha abre com o 97,90, nunca botão morto.
 * Preço, por-mês e dias grátis vêm SEMPRE do produto que a loja devolveu —
 * nada de "97,90" chumbado no texto (o braço 69,90 leria o preço errado). */
const ID_ANUAL_IOS_PADRAO = "core_anual_97";
type PacoteRC = import("@revenuecat/purchases-capacitor").PurchasesPackage;
let produtoAnualIos: ProdutoRC | undefined;
let pacoteAnualIos: PacoteRC | undefined;
let offeringAnualIos: string | null = null;
let produtoMensalIos: ProdutoRC | undefined;
let prefetchAnualDesfecho = "nao_rodou";

/** Oferta da App Store = o anual da família core_anual_* (97, 69…), nunca o pré-pago do Play. */
const ehAnualDaAppStore = (id: string | undefined): boolean => !!id && /^core_anual(_\d+)?$/.test(id);

export async function prefetchAnualIos(): Promise<void> {
  if (produtoAnualIos) return;
  if (!configurado || !Purchases) { prefetchAnualDesfecho = "nao_configurado"; return; }
  // 1) o pacote anual da offering ATUAL (o experimento decide qual é)
  try {
    const offerings = await Purchases.getOfferings();
    registrarChavesDasOfferings(offerings);
    const atual = offerings?.current;
    const pacote = (atual?.availablePackages ?? []).find((p) => ehAnualDaAppStore(p?.product?.identifier))
      ?? (ehAnualDaAppStore((atual as { annual?: PacoteRC } | undefined)?.annual?.product?.identifier) ? (atual as { annual?: PacoteRC }).annual : undefined);
    if (pacote?.product) {
      pacoteAnualIos = pacote;
      produtoAnualIos = pacote.product;
      offeringAnualIos = atual?.identifier ?? null;
      prefetchAnualDesfecho = `offering_${offeringAnualIos ?? "?"}`;
    }
    // 10/10: o MENSAL da mesma offering (core_mensal) — preço real pro selo "economize N%"
    const mensal = (atual?.availablePackages ?? []).find((p) => /^core_mensal(:|$)/.test(String(p?.product?.identifier ?? "")));
    if (mensal?.product) produtoMensalIos = mensal.product;
  } catch (e) {
    prefetchAnualDesfecho = "offerings_lancou_" + String((e as { message?: string })?.message ?? e).slice(0, 60);
  }
  // 2) reserva: o produto padrão direto da loja (como era até 01/10)
  if (!produtoAnualIos) {
    try {
      const mod = await import("@revenuecat/purchases-capacitor");
      const { products } = await Purchases.getProducts({ productIdentifiers: [ID_ANUAL_IOS_PADRAO], type: mod.PRODUCT_CATEGORY.SUBSCRIPTION });
      produtoAnualIos = (products ?? []).find((p) => p?.identifier === ID_ANUAL_IOS_PADRAO || p?.identifier?.startsWith(ID_ANUAL_IOS_PADRAO + ":"));
      pacoteAnualIos = undefined;
      offeringAnualIos = null;
      prefetchAnualDesfecho += `_produtos_${(products ?? []).length}`;
    } catch (e) {
      prefetchAnualDesfecho += "_lancou_" + String((e as { message?: string })?.message ?? e).slice(0, 60);
    }
  }
  if (produtoAnualIos) {
    const id = idProdutoAnualIos();
    try {
      const r = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [id] });
      // INTRO_ELIGIBILITY_STATUS: 0 desconhecido · 1 inelegível · 2 elegível · 3 sem oferta
      const st = (r as Record<string, { status?: number }> | null)?.[id]?.status;
      elegivelIntroAnual = st === 1 ? "ineligible" : st === 2 ? "eligible" : "unknown";
    } catch { elegivelIntroAnual = "unknown"; }
  }
}

/** A loja já carregou o anual? (a vitrine só promete o que a loja tem) */
export const temAnualIos = (): boolean => !!produtoAnualIos;
/** Preço real do anual na moeda da loja (ex.: "R$ 97,90" ou "R$ 69,90"), se já carregou. */
export const precoAnualIos = (): string | null => produtoAnualIos?.priceString ?? null;
/** Id do produto anual que a loja serviu (core_anual_97 / core_anual_69). Antes de carregar, o padrão. */
export const idProdutoAnualIos = (): string => {
  const id = produtoAnualIos?.identifier ?? ID_ANUAL_IOS_PADRAO;
  return id.includes(":") ? id.split(":")[0] : id;
};
/** "anual_97" / "anual_69": o rótulo do braço, pra TODO evento de paywall/compra. */
export const ofertaAnualIos = (id: string = idProdutoAnualIos()): string => id.replace(/^core_/, "");
/** O que a pessoa está vendo — vai junto em cada evento do paywall e da compra. */
export const dadosDaOfertaIos = (): { oferta: string; produto: string; offering: string | null; preco: string | null; pacote: boolean } => ({
  oferta: ofertaAnualIos(),
  produto: idProdutoAnualIos(),
  offering: offeringAnualIos,
  preco: precoAnualIos(),
  pacote: !!pacoteAnualIos,
});
/* ELEGIBILIDADE (20/09): o StoreKit devolve a oferta introdutória no produto
 * pra TODO MUNDO; quem já usou o teste no grupo não ganha de novo e a folha
 * cobra na hora. O RevenueCat sabe dizer quem é (checkTrialOrIntroductory-
 * PriceEligibility); sem resposta, a vitrine assume elegível — a folha da
 * Apple é quem manda no fim. */
let elegivelIntroAnual: "eligible" | "ineligible" | "unknown" = "unknown";
type IntroAnual = { price?: number; priceString?: string; periodUnit?: string; periodNumberOfUnits?: number } | null;
const introDoAnual = (): IntroAnual => (produtoAnualIos as { introPrice?: IntroAnual } | undefined)?.introPrice ?? null;

/** A folha vai oferecer os dias grátis pra esta conta? */
export const anualIosTemTrial = (): boolean => !!introDoAnual() && elegivelIntroAnual !== "ineligible";

/** Dias grátis da oferta introdutória, lidos da LOJA e não do código: 3 hoje;
 *  trocar pra 7 no App Store Connect não pede build nova. 0 = sem teste. */
export const diasTrialIos = (): number => {
  const intro = introDoAnual();
  if (!intro || !anualIosTemTrial()) return 0;
  const n = Number(intro.periodNumberOfUnits ?? 0) || 0;
  const u = String(intro.periodUnit ?? "DAY").toUpperCase();
  return u === "WEEK" ? n * 7 : u === "MONTH" ? n * 30 : u === "YEAR" ? n * 365 : n;
};

/** 10/10 (PAYWALL_CURTO): o que a folha da Apple mostra HOJE pelo teste — o priceString da
 *  oferta introdutória ("R$ 0,00"; "$0.00" na vitrine dos EUA). Sem oferta/sem loja: null. */
export const precoDoTesteIos = (): string | null => {
  const intro = introDoAnual();
  if (!intro || !anualIosTemTrial()) return null;
  if (intro.priceString) return intro.priceString;
  const p = produtoAnualIos as { currencyCode?: string } | undefined;
  return formatarMoeda(Number(intro.price ?? 0) || 0, p?.currencyCode || "BRL");
};

const formatarMoeda = (valor: number, moeda: string): string => {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(valor).replace(/\u00A0/g, " ");
  } catch {
    return `${moeda} ${valor.toFixed(2).replace(".", ",")}`;
  }
};

/** Valor numérico do anual na moeda da loja (97.9 / 69.9), ou null. */
export const valorAnualIos = (): number | null => {
  const p = produtoAnualIos as { price?: number } | undefined;
  return p?.price && p.price > 0 ? p.price : null;
};
/** "4 meses de mensal = 1 ano inteiro": quantos meses de 24,90 pagam o ano, pelo preço REAL
 *  (97,90 → 4; 69,90 → 3). null enquanto a loja não respondeu. */
export const mesesDeMensalQuePagamOAno = (mensal = 24.9): number | null => {
  const v = valorAnualIos();
  return v ? Math.max(1, Math.ceil(v / mensal - 1e-9)) : null;
};
/** O anual dividido por 12, na moeda da loja ("R$ 8,16") — é o número que a
 *  pessoa compara com o mensal. null enquanto a loja não respondeu. */
export const precoMensalDoAnualIos = (): string | null => {
  const p = produtoAnualIos as { price?: number; currencyCode?: string } | undefined;
  if (!p?.price || !(p.price > 0)) return null;
  return formatarMoeda(p.price / 12, p.currencyCode || "BRL");
};

/* 10/10 (chave PAYWALL_TEXTOS): o MENSAL também vem da loja, nunca chumbado. */
/** Preço real do mensal (core_mensal) na offering atual, ex. "R$ 24,90"; null até a loja responder. */
export const precoMensalIos = (): string | null => produtoMensalIos?.priceString ?? null;
/** Valor numérico do mensal (24.9), ou null. */
export const valorMensalIos = (): number | null => {
  const p = produtoMensalIos as { price?: number } | undefined;
  return p?.price && p.price > 0 ? p.price : null;
};
/** "economize 67%": quanto o ano economiza contra 12 meses de mensal, arredondado.
 *  Pura: 97,90 × 24,90 → 67; 69,90 × 24,90 → 77. null se algum preço faltar ou a conta não fizer sentido. */
export const calcularEconomia = (anual: number | null, mensal: number | null): number | null => {
  if (!anual || !mensal || anual <= 0 || mensal <= 0) return null;
  const pct = Math.round((1 - anual / (12 * mensal)) * 100);
  return pct >= 1 && pct <= 99 ? pct : null;
};
/** A economia do anual servido pela loja contra o mensal servido pela loja. */
export const economiaDoAnualIos = (): number | null => calcularEconomia(valorAnualIos(), valorMensalIos());

let ultimaCompraFoiTrial = false;
let ultimaCompraFimMs: number | null = null;
/** Lê do resultado da folha se a compra entrou em TESTE (e até quando) — comum ao anual do
 *  paywall e ao presente de 69,90 (10/10). `seNaoDisser` vale quando a loja não devolveu entitlement. */
const anotarTrialDaCompra = (resultado: unknown, seNaoDisser: boolean): void => {
  const ativos = Object.values(
    (resultado as { customerInfo?: { entitlements?: { active?: Record<string, { periodType?: string; expirationDateMillis?: number | null }> } } } | undefined)
      ?.customerInfo?.entitlements?.active ?? {},
  );
  ultimaCompraFoiTrial = ativos.length ? ativos.some((e) => e?.periodType === "TRIAL") : seNaoDisser;
  const fim = ativos.find((e) => e?.periodType === "TRIAL")?.expirationDateMillis;
  ultimaCompraFimMs = typeof fim === "number" && fim > Date.now() ? fim : null;
};
/** A última compra do anual entrou em período de TESTE (a Apple aplicou a
 *  oferta)? É o que decide se o app arma o lembrete "acaba amanhã". */
export const ultimaCompraAnualFoiTrial = (): boolean => ultimaCompraFoiTrial;
/** Fim REAL do teste que a última compra abriu (expirationDateMillis do
 *  entitlement), ou null se a loja não disse — aí o app conta `dias` da compra. */
export const fimDaUltimaCompraTrial = (): number | null => ultimaCompraFimMs;


export async function comprarAnualIos(): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: idProdutoAnualIos(), oferta: ofertaAnualIos(), retentou: true });
    return false;
  }
  try {
    if (!produtoAnualIos) { await initRevenueCat(); await prefetchAnualIos(); }
    if (!produtoAnualIos) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "produto_ausente", produto: ID_ANUAL_IOS_PADRAO, oferta: ofertaAnualIos(ID_ANUAL_IOS_PADRAO), retentou: true, estado_rc: estado, prefetch: prefetchAnualDesfecho });
      return false;
    }
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: idProdutoAnualIos(),
      escolhida: produtoAnualIos.identifier ?? idProdutoAnualIos(),
      preco: produtoAnualIos.priceString ?? null,
      trial: anualIosTemTrial(),
      ...dadosDaOfertaIos(),
    });
    // Pelo PACOTE quando veio da offering (é o que amarra a compra ao braço do
    // experimento); pelo produto só na reserva. 1.0.18: com 1 retentativa se a loja falhar de passagem.
    const pacote = pacoteAnualIos, produto = produtoAnualIos, P = Purchases;
    const resultado = await folhaComRetentativa(idProdutoAnualIos(), () => (pacote
      ? P.purchasePackage({ aPackage: pacote })
      : P.purchaseStoreProduct({ product: produto })));
    registrarResultadoDaFolha("sucesso", idProdutoAnualIos());
    anotarTrialDaCompra(resultado, anualIosTemTrial());
    /* SEM logPurchase manual (20/09, build 20). O app da Meta tem "registro
     * automático de compras" LIGADO (bitmask do app, bit 1) e o SDK 18 lê o
     * StoreKit 2: ele mesmo registra StartTrial nos 3 dias grátis e Subscribe
     * na cobrança. A VENDA (Purchase 97,90) sai do servidor pelo CAPI quando o
     * trial vira cobrança (meta-backfill-app: período < 10 dias = StartTrial,
     * depois Purchase no período cheio). Um Purchase de R$ 0 aqui contava
     * "compra" sem dinheiro e ensinava a campanha a buscar quem só começa o
     * teste. */
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    return desfechoDaFalha(e, idProdutoAnualIos());
  }
}

const IDS_VITALICIOS = ["core_vitalicio", "core_vitalicio_19", "core_vitalicio_97"] as const;
export type IdVitalicio = (typeof IDS_VITALICIOS)[number];
const produtosVitalicios: Partial<Record<IdVitalicio, ProdutoRC>> = {};
// Diagnóstico da varredura 31/08: o catch vazio daqui deixava o evento
// produto_ausente MUDO — impossível separar "getProducts lançou" (rede) de
// "respondeu vazio" (conta/aparelho sem o SKU, ex.: emulador ou conta Play de
// fora do BR — o catálogo inteiro é só-BR). Guarda o último desfecho pro
// evento contar.
let prefetchVitalicioDesfecho: string | null = null;
export async function prefetchVitalicio(): Promise<void> {
  if (IDS_VITALICIOS.every((i) => produtosVitalicios[i])) return;
  // v83: mesmo racional do prefetchAssinaturas — configurado basta.
  if (!configurado || !Purchases) { prefetchVitalicioDesfecho = "nao_configurado"; return; }
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    const { products } = await Purchases.getProducts({
      productIdentifiers: [...IDS_VITALICIOS],
      type: mod.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    for (const p of products ?? []) {
      const id = IDS_VITALICIOS.find((i) => p?.identifier?.startsWith(i + ":") || p?.identifier === i);
      if (id) produtosVitalicios[id] = p;
    }
    prefetchVitalicioDesfecho = `respondeu_${(products ?? []).length}`;
  } catch (e) {
    // sem rede agora — o comprarVitalicio tenta de novo na hora do toque
    prefetchVitalicioDesfecho = "lancou_" + String((e as { message?: string })?.message ?? e).slice(0, 80);
  }
}

/** Vitalício 97,90 no catálogo? (regra do botão-nunca-morto: a vitrine só
 *  promete o que a loja carregou; enquanto propaga, fallback no anual97.) */
export const temVitalicio97 = (): boolean => !!produtosVitalicios.core_vitalicio_97;

export async function comprarVitalicio(produtoId: IdVitalicio = "core_vitalicio"): Promise<boolean> {
  ultimoMotivo = null;
  if (!(await garantirPronto())) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: produtoId, retentou: true });
    return false;
  }
  try {
    if (!produtosVitalicios[produtoId]) await prefetchVitalicio();
    let produto = produtosVitalicios[produtoId];
    if (!produto) {
      /* Varredura 31/08: o toque é o momento de maior intenção (lição do
       * 8040e72) — antes de declarar ausente, UMA re-tentativa completa
       * (init + prefetch): se o init anterior ficou capenga por rede, o
       * prefetch sozinho faria early-return de novo. Cliente real com rede
       * oscilando se recupera aqui; emulador/conta sem o SKU continua
       * falhando fechado, como desenhado. */
      await initRevenueCat();
      await prefetchVitalicio();
      produto = produtosVitalicios[produtoId];
    }
    if (!produto) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", {
        motivo: "produto_ausente",
        produto: produtoId,
        retentou: true,
        // o que o aparelho REALMENTE viu — separa rede × conta/país sem SKU
        estado_rc: estado,
        prefetch: prefetchVitalicioDesfecho,
        cacheados: Object.keys(produtosVitalicios).slice(0, 4),
      });
      return false;
    }
    /* v83: o vitalício era CEGO na telemetria de abertura — 35% das vendas só
     * apareciam na subscriptions e a folha dele tinha que ser reconstruída por
     * cancelamento. Mesmo evento do caminho pré-pago. */
    trackEventBeacon("app_compra_opcao", {
      desde_toque_ms: consumirToque(),
      produto: produtoId,
      escolhida: produto?.identifier ?? produtoId,
      preco: produto?.priceString ?? null,
      vitalicio: true,
    });
    marcarFolhaAberta();
    await Purchases.purchaseStoreProduct({ product: produto });
    registrarResultadoDaFolha("sucesso", produtoId);
    // Dinheiro saiu. Sincroniza já pra pessoa entrar na hora; se o sync
    // atrasar, webhook e reconciliarSePreciso completam.
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    // cancelou / pendente / já é seu / conta não pode / erro da Play — triagem única
    return desfechoDaFalha(e, produtoId);
  }
}

/**
 * A pessoa COMPROU neste aparelho mas ainda não tem conta? (09/08 — cadastro
 * passou pra DEPOIS da compra no app.) O RevenueCat guarda a transação no
 * usuário anônimo local; se o app morrer entre a folha do Google e o
 * cadastro, é isto que deixa a reabertura cair direto no "salvar seu acesso"
 * em vez de mostrar paywall pra quem já pagou.
 */
export async function compraVitaliciaLocal(): Promise<boolean> {
  if (!isNativeShell()) return false;
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const compras = (customerInfo as unknown as { nonSubscriptionTransactions?: { productIdentifier?: string; productId?: string }[] })
      ?.nonSubscriptionTransactions ?? [];
    return compras.some((t) => String(t?.productIdentifier ?? t?.productId ?? "").startsWith("core_vitalicio"));
  } catch {
    return false;
  }
}

/** Restaurar compras (obrigatório de loja — botão no paywall). */
/**
 * Folha de resgate de código de oferta da APPLE (14/09, "segue e ganha 7
 * dias" no iPhone). A Apple proíbe destravar por código próprio (3.1.1),
 * mas o Offer Code dela é o caminho oficial: o código INSTA7 vive no App
 * Store Connect (1 semana grátis no mensal) e a folha é do sistema. Depois
 * que a pessoa resgata, a assinatura aparece no restaurar()/sincronizar —
 * a folha não avisa quando fecha, então quem chama mostra "Já resgatei".
 */
export async function abrirResgateApple(): Promise<boolean> {
  if (!configurado || !Purchases) return false;
  try {
    await (Purchases as NonNullable<typeof Purchases>).presentCodeRedemptionSheet();
    return true;
  } catch {
    return false;
  }
}

export async function restaurar(): Promise<boolean> {
  // v83: restaurar é exigência de loja — não pode depender de offerings.
  if (!configurado || !Purchases) return false;
  try {
    const { customerInfo } = await (Purchases as NonNullable<typeof Purchases>).restorePurchases();
    if (!temEntitlement(customerInfo)) return false;
    await sincronizarAssinatura();
    return true;
  } catch {
    return false;
  }
}
