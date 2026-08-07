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
 *  - "sem_chave": VITE_REVENUECAT_ANDROID_KEY ausente. Paywall mostra os
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
import { isNativeShell } from "@/lib/native-shell";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

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

export async function initRevenueCat(): Promise<EstadoRC> {
  if (!isNativeShell()) return "sem_chave";
  const key = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
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
export type MotivoCompra = "cancelou" | "billing_erro" | "produto_ausente" | "sem_entitlement" | "catalogo" | null;
let ultimoMotivo: MotivoCompra = null;
export const motivoUltimaCompra = (): MotivoCompra => ultimoMotivo;

export async function comprar(productId: string): Promise<boolean> {
  ultimoMotivo = null;
  if (estado !== "pronto" || !Purchases) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: productId });
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
    const { customerInfo } = await (Purchases as NonNullable<typeof Purchases>).purchasePackage({ aPackage: alvo });
    if (!temEntitlement(customerInfo)) {
      ultimoMotivo = "sem_entitlement";
      trackEvent("app_compra_falhou", { motivo: "sem_entitlement", produto: productId });
      return false;
    }
    // O dinheiro já saiu: mesmo que o sync falhe agora, devolvo true (o
    // webhook e o reconciliarSePreciso pegam depois) — mas tento aqui pra
    // pessoa entrar no app na mesma hora.
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    // usuário cancelou a folha de compra ou erro de billing — não é crash
    console.warn("[RC] compra não concluída:", e);
    const msg = String((e as { message?: string })?.message ?? e);
    const cancelou = /cancel/i.test(msg) || (e as { code?: string })?.code === "1";
    ultimoMotivo = cancelou ? "cancelou" : "billing_erro";
    trackEvent("app_compra_falhou", {
      motivo: cancelou ? "cancelou" : "billing_erro",
      produto: productId,
      erro: msg.slice(0, 160),
    });
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
let produtoVitalicio: ProdutoRC | null = null;
export async function prefetchVitalicio(): Promise<void> {
  if (produtoVitalicio || estado !== "pronto" || !Purchases) return;
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    const { products } = await Purchases.getProducts({
      productIdentifiers: ["core_vitalicio"],
      type: mod.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    produtoVitalicio = products?.[0] ?? null;
  } catch {
    // sem rede agora — o comprarVitalicio tenta de novo na hora do toque
  }
}

export async function comprarVitalicio(): Promise<boolean> {
  ultimoMotivo = null;
  if (estado !== "pronto" || !Purchases) {
    ultimoMotivo = "catalogo";
    trackEvent("app_compra_falhou", { motivo: "rc_" + estado, produto: "core_vitalicio" });
    return false;
  }
  try {
    if (!produtoVitalicio) await prefetchVitalicio();
    const produto = produtoVitalicio;
    if (!produto) {
      ultimoMotivo = "produto_ausente";
      trackEvent("app_compra_falhou", { motivo: "produto_ausente", produto: "core_vitalicio" });
      return false;
    }
    await Purchases.purchaseStoreProduct({ product: produto });
    // Dinheiro saiu. Sincroniza já pra pessoa entrar na hora; se o sync
    // atrasar, webhook e reconciliarSePreciso completam.
    await sincronizarAssinatura();
    return true;
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    const cancelou = /cancel/i.test(msg) || (e as { code?: string })?.code === "1";
    ultimoMotivo = cancelou ? "cancelou" : "billing_erro";
    trackEvent("app_compra_falhou", {
      motivo: cancelou ? "cancelou" : "billing_erro",
      produto: "core_vitalicio",
      erro: msg.slice(0, 160),
    });
    return false;
  }
}

/** Restaurar compras (obrigatório de loja — botão no paywall). */
export async function restaurar(): Promise<boolean> {
  if (estado !== "pronto" || !Purchases) return false;
  try {
    const { customerInfo } = await (Purchases as NonNullable<typeof Purchases>).restorePurchases();
    if (!temEntitlement(customerInfo)) return false;
    await sincronizarAssinatura();
    return true;
  } catch {
    return false;
  }
}
