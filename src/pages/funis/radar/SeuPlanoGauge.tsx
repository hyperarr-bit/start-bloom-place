import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { AREAS, GASTO_ANCHOR, type AreaKey } from "@/lib/funnel";

/**
 * SEU PLANO — o pico de endowment do funil (web + app; decisão do dono
 * 23/07 noite, estudo Cal AI/BitePal). Entra DEPOIS da demo (o plano
 * promete, a demo já provou) e antes do cadastro: plano → compromisso →
 * "salvar meu plano" → paywall.
 *
 * A lei da tela: NENHUM bloco genérico — cada elemento existe porque a
 * pessoa respondeu algo (hero = número dela + data; semana = missão como
 * faixa de hábito real; tiles = ecos das respostas) e aparece com a cara
 * do produto. ZERO preço aqui — preço mora só no paywall.
 */

const ACAO_DIA1: Record<AreaKey, string> = {
  dinheiro: "anotar os gastos do dia — só isso",
  rotina: "montar seus 3 hábitos-chave",
  corpo: "registrar sua primeira refeição",
  saude: "fazer seu primeiro check-in",
  metas: "escrever sua meta nº 1",
};

const HERO_AREA: Record<Exclude<AreaKey, "dinheiro">, [string, string]> = {
  rotina: ["Sua rotina inteira", "sob controle"],
  corpo: ["Treino e dieta", "no trilho, enfim"],
  saude: ["Sua saúde em dia,", "todo dia"],
  metas: ["Suas metas saindo", "do papel"],
};

type Tile = { emoji: string; cor: string; titulo: string; sub: string };

// Eco da resposta "o que mais atrapalha" (trilha dinheiro) → primeiro tile.
const TILE_ATRAPALHA: Record<string, Tile> = {
  "Gasto sem perceber": { emoji: "📊", cor: "#d7f0dd", titulo: "Pra onde foi", sub: "cada real do mês categorizado" },
  "Esqueço contas": { emoji: "🔔", cor: "#cdeeee", titulo: "Contas avisadas", sub: "lembrete antes de cada vencimento" },
  "Não consigo guardar dinheiro": { emoji: "🐖", cor: "#fdeccb", titulo: "Guardar vira meta", sub: "acompanhada semana a semana" },
  "Não sei pra onde meu dinheiro vai": { emoji: "📊", cor: "#d7f0dd", titulo: "Pra onde foi", sub: "cada real do mês categorizado" },
  "Quero organizar tudo": { emoji: "🗂️", cor: "#e6def8", titulo: "Painel único", sub: "contas, gastos e metas num lugar" },
};

// Tile fixo por área (fora de dinheiro o quiz varia — o eco fica na medida).
const TILE_AREA: Record<AreaKey, Tile> = {
  dinheiro: { emoji: "🔔", cor: "#cdeeee", titulo: "Contas avisadas", sub: "lembrete antes de cada vencimento" },
  rotina: { emoji: "📅", cor: "#cdeeee", titulo: "Semana num painel", sub: "tarefas e hábitos à vista" },
  corpo: { emoji: "🍎", cor: "#d7f0dd", titulo: "Refeições e treinos", sub: "registrados sem fricção" },
  saude: { emoji: "❤️", cor: "#fbd8e8", titulo: "Check-ins diários", sub: "seus sinais acompanhados" },
  metas: { emoji: "🧭", cor: "#d9e4fb", titulo: "Plano por meta", sub: "passos pequenos e claros" },
};

const fmtData = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

export function SeuPlanoScreen({ area, answers, onCommit }: {
  area: AreaKey;
  answers: Record<string, string>;
  onCommit: () => void;
}) {
  // Volta da demo é page-load novo: o estado vive no localStorage (mesma
  // fonte que o PaywallFlow usa).
  const resp = useMemo<Record<string, string>>(() => {
    if (answers && Object.keys(answers).length) return answers;
    try { return JSON.parse(localStorage.getItem("funnel-quiz-answers") || "{}"); } catch { return {}; }
  }, [answers]);

  useEffect(() => { trackEvent("funnel_view", { step: "plano", area }); }, [area]);

  const anchor = area === "dinheiro" ? GASTO_ANCHOR[resp.gasto ?? ""] ?? null : null;
  const dataAlvo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; }, []);
  const desorganizado = resp.controle === "Não controlo" || resp.consistencia === "Nunca consegui manter";
  const scoreHoje = desorganizado ? "3,6" : "4,2";

  const tile1 = (area === "dinheiro" && TILE_ATRAPALHA[resp.atrapalha ?? ""]) || TILE_AREA[area];
  const tile2: Tile = {
    emoji: "🎯", cor: "#e6def8",
    titulo: resp.vitoria ?? "Sua primeira vitória",
    sub: "vira a meta nº 1 do seu plano",
  };
  // tile1 e tile2 iguais em tema? troca o 1 pelo fixo da área.
  const tiles: Tile[] = [
    tile1.titulo === tile2.titulo ? TILE_AREA[area] : tile1,
    tile2,
    { emoji: "✍️", cor: "#fdeccb", titulo: "5 min por dia", sub: "o ritmo que você topou no quiz" },
    { emoji: "🧩", cor: "#dcf3d2", titulo: "+15 módulos", sub: "entram junto, quando quiser" },
  ];

  const stag = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.12 + i * 0.1, duration: 0.35 },
  });

  return (
    <div className="w-full max-w-md mx-auto text-center pb-6">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 15 }}
        className="w-11 h-11 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-2 shadow-[0_8px_24px_-6px_hsl(var(--accent)/0.55)] text-lg font-black"
      >✓</motion.div>
      <motion.div {...stag(0)} className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
        Seu plano tá pronto
      </motion.div>
      <motion.h2 {...stag(1)} className="text-[27px] font-black tracking-tight leading-[1.08] mt-1">
        {area === "dinheiro" ? (
          anchor
            ? <><span className="text-accent">{anchor.month}/mês</span> de volta<br />no seu controle</>
            : <>Seu dinheiro sob<br />controle de verdade</>
        ) : (
          <>{HERO_AREA[area as Exclude<AreaKey, "dinheiro">][0]}<br />{HERO_AREA[area as Exclude<AreaKey, "dinheiro">][1]}</>
        )}
      </motion.h2>
      <motion.div {...stag(2)} className="inline-flex items-center gap-1.5 mt-2.5 bg-foreground text-background rounded-full px-3.5 py-1.5 text-[12px] font-bold">
        📅 primeira vitória até {fmtData(dataAlvo)}
      </motion.div>

      {/* a missão dos 7 dias com cara do produto: faixa de hábito, dia 1 aceso */}
      <motion.div {...stag(3)} className="mt-5 rounded-2xl border border-[#eef0f3] bg-white p-3.5 text-left shadow-[0_8px_20px_-14px_rgba(20,40,70,0.28)]">
        <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2.5">Sua primeira semana</div>
        <div className="flex justify-between mb-2.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <span
              key={d}
              className={`w-8 h-8 rounded-full grid place-items-center text-[11.5px] font-extrabold ${d === 1 ? "bg-accent text-accent-foreground shadow-[0_6px_14px_-5px_hsl(var(--accent)/0.55)]" : "bg-secondary text-muted-foreground"}`}
            >{d}</span>
          ))}
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-accent/5 px-2.5 py-2">
          <span className="w-8 h-8 rounded-lg grid place-items-center text-base shrink-0" style={{ background: "#fdeccb" }}>✍️</span>
          <span className="leading-tight">
            <b className="block text-[13px]">Hoje · 5 minutos</b>
            <small className="text-[11px] text-muted-foreground">{ACAO_DIA1[area]}</small>
          </span>
        </div>
      </motion.div>

      {/* tiles computados das respostas — nada genérico */}
      <motion.div {...stag(4)} className="grid grid-cols-2 gap-2.5 mt-2.5">
        {tiles.map((t) => (
          <div key={t.titulo} className="rounded-2xl border border-[#eef0f3] bg-white p-3 text-left shadow-[0_8px_20px_-14px_rgba(20,40,70,0.25)]">
            <span className="w-7 h-7 rounded-lg grid place-items-center text-[14px] mb-1.5" style={{ background: t.cor }}>{t.emoji}</span>
            <b className="block text-[12.5px] leading-tight">{t.titulo}</b>
            <small className="block text-[10.5px] text-muted-foreground leading-snug mt-0.5">{t.sub}</small>
          </div>
        ))}
      </motion.div>

      {/* antes → depois desenhado */}
      <motion.div {...stag(5)} className="mt-3.5 flex items-center justify-center gap-4">
        <span className="text-center">
          <small className="block text-[9.5px] font-bold text-muted-foreground">organização hoje</small>
          <b className="text-lg tabular-nums text-destructive/80">{scoreHoje}</b>
        </span>
        <svg width="92" height="42" viewBox="0 0 92 42" aria-hidden="true">
          <path d="M7 35 A 40 40 0 0 1 85 35" fill="none" stroke="hsl(var(--secondary))" strokeWidth="7" strokeLinecap="round" />
          <motion.path
            d="M7 35 A 40 40 0 0 1 67 12" fill="none" stroke="hsl(var(--accent))" strokeWidth="7" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.7, duration: 0.9, ease: "easeOut" }}
          />
          <motion.circle cx="67" cy="12" r="5" fill="hsl(var(--accent))" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.55 }} />
        </svg>
        <span className="text-center">
          <small className="block text-[9.5px] font-bold text-muted-foreground">semana 4 do plano</small>
          <b className="text-lg tabular-nums text-accent">8,5</b>
        </span>
      </motion.div>

      <motion.p {...stag(6)} className="text-[11px] text-muted-foreground mt-2.5">
        montado com as suas respostas · dá pra ajustar tudo depois
      </motion.p>

      <motion.div {...stag(7)} className="mt-5">
        <Button
          size="lg"
          className="w-full h-13 min-h-[52px] rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
          onClick={() => { trackEvent("funnel_click", { cta: "plano_commit", area }); onCommit(); }}
        >
          Quero cumprir esse plano 🤝 <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
}
