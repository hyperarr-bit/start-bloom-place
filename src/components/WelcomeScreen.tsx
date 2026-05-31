import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import {
  DollarSign, TrendingDown, TrendingUp, BarChart3, Heart,
  Calendar, AlertCircle, Bell, CheckCircle2, ChevronDown, Star, RefreshCw, ArrowDown,
  ArrowRight, Clock, Home, PieChart, Target, Bus, Shirt, ShoppingCart,
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
  floatRange = 6,
  rotate = 0,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof DollarSign;
  iconFill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  floatRange?: number;
  rotate?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.9, rotate }}
    animate={{
      opacity: 1,
      scale: 1,
      rotate,
      y: [0, -floatRange, 0],
    }}
    transition={{
      opacity: { delay, duration: 0.5, ease: "easeOut" },
      scale: { delay, duration: 0.5, ease: "easeOut" },
      rotate: { delay, duration: 0.5, ease: "easeOut" },
      y: {
        delay: delay + 0.5,
        duration: 3.5 + Math.random(),
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      },
    }}
    whileHover={{ scale: 1.05, rotate: 0, transition: { duration: 0.25 } }}
    style={style}
    className={`absolute flex items-center gap-2.5 rounded-2xl pl-2 pr-4 py-2 shadow-md ${className}`}
  >
    <div
      className="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `hsl(var(${color}))` }}
    >
      <Icon className="w-4 h-4 text-white" strokeWidth={2.25} fill={iconFill ? "currentColor" : "none"} />
      <motion.span
        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-background"
        style={{ background: `hsl(var(${color}))` }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </div>
    <div>
      <p className="text-[10px] text-foreground/60 leading-none">{label}</p>
      <p className="text-[13px] font-bold text-foreground leading-tight mt-1">{value}</p>
    </div>
  </motion.div>
);

const FloatingDot = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <motion.span
    className={`absolute rounded-full ${className}`}
    animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 3 + Math.random() * 1.5, repeat: Infinity, ease: "easeInOut", delay }}
  />
);


const SlideOneMock = () => (
  <div className="w-full max-w-[340px] mx-auto">
    {/* Área dos 4 cards flutuantes com confetes */}
    <div className="relative w-full h-[230px]">

      {/* dots decorativos animados */}
      <FloatingDot className="w-1 h-1 bg-[hsl(var(--chart-2)/0.6)] top-1 left-16" delay={0.2} />
      <FloatingDot className="w-1.5 h-1.5 bg-[hsl(var(--chart-1)/0.5)] top-3 right-8" delay={0.6} />
      <FloatingDot className="w-1 h-1 bg-[hsl(var(--chart-4)/0.5)] top-24 left-2" delay={1.1} />
      <FloatingDot className="w-1 h-1 bg-[hsl(var(--chart-3)/0.6)] top-32 right-1" delay={0.4} />
      <FloatingDot className="w-1.5 h-1.5 bg-[hsl(var(--chart-2)/0.4)] bottom-8 left-8" delay={0.9} />
      <FloatingDot className="w-1 h-1 bg-[hsl(var(--chart-4)/0.5)] bottom-16 right-20" delay={1.4} />
      <FloatingDot className="w-1 h-1 bg-[hsl(var(--chart-1)/0.5)] bottom-2 right-6" delay={0.7} />

      {/* Receitas — amarelo (chart-3) */}
      <FloatCard
        label="Receitas"
        value="R$ 6.400,00"
        color="--chart-3"
        icon={DollarSign}
        delay={0.05}
        rotate={-4}
        floatRange={5}
        className="top-0 left-0 bg-[hsl(var(--chart-3)/0.22)]"
      />

      {/* Despesas — lilás (chart-4) */}
      <FloatCard
        label="Despesas"
        value="R$ 635,00"
        color="--chart-4"
        icon={ArrowDown}
        delay={0.15}
        rotate={4}
        floatRange={7}
        className="top-16 right-0 bg-[hsl(var(--chart-4)/0.22)]"
      />

      {/* Investimentos — verde (chart-2) */}
      <FloatCard
        label="Investimentos"
        value="R$ 14.500,00"
        color="--chart-2"
        icon={BarChart3}
        delay={0.25}
        rotate={-3}
        floatRange={6}
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
        rotate={3}
        floatRange={5}
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


// Mini card flutuante compacto usado no SlideOneHero
const MiniFloatCard = ({
  label,
  value,
  color,
  icon: Icon,
  iconFill = false,
  className = "",
  delay = 0,
  rotate = 0,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof DollarSign;
  iconFill?: boolean;
  className?: string;
  delay?: number;
  rotate?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 14, scale: 0.92, rotate }}
    animate={{ opacity: 1, y: 0, scale: 1, rotate }}
    transition={{ delay, duration: 0.45, ease: "easeOut" }}
    className={`absolute flex items-center gap-2 rounded-2xl pl-1.5 pr-3 py-1.5 bg-card border border-border/60 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ${className}`}
  >
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `hsl(var(${color}))` }}
    >
      <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.25} fill={iconFill ? "currentColor" : "none"} />
    </div>
    <div className="leading-tight">
      <p className="text-[8.5px] uppercase tracking-wider font-semibold text-foreground/55">{label}</p>
      <p className="text-[11px] font-bold text-foreground">{value}</p>
    </div>
  </motion.div>
);

// Slide 1 mobile: 3 cards empilhados (Receitas, Gastos, Saldo do mês)
const SlideOneRow = ({
  label,
  value,
  color,
  icon: Icon,
  trendIcon: TrendIcon,
  delay = 0,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof DollarSign;
  trendIcon: typeof TrendingUp;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.45, ease: "easeOut" }}
    className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-3.5 py-3 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)]"
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: `hsl(var(${color}) / 0.18)` }}
    >
      <Icon className="w-5 h-5" style={{ color: `hsl(var(${color}))` }} strokeWidth={2.5} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] text-muted-foreground leading-none">{label}</p>
      <p
        className="text-[20px] font-extrabold leading-tight mt-1 tabular-nums"
        style={{ color: `hsl(var(${color}))` }}
      >
        {value}
      </p>
    </div>
    <TrendIcon
      className="w-5 h-5 flex-shrink-0"
      style={{ color: `hsl(var(${color}) / 0.55)` }}
      strokeWidth={2.25}
    />
  </motion.div>
);

const SlideOneHero = () => (
  <div className="w-full flex flex-col gap-2.5">
    <SlideOneRow
      label="Receitas"
      value="R$ 3.000,00"
      color="--success"
      icon={DollarSign}
      trendIcon={TrendingUp}
      delay={0.05}
    />
    <SlideOneRow
      label="Gastos"
      value="R$ 635,00"
      color="--destructive"
      icon={TrendingDown}
      trendIcon={TrendingDown}
      delay={0.12}
    />
    <SlideOneRow
      label="Saldo do mês"
      value="+R$ 2.365,00"
      color="--success"
      icon={TrendingUp}
      trendIcon={TrendingUp}
      delay={0.19}
    />
  </div>
);


const SlideTwoCategories = [
  { c: "--chart-4", n: "Moradia", v: "R$ 1.300", pct: 54.7 },
  { c: "--chart-1", n: "Educação", v: "R$ 450", pct: 18.9 },
  { c: "--chart-3", n: "Contas da Casa", v: "R$ 225", pct: 9.5 },
  { c: "--chart-2", n: "Vestuário", v: "R$ 220", pct: 9.3 },
  { c: "--chart-5", n: "Restaurante", v: "R$ 180", pct: 7.6 },
];

const Slide2Donut = () => {
  const R = 62;
  const C = 2 * Math.PI * R;
  const GAP_PCT = 1.2; // gap branco entre segmentos
  let cumulative = 0;
  return (
    <svg viewBox="0 0 160 160" className="w-[160px] h-[160px] -rotate-90">
      {SlideTwoCategories.map((s, i) => {
        const visiblePct = Math.max(0, s.pct - GAP_PCT);
        const len = (visiblePct / 100) * C;
        const offset = (cumulative / 100) * C;
        cumulative += s.pct;
        return (
          <motion.circle
            key={s.n}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={`hsl(var(${s.c}))`}
            strokeWidth="26"
            strokeLinecap="butt"
            strokeDasharray={`0 ${C}`}
            animate={{ strokeDasharray: `${len} ${C}` }}
            transition={{ delay: 0.4 + i * 0.18, duration: 0.7, ease: "easeOut" }}
            style={{ strokeDashoffset: -offset }}
          />
        );
      })}
    </svg>
  );
};

const SlideTwoHero = () => (
  <div className="w-full flex flex-col gap-3">
    {/* Card do gráfico */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
      className="bg-card border border-border/60 rounded-3xl p-4 shadow-sm"
    >
      <p className="text-[12px] font-extrabold text-foreground tracking-wider uppercase flex items-center gap-2 mb-3">
        <span className="text-base leading-none" aria-hidden>📊</span>
        Gastos por categoria
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Slide2Donut />
        </div>
        <div className="flex-1 space-y-2">
          {SlideTwoCategories.map((r, i) => (
            <motion.div
              key={r.n}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
              className="flex items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `hsl(var(${r.c}))` }} />
                {r.n}
              </span>
              <span className="text-muted-foreground tabular-nums">{r.v}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>

    {/* Card lavanda — Maior gasto */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.45, ease: "easeOut" }}
      className="rounded-2xl p-3.5 flex items-center gap-3"
      style={{ background: "hsl(var(--chart-4) / 0.12)" }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "hsl(var(--chart-4) / 0.22)" }}
      >
        <Home className="w-5 h-5" style={{ color: "hsl(var(--chart-4))" }} strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <p className="text-[12px] text-muted-foreground">Maior gasto:</p>
        <p className="text-[18px] font-extrabold mt-0.5" style={{ color: "hsl(var(--chart-4))" }}>Moradia</p>
      </div>
    </motion.div>
  </div>
);


const SlideThreeHero = () => (
  <div className="w-full flex flex-col gap-3">
    {/* Card branco — Previsão do mês */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
      className="bg-card border border-border/60 rounded-3xl p-4 shadow-sm"
    >
      {/* header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(var(--success) / 0.15)" }}
        >
          <BarChart3 className="w-[18px] h-[18px]" style={{ color: "hsl(var(--success))" }} strokeWidth={2.25} />
        </div>
        <p className="text-[17px] font-bold text-foreground">Previsão do mês</p>
      </div>

      {/* destaque verde */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-2xl px-4 py-3"
        style={{
          background: "hsl(var(--success) / 0.10)",
          border: "1px solid hsl(var(--success) / 0.25)",
        }}
      >
        <p className="text-[12px] text-muted-foreground">Saldo previsto positivo</p>
        <p className="text-[28px] font-extrabold leading-tight mt-0.5" style={{ color: "hsl(var(--success))" }}>
          +R$ 965
        </p>
      </motion.div>

      {/* linhas */}
      <div className="mt-3 space-y-2">
        {[
          { n: "Receita", v: "+ R$ 3.000", c: "--success" },
          { n: "Gastos atuais", v: "- R$ 635", c: "--destructive" },
          { n: "Contas pendentes", v: "- R$ 1.400", c: "--chart-3" },
        ].map((r, i) => (
          <motion.div
            key={r.n}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.08, duration: 0.3 }}
            className="flex items-center justify-between text-[13px]"
          >
            <span className="text-foreground">{r.n}</span>
            <span className="font-semibold tabular-nums" style={{ color: `hsl(var(${r.c}))` }}>{r.v}</span>
          </motion.div>
        ))}
      </div>

      {/* divisor */}
      <div className="h-px bg-border/70 my-3" />

      {/* total */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-foreground">Saldo previsto</span>
        <span className="text-[20px] font-extrabold tabular-nums" style={{ color: "hsl(var(--success))" }}>
          +R$ 965
        </span>
      </div>

      {/* status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.35 }}
        className="flex items-center justify-center gap-1.5 mt-3 text-[12px]"
        style={{ color: "hsl(var(--success))" }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.25} />
        Tudo sob controle este mês.
      </motion.div>
    </motion.div>

  </div>
);


// ---------- Slide 4 hero (Limites por categoria) ----------
const FilledUtensils = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="currentColor">
    <path d="M6.2 2.5c.43 0 .78.35.78.78v6.06h1.2V3.28a.78.78 0 0 1 1.56 0v6.06h1.1V3.28a.78.78 0 0 1 1.56 0v6.2c0 2.1-1.28 3.84-3.05 4.28v6.92a1.15 1.15 0 0 1-2.3 0v-6.92C5.27 13.32 4 11.58 4 9.48v-6.2c0-.43.35-.78.78-.78s.78.35.78.78v6.06h1.1V3.28c0-.43.35-.78.78-.78Z" />
    <path d="M17.6 2.75c1.74 0 2.9 2.2 2.9 5.42 0 2.72-.82 4.78-2.05 5.35v7.18a1.15 1.15 0 0 1-2.3 0V3.28c0-.29.23-.53.53-.53h.92Z" />
  </svg>
);

const FilledBook = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="currentColor">
    <path d="M5 4.25c2.08 0 3.9.44 5.35 1.38.42.27.65.72.65 1.22v12.7c0 .35-.38.56-.68.38C8.9 19.08 7.08 18.7 5 18.7H3.9c-.77 0-1.4-.63-1.4-1.4V5.65c0-.77.63-1.4 1.4-1.4H5Z" />
    <path d="M19 4.25h1.1c.77 0 1.4.63 1.4 1.4V17.3c0 .77-.63 1.4-1.4 1.4H19c-2.08 0-3.9.38-5.32 1.23-.3.18-.68-.03-.68-.38V6.85c0-.5.23-.95.65-1.22C15.1 4.69 16.92 4.25 19 4.25Z" />
  </svg>
);

type LimitRow = {
  name: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  pillBg: string;
  spent: number;
  limit: number;
  barColor: string;
  iconFill?: boolean;
};

const SLIDE_FOUR_LIMITS: LimitRow[] = [
  { name: "Restaurante", icon: FilledUtensils, iconColor: "--limit-orange", pillBg: "hsl(var(--limit-orange) / 0.10)", spent: 180, limit: 150, barColor: "--limit-red" },
  { name: "Transporte", icon: Bus, iconColor: "--limit-blue", pillBg: "hsl(var(--limit-blue) / 0.10)", spent: 50, limit: 250, barColor: "--limit-green", iconFill: true },
  { name: "Vestuário", icon: Shirt, iconColor: "--limit-cyan", pillBg: "hsl(var(--limit-cyan) / 0.10)", spent: 220, limit: 980, barColor: "--limit-green", iconFill: true },
  { name: "Educação", icon: FilledBook, iconColor: "--limit-green", pillBg: "hsl(var(--limit-green) / 0.10)", spent: 450, limit: 580, barColor: "--limit-lime" },
  { name: "Moradia", icon: Home, iconColor: "--limit-orange", pillBg: "hsl(var(--limit-orange) / 0.08)", spent: 1300, limit: 1400, barColor: "--limit-orange", iconFill: true },
];

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const SlideFourHero = () => (
  <div className="w-full flex flex-col gap-[10px]">
    {/* Card branco — Limites por categoria */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
      className="bg-card border border-border/70 rounded-[22px] px-[16px] py-[14px]"
      style={{ boxShadow: "var(--limit-card-shadow)" }}
    >
      {/* header */}
      <div className="flex items-center gap-[12px] mb-[12px]">
        <div
          className="w-[39px] h-[39px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(var(--muted) / 0.72)" }}
        >
          <Target className="w-[19px] h-[19px] text-foreground" strokeWidth={3} />
        </div>
        <p className="text-[18px] font-extrabold leading-none text-foreground">Limites por categoria</p>
      </div>

      {/* rows */}
      <div>
        {SLIDE_FOUR_LIMITS.map((row, i) => {
          const pct = Math.min(1, row.spent / row.limit);
          const exceeded = row.spent > row.limit;
          const Icon = row.icon;
          return (
            <motion.div
              key={row.name}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.08, duration: 0.32 }}
              className={`flex flex-col ${i === SLIDE_FOUR_LIMITS.length - 1 ? "pt-[7px]" : "border-b border-border/55 py-[7px]"} ${i === 0 ? "pt-0" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-[8px] px-[9px] py-[5px] rounded-[8px]"
                  style={{ background: row.pillBg }}
                >
                  <Icon
                    className="w-[16px] h-[16px] flex-shrink-0"
                    style={{ color: `hsl(var(${row.iconColor}))` }}
                    strokeWidth={2.8}
                    fill={row.iconFill ? "currentColor" : undefined}
                  />
                  <span className="text-[14px] font-medium leading-none text-foreground">{row.name}</span>
                </div>
                <div className="text-[14px] tabular-nums whitespace-nowrap">
                  <span
                    className="font-extrabold"
                    style={{ color: exceeded ? "hsl(var(--limit-red))" : "hsl(var(--foreground))" }}
                  >
                    {fmtBRL(row.spent)}
                  </span>
                  <span className="text-muted-foreground"> / {fmtBRL(row.limit)}</span>
                </div>
              </div>
              <div className="h-[5px] w-full rounded-full overflow-hidden mt-[6px]" style={{ background: "hsl(var(--muted) / 0.62)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: `hsl(var(${row.barColor}))` }}
                />
              </div>
              {exceeded && (
                <p className="text-[13px] font-medium mt-[6px]" style={{ color: "hsl(var(--limit-red))" }}>
                  Limite excedido em {fmtBRL(row.spent - row.limit)}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>

    {/* tip card */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85, duration: 0.4, ease: "easeOut" }}
      className="rounded-[14px] px-[13px] py-[10px] flex items-center gap-[15px] border"
      style={{ background: "hsl(var(--limit-red) / 0.055)", borderColor: "hsl(var(--limit-red) / 0.18)" }}
    >
      <div
        className="w-[39px] h-[39px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "hsl(var(--limit-red) / 0.11)" }}
      >
        <Bell className="w-[20px] h-[20px]" style={{ color: "hsl(var(--limit-red))" }} strokeWidth={2.35} />
      </div>
      <p className="text-[14px] text-foreground leading-[1.35]">
        Alertas ajudam você a corrigir<br />antes de gastar demais
      </p>
    </motion.div>
  </div>
);

// ---------- Slide 5 — Acompanhe seus desejos e metas ----------

const SlideFiveDesejosHero = () => {
  const meta = 3399;
  const guardado = 1200;
  const falta = meta - guardado;
  const pct = Math.round((guardado / meta) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
      className="bg-card rounded-[22px] px-[16px] pt-[14px] pb-[14px]"
      style={{ boxShadow: "var(--limit-card-shadow)" }}
    >
      {/* header: Desejo atual */}
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div
          className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(var(--chart-1) / 0.12)" }}
        >
          <Heart
            className="w-[18px] h-[18px]"
            style={{ color: "hsl(var(--chart-1))" }}
            strokeWidth={2.4}
          />
        </div>
        <p className="text-[17px] font-extrabold leading-none text-foreground">Desejo atual</p>
      </div>

      {/* 3 colunas */}
      <div className="grid grid-cols-3 gap-0 mb-[12px]">
        {/* Meta total */}
        <div className="flex flex-col pr-[8px]">
          <div className="flex items-center gap-[5px] mb-[4px]">
            <Target className="w-[13px] h-[13px]" style={{ color: "hsl(var(--chart-1))" }} strokeWidth={2.6} />
            <span className="text-[11px] text-muted-foreground leading-none">Meta total</span>
          </div>
          <p className="text-[15px] font-extrabold text-foreground tabular-nums leading-none">R$ 3.399</p>
        </div>
        {/* Já guardado */}
        <div className="flex flex-col px-[8px] border-l border-r border-border/60">
          <div className="flex items-center gap-[4px] mb-[4px]">
            <TrendingUp className="w-[13px] h-[13px] flex-shrink-0" style={{ color: "hsl(var(--chart-2))" }} strokeWidth={2.6} />
            <span className="text-[11px] text-muted-foreground leading-none whitespace-nowrap">Já guardado</span>
          </div>
          <p className="text-[15px] font-extrabold tabular-nums leading-none" style={{ color: "hsl(var(--chart-2))" }}>R$ 1.200</p>
        </div>
        {/* Falta */}
        <div className="flex flex-col pl-[8px]">
          <div className="flex items-center gap-[4px] mb-[4px]">
            <ShoppingCart className="w-[13px] h-[13px] flex-shrink-0" style={{ color: "hsl(var(--chart-3))" }} strokeWidth={2.6} />
            <span className="text-[11px] text-muted-foreground leading-none">Falta</span>
          </div>
          <p className="text-[15px] font-extrabold tabular-nums leading-none" style={{ color: "hsl(var(--chart-3))" }}>R$ 2.199</p>
        </div>
      </div>

      <div className="h-px w-full bg-border/70 mb-[12px]" />

      {/* Produto */}
      <div className="flex items-center gap-[12px] mb-[12px]">
        <img src={ipadImg} alt="Apple iPad 128 GB" className="w-[78px] h-[78px] object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
          <p className="text-[15px] font-extrabold text-foreground leading-tight">Apple iPad 128 GB</p>
          <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-md px-[8px] py-[2px] self-start leading-none">Outros</span>
          <p className="text-[15px] font-extrabold text-foreground tabular-nums leading-none mt-[2px]">R$ 3.399,00</p>
        </div>
      </div>

      {/* Progresso */}
      <div className="flex items-center justify-between mb-[6px]">
        <span className="text-[12px] font-medium tabular-nums" style={{ color: "hsl(var(--chart-2))" }}>
          Guardado: R$ 1.200,00
        </span>
        <span className="text-[12px] font-medium tabular-nums" style={{ color: "hsl(var(--chart-3))" }}>
          Falta: R$ 2.199,00
        </span>
      </div>
      <div className="h-[7px] w-full rounded-full overflow-hidden" style={{ background: "hsl(var(--muted) / 0.7)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(var(--chart-1)) 0%, hsl(330 80% 65%) 100%)" }}
        />
      </div>
      <p className="text-[13px] font-semibold text-foreground mt-[6px] tabular-nums">{pct}%</p>
    </motion.div>
  );
};

// ---------- Slide 6 — Comece pela sua primeira receita ----------

const SlideSixHero = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
    className="bg-card rounded-[22px] px-[16px] pt-[14px] pb-[14px]"
    style={{ boxShadow: "var(--limit-card-shadow)" }}
  >
    {/* header */}
    <div className="flex items-center gap-[10px] mb-[14px]">
      <div
        className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "hsl(var(--chart-2) / 0.14)" }}
      >
        <DollarSign
          className="w-[18px] h-[18px]"
          style={{ color: "hsl(var(--chart-2))" }}
          strokeWidth={2.6}
        />
      </div>
      <p className="text-[17px] font-extrabold leading-none text-foreground">Nova receita</p>
    </div>

    {/* Fonte da receita */}
    <div className="mb-[10px]">
      <p className="text-[12px] text-muted-foreground mb-[6px]">Fonte da receita</p>
      <div className="border border-border rounded-[12px] px-[12px] py-[11px] flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">Salário</span>
        <ChevronDown className="w-[16px] h-[16px] text-muted-foreground" strokeWidth={2.25} />
      </div>
    </div>

    {/* Valor */}
    <div className="mb-[12px]">
      <p className="text-[12px] text-muted-foreground mb-[6px]">Valor</p>
      <div className="border border-border rounded-[12px] px-[12px] py-[11px]">
        <span className="text-[14px] font-extrabold text-foreground tabular-nums">R$ 6.400,00</span>
      </div>
    </div>

    {/* destaque Ótimo começo */}
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="rounded-[14px] px-[13px] py-[10px] flex items-start gap-[12px] border"
      style={{ background: "hsl(var(--chart-3) / 0.10)", borderColor: "hsl(var(--chart-3) / 0.22)" }}
    >
      <div
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "hsl(var(--chart-3) / 0.18)" }}
      >
        <Star
          className="w-[16px] h-[16px]"
          style={{ color: "hsl(var(--chart-3))" }}
          fill="currentColor"
          strokeWidth={2}
        />
      </div>
      <div className="text-[13px] leading-[1.35]">
        <p className="font-bold text-foreground">Ótimo começo!</p>
        <p className="text-muted-foreground">Registrar suas receitas é o primeiro passo para ter controle total das suas finanças.</p>
      </div>
    </motion.div>
  </motion.div>
);




const StatCard = ({
  label,
  value,
  color,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof DollarSign;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: "easeOut" }}
    className="bg-card border border-border/60 rounded-2xl px-3 py-2.5 flex flex-col justify-between min-h-[64px]"
  >
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(var(${color}))` }} strokeWidth={2.25} />
    </div>
    <p className="text-[15px] font-extrabold leading-none mt-1" style={{ color: `hsl(var(${color}))` }}>{value}</p>
  </motion.div>
);

const SlideTwoMock = () => {
  const donutSegments = [
    { c: "--chart-4", pct: 55 }, // Moradia roxo
    { c: "--chart-1", pct: 19 }, // Educação rosa
    { c: "--chart-3", pct: 10 }, // Contas da Casa laranja
    { c: "--chart-2", pct: 9 },  // Vestuário verde
    { c: "--chart-5", pct: 7 },  // Restaurante azul
  ];
  let acc = 0;
  const gradient = donutSegments
    .map((s) => {
      const from = acc;
      acc += s.pct;
      return `hsl(var(${s.c})) ${from}% ${acc}%`;
    })
    .join(", ");

  const legend = [
    { c: "--chart-4", n: "Moradia", v: "R$ 1.300" },
    { c: "--chart-1", n: "Educação", v: "R$ 450" },
    { c: "--chart-3", n: "Contas da Casa", v: "R$ 225" },
    { c: "--chart-2", n: "Vestuário", v: "R$ 220" },
    { c: "--chart-5", n: "Restaurante", v: "R$ 180" },
  ];

  return (
    <div className="w-full max-w-[320px] mx-auto space-y-2.5">
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Receitas do mês" value="R$ 6.400" color="--chart-2" icon={DollarSign} delay={0.05} />
        <StatCard label="Despesas" value="R$ 635" color="--chart-1" icon={TrendingDown} delay={0.1} />
        <StatCard label="Saldo disponível" value="+R$ 5.765" color="--chart-2" icon={TrendingUp} delay={0.15} />
        <StatCard label="Investimentos" value="R$ 14.500" color="--chart-4" icon={TrendingUp} delay={0.2} />
      </div>

      {/* Alertas inteligentes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="bg-card border border-border/60 rounded-2xl p-2.5 space-y-1.5"
      >
        <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" strokeWidth={2} /> Alertas inteligentes
        </p>
        <div className="flex items-start gap-2 bg-[hsl(var(--chart-3)/0.15)] rounded-xl p-2">
          <Calendar className="w-3.5 h-3.5 text-[hsl(var(--chart-3))] mt-0.5 flex-shrink-0" strokeWidth={2} />
          <div className="text-[10px] leading-tight">
            <p className="text-foreground">2 conta(s) vencem em 2 dia(s)</p>

            <p className="text-muted-foreground">Cartão Nubank, Netflix</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-[hsl(var(--chart-2)/0.15)] rounded-xl p-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--chart-2))] mt-0.5 flex-shrink-0" strokeWidth={2} />
          <p className="text-[10px] text-foreground leading-tight">
            Excelente! Você está poupando 90,1% da sua renda este mês.
          </p>
        </div>
      </motion.div>

      {/* Despesas por categoria */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="bg-card border border-border/60 rounded-2xl p-2.5"
      >
        <p className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-[hsl(var(--chart-4))]" strokeWidth={2} />
          Despesas por categoria
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="w-8 h-8 rounded-full bg-card" />
          </div>
          <div className="flex-1 space-y-0.5 text-[10px]">
            {legend.map((r) => (
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
      </motion.div>
    </div>
  );
};


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
    title: <>Acompanhe seus<br />desejos e metas</>,
    subtitle: "Crie desejos, acompanhe quanto já guardou e veja quanto falta para chegar lá.",
    mock: <SlideFiveDesejosHero />,
  },
  {
    title: <>Comece pela sua<br />primeira receita</>,
    subtitle: "Adicione sua fonte de renda para montar a base da sua organização financeira.",
    mock: <SlideSixHero />,
  },

];

export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  ({ onComplete, onLogin }, _ref) => {
    const [step, setStep] = useState(0);
    const isLast = step === slides.length - 1;
    const stepRef = useRef(step);
    const completedRef = useRef(false);
    stepRef.current = step;
    const mockSlotRef = useRef<HTMLDivElement>(null);
    const mockInnerRef = useRef<HTMLDivElement>(null);
    const [mockScale, setMockScale] = useState(1);

    useEffect(() => {
      captureLandingMeta();
      trackEvent("landing_view", {});
    }, []);

    useEffect(() => {
      trackEvent("onboarding_step_view", {
        step: step + 1,
        slide_title: typeof slides[step]?.title === "string" ? slides[step].title : `slide_${step + 1}`,
      });
    }, [step]);

    // Reduz proporcionalmente o mock para caber na tela em devices menores
    useEffect(() => {
      const fit = () => {
        const slot = mockSlotRef.current;
        const inner = mockInnerRef.current;
        if (!slot || !inner) return;
        // mede tamanho natural sem o transform atual
        const prev = inner.style.transform;
        inner.style.transform = "none";
        const naturalH = inner.scrollHeight;
        inner.style.transform = prev;
        const availH = slot.clientHeight;
        if (naturalH <= 0 || availH <= 0) return;
        const next = Math.min(1, availH / naturalH);
        setMockScale(Math.max(0.5, next));
      };
      fit();
      const id = window.setTimeout(fit, 60);
      const id2 = window.setTimeout(fit, 250);
      window.addEventListener("resize", fit);
      return () => {
        window.removeEventListener("resize", fit);
        window.clearTimeout(id);
        window.clearTimeout(id2);
      };
    }, [step]);

    // Dropoff tracking: emite exit quando o usuário sai (unmount / pagehide / aba escondida) sem completar
    useEffect(() => {
      const emitExit = (reason: string) => {
        if (completedRef.current) return;
        trackEvent("onboarding_step_exit", {
          step: stepRef.current + 1,
          total: slides.length,
          reason,
        });
      };
      const onPageHide = () => emitExit("pagehide");
      const onVisibility = () => {
        if (document.visibilityState === "hidden") emitExit("hidden");
      };
      window.addEventListener("pagehide", onPageHide);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("pagehide", onPageHide);
        document.removeEventListener("visibilitychange", onVisibility);
        emitExit("unmount");
      };
    }, []);

    const goNext = () => {
      if (isLast) finish();
      else setStep((s) => s + 1);
    };
    const goBack = () => {
      const from = stepRef.current;
      const to = Math.max(0, from - 1);
      trackEvent("onboarding_step_back", { from_step: from + 1, to_step: to + 1 });
      setStep(to);
    };
    const finish = () => {
      completedRef.current = true;
      trackEvent("start_clicked", { destination: "financas", step: step + 1 });
      onComplete?.();
      window.location.href = "/financas";
    };

    const current = slides[step];

    // Nav desktop (mantém o layout antigo)
    const nav = isLast ? (
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
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Voltar
            </button>
          ) : (
            <span className="w-10" />
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
    );

    const loginLink = step === 0 && (
      <Link
        to="/auth"
        onClick={() => { trackEvent("login_clicked", {}); onLogin?.(); }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center mt-3 md:text-left"
      >
        Já tem uma conta? <span className="font-semibold text-foreground">Entrar</span>
      </Link>
    );

    // Nav mobile unificado: dots centralizados → CTA full-width → Voltar/Entrar
    const mobileCtaLabel = isLast ? "Começar agora" : step === 0 ? "Começar grátis" : "Continuar";
    const mobileNav = (
      <div className="flex flex-col items-center gap-3 pb-1">
        <div className="flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <button
          onClick={goNext}
          className="w-full h-[56px] rounded-full bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
        >
          {mobileCtaLabel}
        </button>
        {step === 0 ? (
          <Link
            to="/auth"
            onClick={() => { trackEvent("login_clicked", {}); onLogin?.(); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Já tem uma conta? <span className="font-semibold text-foreground">Entrar</span>
          </Link>
        ) : (
          <button
            onClick={goBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar
          </button>
        )}
      </div>
    );

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col bg-background overflow-y-auto md:overflow-hidden px-6 md:px-12 lg:px-20"
        style={{
          minHeight: "100dvh",
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Mobile layout (até md) */}
        <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto md:hidden min-h-0">
          {step === 0 ? (
            <motion.div
              key="slide-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center w-full min-h-0 justify-start"
            >
              {/* dots topo */}
              <div className="flex justify-center gap-1.5 shrink-0 pt-0">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
                  />
                ))}
              </div>

              {/* CORE */}
              <h2 className="text-[64px] sm:text-[72px] font-black tracking-tight text-foreground text-center leading-none mt-8">
                CORE
              </h2>

              {/* Título + subtítulo */}
              <h1 className="text-[26px] font-bold text-foreground tracking-tight leading-[1.2] text-center mt-8 px-2">
                Controle sua vida financeira em um só lugar
              </h1>
              <p className="text-[14px] text-muted-foreground text-center mt-3 leading-snug px-2">
                Acompanhe receitas, gastos, contas, metas e investimentos sem complicação.
              </p>

              {/* 3 cards */}
              <div className="w-full mt-7">
                <SlideOneHero />
              </div>

              {/* CTA */}
              <button
                onClick={goNext}
                className="w-full h-[56px] rounded-2xl bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform mt-6 flex items-center justify-center relative"
              >
                <span>Começar agora</span>
                <ArrowRight className="w-5 h-5 absolute right-5" strokeWidth={2.25} />
              </button>

              {/* Microcopy */}
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                Leva menos de 2 minutos para configurar.
              </p>

              {/* Login link */}
              <p className="text-xs text-muted-foreground text-center mt-3 mb-1">
                Já tem uma conta?{" "}
                <Link to="/auth" className="text-foreground font-semibold underline underline-offset-2">
                  Entrar
                </Link>
              </p>
            </motion.div>
          ) : step === 1 ? (
            <motion.div
              key="slide-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center w-full min-h-0 justify-start"
            >
              {/* dots topo */}
              <div className="flex justify-center gap-1.5 shrink-0 pt-0">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
                  />
                ))}
              </div>

              {/* CORE */}
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="text-[56px] min-[390px]:text-[64px] font-black tracking-tight text-foreground text-center leading-none mt-6"
              >
                CORE
              </motion.h2>

              {/* Título + subtítulo */}
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="text-[22px] min-[390px]:text-[25px] font-bold text-foreground tracking-tight leading-[1.16] text-center mt-6 px-2"
              >
                Pare de perder dinheiro sem perceber
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="text-[13px] min-[390px]:text-[14px] text-muted-foreground text-center mt-3 leading-snug px-2"
              >
                Veja seus gastos separados por categoria e entenda exatamente onde seu dinheiro está indo.
              </motion.p>

              {/* Hero do slide 2 */}
              <div className="w-full mt-5">
                <SlideTwoHero />
              </div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.35 }}
                onClick={goNext}
                className="w-full h-[60px] rounded-full bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform mt-6 flex items-center justify-center relative"
              >
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5 absolute right-5" strokeWidth={2.25} />
              </motion.button>

              {/* Microcopy */}
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4 mb-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                Leva menos de 2 minutos para configurar.
              </p>
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="slide-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center w-full min-h-0"
            >
              {/* dots topo */}
              <div className="flex justify-center gap-1.5 shrink-0 pt-1">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
                  />
                ))}
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="text-[56px] min-[390px]:text-[64px] font-black tracking-tight text-foreground text-center leading-none mt-6"
              >
                CORE
              </motion.h2>

              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="text-[22px] min-[390px]:text-[25px] font-bold text-foreground tracking-tight leading-[1.16] text-center mt-6 px-2"
              >
                Saiba se o mês<br />vai fechar no positivo
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="text-[13px] min-[390px]:text-[14px] text-muted-foreground text-center mt-3 leading-snug px-2"
              >
                O CORE calcula receitas, despesas e contas pendentes para mostrar uma previsão antes do problema acontecer.
              </motion.p>

              <div className="w-full mt-7">
                <SlideThreeHero />
              </div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.35 }}
                onClick={goNext}
                className="w-full h-[60px] rounded-full bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform mt-6 flex items-center justify-center relative"
              >
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5 absolute right-5" strokeWidth={2.25} />
              </motion.button>

              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4 mb-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                Leva menos de 2 minutos para configurar.
              </p>
            </motion.div>
          ) : step === 3 ? (
            <motion.div
              key="slide-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center w-full min-h-0"
            >
              {/* dots topo */}
              <div className="flex justify-center gap-1.5 shrink-0 pt-1">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
                  />
                ))}
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="text-[64px] sm:text-[72px] font-black tracking-tight text-foreground text-center leading-none mt-8"
              >
                CORE
              </motion.h2>

              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="text-[26px] font-bold text-foreground tracking-tight leading-[1.2] text-center mt-8 px-2"
              >
                Defina limites e evite<br />passar do ponto
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="text-[14px] text-muted-foreground text-center mt-3 leading-snug px-2"
              >
                Crie limites por categoria e receba alertas quando estiver perto de exceder.
              </motion.p>

              <div className="w-full max-w-[336px] mt-5">
                <SlideFourHero />
              </div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.35 }}
                onClick={goNext}
                className="w-full max-w-[336px] h-[52px] rounded-[13px] bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform mt-4 flex items-center justify-center relative"
              >
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5 absolute right-5" strokeWidth={2.25} />
              </motion.button>

              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3 mb-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                Leva menos de 2 minutos para configurar.
              </p>
            </motion.div>
          ) : step === 4 ? (
            <motion.div
              key="slide-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center w-full min-h-0"
            >
              {/* dots topo */}
              <div className="flex justify-center gap-1.5 shrink-0 pt-1">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-foreground" : "w-1.5 bg-muted"}`}
                  />
                ))}
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
                className="text-[64px] sm:text-[72px] font-black tracking-tight text-foreground text-center leading-none mt-6"
              >
                CORE
              </motion.h2>

              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.35 }}
                className="text-[26px] font-bold text-foreground tracking-tight leading-[1.2] text-center mt-6 px-2"
              >
                Acompanhe seus<br />desejos e metas
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="text-[14px] text-muted-foreground text-center mt-3 leading-snug px-2"
              >
                Crie desejos, acompanhe quanto já guardou<br />e veja quanto falta para chegar lá.
              </motion.p>

              <div className="w-full max-w-[336px] mt-4">
                <SlideFiveDesejosHero />
              </div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.35 }}
                onClick={goNext}
                className="w-full max-w-[336px] h-[52px] rounded-[13px] bg-foreground text-background text-base font-semibold shadow-lg active:scale-[0.98] transition-transform mt-4 flex items-center justify-center relative"
              >
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5 absolute right-5" strokeWidth={2.25} />
              </motion.button>

              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3 mb-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                Leva menos de 2 minutos para configurar.
              </p>
            </motion.div>
          ) : (
            <>
              <span className="text-2xl font-black tracking-tight text-foreground mb-3 shrink-0 text-center">CORE</span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex-1 flex flex-col items-center justify-center min-h-0 w-full"
                >
                  <div className="w-full flex items-center justify-center py-2 min-h-0" ref={mockSlotRef}>
                    <div
                      ref={mockInnerRef}
                      style={{
                        transform: `scale(${mockScale})`,
                        transformOrigin: "top center",
                        width: "100%",
                      }}
                    >
                      {current.mock}
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight leading-[1.15] shrink-0 text-center mt-4">
                    {current.title}
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-2 leading-snug shrink-0 text-center">
                    {current.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="shrink-0 pt-2 w-full">
                {mobileNav}
              </div>
            </>
          )}
        </div>







        {/* Desktop/tablet layout (md+) */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-12 lg:gap-20 md:items-center flex-1 w-full max-w-6xl mx-auto">
          {/* Coluna esquerda */}
          <div className="flex flex-col h-full max-h-[720px]">
            <span className="text-3xl font-black tracking-tight text-foreground mb-8">CORE</span>
            <AnimatePresence mode="wait">
              <motion.div
                key={`l-${step}`}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
                }}
                className="flex-1 flex flex-col justify-center"
              >
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
                  }}
                  className="text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.1]"
                >
                  {current.title}
                </motion.h1>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
                  }}
                  className="text-base lg:text-lg text-muted-foreground mt-5 leading-relaxed max-w-md"
                >
                  {current.subtitle}
                </motion.p>
              </motion.div>
            </AnimatePresence>
            <div className="max-w-md w-full">
              {nav}
              {loginLink}
            </div>
          </div>

          {/* Coluna direita: mock */}
          <div className="flex items-center justify-center h-full max-h-[720px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`r-${step}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full flex items-center justify-center"
                style={{ transform: "scale(1.15)" }}
              >
                {current.mock}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }
);

WelcomeScreen.displayName = "WelcomeScreen";
