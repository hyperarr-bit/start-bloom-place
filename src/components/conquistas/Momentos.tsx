import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { MARCOS_SEQUENCIA } from "@/lib/sequencia";
import { CHAVE_VISTAS } from "@/lib/conquistas-registro";
import { RARIDADES, RARIDADE_LABEL, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";
import { AdesivoRaro, ChipRaridade } from "./adesivos-raridade";
import { Roseta } from "./Roseta";
import { compartilharAdesivo, compartilharRoseta } from "./compartilhar-conquistas";
import { useConquistas, useEfeitosSequencia, usePerfilConquistas, useSequencia } from "./use-conquistas";
import { CAPAS, CHAVE_CAPA, CapaResponsiva, type CapaId } from "./CapaPlanner";
import { CHAVE_CAPAS_VISTAS, capasNovas, diasPraCapa, lerCapasVistas } from "@/lib/fogo-sequencia";
import { isNativeShell } from "@/lib/native-shell";
import { missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import "./conquistas.css";

/**
 * MOMENTOS (26/09, "estilo Duolingo, com a nossa cara"): adesivo novo sendo
 * colado e a roseta dos marcos de 7/30/100 dias seguidos. Cada um aparece UMA
 * vez (gravado em `conquistas-vistas`), um de cada vez (fila) e nunca por cima
 * de outra tela aberta (a comemoração do dia 100, um diálogo, uma folha).
 *
 * 27/09: a festa cresce com a RARIDADE — comum: o adesivo cai + 14 confetes;
 * raro: 20 + raios discretos; épico: raios coloridos girando + 30; lendário:
 * raios de ouro + 42 confetes dourados — e o chip diz o que é.
 *
 * Na 1ª abertura desta versão tudo o que já estava conquistado entra como
 * "visto" em silêncio — ninguém ganha uma fila de nove festas atrasadas.
 * E quando MUITOS adesivos abrem de uma vez (27/09: 26 regras novas que o
 * dado antigo já satisfaz), a festa é só pros 3 mais raros; os outros entram
 * como vistos, colados na folha do mesmo jeito.
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

/**
 * 01/10 — ADESIVO COMUM EM POPUP (dono: "podem não ocupar a tela toda, mas
 * ainda ter uma animação muito bonita tipo confete, só que num popup, e dar a
 * opção de deixar em tela cheia"). Medido: 74% dos adesivos são comuns e em
 * 46% das vezes vêm 2+ no mesmo dia (dia 1º = 3 festas de tela cheia seguidas).
 *  - comum → cartão central (MomentoPopup) com confete, brilho e o adesivo
 *    colando; "Ver em tela cheia" abre a festa de hoje; "Continuar" fecha;
 *  - vários comuns juntos → UM popup com os adesivos em carrossel;
 *  - raro/épico/lendário e os marcos da sequência → festa de tela cheia, como hoje;
 *  - nada aparece no meio de um registro (teclado aberto, folha/diálogo na tela).
 * Medição: festa_view {raridade, formato}, festa_fechada {ms, como}, festa_tela_cheia_click.
 */
type Item = { tipo: "marco"; dias: number } | { tipo: "adesivo"; badge: Badge } | { tipo: "popup"; badges: Badge[] } | { tipo: "capa"; capas: CapaId[] };

/** Quantos adesivos RAROS+ ganham festa de tela cheia de uma vez; o resto só cola na folha. */
export const MAX_FESTAS_DE_UMA_VEZ = 3;
/** Quantos comuns cabem no popup de uma vez (carrossel); o resto só cola na folha. */
export const MAX_NO_POPUP = 6;
/** Conta com menos de 24 h (1º dia, tutorial e Missão ainda passando): uma festa só por vez (28/09). */
export const MAX_FESTAS_CONTA_NOVA = 1;
/** Formato da festa pela raridade: comum = popup; o resto, tela cheia. */
export const formatoDaFesta = (b: Pick<Badge, "xp" | "raridade">): "popup" | "tela_cheia" => (raridadeDe(b) === "comum" ? "popup" : "tela_cheia");

/**
 * TESTE GRÁTIS SEM FESTA (28/09, dono: "o teste grátis tá convertendo bem, cuidado"). A Missão dos
 * 3 dias é a peça que converte, e as conversões boas vieram SEM festa de adesivo (a 1.0.6 nem tinha).
 * Na 1.0.7 a festa em tela cheia caía por cima do "Primeiro registro feito! Dia 1 da missão". Enquanto
 * a Missão estiver valendo, o adesivo cola quieto na folha — igual à 1.0.6 no caminho que converte.
 */
export const emTesteComMissao = (): boolean => {
  try { return isNativeShell() && trialCartaoAtivo() && !!missaoAtual(); } catch { return false; }
};
const pesoDaRaridade = (b: Badge) => RARIDADES.indexOf(raridadeDe(b));

/**
 * Outra camada em cima da tela? (comemoração do 100, diálogo, folha de baixo) —
 * e, desde 28/09, QUALQUER camada de guia (Missão do teste, tutorial, holofote
 * dos módulos: `data-camada-guia`). No 1º gasto do teste grátis a festa do
 * adesivo caía 0,8 s depois do "Primeiro registro feito! Dia 1 da missão" e
 * cobria a tela inteira — a peça da Missão que puxa a volta do dia 2 sumia.
 */
export const outraTelaAberta = () =>
  typeof document !== "undefined" &&
  !!document.querySelector('[data-testid="celebracao-100"], [role="dialog"]:not([data-momento]), [role="alertdialog"], [data-camada-guia]');

/**
 * A pessoa está NO MEIO de um registro? (01/10) Teclado aberto num campo, ou
 * uma folha/menu aberto (Radix/vaul: data-state="open"). A festa espera a ação
 * terminar — o adesivo da "Primeira Despesa" caía enquanto ela ainda digitava
 * o segundo gasto.
 */
export const registroEmAndamento = () => {
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) && (el as HTMLInputElement).type !== "checkbox" && (el as HTMLInputElement).type !== "radio") return true;
  return !!document.querySelector('[data-state="open"][role="dialog"], [data-state="open"][data-radix-popper-content-wrapper], [data-vaul-drawer][data-state="open"]');
};

// Confete: pedaços nas cores do app (ou de ouro), caem uma vez. Quantos, pela raridade.
const CORES = ["#d22d80", "#F5B301", "#4F8BFF", "#22c55e", "#fb923c", "#8b5cf6"];
const CORES_OURO = ["#e9c65a", "#fff1b0", "#d4a629", "#d22d80", "#fff7d6"];
export const CONFETES_POR_RARIDADE: Record<Raridade, number> = { comum: 14, raro: 20, epico: 30, lendario: 42 };
/** No popup o confete é mais curto: cai por trás do cartão, na tela inteira. */
export const CONFETES_DO_POPUP = 18;
const pedacos = (n: number, cores: string[]) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    x: 4 + ((i * 53) % 92),
    atraso: 0.35 + (i % 6) * 0.08,
    dur: 2.1 + (i % 4) * 0.28,
    giro: (i % 2 ? 1 : -1) * (140 + ((i * 37) % 180)),
    cor: cores[i % cores.length],
    w: 6 + (i % 3) * 2.5,
    redondo: i % 3 === 0,
  }));

const Confete = ({ raridade = "comum", quantidade }: { raridade?: Raridade; quantidade?: number }) => {
  const lista = useMemo(() => pedacos(quantidade ?? CONFETES_POR_RARIDADE[raridade], raridade === "lendario" ? CORES_OURO : CORES), [raridade, quantidade]);
  return (
    <>
      {lista.map((p) => (
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
};

const pontilhado = {
  backgroundImage: "radial-gradient(circle, hsl(var(--foreground) / .13) 1.4px, transparent 1.6px)",
  backgroundSize: "22px 22px",
};

interface CascaProps {
  rotulo: string;
  testid: string;
  children: React.ReactNode;
  rodape: React.ReactNode;
  raridade?: Raridade;
}

const Casca = ({ rotulo, testid, children, rodape, raridade = "comum" }: CascaProps) => {
  const reduzir = useReducedMotion();
  const raios = raridade !== "comum";
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      data-momento=""
      data-testid={testid}
      data-raridade={raridade}
      className="fixed inset-0 z-[400] flex flex-col bg-background text-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={pontilhado} />
      {raios && (
        <motion.div
          aria-hidden
          className="mo-raios"
          data-rar={raridade}
          initial={{ opacity: 0 }}
          animate={{ opacity: raridade === "raro" ? 0.5 : 1 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          style={reduzir ? { animation: "none" } : undefined}
        />
      )}
      {!reduzir && <Confete raridade={raridade} />}
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

/** Mede a festa: `festa_view` ao abrir, `festa_fechada` {ms, como} ao sair por qualquer caminho. */
const useMedirFesta = (dados: Record<string, unknown>) => {
  const abriuEm = useRef(Date.now());
  const fechou = useRef(false);
  const chave = JSON.stringify(dados);
  useEffect(() => {
    abriuEm.current = Date.now();
    fechou.current = false;
    trackEvent("festa_view", dados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return (como: string, extra: Record<string, unknown> = {}) => {
    if (fechou.current) return;
    fechou.current = true;
    trackEvent("festa_fechada", { ...dados, como, ms: Date.now() - abriuEm.current, ...extra });
  };
};

export const MomentoAdesivo = ({ badge, nome, membroDesde, onContinuar, onVerAdesivos, origem = "direto" }: {
  badge: Badge; nome: string; membroDesde: string; onContinuar: () => void; onVerAdesivos?: () => void;
  /** "popup" quando veio do botão "Ver em tela cheia" do cartão. */
  origem?: "direto" | "popup";
}) => {
  const [enviando, setEnviando] = useState(false);
  const raridade = raridadeDe(badge);
  const fechar = useMedirFesta({ raridade, formato: "tela_cheia", id: badge.id, origem });
  const compartilhar = async () => {
    setEnviando(true);
    try {
      await compartilharAdesivo({ id: badge.id, titulo: badge.name, descricao: badge.description, raridade, nome, membroDesde });
      trackEvent("festa_compartilhar", { raridade, formato: "tela_cheia", id: badge.id });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Casca
      rotulo={`Adesivo novo: ${badge.name}`}
      testid="momento-adesivo"
      raridade={raridade}
      rodape={
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={compartilhar} disabled={enviando} className={botaoSecundario}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartilhar
            </button>
            <button type="button" onClick={() => { fechar("continuar"); onContinuar(); }} className={botaoPrimario}>{origem === "popup" ? "Voltar" : "Continuar"}</button>
          </div>
          {onVerAdesivos && (
            <button type="button" onClick={() => { fechar("ver_adesivos"); onVerAdesivos(); }} className="w-full py-1.5 text-xs font-semibold text-muted-foreground">
              Ver meus adesivos ›
            </button>
          )}
        </>
      }
    >
      <Eyebrow>Adesivo novo</Eyebrow>
      <Colando>
        <AdesivoRaro id={badge.id} raridade={raridade} tamanho={196} bordaGrossa titulo={badge.name} />
      </Colando>
      <motion.div className="mt-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <ChipRaridade raridade={raridade} tam="g" texto={`Adesivo ${RARIDADE_LABEL[raridade]}`} />
      </motion.div>
      <motion.h2 className="mt-3.5 text-[30px] font-black tracking-tight leading-[1.05]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        {badge.name}
      </motion.h2>
      <motion.p className="mt-2 text-[15px] text-muted-foreground max-w-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}>
        {badge.description}
      </motion.p>
    </Casca>
  );
};

export const MomentoMarco = ({ dias, nome, membroDesde, nivel, onContinuar }: {
  dias: number; nome: string; membroDesde: string; nivel: string; onContinuar: () => void;
}) => {
  const [enviando, setEnviando] = useState<"cor" | "transparente" | null>(null);
  const fechar = useMedirFesta({ raridade: dias >= 100 ? "lendario" : dias >= 30 ? "epico" : "raro", formato: "tela_cheia", marco: dias });
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
      raridade={dias >= 100 ? "lendario" : dias >= 30 ? "epico" : "raro"}
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
            <button type="button" onClick={() => { fechar("continuar"); onContinuar(); }} className={botaoSecundario}>Continuar</button>
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

/* ------------------------------------------------------------------ popup */

/** Faíscas que saem do adesivo quando ele cola (CSS: --dx/--dy, transform só). */
const Faiscas = () => (
  <>
    {Array.from({ length: 10 }, (_, i) => {
      const ang = (i / 10) * Math.PI * 2;
      const d = 62 + (i % 3) * 14;
      return (
        <span
          key={i}
          aria-hidden
          className="mo-faisca"
          style={{ "--dx": `${Math.cos(ang) * d}px`, "--dy": `${Math.sin(ang) * d}px`, animationDelay: `${0.42 + (i % 4) * 0.05}s`, background: CORES[i % CORES.length] } as React.CSSProperties}
        />
      );
    })}
  </>
);

/**
 * O CARTÃO do adesivo comum (01/10): um popup central com a cara de planner —
 * faixa colorida no topo com o título em caixa alta, papel pontilhado, o
 * adesivo colando com mola, brilho atrás dele, faíscas e confete pela tela.
 * Vários comuns juntos viram um carrossel (deslize ou ‹ ›) num cartão só.
 */
export const MomentoPopup = ({ badges, onContinuar, onTelaCheia, onVerAdesivos }: {
  badges: Badge[];
  onContinuar: () => void;
  onTelaCheia: (b: Badge) => void;
  onVerAdesivos?: () => void;
}) => {
  const reduzir = useReducedMotion();
  const trilho = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(0);
  const atual = badges[Math.min(pagina, badges.length - 1)] ?? badges[0];
  const fechar = useMedirFesta({ raridade: "comum", formato: "popup", quantidade: badges.length, ids: badges.map((b) => b.id).join(",") });

  const irPara = (n: number) => {
    const t = trilho.current;
    if (!t) return;
    const alvo = Math.max(0, Math.min(badges.length - 1, n));
    // (jsdom e WebViews antigos não têm scrollTo em elemento)
    if (typeof t.scrollTo === "function") t.scrollTo({ left: alvo * t.clientWidth, behavior: reduzir ? "auto" : "smooth" });
    else t.scrollLeft = alvo * t.clientWidth;
    setPagina(alvo);
  };
  const aoRolar = () => {
    const t = trilho.current;
    if (!t || !t.clientWidth) return;
    setPagina(Math.round(t.scrollLeft / t.clientWidth));
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={badges.length > 1 ? `${badges.length} adesivos novos` : `Adesivo novo: ${atual.name}`}
      data-momento=""
      data-testid="momento-popup"
      data-quantidade={badges.length}
      className="fixed inset-0 z-[400] flex items-center justify-center px-5 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* véu: toque fora = continuar (mede como "fora") */}
      <button
        type="button"
        aria-label="Fechar"
        data-testid="momento-popup-fora"
        className="absolute inset-0 bg-black/45"
        onClick={() => { fechar("fora"); onContinuar(); }}
      />
      {!reduzir && <div aria-hidden className="absolute inset-0 pointer-events-none"><Confete quantidade={CONFETES_DO_POPUP} /></div>}
      <motion.div
        className="mo-popup relative w-full max-w-[340px] rounded-3xl bg-card text-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)] overflow-hidden"
        initial={reduzir ? { opacity: 0 } : { scale: 0.82, y: 28, opacity: 0 }}
        animate={reduzir ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
        transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 330, damping: 24, mass: 0.9 }}
      >
        {/* faixa do planner: título em caixa alta */}
        <div className="mo-popup-faixa">
          {badges.length > 1 ? `${badges.length} adesivos novos` : "Adesivo novo"}
        </div>
        <div className="relative" style={pontilhado}>
          <div
            ref={trilho}
            className="alb-trilho"
            onScroll={aoRolar}
            data-testid="momento-popup-trilho"
          >
            {badges.map((b, i) => (
              <div key={b.id} className="alb-pagina px-5 pt-5 pb-2 text-center" data-testid={`momento-popup-item-${b.id}`} data-ativo={i === pagina ? "" : undefined}>
                <div className="relative inline-block">
                  {!reduzir && <span aria-hidden className="mo-brilho" />}
                  {!reduzir && i === pagina && <Faiscas />}
                  <Colando>
                    <AdesivoRaro id={b.id} raridade="comum" tamanho={128} bordaGrossa titulo={b.name} />
                  </Colando>
                </div>
                <motion.div className="mt-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <ChipRaridade raridade="comum" tam="m" texto="Adesivo comum" />
                </motion.div>
                <motion.h2 className="mt-2 text-[22px] font-black tracking-tight leading-[1.08]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                  {b.name}
                </motion.h2>
                <motion.p className="mt-1 text-[13px] text-muted-foreground leading-snug min-h-[2.4em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  {b.description}
                </motion.p>
              </div>
            ))}
          </div>
          {badges.length > 1 && (
            <div className="flex items-center justify-center gap-1 pb-1">
              <button type="button" className="alb-nav" aria-label="Adesivo anterior" disabled={pagina === 0} onClick={() => irPara(pagina - 1)}>‹</button>
              <div className="alb-dots" aria-label={`${pagina + 1} de ${badges.length}`}>
                {badges.map((b, i) => (
                  <button key={b.id} type="button" className="alb-dot" data-ativo={i === pagina ? "" : undefined} aria-label={`Adesivo ${i + 1}`} onClick={() => irPara(i)}><i /></button>
                ))}
              </div>
              <button type="button" className="alb-nav" aria-label="Próximo adesivo" disabled={pagina === badges.length - 1} onClick={() => irPara(pagina + 1)}>›</button>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 pt-2 space-y-2 bg-card">
          <button type="button" onClick={() => { fechar("continuar", { vistos: pagina + 1 }); onContinuar(); }} className={`${botaoPrimario} w-full`} data-testid="momento-popup-continuar">
            Continuar
          </button>
          <div className={`grid gap-2 ${onVerAdesivos ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              className={`${botaoSecundario} h-10 text-[13px]`}
              data-testid="momento-popup-tela-cheia"
              onClick={() => {
                trackEvent("festa_tela_cheia_click", { id: atual.id, raridade: "comum", quantidade: badges.length, posicao: pagina + 1 });
                onTelaCheia(atual);
              }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Ver em tela cheia
            </button>
            {onVerAdesivos && (
              <button type="button" className={`${botaoSecundario} h-10 text-[13px]`} onClick={() => { fechar("ver_adesivos"); onVerAdesivos(); }}>
                Meus adesivos ›
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ------------------------------------------------------------ capa nova */

/**
 * "CAPA NOVA LIBERADA!" (02/10): o mesmo cartão do adesivo comum, com a capa
 * de verdade (em miniatura, torta) colando com mola, confete e faixa dourada.
 * Uma capa por página (várias liberadas de uma vez = carrossel). "Usar esta
 * capa" grava `conquistas-capa`; "Deixar como está" só fecha. O evento
 * `capa_desbloqueada {capa}` sai ao mostrar.
 */
export const MomentoCapa = ({ capas, nome, membroDesde, dias, nivel, onUsar, onContinuar }: {
  capas: CapaId[]; nome: string; membroDesde: string; dias: number; nivel: string;
  onUsar: (capa: CapaId) => void; onContinuar: () => void;
}) => {
  const reduzir = useReducedMotion();
  const trilho = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(0);
  const atual = capas[Math.min(pagina, capas.length - 1)] ?? capas[0];
  const fechar = useMedirFesta({ raridade: "capa", formato: "popup", quantidade: capas.length, ids: capas.join(",") });
  useEffect(() => {
    for (const c of capas) trackEvent("capa_desbloqueada", { capa: c, dias: diasPraCapa(c) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capas.join(",")]);
  const irPara = (n: number) => {
    const t = trilho.current;
    if (!t) return;
    const alvo = Math.max(0, Math.min(capas.length - 1, n));
    if (typeof t.scrollTo === "function") t.scrollTo({ left: alvo * t.clientWidth, behavior: reduzir ? "auto" : "smooth" });
    else t.scrollLeft = alvo * t.clientWidth;
    setPagina(alvo);
  };
  const aoRolar = () => {
    const t = trilho.current;
    if (!t || !t.clientWidth) return;
    setPagina(Math.round(t.scrollLeft / t.clientWidth));
  };
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={capas.length > 1 ? `${capas.length} capas novas liberadas` : `Capa nova liberada: ${CAPAS[atual].nome}`}
      data-momento=""
      data-testid="momento-capa"
      data-capa={atual}
      className="fixed inset-0 z-[400] flex items-center justify-center px-5 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button type="button" aria-label="Fechar" data-testid="momento-capa-fora" className="absolute inset-0 bg-black/45" onClick={() => { fechar("fora"); onContinuar(); }} />
      {!reduzir && <div aria-hidden className="absolute inset-0 pointer-events-none"><Confete raridade="lendario" quantidade={CONFETES_DO_POPUP} /></div>}
      <motion.div
        className="relative w-full max-w-[340px] rounded-3xl bg-card text-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)] overflow-hidden"
        initial={reduzir ? { opacity: 0 } : { scale: 0.82, y: 28, opacity: 0 }}
        animate={reduzir ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
        transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 330, damping: 24, mass: 0.9 }}
      >
        <div className="mo-popup-faixa mo-faixa-ouro">{capas.length > 1 ? `${capas.length} capas novas liberadas` : "Capa nova liberada"}</div>
        <div className="relative" style={pontilhado}>
          <div ref={trilho} className="alb-trilho" onScroll={aoRolar} data-testid="momento-capa-trilho">
            {capas.map((c, i) => (
              <div key={c} className="alb-pagina px-5 pt-6 pb-2 text-center" data-testid={`momento-capa-item-${c}`} data-ativo={i === pagina ? "" : undefined}>
                <div className="relative inline-block" style={{ transform: "rotate(-3deg)" }}>
                  {!reduzir && <span aria-hidden className="mo-brilho" />}
                  {!reduzir && i === pagina && <Faiscas />}
                  <Colando>
                    <div style={{ filter: "drop-shadow(0 14px 18px rgba(0,0,0,.35))" }}>
                      <CapaResponsiva capa={c} largura={250} nome={nome} membroDesde={membroDesde} dias={dias} nivel={nivel} />
                    </div>
                  </Colando>
                </div>
                <motion.h2 className="mt-4 text-[22px] font-black tracking-tight leading-[1.08]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
                  Capa {CAPAS[c].nome}
                </motion.h2>
                <motion.p className="mt-1 text-[13px] text-muted-foreground leading-snug min-h-[2.4em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  {CAPAS[c].descricao.split(" · ").slice(0, 2).join(" · ")}. <b className="text-foreground">{diasPraCapa(c)} dias seguidos</b> — é sua.
                </motion.p>
              </div>
            ))}
          </div>
          {capas.length > 1 && (
            <div className="flex items-center justify-center gap-1 pb-1">
              <button type="button" className="alb-nav" aria-label="Capa anterior" disabled={pagina === 0} onClick={() => irPara(pagina - 1)}>‹</button>
              <div className="alb-dots" aria-label={`${pagina + 1} de ${capas.length}`}>
                {capas.map((c, i) => <button key={c} type="button" className="alb-dot" data-ativo={i === pagina ? "" : undefined} aria-label={`Capa ${i + 1}`} onClick={() => irPara(i)}><i /></button>)}
              </div>
              <button type="button" className="alb-nav" aria-label="Próxima capa" disabled={pagina === capas.length - 1} onClick={() => irPara(pagina + 1)}>›</button>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 pt-2 space-y-2 bg-card">
          <button type="button" onClick={() => { fechar("usar", { capa: atual }); onUsar(atual); }} className={`${botaoPrimario} w-full`} data-testid="momento-capa-usar">
            Usar esta capa
          </button>
          <button type="button" onClick={() => { fechar("continuar"); onContinuar(); }} className={`${botaoSecundario} w-full h-10 text-[13px]`} data-testid="momento-capa-continuar">
            Deixar como está
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ------------------------------------------------------------ orquestra */

/** Orquestra a fila de momentos + as escritas da sequência (uma vez por tela). */
export const MomentosConquistas = ({ contaNova = false }: { contaNova?: boolean } = {}) => {
  const { get, set, loaded } = useUserData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seq = useSequencia();
  useEfeitosSequencia(seq);
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const vistasCru = get<unknown>(CHAVE_VISTAS, undefined);
  const vistas = useMemo(() => lerVistas(vistasCru), [vistasCru]);
  // (02/10) as capas que o tempo libera: a festa de cada uma passa UMA vez (lista de ids)
  const capasVistasCru = get<unknown>(CHAVE_CAPAS_VISTAS, undefined);
  const capasVistas = useMemo(() => lerCapasVistas(capasVistasCru) ?? [], [capasVistasCru]);

  // (02/10, dono) "Capa nova liberada" só aparece QUANDO A PESSOA ABRE A TELA DE CONQUISTAS — nunca
  // por cima da Home, do Treino etc. Sem linha de base silenciosa: quem já tinha recorde ≥14/30
  // quando as capas chegaram também vê o popup UMA vez, na 1ª abertura de Conquistas (as capas já
  // estão liberadas no seletor desde antes — o popup só avisa).
  const emConquistas = pathname.startsWith("/conquistas");

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

  /*
   * A FILA (01/10): marco da sequência → raros+ em tela cheia (até 3) → UM
   * popup com os comuns (até 6, em carrossel). Conta nova: uma peça só (o
   * raro mais alto, ou um popup com 1 comum). O que sobra entra como visto.
   */
  const { fila, semFesta } = useMemo<{ fila: Item[]; semFesta: string[] }>(() => {
    if (!loaded || !vistas) return { fila: [], semFesta: [] };
    const itens: Item[] = [];
    // pelo RECORDE: quem bateu 7 e quebrou antes de abrir a Home ainda ganha a roseta dos 7
    const marco = [...MARCOS_SEQUENCIA].reverse().find((m) => seq.recorde >= m && !vistas.marcos.includes(m));
    if (marco && !emTesteComMissao()) itens.push({ tipo: "marco", dias: marco });
    // capa nova pelo RECORDE (nunca é tirada): uma festa só, com todas as liberadas desde a última vez
    const capas = emConquistas ? capasNovas(seq.recorde, capasVistas) : []; // só com a tela de Conquistas aberta
    if (capas.length && !emTesteComMissao()) itens.push({ tipo: "capa", capas });
    const novos = conq.folha
      .filter((b) => b.unlocked && !/^sequencia-/.test(b.id) && !vistas.adesivos.includes(b.id))
      .sort((a, b) => pesoDaRaridade(b) - pesoDaRaridade(a));
    if (emTesteComMissao()) return { fila: itens, semFesta: novos.map((b) => b.id) };
    const raros = novos.filter((b) => formatoDaFesta(b) === "tela_cheia");
    const comuns = novos.filter((b) => formatoDaFesta(b) === "popup");
    const maxRaros = contaNova ? MAX_FESTAS_CONTA_NOVA : MAX_FESTAS_DE_UMA_VEZ;
    const comFesta = raros.slice(0, maxRaros);
    for (const b of comFesta) itens.push({ tipo: "adesivo", badge: b });
    // conta nova já com um raro: os comuns colam quietos; senão, 1 no popup
    const maxComuns = contaNova ? (comFesta.length ? 0 : 1) : MAX_NO_POPUP;
    const noPopup = comuns.slice(0, maxComuns);
    if (noPopup.length) itens.push({ tipo: "popup", badges: noPopup });
    const semFesta = [...raros.slice(maxRaros), ...comuns.slice(maxComuns)].map((b) => b.id);
    return { fila: itens, semFesta };
  }, [loaded, vistas, seq.recorde, conq.folha, contaNova, capasVistas, emConquistas]);

  // os que ficaram sem festa entram como vistos (uma escrita só)
  const semFestaTxt = semFesta.join(",");
  useEffect(() => {
    if (!loaded || !semFestaTxt) return;
    const v = lerVistas(get<unknown>(CHAVE_VISTAS, undefined)) ?? { adesivos: [], marcos: [] };
    set(CHAVE_VISTAS, { ...v, adesivos: [...new Set([...v.adesivos, ...semFestaTxt.split(",")])] }, { system: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, semFestaTxt]);

  // espera a tela assentar, nenhuma outra camada aberta e nenhum registro em andamento
  const [liberado, setLiberado] = useState(false);
  const temFila = fila.length > 0;
  useEffect(() => {
    if (!temFila) { setLiberado(false); return; }
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (!vivo) return;
      if (outraTelaAberta() || registroEmAndamento()) t = setTimeout(tentar, 1200);
      else setLiberado(true);
    };
    // 1,6 s (28/09, era 0,9): as camadas que a PRÓPRIA ação abre (pedido de avaliação no 1º gasto do
    // Android ~1,2 s, festa do dia da Missão ~0,1 s) já estão montadas quando a festa olha a tela — antes
    // ela chegava primeiro e as duas abriam juntas.
    t = setTimeout(tentar, 1600);
    return () => { vivo = false; clearTimeout(t); };
  }, [temFila]);

  const atual = liberado ? fila[0] : undefined;
  const chaveAtual = atual ? (atual.tipo === "marco" ? `marco-${atual.dias}` : atual.tipo === "popup" ? `popup-${atual.badges.map((b) => b.id).join("+")}` : atual.tipo === "capa" ? `capa-${atual.capas.join("+")}` : atual.badge.id) : null;
  // "Ver em tela cheia" do popup: a festa de hoje do adesivo escolhido, por cima; "Voltar" devolve ao cartão
  const [telaCheia, setTelaCheia] = useState<Badge | null>(null);
  useEffect(() => { setTelaCheia(null); }, [chaveAtual]);

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
    } else if (item.tipo === "popup") {
      set(CHAVE_VISTAS, { ...v, adesivos: [...new Set([...v.adesivos, ...item.badges.map((b) => b.id)])] }, { system: true });
    } else if (item.tipo === "capa") {
      const vistasAgora = lerCapasVistas(get<unknown>(CHAVE_CAPAS_VISTAS, undefined)) ?? [];
      set(CHAVE_CAPAS_VISTAS, [...new Set([...vistasAgora, ...item.capas])], { system: true });
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
      {atual?.tipo === "capa" && (
        <MomentoCapa
          key={chaveAtual!}
          capas={atual.capas}
          nome={perfil.nome}
          membroDesde={perfil.membroDesde}
          dias={seq.dias}
          nivel={conq.nivel.name}
          onUsar={(c) => { set(CHAVE_CAPA, c); trackEvent("capa_trocar", { capa: c, via: "festa" }); continuar(); }}
          onContinuar={continuar}
        />
      )}
      {atual?.tipo === "adesivo" && (
        <MomentoAdesivo key={chaveAtual!} badge={atual.badge} nome={perfil.nome} membroDesde={perfil.membroDesde} onContinuar={continuar} onVerAdesivos={verAdesivos} />
      )}
      {atual?.tipo === "popup" && !telaCheia && (
        <MomentoPopup key={chaveAtual!} badges={atual.badges} onContinuar={continuar} onTelaCheia={setTelaCheia} onVerAdesivos={verAdesivos} />
      )}
      {atual?.tipo === "popup" && telaCheia && (
        <MomentoAdesivo key={`${chaveAtual}-cheia-${telaCheia.id}`} badge={telaCheia} nome={perfil.nome} membroDesde={perfil.membroDesde} origem="popup" onContinuar={() => setTelaCheia(null)} onVerAdesivos={verAdesivos} />
      )}
    </AnimatePresence>
  );
};
