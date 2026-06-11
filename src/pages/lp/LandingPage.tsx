import { Fragment, useState } from "react";
import heroPhones from "@/assets/hero-phones-v2.png.asset.json";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, CalendarDays, ShieldCheck, XCircle,
  Wallet, Calendar as CalendarIcon, Sparkles, LayoutGrid,
  Sun, Heart, TrendingUp, TrendingDown, Leaf,
  ChevronLeft, ChevronRight, ChevronDown,
  Utensils, Dumbbell, Brain, GraduationCap, Home as HomeIcon,
  PawPrint, Plane, Users, Briefcase, BookOpen, HeartPulse, Flower2,
  Trophy, Flame, Wifi, Moon, Smartphone, Lock, Zap, Target,
  FileSpreadsheet, StickyNote, Bell, BarChart3,
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
  { key: "hiperfoco", title: "MENTE", desc: "Capture ideias, metas e estratégias antes que escapem.", icon: Brain, bg: "bg-indigo-50/70 border-indigo-100", iconBg: "bg-indigo-100", iconFg: "text-indigo-600", titleColor: "text-indigo-700" },
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

/* ---------- Mini previews per module ---------- */

const PreviewCard = ({ title, titleIcon, children }: { title: string; titleIcon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-xl bg-white border border-black/10 shadow-sm p-3 md:p-4">
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-black/80 mb-2.5">
      {titleIcon}
      <span className="tracking-wide">{title}</span>
    </div>
    {children}
  </div>
);

const FinancePreview = () => (
  <PreviewCard title="">
    <div className="text-[10px] text-black/50">Saldo do Mês</div>
    <div className="flex items-center justify-between">
      <div className="text-emerald-600 font-bold text-lg">+R$ 2.365</div>
      <TrendingUp className="w-4 h-4 text-emerald-500" />
    </div>
    <div className="flex items-center gap-3 mt-2">
      <div
        className="w-14 h-14 rounded-full shrink-0"
        style={{ background: "conic-gradient(#8b5cf6 0 55%, #ec4899 55% 75%, #f59e0b 75% 90%, #10b981 90% 100%)" }}
      >
        <div className="w-full h-full rounded-full grid place-items-center">
          <div className="w-7 h-7 rounded-full bg-white" />
        </div>
      </div>
      <div className="flex-1 space-y-1 text-[10px]">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-violet-500" />Moradia</span><span className="font-semibold">R$ 1.300</span></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-pink-500" />Educação</span><span className="font-semibold">R$ 450</span></div>
        <div className="flex items-center justify-between"><span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-amber-500" />Contas da Casa</span><span className="font-semibold">R$ 225</span></div>
      </div>
    </div>
  </PreviewCard>
);

const Check2 = ({ on }: { on: boolean }) => (
  <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${on ? "bg-emerald-500" : "border border-black/20"}`}>
    {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
  </div>
);

const RotinaPreview = () => (
  <PreviewCard title="HÁBITOS DIÁRIOS" titleIcon={<Check className="w-3 h-3 text-emerald-600" />}>
    <div className="grid grid-cols-4 gap-y-1.5 text-[10px]">
      <div className="text-black/50">DIA</div>
      <div className="text-black/50 text-center">Beber 2L</div>
      <div className="text-black/50 text-center">Treinar</div>
      <div className="text-black/50 text-center">Ler 30min</div>
      <div className="font-semibold">SEG</div>
      <div className="grid place-items-center"><Check2 on /></div>
      <div className="grid place-items-center"><Check2 on={false} /></div>
      <div className="grid place-items-center"><Check2 on /></div>
      <div className="font-semibold">TER</div>
      <div className="grid place-items-center"><Check2 on /></div>
      <div className="grid place-items-center"><Check2 on /></div>
      <div className="grid place-items-center"><Check2 on={false} /></div>
    </div>
  </PreviewCard>
);

const DevPreview = () => (
  <PreviewCard title="MINHAS FORÇAS" titleIcon={<Sparkles className="w-3 h-3 text-violet-600" />}>
    <div className="space-y-1.5">
      {["Comunicação", "Persistência", "Curiosidade"].map((s) => (
        <div key={s} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-md bg-violet-50 border border-violet-100">
          <span>{s}</span>
          <XCircle className="w-3 h-3 text-black/30" />
        </div>
      ))}
    </div>
  </PreviewCard>
);

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-1.5 rounded-full bg-black/5 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
);

const DietaPreview = () => (
  <PreviewCard title="MACROS DE HOJE" titleIcon={<Utensils className="w-3 h-3 text-amber-600" />}>
    <div className="flex items-end justify-between mb-2">
      <div className="text-lg font-bold">1.840<span className="text-[10px] font-normal text-black/50"> / 2.000 kcal</span></div>
    </div>
    <div className="space-y-1.5 text-[10px]">
      <div className="flex justify-between"><span>Proteína</span><span>92g</span></div><Bar pct={75} color="bg-rose-400" />
      <div className="flex justify-between"><span>Carboidrato</span><span>210g</span></div><Bar pct={60} color="bg-amber-400" />
      <div className="flex justify-between"><span>Gordura</span><span>48g</span></div><Bar pct={40} color="bg-blue-400" />
    </div>
  </PreviewCard>
);

const TreinoPreview = () => (
  <PreviewCard title="TREINO A · PEITO" titleIcon={<Dumbbell className="w-3 h-3 text-blue-600" />}>
    <div className="space-y-1.5 text-[11px]">
      {[["Supino reto", "4 × 10"], ["Crucifixo", "3 × 12"], ["Crossover", "3 × 15"]].map(([n, s]) => (
        <div key={n} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-blue-50/60">
          <span>{n}</span><span className="font-semibold text-blue-700">{s}</span>
        </div>
      ))}
    </div>
  </PreviewCard>
);

const SaudePreview = () => (
  <PreviewCard title="HIDRATAÇÃO" titleIcon={<HeartPulse className="w-3 h-3 text-rose-600" />}>
    <div className="flex items-end justify-between mb-2">
      <div className="text-lg font-bold">6<span className="text-[10px] font-normal text-black/50"> / 8 copos</span></div>
      <div className="text-[10px] text-rose-600 font-semibold">75%</div>
    </div>
    <div className="flex gap-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`flex-1 h-6 rounded-sm ${i < 6 ? "bg-rose-400" : "bg-black/5"}`} />
      ))}
    </div>
  </PreviewCard>
);

const HiperfocoPreview = () => (
  <PreviewCard title="IDEIAS CAPTURADAS" titleIcon={<Brain className="w-3 h-3 text-indigo-600" />}>
    <div className="space-y-1.5 text-[11px]">
      {["Lançar newsletter semanal", "Estudar React Server Comp.", "Organizar reunião 1:1"].map((t) => (
        <div key={t} className="px-2 py-1.5 rounded-md bg-indigo-50 border-l-2 border-indigo-400">{t}</div>
      ))}
    </div>
  </PreviewCard>
);

const EstudosPreview = () => (
  <PreviewCard title="MATÉRIAS" titleIcon={<GraduationCap className="w-3 h-3 text-yellow-700" />}>
    <div className="space-y-2 text-[11px]">
      {[["Matemática", 80, "bg-yellow-500"], ["História", 55, "bg-orange-400"], ["Inglês", 35, "bg-emerald-400"]].map(([n, p, c]) => (
        <div key={n as string}>
          <div className="flex justify-between mb-0.5"><span>{n}</span><span className="text-black/50">{p}%</span></div>
          <Bar pct={p as number} color={c as string} />
        </div>
      ))}
    </div>
  </PreviewCard>
);

const CarreiraPreview = () => (
  <PreviewCard title="METAS DO TRIMESTRE" titleIcon={<Briefcase className="w-3 h-3 text-slate-700" />}>
    <div className="space-y-1.5 text-[11px]">
      {[["Fechar projeto X", true], ["Promoção sênior", false], ["Curso de liderança", true]].map(([t, d]) => (
        <div key={t as string} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-50">
          <Check2 on={d as boolean} /><span className={d ? "line-through text-black/40" : ""}>{t}</span>
        </div>
      ))}
    </div>
  </PreviewCard>
);

const BibliotecaPreview = () => (
  <PreviewCard title="LENDO AGORA" titleIcon={<BookOpen className="w-3 h-3 text-stone-700" />}>
    <div className="flex gap-2 mb-2">
      <div className="w-8 h-12 rounded-sm bg-rose-400" />
      <div className="w-8 h-12 rounded-sm bg-indigo-500" />
      <div className="w-8 h-12 rounded-sm bg-emerald-500" />
      <div className="w-8 h-12 rounded-sm bg-amber-500" />
    </div>
    <div className="text-[11px]"><span className="font-semibold">Atomic Habits</span> · pág. 142 / 320</div>
    <Bar pct={44} color="bg-stone-700" />
  </PreviewCard>
);

const CasaPreview = () => (
  <PreviewCard title="LIMPEZA DA SEMANA" titleIcon={<HomeIcon className="w-3 h-3 text-teal-600" />}>
    <div className="space-y-1.5 text-[11px]">
      {[["Aspirar sala", true], ["Trocar lençóis", false], ["Lavar banheiro", true], ["Regar plantas", false]].map(([t, d]) => (
        <div key={t as string} className="flex items-center gap-2"><Check2 on={d as boolean} /><span className={d ? "line-through text-black/40" : ""}>{t}</span></div>
      ))}
    </div>
  </PreviewCard>
);

const ViagensPreview = () => (
  <PreviewCard title="PRÓXIMA VIAGEM" titleIcon={<Plane className="w-3 h-3 text-sky-600" />}>
    <div className="flex items-center justify-between mb-2">
      <div>
        <div className="text-[10px] text-black/50">Lisboa, Portugal</div>
        <div className="text-lg font-bold text-sky-700">Faltam 12 dias</div>
      </div>
      <div className="text-2xl">🇵🇹</div>
    </div>
    <div className="flex gap-1 text-[10px]">
      <span className="px-2 py-1 rounded bg-sky-50 border border-sky-100">Mala 60%</span>
      <span className="px-2 py-1 rounded bg-sky-50 border border-sky-100">Roteiro ok</span>
    </div>
  </PreviewCard>
);

const RelacionamentosPreview = () => (
  <PreviewCard title="PESSOAS IMPORTANTES" titleIcon={<Users className="w-3 h-3 text-pink-600" />}>
    <div className="flex -space-x-2 mb-2">
      {["bg-rose-400", "bg-amber-400", "bg-violet-400", "bg-emerald-400"].map((c, i) => (
        <div key={i} className={`w-8 h-8 rounded-full border-2 border-white ${c}`} />
      ))}
    </div>
    <div className="text-[11px]"><span className="font-semibold">Aniversário do João</span> · em 5 dias</div>
    <div className="text-[10px] text-black/50">Ideia de presente: livro favorito</div>
  </PreviewCard>
);

const PetPreview = () => (
  <PreviewCard title="MEU PET" titleIcon={<PawPrint className="w-3 h-3 text-lime-700" />}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-10 h-10 rounded-full bg-lime-200 grid place-items-center text-lg">🐶</div>
      <div>
        <div className="text-[11px] font-semibold">Thor · 3 anos</div>
        <div className="text-[10px] text-black/50">Golden Retriever</div>
      </div>
    </div>
    <div className="text-[10px] px-2 py-1.5 rounded-md bg-lime-50 border border-lime-100">💉 Próxima vacina em 8 dias</div>
  </PreviewCard>
);

const BelezaPreview = () => (
  <PreviewCard title="ROTINA DE HOJE" titleIcon={<Flower2 className="w-3 h-3 text-fuchsia-600" />}>
    <div className="space-y-1.5 text-[11px]">
      <div className="px-2 py-1.5 rounded-md bg-fuchsia-50 border border-fuchsia-100"><span className="font-semibold">AM</span> · Limpeza · Vit C · Protetor</div>
      <div className="px-2 py-1.5 rounded-md bg-fuchsia-50 border border-fuchsia-100"><span className="font-semibold">PM</span> · Limpeza · Retinol · Hidratante</div>
    </div>
  </PreviewCard>
);

const DetoxPreview = () => (
  <PreviewCard title="STREAK ATUAL" titleIcon={<Leaf className="w-3 h-3 text-green-600" />}>
    <div className="text-lg font-bold text-green-700 mb-1">7 dias limpo 🔥</div>
    <div className="flex gap-1 mb-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className={`flex-1 h-5 rounded-sm ${i < 7 ? "bg-green-500" : "bg-black/5"}`} />
      ))}
    </div>
    <div className="text-[10px] text-black/50">Recorde anterior: 12 dias</div>
  </PreviewCard>
);

const PREVIEWS: Record<string, React.FC> = {
  financas: FinancePreview, rotina: RotinaPreview, dev: DevPreview,
  dieta: DietaPreview, treino: TreinoPreview, saude: SaudePreview,
  hiperfoco: HiperfocoPreview, estudos: EstudosPreview, carreira: CarreiraPreview,
  biblioteca: BibliotecaPreview, casa: CasaPreview, viagens: ViagensPreview,
  relacionamentos: RelacionamentosPreview, pet: PetPreview, beleza: BelezaPreview,
  detox: DetoxPreview,
};

const ModulesCarousel = () => {
  const [idx, setIdx] = useState(0);
  const go = (dir: 1 | -1) => setIdx((i) => (i + dir + MODULES.length) % MODULES.length);
  const m = MODULES[idx];
  const Icon = m.icon;
  const Preview = PREVIEWS[m.key];
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-semibold text-black/50 tracking-wider">EXPLORE POR MÓDULO</div>
          <div className="text-[22px] md:text-3xl font-bold leading-tight">Veja cada área em detalhe</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} aria-label="Anterior" className="w-10 h-10 rounded-full border border-black/10 bg-white hover:border-black/30 flex items-center justify-center transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Próximo" className="w-10 h-10 rounded-full border border-black/10 bg-white hover:border-black/30 flex items-center justify-center transition">
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
            <div className="flex items-center gap-2.5 mb-2">
              <Icon className={`w-5 h-5 ${m.iconFg}`} strokeWidth={2.2} />
              <span className={`font-bold ${m.titleColor} text-[15px] tracking-wider`}>{m.title}</span>
            </div>
            <p className="text-[15px] md:text-base text-black/70 mb-5 leading-snug">{m.desc}</p>
            {Preview && <Preview />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mt-5">
        {MODULES.map((mod, i) => (
          <button
            key={mod.key}
            onClick={() => setIdx(i)}
            aria-label={mod.title}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-black" : "w-1.5 bg-black/15 hover:bg-black/30"}`}
          />
        ))}
      </div>
    </div>
  );
};

/* =========================================================
   PHONE MOCKUPS
   ========================================================= */

const PhoneFrame = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={
      "relative bg-black rounded-[2rem] p-[5px] shadow-[0_25px_60px_-20px_rgba(0,0,0,0.35)] " +
      "ring-1 ring-black/10 " + className
    }
  >
    <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[34%] h-[18px] bg-black rounded-full z-20" />
    <div className="relative bg-white rounded-[1.7rem] overflow-hidden aspect-[9/19.5]">
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
      <div className="text-[6px] bg-white rounded px-1 py-0.5 border border-emerald-100 text-emerald-700">Excelente! Você está poupando 78,8% da renda</div>
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
      <span className="px-1.5 py-0.5 rounded bg-black/5 text-[6.5px]">HUMOR</span>
    </div>
    <div className="rounded-md bg-violet-50 border border-violet-100 p-2 text-center">
      <div className="text-[6.5px] text-violet-700 font-semibold flex items-center justify-center gap-1 mb-0.5">
        <Leaf className="w-2 h-2" /> Frase do dia
      </div>
      <div className="italic text-[8px]">"Grandes coisas nunca vieram de zonas de conforto."</div>
    </div>
    <div className="rounded-md bg-white border border-black/10 p-1.5 space-y-1">
      <div className="text-[6.5px] font-semibold">O QUE ME MOTIVA?</div>
      <div className="bg-yellow-100 rounded px-1.5 py-1 text-[6.5px]">Ser exemplo pra família</div>
      <div className="bg-yellow-100 rounded px-1.5 py-1 text-[6.5px]">Viajar pelo mundo</div>
    </div>
    <div className="rounded-md bg-emerald-50 border border-emerald-100 p-1.5 space-y-1">
      <div className="text-[6.5px] font-semibold text-emerald-700 flex items-center gap-1">
        <Sparkles className="w-2 h-2" /> AFIRMAÇÕES
      </div>
      <div className="bg-white rounded px-1.5 py-1 text-[6.5px]">Eu sou capaz de construir a vida que quero.</div>
    </div>
  </div>
);

const PhoneTrio = () => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7 }}
    className="w-full flex justify-center"
  >
    <img
      src={heroPhones.url}
      alt="Três telas do app: Rotina, Finanças e Desenvolvimento Pessoal"
      className="w-full max-w-[640px] h-auto object-contain mx-auto"
      loading="eager"
    />
  </motion.div>
);

/* =========================================================
   FAQ
   ========================================================= */

const FAQ_ITEMS = [
  { q: "Funciona offline?", a: "Sim. O CORE foi feito como PWA, então continua funcionando mesmo sem internet — seus dados sincronizam quando você reconectar." },
  { q: "Meus dados ficam seguros?", a: "Sim. Usamos Supabase com Row Level Security: cada usuário só consegue acessar os próprios dados, com criptografia em trânsito e em repouso." },
  { q: "Preciso instalar algum app?", a: "Não. O CORE roda no navegador como aplicativo (PWA) — você pode adicionar à tela inicial do celular em 2 toques." },
  { q: "Tem versão grátis?", a: "Sim, 7 dias de teste completo, sem precisar cadastrar cartão de crédito." },
  { q: "Posso usar só alguns módulos?", a: "Pode. Ative só Finanças, só Rotina, ou os 16 — você escolhe. Não tem upsell escondido: o plano inclui tudo." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Cancelamento é com 1 clique, sem fidelidade, sem ligação, sem burocracia." },
  { q: "Funciona no computador também?", a: "Sim, o CORE é responsivo e funciona perfeitamente no celular, tablet e desktop." },
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
   PAGE
   ========================================================= */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(0_0%_99%)] text-foreground pb-20 md:pb-0">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Link to="/lp" className="font-bold text-[17px] tracking-tight text-black">
            CORE
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-black/70">
            <a href="#modulos" className="hover:text-black">Módulos</a>
            <a href="#financas" className="hover:text-black">Finanças</a>
            <a href="#beneficios" className="hover:text-black">Benefícios</a>
            <a href="#precos" className="hover:text-black">Preços</a>
            <a href="#faq" className="hover:text-black">Perguntas</a>
          </nav>
          <Link
            to="/auth"
            className="px-4 py-1.5 rounded-md bg-black hover:bg-black/85 text-white text-sm font-semibold transition"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 pt-8 md:pt-16 pb-12 md:pb-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.04] border border-black/10 text-black text-[11px] font-semibold tracking-wide mb-5"
            >
              <Check className="w-3 h-3" /> 16 MÓDULOS · 1 ÚNICO APP
            </motion.div>
            <h1 className="text-[34px] md:text-[56px] leading-[1.05] font-bold tracking-tight mb-4">
              Organize sua vida<br />em um só lugar.
            </h1>
            <p className="text-[15px] md:text-lg text-black/60 mb-6 max-w-md">
              Substitui sua planilha de gastos, seu app de hábitos, seu caderno de metas e mais 13 coisas. Tudo num app simples e bonito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                to="/auth"
                className="btn-shine inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-black hover:bg-black/85 text-white font-semibold text-sm shadow-sm transition"
              >
                Testar grátis por 7 dias <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
              {[
                { icon: CalendarDays, t: "7 dias grátis", s: "Sem compromisso" },
                { icon: XCircle, t: "Cancelamento fácil", s: "Cancele quando quiser" },
                { icon: ShieldCheck, t: "Seus dados seguros", s: "Privacidade total" },
              ].map((b) => (
                <div key={b.t} className="space-y-1 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-md bg-black/[0.05] text-black flex items-center justify-center">
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

        {/* Modules ticker */}
        <div className="mt-10 pt-6 border-t border-black/5">
          <div className="text-[10.5px] font-semibold text-black/40 tracking-widest text-center mb-3">
            O QUE CABE NO CORE
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-black/55">
            {MODULES.map((m, i) => (
              <Fragment key={m.key}>
                <span className="font-medium">{m.title}</span>
                {i < MODULES.length - 1 && <span className="text-black/20">·</span>}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">O PROBLEMA</div>
            <h2 className="text-[26px] md:text-4xl font-bold leading-tight">
              Sua vida tá espalhada em<br />6 apps e 3 cadernos.
            </h2>
          </div>
          <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-8">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileSpreadsheet, t: "Planilha de gastos" },
                { icon: Check, t: "App de hábitos" },
                { icon: StickyNote, t: "Caderno de metas" },
                { icon: Bell, t: "Lembretes soltos" },
                { icon: BookOpen, t: "Lista de livros" },
                { icon: Dumbbell, t: "App de treino" },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-black/10 text-[12.5px]">
                  <b.icon className="w-4 h-4 text-black/40 shrink-0" />
                  <span className="text-black/70 truncate">{b.t}</span>
                </div>
              ))}
            </div>
            <div className="flex md:flex-col items-center justify-center gap-2 text-black/30">
              <ArrowRight className="w-8 h-8 hidden md:block rotate-0" />
              <ArrowRight className="w-6 h-6 md:hidden rotate-90" />
            </div>
            <div className="rounded-2xl bg-black text-white p-6 md:p-8 text-center">
              <div className="text-[11px] font-semibold tracking-widest text-white/60 mb-2">A SOLUÇÃO</div>
              <div className="text-3xl md:text-4xl font-bold mb-2">CORE</div>
              <div className="text-[13px] text-white/70 leading-relaxed">
                Tudo num app só. Conversando entre si. Sem trocar de aba, sem perder dado.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES GRID */}
      <section id="modulos" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="text-center mb-10">
          <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">TUDO QUE O CORE FAZ</div>
          <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-3">
            16 módulos. Uma vida inteira.
          </h2>
          <p className="text-[14px] md:text-base text-black/55 max-w-xl mx-auto">
            Ative só o que importa pra você. Cada módulo é completo, integrado e pensado pro dia a dia.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className={`rounded-xl border ${m.bg} p-4 md:p-5 transition hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className={`w-9 h-9 rounded-lg ${m.iconBg} ${m.iconFg} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <div className={`text-[12px] font-bold ${m.titleColor} tracking-wide mb-1`}>{m.title}</div>
                <div className="text-[12px] text-black/55 leading-snug">{m.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RECURSOS — carrossel (deep-dive) */}
      <section id="recursos" className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <ModulesCarousel />
        </div>
      </section>

      {/* SPOTLIGHT FINANÇAS */}
      <section id="financas" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="order-2 md:order-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-[11px] font-bold tracking-wide mb-4">
              <Wallet className="w-3 h-3" /> MÓDULO FINANÇAS
            </div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
              Substitua sua planilha em 30 segundos.
            </h2>
            <p className="text-[14px] md:text-base text-black/60 mb-6 leading-relaxed">
              O módulo mais completo do CORE. Tudo que você precisa pra entender pra onde seu dinheiro vai — e fazer sobrar mais.
            </p>
            <div className="space-y-2.5">
              {[
                "Receitas, despesas fixas e variáveis em tabelas claras",
                "Orçamento mensal e anual por categoria",
                "Alertas inteligentes de contas a vencer",
                "Rastreador de parcelas e investimentos",
                "Metas financeiras com progresso visual",
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
          </div>
          <div className="order-1 md:order-2 flex justify-center">
            <div className="w-full max-w-[280px]">
              <PhoneFrame><FinancePhone /></PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* SPOTLIGHT ROTINA */}
      <section className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="flex justify-center">
            <div className="w-full max-w-[280px]">
              <PhoneFrame><RoutinePhone /></PhoneFrame>
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold tracking-wide mb-4">
              <CalendarIcon className="w-3 h-3" /> MÓDULO ROTINA
            </div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
              Veja sua consistência crescer dia a dia.
            </h2>
            <p className="text-[14px] md:text-base text-black/60 mb-6 leading-relaxed">
              Hábitos não acontecem por motivação — acontecem por sistema. O módulo Rotina te dá esse sistema.
            </p>
            <div className="space-y-2.5">
              {[
                "Hábitos diários com checks rápidos por semana",
                "Heatmap visual de consistência (estilo GitHub)",
                "Visão semanal e mensal lado a lado",
                "Streaks pra manter o ritmo",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] text-black/75">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* GAMIFICAÇÃO */}
      <section className="lp-enter bg-black text-white py-12 md:py-20">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-[11px] font-bold tracking-wide mb-4">
                <Trophy className="w-3 h-3" /> GAMIFICAÇÃO
              </div>
              <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-4">
                Cada hábito vira XP.<br />Cada meta vira conquista.
              </h2>
              <p className="text-[14px] md:text-base text-white/65 leading-relaxed mb-6">
                Você não tá só "fazendo tarefas". Tá evoluindo um personagem real: você. Conquistas, badges e streaks pra manter a chama acesa.
              </p>
              <div className="flex flex-wrap gap-2">
                {["🔥 Streaks", "🏆 Conquistas", "⭐ Níveis", "🎯 Metas", "📊 Progresso"].map((b) => (
                  <span key={b} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[12px]">{b}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4">
                <Flame className="w-6 h-6 text-orange-400 mb-2" />
                <div className="text-3xl font-bold">42</div>
                <div className="text-[12px] text-white/60">dias seguidos</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4">
                <Trophy className="w-6 h-6 text-amber-400 mb-2" />
                <div className="text-3xl font-bold">18</div>
                <div className="text-[12px] text-white/60">conquistas</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4">
                <Zap className="w-6 h-6 text-yellow-300 mb-2" />
                <div className="text-3xl font-bold">2.840</div>
                <div className="text-[12px] text-white/60">XP total</div>
              </div>
              <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4">
                <Target className="w-6 h-6 text-emerald-400 mb-2" />
                <div className="text-3xl font-bold">7/10</div>
                <div className="text-[12px] text-white/60">metas no trimestre</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS CONCRETOS */}
      <section id="beneficios" className="lp-enter max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="text-center mb-10">
          <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">PENSADO PARA O MUNDO REAL</div>
          <h2 className="text-[26px] md:text-4xl font-bold leading-tight">
            Os detalhes que fazem diferença.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { icon: Lock, t: "Dados criptografados", s: "Supabase com RLS. Só você acessa o que é seu." },
            { icon: Wifi, t: "Funciona offline", s: "Sem internet? Continua usando. Sincroniza depois." },
            { icon: Moon, t: "Modo claro e escuro", s: "Adapta ao seu olho e ao seu humor do dia." },
            { icon: Smartphone, t: "Roda sem instalar", s: "PWA: adiciona à tela inicial em 2 toques." },
          ].map((b) => (
            <div key={b.t} className="rounded-xl border border-black/10 bg-white p-4 md:p-5">
              <div className="w-10 h-10 rounded-lg bg-black/[0.05] text-black flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5" />
              </div>
              <div className="font-bold text-[14px] mb-1">{b.t}</div>
              <div className="text-[12.5px] text-black/55 leading-snug">{b.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PERSONAS */}
      <section className="lp-enter bg-[hsl(0_0%_97%)] border-y border-black/5 py-12 md:py-20">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">PRA QUEM É O CORE</div>
            <h2 className="text-[26px] md:text-4xl font-bold leading-tight">
              Combine os módulos do seu jeito.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {[
              {
                t: "Quem quer organizar a vida financeira",
                emoji: "💰",
                mods: ["FINANÇAS", "CARREIRA", "DESENVOLVIMENTO PESSOAL"],
                color: "border-orange-200 bg-orange-50/40",
              },
              {
                t: "Quem quer criar hábitos e cuidar de si",
                emoji: "🌱",
                mods: ["ROTINA", "SAÚDE", "TREINO", "DETOX"],
                color: "border-emerald-200 bg-emerald-50/40",
              },
              {
                t: "Quem quer evoluir profissionalmente",
                emoji: "📈",
                mods: ["CARREIRA", "ESTUDOS", "MENTE", "BIBLIOTECA"],
                color: "border-indigo-200 bg-indigo-50/40",
              },
            ].map((p) => (
              <div key={p.t} className={`rounded-2xl border ${p.color} p-5 md:p-6`}>
                <div className="text-3xl mb-3">{p.emoji}</div>
                <div className="font-bold text-[15px] mb-4 leading-snug">{p.t}</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.mods.map((m) => (
                    <span key={m} className="px-2 py-1 rounded-md bg-white border border-black/10 text-[10.5px] font-semibold text-black/70 tracking-wide">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ANTES X DEPOIS */}
      <section className="lp-enter max-w-[900px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="text-center mb-10">
          <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">ANTES × DEPOIS</div>
          <h2 className="text-[26px] md:text-4xl font-bold leading-tight">
            Troque 6 apps por 1.
          </h2>
        </div>
        <div className="rounded-2xl border border-black/10 overflow-hidden bg-white">
          <div className="grid grid-cols-2 bg-black/[0.03] border-b border-black/10">
            <div className="px-4 md:px-6 py-3 text-[11px] font-bold tracking-widest text-black/50">ANTES</div>
            <div className="px-4 md:px-6 py-3 text-[11px] font-bold tracking-widest text-black border-l border-black/10">COM CORE</div>
          </div>
          {[
            ["Planilha de gastos no Excel", "Módulo Finanças completo"],
            ["App pago de hábitos", "Módulo Rotina + Gamificação"],
            ["Caderno de metas perdido", "Desenvolvimento Pessoal"],
            ["Notas espalhadas no celular", "Módulo Hiperfoco"],
            ["Lembrete da vacina do pet", "Módulo Pet"],
            ["6 apps abertos ao mesmo tempo", "1 app, 1 senha, 1 lugar"],
          ].map(([before, after], i) => (
            <div key={i} className="grid grid-cols-2 border-b border-black/5 last:border-b-0">
              <div className="px-4 md:px-6 py-3 text-[13px] md:text-[14px] text-black/55 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-black/30 shrink-0" />
                <span className="truncate">{before}</span>
              </div>
              <div className="px-4 md:px-6 py-3 text-[13px] md:text-[14px] text-black font-medium flex items-center gap-2 border-l border-black/10">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{after}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GALERIA */}
      <section id="mockup" className="lp-enter bg-[hsl(0_0%_97%)] py-12 md:py-20 border-y border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">GALERIA</div>
            <h2 className="text-[28px] md:text-4xl font-bold leading-tight mb-3">Tudo no seu celular</h2>
            <p className="text-black/55 text-[14px] md:text-base max-w-xl mx-auto">
              Acesse seus dados de qualquer lugar e tenha sua vida organizada sempre à mão.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-[900px] mx-auto">
            <div className="scale-[0.95]"><PhoneFrame><FinancePhone /></PhoneFrame></div>
            <div><PhoneFrame><RoutinePhone /></PhoneFrame></div>
            <div className="scale-[0.95]"><PhoneFrame><DevPhone /></PhoneFrame></div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="lp-enter max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="text-center mb-10">
          <div className="text-[11px] font-semibold text-black/50 tracking-widest mb-2">QUEM JÁ USA</div>
          <h2 className="text-[26px] md:text-4xl font-bold leading-tight">
            O que estão dizendo.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {[
            { n: "Marina S.", c: "São Paulo, SP", t: "Larguei a planilha de gastos depois de 4 anos. O módulo de Finanças do CORE faz tudo e ainda me avisa quando uma conta tá pra vencer.", a: "bg-rose-300" },
            { n: "Pedro H.", c: "Curitiba, PR", t: "Eu juntava 7 apps diferentes. Agora é só o CORE. Treino, dieta, finanças, livros — tudo no mesmo lugar e conversando entre si.", a: "bg-indigo-300" },
            { n: "Júlia M.", c: "Recife, PE", t: "O heatmap de consistência mudou meu jogo. Ver o mês inteiro pintado de verde vicia mais que rede social.", a: "bg-emerald-300" },
          ].map((d) => (
            <div key={d.n} className="rounded-2xl border border-black/10 bg-white p-5 md:p-6">
              <div className="flex gap-0.5 mb-3 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <span key={i}>★</span>)}
              </div>
              <p className="text-[14px] text-black/75 leading-relaxed mb-4">"{d.t}"</p>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-full ${d.a}`} />
                <div>
                  <div className="font-semibold text-[13px]">{d.n}</div>
                  <div className="text-[11.5px] text-black/50">{d.c}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="lp-enter bg-black text-white py-8 md:py-10">
        <div className="max-w-[1100px] mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 text-center">
          {[
            { n: "16", t: "módulos" },
            { n: "+200", t: "funcionalidades" },
            { n: "Semanais", t: "atualizações" },
            { n: "100%", t: "dados seus" },
          ].map((s) => (
            <div key={s.t}>
              <div className="text-3xl md:text-4xl font-bold mb-1">{s.n}</div>
              <div className="text-[12px] text-white/55 tracking-wide">{s.t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="lp-enter max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-20">
        <div className="rounded-2xl border border-black/5 bg-white p-5 md:p-8">
          <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-10 items-start">
            <div className="text-center md:text-left">
              <h2 className="text-[26px] md:text-4xl font-bold leading-tight mb-2">Escolha o plano<br />ideal para você</h2>
              <p className="text-[13px] text-black/50 mb-3">7 dias grátis · Cancele quando quiser</p>
              <p className="text-[12px] text-black/60 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] border border-black/10">
                <Check className="w-3 h-3" /> Inclui todos os 16 módulos
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative rounded-xl border-2 border-black/80 bg-black/[0.03] p-5">
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-black text-white text-[10px] font-semibold">
                  MELHOR CUSTO-BENEFÍCIO
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
                  className="btn-shine block w-full text-center py-2.5 rounded-md bg-black hover:bg-black/85 text-white font-semibold text-sm transition"
                >
                  Começar agora
                </Link>
              </div>
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
                  className="btn-shine block w-full text-center py-2.5 rounded-md bg-black hover:bg-black/85 text-white font-semibold text-sm transition"
                >
                  Começar agora
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-enter max-w-[820px] mx-auto px-5 md:px-8 pb-12 md:pb-20">
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
            <Sparkles className="w-6 h-6 text-white shrink-0 mt-1" />
            <div>
              <div className="font-bold text-[20px] md:text-3xl leading-tight mb-2">
                Comece organizando 1 área.<br className="hidden md:block" /> Em 1 semana, vai querer organizar todas.
              </div>
              <div className="text-[13px] md:text-sm text-white/65">
                7 dias grátis. Sem cartão. Sem compromisso.
              </div>
            </div>
          </div>
          <Link
            to="/auth"
            className="btn-shine inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-white text-black hover:bg-white/90 font-semibold text-sm transition whitespace-nowrap"
          >
            Quero testar o CORE <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* STICKY MOBILE CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-black/10 px-4 py-3">
        <Link
          to="/auth"
          className="btn-shine flex items-center justify-center gap-2 w-full py-3 rounded-md bg-black text-white font-semibold text-sm"
        >
          Testar grátis por 7 dias <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
