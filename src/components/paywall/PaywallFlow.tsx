import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, X, ShieldCheck, Loader2, Gift,
  Wallet, BellRing, Target, BarChart3, Unlock, MessageCircleHeart, TrendingUp, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { WinbackWheel } from "@/components/retention/WinbackWheel";
import { GASTO_ANCHOR, VICTORY_PHRASE } from "@/lib/funnel";

/**
 * Paywall autocontido (padrão Cal AI: hook → âncora → desconto → backup).
 * Usado em 2 contextos:
 *   - "funnel": passo `offer` do /comecar (depois do cadastro)
 *   - "app": gate de quem entrou sem pagar (TrialBanner, contas sem trial)
 * Exit (voltar do celular ou X) → roleta → downsell com as ofertas limitadas.
 * Tudo interno: quem usa só renderiza <PaywallFlow context=... />.
 */

// Marca "saiu pro checkout": se voltar sem pagar, o paywall abre a roleta em
// vez de ficar mudo. Dado que motivou (desde o reset de 07/07): 15 cliques em
// "assinar" → só 3 geraram Pix — 12 pessoas recuaram no formulário da Cakto e
// voltaram pra um paywall idêntico, sem nenhuma reação da nossa parte.
const CHECKOUT_PENDING_KEY = "core_checkout_pending";

// Preços — TÊM que bater com as ofertas da Cakto
// (regular: 6g8iiak/xs9s7ws_914041 · limitada: 37pjpm8/6a3owem).
const PRICING = {
  monthly: { perMonth: "14,90" },
  annual: { perMonth: "3,90", total: "46,80", offPct: 74, perDay: "0,13" },
  downsellMonthly: { perMonth: "9,90", offPct: 33 },
  downsellAnnual: { perMonth: "2,90", total: "34,80", offPct: 80 },
};

// Paywall sempre claro, mesmo com o app em dark (padrão dos paywalls mobile).
const LIGHT_VARS = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 15%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "40 20% 96%",
  "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%",
  "--muted-foreground": "0 0% 45%",
  "--accent": "330 65% 50%",
  "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "0 0% 20%",
} as CSSProperties;

// VICTORY_PHRASE e GASTO_ANCHOR vêm de src/lib/funnel.ts (compartilhados com o quiz).

async function startCheckout(
  body: { billing: "monthly" | "annual"; offer?: "regular" | "limited" },
  cta: string,
  context: string,
  setLoading: (v: boolean) => void,
) {
  trackEvent("funnel_click", { cta, context });
  // Meta Pixel: intenção de compra (clicou pra assinar). A Compra em si vem
  // server-side da Cakto — aqui é só o sinal de checkout iniciado.
  fireMetaEvent("InitiateCheckout", {
    content_name: body.billing,
    value: body.billing === "annual" ? 46.8 : 14.9,
    currency: "BRL",
  });
  setLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke("cakto-checkout", {
      body: { ...body, attribution: getAttributionParams() },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.url) {
      try { localStorage.setItem(CHECKOUT_PENDING_KEY, JSON.stringify({ at: Date.now(), cta })); } catch { /* noop */ }
      window.location.href = data.url;
      return;
    }
    throw new Error("Checkout indisponível. Tente de novo.");
  } catch (err: any) {
    toast.error(err?.message || "Erro ao iniciar checkout");
    setLoading(false);
  }
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.15 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
});

/* ------------------------------------------------------ transformação (SVG) */

function TransformChart() {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 overflow-hidden">
      <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-accent" /> Seu controle do dinheiro
      </div>
      <svg viewBox="0 0 320 150" className="w-full h-auto" aria-hidden>
        {/* grade sutil */}
        {[40, 75, 110].map((y) => (
          <line key={y} x1="8" x2="312" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        {/* sem o CORE: continua no escuro */}
        <motion.path
          d="M 12 112 C 90 114, 200 120, 306 122"
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.45)"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
        />
        {/* com o CORE: sobe */}
        <motion.path
          d="M 12 112 C 80 108, 130 78, 190 52 C 235 33, 275 24, 306 20"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="3.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, delay: 0.45, ease: "easeOut" }}
        />
        {/* ponto final pulsando */}
        <motion.circle
          cx="306" cy="20" r="5" fill="hsl(var(--accent))"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1], opacity: 1 }}
          transition={{ delay: 1.75, duration: 0.5 }}
        />
        <motion.circle
          cx="306" cy="20" r="10" fill="hsl(var(--accent) / 0.25)"
          initial={{ scale: 0 }}
          animate={{ scale: [0.6, 1.15, 0.9, 1] }}
          transition={{ delay: 1.85, duration: 1.6, repeat: Infinity, repeatType: "mirror" }}
        />
      </svg>
      <motion.span
        {...stagger(9)}
        className="absolute right-4 top-11 text-[11px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5"
      >
        Com o CORE
      </motion.span>
      <span className="absolute right-4 bottom-9 text-[11px] font-semibold text-muted-foreground/70">
        do jeito que tá
      </span>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5">
        <span>Hoje</span><span>7 dias</span><span>1 mês</span><span>3 meses</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- seções */

const STACK = [
  { Icon: Wallet, tile: "bg-amber-100 text-amber-700", title: "Finanças completo", sub: "gastos, saldo e visão do mês" },
  { Icon: BellRing, tile: "bg-rose-100 text-rose-600", title: "Contas a vencer", sub: "lembretes antes do juros" },
  { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas e desejos", sub: "progresso que dá vontade" },
  { Icon: BarChart3, tile: "bg-violet-100 text-violet-700", title: "Saúde financeira", sub: "score, relatórios e simuladores" },
];

function ValueStack() {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {STACK.map((s, i) => (
          <motion.div key={s.title} {...stagger(2 + i)} className="rounded-2xl border border-border bg-card p-3 text-left">
            <span className={`inline-grid place-items-center w-9 h-9 rounded-xl ${s.tile} mb-2`}>
              <s.Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="text-[13px] font-bold leading-tight">{s.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.sub}</div>
          </motion.div>
        ))}
      </div>
      {/* Mata a objeção nº 1 ("vou ter que digitar tudo?") — destaque próprio */}
      <motion.div {...stagger(6)} className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3 text-left">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent text-accent-foreground shrink-0">
          <FileDown className="w-[18px] h-[18px]" />
        </span>
        <div>
          <div className="text-[13px] font-bold leading-tight">Importa o extrato do seu banco</div>
          <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Exporta do app do banco, importa aqui — o mês inteiro categorizado sem digitar nada.
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const TIMELINE = [
  { Icon: Unlock, title: "Hoje", sub: "Acesso total, na hora. Todas as funções, sem limite." },
  { Icon: ShieldCheck, title: "Até o dia 7", sub: "Não curtiu? Reembolso de 100% em 1 mensagem. Sem perguntas." },
  { Icon: MessageCircleHeart, title: "Do dia 8 em diante", sub: "Você só continua se estiver funcionando pra você." },
];

function GuaranteeTimeline() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Risco zero, de verdade
      </div>
      <div className="space-y-0">
        {TIMELINE.map((t, i) => (
          <motion.div key={t.title} {...stagger(6 + i)} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${i === 1 ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
                <t.Icon className="w-4 h-4" />
              </span>
              {i < TIMELINE.length - 1 && <span className="w-0.5 flex-1 min-h-4 bg-accent/20 my-1" />}
            </div>
            <div className={i < TIMELINE.length - 1 ? "pb-4" : ""}>
              <div className="text-[13.5px] font-bold leading-tight mt-1.5">{t.title}</div>
              <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">{t.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Contraste "o que some por ano" vs "o que o CORE custa" — usa a estimativa
 *  que a própria pessoa deu no quiz. Sem resposta útil, não renderiza nada. */
function AnchorCard({ gasto }: { gasto: string }) {
  const anchor = GASTO_ANCHOR[gasto] ?? null;
  if (!anchor) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">Somem por ano,<br />pela sua estimativa</p>
          <p className="text-xl font-extrabold text-destructive/80 tracking-tight">{anchor.year}</p>
        </div>
        <div className="pl-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">CORE Anual,<br />pra enxergar tudo</p>
          <p className="text-xl font-extrabold text-accent tracking-tight">R$ {PRICING.annual.total}</p>
        </div>
      </div>
    </div>
  );
}

const TRUST_CHIPS = [
  { emoji: "🇧🇷", label: "Pix aceito" },
  { emoji: "🛡️", label: "Garantia de 7 dias" },
  { emoji: "✌️", label: "Sem fidelidade" },
];

function TrustChips() {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {TRUST_CHIPS.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-semibold">
          <span>{c.emoji}</span> {c.label}
        </span>
      ))}
    </div>
  );
}

const COMPARE_ROWS: Array<{ label: string; core: boolean; sheet: boolean; bank: boolean }> = [
  { label: "Tudo num lugar só", core: true, sheet: false, bank: false },
  { label: "Extrato importado e categorizado", core: true, sheet: false, bank: false },
  { label: "Avisa antes da conta vencer", core: true, sheet: false, bank: false },
  { label: "Metas com progresso visual", core: true, sheet: true, bank: false },
  { label: "Dá vontade de abrir todo dia", core: true, sheet: false, bank: false },
];

function CompareTable() {
  const Mark = ({ on }: { on: boolean }) =>
    on ? (
      <span className="grid place-items-center w-5 h-5 rounded-full bg-accent/15 text-accent mx-auto">
        <Check className="w-3 h-3" strokeWidth={3.5} />
      </span>
    ) : (
      <X className="w-3.5 h-3.5 text-muted-foreground/40 mx-auto" />
    );
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-[1fr_44px_44px_44px] items-center gap-y-3">
        <span />
        <span className="text-[10px] font-extrabold text-accent text-center tracking-wide">CORE</span>
        <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">Planilha</span>
        <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">App do banco</span>
        {COMPARE_ROWS.map((r) => (
          <FragmentRow key={r.label} row={r} Mark={Mark} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ row, Mark }: { row: (typeof COMPARE_ROWS)[number]; Mark: (p: { on: boolean }) => JSX.Element }) {
  return (
    <>
      <span className="text-[12.5px] font-medium text-left leading-snug pr-2">{row.label}</span>
      <Mark on={row.core} />
      <Mark on={row.sheet} />
      <Mark on={row.bank} />
    </>
  );
}

function PlanPicker({
  billing, setBilling,
}: { billing: "monthly" | "annual"; setBilling: (b: "monthly" | "annual") => void }) {
  return (
    <div className="space-y-2.5 text-left">
      <button
        onClick={() => setBilling("annual")}
        className={`relative w-full rounded-2xl border-2 p-4 transition-all ${
          billing === "annual" ? "border-accent bg-accent/[0.05] shadow-[0_4px_20px_-8px_hsl(var(--accent)/0.45)]" : "border-border bg-card"
        }`}
      >
        <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wide">
          MAIS ESCOLHIDO · -{PRICING.annual.offPct}%
        </span>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[15px]">Anual</div>
            <div className="text-[12px] leading-tight">
              <span className="font-semibold text-foreground">R$ {PRICING.annual.total} hoje, 1x no ano</span>
              <span className="text-muted-foreground"> · R$ {PRICING.annual.perDay}/dia</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted-foreground line-through">R$ {PRICING.monthly.perMonth}</div>
            <div className="font-extrabold text-xl leading-none">
              R$ {PRICING.annual.perMonth}<span className="text-xs font-semibold text-muted-foreground">/mês</span>
            </div>
          </div>
        </div>
      </button>
      <button
        onClick={() => setBilling("monthly")}
        className={`w-full rounded-2xl border-2 p-4 transition-all ${
          billing === "monthly" ? "border-accent bg-accent/[0.05]" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[15px]">Mensal</div>
            <div className="text-[12px] text-muted-foreground leading-tight">
              Começa leve · cancela quando quiser
            </div>
          </div>
          <div className="font-extrabold text-xl leading-none">
            R$ {PRICING.monthly.perMonth}<span className="text-xs font-semibold text-muted-foreground">/mês</span>
          </div>
        </div>
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- offer */

function OfferScreen({
  context, answers, onEscape,
}: { context: "funnel" | "app"; answers: Record<string, string>; onEscape: () => void }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  // X aparece com atraso (padrão Cal AI) e voltar do celular vira downsell
  useEffect(() => {
    const t = setTimeout(() => setShowClose(true), 1800);
    window.history.pushState({ paywall: true }, "");
    const onPop = () => escapeRef.current();
    window.addEventListener("popstate", onPop);
    return () => { clearTimeout(t); window.removeEventListener("popstate", onPop); };
  }, []);

  // Quem para de interagir na oferta ia embora sem ver a roleta (fechar a aba
  // não dispara popstate). 40s parado → banner-presente que leva pro downsell.
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    let fired = false;
    const arm = () => {
      if (fired) return;
      clearTimeout(idle);
      idle = setTimeout(() => {
        fired = true;
        setShowGift(true);
        trackEvent("funnel_view", { step: "idle_gift" });
      }, 40_000);
    };
    const events = ["scroll", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(idle);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, []);

  const victory = VICTORY_PHRASE[answers?.vitoria ?? ""] ?? "ver pra onde seu dinheiro vai";

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pb-36 pt-10">
      <AnimatePresence>
        {showClose && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            onClick={onEscape}
            aria-label="Fechar"
            className="fixed top-3 right-3 z-[80] grid place-items-center w-9 h-9 rounded-full bg-black/[0.06] text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reveal */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </motion.div>
      <motion.h1 {...stagger(0)} className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu plano pra<br /><span className="text-accent">{victory}</span><br />está pronto
      </motion.h1>
      <motion.p {...stagger(1)} className="text-muted-foreground text-sm leading-relaxed mb-6">
        Você já viu como funciona. Agora é com os seus números de verdade.
      </motion.p>

      <div className="space-y-4">
        <motion.div {...stagger(2)}><AnchorCard gasto={answers?.gasto ?? ""} /></motion.div>
        <motion.div {...stagger(3)}><TransformChart /></motion.div>
        <ValueStack />
        <GuaranteeTimeline />
        <motion.div {...stagger(9)}><CompareTable /></motion.div>
        <motion.div {...stagger(10)}><PlanPicker billing={billing} setBilling={setBilling} /></motion.div>
        <motion.div {...stagger(11)}><TrustChips /></motion.div>
      </div>

      {/* Presente por inatividade → roleta/downsell */}
      <AnimatePresence>
        {showGift && (
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={() => { trackEvent("funnel_click", { cta: "idle_gift", context }); onEscape(); }}
            className="fixed inset-x-5 bottom-[104px] z-[76] max-w-sm mx-auto flex items-center gap-3 rounded-2xl border-2 border-accent bg-white p-3 text-left shadow-[0_14px_40px_-10px_hsl(var(--accent)/0.55)]"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent text-accent-foreground text-xl shrink-0">🎁</span>
            <span className="flex-1 leading-tight">
              <span className="block text-[13.5px] font-bold">Espera — você ganhou um giro</span>
              <span className="block text-[11.5px] text-muted-foreground">Roleta de boas-vindas com até 80% OFF</span>
            </span>
            <ArrowRight className="w-4 h-4 text-accent shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* CTA sticky */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          <Button
            size="lg"
            disabled={loading}
            className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
            onClick={() => startCheckout({ billing }, `paywall_${billing}`, context, setLoading)}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Desbloquear meu acesso <ArrowRight className="w-4 h-4" /></>}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {billing === "annual"
                ? <>Hoje: <strong className="text-foreground font-semibold whitespace-nowrap">R$ {PRICING.annual.total}</strong> (1x no ano) · Pix ou cartão · Garantia de 7 dias</>
                : <>Hoje: <strong className="text-foreground font-semibold whitespace-nowrap">R$ {PRICING.monthly.perMonth}</strong> por mês · Pix ou cartão · Garantia de 7 dias</>}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- downsell */

function DownsellScreen({ context, onDismiss }: { context: "funnel" | "app"; onDismiss: () => void }) {
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const dismiss = () => {
    trackEvent("funnel_click", { cta: "downsell_dismiss", context });
    onDismiss();
  };

  return (
    <div className="w-full max-w-sm mx-auto text-center pt-10 pb-10">
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 12 }}
        className="w-16 h-16 rounded-2xl bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_10px_30px_-6px_hsl(var(--accent)/0.6)]"
      >
        <Gift className="w-8 h-8" />
      </motion.div>
      <motion.div {...stagger(0)} className="inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold tracking-wide mb-3">
        PRÊMIO DA ROLETA: {PRICING.downsellAnnual.offPct}% OFF
      </motion.div>
      <motion.h2 {...stagger(1)} className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        CORE Anual por<br /><span className="text-accent">R$ {PRICING.downsellAnnual.perMonth}/mês</span>
      </motion.h2>
      <motion.p {...stagger(2)} className="text-muted-foreground text-sm leading-relaxed mb-4">
        Oferta única de boas-vindas — vale só nesta tela.
      </motion.p>

      <motion.div {...stagger(3)} className="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-accent bg-accent/10 rounded-full px-4 py-1.5 mb-5">
        ⏳ Expira em {mm}:{ss}
      </motion.div>

      <motion.div {...stagger(4)} className="rounded-2xl border-2 border-accent bg-accent/[0.04] p-4 mb-3 text-left shadow-[0_10px_34px_-12px_hsl(var(--accent)/0.5)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[15px]">Anual com prêmio</div>
            <div className="text-[11px] text-muted-foreground">R$ {PRICING.downsellAnnual.total} cobrado 1x ao ano</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted-foreground line-through">R$ {PRICING.monthly.perMonth}</div>
            <div className="font-extrabold text-2xl leading-none text-accent">
              R$ {PRICING.downsellAnnual.perMonth}<span className="text-xs font-semibold text-muted-foreground">/mês</span>
            </div>
          </div>
        </div>
        <Button
          size="lg"
          disabled={loading}
          className="w-full h-[52px] text-base font-bold mt-3 rounded-full"
          onClick={() => startCheckout({ billing: "annual", offer: "limited" }, "downsell_annual", context, setLoading)}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Resgatar meu prêmio <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </motion.div>

      <motion.div {...stagger(5)}>
        <Button
          variant="outline"
          disabled={loading}
          className="w-full h-11 text-sm font-semibold mb-4 rounded-full"
          onClick={() => startCheckout({ billing: "monthly", offer: "limited" }, "downsell_monthly", context, setLoading)}
        >
          Prefiro mensal: R$ {PRICING.downsellMonthly.perMonth}/mês (-{PRICING.downsellMonthly.offPct}%)
        </Button>

        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 justify-center mb-5">
          <ShieldCheck className="w-3.5 h-3.5" /> Garantia de 7 dias · Pix ou cartão · cancele quando quiser
        </p>

        <div>
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground/70 underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            Continuar sem desconto
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ flow */

export function PaywallFlow({
  context,
  answers,
}: {
  context: "funnel" | "app";
  answers?: Record<string, string>;
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"offer" | "wheel" | "downsell">("offer");
  const { isSubscribed } = useAuth();
  const subRef = useRef(isSubscribed);
  subRef.current = isSubscribed;
  const rescueDone = useRef(false);

  // Respostas do quiz: prop (funil na mesma sessão) ou localStorage
  // (volta do OAuth / gate in-app de quem veio do funil).
  const [quiz] = useState<Record<string, string>>(() => {
    if (answers && Object.keys(answers).length) return answers;
    try { return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}"); } catch { return {}; }
  });

  // Resgate do "voltei do checkout sem pagar": clicou em assinar, foi pra
  // Cakto e voltou → abre a roleta (→ downsell) em vez do mesmo paywall mudo.
  // Antes de disparar, CONFIRMA no servidor que não pagou. A espera cega de
  // 2,5s perdeu a corrida na venda de 10/07 (webhook chegou junto do retorno
  // e a pagante viu a roleta) — agora o check-subscription é consultado na
  // hora e a roleta só abre com "subscribed: false" fresco.
  useEffect(() => {
    // Timer PRECISA morrer com o componente: em 10/07 ele sobreviveu ao
    // desmonte do gate e registrou um checkout_return fantasma de uma pagante.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryRescue = () => {
      if (rescueDone.current) return;
      let marker: { at?: number } | null = null;
      try { marker = JSON.parse(localStorage.getItem(CHECKOUT_PENDING_KEY) || "null"); } catch { marker = null; }
      if (!marker?.at) return;
      const ageMs = Date.now() - marker.at;
      if (ageMs > 6 * 60 * 60 * 1000) {
        try { localStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* noop */ }
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (rescueDone.current) return;
        if (subRef.current) {
          // Já sabemos que pagou: marcador morre aqui, sem roleta.
          try { localStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* noop */ }
          return;
        }
        try {
          const { data } = await supabase.functions.invoke("check-subscription");
          if (data?.subscribed) {
            // Pagou — some com o marcador e nada de roleta.
            try { localStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* noop */ }
            return;
          }
        } catch { /* servidor indisponível: segue com o estado local */ }
        if (rescueDone.current || subRef.current) return;
        rescueDone.current = true;
        try { localStorage.removeItem(CHECKOUT_PENDING_KEY); } catch { /* noop */ }
        trackEvent("funnel_click", { cta: "checkout_return", context, mins: Math.round(ageMs / 60000) });
        setPhase("wheel");
      }, 2500);
    };
    tryRescue();
    const onVis = () => { if (document.visibilityState === "visible") tryRescue(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [context]);

  useEffect(() => {
    const name = context === "funnel" ? "funnel_view" : "paywall_view";
    trackEvent(name, context === "funnel" ? { step: phase === "offer" ? "offer" : phase } : { phase: `v2_${phase}` });
  }, [phase, context]);

  const fade = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div style={LIGHT_VARS} className="min-h-dvh w-full bg-white text-foreground overflow-y-auto">
      <div className="px-5">
        <AnimatePresence mode="wait">
          <motion.div key={phase} {...fade}>
            {phase === "offer" && (
              <OfferScreen context={context} answers={quiz} onEscape={() => setPhase("wheel")} />
            )}
            {phase === "wheel" && (
              <div className="w-full max-w-sm mx-auto min-h-dvh grid place-items-center py-10">
                <WinbackWheel attemptId={null} onSpinComplete={() => setPhase("downsell")} />
              </div>
            )}
            {phase === "downsell" && (
              <div className="min-h-dvh grid place-items-center">
                <DownsellScreen
                  context={context}
                  // Recusou o downsell: no funil entra no app (bloqueado);
                  // no gate in-app volta pra oferta (continua bloqueado).
                  onDismiss={() => { if (context === "funnel") navigate("/financas"); else setPhase("offer"); }}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
