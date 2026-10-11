import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  codigoDoLinkDeAbertura, detectarLinkNoClipboard, marcarClipboardTentado, precisaOlharClipboard,
  resgatarCodigo, resgatarDoClipboard, type ResultadoHandoff,
} from "@/lib/porta-handoff";

/**
 * A 1ª ABERTURA NO iPHONE, ANTES DA WELCOME (10/10, build 38) — o "abrir o app já logado" da Porta.
 *
 * O RootGate monta isto no lugar do `<Navigate to={ENTRADA_APP}>` quando o app da loja abre SEM conta.
 * Fora do iPhone, ou se esta instalação já olhou uma vez, é o Navigate direto (zero espera).
 * Na 1ª vez, em paralelo e com teto de 400 ms:
 *   · o app abriu por `core://porta?c=…` (o "Abrir o CORE" da Porta, app recém-instalado)? → resgata esse;
 *   · senão, há URL no clipboard (detectPatterns, sem aviso)? → lê (o iOS pergunta "Permitir colar?"),
 *     confere se é o link da Porta e resgata.
 * Entrou → /home (o gate mostra o paywall do teste; nunca a welcome nem o funil). O código era da Porta
 * mas não deu → /entrar (ela tem conta). Nada da Porta → a welcome, como sempre.
 */
export function PortaPrimeiraAbertura({ semPorta }: { semPorta: string }) {
  const [destino, setDestino] = useState<string | null>(() => (precisaOlharClipboard() ? null : semPorta));
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (destino) return;
    let vivo = true;
    void (async () => {
      const [deLink, temUrl] = await Promise.all([codigoDoLinkDeAbertura(), detectarLinkNoClipboard()]);
      let r: ResultadoHandoff | null = null;
      if (deLink) {
        marcarClipboardTentado();
        if (vivo) setEntrando(true);
        r = await resgatarCodigo(deLink, "link");
      } else if (temUrl) {
        r = await resgatarDoClipboard();
      }
      if (!vivo) return;
      if (!r) setDestino(semPorta);
      else if (r.ok) setDestino("/home");
      else setDestino(r.motivo === "assinante_logado" ? semPorta : "/entrar");
    })();
    // só aparece se o resgate demorar (rede): sem link nenhum a decisão sai antes disso
    const t = window.setTimeout(() => { if (vivo) setEntrando(true); }, 700);
    return () => { vivo = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (destino) return <Navigate to={destino} replace />;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="porta-primeira-abertura">
      {entrando && <p className="text-[15px] text-muted-foreground">Entrando na sua conta…</p>}
    </div>
  );
}
