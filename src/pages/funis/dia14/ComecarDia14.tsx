import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams, useLocation, Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, Sparkles, ShieldCheck,
  Lock, MailCheck, Loader2, ChevronLeft, ChevronRight, Circle, CheckCircle2,
} from "lucide-react";
import { corDaOpcao, iconeDaOpcao, MODULO_VISUAL, ORDEM_CENTRAL } from "@/lib/funnel-icones";
import { PaywallDia14 as PaywallFlow } from "./PaywallDia14";
import { Button } from "@/components/ui/button";
import { ehApple } from "@/lib/loja";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";
import {
  QUIZ, GASTO_ANCHOR, isInAppBrowser,
  AREAS, AREA_TRACKS, AREA_PROOF, ALL_MODULE_ICONS, FUNNEL_AREA_KEY, DOOR_AREAS, AREA_TUTORIAL,
  type AreaKey, type QuizQ,
} from "@/lib/funnel";

// Marca que o OAuth partiu do funil: o /auth/callback lê isso pra devolver o
// usuário NOVO pro paywall do funil (em vez de pular direto pro app).
export const FUNNEL_OAUTH_KEY = "funnel-oauth-pending";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.6 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.5.4 6.9-5 6.9-15.1 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

/**
 * Funil "sem LP" (mobile-first, tráfego frio) — modelo PAGO com paywall:
 *   início → quiz → DEMO no app real (/preview/financas, dados de exemplo)
 *   → cadastro → PAYWALL (assinar) → checkout Cakto → app ativo.
 * Se o lead tenta sair do paywall: roleta → downsell (ofertas limitadas).
 * A demo é o app de verdade: o slide final manda pra /preview/financas?funnel=1&from=dia14,
 * que tem um CTA "Quase lá" voltando pra cá em ?step=signup.
 */

type Step = "start" | "quiz" | "prova" | "progress" | "result" | "central" | "signup" | "offer" | "confirm";

const DEMO_URL = "/preview/financas?funnel=1&from=dia14";
/** Demo do funil vitrine: abre no módulo da área escolhida, com a barra de
 *  navegação entre os módulos do criativo (tour=vida). A área de metas cai
 *  direto na aba Metas — a promessa da porta, não o "Sobre mim". */
const demoUrlFor = (area: AreaKey) =>
  `/preview/${AREAS[area].module}?funnel=1&tour=vida&from=dia14${area === "metas" ? "&tab=metas" : ""}`;

// Funil sempre em tema claro (fundo branco), mesmo se o visitante estiver no dark.
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

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

const PREP_STEPS = [
  "Identificando seu perfil financeiro",
  "Montando seu painel inicial",
  "Separando os recursos mais importantes",
  "Finalizando seu plano personalizado",
];

const RESULT_ITEMS = [
  "Ver para onde seu dinheiro está indo",
  "Organizar contas e vencimentos",
  "Acompanhar saldo disponível",
  "Criar metas e desejos",
  "Testar um painel financeiro simples no dia a dia",
];

const TrustRow = () => (
  <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Sem cartão agora</span>
    <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Cancele quando quiser</span>
  </div>
);

/* ------------------------------------------------------------------- quiz */

// Perguntas em QUIZ (src/lib/funnel.ts). A tela de impacto entra depois da
// pergunta de "gasto" — usa a resposta da pessoa como âncora de dor em R$.
const PROOF_AFTER_KEY = "gasto";

/* ---------------------------------------------------------------- screens */

function StartScreen({ onPick }: { onPick: (firstAnswer: string) => void }) {
  // Item 3 (RCD/Schwartz): público problem-aware → a 1ª tela já é o diagnóstico.
  // O 1º toque responde a pergunta em vez de um botão neutro — encurta o
  // caminho até a prova. Sem vídeo (bugado) — headline + pergunta são o hero.
  const q0 = QUIZ[0]; // "O que mais te atrapalha hoje?"
  return (
    <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto">
      <h1 className="text-[clamp(28px,8vw,42px)] font-bold leading-[1.05] tracking-tight mb-2 text-center">
        Organize sua vida financeira
      </h1>
      <p className="text-[15px] text-muted-foreground text-center mb-6">{q0.q}</p>

      <div className="space-y-2.5">
        {q0.opts.map((o) => (
          <button
            key={o.label}
            onClick={() => onPick(o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-secondary text-xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground mt-4 text-center">
        5 perguntas rápidas · sem cadastro agora
      </p>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Já tem uma conta? <Link to="/auth" className="font-semibold text-foreground">Entrar</Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------- porta vitrine (?porta=vida) */

/** Porta do criativo "vida inteira": o vídeo vendeu a casa, a porta faz a
 *  pessoa escolher um cômodo — amplitude vira especificidade em 1 toque. */
export function VitrineStartScreen({ onPickArea }: { onPickArea: (area: AreaKey, label: string) => void }) {
  const options: Array<{ area: AreaKey; emoji: string; label: string }> = [
    ...DOOR_AREAS.map((key) => ({ area: key, emoji: AREAS[key].emoji, label: AREAS[key].label })),
    // "Tudo" não é uma trilha — é pedido de priorização. Começa pelo que
    // custa mais caro (dinheiro), e a central mostra o resto junto.
    { area: "dinheiro" as AreaKey, emoji: "😵", label: "Tudo, sinceramente" },
  ];
  return (
    <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto">
      {/* Prova visual da amplitude: os 16 módulos como pano de fundo, sem virar menu */}
      <div className="grid grid-cols-8 gap-1.5 mb-5 opacity-90">
        {ALL_MODULE_ICONS.map((m) => (
          <span key={m.label} className="grid place-items-center aspect-square rounded-lg bg-secondary text-[15px]">
            {m.emoji}
          </span>
        ))}
      </div>
      <h1 className="text-[clamp(27px,7.5vw,40px)] font-bold leading-[1.06] tracking-tight mb-2 text-center">
        Um app pra<br />vida inteira
      </h1>
      <p className="text-[15px] text-muted-foreground text-center mb-6">
        Qual área tá mais fora de controle hoje?
      </p>

      <div className="space-y-2.5">
        {options.map((o) => (
          <button
            key={o.label}
            onClick={() => onPickArea(o.area, o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-secondary text-xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground mt-4 text-center">
        4 perguntas rápidas · sem cadastro agora
      </p>
      <p className="text-sm text-muted-foreground mt-2 text-center">
        Já tem uma conta? <Link to="/auth" className="font-semibold text-foreground">Entrar</Link>
      </p>
    </div>
  );
}

/** Radar da vida (funil vitrine): a área escolhida em baixa, o potencial
 *  mapeado — o momento "isso sou eu" da trilha de vida. */
function LifeRadar({ area }: { area: AreaKey }) {
  // Os 5 eixos mapeiam 1:1 com as 5 áreas da porta.
  const axes = [
    { key: "dinheiro", label: "Dinheiro" },
    { key: "rotina", label: "Rotina" },
    { key: "corpo", label: "Corpo" },
    { key: "saude", label: "Saúde" },
    { key: "metas", label: "Metas" },
  ];
  // Escolhida = baixa (foi o que a pessoa DISSE); demais = meio-termo neutro.
  const value = (k: string) => (k === area ? 0.3 : 0.58);
  const C = 100; // centro
  const R = 72;
  const pt = (i: number, r: number) => {
    const ang = (i * (360 / axes.length) - 90) * (Math.PI / 180);
    return [C + r * Math.cos(ang), C + r * Math.sin(ang)] as const;
  };
  const poly = (rFor: (i: number) => number) =>
    axes.map((_, i) => pt(i, rFor(i)).join(",")).join(" ");
  return (
    <div className="relative mx-auto w-64 h-56">
      <svg viewBox="0 0 200 190" className="w-full h-full">
        {[0.33, 0.66, 1].map((f) => (
          <polygon key={f} points={poly(() => R * f)} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />;
        })}
        <motion.polygon
          points={poly((i) => R * value(axes[i].key))}
          fill="hsl(var(--accent) / 0.18)"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
          style={{ transformOrigin: "100px 100px" }}
        />
        {axes.map((a, i) => {
          const [x, y] = pt(i, R * value(a.key));
          const chosen = a.key === area;
          return (
            <motion.circle
              key={a.key} cx={x} cy={y} r={chosen ? 5 : 3.5}
              fill={chosen ? "hsl(var(--destructive))" : "hsl(var(--accent))"}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.06 }}
            />
          );
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 16);
          const chosen = a.key === area;
          return (
            <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight={chosen ? 800 : 600}
              fill={chosen ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}>
              {a.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

const AREA_RESULT_ITEMS: Record<AreaKey, string[]> = {
  dinheiro: RESULT_ITEMS,
  rotina: [
    "Montar sua rotina semanal, hora a hora",
    "Manter hábitos com streaks que dão orgulho",
    "Nunca mais esquecer tarefa ou compromisso",
    "Ver sua consistência crescer no calendário",
  ],
  corpo: [
    "Montar seu plano de treino da semana",
    "Seguir um cardápio simples, refeição por refeição",
    "Registrar cargas e ver a progressão",
    "Treino e dieta finalmente no mesmo lugar",
  ],
  saude: [
    "Bater sua meta de água todo dia",
    "Vitaminas e remédios com lembrete e estoque",
    "Acompanhar sono, peso e evolução",
    "Sua saúde inteira num painel só",
  ],
  metas: [
    "Transformar sua meta num plano com passos",
    "Ver sua linha do tempo: 6 meses, 1, 3, 5 anos",
    "Diário, humor e gratidão pra manter o pique",
    "Ver sua evolução na roda da vida",
  ],
};

const LEMBRETES_POR_AREA: Record<AreaKey, number> = { dinheiro: 3, rotina: 3, corpo: 3, saude: 3, metas: 3 };

export function RadarResultScreen({ answers, area, onDone }: { answers: Record<string, string>; area: AreaKey; onDone: () => void }) {
  const a = AREAS[area];
  const items = answers.vitoria
    ? [answers.vitoria, ...AREA_RESULT_ITEMS[area].filter((r) => r !== answers.vitoria)].slice(0, 4)
    : AREA_RESULT_ITEMS[area].slice(0, 4);
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">Análise concluída</div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-1">Seu mapa da vida<br />está pronto</h2>
      <LifeRadar area={area} />
      {/* v105: o PLANO EM NÚMEROS (Cal AI faz assim): três cartões curtos antes
          do texto. "5 min/dia" é a promessa que a pessoa acabou de aceitar no
          quiz; os lembretes são os do LEMBRETES_W da área; 16 é o que ela viu. */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[["5 min", "por dia"], [String(LEMBRETES_POR_AREA[area] ?? 3), "lembretes na hora"], ["16", "módulos abertos"]].map(([g, c]) => (
          <div key={c} className="rounded-2xl border border-border bg-card py-3 px-2">
            <div className="text-[20px] font-extrabold tracking-[-0.02em] leading-none text-foreground">{g}</div>
            <div className="text-[11px] font-medium text-muted-foreground leading-tight mt-1.5">{c}</div>
          </div>
        ))}
      </div>
      <Card className="p-3.5 text-left mb-4 border-destructive/30 bg-destructive/[0.04]">
        <p className="text-[13.5px] leading-snug">
          <strong>Seu ponto de partida: {a.nome}.</strong> Foi o que você disse que mais dói — é por onde seu plano começa.
        </p>
      </Card>
      <Card className="p-4 text-left space-y-3 mb-7">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Com o CORE, você vai</div>
        {items.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {r}
          </motion.div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "result", area }); onDone(); }}>
        Ver minha central <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Abre o app de verdade, com dados de exemplo</p>
    </div>
  );
}

/** Vislumbre da central: prova a amplitude (16 módulos) por 3 segundos de
 *  tela — trailer, não mapa. A demo continua guiada (5 módulos do vídeo). */
export function CentralScreen({ area, onOpen }: { area: AreaKey; onOpen: () => void }) {
  const a = AREAS[area];
  // Só o módulo da área tem anel "começa aqui" (bate com a copy). Os outros
  // 15 são cards sólidos — NADA apagado, senão o lead acha que estão bloqueados.
  const startHere = a.module;
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-2">Sua central tá pronta</h2>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Os 16 módulos já são seus. <strong className="text-foreground">Começamos por {a.nome}</strong> — o resto entra no seu ritmo.
      </p>
      {/* v105: os 16 como o painel do app os desenha (ícone lucide + pastel),
          na ordem de uso real dos pagantes — o emoji saiu do funil inteiro. */}
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        {ORDEM_CENTRAL.map((id, i) => {
          const m = MODULO_VISUAL[id];
          const on = id === startHere;
          const Icon = m.Icon;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.03, duration: 0.35, ease: [0.22, 1.25, 0.36, 1] }}
              className="relative flex flex-col items-center gap-1.5"
            >
              {on && (
                <span className="absolute -top-2 right-0 z-10 text-[8px] font-extrabold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 whitespace-nowrap">
                  começa aqui
                </span>
              )}
              <span className={`grid place-items-center w-[52px] h-[52px] rounded-2xl ${on ? "ring-[3px] ring-accent" : ""}`} style={{ background: m.cor, color: m.tinta }}>
                <Icon className="w-[22px] h-[22px]" strokeWidth={2} />
              </span>
              <span className="text-[10.5px] font-semibold leading-none text-foreground">{m.nome}</span>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[11px] text-accent font-semibold mb-6 inline-flex items-center justify-center gap-1 w-full">
        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Todos os 16 inclusos, sem pagar à parte
      </p>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "central_open", area }); onOpen(); }}>
        Abrir minha central <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Explore à vontade — dados de exemplo</p>
    </div>
  );
}

/** Tela de impacto: devolve a estimativa da própria pessoa, anualizada.
 *  É o momento "isso é sério" antes das duas últimas perguntas. */
function ProofSlide({ gasto, onNext }: { gasto: string; onNext: () => void }) {
  const anchor = GASTO_ANCHOR[gasto] ?? null;
  return (
    <div className="text-center pt-2">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-14 h-14 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-5 text-2xl"
      >
        💡
      </motion.div>
      {anchor ? (
        <>
          <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
            Pela sua estimativa,<br />
            <span className="text-accent">{anchor.month} somem por mês</span><br />
            sem você ver.
          </h2>
          <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
            <p className="text-[13px] text-muted-foreground mb-1">Em um ano, isso vira</p>
            <p className="text-4xl font-extrabold text-accent tracking-tight">{anchor.year}</p>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
            A maioria das pessoas<br />
            <span className="text-accent">não faz ideia</span> —<br />
            e é assim que o dinheiro some.
          </h2>
          <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
            <p className="text-[14px] leading-relaxed">
              Sem registro, cada gasto pequeno fica invisível. E o que é invisível não dá pra controlar.
            </p>
          </div>
        </>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed mb-7">
        Não é falta de disciplina — é falta de <strong className="text-foreground">visibilidade</strong>.
        Registrar no CORE leva segundos.
      </p>
      <Button size="lg" className="w-full h-12 text-base" onClick={onNext}>
        Quero ver pra onde vai <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

/** Pico das trilhas de vida (funil vitrine): a resposta de consistência vira
 *  a confissão — "não é força de vontade, é falta de sistema". */
function AreaProofSlide({ area, answer, onNext }: { area: AreaKey; answer: string; onNext: () => void }) {
  const proof = AREA_PROOF[area as Exclude<AreaKey, "dinheiro">];
  const echo = proof?.echo[answer] ?? "É sempre a mesma história.";
  return (
    <div className="text-center pt-2">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-14 h-14 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-5 text-2xl"
      >
        💡
      </motion.div>
      <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-4">
        <span className="text-accent">{echo}</span><br />
        {proof.reframe}
      </h2>
      <div className="rounded-2xl border-2 border-accent/25 bg-accent/[0.05] p-5 mb-5">
        <p className="text-[14px] leading-relaxed">{proof.card}</p>
      </div>
      <Button size="lg" className="w-full h-12 text-base" onClick={onNext}>
        {proof.cta} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// Fluxo do quiz: perguntas + (na trilha de dinheiro) a tela de impacto logo
// após a pergunta de gasto. As trilhas das outras áreas não têm proof.
/* "eco" (31/08, ordem do dono, referência BitePal): a tela que RESPONDE a
 * resposta. O quiz do BitePal nunca é só pergunta atrás de pergunta — a cada
 * escolha o app devolve algo ("Eating window: 10 hours", "Your BMI: 25"), e é
 * isso que faz parecer que ele entendeu você em vez de preencher formulário.
 * O nosso era só a pergunta. */
export type QuizItem = { kind: "q"; qIdx: number } | { kind: "proof" } | { kind: "extra" } | { kind: "eco"; qIdx: number };
export const buildQuizItems = (questions: QuizQ[], proofAfterKey?: string, comEco = false): QuizItem[] =>
  questions.flatMap((q, i) => {
    const item: QuizItem[] = [{ kind: "q", qIdx: i }];
    // o eco vem colado na pergunta que ele comenta; o proof continua depois
    if (comEco) item.push({ kind: "eco", qIdx: i });
    if (proofAfterKey && q.key === proofAfterKey) item.push({ kind: "proof" });
    return item;
  });
const QUIZ_ITEMS: QuizItem[] = buildQuizItems(QUIZ, PROOF_AFTER_KEY);

export function QuizScreen({ questions, items, onDone, onBack, initialAnswers, skipFirstAnswered, proofArea, extraSlide, ecoSlide, counterBase = 0, semContador = false, onAnswer }: {
  questions: QuizQ[];
  items: QuizItem[];
  onDone: (a: Record<string, string>) => void;
  onBack: () => void;
  initialAnswers?: Record<string, string>;
  /** Porta de finanças responde a 1ª pergunta na tela inicial: começa da 2ª. */
  skipFirstAnswered?: boolean;
  /** Trilha de vida: renderiza o pico de área (senão, o proof de gasto). */
  proofArea?: AreaKey;
  /** Funil W: slide próprio no meio do quiz (item {kind:"extra"}) — ex.: convite de notificação estilo Cal AI. */
  extraSlide?: (next: () => void) => React.ReactNode;
  /** Funil W: a tela de ECO — recebe a pergunta respondida e as respostas. */
  ecoSlide?: (qIdx: number, answers: Record<string, string>, next: () => void) => React.ReactNode;
  /** Funil W: telas ANTES do quiz que contam no progresso (a porta = pergunta 1). */
  counterBase?: number;
  /** 31/08 (ordem do dono, referência BitePal): só a BARRA, sem o "3/8".
   *  Número à vista vira contrato — a pessoa calcula quanto falta e desiste
   *  no meio. A barra sozinha dá a mesma noção de avanço sem dar o boleto. */
  semContador?: boolean;
  /** v105: cada resposta sobe na hora (o funil W decide o ECO a partir da 1ª). */
  onAnswer?: (key: string, label: string, all: Record<string, string>) => void;
}) {
  const startIdx = skipFirstAnswered && initialAnswers && questions.length > 0 && initialAnswers[questions[0].key]
    ? items.findIndex((it) => it.kind === "q" && it.qIdx === 1)
    : 0;
  const [idx, setIdx] = useState(startIdx < 0 ? 0 : startIdx);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  /* MESMO CRASH DO FUNIL DO APP (27/07) — e aqui é o funil que está em
     escala. Dois toques no mesmo quadro liam o mesmo `idx`, os dois
     incrementavam, o índice passava do fim e `item.kind` estourava: a pessoa
     via "algo deu errado nesta seção" no meio do quiz, antes do preço.
     Correção idêntica à do ComecarRadar (trava + clamp). É defeito, não
     mudança de comportamento — o funil continua o mesmo. */
  const travaRef = useRef(false);
  useEffect(() => { travaRef.current = false; }, [idx]);
  const item = items[Math.min(idx, items.length - 1)] ?? items[0];
  const q = item.kind === "q" ? questions[item.qIdx] : null;
  useEffect(() => {
    const it = items[idx];
    trackEvent("funnel_view", { step: it.kind === "q" ? `quiz_${it.qIdx + 1}` : it.kind === "extra" ? "quiz_extra" : it.kind === "eco" ? `quiz_eco_${it.qIdx + 1}` : "quiz_proof" });
  }, [idx, items]);
  const back = () => { if (idx === 0) onBack(); else setIdx((i) => i - 1); };
  const advance = (next: Record<string, string>) => {
    if (travaRef.current) return;
    travaRef.current = true;
    if (idx < items.length - 1) setIdx((i) => Math.min(i + 1, items.length - 1));
    else onDone(next);
  };
  /* v105: a escolha PRIMEIRO acende (borda grafite + tique magenta, 240 ms) e
   * só então avança — é o feedback que o Cal AI dá e que a tela seca não dava.
   * A trava continua valendo desde o toque: dois toques no mesmo quadro não
   * avançam duas vezes. */
  const [escolhida, setEscolhida] = useState<string | null>(null);
  useEffect(() => { setEscolhida(null); }, [idx]);
  const pick = (label: string) => {
    if (!q || travaRef.current) return;
    travaRef.current = true;
    setEscolhida(label);
    const next = { ...answers, [q.key]: label };
    setAnswers(next);
    trackEvent("funnel_quiz_answer", { q: q.key, answer: label });
    onAnswer?.(q.key, label, next);
    window.setTimeout(() => {
      travaRef.current = false;
      advance(next);
    }, 240);
  };
  return (
    <div className="w-full max-w-md mx-auto">
      {/* topo: voltar + progresso */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={back} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${((idx + 1 + counterBase) / (items.length + counterBase)) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
        {!semContador && <span className="text-xs text-muted-foreground tabular-nums">{idx + 1 + counterBase}/{items.length + counterBase}</span>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={item.kind === "q" ? q!.key : item.kind === "eco" ? `eco${item.qIdx}` : item.kind} {...slide}>
          {item.kind === "extra" ? (
            extraSlide?.(() => advance(answers)) ?? null
          ) : item.kind === "eco" ? (
            ecoSlide?.(item.qIdx, answers, () => advance(answers)) ?? null
          ) : item.kind === "proof" ? (
            proofArea && proofArea !== "dinheiro" ? (
              <AreaProofSlide area={proofArea} answer={answers.consistencia ?? ""} onNext={() => advance(answers)} />
            ) : (
              <ProofSlide gasto={answers.gasto ?? ""} onNext={() => advance(answers)} />
            )
          ) : (
            <>
              <h2 className="text-[26px] font-extrabold tracking-[-0.02em] leading-[1.15] mb-6">{q!.q}</h2>
              <div className="space-y-2.5">
                {q!.opts.map((o, i) => {
                  /* v105: ícone em TODA opção (o mesmo vocabulário da porta e do
                     painel do app), linha branca, borda grafite ao escolher. */
                  const Icone = iconeDaOpcao(o.label);
                  const paleta = corDaOpcao(i);
                  const sel = escolhida === o.label;
                  return (
                    <motion.button
                      key={o.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
                      onClick={() => pick(o.label)}
                      className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[0.985] transition-[transform,border-color,background-color] duration-150 ${
                        sel ? "border-[#16121c] bg-[#F6F5F3]" : "border-border bg-card"
                      }`}
                    >
                      <span className="grid place-items-center w-[42px] h-[42px] rounded-xl shrink-0" style={{ background: paleta.cor, color: paleta.tinta }}>
                        <Icone className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
                      <span className={`grid place-items-center w-[22px] h-[22px] rounded-full border-2 shrink-0 transition-colors ${sel ? "border-accent bg-accent" : "border-border"}`}>
                        <Check className={`w-3 h-3 text-white transition-transform ${sel ? "scale-100" : "scale-0"}`} strokeWidth={3.5} />
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------ prova social no funil */

/**
 * Tela dedicada de prova (30/07) — cópia da lei do Cal AI analisada frame a
 * frame ("Join over 10 million people like you": agregado + fileira de rostos
 * + review, posicionada ANTES do "gerar seu plano"). O BitePal faz o mesmo no
 * momento do compromisso ("Over 10,000+ with 5-star reviews"). Aqui ela entra
 * entre o fim do quiz e o loading: a pessoa acabou de investir 5 respostas e
 * está prestes a "receber" o plano — é o pico de compromisso do funil.
 * Depoimentos REAIS (feedbacks do Instagram, curadoria do dono; fotos são
 * avatares escolhidos pelo dono — decisão dele, 29/07).
 */
const PROVA_AVATARES: Array<{ foto?: string; ini?: string; cor?: string }> = [
  { foto: "/depoimentos/mariana.jpg" },
  { foto: "/depoimentos/joaop.jpg" },
  { foto: "/depoimentos/amanda.jpg" },
  { foto: "/depoimentos/gabriel.jpg" },
  { foto: "/depoimentos/fernandar.jpg" },
];

/** As avaliações são da GOOGLE PLAY. No iPhone a loja não pode ser citada
 *  (3.1.1) e dizer "App Store" seria mentira — fica "avaliação de usuário". */
const rotuloDaLoja = () => (ehApple() ? "avaliação de usuário" : "Google Play");

export function ProvaSocialScreen({ onNext }: { onNext: () => void }) {
  useEffect(() => { trackEvent("funnel_view", { step: "prova_social" }); }, []);
  return (
    <div className="w-full max-w-sm mx-auto text-center pt-4">
      <div className="flex items-center justify-center mb-4" aria-hidden>
        <span className="flex -space-x-2.5">
          {PROVA_AVATARES.map((a, i) =>
            a.foto ? (
              <img key={i} src={a.foto} alt="" loading="lazy"
                className="w-11 h-11 rounded-full border-2 border-white object-cover shadow-sm" />
            ) : (
              <span key={i} className="grid place-items-center w-11 h-11 rounded-full border-2 border-white text-[15px] font-bold text-white shadow-sm" style={{ background: a.cor }}>
                {a.ini}
              </span>
            ))}
        </span>
      </div>
      <div className="text-[15px] tracking-wide text-[#f0a500] mb-2" aria-label="5 estrelas">★★★★★</div>
      <h2 className="text-[26px] font-bold tracking-tight leading-[1.15] mb-2">
        Junte-se a <span className="text-accent">+1000 pessoas</span><br />organizando a vida
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        Gente que também cansou de app separado pra cada coisa.
      </p>
      {/* 03/09: as duas citações viraram avaliações REAIS da Google Play,
          palavra por palavra, com o nome que a loja mostra. Sem foto, sem
          nota, sem quantidade (dono). No iPhone a loja não é citada (3.1.1). */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-2xl border border-border bg-card p-4 text-left mb-3"
      >
        <p className="text-[13px] leading-relaxed">
          “Que app incrível! Tudo que eu sempre quis num planner online. É maravilhoso pra se organizar e motivar. Vale cada centavo.”
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold text-white" style={{ background: "#D22D80" }}>E</span>
          <p className="text-[11px] text-muted-foreground font-semibold">Elisa D. — {rotuloDaLoja()} <span className="text-[#f0a500]">★★★★★</span></p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="rounded-2xl border border-border bg-card p-4 text-left mb-7"
      >
        <p className="text-[13px] leading-relaxed">
          “aplicativo muito bom, vale o preço, depois que baixei, organizei minha rotina, e estou ganhando mais por causa disso, e passando mais tempo com a minha família”
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold text-white" style={{ background: "#127A56" }}>P</span>
          <p className="text-[11px] text-muted-foreground font-semibold">Paulo P. — {rotuloDaLoja()} <span className="text-[#f0a500]">★★★★★</span></p>
        </div>
      </motion.div>
      <Button size="lg" className="w-full h-12 text-base" onClick={onNext}>
        Montar meu plano <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function ProgressScreen({ onDone, steps = PREP_STEPS }: { onDone: () => void; steps?: string[] }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= steps.length) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 500 : 850);
    return () => clearTimeout(t);
  }, [done, onDone, steps.length]);
  const pct = Math.round((done / steps.length) * 100);
  const C = 2 * Math.PI * 44;
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="relative w-28 h-28 mx-auto mb-7">
        <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--accent))" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-2xl font-bold tabular-nums">{pct}%</div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Preparando seu plano…</h2>
      <p className="text-muted-foreground text-sm mb-8">Isso leva só alguns segundos.</p>
      <div className="space-y-3 text-left max-w-xs mx-auto">
        {steps.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "pending";
          return (
            <div key={s} className="flex items-center gap-3">
              {state === "done" ? <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                : state === "active" ? <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />}
              <span className={`text-sm ${state === "pending" ? "text-muted-foreground/60" : "text-foreground"}`}>{s}</span>
            </div>
          );
        })}
      </div>
      {/* 01/08 (ordem do dono): o depoimento da espera saiu junto com o resto
          da prova social — funil de volta ao estado de 29/07. */}
    </div>
  );
}

/** Diagnóstico derivado das respostas — barras que dão o momento "isso sou eu". */
function DiagnosisCard({ answers }: { answers: Record<string, string> }) {
  const semControle = answers.controle === "Não controlo" || answers.controle === "Bloco de notas";
  const rows = [
    { label: "Visibilidade dos gastos", pct: semControle ? 18 : 38, level: "Baixa", tone: "bg-destructive/70" },
    { label: "Organização das contas", pct: answers.atrapalha === "Esqueço contas" ? 22 : 42, level: semControle ? "Baixa" : "Média", tone: "bg-amber-500/80" },
    { label: "Potencial de economia", pct: 88, level: "Alto", tone: "bg-accent" },
  ];
  return (
    <Card className="p-4 text-left space-y-3.5 mb-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu diagnóstico</div>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[13px] font-semibold">{r.label}</span>
            <span className={`text-[11px] font-bold ${r.pct >= 60 ? "text-accent" : "text-muted-foreground"}`}>{r.level}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${r.tone}`}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct}%` }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

function ResultScreen({ answers, onDone }: { answers: Record<string, string>; onDone: () => void }) {
  // Coloca a "vitória" escolhida em primeiro, pra parecer feito pra ela.
  const items = answers.vitoria
    ? [answers.vitoria, ...RESULT_ITEMS.filter((r) => r !== answers.vitoria)].slice(0, 4)
    : RESULT_ITEMS.slice(0, 4);
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-16 h-16 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-4">
        <Sparkles className="w-8 h-8" />
      </motion.div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">Análise concluída</div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-5">Seu plano personalizado<br />está pronto</h2>
      <DiagnosisCard answers={answers} />
      <Card className="p-4 text-left space-y-3 mb-7">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Com o CORE, você vai</div>
        {items.map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.08 }}
            className="flex items-start gap-2.5 text-[14px]">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            {r}
          </motion.div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={() => { trackEvent("funnel_click", { cta: "result" }); onDone(); }}>
        Ver meu painel <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Abre o app de verdade, com dados de exemplo</p>
    </div>
  );
}

function SignupScreen({ onSession, onConfirm }: { onSession: () => void; onConfirm: (email: string) => void }) {
  const { signUp, signIn } = useAuth();
  const { set: setUserData } = useUserData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "User already registered": a pessoa voltou pelo anúncio e já tem conta.
  // Em vez de beco sem saída, oferece login com o e-mail que ela já digitou.
  const [existingAccount, setExistingAccount] = useState(false);
  // Link mágico (17/08): dos 23 "User already registered"/semana, 8 morriam —
  // todos no mesmo lugar: não lembram a senha (5 clicaram em "recuperar" e
  // nunca voltaram do e-mail). O link mágico corta a senha do caminho:
  // um clique no e-mail e a pessoa volta LOGADA direto na oferta.
  const [magicSent, setMagicSent] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (existingAccount || !!name.trim());
  // Webview do Instagram/Facebook: o Google trava o OAuth ali (dados de 11/07:
  // ~metade dos cliques falhavam e era ONDE o cadastro morria). Some com o
  // botão nesse ambiente e vai direto pro e-mail — igual o Auth.tsx já faz.
  const [inApp] = useState(isInAppBrowser);
  useEffect(() => {
    if (inApp) trackEvent("funnel_view", { step: "signup_inapp_browser" });
  }, [inApp]);

  const handleGoogle = async () => {
    if (loading || googleLoading) return;
    setErr(null);
    setGoogleLoading(true);
    trackEvent("funnel_click", { cta: "signup_google", inapp: inApp });
    // O VALOR é o caminho do funil (17/08): o AuthCallback usa pra voltar pro
    // funil CERTO — antes voltava fixo pro /comecar, o funil velho.
    try { localStorage.setItem(FUNNEL_OAUTH_KEY, window.location.pathname); } catch { /* noop */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error) {
      try { localStorage.removeItem(FUNNEL_OAUTH_KEY); } catch { /* noop */ }
      trackEvent("funnel_error", { where: "signup_google", inapp: inApp, message: (error.message || "").slice(0, 200) });
      setErr(error.message || "Não consegui abrir o Google. Tente de novo.");
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) { setErr("Digite seu e-mail pra receber o link."); return; }
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getAuthRedirectUrl("/update-password"),
    });
    trackEvent("funnel_click", { cta: "signup_reset_password" });
    if (error) setErr(error.message);
    else setErr("Enviamos um link de recuperação pro seu e-mail. ✓");
  };

  const handleMagicLink = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) { setErr("Digite seu e-mail pra receber o link."); return; }
    setErr(null);
    trackEvent("funnel_click", { cta: "signup_magic_link", inapp: inApp });
    // Mesmo caminho de volta do Google: /auth/callback lê a flag e devolve
    // pra oferta. Se o e-mail abrir em OUTRO navegador (comum no webview do
    // Instagram), a flag não existe lá e a pessoa cai logada no app — pior
    // que a oferta, melhor que morrer na senha.
    try { localStorage.setItem(FUNNEL_OAUTH_KEY, window.location.pathname); } catch { /* noop */ }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: getAuthRedirectUrl("/auth/callback"), shouldCreateUser: false },
    });
    if (error) {
      trackEvent("funnel_error", { where: "signup_magic_link", message: (error.message || "").slice(0, 200) });
      setErr(error.message || "Não consegui enviar o link. Tente a senha ou a recuperação.");
      return;
    }
    setMagicSent(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setErr(null);
    setLoading(true);

    // Modo "entrar" (e-mail já tinha conta): loga direto, sem tentar criar.
    if (existingAccount) {
      trackEvent("funnel_click", { cta: "existing_login_submit" });
      const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
      if (signInErr) {
        setErr("Senha incorreta. Tente de novo ou recupere abaixo.");
        setLoading(false);
        return;
      }
      trackEvent("funnel_click", { cta: "signup_success", via: "existing_login" });
      setLoading(false);
      onSession();
      return;
    }

    trackEvent("funnel_click", { cta: "signup_submit" });
    const { error, session } = await signUp(email.trim().toLowerCase(), password, name.trim());
    if (error) {
      // O MOTIVO importa: sem ele, "7 submits sem sucesso" (caso real de
      // 09/07) fica indiagnosticável — senha? e-mail já usado? rede do webview?
      trackEvent("funnel_error", { where: "signup_submit", inapp: inApp, message: (error.message || "").slice(0, 200) });
      const already = /already registered|already been registered|user already/i.test(error.message || "");
      if (already) {
        // Já tem conta: tenta logar com a senha que ela ACABOU de digitar
        // (o caminho mais curto — se acertou, entra direto no paywall).
        const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
        if (!signInErr) {
          // Login de conta existente: NÃO força tutorial (pode já ter feito).
          trackEvent("funnel_click", { cta: "signup_success", via: "existing_login" });
          setLoading(false);
          onSession();
          return;
        }
        // Senha não bateu: mostra o caminho de recuperação, sem beco sem saída.
        setExistingAccount(true);
        setErr("Esse e-mail já tem conta. Entre com sua senha — ou recupere abaixo.");
        setLoading(false);
        return;
      }
      setErr(error.message || "Não consegui criar a conta. Tente outro e-mail.");
      setLoading(false);
      return;
    }
    try { setUserData("user-name", name.trim()); } catch { /* noop */ }
    /*
     * TUTORIAL PRA QUEM ESCOLHEU QUALQUER ÁREA (05/08) — mesma correção do
     * funil do app (ver ComecarRadar). A marca era gravada só pra "dinheiro",
     * mas o tour do módulo (SpotlightOverlay) depende dela: quem escolhia
     * outra área não via assistente NEM tour, e a 1ª visita ao módulo ainda
     * marcava o tour como visto. 5 dos 20 pagantes de 05/08 entraram assim.
     */
    try {
      const vidaArea = localStorage.getItem(FUNNEL_AREA_KEY);
      setUserData("force-new-user-tutorial", "true");
      localStorage.setItem("force-new-user-tutorial", "true");
      const chave = vidaArea && vidaArea in AREA_TUTORIAL
        ? AREA_TUTORIAL[vidaArea as AreaKey]
        : null;
      if (chave) setUserData("tutorial-selected-modules", [chave]);
    } catch { /* noop */ }
    trackEvent("funnel_click", { cta: "signup_success", instant: !!session });
    fireMetaEvent("CompleteRegistration", { content_name: "signup" });
    setLoading(false);
    if (session) onSession();
    else onConfirm(email.trim().toLowerCase());
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Último passo
        </div>
        <h2 className="text-[26px] font-bold tracking-tight leading-tight">
          Só falta 1 passo pra você<br />começar a usar o CORE.
        </h2>
        <p className="text-muted-foreground text-sm mt-2">Crie sua conta pra destravar seu plano personalizado.</p>
      </div>

      {/* Fora do webview: Google é o caminho rápido. Dentro do Instagram/FB
          o OAuth trava, então nem mostra — e-mail vira o único caminho. */}
      {!inApp ? (
        <>
          <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading || googleLoading} className="w-full h-12 gap-2 text-[15px] font-semibold">
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GoogleIcon /> Continuar com Google</>}
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou com e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted-foreground leading-snug text-center mb-4">
          Crie sua conta com e-mail e senha — leva 10 segundos.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => { setEmail(e.target.value); if (existingAccount) { setExistingAccount(false); setErr(null); } }} autoComplete="email" className="h-12" />
        <Input type="password" placeholder={existingAccount ? "Sua senha" : "Crie uma senha (mín. 6)"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={existingAccount ? "current-password" : "new-password"} className="h-12" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : existingAccount ? <>Entrar e continuar <ArrowRight className="w-4 h-4" /></> : <>Criar conta e continuar <ArrowRight className="w-4 h-4" /></>}
        </Button>
        {existingAccount && !magicSent && (
          <>
            {/* O caminho SEM SENHA vem primeiro e com cara de botão: quem cai
                aqui não lembra a senha (8 mortes/semana medidas, todas neste
                ponto). "Esqueci minha senha" (reset) fica como plano C — exige
                trocar a senha; o link mágico só exige 1 clique. */}
            <Button type="button" variant="outline" size="lg" className="w-full h-12 text-base" onClick={handleMagicLink}>
              Entrar sem senha (link por e-mail)
            </Button>
            <button type="button" onClick={handleForgotPassword} className="w-full text-center text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
              Esqueci minha senha
            </button>
          </>
        )}
        {magicSent && (
          <p className="text-[13.5px] text-center leading-relaxed rounded-xl bg-muted/50 border border-border p-3">
            📩 Link enviado pra <strong>{email.trim().toLowerCase()}</strong>.<br />
            Abre teu e-mail e clica — você volta <strong>logado, direto na oferta</strong>.
          </p>
        )}
      </form>
      <div className="mt-5"><TrustRow /></div>
    </div>
  );
}

function ConfirmScreen({ email }: { email: string }) {
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <MailCheck className="w-10 h-10" />
      </div>
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-2">Falta 1 clique: confirme<br />seu e-mail.</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Mandamos um link pra <strong className="text-foreground">{email}</strong>. Confirme e <strong>seu plano te espera</strong> do outro lado.
      </p>
      <Button asChild size="lg" className="w-full h-12 text-base">
        <Link to="/auth">Já confirmei — entrar</Link>
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Não chegou? Veja o spam ou aguarde 1 minuto.</p>
    </div>
  );
}

/* ----------------------------------------------------------------- shell */

export default function ComecarDia14() {
  const [params] = useSearchParams();
  const { user, isSubscribed, subLoaded } = useAuth();
  // Volta da demo (?step=signup) cai no cadastro; volta do OAuth Google
  // (?step=offer, via /auth/callback) cai direto no paywall.
  // ("trial" é aceito por compat com links antigos.)
  const [step, setStep] = useState<Step>(() => {
    const s = params.get("step");
    return s === "signup" ? "signup" : s === "offer" || s === "trial" ? "offer" : "start";
  });
  const [confirmEmail, setConfirmEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Funil vitrine: /inicio (URL limpa dos anúncios) ou ?porta=vida (compat).
  // Criativo "app pra vida inteira". A área escolhida persiste — quem volta
  // da demo (?step=signup) segue na trilha.
  const { pathname } = useLocation();
  const vitrine = pathname.startsWith("/inicio") || params.get("porta") === "vida";
  const [area, setArea] = useState<AreaKey | null>(() => {
    try {
      const a = localStorage.getItem(FUNNEL_AREA_KEY);
      return a && a in AREAS ? (a as AreaKey) : null;
    } catch { return null; }
  });
  const track: QuizQ[] = vitrine && area && area !== "dinheiro" ? AREA_TRACKS[area] : QUIZ;
  // Trilhas de vida ganham a tela de PICO depois da pergunta de consistência.
  const trackItems = vitrine && area && area !== "dinheiro"
    ? buildQuizItems(track, "consistencia")
    : QUIZ_ITEMS;
  const vidaPrepSteps = area
    ? ["Analisando suas respostas", "Montando sua central", `Preparando o módulo de ${AREAS[area].nome}`, "Finalizando seu plano personalizado"]
    : PREP_STEPS;

  // Captura UTM/referrer da entrada no funil — sem isso o admin não sabe
  // qual campanha/origem trouxe cada sessão.
  useEffect(() => {
    captureLandingMeta();
    // Meta Pixel: visitante entrou no funil (topo). A Compra vem da Cakto.
    fireMetaEvent("ViewContent", { content_name: "funil_comecar" });
  }, []);

  // Telemetria do funil: cada tela vista (a "quiz" emite quiz_1/2/3 por dentro
  // e o paywall emite offer/wheel/downsell por conta própria).
  useEffect(() => {
    if (step !== "quiz" && step !== "offer") {
      trackEvent("funnel_view", {
        step,
        // Segmenta o funil vitrine ("vida") do funil padrão (finanças) no admin.
        ...(vitrine ? { porta: "vida" } : {}),
        // Só na 1ª tela: sinal pra distinguir visita real de pré-carregamento
        // do webview (Instagram/TikTok pré-abrem a página antes do tap real —
        // isso chega com visibilityState "hidden"/"prerender").
        ...(step === "start"
          ? { visibility: document.visibilityState, ua: navigator.userAgent.slice(0, 200) }
          : {}),
      });
    }
  }, [step]);

  // Assinante logado não tem nada a fazer no funil — manda pro app, na área
  // que ele escolheu. Caso real de 12/07: pagante voltou pro /inicio pelo
  // link do anúncio, reviu o quiz, tentou recriar a conta ("User already
  // registered") e cancelou achando que era problema técnico.
  if (user && subLoaded && isSubscribed) {
    return <Navigate to={area && area !== "dinheiro" ? `/${AREAS[area].module}` : "/financas"} replace />;
  }

  // Paywall é full-bleed (tem fundo, padding e CTA sticky próprios)
  if (step === "offer") return <PaywallFlow context="funnel" answers={answers} />;

  return (
    <div style={LIGHT_VARS} className="min-h-dvh bg-white text-foreground flex flex-col">
      <div className={`flex-1 flex flex-col ${step === "start" ? "px-5 pt-3 pb-7" : "items-center justify-center px-5 py-12"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={step} {...fade} className={step === "start" ? "w-full flex-1 flex flex-col" : "w-full"}>
            {step === "start" && (vitrine ? (
              <VitrineStartScreen
                onPickArea={(picked, label) => {
                  setArea(picked);
                  const first = { area: picked };
                  setAnswers(first);
                  try { localStorage.setItem(FUNNEL_AREA_KEY, picked); } catch { /* noop */ }
                  trackEvent("funnel_click", { cta: "start", porta: "vida", area: picked });
                  trackEvent("funnel_quiz_answer", { q: "area", answer: label });
                  setStep("quiz");
                }}
              />
            ) : (
              <StartScreen
                onPick={(firstAnswer) => {
                  const first = { [QUIZ[0].key]: firstAnswer };
                  setAnswers(first);
                  trackEvent("funnel_click", { cta: "start" });
                  // A 1ª pergunta virou a tela inicial: emite quiz_1 aqui pra o
                  // passo "Quiz 1" do admin continuar contando (o QuizScreen
                  // agora começa no quiz_2).
                  trackEvent("funnel_view", { step: "quiz_1" });
                  trackEvent("funnel_quiz_answer", { q: QUIZ[0].key, answer: firstAnswer });
                  setStep("quiz");
                }}
              />
            ))}
            {step === "quiz" && (
              <QuizScreen
                questions={track}
                items={trackItems}
                skipFirstAnswered={!vitrine}
                proofArea={vitrine && area ? area : undefined}
                initialAnswers={answers}
                onBack={() => setStep("start")}
                onDone={(a) => {
                  setAnswers(a);
                  // Persiste pro paywall personalizar mesmo após OAuth/refresh
                  try { localStorage.setItem("funnel-quiz-answers", JSON.stringify(a)); } catch { /* noop */ }
                  // 01/08 (ordem do dono): funil volta ao de 29/07 — a tela de
                  // prova sai do caminho. Religar = setStep("prova") aqui.
                  setStep("progress");
                }}
              />
            )}
            {step === "prova" && <ProvaSocialScreen onNext={() => setStep("progress")} />}
            {step === "progress" && <ProgressScreen steps={vitrine ? vidaPrepSteps : PREP_STEPS} onDone={() => setStep("result")} />}
            {step === "result" && (vitrine && area ? (
              <RadarResultScreen answers={answers} area={area} onDone={() => setStep("central")} />
            ) : (
              <ResultScreen answers={answers} onDone={() => { window.location.href = DEMO_URL; }} />
            ))}
            {step === "central" && area && (
              <CentralScreen area={area} onOpen={() => { window.location.href = demoUrlFor(area); }} />
            )}
            {step === "signup" && (
              <SignupScreen
                onSession={() => setStep("offer")}
                onConfirm={(e) => { setConfirmEmail(e); setStep("confirm"); }}
              />
            )}
            {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
