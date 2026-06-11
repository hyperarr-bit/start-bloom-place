import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, CalendarDays, ShieldCheck, XCircle,
  Wallet, Calendar as CalendarIcon, Sparkles, LayoutGrid,
  Sun, Heart, TrendingUp, TrendingDown, Leaf,
  ChevronLeft, ChevronRight,
  Utensils, Dumbbell, Brain, GraduationCap, Home as HomeIcon,
  PawPrint, Plane, Users, Briefcase, BookOpen, HeartPulse, Flower2,
  type LucideIcon,
} from "lucide-react";

type ModuleItem = {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  bg: string;
  iconBg: string;
  iconFg: string;
  titleColor: string;
};

const MODULES: ModuleItem[] = [
  { key: "financas", title: "FINANÇAS", desc: "Entenda receitas, despesas e investimentos com clareza.", icon: Wallet, bg: "bg-orange-50/70 border-orange-100", iconBg: "bg-orange-100", iconFg: "text-orange-600", titleColor: "text-orange-700" },
  { key: "rotina", title: "ROTINA", desc: "Organize hábitos, consistência e sua semana em poucos toques.", icon: CalendarIcon, bg: "bg-emerald-50/70 border-emerald-100", iconBg: "bg-emerald-100", iconFg: "text-emerald-600", titleColor: "text-emerald-700" },
  { key: "dev", title: "DESENVOLVIMENTO PESSOAL", desc: "Acompanhe metas, forças, afirmações e evolução pessoal.", icon: Sparkles, bg: "bg-violet-50/70 border-violet-100", iconBg: "bg-violet-100", iconFg: "text-violet-600", titleColor: "text-violet-700" },
  { key: "dieta", title: "DIETA", desc: "Planeje refeições, calorias e macros sem complicação.", icon: Utensils, bg: "bg-amber-50/70 border-amber-100", iconBg: "bg-amber-100", iconFg: "text-amber-600", titleColor: "text-amber-700" },
  { key: "treino", title: "TREINO", desc: "Monte e acompanhe seus treinos com clareza total.", icon: Dumbbell, bg: "bg-blue-50/70 border-blue-100", iconBg: "bg-blue-100", iconFg: "text-blue-600", titleColor: "text-blue-700" },
  { key: "saude", title: "SAÚDE", desc: "Hidratação, jejum, exames e bem-estar no mesmo lugar.", icon: HeartPulse, bg: "bg-rose-50/70 border-rose-100", iconBg: "bg-rose-100", iconFg: "text-rose-600", titleColor: "text-rose-700" },
  { key: "hiperfoco", title: "HIPERFOCO", desc: "Capture ideias, metas e estratégias antes que escapem.", icon: Brain, bg: "bg-indigo-50/70 border-indigo-100", iconBg: "bg-indigo-100", iconFg: "text-indigo-600", titleColor: "text-indigo-700" },
  { key: "estudos", title: "ESTUDOS", desc: "Organize matérias, sessões e progresso de aprendizado.", icon: GraduationCap, bg: "bg-yellow-50/70 border-yellow-100", iconBg: "bg-yellow-100", iconFg: "text-yellow-700", titleColor: "text-yellow-700" },
  { key: "carreira", title: "CARREIRA", desc: "Acompanhe metas profissionais, projetos e evolução.", icon: Briefcase, bg: "bg-slate-50/70 border-slate-200", iconBg: "bg-slate-100", iconFg: "text-slate-700", titleColor: "text-slate-700" },
  { key: "biblioteca", title: "BIBLIOTECA", desc: "Sua estante digital com livros, leituras e resumos.", icon: BookOpen, bg: "bg-stone-50/70 border-stone-200", iconBg: "bg-stone-100", iconFg: "text-stone-700", titleColor: "text-stone-700" },
  { key: "casa", title: "CASA", desc: "Limpeza, despensa, manutenções e rotinas do lar.", icon: HomeIcon, bg: "bg-teal-50/70 border-teal-100", iconBg: "bg-teal-100", iconFg: "text-teal-600", titleColor: "text-teal-700" },
  { key: "viagens", title: "VIAGENS", desc: "Roteiros, malas, orçamento e bucket list em um só lugar.", icon: Plane, bg: "bg-sky-50/70 border-sky-100", iconBg: "bg-sky-100", iconFg: "text-sky-600", titleColor: "text-sky-700" },
  { key: "relacionamentos", title: "RELACIONAMENTOS", desc: "Pessoas, datas importantes, presentes e momentos.", icon: Users, bg: "bg-pink-50/70 border-pink-100", iconBg: "bg-pink-100", iconFg: "text-pink-600", titleColor: "text-pink-700" },
  { key: "pet", title: "PET", desc: "Saúde, rotina, gastos e diário do seu pet.", icon: PawPrint, bg: "bg-lime-50/70 border-lime-100", iconBg: "bg-lime-100", iconFg: "text-lime-700", titleColor: "text-lime-700" },
  { key: "beleza", title: "BELEZA", desc: "Skincare, cabelo, produtos e cronogramas personalizados.", icon: Flower2, bg: "bg-fuchsia-50/70 border-fuchsia-100", iconBg: "bg-fuchsia-100", iconFg: "text-fuchsia-600", titleColor: "text-fuchsia-700" },
  { key: "detox", title: "DETOX", desc: "Largue hábitos ruins com tracker, diário e conquistas.", icon: Leaf, bg: "bg-green-50/70 border-green-100", iconBg: "bg-green-100", iconFg: "text-green-600", titleColor: "text-green-700" },
];

const ModulesCarousel = () => {
  const [idx, setIdx] = useState(0);
  const go = (dir: 1 | -1) => setIdx((i) => (i + dir + MODULES.length) % MODULES.length);
  const m = MODULES[idx];
  const Icon = m.icon;
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-semibold text-black/50 tracking-wider">MÓDULOS</div>
          <div className="text-[22px] md:text-3xl font-bold leading-tight">+{MODULES.length} áreas da sua vida</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="w-10 h-10 rounded-full border border-black/10 bg-white hover:border-black/30 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Próximo"
            className="w-10 h-10 rounded-full border border-black/10 bg-white hover:border-black/30 flex items-center justify-center transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={m.key}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className={`rounded-2xl border ${m.bg} p-6 md:p-8 max-w-2xl mx-auto`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-lg ${m.iconBg} ${m.iconFg} flex items-center justify-center`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={`font-bold ${m.titleColor} text-base tracking-wide`}>{m.title}</span>
            </div>
            <p className="text-[15px] text-black/70 mb-1">{m.desc}</p>
            <div className="mt-4 text-[12px] text-black/40 font-medium">
              {idx + 1} / {MODULES.length}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mt-5">
        {MODULES.map((mod, i) => (
          <button
            key={mod.key}
            onClick={() => setIdx(i)}
            aria-label={mod.title}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-emerald-500" : "w-1.5 bg-black/15 hover:bg-black/30"}`}
          />
        ))}
      </div>
    </div>
  );
};

/* =========================================================
   PHONE MOCKUPS (Tailwind only, sem assets externos)
   ========================================================= */

const PhoneFrame = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={
      "relative bg-black rounded-[2rem] p-[5px] shadow-[0_25px_60px_-20px_rgba(0,0,0,0.35)] " +
      "ring-1 ring-black/10 " + className
    }
  >
    {/* notch */}
    <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[34%] h-[18px] bg-black rounded-full z-20" />
    <div className="relative bg-white rounded-[1.7rem] overflow-hidden aspect-[9/19.5]">
      {/* status bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[9px] font-semibold text-black/80">
        <span>10:36</span>
        <span className="opacity-60">••• 📶 🔋</span>
      </div>
      <div className="px-3 pb-3 text-black">{children}</div>
    </div>
  </div>
);

const FinancePhone = () => (
  <div className="space-y-2 text-[8px]">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 font-bold">
        <span>≡</span>
        <span className="text-emerald-600">$</span>
        <span>FINANÇAS</span>
      </div>
      <div className="text-[7px] text-black/60 flex items-center gap-1">
        Maio De 2026 <Sun className="w-2 h-2" />
      </div>
    </div>
    <div className="flex gap-1">
      <span className="px-1.5 py-0.5 rounded bg-black text-white text-[6.5px] font-semibold">DASHBOARD</span>
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">MEU FINANCEIRO</span>
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">INVESTIMENTOS</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded-md bg-emerald-50 border border-emerald-100 p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[6.5px] text-emerald-700">Receitas</span>
          <span className="text-emerald-600 text-[7px]">$</span>
        </div>
        <div className="font-bold text-[9px] text-emerald-700">R$ 3.000</div>
      </div>
      <div className="rounded-md bg-rose-50 border border-rose-100 p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[6.5px] text-rose-700">Despesas</span>
          <TrendingDown className="w-2 h-2 text-rose-600" />
        </div>
        <div className="font-bold text-[9px] text-rose-700">R$ 635</div>
      </div>
      <div className="rounded-md bg-emerald-50 border border-emerald-100 p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[6.5px] text-emerald-700">Saldo do Mês</span>
          <TrendingUp className="w-2 h-2 text-emerald-600" />
        </div>
        <div className="font-bold text-[9px] text-emerald-700">+R$ 2.365</div>
      </div>
      <div className="rounded-md bg-violet-50 border border-violet-100 p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[6.5px] text-violet-700">Investimentos</span>
          <TrendingUp className="w-2 h-2 text-violet-600" />
        </div>
        <div className="font-bold text-[9px] text-violet-700">R$ 14.500</div>
      </div>
    </div>
    <div className="rounded-md bg-amber-50 border border-amber-100 p-1.5 space-y-1">
      <div className="text-[6.5px] font-semibold text-amber-700">⚠ ALERTAS INTELIGENTES</div>
      <div className="text-[6px] bg-white rounded px-1 py-0.5 border border-amber-100">2 conta(s) vencem em 4 dia(s): Aluguel, Plano de Saúde</div>
      <div className="text-[6px] bg-white rounded px-1 py-0.5 border border-amber-100">2 conta(s) vencem em 0 dia(s): YouTube Music, Fatura</div>
      <div className="text-[6px] bg-white rounded px-1 py-0.5 border border-emerald-100 text-emerald-700">Excelente! Você está poupando 78,8% da renda</div>
    </div>
    <div className="rounded-md bg-white border border-black/10 p-1.5">
      <div className="text-[6.5px] font-semibold mb-1">⊙ GASTOS POR CATEGORIA</div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full"
          style={{
            background: "conic-gradient(#6366f1 0 30%, #ec4899 30% 50%, #f59e0b 50% 68%, #10b981 68% 85%, #ef4444 85% 100%)",
          }}
        >
          <div className="w-3 h-3 bg-white rounded-full m-2.5" />
        </div>
        <div className="flex-1 space-y-0.5 text-[6px]">
          <div className="flex justify-between"><span>● Moradia</span><span>R$ 1.300</span></div>
          <div className="flex justify-between"><span>● Educação</span><span>R$ 450</span></div>
          <div className="flex justify-between"><span>● Contas da Casa</span><span>R$ 225</span></div>
          <div className="flex justify-between"><span>● Vestuário</span><span>R$ 220</span></div>
          <div className="flex justify-between"><span>● Restaurante</span><span>R$ 180</span></div>
        </div>
      </div>
    </div>
  </div>
);

const RoutinePhone = () => {
  const days = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
  return (
    <div className="space-y-2 text-[8px]">
      <div className="flex items-center justify-between font-bold">
        <span>← ROTINA</span>
        <span className="text-[7px] text-black/50">Junho</span>
      </div>
      <div className="flex gap-1">
        <span className="px-1.5 py-0.5 rounded bg-black text-white text-[6.5px] font-semibold">MINHA SEMANA</span>
        <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">MEU MÊS</span>
      </div>
      <div className="rounded-md bg-emerald-50/60 border border-emerald-100 p-1.5">
        <div className="text-[7px] font-semibold text-emerald-700 mb-1">HÁBITOS DIÁRIOS ✓</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-1 text-[6.5px]">
          <div className="font-semibold text-black/60">DIA</div>
          <div className="font-semibold text-black/60 w-8 text-center">Beber 2L</div>
          <div className="font-semibold text-black/60 w-8 text-center">Treinar</div>
          {days.map((d, i) => (
            <Fragment key={d}>
              <div className="font-medium">{d}</div>
              <div className="w-8 flex justify-center">
                <div className={`w-3 h-3 rounded-sm ${i < 5 ? "bg-emerald-500" : "border border-black/20"} flex items-center justify-center`}>
                  {i < 5 && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
                </div>
              </div>
              <div className="w-8 flex justify-center">
                <div className={`w-3 h-3 rounded-sm ${i % 2 === 0 ? "bg-emerald-500" : "border border-black/20"} flex items-center justify-center`}>
                  {i % 2 === 0 && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="rounded-md bg-white border border-black/10 p-1.5">
        <div className="text-[7px] font-semibold mb-1">⌧ CONSISTÊNCIA</div>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className={`aspect-square rounded-[1px] ${Math.random() > 0.4 ? "bg-emerald-400" : "bg-black/5"}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

const DevPhone = () => (
  <div className="space-y-2 text-[8px]">
    <div className="flex items-center justify-between">
      <span className="font-bold flex items-center gap-1">
        <span className="text-violet-600">✦</span> DESENVOLVIMENTO PESSOAL
      </span>
      <span className="text-[6.5px] text-black/50">23/05</span>
    </div>
    <div className="flex gap-1">
      <span className="px-1.5 py-0.5 rounded bg-black text-white text-[6.5px] font-semibold">METAS</span>
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">DIÁRIO</span>
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">DÁRIO</span>
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">HUMOR</span>
    </div>
    <div className="rounded-md bg-violet-50 border border-violet-100 p-2 text-center">
      <div className="text-[6.5px] text-violet-700 font-semibold flex items-center justify-center gap-1 mb-0.5">
        <Leaf className="w-2 h-2" /> Frase do dia
      </div>
      <div className="italic text-[8px]">"Grandes coisas nunca vieram de zonas de conforto."</div>
    </div>
    <div className="rounded-md bg-white border border-black/10 p-1.5 space-y-1">
      <div className="text-[6.5px] font-semibold">O QUE ME MOTIVA A ACORDAR TODOS OS DIAS?</div>
      <div className="bg-yellow-100 rounded px-1.5 py-1 text-[6.5px]">Ser exemplo pra família</div>
      <div className="bg-yellow-100 rounded px-1.5 py-1 text-[6.5px]">Viajar pelo mundo</div>
    </div>
    <div className="rounded-md bg-emerald-50 border border-emerald-100 p-1.5 space-y-1">
      <div className="text-[6.5px] font-semibold text-emerald-700 flex items-center gap-1">
        <Sparkles className="w-2 h-2" /> AFIRMAÇÕES
      </div>
      <div className="bg-white rounded px-1.5 py-1 text-[6.5px]">Eu sou capaz de construir a vida que quero.</div>
      <div className="bg-white rounded px-1.5 py-1 text-[6.5px]">Cada dia me aproxima das minhas metas.</div>
    </div>
  </div>
);

/* =========================================================
   PHONE TRIO (Hero) — leque com proporção mobile cuidadosa
   ========================================================= */

const PhoneTrio = () => (
  <div className="relative w-full mx-auto" style={{ maxWidth: 560 }}>
    <div className="relative flex items-end justify-center">
      {/* Left phone */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -10 }}
        animate={{ opacity: 1, y: 0, rotate: -8 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="w-[32%] translate-y-6 -mr-4 z-10"
      >
        <PhoneFrame><RoutinePhone /></PhoneFrame>
      </motion.div>
      {/* Center phone */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="w-[40%] z-20"
      >
        <PhoneFrame><FinancePhone /></PhoneFrame>
      </motion.div>
      {/* Right phone */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 10 }}
        animate={{ opacity: 1, y: 0, rotate: 8 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="w-[32%] translate-y-6 -ml-4 z-10"
      >
        <PhoneFrame><DevPhone /></PhoneFrame>
      </motion.div>
    </div>
  </div>
);

/* =========================================================
   PAGE
   ========================================================= */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(0_0%_99%)] text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Link to="/lp" className="flex items-center gap-2 font-bold text-[15px]">
            <span className="w-6 h-6 rounded-full border-[3px] border-emerald-500 border-l-transparent" />
            CORE
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-black/70">
            <a href="#recursos" className="hover:text-black">Recursos</a>
            <a href="#beneficios" className="hover:text-black">Benefícios</a>
            <a href="#mockup" className="hover:text-black">Depoimentos</a>
            <a href="#precos" className="hover:text-black">Preços</a>
            <a href="#faq" className="hover:text-black">Perguntas</a>
          </nav>
          <Link
            to="/auth"
            className="px-4 py-1.5 rounded-md border border-emerald-500 text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-[1200px] mx-auto px-5 md:px-8 pt-8 md:pt-16 pb-12 md:pb-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-semibold tracking-wide mb-5"
            >
              <Check className="w-3 h-3" /> TUDO PARA SUA VIDA. EM UM SÓ LUGAR.
            </motion.div>
            <h1 className="text-[34px] md:text-[56px] leading-[1.05] font-bold tracking-tight mb-4">
              Organize sua vida<br />em um só lugar.
            </h1>
            <p className="text-[15px] md:text-lg text-black/60 mb-6 max-w-md">
              Finanças, rotina e desenvolvimento pessoal em um app simples, bonito e feito para o seu dia a dia.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm shadow-sm transition"
              >
                Testar grátis por 7 dias <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#mockup"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-black/15 hover:border-black/30 text-sm font-semibold transition"
              >
                Ver como funciona <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: CalendarDays, t: "7 dias grátis", s: "Sem compromisso" },
                { icon: XCircle, t: "Cancelamento fácil", s: "Cancele quando quiser" },
                { icon: ShieldCheck, t: "Seus dados seguros", s: "Privacidade em primeiro lugar" },
              ].map((b) => (
                <div key={b.t} className="space-y-1">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <b.icon className="w-4 h-4" />
                  </div>
                  <div className="text-[12px] font-semibold leading-tight">{b.t}</div>
                  <div className="text-[10.5px] text-black/50 leading-tight">{b.s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="-mx-2 md:mx-0">
            <PhoneTrio />
          </div>
        </div>
      </section>

      {/* RECURSOS — 3 cards */}
      <section id="recursos" className="max-w-[1200px] mx-auto px-5 md:px-8 pb-12 md:pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {/* Finanças */}
          <div className="rounded-2xl bg-orange-50/70 border border-orange-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="font-bold text-orange-700 text-sm tracking-wide">FINANÇAS</span>
            </div>
            <p className="text-sm text-black/70 mb-4">Entenda receitas, despesas e investimentos com clareza.</p>
            <div className="rounded-xl bg-white border border-black/5 p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[10px] text-black/50">Saldo do Mês</div>
                  <div className="text-lg font-bold text-emerald-600">+R$ 2.365</div>
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full"
                  style={{ background: "conic-gradient(#8b5cf6 0 35%, #ec4899 35% 55%, #f59e0b 55% 70%, #10b981 70% 85%, #ef4444 85% 100%)" }}
                >
                  <div className="w-6 h-6 bg-white rounded-full m-4" />
                </div>
                <div className="flex-1 text-[10px] space-y-0.5">
                  <div className="flex justify-between"><span>● Moradia</span><span>R$ 1.300</span></div>
                  <div className="flex justify-between"><span>● Educação</span><span>R$ 450</span></div>
                  <div className="flex justify-between"><span>● Contas da Casa</span><span>R$ 225</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Rotina */}
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <span className="font-bold text-emerald-700 text-sm tracking-wide">ROTINA</span>
            </div>
            <p className="text-sm text-black/70 mb-4">Organize hábitos, consistência e sua semana em poucos toques.</p>
            <div className="rounded-xl bg-white border border-black/5 p-3">
              <div className="text-[10px] font-semibold text-emerald-700 mb-2">HÁBITOS DIÁRIOS ✓</div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-y-1 gap-x-3 text-[11px]">
                <div className="text-black/50 font-semibold text-[10px]">DIA</div>
                <div className="text-black/50 font-semibold text-[10px] text-center">Beber 2L</div>
                <div className="text-black/50 font-semibold text-[10px] text-center">Treinar</div>
                {["SEG", "TER"].map((d, i) => (
                  <Fragment key={d}>
                    <div className="font-medium">{d}</div>
                    <div className="flex justify-center">
                      <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className={`w-4 h-4 rounded ${i === 0 ? "bg-emerald-500" : "border border-black/20"} flex items-center justify-center`}>
                        {i === 0 && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Dev */}
          <div className="rounded-2xl bg-violet-50/70 border border-violet-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-violet-700 text-sm tracking-wide">DESENVOLVIMENTO PESSOAL</span>
            </div>
            <p className="text-sm text-black/70 mb-4">Acompanhe metas, forças, afirmações e evolução pessoal.</p>
            <div className="rounded-xl bg-white border border-black/5 p-3">
              <div className="text-[10px] font-semibold mb-2 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-violet-500" /> MINHAS FORÇAS
              </div>
              <div className="space-y-1.5 text-[11px]">
                {["Comunicação", "Persistência", "Curiosidade"].map((f) => (
                  <div key={f} className="flex items-center justify-between bg-black/[0.03] rounded px-2 py-1.5">
                    <span>{f}</span>
                    <span className="text-black/30">×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MOCKUP — Tudo no seu celular */}
      <section id="mockup" className="bg-[hsl(0_0%_97%)] py-12 md:py-20 border-y border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 grid md:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 items-center">
          <div>
            <h2 className="text-[28px] md:text-4xl font-bold mb-3">Tudo no seu celular</h2>
            <p className="text-black/60 text-[15px]">
              Acesse seus dados de qualquer lugar e tenha sua vida organizada sempre à mão.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="scale-[0.95]"><PhoneFrame><FinancePhone /></PhoneFrame></div>
            <div><PhoneFrame><RoutinePhone /></PhoneFrame></div>
            <div className="scale-[0.95]"><PhoneFrame><DevPhone /></PhoneFrame></div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS — Feito para o seu dia a dia */}
      <section id="beneficios" className="max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-[1fr_2fr] gap-8 md:gap-12">
          <h2 className="text-[28px] md:text-4xl font-bold leading-tight">Feito para o<br />seu dia a dia</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
            {[
              { icon: Check, bg: "bg-emerald-50", fg: "text-emerald-600", t: "Interface simples e intuitiva", s: "Navegação fácil que qualquer pessoa consegue usar." },
              { icon: LayoutGrid, bg: "bg-violet-50", fg: "text-violet-600", t: "Módulos para diferentes áreas da vida", s: "Finanças, rotina, hábitos, metas e muito mais em um só app." },
              { icon: Sun, bg: "bg-amber-50", fg: "text-amber-600", t: "Visual limpo e agradável", s: "Cores suaves, organização inteligente e foco no que realmente importa." },
              { icon: Heart, bg: "bg-rose-50", fg: "text-rose-600", t: "Organização sem complicação", s: "Tudo que você precisa para ter mais clareza e consistência." },
            ].map((f) => (
              <div key={f.t}>
                <div className={`w-9 h-9 rounded-md ${f.bg} ${f.fg} flex items-center justify-center mb-2`}>
                  <f.icon className="w-4 h-4" />
                </div>
                <div className="font-semibold text-[14px] mb-1 leading-tight">{f.t}</div>
                <div className="text-[12.5px] text-black/55 leading-snug">{f.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="max-w-[1200px] mx-auto px-5 md:px-8 pb-12 md:pb-20">
        <div className="rounded-2xl border border-black/5 bg-white p-5 md:p-8">
          <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-10 items-start">
            <div>
              <h2 className="text-[26px] md:text-4xl font-bold leading-tight mb-2">Escolha o plano<br />ideal para você</h2>
              <p className="text-[13px] text-black/50">7 dias grátis · Cancele quando quiser</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Anual */}
              <div className="relative rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-5">
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1">
                  <Leaf className="w-3 h-3" /> MELHOR CUSTO-BENEFÍCIO
                </div>
                <div className="text-sm font-semibold mb-1">Anual</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">R$ 3,90</span>
                  <span className="text-sm text-black/50">/mês</span>
                </div>
                <div className="text-[12px] text-black/50 mb-4">
                  Pago anualmente<br />R$ 46,80/ano
                </div>
                <Link
                  to="/auth"
                  className="block w-full text-center py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition"
                >
                  Começar agora
                </Link>
              </div>
              {/* Mensal */}
              <div className="rounded-xl border border-black/10 bg-white p-5">
                <div className="text-sm font-semibold mb-1">Mensal</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">R$ 14,90</span>
                  <span className="text-sm text-black/50">/mês</span>
                </div>
                <div className="text-[12px] text-black/50 mb-4">
                  Pago mensalmente<br />R$ 14,90/mês
                </div>
                <Link
                  to="/auth"
                  className="block w-full text-center py-2.5 rounded-md border border-black/15 hover:border-black/30 font-semibold text-sm transition"
                >
                  Começar agora
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section id="faq" className="max-w-[1200px] mx-auto px-5 md:px-8 pb-16">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="flex items-start gap-3 flex-1">
            <Sparkles className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
            <div>
              <div className="font-bold text-[18px] md:text-2xl leading-tight mb-1">
                Pare de se perder entre mil<br className="hidden md:block" /> apps e anotações.
              </div>
              <div className="text-[13px] md:text-sm text-black/60">
                Tenha clareza, foco e controle da sua vida em um só lugar com o CORE.
              </div>
            </div>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition whitespace-nowrap"
          >
            Quero testar o CORE <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
