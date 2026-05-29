import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import {
  DollarSign, TrendingDown, TrendingUp, BarChart3, Heart,
  Calendar, AlertCircle, Bell, CheckCircle2, ChevronDown, Star,
} from "lucide-react";

interface WelcomeScreenProps {
  onComplete?: () => void;
  onLogin?: () => void;
}

// ---------- Slide mockups ----------

const SlideOneMock = () => (
  <div className="relative w-full max-w-[280px] h-[260px] mx-auto">
    {/* floating cards */}
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="absolute top-2 left-0 bg-card border border-border rounded-2xl px-3 py-2 shadow-md flex items-center gap-2"
    >
      <div className="w-7 h-7 rounded-full bg-[hsl(var(--chart-1)/0.2)] flex items-center justify-center">
        <DollarSign className="w-3.5 h-3.5 text-[hsl(var(--chart-1))]" />
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground leading-none">Receitas</p>
        <p className="text-xs font-bold text-foreground leading-tight">R$ 6.400,00</p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="absolute top-4 right-0 bg-card border border-border rounded-2xl px-3 py-2 shadow-md flex items-center gap-2"
    >
      <div className="w-7 h-7 rounded-full bg-[hsl(var(--chart-4)/0.2)] flex items-center justify-center">
        <TrendingDown className="w-3.5 h-3.5 text-[hsl(var(--chart-4))]" />
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground leading-none">Despesas</p>
        <p className="text-xs font-bold text-foreground leading-tight">R$ 635,00</p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="absolute top-24 left-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-md flex items-center gap-2"
    >
      <div className="w-7 h-7 rounded-full bg-[hsl(var(--chart-2)/0.2)] flex items-center justify-center">
        <BarChart3 className="w-3.5 h-3.5 text-[hsl(var(--chart-2))]" />
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground leading-none">Investimentos</p>
        <p className="text-xs font-bold text-foreground leading-tight">R$ 14.500,00</p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="absolute top-28 right-2 bg-card border border-border rounded-2xl px-3 py-2 shadow-md flex items-center gap-2"
    >
      <div className="w-7 h-7 rounded-full bg-[hsl(var(--chart-5)/0.2)] flex items-center justify-center">
        <Heart className="w-3.5 h-3.5 text-[hsl(var(--chart-5))]" />
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground leading-none">Desejos</p>
        <p className="text-xs font-bold text-foreground leading-tight">R$ 1.200,00</p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      className="absolute bottom-0 inset-x-0 bg-card border border-border rounded-2xl p-3 shadow-md"
    >
      <p className="text-[10px] font-semibold text-foreground mb-1.5">Resumo do mês</p>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-2.5 h-2.5" />Saldo do mês</span>
          <span className="font-semibold text-[hsl(var(--chart-1))]">+R$ 5.765,00</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><AlertCircle className="w-2.5 h-2.5" />Contas a pagar</span>
          <span className="font-semibold text-[hsl(var(--chart-4))]">2</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><Bell className="w-2.5 h-2.5" />Alertas inteligentes</span>
          <span className="font-semibold text-[hsl(var(--chart-4))]">2</span>
        </div>
      </div>
    </motion.div>
  </div>
);

const SlideTwoMock = () => (
  <div className="w-full max-w-[280px] mx-auto space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-[hsl(var(--chart-3)/0.15)] rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground">Receitas</span>
          <DollarSign className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 6.400</p>
      </div>
      <div className="bg-[hsl(var(--chart-4)/0.15)] rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground">Despesas</span>
          <TrendingDown className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 635</p>
      </div>
      <div className="bg-[hsl(var(--chart-1)/0.15)] rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground">Saldo do mês</span>
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">+R$ 5.765</p>
      </div>
      <div className="bg-[hsl(var(--chart-2)/0.15)] rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground">Investimentos</span>
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">R$ 14.500</p>
      </div>
    </div>

    <div className="bg-card border border-border rounded-xl p-2.5 space-y-2">
      <p className="text-[10px] font-semibold text-foreground flex items-center gap-1.5">
        <Bell className="w-3 h-3" /> Alertas inteligentes
      </p>
      <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2">
        <Calendar className="w-3 h-3 text-[hsl(var(--chart-4))] mt-0.5" />
        <div className="text-[9px]">
          <p className="text-foreground">2 conta(s) vencem em 2 dia(s)</p>
          <p className="text-muted-foreground">Cartão Nubank, Netflix</p>
        </div>
      </div>
      <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2">
        <CheckCircle2 className="w-3 h-3 text-[hsl(var(--chart-1))] mt-0.5" />
        <p className="text-[9px] text-foreground">Excelente! Você está poupando 90.1% da sua renda este mês.</p>
      </div>
    </div>
  </div>
);

const SlideThreeMock = () => {
  const cats = [
    { name: "Transporte", val: 50, max: 250, color: "--chart-1" },
    { name: "Alimentação", val: 180, max: 350, color: "--chart-3" },
    { name: "Vestuário", val: 220, max: 250, color: "--chart-5" },
    { name: "Lazer", val: 65, max: 180, color: "--chart-1" },
    { name: "Pets", val: 120, max: 200, color: "--muted-foreground" },
  ];
  const chips = ["Alimentação", "Transporte", "Moradia", "Educação", "Lazer", "Saúde", "Contas da Casa", "Internet", "Pets", "Viagem", "Presentes", "Outros"];
  return (
    <div className="w-full max-w-[280px] mx-auto space-y-2">
      <div className="bg-card border border-border rounded-xl p-2.5">
        <p className="text-[10px] font-semibold text-foreground mb-2">Limites por categoria</p>
        <div className="space-y-1.5">
          {cats.map((c) => (
            <div key={c.name}>
              <div className="flex items-center justify-between text-[9px] mb-0.5">
                <span className="text-foreground">{c.name}</span>
                <span className="text-muted-foreground">R$ {c.val} / R$ {c.max}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.val / c.max) * 100}%`, background: `hsl(var(${c.color}))` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-2.5">
        <p className="text-[10px] font-semibold text-foreground mb-2">Categorias populares</p>
        <div className="flex flex-wrap gap-1">
          {chips.map((c, i) => (
            <span
              key={c}
              className="text-[8px] px-1.5 py-0.5 rounded-full"
              style={{
                background: `hsl(var(--chart-${(i % 5) + 1}) / 0.15)`,
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
  <div className="w-full max-w-[280px] mx-auto">
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <p className="text-[10px] font-semibold text-foreground">Meu desejo</p>
      <div className="bg-muted/40 rounded-lg h-20 flex items-center justify-center">
        <div className="w-12 h-16 bg-gradient-to-br from-[hsl(var(--chart-2)/0.3)] to-[hsl(var(--chart-1)/0.3)] rounded-md" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-foreground">iPad 10ª geração 64GB</p>
        <Heart className="w-3 h-3 text-[hsl(var(--chart-5))]" />
      </div>
      <span className="inline-block text-[8px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]">Tecnologia</span>
      <div className="flex justify-between text-[9px] pt-1">
        <div>
          <p className="text-muted-foreground">Guardado</p>
          <p className="font-bold text-[hsl(var(--chart-5))]">R$ 1.200,00</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Falta</p>
          <p className="font-bold text-[hsl(var(--chart-4))]">R$ 2.199,00</p>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full w-[35%] bg-gradient-to-r from-[hsl(var(--chart-5))] to-[hsl(var(--chart-4))]" />
      </div>
      <p className="text-[9px] text-right text-muted-foreground">35%</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-muted/40 rounded-lg p-1.5">
          <p className="text-[8px] text-muted-foreground">Tempo estimado</p>
          <p className="text-[10px] font-bold text-foreground">5 meses</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-1.5">
          <p className="text-[8px] text-muted-foreground">Faltam</p>
          <p className="text-[10px] font-bold text-foreground">5 meses</p>
        </div>
      </div>
      <div className="bg-[hsl(var(--chart-1)/0.1)] rounded-lg p-2 flex items-start gap-1.5">
        <CheckCircle2 className="w-3 h-3 text-[hsl(var(--chart-1))] mt-0.5" />
        <p className="text-[9px] text-foreground">Você está no caminho certo! Mantendo esse ritmo, seu objetivo será alcançado em Novembro de 2026.</p>
      </div>
    </div>
  </div>
);

const SlideFiveMock = () => (
  <div className="w-full max-w-[280px] mx-auto">
    <div className="bg-card border border-border rounded-xl p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-foreground">Nova receita</p>
      <div>
        <p className="text-[9px] text-muted-foreground mb-1">Fonte da receita</p>
        <div className="border border-border rounded-lg px-2.5 py-2 flex items-center justify-between">
          <span className="text-xs text-foreground">Salário</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      <div>
        <p className="text-[9px] text-muted-foreground mb-1">Valor</p>
        <div className="border border-border rounded-lg px-2.5 py-2">
          <span className="text-xs text-foreground">R$ 6.400,00</span>
        </div>
      </div>
      <div className="bg-[hsl(var(--chart-3)/0.15)] rounded-lg p-2 flex items-start gap-1.5">
        <Star className="w-3 h-3 text-[hsl(var(--chart-3))] mt-0.5" />
        <div className="text-[9px]">
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
    title: <>Organize sua vida<br />financeira em um<br />só lugar</>,
    subtitle: "Controle receitas, despesas, metas, desejos e investimentos com mais clareza no dia a dia.",
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
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex-1 flex flex-col w-full max-w-sm mx-auto">
          <span className="text-xl font-black tracking-tight text-foreground mb-4">CORE</span>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-[26px] font-bold text-foreground tracking-tight leading-[1.15]">
                {current.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-snug">
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
            <div className="flex items-center justify-between gap-3 pb-1">
              {step === 0 ? (
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
                className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                Continuar
              </button>
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
