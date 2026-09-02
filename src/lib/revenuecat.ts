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
import { trackEvent } from "@/lib/analytics";
import { marcarTrialCartaoAte, trialCartaoAtivo } from "@/lib/teste-gratis";

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
const chaveDaLoja = (): string | undefined => {
  const env = import.meta.env as Record<string, string | undefined>;
  return plataformaApp() === "ios"
    ? env.VITE_REVENUECAT_IOS_KEY
    : env.VITE_REVENUECAT_ANDROID_KEY;
};

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
  for (let i = 0; i < tentativas; i++) {
    try {
      const { data, error } = await supabase.functions.invoke("revenuecat-sync");
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
  if (trialCartaoAtivo()) return; // a compra na própria sessão já marcou
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const ativos =
      ((customerInfo as unknown as {
        entitlements?: { active?: Record<string, { periodType?: string; expirationDateMillis?: number | null }> };
      })?.entitlements?.active) ?? {};
    for (const e of Object.values(ativos)) {
      if (e?.periodType === "TRIAL") {
        // fallback 7d (23/08): o único trial da vitrine nova é o anual de 7
        // dias — o fim REAL continua vindo do expirationDateMillis.
        marcarTrialCartaoAte(e.expirationDateMillis ?? Date.now() + 7 * 86_400_000);
        return;
      }
    }
  } catch { /* rede de segurança: nunca pode quebrar o boot */ }
}

/** Trial que NÃO vai renovar (cancelou, acesso ainda vivo): periodType TRIAL
 *  + willRenew false. É o gatilho da save-offer de downgrade (22/08, caso
 *  raquel: cancelou o anual 4h antes do débito — churn de preço, não de
 *  produto). 100% cliente, sem servidor. */
export async function estadoTrialCancelado(): Promise<boolean> {
  if (!isNativeShell()) return false;
  if (!configurado) await initRevenueCat();
  if (!Purchases || !configurado) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const ativos =
      ((customerInfo as unknown as {
        entitlements?: { active?: Record<string, { periodType?: string; willRenew?: boolean }> };
      })?.entitlements?.active) ?? {};
    return Object.values(ativos).some((e) => e?.periodType === "TRIAL" && e?.willRenew === false);
  } catch {
    return false;
  }
}

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
    trackEvent("app_compra_falhou", { motivo: "nao_permitido", produto, erro: msg.slice(0, 160) });
    return false;
  }
  const cancelou = /cancel/i.test(msg) || codigo === "1";
  ultimoMotivo = cancelou ? "cancelou" : "billing_erro";
  trackEvent("app_compra_falhou", { motivo: ultimoMotivo, produto, erro: msg.slice(0, 160) });
  return false;
}

/** Quando a FOLHA do Google foi aberta de verdade (varredura v81): medir "tempo
 *  na folha" a partir do toque no CTA mentia — o toque ainda paga import,
 *  garantirPronto (que pode re-rodar o init na rede) e prefetch. O carimbo
 *  nasce imediatamente antes do purchase*; a escada do paywall usa ele pra
 *  separar "fechou no Processando" de "trabalhou na folha". */
let folhaAbertaEm: number | null = null;
export const inicioUltimaFolha = (): number | null => folhaAbertaEm;
/** Carimbo da folha em memória E no disco: o `saida-do-app.ts` lê o de disco
 *  no boot seguinte pra saber se a morte do processo veio logo depois. */
const marcarFolhaAberta = () => {
  folhaAbertaEm = Date.now();
  try { localStorage.setItem("core-folha-aberta-em", String(folhaAbertaEm)); } catch { /* modo privado */ }
};

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
    trackEvent("app_compra_opcao", {
      produto: productId,
      servidas: opcoes.map((o) => o?.id).filter(Boolean).slice(0, 6),
      escolhida: comTrial?.id ?? baseSemTrial?.id ?? "package_default",
      temGratis: !!comTrial,
      semTrial: !!opts?.semTrial,
    });
    if (opts?.semTrial && !baseSemTrial) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "sem_base_plan", produto: productId });
      return false;
    }
    const escolhida = comTrial ?? baseSemTrial;
    if (escolhida) {
      marcarFolhaAberta();
      await (Purchases as NonNullable<typeof Purchases>).purchaseSubscriptionOption({
        subscriptionOption: escolhida as Parameters<NonNullable<typeof Purchases>["purchaseSubscriptionOption"]>[0]["subscriptionOption"],
      });
    } else {
      await (Purchases as NonNullable<typeof Purchases>).purchasePackage({ aPackage: alvo });
    }
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
    trackEvent("app_compra_opcao", {
      produto: id,
      escolhida: produto?.identifier ?? id,
      preco: produto?.priceString ?? null,
      prepago: true,
    });
    marcarFolhaAberta();
    await Purchases.purchaseStoreProduct({ product: produto });
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
    trackEvent("app_compra_opcao", {
      produto: produtoId,
      escolhida: produto?.identifier ?? produtoId,
      preco: produto?.priceString ?? null,
      vitalicio: true,
    });
    marcarFolhaAberta();
    await Purchases.purchaseStoreProduct({ product: produto });
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
