import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { useHomeNova } from "@/hooks/use-home-nova";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { trackEvent } from "@/lib/analytics";
import { dialogoAberto, lerTela, limparVolta, marcarVolta, planoDeNavegacao } from "@/lib/nav-abas";
import { EVENTO_HOME_NOVA_MAIS, pedirMaisNaHome } from "@/lib/home-nova";
import { marcarTrocaDeAba } from "@/lib/troca-de-rota";
import { BarraVidro, DicaDoMais } from "./BarraVidro";
import { CHAVE_DICA_MAIS, ESPERA_DICA_MAIS_MS, dicaDoMaisDevida, encerrarDicaMais, registrarAparicaoDicaMais } from "@/lib/dica-mais";
import { EVENTO_MISSAO_DOSES, lerMissao } from "@/lib/missao-doses";
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
/** a dica do "+" já contou a aparição nesta abertura do app (fechar e abrir conta de novo; voltar pra Home, não) */
let dicaContadaNestaAbertura = false;
export const __zerarDicaDaBarraVidro = () => { dicaContadaNestaAbertura = false; };
let pendente: { para: string; hojeAbaixo: boolean } | null = null;
/** só pros testes */
export const __zerarPilhaDaBarraVidro = () => { hojeLogoAbaixo = false; pendente = null; };

export function BarraVidroGlobal() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get, set } = useUserData();
  const nova = useHomeNova(user);
  const aba = abaDa(pathname);
  const candidata = nova.ligada && !!user && aba !== null;

  // a tela por baixo: raiz pronta? camada guiada por cima? folha/diálogo padrão (Radix, z-50) aberto?
  const ler = () => ({ ...lerTela(), dialogo: dialogoAberto() });
  const [tela, setTela] = useState(() => (candidata ? ler() : { raizPronta: false, camadaPorCima: false, dialogo: false }));
  useEffect(() => {
    if (!candidata) return;
    let quadro = 0;
    const reler = () => {
      if (quadro) return;
      const agendar = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame : (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16);
      quadro = agendar(() => {
        quadro = 0;
        const t = ler();
        setTela((ant) => (ant.raizPronta === t.raizPronta && ant.camadaPorCima === t.camadaPorCima && ant.dialogo === t.dialogo ? ant : t));
      }) as unknown as number;
    };
    reler();
    const obs = new MutationObserver(reler);
    // data-state: o Radix marca open/closed na própria folha (abrir/fechar sem tirar o nó durante a animação)
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    obs.observe(document.documentElement, { attributes: true });
    return () => { obs.disconnect(); if (quadro) (window.cancelAnimationFrame ?? window.clearTimeout)(quadro); };
  }, [candidata, pathname]);

  /** a barra pertence a esta tela (o respiro de baixo também) */
  const naTela = candidata && !tela.camadaPorCima && (aba !== "inicio" || tela.raizPronta);
  /** …e está na frente: com uma folha/diálogo padrão aberto (z-50) ela sai, pra não ficar por cima dele */
  const visivel = naTela && !tela.dialogo;

  const ultimoPath = useRef(pathname);
  useEffect(() => {
    if (ultimoPath.current === pathname) return;
    ultimoPath.current = pathname;
    if (pendente && pendente.para === pathname) hojeLogoAbaixo = pendente.hojeAbaixo;
    else hojeLogoAbaixo = false;
    pendente = null;
    if (abaDa(pathname)) limparVolta();
  }, [pathname]);

  // Conquistas e Você ganham o respiro da barra; a Home nova já tem o seu (o respiro fica mesmo com um diálogo aberto: a página não pula)
  useEffect(() => {
    const precisa = naTela && aba !== "inicio";
    document.body.classList.toggle("com-barra-vidro", precisa);
    return () => { document.body.classList.remove("com-barra-vidro"); };
  }, [naTela, aba]);

  /* 1.0.19 (dono 26/10) — A DICA DO "+" (lib/dica-mais): só na Início, com a barra na frente (sem camada guiada,
     festa ou folha por cima) e parada por ESPERA_DICA_MAIS_MS; some no 1º toque e nunca volta. */
  const [, setMissaoVersao] = useState(0);
  useEffect(() => {
    const reler = () => setMissaoVersao((v) => v + 1);
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);
  const marcaNaConta = get<unknown>(CHAVE_DICA_MAIS, null);
  const dicaCandidata = visivel && aba === "inicio" && (() => { try { return dicaDoMaisDevida(lerMissao(), marcaNaConta, undefined, dicaContadaNestaAbertura); } catch { return false; } })();
  const [dicaNaTela, setDicaNaTela] = useState(false);
  useEffect(() => {
    if (!dicaCandidata) { setDicaNaTela(false); return; }
    const t = window.setTimeout(() => {
      setDicaNaTela(true);
      if (!dicaContadaNestaAbertura) {
        dicaContadaNestaAbertura = true;
        const marca = registrarAparicaoDicaMais(marcaNaConta);
        set(CHAVE_DICA_MAIS, marca, { system: true });
        trackEvent("home_dica_mais", { acao: "vista", aparicao: marca.aparicoes ?? 1 });
      }
    }, ESPERA_DICA_MAIS_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dicaCandidata]);
  useEffect(() => {
    if (!dicaNaTela) return;
    // o 1º toque em QUALQUER lugar encerra (no "+" = usada: o toque segue e abre a folha)
    const aoTocar = (e: Event) => {
      const alvo = e.target as Element | null;
      const via = alvo?.closest?.('[data-testid="hn-mais"]') ? "usada" : "dispensada";
      const marca = encerrarDicaMais(via);
      set(CHAVE_DICA_MAIS, marca, { system: true });
      trackEvent("home_dica_mais", { acao: via });
      setDicaNaTela(false);
    };
    document.addEventListener("pointerdown", aoTocar, true);
    return () => document.removeEventListener("pointerdown", aoTocar, true);
  }, [dicaNaTela, set]);

  if (!visivel || !aba) return null;

  const ir = (para: AbaNova) => {
    const rota = ROTA[para];
    const plano = planoDeNavegacao(pathname, rota, hojeLogoAbaixo);
    if (plano.tipo === "nada") { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } return; }
    trackEvent("tab_click", { tab: para, de: aba, barra: "vidro" });
    marcarTrocaDeAba(); // rodada 3: a troca de aba é instantânea (sem a foto cruzando as duas telas)
    if (para === "conquistas") marcarVolta("/conquistas", "/home");
    const state = para === "conquistas" ? { origem: "home" } : undefined;
    if (plano.tipo === "voltar") { pendente = { para: rota, hojeAbaixo: false }; navigate(-1); return; }
    pendente = { para: rota, hojeAbaixo: plano.tipo === "empilhar" ? true : hojeLogoAbaixo };
    navigate(rota, { replace: plano.tipo === "substituir", state });
  };
  const mais = () => {
    trackEvent("home_mais_abrir", { de: aba });
    if (aba === "inicio") { try { window.dispatchEvent(new CustomEvent(EVENTO_HOME_NOVA_MAIS)); } catch { /* noop */ } return; }
    // fora da Home: leva pra Home SEM empilhar histórico (volta 1 se a Home está logo abaixo; senão substitui) e a
    // folha abre ao chegar (pedido em memória, consumido 1x pela Home — nunca no estado da navegação)
    pedirMaisNaHome();
    marcarTrocaDeAba();
    const plano = planoDeNavegacao(pathname, "/home", hojeLogoAbaixo);
    pendente = { para: "/home", hojeAbaixo: false };
    if (plano.tipo === "voltar") { navigate(-1); return; }
    navigate("/home", { replace: true });
  };

  const nome = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  return (
    <div className="hn he he-so-vars" data-testid="barra-vidro-global">
      <BarraVidro ativa={aba} iniciais={iniciaisDe(nome)} onIr={ir} onMais={mais} dica={dicaNaTela && dicaCandidata ? <DicaDoMais /> : null} />
    </div>
  );
}
