import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight, Check, ChevronDown, Sparkles,
  Wallet, Calendar, Brain, HeartPulse, Home as HomeIcon, GraduationCap,
  BookOpen, Flower2, Plane, Briefcase, Dumbbell, Salad, Target,
  Users, PawPrint, ShieldOff, Trophy, LayoutGrid, Zap, Flame, Smartphone,
} from "lucide-react";

// ---------------- Data ----------------

const modules = [
  { icon: Wallet, name: "Finanças", desc: "Receitas, despesas, contas, cartões, investimentos, desejos." },
  { icon: Calendar, name: "Rotina", desc: "Tarefas, hábitos e agenda do dia." },
  { icon: Brain, name: "Dev. Pessoal", desc: "Acompanhe seu crescimento." },
  { icon: HeartPulse, name: "Saúde", desc: "Hidratação, jejum, evolução corporal, log médico." },
  { icon: HomeIcon, name: "Casa", desc: "Limpeza, mercado, contas, manutenção e despensa." },
  { icon: GraduationCap, name: "Estudos", desc: "Tracking de estudos e progresso." },
  { icon: BookOpen, name: "Biblioteca", desc: "Lidos, lendo, quero ler — com metadados." },
  { icon: Flower2, name: "Beleza", desc: "Skincare, cabelo e inventário de produtos." },
  { icon: Plane, name: "Viagens", desc: "Bucket list, orçamento, mala, diário e câmbio." },
  { icon: Briefcase, name: "Carreira", desc: "Tracking da sua trajetória profissional." },
  { icon: Dumbbell, name: "Treino", desc: "Plano de treino e registros do dia." },
  { icon: Salad, name: "Dieta", desc: "Calorias, macros e refeições." },
  { icon: Target, name: "Mente", desc: "Captura de ideias, metas, sonhos e estratégia." },
  { icon: Users, name: "Relações", desc: "Pessoas, datas e ideias de presente." },
  { icon: PawPrint, name: "Pet", desc: "Diário, saúde, gastos e rotina." },
  { icon: ShieldOff, name: "Detox", desc: "Menos tela, mais vida." },
];

const mechanics = [
  { icon: LayoutGrid, title: "Home customizável", desc: "Widgets arrastáveis. Monte a tela como quiser." },
  { icon: Flame, title: "Streak diária", desc: "Sua sequência de dias ativos. Vicia no bom." },
  { icon: Zap, title: "Quick Actions", desc: "Registre água, gasto, treino ou ideia em 1 toque." },
  { icon: Trophy, title: "Conquistas", desc: "Cada hábito vira badge. Cada badge vira identidade." },
];

const benefits = [
  "Pare de pular entre 15 apps — sua vida inteira em um só painel.",
  "Em 3 segundos, saiba como está seu mês financeiro.",
  "Nunca mais esqueça uma conta, treino, remédio ou refeição.",
  "Crie o hábito que nenhum app vertical te deu — com streak e score.",
  "Visual premium estilo Notion/Linear. Bonito o bastante pra abrir todo dia.",
  "Mobile-first real. Roda no navegador. Sem precisar baixar.",
];

const faq = [
  { q: "O que é o CORE?", a: "Um app que reúne 16 módulos pra organizar sua vida inteira: finanças, treino, dieta, rotina, saúde, casa, viagens, leitura, hábitos e mais." },
  { q: "Preciso usar todos os módulos?", a: "Não. Você escolhe os que importam pra você na Home. O resto fica guardado." },
  { q: "É grátis?", a: "Você tem 7 dias grátis sem cartão. Depois R$ 3,90/mês no plano anual ou R$ 14,90/mês no mensal." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa." },
  { q: "Funciona no iPhone e Android?", a: "Sim. O CORE é PWA mobile-first — roda direto no navegador." },
  { q: "Meus dados ficam seguros?", a: "Sim. Tudo armazenado de forma criptografada em nuvem. Só você acessa." },
  { q: "Preciso entender de finanças ou de produtividade?", a: "Não. A linguagem é simples e os painéis vêm prontos." },
  { q: "Como cancelo?", a: "Direto no app, em 1 clique." },
];

// ---------------- Helpers ----------------

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay, ease: "easeOut" as const },
});

const CTA = ({ children = "Testar grátis por 7 dias", className = "" }: { children?: React.ReactNode; className?: string }) => (
  <Link
    to="/auth"
    className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background px-6 py-3.5 text-sm font-semibold shadow-sm hover:opacity-90 transition ${className}`}
  >
    {children}
    <ArrowRight className="w-4 h-4" />
  </Link>
);

// ---------------- Sections ----------------

const Nav = () => (
  <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
    <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
      <Link to="/lp" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-sm">C</div>
        <span className="font-bold tracking-tight">CORE</span>
      </Link>
      <div className="flex items-center gap-2">
        <Link to="/auth" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground px-3 py-2">Entrar</Link>
        <CTA className="!px-4 !py-2 !text-xs">Começar grátis</CTA>
      </div>
    </div>
  </header>
);

const Hero = () => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 -z-10 opacity-60" style={{
      background: "radial-gradient(circle at 20% 10%, hsl(var(--chart-1)/0.18), transparent 50%), radial-gradient(circle at 80% 30%, hsl(var(--chart-2)/0.18), transparent 55%), radial-gradient(circle at 50% 90%, hsl(var(--chart-4)/0.18), transparent 60%)",
    }} />
    <div className="max-w-6xl mx-auto px-5 pt-14 pb-20 md:pt-24 md:pb-28">
      <motion.div {...fade(0)} className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
          <Sparkles className="w-3 h-3" /> O sistema operacional da sua vida
        </span>
      </motion.div>
      <motion.h1 {...fade(0.05)} className="mt-5 text-center text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
        Sua vida inteira
        <br />
        <span className="bg-gradient-to-r from-[hsl(var(--chart-1))] via-[hsl(var(--chart-4))] to-[hsl(var(--chart-2))] bg-clip-text text-transparent">
          em um só painel.
        </span>
      </motion.h1>
      <motion.p {...fade(0.1)} className="mt-5 text-center text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
        16 módulos integrados — finanças, treino, dieta, rotina, saúde, casa, viagens, leitura, hábitos e mais.
        Sem fragmentação. Sem 15 notificações.
      </motion.p>
      <motion.div {...fade(0.15)} className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <CTA />
        <p className="text-xs text-muted-foreground">Sem cartão · Cancele quando quiser</p>
      </motion.div>

      {/* Mockup */}
      <motion.div {...fade(0.2)} className="mt-14 mx-auto max-w-md">
        <div className="relative rounded-[2.2rem] border border-border bg-card p-3 shadow-2xl">
          <div className="rounded-[1.6rem] bg-background p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Bom dia,</p>
                <p className="text-base font-bold">Vamos pra cima 👋</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--chart-2))] to-[hsl(var(--chart-3))] flex items-center justify-center text-background font-bold text-xs">
                87
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[hsl(var(--chart-3)/0.15)] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Saldo do mês</p>
                <p className="text-sm font-bold text-[hsl(var(--chart-2))]">+R$ 5.765</p>
              </div>
              <div className="bg-[hsl(var(--chart-1)/0.15)] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Treino</p>
                <p className="text-sm font-bold">Peito + Tríceps</p>
              </div>
              <div className="bg-[hsl(var(--chart-2)/0.15)] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Calorias</p>
                <p className="text-sm font-bold">1.420 / 2.100</p>
              </div>
              <div className="bg-[hsl(var(--chart-4)/0.15)] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Hábitos hoje</p>
                <p className="text-sm font-bold">4 / 6</p>
              </div>
            </div>

            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-1">Streak</p>
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[hsl(var(--chart-3))]" />
                <span className="text-sm font-bold">23 dias seguidos</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

const Problem = () => (
  <section className="border-t border-border/60">
    <div className="max-w-4xl mx-auto px-5 py-20 md:py-28 text-center">
      <motion.h2 {...fade()} className="text-3xl md:text-5xl font-bold tracking-tight">
        Sua vida está em 15 apps diferentes.
        <br />
        <span className="text-muted-foreground">E você não usa nenhum direito.</span>
      </motion.h2>
      <motion.div {...fade(0.1)} className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
        {[
          "Finanças no app do banco. Treino no Strava. Dieta numa nota. Hábitos na cabeça.",
          "Já tentou Notion, planilha, bullet journal — largou em 2 semanas.",
          "Esquece contas, treinos, remédios, refeições.",
          "Não enxerga a semana — só o que está bem na sua frente.",
        ].map((t, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            {t}
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

const Solution = () => (
  <section className="border-t border-border/60 bg-muted/30">
    <div className="max-w-4xl mx-auto px-5 py-20 md:py-28 text-center">
      <motion.p {...fade()} className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">A solução</motion.p>
      <motion.h2 {...fade(0.05)} className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">
        Um app. Todas as áreas. Um painel só.
      </motion.h2>
      <motion.p {...fade(0.1)} className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
        O CORE foi feito pra durar. Bonito o bastante pra você abrir todo dia.
        Leve o bastante pra rodar no celular sem peso.
      </motion.p>
    </div>
  </section>
);

const HowItWorks = () => (
  <section className="border-t border-border/60">
    <div className="max-w-5xl mx-auto px-5 py-20 md:py-28">
      <motion.h2 {...fade()} className="text-3xl md:text-4xl font-bold tracking-tight text-center">Como funciona</motion.h2>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { n: "01", t: "Monte sua Home", d: "Escolha os widgets que importam pra você. Arraste, redimensione, organize." },
          { n: "02", t: "Registre em 1 toque", d: "Gasto, treino, água, refeição, hábito, ideia. Quick Actions em qualquer lugar." },
          { n: "03", t: "Construa sua streak", d: "Score do dia, sequência de dias ativos, conquistas que viram identidade." },
        ].map((s, i) => (
          <motion.div key={s.n} {...fade(i * 0.08)} className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs font-mono text-muted-foreground">{s.n}</div>
            <h3 className="mt-2 text-lg font-bold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Modules = () => (
  <section className="border-t border-border/60 bg-muted/30">
    <div className="max-w-6xl mx-auto px-5 py-20 md:py-28">
      <motion.div {...fade()} className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">16 módulos, um app</h2>
        <p className="mt-4 text-muted-foreground">Use os que importam pra você. O resto fica guardado, esperando.</p>
      </motion.div>
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        {modules.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.name}
              {...fade(i * 0.02)}
              className="rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">{m.name}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

const Mechanics = () => (
  <section className="border-t border-border/60">
    <div className="max-w-5xl mx-auto px-5 py-20 md:py-28">
      <motion.h2 {...fade()} className="text-3xl md:text-4xl font-bold tracking-tight text-center max-w-2xl mx-auto">
        Mecânicas que <span className="italic">viciam no bom</span>
      </motion.h2>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        {mechanics.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div key={m.title} {...fade(i * 0.05)} className="rounded-2xl border border-border bg-card p-6 flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

const Benefits = () => (
  <section className="border-t border-border/60 bg-muted/30">
    <div className="max-w-4xl mx-auto px-5 py-20 md:py-28">
      <motion.h2 {...fade()} className="text-3xl md:text-4xl font-bold tracking-tight text-center">
        O que você ganha
      </motion.h2>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
        {benefits.map((b, i) => (
          <motion.div key={i} {...fade(i * 0.03)} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="w-6 h-6 rounded-full bg-[hsl(var(--chart-2)/0.18)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-[hsl(var(--chart-2))]" />
            </div>
            <p className="text-sm">{b}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Pricing = () => (
  <section className="border-t border-border/60">
    <div className="max-w-4xl mx-auto px-5 py-20 md:py-28">
      <motion.div {...fade()} className="text-center max-w-xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Risco zero pra começar</h2>
        <p className="mt-4 text-muted-foreground">7 dias grátis. Sem cartão. Cancele quando quiser.</p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div {...fade(0.05)} className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Mensal</p>
          <p className="mt-3 text-3xl font-bold">R$ 14,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Flexibilidade total</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />Acesso aos 16 módulos</li>
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />Home customizável</li>
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />Cancele quando quiser</li>
          </ul>
          <Link to="/auth" className="mt-6 inline-flex w-full justify-center items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted transition">Começar com 7 dias grátis</Link>
        </motion.div>

        <motion.div {...fade(0.1)} className="relative rounded-2xl border-2 border-foreground bg-card p-6">
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-foreground text-background px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
            Mais escolhido
          </span>
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Anual</p>
          <p className="mt-3 text-3xl font-bold">R$ 3,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <p className="mt-1 text-xs text-[hsl(var(--chart-2))] font-medium">Economia de R$ 132/ano</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />Tudo do mensal</li>
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />74% de desconto</li>
            <li className="flex gap-2"><Check className="w-4 h-4 text-[hsl(var(--chart-2))] flex-shrink-0 mt-0.5" />1 ano completo</li>
          </ul>
          <CTA className="mt-6 w-full">Começar com 7 dias grátis</CTA>
        </motion.div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Sem cartão pra testar · Cancele em 1 clique · Sem fidelidade
      </p>
    </div>
  </section>
);

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="font-medium">{q}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="pb-5 text-sm text-muted-foreground">{a}</p>}
    </div>
  );
};

const FAQ = () => (
  <section className="border-t border-border/60 bg-muted/30">
    <div className="max-w-3xl mx-auto px-5 py-20 md:py-28">
      <motion.h2 {...fade()} className="text-3xl md:text-4xl font-bold tracking-tight text-center">Perguntas frequentes</motion.h2>
      <div className="mt-10">
        {faq.map(item => <FAQItem key={item.q} {...item} />)}
      </div>
    </div>
  </section>
);

const FinalCTA = () => (
  <section className="border-t border-border/60">
    <div className="max-w-3xl mx-auto px-5 py-24 md:py-32 text-center">
      <motion.div {...fade()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground mb-6">
        <Smartphone className="w-3 h-3" /> Mobile-first · PWA · sem app store
      </motion.div>
      <motion.h2 {...fade(0.05)} className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
        Comece hoje.
        <br />
        <span className="text-muted-foreground">Sua vida agradece.</span>
      </motion.h2>
      <motion.div {...fade(0.1)} className="mt-8 flex flex-col items-center gap-3">
        <CTA />
        <p className="text-xs text-muted-foreground">7 dias grátis · sem cartão · cancele quando quiser</p>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-border/60">
    <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-xs">C</div>
        <span className="font-bold text-sm">CORE</span>
      </div>
      <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} CORE — Organize sua vida</p>
    </div>
  </footer>
);

// ---------------- Page ----------------

const LandingPage = () => (
  <div className="min-h-dvh bg-background text-foreground antialiased">
    <Nav />
    <main>
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Modules />
      <Mechanics />
      <Benefits />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
