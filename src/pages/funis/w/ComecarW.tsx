/**
 * FUNIL W (29/08, desenho do dono): o funil da WEB que dava ROI, dentro do
 * app, com as adições que o APP provou. Passo a passo e a origem de cada tela:
 *
 *   welcome     → grade viva azul do app (AppWelcome)
 *   promessas   → 3 telas rápidas BitePal (app)
 *   porta       → "Um app pra vida inteira. Qual área tá fora de controle?"
 *                 (web dia14 vitrine) — define a ROTA de tudo que segue
 *   quiz        → perguntas da web (QUIZ finanças / AREA_TRACKS por área)
 *   progress    → loading teatral (web)
 *   result      → diagnóstico da área (web, RadarResultScreen)
 *   central     → 16 módulos → abre a DEMO REAL (/preview do módulo da rota)
 *   compromissos→ volta da demo: Claro!×3 POR ROTA (app/Me+, perguntas novas)
 *   contrato    → assinatura no dedo (app/Me+)
 *   notif       → UMA tela só, copy premissa-dia14, pós-contrato
 *   offer       → PaywallW (layout web @ 97,90 vitalício, motor RC do app)
 *   signup      → cadastro DEPOIS de pagar (v48) → liberando
 *
 * O que a web tinha e MORREU aqui de propósito: criar-conta pré-paywall (no
 * app a conta nasce depois do pagamento) e a prova social no meio do quiz
 * (a web que dava ROI rodava com ela desligada; a prova mora no mural).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppWelcome } from "@/components/app/AppWelcome";
import { trackEvent } from "@/lib/analytics";
import { QUIZ, AREA_TRACKS, AREAS, type AreaKey } from "@/lib/funnel";
import {
  VitrineStartScreen, QuizScreen, ProgressScreen, RadarResultScreen, CentralScreen,
  buildQuizItems,
} from "@/pages/funis/dia14/ComecarDia14";
import { PromessasScreen, ContratoScreen, NotifScreen } from "@/pages/funis/teste/ComecarTeste";
import { SignupScreen, ConfirmScreen, LiberandoScreen } from "@/pages/funis/radar/ComecarRadar";
import { PaywallW } from "./PaywallW";

const FUNIL = "w";

type Step =
  | "welcome" | "promessas" | "porta" | "quiz" | "progress" | "result"
  | "central" | "compromissos" | "contrato" | "notif" | "offer"
  | "signup" | "confirm" | "liberando";

// Tema claro fixo (o funil da web roda claro, doa o que doer o tema do sistema).
const LIGHT_VARS = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 15%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "40 20% 96%",
  "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%",
  "--muted-foreground": "0 0% 45%",
  "--accent": "330 65% 50%",
  "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "0 0% 20%",
} as CSSProperties;

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

/** Claro!×3 POR ROTA (pedido do dono: "elas têm que mudar de acordo com a
 *  escolha da rota"). A pergunta 1 é a dor da área; 2 e 3 sobem o degrau. */
const COMPROMISSOS_POR_AREA: Record<AreaKey, Array<{ emoji: string; p: string }>> = {
  dinheiro: [
    { emoji: "💸", p: "Você quer saber pra onde seu dinheiro vai?" },
    { emoji: "📅", p: "Quer parar de esquecer conta e pagar juros?" },
    { emoji: "🚀", p: "Topa fechar o mês no azul?" },
  ],
  rotina: [
    { emoji: "🗓️", p: "Você quer um dia que se organiza sozinho?" },
    { emoji: "🔁", p: "Quer construir hábitos que ficam?" },
    { emoji: "🚀", p: "Topa manter a constância por 30 dias?" },
  ],
  corpo: [
    { emoji: "💪", p: "Você quer treinar com progresso de verdade?" },
    { emoji: "🥗", p: "Quer dieta e treino no mesmo lugar?" },
    { emoji: "🚀", p: "Topa cuidar do corpo sem depender de motivação?" },
  ],
  saude: [
    { emoji: "❤️", p: "Você quer cuidar da sua saúde todo dia?" },
    { emoji: "😴", p: "Quer dormir e beber água como gente grande?" },
    { emoji: "🚀", p: "Topa virar sua versão mais saudável?" },
  ],
  metas: [
    { emoji: "🎯", p: "Você quer tirar suas metas do papel?" },
    { emoji: "🧭", p: "Quer ver seu progresso toda semana?" },
    { emoji: "🚀", p: "Topa virar sua melhor versão?" },
  ],
};

function CompromissosPorRota({ area, onDone }: { area: AreaKey; onDone: () => void }) {
  const PERGUNTAS = COMPROMISSOS_POR_AREA[area] ?? COMPROMISSOS_POR_AREA.dinheiro;
  const [i, setI] = useState(0);
  const responder = (sim: boolean) => {
    trackEvent("funnel_quiz_answer", { step: `compromisso_${i + 1}`, answer: sim ? "claro" : "nao", area, funil: FUNIL });
    if (i >= PERGUNTAS.length - 1) onDone();
    else setI(i + 1);
  };
  const q = PERGUNTAS[i];
  return (
    <div className="w-full flex-1 flex flex-col pt-2 min-h-[70vh]">
      <AnimatePresence mode="wait">
        <motion.div
          key={q.p}
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.24 }}
          className="flex-1 flex flex-col"
        >
          <div className="flex-1 grid place-items-center">
            <div className="text-center px-4">
              <div className="text-[64px] leading-none mb-5">{q.emoji}</div>
              <h1 className="text-[26px] font-black tracking-[-0.02em] leading-tight">{q.p}</h1>
              <div className="flex justify-center gap-1.5 mt-5">
                {PERGUNTAS.map((_, k) => (
                  <span key={k} className={`w-2 h-2 rounded-full ${k <= i ? "bg-accent" : "bg-black/10"}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="pb-1 space-y-2.5">
            <button
              onClick={() => responder(true)}
              className="w-full rounded-full py-4 text-[16px] font-extrabold text-white active:scale-[0.99] transition-transform"
              style={{ background: "#16121c" }}
            >
              Claro!
            </button>
            <button onClick={() => responder(false)} className="w-full text-center text-[13px] text-muted-foreground py-2">
              Não
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const CHAVES = {
  area: "core-funil-w-area",
  respostas: "core-funil-w-respostas",
  passo: "core-funil-w-passo",
} as const;

export default function ComecarW() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStepCru] = useState<Step>("welcome");
  const [area, setArea] = useState<AreaKey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmEmail, setConfirmEmail] = useState("");
  const [posCompra, setPosCompra] = useState(false);
  const montou = useRef(false);

  const setStep = (s: Step) => {
    setStepCru(s);
    try { sessionStorage.setItem(CHAVES.passo, s); } catch { /* noop */ }
    trackEvent("funnel_view", { step: s === "porta" ? "start" : s, funil: FUNIL, ...(area ? { area } : {}) });
    window.scrollTo(0, 0);
  };

  // Retomada: volta da DEMO cai em ?step=compromissos (mesma mecânica do /app);
  // pós-OAuth e estados persistidos seguem a whitelist curta.
  useEffect(() => {
    if (montou.current) return;
    montou.current = true;
    try {
      const a = sessionStorage.getItem(CHAVES.area) as AreaKey | null;
      if (a && a in AREAS) setArea(a);
      const r = sessionStorage.getItem(CHAVES.respostas);
      if (r) setAnswers(JSON.parse(r));
    } catch { /* noop */ }
    const s = params.get("step");
    if (s === "compromissos" || s === "offer" || s === "signup") {
      setStepCru(s as Step);
      trackEvent("funnel_view", { step: s, funil: FUNIL, retomada: true });
    } else {
      trackEvent("funnel_view", { step: "welcome", funil: FUNIL });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = (a: AreaKey | null, r: Record<string, string>) => {
    try {
      if (a) sessionStorage.setItem(CHAVES.area, a);
      sessionStorage.setItem(CHAVES.respostas, JSON.stringify(r));
    } catch { /* noop */ }
  };

  const areaOuPadrao: AreaKey = area ?? "dinheiro";
  // Mesma derivação do dia14 em modo vitrine: dinheiro = QUIZ completo com a
  // prova de gasto embutida; outras áreas = trilha própria com o pico após a
  // pergunta de consistência.
  const perguntas = areaOuPadrao === "dinheiro" ? QUIZ : AREA_TRACKS[areaOuPadrao as Exclude<AreaKey, "dinheiro">];
  const itensQuiz = areaOuPadrao === "dinheiro" ? buildQuizItems(QUIZ, "gasto") : buildQuizItems(perguntas, "consistencia");
  const prepSteps = ["Analisando suas respostas", "Montando sua central", `Preparando o módulo de ${AREAS[areaOuPadrao].nome}`, "Finalizando seu plano personalizado"];
  const telaCheia = step === "offer" || step === "signup" || step === "confirm" || step === "liberando";

  // Faixa da status bar veste o funil (regra v83.4). Notif é tela escura.
  useEffect(() => {
    const cor = step === "welcome" ? "#7ec6f6" : step === "notif" ? "#16121c" : "#ffffff";
    try { document.documentElement.style.setProperty("--safe-top-cor", cor); } catch { /* noop */ }
    return () => { try { document.documentElement.style.removeProperty("--safe-top-cor"); } catch { /* noop */ } };
  }, [step]);

  const abrirDemo = () => {
    // Cerca da demo (v83.4): a volta converge em /funil-w?step=compromissos.
    try {
      sessionStorage.setItem("core-demo-guarda", "1");
      sessionStorage.setItem("core-demo-volta", "/funil-w?step=compromissos");
    } catch { /* noop */ }
    const modulo = AREAS[areaOuPadrao].module;
    trackEvent("funnel_view", { step: "demo", funil: FUNIL, area: areaOuPadrao, module: modulo });
    navigate(`/preview/${modulo}?funnel=1&tour=vida&from=w`);
  };

  return (
    <div style={{ ...LIGHT_VARS, background: "#ffffff" }} className="min-h-dvh text-foreground flex flex-col">
      <AnimatePresence>
        {step === "welcome" && (
          <motion.div key="welcome" exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <AppWelcome
              onComecar={() => setStep("promessas")}
              onEntrar={() => navigate("/auth")}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {step === "promessas" && <PromessasScreen onDone={() => setStep("porta")} />}

      {step !== "welcome" && step !== "promessas" && (
        <div className={`flex-1 flex flex-col ${telaCheia ? "px-5 pt-4 pb-7" : "items-center justify-center px-5 py-10"}`}>
          <AnimatePresence mode="wait">
            <motion.div key={step} {...fade} className="w-full flex-1 flex flex-col">
              {step === "porta" && (
                <VitrineStartScreen
                  onPickArea={(a, label) => {
                    setArea(a);
                    const r = { ...answers, area: a, area_label: label };
                    setAnswers(r);
                    guardar(a, r);
                    trackEvent("funnel_quiz_answer", { step: "porta", answer: label, funil: FUNIL });
                    setStep("quiz");
                  }}
                />
              )}
              {step === "quiz" && (
                <QuizScreen
                  questions={perguntas}
                  items={itensQuiz}
                  initialAnswers={answers}
                  proofArea={areaOuPadrao === "dinheiro" ? undefined : areaOuPadrao}
                  onBack={() => setStep("porta")}
                  onDone={(r: Record<string, string>) => {
                    const todas = { ...answers, ...r };
                    setAnswers(todas);
                    guardar(area, todas);
                    setStep("progress");
                  }}
                />
              )}
              {step === "progress" && <ProgressScreen steps={prepSteps} onDone={() => setStep("result")} />}
              {step === "result" && (
                <RadarResultScreen answers={answers} area={areaOuPadrao} onDone={() => setStep("central")} />
              )}
              {step === "central" && <CentralScreen area={areaOuPadrao} onOpen={abrirDemo} />}
              {step === "compromissos" && <CompromissosPorRota area={areaOuPadrao} onDone={() => setStep("contrato")} />}
              {step === "contrato" && <ContratoScreen onDone={() => setStep("notif")} />}
              {/* NotifScreen foi desenhada pra fundo GRAFITE (tela escura do
                  funil do app) — aqui ela ganha o palco escuro dela. */}
              {step === "notif" && (
                <div className="fixed inset-0 z-[5] overflow-y-auto flex flex-col px-5 py-10" style={{ background: "#16121c" }}>
                  <NotifScreen area={areaOuPadrao} hora={null} onDone={() => setStep("offer")} />
                </div>
              )}
              {step === "offer" && (
                <PaywallW
                  area={areaOuPadrao}
                  answers={answers}
                  onPagoSemConta={() => { setPosCompra(true); setStep("signup"); }}
                />
              )}
              {step === "signup" && (
                <SignupScreen
                  posCompra={posCompra}
                  onSession={() => setStep(posCompra ? "liberando" : "offer")}
                  onConfirm={(e: string) => { setConfirmEmail(e); setStep("confirm"); }}
                />
              )}
              {step === "confirm" && <ConfirmScreen email={confirmEmail} />}
              {step === "liberando" && <LiberandoScreen />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
