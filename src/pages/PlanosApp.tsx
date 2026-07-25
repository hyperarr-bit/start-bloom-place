import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";
import { AppPurchaseSheet } from "@/components/app/AppPurchaseSheet";

/**
 * "MEU ACESSO" DO APP — a /planos do shell nativo (24/07).
 *
 * Por que existe: a /planos web vende o VITALÍCIO no Pix ("CORE VITALÍCIO ·
 * R$ 27,90 · Gerar meu Pix"). Dentro do binário da loja isso é pagamento
 * externo pra conteúdo digital — a violação exata que tirou o Cal AI do ar.
 * O app não pode nem MENCIONAR preço/forma de pagamento fora do Play Billing.
 *
 * O que esta tela faz, então: mostra o ESTADO do acesso (sem preço, sem Pix)
 * e, pra quem não tem, chama o AppPurchaseSheet — que transaciona pelo
 * RevenueCat/Play com preço total, renovação explícita e Restaurar compras.
 *
 * Quem paga vitalício na WEB e loga no app cai no ramo "ativo": a gente
 * informa que o acesso está liberado, sem dizer como foi comprado (descrever
 * um direito que a conta já tem é permitido; oferecer a compra não é).
 */
const BENEFICIOS = [
  "Finanças, contas a vencer e metas num painel só",
  "Rotina, hábitos e hiperfoco pra cumprir o plano",
  "Treino, dieta e saúde acompanhados de perto",
  "Casa, viagens, estudos, carreira — 16 módulos",
];

const PlanosApp = () => {
  const navigate = useNavigate();
  const { isSubscribed, subLoaded } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("planos_view", { source: "app" });
    // Aquece o RevenueCat: se a pessoa tocar em "Ver planos", o sheet já
    // abre com as offerings carregadas em vez de piscar o botão desligado.
    initRevenueCat();
  }, []);

  const voltar = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };

  // Botão obrigatório de loja: quem trocou de aparelho (ou reinstalou)
  // recupera a assinatura sem falar com o suporte.
  const tentarRestaurar = async () => {
    setRestaurando(true);
    trackEvent("app_restore_planos", {});
    const ok = await restaurar();
    setRestaurando(false);
    if (ok) { window.location.href = "/"; return; }
    setMsg("Nenhuma assinatura encontrada nesta conta Google.");
  };

  return (
    <div className="min-h-dvh bg-background">
      {sheetOpen && <AppPurchaseSheet onClose={() => setSheetOpen(false)} />}

      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={voltar} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Meu acesso</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-7">
        {!subLoaded ? (
          <div className="py-16 grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isSubscribed ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto">
              <Check className="w-7 h-7" strokeWidth={3} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Seu acesso está ativo</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todos os 16 módulos liberados nesta conta. É só usar.
            </p>
            <Button size="lg" className="w-full h-12" onClick={() => navigate("/")}>
              Voltar pro app
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30">
                <Crown className="w-7 h-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Sua vida inteira organizada</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Um app só pro dinheiro, a rotina, o corpo e as metas — sem planilha, sem cinco apps.
              </p>
            </div>

            <ul className="space-y-2.5">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full h-13 min-h-[52px] rounded-full text-base font-bold"
                onClick={() => { trackEvent("planos_cta_app", {}); setSheetOpen(true); }}
              >
                Ver planos
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5" /> Cancele quando quiser, direto na Play Store
              </p>
            </div>
          </>
        )}

        <div className="pt-2 text-center space-y-2">
          <button
            onClick={tentarRestaurar}
            disabled={restaurando}
            className="text-[12px] font-semibold text-muted-foreground disabled:opacity-50"
          >
            {restaurando ? "Restaurando…" : "Restaurar compras"}
          </button>
          {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
          <p className="text-[11px] text-muted-foreground">
            <a href="/privacidade" className="underline underline-offset-2">Política de privacidade</a>
            {" · "}
            <a href="/termos" className="underline underline-offset-2">Termos de uso</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default PlanosApp;
