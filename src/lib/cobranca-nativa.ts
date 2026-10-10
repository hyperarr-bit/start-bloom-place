/**
 * A FOLHA NATIVA "PROBLEMA DE COBRANÇA" DO STOREKIT — ponte JS (10/10, 1.0.14).
 *
 * No iOS 16.4+ o StoreKit tem a `StoreKit.Message` de billingIssue: a folha do
 * próprio sistema que leva direto à troca do cartão. Sem ninguém observar
 * `Message.messages`, o iOS mostra ela sozinho — em QUALQUER tela, inclusive
 * no meio do funil ou de um passo da missão. OBSERVAR a fila SUPRIME a
 * exibição automática: aí quem decide quando mostrar é o app.
 *
 * O nativo (ios/App/App/AppDelegate.swift, plugin `CoreNativo`) só começa a
 * observar quando o JS pede (`ativarFolhaDeCobranca`) — com a chave
 * COBRANCA_V14 desligada nada muda no aparelho. Ligada: o JS informa a rota a
 * cada navegação (`telaAtual`), o nativo guarda a folha numa fila e exibe
 * quando a rota é a Home; se em 60 s a Home não vier, exibe mesmo assim
 * (nunca engolir a folha que recupera dinheiro). Cada exibição volta como
 * evento `billingSheetExibida` → `billing_sheet_exibida`.
 *
 * Só no iPhone. Sem o plugin (build antiga, Android, web) tudo aqui é no-op.
 */
import { plataformaApp } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { cobrancaV14Ligada } from "@/lib/cobranca-recusada";

type PluginCoreNativo = {
  telaAtual(o: { rota: string }): Promise<void>;
  ativarFolhaDeCobranca(): Promise<{ ativo: boolean; suportado: boolean }>;
  addListener(evento: "billingSheetExibida", f: (d: { motivo?: string; esperou_ms?: number; forcada?: boolean }) => void): Promise<{ remove: () => Promise<void> }>;
};

/* Devolvido DENTRO DE UM OBJETO, de propósito (o mesmo motivo do `plugin()` em
 * notificacoes.ts): o plugin do Capacitor é um Proxy que transforma qualquer
 * propriedade lida numa chamada nativa — resolver uma promise com ele faz o JS
 * procurar `.then()`, o proxy "responde" que tem, e sem o nativo isso vira uma
 * rejeição solta ("CoreNativo" plugin is not implemented). */
type Carregado = { nativo: PluginCoreNativo };
let plugin: Promise<Carregado | null> | null = null;
const carregar = (): Promise<Carregado | null> => {
  if (plataformaApp() !== "ios") return Promise.resolve(null);
  if (!plugin) {
    plugin = import("@capacitor/core")
      .then(({ registerPlugin }) => ({ nativo: registerPlugin<PluginCoreNativo>("CoreNativo") }))
      .catch(() => null);
  }
  return plugin;
};

/** As rotas em que a folha pode aparecer: a Home. Nunca funil, missão, módulo. */
export const rotaAceitaFolha = (pathname: string): boolean => pathname === "/home" || pathname === "/";

/** Avisa o nativo da rota atual (ele só exibe na Home). Nunca lança. */
export async function informarTelaAtual(pathname: string): Promise<void> {
  try {
    const p = await carregar();
    await p?.nativo.telaAtual({ rota: pathname });
  } catch { /* build sem o plugin */ }
}

/**
 * Liga a ponte: ativa a observação no nativo (só com a chave) e escuta as
 * exibições. Devolve a função que desliga o ouvinte.
 */
export async function ligarPonteDaFolhaDeCobranca(): Promise<() => void> {
  if (plataformaApp() !== "ios") return () => {};
  try {
    const p = await carregar();
    if (!p) return () => {};
    const ouvinte = await p.nativo.addListener("billingSheetExibida", (d) => {
      trackEvent("billing_sheet_exibida", { motivo: d?.motivo ?? "billingIssue", esperou_ms: d?.esperou_ms ?? null, forcada: !!d?.forcada });
    });
    if (cobrancaV14Ligada()) {
      const r = await p.nativo.ativarFolhaDeCobranca();
      trackEvent("billing_sheet_observando", { ativo: !!r?.ativo, suportado: !!r?.suportado });
    }
    return () => { void ouvinte.remove().catch(() => { /* noop */ }); };
  } catch {
    return () => {};
  }
}
