/**
 * A ÚNICA VENDA DO APP — À VISTA (pivô 23/08, aprovado pelo dono).
 *
 * História: v53 vendia assinatura com trial no cartão. Dados de 19-23/08
 * mataram o modelo: 48 trials iniciados = R$ 0,00 liquidado; 83% cancelam a
 * folha; TODO dinheiro real do catálogo novo veio de pagamento à vista
 * (pré-pago com Pix na folha do Google — 5× 19,90 + 2× 24,90). O funil novo
 * é o do Me+ (10M+ downloads) adaptado: compromisso antes do preço, paywall
 * em colunas com âncora por mês, e escada de saída com caixa de presente.
 *
 * TUDO aqui compra pelo botão do pré-pago (purchaseStoreProduct): folha do
 * Google aceita Pix, liquida na hora, renovação manual. Sem fase grátis,
 * nunca — as ofertas de trial seguem vivas no catálogo SÓ pros APKs antigos.
 *
 * A ESCADA (cada degrau só aparece depois de recusa real):
 *   vitrine: Mensal 24,90 | 12 meses 97,90 (herói, R$ 8,16/mês) — 26/08 o
 *   anual de 159,90 saiu: 95 dos 102 toques em comprar iam nele e vendeu ZERO
 *   cancelou a folha do ANUAL → 🎁 ANUAL 97,90 (R$ 62 off — nunca na vitrine)
 *   cancelou o 97,90 ou o MENSAL → resgate: 1 mês 19,90 (Pix)
 *
 * Regras herdadas (aprendidas com dinheiro) + varredura 23/08 (37 achados):
 *  - CTA abre a folha DIRETO (tela intermediária matou 57% na v50);
 *  - Pix na folha = compra PENDENTE, não erro: caminho pendente tem que ter
 *    AÇÃO em toda superfície (barra E modal do gift) e funcionar pra
 *    comprador ANÔNIMO (o fluxo padrão: conta nasce DEPOIS do pagamento);
 *  - superfície de dinheiro nunca promete o que a folha não dá (o fallback
 *    do mensal é recorrente → a promessa muda junto);
 *  - Restaurar compras + legais sempre presentes (exigência de loja) — no
 *    gate o AppLegalFooter completo (tem o Excluir conta, exigência Play).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { estadoTeste, limparGuiaSemente } from "@/lib/teste-gratis";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { agendarResgateDoPlano, cancelarResgateDoPlano, cancelarReguaDoTeste } from "@/lib/notificacoes";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";

export type ContextoPaywall = "funil" | "gate" | "planos";

// Gift 1× por SESSÃO DO APP de verdade (varredura: useRef zera a cada mount e
// o sheet do /planos remonta a cada abertura — a caixa rearmava toda vez).
const GIFT_VISTO_SESSAO = "core-gift-visto-sessao";

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
  contexto, area = null, d3 = false, onPagoSemConta, onFechar,
}: {
  contexto: ContextoPaywall;
  area?: AreaKey | null;
  d3?: boolean;
  onPagoSemConta?: () => void;
  onFechar?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recap = useRecap(area);
  const teste = estadoTeste();
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  // Degraus da escada. "resgate" = 1 mês 19,90 no Pix, na caixa de presente
  // do Me+ (o desenho que segurava atenção; 26/08 o 97,90 virou o anual).
  const [oferta, setOferta] = useState<"cheia" | "resgate">("cheia");
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  // Disponibilidade REAL no catálogo da loja.
  const [loja, setLoja] = useState({ mensalVista: false, anualVista: false, anual97: false, mensalPix: false });
  const cancelamentos = useRef(0);
  const giftTimer = useRef<number | null>(null);
  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;
    trackEvent("app_paywall_view", {
      contexto, modo: "avista", d3,
      dia: teste.fase === "ativo" ? teste.dia : teste.fase,
    });
    let retry: number | null = null;
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchAssinaturas();
      if (!vivoRef.current) return;
      const ler = () => setLoja({ mensalVista: rc.temMensalVista(), anualVista: rc.temAnualVista(), anual97: rc.temAnual97(), mensalPix: rc.temMensalPix() });
      ler();
      // Base plans criados por API demoram a propagar (varredura: o herói
      // ficava botão morto no dia do lançamento). Uma re-tentativa curta
      // cobre a folga; a terceira chance é o re-prefetch do próprio toque.
      if (!rc.temAnualVista() || !rc.temMensalVista()) {
        retry = window.setTimeout(async () => {
          await rc.prefetchAssinaturas();
          if (vivoRef.current) ler();
        }, 2500);
      }
      // QA do presente (23/08): emulador não abre folha real. Flag MANUAL de
      // devtools (ninguém liga sem CDP/adb): força catálogo ok + abre o modal
      // — só visual, a compra continua dependendo da loja de verdade.
      try {
        if (localStorage.getItem("core-debug-gift") === "1") {
          setLoja({ mensalVista: true, anualVista: true, anual97: true, mensalPix: true });
          window.setTimeout(() => setOferta("resgate"), 600);
        }
      } catch { /* noop */ }
    })();
    if (contexto !== "planos") void agendarResgateDoPlano(area ? AREAS[area].nome : null);
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
      if (giftTimer.current) window.clearTimeout(giftTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const giftJaFoi = (): boolean => {
    try { return sessionStorage.getItem(GIFT_VISTO_SESSAO) === "1"; } catch { return false; }
  };

  /** Agenda a caixa de presente (pop do Me+, 450ms depois da recusa).
   *  Segura o CTA travado até o modal abrir — a varredura pegou a corrida:
   *  re-toque na janela reabria a folha e queimava o degrau sem ninguém ver. */
  const abrirResgate = (origem: string): boolean => {
    if (giftJaFoi() || !loja.mensalPix) return false;
    giftTimer.current = window.setTimeout(() => {
      if (!vivoRef.current) return;
      try { sessionStorage.setItem(GIFT_VISTO_SESSAO, "1"); } catch { /* noop */ }
      setOferta("resgate");
      setComprando(false);
      trackEvent("app_downsell_view", { plano: "mensal_pix", de: "anual_97", origem, contexto });
    }, 450);
    return true;
  };

  /** "Já paguei — atualizar" (barra E modal). Varredura, invariantes 3+4: o
   *  comprador ANÔNIMO (fluxo padrão — conta nasce depois) caía num botão
   *  morto: sincronizarAssinatura exige sessão e devolvia false sempre. Sem
   *  conta, a prova de pagamento é a PRÓPRIA loja (restaurar/compra local). */
  const confirmarPagamento = async () => {
    if (conferindo) return;
    setConferindo(true);
    setErro(null);
    try {
      const rc = await import("@/lib/revenuecat");
      const restaurou = await rc.restaurar();
      if (!user) {
        const pagouLocal = restaurou || (await rc.compraAssinaturaLocal());
        if (pagouLocal) {
          void cancelarResgateDoPlano();
          void cancelarReguaDoTeste();
          limparGuiaSemente();
          if (onPagoSemConta) onPagoSemConta();
          else navigate("/app?step=signup", { replace: true });
          return;
        }
        setErro("Ainda não achamos seu pagamento — o Pix pode levar ~1 minuto. Tenta de novo já já.");
        return;
      }
      const ok = restaurou || (await rc.sincronizarAssinatura(2));
      if (!ok) {
        setErro("Ainda não achamos seu pagamento — o Pix pode levar ~1 minuto. Tenta de novo já já.");
        return;
      }
      void cancelarResgateDoPlano();
      void cancelarReguaDoTeste();
      limparGuiaSemente();
      window.location.href = "/";
    } finally {
      setConferindo(false);
    }
  };

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
      /* ESCADA (redesenhada 26/08). Era: recusou anual 159,90 → presente 97,90
       * → resgate 19,90. Agora o 97,90 É o anual, então o degrau do meio some e
       * a recusa cai direto no 19,90 — com o mesmo desenho de caixa de presente,
       * que é o que segurava a atenção. Cada degrau uma vez, sempre por recusa
       * REAL na folha do Google. */
      if (oferta === "cheia" && abrirResgate("cancelou_folha")) {
        return; // CTA fica travado até o modal abrir (o timer solta)
      } else if (cancelamentos.current >= 2) {
        trackEvent("app_resgate_view", { contexto });
      }
    } else if (motivo === "produto_ausente") {
      // Varredura: a mensagem antiga mandava ATUALIZAR o app — falso no dia
      // do lançamento (o v76 É a versão nova; o que falta é o catálogo
      // propagar). O toque seguinte re-prefetcha sozinho.
      setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
    } else if (motivo === "catalogo") {
      setErro("Atualize o CORE na Play Store pra continuar — esta versão ficou sem o catálogo.");
    } else if (motivo) {
      setErro("O Google não concluiu o pagamento. Tenta de novo em instantes.");
    }
    setComprando(false);
  };

  const selo = (() => {
    if (contexto === "planos") return "Escolha seu plano";
    if (d3 || teste.fase === "expirado") return "Seu teste terminou";
    return "Último passo";
  })();
  const titulo = contexto === "funil" ? "Seu plano tá pronto" : "Sua vida inteira organizada";

  const compraAtual = plano === "anual"
    ? { fn: (rc: typeof import("@/lib/revenuecat")) => rc.comprarAnual97(), id: APP_PRECOS.anual97.id, cta: <>Continuar <ArrowRight className="w-4 h-4" /></>, legal: `${APP_PRECOS.anual97.preco} · 12 meses de acesso · Pix ou cartão · sem renovação automática` }
    : { fn: (rc: typeof import("@/lib/revenuecat")) => (loja.mensalVista ? rc.comprarMensalVista() : rc.comprar(APP_PRECOS.mensal.id, { semTrial: true })), id: loja.mensalVista ? APP_PRECOS.mensalVista.id : APP_PRECOS.mensal.id, cta: <>Continuar <ArrowRight className="w-4 h-4" /></>, legal: `${APP_PRECOS.mensal.preco} · 30 dias de acesso · ${loja.mensalVista ? "Pix ou cartão · renova só se você quiser" : "cancele quando quiser"}` };

  const barraFixa = contexto !== "planos";

  const caixaPendente = (
    <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5">
      <b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
      o acesso libera sozinho aqui.
      <button
        className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50"
        disabled={conferindo}
        onClick={() => void confirmarPagamento()}
      >
        {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
      </button>
    </div>
  );

  const blocoAcao = (
    <>
      {pendente && caixaPendente}
      {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}

      <p className="text-center text-[12px] text-muted-foreground mb-2">
        <span className="text-[#f0a500]">★★★★★</span> <b className="text-foreground">+1000 pessoas</b>
        {" · "}
        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
          <Check className="w-3.5 h-3.5 inline" strokeWidth={3} /> acesso na hora
        </span>
      </p>

      <Button
        size="lg"
        className="w-full min-h-[54px] rounded-full text-base font-extrabold bg-[#16121c] hover:bg-[#16121c]/90 text-white shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)]"
        disabled={comprando}
        onClick={async () => {
          const rc = await import("@/lib/revenuecat");
          void pagou(() => compraAtual.fn(rc), compraAtual.id);
        }}
      >
        {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : compraAtual.cta}
      </Button>
      <p className="text-[10.5px] text-muted-foreground text-center mt-1.5">{compraAtual.legal}</p>
    </>
  );

  return (
    <div className={`w-full max-w-sm mx-auto relative ${barraFixa ? "" : "pb-6"}`}>
      {/* Overlay anti-abandono (Me+ "não feche a página"): a folha do Google
          demora a abrir em aparelho fraco e a pessoa acha que travou. */}
      {comprando && (
        <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
          <div className="mx-auto rounded-full bg-[#16121c] text-white text-[12.5px] font-bold px-4 py-2 shadow-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Abrindo o pagamento — não feche o app
          </div>
        </div>
      )}

      {contexto === "planos" && onFechar && (
        <button
          aria-label="Fechar"
          onClick={() => {
            // 1º X da sessão = caixa de presente (Me+); depois disso, fecha.
            if (oferta === "cheia" && abrirResgate("x_planos")) return;
            trackEvent("app_sheet_close", { via: "x", contexto });
            onFechar();
          }}
          className="absolute right-0 -top-1 w-8 h-8 rounded-full bg-black/[0.06] grid place-items-center text-muted-foreground z-[1]"
        >
          <X className="w-4 h-4" strokeWidth={2.25} />
        </button>
      )}

      <div className="text-center mb-3.5 [@media(max-height:700px)]:mb-2.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider mb-2 [@media(max-height:700px)]:mb-1.5">
          {selo}
        </div>
        <h2 className="text-[25px] [@media(max-height:700px)]:text-[22px] font-bold tracking-tight leading-[1.15]">{titulo}</h2>
      </div>

        <>
          {/* Recap (endowment) — só fora do funil: no funil o compromisso
              acabou de acontecer (resultado → "Claro!" ×3 → contrato). */}
          {contexto !== "funil" && !(contexto === "planos" && teste.fase === "nunca") && (
            <div className="rounded-2xl border border-border bg-white text-[#16121c] p-3.5 mb-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/45 mb-2">
                O que você construiu
              </div>
              {recap.map((r) => (
                <div key={r} className="flex items-center gap-2.5 text-[13px] font-semibold py-0.5">
                  <span className="min-w-[18px] min-h-[18px] rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
                    <Check className="w-3 h-3" strokeWidth={3.5} />
                  </span>
                  {r}
                </div>
              ))}
            </div>
          )}

          {/* O que entra: eco da grade viva da welcome — os 16 módulos na
              hora do preço, sem gastar altura (uma fileira só). */}
          <div className="flex justify-center gap-1.5 mb-3">
            {([["💰", "#fdeccb"], ["📅", "#cdeeee"], ["💪", "#d9e4fb"], ["🥗", "#d7f0dd"], ["🎯", "#e6def8"], ["❤️", "#fbd8e8"], ["🧠", "#dcf3d2"]] as Array<[string, string]>).map(([e, c]) => (
              <span key={e} className="w-8 h-8 rounded-[10px] grid place-items-center text-[15px]" style={{ background: c }}>{e}</span>
            ))}
            <span className="w-8 h-8 rounded-[10px] grid place-items-center text-[10px] font-black bg-black/[0.06] text-black/50 dark:bg-white/10 dark:text-white/60">+9</span>
          </div>

          {/* CARDS-COLUNA (anatomia do Me+). bg-white é PROPOSITAL nos dois
              temas → cor de texto explícita (varredura: dark mode virava
              branco no branco). Seleção fala UMA cor: rosa (dono, 23/08). */}
          <div className="grid grid-cols-2 gap-2.5 mb-1 items-stretch">
            <button
              onClick={() => setPlano("mensal")}
              className={`rounded-2xl border-2 overflow-hidden transition-all flex flex-col text-center ${plano === "mensal" ? "border-accent shadow-[0_12px_28px_-14px_rgba(0,0,0,.35)]" : "border-border"} bg-white text-[#16121c]`}
            >
              <span className="h-[26px]" aria-hidden />
              <span className="text-[34px] font-black leading-none">1</span>
              <span className="text-[13px] font-bold text-black/45">mês</span>
              <span className="text-[15px] font-extrabold mt-2">{APP_PRECOS.mensal.preco}</span>
              <span className="mx-4 my-2 border-t border-black/10" aria-hidden />
              <span className="text-[10.5px] font-semibold text-black/45 pb-3 px-2 leading-tight">
                {loja.mensalVista ? "renova só se você quiser" : "cancele quando quiser"}
              </span>
            </button>
            <button
              onClick={() => setPlano("anual")}
              className={`rounded-2xl border-2 overflow-hidden transition-all flex flex-col text-center ${plano === "anual" ? "border-accent shadow-[0_14px_30px_-14px_rgba(0,0,0,.4)]" : "border-border"} bg-white text-[#16121c]`}
            >
              <span className={`text-[10px] font-extrabold tracking-wide py-1 ${plano === "anual" ? "bg-accent text-white" : "bg-accent/10 text-accent"}`}>
                MELHOR PREÇO
              </span>
              <span className="text-[34px] font-black leading-none mt-1">12</span>
              <span className="text-[13px] font-bold text-black/45">meses</span>
              <span className="text-[15px] font-extrabold mt-2">{APP_PRECOS.anual97.porMes}<small className="text-[10px] font-bold text-black/45">/mês</small></span>
              <span className="mx-4 my-2 border-t border-black/10" aria-hidden />
              <span className="text-[10.5px] font-semibold text-black/45 pb-3 px-2 leading-tight">
                {APP_PRECOS.anual97.preco} por 1 ano<br />economiza {APP_PRECOS.anual97.economia}
              </span>
            </button>
          </div>
        </>

      {teste.fase === "ativo" && !d3 && contexto !== "planos" && (
        <button
          onClick={() => navigate("/home")}
          className="w-full text-center text-[12px] text-muted-foreground underline underline-offset-2 mt-2 py-1"
        >
          Continuar meu teste — decido depois
        </button>
      )}

      {/* /planos e GATE levam o AppLegalFooter completo (o gate tinha perdido
          o "Excluir conta" — exigência da Play pra conta logada). No funil a
          letra miúda mora na barra fixa. */}
      {contexto !== "funil" && (
        <div className="mt-2">
          <AppLegalFooter />
        </div>
      )}

      {barraFixa ? (
        <>
          <div className={pendente || erro ? "h-[252px]" : "h-[148px]"} aria-hidden />
          <div className="fixed bottom-0 inset-x-0 z-[60] pointer-events-none">
            <div className="max-w-sm mx-auto px-5 pb-3 pt-9 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-auto">
              {blocoAcao}
              {contexto === "funil" && (
                <p className="text-[10px] text-muted-foreground/80 text-center mt-1.5">
                  <button
                    className="underline underline-offset-2"
                    onClick={async () => {
                      trackEvent("app_restore_paywall", {});
                      const rc = await import("@/lib/revenuecat");
                      if (await rc.restaurar()) window.location.href = "/";
                    }}
                  >
                    Restaurar compras
                  </button>
                  {" · "}
                  <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>
                  {" · "}
                  <a href="/termos" className="underline underline-offset-2">Termos</a>
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        blocoAcao
      )}

      {/* ══ CAIXA DE PRESENTE (modal do Me+, f092/f108): bottom sheet POR CIMA
          do paywall, preço riscado → card de moldura amarela "Melhor oferta",
          CTA preto. Números honestos: R$ 62 OFF (não "50%"). ══ */}
      {oferta === "resgate" && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/55"
            onClick={() => { setOferta("cheia"); trackEvent("app_gift_recusado", { via: "fundo", contexto }); }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] overflow-hidden"
            style={{ background: "linear-gradient(178deg, hsl(330 65% 46%) 0%, hsl(330 62% 36%) 100%)" }}
          >
            <div className="max-w-sm mx-auto px-5 pt-7 pb-4 relative text-white">
              <button
                aria-label="Fechar oferta"
                onClick={() => { setOferta("cheia"); trackEvent("app_gift_recusado", { via: "x", contexto }); }}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/15 grid place-items-center"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.7, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: -2, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.1 }}
                  className="inline-block bg-white text-[#16121c] font-black italic text-[21px] tracking-tight px-4 py-1 rounded-lg shadow-[0_8px_20px_rgba(0,0,0,.25)]"
                >
                  OFERTA ESPECIAL
                </motion.div>
                <p className="text-[12.5px] font-semibold text-white/85 mt-2">
                  Só nesta tela · comece por 30 dias, sem assinatura
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="rounded-2xl bg-white/95 text-[#16121c] px-3 py-3 text-center w-[118px]">
                  <div className="text-[21px] font-black leading-none">1</div>
                  <div className="text-[10.5px] font-bold text-black/45">mês</div>
                  <div className="text-[13.5px] font-extrabold mt-1 line-through decoration-[#e0654a] decoration-2">{APP_PRECOS.mensal.preco}</div>
                  <div className="text-[10px] font-semibold text-black/40">por mês</div>
                </div>
                <ArrowRight className="w-6 h-6 text-[#ffd84d] shrink-0" strokeWidth={3} />
                <div className="rounded-2xl bg-[#ffd84d] p-1.5 w-[132px] shadow-[0_14px_30px_-10px_rgba(0,0,0,.35)]">
                  <div className="text-center text-[11px] font-black text-[#16121c] pb-1">Melhor oferta</div>
                  <div className="rounded-xl bg-white text-[#16121c] px-3 py-2.5 text-center">
                    <div className="text-[21px] font-black leading-none">1</div>
                    <div className="text-[10.5px] font-bold text-black/45">mês</div>
                    <div className="text-[15px] font-extrabold mt-1">{APP_PRECOS.mensalPix.preco}</div>
                    <div className="text-[10px] font-semibold text-black/40">à vista</div>
                  </div>
                </div>
              </div>

              <p className="text-center text-[13px] font-bold mt-4 leading-snug">
                Total de {APP_PRECOS.mensalPix.preco} por 30 dias — pagamento único, sem renovação.
              </p>

              {/* Varredura: pendente/erro tinham que existir DENTRO do modal —
                  a barra (z-60) fica soterrada pelo backdrop (z-70). */}
              {pendente && (
                <div className="rounded-xl bg-white/15 text-[12px] leading-snug p-2.5 mt-2.5 text-center">
                  <b>Pagamento em processamento.</b> Gerou um Pix? Paga no app do banco.
                  <button
                    className="block w-full text-center font-bold underline underline-offset-2 mt-1 disabled:opacity-50"
                    disabled={conferindo}
                    onClick={() => void confirmarPagamento()}
                  >
                    {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
                  </button>
                </div>
              )}
              {erro && <p className="text-[12px] text-[#ffd84d] text-center mt-2">{erro}</p>}

              <Button
                size="lg"
                className="w-full min-h-[52px] rounded-full text-[15.5px] font-extrabold bg-[#16121c] hover:bg-[#16121c]/90 text-white mt-3.5"
                disabled={comprando}
                onClick={async () => {
                  const rc = await import("@/lib/revenuecat");
                  void pagou(() => rc.comprarMensalPix(), APP_PRECOS.mensalPix.id);
                }}
              >
                {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
              </Button>
              <p className="text-[10px] text-white/70 text-center mt-1.5">
                Pagamento único pelo Google Play · 30 dias de acesso · Pix ou cartão
              </p>
              <button
                onClick={() => { setOferta("cheia"); trackEvent("app_gift_recusado", { via: "agora_nao", contexto }); }}
                className="w-full text-center text-[12px] text-white/70 mt-1 py-1.5"
              >
                Agora não
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
