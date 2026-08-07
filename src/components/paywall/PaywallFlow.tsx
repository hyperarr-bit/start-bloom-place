import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, X, ShieldCheck, Gift,
  Wallet, BellRing, Target, BarChart3, Unlock, MessageCircleHeart, TrendingUp, FileDown,
  CalendarDays, Flame, Dumbbell, Salad, HeartPulse, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { WinbackWheel } from "@/components/retention/WinbackWheel";
import { PixCheckout, type PixOffer } from "@/components/paywall/PixCheckout";
import { isNativeShell, APP_PRECOS } from "@/lib/native-shell";
// (TrialTimeline saiu em 06/08 — o app vitalício usa a GuaranteeTimeline da web)
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { restaurar, initRevenueCat, estadoRevenueCat, comprarVitalicio, motivoUltimaCompra } from "@/lib/revenuecat";
import { BoasVindasPago } from "@/components/onboarding/BoasVindasPago";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { GASTO_ANCHOR, VICTORY_PHRASE, AREAS, AREA_ANCHOR, ALL_MODULE_ICONS, type AreaKey } from "@/lib/funnel";

// "9 de agosto" — mês por extenso à mão, sem depender do ICU do WebView velho.

/**
 * Paywall autocontido (padrão Cal AI: hook → âncora → desconto → backup).
 * Usado em 2 contextos:
 *   - "funnel": passo `offer` do /comecar (depois do cadastro)
 *   - "app": gate de quem entrou sem pagar (TrialBanner, contas sem trial)
 * Exit (voltar do celular ou X) → roleta → downsell: VITALÍCIO R$14,90.
 * Compra acontece DENTRO do app (PixCheckout — QR + copia-e-cola + polling);
 * não existe mais redirect pra checkout externo.
 * Tudo interno: quem usa só renderiza <PaywallFlow context=... />.
 */

// Modelo 13/07: acesso VITALÍCIO, pagamento ÚNICO, SÓ Pix — dentro do app
// (PixCheckout). Motivo: dias 12-13 tiveram ~25 cliques no anual e 0 vendas
// no checkout hospedado da Cakto (caixa-preta). Preço mora na OFERTA da
// Cakto (secrets CAKTO_OFFER_*); estes valores são display — manter em par.
const PRICING = {
  lifetime: { total: "27,90" },
  downsell: { total: "14,90" }, // prêmio da roleta: vitalício com desconto
  anchor: "99,90", // valor de referência riscado (sem rótulo de "mensal")
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

/** Sinal de intenção de compra + abre o Pix in-app. A Compra (Purchase) em si
 *  continua server-side (CAPI da Cakto via webhook). */
function openPixIntent(offer: PixOffer, cta: string, context: string, open: (o: PixOffer) => void) {
  trackEvent("funnel_click", { cta, context });
  fireMetaEvent("InitiateCheckout", {
    content_name: offer,
    value: offer === "lifetime" ? 27.9 : 19.9,
    currency: "BRL",
  });
  open(offer);
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.15 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
});

/* ------------------------------------------------------ transformação (SVG) */

const CHART_LABEL: Record<AreaKey, string> = {
  dinheiro: "Seu controle do dinheiro",
  rotina: "Sua consistência",
  corpo: "Sua evolução",
  saude: "Seu cuidado com você",
  metas: "Sua distância até a meta",
};

function TransformChart({ label = CHART_LABEL.dinheiro }: { label?: string }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 overflow-hidden">
      <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-accent" /> {label}
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
        {/* halo do ponto final: entra uma vez e para. Antes pulsava pra
            sempre — mais uma camada animada por cima de uma área que rola,
            que é o que faz aparelho simples errar o repaint. */}
        <motion.circle
          cx="306" cy="20" r="10" fill="hsl(var(--accent) / 0.25)"
          initial={{ scale: 0 }}
          animate={{ scale: [0.6, 1.15, 1] }}
          transition={{ delay: 1.85, duration: 0.9 }}
        />
      </svg>
      {/* right-12 e não right-4 (27/07): medido no aparelho, o ponto final do
          gráfico (349→373px) caía EM CIMA do fim do chip (292→375px) e o
          rótulo lia "Com o COR". Agora o chip para antes do ponto. */}
      <motion.span
        {...stagger(9)}
        className="absolute right-12 top-11 text-[11px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5"
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

// Value stack por área de entrada (funil vitrine): a killer feature da dor
// escolhida vem primeiro (serial position); a amplitude é bônus, não promessa.
const STACKS: Record<AreaKey, Array<{ Icon: typeof Wallet; tile: string; title: string; sub: string }>> = {
  dinheiro: [
    { Icon: Wallet, tile: "bg-amber-100 text-amber-700", title: "Finanças completo", sub: "gastos, saldo e visão do mês" },
    { Icon: BellRing, tile: "bg-rose-100 text-rose-600", title: "Contas a vencer", sub: "lembretes antes do juros" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas e desejos", sub: "progresso que dá vontade" },
    { Icon: BarChart3, tile: "bg-violet-100 text-violet-700", title: "Saúde financeira", sub: "score, relatórios e simuladores" },
  ],
  rotina: [
    { Icon: CalendarDays, tile: "bg-rose-100 text-rose-600", title: "Rotina semanal", sub: "sua semana inteira, hora a hora" },
    { Icon: Flame, tile: "bg-amber-100 text-amber-700", title: "Hábitos e streaks", sub: "consistência que dá orgulho" },
    { Icon: BellRing, tile: "bg-violet-100 text-violet-700", title: "Tarefas e urgências", sub: "nada mais esquecido" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas e desejos", sub: "progresso que dá vontade" },
  ],
  corpo: [
    { Icon: Dumbbell, tile: "bg-violet-100 text-violet-700", title: "Treino completo", sub: "plano, cargas e progressão" },
    { Icon: Salad, tile: "bg-emerald-100 text-emerald-700", title: "Dieta e cardápio", sub: "refeição por refeição" },
    { Icon: BarChart3, tile: "bg-amber-100 text-amber-700", title: "Progresso visível", sub: "cada treino registrado" },
    { Icon: Flame, tile: "bg-rose-100 text-rose-600", title: "Constância", sub: "streaks que te seguram firme" },
  ],
  saude: [
    { Icon: HeartPulse, tile: "bg-rose-100 text-rose-600", title: "Saúde no dia a dia", sub: "água, sono e energia" },
    { Icon: BellRing, tile: "bg-amber-100 text-amber-700", title: "Vitaminas na hora", sub: "lembrete + controle de estoque" },
    { Icon: BarChart3, tile: "bg-violet-100 text-violet-700", title: "Evolução do corpo", sub: "peso, medidas e exames" },
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Autocuidado", sub: "pequenas vitórias diárias" },
  ],
  metas: [
    { Icon: Target, tile: "bg-emerald-100 text-emerald-700", title: "Metas com plano", sub: "visão, passos e prazo" },
    { Icon: CalendarDays, tile: "bg-violet-100 text-violet-700", title: "Linha do tempo", sub: "6 meses, 1, 3 e 5 anos" },
    { Icon: BarChart3, tile: "bg-amber-100 text-amber-700", title: "Sua evolução visível", sub: "roda da vida + progresso" },
    { Icon: MessageCircleHeart, tile: "bg-rose-100 text-rose-600", title: "Diário e humor", sub: "gratidão pra manter o pique" },
  ],
};

function ValueStack({ area }: { area: AreaKey }) {
  const stack = STACKS[area] ?? STACKS.dinheiro;
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {stack.map((s, i) => (
          <motion.div key={s.title} {...stagger(2 + i)} className="rounded-2xl border border-border bg-card p-3 text-left">
            <span className={`inline-grid place-items-center w-9 h-9 rounded-xl ${s.tile} mb-2`}>
              <s.Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="text-[13px] font-bold leading-tight">{s.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.sub}</div>
          </motion.div>
        ))}
      </div>
      {area === "dinheiro" ? (
        /* Mata a objeção nº 1 ("vou ter que digitar tudo?") — destaque próprio */
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
      ) : (
        /* Funil vitrine: a amplitude entra como bônus concreto, em 1 linha */
        <motion.div {...stagger(6)} className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3 text-left">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent text-accent-foreground shrink-0">
            <LayoutGrid className="w-[18px] h-[18px]" />
          </span>
          <div>
            <div className="text-[13px] font-bold leading-tight">16 módulos inclusos, sem pagar mais</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              Finanças, estudos, casa, leitura, pet… a vida inteira no mesmo app.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Funil vitrine: no lugar da comparação com planilha (que é de finanças),
 *  a prova de amplitude — os 16 módulos. TODOS lêem como inclusos (check em
 *  cada): destacar só 5 fazia o lead achar que os cinza eram bloqueados. */
function ModulesIncludedCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-left">
          Tudo isso incluso
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5">
          <Check className="w-3 h-3" strokeWidth={3.5} /> 16/16
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {ALL_MODULE_ICONS.map((m) => (
          <div key={m.label} className="relative rounded-xl border border-accent/30 bg-accent/[0.05] p-1.5 flex flex-col items-center gap-0.5">
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent text-accent-foreground grid place-items-center shadow-sm">
              <Check className="w-2 h-2" strokeWidth={4} />
            </span>
            <span className="text-base leading-none">{m.emoji}</span>
            <span className="text-[9px] font-semibold text-foreground leading-none">{m.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Acesso completo a todos — nada é cobrado à parte.
      </p>
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

/** Coluna direita das âncoras: preço vitalício (web) ou o mensal-do-anual
 *  (shell — copy de assinatura, zero menção a vitalício no app das lojas). */
function AnchorPriceCol() {
  if (isNativeShell()) {
    // 06/08: app virou vitalício — mesma âncora da web, preço do Play.
    return (
      <div className="pl-3 text-center">
        <p className="text-[11px] text-muted-foreground leading-tight mb-1">CORE vitalício,<br />pra enxergar tudo</p>
        <p className="text-xl font-extrabold text-accent tracking-tight">{APP_PRECOS.vitalicio.preco}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></p>
      </div>
    );
  }
  return (
    <div className="pl-3 text-center">
      <p className="text-[11px] text-muted-foreground leading-tight mb-1">CORE vitalício,<br />pra enxergar tudo</p>
      <p className="text-xl font-extrabold text-accent tracking-tight">R$ {PRICING.lifetime.total}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></p>
    </div>
  );
}

/** Contraste "o que some por ano" vs "o que o CORE custa" — usa a estimativa
 *  que a própria pessoa deu no quiz. Sem resposta útil, não renderiza nada. */
function AnchorCard({ gasto }: { gasto: string }) {
  const anchor = GASTO_ANCHOR[gasto] ?? null;
  // "Não faço ideia" era null → a tela de venda perdia a âncora JUSTO pro
  // segmento mais perdido (dado 18–20/07: 29 das 67 mortes silenciosas no
  // paywall). Não inventamos número: vendemos a própria incerteza como dor.
  if (!anchor && gasto === "Não faço ideia") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="pr-3 text-center">
            <p className="text-[11px] text-muted-foreground leading-tight mb-1">Somem por mês,<br />sem você ver</p>
            <p className="text-xl font-extrabold text-destructive/80 tracking-tight">R$ ???</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">o que não se vê,<br />não se controla</p>
          </div>
          <AnchorPriceCol />
        </div>
      </div>
    );
  }
  if (!anchor) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">Somem por ano,<br />pela sua estimativa</p>
          <p className="text-xl font-extrabold text-destructive/80 tracking-tight">{anchor.year}</p>
        </div>
        <AnchorPriceCol />
      </div>
    </div>
  );
}

/** Âncora de custo das trilhas de vida: o custo de CONTINUAR ASSIM
 *  (recomeços/sintomas) vs o preço por mês. Espelha o AnchorCard de finanças. */
function AreaAnchorCard({ area }: { area: Exclude<AreaKey, "dinheiro"> }) {
  const anchor = AREA_ANCHOR[area];
  if (!anchor) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">Continuar assim<br />custa</p>
          <p className="text-lg font-extrabold text-destructive/80 tracking-tight leading-tight">{anchor.pain}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{anchor.painSub}</p>
        </div>
        <div className="pl-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">Com o CORE,<br />sai por</p>
          <p className="text-xl font-extrabold text-accent tracking-tight">
            {isNativeShell()
              ? <>{APP_PRECOS.vitalicio.preco}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></>
              : <>R$ {PRICING.lifetime.total}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></>}
          </p>
        </div>
      </div>
    </div>
  );
}

const TRUST_CHIPS = [
  { emoji: "🇧🇷", label: "Pix na hora" },
  { emoji: "🛡️", label: "Garantia de 7 dias" },
  { emoji: "♾️", label: "Sem mensalidade" },
];

// Shell: vitalício igual à web — só o "Pix na hora" fica de fora (a palavra
// Pix não pode existir dentro do app da loja; quem cobra é o Play Billing).
const TRUST_CHIPS_APP = [
  { emoji: "🛡️", label: "Garantia de 7 dias" },
  { emoji: "♾️", label: "Sem mensalidade" },
  { emoji: "📱", label: "16 módulos inclusos" },
];

function TrustChips() {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {(isNativeShell() ? TRUST_CHIPS_APP : TRUST_CHIPS).map((c) => (
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

/** Card único do VITALÍCIO: a estrela visual da oferta — borda gradiente,
 *  glow e preço grande centralizado (padrão dos paywalls mobile premium). */
function LifetimeCard() {
  return (
    <div className="relative w-full rounded-3xl p-[2px] bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_44px_-14px_hsl(var(--accent)/0.55)]">
      <div className="relative rounded-[calc(1.5rem-2px)] bg-white px-4 pt-5 pb-4 overflow-hidden text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 w-60 h-28 rounded-full"
          style={{ background: "hsl(var(--accent) / 0.14)", filter: "blur(28px)" }}
        />
        <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-widest mb-3">
          ACESSO VITALÍCIO
        </span>
        <div className="relative font-bold text-[15px] leading-tight mb-2">Pague 1x. Seu pra sempre.</div>
        <div className="relative flex items-end justify-center gap-2">
          <span className="text-[13px] text-muted-foreground line-through mb-[7px]">R$ {PRICING.anchor}</span>
          <span className="text-[42px] leading-none font-extrabold tracking-tight text-accent">
            R$ {PRICING.lifetime.total}
          </span>
        </div>
        <div className="relative text-[12px] font-semibold text-muted-foreground mt-1.5">pagamento único no Pix</div>
        <div className="relative grid grid-cols-3 gap-1.5 mt-3.5">
          {["16 módulos", "Sem mensalidade", "Garantia 7 dias"].map((c) => (
            <span key={c} className="rounded-full bg-secondary px-1 py-1.5 text-[10px] font-bold leading-tight">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- offer */

/** Rodapé legal do paywall do APP (24/07). Existe por dois motivos de loja:
 *  1. Restaurar compras e os links legais têm que estar visíveis onde se
 *     vende (padrão Cal AI/BitePal — e o Play cobra o "Restaurar").
 *  2. Quem não assina fica PRESO neste gate: sem esta saída, a exclusão de
 *     conta do menu é inalcançável, e o Google exige caminho in-app pra
 *     apagar conta. Aqui o não-pagante (e o revisor) consegue apagar. */
function AppLegalFooter() {
  const { user } = useAuth();
  const [excluirAberto, setExcluirAberto] = useState(false);
  return (
    <div className="pt-1 pb-2 text-center space-y-2">
      <button
        onClick={async () => {
          trackEvent("app_restore_paywall", {});
          const ok = await restaurar();
          if (ok) window.location.href = "/";
        }}
        className="text-[11.5px] font-semibold text-muted-foreground"
      >
        Restaurar compras
      </button>
      <p className="text-[11px] text-muted-foreground">
        <a href="/privacidade" className="underline underline-offset-2">Privacidade</a>
        {" · "}
        <a href="/termos" className="underline underline-offset-2">Termos</a>
        {user && (
          <>
            {" · "}
            <button onClick={() => setExcluirAberto(true)} className="underline underline-offset-2">
              Excluir conta
            </button>
          </>
        )}
      </p>
      <DeleteAccountDialog open={excluirAberto} onOpenChange={setExcluirAberto} />
    </div>
  );
}

function OfferScreen({
  context, answers, onEscape, onBuy,
}: { context: "funnel" | "app"; answers: Record<string, string>; onEscape: () => void; onBuy: (o: PixOffer) => void }) {
  const [showClose, setShowClose] = useState(false);
  // APP DAS LOJAS: o CTA abre o bottom sheet de assinatura (lógica BitePal);
  // nada de Pix, roleta ou downsell no shell — desconto só via oferta oficial.
  const nativo = isNativeShell();
  /* COMPRA EM UM TOQUE (05/08, dono: "o usuário tem que confirmar 2 vezes
     pra comprar").
     Era: CTA → nosso bottom sheet (2º botão) → folha do Google. O sheet
     nasceu quando o preço só existia DENTRO dele (padrão BitePal). Desde a
     v39 a tela já tem os dois cards com preço, a seleção, a linha de
     renovação e o Restaurar compras no rodapé — o sheet virou uma cópia do
     que está logo acima, e cada toque a mais entre a intenção e a folha do
     Google é gente que some. Agora o CTA compra o plano selecionado direto.
     O sheet continua vivo em /planos ("Meu acesso"), onde não há cards. */
  const [rc, setRc] = useState(estadoRevenueCat());
  /* Enquanto o catálogo da loja não respondeu, o CTA fica ATIVO de propósito:
     desabilitar por 1-2s cria um botão que não faz nada justo no instante de
     maior intenção (a pessoa toca, não acontece nada, ela desiste). Se ela
     tocar antes, a compra espera o init e segue sozinha. Só vira botão
     desabilitado + aviso se o init terminar SEM catálogo. */
  const [rcResolvido, setRcResolvido] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [erroCompra, setErroCompra] = useState<string | null>(null);
  /*
   * Resgate do "cancelou a folha do Google" (06/08). O dado do 1º dia de
   * campanha: 12 pessoas abriram a folha, 4 assinaram — e quem cancelava
   * voltava pra uma tela IDÊNTICA, sem uma palavra (o motivo era engolido).
   * O medo ali é a cobrança: a folha estampa o preço do ano inteiro mesmo
   * com trial. Zero fricção — a mensagem aparece sozinha, ninguém precisa
   * fazer nada; no mensal ela ainda oferece o caminho sem risco (trial).
   */
  const [resgate, setResgate] = useState<"vitalicio" | null>(null);
  const [celebrar, setCelebrar] = useState(false);
  const { get: getUserData } = useUserData();
  const nomeUsuario = getUserData<string>("core-user-name", "") || getUserData<string>("user-name", "");
  /* AS DUAS OFERTAS NA TELA, PESO IGUAL (04/08, terceira cobrança do dono —
     registro honesto: v35 pôs os cards só dentro do sheet, v36 pôs um link
     fantasma de mensal, e nenhum dos dois era o pedido. 06/08: a história
     acabou de outro jeito — o app virou produto ÚNICO (vitalício 47,90,
     decisão do dono), e o seletor de planos saiu inteiro. */
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  /*
   * X: só na WEB (27/07).
   *
   * O padrão Cal AI de mostrar o X com 1,8s de atraso continua valendo na web,
   * onde o desenho está calibrado. No APP ele sai junto com o "voltar", pela
   * mesma razão: sem downsell atrás, a saída não recupera ninguém — só entrega
   * a pessoa ao app com a oferta pela metade. O funil do dia 14 não tem X, e é
   * dele que estamos copiando o esqueleto.
   *
   * (Registro do meu erro: eu tinha dito ao dono que "o X nunca renderiza".
   * Olhei o useState(false) e não vi este setTimeout três linhas abaixo. Ele
   * renderizava sim, e o teste no aparelho é que mostrou.)
   */
  useEffect(() => {
    if (nativo) return;
    const t = setTimeout(() => setShowClose(true), 1800);
    return () => clearTimeout(t);
  }, [nativo]);

  /* O motor de compra agora liga AQUI (antes vivia no sheet). Junto vem a
     telemetria que revelou o "botão morto" de 02-03/08: sem ela, um CTA
     desabilitado por falta de catálogo não gerava evento nenhum e a
     campanha rodava com zero venda sem ninguém saber o porquê. */
  useEffect(() => {
    if (!nativo) return;
    trackEvent("app_paywall_rc", { fase: "abertura", estado: estadoRevenueCat(), context });
    initRevenueCat().then((e) => {
      setRc(e);
      setRcResolvido(true);
      trackEvent("app_paywall_rc", { fase: "apos_init", estado: e, context });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativo]);

  const assinarDireto = async () => {
    if (comprando) return;
    setComprando(true);
    setResgate(null);
    trackEvent("funnel_click", { cta: "app_paywall_cta", context, plano: "vitalicio" });
    // tocou antes do catálogo chegar: espera o init em vez de não fazer nada
    let estadoAtual = rc;
    if (estadoAtual !== "pronto") {
      estadoAtual = await initRevenueCat();
      setRc(estadoAtual);
      setRcResolvido(true);
    }
    if (estadoAtual !== "pronto") {
      trackEvent("app_compra_falhou", { motivo: "rc_" + estadoAtual, produto: APP_PRECOS.vitalicio.id, via: "paywall_direto" });
      setErroCompra("Não consegui falar com o Google Play agora. Tente de novo em instantes.");
      setComprando(false);
      return;
    }
    setErroCompra(null);
    const ativou = await comprarVitalicio();
    setComprando(false);
    /* Sem o painel intermediário, um toque que não abre a folha do Google
       fica INDISTINGUÍVEL de app quebrado. Cancelamento vira resgate (a
       mensagem certa pro medo certo); qualquer outro motivo, aviso com saída. */
    if (!ativou) {
      const motivo = motivoUltimaCompra();
      if (motivo === "cancelou") {
        setResgate("vitalicio");
        trackEvent("app_resgate_view", { plano: "vitalicio", context });
      } else if (motivo) {
        setErroCompra(
          motivo === "sem_entitlement"
            ? "A compra foi registrada, mas o acesso ainda não liberou. Toque em Restaurar compras aqui embaixo."
            : "Não consegui abrir o Google Play agora. Tente de novo em instantes.",
        );
      }
    }
    if (ativou) {
      trackEvent("app_sheet_success", { plano: "vitalicio", via: "paywall_direto" });
      // Celebra ANTES de navegar (27/07): o app não pode pintar primeiro,
      // senão a pessoa vê o módulo cru e a comemoração chega como aviso.
      setTimeout(() => setCelebrar(true), 700);
    }
  };

  /*
   * VOLTAR: dois caminhos, e misturá-los era o bug (27/07).
   *
   * O relato do dono foi "o paywall do nada recomeça, eu tô andando e reseta".
   * A causa: este componente empurrava uma entrada no histórico
   * (`history.pushState`) e ouvia `popstate` — só que os PASSOS DO FUNIL são
   * estado interno, sem entrada de histórico nenhuma. No gesto de voltar do
   * Android, o React Router e este ouvinte disputavam o mesmo evento: medido
   * no aparelho, o resultado era cair em /entrar. Fora do funil, o estado
   * perdido, e reentrar significava recomeçar do primeiro passo.
   *
   * WEB continua igual (pushState/popstate), porque lá o "voltar" é do
   * navegador e o comportamento está calibrado.
   *
   * APP DA LOJA (27/07, decisão do dono: "melhor tirar o voltar já que não tem
   * downsell"): NENHUMA rota de fuga. É o mesmo desenho do funil do dia 14 —
   * sem X, sem popstate, sem voltar que sai da oferta. A lógica é direta: a
   * fuga só se paga quando existe algo esperando do outro lado (roleta,
   * downsell de R$14,90). Sem isso, quem sai leva a oferta consigo e não
   * volta — a saída vira ralo, não válvula.
   *
   * Sem ouvinte aqui, o botão voltar do Android faz o padrão do Capacitor:
   * anda no histórico do webview. Quem veio da demo volta pra demo; quem
   * chegou direto sai do app. Ninguém fica preso, e ninguém escorrega pra
   * dentro do app com a oferta pela metade.
   */
  useEffect(() => {
    if (isNativeShell()) return;
    window.history.pushState({ paywall: true }, "");
    const onPop = () => escapeRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Quem para de interagir na oferta ia embora sem ver a roleta (fechar a aba
  // não dispara popstate). Duas coisas separadas aqui, e a distinção custou
  // dinheiro:
  //  - COMO abrir: automático, sem clique. O mini-card antigo exigia ação de
  //    quem já tinha desistido (só 11 de ~40 clicavam, 18–20/07). Isso fica.
  //  - QUANDO abrir: 15s foi longe DEMAIS (20→21/07). A roleta passou a
  //    sequestrar a tela de quem ainda estava LENDO — 15s parado sem rolar é
  //    leitura normal, não desistência. Resultado medido na mesma janela de
  //    horas: roleta vista +190%, mas venda de preço cheio −58% (12→5) com o
  //    downsell estável (9→8) e receita por paywall visto de R$11,16 → R$3,08.
  //    Ela não trouxe gente nova: converteu quem pagaria 27,90 em 14,90 e
  //    interrompeu o resto. Volta pros 40s, que é hora de quem TRAVOU mesmo.
  // Idle-timer de 40s REMOVIDO (23/07, fase 1): ele existia só pra disparar
  // a roleta, que saiu de cena — desconto nunca mais pra quem tá lendo.

  // Área de entrada (funil vitrine); sem área = funil padrão de finanças.
  const area: AreaKey = answers?.area && answers.area in AREAS ? (answers.area as AreaKey) : "dinheiro";
  const AREA_VICTORY_FALLBACK: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };
  const victory = VICTORY_PHRASE[answers?.vitoria ?? ""] ?? AREA_VICTORY_FALLBACK[area];

  // A celebração cobre a tela inteira e é ela quem navega — o app só monta
  // depois que a pessoa toca em começar.
  if (celebrar) {
    return <BoasVindasPago imediato nome={nomeUsuario} onComecar={() => { window.location.href = "/"; }} />;
  }

  return (
    <div className={`relative w-full max-w-sm mx-auto text-center pt-10 ${nativo ? "pb-72" : "pb-36"}`}>
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
        <motion.div {...stagger(2)}>
          {area === "dinheiro"
            ? <AnchorCard gasto={answers?.gasto ?? ""} />
            : <AreaAnchorCard area={area} />}
        </motion.div>
        <motion.div {...stagger(3)}><TransformChart label={CHART_LABEL[area]} /></motion.div>
        <ValueStack area={area} />
        {/* 06/08: vitalício no app → a timeline é a da GARANTIA, igual à web
            (a do trial morreu junto com a assinatura como produto de entrada) */}
        <GuaranteeTimeline />
        <motion.div {...stagger(9)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        {/* Shell: o PLANO é tela própria ANTES do cadastro (ordem 23/07) —
            aqui não se repete; o paywall só vende e o sheet só cobra. */}
        {!nativo && <motion.div {...stagger(10)}><LifetimeCard /></motion.div>}
        <motion.div {...stagger(11)}><TrustChips /></motion.div>
        {nativo && <AppLegalFooter />}
      </div>

      {/*
        CTA ANCORADO.

        TENTEI mandar esta barra por portal pro body, como fiz no CtaFixo do
        funil. NÃO FUNCIONA AQUI: o `body` do CORE tem `overflow-x: clip`
        (index.css, pra não deixar nada vazar na horizontal), e `clip` — ao
        contrário de `visible` — RECORTA descendentes `fixed`. Rolando a
        página, a barra caía fora do retângulo do body e simplesmente não era
        pintada: existia no DOM, media certo, e era invisível. Descobri
        tirando print do aparelho parado, não lendo código.

        Fica no lugar. O pulso infinito do botão é que saiu — era uma camada
        animada pra sempre por cima de uma área que rola, que é o que faz
        aparelho simples errar o repaint (e o dono já tinha pedido menos
        agressividade no geral).
      */}
      <div
        // O degradê era curto demais (pt-8) e começava a desaparecer logo
        // acima do botão: os cards de trás apareciam FATIADOS na altura do
        // texto ("Finanças complet…" cortado no meio da letra), que é o que dá
        // aquela sensação de tela quebrada. Agora a área de fade é o dobro e
        // fica opaca por mais tempo — o conteúdo some por baixo em vez de ser
        // cortado.
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white from-55% via-white/90 to-transparent pt-16"
        style={{ paddingBottom: "calc(0.9rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {/* 06/08 (decisão do dono): produto ÚNICO no app — vitalício
              R$ 47,90, espelho da web. Seletor de planos morreu junto com a
              assinatura como produto de entrada; o rodapé é só CTA + legal. */}
          {/*
            PULSO: sai no APP, FICA na web (28/07).

            Tirei o pulso pra matar o repaint fantasma do WebView Android. Só
            que este componente também é o paywall do /comecar, que está
            rodando anúncio agora — e o pulso ali é elemento de conversão
            calibrado (padrão Cal AI), não enfeite. Deixar a correção de um bug
            de Android apagar um elemento de venda da web seria embutir uma
            mudança por TEORIA junto de uma por DEFEITO: se a conversão caísse
            semana que vem, ninguém saberia qual das duas foi.

            Então o pulso é condicional: aparelho não pulsa, web continua igual
            ao que está medido hoje.
          */}
          <motion.div
            {...(nativo ? {} : { animate: { scale: [1, 1.02, 1] }, transition: { duration: 1.9, repeat: Infinity, ease: "easeInOut" } })}
          >
            <Button
              size="lg"
              disabled={nativo && ((rcResolvido && rc !== "pronto") || comprando)}
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)] disabled:opacity-60"
              onClick={() => {
                if (nativo) { void assinarDireto(); return; }
                openPixIntent("lifetime", "paywall_lifetime", context, onBuy);
              }}
            >
              {nativo
                ? (comprando
                    ? <>Abrindo o Google Play…</>
                    : <>Quero pra sempre — {APP_PRECOS.vitalicio.preco} <ArrowRight className="w-4 h-4" /></>)
                : <>Quero pra sempre — R$ {PRICING.lifetime.total} no Pix <ArrowRight className="w-4 h-4" /></>}
            </Button>
            {nativo && rcResolvido && rc !== "pronto" && !erroCompra && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                As compras estarão disponíveis em breve nesta versão.
              </p>
            )}
            {nativo && erroCompra && (
              <p className="text-[11.5px] text-center mt-2 font-medium text-foreground/80">{erroCompra}</p>
            )}
            {nativo && resgate && (
              <p className="text-[11.5px] text-center mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
                Fica tranquilo: é <b>pagamento único</b> — nenhuma mensalidade escondida.
                E se não curtir, a <b>Garantia de 7 dias</b> devolve 100% em 1 mensagem.
              </p>
            )}
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {nativo
                ? <>Pagamento <strong className="text-foreground font-semibold">único</strong> de {APP_PRECOS.vitalicio.preco} · sem mensalidade · Garantia de 7 dias</>
                : <>Pagamento <strong className="text-foreground font-semibold">único</strong> de R$ {PRICING.lifetime.total} no Pix · sem mensalidade · Garantia de 7 dias</>}
            </span>
          </p>
        </div>
      </div>

    </div>
  );
}

/* -------------------------------------------------------------- downsell */

type PropsDownsell = { context: "funnel" | "app"; onDismiss: () => void; onBuy: (o: PixOffer) => void };

// Segunda trava, colada no conteúdo proibido: oferta de VITALÍCIO por R$ 14,90
// no Pix não pode existir dentro do app da loja, venha de onde vier. Separado
// em wrapper porque os hooks abaixo não podem rodar condicionalmente.
function DownsellScreen(p: PropsDownsell) {
  return isNativeShell() ? null : <DownsellWeb {...p} />;
}

function DownsellWeb({ context, onDismiss, onBuy }: PropsDownsell) {
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
        PRÊMIO DA ROLETA
      </motion.div>
      <motion.h2 {...stagger(1)} className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        CORE VITALÍCIO por<br /><span className="text-accent">R$ {PRICING.downsell.total}</span>
      </motion.h2>
      <motion.p {...stagger(2)} className="text-muted-foreground text-sm leading-relaxed mb-4">
        Pagamento único no Pix — seu pra sempre, sem mensalidade nunca. Garantia de 7 dias.
      </motion.p>

      <motion.div {...stagger(3)} className="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-accent bg-accent/10 rounded-full px-4 py-1.5 mb-5">
        ⏳ Expira em {mm}:{ss}
      </motion.div>

      <motion.div {...stagger(4)} className="rounded-2xl border-2 border-accent bg-accent/[0.04] p-4 mb-3 text-left shadow-[0_10px_34px_-12px_hsl(var(--accent)/0.5)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-[15px]">Vitalício com prêmio</div>
            <div className="text-[11px] text-muted-foreground">Todos os 16 módulos · pagamento único no Pix</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-muted-foreground line-through">R$ {PRICING.lifetime.total}</div>
            <div className="font-extrabold text-2xl leading-none text-accent">
              R$ {PRICING.downsell.total}
            </div>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full h-[52px] text-base font-bold mt-3 rounded-full"
          onClick={() => openPixIntent("downsell", "downsell_lifetime", context, onBuy)}
        >
          Resgatar meu prêmio <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>

      <motion.div {...stagger(5)}>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 justify-center mb-5">
          <ShieldCheck className="w-3.5 h-3.5" /> Garantia de 7 dias · Pix na hora · sem mensalidade
        </p>

        <div>
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground/70 underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            Continuar sem o prêmio
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
  // Pix in-app: quando setado, o overlay PixCheckout cobre o paywall.
  // (O antigo "resgate do checkout_return" morreu junto com o redirect —
  // ninguém mais SAI do app pra pagar.)
  const [pixOffer, setPixOffer] = useState<PixOffer | null>(null);

  // Respostas do quiz: prop (funil na mesma sessão) ou localStorage
  // (volta do OAuth / gate in-app de quem veio do funil).
  const [quiz] = useState<Record<string, string>>(() => {
    if (answers && Object.keys(answers).length) return answers;
    try { return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}"); } catch { return {}; }
  });

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

  /*
   * SEM overflow-y-auto (27/07). Isso criava um SCROLLER ANINHADO: a página
   * rolava por fora e o paywall rolava por dentro. Com uma barra `fixed` por
   * cima, o WebView do Android invalidava só um pedaço da superfície e o
   * conteúdo aparecia PINTADO DUAS VEZES, deslocado — o "mini bug" que o dono
   * filmou (dá pra ver "R$ 1.200" e "SEU CONTROLE DO DINHEIRO" em dobro no
   * meio do arrasto). A página inteira rola sozinha; o scroller de dentro
   * nunca precisou existir.
   */
  return (
    <div style={LIGHT_VARS} className="min-h-dvh w-full bg-white text-foreground">
      {pixOffer && (
        <PixCheckout offer={pixOffer} context={context} onClose={() => setPixOffer(null)} />
      )}
      <div className="px-5">
        <AnimatePresence mode="wait">
          <motion.div key={phase} {...fade}>
            {phase === "offer" && (
              <OfferScreen
                context={context}
                answers={quiz}
                onEscape={() => {
                  // DOWNSELL OFF (23/07, fase 1 da reforma): sem roleta/14,90
                  // em lugar NENHUM — X/voltar entra no app (o gate de trial
                  // segura). Ticket 100% preço cheio → sobe o cost cap. Dado
                  // que sustenta: 20-21/07, roleta agressiva derrubou receita
                  // por paywall visto de R$11,16 pra R$3,08 (canibalizava).
                  trackEvent(isNativeShell() ? "app_paywall_close" : "funnel_click", isNativeShell() ? {} : { cta: "paywall_escape", context });
                  if (context !== "funnel") return;
                  const a = quiz?.area && quiz.area in AREAS ? (quiz.area as AreaKey) : "dinheiro";
                  navigate(`/${AREAS[a].module}`);
                }}
                onBuy={setPixOffer}
              />
            )}
            {/* Roleta e downsell são de VITALÍCIO no Pix — nunca no app da loja
                (trava de 25/07). Hoje nada chama setPhase("wheel"), então o
                ramo está morto; a guarda existe justamente porque ele está a
                uma linha de reviver dentro do binário. */}
            {phase === "wheel" && !isNativeShell() && (
              <div className="w-full max-w-sm mx-auto min-h-dvh grid place-items-center py-10">
                <WinbackWheel attemptId={null} prizeLabel="VITALÍCIO R$14,90" quick onSpinComplete={() => setPhase("downsell")} />
              </div>
            )}
            {phase === "downsell" && !isNativeShell() && (
              <div className="min-h-dvh grid place-items-center">
                <DownsellScreen
                  context={context}
                  onBuy={setPixOffer}
                  // Recusou o downsell: no funil entra no app (bloqueado) — na
                  // ÁREA que escolheu, se veio do funil vitrine; no gate in-app
                  // volta pra oferta (continua bloqueado).
                  onDismiss={() => {
                    if (context !== "funnel") { setPhase("offer"); return; }
                    const a = quiz?.area && quiz.area in AREAS ? (quiz.area as AreaKey) : "dinheiro";
                    navigate(`/${AREAS[a].module}`);
                  }}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
