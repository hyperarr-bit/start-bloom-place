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
 * O DESENHO v82 (27/08, decisão do dono em cima do blueprint 64f93f75):
 *  - DUAS COLUNAS: mensal 24,90 como ÂNCORA VIVA (frame de aluguel: "todo
 *    mês, pra sempre") × VITALÍCIO 97,90 como herói ("4 meses de mensal =
 *    CORE pra sempre"). O mensal vendia todo dia (5 em 26/08) — âncora morta
 *    jogava esse chão de receita fora; âncora viva ancora E fatura.
 *    Régua de mix definida ANTES: vitalício < 40% das vendas = frame fraco.
 *  - Maior ticket = menor milagre (breakeven D0 pede só 2,7% install→pago).
 *  - Anti-assinatura como argumento: "paga uma vez, sem renovação" — produto
 *    AVULSO deixa a folha sem o bloco de assinatura e o Pix é nativo.
 *  - A ESPERA tratada de frente (é ela que come 79% dos leads):
 *      no toque         → overlay "leva uns segundos — não fecha o app"
 *                         (v83.3, dono: a linha estática sob o CTA "ninguém
 *                         lê" — o overlay entrega a MESMA info na hora do
 *                         toque, quando 100% estão olhando);
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
import {
  ehApple, pelaLoja, sufixoPagamento, temEscadaPix,
  erroPagamentoNaoAchado, avisoAtualizarApp,
} from "@/lib/loja";
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
    // v83: a conta armada na DEMO GUIADA (chave própria pra não poluir o
    // módulo finanças) também conta como construção — endowment do funil.
    const demoConta = get<string | null>("core-demo-conta", null);
    if (demoConta && contas === 0) linhas.push(`Lembrete da conta "${demoConta}" armado`);
  } catch { /* recap nunca derruba o paywall */ }
  if (linhas.length === 0) {
    linhas.push(area ? `Seu painel de ${AREAS[area].nome} te esperando` : "Seu painel te esperando do jeito que você deixou");
  }
  return linhas.slice(0, 3);
}

/* 5 feedbacks REAIS girando num slot só (v83.3, pedido do dono: "botar 5 mas
 * ocupar só um espaço" — Cal AI roda reviews no paywall do mesmo jeito).
 * Curadoria: cobre as 4 portas do funil (dinheiro ×2 — é a porta que mais
 * vende —, vida inteira, rotina, corpo). Textos = versão curta dos feedbacks
 * do Instagram já usados no funil web (PaywallDia14). Fotos vêm no bundle
 * (preparar-loja NÃO poda /depoimentos); se faltar, cai na inicial colorida. */
const DEPOS: Array<{ nome: string; meta: string; ini: string; cor: string; texto: string; foto?: string }> = [
  /* 03/09: avaliações REAIS da Google Play, palavra por palavra, nome como
   * a loja mostra. Sem foto (ninguém posou), sem nota nem quantidade (dono). */
  { nome: "Elisa D.", meta: "", ini: "E", cor: "#fbd8e8",
    texto: "Que app incrível! Tudo que eu sempre quis num planner online. É maravilhoso pra se organizar e motivar. Vale cada centavo." },
  { nome: "Paulo P.", meta: "", ini: "P", cor: "#dcf3d2",
    texto: "aplicativo muito bom, vale o preço, depois que baixei, organizei minha rotina, e estou ganhando mais por causa disso, e passando mais tempo com a minha família" },
  { nome: "Natalia J.", meta: "", ini: "N", cor: "#fdeccb",
    texto: "gostei muito do app, consegui organizar minhas finanças, vi meus gastos e pedi ajuda com a ia TMB" },
  { nome: "Sabrina F.", meta: "", ini: "S", cor: "#d7f0dd",
    texto: "Pontos fortes: Design ótimo, interfaces completas sem ser complexas. Agradável de usar. Assinatura de pagamento único." },
  { nome: "Naisa E.", meta: "", ini: "N", cor: "#d9e4fb",
    texto: "Esse app é incrível e o mais evolutivo que conheci até hoje!" },
];

function CarrosselDepoimentos() {
  const [i, setI] = useState(0);
  const [semFoto, setSemFoto] = useState<Record<number, boolean>>({});
  // Toque num ponto = controle manual — o giro automático para pra sempre
  // (autonomia vence animação; regra das superfícies de venda).
  const manual = useRef(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!manual.current) setI((v) => (v + 1) % DEPOS.length);
    }, 4500);
    return () => window.clearInterval(t);
  }, []);
  const d = DEPOS[i];
  return (
    <div className="rounded-2xl border border-border bg-white text-[#16121c] p-3.5">
      {/* key troca → fade do tailwindcss-animate; min-h segura o slot parado
          (o texto mais longo dá 4 linhas em tela de 360px). */}
      <div key={i} className="animate-in fade-in duration-500">
        <p className="text-[12.5px] leading-relaxed min-h-[80px]">“{d.texto}”</p>
        <div className="flex items-center gap-2 mt-2">
          {d.foto && !semFoto[i] ? (
            <img
              src={d.foto} alt="" loading="lazy"
              className="w-6 h-6 rounded-full object-cover"
              onError={() => setSemFoto((s) => ({ ...s, [i]: true }))}
            />
          ) : (
            <span className="grid place-items-center w-6 h-6 rounded-full text-[10px] font-black text-[#16121c]" style={{ background: d.cor }}>{d.ini}</span>
          )}
          <p className="text-[11px] text-black/50 font-semibold">{d.nome} — {d.meta || (ehApple() ? "avaliação de usuário" : "Google Play")} <span className="text-[#f0a500]">★★★★★</span></p>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mt-2.5">
        {DEPOS.map((dep, j) => (
          <button
            key={dep.nome}
            aria-label={`Depoimento ${j + 1}`}
            className={`w-[6px] h-[6px] rounded-full transition-colors ${j === i ? "bg-accent" : "bg-black/15"}`}
            onClick={() => { manual.current = true; setI(j); }}
          />
        ))}
      </div>
    </div>
  );
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
  // v82: coluna escolhida — vitalício nasce selecionado (é o herói).
  const [plano, setPlano] = useState<"vitalicio" | "mensal">("vitalicio");
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  // Resgate PIX (1ª recusa rápida): a folha aceita Pix mas 79% fecham no
  // "Processando" sem ver — a caixa reabre a folha, que na 2ª vez abre logo.
  const [resgatePix, setResgatePix] = useState(false);
  /* v83 (autópsia 28/08): 140 sessões VIRAM o resgate e só 6 tocaram no botão
   * — mas 54% reabriram a folha depois de ver. O botão está morto; a caixa
   * funciona como lembrete. Então a folha REABRE SOZINHA com contagem visível
   * (prêmio persegue a pessoa, zero ação exigida) e "Agora não" cancela. */
  const [reabrindoEm, setReabrindoEm] = useState<number | null>(null);
  const contagemRef = useRef<number | null>(null);
  const compraAtualRef = useRef<{ fn: (rc: typeof import("@/lib/revenuecat")) => Promise<boolean>; id: string }>({ fn: async () => false, id: "" });
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
  const [loja, setLoja] = useState<{ vitalicio97: boolean | null; anual97: boolean; mensalVista: boolean }>({ vitalicio97: null, anual97: false, mensalVista: false });
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
        mensalVista: rc.temMensalVista(),
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
          setLoja({ vitalicio97: true, anual97: true, mensalVista: true });
        }
        if (localStorage.getItem("core-debug-resgate-pix") === "1") {
          setLoja({ vitalicio97: true, anual97: true, mensalVista: true });
          setResgatePix(true);
        }
        if (localStorage.getItem("core-debug-pix-vence") === "1") {
          setLoja({ vitalicio97: true, anual97: true, mensalVista: true });
          setPixVencendo(true);
        }
      } catch { /* noop */ }
    })();
    if (contexto !== "planos") void agendarResgateDoPlano(area ? AREAS[area].nome : null);
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
      if (contagemRef.current) window.clearInterval(contagemRef.current);
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
        setErro(erroPagamentoNaoAchado());
        return;
      }
      const ok = restaurou || (await rc.sincronizarAssinatura(2));
      if (!ok) {
        setErro(erroPagamentoNaoAchado());
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
    // carimbo do toque pro app_compra_opcao (desde_toque_ms) — consumido uma vez no revenuecat
    void import("@/lib/revenuecat").then((m) => m.marcarToqueDeCompra?.()).catch(() => { /* noop */ });
    if (comprando) return;
    setComprando(true);
    setErro(null);
    setPendente(false);
    setResgatePix(false);
    setPixVencendo(false);
    // qualquer ação de compra desarma a contagem de reabertura
    setReabrindoEm(null);
    if (contagemRef.current) { window.clearInterval(contagemRef.current); contagemRef.current = null; }
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
      /* v83: gatilho do "código vencendo" ampliado 30s→20s (7 exposições em
       * 1,5 dia era pouco; 1 das 7 virou venda). */
      if (segundosNaFolha >= 20 && !pixVencendoJaFoi.current && folhaPrepaga) {
        pixVencendoJaFoi.current = true;
        setPixVencendo(true);
        trackEvent("app_pix_vencendo_view", { contexto, produto, seg: Math.round(segundosNaFolha) });
      } else if (segundosNaFolha < 20 && cancelamentos.current === 1 && folhaPrepaga) {
        setResgatePix(true);
        trackEvent("app_resgate_pix_view", { contexto, produto, auto: true });
        // contagem de 4s e a folha reabre sozinha (o cancelador rápido nunca
        // viu o Pix; a 2ª folha abre na hora, serviço quente)
        setReabrindoEm(4);
        contagemRef.current = window.setInterval(() => {
          setReabrindoEm((n) => {
            if (n === null) return null;
            if (n <= 1) {
              if (contagemRef.current) window.clearInterval(contagemRef.current);
              contagemRef.current = null;
              trackEvent("app_resgate_pix_auto", { contexto, produto });
              const rcMod = import("@/lib/revenuecat");
              void rcMod.then((m) => pagou(() => compraAtualRef.current.fn(m), compraAtualRef.current.id));
              return null;
            }
            return n - 1;
          });
        }, 1000);
      }
    } else if (motivo === "produto_ausente") {
      // Varredura: a mensagem antiga mandava ATUALIZAR o app — falso no dia
      // do lançamento (o que falta é o catálogo propagar). O toque seguinte
      // re-prefetcha sozinho.
      setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
    } else if (motivo === "ja_ativo") {
      // 02/09: a Play diz que a compra já é desta pessoa — restaurar, não "tentar de novo".
      if (await rc.restaurar()) { window.location.href = "/"; return; }
      setErro("A Play diz que esta compra já é sua. Toca em «Restaurar compras» aqui embaixo pra liberar o acesso.");
    } else if (motivo === "nao_permitido") {
      setErro("A Play Store recusou compras nesta conta Google. Abre a Play Store, confere se está logado e se a conta pode comprar (conta de menor precisa da aprovação dos pais) e volta aqui. Se já pagou, toca em «Restaurar compras».");
    } else if (motivo === "catalogo") {
      setErro(avisoAtualizarApp());
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
  const colunaDireita = vitalicio
    ? {
        fn: (rc: typeof import("@/lib/revenuecat")) => rc.comprarVitalicio("core_vitalicio_97"),
        id: APP_PRECOS.vitalicio97.id,
        cta: <>Quero pra sempre <ArrowRight className="w-4 h-4" /></>,
        legal: `${APP_PRECOS.vitalicio97.preco} · acesso vitalício · pagamento único ${pelaLoja()}${sufixoPagamento()}`,
      }
    : {
        fn: (rc: typeof import("@/lib/revenuecat")) => rc.comprarAnual97(),
        id: APP_PRECOS.anual97.id,
        cta: <>Continuar <ArrowRight className="w-4 h-4" /></>,
        legal: `${APP_PRECOS.anual97.preco} · 12 meses de acesso${sufixoPagamento()} · sem renovação automática`,
      };
  /* Âncora VIVA (v82): o mensal 24,90 vende de verdade (5 em 26/08) — pré-pago
   * quando a loja carregou; fallback recorrente com a promessa mudando junto. */
  const colunaMensal = {
    fn: (rc: typeof import("@/lib/revenuecat")) =>
      loja.mensalVista ? rc.comprarMensalVista() : rc.comprar(APP_PRECOS.mensal.id, { semTrial: true }),
    id: loja.mensalVista ? APP_PRECOS.mensalVista.id : APP_PRECOS.mensal.id,
    cta: <>Continuar <ArrowRight className="w-4 h-4" /></>,
    legal: `${APP_PRECOS.mensal.preco} · 30 dias de acesso · ${loja.mensalVista ? "Pix ou cartão · renova só se você quiser" : "cancele quando quiser"}`,
  };
  const compraAtual = plano === "vitalicio" ? colunaDireita : colunaMensal;
  // O interval da contagem captura closure velha — o ref entrega sempre a atual.
  compraAtualRef.current = compraAtual;
  // Folha pré-paga = Pix garantido nela (selo e resgate só prometem o real).
  // 30/08: `temEscadaPix()` na frente porque este é o interruptor ÚNICO da
  // mecânica de Pix — governa as duas ramificações da escada (resgate e
  // "código vencendo") e o selo. Na App Store não existe Pix nem folha lenta
  // pra resgatar, então tudo isso morre aqui, num lugar só.
  const folhaPrepaga = temEscadaPix() && (plano === "vitalicio" || loja.mensalVista);

  const barraFixa = contexto !== "planos";

  const caixaPendente = (
    <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5">
      {ehApple() ? (
        <><b>Compra em processamento.</b> A App Store ainda está confirmando —
        o acesso libera sozinho aqui.</>
      ) : (
        <><b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
        o acesso libera sozinho aqui.</>
      )}
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
      A tela do Google aceita <b>Pix</b> — abre de novo <b>na hora</b> (sem a espera),
      escolhe Pix na lista e copia o código.
      {reabrindoEm !== null ? (
        <span className="flex items-center justify-between mt-1.5">
          <b>Reabrindo em {reabrindoEm}s…</b>
          <button
            className="font-bold underline underline-offset-2"
            onClick={() => {
              setReabrindoEm(null);
              if (contagemRef.current) { window.clearInterval(contagemRef.current); contagemRef.current = null; }
              trackEvent("app_resgate_pix_cancelou_auto", { contexto });
            }}
          >
            Agora não
          </button>
        </span>
      ) : (
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
      )}
      {/* Saída dupla (autópsia: 74% dos canceladores somem; a última chance da
          sessão oferece o degrau junto, não depois). */}
      {plano === "vitalicio" && loja.mensalVista && reabrindoEm === null && (
        <button
          className="block w-full text-center text-[11.5px] font-semibold mt-1 opacity-80 underline underline-offset-2 disabled:opacity-50"
          disabled={comprando}
          onClick={async () => {
            trackEvent("app_resgate_mensal_toque", { contexto });
            setPlano("mensal");
            const rc = await import("@/lib/revenuecat");
            void pagou(() => (loja.mensalVista ? rc.comprarMensalVista() : rc.comprar(APP_PRECOS.mensal.id, { semTrial: true })), APP_PRECOS.mensalVista.id);
          }}
        >
          ou começa com 1 mês — {APP_PRECOS.mensal.preco}
        </button>
      )}
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
      {!resgatePix && !pixVencendo && folhaPrepaga && (
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
      <p className="text-[10.5px] text-muted-foreground/80 text-center mt-1.5">{compraAtual.legal}</p>
    </>
  );

  return (
    <div className={`w-full max-w-sm mx-auto relative ${barraFixa ? "" : "pb-6"}`}>
      {/* Overlay anti-abandono (Me+ "não feche a página"): a folha do Google
          leva 15-25s num aparelho popular e 79% desistiam achando que travou.
          v83.3: é SÓ AQUI que a espera é avisada — no momento do toque. */}
      {comprando && (
        <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
          <div className="mx-auto max-w-[92%] rounded-2xl bg-[#16121c] text-white text-[12.5px] font-bold px-4 py-2.5 shadow-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Abrindo o pagamento — leva uns segundos, não fecha o app
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

      {/* Recap (endowment). v83: LIGADO também no funil quando a DEMO
          produziu construção real (hábito marcado, conta armada) — é o
          material de deliberação de quem compra (autópsia: 108s lendo). O
          fallback genérico continua só fora do funil. */}
      {(contexto !== "funil"
        ? !(contexto === "planos" && teste.fase === "nunca")
        : !recap[0]?.startsWith("Seu painel")) && (
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

      {/* DUAS COLUNAS (v82): mensal = âncora VIVA com frame de aluguel; o
          vitalício é o herói com a conta pronta. bg-white PROPOSITAL nos dois
          temas → cor de texto explícita (varredura: dark virava branco no
          branco). Seleção fala UMA cor: rosa. */}
      <div className="grid grid-cols-2 gap-2.5 mb-1 items-stretch">
        <button
          onClick={() => setPlano("mensal")}
          className={`rounded-2xl border-2 overflow-hidden transition-all flex flex-col text-center ${plano === "mensal" ? "border-accent shadow-[0_12px_28px_-14px_rgba(0,0,0,.35)]" : "border-border"} bg-white text-[#16121c]`}
        >
          <span className="h-[22px]" aria-hidden />
          <span className="text-[30px] font-black leading-none">1</span>
          <span className="text-[12.5px] font-bold text-black/45">mês</span>
          <span className="text-[16px] font-extrabold mt-2">{APP_PRECOS.mensal.preco}</span>
          <span className="text-[10px] font-semibold text-black/40">por mês</span>
          <span className="mx-4 my-2 border-t border-black/10" aria-hidden />
          {/* v83.1 (dono): "todo mês, pra sempre" assustava o comprador DA
              coluna — âncora de aluguel mora na comparação do vitalício, não
              no produto. Verdade do pré-pago: renovação manual. */}
          <span className="text-[10.5px] font-semibold text-black/45 pb-3 px-2 leading-tight">
            {loja.mensalVista ? "renova só se você quiser" : "cancele quando quiser"}
          </span>
        </button>
        <button
          onClick={() => setPlano("vitalicio")}
          className={`rounded-2xl border-2 overflow-hidden transition-all flex flex-col text-center ${plano === "vitalicio" ? "border-accent shadow-[0_14px_30px_-14px_rgba(0,0,0,.4)]" : "border-border"} bg-white text-[#16121c]`}
        >
          <span className={`text-[10px] font-extrabold tracking-wide py-1 ${plano === "vitalicio" ? "bg-accent text-white" : "bg-accent/10 text-accent"}`}>
            {vitalicio ? "MELHOR ESCOLHA" : "MELHOR PREÇO"}
          </span>
          <span className="text-[21px] font-black leading-[1.05] mt-1.5 px-1 tracking-tight">
            {vitalicio ? "Pra sempre" : "12 meses"}
          </span>
          <span className="text-[16px] font-extrabold mt-1.5">
            {(vitalicio ? APP_PRECOS.vitalicio97 : APP_PRECOS.anual97).preco}
          </span>
          <span className="text-[10px] font-semibold text-black/40">{vitalicio ? "vitalício · uma única vez" : "R$ 8,16/mês"}</span>
          <span className="mx-4 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-3 px-2 leading-tight">
            {vitalicio ? <>4 meses de mensal =<br /><b className="text-black/60">CORE pra sempre</b></> : <>{APP_PRECOS.anual97.preco} por 1 ano<br />sem renovação</>}
          </span>
        </button>
      </div>

      {/* ══ DELIBERAÇÃO (v83, autópsia 28/08): 66-73% de quem chega no offer
          não toca em NADA; quem lê 60s+ converte 44%. Isto é o material de
          leitura — prova REAL (feedbacks do Instagram, curadoria do dono,
          os mesmos do funil web). Só no funil, onde o recap sozinho não
          bastava. v83.3 (dono): 5 depoimentos GIRANDO num slot só (Cal AI
          roda reviews no paywall assim); a linha "🔒 Compra única" morreu —
          o legal sob o CTA já diz "pagamento único pelo Google Play". ══ */}
      {contexto === "funil" && (
        <div className="mt-3">
          <CarrosselDepoimentos />
        </div>
      )}

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
          {/* Varredura v81: a barra real mede ~250-270px no estado base (a
              linha legal quebra em 2 em tela de 360px) — spacer menor deixava
              a barra COBRINDO o fim do conteúdo. v83.3: −34px (linha da
              espera saiu da barra; a info mora no overlay do toque). */}
          <div className={pendente || erro || resgatePix || pixVencendo ? "h-[344px]" : "h-[240px]"} aria-hidden />
          <div className="fixed bottom-0 inset-x-0 z-[60] pointer-events-none">
            <div className="max-w-sm mx-auto px-5 pb-3 pt-9 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-auto">
              {blocoAcao}
              {contexto === "funil" && (
                <p className="text-[10px] text-muted-foreground/80 text-center mt-1.5">
                  <button
                    className="underline underline-offset-2"
                    onClick={async () => {
                      trackEvent("app_restore_paywall", {});
                      /* Varredura v83.4: restaurar é ação de RESOLUÇÃO — desarma a
                         reabertura automática (senão a folha abria em cima do restore
                         em voo — pagante reinstalado cancela a folha e corre pra cá) e
                         recolhe a caixa. Restore falho ganha voz: silêncio = botão morto. */
                      setReabrindoEm(null);
                      if (contagemRef.current) { window.clearInterval(contagemRef.current); contagemRef.current = null; }
                      setResgatePix(false);
                      const rc = await import("@/lib/revenuecat");
                      if (await rc.restaurar()) { window.location.href = "/"; return; }
                      setErro("Nenhuma compra encontrada nesta conta Google. Se pagou agora há pouco, espera 1 minuto e tenta de novo.");
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
