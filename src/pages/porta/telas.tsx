import { useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock, X } from "lucide-react";
import { BotaoPorta } from "./BotaoPorta";
import { NOME_DA_AREA, mesCurto, planoDe3Dias, type AreaPorta, type ComSem, type Opcao } from "./conteudo";

/**
 * As telas do meio da Porta (/comece): perguntas de 1 toque (1, 2 e 3), o
 * "com × sem o CORE" (4) e o plano de 3 dias com cadeado (5). Visual planner:
 * branco, grafite #16121c, magenta só no detalhe, Inter herdada.
 */
const GRAFITE = "#16121c";
const COR_SEM = "#a16207";
const COR_COM = "#d22d80";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7d8691]">{children}</p>;
}

/* ------------------------------------------------ telas 1, 2 e 3 */

export function PerguntaPorta({ eyebrow, titulo, opcoes, onEscolher, testid, compacta = false }: {
  eyebrow?: string;
  titulo: string;
  opcoes: Opcao[];
  onEscolher: (o: Opcao) => void;
  testid: string;
  /** chips mais baixos (tela 3) */
  compacta?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const indo = useRef(false);
  const escolher = (o: Opcao) => {
    if (indo.current) return;
    indo.current = true;
    setSel(o.id);
    // o toque aparece (preenchido) antes de avançar, como no Cal AI
    window.setTimeout(() => onEscolher(o), 170);
  };
  return (
    <div className="flex-1 flex flex-col" data-testid={testid}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.12] mt-1.5 text-balance" data-testid="porta-pergunta">{titulo}</h1>
      <div className={`mt-6 flex flex-col ${compacta ? "gap-2.5" : "gap-3"}`} role="list">
        {opcoes.map((o, i) => {
          const on = sel === o.id;
          return (
            <motion.button
              key={o.id}
              type="button"
              role="listitem"
              onClick={() => escolher(o)}
              data-testid={`porta-opcao-${o.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.22 }}
              className={`w-full flex items-center gap-3.5 rounded-2xl border-2 text-left transition-colors ${compacta ? "px-3.5 py-3" : "px-4 py-4"} ${on ? "border-[#16121c] bg-[#16121c] text-white" : "border-[#ebe7ef] bg-white text-[#16121c] active:bg-[#f7f5fa]"}`}
            >
              <span className={`grid place-items-center rounded-xl shrink-0 text-[22px] leading-none ${compacta ? "w-10 h-10" : "w-11 h-11"} ${on ? "bg-white/15" : "bg-[#f6f3f8]"}`} aria-hidden>{o.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-bold leading-tight">{o.label}</span>
                {o.sub && <span className={`block text-[13px] leading-snug mt-0.5 ${on ? "text-white/75" : "text-[#7d8691]"}`}>{o.sub}</span>}
              </span>
              {on && <Check className="w-5 h-5 shrink-0" strokeWidth={3} aria-hidden />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------ tela 4: com × sem */

export function ComSemPorta({ dados, hoje = new Date(), onNext }: { dados: ComSem; hoje?: Date; onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col" data-testid="porta-comsem" data-tipo={dados.tipo}>
      <Eyebrow>{dados.eyebrow}</Eyebrow>
      <h1 className="text-[25px] font-black tracking-[-0.02em] leading-[1.12] mt-1.5" data-testid="porta-comsem-titulo">
        <span style={{ color: COR_SEM }}>{dados.titulo}</span><br />{dados.subtitulo}
      </h1>
      {dados.tipo === "copy" ? <CardsComSem sem={dados.sem} com={dados.com} /> : <Grafico dados={dados} hoje={hoje} />}
      <motion.p className="text-[14px] text-[#5b6570] leading-snug mt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.4 }}>
        <strong className="text-[#16121c]">{dados.legenda}</strong>
      </motion.p>
      <BotaoPorta texto={dados.cta} onClick={onNext} testid="porta-comsem-cta" />
    </div>
  );
}

function CardsComSem({ sem, com }: { sem: string[]; com: string[] }) {
  return (
    <div className="mt-5 space-y-3">
      <motion.div className="rounded-2xl border-2 p-4" style={{ borderColor: "#e7e5e4", background: "#faf8f5" }} data-testid="porta-card-sem" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
        <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: COR_SEM }}>Sem o CORE</span>
        <ul className="mt-2 space-y-2">
          {sem.map((l) => (
            <li key={l} className="flex items-start gap-2.5 text-[15px] font-semibold leading-snug text-[#57534e]">
              <span className="grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5" style={{ background: "#e7e5e4", color: COR_SEM }} aria-hidden><X className="w-3 h-3" strokeWidth={3} /></span>
              {l}
            </li>
          ))}
        </ul>
      </motion.div>
      <motion.div className="rounded-2xl border-2 p-4" style={{ borderColor: COR_COM, background: "#fff5fa" }} data-testid="porta-card-com" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.35 }}>
        <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: COR_COM }}>Com o CORE</span>
        <ul className="mt-2 space-y-2">
          {com.map((l) => (
            <li key={l} className="flex items-start gap-2.5 text-[15px] font-extrabold leading-snug text-[#16121c]">
              <span className="grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5 text-white" style={{ background: COR_COM }} aria-hidden><Check className="w-3 h-3" strokeWidth={3.5} /></span>
              {l}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

const W = 320, H = 196, PAD_X = 14, PAD_TOP = 26, PAD_BOTTOM = 26;

/** O gráfico: dinheiro SEM eixo em reais (a forma da curva, rótulos em palavras); corpo em treinos por semana. */
function Grafico({ dados, hoje }: { dados: Extract<ComSem, { tipo: "dinheiro" | "treinos" }>; hoje: Date }) {
  const idClip = `pg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { sem, com } = useMemo(() => (dados.tipo === "treinos" ? { sem: dados.sem, com: dados.com } : { sem: [0, 1, 2, 3], com: [0, 0.42, 0.56, 0.66] }), [dados]);
  const treinos = dados.tipo === "treinos";
  const padDireita = treinos ? 50 : 14;
  const n = sem.length;
  const max = Math.max(...sem, ...com, 1) * (treinos ? 1.2 : 1.08);
  const x = (i: number) => PAD_X + (i / (n - 1)) * (W - PAD_X - padDireita);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM);
  const caminho = (s: number[]) => s.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${caminho(sem)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const marcas: Array<{ i: number; r: string }> = treinos
    ? [0, 4, 8, 12].map((i) => ({ i, r: i === 0 ? "hoje" : `${i / 4} ${i === 4 ? "mês" : "meses"}` }))
    : [0, 1, 2, 3].map((i) => ({ i, r: i === 0 ? "hoje" : mesCurto(hoje, i) }));
  const semFim = sem[n - 1], comFim = com[n - 1];
  const fmt = (v: number) => `${String(v).replace(".", ",")}/sem`;
  const ySem = y(semFim), yCom = y(comFim);
  const [ySemR, yComR] = Math.abs(ySem - yCom) < 16 ? (ySem < yCom ? [ySem, ySem + 16] : [yCom + 16, yCom]) : [ySem, yCom];

  return (
    <div className="mt-5 rounded-2xl border border-[#ebe7ef] bg-white px-2 pt-3 pb-1" data-testid="porta-grafico">
      <div className="flex items-center gap-4 px-2 text-[11.5px] font-semibold text-[#7d8691]" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={COR_SEM} strokeWidth="2" strokeDasharray="4 3" /></svg>Sem o CORE</span>
        <span className="inline-flex items-center gap-1.5"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={COR_COM} strokeWidth="2.5" /></svg>Com o CORE</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-1" role="img" aria-label={treinos ? `Sem o CORE: ${fmt(semFim)}. Com o CORE: ${fmt(comFim)}.` : "Sem o CORE o dinheiro some sem rastro. Com o CORE fica sob controle."}>
        <line x1={PAD_X} x2={W - padDireita} y1={y(0)} y2={y(0)} stroke="#ebe7ef" strokeWidth="1" />
        <line x1={PAD_X} x2={W - padDireita} y1={y(max / 2)} y2={y(max / 2)} stroke="#ebe7ef" strokeWidth="1" strokeDasharray="2 4" />
        {marcas.map((m) => (
          <text key={m.i} x={x(m.i)} y={H - 8} textAnchor={m.i === 0 ? "start" : m.i === n - 1 ? "end" : "middle"} fontSize="10.5" fontWeight="600" fill="#7d8691">{m.r}</text>
        ))}
        <defs>
          <clipPath id={`${idClip}-sem`}><motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }} /></clipPath>
          <clipPath id={`${idClip}-com`}><motion.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease: "easeOut", delay: 0.45 }} /></clipPath>
        </defs>
        {!treinos && <motion.path d={area} fill={COR_SEM} initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ delay: 1.0, duration: 0.6 }} />}
        <path d={caminho(sem)} fill="none" stroke={COR_SEM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" clipPath={`url(#${idClip}-sem)`} />
        <path d={caminho(com)} fill="none" stroke={COR_COM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${idClip}-com)`} />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.45, duration: 0.3 }}>
          <circle cx={x(n - 1)} cy={ySem} r="5.5" fill={COR_SEM} stroke="#fff" strokeWidth="2" />
          {treinos
            ? <text x={x(n - 1) + 9} y={ySemR + 4} fontSize="12" fontWeight="800" fill={GRAFITE}>{fmt(semFim)}</text>
            : <text x={x(n - 1) - 10} y={ySem + 4} textAnchor="end" fontSize="12" fontWeight="800" fill={GRAFITE}>Some sem rastro</text>}
        </motion.g>
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 0.3 }}>
          <circle cx={x(n - 1)} cy={yCom} r="5.5" fill={COR_COM} stroke="#fff" strokeWidth="2" />
          {treinos
            ? <text x={x(n - 1) + 9} y={yComR + 4} fontSize="12" fontWeight="800" fill={GRAFITE}>{fmt(comFim)}</text>
            : <text x={x(n - 1) - 4} y={yCom - 12} textAnchor="end" fontSize="12" fontWeight="800" fill={GRAFITE}>Sob controle</text>}
        </motion.g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------ tela 5: plano com cadeado */

export function PlanoPorta({ rota, p3, onDesbloquear }: { rota: AreaPorta; p3: string | null; onDesbloquear: () => void }) {
  const plano = planoDe3Dias(rota, p3);
  const info = NOME_DA_AREA[rota];
  return (
    <div className="flex-1 flex flex-col" data-testid="porta-plano">
      <Eyebrow>Feito com as suas respostas</Eyebrow>
      <h1 className="text-[26px] font-black tracking-[-0.025em] leading-[1.1] mt-1.5">Seu plano de 3 dias</h1>

      <div className="mt-5 rounded-2xl border-2 border-[#16121c] bg-white p-4" data-testid="porta-plano-card">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none" aria-hidden>{info.emoji}</span>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#16121c]">{info.nome}</span>
        </div>

        <motion.div className="mt-3.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} data-testid="porta-plano-dia1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#16121c] text-white text-[10.5px] font-extrabold tracking-wide px-2 py-[3px]">DIA 1</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: COR_COM }}>Hoje</span>
          </div>
          <p className="text-[17px] font-extrabold leading-snug text-[#16121c] mt-2">{plano.dia1}</p>
          {plano.motivo && <p className="text-[13px] text-[#7d8691] mt-1">Porque você disse: “{plano.motivo}”</p>}
        </motion.div>

        <div className="mt-4 pt-3.5 border-t border-[#ebe7ef] space-y-3">
          {[plano.dia2, plano.dia3].map((t, i) => (
            <div key={t} className="grid grid-cols-[52px_1fr_auto] gap-2 items-center" data-testid={`porta-plano-dia${i + 2}`} data-trancado="">
              <span className="rounded-md bg-[#efedf2] text-[#7d8691] text-[10.5px] font-extrabold tracking-wide text-center py-[3px]">DIA {i + 2}</span>
              <span className="text-[14px] font-semibold leading-snug text-[#16121c] select-none" style={{ filter: "blur(5px)" }} aria-hidden>{t}</span>
              <Lock className="w-4 h-4 text-[#7d8691]" strokeWidth={2.5} aria-label="Trancado" />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-[14px] leading-snug text-[#5b6570]" data-testid="porta-plano-nota">
        <Lock className="w-4 h-4 shrink-0 mt-[2px] text-[#16121c]" strokeWidth={2.5} aria-hidden />
        <span>Os dias 2 e 3 abrem quando você salva o plano na sua conta.</span>
      </p>

      <BotaoPorta texto="Desbloquear meu plano" seta={false} icone={<Lock className="w-4 h-4" strokeWidth={2.5} aria-hidden />} onClick={onDesbloquear} testid="porta-desbloquear" />
    </div>
  );
}
