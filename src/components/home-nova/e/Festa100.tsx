import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { localDayKey } from "@/lib/utils";
import { CHAVE_SCORE_100_HOME_NOVA } from "@/lib/home-nova";
import { TINTA } from "./paleta";

/**
 * A FESTINHA DO 100 (Home nova, dono 26/10: "o Cal AI não muda o símbolo quando bate 100"). No 100 a ESTRELA
 * FICA — nada de ✓ no lugar dela. O que muda é a cor: a estrela, o anel e o número passam do preto (TINTA) pro
 * ÂMBAR, o laranja-âmbar do score antigo (--warning, hsl(38 92% 50%), o que o DayScoreRing usava), ajustado
 * (home-e.css: --he-ouro nos traços; --he-ouro-texto, mais fundo no claro, no número pra ter contraste).
 *
 * A passagem é uma mini animação (~0,9 s, home-e.css): a estrela dá um pulo com um leve giro, um brilho âmbar
 * discreto acende atrás dela e some, o anel solta um "eco" que se desfaz, e as cores trocam no pico do pulo (0,2 s).
 * Toca UMA vez por dia (chave do aparelho `core-home-nova-score-100`, lib/chaves-do-aparelho): reabrir o app ou
 * trocar de aba com o dia já em 100 mostra o âmbar parado. Enquanto a comemoração de tela cheia estiver pra abrir
 * ou aberta (`pausada`), espera — a festa toca quando a pessoa volta pra Home. prefers-reduced-motion: âmbar direto.
 */
export type Fase100 = "preto" | "festa" | "ouro";

export const COR_OURO = "var(--he-ouro)";
export const COR_OURO_TEXTO = "var(--he-ouro-texto)";
/** quanto a festa dura (a maior das animações do CSS) */
export const DURACAO_FESTA_MS = 950;

const jaFestejou = (): boolean => {
  try { return localStorage.getItem(CHAVE_SCORE_100_HOME_NOVA) === localDayKey(); } catch { return false; }
};
const marcarFesta = (): void => {
  try { localStorage.setItem(CHAVE_SCORE_100_HOME_NOVA, localDayKey()); } catch { /* sem storage: no máximo repete */ }
};

/**
 * A fase do 100 pro card do score. `forcar` (só a rota de dev) toca a festa a cada montagem e não grava nada.
 * Na montagem a festa espera o anel terminar de encher (~1,1 s); com a Home já na tela, 250 ms.
 */
export function useFesta100(score: number, pausada = false, forcar = false): Fase100 {
  const completo = score >= 100;
  const reduzido = !!useReducedMotion();
  const [fase, setFase] = useState<Fase100>(() => (completo && !forcar && jaFestejou() ? "ouro" : "preto"));
  const montou = useRef(Date.now());

  useEffect(() => {
    if (!completo) { setFase("preto"); return; }
    if (fase !== "preto") return;
    if (!forcar && jaFestejou()) { setFase("ouro"); return; }
    if (pausada) return;
    if (reduzido) { if (!forcar) marcarFesta(); setFase("ouro"); return; }
    const espera = Math.max(250, 1100 - (Date.now() - montou.current));
    const t = window.setTimeout(() => { if (!forcar) marcarFesta(); setFase("festa"); }, espera);
    return () => window.clearTimeout(t);
  }, [completo, pausada, forcar, reduzido, fase]);

  useEffect(() => {
    if (fase !== "festa") return;
    const t = window.setTimeout(() => setFase("ouro"), DURACAO_FESTA_MS);
    return () => window.clearTimeout(t);
  }, [fase]);

  return fase;
}

/** A cor dos traços (anel e estrela) na fase. */
export const corDaFase = (fase: Fase100): string => (fase === "preto" ? TINTA : COR_OURO);

/**
 * A ESTRELA da festa: o brilho atrás (só na festa), a estrela que pula (só na festa) e a cor que transiciona.
 * `tamanho` em px (a estrela do card tem 32; a da comemoração, maior).
 */
export const EstrelaFesta = ({ fase, tamanho, testid = "he-estrela" }: { fase: Fase100; tamanho: number; testid?: string }) => {
  const c = corDaFase(fase);
  return (
    <span className="he-estrela relative grid place-items-center" data-testid={testid} data-fase={fase} style={{ width: tamanho, height: tamanho }}>
      {fase === "festa" && <span className="he-estrela-brilho" aria-hidden />}
      <Star className="he-estrela-icone relative" style={{ width: tamanho, height: tamanho, color: c, fill: c }} strokeWidth={1.5} aria-hidden />
    </span>
  );
};

/** O "eco" do anel (um contorno âmbar que cresce e some) — só na festa; o pai é `relative`. */
export const EcoDoAnel = ({ fase, espessura }: { fase: Fase100; espessura: number }) =>
  fase === "festa" ? <span className="he-anel-eco" style={{ borderWidth: Math.max(2, Math.round(espessura / 3)) }} aria-hidden data-testid="he-anel-eco" /> : null;
