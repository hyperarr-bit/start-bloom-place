import { useEffect, useState } from "react";
const financasPreviewVideo = { url: "/videos/financas.mp4" };
const rotinaPreviewVideo = { url: "/videos/rotina.mp4" };
const financasPreviewPoster = { url: "/videos/financas-poster.jpg" };
const rotinaPreviewPoster = { url: "/videos/rotina-poster.jpg" };
import { Link } from "react-router-dom";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, ShieldCheck, PlayCircle,
  Wallet, Calendar as CalendarIcon, Sparkles, LayoutGrid,
  ChevronDown, Leaf,
  Utensils, Dumbbell, Brain, GraduationCap, Home as HomeIcon,
  PawPrint, Plane, Users, Briefcase, BookOpen, HeartPulse, Flower2,
  Trophy, Flame, Wifi, Moon, Smartphone, Lock, Zap, Target, BarChart3,
  type LucideIcon,
} from "lucide-react";

type ModuleItem = {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  iconFg: string;
  iconBg: string;
};

const MODULES: ModuleItem[] = [
  { key: "financas", title: "FINANÇAS", desc: "Entenda receitas, despesas e investimentos com clareza.", icon: Wallet, iconFg: "text-orange-600", iconBg: "bg-orange-100" },
  { key: "rotina", title: "ROTINA", desc: "Organize hábitos, consistência e sua semana em poucos toques.", icon: CalendarIcon, iconFg: "text-emerald-600", iconBg: "bg-emerald-100" },
  { key: "dev", title: "DESENVOLVIMENTO PESSOAL", desc: "Acompanhe metas, forças, afirmações e evolução pessoal.", icon: Sparkles, iconFg: "text-violet-600", iconBg: "bg-violet-100" },
  { key: "dieta", title: "DIETA", desc: "Planeje refeições, calorias e macros sem complicação.", icon: Utensils, iconFg: "text-amber-600", iconBg: "bg-amber-100" },
  { key: "treino", title: "TREINO", desc: "Monte e acompanhe seus treinos com clareza total.", icon: Dumbbell, iconFg: "text-blue-600", iconBg: "bg-blue-100" },
  { key: "saude", title: "SAÚDE", desc: "Hidratação, jejum, exames e bem-estar no mesmo lugar.", icon: HeartPulse, iconFg: "text-rose-600", iconBg: "bg-rose-100" },
  { key: "hiperfoco", title: "MENTE", desc: "Capture ideias, metas e estratégias antes que escapem.", icon: Brain, iconFg: "text-indigo-600", iconBg: "bg-indigo-100" },
  { key: "estudos", title: "ESTUDOS", desc: "Organize matérias, sessões e progresso de aprendizado.", icon: GraduationCap, iconFg: "text-yellow-700", iconBg: "bg-yellow-100" },
  { key: "carreira", title: "CARREIRA", desc: "Acompanhe metas profissionais, projetos e evolução.", icon: Briefcase, iconFg: "text-slate-700", iconBg: "bg-slate-100" },
  { key: "biblioteca", title: "BIBLIOTECA", desc: "Sua estante digital com livros, leituras e resumos.", icon: BookOpen, iconFg: "text-stone-700", iconBg: "bg-stone-100" },
  { key: "casa", title: "CASA", desc: "Limpeza, despensa, manutenções e rotinas do lar.", icon: HomeIcon, iconFg: "text-teal-600", iconBg: "bg-teal-100" },
  { key: "viagens", title: "VIAGENS", desc: "Roteiros, malas, orçamento e bucket list em um só lugar.", icon: Plane, iconFg: "text-sky-600", iconBg: "bg-sky-100" },
  { key: "relacionamentos", title: "RELACIONAMENTOS", desc: "Pessoas, datas importantes, presentes e momentos.", icon: Users, iconFg: "text-pink-600", iconBg: "bg-pink-100" },
  { key: "pet", title: "PET", desc: "Saúde, rotina, gastos e diário do seu pet.", icon: PawPrint, iconFg: "text-lime-700", iconBg: "bg-lime-100" },
  { key: "beleza", title: "BELEZA", desc: "Skincare, cabelo, produtos e cronogramas personalizados.", icon: Flower2, iconFg: "text-fuchsia-600", iconBg: "bg-fuchsia-100" },
  { key: "detox", title: "DETOX", desc: "Largue hábitos ruins com tracker, diário e conquistas.", icon: Leaf, iconFg: "text-green-600", iconBg: "bg-green-100" },
];

// Preview route param: só "dev" diverge da key (componente DesenvolvimentoPessoal)
const previewPath = (key: string) => `/preview/${key === "dev" ? "desenvolvimento" : key}`;

/* =========================================================
   PHONE MOCKUP (hero)
   ========================================================= */

const PhoneTrio = () => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7 }}
    className="w-full flex justify-center"
  >
    <picture>
      <source srcSet="/hero-phones.webp" type="image/webp" />
      <img
        src="/hero-phones.webp"
        alt="Três telas do app: Rotina, Finanças e Desenvolvimento Pessoal"
        className="w-full max-w-[640px] h-auto object-contain mx-auto"
        loading="eager"
        decoding="async"
        // @ts-expect-error fetchpriority is a valid HTML attribute
        fetchpriority="high"
        width={1280}
        height={960}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </picture>
  </motion.div>
);

/* =========================================================
   FAQ
   ========================================================= */

const FAQ_ITEMS = [
  { q: "Dá pra testar antes de pagar?", a: "Dá sim — e sem cadastro. A demonstração é completa e aberta: abra qualquer módulo e use agora mesmo, com dados de exemplo. Quando assinar, ainda tem 7 dias de garantia." },
  { q: "E se eu não gostar?", a: "Você tem garantia de 7 dias. Se não for pra você, devolvemos o valor — sem perguntas. E pode cancelar quando quiser, em 1 clique, sem fidelidade." },
  { q: "Funciona offline?", a: "Sim. O CORE foi feito como PWA, então continua funcionando mesmo sem internet — seus dados sincronizam quando você reconectar." },
  { q: "Meus dados ficam seguros?", a: "Sim. Usamos Supabase com Row Level Security: cada usuário só consegue acessar os próprios dados, com criptografia em trânsito e em repouso." },
  { q: "Preciso instalar algum app?", a: "Não. O CORE roda no navegador como aplicativo (PWA) — você pode adicionar à tela inicial do celular em 2 toques." },
  { q: "Posso usar só alguns módulos?", a: "Pode. Ative só Finanças, só Rotina, ou os 16 — você escolhe. Não tem upsell escondido: a assinatura inclui tudo." },
  { q: "Funciona no computador também?", a: "Sim, o CORE é responsivo e funciona perfeitamente no celular, tablet e desktop, com a mesma conta sincronizada." },
];

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="font-semibold text-[15px] text-black">{q}</span>
        <ChevronDown className={`w-5 h-5 text-black/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-[14px] text-black/60 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* =========================================================
   PLANOS (selecionáveis)
   ========================================================= */

const PricingPlans = () => {
  const [selected, setSelected] = useState<"anual" | "mensal">("anual");
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => setSelected("anual")}
        className={`relative text-left rounded-2xl p-5 transition-all ${
          selected === "anual"
            ? "border-2 border-black bg-black/[0.04] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.25)]"
            : "border border-black/10 bg-white hover:border-black/30"
        }`}
      >
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-black text-white text-[10px] font-semibold">
          MELHOR CUSTO-BENEFÍCIO
        </div>
        <div className="absolute top-3 right-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
            selected === "anual" ? "border-black bg-black" : "border-black/25 bg-white"
          }`}>
            {selected === "anual" && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        </div>
        <div className="text-sm font-semibold mb-1">Anual</div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold">R$ 3,90</span>
          <span className="text-sm text-black/50">/mês</span>
        </div>
        <div className="text-[12px] text-black/50 mb-2">
          Pago anualmente · R$ 46,80/ano
        </div>
        <div className="inline-flex items-center gap-1 mb-4 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-[11px] font-semibold">
          Economize R$ 132/ano
        </div>
        <Link
          to="/auth?signup=1"
          onClick={(e) => { e.stopPropagation(); trackEvent("landing_cta_click", { cta: "pricing_anual" }); }}
          className="btn-shine block w-full text-center py-2.5 rounded-xl bg-accent hover:opacity-90 text-accent-foreground font-semibold text-sm transition"
        >
          Assinar
        </Link>
      </button>
      <button
        type="button"
        onClick={() => setSelected("mensal")}
        className={`relative text-left rounded-2xl p-5 transition-all ${
          selected === "mensal"
            ? "border-2 border-black bg-black/[0.04] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.25)]"
            : "border border-black/10 bg-white hover:border-black/30"
        }`}
      >
        <div className="absolute top-3 right-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
            selected === "mensal" ? "border-black bg-black" : "border-black/25 bg-white"
          }`}>
            {selected === "mensal" && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        </div>
        <div className="text-sm font-semibold mb-1">Mensal</div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold">R$ 14,90</span>
          <span className="text-sm text-black/50">/mês</span>
        </div>
        <div className="text-[12px] text-black/50 mb-4 mt-[26px]">
          Pago mensalmente · flexível
        </div>
        <Link
          to="/auth?signup=1"
          onClick={(e) => { e.stopPropagation(); trackEvent("landing_cta_click", { cta: "pricing_mensal" }); }}
          className="btn-shine block w-full text-center py-2.5 rounded-xl bg-black hover:bg-black/85 text-white font-semibold text-sm transition"
        >
          Assinar
        </Link>
      </button>
    </div>
  );
};

/* =========================================================
   COMO FUNCIONA — 3 passos (demo → assinar)
   ========================================================= */

const HOW_STEPS = [
  { Icon: PlayCircle, t: "Abra a demo", s: "Sem cadastro. Abra qualquer módulo e mexe agora mesmo, com dados de exemplo." },
  { Icon: Zap, t: "Sinta em segundos", s: "Marque um hábito, lance um gasto, anote uma meta. Sem fricção, sem manual." },
  { Icon: ShieldCheck, t: "Assine e leve junto", s: "Gostou? Assine e tudo fica salvo e sincronizado — com garantia de 7 dias." },
];

const HowItWorks = () => (
  <section className="lp-enter max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-20">
    <div className="text-center mb-10">
      <div className="text-[11px] font-semibold text-accent tracking-widest mb-2">COMO FUNCIONA</div>
      <h2 className="text-[26px] md:text-4xl font-bold leading-tight tracking-tight">Experimente antes de decidir.</h2>
    </div>
    <div className="grid md:grid-cols-3 gap-4 md:gap-5">
      {HOW_STEPS.map((step, i) => (
        <div key={step.t} className="relative rounded-2xl border border-black/10 bg-white p-6">
          <div className="absolute top-5 right-5 text-[34px] font-bold text-black/[0.06] leading-none">{i + 1}</div>
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
            <step.Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="font-bold text-[16px] mb-1.5">{step.t}</div>
          <div className="text-[13.5px] text-black/55 leading-snug">{step.s}</div>
        </div>
      ))}
    </div>
  </section>
);

/* =========================================================
   FAIXA DE DEMO — peça central (testar antes de pagar)
   ========================================================= */

const DEMO_BAND_KEYS = ["financas", "rotina", "dev", "saude", "treino", "dieta", "hiperfoco", "estudos"];

const DemoBand = () => (
  <section id="demo" className="lp-enter relative overflow-hidden bg-[#0f1115]">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-90"
      style={{ background: "radial-gradient(60% 80% at 15% 0%, hsl(330 65% 50% / 0.20), transparent 70%), radial-gradient(50% 70% at 100% 100%, hsl(330 65% 50% / 0.12), transparent 70%)" }}
    />
    <div className="relative max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
      <div className="max-w-[640px]">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(330_65%_50%/0.14)] border border-[hsl(330_70%_62%/0.3)] text-[hsl(330_85%_82%)] text-[12px] font-semibold mb-5">
          <PlayCircle className="w-3.5 h-3.5" /> DEMONSTRAÇÃO ABERTA
        </div>
        <h2 className="text-[28px] md:text-[44px] font-bold leading-[1.05] tracking-[-0.02em] text-white mb-4">
          Não acredite na gente. Abra e use.
        </h2>
        <p className="text-[15px] md:text-[18px] text-white/65 leading-relaxed mb-7 max-w-[52ch]">
          Demonstração real, com dados de exemplo — o app de verdade, não um vídeo. Nada é salvo até você assinar.
        </p>
        <a
          href={previewPath("financas")}
          target="_blank"
          rel="noopener"
          onClick={() => trackEvent("landing_cta_click", { cta: "demo_band", module: "financas" })}
          className="btn-shine inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-accent hover:opacity-90 text-accent-foreground font-bold text-[15px] shadow-[0_12px_30px_-10px_hsl(var(--accent)/0.6)] transition"
        >
          <PlayCircle className="w-5 h-5" /> Abrir demonstração
        </a>
      </div>

      <div className="mt-8 -mx-5 md:mx-0 px-5 md:px-0 flex md:flex-wrap gap-2.5 overflow-x-auto md:overflow-visible no-scrollbar">
        {DEMO_BAND_KEYS.map((k) => {
          const m = MODULES.find((x) => x.key === k);
          if (!m) return null;
          const Icon = m.icon;
          return (
            <a
              key={k}
              href={previewPath(k)}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { cta: "demo_band", module: k })}
              className="shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full bg-white/[0.06] border border-white/12 text-white/85 text-[13px] font-medium hover:bg-white/[0.12] hover:border-white/25 transition"
            >
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-[hsl(330_85%_80%)]" strokeWidth={2.2} />
              </span>
              {m.title}
            </a>
          );
        })}
        <a
          href="#modulos"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[hsl(330_85%_80%)] text-[13px] font-semibold hover:text-[hsl(330_90%_88%)] transition"
        >
          + 8 outros <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  </section>
);

/* =========================================================
   GRID DE MÓDULOS — amplitude num relance (cada card abre a demo)
   ========================================================= */

const ModulesGrid = () => (
  <section id="modulos" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
    <div className="text-center mb-10">
      <div className="text-[11px] font-semibold text-accent tracking-widest mb-2">16 MÓDULOS, 1 ASSINATURA</div>
      <h2 className="text-[26px] md:text-4xl font-bold leading-tight tracking-tight">Tudo que você organizaria em 10 apps.</h2>
      <p className="text-[14px] md:text-[15px] text-black/55 mt-3 max-w-[52ch] mx-auto">
        Combine os módulos do seu jeito — a assinatura inclui todos, sem upsell escondido. Toque em qualquer um pra abrir a demo.
      </p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
      {MODULES.map((m) => {
        const Icon = m.icon;
        return (
          <a
            key={m.key}
            href={previewPath(m.key)}
            target="_blank"
            rel="noopener"
            onClick={() => trackEvent("landing_cta_click", { cta: "grid_demo", module: m.key })}
            className="group rounded-2xl border border-black/10 bg-white p-3.5 md:p-4 transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
          >
            <div className={`w-9 h-9 rounded-lg ${m.iconBg} ${m.iconFg} flex items-center justify-center mb-2.5`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </div>
            <div className="font-bold text-[12.5px] text-black tracking-wide leading-tight">{m.title}</div>
            <div className="text-[11.5px] text-black/55 leading-snug mt-1 line-clamp-2">{m.desc}</div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
              Abrir demo <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
        );
      })}
    </div>
  </section>
);

/* =========================================================
   PROVA DE PRODUTO — substitui depoimentos (confiança honesta)
   ========================================================= */

const PROOF = [
  { icon: Lock, t: "Seus dados são só seus", s: "Supabase com Row Level Security e criptografia em trânsito e em repouso." },
  { icon: Wifi, t: "Funciona offline", s: "Sem internet? Continua usando. Sincroniza sozinho quando você reconectar." },
  { icon: Smartphone, t: "Celular, tablet e desktop", s: "A mesma conta, sincronizada onde você estiver — instala como app (PWA)." },
  { icon: LayoutGrid, t: "16 módulos inclusos", s: "Um preço, tudo liberado. Sem upsell, sem recurso bloqueado." },
  { icon: Moon, t: "Claro e escuro", s: "Se adapta ao seu olho e ao ambiente, de dia ou de madrugada." },
  { icon: ShieldCheck, t: "Garantia de 7 dias", s: "Não curtiu? Devolvemos. Cancele em 1 clique, sem fidelidade." },
];

const ProductProof = () => (
  <section className="lp-enter max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-20">
    <div className="text-center mb-10">
      <div className="text-[11px] font-semibold text-accent tracking-widest mb-2">POR QUE CONFIAR</div>
      <h2 className="text-[26px] md:text-4xl font-bold leading-tight tracking-tight">
        Feito pra você confiar — e ficar.
      </h2>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {PROOF.map((b) => (
        <div key={b.t} className="rounded-2xl border border-black/10 bg-white p-4 md:p-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3">
            <b.icon className="w-5 h-5" />
          </div>
          <div className="font-bold text-[14px] mb-1">{b.t}</div>
          <div className="text-[12.5px] text-black/55 leading-snug">{b.s}</div>
        </div>
      ))}
    </div>
  </section>
);

/* =========================================================
   SCORECARD MOCK (visual do spotlight de Desenvolvimento)
   ========================================================= */

const SCORECARD = [
  { area: "Saúde", v: 7 },
  { area: "Finanças", v: 6 },
  { area: "Relações", v: 8 },
  { area: "Carreira", v: 7 },
  { area: "Espiritual", v: 5 },
  { area: "Lazer", v: 6 },
  { area: "Intelectual", v: 9 },
  { area: "Emocional", v: 7 },
];

const DevScorecardMock = () => (
  <div className="w-full max-w-[360px] rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)] p-5">
    <div className="flex items-center justify-between mb-4">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-violet-600">
        <BarChart3 className="w-3.5 h-3.5" /> SCORECARD SEMANAL
      </span>
      <span className="text-[11px] text-black/40">2026 · W25</span>
    </div>
    <div className="space-y-2.5">
      {SCORECARD.map((s) => (
        <div key={s.area} className="flex items-center gap-3">
          <span className="w-20 text-[12px] text-black/70 shrink-0">{s.area}</span>
          <div className="flex-1 h-2 rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${s.v * 10}%` }} />
          </div>
          <span className="w-9 text-right text-[12px] font-semibold text-black/70">{s.v}/10</span>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-4 border-t border-black/10 flex items-center justify-between">
      <span className="text-[12px] text-black/55">Média da semana</span>
      <span className="text-[20px] font-bold text-violet-600">6.9<span className="text-[12px] text-black/40 font-medium">/10</span></span>
    </div>
  </div>
);

/* =========================================================
   PAGE
   ========================================================= */

export default function LandingPage() {
  useEffect(() => {
    captureLandingMeta();
    trackEvent("landing_view", { source: "lp" });
  }, []);
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".lp-enter");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-enter-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) {
        el.classList.add("lp-enter-in");
      } else {
        io.observe(el);
      }
    });
    return () => io.disconnect();
  }, []);
  return (
    <div className="min-h-screen bg-[hsl(0_0%_99%)] text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-12 md:h-14 flex items-center justify-between">
          <Link to="/lp" className="font-bold text-[17px] tracking-tight text-black">
            CORE
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-black/70">
            <a href="#demo" className="hover:text-black">Demo</a>
            <a href="#modulos" className="hover:text-black">Módulos</a>
            <a href="#precos" className="hover:text-black">Preços</a>
            <a href="#faq" className="hover:text-black">Perguntas</a>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              to="/auth"
              onClick={() => trackEvent("landing_cta_click", { cta: "header_entrar" })}
              className="text-sm font-semibold text-black/70 hover:text-black px-2 py-2 transition"
            >
              Entrar
            </Link>
            <Link
              to="/auth?signup=1"
              onClick={() => trackEvent("landing_cta_click", { cta: "header_signup" })}
              className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold shadow-sm transition"
            >
              Assinar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 pt-4 md:pt-10 pb-8 md:pb-16">
        <div className="grid md:grid-cols-2 gap-4 md:gap-10 items-center">

          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <h1 className="text-[clamp(32px,7.5vw,58px)] font-bold leading-[1.05] tracking-[-0.03em] text-[#0a0a0a] mb-5 mt-0 md:mt-2 max-w-[20ch] md:max-w-[17ch] mx-auto md:mx-0">
              O dinheiro some, a rotina desanda, as metas morrem.
            </h1>
            <p className="text-[16px] md:text-[19px] text-neutral-600 leading-[1.5] mb-7 max-w-[44ch] md:max-w-md mx-auto md:mx-0">
              Não é falta de disciplina — é sua vida espalhada em apps que não conversam. O CORE junta <strong className="font-semibold text-neutral-800">finanças, rotina, metas</strong> e mais 13 áreas da vida num só lugar. Abra a demo e use agora, sem criar conta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full sm:w-auto">
              <a
                href={previewPath("financas")}
                target="_blank"
                rel="noopener"
                onClick={() => trackEvent("landing_cta_click", { cta: "hero_demo", module: "financas" })}
                className="btn-shine inline-flex w-full sm:w-auto items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-accent hover:opacity-90 text-accent-foreground font-semibold text-[15px] shadow-[0_12px_30px_-10px_hsl(var(--accent)/0.6)] transition"
              >
                <PlayCircle className="w-5 h-5" /> Testar agora — sem cadastro
              </a>
              <a
                href="#precos"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-7 py-4 rounded-2xl border border-black/15 bg-white hover:border-black/30 text-black font-semibold text-[15px] transition"
              >
                Ver planos
              </a>
            </div>
            <p className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500 mb-5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" /> Garantia de 7 dias · cancele quando quiser · sem fidelidade
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-[12.5px] text-black/60">
              {[
                { Icon: ShieldCheck, t: "Dados criptografados" },
                { Icon: Wifi, t: "Funciona offline" },
                { Icon: Smartphone, t: "Celular e desktop" },
              ].map((b) => (
                <span key={b.t} className="inline-flex items-center gap-1.5">
                  <b.Icon className="w-3.5 h-3.5 text-accent" /> {b.t}
                </span>
              ))}
            </div>
          </div>

          <div className="-mx-2 md:mx-0 -mt-2 md:mt-0 relative">
            <PhoneTrio />
          </div>
        </div>
      </section>

      {/* FAIXA DE DEMO — peça central */}
      <DemoBand />

      {/* COMO FUNCIONA */}
      <HowItWorks />

      {/* SPOTLIGHT FINANÇAS */}
      <section id="financas" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="order-2 md:order-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-[11px] font-bold tracking-wide mb-4">
              <Wallet className="w-3 h-3" /> MÓDULO FINANÇAS
            </div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
              Saiba para onde vai cada real — e faça sobrar.
            </h2>
            <p className="text-[14px] md:text-base text-black/60 mb-6 leading-relaxed">
              O módulo mais completo do CORE: um <strong className="font-semibold text-black/80">Score Financeiro de 0 a 100</strong> diz, num número, como anda sua vida financeira — e o que mexer pra melhorar.
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                "Score Financeiro de 0 a 100 com dicas personalizadas",
                "Dashboard: gastos por categoria e evolução do patrimônio",
                "Simuladores de juros compostos e independência financeira",
                "Limites por categoria e alertas de contas a vencer",
                "Investimentos, parcelas e metas com progresso visual",
                "Relatórios mensais e virada de mês automática",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] text-black/75">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
            <a
              href={previewPath("financas")}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { cta: "spotlight_demo", module: "financas" })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 bg-white hover:border-black/30 text-black font-semibold text-[14px] transition"
            >
              <PlayCircle className="w-4 h-4 text-accent" /> Abrir demo de Finanças
            </a>
          </div>
          <div className="order-1 md:order-2 flex justify-center">
            <div className="w-full max-w-[320px]">
              <video
                poster={financasPreviewPoster.url}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                disableRemotePlayback
                onLoadedMetadata={(e) => { e.currentTarget.play().catch(() => {}); }}
                onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
                onError={(e) => {
                  const v = e.currentTarget;
                  const img = document.createElement("img");
                  img.src = financasPreviewPoster.url;
                  img.alt = "Prévia do módulo de finanças";
                  img.className = v.className;
                  v.replaceWith(img);
                }}
                className="w-full h-auto rounded-[2rem] bg-black"
              >
                <source src={financasPreviewVideo.url} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* GRID DE MÓDULOS — amplitude */}
      <ModulesGrid />

      {/* SPOTLIGHT ROTINA */}
      <section className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="flex justify-center">
            <div className="w-full max-w-[320px]">
              <video
                poster={rotinaPreviewPoster.url}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                disableRemotePlayback
                onLoadedMetadata={(e) => { e.currentTarget.play().catch(() => {}); }}
                onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
                onError={(e) => {
                  const v = e.currentTarget;
                  const img = document.createElement("img");
                  img.src = rotinaPreviewPoster.url;
                  img.alt = "Prévia do módulo de rotina";
                  img.className = v.className;
                  v.replaceWith(img);
                }}
                className="w-full h-auto rounded-[2rem] bg-black"
              >
                <source src={rotinaPreviewVideo.url} type="video/mp4" />
              </video>
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold tracking-wide mb-4">
              <CalendarIcon className="w-3 h-3" /> MÓDULO ROTINA
            </div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
              Sua semana sob controle — não na sua cabeça.
            </h2>
            <p className="text-[14px] md:text-base text-black/60 mb-6 leading-relaxed">
              Planeje a semana, marque hábitos em segundos e entre em foco. Sua constância vira um mapa que você vê crescer.
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                "Hábitos diários com mapa de consistência (estilo GitHub)",
                "Agenda semanal por horário, do acordar ao dormir",
                "Modo Foco com Pomodoro e blocos de tempo",
                "Diário, revisão e nível de energia do dia",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] text-black/75">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
            <a
              href={previewPath("rotina")}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { cta: "spotlight_demo", module: "rotina" })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 bg-white hover:border-black/30 text-black font-semibold text-[14px] transition"
            >
              <PlayCircle className="w-4 h-4 text-accent" /> Abrir demo de Rotina
            </a>
          </div>
        </div>
      </section>

      {/* SPOTLIGHT DESENVOLVIMENTO */}
      <section id="desenvolvimento" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="order-2 md:order-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-[11px] font-bold tracking-wide mb-4">
              <Sparkles className="w-3 h-3" /> MÓDULO DESENVOLVIMENTO
            </div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
              Evolua de verdade — com método, não com força de vontade.
            </h2>
            <p className="text-[14px] md:text-base text-black/60 mb-6 leading-relaxed">
              Metas, valores e hábitos mentais num lugar só — e um <strong className="font-semibold text-black/80">scorecard que pontua 8 áreas da sua vida</strong> toda semana. Evolução deixa de ser sentimento e vira número.
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                "Scorecard semanal de vida — 8 áreas, uma nota",
                "Metas e quadro de visão (bucket list)",
                "Diário de humor com histórico dos últimos dias",
                "Afirmações, forças, valores e desafios de 30 dias",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] text-black/75">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
            <a
              href={previewPath("dev")}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { cta: "spotlight_demo", module: "dev" })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-black/15 bg-white hover:border-black/30 text-black font-semibold text-[14px] transition"
            >
              <PlayCircle className="w-4 h-4 text-accent" /> Abrir demo de Desenvolvimento
            </a>
          </div>
          <div className="order-1 md:order-2 flex justify-center">
            <DevScorecardMock />
          </div>
        </div>
      </section>

      {/* GAMIFICAÇÃO */}
      <section className="lp-enter bg-[#0f1115] text-white py-12 md:py-20">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(330_65%_50%/0.14)] border border-[hsl(330_70%_62%/0.3)] text-[hsl(330_85%_82%)] text-[11px] font-bold tracking-wide mb-4">
                <Trophy className="w-3 h-3" /> PROGRESSO QUE VICIA
              </div>
              <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
                Seu progresso deixa de ser invisível.
              </h2>
              <p className="text-[14px] md:text-base text-white/65 leading-relaxed">
                Cada hábito marcado, meta batida e ação no app vira XP, streak e conquista. Você sobe de nível — e sente vontade de voltar amanhã.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:gap-3">
              {[
                { Icon: Flame, t: "Streaks", s: "Sua sequência crescendo — e o medo gostoso de quebrar." },
                { Icon: Sparkles, t: "XP & níveis", s: "Cada ação vira XP. Evolua de Prata a Ouro." },
                { Icon: Trophy, t: "Conquistas", s: "Dezenas de marcos pra desbloquear em cada módulo." },
                { Icon: BarChart3, t: "Evolução", s: "Seu score e sua constância, semana após semana." },
              ].map((c) => (
                <div key={c.t} className="rounded-2xl bg-white/[0.05] border border-white/10 p-4">
                  <c.Icon className="w-5 h-5 text-[hsl(330_80%_70%)] mb-2.5" strokeWidth={2} />
                  <div className="font-bold text-[15px] mb-0.5">{c.t}</div>
                  <div className="text-[11.5px] text-white/55 leading-snug">{c.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROVA DE PRODUTO */}
      <ProductProof />

      {/* PREÇOS */}
      <section id="precos" className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="rounded-2xl border border-black/10 bg-white shadow-[0_8px_30px_-16px_rgba(0,0,0,0.25)] p-5 md:p-8">
            <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-10 items-start">
              <div className="text-center md:text-left">
                <h2 className="text-[26px] md:text-4xl font-bold leading-tight mb-2">Um app no lugar<br />de dez.</h2>
                <p className="text-[14px] text-black/60 mb-4 leading-relaxed">
                  Menos que um café por mês pra organizar finanças, rotina, saúde e mais 13 áreas.
                </p>
                <div className="flex flex-col items-center md:items-start gap-2">
                  <p className="text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] border border-black/10 text-black/70">
                    <Check className="w-3 h-3 text-accent" /> Inclui todos os 16 módulos
                  </p>
                  <p className="text-[12px] text-black/70 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] border border-black/10">
                    <ShieldCheck className="w-3 h-3" /> Garantia de 7 dias · cancele em 1 clique · sem fidelidade
                  </p>
                </div>
              </div>
              <PricingPlans />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-enter max-w-[820px] mx-auto px-5 md:px-8 pt-16 md:pt-28 pb-12 md:pb-20">
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">PERGUNTAS FREQUENTES</div>
          <h2 className="text-[26px] md:text-4xl font-bold leading-tight">Ainda tem dúvida?</h2>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white px-5 md:px-7">
          {FAQ_ITEMS.map((f) => <FAQItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 pb-16">
        <div className="rounded-2xl bg-black text-white p-6 md:p-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
          <div className="flex items-start gap-3 flex-1">
            <Sparkles className="w-6 h-6 text-[hsl(330_80%_70%)] shrink-0 mt-1" />
            <div>
              <div className="font-bold text-[20px] md:text-3xl leading-tight mb-2">
                Comece hoje. Se não for pra você,<br className="hidden md:block" /> devolvemos em 7 dias.
              </div>
              <div className="text-[13px] md:text-sm text-white/65">
                Garantia de 7 dias · cancele quando quiser · sem fidelidade.
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/auth?signup=1"
              onClick={() => trackEvent("landing_cta_click", { cta: "final_signup" })}
              className="btn-shine inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent hover:opacity-90 text-accent-foreground font-semibold text-[15px] shadow-[0_10px_28px_-8px_hsl(var(--accent)/0.6)] transition whitespace-nowrap"
            >
              Assinar agora <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href={previewPath("financas")}
              target="_blank"
              rel="noopener"
              onClick={() => trackEvent("landing_cta_click", { cta: "final_demo", module: "financas" })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/20 bg-white/[0.04] hover:bg-white/[0.1] text-white font-semibold text-[15px] transition whitespace-nowrap"
            >
              <PlayCircle className="w-4 h-4" /> Ver demonstração
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-enter bg-[#0a0a14] text-white/70 pt-14 pb-8">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-10 md:gap-14">
            <div>
              <Link to="/lp" className="font-bold text-[22px] tracking-tight text-white inline-block mb-4">
                CORE.
              </Link>
              <p className="text-[14px] leading-relaxed text-white/55 max-w-[380px]">
                Sua vida inteira em um só app. 16 módulos pra organizar finanças, rotina, saúde, casa e tudo o que importa — sem precisar de 10 aplicativos.
              </p>
            </div>

            <div>
              <div className="font-semibold text-white mb-4 text-[14px]">Produto</div>
              <ul className="space-y-3 text-[14px]">
                <li><a href="#demo" className="hover:text-white transition">Demonstração</a></li>
                <li><a href="#modulos" className="hover:text-white transition">Módulos</a></li>
                <li><a href="#financas" className="hover:text-white transition">Finanças</a></li>
                <li><a href="#precos" className="hover:text-white transition">Preços</a></li>
                <li><a href="#faq" className="hover:text-white transition">Perguntas</a></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-white mb-4 text-[14px]">Empresa</div>
              <ul className="space-y-3 text-[14px]">
                <li><Link to="/auth" className="hover:text-white transition">Entrar / Criar conta</Link></li>
                <li><Link to="/planos" className="hover:text-white transition">Planos</Link></li>
                <li><a href="mailto:contato@coreaplicativo.com" className="hover:text-white transition">Fale Conosco</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-6 text-center text-[12.5px] text-white/45">
            © {new Date().getFullYear()} CORE. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
