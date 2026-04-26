import { WinbackFlow } from "@/components/retention/WinbackFlow";
import { useWinbackTrigger } from "@/hooks/use-winback-trigger";

/**
 * Mounts the WinbackFlow on any route that includes <TrialBanner />.
 * This catches the case where the user clicks "Assinar" → goes to AbacatePay
 * → comes back directly to /, /financas, etc. (not /planos).
 * The hook auto-fires when ?canceled=true or recent intent is detected.
 */
export const GlobalWinback = () => {
  const winback = useWinbackTrigger();
  return <WinbackFlow open={winback.open} onClose={winback.close} attemptId={winback.attemptId} />;
};
