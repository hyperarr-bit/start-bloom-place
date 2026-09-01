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
import { isNativeShell } from "@/lib/native-shell";
import { anonimoLigado, ehSessaoAnonima } from "@/lib/sessao-anonima";
import { QUIZ, AREA_TRACKS, AREAS, type AreaKey } from "@/lib/funnel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  QuizScreen, ProgressScreen, RadarResultScreen, CentralScreen,
  buildQuizItems,
} from "@/pages/funis/dia14/ComecarDia14";
import { PromessasScreen, ContratoScreen } from "@/pages/funis/teste/ComecarTeste";
import { SignupScreen, ConfirmScreen, LiberandoScreen, POS_COMPRA_OAUTH_KEY } from "@/pages/funis/radar/ComecarRadar";
import { PaywallW } from "./PaywallW";
import { PaywallIOS } from "@/pages/funis/ios/PaywallIOS";
import { SignupIOS, ConfirmIOS, LiberandoIOS } from "@/pages/funis/ios/CadastroIOS";
import { ehApple } from "@/lib/loja";

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

/** Porta como PERGUNTA de quiz (30/08, dono): na web esta tela era a ENTRADA
 *  do funil (headline hero, grade de 16 ícones, "5 perguntas rápidas · sem
 *  cadastro"). Aqui ela vem DEPOIS da welcome+promessas — então veste o
 *  uniforme das outras perguntas: título de quiz + opções, e só. */
const PORTAS_W: Array<{ area: AreaKey; emoji: string; label: string }> = [
  { area: "dinheiro", emoji: "💰", label: "Meu dinheiro" },
  { area: "rotina", emoji: "📅", label: "Minha rotina e hábitos" },
  { area: "corpo", emoji: "💪", label: "Treino e alimentação" },
  { area: "metas", emoji: "🎯", label: "Minhas metas paradas" },
  { area: "dinheiro", emoji: "😵", label: "Tudo, sinceramente" },
];

/* A PORTA É A PERGUNTA 1 (31/08, bronca do dono: "deixa ela no mesmo design
 * das outras com a barra em cima"). Antes ela era uma tela avulsa, sem topo:
 * a pessoa respondia a primeira pergunta sem nenhum sinal de que o quiz tinha
 * começado, e a barra só aparecia depois — parecia outro app. Agora nasce com
 * o mesmo cabeçalho do QuizScreen, com a barra no primeiro degrau de 8.
 * O botão de voltar existe mas leva pras promessas (não há pergunta antes). */
function PortaW({ onPickArea, onBack, totalPassos }: { onPickArea: (a: AreaKey, label: string) => void; onBack: () => void; totalPassos: number }) {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-accent rounded-full" initial={false}
            animate={{ width: `${(1 / totalPassos) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
        </div>
      </div>
      <h2 className="text-[27px] font-bold tracking-tight leading-[1.15] mb-7">
        Qual área da sua vida tá mais fora de controle hoje?
      </h2>
      <div className="space-y-2.5">
        {PORTAS_W.map((o) => (
          <button
            key={o.label}
            onClick={() => onPickArea(o.area, o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border-2 border-border bg-card p-3.5 text-left hover:border-accent hover:bg-accent/[0.04] active:scale-[0.99] transition-all"
          >
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-2xl shrink-0">{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <span className="grid place-items-center w-6 h-6 rounded-full border-2 border-border group-hover:border-accent transition-colors shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Notificação NO ONBOARDING (30/08, dono: "não faz sentido depois do
 *  compromisso; tem que seguir a identidade da web e falar do que ELE
 *  escolheu"). Tela CLARA, uniforme de quiz, logo depois do diagnóstico:
 *  o resultado acabou de dizer o que o CORE vai fazer — aqui ele diz COMO
 *  te lembra disso. Copy por área, concreta. */
const LEMBRETES_W: Record<AreaKey, { titulo: string; itens: Array<{ emoji: string; t: string }> }> = {
  dinheiro: {
    titulo: "O CORE te avisa antes da conta vencer",
    itens: [
      { emoji: "💸", t: "Conta chegando no vencimento — aviso na véspera" },
      { emoji: "📊", t: "Quanto ainda dá pra gastar no mês" },
      { emoji: "🗓️", t: "Fechamento do teu mês, todo dia 1º" },
    ],
  },
  rotina: {
    titulo: "O CORE te lembra do hábito na hora certa",
    itens: [
      { emoji: "🔁", t: "Hábito do dia ainda aberto — um toque às 21h" },
      { emoji: "📅", t: "Sua agenda de amanhã, na noite anterior" },
      { emoji: "🔥", t: "Sua sequência em risco — antes de quebrar" },
    ],
  },
  corpo: {
    titulo: "O CORE te lembra do treino de hoje",
    itens: [
      { emoji: "💪", t: "Treino do dia, no seu horário" },
      { emoji: "💧", t: "Água ficando pra trás — lembrete leve" },
      { emoji: "🔥", t: "Constância em risco — antes de quebrar" },
    ],
  },
  saude: {
    titulo: "O CORE cuida dos teus lembretes de saúde",
    itens: [
      { emoji: "💧", t: "Água e sono — no ritmo que você definir" },
      { emoji: "❤️", t: "Check-in do teu dia, uma vez só" },
      { emoji: "🔥", t: "Sequência em risco — antes de quebrar" },
    ],
  },
  metas: {
    titulo: "O CORE te cobra a meta (do jeito bom)",
    itens: [
      { emoji: "🎯", t: "Check-in semanal do progresso da meta" },
      { emoji: "📈", t: "Marco batido — comemorar também importa" },
      { emoji: "🔥", t: "Semana sem avanço — cutucada gentil" },
    ],
  },
};

function NotifW({ area, onDone }: { area: AreaKey; onDone: () => void }) {
  const [indo, setIndo] = useState(false);
  const conf = LEMBRETES_W[area] ?? LEMBRETES_W.dinheiro;
  const seguir = async (pedir: boolean) => {
    if (indo) return;
    setIndo(true);
    trackEvent("funnel_click", { cta: pedir ? "notif_ativar" : "notif_pular", funil: FUNIL, area });
    if (pedir) {
      /* TETO DE 4s (31/08). O `catch` sozinho não bastava: ele cobre promise
       * REJEITADA, não promise que nunca resolve. E o plugin de permissão
       * pendura em alguns aparelhos — reproduzido no emulador, onde o diálogo
       * do Android não volta nunca. Como `indo` já desabilitou os DOIS botões
       * antes do await, o resultado era uma tela sem saída: a pessoa que pediu
       * o lembrete ficava presa no funil pra sempre, sem nem poder voltar.
       * Corre atrás do dado quando dá, mas o funil nunca espera mais que 4s. */
      const comTeto = <T,>(p: Promise<T>, ms = 4000) =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
      try {
        const { pedirPermissao, estadoPermissao } = await import("@/lib/notificacoes");
        const antes = await comTeto(estadoPermissao());
        const concedida = await comTeto(pedirPermissao());
        // "denied" prévio (reinstalação/recusa antiga) = o Android NÃO mostra
        // o diálogo nunca mais — o funil segue, e a telemetria conta quantos.
        // `concedida: null` agora significa "o aparelho não respondeu a tempo",
        // que é exatamente o caso que travava e a gente não conseguia contar.
        trackEvent("notif_permissao_funil", { funil: FUNIL, area, antes, concedida, expirou: concedida === null });
      } catch { /* nunca trava o funil */ }
    }
    onDone();
  };
  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-[24px] font-bold tracking-tight leading-[1.15] mb-2">{conf.titulo}</h2>
      <p className="text-[13px] text-muted-foreground mb-4 leading-snug">
        Organizar sozinho falha no dia 3 — por esquecimento, não por preguiça. O lembrete certo é metade do resultado.
      </p>
      <div className="space-y-2 mb-5">
        {conf.itens.map((i) => (
          <div key={i.t} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary text-lg shrink-0">{i.emoji}</span>
            <span className="font-semibold text-[13.5px] leading-snug">{i.t}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 pb-2">
        <button
          onClick={() => void seguir(true)}
          disabled={indo}
          className="w-full rounded-full py-3.5 text-[15px] font-extrabold text-white active:scale-[0.99] transition-transform disabled:opacity-60"
          style={{ background: "#16121c" }}
        >
          Quero ser lembrado
        </button>
        <button onClick={() => void seguir(false)} disabled={indo} className="w-full text-center text-[13px] text-muted-foreground py-2">
          Agora não
        </button>
      </div>
    </div>
  );
}

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
    <div className="w-full flex-1 flex flex-col pt-2">
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
  // Init preguiçoso DIRETO da URL (bug do dono 30/08: a volta da demo pintava
  // 1 frame da welcome azul antes do efeito trocar o passo — o estado já
  // nasce no passo certo e o azul nunca pinta).
  const [step, setStepCru] = useState<Step>(() => {
    try {
      const s = new URLSearchParams(window.location.search).get("step");
      if (s === "compromissos" || s === "offer" || s === "signup") return s as Step;
    } catch { /* noop */ }
    return "welcome";
  });
  const [area, setArea] = useState<AreaKey | null>(() => {
    try { const a = sessionStorage.getItem(CHAVES.area) as AreaKey | null; return a && a in AREAS ? a : null; } catch { return null; }
  });
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try { return JSON.parse(sessionStorage.getItem(CHAVES.respostas) ?? "{}"); } catch { return {}; }
  });
  const [confirmEmail, setConfirmEmail] = useState("");
  const [posCompra, setPosCompra] = useState(false);
  /* A chave de sign-in anônimo está ligada? Decide se a web vende antes de
   * cadastrar (caminho novo) ou cadastra antes de vender (caminho de 31/08).
   * Nasce `false` — o caminho antigo — e só vira `true` se o Supabase
   * confirmar. A pergunta sai no mount, muito antes do contrato, então já
   * chegou quando a resposta importa; e se não tiver chegado, o pior caso é
   * pedir cadastro a mais, nunca levar alguém a um beco sem sessão. */
  const [anonimoOk, setAnonimoOk] = useState(false);
  /* MESMO FUNIL, DOIS CANOS DE PAGAMENTO (31/08). Fora do shell da loja este
   * arquivo roda em /w e cobra por Pix; dentro do app, pela folha do Google.
   * A meta que motivou isso é ROI 2, e a conta não fecha na folha: ela paga
   * 13-27% (medido 27-31/08), cobra 15% e prende o caixa 60 dias. */
  const naWeb = !isNativeShell();
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
    // Volta do OAuth de quem JÁ PAGOU (SignupScreen grava a flag antes de
    // abrir o Google): pousa direto no liberando, nunca de volta no paywall.
    try {
      if (localStorage.getItem(POS_COMPRA_OAUTH_KEY) === "1") {
        localStorage.removeItem(POS_COMPRA_OAUTH_KEY);
        setPosCompra(true);
        setStepCru("liberando");
        return;
      }
    } catch { /* noop */ }
    // Pergunta cedo, usa tarde: a resposta só é lida no fim do contrato.
    if (naWeb) void anonimoLigado().then(setAnonimoOk);
    const s = params.get("step");
    if (s === "compromissos" || s === "offer" || s === "signup") {
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
  const itensQuiz = (() => {
    const base = areaOuPadrao === "dinheiro" ? buildQuizItems(QUIZ, "gasto") : buildQuizItems(perguntas, "consistencia");
    // Notificação ENTRE as perguntas (30/08, dono: "igual o Cal AI, que mete
    // um gráfico no meio do quiz") — entra logo depois da 2ª pergunta.
    const pos = base.findIndex((it) => it.kind === "q" && it.qIdx === 1);
    const arr = [...base];
    arr.splice((pos < 0 ? 0 : pos) + 1, 0, { kind: "extra" });
    return arr;
  })();
  const prepSteps = ["Analisando suas respostas", "Montando sua central", `Preparando o módulo de ${AREAS[areaOuPadrao].nome}`, "Finalizando seu plano personalizado"];
  const telaCheia = step === "offer" || step === "signup" || step === "confirm" || step === "liberando";

  // Faixa da status bar veste o funil (regra v83.4).
  useEffect(() => {
    const cor = step === "welcome" ? "#7ec6f6" : "#ffffff";
    try { document.documentElement.style.setProperty("--safe-top-cor", cor); } catch { /* noop */ }
    return () => { try { document.documentElement.style.removeProperty("--safe-top-cor"); } catch { /* noop */ } };
  }, [step]);

  const abrirDemo = () => {
    // Cerca da demo (v83.4): a volta converge em /funil-w?step=compromissos.
    try {
      sessionStorage.setItem("core-demo-guarda", "1");
      sessionStorage.setItem("core-demo-volta", `${window.location.pathname}?step=compromissos`);
    } catch { /* noop */ }
    const modulo = AREAS[areaOuPadrao].module;
    trackEvent("funnel_view", { step: "demo", funil: FUNIL, area: areaOuPadrao, module: modulo });
    navigate(`/preview/${modulo}?funnel=1&tour=vida&from=w`);
  };

  return (
    <div style={{ ...LIGHT_VARS, background: "#ffffff" }} className="min-h-[calc(100dvh-var(--app-safe-top,0px))] text-foreground flex flex-col">
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
        /* UNIFORME (30/08, dono: "as telas não conversavam — uma em cima,
           outra embaixo, e dava pra rolar tela que não precisa"): todo passo
           curto vive num viewport travado (h-dvh, sem scroll) com o MESMO
           topo; só resultado/central/paywall — compridos de verdade — rolam. */
        <div
          style={{ ["--util" as string]: "calc(100dvh - var(--app-safe-top, 0px))" }}
          className={`flex flex-col px-5 ${telaCheia ? "min-h-[var(--util)] pt-4 pb-7" : step === "result" || step === "central" ? "min-h-[var(--util)] pt-6 pb-8" : "h-[var(--util)] overflow-hidden pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div key={step} {...fade} className="w-full flex-1 flex flex-col">
              {step === "porta" && (
                <PortaW
                  onBack={() => setStep("promessas")}
                  totalPassos={itensQuiz.length + 1}
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
                  counterBase={1}
                  semContador
                  extraSlide={(next) => <NotifW area={areaOuPadrao} onDone={next} />}
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
              {step === "progress" && <div className="flex-1 grid place-items-center"><ProgressScreen steps={prepSteps} onDone={() => setStep("result")} /></div>}
              {step === "result" && (
                <RadarResultScreen answers={answers} area={areaOuPadrao} onDone={() => setStep("central")} />
              )}
              {step === "central" && <CentralScreen area={areaOuPadrao} onOpen={abrirDemo} />}
              {step === "compromissos" && <CompromissosPorRota area={areaOuPadrao} onDone={() => setStep("contrato")} />}
              {/* MESMA ORDEM NAS DUAS PONTAS (01/09): vende primeiro, cadastra
                  depois. Até ontem a web era obrigada a cadastrar ANTES do
                  paywall porque a função do Pix exige usuário autenticado pra
                  emitir o QR. Medido no dia: 54 assinaram o contrato e 11
                  criaram conta — o cadastro comia 80% de um tráfego 100% pago.
                  Agora o PixCheckout abre uma SESSÃO ANÔNIMA antes do QR
                  (src/lib/sessao-anonima.ts), então existe um user_id de
                  verdade e nenhuma função de dinheiro mudou. Se a chave de
                  sign-in anônimo estiver desligada no painel, o PixCheckout
                  cai no caminho antigo e pede pra entrar — por isso dá pra
                  subir isto antes de ligar a chave.

                  A PERGUNTA TEM QUE SER FEITA AQUI, não no checkout: se a
                  chave estiver desligada e a gente mandar a pessoa direto pro
                  paywall, ela só descobre que precisa de conta ao TOCAR EM
                  COMPRAR — numa tela de erro que a joga pra fora do funil.
                  Perguntando antes, a ordem antiga (cadastro → paywall) volta
                  inteira. `anonimoLigado()` falha pro lado antigo de propósito. */}
              {step === "contrato" && (
                <ContratoScreen onDone={() => setStep(naWeb && !anonimoOk ? "signup" : "offer")} />
              )}
              {/* A BIFURCAÇÃO DAS DUAS LOJAS (31/08, decisão do dono).
                  Não é um `if` de comportamento — é a escolha de QUAL ARQUIVO
                  renderizar. A partir daqui o paywall do Android e o do iPhone
                  são produtos separados: mexer num não alcança o outro, e não
                  depende de ninguém lembrar de uma condicional. */}
              {step === "offer" && (
                ehApple() ? (
                  <PaywallIOS
                    area={areaOuPadrao}
                    answers={answers}
                    onPagoSemConta={() => { setPosCompra(true); setStep("signup"); }}
                  />
                ) : (
                  <PaywallW
                    area={areaOuPadrao}
                    answers={answers}
                    naWeb={naWeb}
                    /* Pagou. No app sempre vai pro cadastro. Na web depende de
                     * QUEM é a sessão: anônima (comprou sem conta) vai pro
                     * cadastro pra ser batizada — o SignupScreen põe e-mail e
                     * senha NESSA conta, que é a dona da compra, em vez de
                     * criar outra e órfã a assinatura. Se já for conta de
                     * verdade (cadastrou antes, ou voltou logada), pedir
                     * cadastro de novo seria absurdo: vai direto liberar. */
                    onPagoSemConta={() => {
                      if (!naWeb) { setPosCompra(true); setStep("signup"); return; }
                      void ehSessaoAnonima().then((anon) => {
                        if (anon) { setPosCompra(true); setStep("signup"); }
                        else setStep("liberando");
                      });
                    }}
                  />
                )
              )}
              {/* PÓS-COMPRA: telas próprias no iPhone (01/09). Foi AQUI que
                  apareceram os 5 vazamentos do teste real — botão da Apple
                  faltando, "como você pagou", garantia de 7 dias, "o Google
                  confirma" e o botão do Google que não volta. Nenhum na tela
                  de venda; todos no que vem depois dela. Agora são arquivos
                  distintos: mexer num não alcança o outro. */}
              {step === "signup" && (
                ehApple() ? (
                  <SignupIOS
                    posCompra={posCompra}
                    onSession={() => setStep(posCompra ? "liberando" : "offer")}
                    onConfirm={(e: string) => { setConfirmEmail(e); setStep("confirm"); }}
                  />
                ) : (
                  <SignupScreen
                    posCompra={posCompra}
                    onSession={() => setStep(posCompra ? "liberando" : "offer")}
                    onConfirm={(e: string) => { setConfirmEmail(e); setStep("confirm"); }}
                  />
                )
              )}
              {step === "confirm" && (ehApple() ? <ConfirmIOS email={confirmEmail} /> : <ConfirmScreen email={confirmEmail} />)}
              {step === "liberando" && (ehApple() ? <LiberandoIOS /> : <LiberandoScreen />)}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
