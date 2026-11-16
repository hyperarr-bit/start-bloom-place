import { useEffect, useState } from "react";
import { EVENTO_PAYWALL_TESTE, guardarForcaPaywallTeste, ofertaDoPaywall, paywallComTeste, visualDoPaywall, type OfertaPaywall, type VisualPaywall } from "@/lib/paywall-teste";

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

/**
 * 12/11 noite: o braço do A/B do visual do paywall sem teste (só iPhone; Android = "android"). `ativo` false = nem
 * sorteia (quem não vai ver o paywall sem teste não ganha braço gravado). Relido quando a metadata do RevenueCat chega.
 */
export function usePaywallVisual(ativo = true): VisualPaywall {
  const [visual, setVisual] = useState<VisualPaywall>(() => (ativo ? visualDoPaywall() : "android"));
  useEffect(() => {
    if (!ativo) return;
    const aoMudar = () => setVisual(visualDoPaywall());
    window.addEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
    aoMudar();
    return () => window.removeEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
  }, [ativo]);
  return visual;
}

/**
 * 12/11 (dono): o braço do A/B da OFERTA do paywall sem teste (só iPhone; fora dele = "anual"). `ativo` false = nem
 * sorteia (quem não vai ver o paywall sem teste não ganha braço gravado). Relido quando a metadata do RevenueCat chega
 * — é assim que `paywall_oferta` = "anual"/"vitalicio" põe o vencedor em 100% sem build.
 */
export function usePaywallOferta(ativo = true): OfertaPaywall {
  const [oferta, setOferta] = useState<OfertaPaywall>(() => (ativo ? ofertaDoPaywall() : "anual"));
  useEffect(() => {
    if (!ativo) return;
    const aoMudar = () => setOferta(ofertaDoPaywall());
    window.addEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
    aoMudar();
    return () => window.removeEventListener(EVENTO_PAYWALL_TESTE, aoMudar);
  }, [ativo]);
  return oferta;
}
