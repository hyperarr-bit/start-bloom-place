import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  routeName?: string;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary por rota: contém crashes em uma única página
 * para que o app inteiro não fique em tela branca.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[RouteErrorBoundary:${this.props.routeName ?? "?"}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Algo deu errado nesta seção</h2>
            <p className="text-sm text-muted-foreground">
              Tivemos um problema ao carregar este módulo. Suas outras abas continuam funcionando normalmente.
            </p>
          </div>
          {this.state.error?.message && (
            <details className="text-left text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="whitespace-pre-wrap break-words mt-2">{this.state.error.message}</pre>
            </details>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" size="sm" onClick={this.reset}>
              <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
            </Button>
            <Button size="sm" onClick={() => (window.location.href = "/")}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
