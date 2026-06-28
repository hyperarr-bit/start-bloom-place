import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, TrendingUp, CalendarClock, ArrowRight, Check, Sparkles,
  PartyPopper, HeartPulse, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * PROTÓTIPO pra comparar 3 formatos de tutorial (não cria conta de verdade):
 *  - value: demo guiada por valor (aponta o que já está na tela)
 *  - quiz : onboarding personalizado (perguntas → insight) estilo Cal AI
 *  - combo: quiz curto + demo guiada
 * Seletor no topo é só do protótipo.
 */

type Variant = "value" | "quiz" | "combo";

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

/* ===================================================== mock do app real */

type Hl = "fluxo" | "sobra" | "contas" | null;

const ring = (on: boolean) =>
  on ? "ring-2 ring-accent ring-offset-2 ring-offset-card relative z-10" : "";

function FinanceMock({ highlight, leftLabel = "R$ 797" }: { highlight: Hl; leftLabel?: string }) {
  return (
    <div className="w-full max-w-[300px] mx-auto rounded-[2rem] border border-border bg-card shadow-xl overflow-hidden">
      {/* topo */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold tracking-tight">Meu mês — Junho</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* sobra */}
        <div className={`rounded-xl bg-secondary p-3.5 transition-all ${ring(highlight === "sobra")}`}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Dá pra gastar</div>
          <div className="text-3xl font-bold tracking-tight">{leftLabel}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">até o fim do mês, sem estourar</div>
        </div>

        {/* fluxo */}
        <div className={`grid grid-cols-2 gap-2.5 transition-all ${ring(highlight === "fluxo")}`}>
          <div className="rounded-xl bg-card-receitas/60 border border-card-receitas-border/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-card-receitas-text/80 font-semibold">Entrou</div>
            <div className="text-base font-bold text-card-receitas-text">R$ 3.000</div>
          </div>
          <div className="rounded-xl bg-card-despesas/60 border border-card-despesas-border/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-card-despesas-text/80 font-semibold">Saiu</div>
            <div className="text-base font-bold text-card-despesas-text">R$ 2.203</div>
          </div>
        </div>

        {/* contas */}
        <div className={`rounded-xl border border-border p-3 transition-all ${ring(highlight === "contas")}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarClock className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Contas a vencer</span>
          </div>
          <div className="space-y-1.5">
            {[["Luz", "dia 5", "R$ 180"], ["Água", "dia 10", "R$ 45"], ["Academia", "dia 12", "R$ 158"]].map(([n, d, v]) => (
              <div key={n} className="flex items-center justify-between text-xs">
                <span className="text-foreground/80">{n} <span className="text-muted-foreground">· {d}</span></span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* saúde */}
        <div className="flex items-center justify-between rounded-xl bg-card-investimentos/50 border border-card-investimentos-border/50 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-card-investimentos-text">
            <HeartPulse className="w-3.5 h-3.5" /> Saúde financeira
          </span>
          <span className="text-xs font-bold text-card-investimentos-text">Boa</span>
        </div>
      </div>
    </div>
  );
}

/* ===================================================== variant: VALUE */

const VALUE_STEPS: { hl: Hl; title: string; body: string }[] = [
  { hl: "fluxo", title: "Tudo do seu mês numa tela.", body: "O que entrou e o que saiu, somado na hora. Sem planilha, sem abrir 3 apps." },
  { hl: "sobra", title: "Quanto dá pra gastar hoje.", body: "O número que importa: o que ainda sobra até o fim do mês, sem estourar." },
  { hl: "contas", title: "Nada mais esquecido.", body: "Suas contas a vencer, organizadas por dia. O CORE te avisa antes." },
];

function ValueTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === VALUE_STEPS.length - 1;
  const s = VALUE_STEPS[i];
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <FinanceMock highlight={s.hl} />
      <AnimatePresence mode="wait">
        <motion.div key={i} {...fade} className="text-center mt-7 px-2">
          <h2 className="text-2xl font-bold tracking-tight mb-2">{s.title}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-1.5 mt-6 mb-6">
        {VALUE_STEPS.map((_, idx) => (
          <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>
      <Button size="lg" className="w-full max-w-xs h-12 text-base" onClick={() => (last ? onDone() : setI(i + 1))}>
        {last ? "Quero isso com meus números" : "Próximo"} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ====================================================== variant: QUIZ */

type Q = { key: string; q: string; opts: string[] };
const QUIZ: Q[] = [
  { key: "renda", q: "Quanto entra por mês, mais ou menos?", opts: ["Até R$ 2 mil", "R$ 2 a 5 mil", "R$ 5 a 10 mil", "Mais de R$ 10 mil"] },
  { key: "vaza", q: "Pra onde some a maior parte?", opts: ["Comida e delivery", "Contas e boletos", "Compras por impulso", "Sinceramente, não sei"] },
  { key: "dor", q: "Qual o seu maior perrengue hoje?", opts: ["Nunca sobra nada", "Vivo no limite do cartão", "Não consigo poupar", "Esqueço de pagar contas"] },
];

function QuizInsight({ answers, onDone, cta = "Ver isso na prática" }: { answers: Record<string, string>; onDone: () => void; cta?: string }) {
  const naoSabe = answers.vaza === "Sinceramente, não sei";
  return (
    <motion.div {...fade} className="w-full max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight leading-tight mb-3">
        {naoSabe ? "Esse é exatamente o problema." : "Já entendi seu caso."}
      </h2>
      <p className="text-muted-foreground leading-relaxed mb-5">
        Quem {answers.dor?.toLowerCase() || "vive no aperto"} normalmente perde de vista{" "}
        <strong className="text-foreground">R$ 300–600 por mês</strong> em gastos que parecem pequenos.
        O CORE coloca isso na sua frente — e te diz quanto dá pra gastar sem culpa.
      </p>
      <Card className="p-4 text-left space-y-2 mb-7">
        {[
          ["Renda", answers.renda],
          ["Onde vaza", answers.vaza],
          ["Maior perrengue", answers.dor],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium text-right">{v || "—"}</span>
          </div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12 text-base" onClick={onDone}>
        {cta} <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

function QuizTutorial({ questions, onDone }: { questions: Q[]; onDone: (a: Record<string, string>) => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = questions[idx];
  const pick = (opt: string) => {
    const next = { ...answers, [q.key]: opt };
    setAnswers(next);
    if (idx < questions.length - 1) setIdx(idx + 1);
    else onDone(next);
  };
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-1.5 mb-7 justify-center">
        {questions.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i <= idx ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.key} {...fade}>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight text-center mb-7">{q.q}</h2>
          <div className="space-y-2.5">
            {q.opts.map((opt) => (
              <button
                key={opt}
                onClick={() => pick(opt)}
                className="w-full text-left rounded-xl border border-border bg-card hover:border-accent hover:bg-accent/5 transition-colors px-4 py-3.5 text-[15px] font-medium flex items-center justify-between group"
              >
                {opt}
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============================================= variant: COMBO + flows */

function QuizFlow({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  if (!answers) return <QuizTutorial questions={QUIZ} onDone={setAnswers} />;
  return <QuizInsight answers={answers} onDone={onDone} cta="Criar minha conta" />;
}

function ComboFlow({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"quiz" | "insight" | "demo">("quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (phase === "quiz") return <QuizTutorial questions={QUIZ.slice(0, 2)} onDone={(a) => { setAnswers(a); setPhase("insight"); }} />;
  if (phase === "insight") return <QuizInsight answers={answers} onDone={() => setPhase("demo")} />;
  return <ValueTutorial onDone={onDone} />;
}

/* ============================================================== ending */

function EndFlow({ onRestart }: { onRestart: () => void }) {
  const [phase, setPhase] = useState<"signup" | "trial">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && pass.length >= 6;

  if (phase === "signup") {
    return (
      <motion.div {...fade} className="w-full max-w-sm mx-auto">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Último passo
          </div>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight">Só falta 1 passo pra você<br />começar a usar o CORE.</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) setPhase("trial"); }} className="space-y-3">
          <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
          <Input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          <Input type="password" placeholder="Crie uma senha (mín. 6)" value={pass} onChange={(e) => setPass(e.target.value)} className="h-12" />
          <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={!valid}>
            Criar conta e liberar acesso <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-4">Protótipo — não cria conta de verdade.</p>
      </motion.div>
    );
  }
  return (
    <motion.div {...fade} className="w-full max-w-sm mx-auto text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5">
        <PartyPopper className="w-10 h-10" />
      </motion.div>
      <h2 className="text-[28px] font-bold tracking-tight leading-tight mb-2">Pronto! 7 dias grátis<br />liberados.</h2>
      <p className="text-muted-foreground leading-relaxed mb-7">Acesso completo, sem cartão agora. Cancele quando quiser.</p>
      <Button size="lg" className="w-full h-12 text-base mb-3" onClick={onRestart}>
        Aceitar e começar <ArrowRight className="w-4 h-4" />
      </Button>
      <button onClick={onRestart} className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
        <RotateCcw className="w-3.5 h-3.5" /> Recomeçar protótipo
      </button>
    </motion.div>
  );
}

/* =============================================================== shell */

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "value", label: "Valor" },
  { id: "quiz", label: "Quiz" },
  { id: "combo", label: "Combo" },
];

export default function TutorialLab() {
  const [variant, setVariant] = useState<Variant>("value");
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const restart = () => { setDone(false); setRunKey((k) => k + 1); };
  const choose = (v: Variant) => { setVariant(v); restart(); };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Protótipo · Tutorial</span>
          <div className="flex items-center gap-1 text-xs">
            {VARIANTS.map((v) => (
              <button key={v.id} onClick={() => choose(v.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${variant === v.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <AnimatePresence mode="wait">
          <motion.div key={`${variant}-${runKey}-${done}`} {...fade} className="w-full">
            {done ? (
              <EndFlow onRestart={restart} />
            ) : (
              <>
                {variant === "value" && <ValueTutorial onDone={() => setDone(true)} />}
                {variant === "quiz" && <QuizFlow onDone={() => setDone(true)} />}
                {variant === "combo" && <ComboFlow onDone={() => setDone(true)} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
