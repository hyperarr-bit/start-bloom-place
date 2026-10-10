import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { MESES_DO_GRAFICO, SEMANAS_DO_GRAFICO, copyDoGrafico, formatarReais, mesAlvo, projecao, type NumeroDaRota } from "@/lib/funil-numeros";

const FUNIL = "w";

/**
 * "SEM O CORE × COM O CORE" (10/10, passo `grafico_com_sem`, chave FUNIL_CALAI) — o passo
 * no meio do funil, no lugar da prova do gasto. Cal AI mete um gráfico no meio do quiz;
 * aqui ele é feito com O QUE A ROTA PERMITE (lib/funil-numeros, dono 10/10):
 *
 *   dinheiro (e a porta "Tudo"): GRÁFICO em R$ — "R$ 500 somem por mês. Até janeiro,
 *             R$ 1.500 sem rastro." — a curva "sem" sobe linear, a "com" achata.
 *   corpo:    GRÁFICO em treinos/semana, 12 semanas — "Sem o CORE: 2 treinos por semana
 *             viram 1 em 3 meses. Com o CORE: 3 por semana, sem falhar."
 *   rotina / metas (e saude): COPY, sem número — "Sua vida sem o CORE × com o CORE":
 *             dois cards (sem = âmbar/cinza, com = magenta) com 3 linhas curtas cada.
 *
 * Visual: planner (branco, grafite, Inter herdada). Duas séries → legenda + rótulo
 * direto no fim de cada linha (identidade nunca só pela cor; a "sem" é tracejada).
 * Cores validadas (dataviz): sem = âmbar escuro #a16207, com = magenta #d22d80.
 *
 * Eventos: `funnel_view step=grafico_com_sem {rota, formato, numero}` sai do ComecarW;
 * aqui só o `funnel_click cta=grafico_quero_ver`.
 */
const COR_SEM = "#a16207";
const COR_COM = "#d22d80";
const W = 320, H = 196, PAD_X = 14, PAD_TOP = 22, PAD_BOTTOM = 26, PAD_DIREITA = 62;

export function GraficoComSem({ numero, hoje = new Date(), onNext }: { numero: NumeroDaRota; hoje?: Date; onNext: () => void }) {
  const copy = useMemo(() => copyDoGrafico(numero, hoje), [numero, hoje]);
  const seguir = () => {
    trackEvent("funnel_click", { cta: "grafico_quero_ver", funil: FUNIL, rota: numero.rota, formato: numero.formato, numero: numero.valor, estimado: numero.estimado });
    onNext();
  };
  const botao = (
    <div className="mt-auto pt-4 pb-1">
      <button
        type="button"
        data-testid="grafico-quero-ver"
        onClick={seguir}
        className="w-full rounded-full py-4 text-[16px] font-extrabold text-white active:scale-[0.99] transition-transform inline-flex items-center justify-center gap-2"
        style={{ background: "#16121c" }}
      >
        {copy.cta} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  if (numero.tipo === "copy") {
    const linhas = numero.copy ?? { sem: [], com: [] };
    return (
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col" data-testid="grafico-com-sem" data-rota={numero.rota} data-formato="copy">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Pela sua resposta</p>
        <h2 className="text-[25px] font-black tracking-[-0.02em] leading-[1.12] mt-1.5" data-testid="grafico-titulo">
          <span style={{ color: COR_SEM }}>{copy.titulo}</span><br />{copy.subtitulo}
        </h2>
        <div className="mt-5 space-y-3">
          <motion.div
            className="rounded-2xl border-2 p-4" style={{ borderColor: "#e7e5e4", background: "#faf8f5" }}
            data-testid="grafico-card-sem"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}
          >
            <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: COR_SEM }}>{copy.semRotulo}</span>
            <ul className="mt-2 space-y-2">
              {linhas.sem.map((l, i) => (
                <motion.li key={l} className="flex items-start gap-2.5 text-[15px] font-semibold leading-snug text-[#57534e]" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.12 }}>
                  <span className="grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5" style={{ background: "#e7e5e4", color: COR_SEM }} aria-hidden><X className="w-3 h-3" strokeWidth={3} /></span>
                  {l}
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            className="rounded-2xl border-2 p-4" style={{ borderColor: COR_COM, background: "#fff5fa" }}
            data-testid="grafico-card-com"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.35 }}
          >
            <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: COR_COM }}>{copy.comRotulo}</span>
            <ul className="mt-2 space-y-2">
              {linhas.com.map((l, i) => (
                <motion.li key={l} className="flex items-start gap-2.5 text-[15px] font-extrabold leading-snug text-[#16121c]" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75 + i * 0.12 }}>
                  <span className="grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5 text-white" style={{ background: COR_COM }} aria-hidden><Check className="w-3 h-3" strokeWidth={3.5} /></span>
                  {l}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
        <motion.p className="text-[14px] text-muted-foreground leading-snug mt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.4 }}>
          <strong className="text-foreground">{copy.legenda}</strong> Dez minutos por dia, no lugar certo.
        </motion.p>
        {botao}
      </div>
    );
  }

  return <Grafico numero={numero} hoje={hoje} copy={copy} botao={botao} />;
}

function Grafico({ numero, hoje, copy, botao }: { numero: NumeroDaRota; hoje: Date; copy: ReturnType<typeof copyDoGrafico>; botao: React.ReactNode }) {
  // ids de clipPath únicos por instância (o React os gera com ":" — vale em url(#…) mesmo assim)
  const idClip = `grafico${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { sem, com } = useMemo(() => projecao(numero), [numero]);
  const n = sem.length;
  const max = Math.max(...sem, ...com, 1) * (numero.tipo === "treinos" ? 1.15 : 1);
  const x = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X - PAD_DIREITA);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);
  const caminho = (serie: number[]) => serie.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${caminho(sem)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const fmt = (v: number) => (numero.tipo === "reais" ? formatarReais(v) : `${String(v).replace(".", ",")}/sem`);
  // eixo x: meses (reais) ou as 12 semanas em 4 marcas (treinos)
  const marcasX: Array<{ i: number; rotulo: string }> = numero.tipo === "reais"
    ? sem.map((_, i) => ({ i, rotulo: i === 0 ? "hoje" : i === n - 1 ? mesAlvo(hoje, MESES_DO_GRAFICO) : mesAlvo(hoje, i) }))
    : [0, 4, 8, SEMANAS_DO_GRAFICO].map((i) => ({ i, rotulo: i === 0 ? "hoje" : `${i / 4} ${i === 4 ? "mês" : "meses"}` }));
  const semFim = sem[n - 1], comFim = com[n - 1];
  // os dois rótulos de ponta não podem se cobrir: afasta o de baixo se ficarem a menos de 16 px
  const ySemRot = y(semFim), yComRot = y(comFim);
  const [yRotA, yRotB] = ySemRot <= yComRot ? [ySemRot, Math.max(yComRot, ySemRot + 16)] : [Math.max(ySemRot, yComRot + 16), yComRot];

  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col" data-testid="grafico-com-sem" data-rota={numero.rota} data-formato="grafico" data-numero={numero.valor}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Pela sua resposta</p>
      <h2 className="text-[25px] font-black tracking-[-0.02em] leading-[1.12] mt-1.5" data-testid="grafico-titulo">
        <span style={{ color: COR_SEM }}>{copy.titulo}</span><br />{copy.subtitulo}
      </h2>

      <div className="mt-5 rounded-2xl border border-border bg-card px-2 pt-3 pb-1">
        {/* legenda: sempre presente (2 séries), com a forma da linha, não só a cor */}
        <div className="flex items-center gap-4 px-2 text-[11.5px] font-semibold text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={COR_SEM} strokeWidth="2" strokeDasharray="4 3" /></svg>{copy.semRotulo}</span>
          <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={COR_COM} strokeWidth="2.5" /></svg>{copy.comRotulo}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-1" role="img" aria-label={`${copy.semRotulo}: ${fmt(semFim)}. ${copy.comRotulo}: ${fmt(comFim)}.`}>
          <line x1={PAD_X} x2={W - PAD_DIREITA} y1={y(0)} y2={y(0)} stroke="hsl(var(--border))" strokeWidth="1" />
          <line x1={PAD_X} x2={W - PAD_DIREITA} y1={y(max / 2)} y2={y(max / 2)} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 4" />
          {marcasX.map((m) => (
            <text key={m.i} x={x(m.i)} y={H - 8} textAnchor={m.i === 0 ? "start" : m.i === n - 1 ? "end" : "middle"} fontSize="10.5" fontWeight="600" fill="hsl(var(--muted-foreground))">{m.rotulo}</text>
          ))}
          {/* as linhas se REVELAM da esquerda pra direita por um clip que cresce (não por
              pathLength: o framer anima pathLength com stroke-dasharray e apagaria o
              tracejado da "sem") */}
          <defs>
            <clipPath id={`${idClip}-sem`}><motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }} /></clipPath>
            <clipPath id={`${idClip}-com`}><motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease: "easeOut", delay: 0.45 }} /></clipPath>
          </defs>
          {numero.tipo === "reais" && (
            /* área sob a "sem": o acumulado que some, bem leve */
            <motion.path d={area} fill={COR_SEM} initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ delay: 1.0, duration: 0.6 }} />
          )}
          <path d={caminho(sem)} fill="none" stroke={COR_SEM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" clipPath={`url(#${idClip}-sem)`} data-testid="grafico-linha-sem" />
          <path d={caminho(com)} fill="none" stroke={COR_COM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${idClip}-com)`} data-testid="grafico-linha-com" />
          {/* pontas: marcador ≥ 8 px com anel da superfície + rótulo direto (texto em tinta, não na cor da série) */}
          <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.45, duration: 0.3 }} style={{ transformOrigin: `${x(n - 1)}px ${y(semFim)}px` }}>
            <circle cx={x(n - 1)} cy={y(semFim)} r="5.5" fill={COR_SEM} stroke="hsl(var(--card))" strokeWidth="2" />
            <text x={x(n - 1) + 9} y={(ySemRot <= yComRot ? yRotA : yRotA) + 4} fontSize="12" fontWeight="800" fill="hsl(var(--foreground))" data-testid="grafico-sem-valor">{fmt(semFim)}</text>
          </motion.g>
          <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.7, duration: 0.3 }} style={{ transformOrigin: `${x(n - 1)}px ${y(comFim)}px` }}>
            <circle cx={x(n - 1)} cy={y(comFim)} r="5.5" fill={COR_COM} stroke="hsl(var(--card))" strokeWidth="2" />
            <text x={x(n - 1) + 9} y={yRotB + 4} fontSize="12" fontWeight="800" fill="hsl(var(--foreground))" data-testid="grafico-com-valor">{fmt(comFim)}</text>
          </motion.g>
        </svg>
      </div>

      <motion.p className="text-[14px] text-muted-foreground leading-snug mt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.4 }}>
        <strong className="text-foreground">{copy.legenda}</strong>{numero.tipo === "reais" ? " Registrar leva segundos — e o que você vê, você controla." : " Treino marcado é treino que acontece."}
      </motion.p>
      {botao}
    </div>
  );
}
