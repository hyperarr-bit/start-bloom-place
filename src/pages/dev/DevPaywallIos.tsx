import type { CSSProperties } from "react";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import type { AreaKey } from "@/lib/funnel";

/**
 * /dev/paywall-ios — SÓ NO SERVIDOR DE DESENVOLVIMENTO (some do build). O
 * paywall do iPhone sozinho, pra fotografar os dois braços do teste de preço
 * sem passar pelo funil inteiro. Precisa do servidor com a loja simulada e a
 * chave do iPhone (`VITE_REVENUECAT_IOS_KEY=appl_mock RC_MOCK=1 npx vite`) e de
 * `window.Capacitor` = iOS injetado antes da página (Playwright addInitScript).
 *   ?oferta=anual_69  → localStorage.__rc_mock_offering = "anual_69" (braço B, R$ 69,90)
 *   ?area=dinheiro|rotina|corpo|saude|metas
 *   ?ofertas-saida=curto,…   → chaves das ofertas de saída (lib/ofertas-saida)
 *   ?paywall-minimalista=on|off|auto → o paywall minimalista (17/10, lib/paywall-minimalista)
 *   ?moldura=gate     → a moldura do gate do TrialBanner (conta logada sem assinatura, modo="gate")
 * 16/10: a moldura é a MESMA do passo "offer" do funil (px-5 pt-4, coluna cheia) — o herói do
 * curto sangra com -mx-5/-mt-4. 17/10: com o tema claro FORÇADO do funil (LIGHT_VARS + tema-claro),
 * pra o print com o app no escuro mostrar o que o funil mostra; o gate não força (é o TrialBanner).
 */
const LIGHT_VARS = {
  "--background": "0 0% 100%", "--foreground": "0 0% 15%", "--card": "0 0% 100%", "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%", "--primary-foreground": "0 0% 100%", "--secondary": "40 20% 96%", "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%", "--muted-foreground": "0 0% 45%", "--accent": "330 65% 50%", "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%", "--input": "0 0% 90%", "--ring": "0 0% 20%",
} as CSSProperties;

export default function DevPaywallIos() {
  const q = new URLSearchParams(window.location.search);
  const oferta = q.get("oferta");
  try {
    if (oferta) localStorage.setItem("__rc_mock_offering", oferta);
    else localStorage.removeItem("__rc_mock_offering");
  } catch { /* noop */ }
  const area = (q.get("area") ?? "dinheiro") as AreaKey;
  if (q.get("moldura") === "gate") {
    // a mesma moldura do TrialBanner (gateCurto): bg-white, sem as variáveis claras forçadas
    return (
      <div
        className="flex flex-col px-5 bg-white min-h-[100dvh]"
        style={{ paddingTop: "calc(var(--app-safe-top, 0px) + 1rem)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <PaywallIOS modo="gate" area={area} answers={{}} onPagoSemConta={() => { /* nada: é só pra olhar */ }} />
      </div>
    );
  }
  return (
    <div style={{ ...LIGHT_VARS, background: "#ffffff" }} className="tema-claro min-h-[calc(100dvh-var(--app-safe-top,0px))] text-foreground flex flex-col">
      <div className="flex flex-col px-5 pt-4 pb-7 min-h-[calc(100dvh-var(--app-safe-top,0px))]">
        <div className="w-full flex-1 flex flex-col">
          <PaywallIOS area={area} answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={() => { /* nada: é só pra olhar */ }} />
        </div>
      </div>
    </div>
  );
}
