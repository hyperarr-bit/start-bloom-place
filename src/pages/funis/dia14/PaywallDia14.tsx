import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, X, ShieldCheck, Gift,
  Wallet, BellRing, Target, BarChart3, Unlock, MessageCircleHeart, TrendingUp, FileDown,
  CalendarDays, Flame, Dumbbell, Salad, HeartPulse, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { PixCheckout, PIX_PRICES, type PixOffer, type Step as PixStep } from "@/components/paywall/PixCheckout";
import { WinbackWheel, SLICES_FUNIL } from "@/components/retention/WinbackWheel";
import { isNativeShell } from "@/lib/native-shell";
import { ehApple } from "@/lib/loja";
import { GASTO_ANCHOR, VICTORY_PHRASE, AREAS, AREA_ANCHOR, ALL_MODULE_ICONS, type AreaKey } from "@/lib/funnel";
import { useAuth } from "@/hooks/use-auth";

/**
 * CÓPIA CONGELADA do paywall do DIA 14 (83c0d98, 14/07 22:30) — usada só pelo
 * funil de teste /funil-dia14. Não é importada por mais ninguém: mexer aqui
 * NÃO afeta o funil que está vendendo.
 *
 * Duas remoções pedidas pelo dono (24/07), o resto é idêntico ao original:
 *   - SEM downsell: a roleta e a oferta de R$14,90 saíram inteiras.
 *   - SEM X: nem o botão de fechar, nem popstate→fuga, nem o presente de 40s.
 * Só o PixCheckout continua compartilhado com o app de verdade — é o passo do
 * dinheiro, e é o que está testado e vendendo hoje.
 */

// Modelo 13/07: acesso VITALÍCIO, pagamento ÚNICO, SÓ Pix — dentro do app
// (PixCheckout). Motivo: dias 12-13 tiveram ~25 cliques no anual e 0 vendas
// no checkout hospedado da Cakto (caixa-preta). Preço mora na OFERTA da
// Cakto (secrets CAKTO_OFFER_*); estes valores são display — manter em par.
/* 03/09 (ordem do dono, "97,90 em tudo"): preço único na WEB. Esta tela abre
 * a MESMA oferta `lifetime` do checkout, e o gateway passou a cobrar 9790 —
 * display e cobrança andam juntos ou a tela vira promessa falsa.
 * A âncora riscada de 99,90 saiu: em cima de 97,90 ela anuncia 2% de desconto. */
const PRICING = {
  lifetime: { total: "97,90" },
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
    value: offer === "lifetime" ? 97.9 : 19.9,
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

export const CHART_LABEL: Record<AreaKey, string> = {
  dinheiro: "Seu controle do dinheiro",
  rotina: "Sua consistência",
  corpo: "Sua evolução",
  saude: "Seu cuidado com você",
  metas: "Sua distância até a meta",
};

export function TransformChart({ label = CHART_LABEL.dinheiro }: { label?: string }) {
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

export function ValueStack({ area }: { area: AreaKey }) {
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
export function ModulesIncludedCard() {
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

/** Contraste "o que some por ano" vs "o que o CORE custa" — usa a estimativa
 *  que a própria pessoa deu no quiz. Sem resposta útil, não renderiza nada. */
export function AnchorCard({ gasto, preco = PRICING.lifetime.total, precoSub = "1x, pra sempre", precoTitulo }: { gasto: string; preco?: string; precoSub?: string; precoTitulo?: React.ReactNode }) {
  const anchor = GASTO_ANCHOR[gasto] ?? null;
  /* 04/09: "Não faço ideia" é 42% de quem escolhe dinheiro e ficava SEM
   * âncora (return null). Sem inventar número: a coluna da esquerda vira a
   * própria dor — não saber — que é o que o produto resolve. */
  const semIdeia = !anchor && gasto === "Não faço ideia";
  if (!anchor && !semIdeia) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-3 text-center">
          {semIdeia ? (
            <>
              <p className="text-[11px] text-muted-foreground leading-tight mb-1">Pra onde vai<br />seu dinheiro hoje</p>
              <p className="text-xl font-extrabold text-destructive/80 tracking-tight">?</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">em 7 dias você sabe</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground leading-tight mb-1">Somem por ano,<br />pela sua estimativa</p>
              <p className="text-xl font-extrabold text-destructive/80 tracking-tight">{anchor!.year}</p>
            </>
          )}
        </div>
        <div className="pl-3 text-center">
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">{precoTitulo ?? <>CORE vitalício,<br />pra enxergar tudo</>}</p>
          <p className="text-xl font-extrabold text-accent tracking-tight">R$ {preco}<span className="block text-[10px] font-semibold text-muted-foreground">{precoSub}</span></p>
        </div>
      </div>
    </div>
  );
}

/** Âncora de custo das trilhas de vida: o custo de CONTINUAR ASSIM
 *  (recomeços/sintomas) vs o preço por mês. Espelha o AnchorCard de finanças. */
export function AreaAnchorCard({ area, preco = PRICING.lifetime.total, precoSub = "1x, pra sempre", precoTitulo }: { area: Exclude<AreaKey, "dinheiro">; preco?: string; precoSub?: string; precoTitulo?: React.ReactNode }) {
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
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">{precoTitulo ?? <>Com o CORE,<br />sai por</>}</p>
          <p className="text-xl font-extrabold text-accent tracking-tight">R$ {preco}<span className="block text-[10px] font-semibold text-muted-foreground">{precoSub}</span></p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- prova social (30/07) */

/**
 * DECISÃO DO DONO (29/07 à noite): sem A/B — o paywall novo entra pra 100%.
 * O braço "a" fica no código como ROLLBACK instantâneo: PAYWALL_AB_FORCE="a"
 * devolve o paywall de ontem inteiro (sem prova, garantia antes do preço).
 *
 * A prova é a régua BitePal + Cal AI, adaptada:
 *   - laurel ★★★★★ +1000 sob o herói (Cal AI abre o paywall com laurel/nota;
 *     mesmo enunciado do AppWelcome/ComecarDia14/SeuPlanoScreen — os quatro
 *     andam juntos, senão a mesma pessoa vê +500 numa tela e +1000 na outra);
 *   - mural de depoimentos depois do preço (Cal AI tem uma tela só de
 *     reviews; aqui vira seção — tela extra no funil custa ~5% de queda);
 *   - depoimento na tela de espera (lei BitePal: a espera vira argumento);
 *   - garantia DEPOIS do preço — risco zero só significa algo depois que a
 *     pessoa sabe qual é o risco.
 * O contador dinâmico "N nas últimas 24h" saiu (dono: número pequeno
 * desconverte). A edge function prova-social segue no ar, sem uso por ora.
 */
type PaywallArm = "a" | "b";
// 10/08 (ordem do dono): volta pro braço "b". O que mudou desde o desligamento
// de 01/08 é que a prova social do ANÚNCIO morreu junto com o Instagram — antes
// o criativo chegava com ~3.000 reações fazendo o convencimento antes do clique.
// Medido: paywall→Pix era 21-23% (04-07/08) e caiu pra 8,8-12,1% (09-10/08),
// no preço BARATO, então não é preço. A prova migra do anúncio pro paywall.
// Rollback instantâneo = "a" nesta constante.
const PAYWALL_AB_FORCE: PaywallArm | null = "b";

const bracoPaywall = (uid: string | null | undefined): PaywallArm => {
  if (PAYWALL_AB_FORCE) return PAYWALL_AB_FORCE;
  try {
    const f = localStorage.getItem("paywall-ab-force");
    if (f === "a" || f === "b") return f;
  } catch { /* storage bloqueado (webview) — cai no hash */ }
  const seed = uid || "anon";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 2 === 0 ? "a" : "b";
};

/**
 * AVALIAÇÕES REAIS DA GOOGLE PLAY (03/09, ordem do dono). Até aqui o mural
 * era feedback do Instagram reescrito, com avatar gerado por IA. Agora é o
 * texto que a pessoa escreveu na loja, palavra por palavra (só espaço depois
 * de vírgula ajustado), com o primeiro nome e a inicial que a Play mostra em
 * público. Sem foto: quem avaliou não posou pra nada. Nota e quantidade NÃO
 * aparecem (dono: "são poucas ainda, assusta") — o "+1000" do laurel fica.
 * Cada card mostra 5 estrelas porque cada uma destas É 5 estrelas na Play.
 * `chip` = resumo nosso do resultado, em palavras nossas, marcado como tal.
 * Fonte: CSV do Console (agosto) + Reviews API (últimos 7 dias); ids das
 * avaliações no scratchpad (play-nomes.mjs) pra quem quiser conferir.
 */
type Depo = {
  nome: string; meta: string; texto: string;
  foto?: string; ini: string; cor: string; chip?: string;
};

const DEPO: Record<string, Depo> = {
  elisa: { nome: "Elisa D.", meta: "ago/2026", ini: "E", cor: "#D22D80", chip: "vale cada centavo",
    texto: "Que app incrível! Tudo que eu sempre quis num planner online. É maravilhoso pra se organizar e motivar. Vale cada centavo." },
  paulo: { nome: "Paulo P.", meta: "ago/2026", ini: "P", cor: "#127A56", chip: "organizou a rotina e ganha mais",
    texto: "aplicativo muito bom, vale o preço, depois que baixei, organizei minha rotina, e estou ganhando mais por causa disso, e passando mais tempo com a minha família" },
  rebeca: { nome: "Rebeca G.", meta: "ago/2026", ini: "R", cor: "#8FB8DA", chip: "a vida inteira num app só",
    texto: "Estou gostando bastante do Core! Acho muito legal reunir várias áreas da vida em um só lugar, como rotina, finanças, treino, alimentação, estudos, metas e até cuidados com os pets. A interface é bonita e fácil de usar, e ajuda bastante na organização do dia a dia. Ainda está em constante melhoria e algumas funções podem ser aprimoradas, mas já é um aplicativo muito útil e prático!" },
  natalia: { nome: "Natalia J.", meta: "ago/2026", ini: "N", cor: "#E4572E", chip: "organizou as finanças",
    texto: "gostei muito do app, consegui organizar minhas finanças, vi meus gastos e pedi ajuda com a ia TMB" },
  sabrina: { nome: "Sabrina F.", meta: "set/2026", ini: "S", cor: "#127A56",
    texto: "Pontos fortes: Design ótimo, interfaces completas sem ser complexas. Agradável de usar. Assinatura de pagamento único." },
  naisa: { nome: "Naisa E.", meta: "set/2026", ini: "N", cor: "#8FB8DA",
    texto: "Esse app é incrível e o mais evolutivo que conheci até hoje!" },
};

/** 3 avaliações casadas com a área do quiz (a história certa pro problema
 *  certo). Elisa fecha todas: é a mais forte e a mais geral. */
const MURAL_POR_AREA: Record<AreaKey, Depo[]> = {
  dinheiro: [DEPO.natalia, DEPO.paulo, DEPO.elisa],
  rotina: [DEPO.paulo, DEPO.rebeca, DEPO.elisa],
  corpo: [DEPO.rebeca, DEPO.sabrina, DEPO.elisa],
  saude: [DEPO.rebeca, DEPO.sabrina, DEPO.elisa],
  metas: [DEPO.paulo, DEPO.naisa, DEPO.elisa],
};
/** As que sobraram da área — sem repetir as três de cima. */
const MURAL_EXTRA_TODAS: Depo[] = [DEPO.rebeca, DEPO.natalia, DEPO.paulo, DEPO.sabrina, DEPO.naisa];

/** Laurel sob o herói — Cal AI abre o paywall com "Trusted by millions".
 *  10/08: +1000, medido no banco antes de subir (1.058 assinaturas, 920 delas
 *  compra Pix na web), arredondado PRA BAIXO. Número dinâmico pequeno
 *  desconverte (dono, 29/07). Se mexer aqui, mexe nas outras três telas. */
function LaurelProva() {
  return (
    <motion.div {...stagger(1)} className="flex items-center justify-center gap-2 mb-5 text-[12.5px]">
      <span className="text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</span>
      {/* 10/08 (dono): +500 → +1000. Conferido no banco antes de escrever —
          1.058 assinaturas, 920 delas compra Pix na web. Se o patamar mudar,
          este número muda junto; número inflado aqui é o tipo de coisa que a
          pessoa checa. */}
      <span className="text-muted-foreground"><strong className="text-foreground font-bold">+1000 pessoas</strong> aprovaram o CORE</span>
    </motion.div>
  );
}

function DepoCard({ d, neutra = false }: { d: Depo; neutra?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left">
      <div className="flex items-center gap-2.5">
        {d.foto
          ? <img src={d.foto} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover shrink-0" />
          : <span className="grid place-items-center w-10 h-10 rounded-full text-[14px] font-bold text-white shrink-0" style={{ background: d.cor }}>{d.ini}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-bold leading-tight truncate">{d.nome}</span>
            <span className="text-[11px] text-[#f0a500] tracking-tight shrink-0" aria-label="5 estrelas">★★★★★</span>
          </div>
          {/* rótulo por plataforma: no iPhone a loja não é citada (3.1.1) e
              "App Store" seria mentira — são avaliações da Google Play */}
          <div className="text-[11px] text-muted-foreground leading-tight">{neutra ? "avaliação de usuário" : "Avaliação na Google Play"} · {d.meta}</div>
        </div>
      </div>
      {d.chip && (
        <div className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold px-2.5 py-1 mt-2.5">
          <TrendingUp className="w-3 h-3" /> {d.chip}
        </div>
      )}
      <p className="text-[12.5px] leading-relaxed text-foreground/90 mt-2.5">{d.texto}</p>
    </div>
  );
}

/** Mural dentro do paywall, depois do preço — o "Success stories from our
 *  clients" do BitePal, com o "ver mais" fazendo o papel da tela-só-de-reviews
 *  do Cal AI sem custar uma tela a mais no funil. */
/** `semLoja`: o paywall do iPhone passa true — lá a loja não pode ser citada
 *  (3.1.1) e dizer "App Store" seria mentira, as avaliações são da Play. */
export function MuralDepoimentos({ area, semLoja = false }: { area: AreaKey; semLoja?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const neutra = semLoja || ehApple();
  const extras = MURAL_EXTRA_TODAS.filter((d) => !MURAL_POR_AREA[area].includes(d));
  return (
    <div className="text-left">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">
        {neutra ? "O que dizem quem já usa" : "O que dizem na Google Play"}
      </div>
      <div className="space-y-3">
        {MURAL_POR_AREA[area].map((d) => <DepoCard key={d.nome} d={d} neutra={neutra} />)}
        {aberto && extras.map((d) => <DepoCard key={d.nome} d={d} neutra={neutra} />)}
      </div>
      {!aberto && (
        <button
          onClick={() => { setAberto(true); trackEvent("funnel_click", { cta: "depoimentos_ver_mais" }); }}
          className="w-full text-center text-[13px] font-semibold text-accent py-3"
        >
          Ver mais {extras.length} avaliações ↓
        </button>
      )}
    </div>
  );
}

const TRUST_CHIPS = [
  { emoji: "🇧🇷", label: "Pix na hora" },
  { emoji: "🛡️", label: "Garantia de 7 dias" },
  { emoji: "♾️", label: "Sem mensalidade" },
];

/**
 * OS SELOS NO iPHONE (30/08) — os dois primeiros de cima não podem ir.
 *
 * Este componente nasceu no paywall da WEB, onde os três são verdade (Pix da
 * Cakto, reembolso manual nosso). O PaywallW importou o conjunto inteiro e
 * levou os selos junto sem ninguém reparar. Na App Store:
 *
 *  · "Pix na hora" é reprovação na 3.1.1 — citar pagamento de fora da loja.
 *  · "Garantia de 7 dias" é promessa que não é nossa pra fazer: na Apple quem
 *    reembolsa é a Apple, pelo formulário dela. Prometer garantia própria
 *    aqui vira dívida de suporte com quem cobra a promessa. (O cabeçalho do
 *    PaywallW já dizia isso em palavras — o import silenciou a decisão.)
 *
 * Os substitutos são fatos verificáveis, não slogans: a compra é da App Store
 * e o acesso libera na hora.
 */
const TRUST_CHIPS_IOS = [
  { emoji: "", label: "Compra pela App Store" },
  { emoji: "⚡", label: "Acesso na hora" },
  { emoji: "♾️", label: "Sem mensalidade" },
];

export function TrustChips() {
  const chips = ehApple() ? TRUST_CHIPS_IOS : TRUST_CHIPS;
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {chips.map((c) => (
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

export function CompareTable() {
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

function OfferScreen({
  context, answers, onBuy, braco, onEscape,
}: { context: "funnel" | "app"; answers: Record<string, string>; onBuy: (o: PixOffer) => void; braco: PaywallArm; onEscape: () => void }) {
  /* ROTA DE FUGA DE VOLTA (05/08, ordem do dono). Ela tinha saído em 24/07 e
   * volta agora porque atrás dela existe downsell de novo: sem resgate, X é só
   * uma porta de saída; com resgate, é o gatilho de maior volume do funil.
   *
   * O presente por INATIVIDADE continua fora, e isso não é descuido: o timer
   * de 15s foi medido em 20-21/07 e derrubou venda cheia em 58% porque
   * sequestrava quem ainda estava lendo. X e voltar são o oposto — a pessoa
   * declarou que está indo embora.
   *
   * 1,8s de atraso pro X aparecer: nascer junto com a tela é convite pra sair
   * antes de ler o preço. */
  const [showClose, setShowClose] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowClose(true), 1800);
    return () => clearTimeout(t);
  }, []);

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
      <motion.p {...stagger(1)} className={`text-muted-foreground text-sm leading-relaxed ${braco === "b" ? "mb-4" : "mb-6"}`}>
        Você já viu como funciona. Agora é com os seus números de verdade.
      </motion.p>

      {braco === "b" && <LaurelProva />}

      <div className="space-y-4">
        <motion.div {...stagger(2)}>
          {area === "dinheiro"
            ? <AnchorCard gasto={answers?.gasto ?? ""} />
            : <AreaAnchorCard area={area} />}
        </motion.div>
        <motion.div {...stagger(3)}><TransformChart label={CHART_LABEL[area]} /></motion.div>
        <ValueStack area={area} />
        {/* Braço A (rollback): garantia ANTES do preço, sem mural. Braço B
            (padrão): preço → histórias (BitePal) → garantia — o risco zero
            responde a objeção DEPOIS que ela nasceu. */}
        {braco === "a" && <GuaranteeTimeline />}
        <motion.div {...stagger(9)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        <motion.div {...stagger(10)}><LifetimeCard /></motion.div>
        {braco === "b" && <MuralDepoimentos area={area} />}
        {/* Laurels de fechamento (BitePal fecha as stories com "4.7 rating |
            1M users"; Cal AI fecha o paywall com "Trusted by millions").
            Números honestos: os que temos. */}
        {braco === "b" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
              <div className="text-[13px] text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</div>
              <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">+1000</div>
              <div className="text-[10.5px] text-muted-foreground font-semibold">aprovaram o CORE</div>
            </div>
            {/* 10/08 (dono): "+190 esta semana" saiu — número de janela curta
                envelhece sozinho e depende do tráfego do dia. No lugar entra a
                garantia, que é fato permanente e responde objeção de risco. */}
            <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
              <div className="text-[13px]" aria-hidden>🛡️</div>
              <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">7 dias</div>
              <div className="text-[10.5px] text-muted-foreground font-semibold">de garantia</div>
            </div>
          </div>
        )}
        {braco === "b" && <GuaranteeTimeline />}
        <motion.div {...stagger(11)}><TrustChips /></motion.div>
      </div>

      {/* CTA sticky */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {/* Pulso sutil (padrão Cal AI): chama o olho sem parecer erro */}
          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              onClick={() => openPixIntent("lifetime", "paywall_lifetime", context, onBuy)}
            >
              Quero pra sempre — R$ {PRICING.lifetime.total} no Pix <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              Pagamento <strong className="text-foreground font-semibold">único</strong> de R$ {PRICING.lifetime.total} no Pix · sem mensalidade · Garantia de 7 dias
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- prêmio */

/**
 * Tela do prêmio, depois do giro.
 *
 * ZERO FRICÇÃO, e isso é dado, não estilo: o mini-card antigo pedia um clique
 * pra "resgatar" e só 11 de ~40 pessoas clicavam (18-20/07). Aqui o desconto
 * JÁ está aplicado quando a tela abre — o único botão leva direto pro Pix.
 *
 * Sem contador regressivo. A condição é real (uma por sessão) e não precisa de
 * teatro; relógio falso numa tela de desconto é o que faz a pessoa desconfiar
 * do preço cheio que ela acabou de ver.
 */
/** Roleta com telemetria de abandono (13/08). Medido 10-12/08: 34 aberturas →
 *  só 12 chegaram no prêmio, e a gente não sabe ONDE as outras 22 morrem — o
 *  giro é automático de ~3s, ninguém deveria se perder aqui. Este wrapper
 *  carimba o desfecho: `downsell_roleta_girou` (com ms até completar) quando o
 *  giro termina, `downsell_roleta_abandono` (com ms de vida) se o componente
 *  desmonta antes — voltar do navegador, X, aba fechada com unmount. Se os
 *  abandonos vierem com ms < 3000, o problema é gente saindo DURANTE o giro
 *  (giro longo demais); se nem o abandono aparecer, é aba morta/travamento em
 *  aparelho fraco — cada causa tem conserto diferente, por isso medir antes. */
function RoletaComTelemetria({ context, onDone }: { context: "funnel" | "app"; onDone: () => void }) {
  const t0 = useRef(Date.now());
  const completou = useRef(false);
  useEffect(() => {
    const inicio = t0.current;
    return () => {
      if (!completou.current) {
        // beacon, não trackEvent: quem abandona a roleta costuma estar SAINDO
        // da página (voltar/fechar) e o insert normal morre com a navegação —
        // era por isso que 22 de 34 sumiam sem deixar rastro.
        trackEventBeacon("downsell_roleta_abandono", { context, ms: Date.now() - inicio });
      }
    };
  }, [context]);
  return (
    <WinbackWheel
      attemptId={null}
      quick
      slices={SLICES_FUNIL}
      prizeLabel={`R$ ${PIX_PRICES.downsell}`}
      onSpinComplete={() => {
        completou.current = true;
        trackEvent("downsell_roleta_girou", { context, ms: Date.now() - t0.current });
        onDone();
      }}
    />
  );
}

function PremioScreen({
  context, onBuy,
}: { context: "funnel" | "app"; onBuy: (o: PixOffer) => void }) {
  useEffect(() => { trackEvent("downsell_premio_view", { context }); }, [context]);

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pt-12 pb-16">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-16 h-16 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-5 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Gift className="w-8 h-8" strokeWidth={2.2} />
      </motion.div>

      <motion.h1 {...stagger(0)} className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu desconto<br /><span className="text-accent">já está aplicado</span>
      </motion.h1>
      <motion.p {...stagger(1)} className="text-muted-foreground text-sm leading-relaxed mb-7">
        Não precisa de cupom nem de código. Ele já está no seu Pix.
      </motion.p>

      <motion.div
        {...stagger(2)}
        className="rounded-3xl border-2 border-accent/30 bg-accent/[0.04] px-6 py-7 mb-6"
      >
        <div className="flex items-end justify-center gap-3 mb-1">
          <span className="text-lg text-muted-foreground line-through mb-[6px] font-semibold">
            R$ {PRICING.lifetime.total}
          </span>
          <span className="text-[46px] leading-none font-extrabold tracking-tight text-accent">
            R$ {PIX_PRICES.downsell}
          </span>
        </div>
        <p className="text-[13px] font-semibold text-foreground/70">
          pagamento único · seu pra sempre
        </p>
      </motion.div>

      <motion.div {...stagger(3)} className="space-y-2.5 text-left mb-7">
        {[
          "Os 16 módulos completos — nada bloqueado",
          "Sem mensalidade, nunca. Você paga uma vez",
          "Garantia de 7 dias: não gostou, devolvo",
        ].map((t) => (
          <div key={t} className="flex items-start gap-2.5">
            <span className="mt-[3px] shrink-0 w-[18px] h-[18px] rounded-full bg-accent/15 grid place-items-center">
              <Check className="w-3 h-3 text-accent" strokeWidth={3.5} />
            </span>
            <span className="text-[14px] leading-snug text-foreground/85">{t}</span>
          </div>
        ))}
      </motion.div>

      <motion.div {...stagger(4)}>
        <Button
          size="lg"
          className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
          onClick={() => openPixIntent("downsell", "downsell_premio", context, onBuy)}
        >
          Garantir por R$ {PIX_PRICES.downsell} no Pix <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-[11px] text-muted-foreground text-center mt-3 flex w-full items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
          <span>Pix na hora · acesso liberado na hora · Garantia de 7 dias</span>
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ flow */

export function PaywallDia14({
  context,
  answers,
}: {
  context: "funnel" | "app";
  answers?: Record<string, string>;
}) {
  /**
   * DOWNSELL COM ROLETA (05/08, ordem do dono). Três fases: oferta → roleta →
   * prêmio. O X do paywall continua não existindo.
   *
   * O GATILHO é fechar o Pix de 27,90 SEM PAGAR — e essa escolha tem história.
   * O idle-timer de 15s foi medido em 20-21/07 e destruiu dinheiro: roleta
   * vista +190%, mas venda de preço cheio −58% e receita por paywall visto de
   * R$11,16 → R$3,08. Ele sequestrava quem ainda estava LENDO. Quem fecha o
   * checkout, não: essa pessoa já viu o preço e recusou. É a única população
   * onde o desconto não canibaliza venda cheia.
   *
   * Uma vez por sessão (resgateUsado): fechar o Pix de 19,90 devolve pra tela
   * do prêmio, não gira de novo.
   */
  const [phase, setPhase] = useState<"offer" | "roleta" | "premio">("offer");
  // Pix in-app: quando setado, o overlay PixCheckout cobre o paywall.
  // (O antigo "resgate do checkout_return" morreu junto com o redirect —
  // ninguém mais SAI do app pra pagar.)
  const [pixOffer, setPixOffer] = useState<PixOffer | null>(null);
  const resgateUsado = useRef(false);
  /* NATIVIDADE CONGELADA NO MOUNT, além da checagem ao vivo lá embaixo.
   *
   * isNativeShell() lê window.Capacitor.isNativePlatform(), e esse método é
   * REESCRITO quando o @capacitor/core entra por import dinâmico — foi o que
   * o E2E pegou: no shell simulado a resposta virava false depois que o
   * SubscriptionPaywall carregava o plugin, e a roleta abria. No Android de
   * verdade o valor é sempre true, então era artefato de teste; mas o custo de
   * errar é oferecer Pix dentro do binário da loja, que reprova na revisão do
   * Play. Duas leituras, e basta UMA dizer "nativo" pra não abrir nada. */
  const nativoNoMount = useRef(isNativeShell());

  const ROLETA_DA_FUGA = false;

  /** Porta única do resgate — três entradas caem aqui: X da oferta, botão
   *  voltar do navegador e fechar o Pix de 27,90 sem pagar. Uma vez por
   *  sessão. NUNCA dentro do binário da loja: lá o Pix não existe e oferta
   *  fora do Play Billing reprova na revisão. */
  const abrirResgate = (origem: string) => {
    /* 03/09: desligado junto com o preço único (ver DOWNSELL_DA_FUGA no
     * PaywallFlow). A roleta premiava com 14,90; contra um cheio de 97,90
     * isso é 85% de desconto a um Voltar de distância. Devolver = true. */
    if (!ROLETA_DA_FUGA) return false;
    if (resgateUsado.current) return false;
    if (nativoNoMount.current || isNativeShell()) return false;
    resgateUsado.current = true;
    trackEvent("downsell_roleta_open", { origem, context });
    setPhase("roleta");
    return true;
  };

  const fecharPix = (step?: PixStep) => {
    const era = pixOffer;
    setPixOffer(null);
    if (era !== "lifetime") return; // fechar o downsell volta pro prêmio, só
    abrirResgate(`pix_${step ?? "?"}`);
  };

  /* VOLTAR do navegador. Empilha uma entrada boba no mount: o primeiro "voltar"
   * consome ela e vira resgate em vez de tirar a pessoa do funil.
   *
   * INTERCEPTA UMA VEZ SÓ, e o E2E é que cobrou isso. Como o pushState não muda
   * a URL, um handler que fica escutando e não faz nada deixa a pessoa PRESA:
   * ela aperta voltar, nada acontece na tela, e o funil parece travado. Então o
   * listener se remove no primeiro disparo — e, se o resgate já tinha sido gasto
   * (pelo X, por exemplo), eu mesmo mando o voltar adiante. Ninguém fica preso. */
  useEffect(() => {
    if (nativoNoMount.current) return;
    window.history.pushState({ paywallDia14: true }, "");
    const onPop = () => {
      window.removeEventListener("popstate", onPop);
      if (!abrirResgate("voltar")) window.history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useNavigate();
  // Braço congelado no mount: ninguém vê a tela trocar de cara no meio.
  const { user: abUser } = useAuth();
  const [braco] = useState<PaywallArm>(() => bracoPaywall(abUser?.id));

  // Respostas do quiz: prop (funil na mesma sessão) ou localStorage
  // (volta do OAuth / gate in-app de quem veio do funil).
  const [quiz] = useState<Record<string, string>>(() => {
    if (answers && Object.keys(answers).length) return answers;
    try { return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    const name = context === "funnel" ? "funnel_view" : "paywall_view";
    // paywall_ab vai junto pra dar pra separar os dois braços na leitura do dia.
    trackEvent(name, context === "funnel"
      ? { step: phase === "offer" ? "offer" : phase, paywall_ab: braco }
      : { phase: `v2_${phase}`, paywall_ab: braco });
  }, [phase, context, braco]);

  const fade = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div style={LIGHT_VARS} className="min-h-dvh w-full bg-white text-foreground overflow-y-auto">
      {pixOffer && (
        <PixCheckout offer={pixOffer} context={context} onClose={fecharPix} />
      )}
      <div className="px-5">
        <AnimatePresence mode="wait">
          <motion.div key={phase} {...fade}>
            {phase === "offer" && (
              <OfferScreen
                context={context}
                answers={quiz}
                onBuy={setPixOffer}
                braco={braco}
                onEscape={() => {
                  // Já girou uma vez? Então o X é X mesmo: entrega a pessoa ao
                  // módulo dela (o gate de trial segura lá dentro) em vez de
                  // deixar ela presa numa tela sem saída.
                  if (abrirResgate("x")) return;
                  trackEvent("funnel_click", { cta: "paywall_escape", context });
                  if (context !== "funnel") return;
                  const a = quiz?.area && quiz.area in AREAS ? (quiz.area as AreaKey) : "dinheiro";
                  navigate(`/${AREAS[a].module}`);
                }}
              />
            )}
            {phase === "roleta" && (
              <div className="min-h-dvh flex items-center justify-center">
                <RoletaComTelemetria context={context} onDone={() => setPhase("premio")} />
              </div>
            )}
            {phase === "premio" && (
              <PremioScreen context={context} onBuy={setPixOffer} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
