import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import { diasDoTesteDaLoja, EVENTO_TRIAL_CARTAO } from "@/lib/teste-da-loja";

/**
 * TELA DE PARABÉNS DO PÓS-COMPRA (1.0.21, FLUXO ENXUTO — dono 27/10: "a tela pós compra é uma tela nova bonita estilo
 * BitePal parabenizando, aí depois o usuário já entra na home").
 *
 * VERSÃO SIMPLES E LIMPA, no visual da Home nova: fundo chapado de ponta a ponta (inclusive atrás do relógio), Inter,
 * sem borda, um selo que se desenha, "Parabéns, Nome!" e um botão de tinta (preto no claro, claro no escuro, canto
 * cheio — o mesmo do "Continuar" da comemoração do dia 100). Confete curto, 1 vez, parado com "reduzir movimento".
 *
 * CONTRATO (pra trocar pela direção estilo BitePal escolhida pelo dono — ramo v1021-parabens): 1 arquivo, este
 * export, estas props. Quem monta (pages/funis/ios/CadastroIOS) cuida dos eventos (`parabens_view`/`parabens_entrar`),
 * da espera do acesso e da navegação — a tela só desenha e chama `onEntrar`.
 * Ela se declara camada (`role="dialog"` + `data-camada-guia="parabens"`): nenhuma festa de conquista abre por cima.
 */
export interface TelaParabensProps {
  /** o nome da pessoa (o 1º nome é tirado daqui; vazio = "Parabéns!") */
  nome?: string | null;
  /** "Entrar no CORE" → a Home */
  onEntrar: () => void;
}

/** "Lucas Andrade" → "Lucas"; nunca o começo de um e-mail. */
const primeiroNome = (nome: string | null | undefined): string => {
  const t = String(nome ?? "").trim();
  if (!t || t.includes("@")) return "";
  const p = t.split(/\s+/)[0] ?? "";
  return p.length > 20 ? "" : p.charAt(0).toUpperCase() + p.slice(1);
};

/** Com teste da loja: os dias dele; sem (mensal, código, web): o acesso, sem número. */
const fraseDoAcesso = (dias: number | null): string =>
  !dias ? "Seu acesso está liberado" : dias === 1 ? "Seu 1 dia grátis começou" : `Seus ${dias} dias grátis começaram`;
const lerDias = (): number | null => { try { return diasDoTesteDaLoja(); } catch { return null; } };

const CORES = ["#C42A73", "#F2B705", "#3BA55C", "#4C6FFF", "#F2711C", "#8B5CF6"];
const CONFETE = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: (i / 18) * 100 + (i % 3) * 3 - 4,
  atraso: 0.55 + (i % 6) * 0.05,
  giro: i % 2 ? 200 : -240,
  cor: CORES[i % CORES.length],
  w: i % 3 === 0 ? 9 : 6,
  h: i % 4 === 0 ? 6 : 11,
}));

export function TelaParabens({ nome, onEntrar }: TelaParabensProps) {
  useFaixaDoRelogioTransparente(true);
  const reduzir = !!useReducedMotion();
  const [dias, setDias] = useState(lerDias);
  useEffect(() => {
    const reler = () => setDias(lerDias());
    window.addEventListener(EVENTO_TRIAL_CARTAO, reler);
    return () => window.removeEventListener(EVENTO_TRIAL_CARTAO, reler);
  }, []);
  const [foi, setFoi] = useState(false);
  const entrar = () => { if (foi) return; setFoi(true); onEntrar(); };
  const n = primeiroNome(nome);
  const entra = (atraso: number) => (reduzir
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: atraso, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } });

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parabens-titulo"
      data-testid="tela-parabens"
      data-camada-guia="parabens"
      className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-background text-foreground"
      style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      initial={reduzir ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {!reduzir && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {CONFETE.map((c) => (
            <motion.span
              key={c.id}
              className="absolute top-0 rounded-[2px]"
              style={{ left: `${c.x}%`, width: c.w, height: c.h, background: c.cor }}
              initial={{ y: -30, opacity: 0, rotate: 0 }}
              animate={{ y: "70vh", opacity: [0, 1, 1, 0], rotate: c.giro }}
              transition={{ delay: c.atraso, duration: 2.1, ease: "easeIn" }}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pt-[var(--app-safe-top,0px)]">
        <motion.div
          className="grid place-items-center w-[104px] h-[104px] rounded-full"
          style={{ background: "hsl(330 65% 50% / 0.1)" }}
          initial={reduzir ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden data-testid="parabens-selo">
            <motion.path
              d="M14 27.5 L22.5 36 L39 18"
              stroke="hsl(330 65% 50%)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduzir ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        <motion.h1 id="parabens-titulo" className="mt-8 text-[34px] leading-[1.08] font-bold tracking-[-0.03em]" {...entra(0.45)}>
          {n ? <>Parabéns, {n}!</> : "Parabéns!"}
        </motion.h1>
        <motion.p className="mt-3 text-[17px] leading-snug text-muted-foreground max-w-[300px]" {...entra(0.6)}>
          Seu CORE está pronto. Tudo o que você organiza fica num lugar só.
        </motion.p>
        <motion.p className="mt-6 text-[14px] font-semibold text-foreground/70" data-testid="parabens-acesso" {...entra(0.75)}>
          {fraseDoAcesso(dias)}
        </motion.p>
      </div>

      <motion.div className="px-5 pb-[max(24px,calc(var(--app-safe-bottom,0px)+12px))]" {...entra(0.9)}>
        <button
          type="button"
          onClick={entrar}
          data-testid="parabens-entrar"
          className="w-full h-14 rounded-full bg-foreground text-background text-[17px] font-semibold active:scale-[0.98] transition-transform"
        >
          Entrar no meu CORE
        </button>
      </motion.div>
    </motion.div>
  );
}

export default TelaParabens;
