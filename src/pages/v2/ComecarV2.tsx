// Funil V2 "polvo" (15/07/2026) — rota /comecar-v2, paralela e independente do
// funil atual (/comecar, intocado). Arco: dor → conversa (não formulário) →
// culpa absolvida → número DELE doendo → método nomeado → pacto → espera
// teatral → mapa computado (pico) → mão na massa → ponte "quase seu" → paywall.
// Pagamento real do CORE: Pix vitalício R$27,90 in-app (sem trial; garantia 7d).
// Eventos: todos com funnel_version: "v2". QA: ?passo=<id> pula pra qualquer tela.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import {
  AREAS, AREA_TRACKS, AREA_PROOF, AREA_ANCHOR, DOOR_AREAS, DEMO_MODULES,
  type AreaKey, type QuizQ, type QuizOpt, ALL_MODULE_ICONS,
} from "@/lib/funnel";
import { useAuth } from "@/hooks/use-auth";
import { PixCheckout, PIX_PRICES, type PixOffer } from "@/components/paywall/PixCheckout";
import { Polvo, PolvoAvatar, PolvoEspiando, TentaculoGigante, type PolvoMood } from "./Polvo";
import { Moeda, Recibo, Cedula, Lupa } from "./Props";
import "./funil-v2.css";

// ---------------------------------------------------------------- constantes

type Wash = "fundo" | "rosa" | "lilas" | "pessego" | "menta" | "coral";

type StepId =
  | "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7"
  | "t8" | "t9" | "t10" | "t11" | "t12" | "t13" | "t14"
  | "t15" | "t16" | "t17";

const ORDEM: StepId[] = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t14", "t15", "t16", "t17"];

const WASHES: Record<StepId, Wash> = {
  t1: "fundo", t2: "fundo", t3: "rosa", t4: "lilas", t5: "fundo", t6: "coral", t7: "menta",
  t8: "rosa", t9: "fundo", t10: "lilas", t11: "lilas", t12: "fundo", t13: "pessego", t14: "rosa",
  t15: "fundo", t16: "lilas", t17: "menta",
};

type Opt = { emoji: string; label: string; reacao: string; mood?: PolvoMood; valor?: number };

// T2 — a dor (pergunta do funil atual, intacta)
const Q_DOR: Opt[] = [
  { emoji: "💸", label: "Gasto sem perceber", reacao: "O gasto invisível é o pior tipo. A gente vai dar rosto pra ele." },
  { emoji: "🧾", label: "Esqueço de pagar contas", reacao: "Multa e juros são dinheiro pago pra ninguém. Isso acaba primeiro." },
  { emoji: "🐷", label: "Não consigo guardar", reacao: "Guardar não é sobra — é decisão. Vamos criar a sua." },
  { emoji: "🤷", label: "Não sei pra onde vai", reacao: "Então começamos pelo raio-X. Ninguém conserta o que não enxerga." },
];

// T3 — como controla hoje
const Q_CONTROLE: Opt[] = [
  { emoji: "📊", label: "Planilha", reacao: "Respeito. Mas planilha não te avisa nada — ela só espera você lembrar dela." },
  { emoji: "🧠", label: "De cabeça", reacao: "Cabeça é ótima pra viver, péssima pra contar. Deixa a memória comigo." },
  { emoji: "📱", label: "Já usei app, larguei", reacao: "O app não era seu — era genérico. Esse aqui nasce das suas respostas." },
  { emoji: "🙈", label: "Não controlo", reacao: "Então hoje ele te controla. Justo. Vamos inverter isso.", mood: "serio" },
];

// T5 — estimativa (combustível da T6)
const Q_ESTIMATIVA: Opt[] = [
  { emoji: "🫰", label: "Uns R$ 150/mês", reacao: "Anotado.", valor: 150 },
  { emoji: "💰", label: "Uns R$ 300/mês", reacao: "Anotado.", valor: 300 },
  { emoji: "😬", label: "Uns R$ 500/mês", reacao: "Anotado.", valor: 500 },
  { emoji: "🥵", label: "R$ 800 ou mais", reacao: "Anotado.", valor: 800 },
  { emoji: "🤷", label: "Nem imagino", reacao: "É a resposta mais comum. Vamos usar a média: R$ 300.", valor: 300 },
];

// T9 — vitória de 7 dias (alimenta T13 e o paywall)
const Q_VITORIA: Opt[] = [
  { emoji: "🔍", label: "Saber pra onde vai cada real", reacao: "Anotado. Essa é a primeira coisa que a sua central resolve." },
  { emoji: "✅", label: "Zerar contas atrasadas", reacao: "Anotado. Essa é a primeira coisa que a sua central resolve." },
  { emoji: "🐷", label: "Guardar os primeiros R$ 100", reacao: "Anotado. Essa é a primeira coisa que a sua central resolve." },
  { emoji: "📈", label: "Fechar a semana no azul", reacao: "Anotado. Essa é a primeira coisa que a sua central resolve." },
];

// ------------------------------------------------------- trilhas por área
// As PERGUNTAS são as mesmas do funil atual (AREA_TRACKS em lib/funnel.ts) —
// aqui elas só ganham a mecânica v2: reação do polvo pra cada resposta.
// Dinheiro segue com Q_DOR/Q_CONTROLE/Q_VITORIA acima, intocados.

const REACOES: Record<string, { reacao: string; mood?: PolvoMood }> = {
  // rotina — atrapalha
  "Acordo sem plano nenhum": { reacao: "Dia sem plano vira dia dos outros. Bora devolver ele pra você." },
  "Perco horas no celular": { reacao: "O celular é projetado pra ganhar de você. Precisa de um sistema do SEU lado." },
  "Começo mil coisas e não termino": { reacao: "Começar você já sabe. Falta quem cobre o fim — deixa comigo." },
  "Esqueço tarefas e compromissos": { reacao: "Sua cabeça não nasceu pra ser agenda. Deixa a memória comigo." },
  // rotina — consistência
  "Uns 3 dias": { reacao: "3 dias é exatamente onde a maioria quebra. Não é defeito seu — é falta de sistema.", mood: "serio" },
  "Uma semana": { reacao: "Uma semana na raça. Imagina com um painel marcando por você." },
  "Um mês, aí largo": { reacao: "Um mês prova que você consegue. Faltou o que segura o mês 2." },
  "Nunca consegui manter": { reacao: "Então hoje é a primeira vez com o jeito certo. Anotado.", mood: "serio" },
  // corpo — atrapalha
  "Começo a treinar e desisto": { reacao: "Desistir no escuro é fácil. Com o progresso na sua cara, fica difícil." },
  "Como mal e nem percebo": { reacao: "O 'nem percebo' é o vilão. A gente vai dar rosto pra ele." },
  "Não tenho plano de treino nem dieta": { reacao: "Esforço sem plano vaza. Vamos montar o seu." },
  "Falta constância, não vontade": { reacao: "Exato. Vontade você tem — o que falta é sistema. Isso eu resolvo." },
  // corpo — consistência
  "Essa vai ser a primeira": { reacao: "Primeira vez já com sistema. Você começa na frente de quase todo mundo." },
  "Umas 2 ou 3": { reacao: "Cada recomeço custou energia. Esse vai ser o último." },
  "Perdi a conta": { reacao: "Perdeu a conta porque nunca teve onde contar. A gente conserta isso.", mood: "serio" },
  "Tô na ativa, mas sem controle": { reacao: "Treinando no escuro. Bora acender a luz." },
  // saude — negligência
  "Beber água": { reacao: "O mais simples é o que mais se esquece. Lembrete no lugar certo resolve." },
  "Dormir direito": { reacao: "Sono ruim cobra o dia inteiro. Vamos cuidar dele primeiro." },
  "Vitaminas e remédios na hora": { reacao: "Hora certa não é memória — é sistema. Deixa comigo." },
  "Exames e check-ups": { reacao: "Adiar exame é apostar contra você. A gente marca e lembra." },
  "Um pouco de tudo": { reacao: "Normal. A gente começa pelo que muda seu dia mais rápido." },
  // saude — avisos do corpo
  "Cansaço o dia todo": { reacao: "Cansaço constante é o corpo pedindo sistema, não café.", mood: "serio" },
  "Sono ruim": { reacao: "Sono ruim derruba todo o resto. Ele vira prioridade no seu painel.", mood: "serio" },
  "Ansiedade e estresse": { reacao: "Rotina caótica alimenta isso. Ordem que você VÊ acalma.", mood: "serio" },
  "Tô bem — quero prevenir": { reacao: "A melhor hora de cuidar é antes de precisar. Respeito." },
  // metas — atrapalha
  "Ficam na cabeça, nunca no papel": { reacao: "Meta na cabeça a vida engole. A gente tira ela de lá hoje." },
  "Empolgo em janeiro, esqueço em março": { reacao: "Empolgação você tem. Falta o plano que sobrevive a março." },
  "Tenho tantas que não sei por onde começar": { reacao: "Excesso de meta também paralisa. Vamos escolher UMA." },
  "Sinto que não saio do lugar": { reacao: "Andar sem medir parece não sair do lugar. Vamos medir.", mood: "serio" },
  // metas — consistência
  "Surgiu agora": { reacao: "Recém-nascida. A melhor hora de dar um plano pra ela." },
  "Uns meses": { reacao: "Meses na fila de espera. Hoje ela sai." },
  "Mais de um ano": { reacao: "Um ano esperando. Não é falta de capacidade — é falta de plano visível.", mood: "serio" },
  "Anos… nem conto mais": { reacao: "Anos olhando ela de longe. Hoje a distância começa a cair.", mood: "serio" },
  // comum às trilhas (última opção do "atrapalha")
  "Quero organizar tudo": { reacao: "Tudo de uma vez trava. A gente começa por UM ponto — ele puxa o resto." },
};

const REACAO_VITORIA = "Anotado. Essa é a primeira coisa que a sua central resolve.";

const comReacao = (opts: QuizOpt[]): Opt[] =>
  opts.map((o) => ({ ...o, reacao: REACOES[o.label]?.reacao ?? "Anotado.", mood: REACOES[o.label]?.mood }));

const deKey = (arr: QuizQ[], key: string): QuizQ => arr.find((x) => x.key === key) ?? arr[0];

type TrilhaV2 = { dorQ: string; dorOpts: Opt[]; consistQ: string; consistOpts: Opt[]; vitoriaOpts: Opt[] };

function trilhaDe(area: AreaKey): TrilhaV2 {
  if (area === "dinheiro") {
    return {
      dorQ: "O que mais te atrapalha hoje?", dorOpts: Q_DOR,
      consistQ: "Como você tenta controlar hoje?", consistOpts: Q_CONTROLE,
      vitoriaOpts: Q_VITORIA,
    };
  }
  const t = AREA_TRACKS[area];
  const atrapalha = deKey(t, "atrapalha");
  const consistencia = deKey(t, "consistencia");
  const vitoria = deKey(t, "vitoria");
  return {
    dorQ: atrapalha.q, dorOpts: comReacao(atrapalha.opts),
    consistQ: consistencia.q, consistOpts: comReacao(consistencia.opts),
    vitoriaOpts: vitoria.opts.map((o) => ({ ...o, reacao: REACAO_VITORIA })),
  };
}

// copy por área nas telas fixas (dinheiro mantém a copy original)
const OLHO_AREA: Record<AreaKey, string> = {
  dinheiro: "Eu te mostro o vazamento em tempo real.",
  rotina: "Eu te mostro seu dia inteiro num painel só.",
  corpo: "Eu te mostro treino, dieta e progresso lado a lado.",
  saude: "Eu te mostro água, sono e remédios num painel só.",
  metas: "Eu te mostro sua meta virando passos com data.",
};

const FATO_HARKIN = "🎓 138 estudos (APA, 2016): registrar progresso é o maior preditor de meta atingida.";

const FATOS_AREA: Record<AreaKey, string[]> = {
  dinheiro: [
    FATO_HARKIN,
    "🔎 A maioria só descobre assinatura esquecida quando alguém mostra o extrato.",
    "⚡ Multa e juros de conta atrasada são o gasto mais fácil de zerar: basta ser avisado antes.",
  ],
  rotina: [
    FATO_HARKIN,
    "🔥 Quem mantém 100 dias de streak não é mais disciplinado que você — só tem onde marcar.",
    "📅 Painel que mostra o dia inteiro tira a decisão mais cansativa: \"o que eu faço agora?\"",
  ],
  corpo: [
    FATO_HARKIN,
    "🏋️ Quase ninguém desiste do treino — desiste de treinar no escuro, sem ver progresso.",
    "🥗 Treino e dieta no mesmo lugar é uma decisão a menos por dia. E decisão cansa.",
  ],
  saude: [
    FATO_HARKIN,
    "💧 Água, sono e vitaminas na hora certa: pequenos cuidados que juntos mudam o dia inteiro.",
    "🛡️ Corpo avisado cedo cobra barato. Avisado tarde, cobra caro.",
  ],
  metas: [
    FATO_HARKIN,
    "🗺️ Meta sem plano visível é só um desejo fazendo aniversário.",
    "✅ Um primeiro passo pequeno vale mais que um plano perfeito que nunca sai da cabeça.",
  ],
};

const ATIVACAO_AREA: Record<AreaKey, string[]> = {
  dinheiro: [
    "Registra seu primeiro gasto REAL (não o de exemplo)",
    "Liga o lembrete das suas contas — 2 toques",
    "Amanhã: 5 minutos. Eu te chamo. 🤝",
  ],
  rotina: [
    "Marca sua primeira tarefa REAL de amanhã",
    "Liga os lembretes do seu dia — 2 toques",
    "Amanhã: 5 minutos. Eu te chamo. 🤝",
  ],
  corpo: [
    "Registra o treino de hoje (ou monta o de amanhã)",
    "Deixa a refeição de amanhã já decidida — 2 toques",
    "Amanhã: 5 minutos. Eu te chamo. 🤝",
  ],
  saude: [
    "Registra sua água de hoje — leva 5 segundos",
    "Liga o lembrete das vitaminas — 2 toques",
    "Amanhã: 5 minutos. Eu te chamo. 🤝",
  ],
  metas: [
    "Escreve sua meta como ela é DE VERDADE",
    "Quebra ela no primeiro passo de amanhã",
    "Amanhã: 5 minutos. Eu te chamo. 🤝",
  ],
};

const LS_KEY = "fv2-state";

// eixos do mapa (T11) = as 5 áreas da porta
const EIXOS: AreaKey[] = ["dinheiro", "rotina", "corpo", "saude", "metas"];

const track = (evento: string, data: Record<string, unknown> = {}) =>
  trackEvent(evento, { funnel_version: "v2", ...data });

function soltarConfete() {
  const cores = ["#E23D7B", "#EC5FA2", "#F5C048", "#2FA968", "#F07A5A", "#33202B"];
  for (let i = 0; i < 30; i++) {
    const c = document.createElement("span");
    c.className = "fv2-conf";
    c.style.left = `${2 + Math.random() * 96}%`;
    c.style.background = cores[i % cores.length];
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    c.style.animationDuration = `${1.1 + Math.random() * 0.9}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

const passoAnim = {
  initial: { opacity: 0, x: 34 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -34 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
};

const popAnim = {
  initial: { opacity: 0, y: 14, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 420, damping: 26 },
};

const brl = (v: number) => v.toLocaleString("pt-BR");

// ---------------------------------------------------------------- página

export default function ComecarV2() {
  const navigate = useNavigate();
  const { user, isSubscribed } = useAuth();

  const salvo = useMemo(() => {
    // ?reset=1 zera o funil (QA/teste) — usuário real sempre retoma de onde parou
    if (new URLSearchParams(window.location.search).has("reset")) {
      try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
      return {};
    }
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
  }, []);

  const passoUrl = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("passo") as StepId | null;
    return p && ORDEM.includes(p) ? p : null;
  }, []);

  const [step, setStep] = useState<StepId>(passoUrl ?? (ORDEM.includes(salvo.step) ? salvo.step : "t1"));
  const [area, setArea] = useState<AreaKey | null>(salvo.area ?? null);
  const [dor, setDor] = useState<string | null>(salvo.dor ?? null);
  const [consist, setConsist] = useState<string | null>(salvo.consist ?? null);
  const [estim, setEstim] = useState<number>(salvo.estim ?? 300);
  const [vitoria, setVitoria] = useState<string | null>(salvo.vitoria ?? null);
  const [gastoTeste, setGastoTeste] = useState<number | null>(salvo.gastoTeste ?? null);
  const [pixAberto, setPixAberto] = useState(false);
  // Downsell (16/07, ordem do dono): fechou o Pix sem pagar no T16 → UMA vez,
  // o polvo corta o preço no meio (offer "downsell" = vitalício R$14,90, a
  // mesma que roda no funil atual).
  const [pixOffer, setPixOffer] = useState<PixOffer>("lifetime");
  const [downsell, setDownsell] = useState(false);
  const downsellVisto = useRef(false);

  // trilha da área escolhida (perguntas idênticas às do funil atual) e a
  // ordem dela: fora de dinheiro não existe T5 (roda de R$) — o pico T6 vem
  // direto da trilha (AREA_PROOF), como no funil atual.
  const areaKey: AreaKey = area ?? "dinheiro";
  const trilha = useMemo(() => trilhaDe(areaKey), [areaKey]);
  const ordem = useMemo(() => (areaKey === "dinheiro" ? ORDEM : ORDEM.filter((s) => s !== "t5")), [areaKey]);

  const idx = Math.max(0, ordem.indexOf(step));
  const progresso = Math.round((idx / (ordem.length - 1)) * 100);
  const areaInfo = AREAS[areaKey];

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ step, area, dor, consist, estim, vitoria, gastoTeste })); } catch { /* noop */ }
  }, [step, area, dor, consist, estim, vitoria, gastoTeste]);

  useEffect(() => { track("funnel_v2_step", { step, idx }); }, [step, idx]);
  useEffect(() => { track("funnel_v2_start"); }, []);

  const avancar = useCallback(() => {
    setStep((s) => {
      // s pode não existir na ordem da trilha (ex.: t5 salvo antes da troca de
      // área) — cai pro vizinho válido em vez de travar
      const i = ordem.indexOf(s);
      const base = i === -1 ? ordem.indexOf("t4") : i;
      return ordem[Math.min(base + 1, ordem.length - 1)];
    });
    window.scrollTo({ top: 0 });
  }, [ordem]);
  const voltar = useCallback(() => {
    setStep((s) => {
      const i = ordem.indexOf(s);
      const base = i === -1 ? ordem.indexOf("t6") : i;
      return ordem[Math.max(base - 1, 0)];
    });
  }, [ordem]);
  const irPara = useCallback((s: StepId) => { setStep(s); window.scrollTo({ top: 0 }); }, []);

  // T16: abre o Pix real ao entrar (só logado — o guest nunca chega aqui sem T15)
  useEffect(() => {
    if (step === "t16" && user) setPixAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Pagamento confirmado (use-auth repolla check-subscription): peak-end
  useEffect(() => {
    if (step === "t16" && isSubscribed) {
      setPixAberto(false);
      track("funnel_v2_paid");
      irPara("t17");
    }
  }, [step, isSubscribed, irPara]);

  return (
    <div className="fv2" data-wash={WASHES[step]}>
      <div className="fv2-col">
        <div className="fv2-top">
          <button className="fv2-back" onClick={voltar} disabled={idx === 0 || step === "t10" || step === "t14" || step === "t16" || step === "t17"} aria-label="Voltar">←</button>
          <div className="fv2-bar"><i style={{ width: `${progresso}%` }} /></div>
          <PolvoAvatar size={34} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} {...passoAnim} style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>

            {step === "t1" && <T1Hero onEscolher={(k, porta) => { setArea(k); track("funnel_v2_area", { area: k, porta: porta ?? k }); avancar(); }} />}

            {step === "t2" && (
              <QuizVivo
                pergunta={trilha.dorQ}
                opts={trilha.dorOpts}
                onDone={(o) => { setDor(o.label); track("funnel_v2_answer", { q: "dor", area: areaKey, opt: o.label }); avancar(); }}
              />
            )}

            {step === "t3" && (
              <QuizVivo
                pergunta={trilha.consistQ}
                opts={trilha.consistOpts}
                onDone={(o) => { setConsist(o.label); track("funnel_v2_answer", { q: "controle", area: areaKey, opt: o.label }); avancar(); }}
              />
            )}

            {step === "t4" && <T4Crenca onContinuar={avancar} />}

            {step === "t5" && (
              <T5Estimativa
                onDone={(v) => { setEstim(v); track("funnel_v2_answer", { q: "estimativa", valor: v }); avancar(); }}
              />
            )}

            {step === "t6" && (areaKey === "dinheiro"
              ? <T6Perda estim={estim} onContinuar={avancar} />
              : <T6PicoArea area={areaKey} consist={consist} onContinuar={avancar} />)}

            {step === "t7" && <T7Metodo area={areaKey} onContinuar={avancar} />}

            {step === "t8" && <T8Pacto onFechado={() => { track("funnel_v2_pact"); avancar(); }} />}

            {step === "t9" && (
              <QuizVivo
                pergunta="Qual seria uma vitória real nos próximos 7 dias?"
                opts={trilha.vitoriaOpts}
                onDone={(o) => { setVitoria(o.label); track("funnel_v2_answer", { q: "vitoria", area: areaKey, opt: o.label }); avancar(); }}
              />
            )}

            {step === "t10" && <T10Loading area={areaKey} areaNome={areaInfo.nome} onPronto={avancar} />}

            {step === "t11" && <T11Mapa area={area ?? "dinheiro"} areaNome={areaInfo.nome} onContinuar={avancar} />}

            {step === "t12" && (
              <T12Demo module={areaInfo.module} onContinuar={avancar} />
            )}

            {step === "t13" && (
              <T13Ponte
                area={area ?? "dinheiro"}
                areaNome={areaInfo.nome}
                gastoTeste={gastoTeste}
                vitoria={vitoria}
                onCta={() => { track("funnel_v2_ponte_cta"); avancar(); }}
              />
            )}

            {step === "t15" && (
              <T15SalvarPlano
                areaNome={areaInfo.nome}
                vitoria={vitoria}
                onSalvo={() => { track("funnel_v2_signup_success"); irPara("t16"); }}
                onEntrar={() => navigate("/entrar")}
              />
            )}

            {step === "t16" && (downsell ? (
              <T16Downsell
                onPagar={() => { setPixOffer("downsell"); setPixAberto(true); track("funnel_v2_downsell_click"); }}
                onRecusar={() => { setDownsell(false); setPixOffer("lifetime"); track("funnel_v2_downsell_dismiss"); }}
              />
            ) : (
              <T16Pix
                pixAberto={pixAberto}
                onAbrir={() => { setPixOffer("lifetime"); setPixAberto(true); }}
                onVoltar={() => irPara("t14")}
              />
            ))}

            {step === "t17" && (
              <T17Ativacao area={areaKey} areaModule={areaInfo.module} areaNome={areaInfo.nome} vitoria={vitoria} />
            )}

            {step === "t14" && (
              <T14Paywall
                area={areaKey}
                estim={estim}
                vitoria={vitoria}
                areaNome={areaInfo.nome}
                onCheckout={() => {
                  track("funnel_v2_checkout_click", { logged: !!user });
                  irPara(user ? "t16" : "t15");
                }}
                onEntrar={() => navigate("/entrar")}
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {pixAberto && (
        <PixCheckout
          offer={pixOffer}
          context="funnel"
          v2={{ mascote: <PolvoEspiando width={150} mood="feliz" />, missao: vitoria }}
          onClose={() => {
            setPixAberto(false);
            // fechou sem pagar no T16 → downsell, uma única vez
            if (step === "t16" && !isSubscribed && !downsellVisto.current) {
              downsellVisto.current = true;
              setDownsell(true);
              track("funnel_v2_downsell_view");
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- T1 — hero + porta

function T1Hero({ onEscolher }: { onEscolher: (k: AreaKey, porta?: string) => void }) {
  // Tela única (16/07, dono): hero + as 5 opções SEM scroll num iPhone —
  // cena mais baixa, polvo menor, tipografia e opções mais justas.
  return (
    <>
      {/* cena-colagem: card do módulo (fundo) → tag número-herói → polvo (frente) */}
      <div className="fv2-cena" style={{ height: 174, margin: "0 -6px 8px" }}>
        <motion.div
          className="fv2-cena-card"
          style={{ width: 222, padding: "11px 13px" }}
          initial={{ opacity: 0, y: 26, rotate: -2.5 }}
          animate={{ opacity: 1, y: 0, rotate: -2.5 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="head">💸 Finanças <span className="ok">EM DIA</span></div>
          <div className="fv2-nh" style={{ padding: "6px 0 4px" }}>
            <b style={{ fontSize: 21 }}>R$ 2.418</b> <span style={{ fontSize: 11 }}>livres este mês</span>
          </div>
          <div className="linha"><span>🛒 Mercado</span><b>−R$ 182</b></div>
          <div className="linha"><span>⚡ Luz · avisada antes</span><b className="verde">R$ 0 multa</b></div>
        </motion.div>

        <motion.div
          className="fv2-tag"
          style={{ padding: "7px 12px" }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 380, damping: 20 }}
        >
          <b style={{ fontSize: 18 }}>R$ 417</b><span>recuperados/mês</span>
        </motion.div>

        <motion.span
          className="fv2-manuscrito"
          style={{ fontSize: 17, top: 48, width: 92 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          um braço pra<br />cada área ↘
        </motion.span>

        <span className="fv2-prop" style={{ left: 10, bottom: 6, transform: "rotate(-14deg)" }}><Moeda size={24} /></span>
        <span className="fv2-prop" style={{ left: 42, bottom: -4, transform: "rotate(9deg)" }}><Recibo size={28} /></span>

        <motion.div
          className="fv2-cena-polvo"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 240, damping: 22 }}
        >
          <Polvo mood="feliz" size={124} />
        </motion.div>
      </div>

      <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 24, margin: "0 0 4px" }}>
        Sua vida inteira. <span className="hl">Um lugar só.</span>
      </h1>
      <p className="fv2-sub" style={{ textAlign: "center", margin: "0 auto 10px", fontWeight: 700, fontSize: 14 }}>
        Escolhe por onde a gente começa:
      </p>
      <div className="fv2-opcoes" style={{ gap: 7 }}>
        {/* mesma porta do funil atual: 4 áreas (saúde fica fora da porta,
            mas viva no radar/trilha) + "Tudo" caindo na trilha que mais
            converte (dinheiro) */}
        {DOOR_AREAS.map((k, i) => (
          <motion.button
            key={k}
            className="fv2-opcao"
            style={{ padding: "9px 14px", fontSize: 15 }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + i * 0.06 }}
            onClick={() => onEscolher(k)}
          >
            <span className="emo" style={{ width: 31, height: 31, borderRadius: 10, fontSize: 15 }}>{AREAS[k].emoji}</span>
            {AREAS[k].label}
            <span className="seta">→</span>
          </motion.button>
        ))}
        <motion.button
          className="fv2-opcao"
          style={{ padding: "9px 14px", fontSize: 15 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 + DOOR_AREAS.length * 0.06 }}
          onClick={() => onEscolher("dinheiro", "tudo")}
        >
          <span className="emo" style={{ width: 31, height: 31, borderRadius: 10, fontSize: 15 }}>😵‍💫</span>
          Tudo, sinceramente
          <span className="seta">→</span>
        </motion.button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- quiz vivo (T2/T3/T5/T9)

function QuizVivo({ pergunta, opts, onDone }: {
  pergunta: string;
  opts: Opt[];
  onDone: (o: Opt) => void;
}) {
  const [picked, setPicked] = useState<Opt | null>(null);

  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(() => onDone(picked), 1400);
    return () => clearTimeout(t);
  }, [picked, onDone]);

  return (
    <>
      {/* flash de wash junto com a reação */}
      {picked && (
        <div
          className="fv2-flash"
          style={{ background: picked.mood === "serio" ? "#B7A6E6" : "#A8E3C2" }}
        />
      )}
      {/* polvo descendo de cima, cortado pelo topo */}
      <motion.div
        className="fv2-pendurado"
        initial={{ y: -46, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <Polvo mood={picked?.mood ?? "neutro"} size={126} />
      </motion.div>
      {picked ? (
        <motion.div {...popAnim} className="fv2-bolha" style={{ textAlign: "center" }}>
          {picked.reacao}
        </motion.div>
      ) : (
        <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 26 }}>{pergunta}</h1>
      )}
      <div className="fv2-opcoes" style={{ marginTop: 6 }}>
        {opts.map((o) => (
          <button
            key={o.label}
            className="fv2-opcao"
            data-on={picked?.label === o.label}
            disabled={!!picked && picked.label !== o.label}
            onClick={() => { if (!picked) setPicked(o); }}
          >
            <span className="emo">{o.emoji}</span>{o.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T5 — wheel de R$

const VALORES_WHEEL = [100, 150, 200, 300, 400, 500, 700, 1000];
const ITEM_H = 56;

function T5Estimativa({ onDone }: { onDone: (v: number) => void }) {
  const [idx, setIdx] = useState(3); // começa em R$ 300
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 3 * ITEM_H });
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(VALORES_WHEEL.length - 1, Math.round(el.scrollTop / ITEM_H)));
    setIdx(i);
  };

  const v = VALORES_WHEEL[idx];
  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
        <Polvo mood="neutro" size={96} />
        <span style={{ marginTop: -20 }}><Lupa size={30} /></span>
      </div>
      <div className="fv2-bolha" style={{ textAlign: "center" }}>Quanto escapa por mês sem você perceber?</div>
      <div className="fv2-wheel-marcas">
        <div className="fv2-wheel" ref={ref} onScroll={onScroll} aria-label="Escolha um valor mensal">
          <div style={{ height: 82 }} />
          {VALORES_WHEEL.map((val, i) => (
            <div key={val} className="item" data-sel={i === idx}>
              R$ {brl(val)}{val === 1000 ? "+" : ""} <span>/mês</span>
            </div>
          ))}
          <div style={{ height: 82 }} />
        </div>
      </div>
      <motion.div key={v} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="fv2-feedback" style={{ marginTop: 10 }}>
        📉 Em 5 anos isso vira <b>R$ {brl(v * 60)}</b> — só de vazamento.
      </motion.div>
      <div className="fv2-rodape">
        <button className="fv2-cta" onClick={() => onDone(v)}>Continuar →</button>
        <button className="fv2-ghost" onClick={() => onDone(300)}>Nem imagino — usa a média (R$ 300)</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T4 — crença

function T4Crenca({ onContinuar }: { onContinuar: () => void }) {
  return (
    <>
      <h1 className="fv2-display">Não é falta de disciplina. É falta de <span className="hl">visibilidade</span>.</h1>
      <div className="fv2-card" style={{ margin: "14px 0" }}>
        <svg viewBox="0 0 260 110" style={{ width: "100%", display: "block" }}>
          {/* ioiô da força de vontade */}
          <motion.path
            d="M10 42 C28 16 38 84 58 48 C78 18 92 88 112 52 C132 22 148 84 168 56 C188 32 200 78 218 62"
            stroke="#F07A5A" strokeWidth="3.5" strokeDasharray="6 6" fill="none"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}
          />
          {/* com sistema */}
          <motion.path
            d="M10 92 C70 86 150 58 250 20"
            stroke="#E23D7B" strokeWidth="4.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.7, ease: "easeOut" }}
          />
          <motion.circle cx="250" cy="20" r="6" fill="#E23D7B"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2 }} />
          <text x="150" y="14" fontSize="11" fontWeight="700" fill="#E23D7B">com sistema</text>
          <text x="16" y="24" fontSize="11" fill="#F07A5A">na força de vontade</text>
        </svg>
      </div>
      <motion.div {...popAnim} transition={{ ...popAnim.transition, delay: 1.6 }} className="fv2-feedback">
        🎓 <b>Meta-análise de 138 estudos</b> (Harkin et al., 2016, <i>Psychological Bulletin</i>/APA):
        monitorar o próprio progresso aumenta significativamente a chance de atingir a meta — e quanto
        mais frequente o registro, maior o efeito.
      </motion.div>
      <div className="fv2-rodape">
        <button className="fv2-cta" onClick={onContinuar}>Entendi. Quero enxergar →</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T6 — matemática da perda

function T6Perda({ estim, onContinuar }: { estim: number; onContinuar: () => void }) {
  const anual = estim * 12;
  const [n, setN] = useState(0);

  useEffect(() => {
    const dur = 1800; const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(anual * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anual]);

  const branco = { color: "#fff" };
  return (
    <>
      <p className="fv2-sub" style={{ ...branco, opacity: 0.9, textAlign: "center", margin: "10px auto 2px" }}>
        R$ {brl(estim)}/mês — o número que <b>VOCÊ</b> estimou — em um ano vira:
      </p>
      <div style={{ position: "relative" }}>
        <div className="fv2-num-grande fv2-nh" style={{ textAlign: "center", margin: "10px 0 6px" }}>
          <b style={{ ...branco, fontSize: 62 }}>R$ {brl(n)}</b>
        </div>
        {/* moedas escapando */}
        <span className="fv2-moeda-voa" style={{ left: "6%", top: -14, animationDelay: "0s" }}><Moeda size={30} /></span>
        <span className="fv2-moeda-voa" style={{ right: "8%", top: -22, animationDelay: ".7s" }}><Moeda size={24} /></span>
        <span className="fv2-moeda-voa" style={{ left: "16%", bottom: -26, animationDelay: "1.2s" }}><Cedula size={36} /></span>
        <span className="fv2-moeda-voa" style={{ right: "14%", bottom: -18, animationDelay: ".4s" }}><Moeda size={20} /></span>
      </div>
      <p className="fv2-sub" style={{ ...branco, opacity: 0.9, textAlign: "center", margin: "6px auto 0" }}>
        escapando por ano. Sem nota, sem memória, sem volta.
      </p>
      {/* polvo arregalado GRANDE, cortado pela borda de baixo */}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "center", overflow: "hidden", height: 150 }}>
        <motion.div
          initial={{ y: 90 }} animate={{ y: 26 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 22 }}
        >
          <Polvo mood="arregalado" size={220} />
        </motion.div>
      </div>
      <div className="fv2-rodape" style={{ marginTop: 0, paddingTop: 12 }}>
        <button
          className="fv2-cta"
          style={{ background: "#fff", color: "var(--tinta)" }}
          onClick={onContinuar}
        >Quero ver pra onde vai →</button>
      </div>
    </>
  );
}

// ------------------------------------------- T6 (áreas) — pico da trilha
// Fora de dinheiro não tem taxímetro: o pico é o da trilha do funil atual
// (AREA_PROOF) — eco da resposta de consistência + reframe + card, no mesmo
// wash coral cor-cheia e com o mesmo polvo cortado embaixo.

function T6PicoArea({ area, consist, onContinuar }: {
  area: Exclude<AreaKey, "dinheiro">; consist: string | null; onContinuar: () => void;
}) {
  const proof = AREA_PROOF[area];
  const echo = consist ? proof.echo[consist] : undefined;
  const branco = { color: "#fff" };

  return (
    <>
      {/* espaços flexíveis acima e abaixo centralizam o bloco de texto —
          o conteúdo aqui é mais curto que o taxímetro de dinheiro */}
      <div style={{ flex: 1 }} />
      {echo && (
        <motion.p
          className="fv2-sub"
          style={{ ...branco, opacity: 0.9, textAlign: "center", margin: "10px auto 2px", fontWeight: 700 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.9, y: 0 }}
        >
          {echo}
        </motion.p>
      )}
      <motion.h1
        className="fv2-display"
        style={{ ...branco, textAlign: "center", fontSize: 29, margin: "10px 0 4px" }}
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 20 }}
      >
        {proof.reframe}
      </motion.h1>
      <motion.div
        className="fv2-card"
        style={{ margin: "12px 0 0", fontSize: 14.5, fontWeight: 600, lineHeight: 1.55 }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        {proof.card}
      </motion.div>
      <div style={{ flex: 1.2 }} />
      {/* polvo sério GRANDE, cortado pela borda de baixo (mesma cena do taxímetro) */}
      <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", height: 150 }}>
        <motion.div
          initial={{ y: 90 }} animate={{ y: 26 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 22 }}
        >
          <Polvo mood="serio" size={220} />
        </motion.div>
      </div>
      <div className="fv2-rodape" style={{ marginTop: 0, paddingTop: 12 }}>
        <button
          className="fv2-cta"
          style={{ background: "#fff", color: "var(--tinta)" }}
          onClick={onContinuar}
        >{proof.cta} →</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T7 — método

function T7Metodo({ area, onContinuar }: { area: AreaKey; onContinuar: () => void }) {
  const cards = [
    { emoji: "🗂️", txt: "Joga tudo aqui dentro.", rot: -3 },
    { emoji: "👁️", txt: OLHO_AREA[area], rot: 2.5 },
    { emoji: "⏱️", txt: "5 min por dia seguram tudo.", rot: -2 },
  ];
  return (
    <>
      <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 26 }}>Como isso funciona</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.txt}
            className="fv2-card fv2-polaroid"
            style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 15, fontWeight: 700, rotate: c.rot }}
            initial={{ opacity: 0, y: -26, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: c.rot }}
            transition={{ delay: 0.25 + i * 0.32, type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="num">{i + 1}</span>
            <span style={{ fontSize: 24 }}>{c.emoji}</span>{c.txt}
          </motion.div>
        ))}
      </div>
      {/* polvo embaixo, braços "segurando" a pilha */}
      <motion.div
        style={{ display: "flex", justifyContent: "center", marginTop: -4 }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 240, damping: 22 }}
      >
        <Polvo mood="feliz" size={128} />
      </motion.div>
      <div className="fv2-rodape">
        <button className="fv2-cta" onClick={onContinuar}>Faz sentido →</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T8 — pacto

function T8Pacto({ onFechado }: { onFechado: () => void }) {
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (!fechado) return;
    soltarConfete();
    const t = setTimeout(onFechado, 1400);
    return () => clearTimeout(t);
  }, [fechado, onFechado]);

  return (
    <>
      {fechado && <div className="fv2-flash" style={{ background: "#F0559D" }} />}
      {fechado ? (
        <motion.div
          style={{ display: "flex", justifyContent: "center" }}
          initial={{ y: 80, scale: 0.7, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <Polvo mood="festa" size={190} />
        </motion.div>
      ) : (
        /* só o braço em cena: o tentáculo entra de fora da tela, estendido */
        <motion.div
          className="fv2-tentaculo"
          initial={{ x: 120, y: 90, rotate: 12 }}
          animate={{ x: 0, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <TentaculoGigante width={320} />
        </motion.div>
      )}
      <div className="fv2-bolha" style={{ textAlign: "center", marginTop: fechado ? 10 : 90 }}>
        {fechado
          ? "Fechado! 🤝 Agora deixa eu trabalhar."
          : "5 minutos por dia. Eu cuido do resto. Fechado?"}
      </div>
      {!fechado && (
        <div className="fv2-opcoes" style={{ marginTop: 8, maxWidth: 300 }}>
          <button className="fv2-opcao" onClick={() => setFechado(true)}>
            <span className="emo">🤝</span>Fechado
          </button>
          <button className="fv2-opcao" onClick={() => setFechado(true)}>
            <span className="emo">🫱</span>Fechado, se for bem simples
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- T10 — loading teatral

function T10Loading({ area, areaNome, onPronto }: { area: AreaKey; areaNome: string; onPronto: () => void }) {
  const fatos = FATOS_AREA[area];
  const [pct, setPct] = useState(0);
  const [fato, setFato] = useState(0);
  const feito = useRef(false);

  useEffect(() => {
    // duas retas, nunca estacionado no 99
    const roteiro: Array<[number, number]> = [[300, 18], [1400, 43], [2800, 64], [4200, 82], [5400, 96], [6100, 100]];
    const timers = roteiro.map(([t, v]) => setTimeout(() => setPct(v), t));
    const fim = setTimeout(() => { if (!feito.current) { feito.current = true; onPronto(); } }, 6600);
    return () => { timers.forEach(clearTimeout); clearTimeout(fim); };
  }, [onPronto]);

  useEffect(() => {
    const t = setInterval(() => setFato((i) => (i + 1) % fatos.length), 2100);
    return () => clearInterval(t);
  }, [fatos.length]);

  const etapas: Array<[string, number]> = [
    [`Ligando o módulo ${areaNome}`, 40],
    ["Posicionando seus pontos no mapa", 70],
    ["Escrevendo sua missão de 7 dias", 96],
  ];

  return (
    <>
      {/* polvo malabarista: braços "segurando" os módulos enquanto trabalha */}
      <div className="fv2-malabar">
        <span className="mini" style={{ left: "8%", top: 6, animationDelay: "0s" }}>💸 Contas</span>
        <span className="mini" style={{ right: "6%", top: 14, animationDelay: ".8s" }}>📅 Rotina</span>
        <span className="mini" style={{ left: "16%", bottom: 4, animationDelay: "1.4s" }}>🎯 Missão</span>
        <Polvo mood="neutro" size={130} />
      </div>
      <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 25 }}>Montando a sua central…</h1>
      <div className="fv2-num-grande" style={{ margin: "6px 0 8px", fontSize: 40 }}>{pct}%</div>
      <div className="fv2-bar" style={{ height: 10, flex: "0 0 auto" }}><i style={{ width: `${pct}%` }} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "16px 0" }}>
        {etapas.map(([label, min]) => (
          <div key={label} className="fv2-prog-item" data-ok={pct >= min}>{label}</div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={fato}
          className="fv2-card"
          style={{ fontSize: 13, color: "var(--tinta-2)", lineHeight: 1.5 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {fatos[fato]}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------- T11 — mapa computado

function radarPts(vals: number[], r = 84, cx = 120, cy = 104) {
  return vals.map((v, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r * (v / 100), cy + Math.sin(a) * r * (v / 100)] as const;
  });
}

function T11Mapa({ area, areaNome, onContinuar }: { area: AreaKey; areaNome: string; onContinuar: () => void }) {
  const hoje = EIXOS.map((k, i) => (k === area ? 26 : [58, 52, 60, 55, 62][i]));
  const potencial = EIXOS.map(() => 86);
  const pHoje = radarPts(hoje);
  const pPot = radarPts(potencial);
  const grade = radarPts([100, 100, 100, 100, 100]);
  const lbl = radarPts([118, 118, 118, 118, 118]);

  return (
    <>
      <h1 className="fv2-display" style={{ fontSize: 26 }}>Seu mapa da vida, <span className="hl">computado</span>.</h1>
      <div className="fv2-card" style={{ margin: "10px 0" }}>
        <svg viewBox="0 0 240 210" style={{ width: "100%", display: "block" }}>
          {[0.33, 0.66, 1].map((f) => (
            <polygon
              key={f}
              points={radarPts([100, 100, 100, 100, 100], 84 * f).map((p) => p.join(",")).join(" ")}
              fill="none" stroke="rgba(51,32,43,.1)" strokeWidth="1"
            />
          ))}
          {grade.map((p, i) => (
            <line key={i} x1="120" y1="104" x2={p[0]} y2={p[1]} stroke="rgba(51,32,43,.08)" />
          ))}
          {/* hoje: coral, ponto a ponto */}
          {pHoje.map((p, i) => (
            <motion.circle
              key={`h${i}`} cx={p[0]} cy={p[1]} r="5" fill="#F07A5A"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.35, type: "spring", stiffness: 400, damping: 18 }}
            />
          ))}
          <motion.polygon
            points={pHoje.map((p) => p.join(",")).join(" ")}
            fill="rgba(240,122,90,.22)" stroke="#F07A5A" strokeWidth="2.5" strokeDasharray="5 4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }}
          />
          {/* potencial: rosa cheio */}
          <motion.polygon
            points={pPot.map((p) => p.join(",")).join(" ")}
            fill="rgba(226,61,123,.2)" stroke="#E23D7B" strokeWidth="3"
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 3, type: "spring", stiffness: 180, damping: 20 }}
            style={{ transformOrigin: "120px 104px" }}
          />
          {lbl.map((p, i) => (
            <text key={i} x={p[0]} y={p[1] + 4} fontSize="12" fontWeight="700" fill="#33202B" textAnchor="middle">
              {AREAS[EIXOS[i]].emoji}
            </text>
          ))}
        </svg>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 12, color: "var(--tinta-2)", marginTop: 4 }}>
          <span>▪ <span style={{ color: "#F07A5A", fontWeight: 700 }}>hoje</span></span>
          <span>▪ <span style={{ color: "#E23D7B", fontWeight: 700 }}>com o CORE</span></span>
        </div>
      </div>
      {/* placar: a nota computada (número-herói) */}
      <motion.div
        className="fv2-placar"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.4 }}
      >
        <span>Hoje <b className="de">42</b><span className="cem">/100</span></span>
        <span className="seta">→</span>
        <span>Potencial <b className="pra">86</b><span className="cem">/100</span></span>
      </motion.div>
      <motion.div {...popAnim} transition={{ ...popAnim.transition, delay: 2.4 }} className="fv2-feedback">
        📍 <b>Seu ponto de partida: {areaNome}.</b> Foi onde você disse que mais dói — o plano começa aí.
      </motion.div>
      <div className="fv2-rodape">
        <button className="fv2-cta magenta" onClick={onContinuar}>Ver minha central →</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T12 — demo guiada

// Chips de troca da demo: os módulos das áreas do quiz + dieta (par natural
// do treino) — poucos de propósito; a amplitude total fica na régua "1 dos 16".
const CHIPS_DEMO = ["financas", "rotina", "treino", "dieta", "desenvolvimento"];

function T12Demo({ module, onContinuar }: { module: string; onContinuar: () => void }) {
  // Demo = o APP REAL (decisão do dono 15/07: "o usuário se sente mais
  // confiante"). Reforma 16/07 (dono: "espremido causa percepção ruim"):
  // a moldura virou uma MINIATURA proporcional (iframe a 390px escalado — um
  // print perfeito, nada cortado) que é só porta de entrada; o teste de
  // verdade acontece em TELA CHEIA (?embed=v2 tira o cromo do preview velho).
  const [mod, setMod] = useState(module);
  const [cheia, setCheia] = useState(false);
  const [nudge, setNudge] = useState(false);
  const jaNudgou = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLIFrameElement>(null);
  const [dim, setDim] = useState({ w: 344, h: 440 });

  // Cerca da tela cheia: a seta ← do app (dentro do iframe) navega pro funil
  // VELHO (dono viu no celular, 16/07). Mesma origem → dá pra vigiar o
  // pathname e trazer de volta pro módulo em ~1 frame se sair de /preview.
  useEffect(() => {
    if (!cheia) return;
    const t = setInterval(() => {
      const win = fsRef.current?.contentWindow;
      try {
        const path = win?.location?.pathname ?? "";
        if (path && !path.startsWith("/preview/")) {
          track("funnel_v2_demo_escape", { to: path.slice(0, 60) });
          win!.location.replace(`/preview/${mod}?embed=v2`);
        }
      } catch { /* nunca cross-origin aqui; se der, deixa quieto */ }
    }, 300);
    return () => clearInterval(t);
  }, [cheia, mod]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const calc = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const escala = dim.w / 390;

  const abrirCheia = () => { setCheia(true); track("funnel_v2_demo_fullscreen", { module: mod }); };
  const fecharCheia = () => { setCheia(false); track("funnel_v2_demo_fullscreen_close", { module: mod }); };

  // o módulo da área escolhida abre primeiro e lidera a fila de chips
  const chips = useMemo(
    () => [module, ...CHIPS_DEMO.filter((k) => k !== module)],
    [module],
  );

  useEffect(() => { track("funnel_v2_demo_open", { module }); }, [module]);

  // pop-up do polvo se a pessoa ficar tempo demais explorando (dispersão):
  // uma vez só, dispensável, com o CTA de seguir em frente
  useEffect(() => {
    const t = setTimeout(() => {
      if (!jaNudgou.current) { jaNudgou.current = true; setNudge(true); track("funnel_v2_demo_nudge"); }
    }, 45000);
    return () => clearTimeout(t);
  }, []);

  const trocar = (k: string) => {
    if (k === mod) return;
    track("funnel_v2_demo_switch", { from: mod, to: k });
    setMod(k);
  };

  return (
    <>
      <h1 className="fv2-display" style={{ fontSize: 25 }}>Sua central. <span className="hl">Testa ela agora.</span></h1>
      <div className="fv2-bolha clara" style={{ marginTop: 2 }}>
        👇 Isso é o app DE VERDADE, com dados de exemplo. Toca pra abrir em tela cheia — e troca de módulo nos botões.
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
        {chips.map((k) => {
          const info = DEMO_MODULES.find((d) => d.key === k);
          if (!info) return null;
          const ativo = k === mod;
          return (
            <button
              key={k}
              onClick={() => trocar(k)}
              style={{
                background: ativo ? "var(--tinta)" : "var(--card)",
                color: ativo ? "#fff" : "var(--tinta)",
                border: "none", borderRadius: 999, padding: "8px 14px",
                fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap",
                fontFamily: "inherit", boxShadow: "var(--sombra)", cursor: "pointer",
              }}
            >
              {info.emoji} {info.label}
            </button>
          );
        })}
      </div>
      <motion.div
        className="fv2-app-frame"
        ref={frameRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* miniatura proporcional: o app renderiza a 390px (largura de celular
            real) e é escalado — print perfeito, sem nada espremido/cortado.
            Sem selo "dados de exemplo": o balão logo acima já diz isso, e o
            carimbo preto cobria o header do app (decisão do dono 16/07). */}
        <iframe
          key={mod}
          src={`/preview/${mod}?embed=v2`}
          title="Demonstração do módulo no app real"
          loading="eager"
          style={{
            width: 390, height: dim.h / escala,
            transform: `scale(${escala})`, transformOrigin: "top left",
            pointerEvents: "none", border: 0, display: "block",
          }}
        />
        <button
          onClick={abrirCheia}
          aria-label="Abrir o app em tela cheia"
          style={{ position: "absolute", inset: 0, zIndex: 3, background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
        >
          <span style={{
            position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
            background: "var(--tinta)", color: "#fff", borderRadius: 999, padding: "10px 18px",
            fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 10px 26px rgba(23,17,28,.38)",
          }}>
            Abrir em tela cheia ↗
          </span>
        </button>
      </motion.div>

      <AnimatePresence>
        {cheia && (
          <motion.div
            key="fs"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "fixed", inset: 0, zIndex: 30, background: "#fff", display: "flex", flexDirection: "column" }}
          >
            {/* a mesma barra do funil original (Preview funnel=1), com o ✕ dentro */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto",
              padding: "8px 12px", paddingTop: "max(8px, env(safe-area-inset-top))",
              background: "linear-gradient(90deg, #7c3aed, #c026d3)", color: "#fff",
            }}>
              <button
                onClick={fecharCheia}
                aria-label="Fechar tela cheia"
                style={{
                  width: 30, height: 30, borderRadius: 999, border: 0, flex: "0 0 auto",
                  background: "rgba(255,255,255,.22)", color: "#fff", fontSize: 14,
                  fontWeight: 800, cursor: "pointer", display: "grid", placeItems: "center",
                }}
              >✕</button>
              <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>
                ✨ <b>Experimente à vontade</b> — dados de exemplo.
              </span>
            </div>
            <iframe
              key={mod}
              ref={fsRef}
              src={`/preview/${mod}?embed=v2`}
              title="App em tela cheia"
              style={{ width: "100%", flex: 1, border: 0, display: "block" }}
            />
            <div style={{
              position: "fixed", left: 0, right: 0, bottom: "max(14px, env(safe-area-inset-bottom))",
              zIndex: 32, display: "flex", justifyContent: "center", pointerEvents: "none",
            }}>
              <button
                className="fv2-cta"
                style={{ pointerEvents: "auto", width: "min(360px, calc(100vw - 32px))", boxShadow: "0 14px 34px rgba(23,17,28,.4)" }}
                onClick={() => { track("funnel_v2_demo_fullscreen_continue"); onContinuar(); }}
              >
                Continuar →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {nudge && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(23,17,28,.42)", zIndex: 40 }}
            onClick={() => { setNudge(false); track("funnel_v2_demo_nudge_dismiss"); }}
          />
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            style={{
              position: "fixed", left: 0, right: 0, bottom: 16, zIndex: 41,
              width: "min(402px, calc(100% - 28px))", margin: "0 auto",
              background: "var(--card)", borderRadius: 22, padding: 18,
              boxShadow: "var(--sombra)", display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <PolvoAvatar size={38} />
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.45 }}>
                Curtiu fuçar? Isso é 1 módulo dos 16. O seu — com a SUA vida dentro — destrava em 1 minuto.
              </p>
            </div>
            <button className="fv2-cta magenta" onClick={() => { track("funnel_v2_demo_nudge_cta"); onContinuar(); }}>
              Continuar →
            </button>
            <button className="fv2-ghost" onClick={() => { setNudge(false); track("funnel_v2_demo_nudge_dismiss"); }}>
              Ainda tô testando
            </button>
          </motion.div>
        </>
      )}
      <p className="fv2-sub" style={{ margin: "12px 0 6px", fontSize: 13.5 }}>Isso foi <b>1 dos 16</b>:</p>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
        {ALL_MODULE_ICONS.map((m) => (
          <span key={m.label} style={{ background: "var(--card)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "var(--sombra)" }}>
            {m.emoji} {m.label}
          </span>
        ))}
      </div>
      <div className="fv2-rodape" style={{ paddingTop: 14 }}>
        <button className="fv2-cta magenta" onClick={abrirCheia}>Testar o app em tela cheia</button>
        <button className="fv2-ghost" onClick={onContinuar}>Continuar →</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T13 — ponte

function T13Ponte({ area, areaNome, gastoTeste, vitoria, onCta }: {
  area: AreaKey; areaNome: string; gastoTeste: number | null; vitoria: string | null;
  onCta: () => void;
}) {
  const hoje = EIXOS.map((k, i) => (k === area ? 26 : [58, 52, 60, 55, 62][i]));
  const pHoje = radarPts(hoje, 40, 60, 52);
  const recap = [
    `🗺️ Seu mapa: ${areaNome} foi onde mais doeu`,
    area === "dinheiro"
      ? (gastoTeste ? `✍️ Você registrou R$ ${brl(gastoTeste)} em 6 segundos` : "✍️ Sua central já calcula tudo sozinha")
      : `✍️ Você mexeu no módulo ${areaNome} de verdade — não era maquete`,
    vitoria ? `🎯 Sua missão escolhida: ${vitoria.toLowerCase()}` : "🎯 Sua missão dos 7 dias tá escrita",
  ];

  return (
    <>
      {/* a central em miniatura (zoom-out da demo) com o polvo espiando por cima */}
      <div className="fv2-espiada" style={{ margin: "62px auto 14px", width: "min(300px,100%)" }}>
        <motion.div
          className="fv2-polvo-borda"
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, type: "spring", stiffness: 260, damping: 22 }}
        >
          <PolvoEspiando width={168} mood="serio" />
        </motion.div>
        <motion.div
          initial={{ scale: 1.6, y: 46, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fv2-card"
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <svg viewBox="0 0 120 104" style={{ width: 96, flex: "0 0 auto" }}>
              <polygon points={radarPts([100, 100, 100, 100, 100], 40, 60, 52).map((p) => p.join(",")).join(" ")} fill="none" stroke="rgba(51,32,43,.12)" />
              <polygon points={pHoje.map((p) => p.join(",")).join(" ")} fill="rgba(240,122,90,.25)" stroke="#F07A5A" strokeWidth="2" />
            </svg>
            <div style={{ fontSize: 12.5, color: "var(--tinta-2)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--tinta)" }}>Módulo {areaNome}: ativo</b><br />
              {area === "dinheiro" ? <>último gasto: R$ {brl(gastoTeste ?? 34)}</> : <>missão dos 7 dias: escrita</>}<br />
              lembretes: ligados
            </div>
          </div>
          <div className="fv2-carimbo">Dados de exemplo</div>
        </motion.div>
      </div>

      <div className="fv2-bolha">
        Sua central tá de pé. Mas olha o carimbo… isso ainda é a vida de outra pessoa.
        A sua tá lá fora, sem ninguém segurando.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recap.map((r, i) => (
          <motion.div
            key={r}
            className="fv2-card"
            style={{ fontSize: 13.5, fontWeight: 600, padding: "12px 14px" }}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + i * 0.3, type: "spring", stiffness: 320, damping: 22 }}
          >
            {r}
          </motion.div>
        ))}
      </div>

      <div className="fv2-rodape">
        <button className="fv2-cta magenta" onClick={onCta}>Colocar minha vida no CORE</button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--tinta-2)", margin: 0 }}>
          🤝 Você fechou: 5 min/dia. Eu seguro o resto.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T14 — paywall

function T14Paywall({ area, estim, vitoria, areaNome, onCheckout, onEntrar }: {
  area: AreaKey; estim: number; vitoria: string | null; areaNome: string;
  onCheckout: () => void; onEntrar: () => void;
}) {
  const anual = estim * 12;
  return (
    <>
      {/* faixa de celebração: polvo festa cortado + headline branca */}
      <div className="fv2-faixa">
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.85 }}>
          ✓ Plano montado
        </p>
        <h1 className="fv2-display" style={{ fontSize: 30, maxWidth: "70%" }}>
          Seu plano tá pronto. Destrave ele inteiro.
        </h1>
        <div className="fv2-faixa-polvo"><Polvo mood="festa" size={140} /></div>
      </div>

      <ul className="fv2-checks" style={{ marginBottom: 16 }}>
        {area === "dinheiro" ? (
          <li className="ruim">R$ {brl(anual)}/ano vazando sem você ver — sua própria conta</li>
        ) : (
          <li className="ruim">{AREA_ANCHOR[area].pain}, {AREA_ANCHOR[area].painSub} — o preço de seguir sem sistema</li>
        )}
        <li>Módulo {areaNome} configurado pro seu caso</li>
        <li>Primeira missão: {vitoria ? vitoria.toLowerCase() : "seus 7 primeiros dias"}</li>
        <li>16 módulos inclusos — entra um por vez, no seu ritmo</li>
      </ul>
      <div className="fv2-card fv2-preco">
        <span className="tag">Acesso vitalício</span>
        <div className="fv2-preco-linha fv2-nh">
          <span className="fv2-preco-de">R$ 99,90</span>
          <b style={{ fontSize: 38, whiteSpace: "nowrap" }}>R$ {PIX_PRICES.lifetime}</b>
          <span style={{ fontSize: 12, lineHeight: 1.25 }}>uma vez,<br />seu pra sempre</span>
        </div>
        <ul className="fv2-checks">
          <li>Sem mensalidade. Sem renovação. Sem pegadinha.</li>
          <li>Todos os 16 módulos + tudo que a gente lançar</li>
        </ul>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <div className="fv2-prova"><span className="estrelas">★★★★★</span><span><b>4,8</b> · milhares de vidas organizadas</span></div>
      </div>
      <div className="fv2-rodape">
        {/* risco zero COLADO no CTA (lei 9 do BitePal: a dúvida final mora aqui) */}
        <p style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, margin: 0 }}>
          🔒 Garantia de 7 dias · Pix aprovado na hora
        </p>
        <button className="fv2-cta magenta" onClick={onCheckout}>Gerar meu Pix de R$ {PIX_PRICES.lifetime}</button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--tinta-2)", margin: 0 }}>
          🤝 Você fechou: 5 min/dia. Eu seguro o resto.
        </p>
        <button className="fv2-ghost" onClick={onEntrar}>Já tenho conta</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T15 — conta "salvar meu plano"

function T15SalvarPlano({ areaNome, vitoria, onSalvo, onEntrar }: {
  areaNome: string; vitoria: string | null;
  onSalvo: () => void; onEntrar: () => void;
}) {
  const { signUp } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { track("funnel_v2_signup_view"); }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || senha.length < 6) {
      setErro(senha.length < 6 ? "A senha precisa de 6+ caracteres." : "Confere o e-mail.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error, session } = await signUp(email.trim(), senha, nome.trim() || undefined);
    setSalvando(false);
    if (error) {
      track("funnel_v2_signup_error", { message: String(error?.message ?? "").slice(0, 120) });
      const msg = String(error?.message ?? "");
      setErro(msg.includes("already") ? "Esse e-mail já tem conta — toca em 'Já tenho conta' embaixo." : "Não deu. Confere o e-mail e tenta de novo.");
      return;
    }
    if (!session) { setErro("Confirma o e-mail que a gente te mandou e volta aqui."); return; }
    onSalvo();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "2px solid var(--linha)", borderRadius: 15, background: "var(--card)",
    fontFamily: "inherit", fontWeight: 600, fontSize: 15.5, padding: "13px 15px", color: "var(--tinta)", outline: "none",
  };

  return (
    <>
      {/* o plano DELE, montado e trancado — endowment (lei 8) */}
      <div className="fv2-card" style={{ position: "relative", marginBottom: 16 }}>
        <span className="fv2-app-selo" style={{ background: "var(--rosa)" }}>🔒 Reservado pra você</span>
        <ul className="fv2-checks" style={{ opacity: 0.75 }}>
          <li>Módulo {areaNome} configurado</li>
          <li>Missão dos 7 dias: {vitoria ? vitoria.toLowerCase() : "escrita"}</li>
          <li>16 módulos esperando</li>
        </ul>
      </div>

      <div className="fv2-bolha" style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left" }}>
        <PolvoAvatar size={30} /> <span>Onde eu te encontro? 30 segundos e o plano é seu.</span>
      </div>

      <form onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" />
        <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu melhor e-mail" aria-label="E-mail" type="email" autoComplete="email" inputMode="email" />
        <input style={inputStyle} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Cria uma senha (6+)" aria-label="Senha" type="password" autoComplete="new-password" />
        {erro && (
          <div className="fv2-feedback" style={{ background: "color-mix(in srgb, var(--coral) 14%, var(--card))" }}>
            {erro}
          </div>
        )}
        <div className="fv2-rodape" style={{ marginTop: 4, paddingTop: 8 }}>
          <button type="submit" className="fv2-cta magenta" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar meu plano →"}
          </button>
          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--tinta-2)", margin: 0 }}>
            Seus dados são só seus. Sem spam.
          </p>
          <button type="button" className="fv2-ghost" onClick={onEntrar}>Já tenho conta</button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- T16 — pagamento (polvo ansioso)

function T16Pix({ pixAberto, onAbrir, onVoltar }: {
  pixAberto: boolean; onAbrir: () => void; onVoltar: () => void;
}) {
  useEffect(() => { track("funnel_v2_pix_screen"); }, []);
  return (
    <>
      <motion.div
        style={{ display: "flex", justifyContent: "center" }}
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      >
        <Polvo mood="neutro" size={150} />
      </motion.div>
      <div className="fv2-bolha" style={{ textAlign: "center" }}>
        {pixAberto
          ? "Pagou? Seu acesso cai NA HORA — eu aviso aqui. 🐙"
          : "Seu Pix tá pronto. Pagou, o acesso libera na hora — te espero aqui."}
      </div>
      {!pixAberto && (
        <div className="fv2-rodape">
          <button className="fv2-cta magenta" onClick={onAbrir}>Abrir o Pix de R$ {PIX_PRICES.lifetime}</button>
          <button className="fv2-ghost" onClick={onVoltar}>Voltar pra oferta</button>
        </div>
      )}
    </>
  );
}

// -------------------------------------------- T16 — downsell (metade do preço)
// Fechou o Pix sem pagar: a última cartada é a mesma oferta do funil atual
// (vitalício R$14,90). Zero fricção — o desconto já vem dado, sem roleta.

function T16Downsell({ onPagar, onRecusar }: { onPagar: () => void; onRecusar: () => void }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Polvo mood="serio" size={132} />
      </div>
      <div className="fv2-bolha" style={{ textAlign: "center" }}>
        Espera. Se o preço pesou, eu corto ele <b>NO MEIO</b>. Mesmo app inteiro, mesmo vitalício.
      </div>
      <motion.div {...popAnim} className="fv2-card fv2-preco">
        <span className="tag" style={{ background: "var(--coral)" }}>Só nessa tela</span>
        <div className="fv2-preco-linha fv2-nh">
          <span className="fv2-preco-de">R$ {PIX_PRICES.lifetime}</span>
          <b style={{ fontSize: 38, whiteSpace: "nowrap" }}>R$ {PIX_PRICES.downsell}</b>
          <span style={{ fontSize: 12, lineHeight: 1.25 }}>uma vez,<br />seu pra sempre</span>
        </div>
        <ul className="fv2-checks">
          <li>Os mesmos 16 módulos, sem tirar nada</li>
          <li>Mesma garantia de 7 dias</li>
        </ul>
      </motion.div>
      <div className="fv2-rodape">
        <button className="fv2-cta magenta" onClick={onPagar}>Gerar meu Pix de R$ {PIX_PRICES.downsell}</button>
        <button className="fv2-ghost" onClick={onRecusar}>Deixa no preço normal</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- T17 — ativação (peak-end)

function T17Ativacao({ area, areaModule, areaNome, vitoria }: {
  area: AreaKey; areaModule: string; areaNome: string; vitoria: string | null;
}) {
  const navigate = useNavigate();
  useEffect(() => { soltarConfete(); track("funnel_v2_activation_view"); }, []);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}><Polvo mood="festa" size={170} /></div>
      <h1 className="fv2-display" style={{ textAlign: "center" }}>Bem-vindo à sua central! 🎉</h1>

      {/* missão ativada — barra começa em 1/7, nunca em zero (started-progress) */}
      <div className="fv2-card" style={{ marginTop: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--rosa)", margin: "0 0 6px" }}>
          🎯 Missão dos 7 dias · ativada
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>
          {vitoria ?? "Colocar sua vida em ordem"}
        </p>
        <div className="fv2-bar" style={{ height: 10, flex: "0 0 auto" }}><i style={{ width: `${100 / 7}%` }} /></div>
        <p style={{ fontSize: 12, color: "var(--tinta-2)", margin: "6px 0 0" }}>
          Dia 1 de 7 — montar o plano JÁ contou. O resto é comigo e com você.
        </p>
      </div>

      <ul className="fv2-checks" style={{ margin: "16px 0 0" }}>
        {ATIVACAO_AREA[area].map((linha) => <li key={linha}>{linha}</li>)}
      </ul>

      <div className="fv2-rodape">
        <button
          className="fv2-cta verde"
          onClick={() => { track("funnel_v2_activation_start"); navigate(`/${areaModule}`); }}
        >Começar meus 5 minutos no {areaNome} →</button>
      </div>
    </>
  );
}
