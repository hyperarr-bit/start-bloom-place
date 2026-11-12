import { useEffect, useState } from "react";
import { EVENTO_PAYWALL_TESTE, guardarForcaPaywallTeste, paywallComTeste } from "@/lib/paywall-teste";

/**
 * "O paywall do app é o COM teste (o de hoje)?" — lido na hora (força de QA > RevenueCat > última resposta do aparelho >
 * padrão "off") e de novo quando a metadata do RevenueCat chega (`core:paywall-teste`). false = PaywallSemTeste.
 */
export function usePaywallComTeste(): boolean {
  const [comTeste, setComTeste] = useState(() => { guardarForcaPaywallTeste(); return paywallComTeste(); });
  useEffect(() => {
    const aoMudar = () => setComTeste(paywallComTeste());
    window.addEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
    aoMudar();
    return () => window.removeEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
  }, []);
  return comTeste;
}
