/**
 * A ÚNICA VENDA DO APP — VITALÍCIO (v81, 27/08, desenho aprovado pelo dono).
 *
 * História curta de como chegamos aqui, com dinheiro de verdade:
 *  - v48-52: vitalício 27,90 → folha do Google fechava 21%, melhor dia da
 *    história (14/08). Único modelo que JÁ provou neste público.
 *  - v53-75: trial no cartão → 48 trials = R$ 0,00 liquidado. Morto.
 *  - v78-80: anual 97,90 + escada de preço → raio-x de 26-27/08 (170 recusas
 *    cronometradas): 79% fecham a folha em <8s — DENTRO do "Processando"/tela
 *    branca de 15-25s do Google (vídeo do dono num moto g). Quem chega a VER
 *    a folha converte 7-9%. ZERO pessoas trocaram de plano após recusar
 *    (0/224). O downsell 19,90 fez 0/168 — e quando vendia, perdia dinheiro
 *    (R$ 16,90 líquido a CPA de R$ 70+). A objeção nunca foi preço.
 *
 * O DESENHO v81 (blueprint 64f93f75):
 *  - OFERTA ÚNICA: core_vitalicio_97 — R$ 97,90 UMA vez, seu pra sempre.
 *    Maior ticket = menor milagre (breakeven D0 pede só 2,7% install→pago).
 *    Âncora honesta: assinar por mês sairia 24,90×12 = R$ 298/ano.
 *  - Anti-assinatura como argumento: "paga uma vez, sem renovação" — produto
 *    AVULSO deixa a folha sem o bloco de assinatura e o Pix é nativo.
 *  - A ESPERA tratada de frente (é ela que come 79% dos leads):
 *      antes do toque  → aviso "a tela do Google leva uns segundos";
 *      1ª recusa rápida → resgate PIX reabre a MESMA folha (2ª abre na hora);
 *      recusa após 30s+ → aviso "teu código Pix vence em 5 min" + Já paguei.
 *  - SEM degrau de preço. 2ª recusa = nada; a notificação D+1 (já agendada
 *    no mount) faz o trabalho de amanhã.
 *
 * Regras herdadas (aprendidas com dinheiro):
 *  - CTA abre a folha DIRETO (tela intermediária matou 57% na v50);
 *  - Pix na folha = compra PENDENTE, não erro: caminho pendente tem AÇÃO e
 *    funciona pra comprador ANÔNIMO (conta nasce DEPOIS do pagamento);
 *  - superfície de dinheiro nunca promete o que a loja não carregou
 *    (vitalício ausente do catálogo → fallback no anual97, já provado);
 *  - Restaurar compras + legais sempre presentes (exigência de loja).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  // Resgate PIX (1ª recusa rápida): a folha aceita Pix mas 79% fecham no
  // "Processando" sem ver — a caixa reabre a folha, que na 2ª vez abre logo.
  const [resgatePix, setResgatePix] = useState(false);
  // Recusa DEPOIS de trabalhar na folha (30s+): provável código Pix gerado —
  // ele vence em 5 minutos, o aviso corre atrás da pessoa.
  const [pixVencendo, setPixVencendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  // Disponibilidade REAL no catálogo da loja (botão nunca morto).
  // vitalicio97 começa NULL (não "false"): o herói nasce vitalício e só
  // rebaixa pra "12 meses" com resposta NEGATIVA da loja — nunca rebaixar a
  // promessa antes da resposta (varredura v81: o primeiro paint mostrava o
  // fallback por 1-3s pra TODO mundo).
  const [loja, setLoja] = useState<{ vitalicio97: boolean | null; anual97: boolean }>({ vitalicio97: null, anual97: false });
  const cancelamentos = useRef(0);
  const pixVencendoJaFoi = useRef(false);
  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;
    trackEvent("app_paywall_view", {
      contexto, modo: "vitalicio", d3,
      dia: teste.fase === "ativo" ? teste.dia : teste.fase,
    });
    let retry: number | null = null;
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      // As duas pré-buscas: vitalício (herói) e assinaturas (fallback anual97
      // enquanto o SKU novo propaga na Play).
      await Promise.all([rc.prefetchVitalicio(), rc.prefetchAssinaturas()]);
      if (!vivoRef.current) return;
      // Só rebaixa a promessa (vitalicio97=false) com resposta NEGATIVA de
      // verdade do catálogo (estado "pronto" e o produto não veio). Init com
      // erro de rede mantém o otimista null — o toque re-tenta sozinho.
      const ler = () => setLoja({
        vitalicio97: rc.temVitalicio97() ? true : (rc.estadoRevenueCat() === "pronto" ? false : null),
        anual97: rc.temAnual97(),
      });
      ler();
      // Produto criado por API demora a propagar (varredura: o herói ficava
      // botão morto no dia do lançamento). Re-tentativa curta cobre a folga;
      // a terceira chance é o re-prefetch do próprio toque.
      const flagQA = () => {
        try {
          return ["core-debug-loja", "core-debug-resgate-pix", "core-debug-pix-vence"]
            .some((k) => localStorage.getItem(k) === "1");
        } catch { return false; }
      };
      if (!rc.temVitalicio97()) {
        retry = window.setTimeout(async () => {
          // Varredura v81: se o init falhou por rede, os prefetches fazem
          // early-return — o retry tem que re-tentar o INIT primeiro.
          await rc.initRevenueCat();
          await Promise.all([rc.prefetchVitalicio(), rc.prefetchAssinaturas()]);
          // o re-ler NÃO pode atropelar a loja forçada dos flags de QA
          if (vivoRef.current && !flagQA()) ler();
        }, 2500);
      }
      // QA visual por flag de devtools (ninguém liga sem CDP/adb) — só
      // aparência; a compra continua dependendo da loja de verdade.
      try {
        if (localStorage.getItem("core-debug-loja") === "1") {
          setLoja({ vitalicio97: true, anual97: true });
        }
        if (localStorage.getItem("core-debug-resgate-pix") === "1") {
          setLoja({ vitalicio97: true, anual97: true });
          setResgatePix(true);
        }
        if (localStorage.getItem("core-debug-pix-vence") === "1") {
          setLoja({ vitalicio97: true, anual97: true });
          setPixVencendo(true);
        }
      } catch { /* noop */ }
    })();
    if (contexto !== "planos") void agendarResgateDoPlano(area ? AREAS[area].nome : null);
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** "Já paguei — atualizar" (barra e avisos). Varredura, invariantes 3+4: o
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
        // Varredura v81: o herói agora é compra ÚNICA (INAPP) — ela mora em
        // nonSubscriptionTransactions (compraVitaliciaLocal), NUNCA em
        // activeSubscriptions (compraAssinaturaLocal). As duas provas locais,
        // senão o "Já paguei" fica cego pra quem acabou de pagar o vitalício.
        const pagouLocal = restaurou
          || (await rc.compraVitaliciaLocal())
          || (await rc.compraAssinaturaLocal());
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
    setResgatePix(false);
    setPixVencendo(false);
    trackEvent("funnel_click", { cta: "app_paywall_cta", contexto, produto });
    const t0 = Date.now();
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
      /* Tempo DENTRO da folha, não desde o toque (varredura v81): o t0 do
       * toque ainda paga import + garantirPronto + prefetch; o carimbo do
       * revenuecat.ts nasce imediatamente antes do purchase*. */
      const abriu = rc.inicioUltimaFolha() ?? t0;
      const segundosNaFolha = (Date.now() - abriu) / 1000;
      /* ESCADA v81 — só de MÉTODO, nunca de preço (0/224 trocaram de plano;
       * 19,90 fez 0/168). Recusa rápida = fechou no "Processando"/tela branca
       * → resgate PIX reabre (a 2ª folha abre na hora, serviço quente).
       * Recusa após 30s+ = trabalhou na folha, provável código Pix gerado —
       * que VENCE EM 5 MINUTOS → o aviso corre atrás. Cada caixa uma vez
       * (a do Pix vencendo com guarda própria, senão re-arma a cada recusa). */
      if (segundosNaFolha >= 30 && !pixVencendoJaFoi.current) {
        pixVencendoJaFoi.current = true;
        setPixVencendo(true);
        trackEvent("app_pix_vencendo_view", { contexto, produto, seg: Math.round(segundosNaFolha) });
      } else if (segundosNaFolha < 30 && cancelamentos.current === 1) {
        setResgatePix(true);
        trackEvent("app_resgate_pix_view", { contexto, produto });
      }
    } else if (motivo === "produto_ausente") {
      // Varredura: a mensagem antiga mandava ATUALIZAR o app — falso no dia
      // do lançamento (o que falta é o catálogo propagar). O toque seguinte
      // re-prefetcha sozinho.
      setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
    } else if (motivo === "catalogo") {
      setErro("Atualize o CORE na Play Store pra continuar — esta versão ficou sem o catálogo.");
    } else if (motivo) {
      setErro("O Google não concluiu o pagamento. Tenta de novo em instantes.");
    }
    setComprando(false);
  };

  const selo = (() => {
    if (contexto === "planos") return "Seu acesso";
    if (d3 || teste.fase === "expirado") return "Seu teste terminou";
    return "Último passo";
  })();
  const titulo = contexto === "funil" ? "Seu plano tá pronto" : "Sua vida inteira organizada";

  /* Herói vitalício por padrão (null = loja ainda não respondeu); só rebaixa
   * pro anual97 com resposta NEGATIVA do catálogo — provado, mesma folha,
   * mesmo preço. A promessa muda JUNTO com o produto (regra de ouro). */
  const vitalicio = loja.vitalicio97 !== false;
  const compraAtual = vitalicio
    ? {
        fn: (rc: typeof import("@/lib/revenuecat")) => rc.comprarVitalicio("core_vitalicio_97"),
        id: APP_PRECOS.vitalicio97.id,
        cta: <>Quero pra sempre <ArrowRight className="w-4 h-4" /></>,
        legal: `${APP_PRECOS.vitalicio97.preco} · pagamento único pelo Google Play · Pix ou cartão · sem renovação`,
      }
    : {
        fn: (rc: typeof import("@/lib/revenuecat")) => rc.comprarAnual97(),
        id: APP_PRECOS.anual97.id,
        cta: <>Continuar <ArrowRight className="w-4 h-4" /></>,
        legal: `${APP_PRECOS.anual97.preco} · 12 meses de acesso · Pix ou cartão · sem renovação automática`,
      };

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

  /* Resgate PIX (1ª recusa rápida). A pessoa fechou a folha no carregamento
   * achando que travou (ou que era só cartão) — a caixa aparece SOZINHA onde
   * o dedo está (prêmio persegue a pessoa, zero fricção) e reabre a MESMA
   * folha, que na segunda vez abre na hora. */
  const caixaResgatePix = (
    <div className="rounded-xl bg-[#e5f6f3] border border-[#b9e6df] text-[#0b6d62] text-[12.5px] leading-snug p-3 mb-2.5">
      <b className="flex items-center gap-1.5 mb-0.5">
        <span className="w-[7px] h-[7px] rotate-45 bg-current rounded-[1.5px]" aria-hidden />
        Prefere pagar no Pix?
      </b>
      Toca de novo — <b>agora a tela abre na hora</b> — e escolhe <b>Pix</b> na lista.
      Pagou, o acesso libera sozinho.
      <button
        className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50"
        disabled={comprando}
        onClick={async () => {
          trackEvent("app_resgate_pix_toque", { contexto, produto: compraAtual.id });
          const rc = await import("@/lib/revenuecat");
          void pagou(() => compraAtual.fn(rc), compraAtual.id);
        }}
      >
        Abrir de novo e pagar no Pix
      </button>
    </div>
  );

  /* Recusa depois de 30s+ DENTRO da folha: provável código Pix gerado — e o
   * código do Google vence em 5 minutos. Quem foi pro app do banco e voltou
   * encontra o caminho de conclusão, não um paywall mudo. */
  const caixaPixVencendo = (
    <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5">
      <b>Gerou o código Pix?</b> Ele vence em 5 minutos — paga agora no app do teu banco
      que o acesso libera sozinho aqui.
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
      {pixVencendo && !pendente && caixaPixVencendo}
      {resgatePix && !pendente && !pixVencendo && caixaResgatePix}
      {pendente && caixaPendente}
      {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}

      <p className="text-center text-[12px] text-muted-foreground mb-2">
        <span className="text-[#f0a500]">★★★★★</span> <b className="text-foreground">+1000 pessoas</b>
        {" · "}
        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
          <Check className="w-3.5 h-3.5 inline" strokeWidth={3} /> {pendente ? "libera após o pagamento" : "acesso na hora"}
        </span>
      </p>

      {/* PIX gritado ANTES da folha (79% fecham no carregamento achando que é
          cartão-only — a letrinha legal de 10px ninguém lê). */}
      {!resgatePix && !pixVencendo && (
        <p className="flex items-center justify-center gap-1.5 mb-2 text-[12px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#e5f6f3] text-[#0e8577] px-1.5 py-[2px] text-[11px] font-black tracking-wide">
            <span className="w-[7px] h-[7px] rotate-45 bg-current rounded-[1.5px]" aria-hidden /> PIX
          </span>
          dá pra pagar no Pix — escolhe na tela do Google
        </p>
      )}

      <Button
        size="lg"
        className="w-full min-h-[54px] rounded-full text-base font-extrabold bg-[#16121c] hover:bg-[#16121c]/90 text-white shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] dark:ring-1 dark:ring-white/25"
        disabled={comprando}
        onClick={async () => {
          const rc = await import("@/lib/revenuecat");
          void pagou(() => compraAtual.fn(rc), compraAtual.id);
        }}
      >
        {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : compraAtual.cta}
      </Button>
      {/* A ESPERA, armada antes do toque: a folha do Google leva 15-25s num
          aparelho popular e 79% desistiam achando que travou. Quem sabe o que
          vem, espera. */}
      <p className="text-[10.5px] text-muted-foreground text-center mt-1.5">
        a tela de pagamento do Google leva uns segundos pra abrir — <b>não fecha o app</b>
      </p>
      <p className="text-[10.5px] text-muted-foreground/80 text-center mt-0.5">{compraAtual.legal}</p>
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

      {/* ÂNCORA honesta acima do herói: o custo real de assinar pra sempre.
          Não é botão — é régua. (0/224 trocaram de plano; escolha era teatro.) */}
      <p className="text-center text-[12px] text-muted-foreground mb-2">
        assinar por mês sairia <span className="line-through decoration-[#e0654a] decoration-2 font-semibold">R$ 298/ano, pra sempre</span>
      </p>

      {/* HERÓI ÚNICO (bg-white PROPOSITAL nos dois temas → cor de texto
          explícita; varredura: dark mode virava branco no branco). */}
      <div className="rounded-2xl border-2 border-accent overflow-hidden text-center bg-white text-[#16121c] shadow-[0_14px_30px_-14px_rgba(0,0,0,.4)] mb-1">
        <div className="bg-accent text-white text-[10px] font-extrabold tracking-wide py-1">
          {vitalicio ? "ACESSO VITALÍCIO — PAGA UMA VEZ" : "MELHOR PREÇO — 12 MESES"}
        </div>
        <div className="text-[27px] font-black leading-none mt-3 tracking-tight">
          {vitalicio ? "Seu pra sempre" : "1 ano de CORE"}
        </div>
        <div className="text-[19px] font-extrabold mt-2">
          {(vitalicio ? APP_PRECOS.vitalicio97 : APP_PRECOS.anual97).preco}
          <small className="text-[11px] font-bold text-black/45"> · {vitalicio ? "uma única vez" : "R$ 8,16/mês"}</small>
        </div>
        <div className="mx-6 my-2.5 border-t border-black/10" aria-hidden />
        <div className="text-[11.5px] font-semibold text-black/55 pb-3.5 px-5 leading-snug">
          {vitalicio
            ? <>Os 16 módulos e tudo que a gente lançar depois. <b>Sem assinatura, sem renovação, sem mensalidade.</b></>
            : <>Acesso completo aos 16 módulos por 12 meses — sem renovação automática.</>}
        </div>
      </div>

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
          {/* Varredura v81: a barra real mede ~250-270px no estado base (as
              linhas de espera+legal quebram em 2 em tela de 360px) — spacer
              menor deixava a barra COBRINDO o fim do conteúdo. */}
          <div className={pendente || erro || resgatePix || pixVencendo ? "h-[376px]" : "h-[272px]"} aria-hidden />
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
    </div>
  );
}
