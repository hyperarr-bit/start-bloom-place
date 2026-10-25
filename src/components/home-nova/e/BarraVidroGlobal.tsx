import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useHomeNova } from "@/hooks/use-home-nova";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { trackEvent } from "@/lib/analytics";
import { lerTela, limparVolta, marcarVolta, planoDeNavegacao } from "@/lib/nav-abas";
import { EVENTO_HOME_NOVA_MAIS } from "@/lib/home-nova";
import { BarraVidro } from "./BarraVidro";
import { iniciaisDe } from "../HomeNova";
import type { AbaNova } from "../BarraFlutuante";
import "../home-nova.css";
import "./home-e.css";

/**
 * A BARRA DE VIDRO, GLOBAL (1.0.19) — Início · Conquistas · Você + "+". Montada no App ao lado da BarraDeAbas
 * da 1.0.17 (que segue desligada), só com a HOME NOVA ligada pra esta conta (use-home-nova).
 *
 * As mesmas regras da nav em abas (lib/nav-abas): só nas 3 telas-raiz (/home, /conquistas, /voce), logado, sem
 * camada guiada por cima (missão em doses, intro de módulo, holofote — `lerTela`), e na Home só quando a Home de
 * verdade está na tela (ATRIBUTO_RAIZ — nunca sobre o tutorial/carregamento). O Voltar do Android segue o
 * `planoDeNavegacao` (Home empilha; aba → aba substitui; voltar pra Home desempilha). Conquistas e Você ganham
 * o respiro de baixo pelo body (`com-barra-vidro`, index.css); a Home nova já tem o próprio.
 * O "+" na Home abre a folha das ações (EVENTO_HOME_NOVA_MAIS); nas outras abas leva pra Home já com a folha.
 */
const ROTA: Record<AbaNova, string> = { inicio: "/home", conquistas: "/conquistas", voce: "/voce" };
const abaDa = (pathname: string): AbaNova | null => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (Object.keys(ROTA) as AbaNova[]).find((k) => ROTA[k] === p) ?? null;
};

let hojeLogoAbaixo = false;
let pendente: { para: string; hojeAbaixo: boolean } | null = null;
/** só pros testes */
export const __zerarPilhaDaBarraVidro = () => { hojeLogoAbaixo = false; pendente = null; };

export function BarraVidroGlobal() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get } = useUserData();
  const nova = useHomeNova(user);
  const aba = abaDa(pathname);
  const candidata = nova.ligada && !!user && aba !== null;

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
    return () => { obs.disconnect(); if (quadro) (window.cancelAnimationFrame ?? window.clearTimeout)(quadro); };
  }, [candidata, pathname]);

  const visivel = candidata && !tela.camadaPorCima && (aba !== "inicio" || tela.raizPronta);

  const ultimoPath = useRef(pathname);
  useEffect(() => {
    if (ultimoPath.current === pathname) return;
    ultimoPath.current = pathname;
    if (pendente && pendente.para === pathname) hojeLogoAbaixo = pendente.hojeAbaixo;
    else hojeLogoAbaixo = false;
    pendente = null;
    if (abaDa(pathname)) limparVolta();
  }, [pathname]);

  // Conquistas e Você ganham o respiro da barra; a Home nova já tem o seu
  useEffect(() => {
    const precisa = visivel && aba !== "inicio";
    document.body.classList.toggle("com-barra-vidro", precisa);
    return () => { document.body.classList.remove("com-barra-vidro"); };
  }, [visivel, aba]);

  if (!visivel || !aba) return null;

  const ir = (para: AbaNova) => {
    const rota = ROTA[para];
    const plano = planoDeNavegacao(pathname, rota, hojeLogoAbaixo);
    if (plano.tipo === "nada") { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } return; }
    trackEvent("tab_click", { tab: para, de: aba, barra: "vidro" });
    if (para === "conquistas") marcarVolta("/conquistas", "/home");
    const state = para === "conquistas" ? { origem: "home" } : undefined;
    if (plano.tipo === "voltar") { pendente = { para: rota, hojeAbaixo: false }; navigate(-1); return; }
    pendente = { para: rota, hojeAbaixo: plano.tipo === "empilhar" ? true : hojeLogoAbaixo };
    navigate(rota, { replace: plano.tipo === "substituir", state });
  };
  const mais = () => {
    trackEvent("home_mais_abrir", { de: aba });
    if (aba === "inicio") { try { window.dispatchEvent(new CustomEvent(EVENTO_HOME_NOVA_MAIS)); } catch { /* noop */ } return; }
    pendente = { para: "/home", hojeAbaixo: false };
    navigate("/home", { state: { mais: true } });
  };

  const nome = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  return (
    <div className="hn he he-so-vars" data-testid="barra-vidro-global">
      <BarraVidro ativa={aba} iniciais={iniciaisDe(nome)} onIr={ir} onMais={mais} />
    </div>
  );
}
