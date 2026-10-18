import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, ChevronLeft, ChevronRight, Copy, Info, Lock, Pencil, QrCode, ShieldCheck, Smartphone, X } from "lucide-react";
import { computeDailyBudget } from "@/lib/finance-totals";
import "./funil-novo/funil-novo.css";

/**
 * /dev/funil-novo — DESENHO do funil web novo (18/10). SÓ NO SERVIDOR DE DESENVOLVIMENTO (some do
 * build), nada linkado no site. Dados falsos: não chama Asaas/Cakto, não cria conta, não grava nada.
 *
 * As 5 telas + pós-compra (o porquê de cada uma em scratchpad/funil-web-zero/A, B e C):
 *   1 renda (a 1ª tela JÁ é a pergunta; o toque na faixa avança) → 2 contas (chips com valor
 *   típico, editáveis) → 3 o número ("você pode gastar R$ X por dia", a MESMA conta do card
 *   QUANTO POSSO GASTAR HOJE: computeDailyBudget) → 4 oferta (anual 27,90 no Pix × mensal, bump,
 *   garantia) → 5 Pix na página (copiar no toque, nome do recebedor, validade, "já paguei")
 *   → 6 pós-compra (1 campo: e-mail → "Abrir meu CORE").
 *
 * Faixas e contas = as do "Vamos montar suas Finanças" da 1.0.16 (lib/montar-financas no ramo
 * v1016, ainda fora do main) — copiadas aqui pra o número do funil ser o número do app.
 *
 * Pra fotografar: ?etapa=renda|contas|resultado|oferta|pix|pago · ?renda=3000 · ?contas=aluguel,luz:180
 *                 · ?plano=mensal · ?bump=1 · ?copiado=1 · ?digitar=1
 */

/* ───────── PLACEHOLDERS (o dono decide) ───────── */
const PRECO_ANUAL_1O_ANO = 27.9;
const PRECO_ANUAL_DEPOIS = 97.9;
const PRECO_MENSAL = 14.9; // placeholder
const PRECO_BUMP = 9.9; // placeholder
const NOME_BUMP = "Plano de 30 dias pra organizar o mês"; // placeholder
const RECEBEDOR = "CAKTO PAGAMENTOS LTDA"; // depende do gateway (Asaas mostraria a razão social)
const VALIDADE_PIX_MIN = 30;

interface Faixa { id: string; rotulo: string; valor: number }
const FAIXAS: Faixa[] = [
  { id: "ate2", rotulo: "Até R$ 2 mil", valor: 1500 },
  { id: "2a4", rotulo: "R$ 2 a 4 mil", valor: 3000 },
  { id: "4a7", rotulo: "R$ 4 a 7 mil", valor: 5500 },
  { id: "7mais", rotulo: "Mais de R$ 7 mil", valor: 8000 },
];

interface Conta { id: string; nome: string; emoji: string; valor: number }
const CONTAS: Conta[] = [
  { id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 900 },
  { id: "luz", nome: "Luz", emoji: "💡", valor: 150 },
  { id: "internet", nome: "Internet", emoji: "📶", valor: 100 },
  { id: "celular", nome: "Celular", emoji: "📱", valor: 60 },
  { id: "streaming", nome: "Streaming", emoji: "🎬", valor: 45 },
  { id: "cartao", nome: "Cartão", emoji: "💳", valor: 600 },
  { id: "agua", nome: "Água", emoji: "💧", valor: 80 },
  { id: "condominio", nome: "Condomínio", emoji: "🏢", valor: 400 },
  { id: "academia", nome: "Academia", emoji: "🏋️", valor: 100 },
  { id: "saude", nome: "Plano de saúde", emoji: "🩺", valor: 300 },
  { id: "carro", nome: "Carro", emoji: "🚗", valor: 400 },
];

/* as 16 áreas do app, nos pastéis da Home */
const AREAS: { nome: string; emoji: string; cor: string }[] = [
  { nome: "Finanças", emoji: "💰", cor: "#fef3c7" },
  { nome: "Rotina", emoji: "☀️", cor: "#fce7f3" },
  { nome: "Treino", emoji: "💪", cor: "#dbeafe" },
  { nome: "Saúde", emoji: "🩺", cor: "#dcfce7" },
  { nome: "Dieta", emoji: "🥗", cor: "#ecfccb" },
  { nome: "Casa", emoji: "🏡", cor: "#ffedd5" },
  { nome: "Estudos", emoji: "📚", cor: "#ede9fe" },
  { nome: "+ 9", emoji: "✨", cor: "#f4f4f5" },
];

type Etapa = "renda" | "contas" | "resultado" | "oferta" | "pix" | "pago";
const ETAPAS: Etapa[] = ["renda", "contas", "resultado", "oferta", "pix", "pago"];

const reais = (v: number, casas = 0) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
const reaisDigitados = (t: string): number => {
  const so = String(t ?? "").split(",")[0].replace(/\D/g, "").slice(0, 7);
  return so ? parseInt(so, 10) : 0;
};

/** O número da tela 3 — a mesma função do card QUANTO POSSO GASTAR HOJE do Dashboard
 *  (montar-financas calcularMontar, sem o passo do cartão: aqui o cartão é mais uma conta fixa). */
function calcular(renda: number, contas: Conta[], agora = new Date()) {
  const validas = contas.filter((c) => c.valor > 0);
  const fixos = validas.reduce((s, c) => s + c.valor, 0);
  const b = computeDailyBudget(renda, fixos, [], validas.map((c) => ({ id: c.id, value: c.valor })), agora);
  return { renda, fixos, n: validas.length, livre: b.availableReal, porDia: b.cantSpend ? 0 : Math.round(b.perDay), dias: b.remainingDays, aperto: b.cantSpend };
}

/** Sobe do 0 ao número em ~0,9 s (sem animação pra quem pediu menos movimento). */
function useSobe(alvo: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(alvo); return; }
    let raf = 0; const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return v;
}

/** Copiar no navegador do Instagram: clipboard API e, se negar, o textarea de sempre. */
async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* cai no plano B */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

const PIX_FALSO =
  "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d5204000053039865405" +
  "27.905802BR5921CAKTO PAGAMENTOS LTDA6009SAO PAULO62140510PROTOTIPO6304ABCD";

function PixIcone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="currentColor" />
    </svg>
  );
}

export default function DevFunilNovo() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const etapaInicial = (ETAPAS.includes(q.get("etapa") as Etapa) ? q.get("etapa") : "renda") as Etapa;
  const contasIniciais = useMemo(() => {
    const m: Record<string, number> = {};
    const p = q.get("contas");
    if (p) p.split(",").forEach((s) => { const [id, v] = s.split(":"); const base = CONTAS.find((c) => c.id === id); if (base) m[id] = v ? Number(v) : base.valor; });
    else if (etapaInicial !== "renda" && etapaInicial !== "contas") { m.aluguel = 900; m.luz = 150; m.internet = 100; }
    return m;
  }, [q, etapaInicial]);

  const [etapa, setEtapa] = useState<Etapa>(etapaInicial);
  const [faixa, setFaixa] = useState<string | null>(null);
  const [renda, setRenda] = useState<number>(Number(q.get("renda")) || (etapaInicial === "renda" || etapaInicial === "contas" ? 0 : 3000));
  const [digitando, setDigitando] = useState(q.get("digitar") === "1");
  const [textoRenda, setTextoRenda] = useState("");
  const [contas, setContas] = useState<Record<string, number>>(contasIniciais);
  const [plano, setPlano] = useState<"anual" | "mensal">(q.get("plano") === "mensal" ? "mensal" : "anual");
  const [bump, setBump] = useState(q.get("bump") === "1");
  const [copiado, setCopiado] = useState(q.get("copiado") === "1");
  const [conferindo, setConferindo] = useState(false);
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pixDesde, setPixDesde] = useState(() => Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  const corpo = useRef<HTMLDivElement>(null);

  const ir = (e: Etapa) => { setEtapa(e); corpo.current?.scrollTo({ top: 0 }); if (e === "pix") { setPixDesde(Date.now()); } };
  const avisar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(null), 2600); };

  useEffect(() => { if (etapa !== "pix") return; const t = window.setInterval(() => setAgora(Date.now()), 1000); return () => window.clearInterval(t); }, [etapa]);

  const escolhidas: Conta[] = CONTAS.filter((c) => c.id in contas).map((c) => ({ ...c, valor: contas[c.id] }));
  const r = calcular(renda, escolhidas);
  const total = (plano === "anual" ? PRECO_ANUAL_1O_ANO : PRECO_MENSAL) + (bump ? PRECO_BUMP : 0);

  const escolherFaixa = (f: Faixa) => {
    setFaixa(f.id); setRenda(f.valor); setDigitando(false);
    window.setTimeout(() => ir("contas"), 160); // o realce aparece antes de trocar de tela
  };
  const alternarConta = (c: Conta) => setContas((m) => { const n = { ...m }; if (c.id in n) delete n[c.id]; else n[c.id] = c.valor; return n; });

  const copiar = async () => {
    await copiarTexto(PIX_FALSO); // no protótipo copia o código falso; mostra confirmação mesmo se o navegador negar
    setCopiado(true);
  };
  const jaPaguei = () => { setConferindo(true); window.setTimeout(() => { setConferindo(false); ir("pago"); }, 1400); };

  const restante = Math.max(0, VALIDADE_PIX_MIN * 60 - Math.floor((agora - pixDesde) / 1000));
  const mmss = `${String(Math.floor(restante / 60)).padStart(2, "0")}:${String(restante % 60).padStart(2, "0")}`;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const fimDoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const fimTxt = `${fimDoMes.getDate()}/${String(fimDoMes.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="fn" data-etapa={etapa}>
      <span className="fn-prototipo">PROTÓTIPO</span>
      <div className="fn-corpo" ref={corpo}>
        {etapa === "renda" && (
          <div className="fn-tela" key="renda">
            <div className="fn-topo"><span className="fn-marca"><i />CORE</span></div>
            <p className="fn-promessa">Descubra <b>quanto você pode gastar hoje</b> — em 20 segundos.</p>
            <div className="fn-barra"><i data-on="" /><i /></div>
            <div className="fn-q">
              <div className="fn-kicker">1 de 2</div>
              <h1>Quanto entra por mês?</h1>
              <p>Mais ou menos. Salário, freela, pensão — tudo junto.</p>
            </div>
            {!digitando ? (
              <div className="fn-faixas">
                {FAIXAS.map((f) => (
                  <button key={f.id} type="button" className="fn-faixa-btn" data-on={faixa === f.id ? "" : undefined} onClick={() => escolherFaixa(f)}>
                    <span>{f.rotulo}</span><ChevronRight size={20} strokeWidth={2.4} />
                  </button>
                ))}
                <button type="button" className="fn-faixa-btn" data-digitar="" onClick={() => { setDigitando(true); setFaixa(null); }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Pencil size={16} strokeWidth={2.2} />Prefiro digitar</span>
                  <ChevronRight size={20} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <>
                <div className="fn-folha">
                  <div className="fn-faixa-sec">💰 Renda do mês</div>
                  <div className="fn-renda">
                    <label>
                      <small>R$</small>
                      <input autoFocus inputMode="numeric" placeholder="0" aria-label="Quanto entra por mês"
                        value={textoRenda} onChange={(e) => { const n = reaisDigitados(e.target.value); setTextoRenda(n ? n.toLocaleString("pt-BR") : ""); setRenda(n); }} />
                    </label>
                  </div>
                </div>
                <div style={{ padding: "0 20px" }}>
                  <button type="button" className="fn-link" onClick={() => setDigitando(false)}>Voltar pras faixas</button>
                </div>
              </>
            )}
            {!digitando && <div className="fn-confia"><Lock size={13} strokeWidth={2.4} />Grátis · sem cadastro · resultado na hora</div>}
            {digitando && (
              <div className="fn-rodape">
                <button type="button" className="fn-cta" disabled={renda <= 0} onClick={() => ir("contas")}>Continuar</button>
              </div>
            )}
          </div>
        )}

        {etapa === "contas" && (
          <div className="fn-tela" key="contas">
            <div className="fn-topo">
              <button type="button" className="fn-voltar" onClick={() => ir("renda")}><ChevronLeft size={18} /><span>Voltar</span></button>
              <span className="fn-topo-dir">Entra {reais(renda)}</span>
            </div>
            <div className="fn-barra"><i data-on="" /><i data-on="" /></div>
            <div className="fn-q">
              <div className="fn-kicker">2 de 2</div>
              <h1>Quais contas chegam todo mês?</h1>
              <p>Toque nas suas. O valor é o típico — toque no número pra ajustar.</p>
            </div>
            <div className="fn-chips">
              {CONTAS.map((c) => (
                <button key={c.id} type="button" className="fn-chip" aria-pressed={c.id in contas} onClick={() => alternarConta(c)}>
                  <span aria-hidden>{c.emoji}</span>{c.nome}<small>{reais(contas[c.id] ?? c.valor)}</small>
                </button>
              ))}
            </div>
            {escolhidas.length > 0 ? (
              <div className="fn-folha">
                <div className="fn-faixa-sec">Suas contas do mês <b>{reais(r.fixos)}</b></div>
                {escolhidas.map((c) => (
                  <div className="fn-linha" key={c.id}>
                    <span className="fn-linha-emoji" aria-hidden>{c.emoji}</span>
                    <span className="fn-linha-nome">{c.nome}</span>
                    <label className="fn-valor">
                      <small>R$</small>
                      <input inputMode="numeric" aria-label={`Valor de ${c.nome}`} value={c.valor ? c.valor.toLocaleString("pt-BR") : ""}
                        onChange={(e) => { const n = reaisDigitados(e.target.value); setContas((m) => ({ ...m, [c.id]: n })); }} />
                    </label>
                    <button type="button" className="fn-tirar" style={{ background: "none" }} aria-label={`Tirar ${c.nome}`} onClick={() => alternarConta(c)}><X size={16} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fn-vazio">Nenhuma conta fixa? Tudo bem — o número sai do mesmo jeito.</div>
            )}
            <div className="fn-rodape">
              <button type="button" className="fn-cta" onClick={() => ir("resultado")}>
                <span>{escolhidas.length > 0 ? "Ver quanto posso gastar" : "Não tenho conta fixa"}</span><ChevronRight size={18} strokeWidth={2.6} />
              </button>
            </div>
          </div>
        )}

        {etapa === "resultado" && <Resultado r={r} fimTxt={fimTxt} onSeguir={() => ir("oferta")} onVoltar={() => ir("contas")} />}

        {etapa === "oferta" && (
          <div className="fn-tela" key="oferta">
            <div className="fn-topo">
              <button type="button" className="fn-voltar" onClick={() => ir("resultado")}><ChevronLeft size={18} /><span>Voltar</span></button>
              <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
            </div>
            <div className="fn-oferta-topo">
              <h1>Seu CORE está pronto</h1>
              <span className="fn-recibo"><Check size={14} strokeWidth={3} />Finanças montada · {r.aperto ? "plano de corte" : `${reais(r.porDia)}/dia`} · {r.n} {r.n === 1 ? "conta" : "contas"}</span>
            </div>
            <div className="fn-planos" role="radiogroup" aria-label="Plano">
              <button type="button" className="fn-plano" aria-pressed={plano === "anual"} onClick={() => setPlano("anual")}>
                <span className="fn-plano-selo">MELHOR PREÇO</span>
                <span className="fn-plano-nome">ANUAL<i>{plano === "anual" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>27,90</span>
                <span className="fn-plano-sub">1º ano, no Pix</span>
                <span className="fn-plano-mes">R$ 2,33/mês</span>
                <span className="fn-plano-depois">Depois, R$ 97,90/ano — só se você renovar</span>
              </button>
              <button type="button" className="fn-plano" aria-pressed={plano === "mensal"} onClick={() => setPlano("mensal")}>
                <span className="fn-plano-nome">MENSAL<i>{plano === "mensal" && <Check size={13} strokeWidth={3.2} />}</i></span>
                <span className="fn-plano-preco"><small>R$ </small>14,90</span>
                <span className="fn-plano-sub">por mês, no cartão</span>
                <span className="fn-plano-mes" data-cinza="">= R$ 178,80/ano</span>
                <span className="fn-plano-depois">Cancela quando quiser</span>
              </button>
            </div>
            <p className="fn-claro">
              {plano === "anual"
                ? <><b>Pagamento único de R$ 27,90.</b> Nada é cobrado sozinho: daqui a 1 ano a gente avisa e você decide se renova.</>
                : <><b>R$ 14,90 todo mês no cartão</b>, até você cancelar. Cancelar é 1 toque no app.</>}
            </p>
            <ul className="fn-inclui">
              <li><Check size={17} strokeWidth={2.8} /><span>Finanças montada com as suas contas</span></li>
              <li><Check size={17} strokeWidth={2.8} /><span>Rotina, treino, saúde e mais 12 áreas</span></li>
              <li><Check size={17} strokeWidth={2.8} /><span>No celular e no computador</span></li>
            </ul>
            <button type="button" className="fn-postit" aria-pressed={bump} onClick={() => setBump((b) => !b)}>
              <span className="fn-caixa">{bump && <Check size={15} strokeWidth={3.2} />}</span>
              <span className="fn-postit-txt">
                <b>+ {NOME_BUMP}</b>
                <span>Uma tarefa curta por dia, já dentro do seu CORE. Opcional.</span>
              </span>
              <span className="fn-postit-preco">+ R$ 9,90</span>
            </button>
            <div className="fn-garantia">
              <span className="fn-selo"><ShieldCheck size={21} strokeWidth={2.2} /></span>
              <p><b>Garantia de 7 dias</b>Não gostou? Pede em até 7 dias e devolvemos tudo.</p>
            </div>
            <div className="fn-rodape" style={{ marginTop: 14 }}>
              {plano === "anual" ? (
                <>
                  <button type="button" className="fn-cta" onClick={() => ir("pix")} data-testid="fn-pagar-pix">
                    <PixIcone /><span>Pagar {reais(total, 2)} com Pix</span>
                  </button>
                  <button type="button" className="fn-link" onClick={() => avisar("Protótipo: aqui abre o cartão (mesma página, sem sair do site).")}><u>Prefiro pagar no cartão</u></button>
                </>
              ) : (
                <button type="button" className="fn-cta" onClick={() => avisar("Protótipo: o mensal abre o cartão na mesma página.")}>
                  Assinar por {reais(total, 2)} no cartão
                </button>
              )}
            </div>
          </div>
        )}

        {etapa === "pix" && (
          <div className="fn-tela" key="pix">
            <div className="fn-topo">
              <button type="button" className="fn-voltar" onClick={() => ir("oferta")}><ChevronLeft size={18} /><span>Voltar</span></button>
              <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
            </div>
            <div className="fn-pix-topo">
              <small>PAGAMENTO COM PIX</small>
              <div className="fn-pix-valor">{reais(total, 2)}</div>
              <span className="fn-status"><i />Esperando o Pix</span>
            </div>
            <ol className="fn-passos">
              <li data-feito={copiado ? "" : undefined}><i>{copiado ? <Check size={13} strokeWidth={3.4} /> : 1}</i><span>Copie o código</span></li>
              <li><i>2</i><span>No app do banco: Pix → <b>Copia e Cola</b></span></li>
              <li><i>3</i><span>Volte aqui — a tela muda sozinha</span></li>
            </ol>
            <div className="fn-copiar">
              <button type="button" className="fn-copiar-btn" data-ok={copiado ? "" : undefined} onClick={() => { void copiar(); }} data-testid="fn-copiar">
                {copiado ? <><Check size={21} strokeWidth={3} /><span>Código copiado!</span></> : <><Copy size={20} strokeWidth={2.4} /><span>Copiar código Pix</span></>}
              </button>
              <div className="fn-copiado-dica">{copiado ? "Agora é só colar no app do seu banco." : ""}</div>
            </div>
            <div className="fn-recebedor">
              <Info size={18} strokeWidth={2.4} />
              <span>No banco, o Pix aparece em nome de <b>{RECEBEDOR}</b> — é o nosso processador de pagamento. Pode pagar sem susto.</span>
            </div>
            <div className="fn-validade">Este código vale por <b>{mmss}</b></div>
            <details className="fn-qr">
              <summary><QrCode size={18} strokeWidth={2.2} />Pagar com QR Code<span>de outro aparelho</span></summary>
              <div className="fn-qr-caixa"><div><QRCodeSVG value={PIX_FALSO} size={156} level="M" /></div></div>
            </details>
            <div className="fn-rodape" style={{ marginTop: 10 }}>
              <button type="button" className="fn-sec" onClick={jaPaguei} disabled={conferindo} data-testid="fn-ja-paguei">
                {conferindo ? "Conferindo seu Pix…" : "Já paguei"}
              </button>
            </div>
          </div>
        )}

        {etapa === "pago" && (
          <div className="fn-tela" key="pago">
            <div className="fn-pago">
              <div className="fn-pago-ok"><Check size={34} strokeWidth={3.2} /></div>
              <h1>Pronto! Seu CORE é seu.</h1>
              <p>{reais(total, 2)} recebido · {plano === "anual" ? "1º ano liberado" : "assinatura ativa"}</p>
            </div>
            <div className="fn-folha fn-salvo">
              <div className="fn-faixa-sec">💰 Suas Finanças, montadas <b>{r.aperto ? "" : `${reais(r.porDia)}/dia`}</b></div>
              <div className="fn-conta"><span>Entra no mês</span>{reais(r.renda)}</div>
              <div className="fn-conta"><span>Contas fixas ({r.n})</span>{r.fixos ? `− ${reais(r.fixos)}` : reais(0)}</div>
              <div className="fn-email">
                <label htmlFor="fn-email">Seu e-mail, pra salvar seu CORE</label>
                <input id="fn-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="voce@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <p>É com ele que você entra no celular e no computador. Sem senha agora.</p>
              </div>
            </div>
            <div className="fn-rodape">
              <button type="button" className="fn-cta" disabled={!emailOk} onClick={() => avisar("Protótipo: aqui abre o CORE na web já logado, com as Finanças montadas.")}>
                <span>Abrir meu CORE</span><ChevronRight size={18} strokeWidth={2.6} />
              </button>
              <button type="button" className="fn-link" onClick={() => avisar("Protótipo: aqui abre a loja do celular (App Store / Google Play).")}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Smartphone size={16} strokeWidth={2.2} /><u>Baixar no celular</u></span>
              </button>
            </div>
          </div>
        )}
      </div>
      {aviso && <div className="fn-aviso" role="status">{aviso}</div>}
    </div>
  );
}

function Resultado({ r, fimTxt, onSeguir, onVoltar }: { r: ReturnType<typeof calcular>; fimTxt: string; onSeguir: () => void; onVoltar: () => void }) {
  const falta = Math.abs(Math.round(r.livre));
  const n = useSobe(r.aperto ? falta : r.porDia);
  return (
    <div className="fn-tela" key="resultado">
      <div className="fn-topo">
        <button type="button" className="fn-voltar" onClick={onVoltar}><ChevronLeft size={18} /><span>Ajustar</span></button>
        <span className="fn-topo-dir"><span className="fn-marca" style={{ fontSize: 12 }}><i />CORE</span></span>
      </div>
      <div className="fn-res">
        {!r.aperto ? (
          <div className="fn-grande">
            <small>Você pode gastar hoje</small>
            <strong><span className="rs">R$</span>{n.toLocaleString("pt-BR")}<em>por dia</em></strong>
            <p>até o fim do mês ({fimTxt} · {r.dias} dias, contando hoje), já tirando as contas fixas.</p>
          </div>
        ) : (
          <div className="fn-grande" data-aperto="">
            <small>Suas contas passam da renda</small>
            <strong><span className="rs">R$</span>{n.toLocaleString("pt-BR")}<em>a mais por mês</em></strong>
            <p>Este mês não fecha sem cortar. No CORE você vê conta por conta e decide por onde começar.</p>
          </div>
        )}
        <div className="fn-folha">
          <div className="fn-faixa-sec">🧾 A conta do seu mês</div>
          <div className="fn-conta"><span>Entra no mês</span>{reais(r.renda)}</div>
          <div className="fn-conta"><span>Contas fixas ({r.n})</span>{r.fixos ? `− ${reais(r.fixos)}` : reais(0)}</div>
          <div className="fn-conta" data-forte=""><span>Livre pro mês</span>{r.livre < 0 ? `− ${reais(Math.abs(Math.round(r.livre)))}` : reais(Math.round(r.livre))}</div>
          {!r.aperto && <div className="fn-conta" data-dia=""><span>÷ {r.dias} dias</span><b>{reais(r.porDia)} por dia</b></div>}
        </div>
        <p className="fn-nota">É a mesma conta que o CORE faz todo dia. Lançou um gasto, o número se ajusta.</p>
        <div className="fn-mais">
          <p>Seu CORE já tem isso montado <span>— e mais 15 áreas: rotina, treino, saúde…</span></p>
          <div className="fn-ladrilhos">
            {AREAS.map((a, i) => (
              <div className="fn-ladrilho" key={a.nome} style={{ background: a.cor }} data-feito={i === 0 ? "" : undefined}><b aria-hidden>{a.emoji}</b>{a.nome}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="fn-rodape">
        <button type="button" className="fn-cta" onClick={onSeguir} data-testid="fn-ver-core"><span>Ver meu CORE</span><ChevronRight size={18} strokeWidth={2.6} /></button>
      </div>
    </div>
  );
}
