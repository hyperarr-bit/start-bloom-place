import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, captureLandingMeta } from "@/lib/analytics";
import { PixCheckout, type PixOffer } from "@/components/paywall/PixCheckout";
/**
 * FUNIL V3 — /plano (20/07). Reconstrução COMPLETA inspirada no Cal AI
 * (vídeo dissecado tela a tela): identidade clínica preto-e-branco, zero
 * mascote, uma decisão por tela, barra de progresso fina.
 *
 * Esqueleto (mecanismo → tela):
 *  w1  welcome com mockup ("o produto existe")
 *  w2  gráfico resultados-que-ficam (razão pra acreditar DESSA vez)
 *  w3  área que pesa (porta) · w4 idade (calibragem "séria")
 *  w5  obstáculo · w6 ritmo com slider → DATA personalizada (commitment)
 *  w7  toggle de configuração (endowment: já tá configurando o app)
 *  w8  "obrigado por confiar" + privacidade (reciprocidade)
 *  w9  DEMO fullscreen do app real (nosso diferencial — prova tangível
 *      no pico de expectativa, antes do plano)
 *  w10 prova social · w11 loading % com etapas (labor illusion)
 *  w12 SCORE DE VIDA + plano pronto (artefato — endowment máximo)
 *  w13 cadastro "salvar meu plano" (ANTES do preço — provado no original)
 *  w14 soft ask "teste sem risco" (pedido em 2 etapas do Cal AI)
 *  w15 paywall denso (16 módulos + âncora + garantia) → Pix sem fricção
 *
 * Sem downsell nesta v1 do funil: uma variável por vez.
 */

type Wid = "w1" | "w2" | "w3" | "w4" | "w5" | "w5b" | "w5c" | "w6" | "w7" | "w8" | "w9" | "w10" | "w11" | "w12" | "w13" | "w14" | "w15";
// w5b/w5c = O NÚMERO da pessoa (20/07, crítica do dono: Cal AI pede peso alvo
// e devolve cálculo; o funil tava genérico). Cada trilha tem sua unidade:
// finanças R$ (vazamento→poupança), rotina horas, corpo kg, metas tempo
// adiando. "Tudo" cai na trilha de FINANÇAS (igual v1/v2) com ponte falada.
const FLUXO_BASE: Wid[] = ["w1", "w2", "w3", "w4", "w5", "w5b", "w5c", "w6", "w7", "w8", "w9", "w10", "w11", "w12", "w13", "w14", "w15"];

const AREAS_V3: Record<string, { nome: string; module: string; emoji: string; missao: string; foco: string }> = {
  dinheiro: { nome: "Finanças", module: "financas", emoji: "💰", missao: "Fechar o mês sabendo pra onde foi cada real", foco: "Controle financeiro" },
  rotina: { nome: "Rotina", module: "rotina", emoji: "✅", missao: "7 dias seguidos cumprindo seus hábitos-chave", foco: "Constância diária" },
  corpo: { nome: "Treino e dieta", module: "dieta", emoji: "🍎", missao: "Semana completa de refeições e treinos registrados", foco: "Corpo em ordem" },
  metas: { nome: "Metas", module: "desenvolvimento", emoji: "🎯", missao: "Definir 3 metas e dar o primeiro passo em cada", foco: "Direção clara" },
  tudo: { nome: "Vida completa", module: "financas", emoji: "🧭", missao: "Fechar sua primeira semana com o score acima de 7", foco: "Organização geral" },
};

const MODULOS_16: Array<[string, string]> = [
  ["💰", "Finanças"], ["✅", "Hábitos"], ["🍎", "Dieta"], ["💪", "Treino"],
  ["❤️", "Saúde"], ["🎯", "Metas"], ["🧠", "Hiperfoco"], ["🎓", "Estudos"],
  ["💼", "Carreira"], ["📚", "Biblioteca"], ["🏠", "Casa"], ["✨", "Beleza"],
  ["✈️", "Viagens"], ["👥", "Relações"], ["🐾", "Pet"], ["📱", "Detox"],
];

const ESTADO_KEY = "fv3-state";
const lerEstado = (): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(ESTADO_KEY) ?? "{}"); } catch { return {}; }
};
const salvarEstado = (patch: Record<string, unknown>) => {
  try { localStorage.setItem(ESTADO_KEY, JSON.stringify({ ...lerEstado(), ...patch })); } catch { /* noop */ }
};

const track = (nome: string, dados?: Record<string, unknown>) => trackEvent(nome, dados ?? {});

const fmtData = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

export default function PlanoV3() {
  const navigate = useNavigate();
  const { user, isSubscribed } = useAuth();
  const [step, setStep] = useState<Wid>(() => (lerEstado().step as Wid) ?? "w1");
  const [area, setArea] = useState<string>(() => (lerEstado().area as string) ?? "");
  const [idade, setIdade] = useState<string>("");
  const [obstaculo, setObstaculo] = useState<string>("");
  const [ritmoDias, setRitmoDias] = useState<number>(14);
  const [cobra, setCobra] = useState<boolean | null>(null);
  const [demoAberta, setDemoAberta] = useState(false);
  const [pixAberto, setPixAberto] = useState(false);
  const [pixOffer, setPixOffer] = useState<PixOffer>("lifetime");
  // DOWNSELL-ROLETA (estilo Cal AI, 20/07): só em rotas de FUGA do paywall
  // (fechou pix / voltar / 40s parado), 1× por sessão, nunca pra assinante.
  const [roletaAberta, setRoletaAberta] = useState(false);
  const roletaVista = () => { try { return sessionStorage.getItem("fv3-ds-visto") === "1"; } catch { return false; } };
  const abrirRoleta = useCallback((origem: string) => {
    if (roletaVista() || isSubscribed) return;
    try { sessionStorage.setItem("fv3-ds-visto", "1"); } catch { /* noop */ }
    track("funnel_v3_wheel_view", { origem });
    setRoletaAberta(true);
  }, [isSubscribed]);

  // OS NÚMEROS da pessoa — alimentam w6 (revelação), w11 (loading), w12
  // (plano) e w15 (âncora do paywall contra o próprio vazamento declarado)
  const [vazamento, setVazamento] = useState<number>(600);
  const [poupar, setPoupar] = useState<number>(400);
  const [horas, setHoras] = useState<number>(2);
  const [pesoAtual, setPesoAtual] = useState<number>(75);
  const [pesoAlvo, setPesoAlvo] = useState<number>(70);
  const [adiada, setAdiada] = useState<string>("");

  const info = AREAS_V3[area] ?? AREAS_V3.tudo;
  // trilha numérica: "tudo" usa a de FINANÇAS (v1/v2 provaram: é a que converte)
  const trilha = area === "tudo" ? "dinheiro" : area || "dinheiro";
  const fluxo = useMemo<Wid[]>(
    () => (trilha === "rotina" || trilha === "metas") ? FLUXO_BASE.filter((w) => w !== "w5c") : FLUXO_BASE,
    [trilha],
  );
  const dataAlvo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + ritmoDias); return d; }, [ritmoDias]);
  // score de partida: calibrado pelas respostas (sempre baixo — é o "antes")
  const scoreHoje = useMemo(() => {
    let s = 5;
    if (obstaculo === "constancia" || obstaculo === "comeco") s -= 1;
    if (area === "tudo") s -= 1;
    return Math.max(3, s);
  }, [obstaculo, area]);

  // A promessa com o número DELA — usada na revelação, no plano e no paywall
  const promessa = useMemo(() => {
    if (trilha === "dinheiro") return { linha: `R$ ${poupar} guardados por mês`, ano: `R$ ${(poupar * 12).toLocaleString("pt-BR")} em um ano` };
    if (trilha === "rotina") return { linha: `+${horas * 7}h livres por semana`, ano: `${horas * 365}h de volta em um ano` };
    if (trilha === "corpo") {
      const d = pesoAtual - pesoAlvo;
      return { linha: d > 0 ? `−${d} kg no seu ritmo` : d < 0 ? `+${Math.abs(d)} kg com plano` : "peso mantido com constância", ano: "refeições e treinos prontos no app" };
    }
    return { linha: "sua meta destravada", ano: "primeiro passo nas próximas 48h" };
  }, [trilha, poupar, horas, pesoAtual, pesoAlvo]);

  useEffect(() => { captureLandingMeta(); track("funnel_v3_start"); }, []);
  useEffect(() => {
    track("funnel_v3_step", { step });
    salvarEstado({ step });
    window.scrollTo({ top: 0 });
  }, [step]);

  const idx = Math.max(0, fluxo.indexOf(step));
  const irPara = useCallback((w: Wid) => setStep(w), []);
  const avancar = useCallback(() => setStep((s) => {
    const i = fluxo.indexOf(s);
    return fluxo[Math.min((i === -1 ? 0 : i) + 1, fluxo.length - 1)];
  }), [fluxo]);
  const voltar = useCallback(() => setStep((s) => {
    const i = fluxo.indexOf(s);
    return fluxo[Math.max((i === -1 ? 1 : i) - 1, 0)];
  }), [fluxo]);

  const escolher = (w: Wid, campo: string, valor: string, setter: (v: string) => void) => {
    setter(valor);
    salvarEstado({ [campo]: valor });
    track(`funnel_v3_${campo}`, { valor });
    setTimeout(avancar, 220);
  };

  // cadastro: logado pula pro soft ask
  useEffect(() => {
    if (step === "w13" && user) irPara("w14");
  }, [step, user, irPara]);

  // gatilhos de fuga do paywall: voltar do celular (popstate) + 40s parado
  useEffect(() => {
    if (step !== "w15") return;
    try { history.pushState({ fv3: 1 }, ""); } catch { /* noop */ }
    const onPop = () => abrirRoleta("voltar");
    window.addEventListener("popstate", onPop);
    let idle: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(idle); idle = setTimeout(() => abrirRoleta("inatividade"), 40_000); };
    const evs = ["pointerdown", "scroll", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      window.removeEventListener("popstate", onPop);
      evs.forEach((e) => window.removeEventListener(e, arm));
      clearTimeout(idle);
    };
  }, [step, abrirRoleta]);

  return (
    <div className="fv3">
      <style>{CSS_V3}</style>

      {/* topo: voltar + progresso fino (padrão Cal AI) */}
      {step !== "w1" && step !== "w11" && !demoAberta && (
        <header className="fv3-top">
          <button className="fv3-back" onClick={voltar} disabled={idx <= 0 || step === "w15"} aria-label="Voltar">←</button>
          <div className="fv3-progress"><div style={{ width: `${(idx / (fluxo.length - 1)) * 100}%` }} /></div>
        </header>
      )}

      <main className="fv3-main">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.22 }}>

            {step === "w1" && (
              <div className="fv3-center">
                <div className="fv3-hero-video" aria-hidden>
                  {/* vídeo do dono (hub real no iPhone). LOOP nos primeiros 14s:
                      o arquivo tem 149s/23MB — limitar o trecho faz o navegador
                      baixar só o começo. Corte inferior esconde a marca d'água. */}
                  <video
                    src="/v3-hero.mp4" poster="/v3-hero-poster.jpg"
                    autoPlay muted loop playsInline preload="metadata"
                    onTimeUpdate={(e) => { const v = e.currentTarget; if (v.currentTime > 14) v.currentTime = 0.05; }}
                  />
                </div>
                <h1>Organize sua vida inteira.<br />Num app só.</h1>
                <p className="fv3-sub">16 módulos. Um método. Resultados que ficam.</p>
                <button className="fv3-cta" onClick={avancar}>Começar</button>
                <button className="fv3-link" onClick={() => navigate("/entrar")}>Já tenho conta? <b>Entrar</b></button>
              </div>
            )}

            {step === "w2" && (
              <div>
                <h2>O CORE cria resultados<br />que ficam</h2>
                <div className="fv3-card">
                  <p className="fv3-mini">Sua organização</p>
                  <svg viewBox="0 0 300 130" className="fv3-grafico" aria-hidden>
                    <path d="M10 30 C 70 20, 110 70, 150 95 S 250 115, 290 118" fill="none" stroke="#d0cbc4" strokeWidth="3" pathLength="1" className="fv3-desenha atras" />
                    <path d="M10 100 C 80 95, 140 55, 200 40 S 270 26, 290 24" fill="none" stroke="#111" strokeWidth="3.5" pathLength="1" className="fv3-desenha frente" />
                    <circle cx="290" cy="24" r="5" fill="#111" className="fv3-pop-tarde" />
                    <text x="180" y="105" fontSize="11" fill="#8a8378" className="fv3-fade t1">motivação solta</text>
                    <text x="205" y="20" fontSize="11.5" fontWeight="700" fill="#111" className="fv3-fade t2">com o CORE</text>
                    <text x="10" y="127" fontSize="10" fill="#8a8378">semana 1</text>
                    <text x="245" y="127" fontSize="10" fill="#8a8378">mês 6</text>
                  </svg>
                  <p className="fv3-legenda">Motivação despenca em 2 semanas. Sistema fica. O CORE transforma organização em rotina — não em fase.</p>
                </div>
                <div className="fv3-rodape"><button className="fv3-cta" onClick={avancar}>Continuar</button></div>
              </div>
            )}

            {step === "w3" && (
              <div>
                <h2>O que mais pesa na sua vida hoje?</h2>
                <p className="fv3-sub2">Seu plano começa por aqui.</p>
                <div className="fv3-opcoes">
                  {Object.entries({ dinheiro: "Meu dinheiro", rotina: "Minha rotina", corpo: "Treino e dieta", metas: "Metas e evolução pessoal", tudo: "Tudo, sinceramente" }).map(([k, label], i) => (
                    <motion.button key={k} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className={`fv3-op ${area === k ? "on" : ""}`} onClick={() => escolher("w3", "area", k, setArea)}>
                      <span className="fv3-op-emoji">{AREAS_V3[k].emoji}</span> {label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === "w4" && (
              <div>
                <h2>Qual a sua faixa de idade?</h2>
                <p className="fv3-sub2">Usamos isso pra calibrar o ritmo do seu plano.</p>
                <div className="fv3-opcoes">
                  {["18–24", "25–34", "35–44", "45+"].map((f, i) => (
                    <motion.button key={f} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className={`fv3-op ${idade === f ? "on" : ""}`} onClick={() => escolher("w4", "idade", f, setIdade)}>{f}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === "w5" && (
              <div>
                <h2>O que te derrubou nas outras tentativas?</h2>
                <p className="fv3-sub2">Sem julgamento — é aqui que o plano ataca primeiro.</p>
                <div className="fv3-opcoes">
                  {Object.entries({ constancia: "Falta de constância", tempo: "Falta de tempo", adiamento: "Ansiedade e adiamento", comeco: "Nunca soube por onde começar" }).map(([k, label], i) => (
                    <motion.button key={k} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className={`fv3-op ${obstaculo === k ? "on" : ""}`} onClick={() => escolher("w5", "obstaculo", k, setObstaculo)}>{label}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === "w5b" && trilha === "dinheiro" && (
              <div>
                {area === "tudo" && (
                  <p className="fv3-ponte">Tudo, sinceramente? Respeito. <b>Vamos começar pelo mais importante: finanças.</b> Os outros 15 módulos entram junto.</p>
                )}
                <h2>Quanto some da sua conta todo mês sem você saber pra onde foi?</h2>
                <p className="fv3-sub2">Chuta sem medo — a maioria descobre que é mais.</p>
                <NumSlider valor={vazamento} onMudar={setVazamento} min={100} max={2000} passo={50} fmt={(v) => `R$ ${v}`} />
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { salvarEstado({ vazamento }); track("funnel_v3_vazamento", { valor: vazamento }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w5c" && trilha === "dinheiro" && (
              <div>
                <h2>E quanto você quer conseguir guardar por mês?</h2>
                <p className="fv3-sub2">Esse vira o número oficial do seu plano.</p>
                <NumSlider valor={poupar} onMudar={setPoupar} min={100} max={2000} passo={50} fmt={(v) => `R$ ${v}`} />
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { salvarEstado({ poupar }); track("funnel_v3_poupar", { valor: poupar }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w5b" && trilha === "rotina" && (
              <div>
                <h2>Quantas horas por dia a desorganização te rouba?</h2>
                <p className="fv3-sub2">Retrabalho, esquecimento, decidir tudo na hora…</p>
                <NumSlider valor={horas} onMudar={setHoras} min={1} max={6} passo={1} fmt={(v) => `${v}h por dia`} />
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { salvarEstado({ horas }); track("funnel_v3_horas", { valor: horas }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w5b" && trilha === "corpo" && (
              <div>
                <h2>Qual seu peso hoje?</h2>
                <NumSlider valor={pesoAtual} onMudar={setPesoAtual} min={45} max={140} passo={1} fmt={(v) => `${v} kg`} />
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { salvarEstado({ pesoAtual }); track("funnel_v3_peso", { valor: pesoAtual }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w5c" && trilha === "corpo" && (
              <div>
                <h2>E qual peso você quer alcançar?</h2>
                <NumSlider valor={pesoAlvo} onMudar={setPesoAlvo} min={45} max={140} passo={1} fmt={(v) => `${v} kg`} />
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { salvarEstado({ pesoAlvo }); track("funnel_v3_peso_alvo", { valor: pesoAlvo }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w5b" && trilha === "metas" && (
              <div>
                <h2>Há quanto tempo você adia a meta mais importante?</h2>
                <div className="fv3-opcoes">
                  {["Uns 3 meses", "Uns 6 meses", "Mais de 1 ano", "Nem lembro mais"].map((o, i) => (
                    <motion.button key={o} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06 }} className={`fv3-op ${adiada === o ? "on" : ""}`} onClick={() => { setAdiada(o); salvarEstado({ adiada: o }); track("funnel_v3_adiada", { valor: o }); setTimeout(avancar, 220); }}>{o}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {step === "w6" && (
              <div>
                <h2>Em quanto tempo você quer sua vida organizada?</h2>
                <div className="fv3-card" style={{ textAlign: "center" }}>
                  <div className="fv3-ritmos">
                    {[["🐢", "Leve", 30], ["🐇", "Recomendado", 14], ["🐆", "Intenso", 7]].map(([e, nome, dias]) => (
                      <button
                        key={String(nome)}
                        className={`fv3-ritmo ${ritmoDias === dias ? "on" : ""}`}
                        onClick={() => { setRitmoDias(dias as number); salvarEstado({ ritmoDias: dias }); }}
                      >
                        <span className="fv3-ritmo-emoji">{e}</span>
                        <span>{nome}</span>
                        <span className="fv3-mini">{dias} dias</span>
                      </button>
                    ))}
                  </div>
                  <motion.div key={promessa.linha + ritmoDias} initial={{ opacity: 0.4, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="fv3-datacaixa">
                    <b>{promessa.linha}</b> até <b>{fmtData(dataAlvo)}</b>
                    <p className="fv3-mini" style={{ marginTop: 4 }}>{promessa.ano}</p>
                    <p className="fv3-mini" style={{ marginTop: 4 }}>
                      {ritmoDias === 14 ? "O ritmo equilibrado — ideal pra maioria." : ritmoDias === 7 ? "Pra quem quer virada rápida. Exige dedicação diária." : "Sem pressa, sem pressão. Constância acima de tudo."}
                    </p>
                  </motion.div>
                </div>
                <div className="fv3-rodape"><button className="fv3-cta" onClick={() => { track("funnel_v3_ritmo", { dias: ritmoDias }); avancar(); }}>Continuar</button></div>
              </div>
            )}

            {step === "w7" && (
              <div>
                <h2>Quer que o CORE te cobre das pendências do dia?</h2>
                <p className="fv3-sub2">Um lembrete gentil quando algo importante ficar pra trás.</p>
                <div className="fv3-duplo">
                  <button className={`fv3-op ${cobra === false ? "on" : ""}`} onClick={() => { setCobra(false); track("funnel_v3_cobra", { valor: false }); setTimeout(avancar, 200); }}>Prefiro sem</button>
                  <button className={`fv3-op ${cobra === true ? "on" : ""}`} onClick={() => { setCobra(true); track("funnel_v3_cobra", { valor: true }); setTimeout(avancar, 200); }}>Sim, me cobra</button>
                </div>
              </div>
            )}

            {step === "w8" && (
              <div className="fv3-center">
                <div className="fv3-selo-grande" aria-hidden>🤝</div>
                <h2 style={{ textAlign: "center" }}>Obrigado por confiar na gente</h2>
                <p className="fv3-sub" style={{ maxWidth: 300 }}>Agora vamos personalizar o CORE pra você.</p>
                <div className="fv3-card fv3-privacidade">
                  🔒 Sua privacidade importa. Seus dados são só seus — nunca vendidos, nunca compartilhados.
                </div>
                <div className="fv3-rodape"><button className="fv3-cta" onClick={avancar}>Continuar</button></div>
              </div>
            )}

            {step === "w9" && !demoAberta && (
              <div>
                <h2>Antes de montar seu plano —<br />testa o app de verdade</h2>
                <p className="fv3-sub2">Sem cadastro, sem compromisso. O módulo de {info.nome} aberto pra você mexer.</p>
                <button
                  className="fv3-democard"
                  onClick={() => { setDemoAberta(true); track("funnel_v3_demo_open", { module: info.module }); }}
                >
                  <span className="fv3-democard-emoji">{info.emoji}</span>
                  <span>
                    <b>Abrir demonstração</b>
                    <small>Módulo {info.nome} · dados de exemplo</small>
                  </span>
                  <span aria-hidden>→</span>
                </button>
                <div className="fv3-rodape">
                  <button className="fv3-link" onClick={avancar}>Pular e ver meu plano →</button>
                </div>
              </div>
            )}

            {step === "w10" && (
              <div>
                <h2>Você não vai estar sozinho</h2>
                <div className="fv3-card fv3-stats">
                  <div><b>+<Conta ate={500} dur={1100} /></b><span>feedbacks positivos</span></div>
                  <div><b>16</b><span>módulos inclusos</span></div>
                  <div><b>7 dias</b><span>de garantia total</span></div>
                </div>
                <div className="fv3-quote">
                  <p>“Adorei demais o aplicativo!! Estou usando há 1 dia e já está me ajudando bastante.”</p>
                  <span>— @requeijohn · Instagram</span>
                </div>
                <div className="fv3-quote">
                  <p>“Esse app é exatamente o que estou procurando a muito tempo.”</p>
                  <span>— @bruupalavro · Instagram</span>
                </div>
                <div className="fv3-quote">
                  <p>“Perfeito — no geral eu achei ele excelente, parabéns pelo app.”</p>
                  <span>— @nandobonfacine · Instagram</span>
                </div>
                <div className="fv3-rodape"><button className="fv3-cta" onClick={avancar}>Continuar</button></div>
              </div>
            )}

            {step === "w11" && <W11Loading areaNome={info.nome} ritmoDias={ritmoDias} promessaLinha={promessa.linha} onFim={avancar} />}

            {step === "w12" && (
              <div>
                <h2>Seu plano tá pronto.</h2>
                <div className="fv3-card">
                  <div className="fv3-scorelinha">
                    <div className="fv3-scorebox"><span className="fv3-mini">Seu score hoje</span><b className="ruim"><Conta ate={scoreHoje} dec={1} dur={800} /></b></div>
                    <span className="fv3-seta" aria-hidden>→</span>
                    <div className="fv3-scorebox"><span className="fv3-mini">até {fmtData(dataAlvo)}</span><b className="bom"><Conta ate={8.5} dec={1} dur={1400} /></b></div>
                  </div>
                  <ul className="fv3-plano">
                    {[
                      <><b>Sua meta:</b> {promessa.linha} até {fmtData(dataAlvo)}</>,
                      <><b>Foco nº 1:</b> {info.foco} ({info.nome})</>,
                      <><b>Missão dos 7 dias:</b> {info.missao.toLowerCase()}</>,
                      <><b>Ritmo:</b> organizada em {ritmoDias} dias{cobra ? " · com lembretes diários" : ""}</>,
                      <><b>Reserva:</b> os outros 15 módulos te esperando</>,
                    ].map((li, i) => (
                      <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.14 }}>{li}</motion.li>
                    ))}
                  </ul>
                </div>
                <div className="fv3-rodape"><button className="fv3-cta" onClick={avancar}>Salvar meu plano</button></div>
              </div>
            )}

            {step === "w13" && !user && <W13Cadastro onOk={() => { track("funnel_v3_signup_success"); irPara("w14"); }} onEntrar={() => navigate("/entrar")} />}

            {step === "w14" && (
              <div className="fv3-center" style={{ minHeight: "60dvh", justifyContent: "center" }}>
                <h2 style={{ textAlign: "center", fontSize: 26 }}>A gente quer que você<br />teste sem risco.</h2>
                <p className="fv3-checkline">✓ Garantia total de 7 dias — não gostou, devolvemos</p>
                <p className="fv3-checkline">✓ Acesso liberado na hora, direto nesta tela</p>
                <div className="fv3-rodape" style={{ width: "100%" }}>
                  <button className="fv3-cta" onClick={() => { track("funnel_v3_softask_ok"); avancar(); }}>Continuar</button>
                  <p className="fv3-mini" style={{ textAlign: "center", marginTop: 8 }}>Pagamento único de R$ 27,90 · sem mensalidade, nunca</p>
                </div>
              </div>
            )}

            {step === "w15" && (
              <div>
                <h2>Tudo isso é seu.<br />Pra sempre.</h2>
                <div className="fv3-card" style={{ padding: "14px 16px" }}>
                  <div className="fv3-preco">
                    <span className="fv3-anchor">R$ 99,90</span>
                    <b>R$ 27,90</b>
                    <span className="fv3-mini">pagamento único · vitalício</span>
                  </div>
                  <div className="fv3-modgrid">
                    {MODULOS_16.map(([e, n], i) => (
                      <motion.span key={n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }}>{e} {n}</motion.span>
                    ))}
                  </div>
                  <p className="fv3-legenda" style={{ marginTop: 10 }}>
                    ✓ Sem mensalidade, nunca &nbsp;·&nbsp; ✓ Garantia de 7 dias &nbsp;·&nbsp; ✓ Atualizações inclusas
                  </p>
                </div>
                {trilha === "dinheiro" && (
                  <p className="fv3-ancora-pessoal">
                    Você disse que <b>R$ {vazamento} somem</b> da sua conta todo mês.<br />O CORE custa <b>R$ 27,90 — uma vez.</b>
                  </p>
                )}
                {trilha !== "dinheiro" && (
                  <p className="fv3-ancora-pessoal">Seu plano: <b>{promessa.linha}</b> até <b>{fmtData(dataAlvo)}</b>.</p>
                )}
                <div className="fv3-rodape">
                  <button className="fv3-cta" onClick={() => { track("funnel_v3_checkout_click"); setPixOffer("lifetime"); setPixAberto(true); }}>
                    Garantir meu acesso vitalício →
                  </button>
                  <p className="fv3-mini" style={{ textAlign: "center", marginTop: 8 }}>Pix na hora · acesso libera nesta tela</p>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* DEMO fullscreen — app real com seeds, cerca anti-fuga */}
      {demoAberta && (
        <DemoFull module={info.module} onFechar={() => { setDemoAberta(false); track("funnel_v3_demo_continue"); avancar(); }} />
      )}

      {pixAberto && (
        <PixCheckout
          offer={pixOffer}
          context="funnel"
          onClose={() => {
            setPixAberto(false);
            // fechou o Pix do preço cheio sem pagar → a rota de fuga mais quente
            if (pixOffer === "lifetime") abrirRoleta("fechou_pix");
          }}
        />
      )}

      {roletaAberta && (
        <RoletaDownsell
          onAceitar={() => {
            track("funnel_v3_wheel_accept");
            setRoletaAberta(false);
            setPixOffer("downsell");
            setPixAberto(true);
          }}
          onFechar={(fase) => { track("funnel_v3_wheel_dismiss", { fase }); setRoletaAberta(false); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- telas com estado próprio

function W11Loading({ areaNome, ritmoDias, promessaLinha, onFim }: { areaNome: string; ritmoDias: number; promessaLinha: string; onFim: () => void }) {
  const [pct, setPct] = useState(0);
  const fimRef = useRef(false);
  const etapas = [
    "Lendo suas respostas…",
    `Montando seu plano de ${areaNome}…`,
    `Calibrando pra ${promessaLinha.toLowerCase()}…`,
    `Ajustando pro ritmo de ${ritmoDias} dias…`,
    "Preparando seus 16 módulos…",
  ];
  useEffect(() => {
    const t = setInterval(() => setPct((p) => {
      const n = Math.min(100, p + 2 + Math.random() * 3);
      if (n >= 100 && !fimRef.current) { fimRef.current = true; setTimeout(onFim, 500); }
      return n;
    }), 90);
    return () => clearInterval(t);
  }, [onFim]);
  const etapa = etapas[Math.min(etapas.length - 1, Math.floor((pct / 100) * etapas.length))];
  return (
    <div className="fv3-center" style={{ minHeight: "70dvh", justifyContent: "center" }}>
      <div className="fv3-pct">{Math.floor(pct)}%</div>
      <h2 style={{ textAlign: "center" }}>Montando tudo pra você</h2>
      <div className="fv3-barra"><div style={{ width: `${pct}%` }} /></div>
      <p className="fv3-sub" aria-live="polite">{etapa}</p>
    </div>
  );
}

function W13Cadastro({ onOk, onEntrar }: { onOk: () => void; onEntrar: () => void }) {
  const { signUp } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  useEffect(() => { track("funnel_v3_signup_view"); }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || senha.length < 6) { setErro(senha.length < 6 ? "A senha precisa de 6+ caracteres." : "Confere o e-mail."); return; }
    setIndo(true); setErro(null);
    const { error, session } = await signUp(email.trim(), senha, nome.trim() || undefined);
    setIndo(false);
    if (error) {
      track("funnel_v3_signup_error", { message: String(error?.message ?? "").slice(0, 120) });
      setErro(String(error?.message ?? "").includes("already") ? "Esse e-mail já tem conta — toca em 'Já tenho conta'." : "Não deu. Confere o e-mail e tenta de novo.");
      return;
    }
    if (!session) { setErro("Confirma o e-mail que enviamos e volta aqui."); return; }
    onOk();
  };

  return (
    <div>
      <h2>Salvar seu plano</h2>
      <p className="fv3-sub2">30 segundos e ele é seu — de qualquer aparelho.</p>
      <form onSubmit={enviar} className="fv3-form">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" aria-label="Seu nome" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu melhor e-mail" type="email" autoComplete="email" inputMode="email" aria-label="E-mail" />
        <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Cria uma senha (6+)" type="password" autoComplete="new-password" aria-label="Senha" />
        {erro && <div className="fv3-erro">{erro}</div>}
        <button type="submit" className="fv3-cta" disabled={indo}>{indo ? "Salvando…" : "Salvar meu plano →"}</button>
        <button type="button" className="fv3-link" onClick={onEntrar}>Já tenho conta</button>
      </form>
    </div>
  );
}

/** Número que CONTA até o alvo (easing cúbico) — vida nos scores e stats. */
function Conta({ ate, dur = 900, dec = 0 }: { ate: number; dur?: number; dec?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(ate * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ate, dur]);
  return <>{v.toFixed(dec).replace(".", ",")}</>;
}

/** Slider numérico grandão (o "peso alvo" do Cal AI): valor gigante em cima,
 *  range embaixo — a pessoa VÊ o número dela virar o número do plano. */
function NumSlider({ valor, onMudar, min, max, passo, fmt }: {
  valor: number; onMudar: (v: number) => void; min: number; max: number; passo: number; fmt: (v: number) => string;
}) {
  return (
    <div className="fv3-card" style={{ textAlign: "center" }}>
      <motion.div key={valor} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }} className="fv3-numgrande">{fmt(valor)}</motion.div>
      <input
        type="range" className="fv3-range"
        min={min} max={max} step={passo} value={valor}
        onChange={(e) => onMudar(Number(e.target.value))}
        aria-label="Escolher valor"
      />
      <div className="fv3-range-legendas"><span>{fmt(min)}</span><span>{fmt(max)}</span></div>
    </div>
  );
}

/**
 * DOWNSELL-ROLETA estilo Cal AI: roda dourada/magenta que SEMPRE cai no 46%
 * — porque 27,90→14,90 É 46% de desconto real (nada de 80% fake). Depois, a
 * tela "Sua oferta única" com card grafite + sparkles. Prêmio já aplicado:
 * zero digitação, 1 toque pro Pix (regra da casa: resgate sem fricção).
 */
const FATIAS: Array<{ rotulo: string; cor: string; texto: string }> = [
  { rotulo: "Sem sorte", cor: "#ffffff", texto: "#8a8378" },
  { rotulo: "25%", cor: "#d22d82", texto: "#ffffff" },
  { rotulo: "🎁", cor: "#211d18", texto: "#ffffff" },
  { rotulo: "46%", cor: "#d4a437", texto: "#ffffff" },
  { rotulo: "10%", cor: "#ffffff", texto: "#8a8378" },
  { rotulo: "30%", cor: "#ef7fb6", texto: "#ffffff" },
];
// centro da fatia "46%" (i=3): -90 + 3*60 + 30 = 120°; ponteiro fica a 0°
// (3h) → giro final = 5 voltas + (360-120) = 2040°
const GIRO_FINAL = 5 * 360 + 240;

function fatiaPath(i: number, r: number) {
  const rad = (a: number) => (a * Math.PI) / 180;
  const a0 = (i * 60) - 90;
  const a1 = ((i + 1) * 60) - 90;
  const x0 = 150 + r * Math.cos(rad(a0)), y0 = 150 + r * Math.sin(rad(a0));
  const x1 = 150 + r * Math.cos(rad(a1)), y1 = 150 + r * Math.sin(rad(a1));
  return `M150 150 L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

function RoletaDownsell({ onAceitar, onFechar }: { onAceitar: () => void; onFechar: (fase: string) => void }) {
  const [fase, setFase] = useState<"roda" | "premio">("roda");
  const [girando, setGirando] = useState(false);
  const [rot, setRot] = useState(0);

  const girar = () => {
    if (girando) return;
    setGirando(true);
    track("funnel_v3_wheel_spin");
    setRot(GIRO_FINAL);
    setTimeout(() => { track("funnel_v3_wheel_offer_view"); setFase("premio"); }, 4200);
  };

  return (
    <div className="fv3-roleta-overlay">
      <button className="fv3-roleta-x" aria-label="Fechar" onClick={() => onFechar(fase)}>✕</button>

      {fase === "roda" && (
        <div className="fv3-roleta-wrap">
          <h2 style={{ textAlign: "center" }}>Antes de ir —<br />você ganhou um giro.</h2>
          <p className="fv3-sub" style={{ marginTop: 4 }}>Uma condição exclusiva, só desta vez.</p>
          <div className="fv3-roda-area">
            <svg viewBox="0 0 300 300" className="fv3-roda" style={{ transform: `rotate(${rot}deg)` }}>
              <circle cx="150" cy="150" r="148" fill="#d4a437" />
              <circle cx="150" cy="150" r="138" fill="#fff" />
              {FATIAS.map((f, i) => <path key={i} d={fatiaPath(i, 136)} fill={f.cor} stroke="#f0ede8" strokeWidth="1" />)}
              {FATIAS.map((f, i) => {
                const ang = (i * 60) - 90 + 30;
                const rad = (ang * Math.PI) / 180;
                const x = 150 + 92 * Math.cos(rad), y = 150 + 92 * Math.sin(rad);
                return (
                  <text key={i} x={x} y={y} fill={f.texto} fontSize="17" fontWeight="800"
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${ang + 90} ${x} ${y})`}>{f.rotulo}</text>
                );
              })}
              <circle cx="150" cy="150" r="26" fill="#211d18" />
              <text x="150" y="151" fontSize="18" textAnchor="middle" dominantBaseline="middle">🧭</text>
            </svg>
            <div className="fv3-ponteiro" aria-hidden>◀</div>
          </div>
          <button className="fv3-cta" onClick={girar} disabled={girando} style={{ maxWidth: 320 }}>
            {girando ? "Girando…" : "Girar a roleta"}
          </button>
        </div>
      )}

      {fase === "premio" && (
        <div className="fv3-roleta-wrap">
          <h2 style={{ textAlign: "center" }}>Sua oferta única</h2>
          <div className="fv3-premio-card">
            <span className="fv3-sparkle s1">✦</span>
            <span className="fv3-sparkle s2">✦</span>
            <span className="fv3-sparkle s3">✦</span>
            <div className="fv3-premio-off">46% OFF</div>
            <div className="fv3-premio-sub">PRA SEMPRE — acesso vitalício</div>
          </div>
          <div className="fv3-premio-preco">
            <span className="fv3-anchor">R$ 27,90</span>
            <b>R$ 14,90</b>
            <span className="fv3-mini">pagamento único</span>
          </div>
          <p className="fv3-mini" style={{ textAlign: "center", marginTop: 10 }}>
            Fechou essa tela, ela não volta. Mesma garantia de 7 dias.
          </p>
          <button className="fv3-cta" onClick={onAceitar} style={{ maxWidth: 320 }}>
            Garantir por R$ 14,90 →
          </button>
        </div>
      )}
    </div>
  );
}

function DemoFull({ module, onFechar }: { module: string; onFechar: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  // cerca: se a navegação interna sair do /preview, volta pro módulo da demo
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const w = ref.current?.contentWindow;
        if (w && !w.location.pathname.startsWith("/preview")) {
          w.location.replace(`/preview/${module}?embed=v2`);
        }
      } catch { /* cross-origin improvável (mesma origem) */ }
    }, 400);
    return () => clearInterval(t);
  }, [module]);
  return (
    <div className="fv3-demo">
      <div className="fv3-demo-top">
        <span>DEMO · mexa à vontade — dados de exemplo</span>
      </div>
      <iframe ref={ref} title="Demonstração do CORE" src={`/preview/${module}?embed=v2`} />
      <button className="fv3-cta fv3-demo-cta" onClick={onFechar}>Continuar →</button>
    </div>
  );
}

// ---------------------------------------------------------------- design system próprio (Cal AI clínico)

const CSS_V3 = `
.fv3 { min-height: 100dvh; background: #fff; color: #111; font-family: -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; }
.fv3 * { box-sizing: border-box; }
.fv3-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 14px; padding: 14px 18px 10px; background: rgba(255,255,255,.94); backdrop-filter: blur(8px); }
.fv3-back { border: 0; background: none; font-size: 22px; line-height: 1; color: #111; padding: 4px 6px; cursor: pointer; }
.fv3-back:disabled { opacity: .25; }
.fv3-progress { flex: 1; height: 3px; background: #eceae6; border-radius: 99px; overflow: hidden; }
.fv3-progress div { height: 100%; background: #111; border-radius: 99px; transition: width .3s ease; }
.fv3-main { max-width: 430px; margin: 0 auto; padding: 18px 22px 40px; }
.fv3 h1 { font-size: 30px; line-height: 1.15; letter-spacing: -.02em; font-weight: 800; text-align: center; margin: 22px 0 0; }
.fv3 h2 { font-size: 24px; line-height: 1.2; letter-spacing: -.015em; font-weight: 800; margin: 10px 0 6px; }
.fv3-sub { color: #6f695f; font-size: 15px; text-align: center; margin: 10px auto 0; line-height: 1.5; }
.fv3-sub2 { color: #6f695f; font-size: 14px; margin: 0 0 18px; line-height: 1.5; }
.fv3-mini { color: #8a8378; font-size: 12px; }
.fv3-center { display: flex; flex-direction: column; align-items: center; padding-top: 8dvh; }
.fv3-cta { width: 100%; border: 0; background: #111; color: #fff; font: inherit; font-weight: 700; font-size: 16.5px; padding: 16px; border-radius: 999px; cursor: pointer; margin-top: 18px; transition: transform .08s; }
.fv3-cta:active { transform: scale(.98); }
.fv3-cta:disabled { opacity: .4; }
.fv3-link { border: 0; background: none; font: inherit; font-size: 14px; color: #6f695f; margin-top: 14px; cursor: pointer; width: 100%; text-align: center; }
.fv3-link b { color: #111; }
.fv3-rodape { margin-top: 22px; }
.fv3-card { background: #faf9f7; border: 1px solid #eceae6; border-radius: 18px; padding: 18px; margin-top: 14px; }
.fv3-legenda { font-size: 13px; color: #6f695f; line-height: 1.55; margin: 8px 0 0; }
.fv3-grafico { width: 100%; height: auto; margin-top: 6px; }
.fv3-opcoes { display: flex; flex-direction: column; gap: 10px; }
.fv3-op { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; font: inherit; font-size: 15.5px; font-weight: 600; padding: 16px; border-radius: 14px; border: 1.5px solid #eceae6; background: #faf9f7; color: #111; cursor: pointer; transition: all .12s; }
.fv3-op.on { background: #111; border-color: #111; color: #fff; }
.fv3-op-emoji { font-size: 19px; }
.fv3-duplo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fv3-duplo .fv3-op { justify-content: center; text-align: center; }
.fv3-ritmos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.fv3-ritmo { display: flex; flex-direction: column; align-items: center; gap: 2px; font: inherit; font-size: 13px; font-weight: 700; padding: 12px 6px; border-radius: 14px; border: 1.5px solid #eceae6; background: #fff; cursor: pointer; color: #111; }
.fv3-ritmo.on { border-color: #111; background: #111; color: #fff; }
.fv3-ritmo.on .fv3-mini { color: rgba(255,255,255,.7); }
.fv3-ritmo-emoji { font-size: 22px; }
.fv3-datacaixa { margin-top: 14px; background: #fff; border: 1.5px dashed #d8d4cd; border-radius: 14px; padding: 12px; font-size: 15px; }
.fv3-selo-grande { font-size: 54px; margin-bottom: 6px; }
.fv3-privacidade { font-size: 13px; line-height: 1.55; color: #6f695f; text-align: center; max-width: 320px; }
.fv3-democard { display: flex; align-items: center; gap: 14px; width: 100%; font: inherit; text-align: left; background: #111; color: #fff; border: 0; border-radius: 18px; padding: 18px; cursor: pointer; }
.fv3-democard b { display: block; font-size: 16px; }
.fv3-democard small { color: rgba(255,255,255,.65); font-size: 12.5px; }
.fv3-democard-emoji { font-size: 28px; }
.fv3-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; }
.fv3-stats b { display: block; font-size: 20px; }
.fv3-stats span { font-size: 11.5px; color: #8a8378; line-height: 1.3; display: block; margin-top: 2px; }
.fv3-quote { background: #faf9f7; border: 1px solid #eceae6; border-radius: 14px; padding: 14px 16px; margin-top: 10px; }
.fv3-quote p { margin: 0; font-size: 14.5px; line-height: 1.5; }
.fv3-quote span { display: block; margin-top: 6px; font-size: 12px; color: #8a8378; }
.fv3-pct { font-size: 56px; font-weight: 800; letter-spacing: -.03em; }
.fv3-barra { width: 100%; max-width: 280px; height: 6px; background: #eceae6; border-radius: 99px; overflow: hidden; margin: 18px 0 4px; }
.fv3-barra div { height: 100%; background: #111; transition: width .12s linear; }
.fv3-scorelinha { display: flex; align-items: center; justify-content: center; gap: 14px; }
.fv3-scorebox { text-align: center; background: #fff; border: 1px solid #eceae6; border-radius: 14px; padding: 10px 18px; }
.fv3-scorebox b { display: block; font-size: 28px; letter-spacing: -.02em; }
.fv3-scorebox b.ruim { color: #b3552e; }
.fv3-scorebox b.bom { color: #1d7a4f; }
.fv3-seta { font-size: 20px; color: #8a8378; }
.fv3-plano { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 14.5px; line-height: 1.45; }
.fv3-plano li::before { content: "✓  "; font-weight: 800; }
.fv3-form { display: flex; flex-direction: column; gap: 10px; }
.fv3-form input { font: inherit; font-size: 15.5px; font-weight: 600; padding: 14px 15px; border-radius: 14px; border: 1.5px solid #eceae6; background: #faf9f7; outline: none; color: #111; }
.fv3-form input:focus { border-color: #111; background: #fff; }
.fv3-erro { background: #fdeeea; color: #a1401f; font-size: 13.5px; border-radius: 12px; padding: 10px 12px; }
.fv3-checkline { font-size: 15px; margin: 8px 0 0; }
.fv3-preco { text-align: center; padding: 4px 0 12px; }
.fv3-anchor { text-decoration: line-through; color: #b0aaa0; font-size: 15px; margin-right: 8px; }
.fv3-preco b { font-size: 32px; letter-spacing: -.02em; }
.fv3-preco .fv3-mini { display: block; margin-top: 2px; }
.fv3-modgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 10px; border-top: 1px dashed #e2ded7; padding-top: 12px; font-size: 13.5px; font-weight: 600; }
.fv3-fone { position: relative; width: 208px; height: 424px; border: 9px solid #111; border-radius: 40px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.22); background: #111; }
.fv3-fone-notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 86px; height: 22px; background: #111; border-radius: 0 0 14px 14px; z-index: 3; }
.fv3-fone-tela { position: absolute; inset: 0; border-radius: 31px; overflow: hidden; background: #fff; }
.fv3-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; opacity: 0; animation: fv3loop 12s ease-in-out infinite; }
@keyframes fv3loop {
  0% { opacity: 0; transform: scale(1.04); }
  4% { opacity: 1; }
  25% { opacity: 1; transform: scale(1); }
  30% { opacity: 0; transform: scale(1); }
  100% { opacity: 0; }
}
.fv3-desenha { stroke-dasharray: 1; stroke-dashoffset: 1; animation: fv3draw 1.1s ease-out forwards; }
.fv3-desenha.atras { animation-delay: .15s; }
.fv3-desenha.frente { animation-delay: .6s; animation-duration: 1.25s; }
@keyframes fv3draw { to { stroke-dashoffset: 0; } }
.fv3-pop-tarde { opacity: 0; transform-origin: center; transform-box: fill-box; animation: fv3popin .45s cubic-bezier(.2,1.5,.4,1) 1.8s forwards; }
@keyframes fv3popin { from { opacity: 0; transform: scale(.3); } to { opacity: 1; transform: scale(1); } }
.fv3-fade { opacity: 0; animation: fv3fadein .5s ease forwards; }
.fv3-fade.t1 { animation-delay: .9s; }
.fv3-fade.t2 { animation-delay: 1.7s; }
@keyframes fv3fadein { to { opacity: 1; } }
.fv3-hero-video { width: 246px; height: 430px; overflow: hidden; }
.fv3-hero-video video { width: 100%; height: 107%; object-fit: cover; object-position: top center; display: block; }
.fv3-ponte { background: #111; color: #fff; border-radius: 14px; padding: 12px 14px; font-size: 14px; line-height: 1.5; margin: 0 0 14px; }
.fv3-numgrande { font-size: 44px; font-weight: 800; letter-spacing: -.02em; padding: 6px 0 10px; }
.fv3-range { width: 100%; accent-color: #111; height: 34px; }
.fv3-range-legendas { display: flex; justify-content: space-between; font-size: 11.5px; color: #8a8378; }
.fv3-ancora-pessoal { text-align: center; font-size: 15px; line-height: 1.55; background: #faf9f7; border: 1.5px dashed #d8d4cd; border-radius: 14px; padding: 12px 14px; margin: 14px 0 0; }
.fv3-roleta-overlay { position: fixed; inset: 0; z-index: 70; background: #fff; display: flex; align-items: center; justify-content: center; padding: 24px; overflow-y: auto; }
.fv3-roleta-x { position: fixed; top: 14px; right: 14px; z-index: 5; width: 36px; height: 36px; border: 0; border-radius: 999px; background: rgba(0,0,0,.06); color: #6f695f; font-size: 16px; cursor: pointer; }
.fv3-roleta-wrap { width: 100%; max-width: 380px; display: flex; flex-direction: column; align-items: center; }
.fv3-roda-area { position: relative; width: min(300px, 78vw); margin: 22px 0 6px; }
.fv3-roda { width: 100%; height: auto; transition: transform 4s cubic-bezier(.12,.82,.16,1); filter: drop-shadow(0 14px 30px rgba(0,0,0,.18)); }
.fv3-ponteiro { position: absolute; right: -14px; top: 50%; transform: translateY(-50%); font-size: 30px; color: #d4a437; text-shadow: 0 2px 6px rgba(0,0,0,.25); }
.fv3-premio-card { position: relative; width: 100%; margin-top: 18px; background: linear-gradient(145deg, #37302a 0%, #17140f 70%); border-radius: 22px; padding: 34px 20px; text-align: center; color: #fff; box-shadow: 0 18px 44px rgba(0,0,0,.28); }
.fv3-premio-off { font-size: 40px; font-weight: 800; letter-spacing: -.02em; }
.fv3-premio-sub { font-size: 13px; font-weight: 700; letter-spacing: .08em; color: #d4a437; margin-top: 6px; }
.fv3-sparkle { position: absolute; color: #fff; opacity: .9; animation: fv3sp 1.6s ease-in-out infinite; }
.fv3-sparkle.s1 { top: 12px; left: 18px; font-size: 20px; }
.fv3-sparkle.s2 { bottom: 14px; right: 22px; font-size: 26px; animation-delay: .4s; }
.fv3-sparkle.s3 { top: 20px; right: 52px; font-size: 13px; animation-delay: .9s; }
@keyframes fv3sp { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
.fv3-premio-preco { text-align: center; margin-top: 16px; }
.fv3-premio-preco b { font-size: 34px; letter-spacing: -.02em; display: inline-block; margin: 0 6px; }
.fv3-premio-preco .fv3-mini { display: block; margin-top: 2px; }
.fv3-demo { position: fixed; inset: 0; z-index: 60; background: #fff; display: flex; flex-direction: column; }
.fv3-demo-top { background: #111; color: #fff; font-size: 12.5px; font-weight: 700; letter-spacing: .04em; text-align: center; padding: 10px; }
.fv3-demo iframe { flex: 1; width: 100%; border: 0; }
.fv3-demo-cta { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(14px, env(safe-area-inset-bottom)); width: min(320px, calc(100vw - 40px)); box-shadow: 0 8px 30px rgba(0,0,0,.35); margin: 0; }
`;
