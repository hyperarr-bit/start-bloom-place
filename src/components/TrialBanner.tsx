import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { useUserData } from "@/hooks/use-user-data";
import { PaywallFlow } from "@/components/paywall/PaywallFlow";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { firePixPurchaseOnce, temPixEmConfirmacao } from "@/lib/purchase-tracking";
import { isNativeShell } from "@/lib/native-shell";

/** Tela do intervalo entre pagar e o crédito cair. Não é paywall e não é o
 *  app: é a resposta honesta pra quem acabou de pagar e voltou. Ela some
 *  sozinha quando isSubscribed vira true (use-auth re-checa em foco e a cada
 *  60s), sem a pessoa precisar fazer nada. */
const ConfirmandoPagamento = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[310] bg-white grid place-items-center px-6 text-center"
  >
    <div className="max-w-sm">
      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-5">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
      <h2 className="text-[22px] font-bold tracking-tight mb-2 text-foreground">
        Confirmando seu pagamento…
      </h2>
      <p className="text-[14px] text-muted-foreground leading-relaxed">
        Isso costuma levar menos de 1 minuto. <strong className="text-foreground">Pode deixar
        esta tela aberta</strong> — seu acesso libera sozinho aqui.
      </p>
      <p className="text-[12.5px] text-muted-foreground leading-snug mt-4">
        📩 Se preferir fechar, tudo bem: o acesso e o passo a passo também chegam no seu e-mail.
      </p>
    </div>
  </motion.div>
);

export const TrialBanner = () => {
  const { user, trialExpired, noTrial, isSubscribed, subLoaded, trialDay, trialHoursLeft } = useAuth();
  const { get, loaded } = useUserData();
  const navigate = useNavigate();
  const location = useLocation();
  const suppressOnRoute =
    location.pathname.startsWith("/planos") ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/update-password") ||
    location.pathname.startsWith("/admin") ||
    // O funil tem o PRÓPRIO paywall (passo offer). Sem isso, a conta
    // recém-criada (sem trial) ganhava DOIS paywalls empilhados no /comecar:
    // o do funil + este gate por cima — eventos duplicados, voltar bugado.
    location.pathname.startsWith("/comecar") ||
    // /inicio é o MESMO funil (vitrine, 96% do tráfego) — fora da lista, o
    // gate montava um 2º paywall POR CIMA do paywall do funil pós-cadastro
    // (15/07: todos os checkouts-fantasma "tela branca ao pagar" eram isso).
    location.pathname.startsWith("/inicio") ||
    // /entrar (login do e-mail pós-compra) e /acesso (gate do TikTok): o
    // paywall por cima delas quebra o propósito da página.
    location.pathname.startsWith("/entrar") ||
    location.pathname.startsWith("/acesso") ||
    // /plano é o funil v3 (20/07) — paywall próprio, mesma regra do /comecar
    location.pathname.startsWith("/plano") ||
    location.pathname.startsWith("/preview");

  // "Já passou pelo tutorial?" — a régua era spotlight-done-financas, cravada
  // no pivô "só finanças" (12/07, revertido). Quem faz o tutorial em Treino ou
  // Rotina nunca marcava essa chave, então o banner de trial não aparecia
  // NUNCA pra essa pessoa (linha 128 devolve null). A régua certa é a bandeira
  // que o próprio tutorial grava ao terminar; a chave antiga fica no OU pra
  // não recomeçar a cobrança de quem já concluiu antes desta correção.
  const tutorialDone =
    loaded &&
    (get<string>("core-onboarding-done", "") === "true" ||
      get<string>("spotlight-done-financas", "") === "true");
  const viewedRef = useRef<string | null>(null);

  // Rescue do Purchase: quem paga o Pix sai do app pra abrir o banco e volta
  // já liberado (webhook gravou a assinatura) — a tela de confirmação não
  // aparece, então o pixel não disparava. Aqui, ao virar assinante com uma
  // intenção de Pix pendente, o Purchase (Meta+Google) sai mesmo assim.
  useEffect(() => {
    if (subLoaded && isSubscribed) firePixPurchaseOnce("rescue");
  }, [subLoaded, isSubscribed]);

  // Janela de confirmação: reavalia a cada 5s pra a tela cair sozinha no
  // paywall quando os 12 minutos passarem sem crédito.
  const [aguardandoPix, setAguardandoPix] = useState(() => temPixEmConfirmacao());
  useEffect(() => {
    if (!aguardandoPix) return;
    const t = setInterval(() => setAguardandoPix(temPixEmConfirmacao()), 5000);
    return () => clearInterval(t);
  }, [aguardandoPix]);
  useEffect(() => {
    if (aguardandoPix && !isSubscribed && subLoaded && user) {
      trackEvent("pix_confirmando_view", {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aguardandoPix]);

  useEffect(() => {
    // Antes da 1ª resposta do check-subscription o status é DESCONHECIDO —
    // sem isso, assinante pago via "Trial • 1d restante" piscando a cada
    // navegação (e a analytics registrava trial_banner_view fantasma).
    if (!subLoaded || !user || isSubscribed) return;
    if (!trialExpired && !tutorialDone) return;
    const key = noTrial ? "no_trial" : trialExpired ? "expired" : `mini-${trialDay}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    trackEvent(
      trialExpired ? "paywall_view" : "trial_banner_view",
      { phase: noTrial ? "no_trial" : trialExpired ? "expired" : "mini", trial_day: trialDay },
      { trialDay },
    );
  }, [subLoaded, user, isSubscribed, trialDay, trialExpired, noTrial, tutorialDone]);

  const goToPlanos = (cta: string) => {
    trackEvent("trial_banner_click", { phase: noTrial ? "no_trial" : trialExpired ? "expired" : "mini", trial_day: trialDay, cta }, { trialDay });
    navigate("/planos");
  };

  if (!subLoaded || isSubscribed || !user) return null;
  if (suppressOnRoute) return null;

  /* PAGOU AGORA E O CRÉDITO NÃO CHEGOU (04/08).
   *
   * O portão só conhecia dois estados — assinante ou não — e o terceiro é
   * frequente: acabou de pagar, confirmação a caminho. Medição de 04/08: 9 de
   * 21 pagantes (43%) viram este paywall DEPOIS de pagar, porque voltaram pro
   * app dentro da janela de crédito (mediana 54s, p90 3,4min). Duas delas
   * abriram chamado achando que tinham perdido o dinheiro — uma mandou print
   * do paywall.
   *
   * Enquanto houver Pix gerado há menos de 12 minutos, a tela diz "estamos
   * confirmando" em vez de "assine". O use-auth já re-checa a cada 60s e em
   * todo retorno de foco; quando o crédito cai, isSubscribed vira true e o
   * componente inteiro some sozinho. Passados os 12min é abandono real e o
   * paywall volta — sem esconder oferta de quem não pagou. */
  if (aguardandoPix) return <ConfirmandoPagamento />;

  // Conta pós-paywall (sem trial): paywall completo estilo Cal AI,
  // autocontido (planos + checkout + roleta/downsell), sem sair da tela.
  // z-[310]: acima dos tutoriais (QuickStart z-100, Spotlight z-200/300) —
  // com z-50, fechar o PixCheckout revelava o card de tutorial POR CIMA do
  // paywall pra conta não-pagante. Abaixo só do próprio PixCheckout (400).
  if (noTrial) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[310] overflow-y-auto bg-white"
      >
        {/* Boundary: crash/chunk velho aqui era TELA BRANCA na hora de pagar */}
        <RouteErrorBoundary routeName="paywall-gate">
          <PaywallFlow context="app" />
        </RouteErrorBoundary>
      </motion.div>
    );
  }

  // Trial expirado (contas antigas) — blocking screen (mantido)
  if (trialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[310] bg-background flex items-center justify-center px-4"
      >
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            {/* No app o trial não é de 7 dias (assinatura da Play tem 3, e conta
                  pós-paywall não tem nenhum) — prometer 7 lá é contradição que
                  o revisor do Play lê como propaganda enganosa (25/07). */}
              <h2 className="text-2xl font-bold">
                {isNativeShell() ? "Seu período de teste terminou" : "Seu trial de 7 dias terminou"}
              </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Continue de onde parou com acesso completo ao CORE.
            </p>
          </div>
          <Button className="w-full h-12 text-base font-semibold" onClick={() => goToPlanos("expired")}>
            Ver planos
          </Button>
        </div>
      </motion.div>
    );
  }

  // Mini barrinha — só após tutorial concluído
  if (!tutorialDone) return null;

  const daysLeft = Math.max(0, Math.ceil(trialHoursLeft / 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-primary/5 border-b border-primary/20"
    >
      <div className="max-w-5xl mx-auto px-3 py-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Trial • <strong className="text-foreground">{daysLeft}d</strong> {daysLeft === 1 ? "restante" : "restantes"}
        </span>
        <button
          onClick={() => goToPlanos("mini")}
          className="text-[11px] font-medium text-primary hover:underline px-2 py-0.5 rounded"
        >
          Assinar
        </button>
      </div>
    </motion.div>
  );
};
