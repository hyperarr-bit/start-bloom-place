// Funil V2 (15/07/2026) — rota /comecar-v2, paralela e independente do funil
// atual (/comecar segue intocado). Blueprint BitePal: promessa → área →
// mascote nomeado → quiz-conversa com feedback → meta realista → labor
// illusion → plano com confete → paywall Pix vitalício.
// Eventos: todos com funnel_version: "v2".
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { AREAS, type AreaKey, ALL_MODULE_ICONS } from "@/lib/funnel";
import { useAuth } from "@/hooks/use-auth";
import { PixCheckout, PIX_PRICES } from "@/components/paywall/PixCheckout";
import { Joao, JoaoAvatar, Casinha, Ninho } from "./Joao";
import "./funil-v2.css";

// ---------------------------------------------------------------- constantes

type Wash = "areia" | "menta" | "lilas" | "pessego" | "banana";

type StepId =
  | "promessa1" | "promessa2"
  | "area"
  | "ninho" | "batismo"
  | "q1" | "q2" | "q3" | "q4"
  | "prova" | "meta"
  | "montando" | "plano"
  | "paywall";

const ORDEM: StepId[] = [
  "promessa1", "promessa2", "area", "ninho", "batismo",
  "q1", "q2", "q3", "q4", "prova", "meta", "montando", "plano", "paywall",
];

const WASHES: Record<StepId, Wash> = {
  promessa1: "areia", promessa2: "menta", area: "areia",
  ninho: "banana", batismo: "banana",
  q1: "areia", q2: "menta", q3: "areia", q4: "lilas",
  prova: "lilas", meta: "lilas", montando: "menta", plano: "banana", paywall: "pessego",
};

// casinha constrói junto com o funil (0..4)
const CASA_STAGE: Record<StepId, number> = {
  promessa1: 0, promessa2: 0, area: 0, ninho: 0, batismo: 1,
  q1: 1, q2: 2, q3: 2, q4: 3, prova: 3, meta: 3, montando: 3, plano: 4, paywall: 4,
};

const NOMES_SORTEIO = ["Chico", "Barro", "Juca", "Nina", "Bento", "Zeca", "Dora", "Caco"];

type QuizQ = {
  id: "q1" | "q2" | "q3" | "q4";
  pergunta: string;
  opts: Array<{ emoji: string; label: string }>;
  // feedback devolvido na hora — a razão dado/recebido do BitePal
  feedback: (opt: string, nome: string) => string;
};

const QUIZ: QuizQ[] = [
  {
    id: "q1",
    pergunta: "O que mais te trava hoje?",
    opts: [
      { emoji: "🌀", label: "Começo e largo no meio" },
      { emoji: "🧭", label: "Não sei por onde começar" },
      { emoji: "🤯", label: "Esqueço das coisas" },
      { emoji: "⏰", label: "Falta de tempo" },
    ],
    feedback: () => "Anotado. Essa é a trava mais comum de quem chega aqui — e é a que o plano resolve primeiro.",
  },
  {
    id: "q2",
    pergunta: "Quanto tempo por dia você consegue dar pra isso?",
    opts: [
      { emoji: "⚡", label: "5 minutos" },
      { emoji: "☕", label: "15 minutos" },
      { emoji: "🧘", label: "30 minutos ou mais" },
    ],
    feedback: (opt, nome) =>
      opt === "5 minutos"
        ? `Perfeito — o ${nome} monta o plano em passos de 5 minutos. Constância vale mais que maratona.`
        : `Ótimo. Com esse tempo o ${nome} consegue montar um plano com folga.`,
  },
  {
    id: "q3",
    pergunta: "Você já tentou se organizar antes?",
    opts: [
      { emoji: "📝", label: "Planilha ou caderno" },
      { emoji: "📱", label: "Outro app, mas larguei" },
      { emoji: "🆕", label: "Nunca tentei de verdade" },
    ],
    feedback: () => "Boa notícia: quem já tentou e largou não falhou — só usou ferramenta genérica demais. O plano aqui é montado pra você.",
  },
  {
    id: "q4",
    pergunta: "Como você prefere começar?",
    opts: [
      { emoji: "🪜", label: "Um passo por dia" },
      { emoji: "🚀", label: "Tudo de uma vez" },
      { emoji: "🤲", label: "Me guiando devagar" },
    ],
    feedback: (_o, nome) => `Fechou. Última coisa e o ${nome} termina a casa — e o seu plano.`,
  },
];

const REVIEWS = [
  { nome: "Mariana", texto: "Eu já tinha desistido de planilha, de agenda, de tudo. Aqui foi a primeira vez que uma rotina durou mais de uma semana." },
  { nome: "Rafael", texto: "Paguei achando que ia largar em 3 dias. Tô no terceiro mês e a fatura do cartão nunca mais me surpreendeu." },
  { nome: "Camila", texto: "O que me ganhou foi ser tudo num app só. Organizei as finanças e acabei arrumando a rotina inteira junto." },
];

const LS_KEY = "fv2-state";

// ---------------------------------------------------------------- utilitários

const track = (evento: string, data: Record<string, unknown> = {}) =>
  trackEvent(evento, { funnel_version: "v2", ...data });

function dataMeta21d(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function soltarConfete() {
  const cores = ["#2E9E52", "#E4572E", "#F2C14E", "#8FB8DA", "#B4652F", "#26201A"];
  for (let i = 0; i < 34; i++) {
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

// animação padrão entre passos
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

// ---------------------------------------------------------------- página

export default function ComecarV2() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const salvo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
  }, []);

  // ?passo=<id> pula direto pra uma tela (QA/preview) — tem prioridade sobre o estado salvo
  const passoUrl = useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("passo") as StepId | null;
    return p && ORDEM.includes(p) ? p : null;
  }, []);

  const [step, setStep] = useState<StepId>(passoUrl ?? (ORDEM.includes(salvo.step) ? salvo.step : "promessa1"));
  const [nome, setNome] = useState<string>(salvo.nome ?? "");
  const [area, setArea] = useState<AreaKey | null>(salvo.area ?? null);
  const [respostas, setRespostas] = useState<Record<string, string>>(salvo.respostas ?? {});
  const [pixAberto, setPixAberto] = useState(false);

  const idx = ORDEM.indexOf(step);
  const progresso = Math.round((idx / (ORDEM.length - 1)) * 100);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ step, nome, area, respostas })); } catch { /* noop */ }
  }, [step, nome, area, respostas]);

  useEffect(() => { track("funnel_v2_step", { step, idx }); }, [step, idx]);
  useEffect(() => { track("funnel_v2_start"); }, []);

  const avancar = useCallback(() => {
    setStep((s) => ORDEM[Math.min(ORDEM.indexOf(s) + 1, ORDEM.length - 1)]);
    window.scrollTo({ top: 0 });
  }, []);
  const voltar = useCallback(() => {
    setStep((s) => ORDEM[Math.max(ORDEM.indexOf(s) - 1, 0)]);
  }, []);

  const areaInfo = area ? AREAS[area] : null;

  return (
    <div className="fv2" data-wash={WASHES[step]}>
      <div className="fv2-col">
        <div className="fv2-top">
          <button className="fv2-back" onClick={voltar} disabled={idx === 0 || step === "paywall"} aria-label="Voltar">←</button>
          <div className="fv2-bar"><i style={{ width: `${progresso}%` }} /></div>
          <Casinha stage={CASA_STAGE[step]} size={44} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} {...passoAnim} style={{ display: "flex", flexDirection: "column", flex: 1 }}>

            {step === "promessa1" && (
              <>
                <h1 className="fv2-display">Sua vida inteira organizada. <span className="hl">Num app só.</span></h1>
                <p className="fv2-sub">Finanças, rotina, casa, saúde e mais 12 áreas — com um plano montado pra você em 2 minutos.</p>
                <div style={{ display: "flex", justifyContent: "center", margin: "26px 0" }}><Joao mood="feliz" size={170} /></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {ALL_MODULE_ICONS.slice(0, 8).map((m) => (
                    <span key={m.label} style={{ background: "var(--card)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 500, boxShadow: "var(--sombra)" }}>
                      {m.emoji} {m.label}
                    </span>
                  ))}
                </div>
                <div className="fv2-rodape">
                  <button className="fv2-cta" onClick={avancar}>Começar →</button>
                  <button className="fv2-ghost" onClick={() => navigate("/entrar")}>Já tenho conta</button>
                </div>
              </>
            )}

            {step === "promessa2" && (
              <>
                <h1 className="fv2-display">Do caos pro controle em <span className="hl">21 dias</span>.</h1>
                <p className="fv2-sub">Sem força de vontade infinita: um plano com passos pequenos, na ordem certa.</p>
                <div className="fv2-card" style={{ margin: "24px 0" }}>
                  <svg viewBox="0 0 260 110" style={{ width: "100%", display: "block" }}>
                    <path d="M10 18 C70 30 100 78 250 92" stroke="#E4572E" strokeWidth="3.5" strokeDasharray="6 6" fill="none" />
                    <path d="M10 18 C60 90 140 96 250 40" stroke="#2E9E52" strokeWidth="4.5" fill="none" strokeLinecap="round" />
                    <circle cx="250" cy="40" r="6" fill="#2E9E52" />
                    <text x="176" y="26" fontSize="11" fontWeight="700" fill="#2E9E52">com um plano</text>
                    <text x="150" y="105" fontSize="11" fill="#8a8073">na força de vontade</text>
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tinta-2)", marginTop: 6 }}>
                    <span>hoje</span><span>{dataMeta21d()}</span>
                  </div>
                </div>
                <div className="fv2-rodape"><button className="fv2-cta" onClick={avancar}>Continuar →</button></div>
              </>
            )}

            {step === "area" && (
              <>
                <h1 className="fv2-display">Qual área tá pedindo socorro primeiro?</h1>
                <p className="fv2-sub" style={{ marginBottom: 18 }}>O plano começa por ela — as outras entram depois.</p>
                <div className="fv2-grid2">
                  {(Object.keys(AREAS) as AreaKey[]).map((k) => (
                    <button
                      key={k}
                      className="fv2-opcao"
                      data-on={area === k}
                      onClick={() => { setArea(k); track("funnel_v2_area", { area: k }); }}
                    >
                      <span className="emo">{AREAS[k].emoji}</span>
                      {AREAS[k].nome}
                    </button>
                  ))}
                </div>
                <div className="fv2-rodape">
                  <button className="fv2-cta" disabled={!area} onClick={avancar}>Continuar →</button>
                </div>
              </>
            )}

            {step === "ninho" && (
              <NinhoStep onRevelar={avancar} />
            )}

            {step === "batismo" && (
              <>
                <h1 className="fv2-display">Ele constrói a própria casa. E agora vai construir a sua.</h1>
                <p className="fv2-sub">É um joão-de-barro — o passarinho arquiteto. Dá um nome pra ele:</p>
                <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 8px" }}><Joao mood="feliz" size={130} /></div>
                <input
                  className="fv2-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value.slice(0, 14))}
                  placeholder="Nome do passarinho"
                  aria-label="Nome do passarinho"
                />
                <button
                  className="fv2-ghost"
                  onClick={() => setNome(NOMES_SORTEIO[Math.floor(Math.random() * NOMES_SORTEIO.length)])}
                >🎲 Sortear um nome</button>
                <div className="fv2-rodape">
                  <button
                    className="fv2-cta"
                    disabled={nome.trim().length < 2}
                    onClick={() => { track("funnel_v2_pet_named", { nome }); avancar(); }}
                  >É esse! →</button>
                </div>
              </>
            )}

            {(step === "q1" || step === "q2" || step === "q3" || step === "q4") && (
              <QuizStep
                key={step}
                q={QUIZ.find((q) => q.id === step)!}
                nome={nome || "João"}
                selecionada={respostas[step]}
                onResponder={(opt) => setRespostas((r) => ({ ...r, [step]: opt }))}
                onContinuar={avancar}
              />
            )}

            {step === "prova" && (
              <>
                <div className="fv2-bolha"><JoaoAvatar /> <span>Sabe por que plano montado funciona e força de vontade não?</span></div>
                <h1 className="fv2-display">Constância vem de <span className="hl">passo pequeno</span>, não de motivação.</h1>
                <p className="fv2-sub">Por isso o seu plano começa com uma única ação por dia na área de {areaInfo?.nome.toLowerCase() ?? "foco"} — e cresce só quando você tá pronto.</p>
                <motion.div {...popAnim} className="fv2-feedback verde" style={{ marginTop: 18 }}>
                  🏗️ <b>A casa já tá quase de pé.</b> Falta pouco pro seu plano ficar pronto.
                </motion.div>
                <div className="fv2-rodape"><button className="fv2-cta" onClick={avancar}>Continuar →</button></div>
              </>
            )}

            {step === "meta" && (
              <>
                <h1 className="fv2-display">
                  Colocar {areaInfo ? `${areaInfo.emoji} ${areaInfo.nome.toLowerCase()}` : "sua vida"} em ordem até <span className="hl">{dataMeta21d()}</span>{" "}
                  <span className="fv2-selo">✓ Realista</span>
                </h1>
                <p className="fv2-sub">21 dias com passos de 5 minutos. Primeiros resultados visíveis já na primeira semana.</p>
                <motion.div {...popAnim} className="fv2-feedback" style={{ marginTop: 18 }}>
                  🌱 Quem segue os 3 primeiros dias do plano tem <b>muito mais chance</b> de chegar no dia 21 — e o {nome || "João"} vai te lembrar.
                </motion.div>
                <div className="fv2-rodape"><button className="fv2-cta verde" onClick={avancar}>Montar meu plano →</button></div>
              </>
            )}

            {step === "montando" && (
              <MontandoStep nome={nome || "João"} onPronto={avancar} />
            )}

            {step === "plano" && (
              <PlanoStep nome={nome || "João"} areaInfo={areaInfo} onContinuar={avancar} />
            )}

            {step === "paywall" && (
              <>
                <h1 className="fv2-display">Seu plano tá pronto. <span className="hl-g">Destrave ele inteiro.</span></h1>
                <div className="fv2-card fv2-preco" style={{ marginTop: 20 }}>
                  <span className="tag">Acesso vitalício</span>
                  <div className="fv2-preco-linha">
                    <span className="fv2-preco-de">R$ 97</span>
                    <span className="fv2-preco-por">R$ {PIX_PRICES.lifetime}</span>
                    <span className="fv2-preco-suf">pagamento único</span>
                  </div>
                  <ul className="fv2-checks">
                    <li>O plano do {nome || "João"} + as 16 áreas da sua vida</li>
                    <li>Seu pra sempre. Sem mensalidade.</li>
                    <li>Garantia de 7 dias — não curtiu, devolvemos</li>
                  </ul>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                  <div className="fv2-prova"><span className="estrelas">★★★★★</span><span><b>4,8</b> · milhares de vidas organizadas</span></div>
                  <div className="fv2-prova">🔒 Pix aprovado na hora · acesso imediato</div>
                </div>
                <div className="fv2-rodape">
                  <button
                    className="fv2-cta fogo"
                    onClick={() => {
                      track("funnel_v2_checkout_click", { logged: !!user });
                      if (user) setPixAberto(true);
                      // Sem conta ainda: cadastro próprio do v2 é a próxima etapa da
                      // build. Por ora o guest segue pro funil atual pra não perder venda.
                      else navigate("/comecar");
                    }}
                  >Gerar Pix de R$ {PIX_PRICES.lifetime}</button>
                  <button className="fv2-ghost" onClick={() => navigate("/entrar")}>Já tenho conta</button>
                </div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {pixAberto && <PixCheckout offer="lifetime" context="funnel" onClose={() => setPixAberto(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- sub-passos

function NinhoStep({ onRevelar }: { onRevelar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <h1 className="fv2-display">{aberto ? "Olha quem tava construindo aqui!" : "Tem alguém construindo uma casa aqui…"}</h1>
      {!aberto && <p className="fv2-sub">Toca no ninho pra espiar.</p>}
      <motion.div
        style={{ display: "flex", justifyContent: "center", margin: "30px 0", cursor: aberto ? "default" : "pointer" }}
        animate={aberto ? {} : { rotate: [0, -2.5, 2.5, -1.5, 0] }}
        transition={aberto ? {} : { repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        onClick={() => { if (!aberto) { setAberto(true); track("funnel_v2_ninho_aberto"); } }}
        role="button"
        aria-label="Espiar o ninho"
      >
        <Ninho size={190} aberto={aberto} />
      </motion.div>
      {aberto && (
        <motion.div {...popAnim} className="fv2-feedback">
          🐦 É um <b>joão-de-barro</b> — o único passarinho que constrói a própria casa, um puxadinho por dia.
        </motion.div>
      )}
      <div className="fv2-rodape">
        {aberto
          ? <button className="fv2-cta" onClick={onRevelar}>Quero conhecer →</button>
          : <button className="fv2-cta" onClick={() => { setAberto(true); track("funnel_v2_ninho_aberto"); }}>Espiar 👀</button>}
      </div>
    </>
  );
}

function QuizStep({ q, nome, selecionada, onResponder, onContinuar }: {
  q: QuizQ; nome: string; selecionada?: string;
  onResponder: (opt: string) => void; onContinuar: () => void;
}) {
  return (
    <>
      <div className="fv2-bolha"><JoaoAvatar /> <span>{q.pergunta}</span></div>
      <div className="fv2-opcoes">
        {q.opts.map((o) => (
          <button key={o.label} className="fv2-opcao" data-on={selecionada === o.label} onClick={() => onResponder(o.label)}>
            <span className="emo">{o.emoji}</span>{o.label}
          </button>
        ))}
      </div>
      {selecionada && (
        <motion.div {...popAnim} className="fv2-feedback" style={{ marginTop: 14 }}>
          💡 {q.feedback(selecionada, nome)}
        </motion.div>
      )}
      <div className="fv2-rodape">
        <button className="fv2-cta" disabled={!selecionada} onClick={onContinuar}>Continuar →</button>
      </div>
    </>
  );
}

function MontandoStep({ nome, onPronto }: { nome: string; onPronto: () => void }) {
  const [pct, setPct] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const feito = useRef(false);

  // roteiro com pausas fabricadas (labor illusion)
  useEffect(() => {
    const roteiro: Array<[number, number]> = [[300, 34], [1100, 69], [2400, 97], [3400, 100]];
    const timers = roteiro.map(([t, v]) => setTimeout(() => setPct(v), t));
    const fim = setTimeout(() => { if (!feito.current) { feito.current = true; onPronto(); } }, 4100);
    return () => { timers.forEach(clearTimeout); clearTimeout(fim); };
  }, [onPronto]);

  useEffect(() => {
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % REVIEWS.length), 1700);
    return () => clearInterval(t);
  }, []);

  const etapas: Array<[string, number]> = [
    ["Analisando suas respostas", 34],
    ["Escolhendo seus módulos", 69],
    ["Ajustando a rotina dos 21 dias", 97],
  ];
  const review = REVIEWS[reviewIdx];

  return (
    <>
      <h1 className="fv2-display">O {nome} tá montando seu plano…</h1>
      <div className="fv2-num-grande" style={{ margin: "10px 0 8px" }}>{pct}%</div>
      <div className="fv2-bar" style={{ height: 10 }}><i style={{ width: `${pct}%` }} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "18px 0" }}>
        {etapas.map(([label, min]) => (
          <div key={label} className="fv2-prog-item" data-ok={pct >= min}>{label}</div>
        ))}
      </div>
      <div className="fv2-card fv2-review">
        <span className="estrelas">★★★★★</span>
        <p style={{ margin: "6px 0 4px" }}>“{review.texto}”</p>
        <b>{review.nome}</b>
      </div>
    </>
  );
}

function PlanoStep({ nome, areaInfo, onContinuar }: {
  nome: string;
  areaInfo: { emoji: string; nome: string } | null;
  onContinuar: () => void;
}) {
  useEffect(() => { soltarConfete(); track("funnel_v2_plan_ready"); }, []);
  const extras = ALL_MODULE_ICONS.filter((m) => m.label !== areaInfo?.nome).slice(0, 2);
  return (
    <>
      <h1 className="fv2-display">A casa ficou pronta — e o seu plano também! 🎉</h1>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, alignItems: "flex-end", margin: "18px 0" }}>
        <Joao mood="festa" size={120} />
        <Casinha stage={4} size={110} />
      </div>
      <div className="fv2-card">
        <b style={{ fontSize: 14 }}>Plano dos seus 21 dias</b>
        <ul className="fv2-checks" style={{ marginTop: 10 }}>
          <li>Começa por {areaInfo ? `${areaInfo.emoji} ${areaInfo.nome}` : "onde dói mais"} — 1 passo de 5 min por dia</li>
          {extras.map((m) => <li key={m.label}>{m.emoji} {m.label} entra na semana 2</li>)}
          <li>O {nome} te lembra e comemora cada passo</li>
        </ul>
      </div>
      <div className="fv2-rodape">
        <button className="fv2-cta verde" onClick={onContinuar}>Quero destravar meu plano →</button>
      </div>
    </>
  );
}
