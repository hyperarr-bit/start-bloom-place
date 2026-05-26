import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  DollarSign, Dumbbell, Apple, CalendarCheck, Sparkles, Heart, Home as HomeIcon,
  GraduationCap, BookOpen, Droplets, Plane, Briefcase, Brain, Users, PawPrint, Leaf,
  Bell, ChevronLeft, Sun, Plus, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
} from "lucide-react";

/**
 * Mockup animado do app dentro do iPhone — substitui o vídeo.
 * Cicla entre 3 telas: Home, Finanças, Dieta.
 */

const SCENE_DURATION = 4500; // ms por tela
const SCENES = ["home", "financas", "dieta"] as const;

const StatusBar = () => (
  <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-semibold text-foreground">
    <span>18:58</span>
    <div className="flex items-center gap-1">
      <span>•••</span>
      <span>📶</span>
      <span className="px-1 rounded bg-foreground/80 text-background text-[8px]">23</span>
    </div>
  </div>
);

const DynamicIsland = () => (
  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[35%] h-5 rounded-full bg-black z-20" />
);

/* ---------------- Home ---------------- */
const HomeScene = () => {
  const modules = [
    { icon: DollarSign, label: "Finanças", bg: "bg-amber-100", color: "text-amber-600" },
    { icon: Dumbbell, label: "Treino", bg: "bg-blue-100", color: "text-blue-600" },
    { icon: Apple, label: "Dieta", bg: "bg-green-100", color: "text-green-600" },
    { icon: CalendarCheck, label: "Rotina", bg: "bg-emerald-100", color: "text-emerald-600" },
    { icon: Sparkles, label: "Dev. Pessoal", bg: "bg-purple-100", color: "text-purple-600" },
    { icon: Heart, label: "Saúde", bg: "bg-red-100", color: "text-red-600" },
    { icon: HomeIcon, label: "Casa", bg: "bg-cyan-100", color: "text-cyan-600" },
    { icon: GraduationCap, label: "Estudos", bg: "bg-indigo-100", color: "text-indigo-600" },
    { icon: BookOpen, label: "Biblioteca", bg: "bg-orange-100", color: "text-orange-600" },
    { icon: Droplets, label: "Beleza", bg: "bg-pink-100", color: "text-pink-600" },
    { icon: Plane, label: "Viagens", bg: "bg-teal-100", color: "text-teal-600" },
    { icon: Briefcase, label: "Carreira", bg: "bg-slate-100", color: "text-slate-600" },
    { icon: Brain, label: "Mente", bg: "bg-violet-100", color: "text-violet-600" },
    { icon: Users, label: "Relações", bg: "bg-rose-100", color: "text-rose-600" },
    { icon: PawPrint, label: "Pet", bg: "bg-amber-100", color: "text-amber-700" },
    { icon: Leaf, label: "Detox", bg: "bg-lime-100", color: "text-lime-600" },
  ];

  return (
    <div className="px-3 pb-2 text-foreground">
      {/* Saudação */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[13px] font-bold">Boa noite, João 👋</div>
          <div className="text-[8px] text-muted-foreground leading-tight w-40">
            Que tal ler um pouco de "As 48 leis do poder" 📕
          </div>
        </div>
        <div className="flex gap-1">
          <div className="w-5 h-5 rounded-full bg-foreground text-background text-[8px] font-bold flex items-center justify-center">JO</div>
          <Sun className="w-3 h-3 text-muted-foreground" />
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
        </div>
      </div>

      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-2.5 mb-2 flex items-center gap-2.5"
      >
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <motion.circle
              cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="94"
              initial={{ strokeDashoffset: 94 }}
              animate={{ strokeDashoffset: 75 }}
              transition={{ duration: 1.2, delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold leading-none">20</span>
            <span className="text-[5px] text-muted-foreground tracking-wide">PONTOS</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold">Vamos lá!</div>
          <div className="text-[8px] text-muted-foreground leading-tight">Score do dia baseado em suas atividades</div>
          <div className="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[8px] font-medium">
            🔥 1 dia <span className="text-muted-foreground">consecutivo</span>
          </div>
        </div>
      </motion.div>

      {/* Ações rápidas */}
      <div className="text-[8px] font-bold text-muted-foreground mb-1 tracking-wide">AÇÕES RÁPIDAS</div>
      <div className="flex gap-1.5 mb-2 overflow-hidden">
        {[
          { icon: "💧", label: "+ 200ml Água" },
          { icon: "😊", label: "Check de Humor" },
          { icon: "💵", label: "Registrar G" },
        ].map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
            className="shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 text-[8px] flex items-center gap-1"
          >
            <span>{a.icon}</span>
            <span className="font-medium">{a.label}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="rounded-lg border border-dashed border-border py-1.5 text-center text-[9px] text-muted-foreground mb-2 flex items-center justify-center gap-1"
      >
        <Plus className="w-2.5 h-2.5" /> Adicionar widget
      </motion.div>

      {/* Pendências */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[8px] font-bold flex items-center gap-1">
          <CalendarCheck className="w-2.5 h-2.5" /> PENDÊNCIAS DE HOJE
        </div>
        <div className="text-[8px] bg-muted rounded-full px-1.5 py-0.5">6 pendentes</div>
      </div>

      {/* Módulos grid */}
      <div className="text-[8px] font-bold text-muted-foreground mb-1.5">MÓDULOS</div>
      <div className="grid grid-cols-4 gap-1.5">
        {modules.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.025 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <span className="text-[7px] text-foreground/80 leading-tight text-center">{m.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- Finanças ---------------- */
const FinancasScene = () => (
  <div className="px-3 pb-2 text-foreground">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <ChevronLeft className="w-3.5 h-3.5" />
        <DollarSign className="w-3 h-3 text-amber-600" />
        <span className="text-[12px] font-bold">FINANÇAS</span>
      </div>
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
        Abril De 2026 <Sun className="w-2.5 h-2.5" />
      </div>
    </div>

    <div className="flex gap-1 mb-2 text-[8px]">
      <div className="bg-card border border-border rounded-md px-2 py-1 font-semibold flex items-center gap-1">
        📊 DASHBOARD
      </div>
      <div className="bg-card border border-border rounded-md px-2 py-1 text-muted-foreground flex items-center gap-1">
        💰 MEU FINANCEIRO
      </div>
      <div className="bg-card border border-border rounded-md px-2 py-1 text-muted-foreground flex items-center gap-1">
        📈 INVESTIM
      </div>
    </div>

    <div className="grid grid-cols-2 gap-1.5 mb-2">
      {[
        { label: "Receitas", value: "R$ 5.800", icon: DollarSign, color: "text-emerald-600" },
        { label: "Despesas", value: "R$ 920", icon: TrendingDown, color: "text-rose-500" },
        { label: "Saldo do Mês", value: "+R$ 4.880", icon: TrendingUp, color: "text-emerald-600" },
        { label: "Investimentos", value: "R$ 0", icon: TrendingUp, color: "text-violet-500" },
      ].map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="rounded-lg border border-border bg-card p-1.5"
        >
          <div className="flex items-center justify-between text-[8px] text-muted-foreground">
            {s.label} <s.icon className={`w-2.5 h-2.5 ${s.color}`} />
          </div>
          <div className={`text-[11px] font-bold ${s.color}`}>{s.value}</div>
        </motion.div>
      ))}
    </div>

    <div className="rounded-lg border border-border bg-card p-2 mb-2">
      <div className="flex items-center gap-1 text-[8px] font-bold mb-1">
        <AlertCircle className="w-2.5 h-2.5" /> ALERTAS INTELIGENTES
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded p-1.5 mb-1 text-[8px] text-orange-900 flex gap-1">
        📅 <span>2 conta(s) vencem em 1 dia(s): Internet, Seguro</span>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5 text-[8px] text-emerald-900 flex gap-1">
        <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
        <span>Excelente! Você está poupando 84.1% da sua renda este mês.</span>
      </div>
    </div>

    <div className="rounded-lg border border-border bg-card p-2">
      <div className="text-[8px] font-bold mb-1.5 flex items-center gap-1">📊 GASTOS POR CATEGORIA</div>
      <div className="flex items-center gap-2">
        {/* Donut */}
        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90 shrink-0">
          <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          {[
            { color: "hsl(263 70% 60%)", val: 50, off: 0 },
            { color: "hsl(340 75% 60%)", val: 12, off: 50 },
            { color: "hsl(160 65% 50%)", val: 10, off: 62 },
            { color: "hsl(35 90% 60%)", val: 8, off: 72 },
            { color: "hsl(220 80% 60%)", val: 7, off: 80 },
          ].map((seg, i) => (
            <motion.circle
              key={i}
              cx="18" cy="18" r="14" fill="none" stroke={seg.color} strokeWidth="4"
              strokeDasharray={`${seg.val} 100`}
              strokeDashoffset={-seg.off}
              pathLength={100}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            />
          ))}
        </svg>
        <div className="flex-1 text-[8px] space-y-0.5">
          {[
            { c: "bg-violet-500", l: "Moradia", v: "R$ 2.250" },
            { c: "bg-pink-500", l: "Lazer", v: "R$ 465" },
            { c: "bg-emerald-500", l: "Assinaturas", v: "R$ 400" },
            { c: "bg-amber-500", l: "Mercado", v: "R$ 320" },
            { c: "bg-blue-500", l: "Transporte", v: "R$ 280" },
          ].map((it, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${it.c}`} />
                <span>{it.l}</span>
              </div>
              <span className="text-muted-foreground">{it.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ---------------- Dieta ---------------- */
const DietaScene = () => (
  <div className="px-3 pb-2 text-foreground">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5">
        <ChevronLeft className="w-3.5 h-3.5" />
        <Apple className="w-3 h-3 text-green-600" />
        <span className="text-[12px] font-bold">DIETA</span>
      </div>
    </div>
    <div className="text-[8px] text-muted-foreground mb-2 ml-5">Cardápio, jejum, receitas e diário</div>

    <div className="flex gap-1 mb-2 text-[8px]">
      {[
        { l: "JEJUM", e: "⏱️" },
        { l: "RECEITAS", e: "🍳" },
        { l: "LISTA", e: "🛒", active: true },
        { l: "DIÁRIO", e: "📊" },
      ].map((t, i) => (
        <div
          key={i}
          className={`rounded-md px-2 py-1 flex items-center gap-1 ${
            t.active ? "bg-foreground text-background font-semibold" : "bg-card border border-border text-muted-foreground"
          }`}
        >
          {t.e} {t.l}
        </div>
      ))}
    </div>

    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-2 mb-2"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1 text-[9px] font-semibold">
          <span className="w-4 h-4 rounded bg-muted flex items-center justify-center">💡</span>
          Dicas para começar
        </div>
        <span className="text-muted-foreground text-[10px]">×</span>
      </div>
      <ul className="text-[8px] text-muted-foreground space-y-0.5 leading-tight ml-1">
        <li>• Configure suas refeições clicando em 🍳 no cardápio</li>
        <li>• No cardápio semanal, clique em cada refeição para adicionar</li>
        <li>• Use o 📊 DIÁRIO para registrar o que comeu</li>
      </ul>
    </motion.div>

    <div className="flex items-center justify-between mb-1.5">
      <div className="text-[9px] font-bold flex items-center gap-1">🛒 LISTA INTELIGENTE</div>
    </div>
    <div className="text-[8px] text-muted-foreground mb-1.5">2 itens pendentes</div>

    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
      <div className="rounded-md border border-border bg-card py-1.5 text-[8px] text-center font-medium">+ Gerar do Cardápio</div>
      <div className="rounded-md border border-border bg-card py-1.5 text-[8px] text-center font-medium">♡ Gerar das Favoritas</div>
    </div>

    <div className="flex gap-1 mb-1.5">
      <div className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[8px] text-muted-foreground">
        Adicionar item manualmente...
      </div>
      <div className="rounded-md bg-foreground text-background w-7 flex items-center justify-center text-[10px] font-bold">+</div>
    </div>

    {[
      { label: "150g De Banana" },
      { label: "Pasta De Amendoim 30g" },
    ].map((it, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 + i * 0.1 }}
        className="rounded-md border border-border bg-card px-2 py-1.5 mb-1 flex items-center gap-2 text-[8px]"
      >
        <div className="w-2.5 h-2.5 rounded border border-border" />
        {it.label}
      </motion.div>
    ))}
  </div>
);

const renderScene = (s: string) => {
  if (s === "home") return <HomeScene />;
  if (s === "financas") return <FinancasScene />;
  return <DietaScene />;
};

interface AnimatedAppMockupProps {
  scene?: "home" | "financas" | "dieta";
}

export const AnimatedAppMockup = ({ scene }: AnimatedAppMockupProps = {}) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (scene) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % SCENES.length), SCENE_DURATION);
    return () => clearInterval(id);
  }, [scene]);

  const current = scene ?? SCENES[idx];

  return (
    <div className="absolute inset-0 bg-background overflow-hidden">
      <DynamicIsland />
      <StatusBar />
      <div className="relative h-[calc(100%-1.6rem)] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 overflow-hidden"
          >
            {renderScene(current)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
