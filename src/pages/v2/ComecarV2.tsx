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
import { AREAS, type AreaKey, ALL_MODULE_ICONS } from "@/lib/funnel";
import { useAuth } from "@/hooks/use-auth";
import { PixCheckout, PIX_PRICES } from "@/components/paywall/PixCheckout";
import { Polvo, PolvoAvatar, PolvoEspiando, type PolvoMood } from "./Polvo";
import { Moeda, Recibo, Cedula } from "./Props";
import "./funil-v2.css";

// ---------------------------------------------------------------- constantes

type Wash = "fundo" | "rosa" | "lilas" | "pessego" | "menta" | "coral";

type StepId =
  | "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7"
  | "t8" | "t9" | "t10" | "t11" | "t12" | "t13" | "t14";

const ORDEM: StepId[] = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t14"];

const WASHES: Record<StepId, Wash> = {
  t1: "fundo", t2: "fundo", t3: "rosa", t4: "lilas", t5: "fundo", t6: "coral", t7: "menta",
  t8: "rosa", t9: "fundo", t10: "lilas", t11: "lilas", t12: "fundo", t13: "pessego", t14: "rosa",
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
  const { user } = useAuth();

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
  const [estim, setEstim] = useState<number>(salvo.estim ?? 300);
  const [vitoria, setVitoria] = useState<string | null>(salvo.vitoria ?? null);
  const [gastoTeste, setGastoTeste] = useState<number | null>(salvo.gastoTeste ?? null);
  const [pixAberto, setPixAberto] = useState(false);

  const idx = ORDEM.indexOf(step);
  const progresso = Math.round((idx / (ORDEM.length - 1)) * 100);
  const areaInfo = area ? AREAS[area] : AREAS.dinheiro;

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ step, area, dor, estim, vitoria, gastoTeste })); } catch { /* noop */ }
  }, [step, area, dor, estim, vitoria, gastoTeste]);

  useEffect(() => { track("funnel_v2_step", { step, idx }); }, [step, idx]);
  useEffect(() => { track("funnel_v2_start"); }, []);

  const avancar = useCallback(() => {
    setStep((s) => ORDEM[Math.min(ORDEM.indexOf(s) + 1, ORDEM.length - 1)]);
    window.scrollTo({ top: 0 });
  }, []);
  const voltar = useCallback(() => {
    setStep((s) => ORDEM[Math.max(ORDEM.indexOf(s) - 1, 0)]);
  }, []);

  return (
    <div className="fv2" data-wash={WASHES[step]}>
      <div className="fv2-col">
        <div className="fv2-top">
          <button className="fv2-back" onClick={voltar} disabled={idx === 0 || step === "t10" || step === "t14"} aria-label="Voltar">←</button>
          <div className="fv2-bar"><i style={{ width: `${progresso}%` }} /></div>
          <PolvoAvatar size={34} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} {...passoAnim} style={{ display: "flex", flexDirection: "column", flex: 1 }}>

            {step === "t1" && <T1Hero onEscolher={(k) => { setArea(k); track("funnel_v2_area", { area: k }); avancar(); }} />}

            {step === "t2" && (
              <QuizVivo
                pergunta="O que mais te atrapalha hoje?"
                opts={Q_DOR}
                onDone={(o) => { setDor(o.label); track("funnel_v2_answer", { q: "dor", opt: o.label }); avancar(); }}
              />
            )}

            {step === "t3" && (
              <QuizVivo
                pergunta="Como você tenta controlar hoje?"
                opts={Q_CONTROLE}
                onDone={(o) => { track("funnel_v2_answer", { q: "controle", opt: o.label }); avancar(); }}
              />
            )}

            {step === "t4" && <T4Crenca onContinuar={avancar} />}

            {step === "t5" && (
              <QuizVivo
                pergunta="Quanto você acha que escapa por mês sem você perceber?"
                opts={Q_ESTIMATIVA}
                onDone={(o) => { setEstim(o.valor ?? 300); track("funnel_v2_answer", { q: "estimativa", opt: o.label, valor: o.valor }); avancar(); }}
              />
            )}

            {step === "t6" && <T6Perda estim={estim} onContinuar={avancar} />}

            {step === "t7" && <T7Metodo onContinuar={avancar} />}

            {step === "t8" && <T8Pacto onFechado={() => { track("funnel_v2_pact"); avancar(); }} />}

            {step === "t9" && (
              <QuizVivo
                pergunta="Qual seria uma vitória real nos próximos 7 dias?"
                opts={Q_VITORIA}
                onDone={(o) => { setVitoria(o.label); track("funnel_v2_answer", { q: "vitoria", opt: o.label }); avancar(); }}
              />
            )}

            {step === "t10" && <T10Loading onPronto={avancar} />}

            {step === "t11" && <T11Mapa area={area ?? "dinheiro"} areaNome={areaInfo.nome} onContinuar={avancar} />}

            {step === "t12" && (
              <T12Demo
                onGasto={(v) => { setGastoTeste(v); track("funnel_v2_demo_expense", { valor: v }); }}
                onContinuar={avancar}
              />
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

            {step === "t14" && (
              <T14Paywall
                estim={estim}
                vitoria={vitoria}
                areaNome={areaInfo.nome}
                onCheckout={() => {
                  track("funnel_v2_checkout_click", { logged: !!user });
                  if (user) setPixAberto(true);
                  // Conta silenciosa do v2 (T15) é a próxima etapa da build.
                  // Guest segue pro funil atual pra não perder venda.
                  else navigate("/comecar");
                }}
                onEntrar={() => navigate("/entrar")}
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {pixAberto && <PixCheckout offer="lifetime" context="funnel" onClose={() => setPixAberto(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- T1 — hero + porta

function T1Hero({ onEscolher }: { onEscolher: (k: AreaKey) => void }) {
  return (
    <>
      {/* cena-colagem: card do módulo (fundo) → tag número-herói → polvo (frente) */}
      <div className="fv2-cena">
        <motion.div
          className="fv2-cena-card"
          initial={{ opacity: 0, y: 26, rotate: -2.5 }}
          animate={{ opacity: 1, y: 0, rotate: -2.5 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="head">💸 Finanças <span className="ok">EM DIA</span></div>
          <div className="fv2-nh" style={{ padding: "8px 0 6px" }}>
            <b style={{ fontSize: 26 }}>R$ 2.418</b> <span style={{ fontSize: 11.5 }}>livres este mês</span>
          </div>
          <div className="linha"><span>🛒 Mercado</span><b>−R$ 182</b></div>
          <div className="linha"><span>⚡ Luz · avisada antes</span><b className="verde">R$ 0 multa</b></div>
        </motion.div>

        <motion.div
          className="fv2-tag"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 380, damping: 20 }}
        >
          <b>R$ 417</b><span>recuperados/mês</span>
        </motion.div>

        <motion.span
          className="fv2-manuscrito"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          um braço pra<br />cada área ↘
        </motion.span>

        <span className="fv2-prop" style={{ left: 10, bottom: 6, transform: "rotate(-14deg)" }}><Moeda size={26} /></span>
        <span className="fv2-prop" style={{ left: 44, bottom: -4, transform: "rotate(9deg)" }}><Recibo size={30} /></span>

        <motion.div
          className="fv2-cena-polvo"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 240, damping: 22 }}
        >
          <Polvo mood="feliz" size={196} />
        </motion.div>
      </div>

      <h1 className="fv2-display" style={{ textAlign: "center" }}>
        Sua vida inteira. <span className="hl">Um lugar só.</span>
      </h1>
      <p className="fv2-sub" style={{ textAlign: "center", margin: "0 auto 18px", fontWeight: 700 }}>
        Escolhe por onde a gente começa:
      </p>
      <div className="fv2-opcoes">
        {EIXOS.map((k, i) => (
          <motion.button
            key={k}
            className="fv2-opcao"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + i * 0.06 }}
            onClick={() => onEscolher(k)}
          >
            <span className="emo">{AREAS[k].emoji}</span>
            {AREAS[k].label}
            <span className="seta">→</span>
          </motion.button>
        ))}
        <motion.button
          className="fv2-opcao"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 + EIXOS.length * 0.06 }}
          onClick={() => onEscolher("dinheiro")}
        >
          <span className="emo">😵‍💫</span>
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <Polvo mood={picked?.mood ?? "neutro"} size={110} />
      </div>
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

// ---------------------------------------------------------------- T7 — método

function T7Metodo({ onContinuar }: { onContinuar: () => void }) {
  const cards = [
    { emoji: "🗂️", txt: "Você joga tudo num lugar só — gasto, conta, meta." },
    { emoji: "👁️", txt: "Eu te mostro o que tá vazando, em tempo real." },
    { emoji: "⏱️", txt: "5 minutos por dia mantêm todos os pratos de pé." },
  ];
  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}><Polvo mood="feliz" size={110} /></div>
      <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 26 }}>Como isso funciona</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.txt}
            className="fv2-card"
            style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14.5, fontWeight: 600 }}
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.35, type: "spring", stiffness: 320, damping: 22 }}
          >
            <span style={{ fontSize: 24 }}>{c.emoji}</span>{c.txt}
          </motion.div>
        ))}
      </div>
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
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Polvo mood={fechado ? "festa" : "neutro"} size={150} />
      </div>
      <div className="fv2-bolha" style={{ textAlign: "center" }}>
        {fechado
          ? "Fechado! 🤝 Agora deixa eu trabalhar."
          : "5 minutos por dia. Eu cuido do resto. Fechado?"}
      </div>
      {!fechado && (
        <div className="fv2-opcoes" style={{ marginTop: 8 }}>
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

const FATOS = [
  "🎓 138 estudos (APA, 2016): registrar progresso é o maior preditor de meta atingida.",
  "🔎 A maioria só descobre assinatura esquecida quando alguém mostra o extrato.",
  "⚡ Multa e juros de conta atrasada são o gasto mais fácil de zerar: basta ser avisado antes.",
];

function T10Loading({ onPronto }: { onPronto: () => void }) {
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
    const t = setInterval(() => setFato((i) => (i + 1) % FATOS.length), 2100);
    return () => clearInterval(t);
  }, []);

  const etapas: Array<[string, number]> = [
    ["Ligando o módulo Dinheiro", 40],
    ["Posicionando seus pontos no mapa", 70],
    ["Escrevendo tua primeira missão", 96],
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}><Polvo mood="neutro" size={120} /></div>
      <h1 className="fv2-display" style={{ textAlign: "center", fontSize: 25 }}>Montando a tua central…</h1>
      <div className="fv2-num-grande" style={{ margin: "6px 0 8px", fontSize: 40 }}>{pct}%</div>
      <div className="fv2-bar" style={{ height: 10 }}><i style={{ width: `${pct}%` }} /></div>
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
          {FATOS[fato]}
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

function T12Demo({ onGasto, onContinuar }: { onGasto: (v: number) => void; onContinuar: () => void }) {
  const [fase, setFase] = useState<1 | 2 | 3>(1);
  const [valor, setValor] = useState("");
  const [gasto, setGasto] = useState<number | null>(null);

  const registrar = () => {
    const v = Math.max(1, Math.round(Number(valor.replace(",", ".")) || 34));
    setGasto(v);
    onGasto(v);
    setFase(2);
    setTimeout(() => setFase(3), 1900);
  };

  const barras = [
    { label: "Mercado", v: 120 },
    { label: "Transporte", v: 60 },
    { label: "Lazer", v: 90 },
    ...(gasto ? [{ label: "Seu teste", v: gasto, meu: true }] : []),
  ];
  const max = Math.max(...barras.map((b) => b.v), 1);

  return (
    <>
      <h1 className="fv2-display" style={{ fontSize: 25 }}>Sua central. <span className="hl">Testa ela agora.</span></h1>

      {fase === 1 && (
        <>
          <div className="fv2-bolha clara">👉 Registra um gasto de teste aqui — qualquer valor.</div>
          <input
            className="fv2-input"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, "").slice(0, 7))}
            placeholder="R$ 34"
            aria-label="Valor do gasto de teste"
          />
          <div className="fv2-rodape">
            <button className="fv2-cta" onClick={registrar}>Registrar ✍️</button>
          </div>
        </>
      )}

      {fase >= 2 && (
        <>
          <div className="fv2-bolha clara">
            {fase === 2 ? "👀 Olha ele virando gráfico na hora." : "⚡ E aqui eu te aviso do que vence amanhã."}
          </div>
          <div className="fv2-card">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120, padding: "0 4px" }}>
              {barras.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(b.v / max) * 90}px` }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    style={{
                      width: "100%", borderRadius: 8,
                      background: (b as { meu?: boolean }).meu ? "var(--magenta)" : "var(--wash-rosa)",
                    }}
                  />
                  <span style={{ fontSize: 10.5, color: "var(--tinta-2)", fontWeight: 600 }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          {fase === 3 && (
            <motion.div {...popAnim} className="fv2-feedback" style={{ marginTop: 10 }}>
              🔔 <b>Conta de luz vence amanhã</b> — avisei com um dia de folga. Multa: R$ 0.
            </motion.div>
          )}
          {fase === 3 && (
            <>
              <p className="fv2-sub" style={{ margin: "16px 0 8px", fontSize: 13.5 }}>Isso foi <b>1 dos 16</b>:</p>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
                {ALL_MODULE_ICONS.map((m) => (
                  <span key={m.label} style={{ background: "var(--card)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", boxShadow: "var(--sombra)" }}>
                    {m.emoji} {m.label}
                  </span>
                ))}
              </div>
              <div className="fv2-rodape">
                <button className="fv2-cta magenta" onClick={onContinuar}>Continuar →</button>
              </div>
            </>
          )}
        </>
      )}
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
    gastoTeste ? `✍️ Você registrou R$ ${brl(gastoTeste)} em 6 segundos` : "✍️ Sua central já calcula tudo sozinha",
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
              último gasto: R$ {brl(gastoTeste ?? 34)}<br />
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

function T14Paywall({ estim, vitoria, areaNome, onCheckout, onEntrar }: {
  estim: number; vitoria: string | null; areaNome: string;
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
        <li className="ruim">R$ {brl(anual)}/ano vazando sem você ver — sua própria conta</li>
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
