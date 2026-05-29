import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import {
  DollarSign, TrendingDown, TrendingUp, BarChart3, Heart,
  Calendar, AlertCircle, Bell, CheckCircle2, ChevronDown, Star, RefreshCw, ArrowDown,
} from "lucide-react";

import ipadImg from "@/assets/ipad-10.jpg";

interface WelcomeScreenProps {
  onComplete?: () => void;
  onLogin?: () => void;
}

// ---------- Slide mockups ----------

const Dot = ({ className }: { className?: string }) => (
  <span className={`absolute rounded-full ${className}`} />
);
const FloatCard = ({
  label,
  value,
  color,
  icon: Icon,
  iconFill = false,
  className = "",
  style,
  delay = 0,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof DollarSign;
  iconFill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    style={style}
    className={`absolute flex items-center gap-2.5 rounded-2xl pl-2 pr-4 py-2 shadow-md ${className}`}
  >
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `hsl(var(${color}))` }}
    >
      <Icon className="w-4 h-4 text-white" strokeWidth={2.25} fill={iconFill ? "currentColor" : "none"} />
    </div>
    <div>
      <p className="text-[10px] text-foreground/60 leading-none">{label}</p>
      <p className="text-[13px] font-bold text-foreground leading-tight mt-1">{value}</p>
    </div>
  </motion.div>
);

const SlideOneMock = () => (
  <div className="w-full max-w-[340px] mx-auto">
    {/* Área dos 4 cards flutuantes com confetes */}
    <div className="relative w-full h-[260px]">
      {/* dots decorativos */}
      <Dot className="w-1 h-1 bg-[hsl(var(--chart-2)/0.6)] top-1 left-16" />
      <Dot className="w-1.5 h-1.5 bg-[hsl(var(--chart-1)/0.5)] top-3 right-8" />
      <Dot className="w-1 h-1 bg-[hsl(var(--chart-4)/0.5)] top-24 left-2" />
      <Dot className="w-1 h-1 bg-[hsl(var(--chart-3)/0.6)] top-32 right-1" />
      <Dot className="w-1.5 h-1.5 bg-[hsl(var(--chart-2)/0.4)] bottom-8 left-8" />
      <Dot className="w-1 h-1 bg-[hsl(var(--chart-4)/0.5)] bottom-16 right-20" />
      <Dot className="w-1 h-1 bg-[hsl(var(--chart-1)/0.5)] bottom-2 right-6" />

      {/* Receitas — amarelo (chart-3) */}
      <FloatCard
        label="Receitas"
        value="R$ 6.400,00"
        color="--chart-3"
        icon={DollarSign}
        delay={0.05}
        style={{ transform: "rotate(-4deg)" }}
        className="top-0 left-0 bg-[hsl(var(--chart-3)/0.22)]"
      />

      {/* Despesas — lilás (chart-4) */}
      <FloatCard
        label="Despesas"
        value="R$ 635,00"
        color="--chart-4"
        icon={ArrowDown}
        delay={0.15}
        style={{ transform: "rotate(4deg)" }}
        className="top-16 right-0 bg-[hsl(var(--chart-4)/0.22)]"
      />

      {/* Investimentos — verde (chart-2) */}
      <FloatCard
        label="Investimentos"
        value="R$ 14.500,00"
        color="--chart-2"
        icon={BarChart3}
        delay={0.25}
        style={{ transform: "rotate(-3deg)" }}
        className="top-[120px] left-2 bg-[hsl(var(--chart-2)/0.22)]"
      />

      {/* Desejos — rosa (chart-1) */}
      <FloatCard
        label="Desejos"
        value="R$ 1.200,00"
        color="--chart-1"
        icon={Heart}
        iconFill
        delay={0.35}
        style={{ transform: "rotate(3deg)" }}
        className="top-[180px] right-0 bg-[hsl(var(--chart-1)/0.22)]"
      />
    </div>

    {/* Resumo do mês */}
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      className="bg-card border border-border/60 rounded-2xl px-4 py-3 shadow-sm mt-2"
    >
      <p className="text-[12px] font-semibold text-foreground mb-1.5">Resumo do mês</p>
      <div className="text-[11px]">
        <div className="flex items-center justify-between py-1.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-[hsl(var(--chart-2))]" strokeWidth={1.75} />
            Saldo do mês
          </span>
          <span className="font-semibold text-[hsl(var(--chart-2))]">+R$ 5.765,00</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border/50">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-[hsl(var(--chart-3))]" strokeWidth={1.75} />
            Contas a pagar
          </span>
          <span className="font-semibold text-[hsl(var(--chart-3))]">2</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-border/50">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Bell className="w-4 h-4 text-[hsl(var(--chart-1))]" strokeWidth={1.75} />
            Alertas inteligentes
          </span>
          <span className="font-semibold text-[hsl(var(--chart-1))]">2</span>
        </div>
      </div>
    </motion.div>
  </div>
);



const SlideTwoMock = () => (
  <div className="w-full max-w-[300px] mx-auto space-y-2.5">
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-[hsl(var(--chart-3)/0.2)] rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Receitas</span>
          <DollarSign className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 6.400</p>
      </div>
      <div className="bg-[hsl(var(--chart-2)/0.2)] rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Despesas</span>
          <TrendingDown className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 635</p>
      </div>
      <div className="bg-[hsl(var(--chart-1)/0.2)] rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Saldo do mês</span>
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">+R$ 5.765</p>
      </div>
      <div className="bg-[hsl(var(--chart-4)/0.18)] rounded-2xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Investimentos</span>
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 14.500</p>
      </div>
    </div>

    <div className="bg-card border border-border/60 rounded-2xl p-3 space-y-2">
      <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
        <Bell className="w-3 h-3" /> Alertas inteligentes
      </p>
      <div className="flex items-start gap-2 bg-muted/40 rounded-xl p-2">
        <Calendar className="w-3 h-3 text-[hsl(var(--chart-4))] mt-0.5 flex-shrink-0" />
        <div className="text-[10px]">
          <p className="text-foreground">2 conta(s) vencem em 2 dia(s)</p>
          <p className="text-muted-foreground">Cartão Nubank, Netflix</p>
        </div>
      </div>
      <div className="flex items-start gap-2 bg-muted/40 rounded-xl p-2">
        <CheckCircle2 className="w-3 h-3 text-[hsl(var(--chart-1))] mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-foreground">Excelente! Você está poupando 90.1% da sua renda este mês.</p>
      </div>
    </div>

    <div className="bg-card border border-border/60 rounded-2xl p-3">
      <p className="text-[11px] font-semibold text-foreground mb-2">Gastos por categoria</p>
      <div className="flex items-center gap-3">
        {/* mini donut */}
        <div
          className="w-14 h-14 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(
              hsl(var(--chart-5)) 0% 30%,
              hsl(var(--chart-3)) 30% 50%,
              hsl(var(--chart-2)) 50% 65%,
              hsl(var(--chart-1)) 65% 80%,
              hsl(var(--chart-4)) 80% 100%
            )`,
          }}
        >
          <div className="w-full h-full rounded-full flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-card" />
          </div>
        </div>
        <div className="flex-1 space-y-0.5 text-[10px]">
          {[
            { c: "--chart-5", n: "Moradia", v: "R$ 1.300" },
            { c: "--chart-3", n: "Educação", v: "R$ 450" },
            { c: "--chart-2", n: "Contas da Casa", v: "R$ 225" },
            { c: "--chart-1", n: "Lazer", v: "R$ 180" },
            { c: "--chart-4", n: "Outros", v: "R$ 120" },
          ].map((r) => (
            <div key={r.n} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(var(${r.c}))` }} />
                {r.n}
              </span>
              <span className="text-muted-foreground tabular-nums">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SlideThreeMock = () => {
  const cats = [
    { name: "Transporte", val: 50, max: 250, color: "--chart-2" },
    { name: "Alimentação", val: 180, max: 350, color: "--chart-3" },
    { name: "Vestuário", val: 220, max: 250, color: "--chart-5" },
    { name: "Lazer", val: 65, max: 180, color: "--chart-1" },
    { name: "Pets", val: 120, max: 200, color: "--muted-foreground" },
  ];
  const chips = ["Alimentação", "Transporte", "Moradia", "Educação", "Lazer", "Saúde", "Contas da Casa", "Internet", "Pets", "Viagem", "Presentes", "Outros"];
  return (
    <div className="w-full max-w-[300px] mx-auto space-y-2.5">
      <div className="bg-card border border-border/60 rounded-2xl p-3">
        <p className="text-[11px] font-semibold text-foreground mb-2.5">Limites por categoria</p>
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.name}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-medium" style={{ color: `hsl(var(${c.color}))` }}>{c.name}</span>
                <span className="text-muted-foreground tabular-nums">R$ {c.val} / R$ {c.max}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.val / c.max) * 100}%`, background: `hsl(var(${c.color}))` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border/60 rounded-2xl p-3">
        <p className="text-[11px] font-semibold text-foreground mb-2">Categorias populares</p>
        <div className="flex flex-wrap gap-1">
          {chips.map((c, i) => (
            <span
              key={c}
              className="text-[9px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: `hsl(var(--chart-${(i % 5) + 1}) / 0.18)`,
                color: `hsl(var(--chart-${(i % 5) + 1}))`,
              }}
            >
              + {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
const SlideFourMock = () => (
  <div className="w-full max-w-[320px] mx-auto space-y-2.5">
    {/* Card externo "Meu desejo" */}
    <div className="bg-card border border-border/60 rounded-2xl p-3 space-y-2.5">
      <p className="text-[11px] font-semibold text-foreground">Meu desejo</p>

      {/* Card interno do produto */}
      <div className="relative bg-card border border-border/60 rounded-2xl p-3">
        <Heart className="absolute top-3 right-3 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />

        <div className="flex items-center justify-center py-2">
          <img
            src={ipadImg}
            alt="iPad 10ª geração"
            width={96}
            height={96}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-24 w-auto object-contain"
          />
        </div>

        <p className="text-[13px] font-semibold text-foreground mt-1">iPad 10ª geração 64GB</p>
        <span className="inline-block mt-1.5 text-[9px] px-2 py-0.5 rounded-md bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))] font-medium">
          Tecnologia
        </span>

        <div className="border-t border-border/60 mt-3 pt-2.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">Guardado</p>
              <p className="text-[13px] font-bold text-[hsl(var(--chart-2))] mt-0.5">R$ 1.200,00</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Falta</p>
              <p className="text-[13px] font-bold text-[hsl(var(--chart-1))] mt-0.5">R$ 2.199,00</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-[35%] rounded-full bg-[hsl(var(--chart-1))]" />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">35%</p>
          </div>
        </div>
      </div>

      {/* Grid de dois mini cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border/60 rounded-xl p-2.5 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <p className="text-[9px] text-muted-foreground leading-tight">Tempo estimado</p>
            <p className="text-[11px] font-bold text-foreground leading-tight mt-0.5">5 meses</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-2.5 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-[hsl(var(--chart-2))]" strokeWidth={1.5} />
          <div>
            <p className="text-[9px] text-muted-foreground leading-tight">Faltam</p>
            <p className="text-[11px] font-bold text-foreground leading-tight mt-0.5">5 meses</p>
          </div>
        </div>
      </div>
    </div>

    {/* Feedback verde fora do card */}
    <div className="bg-[hsl(var(--chart-2)/0.1)] border border-[hsl(var(--chart-2)/0.2)] rounded-xl p-2.5 flex items-start gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--chart-2))] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
      <div className="text-[10px] leading-snug">
        <p className="font-semibold text-foreground">Você está no caminho certo!</p>
        <p className="text-muted-foreground mt-0.5">Mantendo esse ritmo, seu objetivo será alcançado em Novembro de 2026.</p>
      </div>
    </div>
  </div>
);


const SlideFiveMock = () => (
  <div className="w-full max-w-[300px] mx-auto">
    <div className="bg-card border border-border/60 rounded-2xl p-3 space-y-3">
      <p className="text-[11px] font-semibold text-foreground">Nova receita</p>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Fonte da receita</p>
        <div className="border border-border rounded-lg px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs text-foreground">Salário</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Valor</p>
        <div className="border border-border rounded-lg px-3 py-2.5">
          <span className="text-xs text-foreground">R$ 6.400,00</span>
        </div>
      </div>
      <div className="bg-[hsl(var(--chart-3)/0.2)] rounded-xl p-2.5 flex items-start gap-2">
        <Star className="w-3.5 h-3.5 text-[hsl(var(--chart-3))] mt-0.5 fill-[hsl(var(--chart-3))]" />
        <div className="text-[10px]">
          <p className="font-semibold text-foreground">Ótimo começo!</p>
          <p className="text-muted-foreground">Registrar suas receitas é o primeiro passo para ter controle total das suas finanças.</p>
        </div>
      </div>
    </div>
  </div>
);

// ---------- Slides data ----------

const slides = [
  {
    title: <>Tenha controle da<br />sua vida financeira</>,
    subtitle: "Acompanhe receitas, despesas, contas, cartões, investimentos e metas em um só lugar.",
    mock: <SlideOneMock />,
  },

  {
    title: <>Veja seu mês<br />com clareza</>,
    subtitle: "Acompanhe saldo, receitas, despesas e alertas inteligentes sem se perder em planilhas.",
    mock: <SlideTwoMock />,
  },
  {
    title: <>Controle seus<br />gastos e limites</>,
    subtitle: "Organize custos fixos e variáveis, acompanhe categorias e saiba onde seu dinheiro está indo.",
    mock: <SlideThreeMock />,
  },
  {
    title: <>Planeje seus<br />desejos e objetivos</>,
    subtitle: "Acompanhe quanto já guardou, quanto falta e quando poderá comprar sem se desorganizar.",
    mock: <SlideFourMock />,
  },
  {
    title: <>Comece pela sua<br />primeira receita</>,
    subtitle: "Adicione sua fonte de renda para montar a base da sua organização financeira.",
    mock: <SlideFiveMock />,
  },
];

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, _ref) => {
    const [step, setStep] = useState(0);
    const isLast = step === slides.length - 1;
    const showSkip = step < 2; // slides 1 e 2 mostram "Pular"

    useEffect(() => {
      captureLandingMeta();
      trackEvent("landing_view", {});
    }, []);

    useEffect(() => {
      trackEvent("onboarding_step_view", { step: step + 1 });
    }, [step]);

    const goNext = () => {
      if (isLast) finish();
      else setStep((s) => s + 1);
    };
    const goBack = () => setStep((s) => Math.max(0, s - 1));
    const finish = () => {
      trackEvent("start_clicked", { destination: "financas", step: step + 1 });
      onComplete?.();
      window.location.href = "/financas";
    };
    const skip = () => {
      trackEvent("onboarding_skipped", { step: step + 1 });
      finish();
    };

    const current = slides[step];

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-background overflow-hidden px-6"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex-1 flex flex-col w-full max-w-sm mx-auto">
          <span className="text-2xl font-black tracking-tight text-foreground mb-5">CORE</span>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-[1.15]">
                {current.title}
              </h1>
              <p className="text-[13px] text-muted-foreground mt-2 leading-snug">
                {current.subtitle}
              </p>

              <div className="flex-1 flex items-center justify-center py-5">
                {current.mock}
              </div>
            </motion.div>
          </AnimatePresence>

          {isLast ? (
            <div className="flex flex-col gap-3 pb-1">
              <button
                onClick={finish}
                className="w-full py-4 rounded-2xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
              >
                Começar agora
              </button>
              <div className="flex items-center justify-between">
                <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Voltar
                </button>
                <div className="flex gap-1.5">
                  {slides.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-foreground" : "bg-muted"}`} />
                  ))}
                </div>
                <span className="w-10" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-1">
              {step === 0 && (
                <p className="text-[11px] text-muted-foreground text-center">7 dias grátis. Sem complicação.</p>
              )}
              <div className="flex items-center justify-between gap-3">
                {showSkip ? (
                  <button onClick={skip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Pular
                  </button>
                ) : (
                  <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Voltar
                  </button>
                )}
                <div className="flex gap-1.5">
                  {slides.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-foreground" : "bg-muted"}`} />
                  ))}
                </div>
                <button
                  onClick={goNext}
                  className={`rounded-2xl bg-foreground text-background font-semibold active:scale-[0.98] transition-transform ${step === 0 ? "px-6 py-3 text-sm shadow-lg" : "px-5 py-2.5 text-sm"}`}
                >
                  {step === 0 ? "Começar grátis" : "Continuar"}
                </button>
              </div>
            </div>
          )}


          {step === 0 && (
            <Link
              to="/auth"
              onClick={() => { trackEvent("login_clicked", {}); onLogin?.(); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center mt-3"
            >
              Já tem uma conta? <span className="font-semibold text-foreground">Entrar</span>
            </Link>
          )}
        </div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
