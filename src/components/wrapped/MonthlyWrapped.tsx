import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getMonthTotals, getFinanceStorageKeys, readMonthData } from "@/components/finance/storage-keys";
import { computeSavingsRate } from "@/lib/finance-totals";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";
import { renderWrappedImage } from "./wrapped-share";

/**
 * Retrospectiva do mês — "Spotify Wrapped" das finanças.
 * Stories em tela cheia: tap na direita avança, esquerda volta, barras de
 * progresso no topo. Fecha no X. Último slide tem o perfil do mês + share.
 */

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
  const topCat = topCategories[0]?.label ?? "";

  // Perfil do mês — heurística simples e divertida em cima dos dados reais
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
    month, income, outflow,
    balance: income - outflow,
    savingsRate,
    topCategories, biggestExpense, pixPct,
    txCount: all.length,
    profile,
  };
};

/* --------------------------------------------------------------- slides */

const SLIDE_BG = [
  "linear-gradient(160deg, #1c1917 0%, #3b0764 130%)",
  "linear-gradient(160deg, #1c1917 0%, #14532d 140%)",
  "linear-gradient(160deg, #831843 0%, #1c1917 90%)",
  "linear-gradient(160deg, #1c1917 0%, #7c2d12 140%)",
  "linear-gradient(160deg, #164e63 0%, #1c1917 90%)",
  "linear-gradient(160deg, #1c1917 0%, #86198f 150%)",
  "linear-gradient(160deg, #D22D80 0%, #1c1917 95%)",
];

const Big = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.p
    initial={{ opacity: 0, y: 24, scale: 0.92 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className={`font-extrabold tracking-tight ${className}`}
  >
    {children}
  </motion.p>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <motion.p
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
    className="text-[12px] font-bold uppercase tracking-[0.25em] text-white/60 mb-4"
  >
    {children}
  </motion.p>
);

interface Props {
  data: WrappedData;
  onClose: () => void;
}

export const MonthlyWrapped = ({ data, onClose }: Props) => {
  const [idx, setIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const d = data;

  const slides = useMemo(() => {
    const s: React.ReactNode[] = [];

    s.push(
      <div key="intro" className="text-center">
        <motion.p
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="text-6xl mb-6"
        >
          🎁
        </motion.p>
        <Eyebrow>Retrospectiva CORE</Eyebrow>
        <Big className="text-5xl text-white leading-[1.05]">
          {d.month} fechou.<br />Bora ver como foi?
        </Big>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-white/50 text-sm mt-8">
          toca pra continuar →
        </motion.p>
      </div>,
    );

    s.push(
      <div key="fluxo" className="text-center">
        <Eyebrow>O fluxo do mês</Eyebrow>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-white/70 text-lg">entrou</motion.p>
        <Big className="text-6xl text-emerald-300">{fmt(d.income)}</Big>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="text-white/70 text-lg mt-6">saiu</motion.p>
        <motion.p initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.55, duration: 0.5 }} className="font-extrabold tracking-tight text-6xl text-rose-300">
          {fmt(d.outflow)}
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-8 inline-block rounded-full bg-white/10 px-6 py-2.5">
          <p className="text-white font-bold text-xl">
            {d.balance >= 0 ? "sobraram" : "faltaram"} {fmt(Math.abs(d.balance))}
          </p>
        </motion.div>
      </div>,
    );

    if (d.topCategories.length > 0) {
      const max = d.topCategories[0].value || 1;
      s.push(
        <div key="cats" className="w-full">
          <Eyebrow>Pra onde foi</Eyebrow>
          <Big className="text-4xl text-white mb-8">Seu top {d.topCategories.length} de gastos</Big>
          <div className="space-y-5">
            {d.topCategories.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.25 }}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-white font-bold text-lg">
                    <span className="text-white/40 mr-2">{i + 1}.</span>{c.label}
                  </span>
                  <span className="text-white/80 font-bold">{fmt(c.value)}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#D22D80] to-[#f0abfc]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.value / max) * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.25, duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>,
      );
    }

    if (d.biggestExpense) {
      s.push(
        <div key="biggest" className="text-center">
          <Eyebrow>O golpe mais forte</Eyebrow>
          <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 11, delay: 0.15 }} className="text-6xl mb-5">💥</motion.p>
          <Big className="text-6xl text-white">{fmt(d.biggestExpense.value)}</Big>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-white/70 text-xl mt-4">
            {d.biggestExpense.description}
            {d.biggestExpense.day && <span className="text-white/40"> · dia {d.biggestExpense.day}</span>}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="text-white/40 text-sm mt-6">
            um gasto só. respira.
          </motion.p>
        </div>,
      );
    }

    if (d.pixPct > 0) {
      s.push(
        <div key="pix" className="text-center">
          <Eyebrow>Seu jeito de pagar</Eyebrow>
          <Big className="text-[88px] leading-none text-cyan-300">{d.pixPct}%</Big>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white text-2xl font-bold mt-4">
            dos pagamentos no Pix ⚡
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-white/50 text-sm mt-4">
            {d.txCount} lançamentos registrados no mês
          </motion.p>
        </div>,
      );
    }

    s.push(
      <div key="rate" className="text-center">
        <Eyebrow>A conta que importa</Eyebrow>
        <Big className={`text-[88px] leading-none ${d.savingsRate >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {d.savingsRate.toFixed(0)}%
        </Big>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white text-2xl font-bold mt-4">
          {d.savingsRate >= 20 ? "da renda guardada 👏" : d.savingsRate >= 0 ? "da renda sobrou no fim" : "além da renda. mês difícil."}
        </motion.p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-white/50 text-sm mt-4">
          meta saudável: 20% ou mais
        </motion.p>
      </div>,
    );

    s.push(
      <div key="profile" className="text-center">
        <Eyebrow>Seu perfil de {d.month}</Eyebrow>
        <motion.p
          initial={{ scale: 0, rotate: 10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 10, delay: 0.2 }}
          className="text-7xl mb-5"
        >
          {d.profile.emoji}
        </motion.p>
        <Big className="text-5xl text-white">{d.profile.name}</Big>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-white/70 text-lg mt-4 max-w-[260px] mx-auto leading-snug">
          {d.profile.line}
        </motion.p>
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          onClick={async (e) => {
            e.stopPropagation();
            setSharing(true);
            trackEvent("wrapped_share", { month: d.month });
            const result = await renderWrappedImage(d);
            if (result === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
            setSharing(false);
          }}
          disabled={sharing}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-stone-900 font-bold px-8 h-13 py-3.5 text-base active:scale-95 transition-transform"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Compartilhar retrospectiva
        </motion.button>
      </div>,
    );

    return s;
  }, [d, sharing]);

  const advance = (dir: 1 | -1) => {
    const next = idx + dir;
    if (next < 0) return;
    if (next >= slides.length) { onClose(); return; }
    setIdx(next);
  };

  return (
    <div className="fixed inset-0 z-[400] select-none" style={{ background: SLIDE_BG[idx % SLIDE_BG.length] }}>
      {/* progresso */}
      <div className="absolute top-0 inset-x-0 z-10 flex gap-1.5 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className={`h-full bg-white transition-all duration-300 ${i < idx ? "w-full" : i === idx ? "w-full" : "w-0"}`} style={i === idx ? { opacity: 0.9 } : undefined} />
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-[max(1.6rem,calc(env(safe-area-inset-top)+0.9rem))] right-4 z-20 grid place-items-center w-9 h-9 rounded-full bg-white/15 text-white"
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
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm [&_button]:pointer-events-auto"
          >
            {slides[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
