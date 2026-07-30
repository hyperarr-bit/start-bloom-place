import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, X, ShieldCheck,
  Wallet, BellRing, Target, BarChart3, Unlock, MessageCircleHeart, TrendingUp, FileDown,
  CalendarDays, Flame, Dumbbell, Salad, HeartPulse, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { PixCheckout, type PixOffer } from "@/components/paywall/PixCheckout";
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
const PRICING = {
  lifetime: { total: "27,90" },
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
    value: offer === "lifetime" ? 27.9 : 14.9,
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
          <p className="text-[11px] text-muted-foreground leading-tight mb-1">CORE vitalício,<br />pra enxergar tudo</p>
          <p className="text-xl font-extrabold text-accent tracking-tight">R$ {PRICING.lifetime.total}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></p>
        </div>
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
          <p className="text-xl font-extrabold text-accent tracking-tight">R$ {PRICING.lifetime.total}<span className="block text-[10px] font-semibold text-muted-foreground">1x, pra sempre</span></p>
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
 *   - laurel ★★★★★ +500 sob o herói (Cal AI abre o paywall com laurel/nota;
 *     "+500 pessoas" é o mesmo enunciado já usado no AppWelcome — 568 têm
 *     acesso, arredondado PRA BAIXO);
 *   - mural de depoimentos depois do preço (Cal AI tem uma tela só de
 *     reviews; aqui vira seção — tela extra no funil custa ~5% de queda);
 *   - depoimento na tela de espera (lei BitePal: a espera vira argumento);
 *   - garantia DEPOIS do preço — risco zero só significa algo depois que a
 *     pessoa sabe qual é o risco.
 * O contador dinâmico "N nas últimas 24h" saiu (dono: número pequeno
 * desconverte). A edge function prova-social segue no ar, sem uso por ora.
 */
type PaywallArm = "a" | "b";
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
 * Depoimentos REAIS (feedbacks do Instagram, curadoria e redação do dono,
 * 29/07). Fotos: avatares escolhidos pelo dono pros dois destaques; o resto
 * vai texto puro — o BitePal também mistura (o "Success stories" tem foto, os
 * quotes do quiz não). `chip` = resultado concreto embaixo do nome, a régua
 * do BitePal ("70 kg → 60 kg in 2,5 months"): resultado vende, elogio enfeita.
 */
type Depo = {
  nome: string; meta: string; texto: string;
  foto?: string; ini: string; cor: string; chip?: string;
};

const DEPO: Record<string, Depo> = {
  mariana: { nome: "Mariana S.", meta: "22 anos · São Paulo, SP", ini: "M", cor: "#D22D80", foto: "/depoimentos/mariana.jpg", chip: "organiza a vida inteira no CORE",
    texto: "Ameiii o app! As retrospectivas que aparecem todo mês são muito boas, o “Pergunte ao CORE” me ajuda a saber quanto posso gastar no dia sem sair do meu planejamento. Hoje organizo praticamente toda a minha vida por aqui." },
  gabriel: { nome: "Gabriel A.", meta: "20 anos · Curitiba, PR", ini: "G", cor: "#127A56", foto: "/depoimentos/gabriel.jpg", chip: "do descontrole → guardando todo mês",
    texto: "Gastava muito descontroladamente e nunca sabia para onde o dinheiro ia. O CORE me ajudou muito nessa questão. Hoje acompanho todos os meus gastos, sei exatamente quanto posso gastar por dia e finalmente consegui começar a guardar dinheiro." },
  joaop: { nome: "João P.", meta: "24 anos · Campinas, SP", ini: "J", cor: "#8FB8DA",
    texto: "Achei que seria só mais um app de finanças, mas acabei migrando praticamente minha rotina inteira pra ele. Hoje já olho quanto posso gastar antes de sair de casa e isso mudou muito meus hábitos." },
  juliana: { nome: "Juliana A.", meta: "26 anos · São Paulo, SP", ini: "J", cor: "#E4572E",
    texto: "O “Pergunte ao CORE” é uma ideia genial. Sempre que bate dúvida de quanto ainda posso gastar no dia eu pergunto ali mesmo. Parece uma conversa e evita que eu extrapole meu orçamento." },
  lucas: { nome: "Lucas M.", meta: "26 anos · Belo Horizonte, MG", ini: "L", cor: "#127A56", chip: "rotina que finalmente consegue seguir",
    texto: "Consegui organizar minhas metas, dividir cada parte do meu dia por horário e criar uma rotina que realmente consigo seguir. Minha produtividade melhorou bastante e ficou muito mais fácil manter constância." },
  beatriz: { nome: "Beatriz M.", meta: "19 anos · Goiânia, GO", ini: "B", cor: "#D22D80",
    texto: "Comecei usando só pelas finanças e hoje uso mais a parte de rotina. Os blocos de foco, as tarefas e os hábitos me ajudaram muito na faculdade. Nunca consegui manter uma organização por tanto tempo." },
  carlos: { nome: "Carlos H.", meta: "31 anos · Florianópolis, SC", ini: "C", cor: "#8FB8DA",
    texto: "O que mais gostei foi que tudo fica conectado. Quando organizo minha rotina já lembro do treino, da dieta e até das contas que vencem naquela semana. Antes eu esquecia alguma coisa todo dia." },
  fernandaR: { nome: "Fernanda R.", meta: "29 anos · Recife, PE", ini: "F", cor: "#E4572E", chip: "−5 kg em 1 mês",
    texto: "Perdi no total 5 quilos em um mês. Meus treinos e minha dieta são todos organizados aqui, consigo registrar minhas cargas, acompanhar meu progresso e ainda gerar automaticamente a lista de compras da dieta." },
  diego: { nome: "Diego R.", meta: "27 anos · Recife, PE", ini: "D", cor: "#127A56",
    texto: "Treino há alguns anos e já testei vários aplicativos. O CORE foi o primeiro em que consegui registrar carga, acompanhar evolução e ainda deixar minha dieta no mesmo lugar." },
  amanda: { nome: "Amanda L.", meta: "21 anos · Fortaleza, CE", ini: "A", cor: "#D22D80",
    texto: "A tela inicial personalizada foi o que mais me conquistou. Deixo logo de cara minhas tarefas, quanto posso gastar, minha água, treino e alimentação. Não preciso abrir cinco aplicativos diferentes durante o dia." },
  larissa: { nome: "Larissa F.", meta: "23 anos · Salvador, BA", ini: "L", cor: "#E4572E", chip: "hábito de leitura todo dia",
    texto: "O módulo de Biblioteca é muito melhor do que eu imaginava. Finalmente consegui criar o hábito de ler todos os dias e acompanhar meu progresso. As metas anuais dão uma motivação enorme." },
  gustavo: { nome: "Gustavo N.", meta: "20 anos · Curitiba, PR", ini: "G", cor: "#8FB8DA",
    texto: "Organizei todas as provas, trabalhos e matérias da faculdade. O melhor é que consigo ver minhas tarefas junto com o restante da rotina, então fica bem mais difícil esquecer alguma entrega." },
  patricia: { nome: "Patrícia S.", meta: "35 anos · Brasília, DF", ini: "P", cor: "#127A56",
    texto: "O módulo Casa me salvou. Divido as tarefas com meu marido, controlo a despensa e nunca mais esqueci de comprar alguma coisa importante no mercado. É simples, mas resolve problemas do dia a dia." },
  matheus: { nome: "Matheus V.", meta: "22 anos · Belo Horizonte, MG", ini: "M", cor: "#E4572E",
    texto: "O que mais gostei é que o app não tenta fazer uma coisa só. Ele realmente organiza a vida inteira. Hoje não tenho mais aplicativo separado pra finanças, hábitos, tarefas, treino e leitura." },
  fernandaO: { nome: "Fernanda O.", meta: "30 anos · Rio de Janeiro, RJ", ini: "F", cor: "#8FB8DA",
    texto: "Dá pra perceber que o aplicativo foi pensado por alguém que realmente usa esse tipo de ferramenta. Tem muitos detalhes pequenos que fazem diferença no dia a dia. Quanto mais eu uso, mais funcionalidades descubro." },
};

/** 3 histórias casadas com a área que a pessoa escolheu no quiz (o BitePal
 *  mostra perda de peso pra quem quer perder peso — a história certa pro
 *  problema certo). Mariana abre em todas: é a mais completa. */
const MURAL_POR_AREA: Record<AreaKey, Depo[]> = {
  dinheiro: [DEPO.gabriel, DEPO.mariana, DEPO.joaop],
  rotina: [DEPO.lucas, DEPO.mariana, DEPO.carlos],
  corpo: [DEPO.fernandaR, DEPO.diego, DEPO.mariana],
  saude: [DEPO.fernandaR, DEPO.amanda, DEPO.mariana],
  metas: [DEPO.lucas, DEPO.larissa, DEPO.mariana],
};
const MURAL_EXTRA: Depo[] = [DEPO.matheus, DEPO.juliana, DEPO.beatriz, DEPO.gustavo, DEPO.patricia, DEPO.fernandaO];

/** Laurel sob o herói — Cal AI abre o paywall com "Trusted by millions";
 *  a nossa escala honesta é o +500 já usado no AppWelcome (568 têm acesso,
 *  arredondado PRA BAIXO). Número dinâmico pequeno desconverte (dono, 29/07). */
function LaurelProva() {
  return (
    <motion.div {...stagger(1)} className="flex items-center justify-center gap-2 mb-5 text-[12.5px]">
      <span className="text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</span>
      <span className="text-muted-foreground"><strong className="text-foreground font-bold">+500 pessoas</strong> organizando a vida no CORE</span>
    </motion.div>
  );
}

function DepoCard({ d }: { d: Depo }) {
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
          <div className="text-[11px] text-muted-foreground leading-tight">{d.meta}</div>
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
function MuralDepoimentos({ area }: { area: AreaKey }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="text-left">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">
        Histórias de quem já entrou
      </div>
      <div className="space-y-3">
        {MURAL_POR_AREA[area].map((d) => <DepoCard key={d.nome} d={d} />)}
        {aberto && MURAL_EXTRA.map((d) => <DepoCard key={d.nome} d={d} />)}
      </div>
      {!aberto && (
        <button
          onClick={() => { setAberto(true); trackEvent("funnel_click", { cta: "depoimentos_ver_mais" }); }}
          className="w-full text-center text-[13px] font-semibold text-accent py-3"
        >
          Ver mais {MURAL_EXTRA.length} avaliações ↓
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

function OfferScreen({
  context, answers, onBuy, braco,
}: { context: "funnel" | "app"; answers: Record<string, string>; onBuy: (o: PixOffer) => void; braco: PaywallArm }) {
  // SEM rota de fuga (pedido do dono, 24/07): nesta cópia do dia 14 o X, o
  // popstate→roleta e o presente por inatividade saíram. A tela vende preço
  // cheio ou nada — o único caminho pra frente é o CTA do Pix.

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

/* ------------------------------------------------------------------ flow */

export function PaywallDia14({
  context,
  answers,
}: {
  context: "funnel" | "app";
  answers?: Record<string, string>;
}) {
  // Uma fase só: oferta. Sem roleta, sem downsell de 14,90, sem X.
  const phase = "offer" as const;
  // Pix in-app: quando setado, o overlay PixCheckout cobre o paywall.
  // (O antigo "resgate do checkout_return" morreu junto com o redirect —
  // ninguém mais SAI do app pra pagar.)
  const [pixOffer, setPixOffer] = useState<PixOffer | null>(null);

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
        <PixCheckout offer={pixOffer} context={context} onClose={() => setPixOffer(null)} />
      )}
      <div className="px-5">
        <AnimatePresence mode="wait">
          <motion.div key={phase} {...fade}>
            <OfferScreen context={context} answers={quiz} onBuy={setPixOffer} braco={braco} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
