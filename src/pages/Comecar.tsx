import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Check, Wallet, TrendingUp, Target,
  PartyPopper, Plus, Eye, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * PROTÓTIPO do novo funil "sem LP":
 *   início (botão Começar) → tutorial → "só falta 1 passo" (form) → "ganhou 7 dias" (aceitar) → app
 * O tutorial tem 3 variações (slides / demo / mix) pra comparar. O seletor do topo
 * é só do protótipo. Quando escolhermos a variação, a gente liga o signUp real e
 * remove o seletor.
 */

type Variant = "slides" | "demo" | "mix";
type Step = "start" | "tutorial" | "signup" | "trial";

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.3 },
};

/* ---------------------------------------------------------------- slides */

const SLIDES = [
  {
    key: "dor",
    Icon: Wallet,
    title: "Pra onde foi o seu dinheiro?",
    subtitle: "Você trabalha o mês todo e no fim não sobra nada — e não sabe explicar por quê.",
  },
  {
    key: "solucao",
    Icon: Eye,
    title: "O CORE te mostra tudo, claro.",
    subtitle: "Receitas, contas, dívidas e metas num lugar só. Atualizado em segundos, sem planilha.",
  },
  {
    key: "ganho",
    Icon: Target,
    title: "Saiba quanto dá pra gastar.",
    subtitle: "Sem culpa, sem susto no fim do mês. Você no controle do seu dinheiro.",
  },
];

function Slides({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <AnimatePresence mode="wait">
        <motion.div key={s.key} {...fade} className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-accent/10 text-accent flex items-center justify-center mb-7">
            <s.Icon className="w-11 h-11" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-3">{s.title}</h2>
          <p className="text-muted-foreground leading-relaxed">{s.subtitle}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-1.5 mt-9 mb-7">
        {SLIDES.map((_, idx) => (
          <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
        ))}
      </div>

      <div className="flex items-center gap-3 w-full justify-center">
        {i > 0 && (
          <Button variant="ghost" size="lg" onClick={() => setI(i - 1)} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        <Button size="lg" className="px-7 h-12" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? "Quase lá" : "Continuar"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ interação */

const SAMPLE_EXPENSES = [
  { label: "iFood", value: 48 },
  { label: "Uber", value: 22 },
  { label: "Mercado", value: 137 },
  { label: "Assinatura", value: 29 },
];

/** Mini-interação: a pessoa lança gastos e vê "quanto sobra" cair na hora. */
function DemoInteraction({ onReady }: { onReady: () => void }) {
  const income = 3000;
  const [added, setAdded] = useState<number[]>([]);
  const spent = useMemo(() => added.reduce((s, idx) => s + SAMPLE_EXPENSES[idx].value, 0), [added]);
  const left = income - spent;
  const nextIdx = added.length;
  const canAdd = nextIdx < SAMPLE_EXPENSES.length;

  return (
    <Card className="w-full max-w-sm mx-auto p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quanto dá pra gastar</span>
        <Wallet className="w-4 h-4 text-accent" />
      </div>
      <motion.div
        key={left}
        initial={{ scale: 1.06 }}
        animate={{ scale: 1 }}
        className="text-4xl font-bold tracking-tight mb-4"
      >
        R$ {left.toLocaleString("pt-BR")}
      </motion.div>

      <div className="space-y-1.5 mb-4 min-h-[44px]">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Entrou</span>
          <span className="font-medium text-emerald-600">+ R$ {income.toLocaleString("pt-BR")}</span>
        </div>
        <AnimatePresence>
          {added.map((idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between text-sm"
            >
              <span className="text-muted-foreground">{SAMPLE_EXPENSES[idx].label}</span>
              <span className="font-medium text-foreground/70">− R$ {SAMPLE_EXPENSES[idx].value}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {canAdd ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const next = [...added, nextIdx];
            setAdded(next);
            if (next.length >= 1) onReady();
          }}
        >
          <Plus className="w-4 h-4" /> Lançar um gasto
        </Button>
      ) : (
        <p className="text-center text-sm text-accent font-medium py-2">É só isso. Seu mês, sempre claro. ✨</p>
      )}

      {added.length >= 1 && canAdd && (
        <p className="text-center text-xs text-muted-foreground mt-3">Viu como o saldo se ajusta na hora?</p>
      )}
    </Card>
  );
}

function DemoTutorial({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-5">
        <TrendingUp className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Experimente agora.</h2>
      <p className="text-muted-foreground leading-relaxed mb-7 max-w-sm">
        Toque em <strong>"Lançar um gasto"</strong> e veja quanto sobra mudar na hora. É assim que o CORE funciona.
      </p>
      <DemoInteraction onReady={() => setReady(true)} />
      <Button size="lg" className="px-7 h-12 mt-8" disabled={!ready} onClick={onDone}>
        Quase lá <ArrowRight className="w-4 h-4" />
      </Button>
      {!ready && <p className="text-xs text-muted-foreground mt-3">Lance pelo menos 1 gasto pra continuar</p>}
    </div>
  );
}

function MixTutorial({ onDone }: { onDone: () => void }) {
  // 2 slides curtos + 1 interação
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [ready, setReady] = useState(false);
  const mini = SLIDES.slice(0, 2);
  if (phase < 2) {
    const s = mini[phase];
    return (
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={s.key} {...fade} className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-accent/10 text-accent flex items-center justify-center mb-7">
              <s.Icon className="w-11 h-11" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">{s.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{s.subtitle}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1.5 mt-9 mb-7">
          {[0, 1, 2].map((idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === phase ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>
        <Button size="lg" className="px-7 h-12" onClick={() => setPhase((phase + 1) as 0 | 1 | 2)}>
          Continuar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Agora experimente.</h2>
      <p className="text-muted-foreground leading-relaxed mb-7 max-w-sm">
        Toque em <strong>"Lançar um gasto"</strong> e veja quanto sobra mudar na hora.
      </p>
      <DemoInteraction onReady={() => setReady(true)} />
      <Button size="lg" className="px-7 h-12 mt-8" disabled={!ready} onClick={onDone}>
        Quase lá <ArrowRight className="w-4 h-4" />
      </Button>
      {!ready && <p className="text-xs text-muted-foreground mt-3">Lance pelo menos 1 gasto pra continuar</p>}
    </div>
  );
}

/* ------------------------------------------------------------- signup */

function SignupStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Último passo
        </div>
        <h2 className="text-2xl font-bold tracking-tight leading-tight">
          Só falta 1 passo pra você<br />começar a usar o CORE.
        </h2>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (valid) onDone(); }}
        className="space-y-3"
      >
        <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Input type="email" placeholder="Seu melhor e-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Input type="password" placeholder="Crie uma senha (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <Button type="submit" size="lg" className="w-full h-12" disabled={!valid}>
          Criar minha conta <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground mt-4">
        Protótipo — aqui ainda não cria conta de verdade.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- trial */

function TrialStep() {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="w-20 h-20 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-5"
      >
        <PartyPopper className="w-10 h-10" />
      </motion.div>
      <h2 className="text-3xl font-bold tracking-tight mb-2">Você ganhou 7 dias grátis!</h2>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Acesso completo ao CORE por 7 dias. Sem cartão agora, cancele quando quiser.
      </p>
      <Card className="p-4 text-left space-y-2.5 mb-7">
        {["Tudo o que você acabou de ver, com seus dados", "Contas a vencer, metas e saúde financeira", "Cancele em 1 clique, sem burocracia"].map((b) => (
          <div key={b} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
            {b}
          </div>
        ))}
      </Card>
      <Button size="lg" className="w-full h-12" onClick={() => navigate("/financas")}>
        Aceitar e começar <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground mt-3 inline-flex items-center gap-1.5 justify-center">
        <ShieldCheck className="w-3.5 h-3.5" /> 7 dias grátis · sem compromisso
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- shell */

export default function Comecar() {
  const [variant, setVariant] = useState<Variant>("mix");
  const [step, setStep] = useState<Step>("start");

  const reset = (v: Variant) => { setVariant(v); setStep("start"); };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Seletor de protótipo (só pra comparar — sai na versão final) */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Protótipo do funil</span>
          <div className="flex items-center gap-1 text-xs">
            {(["slides", "demo", "mix"] as Variant[]).map((v) => (
              <button
                key={v}
                onClick={() => reset(v)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                  variant === v ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <AnimatePresence mode="wait">
          <motion.div key={`${variant}-${step}`} {...fade} className="w-full">
            {step === "start" && (
              <div className="flex flex-col items-center text-center max-w-md mx-auto">
                <div className="font-bold text-2xl tracking-tight mb-1">CORE<span className="text-accent">.</span></div>
                <h1 className="text-[clamp(28px,8vw,44px)] font-bold leading-[1.08] tracking-tight mt-6 mb-4 max-w-[14ch]">
                  Assuma o controle do seu dinheiro.
                </h1>
                <p className="text-muted-foreground leading-relaxed mb-9 max-w-xs">
                  Em 1 minuto você entende pra onde seu dinheiro vai — e quanto dá pra gastar.
                </p>
                <Button size="lg" className="px-10 h-12 text-base" onClick={() => setStep("tutorial")}>
                  Começar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {step === "tutorial" && variant === "slides" && <Slides onDone={() => setStep("signup")} />}
            {step === "tutorial" && variant === "demo" && <DemoTutorial onDone={() => setStep("signup")} />}
            {step === "tutorial" && variant === "mix" && <MixTutorial onDone={() => setStep("signup")} />}

            {step === "signup" && <SignupStep onDone={() => setStep("trial")} />}
            {step === "trial" && <TrialStep />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
