import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { PRECO_ANUAL_DEPOIS, PLANOS, VALOR_OFERTA, preco, reais, type PlanoHoje } from "./conteudo";
import "./upsell-animado.css";

/**
 * Os desenhos animados dos upsells do /hoje (aprovados pelo dono 18/10, protótipo /dev/upsell-animado do ramo
 * prototipos-funil2). Só CSS + SVG — leve no navegador do Instagram, sem lib nova, sem vídeo. Com
 * prefers-reduced-motion tudo aparece direto no estado final e o confete some (upsell-animado.css).
 *   GraficoPraSempre → up1 (47): "quanto você paga" renovando × pra sempre, a linha se desenhando
 *   Etiqueta         → down (27): o 47 riscado à mão e o 27 caindo no lugar
 *   Confete          → tela do pago: 1 chuva leve (~2,5 s)
 */

/** Custo acumulado em 4 marcos (hoje, 1, 2, 3 anos): renovando o plano × pagando o "pra sempre" agora.
 *  A renovação NÃO é automática — a nota embaixo diz "se você renovar todo ano/mês". */
/* 26/10 (oferta "anual" do /inicio): `contas` opcional troca os números (entrada, renovação por ano, upgrade) e a nota.
 * Sem a prop, o /hoje fica exatamente como era. */
export function GraficoPraSempre({ plano, contas }: { plano: PlanoHoje; contas?: { entrada: number; porAno: number; upgrade: number; nota: string } }) {
  const g = useMemo(() => {
    const entrada = contas?.entrada ?? PLANOS[plano].valor;
    const porAno = contas?.porAno ?? (plano === "anual" ? PRECO_ANUAL_DEPOIS : PLANOS.mensal.valor * 12);
    const renovando = [0, 1, 2, 3].map((k) => Math.round((entrada + porAno * k) * 100) / 100);
    const sempre = Math.round((entrada + (contas?.upgrade ?? VALOR_OFERTA.hv47)) * 100) / 100;
    const max = renovando[3];
    const X = [16, 88, 160, 232];
    const y = (v: number) => 128 - (v / max) * 108;
    const cinza = renovando.map((v, i) => `${i ? "L" : "M"}${X[i]} ${y(v).toFixed(1)}`).join(" ");
    return { renovando, sempre, X, y, cinza, ys: y(sempre) };
  }, [plano, contas?.entrada, contas?.porAno, contas?.upgrade]);
  const fim = g.renovando[3];
  const nota = contas ? contas.nota : plano === "anual"
    ? `* renovando = se você renovar todo ano por ${reais(PRECO_ANUAL_DEPOIS, 2)}. Nada renova sozinho.`
    : `* renovando = se você renovar todo mês por ${reais(PLANOS.mensal.valor, 2)}. Nada renova sozinho.`;
  return (
    <div className="ua-graf" data-testid="hoje-up1-grafico">
      <span className="ua-adesivo" aria-hidden>nunca mais renova ✦</span>
      <div className="ua-graf-topo">
        <span>Quanto você paga</span>
        <span className="ua-leg" aria-hidden>
          <span><i style={{ background: "#c4c4c4" }} />renovando*</span>
          <span style={{ color: "#b0236f" }}><i style={{ background: "#d6338a" }} />pra sempre</span>
        </span>
      </div>
      <svg viewBox="0 0 300 150" role="img" aria-label={`Em 3 anos: ${preco(fim)} se você renovar, ${preco(g.sempre)} com o CORE pra sempre`}>
        <defs>
          <linearGradient id="ua-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d6338a" stopOpacity=".16" />
            <stop offset="1" stopColor="#d6338a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 56, 92, 128].map((yy) => <line key={yy} className="ua-grade" x1="10" x2="292" y1={yy} y2={yy} />)}
        {["hoje", "1 ano", "2 anos", "3 anos"].map((t, i) => <text key={t} className="ua-eixo" x={g.X[i]} y="146" textAnchor={i === 0 ? "start" : "middle"}>{t}</text>)}
        <path className="ua-area" d={`M${g.X[0]} ${g.ys} L${g.X[3]} ${g.ys} L${g.X[3]} 128 L${g.X[0]} 128 Z`} />
        <path className="ua-l-cinza" d={g.cinza} />
        <path className="ua-l-mag" d={`M${g.X[0]} ${g.ys} L${g.X[3]} ${g.ys}`} />
        {g.renovando.map((v, i) => (
          <circle key={i} className="ua-ponto" cx={g.X[i]} cy={g.y(v)} r="3.5" fill="#fff" stroke="#c4c4c4" strokeWidth="2.5" style={{ animationDelay: `${0.45 + i * 0.4}s` }} />
        ))}
        <text className="ua-rot" x={g.X[3] + 10} y={g.y(fim) + 4} fontSize="12" fontWeight="800" fill="#8a8a8a" style={{ animationDelay: "1.7s" }}>{preco(Math.round(fim))}</text>
        <circle className="ua-ponto" cx={g.X[3]} cy={g.ys} r="6" fill="#d6338a" stroke="#fff" strokeWidth="2.5" style={{ animationDelay: "2.5s" }} />
        <text className="ua-rot" x={g.X[3] + 12} y={g.ys + 4} fontSize="13" fontWeight="800" fill="#b0236f" style={{ animationDelay: "2.55s" }}>{preco(g.sempre)}</text>
        <Estrela x={g.X[3] - 16} y={g.ys - 22} s={9} atraso={2.6} />
        <Estrela x={g.X[3] + 20} y={g.ys - 16} s={6} atraso={2.75} cor="#f59e0b" />
        <Estrela x={g.X[3] - 2} y={g.ys + 14} s={5} atraso={2.9} />
      </svg>
      <p className="ua-nota" data-testid="hoje-up1-nota">{nota}</p>
    </div>
  );
}

function Estrela({ x, y, s, atraso, cor = "#d6338a" }: { x: number; y: number; s: number; atraso: number; cor?: string }) {
  const d = `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`;
  return <path className="ua-estrela" d={d} fill={cor} style={{ animationDelay: `${atraso}s` }} />;
}

/** down: a etiqueta de ingresso — o preço velho riscado à mão, o novo cai no lugar. */
export function Etiqueta({ de, por, nome }: { de: number; por: number; nome: string }) {
  const [inteiro, centavos] = preco(por).replace(/^R\$\s*/, "").split(",");
  return (
    <div className="ua-ticket" data-testid="hoje-down-etiqueta" role="img" aria-label={`De ${preco(de)} por ${preco(por)}`}>
      <div className="ua-ticket-nome">{nome}</div>
      <div className="ua-velho">
        {preco(de)}
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden><path d="M2 14 C 30 6, 60 12, 98 5" /></svg>
      </div>
      <span className="ua-novo"><small>+ R$</small>{inteiro}{centavos ? <small>,{centavos}</small> : null}</span>
      <span className="ua-economia"><Sparkles size={13} strokeWidth={2.6} />− {preco(Math.round((de - por) * 100) / 100)} só nesta tela</span>
      <div className="ua-ticket-sub">pagamento único no Pix</div>
      <div className="ua-estrelas" aria-hidden>
        <svg width="60" height="60" style={{ right: 6, top: 30 }} viewBox="0 0 60 60"><Estrela x={30} y={30} s={9} atraso={1.5} /></svg>
        <svg width="40" height="40" style={{ left: 18, top: 70 }} viewBox="0 0 40 40"><Estrela x={20} y={20} s={6} atraso={1.7} cor="#f59e0b" /></svg>
        <svg width="40" height="40" style={{ right: 34, bottom: 30 }} viewBox="0 0 40 40"><Estrela x={20} y={20} s={5} atraso={1.85} /></svg>
      </div>
    </div>
  );
}

const CORES = ["#d6338a", "#f59e0b", "#262626", "#16a34a", "#f9a8d4", "#fde68a"];
/** 34 pedaços com posições fixas (pseudoaleatório determinístico). */
const PEDACOS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    left: `${Math.round(r(1) * 100)}%`, x: `${Math.round((r(2) - 0.5) * 140)}px`, rot: `${Math.round(360 + r(3) * 540)}deg`,
    d: `${(2 + r(4) * 1.2).toFixed(2)}s`, a: `${(r(5) * 0.5).toFixed(2)}s`, cor: CORES[i % CORES.length],
    w: r(6) > 0.5 ? 8 : 6, h: r(7) > 0.5 ? 12 : 7, round: r(8) > 0.75,
  };
});

/** 1 chuva de confete leve (só CSS; some com prefers-reduced-motion). */
export function Confete() {
  return (
    <div className="ua-confete" aria-hidden data-testid="hoje-confete">
      {PEDACOS.map((p, i) => (
        <i key={i} style={{
          left: p.left, background: p.cor, width: p.w, height: p.h, borderRadius: p.round ? "50%" : 2,
          ["--x" as string]: p.x, ["--r" as string]: p.rot, ["--d" as string]: p.d, ["--a" as string]: p.a,
        }} />
      ))}
    </div>
  );
}

/** O check verde que se desenha, com uma onda em volta. */
export function SeloPago() {
  return (
    <div className="ua-selo">
      <div className="fn-pago-ok">
        <svg className="ua-check" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
    </div>
  );
}
