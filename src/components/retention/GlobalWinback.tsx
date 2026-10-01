import { WinbackFlow } from "@/components/retention/WinbackFlow";
import { useWinbackTrigger } from "@/hooks/use-winback-trigger";
import { isNativeShell } from "@/lib/native-shell";
import { VENDA_NA_WEB } from "@/lib/rotas-web";

/**
 * Mounts the WinbackFlow on any route that includes <TrialBanner />.
 * This catches the case where the user clicks "Assinar" → goes to AbacatePay
 * → comes back directly to /, /financas, etc. (not /planos).
 * The hook auto-fires when ?canceled=true or recent intent is detected.
 *
 * NUNCA no app das lojas (trava de 25/07): o WinbackFlow é roleta de desconto
 * + oferta de VITALÍCIO por Pix ("GARANTIR VITALÍCIO POR R$ 14,90"). Isso é
 * pagamento externo pra conteúdo digital — a violação exata que tira app do
 * ar. E o gatilho é fácil de acontecer sem querer: basta `?canceled=true` na
 * URL com o trial vencido, e qualquer conta web antiga que logue no app está
 * com o trial vencido. Como este componente é montado GLOBAL no App.tsx, a
 * trava tem que morar aqui, antes do hook.
 */
export const GlobalWinback = () => {
  if (isNativeShell()) return null;
  // 01/10: venda na web desligada (ver src/lib/rotas-web.ts) — a roleta é
  // oferta de Pix, então não monta. Rollback = VENDA_NA_WEB true.
  if (!VENDA_NA_WEB) return null;
  return <WinbackNaWeb />;
};

// Componente separado porque o hook não pode rodar condicionalmente.
const WinbackNaWeb = () => {
  const winback = useWinbackTrigger();
  return <WinbackFlow open={winback.open} onClose={winback.close} attemptId={winback.attemptId} />;
};
