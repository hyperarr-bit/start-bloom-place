/**
 * PAGO (v105, 05/09) — a tela dos 3 segundos entre "a folha fechou" e
 * "cria a conta".
 *
 * O que os dados mandaram (28/08→04/09, 207 vendas na Play): a conta é criada
 * DEPOIS da compra em 92% dos casos, mediana de 22 s depois de pagar; 15%
 * tiveram o app morto embaixo da folha do Google e só terminaram o cadastro
 * numa sessão seguinte. Ou seja: o cadastro pós-compra é a regra, não a
 * exceção — e a pessoa chegava nele sem ninguém ter dito "deu certo".
 *
 * Ordem nova (quem liga é o ComecarW): paywall → PagoScreen (comemora e pede
 * "Guardar meu acesso") → SignupScreen → LiberandoScreen (sincroniza o
 * RevenueCat, sem comemorar de novo) → "/".
 *
 * A cena: 8 RECORTES dos módulos de verdade (o mesmo vocabulário da welcome
 * e do painel — tile pastel + ícone lucide + um dado real) convergem pra uma
 * LENTE de vidro no centro, que então mostra o certo verde e solta um anel
 * magenta. Tudo em CSS, só transform/opacity; com `prefers-reduced-motion`
 * fica no estado final, parado. Nenhum timer JS: não há o que vazar no
 * desmonte (a tela some assim que a pessoa toca no botão).
 *
 * Os pares ícone/pastel são os do ModuleDrawer (o mesmo mapa que a welcome
 * usa). Ficam DECLARADOS aqui, e não importados de `@/lib/funnel-icones`,
 * porque esse arquivo ainda está nascendo em outra sessão — a tela pós-compra
 * não pode depender de export que ainda pode mudar de nome.
 */
import { useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AREAS, type AreaKey } from "@/lib/funnel";
import { MODULO_VISUAL } from "@/lib/funnel-icones";
import { trackEvent } from "@/lib/analytics";

const GRAFITE = "#16121c";
const MAGENTA = "hsl(330 65% 50%)";
const VERDE = "#127A56";
const RAIO_LENTE = 78;

/** Um recorte: módulo, dado pequeno de verdade, e a pose ESPALHADA (dx/dy/r,
 *  a partir do centro do palco). A pose final — agrupada embaixo da lente —
 *  é calculada: 8 pontos num anel de 30 px, escala 0,42. */
type Recorte = { id: string; dado: string; dx: number; dy: number; r: number };
/** Os mesmos 8 da welcome (ranking real de uso), com ícone e pastel de
 *  MODULO_VISUAL — uma fonte só pro funil inteiro. */
const RECORTES: Recorte[] = [
  { id: "financas", dado: "Sobrando R$ 1.240", dx: -80, dy: -92, r: -6 },
  { id: "rotina", dado: "Hoje ●●●●○", dx: 60, dy: -104, r: 5 },
  { id: "treino", dado: "3 de 5", dx: 118, dy: -50, r: 8 },
  { id: "dieta", dado: "1.640 kcal", dx: -100, dy: -18, r: 4 },
  { id: "saude", dado: "Água 6 de 8", dx: 104, dy: 22, r: -5 },
  { id: "desenvolvimento", dado: "62%", dx: -118, dy: 58, r: 6 },
  { id: "casa", dado: "Luz vence sexta", dx: -20, dy: 100, r: -4 },
  { id: "relacionamentos", dado: "Ligar pra mãe", dx: 92, dy: 92, r: 7 },
];

const poseFinal = (i: number) => {
  const ang = ((i * 45 + 22) * Math.PI) / 180;
  return { ex: Math.round(30 * Math.cos(ang)), ey: Math.round(30 * Math.sin(ang)) };
};
/** `translate(-50%,-50%)` centra o recorte no ponto (a largura varia com o
 *  texto); o segundo translate é a pose. Vai inteiro em cada quadro porque
 *  keyframe substitui o transform todo. */
const transformDe = (dx: number, dy: number, r: number, s: number) =>
  `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${r}deg) scale(${s})`;

/* Linha do tempo (ms): 0–245 recortes pousam (escalonado) · 300–760 a lente se
 * forma · 380–940 recortes convergem · 850 certo + anel. Estado-base de cada
 * peça = estado FINAL; as animações partem do inicial com fill `both`, e a
 * media query só desliga a animação — sobra o final, sem regra por peça. */
const CSS = `
.pago-palco{position:relative;height:260px;width:100%;overflow:hidden}
.pago-rc{position:absolute;left:50%;top:50%;z-index:1}
.pago-rc-in{display:flex;align-items:center;gap:7px;background:#fff;border-radius:12px;padding:6px 10px 6px 6px;white-space:nowrap;
  box-shadow:0 0 0 3px #fff,0 8px 18px -8px rgba(22,18,28,.28),0 1px 2px rgba(22,18,28,.06);
  animation:pago-pop 220ms ease-out both}
.pago-tile{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.pago-nome{display:block;font-size:11.5px;font-weight:700;line-height:1.1;color:${GRAFITE};letter-spacing:-.01em}
.pago-dado{display:block;font-size:10.5px;font-weight:500;line-height:1.2;color:#6b6470;margin-top:1px}
.pago-lente{position:absolute;left:50%;top:50%;width:${RAIO_LENTE * 2}px;height:${RAIO_LENTE * 2}px;margin-left:-${RAIO_LENTE}px;margin-top:-${RAIO_LENTE}px;border-radius:50%;z-index:2;
  background:radial-gradient(circle at 36% 30%,rgba(255,255,255,.98) 0%,rgba(255,255,255,.80) 48%,rgba(255,247,251,.62) 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -10px 24px rgba(196,42,115,.07),inset 0 0 0 1px rgba(22,18,28,.06),0 22px 44px -22px rgba(22,18,28,.38);
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
  animation:pago-lente 460ms cubic-bezier(.2,.8,.2,1) 300ms both}
.pago-check{position:absolute;left:50%;top:50%;width:56px;height:56px;margin-left:-28px;margin-top:-28px;display:flex;align-items:center;justify-content:center;color:${VERDE};z-index:3;
  animation:pago-check 320ms cubic-bezier(.34,1.56,.64,1) 850ms both}
.pago-anel{position:absolute;left:50%;top:50%;width:${RAIO_LENTE * 2}px;height:${RAIO_LENTE * 2}px;margin-left:-${RAIO_LENTE}px;margin-top:-${RAIO_LENTE}px;border-radius:50%;border:2px solid ${MAGENTA};z-index:3;pointer-events:none;
  opacity:0;transform:scale(.7);animation:pago-anel 900ms ease-out 850ms forwards}
.pago-cta{width:100%;height:56px;border-radius:999px;background:${GRAFITE};color:#fff;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;margin-top:22px;
  box-shadow:0 12px 28px -14px rgba(22,18,28,.55);transition:transform .12s ease;-webkit-tap-highlight-color:transparent}
.pago-cta:active{transform:scale(.985)}
@keyframes pago-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes pago-lente{from{opacity:0;transform:scale(.72)}to{opacity:1;transform:scale(1)}}
@keyframes pago-check{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
@keyframes pago-anel{from{opacity:.85;transform:scale(.72)}to{opacity:0;transform:scale(1.6)}}
${RECORTES.map((rc, i) => {
  const { ex, ey } = poseFinal(i);
  return `@keyframes pago-conv-${i}{from{transform:${transformDe(rc.dx, rc.dy, rc.r, 1)}}to{transform:${transformDe(ex, ey, rc.r / 2, 0.42)}}}`;
}).join("\n")}
@media (prefers-reduced-motion:reduce){.pago-rc,.pago-rc-in,.pago-lente,.pago-check,.pago-anel{animation:none!important}}
`;

export function PagoScreen({ area, onContinuar }: { area: AreaKey; onContinuar: () => void }) {
  useEffect(() => { trackEvent("app_pago_visto", { area }); }, [area]);

  const seguir = () => {
    trackEvent("app_pago_seguiu", { area });
    onContinuar();
  };

  return (
    <div
      className="w-full max-w-sm mx-auto pb-4"
      style={{ background: "linear-gradient(180deg,#FFF7FB 0%,#FFFFFF 45%)" }}
      data-testid="pago-screen"
    >
      <style>{CSS}</style>

      <div className="pago-palco" aria-hidden>
        {RECORTES.map((rc, i) => {
          const { ex, ey } = poseFinal(i);
          const v = MODULO_VISUAL[rc.id];
          const Icon = v.Icon;
          return (
            <div
              key={rc.id}
              className="pago-rc"
              style={{
                transform: transformDe(ex, ey, rc.r / 2, 0.42),
                animation: `pago-conv-${i} 420ms cubic-bezier(.55,0,.2,1) ${380 + i * 20}ms both`,
              }}
            >
              <div className="pago-rc-in" style={{ animationDelay: `${30 + i * 35}ms` }}>
                <span className="pago-tile" style={{ background: v.cor, color: v.tinta }}>
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span>
                  <span className="pago-nome">{v.nome}</span>
                  <span className="pago-dado">{rc.dado}</span>
                </span>
              </div>
            </div>
          );
        })}
        <div className="pago-lente" />
        <div className="pago-anel" />
        <div className="pago-check">
          <Check size={46} strokeWidth={3.4} />
        </div>
      </div>

      <h1
        className="text-center"
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 800, fontSize: 34, letterSpacing: "-.03em", lineHeight: 1.05, color: GRAFITE, marginTop: 4,
        }}
      >
        Pronto.
      </h1>
      <p className="text-center mt-3 text-[15.5px] leading-relaxed px-2" style={{ color: "#5c5561" }}>
        O CORE inteiro é seu. Vamos começar por <b style={{ color: GRAFITE, fontWeight: 700 }}>{AREAS[area].nome}</b>, como você pediu.
      </p>

      <button type="button" className="pago-cta" onClick={seguir}>
        Guardar meu acesso <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
      </button>
      <p className="text-center mt-3 px-3" style={{ fontSize: 11.5, lineHeight: 1.45, color: "#8a8390" }}>
        Leva 10 segundos. É com a conta que você entra em qualquer aparelho.
      </p>
    </div>
  );
}
