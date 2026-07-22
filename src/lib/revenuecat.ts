/**
 * RevenueCat — assinatura do app Android (22/07). Carrega SÓ no shell nativo,
 * por import dinâmico: o bundle web nunca puxa o plugin.
 *
 * Estados possíveis (o paywall trata os três):
 *  - "pronto": chave configurada + offerings carregadas → compra funciona
 *  - "sem_chave": VITE_REVENUECAT_ANDROID_KEY ausente (Console/RC ainda não
 *    criados — fase atual). Paywall mostra os preços, botão desabilitado
 *    com aviso. NUNCA quebra o app.
 *  - "erro": plugin falhou (rede etc.) → mesmo tratamento de sem_chave.
 */
import { isNativeShell } from "@/lib/native-shell";

type EstadoRC = "pronto" | "sem_chave" | "erro";
let estado: EstadoRC = "sem_chave";
let Purchases: typeof import("@revenuecat/purchases-capacitor").Purchases | null = null;

export async function initRevenueCat(): Promise<EstadoRC> {
  if (!isNativeShell()) return "sem_chave";
  const key = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  if (!key) { estado = "sem_chave"; return estado; }
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    Purchases = mod.Purchases;
    await Purchases.configure({ apiKey: key });
    estado = "pronto";
  } catch (e) {
    console.warn("[RC] init falhou:", e);
    estado = "erro";
  }
  return estado;
}

export const estadoRevenueCat = () => estado;

/** Compra o produto (core_anual/core_mensal). Devolve true se a assinatura
 *  ativou. O grant de acesso vem do estado do RevenueCat (entitlement), não
 *  de webhook nosso — RC cuida de renovação/cancelamento/restore. */
export async function comprar(productId: string): Promise<boolean> {
  if (estado !== "pronto" || !Purchases) return false;
  try {
    const offerings = await (Purchases as NonNullable<typeof Purchases>).getOfferings();
    const pacotes = offerings?.current?.availablePackages ?? [];
    const alvo = pacotes.find((p) => p.product?.identifier?.startsWith(productId));
    if (!alvo) { console.warn("[RC] produto não encontrado:", productId); return false; }
    const { customerInfo } = await (Purchases as NonNullable<typeof Purchases>).purchasePackage({ aPackage: alvo });
    return Object.keys(customerInfo?.entitlements?.active ?? {}).length > 0;
  } catch (e) {
    // usuário cancelou a folha de compra ou erro de billing — não é crash
    console.warn("[RC] compra não concluída:", e);
    return false;
  }
}

/** Restaurar compras (obrigatório de loja — botão no paywall). */
export async function restaurar(): Promise<boolean> {
  if (estado !== "pronto" || !Purchases) return false;
  try {
    const { customerInfo } = await (Purchases as NonNullable<typeof Purchases>).restorePurchases();
    return Object.keys(customerInfo?.entitlements?.active ?? {}).length > 0;
  } catch {
    return false;
  }
}
