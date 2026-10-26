import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { fogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";
import { CoreFire } from "./core-fire/CoreFire";
import { CORE_FIRE_COLORS, toneForDays, type CoreFireStatus } from "./core-fire/core-fire-data";
import "./fogo-sequencia.css";

/**
 * O FOGO UNIFICADO — UM componente pra pílula da Home nova, a folha "Um dia de cada vez" e o cartão da sequência das
 * Conquistas do Codex.
 * 26/10 (tarde): o DESENHO e a ANIMAÇÃO passam a ser a CHAMA SEM BORDA do Codex (./core-fire — cor chapada, sem
 * contorno, fluxo contínuo de 4,8 s no corpo e no miolo). As CORES POR MARCO são as das figurinhas novas da família de
 * pedra: âmbar 1–2 · petróleo 3–6 · violeta 7–13 · magenta 14–29 · ouro suave 30–99 · ouro luminoso 100+ — e a paleta
 * do caderno (`fogoDoCaderno`: discos da semana, cartão, faixas) sai das MESMAS cores, então chama, figurinha do marco
 * e cartão sempre batem.
 *
 * Estados (a API de antes): `aceso` (hoje garantido) → `done`, cor plena + movimento · `apagado` (sequência viva, hoje
 * ainda não) → `pending`, a mesma cor mais suave, parada · `neutro` (0 dias) → `unstarted`, cinza quieto.
 * `acender` = o pulso de acender do CoreFire (`celebrationKey`; quem chama decide — a pílula, 1x por dia).
 * Continuidade (rodada 3): remontar (trocar de aba, voltar pra Home) continua a chama na fase do relógio — o CoreFire
 * põe o relógio do SVG em `fireClockPhase()` toda vez que o movimento liga. prefers-reduced-motion desliga tudo.
 */
export type EstadoDoFogo = "aceso" | "apagado" | "neutro";

/** neutro = sem sequência · apagado = sequência viva mas HOJE ainda não garantido · aceso = garantido hoje. */
export const estadoDoFogo = (s: { dias: number; hojeFeito: boolean }): EstadoDoFogo => (s.dias <= 0 ? "neutro" : s.hojeFeito ? "aceso" : "apagado");

const STATUS: Record<EstadoDoFogo, CoreFireStatus> = { aceso: "done", apagado: "pending", neutro: "unstarted" };

/** A chama ocupa ~92 % da altura do CoreFire e ~75 % da caixa do desenho antigo: 0,88 mantém o mesmo peso visual
 * nos três lugares (pílula 26 → 23 px · cartão 42 → 37 px · folha 56 → 49 px) sem mudar a caixa de layout. */
export const alturaDaChama = (tamanho: number) => Math.round(tamanho * 0.88);

interface Props {
  dias: number;
  /** sem `estado`: aceso com dias > 0, neutro com 0 */
  estado?: EstadoDoFogo;
  tamanho?: number;
  /** um halo suave atrás (as Conquistas e a folha usam só no ouro luminoso, 100+) */
  brilho?: boolean;
  /** a chama viva (fluxo contínuo); padrão ligada, e só vale no aceso */
  viva?: boolean;
  /** o pulso de acender: cada subida de false → true toca o acender do CoreFire uma vez */
  acender?: boolean;
  /** a subida de faixa do caderno (Conquistas) */
  subiu?: boolean;
  /** a faísca ✦ do ouro (Conquistas) */
  faisca?: boolean;
  className?: string;
  style?: CSSProperties;
  testid?: string;
}

export const FogoSequencia = ({ dias, estado, tamanho = 42, brilho = false, viva = true, acender = false, subiu = false, faisca = false, className, style, testid = "fg-seq" }: Props) => {
  const reduzir = !!useReducedMotion();
  const est: EstadoDoFogo = estado ?? (dias > 0 ? "aceso" : "neutro");
  const neutro = est === "neutro" || !(dias > 0);
  const status = neutro ? "unstarted" : STATUS[est];
  const tom = neutro ? "gray" : toneForDays(dias);
  const faixa = fogoDoCaderno(dias);
  const [celebracao, setCelebracao] = useState(0);
  useEffect(() => { if (acender && !reduzir) setCelebracao((k) => k + 1); }, [acender, reduzir]);
  const altura = alturaDaChama(tamanho);
  const halo = brilho && !neutro ? `drop-shadow(0 0 ${Math.max(2, Math.round(altura / 8))}px ${CORE_FIRE_COLORS[tom].body}66)` : undefined;
  return (
    <span
      className={`fg-seq${className ? ` ${className}` : ""}`}
      data-testid={testid}
      data-fogo={neutro ? "neutro" : est}
      data-faixa={neutro ? "apagado" : faixa.id}
      data-tom={tom}
      data-viva={viva && status === "done" && !reduzir ? "" : undefined}
      data-acende={acender && !reduzir ? "" : undefined}
      data-subiu={subiu && !reduzir ? "" : undefined}
      data-ouro={dias >= 100 ? "" : undefined}
      style={{ "--fg-t": `${tamanho}px`, ...style } as CSSProperties}
      aria-hidden
    >
      <CoreFire tone={tom} status={status} size={altura} motion={viva && !reduzir} celebrationKey={celebracao} style={halo ? { filter: halo } : undefined} />
      {faisca && <span className="cn-fogo-faisca">✦</span>}
    </span>
  );
};
