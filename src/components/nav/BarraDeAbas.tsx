import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck, LayoutGrid, CircleUserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { ABAS, abaDaRota, barraVisivel, guardarForcaNavDaUrl, lerTela, limparVolta, navAbasLigada, planoDeNavegacao, type IdDaAba } from "@/lib/nav-abas";

/**
 * A BARRA DE ABAS (1.0.17) — Hoje · Módulos · Você. Ver lib/nav-abas (regra, chave, Voltar do Android).
 *
 * Calma e de planner: fundo do cartão, linha fina em cima, ícone + rótulo curto (nada trunca: 3 palavras
 * curtas), ativo em tinta cheia com um traço curto em cima, inativo em cinza. Alvos de 44pt+, respeita a
 * área segura de baixo (a regra global `.fixed.bottom-0` do index.css soma o env(safe-area-inset-bottom)).
 * No computador (≥1024 px) some: o trilho lateral já faz esse papel (TrilhoLateral, com "Você" no pé).
 */
const ICONES: Record<IdDaAba, typeof CalendarCheck> = { hoje: CalendarCheck, modulos: LayoutGrid, voce: CircleUserRound };

/** A entrada logo abaixo no histórico é a Hoje que empilhou esta aba? (decide o "voltar 1" — ver planoDeNavegacao) */
let hojeLogoAbaixo = false;
let pendente: { para: string; hojeAbaixo: boolean } | null = null;
/** só pros testes */
export const __zerarPilhaDasAbas = () => { hojeLogoAbaixo = false; pendente = null; };

export function BarraDeAbas() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  guardarForcaNavDaUrl();
  const ligada = navAbasLigada();
  const aba = abaDaRota(pathname);
  const candidata = ligada && !!user && aba !== null;

  // a tela por baixo: raiz pronta? camada guiada por cima? (MutationObserver, coalescido por quadro)
  const [tela, setTela] = useState(() => (candidata ? lerTela() : { raizPronta: false, camadaPorCima: false }));
  useEffect(() => {
    if (!candidata) return;
    let quadro = 0;
    const reler = () => {
      if (quadro) return;
      const agendar = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame : (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16);
      quadro = agendar(() => {
        quadro = 0;
        const t = lerTela();
        setTela((ant) => (ant.raizPronta === t.raizPronta && ant.camadaPorCima === t.camadaPorCima ? ant : t));
      }) as unknown as number;
    };
    reler();
    const obs = new MutationObserver(reler);
    obs.observe(document.body, { childList: true, subtree: true });
    obs.observe(document.documentElement, { attributes: true });
    return () => { obs.disconnect(); if (quadro) { (window.cancelAnimationFrame ?? window.clearTimeout)(quadro); } };
  }, [candidata, pathname]);

  const visivel = barraVisivel({ ligada, logado: !!user, pathname, raizPronta: tela.raizPronta, camadaPorCima: tela.camadaPorCima });

  // pilha das abas: só a navegação que ESTA barra pediu mantém o "Hoje logo abaixo"
  const ultimoPath = useRef(pathname);
  useEffect(() => {
    if (ultimoPath.current === pathname) return;
    ultimoPath.current = pathname;
    if (pendente && pendente.para === pathname) hojeLogoAbaixo = pendente.hojeAbaixo;
    else hojeLogoAbaixo = false;
    pendente = null;
    // chegou numa aba: a "volta pra aba" das subpáginas perde o sentido
    if (abaDaRota(pathname)) limparVolta();
  }, [pathname]);
  useEffect(() => { if (abaDaRota(pathname)) limparVolta(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // o conteúdo das raízes ganha o respiro da barra (index.css: body.com-abas)
  useEffect(() => {
    document.body.classList.toggle("com-abas", visivel);
    return () => { document.body.classList.remove("com-abas"); };
  }, [visivel]);

  if (!visivel || !aba) return null;

  const ir = (para: string, id: IdDaAba) => {
    const plano = planoDeNavegacao(pathname, para, hojeLogoAbaixo);
    if (plano.tipo === "nada") {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ }
      return;
    }
    trackEvent("tab_click", { tab: id, de: aba });
    if (plano.tipo === "voltar") { pendente = { para, hojeAbaixo: false }; navigate(-1); return; }
    pendente = { para, hojeAbaixo: plano.tipo === "empilhar" ? true : hojeLogoAbaixo };
    navigate(para, { replace: plano.tipo === "substituir" });
  };

  return (
    <nav
      aria-label="Navegação principal"
      data-testid="barra-de-abas"
      className="barra-de-abas fixed bottom-0 inset-x-0 z-[45] lg:hidden bg-card/95 backdrop-blur border-t border-border"
    >
      <ul className="max-w-lg mx-auto grid grid-cols-3">
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          const Icone = ICONES[a.id];
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => ir(a.rota, a.id)}
                aria-current={ativa ? "page" : undefined}
                aria-label={a.rotulo}
                data-testid={`aba-${a.id}`}
                data-track={`aba:${a.id}`}
                className={`relative w-full min-h-[52px] flex flex-col items-center justify-center gap-0.5 pt-1.5 transition-colors duration-150 motion-reduce:transition-none ${
                  ativa ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span aria-hidden className={`absolute top-0 h-[2px] w-7 rounded-full transition-opacity duration-150 motion-reduce:transition-none ${ativa ? "bg-foreground opacity-100" : "opacity-0"}`} />
                <Icone className="w-[22px] h-[22px]" strokeWidth={ativa ? 2.3 : 1.8} aria-hidden />
                <span className={`text-[11px] leading-none whitespace-nowrap ${ativa ? "font-bold" : "font-medium"}`}>{a.rotulo}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
