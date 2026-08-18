/**
 * A ÚNICA VENDA DE ASSINATURA DO APP (v53.1, 16/08).
 *
 * Nasceu de um bug de dinheiro achado na varredura: depois do pivot pra
 * assinatura, o app tinha TRÊS superfícies de venda e só uma sabia disso.
 *   - funil do teste (ComecarTeste, step offer) → vendia assinatura ✓
 *   - "Meu acesso" (/planos → AppPurchaseSheet) → vendia VITALÍCIO 27,90 ✗
 *   - gate de conta sem assinatura (TrialBanner → PaywallFlow) → 27,90 ✗
 * Duas delas ofereciam um preço que não é mais o do catálogo da Play. Fora
 * a confusão pra quem paga, divergência app × catálogo reprova na análise.
 *
 * Agora as três montam ESTE componente. O que muda por `contexto`:
 *   funil  — sem saída (é o dia 3, a decisão é aqui), recap do que construiu
 *   gate   — sem saída (conta sem acesso), recap do que a conta tem
 *   planos — tem X (a pessoa abriu voluntariamente "Meu acesso")
 *
 * Regras que valem nos três (aprendidas com dinheiro):
 *  - CTA abre a folha do Google DIRETO (tela intermediária matou 57% na v50);
 *  - cancelou a folha → downsell R$19,90/mês pré-pago no Pix, NUNCA exposto
 *    antes (downsell cedo canibaliza o mensal cheio);
 *  - Pix na folha = compra PENDENTE, não erro: a tela explica e espera;
 *  - Restaurar compras + legais sempre visíveis (exigência de loja).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { estadoTeste } from "@/lib/teste-gratis";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { agendarResgateDoPlano, cancelarResgateDoPlano, cancelarReguaDoTeste } from "@/lib/notificacoes";
import { limparGuiaSemente } from "@/lib/teste-gratis";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";

export type ContextoPaywall = "funil" | "gate" | "planos";

/** Recap REAL do que a pessoa construiu (guest storage no teste, conta depois).
 *  Se não fez nada, degrada pra promessa da área — sempre há algo a perder. */
export function useRecap(area: AreaKey | null): string[] {
  const { get } = useUserData();
  const linhas: string[] = [];
  try {
    const dueDays = get<Array<{ bills?: unknown[] }>>("finance-dueDays", []) ?? [];
    const contas = dueDays.reduce((n, d) => n + (Array.isArray(d?.bills) ? d.bills.length : 0), 0);
    if (contas > 0) linhas.push(`${contas} conta${contas > 1 ? "s" : ""} armada${contas > 1 ? "s" : ""} com lembrete`);
    const habitos = get<string[]>("rotina-habits", []) ?? [];
    if (habitos.length > 0) linhas.push(`${habitos.length} hábito${habitos.length > 1 ? "s" : ""} no painel`);
    const metas = get<unknown[]>("goals-board-v2", []) ?? [];
    if (metas.length > 0) linhas.push(`${metas.length} meta${metas.length > 1 ? "s" : ""} saindo do papel`);
    const treinos = get<unknown[]>("saude-workouts-v2", []) ?? [];
    if (Array.isArray(treinos) && treinos.length > 0) linhas.push("Plano de treino montado");
  } catch { /* recap nunca derruba o paywall */ }
  if (linhas.length === 0) {
    linhas.push(area ? `Seu painel de ${AREAS[area].nome} te esperando` : "Seu painel te esperando do jeito que você deixou");
  }
  return linhas.slice(0, 3);
}

export function PaywallAssinatura({
  contexto, area = null, d3 = false, trial = false, onPagoSemConta, onFechar, onEntrar,
}: {
  contexto: ContextoPaywall;
  area?: AreaKey | null;
  d3?: boolean;
  /** 18/08 (decisão do dono): teste SÓ com cartão, estilo Cal AI. O funil
   *  desemboca aqui ANTES de qualquer uso — a folha do anual abre com a
   *  oferta coretrial (3 dias grátis, Play aplica sozinho pra assinante
   *  novo) e a cobrança do dia 3 é automática, cancelável na Play. */
  trial?: boolean;
  onPagoSemConta?: () => void;
  onFechar?: () => void;
  /** Porta pro LOGIN de quem já tem conta (18/08, avaliação 2★ real): a
   *  pagante do vitalício da WEB ficou presa no funil apertando "Restaurar
   *  compras" 25× — restaurar só olha a Play, e o acesso dela vive na conta.
   *  Sem esta porta, todo pagante da web que instala o app fica de fora. */
  onEntrar?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recap = useRecap(area);
  const teste = estadoTeste();
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  const [oferta, setOferta] = useState<"cheia" | "downsell">("cheia");
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelamentos = useRef(0);

  useEffect(() => {
    trackEvent("app_paywall_view", {
      contexto, modo: "assinatura", d3, trial,
      dia: teste.fase === "ativo" ? teste.dia : teste.fase,
    });
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchAssinaturas();
    })();
    // Abandonou a oferta? As 2 notificações de resgate são o único canal de
    // volta pra quem não tem conta (cadastro é pós-compra). No /planos não
    // agenda: a pessoa entrou só pra ver o acesso dela, não é abandono.
    if (contexto !== "planos") void agendarResgateDoPlano(area ? AREAS[area].nome : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pagou = async (fn: () => Promise<boolean>, produto: string) => {
    if (comprando) return;
    setComprando(true);
    setErro(null);
    setPendente(false);
    trackEvent("funnel_click", { cta: "app_paywall_cta", contexto, produto, oferta });
    const rc = await import("@/lib/revenuecat");
    const ok = await fn();
    if (ok) {
      trackEvent("app_sheet_success", { contexto, produto });
      void cancelarResgateDoPlano();
      void cancelarReguaDoTeste();
      limparGuiaSemente();
      // Sem conta = fluxo v48: cadastro DEPOIS do pagamento. Quem chegou aqui
      // pelo /planos ou pelo gate já tem conta — recarrega e o gate abre.
      if (!user && onPagoSemConta) { onPagoSemConta(); return; }
      if (!user) { navigate("/app?step=signup", { replace: true }); return; }
      window.location.href = "/";
      return;
    }
    const motivo = rc.motivoUltimaCompra();
    if (motivo === "pendente") {
      setPendente(true);
    } else if (motivo === "cancelou") {
      cancelamentos.current += 1;
      if (oferta === "cheia" && rc.temMensalPix()) {
        setOferta("downsell");
        trackEvent("app_downsell_view", { plano: "mensal_pix", origem: "cancelou_folha", contexto });
      } else if (cancelamentos.current >= 2) {
        trackEvent("app_resgate_view", { contexto });
      }
    } else if (motivo === "produto_ausente" || motivo === "catalogo") {
      setErro("Atualize o CORE na Play Store pra assinar — esta versão ficou sem o catálogo.");
    } else if (motivo) {
      setErro("O Google não concluiu o pagamento. Tenta de novo em instantes.");
    }
    setComprando(false);
  };

  // O selo de cima conta a verdade do estado da pessoa.
  const selo = (() => {
    if (trial) return "Último passo";
    if (contexto === "planos") return "Escolha seu plano";
    if (d3 || teste.fase === "expirado") return "Seu teste terminou";
    if (teste.fase === "ativo") return `Dia ${teste.dia} do seu teste`;
    return "Seu acesso ao CORE";
  })();
  const titulo = trial
    ? "Destrave seus 3 dias grátis"
    : teste.fase === "nunca" && contexto !== "funil"
    ? "Sua vida inteira organizada"
    : "Seus 3 dias no CORE";

  return (
    <div className="w-full max-w-sm mx-auto pb-6 relative">
      {contexto === "planos" && onFechar && (
        <button
          aria-label="Fechar"
          onClick={() => { trackEvent("app_sheet_close", { via: "x", contexto }); onFechar(); }}
          className="absolute right-0 -top-1 w-8 h-8 rounded-full bg-black/[0.06] grid place-items-center text-muted-foreground"
        >
          <X className="w-4 h-4" strokeWidth={2.25} />
        </button>
      )}

      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider mb-3">
          {selo}
        </div>
        <h2 className="text-[26px] font-bold tracking-tight leading-tight">{titulo}</h2>
      </div>

      {/* O recap é o endowment: primeiro o que ela tem, depois o preço. No
          /planos de quem nunca testou não há o que recapitular — e no gate
          de trial (D0) também não: a pessoa ainda não construiu nada. */}
      {!trial && !(contexto === "planos" && teste.fase === "nunca") && (
        <div className="rounded-2xl border border-border bg-white p-4 mb-4">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
            O que você construiu
          </div>
          {recap.map((r) => (
            <div key={r} className="flex items-center gap-2.5 text-[13.5px] font-semibold py-1">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
                <Check className="w-3 h-3" strokeWidth={3.5} />
              </span>
              {r}
            </div>
          ))}
        </div>
      )}

      {oferta === "downsell" ? (
        <div className="rounded-2xl border-2 border-accent bg-accent/5 p-4 mb-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-accent mb-1">Sem cartão? Sem problema</div>
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold">1 mês de CORE</span>
            <span className="text-[20px] font-extrabold">{APP_PRECOS.mensalPix.preco}</span>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-1.5">
            Paga no <b className="text-foreground">Pix, dentro do Google</b> — vale 30 dias e renova
            <b className="text-foreground"> só se você quiser</b>. Sem assinatura presa no cartão.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-muted-foreground text-center mb-3">
            {trial ? (
              <>
                <b className="text-foreground">3 dias com o app inteiro, de graça.</b>{" "}
                Não curtiu? Cancela na Play antes do dia 3 e não paga nada.
              </>
            ) : (
              <>
                <b className="text-foreground">
                  {teste.fase === "nunca" && contexto !== "funil" ? "Os 16 módulos liberados" : "Tudo isso fica salvo"}
                </b>{" "}
                se você continuar. Escolhe como:
              </>
            )}
          </p>
          <button
            onClick={() => setPlano("anual")}
            className={`w-full text-left rounded-2xl border-2 p-4 mb-2.5 relative transition-colors ${plano === "anual" ? "border-accent bg-accent/5" : "border-border bg-white"}`}
          >
            <span className="absolute -top-2.5 left-4 bg-accent text-white text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide">
              {trial ? "3 DIAS GRÁTIS" : "MAIS ESCOLHIDO"}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-extrabold">Anual</span>
              <span className="text-[19px] font-extrabold">{APP_PRECOS.anual.preco}<small className="text-[11px] font-bold text-muted-foreground">/ano</small></span>
            </div>
            <div className="text-[12px] font-semibold text-muted-foreground mt-0.5">
              {trial
                ? <>primeiros 3 dias grátis · depois = {APP_PRECOS.anual.porMes}/mês</>
                : <>= {APP_PRECOS.anual.porMes}/mês · economiza {APP_PRECOS.anual.economiaAno} no ano</>}
            </div>
          </button>
          <button
            onClick={() => setPlano("mensal")}
            className={`w-full text-left rounded-2xl border-2 p-3.5 mb-4 transition-colors ${plano === "mensal" ? "border-accent bg-accent/5" : "border-border bg-white"}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-bold">Mensal</span>
              <span className="text-[16px] font-extrabold">{APP_PRECOS.mensal.preco}<small className="text-[11px] font-bold text-muted-foreground">/mês</small></span>
            </div>
            <div className="text-[11.5px] font-medium text-muted-foreground mt-0.5">
              {trial ? "começa cobrando hoje — sem os 3 dias grátis" : "cancele quando quiser"}
            </div>
          </button>
        </>
      )}

      {pendente && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-3">
          <b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
          o acesso libera sozinho aqui.
          <button
            className="block w-full text-center font-bold underline underline-offset-2 mt-1.5"
            onClick={async () => {
              const rc = await import("@/lib/revenuecat");
              await rc.restaurar();
              const ok = await rc.sincronizarAssinatura(2);
              if (!ok) return;
              void cancelarResgateDoPlano();
              void cancelarReguaDoTeste();
              limparGuiaSemente();
              if (!user && onPagoSemConta) onPagoSemConta();
              else window.location.href = "/";
            }}
          >
            Já paguei — atualizar
          </button>
        </div>
      )}
      {erro && <p className="text-[12.5px] text-destructive text-center mb-3">{erro}</p>}

      <Button
        size="lg"
        className="w-full min-h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={comprando}
        onClick={async () => {
          const rc = await import("@/lib/revenuecat");
          if (oferta === "downsell") void pagou(() => rc.comprarMensalPix(), APP_PRECOS.mensalPix.id);
          else void pagou(() => rc.comprar(APP_PRECOS[plano].id), APP_PRECOS[plano].id);
        }}
      >
        {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : oferta === "downsell"
          ? <>Pagar 1 mês no Pix <ArrowRight className="w-4 h-4" /></>
          : trial && plano === "anual"
          ? <>Começar meus 3 dias grátis <ArrowRight className="w-4 h-4" /></>
          : <>Continuar com meu CORE <ArrowRight className="w-4 h-4" /></>}
      </Button>
      <p className="text-[10.5px] text-muted-foreground text-center mt-2">
        {oferta === "downsell"
          ? "Pagamento único pelo Google Play · 30 dias de acesso · renovação manual"
          : trial && plano === "anual"
          ? `3 dias grátis, depois ${APP_PRECOS.anual.preco}/ano · cancele na Play quando quiser`
          : "Pagamento pelo Google Play · cancele quando quiser"}
      </p>

      {/* Saída pra quem ainda tem teste rodando: sair daqui não é perder nada. */}
      {teste.fase === "ativo" && !d3 && contexto !== "planos" && (
        <button
          onClick={() => navigate("/home")}
          className="w-full text-center text-[12px] text-muted-foreground underline underline-offset-2 mt-3 py-1"
        >
          Continuar meu teste — decido no dia 3
        </button>
      )}

      {/* Já é cliente (site vitalício, conta antiga)? O acesso vive na CONTA,
          não na Play — "Restaurar compras" não resolve pra essa pessoa. */}
      {!user && contexto === "funil" && (
        <button
          onClick={() => {
            trackEvent("funnel_click", { cta: "paywall_ja_tenho_conta", contexto });
            if (onEntrar) onEntrar();
            else navigate("/app?step=signup");
          }}
          className="w-full text-center text-[12px] text-muted-foreground mt-3 py-1"
        >
          Já tenho conta (comprei no site) — <span className="underline underline-offset-2 font-semibold text-foreground">entrar</span>
        </button>
      )}

      <div className="mt-4">
        <AppLegalFooter />
      </div>
    </div>
  );
}
