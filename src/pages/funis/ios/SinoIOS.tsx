/**
 * A TELA DO SINO (1.0.18, dono 22/10 — Cal AI "We'll send a reminder before your trial ends"). Logo antes do
 * paywall do iPhone, UMA vez por aparelho, atrás da chave remota `sino_paywall` (lib/sino-paywall).
 *
 * Regras do dono: sem preço, sem falar em cobrança da Apple ("24 h antes"), neutra de gênero, curta.
 * A promessa é verdadeira: o aviso "Seu teste grátis termina amanhã" (notificacoes.copyDoLembreteDoTeste, 920001)
 * é armado depois da compra em teste se a permissão de notificação estiver dada — por isso o "Continuar grátis"
 * pede a permissão AQUI, só se ainda não foi decidida (o convite de notificação do funil, "Quero ser lembrado",
 * e o "Plano de amanhã" da missão usam o mesmo estado do sistema: o diálogo nunca aparece duas vezes).
 *
 * Eventos: `funnel_view step=sino` (no mount), `funnel_click cta=sino_continuar` / `sino_voltar`,
 * `sino_permissao {antes, resultado}`. Todos com `funil: "ios"`, `loja: "ios"`, `sino: "com"`.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import type { AreaKey } from "@/lib/funnel";
import { deveMostrarSino, guardarForcaSino, marcarSinoVisto } from "@/lib/sino-paywall";

export const TEXTOS_DO_SINO = {
  titulo: "A gente te avisa antes do teste acabar",
  sub: "Com as notificações ligadas",
  garantia: "Nada é cobrado hoje",
  botao: "Continuar grátis",
} as const;

/** Teto da espera pela resposta do diálogo (o plugin pendura em alguns aparelhos — ver NotifW, 31/08). */
export const TETO_DA_PERMISSAO_MS = 15000;

const comTeto = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export function SinoIOS({ area, onContinuar, onVoltar }: { area: AreaKey; onContinuar: () => void; onVoltar?: () => void }) {
  const [indo, setIndo] = useState(false);
  const indoRef = useRef(false);
  const base = { funil: "ios", loja: "ios", area, sino: "com" as const };

  useEffect(() => {
    // gravado na hora em que aparece: reabrir o app aqui no meio já cai no paywall
    marcarSinoVisto();
    trackEvent("funnel_view", { step: "sino", ...base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continuar = async () => {
    if (indoRef.current) return;
    indoRef.current = true;
    setIndo(true);
    trackEvent("funnel_click", { cta: "sino_continuar", step: "sino", ...base });
    try {
      const { estadoPermissao, pedirPermissao } = await import("@/lib/notificacoes");
      const antes = await comTeto(estadoPermissao(), 4000);
      if (antes === "prompt") {
        const concedida = await comTeto(pedirPermissao(), TETO_DA_PERMISSAO_MS);
        trackEvent("sino_permissao", { ...base, antes, resultado: concedida === null ? "expirou" : concedida ? "concedeu" : "negou" });
      } else {
        // já decidida (ou sem plugin): não pede de novo, só segue
        trackEvent("sino_permissao", { ...base, antes: antes ?? "expirou", resultado: antes === "granted" ? "ja_tinha" : antes === "denied" ? "ja_negada" : antes ?? "expirou" });
      }
    } catch { /* nunca trava o funil */ }
    onContinuar();
  };

  const voltar = () => {
    if (indoRef.current) return;
    trackEvent("funnel_click", { cta: "sino_voltar", step: "sino", ...base });
    onVoltar?.();
  };

  return (
    <div className="relative w-full flex-1 flex flex-col text-[#16121c]" data-testid="ios-sino">
      {onVoltar && (
        <button
          type="button" aria-label="Voltar" data-testid="ios-sino-voltar" onClick={voltar}
          className="self-start -ml-1 w-10 h-10 rounded-full bg-secondary text-[#16121c] grid place-items-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      <div className="max-w-sm w-full mx-auto text-center mt-[clamp(8px,3dvh,32px)]">
        <h1 className="text-[clamp(27px,4.3dvh,33px)] font-black tracking-[-0.03em] leading-[1.08]" data-testid="ios-sino-titulo">
          {TEXTOS_DO_SINO.titulo}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{TEXTOS_DO_SINO.sub}</p>
      </div>

      <div className="flex-1 grid place-items-center py-6" aria-hidden>
        <Sino />
      </div>

      <div className="shrink-0 max-w-sm w-full mx-auto flex flex-col">
        <p className="flex items-center justify-center gap-2 text-[15px] font-semibold" data-testid="ios-sino-garantia">
          <Check className="w-[18px] h-[18px]" strokeWidth={3} />
          {TEXTOS_DO_SINO.garantia}
        </p>
        <button
          type="button" data-testid="ios-sino-continuar" onClick={() => void continuar()} disabled={indo}
          className="mt-4 w-full h-14 rounded-full bg-[#16121c] text-white text-[17px] font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] active:scale-[0.99] transition-transform disabled:opacity-70"
        >
          {TEXTOS_DO_SINO.botao}
        </button>
      </div>
    </div>
  );
}

/** O sino com o "1": cinza-claro do CORE, badge magenta. Um balanço curto ao entrar. */
function Sino() {
  const tamanho = "clamp(150px, 26dvh, 210px)";
  return (
    <motion.div
      style={{ width: tamanho, height: tamanho, transformOrigin: "50% 8%" }}
      className="relative"
      initial={{ rotate: 0 }}
      animate={{ rotate: [0, -10, 8, -5, 3, 0] }}
      transition={{ duration: 1.1, delay: 0.35, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" role="img" aria-label="Sino de notificação">
        {/* a argola */}
        <rect x="88" y="12" width="24" height="26" rx="12" fill="#E6E2EA" />
        {/* o corpo */}
        <path d="M100 26c-33 0-56 25-56 58v42c0 6-3 11-8 15l-14 12c-5 5-2 13 5 13h146c7 0 10-8 5-13l-14-12c-5-4-8-9-8-15V84c0-33-23-58-56-58z" fill="#E6E2EA" />
        {/* o badalo */}
        <path d="M80 172h40a20 20 0 0 1-40 0z" fill="#E6E2EA" />
      </svg>
      <motion.span
        className="absolute grid place-items-center rounded-full text-white font-extrabold shadow-[0_6px_16px_-6px_rgba(210,45,128,0.6)]"
        style={{ background: "hsl(330 65% 50%)", width: "38%", height: "38%", top: "4%", right: "6%", fontSize: "clamp(34px, 6dvh, 48px)", lineHeight: 1 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.15 }}
      >
        1
      </motion.span>
    </motion.div>
  );
}

/**
 * O passo "offer" do funil no iPhone: o sino (uma vez) e depois o paywall. Com a chave desligada, no braço
 * "sem", ou com o sino já visto, renderiza só o paywall (o funil de hoje). Quem a loja já disse que NÃO tem
 * teste grátis (usou o teste antes) pula o sino — a promessa "antes do teste acabar" seria falsa.
 */
export function AntesDoPaywallIOS({ area, onVoltar, desligado = false, children }: {
  area: AreaKey;
  /** o recuo de um passo (o mesmo do Voltar do paywall) */
  onVoltar?: () => void;
  /** já assina (a tela de Planos monta este passo pra cliente): nunca o sino */
  desligado?: boolean;
  /** o paywall */
  children: ReactNode;
}) {
  const [fase, setFase] = useState<"decidindo" | "sino" | "paywall">(() => {
    try { guardarForcaSino(); } catch { /* noop */ }
    return !desligado && deveMostrarSino() ? "decidindo" : "paywall";
  });
  const veioDoSinoRef = useRef(false);
  useEffect(() => {
    if (fase !== "decidindo") return;
    let vivo = true;
    const decidir = (temTeste: boolean | null) => {
      if (!vivo) return;
      if (temTeste === false) {
        trackEvent("funnel_click", { cta: "sino_pulado", motivo: "sem_teste", funil: "ios", loja: "ios", area, sino: "com" });
        setFase("paywall");
      } else setFase("sino");
    };
    const t = window.setTimeout(() => decidir(null), 700);
    void import("@/lib/revenuecat").then((rc) => {
      window.clearTimeout(t);
      try {
        const pronto = typeof rc.estadoRevenueCat === "function" && rc.estadoRevenueCat() === "pronto";
        const temAnual = typeof rc.temAnualIos === "function" && rc.temAnualIos();
        decidir(pronto && temAnual && typeof rc.anualIosTemTrial === "function" ? rc.anualIosTemTrial() : null);
      } catch { decidir(null); }
    }).catch(() => { window.clearTimeout(t); decidir(null); });
    return () => { vivo = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  if (fase === "decidindo") return <div className="flex-1" data-testid="ios-sino-decidindo" />;
  if (fase === "sino") return <SinoIOS area={area} onVoltar={onVoltar} onContinuar={() => { veioDoSinoRef.current = true; setFase("paywall"); window.scrollTo(0, 0); }} />;
  // do sino pro paywall: um esmaecer curto (sem o corte seco); sem o sino, o paywall de hoje, sem camada nenhuma
  if (veioDoSinoRef.current) {
    return (
      <motion.div className="w-full flex-1 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
        {children}
      </motion.div>
    );
  }
  return <>{children}</>;
}
