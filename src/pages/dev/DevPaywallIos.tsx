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
 * 16/10: a moldura é a MESMA do passo "offer" do funil (px-5 pt-4, coluna cheia) — o herói do
 * curto sangra com -mx-5/-mt-4.
 */
export default function DevPaywallIos() {
  const q = new URLSearchParams(window.location.search);
  const oferta = q.get("oferta");
  try {
    if (oferta) localStorage.setItem("__rc_mock_offering", oferta);
    else localStorage.removeItem("__rc_mock_offering");
  } catch { /* noop */ }
  const area = (q.get("area") ?? "dinheiro") as AreaKey;
  return (
    <div className="flex flex-col px-5 pt-4 pb-7 bg-background min-h-[100dvh]">
      <PaywallIOS area={area} answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={() => { /* nada: é só pra olhar */ }} />
    </div>
  );
}
