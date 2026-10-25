/**
 * "INICIAR TESTE" PELO SDK DA META NO iPHONE (1.0.19, 25/10) — pro SKAdNetwork.
 *
 * O problema (24/10): no Gerenciador de Eventos, a tela do SKAdNetwork com "Usar o SDK do Facebook" listou
 * ZERO eventos — nem "Iniciar teste", nem "Compra". O SDK do iPhone só mandava instalação e abertura; o
 * StartTrial e o Purchase saem do SERVIDOR (meta-backfill-app, CAPI de app). Evento de servidor não mexe no
 * valor de conversão do SKAN: quem atualiza o SKAN é o SDK, DENTRO do aparelho, na hora do evento.
 * (O "registro automático de compras" do SDK 18 lê o StoreKit, mas na prática não apareceu nada vindo do
 * SDK — a compra é feita pelo RevenueCat e o SDK não a enxergou.)
 *
 * O que isto faz: quando a folha da Apple fecha com SUCESSO e a compra entrou em TESTE GRÁTIS (entitlement
 * com periodType TRIAL), o aparelho manda "StartTrial" pelo SDK (MetaAds.logInicioTeste), com valor/moeda do
 * produto da loja, fb_content_id, fb_order_id/fb_transaction_id e event_id = id da transação da Apple.
 *
 * UMA VEZ POR TESTE, NO APARELHO QUE COMPROU:
 *   · só é chamado dos dois caminhos de compra do iPhone (anual do paywall e presente 69,90) — restaurar
 *     compra, renovação e reabrir o app nunca passam por aqui;
 *   · a transação tem que ser NOVA (data da compra há menos de 1 h): comprar de novo o que já está ativo
 *     devolve a transação antiga, que é recusada;
 *   · o id da transação fica guardado no aparelho (core-skan-trial-enviado) e nunca se repete.
 *
 * DEDUPLICAÇÃO COM O SERVIDOR: a Meta junta SDK e CAPI quando os dois trazem o MESMO event_id e o mesmo nome
 * (janela de 48 h). Aqui o event_id é o id da transação da Apple — para a 1ª compra de uma assinatura ele é
 * o original_transaction_id, que o RevenueCat chama de store_subscription_identifier. O servidor hoje manda
 * o StartTrial com event_id = id da assinatura NO REVENUECAT ("sub…"), que o aparelho não conhece. Então,
 * até o dono decidir, os dois NÃO se juntam (ver PASSO-A-PASSO.md de 25/10 e META_STARTTRIAL_ID_DA_LOJA no
 * meta-backfill-app, que já está pronto e DESLIGADO).
 *
 * Só iOS nativo. Web e Android: nada (retorna "nao_ios").
 */
import { trackEvent } from "@/lib/analytics";
import { plataformaApp } from "@/lib/native-shell";

export const CHAVE_INICIO_TESTE_ENVIADO = "core-skan-trial-enviado"; // do aparelho (lib/chaves-do-aparelho)
/** Transação mais velha que isto não é "o teste que acabou de começar". */
export const FRESCOR_MAXIMO_MS = 60 * 60 * 1000;
const GUARDA_NO_MAXIMO = 20;

type Entitlement = { periodType?: string; latestPurchaseDateMillis?: number | null; productIdentifier?: string };
type ResultadoDaCompra = {
  productIdentifier?: string;
  customerInfo?: { entitlements?: { active?: Record<string, Entitlement> } };
  transaction?: { transactionIdentifier?: string; productIdentifier?: string; purchaseDate?: string } | null;
};
type ProdutoDaLoja = { identifier?: string; price?: number; currencyCode?: string } | null | undefined;

export type InicioDeTeste = { transacao: string; produto: string; valor: number; moeda: string };
export type DecisaoInicioTeste =
  | { mandar: true; evento: InicioDeTeste }
  | { mandar: false; motivo: "sem_trial" | "sem_transacao" | "transacao_velha" | "ja_enviado" };

const lerEnviados = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_INICIO_TESTE_ENVIADO) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const marcarEnviado = (tx: string): void => {
  try {
    const lista = [...lerEnviados().filter((x) => x !== tx), tx].slice(-GUARDA_NO_MAXIMO);
    localStorage.setItem(CHAVE_INICIO_TESTE_ENVIADO, JSON.stringify(lista));
  } catch { /* modo privado: sem guarda local, mas a transação velha continua barrada pelo frescor */ }
};

/** Decisão pura: este resultado da folha é um teste que ACABOU de começar e ainda não foi mandado? */
export function decidirInicioDeTeste(resultado: unknown, produto: ProdutoDaLoja, agora: number = Date.now()): DecisaoInicioTeste {
  const r = (resultado ?? {}) as ResultadoDaCompra;
  const ativos = Object.values(r.customerInfo?.entitlements?.active ?? {});
  const trial = ativos.find((e) => e?.periodType === "TRIAL");
  // A loja não disse que entrou em teste = não manda (na dúvida, o servidor continua cobrindo pelo CAPI).
  if (!trial) return { mandar: false, motivo: "sem_trial" };
  const tx = String(r.transaction?.transactionIdentifier ?? "").trim();
  if (!tx) return { mandar: false, motivo: "sem_transacao" };
  const quando = r.transaction?.purchaseDate ? Date.parse(r.transaction.purchaseDate) : NaN;
  const data = Number.isFinite(quando) ? quando : Number(trial.latestPurchaseDateMillis ?? NaN);
  if (!Number.isFinite(data) || agora - data > FRESCOR_MAXIMO_MS) return { mandar: false, motivo: "transacao_velha" };
  if (lerEnviados().includes(tx)) return { mandar: false, motivo: "ja_enviado" };
  const id = r.transaction?.productIdentifier || r.productIdentifier || produto?.identifier || trial.productIdentifier || "";
  const valor = Number(produto?.price ?? 0);
  return {
    mandar: true,
    evento: { transacao: tx, produto: id, valor: valor > 0 ? valor : 0, moeda: produto?.currencyCode || "BRL" },
  };
}

export type DesfechoInicioTeste = "enviado" | "nao_ios" | "sem_sdk" | "erro" | Extract<DecisaoInicioTeste, { mandar: false }>["motivo"];

/** Chamado logo depois de `registrarResultadoDaFolha("sucesso")` nos caminhos do iPhone. Nunca lança. */
export async function registrarInicioDoTesteNoSdk(resultado: unknown, produto: ProdutoDaLoja, origem: string): Promise<DesfechoInicioTeste> {
  try {
    // Plataforma pelo global do runtime (sem importar o @capacitor/core antes da hora: o import só acontece
    // quando há mesmo o que mandar).
    if (plataformaApp() !== "ios") return "nao_ios";
    const d = decidirInicioDeTeste(resultado, produto);
    if (d.mandar === false) {
      const { motivo } = d as Extract<DecisaoInicioTeste, { mandar: false }>;
      if (motivo !== "sem_trial") trackEvent("meta_sdk_inicio_teste", { ok: false, motivo, origem });
      return motivo;
    }
    const { registerPlugin } = await import("@capacitor/core");
    const MetaAds = registerPlugin<{ logInicioTeste(o: InicioDeTeste): Promise<{ ok: boolean }> }>("MetaAds");
    // Marca ANTES de chamar: o pior caso de um erro aqui é perder 1 evento (o servidor continua mandando),
    // nunca mandar 2 vezes.
    marcarEnviado(d.evento.transacao);
    const r = await MetaAds.logInicioTeste(d.evento);
    const ok = !!r?.ok;
    trackEvent("meta_sdk_inicio_teste", { ok, origem, produto: d.evento.produto, valor: d.evento.valor, tx: d.evento.transacao });
    return ok ? "enviado" : "sem_sdk";
  } catch {
    return "erro";
  }
}
