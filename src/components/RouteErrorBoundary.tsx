import React from "react";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { isNativeShell } from "@/lib/native-shell";

interface Props {
  children: React.ReactNode;
  routeName?: string;
}

interface State {
  error: Error | null;
  reloading: boolean;
}

// Deploy troca o hash dos chunks: aba aberta com o index.html antigo tenta
// carregar um JS que não existe mais e o lazy import explode. Caso real de
// 12/07: o dono (e possivelmente um pagante às 16:20, que marcou "problema
// técnico" e cancelou) viu a tela de erro em /financas logo após deploys.
//
// AS TRÊS CARAS QUE FALTAVAM (16/08, achadas no painel de route_error):
//  - "Cannot read properties of undefined (reading 'default')": o chunk do
//    React.lazy resolveu com `undefined` SEM lançar. A causa não era o
//    servidor (HTML não passa por parser de módulo — isso dá erro de MIME,
//    abaixo): era o NOSSO listener de vite:preloadError chamando
//    preventDefault, o que faz o `.catch` do Vite resolver vazio. Corrigido
//    na origem em main.tsx; o padrão fica aqui como rede de segurança.
//    Sintoma nº1 em 7 dias: 11 telas quebradas em /casa, 10 pessoas
//    DIFERENTES. Não era dado velho de usuário: era deploy.
//  - "'text/html' is not a valid JavaScript MIME type": o servidor devolveu
//    o index.html (fallback de SPA) no lugar do JS sumido e o navegador
//    recusou — é a mesma família, chunk que não existe mais.
//  - "Unable to preload CSS for /assets/*.css": irmão do anterior no CSS.
// Nenhuma delas casava com o regex, então o boundary não recarregava —
// mostrava "Algo deu errado nesta seção" e a pessoa ficava presa numa tela
// morta que um F5 resolveria.
const isChunkError = (error: Error | null) =>
  !!error && /dynamically imported module|module script failed|ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|Unable to preload CSS|is not a valid JavaScript MIME type|reading 'default'|of undefined \(reading "default"\)/i.test(
    `${error.name} ${error.message}`,
  );

const RELOAD_GUARD_KEY = "core-chunk-reload-at";

/**
 * ErrorBoundary por rota: contém crashes em uma única página
 * para que o app inteiro não fique em tela branca.
 * Erro de chunk (build novo no ar, aba velha) recarrega sozinho — 1x por
 * minuto no máximo, pra nunca virar loop de reload.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[RouteErrorBoundary:${this.props.routeName ?? "?"}]`, error, info);

    /*
     * MANDA O ERRO PRA CASA (27/07).
     *
     * O dono levou esta tela no meio do funil e a única pista que sobrou foi
     * a foto: título "Algo deu errado nesta seção" e os "Detalhes técnicos"
     * fechados. Passei duas horas atrás da causa por eliminação e ERREI o
     * diagnóstico — o console só existe pra quem tem o cabo na mão, e ninguém
     * tem quando é o usuário que quebra.
     *
     * Agora todo crash de rota vira evento com a mensagem, a rota e a
     * primeira linha do stack. Da próxima vez a resposta vem do painel, não
     * de palpite meu.
     */
    try {
      trackEvent("route_error", {
        route: this.props.routeName ?? "?",
        message: String(error?.message ?? "").slice(0, 300),
        stack: String(error?.stack ?? "").split("\n").slice(0, 3).join(" | ").slice(0, 400),
        componente: String(info?.componentStack ?? "").trim().split("\n")[0]?.slice(0, 120) ?? "",
        url: typeof location !== "undefined" ? location.pathname + location.search : "",
        chunk: isChunkError(error),
      });
    } catch { /* telemetria nunca pode derrubar a tela de erro */ }
    if (isChunkError(error)) {
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0); } catch { /* noop */ }
      if (Date.now() - last > 60_000) {
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch { /* noop */ }
        this.setState({ reloading: true });
        window.location.reload();
      }
    }
  }

  reset = () => this.setState({ error: null, reloading: false });

  render() {
    if (!this.state.error) return this.props.children;

    // Recarregando pra pegar o build novo: spinner discreto, não tela de erro.
    if (this.state.reloading) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Atualizando o app…</p>
        </div>
      );
    }

    const chunk = isChunkError(this.state.error);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              {chunk ? "Nova versão do app disponível" : "Algo deu errado nesta seção"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {chunk
                ? "Atualizamos o CORE enquanto essa tela estava aberta. Recarregue pra pegar a versão nova — seus dados estão salvos."
                : "Tivemos um problema ao carregar este módulo. Suas outras abas continuam funcionando normalmente."}
            </p>
          </div>
          {!chunk && this.state.error?.message && (
            /* ABERTO por padrão no app da loja (04/08): o dono fotografou esta
               tela num aparelho de teste e a foto veio com os detalhes
               fechados — zero informação. No celular ninguém abre <summary>;
               com o motivo visível, a foto do usuário É o diagnóstico. Na web
               continua fechado (lá tem DevTools). */
            <details open={isNativeShell()} className="text-left text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="whitespace-pre-wrap break-words mt-2">{this.state.error.message}</pre>
            </details>
          )}
          <div className="flex gap-2 justify-center pt-2">
            {chunk ? (
              <Button size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-1" /> Recarregar agora
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={this.reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
                </Button>
                <Button size="sm" onClick={() => (window.location.href = "/")}>
                  Voltar ao início
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
