/**
 * PAYWALL DO FUNIL W (29/08, desenho do dono): o LAYOUT do paywall da web que
 * dava ROI (PaywallDia14, braço B vencedor: reveal → âncora → transformação →
 * pilha de valor → preço → mural de depoimentos → laurels → confiança) com o
 * MOTOR do app que já provou dinheiro (RevenueCat: folha do Google, pendente
 * com "Já paguei", resgate Pix com reabertura automática).
 *
 * Diferenças deliberadas vs a web (cada uma com motivo):
 *  - R$ 97,90 VITALÍCIO via Google (core_vitalicio_97), não 27,90 Cakto;
 *  - SEM X e SEM roleta/downsell: no app a saída é a escada de resgate
 *    (1ª recusa → reabre a folha sozinha; a caixa oferece o mensal como
 *    saída dupla — o análogo provado do downsell da web);
 *  - SEM "garantia de 7 dias": era promessa própria da web (reembolso manual
 *    Cakto). No Google o reembolso é da Play — prometer garantia nossa aqui
 *    viraria dívida de suporte. No lugar: "pagamento único pelo Google Play";
 *  - SEM âncora de preço riscado (a web riscava o anchor do catálogo dela);
 *    a âncora honesta do app é "4 meses de mensal = seu pra sempre".
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey } from "@/lib/funnel";
import {
  TransformChart, ValueStack, ModulesIncludedCard, AnchorCard, AreaAnchorCard,
  MuralDepoimentos, TrustChips, CompareTable, CHART_LABEL,
} from "@/pages/funis/dia14/PaywallDia14";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: Math.min(i * 0.05, 0.3) },
});

/* A/B DO PREÇO (31/08, teste do dono): braço A = vitrine de UM preço só
 * (o desenho da web que dava ROI); braço B = vitalício herói + mensal
 * VISÍVEL logo abaixo, ambos selecionáveis. Sorteio 50/50 estável por
 * aparelho (localStorage) — a pessoa vê SEMPRE o mesmo braço, mesmo
 * recarregando. Forçar no QA: localStorage core-w-braco = "a" | "b". */
export type BracoW = "a" | "b";
const BRACO_KEY = "core-w-braco";
const sortearBraco = (): BracoW => {
  try {
    const j = localStorage.getItem(BRACO_KEY);
    if (j === "a" || j === "b") return j;
    const b: BracoW = Math.random() < 0.5 ? "a" : "b";
    localStorage.setItem(BRACO_KEY, b);
    return b;
  } catch { return "a"; }
};

/** Preço vitalício do app no formato que o LifetimeCard da web tinha.
 *  No braço B vira cartão SELECIONÁVEL (o mensal mora embaixo). */
function LifetimeCardW({ selecionavel = false, ativo = true, onSelect }: { selecionavel?: boolean; ativo?: boolean; onSelect?: () => void }) {
  return (
    <div
      onClick={selecionavel ? onSelect : undefined}
      role={selecionavel ? "button" : undefined}
      className={`relative w-full rounded-3xl p-[2px] transition-all ${selecionavel && !ativo ? "bg-black/10 shadow-none" : "bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_44px_-14px_hsl(var(--accent)/0.55)]"}`}
    >
      <div className="relative rounded-[calc(1.5rem-2px)] bg-white px-4 pt-5 pb-4 overflow-hidden text-center text-[#16121c]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 w-60 h-28 rounded-full"
          style={{ background: "hsl(var(--accent) / 0.14)", filter: "blur(28px)" }}
        />
        <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-widest mb-3">
          ACESSO VITALÍCIO
        </span>
        <div className="relative font-bold text-[15px] leading-tight mb-2">Pague 1x. Seu pra sempre.</div>
        <div className="relative text-[42px] leading-none font-extrabold tracking-tight text-accent">
          {APP_PRECOS.vitalicio97.preco}
        </div>
        <div className="relative text-[12px] font-semibold text-black/50 mt-1.5">
          pagamento único · Pix ou cartão na tela do Google
        </div>
        <div className="relative text-[11px] font-semibold text-black/40 mt-1">
          4 meses de mensal = CORE pra sempre
        </div>
        <div className="relative grid grid-cols-3 gap-1.5 mt-3.5">
          {["16 módulos", "Sem mensalidade", "Acesso na hora"].map((c) => (
            <span key={c} className="rounded-full bg-secondary px-1 py-1.5 text-[10px] font-bold leading-tight">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Braço B: o mensal renovável visível — hierarquia menor de propósito
 *  (o herói continua sendo o vitalício; isto é a alternativa, não a rival). */
function MensalCardW({ ativo, onSelect }: { ativo: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      role="button"
      className={`w-full rounded-2xl border-2 bg-white text-[#16121c] px-4 py-3 flex items-center gap-3 text-left transition-all ${ativo ? "border-accent shadow-[0_10px_26px_-14px_rgba(0,0,0,.4)]" : "border-black/10"}`}
    >
      <span className={`grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 ${ativo ? "border-accent" : "border-black/20"}`}>
        {ativo && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-extrabold leading-tight">Ou comece com 1 mês</span>
        <span className="block text-[11.5px] text-black/50 font-semibold">renova todo mês · cancela quando quiser</span>
      </span>
      <span className="text-[17px] font-extrabold shrink-0">{APP_PRECOS.mensal.preco}</span>
    </div>
  );
}

export function PaywallW({
  area, answers, onPagoSemConta,
}: { area: AreaKey; answers: Record<string, string>; onPagoSemConta: () => void }) {
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resgatePix, setResgatePix] = useState(false);
  const [reabrindoEm, setReabrindoEm] = useState<number | null>(null);
  const [pixVencendo, setPixVencendo] = useState(false);
  const pixVencendoJaFoi = useRef(false);
  const cancelamentos = useRef(0);
  const contagemRef = useRef<number | null>(null);
  const vivoRef = useRef(true);
  // Disponibilidade real: otimista até resposta NEGATIVA da loja (regra v81).
  const [vitalicioNaLoja, setVitalicioNaLoja] = useState<boolean | null>(null);
  // A/B do preço: A = só vitalício · B = vitalício + mensal visível.
  const [braco] = useState<BracoW>(() => sortearBraco());
  const [plano, setPlano] = useState<"vitalicio" | "mensal">("vitalicio");

  useEffect(() => {
    vivoRef.current = true;
    trackEvent("funnel_view", { step: "offer", funil: "w", area, braco });
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.prefetchVitalicio();
      if (!vivoRef.current) return;
      if (rc.estadoRevenueCat() === "pronto") setVitalicioNaLoja(rc.temVitalicio97());
    })();
    return () => {
      vivoRef.current = false;
      if (contagemRef.current) window.clearInterval(contagemRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desarmar = () => {
    setReabrindoEm(null);
    if (contagemRef.current) { window.clearInterval(contagemRef.current); contagemRef.current = null; }
  };

  const confirmarPagamento = async () => {
    setConferindo(true);
    try {
      const rc = await import("@/lib/revenuecat");
      const ok = (await rc.restaurar()) || (await rc.compraVitaliciaLocal()) || (await rc.compraAssinaturaLocal());
      if (ok) { trackEvent("funnel_click", { cta: "w_ja_paguei_ok", funil: "w" }); onPagoSemConta(); return; }
      setErro("Ainda não achei o pagamento. Se você acabou de pagar o Pix, espera uns segundos e toca de novo.");
    } catch { /* conferência nunca derruba o paywall */ }
    setConferindo(false);
  };

  const comprar = async (produto: "vitalicio" | "mensal") => {
    if (comprando) return;
    setErro(null);
    desarmar();
    setComprando(true);
    const abriuEm = Date.now();
    try {
      const rc = await import("@/lib/revenuecat");
      const idProduto = produto === "mensal" ? "core_mensal" : vitalicioNaLoja !== false ? "core_vitalicio_97" : "core_anual:coreanual97";
      const ok = produto === "mensal"
        ? await rc.comprar("core_mensal", { semTrial: true })
        : vitalicioNaLoja !== false
          ? await rc.comprarVitalicio("core_vitalicio_97")
          : await rc.comprarAnual97();
      // v88: o front do W não emitia sucesso — o funil marcava "pagou 0" com
      // dinheiro no caixa (o webhook cobria a verdade, o relatório não).
      if (ok) trackEvent("app_sheet_success", { produto: idProduto, funil: "w", braco });
      if (ok) { onPagoSemConta(); return; }
      // Recusa: a MESMA escada provada do PaywallAssinatura.
      const dentroDaFolha = (Date.now() - abriuEm) / 1000;
      const motivo = rc.motivoUltimaCompra();
      if (motivo === "pendente") {
        setPendente(true);
      } else if (motivo === "produto_ausente") {
        setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
      } else if (dentroDaFolha >= 30 && !pixVencendoJaFoi.current) {
        pixVencendoJaFoi.current = true;
        setPixVencendo(true);
        trackEvent("funnel_view", { step: "w_pix_vencendo", funil: "w" });
      } else if (dentroDaFolha < 20 && cancelamentos.current === 0) {
        cancelamentos.current += 1;
        setResgatePix(true);
        setReabrindoEm(4);
        trackEvent("funnel_view", { step: "w_resgate_pix", funil: "w" });
        contagemRef.current = window.setInterval(() => {
          setReabrindoEm((v) => {
            if (v === null) return null;
            if (v <= 1) {
              desarmar();
              void comprar(braco === "b" ? plano : "vitalicio");
              return null;
            }
            return v - 1;
          });
        }, 1000);
      } else {
        cancelamentos.current += 1;
      }
    } catch { setErro("O Google não concluiu o pagamento. Tenta de novo em instantes."); }
    setComprando(false);
  };

  const chartLabel = CHART_LABEL[area] ?? CHART_LABEL.dinheiro;
  const vitoria: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pb-40 pt-8">
      {/* Reveal (web) */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </motion.div>
      <h1 className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu plano pra<br /><span className="text-accent">{vitoria[area]}</span><br />está pronto
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Você já viu como funciona. Agora é com os seus números de verdade.
      </p>

      <div className="space-y-4">
        <motion.div {...stagger(0)}>
          {area === "dinheiro"
            ? <AnchorCard gasto={answers?.gasto ?? ""} preco="97,90" />
            : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco="97,90" />}
        </motion.div>
        <motion.div {...stagger(1)}><TransformChart label={chartLabel} /></motion.div>
        <ValueStack area={area} />
        <motion.div {...stagger(2)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        <motion.div {...stagger(3)} className="space-y-2.5">
          <LifetimeCardW
            selecionavel={braco === "b"}
            ativo={braco === "a" || plano === "vitalicio"}
            onSelect={() => { setPlano("vitalicio"); trackEvent("funnel_click", { cta: "w_plano", plano: "vitalicio", braco, funil: "w" }); }}
          />
          {braco === "b" && (
            <MensalCardW
              ativo={plano === "mensal"}
              onSelect={() => { setPlano("mensal"); trackEvent("funnel_click", { cta: "w_plano", plano: "mensal", braco, funil: "w" }); }}
            />
          )}
        </motion.div>
        <MuralDepoimentos area={area} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px] text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">+1000</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">aprovaram o CORE</div>
          </div>
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px]" aria-hidden>⚡</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">Na hora</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">acesso liberado</div>
          </div>
        </div>
        <motion.div {...stagger(4)}><TrustChips /></motion.div>
      </div>

      {/* CTA sticky — motor RC + escada de resgate */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              <b>Pagamento em processamento no Google.</b> Se você gerou um Pix, paga no app do seu banco —
              o acesso libera sozinho aqui.
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
              </button>
            </div>
          )}
          {pixVencendo && !pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              <b>Gerou o código Pix?</b> Ele vence em 5 minutos — paga agora no app do teu banco que o acesso libera sozinho.
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já paguei — atualizar"}
              </button>
            </div>
          )}
          {resgatePix && !pendente && !pixVencendo && (
            <div className="rounded-xl bg-[#e5f6f3] border border-[#b9e6df] text-[#0b6d62] text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              <b>Prefere pagar no Pix?</b> A tela do Google aceita Pix — abre de novo na hora, escolhe Pix na lista e copia o código.
              {reabrindoEm !== null ? (
                <span className="flex items-center justify-between mt-1.5">
                  <b>Reabrindo em {reabrindoEm}s…</b>
                  <button className="font-bold underline underline-offset-2" onClick={() => { desarmar(); trackEvent("funnel_click", { cta: "w_resgate_cancelou", funil: "w" }); }}>
                    Agora não
                  </button>
                </span>
              ) : (
                <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={comprando} onClick={() => void comprar("vitalicio")}>
                  Abrir de novo e pagar no Pix
                </button>
              )}
              {reabrindoEm === null && (
                <button className="block w-full text-center text-[11.5px] font-semibold mt-1 opacity-80 underline underline-offset-2 disabled:opacity-50" disabled={comprando} onClick={() => void comprar("mensal")}>
                  ou assina o mensal — {APP_PRECOS.mensal.preco}/mês · cancela quando quiser
                </button>
              )}
            </div>
          )}
          {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}

          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              disabled={comprando}
              onClick={() => {
                const escolha = braco === "b" ? plano : "vitalicio";
                trackEvent("funnel_click", { cta: "app_paywall_cta", produto: escolha === "mensal" ? "core_mensal" : "core_vitalicio_97", funil: "w", braco });
                void comprar(escolha);
              }}
            >
              {comprando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : braco === "b" && plano === "mensal"
                  ? <>Começar por {APP_PRECOS.mensal.preco}/mês <ArrowRight className="w-4 h-4" /></>
                  : <>Quero pra sempre — {APP_PRECOS.vitalicio97.preco} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {braco === "b" && plano === "mensal"
                ? <>Assinatura de {APP_PRECOS.mensal.preco}/mês pelo Google Play · Pix ou cartão · cancela quando quiser</>
                : <>Pagamento <strong className="text-foreground font-semibold">único</strong> pelo Google Play · Pix ou cartão · sem mensalidade</>}
            </span>
          </p>
        </div>
      </div>

      {/* Overlay anti-abandono na abertura da folha (motor do app) */}
      {comprando && (
        <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
          <div className="mx-auto max-w-[92%] rounded-2xl bg-[#16121c] text-white text-[12.5px] font-bold px-4 py-2.5 shadow-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Abrindo o pagamento — leva uns segundos, não fecha o app
          </div>
        </div>
      )}
    </div>
  );
}
