import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import { X, Share2, Loader2 } from "lucide-react";
import { getMonthTotals, getFinanceStorageKeys, readMonthData } from "@/components/finance/storage-keys";
import { computeSavingsRate } from "@/lib/finance-totals";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";
import { renderWrappedImage } from "./wrapped-share";

/**
 * Retrospectiva do mês — "Spotify Wrapped" das finanças.
 * Stories em tela cheia: tap na direita avança, esquerda volta, barras de
 * progresso no topo. Um slide de EGO condicional: se o mês foi bom, infla
 * (comparação honesta, número grande, ouro); se foi ruim, mostra a realidade
 * sem dourar — com o corte mais óbvio na mesa.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado",
  transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  saude: "Saúde", farmacia: "Farmácia", vestuario: "Vestuário",
  educacao: "Educação", eletronicos: "Eletrônicos", delivery: "Delivery",
  presente: "Presentes", pets: "Pets", moradia: "Moradia",
  contas_casa: "Contas da Casa", plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas", internet_telefone: "Internet/Telefone",
  academia: "Academia", beleza: "Beleza", outros: "Outros",
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

export type EgoMoment =
  | { kind: "saver"; rate: number; saved: number }
  | { kind: "raise"; pct: number; prevMonth: string }
  | { kind: "cutter"; pct: number; prevMonth: string }
  | { kind: "modest"; saved: number }
  | { kind: "reality"; deficit: number; cut: { label: string; value: number } | null };

export interface WrappedData {
  month: string;
  income: number;
  outflow: number;
  balance: number;
  savingsRate: number;
  topCategories: { label: string; value: number }[];
  biggestExpense: { description: string; value: number; day: string } | null;
  pixPct: number;
  txCount: number;
  ego: EgoMoment;
  profile: { emoji: string; name: string; line: string };
}

/** Lê os dados do mês e monta a retrospectiva. Null se o mês não tem dados. */
export const buildWrappedData = (month: string, userId: string | null): WrappedData | null => {
  const totals = getMonthTotals(month, userId);
  const keys = getFinanceStorageKeys(month);
  const expenses: any[] = readMonthData(userId, keys.expenses) || [];
  const fixed: any[] = readMonthData(userId, keys.fixed) || [];

  const income = totals.receitas;
  const outflow = totals.custosFixos + totals.custosVariaveis;
  if (income <= 0 && outflow <= 0) return null;

  const all = [...expenses, ...fixed];
  const byCategory: Record<string, number> = {};
  for (const e of all) {
    const cat = e.category || "outros";
    byCategory[cat] = (byCategory[cat] || 0) + (e.value || 0);
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, value]) => ({ label: CATEGORY_LABELS[cat] || cat, value }));

  const biggest = [...expenses].sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const biggestExpense = biggest
    ? {
        description: biggest.description || CATEGORY_LABELS[biggest.category] || "Gasto",
        value: biggest.value || 0,
        day: biggest.date ? new Date(`${biggest.date}T12:00:00`).getDate().toString() : "",
      }
    : null;

  const paid = all.filter((e) => e.paymentMethod);
  const pixPct = paid.length > 0
    ? Math.round((paid.filter((e) => e.paymentMethod === "pix").length / paid.length) * 100)
    : 0;

  const savingsRate = computeSavingsRate(income, outflow);
  const balance = income - outflow;

  // ---- comparação com o mês anterior (pro momento de ego) ----
  const prevMonth = MONTHS[(MONTHS.indexOf(month) + 11) % 12];
  const prev = getMonthTotals(prevMonth, userId);
  const prevOutflow = prev.custosFixos + prev.custosVariaveis;
  const incomeUpPct = prev.receitas > 0 ? ((income - prev.receitas) / prev.receitas) * 100 : 0;
  const spentDownPct = prevOutflow > 0 ? ((prevOutflow - outflow) / prevOutflow) * 100 : 0;

  // ---- momento de ego: só infla se mereceu; senão, realidade na mesa ----
  let ego: EgoMoment;
  if (balance < 0) {
    // Corte sugerido: maior categoria VARIÁVEL (fixo não dá pra cortar amanhã)
    const varByCat: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || "outros";
      varByCat[cat] = (varByCat[cat] || 0) + (e.value || 0);
    }
    const topVar = Object.entries(varByCat).sort((a, b) => b[1] - a[1])[0];
    ego = {
      kind: "reality",
      deficit: Math.abs(balance),
      cut: topVar ? { label: CATEGORY_LABELS[topVar[0]] || topVar[0], value: topVar[1] } : null,
    };
  } else if (savingsRate >= 20) {
    ego = { kind: "saver", rate: savingsRate, saved: balance };
  } else if (incomeUpPct >= 10) {
    ego = { kind: "raise", pct: incomeUpPct, prevMonth };
  } else if (spentDownPct >= 10) {
    ego = { kind: "cutter", pct: spentDownPct, prevMonth };
  } else {
    ego = { kind: "modest", saved: balance };
  }

  const topCat = topCategories[0]?.label ?? "";
  const profile =
    savingsRate >= 30
      ? { emoji: "🐷", name: "Cofre Forte", line: `Guardou ${savingsRate.toFixed(0)}% da renda. Elite.` }
      : ["Restaurante", "Delivery"].includes(topCat)
      ? { emoji: "🍽️", name: "O Gourmet", line: `${topCat} liderou seus gastos este mês.` }
      : topCat === "Lazer"
      ? { emoji: "🎢", name: "Vida Boa", line: "Lazer no topo — viveu o mês, literalmente." }
      : topCat === "Vestuário"
      ? { emoji: "👟", name: "Estiloso(a)", line: "O guarda-roupa agradece." }
      : savingsRate >= 10
      ? { emoji: "⚖️", name: "Equilibrista", line: "Fechou no azul, com folga. Consistência é tudo." }
      : savingsRate >= 0
      ? { emoji: "🤏", name: "No Limite", line: "Fechou no azul... por pouco. Próximo mês a gente folga." }
      : { emoji: "🌪️", name: "Mês Turbulento", line: "Saiu mais do que entrou. Acontece — agora tá no radar." };

  return {
    month, income, outflow, balance, savingsRate,
    topCategories, biggestExpense, pixPct,
    txCount: all.length,
    ego, profile,
  };
};

/* ------------------------------------------------------------ primitivas */

/** Número que "conta" até o valor — o momento-assinatura dos wrappeds. */
const CountUp = ({ to, render, delay = 0.3, duration = 1.1 }: {
  to: number;
  render: (v: number) => string;
  delay?: number;
  duration?: number;
}) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, { delay, duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => controls.stop();
  }, [to, delay, duration]);
  return <>{render(v)}</>;
};

/** Blobs desfocados flutuando no fundo — profundidade sem custo de layout. */
const Blobs = ({ a, b }: { a: string; b: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
    <motion.div
      className="absolute w-[420px] h-[420px] rounded-full blur-3xl"
      style={{ background: a, top: "-12%", left: "-25%", opacity: 0.5 }}
      animate={{ x: [0, 30, 0], y: [0, 24, 0] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute w-[380px] h-[380px] rounded-full blur-3xl"
      style={{ background: b, bottom: "-14%", right: "-28%", opacity: 0.45 }}
      animate={{ x: [0, -26, 0], y: [0, -20, 0] }}
      transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <motion.p
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="text-[12px] font-bold uppercase tracking-[0.28em] text-white/55 mb-5"
  >
    {children}
  </motion.p>
);

const Pop = ({ children, delay = 0.15, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 26, scale: 0.94 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

/* --------------------------------------------------------------- slides */

type SlideDef = { bg: string; blobs: [string, string]; node: React.ReactNode };

interface Props {
  data: WrappedData;
  onClose: () => void;
}

export const MonthlyWrapped = ({ data, onClose }: Props) => {
  const [idx, setIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const d = data;

  const slides = useMemo<SlideDef[]>(() => {
    const s: SlideDef[] = [];

    s.push({
      bg: "linear-gradient(165deg, #0c0a09 0%, #3b0764 160%)",
      blobs: ["#D22D80", "#7c3aed"],
      node: (
        <div className="text-center">
          <motion.p
            initial={{ scale: 0, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="text-7xl mb-7"
          >
            🎁
          </motion.p>
          <Eyebrow>Retrospectiva CORE</Eyebrow>
          <Pop className="text-[44px] font-black text-white leading-[1.02] tracking-tight">
            {d.month} fechou.<br />Bora ver como foi?
          </Pop>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-white/45 text-sm mt-9">
            toca pra continuar →
          </motion.p>
        </div>
      ),
    });

    s.push({
      bg: "linear-gradient(165deg, #0c0a09 0%, #052e16 150%)",
      blobs: ["#10b981", "#D22D80"],
      node: (
        <div className="text-center">
          <Eyebrow>O fluxo do mês</Eyebrow>
          <Pop delay={0.1}>
            <p className="text-white/60 text-lg">entrou</p>
            <p className="font-black tracking-tight text-[64px] leading-none text-emerald-300 tabular-nums">
              <CountUp to={d.income} render={fmt} delay={0.3} />
            </p>
          </Pop>
          <Pop delay={0.7}>
            <p className="text-white/60 text-lg mt-7">saiu</p>
            <p className="font-black tracking-tight text-[64px] leading-none text-rose-300 tabular-nums">
              <CountUp to={d.outflow} render={fmt} delay={0.9} />
            </p>
          </Pop>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.7, type: "spring", stiffness: 200, damping: 14 }}
            className="mt-9 inline-block rounded-full border border-white/20 bg-white/10 backdrop-blur px-7 py-3"
          >
            <p className="text-white font-bold text-xl">
              {d.balance >= 0 ? "sobraram" : "faltaram"} {fmt(Math.abs(d.balance))}
            </p>
          </motion.div>
        </div>
      ),
    });

    if (d.topCategories.length > 0) {
      const max = d.topCategories[0].value || 1;
      s.push({
        bg: "linear-gradient(165deg, #500724 0%, #0c0a09 90%)",
        blobs: ["#D22D80", "#f59e0b"],
        node: (
          <div className="w-full">
            <Eyebrow>Pra onde foi</Eyebrow>
            <Pop className="text-[40px] font-black text-white tracking-tight leading-[1.05] mb-9">
              Seu pódio<br />de gastos
            </Pop>
            <div className="space-y-6">
              {d.topCategories.map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-white font-bold text-xl">
                      <span className="mr-2.5">{["🥇", "🥈", "🥉"][i]}</span>{c.label}
                    </span>
                    <span className="text-white/85 font-black tabular-nums">{fmt(c.value)}</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #D22D80, #fda4af)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max((c.value / max) * 100, 8)}%` }}
                      transition={{ delay: 0.6 + i * 0.28, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (d.biggestExpense) {
      s.push({
        bg: "linear-gradient(165deg, #0c0a09 0%, #7c2d12 160%)",
        blobs: ["#f97316", "#D22D80"],
        node: (
          <div className="text-center">
            <Eyebrow>O golpe mais forte</Eyebrow>
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 170, damping: 10, delay: 0.15 }}
              className="text-7xl mb-6"
            >
              💥
            </motion.p>
            <p className="font-black tracking-tight text-[68px] leading-none text-white tabular-nums">
              <CountUp to={d.biggestExpense.value} render={fmt} delay={0.4} />
            </p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="text-white/75 text-2xl font-bold mt-5">
              {d.biggestExpense.description}
              {d.biggestExpense.day && <span className="text-white/40 font-normal"> · dia {d.biggestExpense.day}</span>}
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-white/40 text-sm mt-7">
              um gasto só. respira.
            </motion.p>
          </div>
        ),
      });
    }

    if (d.pixPct > 0) {
      s.push({
        bg: "linear-gradient(165deg, #083344 0%, #0c0a09 95%)",
        blobs: ["#06b6d4", "#D22D80"],
        node: (
          <div className="text-center">
            <Eyebrow>Seu jeito de pagar</Eyebrow>
            <p className="font-black tracking-tight text-[110px] leading-none text-cyan-300 tabular-nums">
              <CountUp to={d.pixPct} render={(v) => `${Math.round(v)}%`} delay={0.3} />
            </p>
            <Pop delay={0.9} className="text-white text-2xl font-bold mt-5">
              dos pagamentos no Pix ⚡
            </Pop>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-white/45 text-sm mt-5">
              {d.txCount} lançamentos registrados no mês
            </motion.p>
          </div>
        ),
      });
    }

    // ---- MOMENTO DE EGO (ou de realidade) ----
    if (d.ego.kind === "reality") {
      const e = d.ego;
      s.push({
        bg: "linear-gradient(170deg, #1c1917 0%, #450a0a 170%)",
        blobs: ["#57534e", "#7f1d1d"],
        node: (
          <div className="text-center">
            <Eyebrow>A real de {d.month}</Eyebrow>
            <p className="font-black tracking-tight text-[72px] leading-none text-rose-300 tabular-nums">
              <CountUp to={e.deficit} render={(v) => `-${fmt(v)}`} delay={0.3} />
            </p>
            <Pop delay={0.9} className="text-white text-xl font-bold mt-5">
              saiu mais do que entrou.
            </Pop>
            {e.cut && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
                className="mt-8 rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur px-5 py-4 text-left"
              >
                <p className="text-white/50 text-[11px] font-bold uppercase tracking-wider mb-1">O corte mais óbvio</p>
                <p className="text-white text-lg font-bold">
                  {e.cut.label}: {fmt(e.cut.value)} no mês
                </p>
                <p className="text-white/60 text-sm mt-1">
                  Metade disso já cobria {fmt(Math.min(e.cut.value / 2, e.deficit))} do rombo.
                </p>
              </motion.div>
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="text-white/40 text-sm mt-7">
              sem drama — agora tá no radar.
            </motion.p>
          </div>
        ),
      });
    } else {
      const e = d.ego;
      const headline =
        e.kind === "saver" ? (
          <>
            <p className="font-black tracking-tight text-[110px] leading-none text-amber-300 tabular-nums">
              <CountUp to={e.rate} render={(v) => `${v.toFixed(0)}%`} delay={0.4} />
            </p>
            <Pop delay={1} className="text-white text-2xl font-bold mt-4">da renda guardada 👏</Pop>
          </>
        ) : e.kind === "raise" ? (
          <>
            <p className="font-black tracking-tight text-[110px] leading-none text-amber-300 tabular-nums">
              <CountUp to={e.pct} render={(v) => `+${v.toFixed(0)}%`} delay={0.4} />
            </p>
            <Pop delay={1} className="text-white text-2xl font-bold mt-4">de renda vs {e.prevMonth} 📈</Pop>
          </>
        ) : e.kind === "cutter" ? (
          <>
            <p className="font-black tracking-tight text-[110px] leading-none text-amber-300 tabular-nums">
              <CountUp to={e.pct} render={(v) => `-${v.toFixed(0)}%`} delay={0.4} />
            </p>
            <Pop delay={1} className="text-white text-2xl font-bold mt-4">de gastos vs mês passado ✂️</Pop>
          </>
        ) : (
          <>
            <p className="font-black tracking-tight text-[84px] leading-none text-amber-300 tabular-nums">
              <CountUp to={e.saved} render={fmt} delay={0.4} />
            </p>
            <Pop delay={1} className="text-white text-2xl font-bold mt-4">guardados no azul ✅</Pop>
          </>
        );

      s.push({
        bg: "linear-gradient(170deg, #422006 0%, #0c0a09 90%)",
        blobs: ["#f59e0b", "#D22D80"],
        node: (
          <div className="text-center">
            <motion.p
              initial={{ scale: 0, rotate: 12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 190, damping: 10 }}
              className="text-6xl mb-5"
            >
              🏆
            </motion.p>
            <Eyebrow>Momento de respeito</Eyebrow>
            {headline}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-300/10 backdrop-blur px-5 py-4"
            >
              <p className="text-amber-100/90 text-[15px] leading-relaxed">
                {e.kind === "saver" || e.kind === "modest" ? (
                  <>Pesquisas mostram que <strong className="text-white">7 em cada 10 brasileiros</strong> fecham o mês sem guardar nada. Você guardou <strong className="text-white">{fmt(d.balance)}</strong>.</>
                ) : e.kind === "raise" ? (
                  <>Renda subindo e conta no azul — <strong className="text-white">{fmt(d.balance)}</strong> guardados no mês.</>
                ) : (
                  <>Cortar gasto sem cortar vida é raro. E ainda sobrou <strong className="text-white">{fmt(d.balance)}</strong>.</>
                )}
              </p>
            </motion.div>
          </div>
        ),
      });
    }

    s.push({
      bg: "linear-gradient(160deg, #D22D80 0%, #0c0a09 92%)",
      blobs: ["#f0abfc", "#7c3aed"],
      node: (
        <div className="text-center">
          <Eyebrow>Seu perfil de {d.month}</Eyebrow>
          <motion.p
            initial={{ scale: 0, rotate: 10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 10, delay: 0.2 }}
            className="text-8xl mb-6"
          >
            {d.profile.emoji}
          </motion.p>
          <Pop className="text-[52px] font-black text-white tracking-tight leading-none">{d.profile.name}</Pop>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-white/70 text-lg mt-5 max-w-[270px] mx-auto leading-snug">
            {d.profile.line}
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            onClick={async (e) => {
              e.stopPropagation();
              setSharing(true);
              trackEvent("wrapped_share", { month: d.month });
              const result = await renderWrappedImage(d);
              if (result === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
              setSharing(false);
            }}
            disabled={sharing}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-white text-stone-900 font-bold px-8 py-3.5 text-base shadow-[0_12px_36px_-8px_rgba(0,0,0,0.6)] active:scale-95 transition-transform"
          >
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Compartilhar retrospectiva
          </motion.button>
        </div>
      ),
    });

    return s;
  }, [d, sharing]);

  const advance = (dir: 1 | -1) => {
    const next = idx + dir;
    if (next < 0) return;
    if (next >= slides.length) { onClose(); return; }
    setIdx(next);
  };

  const slide = slides[idx];

  return (
    <div className="fixed inset-0 z-[400] select-none transition-[background] duration-500" style={{ background: slide.bg }}>
      <Blobs a={slide.blobs[0]} b={slide.blobs[1]} />

      {/* progresso */}
      <div className="absolute top-0 inset-x-0 z-20 flex gap-1.5 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className={`h-full bg-white transition-all duration-300 ${i <= idx ? "w-full" : "w-0"}`} style={i === idx ? { opacity: 0.95 } : undefined} />
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-[max(1.6rem,calc(env(safe-area-inset-top)+0.9rem))] right-4 z-30 grid place-items-center w-9 h-9 rounded-full bg-white/15 text-white backdrop-blur"
      >
        <X className="w-5 h-5" />
      </button>

      {/* zonas de toque */}
      <div className="absolute inset-y-0 left-0 w-1/3 z-[5]" onClick={() => advance(-1)} />
      <div className="absolute inset-y-0 right-0 w-2/3 z-[5]" onClick={() => advance(1)} />

      {/* conteúdo — z acima das zonas de toque; só os botões capturam clique,
          o resto deixa passar pro avanço de slide */}
      <div className="relative z-10 h-full flex items-center justify-center px-8 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-sm [&_button]:pointer-events-auto"
          >
            {slide.node}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
