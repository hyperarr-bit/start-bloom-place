import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { codigoDoLinkDeAbertura, olharLinkDeAbertura, resgatarCodigo } from "@/lib/porta-handoff";

/**
 * A ABERTURA SEM CONTA NO iPHONE, ANTES DA WELCOME (10/10, build 38) — o "abrir já logado" da Porta.
 *
 * O RootGate monta isto no lugar do `<Navigate to={ENTRADA_APP}>` quando o app da loja abre SEM conta.
 * Fora do iPhone é o Navigate direto. No iPhone, lê o link de abertura (teto de 400 ms; na prática é
 * imediato): se o app abriu por `core://entrar?h=<código>` (o "Abrir o CORE" da Porta, app recém-
 * instalado), resgata esse código em vez de piscar a welcome. Entrou → /home (o gate mostra "Você ganhou
 * 3 dias grátis" e o paywall curto; nunca a welcome nem o funil). O código não deu → /entrar (ela tem
 * conta). Sem link (ou `core://entrar` sem código, que o deep-link.ts leva pro /entrar) → a welcome.
 * NUNCA lê a área de transferência (proibido, dono 10/10).
 */
export function PortaPrimeiraAbertura({ semPorta }: { semPorta: string }) {
  const [destino, setDestino] = useState<string | null>(() => (olharLinkDeAbertura() ? null : semPorta));
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (destino) return;
    let vivo = true;
    void (async () => {
      const codigo = await codigoDoLinkDeAbertura();
      if (!vivo) return;
      if (!codigo) { setDestino(semPorta); return; }
      setEntrando(true);
      const r = await resgatarCodigo(codigo, "link");
      if (!vivo) return;
      setDestino(r.ok ? "/home" : r.motivo === "assinante_logado" ? semPorta : "/entrar");
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (destino) return <Navigate to={destino} replace />;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="porta-primeira-abertura">
      {entrando && <p className="text-[15px] text-muted-foreground">Entrando na sua conta…</p>}
    </div>
  );
}
