import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, ShieldCheck, Loader2, CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { initRevenueCat, restaurar } from "@/lib/revenuecat";
import { AppPurchaseSheet } from "@/components/app/AppPurchaseSheet";
import { estadoTeste } from "@/lib/teste-gratis";

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

/** Deep link de assinaturas da Play precisa do id do pacote. */
const PACOTE_ANDROID = "br.com.coreaplicativo.app";

const NOME_DO_PLANO: Record<string, string> = {
  monthly: "Plano mensal",
  // Downsell do Pix: 30 dias avulsos, sem renovação automática. Precisa de
  // nome e de linha própria — chamado de "mensal" ele herdava o texto
  // "renova automaticamente", e a pessoa perderia o acesso justamente no
  // dia em que o app prometeu que ia renovar sozinho.
  monthly_prepaid: "1 mês de acesso (Pix)",
  annual: "Plano anual",
  lifetime: "Acesso vitalício",
};

const PlanosApp = () => {
  const navigate = useNavigate();
  const { user, isSubscribed, subLoaded, billingPeriod, subscriptionEnd, paymentMethod, inGracePeriod } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /* TESTE GRÁTIS DE 3 DIAS (v53): esta tela não sabia que ele existe — quem
     estava testando abria "Meu acesso" e lia "Sua vida inteira organizada",
     como se não tivesse nada, com um botão que vendia VITALÍCIO. Agora o
     teste tem estado próprio aqui: dia, horas restantes e a assinatura. */
  const teste = estadoTeste();

  const nomeDoPlano = NOME_DO_PLANO[billingPeriod ?? ""] ?? "Todos os 16 módulos liberados";
  const prePago = billingPeriod === "monthly_prepaid";
  // Só assinatura RECORRENTE ganha o texto de renovação e o link de
  // gerenciar/cancelar: no pré-pago não há o que cancelar (ele acaba sozinho).
  const ehAssinaturaDaLoja = paymentMethod === "play_store" && !prePago;
  const vitalicio = billingPeriod === "lifetime";

  // Data por extenso: "12 de agosto de 2027" lê melhor que 12/08/2027 numa
  // frase. Vitalício não tem renovação — dizer "renova em 2099" seria mentira
  // de interface.
  const linhaRenovacao = (() => {
    if (vitalicio) return "Acesso permanente nesta conta — não expira e não renova.";
    if (!subscriptionEnd) return null;
    const d = new Date(subscriptionEnd);
    if (Number.isNaN(d.getTime())) return null;
    const quando = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    if (inGracePeriod) return `Pagamento pendente. O acesso segue até ${quando}.`;
    if (prePago) return `Vale até ${quando}. NÃO renova sozinho — quando chegar a data, é só pagar outro mês se quiser.`;
    return ehAssinaturaDaLoja
      ? `Renova automaticamente em ${quando}. Você pode cancelar antes disso.`
      : `Seu acesso vai até ${quando}.`;
  })();

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
        {/* `subLoaded` só vira true depois do check-subscription, que exige
            SESSÃO (use-auth: sem usuário ele volta pra false). Com o teste
            grátis da v53 o convidado usa o app sem conta — e esta tela ficava
            eternamente no estado de carregando pra ele, sem nada na área
            central. Sem usuário não há assinatura a esperar: segue direto. */}
        {user && !subLoaded ? (
          <div className="py-16 grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isSubscribed ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Antes esta tela era um ✓, uma frase e um botão — 444px de branco
                medidos na varredura. Quem paga quer saber O QUE tem, QUAL plano
                e QUANDO renova; e a loja exige um caminho claro pra gerenciar. */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Check className="w-6 h-6" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight leading-tight">Seu acesso está ativo</h2>
                  <p className="text-[13px] text-muted-foreground">{nomeDoPlano}</p>
                </div>
              </div>

              {linhaRenovacao && (
                <div className="flex items-start gap-2.5 rounded-xl bg-background/70 px-3.5 py-3">
                  <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-snug">{linhaRenovacao}</p>
                </div>
              )}

              <Button size="lg" className="w-full h-12" onClick={() => navigate("/")}>
                Voltar pro app
              </Button>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                O que está liberado
              </h3>
              <ul className="space-y-2.5">
                {BENEFICIOS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cancelamento é da Play, não do app — o Google não permite que o
                app processe. O que se pode (e deve) fazer é levar até lá. */}
            {ehAssinaturaDaLoja && (
              <a
                href={`https://play.google.com/store/account/subscriptions?package=${PACOTE_ANDROID}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackEvent("app_gerenciar_assinatura", { billing: billingPeriod })}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-sm font-semibold"
              >
                <span className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  Gerenciar ou cancelar assinatura
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">Play Store</span>
              </a>
            )}
          </motion.div>
        ) : (
          <>
            {/* NO MEIO DO TESTE: o estado é "você TEM acesso, e ele tem prazo".
                Dizer "assine" pra quem está no dia 1 apaga a promessa que a
                porta fez ("3 dias, tudo liberado") e queima confiança. */}
            {teste.fase === "ativo" ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Check className="w-6 h-6" strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight leading-tight">
                      Seu teste está ativo — dia {teste.dia} de 3
                    </h2>
                    <p className="text-[13px] text-muted-foreground">Todos os 16 módulos liberados</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-background/70 px-3.5 py-3">
                  <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-snug">
                    {teste.horasRestantes <= 24
                      ? `Termina em ${teste.horasRestantes}h. Depois disso, o que você montou fica te esperando com a assinatura.`
                      : `Faltam ${Math.ceil(teste.horasRestantes / 24)} dias. Sem cartão cadastrado — nada é cobrado automaticamente.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30">
                  <Crown className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {teste.fase === "expirado" ? "Seu teste terminou" : "Sua vida inteira organizada"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {teste.fase === "expirado"
                    ? "Tudo que você montou nos 3 dias continua salvo — a assinatura destrava de novo."
                    : "Um app só pro dinheiro, a rotina, o corpo e as metas — sem planilha, sem cinco apps."}
                </p>
              </div>
            )}

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
                onClick={() => { trackEvent("planos_cta_app", { teste: teste.fase }); setSheetOpen(true); }}
              >
                {teste.fase === "ativo" ? "Garantir meu CORE" : "Ver planos"}
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
          {/* VERSÃO VISÍVEL (29/07). O app não mostrava a versão em lugar
              nenhum, e isso custou caro: o dono testou o login com Google,
              disse que ainda ia pro site, e ninguém sabia se era o conserto
              que falhou ou se o aparelho estava com um build de cinco dias
              atrás. Primeira pergunta de qualquer suporte, e não tínhamos
              resposta. Vem do build (__APP_VERSION__), não escrito à mão. */}
          <p className="text-[10px] text-muted-foreground/60 tabular-nums pt-1">
            versão {__APP_VERSION__}
          </p>
        </div>
      </main>
    </div>
  );
};

export default PlanosApp;
