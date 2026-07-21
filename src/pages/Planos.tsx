import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  Wallet,
  Target,
  ShieldCheck,
  CalendarCheck,
  Dumbbell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PaymentStatus } from "@/components/PaymentStatus";
import { PixCheckout } from "@/components/paywall/PixCheckout";
import { CancelFlowDialog } from "@/components/retention/CancelFlowDialog";
import { useWinbackTrigger } from "@/hooks/use-winback-trigger";

// A assinatura é o app COMPLETO (16 módulos) — a página de assinatura tem
// que vender o mesmo produto que o paywall promete ("16/16 inclusos").
const MODULE_GROUPS: Array<{
  icon: typeof Wallet;
  title: string;
  items: string[];
}> = [
  {
    icon: Wallet,
    title: "💰 Dinheiro",
    items: [
      "Finanças completas com calendário Meu Mês",
      "Investimentos, dívidas e limites",
      "Relatórios e saúde financeira com score",
    ],
  },
  {
    icon: CalendarCheck,
    title: "📅 Rotina e produtividade",
    items: [
      "Hábitos, agenda e rituais de manhã/noite",
      "Hiperfoco e sessões de estudo",
      "Carreira e biblioteca de leituras",
    ],
  },
  {
    icon: Dumbbell,
    title: "💪 Corpo e saúde",
    items: [
      "Treino com fichas prontas",
      "Dieta, saúde e autocuidado",
      "Beleza e detox das telas",
    ],
  },
  {
    icon: Target,
    title: "🎯 Metas e vida",
    items: [
      "Metas e evolução pessoal",
      "Casa, viagens, pet e relacionamentos",
      "Conquistas e sequências (streaks)",
    ],
  },
];

/** Tela pós-checkout (?success=true — URL de retorno configurada na Cakto).
 *  Antes o param era IGNORADO: quem pagava voltava pra página de PREÇOS sem
 *  nenhuma confirmação — e se o webhook atrasasse, via os botões de assinar
 *  de novo. Caso real de 12/07: pagante concluiu "problema técnico" e
 *  cancelou a renovação 14min depois de pagar. Esta tela confirma no
 *  servidor (com polling, o webhook pode levar segundos) e celebra. */
function PaymentSuccess() {
  const { isSubscribed } = useAuth();
  const [status, setStatus] = useState<"checking" | "confirmed" | "waiting">("checking");
  const [round, setRound] = useState(0);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    trackEvent("purchase_success_view", {});
  }, []);

  useEffect(() => {
    if (doneRef.current) return;
    let stopped = false;
    const confirm = () => {
      if (stopped || doneRef.current) return;
      doneRef.current = true;
      // Marcador de checkout morre aqui: sem ele, o resgate do paywall não
      // tem como abrir roleta fantasma pra quem acabou de pagar.
      try { localStorage.removeItem("core_checkout_pending"); } catch { /* noop */ }
      trackEvent("purchase_success_confirmed", { secs: Math.round((Date.now() - startRef.current) / 1000) });
      setStatus("confirmed");
    };
    if (isSubscribed) { confirm(); return; }
    const tick = async (attempt: number) => {
      if (stopped || doneRef.current) return;
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.subscribed) { confirm(); return; }
      } catch { /* rede/função indisponível: tenta de novo */ }
      if (stopped || doneRef.current) return;
      if (attempt >= 14) {
        // ~45s sem confirmação: Pix pode levar 1-2min. Sê honesto, não trava.
        trackEvent("purchase_success_timeout", {});
        setStatus("waiting");
        return;
      }
      setTimeout(() => tick(attempt + 1), 3000);
    };
    tick(0);
    return () => { stopped = true; };
  }, [isSubscribed, round]);

  // Hard navigation de propósito: recarrega o app com o estado de assinatura
  // fresco (evita o gate de trial piscar pra quem acabou de pagar).
  const enterApp = () => { window.location.href = "/"; };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
      {status === "checking" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-5" />
          <h1 className="text-xl font-bold tracking-tight mb-2">Confirmando seu pagamento…</h1>
          <p className="text-sm text-muted-foreground">Leva só alguns segundos. Não fecha essa tela.</p>
        </motion.div>
      )}
      {status === "confirmed" && (
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-6"
          >
            <Check className="w-10 h-10" strokeWidth={3} />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Pagamento confirmado 🎉</h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
            Seu CORE está liberado — todos os módulos, tudo teu.<br />Bora montar sua vida organizada?
          </p>
          <Button size="lg" className="w-full h-12 text-base" onClick={enterApp}>
            Entrar no app
          </Button>
          <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Garantia de 7 dias · cancele quando quiser
          </p>
        </motion.div>
      )}
      {status === "waiting" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted grid place-items-center mx-auto mb-5">
            <Crown className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight mb-2">Pagamento em processamento</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Pix e cartão podem levar 1–2 minutos pra compensar. Assim que cair, seu acesso
            libera sozinho — pode deixar essa tela aberta ou voltar depois.
          </p>
          <Button size="lg" variant="outline" className="w-full h-11 mb-3"
            onClick={() => { setStatus("checking"); setRound((r) => r + 1); }}>
            Já paguei — verificar de novo
          </Button>
          <button onClick={enterApp} className="text-sm text-muted-foreground underline underline-offset-2">
            Entrar no app mesmo assim
          </button>
        </motion.div>
      )}
    </div>
  );
}

const Planos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSubscribed, user, subLoaded } = useAuth();
  const [loading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const winback = useWinbackTrigger();
  // Retorno do checkout da Cakto (?success=true): tela de confirmação, não
  // a página de preços.
  const paymentReturn = searchParams.get("success") === "true";

  useEffect(() => {
    if (paymentReturn) return; // não conta como visita à página de planos
    trackEvent("planos_view", { source: searchParams.get("from") ?? "direct" });
  }, []);

  const shouldOfferWinback = !!user && !isSubscribed;

  const exitToPrevious = useCallback(() => {
    if (shouldOfferWinback) winback.markIntent();
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate, shouldOfferWinback, winback]);

  useEffect(() => {
    if (!shouldOfferWinback) return;
    const onPopState = () => winback.markIntent();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [shouldOfferWinback, winback]);

  const handleBack = useCallback(() => exitToPrevious(), [exitToPrevious]);

  // VITALÍCIO (13/07): pagamento único no Pix, dentro do app (PixCheckout).
  const [pixOpen, setPixOpen] = useState(false);
  // ?oferta=ds (20/07): última chamada do e-mail de recuperação (h24) com o
  // vitalício de R$ 14,90 — mesmo prêmio da roleta do paywall. Fricção zero:
  // o clique do e-mail cai DIRETO no QR, sem passar pela página de preços.
  // ESPERA o subLoaded: no mount isSubscribed ainda é false até o check async
  // responder — sem isso, assinante via link recebia QR de cobrança (corrida
  // pega pelo teste de guarda em 20/07).
  const querDs = searchParams.get("oferta") === "ds";
  const ofertaDs = querDs && !isSubscribed;
  const dsJaAbriu = useRef(false);
  useEffect(() => {
    if (!querDs || !subLoaded || isSubscribed || dsJaAbriu.current) return;
    dsJaAbriu.current = true;
    trackEvent("planos_ds_email_open");
    setPixOpen(true);
  }, [querDs, subLoaded, isSubscribed]);
  // Assinante lifetime não tem o que cancelar (nada renova) — esconde o botão.
  const [isLifetime, setIsLifetime] = useState(false);
  useEffect(() => {
    if (!isSubscribed || !user) return;
    // .limit(1) + order: contas antigas podem ter MAIS de uma linha (maybeSingle
    // com 2+ linhas devolve erro e o vitalício não era detectado).
    supabase.from("subscriptions").select("billing_period, plan")
      .eq("user_id", user.id).order("current_period_end", { ascending: false }).limit(1)
      .then(({ data }) => {
        const s = data?.[0];
        if (s?.billing_period === "lifetime" || s?.plan === "lifetime" || s?.plan === "premium") setIsLifetime(true);
      });
  }, [isSubscribed, user]);

  const handleCheckout = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      navigate("/auth");
      return;
    }
    winback.markIntent();
    setPixOpen(true);
  };

  if (paymentReturn) return <PaymentSuccess />;

  return (
    <div className="min-h-screen bg-background">
      {pixOpen && <PixCheckout offer={ofertaDs ? "downsell" : "lifetime"} context="app" onClose={() => setPixOpen(false)} />}
      <PaymentStatus />

      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Escolha seu plano</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-8 pb-32 sm:pb-10">
        {isSubscribed && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-primary">
              {isLifetime ? "Seu acesso ao CORE é VITALÍCIO 🎉 — nada a pagar, nunca." : "Você já é assinante CORE PRO"}
            </p>
            {!isLifetime && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelOpen(true)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Cancelar assinatura
              </Button>
            )}
          </div>
        )}
        <CancelFlowDialog open={cancelOpen} onOpenChange={setCancelOpen} />

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30">
            <Crown className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Seu dinheiro, finalmente sob controle
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Gastos, contas a vencer, metas, investimentos e sua saúde financeira — num painel só.
          </p>
        </div>

        {/* Plan card — VITALÍCIO, pagamento único no Pix */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border-2 border-primary/30 bg-card p-6 sm:p-8 space-y-5 shadow-xl shadow-primary/10 overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">CORE VITALÍCIO</h3>
                <p className="text-xs text-muted-foreground">Pague 1x. Seu pra sempre.</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-md">
              Pagamento único
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground line-through">
              R$ 99,90
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">R$ 27,90</span>
              <span className="text-muted-foreground">uma vez</span>
            </div>
            <p className="text-xs text-primary font-medium">
              No Pix · todos os 16 módulos · sem mensalidade, nunca
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={loading || isSubscribed}
          >
            {isSubscribed ? "Acesso já liberado" : "Gerar meu Pix de R$ 27,90"}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Garantia de 7 dias · Pix libera na hora · sem fidelidade</span>
          </div>
        </motion.div>

        {/* All modules benefits */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold">O que está incluído</h3>
            <p className="text-xs text-muted-foreground">
              Todos os 16 módulos, sem limites — uma assinatura, sua vida inteira
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {MODULE_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div
                  key={group.title}
                  className="rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm">{group.title}</h4>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky CTA mobile */}
      {!isSubscribed && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="leading-tight">
              <p className="text-[11px] text-muted-foreground">Vitalício</p>
              <p className="text-base font-bold">
                R$ 27,90
                <span className="text-xs font-normal text-muted-foreground"> uma vez</span>
              </p>
            </div>
            <Button onClick={handleCheckout} disabled={loading} className="flex-1 max-w-[60%]">
              Pagar no Pix
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planos;
