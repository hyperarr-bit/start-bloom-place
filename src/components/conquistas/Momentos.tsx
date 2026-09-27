import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { MARCOS_SEQUENCIA } from "@/lib/sequencia";
import { CHAVE_VISTAS } from "@/lib/conquistas-registro";
import type { Badge } from "@/components/gamification/types";
import { Adesivo } from "./adesivos-arte";
import { Roseta } from "./Roseta";
import { compartilharAdesivo, compartilharRoseta } from "./compartilhar-conquistas";
import { useConquistas, useEfeitosSequencia, usePerfilConquistas, useSequencia } from "./use-conquistas";

/**
 * MOMENTOS (26/09, "estilo Duolingo, com a nossa cara"): adesivo novo sendo
 * colado e a roseta dos marcos de 7/30/100 dias seguidos. Cada um aparece UMA
 * vez (gravado em `conquistas-vistas`), um de cada vez (fila) e nunca por cima
 * de outra tela aberta (a comemoração do dia 100, um diálogo, uma folha).
 *
 * Na 1ª abertura desta versão tudo o que já estava conquistado entra como
 * "visto" em silêncio — ninguém ganha uma fila de nove festas atrasadas.
 *
 * Montado na Home e nas Conquistas (o App.tsx não é deste pacote): quem anota
 * num módulo vê o momento ao voltar pra Home.
 */

type Vistas = { adesivos: string[]; marcos: number[] };

const lerVistas = (v: unknown): Vistas | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as { adesivos?: unknown; marcos?: unknown };
  return {
    adesivos: Array.isArray(o.adesivos) ? o.adesivos.filter((x): x is string => typeof x === "string") : [],
    marcos: Array.isArray(o.marcos) ? o.marcos.filter((x): x is number => typeof x === "number") : [],
  };
};

type Item = { tipo: "marco"; dias: number } | { tipo: "adesivo"; badge: Badge };

/** Outra camada em cima da tela? (comemoração do 100, diálogo, folha de baixo) */
const outraTelaAberta = () =>
  typeof document !== "undefined" &&
  !!document.querySelector('[data-testid="celebracao-100"], [role="dialog"]:not([data-momento]), [role="alertdialog"]');

// Confete leve: 16 pedaços nas cores do app, caem uma vez.
const CORES = ["#d22d80", "#F5B301", "#4F8BFF", "#22c55e", "#fb923c"];
const PEDACOS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: 4 + ((i * 53) % 92),
  atraso: 0.35 + (i % 6) * 0.08,
  dur: 2.1 + (i % 4) * 0.28,
  giro: (i % 2 ? 1 : -1) * (140 + ((i * 37) % 180)),
  cor: CORES[i % CORES.length],
  w: 6 + (i % 3) * 2.5,
  redondo: i % 3 === 0,
}));

const Confete = () => (
  <>
    {PEDACOS.map((p) => (
      <motion.span
        key={p.id}
        aria-hidden="true"
        className="pointer-events-none absolute top-0"
        style={{ left: `${p.x}%`, width: p.w, height: p.redondo ? p.w : p.w * 1.7, background: p.cor, borderRadius: p.redondo ? "50%" : 2 }}
        initial={{ y: -30, rotate: 0, opacity: 0 }}
        animate={{ y: "105vh", rotate: p.giro, opacity: [0, 1, 1, 0.4] }}
        transition={{ delay: p.atraso, duration: p.dur, ease: "easeIn" }}
      />
    ))}
  </>
);

const pontilhado = {
  backgroundImage: "radial-gradient(circle, hsl(var(--foreground) / .13) 1.4px, transparent 1.6px)",
  backgroundSize: "22px 22px",
};

interface CascaProps {
  rotulo: string;
  testid: string;
  children: React.ReactNode;
  rodape: React.ReactNode;
}

const Casca = ({ rotulo, testid, children, rodape }: CascaProps) => {
  const reduzir = useReducedMotion();
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      data-momento=""
      data-testid={testid}
      className="fixed inset-0 z-[400] flex flex-col bg-background text-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={pontilhado} />
      {!reduzir && <Confete />}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">{children}</div>
      <div className="relative w-full max-w-md mx-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-2.5">{rodape}</div>
    </motion.div>
  );
};

/** O adesivo "caindo" na folha: gira um pouco e assenta com um quique curto. */
const Colando = ({ children }: { children: React.ReactNode }) => {
  const reduzir = useReducedMotion();
  return (
    <motion.div
      initial={reduzir ? { opacity: 0 } : { y: -340, rotate: -26, scale: 1.25, opacity: 0 }}
      animate={reduzir ? { opacity: 1 } : { y: 0, rotate: -5, scale: 1, opacity: 1 }}
      // quique LEVE: amortecimento ~0,7 passa uns 15 px do ponto e volta (medido: com 12 passava 80 px)
      transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 21, mass: 0.9, opacity: { duration: 0.15 } }}
    >
      {children}
    </motion.div>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] mb-5" style={{ color: "hsl(var(--accent))" }}>
    {children}
  </p>
);

const botaoPrimario = "h-12 rounded-xl bg-foreground text-background font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform";
const botaoSecundario = "h-12 rounded-xl border border-border bg-card font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60";

export const MomentoAdesivo = ({ badge, nome, membroDesde, onContinuar, onVerAdesivos }: {
  badge: Badge; nome: string; membroDesde: string; onContinuar: () => void; onVerAdesivos?: () => void;
}) => {
  const [enviando, setEnviando] = useState(false);
  const compartilhar = async () => {
    setEnviando(true);
    try {
      await compartilharAdesivo({ id: badge.id, titulo: badge.name, descricao: badge.description, nome, membroDesde });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Casca
      rotulo={`Adesivo novo: ${badge.name}`}
      testid="momento-adesivo"
      rodape={
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={compartilhar} disabled={enviando} className={botaoSecundario}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartilhar
            </button>
            <button type="button" onClick={onContinuar} className={botaoPrimario}>Continuar</button>
          </div>
          {onVerAdesivos && (
            <button type="button" onClick={onVerAdesivos} className="w-full py-1.5 text-xs font-semibold text-muted-foreground">
              Ver meus adesivos ›
            </button>
          )}
        </>
      }
    >
      <Eyebrow>Adesivo novo</Eyebrow>
      <Colando>
        <Adesivo id={badge.id} tamanho={196} bordaGrossa titulo={badge.name} />
      </Colando>
      <motion.h2 className="mt-7 text-[30px] font-black tracking-tight leading-[1.05]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        {badge.name}
      </motion.h2>
      <motion.p className="mt-2 text-[15px] text-muted-foreground max-w-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {badge.description}
      </motion.p>
    </Casca>
  );
};

export const MomentoMarco = ({ dias, nome, membroDesde, nivel, onContinuar }: {
  dias: number; nome: string; membroDesde: string; nivel: string; onContinuar: () => void;
}) => {
  const [enviando, setEnviando] = useState<"cor" | "transparente" | null>(null);
  const postar = async (transparente: boolean) => {
    setEnviando(transparente ? "transparente" : "cor");
    try {
      await compartilharRoseta({ dias, nome, membroDesde, nivel, transparente });
    } finally {
      setEnviando(null);
    }
  };
  return (
    <Casca
      rotulo={`${dias} dias seguidos`}
      testid="momento-marco"
      rodape={
        <>
          <button type="button" onClick={() => postar(false)} disabled={!!enviando} className={`${botaoPrimario} w-full`}>
            {enviando === "cor" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Postar nos Stories
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => postar(true)} disabled={!!enviando} className={`${botaoSecundario} flex-col gap-0 leading-tight`}>
              <span className="inline-flex items-center gap-1.5">
                {enviando === "transparente" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Fundo transparente
              </span>
              <span className="text-[10.5px] font-medium text-muted-foreground">pra colar na sua foto</span>
            </button>
            <button type="button" onClick={onContinuar} className={botaoSecundario}>Continuar</button>
          </div>
        </>
      }
    >
      <Eyebrow>Marco de sequência</Eyebrow>
      <Colando>
        <Roseta dias={dias} nivel={nivel} membroDesde={membroDesde} largura={196} />
      </Colando>
      <motion.h2 className="mt-6 text-[30px] font-black tracking-tight leading-[1.05]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        {dias} dias seguidos!
      </motion.h2>
      <motion.p
        className="mt-1.5 text-[22px] text-muted-foreground"
        style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Constância tem prêmio.
      </motion.p>
    </Casca>
  );
};

/** Orquestra a fila de momentos + as escritas da sequência (uma vez por tela). */
export const MomentosConquistas = () => {
  const { get, set, loaded } = useUserData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seq = useSequencia();
  useEfeitosSequencia(seq);
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const vistasCru = get<unknown>(CHAVE_VISTAS, undefined);
  const vistas = useMemo(() => lerVistas(vistasCru), [vistasCru]);

  // linha de base (1ª abertura): o que já está conquistado não vira festa atrasada
  useEffect(() => {
    if (!loaded || vistasCru !== undefined) return;
    set(
      CHAVE_VISTAS,
      { adesivos: conq.adesivos.filter((b) => b.unlocked).map((b) => b.id), marcos: MARCOS_SEQUENCIA.filter((m) => m <= seq.recorde) },
      { system: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, vistasCru === undefined]);

  const fila = useMemo<Item[]>(() => {
    if (!loaded || !vistas) return [];
    const itens: Item[] = [];
    // pelo RECORDE: quem bateu 7 e quebrou antes de abrir a Home ainda ganha a roseta dos 7
    const marco = [...MARCOS_SEQUENCIA].reverse().find((m) => seq.recorde >= m && !vistas.marcos.includes(m));
    if (marco) itens.push({ tipo: "marco", dias: marco });
    for (const b of conq.folha) {
      if (b.unlocked && b.category !== "sequencia" && !vistas.adesivos.includes(b.id)) itens.push({ tipo: "adesivo", badge: b });
    }
    return itens;
  }, [loaded, vistas, seq.recorde, conq.folha]);

  // espera a tela assentar e nenhuma outra camada estar aberta
  const [liberado, setLiberado] = useState(false);
  const temFila = fila.length > 0;
  useEffect(() => {
    if (!temFila) { setLiberado(false); return; }
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (!vivo) return;
      if (outraTelaAberta()) t = setTimeout(tentar, 1200);
      else setLiberado(true);
    };
    t = setTimeout(tentar, 900);
    return () => { vivo = false; clearTimeout(t); };
  }, [temFila]);

  const atual = liberado ? fila[0] : undefined;
  const chaveAtual = atual ? (atual.tipo === "marco" ? `marco-${atual.dias}` : atual.badge.id) : null;

  useEffect(() => {
    if (atual?.tipo === "marco") trackEvent("sequencia_marco", { dias: atual.dias });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveAtual]);

  const marcarVisto = (item: Item) => {
    const v = lerVistas(get<unknown>(CHAVE_VISTAS, undefined)) ?? { adesivos: [], marcos: [] };
    if (item.tipo === "marco") {
      const marcos = [...new Set([...v.marcos, ...MARCOS_SEQUENCIA.filter((m) => m <= item.dias)])];
      const adesivos = [...new Set([...v.adesivos, ...MARCOS_SEQUENCIA.filter((m) => m <= item.dias).map((m) => `sequencia-${m}`)])];
      set(CHAVE_VISTAS, { adesivos, marcos }, { system: true });
    } else {
      set(CHAVE_VISTAS, { ...v, adesivos: [...new Set([...v.adesivos, item.badge.id])] }, { system: true });
    }
  };

  const continuar = () => { if (atual) marcarVisto(atual); };
  const verAdesivos = pathname.startsWith("/conquistas")
    ? undefined
    : () => {
        if (atual) marcarVisto(atual);
        navigate("/conquistas", { state: { origem: "celebracao" } });
      };

  return (
    <AnimatePresence mode="wait">
      {atual?.tipo === "marco" && (
        <MomentoMarco key={chaveAtual!} dias={atual.dias} nome={perfil.nome} membroDesde={perfil.membroDesde} nivel={conq.nivel.name} onContinuar={continuar} />
      )}
      {atual?.tipo === "adesivo" && (
        <MomentoAdesivo key={chaveAtual!} badge={atual.badge} nome={perfil.nome} membroDesde={perfil.membroDesde} onContinuar={continuar} onVerAdesivos={verAdesivos} />
      )}
    </AnimatePresence>
  );
};
