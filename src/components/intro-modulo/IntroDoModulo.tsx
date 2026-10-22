import { useEffect, useRef, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import {
  INTROS, chavesDoTutorialAntigo, passoDaIntroNaTela, doseNaTela, introAbertaNesteAparelho, marcarIntroAbertaNoAparelho, marcarIntroVista, montarNaTela, porQueNaoMostrar, retomadaDaIntro,
  type FimDaIntro, type IntroDeUmToqueConfig, type Leitor, type RetomadaDaIntro,
} from "@/lib/intro-modulo";
import { missaoAtual, trialCartaoAtivo } from "@/lib/teste-gratis";
import { IntroGuiada } from "./IntroGuiada";
import { IntroDeUmToque } from "./IntroDeUmToque";
import { ConhecerMaisHost } from "./ConhecerMais";
import { temTour } from "@/lib/conhecer-mais";
import { trackEvent } from "@/lib/analytics";

/** Só a camada de guia de OUTRO componente conta (a própria intro também é uma camada). 1.0.17 (gravação no Simulador,
 *  20/10): o ANEL da própria intro é um `demo-holofote` (o Anel da demo guiada, testid `intro-modulo-anel[-olhar]`); quando
 *  ele acendia antes da conferência de 700 ms — a Rotina numa conta vazia acende em ~0,6 s num aparelho rápido — a intro
 *  se via como "outra guia por cima" e sumia 0,8 s depois de aparecer, sem marcar vista. */
const OUTRA_GUIA = '[data-camada-guia]:not([data-camada-guia="intro-modulo"]):not([data-testid^="intro-modulo"])';

/**
 * Outra guia está (ou vai estar) na tela deste módulo? O holofote/tutorial antigo (force-new-user-tutorial,
 * tutorial-replay-modules), a Missão do teste grátis antiga (MissaoDoTrial) e qualquer camada de guia já no
 * DOM. A missão em doses NÃO entra aqui — a regra dela é a de lib/intro-modulo (introBloqueadaPelaMissao),
 * que só bloqueia a dose de hoje, a dose na tela e o módulo cuja dose já foi feita (dono, 17/10).
 */
function outraGuiaAtiva(moduleId: string, get: Leitor): boolean {
  try {
    if (typeof document !== "undefined" && document.querySelector(OUTRA_GUIA)) return true;
    const forceNew = !!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    if (forceNew) return true;
    const replay = get<string[]>("tutorial-replay-modules", []);
    if (Array.isArray(replay) && replay.includes(moduleId)) return true;
    if (trialCartaoAtivo() && missaoAtual()) return true;
  } catch { /* sem storage: segue */ }
  return false;
}

/**
 * A PORTA DA INTRO (16/10): decide UMA vez, quando a conta está CARREGADA, se este módulo mostra a
 * intro guiada (Finanças/Rotina/Saúde) ou a intro de 1 toque (os outros 13, 17/10), e grava "vista" no aparelho E
 * na conta ao terminar (feita ou pulada — e "feita" na lista de feitas, que a missão lê). As regras
 * moram em lib/intro-modulo (porQueNaoMostrar):
 *   · chave desligada · módulo sem intro · já vista (aparelho ou conta) · módulo já apresentado de
 *     outro jeito · módulo COM dado (conta de antes) · missão (dose na tela, dose de hoje por fazer,
 *     dose feita) · outra guia por cima (holofote, festa, tutorial antigo).
 * Espera o `loaded` porque a lista "vistas" da conta e o dado do módulo chegam na hidratação — sem
 * isso, o 2º aparelho mostraria a intro de novo antes de saber que a conta já viu.
 * O MONTAR do módulo (config.montar — Finanças: ramo v1016-financas; Rotina: v1016-rotina), que só roda
 * como 1ª dose da missão: enquanto `<html <atributo>>` está lá a intro ESPERA; quando ele termina (o
 * evento de fim na window e/ou o atributo some) ela decide e começa logo em seguida — com
 * `detail.resultado === "pronto"` a intro guiada sabe que veio do montar (Rotina: "marca o primeiro
 * quando fizer"; Finanças: com renda gravada, o "olha" vai no QUANTO POSSO GASTAR HOJE). Numa abertura
 * por curiosidade o montar não aparece e nada disso acontece.
 * Fechar o app no meio: volta 1 vez; na 2ª aparição já marca vista (como pulada; se ela terminar,
 * vira feita) — nunca vira insistência.
 */
export function IntroDoModulo({ moduleId }: { moduleId: string }) {
  const { get, set, loaded } = useUserData();
  const config = INTROS[moduleId];
  const [estado, setEstado] = useState<"decidindo" | "visivel" | "nada">("decidindo");
  /** a guiada terminou o "olha" e passou o bastão pros passos de 1 toque (com o rótulo do que entrou) */
  const [continuacao, setContinuacao] = useState<{ rotulos: string[] } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const getRef = useRef(get); getRef.current = get;
  const setRef = useRef(set); setRef.current = set;
  const abertaTratada = useRef(false);
  /* B1 (1.0.18, QA 21/10): a 2ª aparição RETOMA no passo onde parou (Detox/Treino abandonados no passo 2 depois de o
   * passo 1 gravar o hábito/treino nunca voltavam; Casa sem dado voltava do começo e repetia a pergunta) */
  const retomada = useRef<RetomadaDaIntro | null>(null);
  /** o montar do módulo acabou de terminar com "pronto" (a intro guiada muda o pedido) */
  const depoisDoMontar = useRef(false);
  const montar = config?.montar;
  /* 17/10 (achado na missão 1.0.16, no app de verdade): o SpotlightOverlay antigo de cada módulo marca
   * `spotlight-done-<módulo>` pra QUALQUER conta logada na 1ª abertura do módulo — e o efeito dele roda ANTES do
   * desta porta (ele vem antes na árvore). Lido depois, isso virava "módulo já apresentado" e a intro NUNCA aparecia
   * pra conta nova logada (Casa, Saúde, Rotina…). O "tutorial antigo" vale pelo que estava gravado ANTES desta
   * abertura: a leitura fica congelada no 1º render com a conta carregada (antes de qualquer efeito). E se a intro já
   * APARECEU neste aparelho (fechou o app no meio), a marca veio dessa visita: não conta (a intro volta 1 vez). */
  // Metas: o tutorial antigo grava `spotlight-done-metas` — as duas chaves ficam congeladas
  const chavesDoTutorial = chavesDoTutorialAntigo(moduleId);
  const tutorialAntes = useRef<Record<string, unknown> | null>(null);
  if (loaded && tutorialAntes.current === null) {
    const abertaAntes = introAbertaNesteAparelho(moduleId);
    const congelado: Record<string, unknown> = {};
    for (const k of chavesDoTutorial) { try { congelado[k] = abertaAntes ? "" : get<unknown>(k, ""); } catch { congelado[k] = ""; } }
    tutorialAntes.current = congelado;
  }
  const leitorDaDecisao: Leitor = <T,>(k: string, f: T): T =>
    (tutorialAntes.current && k in tutorialAntes.current ? ((tutorialAntes.current[k] ?? f) as T) : getRef.current(k, f));

  useEffect(() => {
    if (!loaded || estado !== "decidindo") return;
    if (montar && montarNaTela(montar)) {
      // o montar está na frente: espera ele terminar (o evento de fim e/ou o atributo sair do <html>)
      const ouvirFim = (e: Event) => {
        try { if ((e as CustomEvent<{ resultado?: string }>).detail?.resultado === "pronto") depoisDoMontar.current = true; } catch { /* noop */ }
        if (!montarNaTela(montar)) setTentativa((t) => t + 1);
      };
      const ouvirAtributo = () => { if (!montarNaTela(montar)) setTentativa((t) => t + 1); };
      window.addEventListener(montar.evento, ouvirFim);
      let obs: MutationObserver | null = null;
      try { obs = new MutationObserver(ouvirAtributo); obs.observe(document.documentElement, { attributes: true, attributeFilter: [montar.atributo] }); } catch { obs = null; }
      return () => { window.removeEventListener(montar.evento, ouvirFim); obs?.disconnect(); };
    }
    const outraGuia = outraGuiaAtiva(moduleId, getRef.current);
    if (porQueNaoMostrar(moduleId, leitorDaDecisao, { outraGuiaAtiva: outraGuia }) !== null) { setEstado("nada"); return; }
    if (!abertaTratada.current) {
      abertaTratada.current = true;
      if (introAbertaNesteAparelho(moduleId)) {
        // 2ª aparição: a última — e retoma onde parou (a guiada com a 1ª ação feita segue nos passos de 1 toque)
        retomada.current = retomadaDaIntro(moduleId);
        marcarIntroVista(moduleId, getRef.current, setRef.current, "pulada");
        if (config?.formato === "guiada" && retomada.current && retomada.current.passo >= 2) setContinuacao({ rotulos: retomada.current.rotulos });
      } else marcarIntroAbertaNoAparelho(moduleId);
    }
    setEstado("visivel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, estado, moduleId, tentativa, montar]);

  /* 1.0.17 (telemetria): a intro SAIU sem "Pronto" nem "Agora não" — voltou (←), foi pra outro módulo, outra guia entrou
     por cima, ou o app foi pro 2º plano (pode voltar; o `via` separa). `modulo_intro_saiu {modulo, passo, via}`. */
  const terminou = useRef(false);
  const motivoDaSaida = useRef<"saiu" | "outra_guia">("saiu");
  useEffect(() => {
    if (estado !== "visivel") return;
    terminou.current = false;
    motivoDaSaida.current = "saiu";
    const aoEsconder = () => { if (document.visibilityState === "hidden" && !terminou.current) trackEvent("modulo_intro_saiu", { modulo: moduleId, passo: passoDaIntroNaTela(moduleId), via: "segundo_plano" }); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      if (!terminou.current) trackEvent("modulo_intro_saiu", { modulo: moduleId, passo: passoDaIntroNaTela(moduleId), via: motivoDaSaida.current });
    };
  }, [estado, moduleId]);

  // uma guia que monta logo depois (a dose da missão, o holofote que espera o `loaded`): a intro sai sem marcar vista;
  // o Montar montando depois: a intro volta a esperar por ele
  useEffect(() => {
    if (estado !== "visivel") return;
    const conferir = () => {
      try {
        if (montar && montarNaTela(montar)) { setEstado("decidindo"); return; }
        if (doseNaTela() || document.querySelector(OUTRA_GUIA)) { motivoDaSaida.current = "outra_guia"; setEstado("nada"); }
      } catch { /* noop */ }
    };
    const t = window.setTimeout(conferir, 700);
    return () => window.clearTimeout(t);
  }, [estado, montar]);

  // o host do "Conhecer mais" (passeio opcional) mora aqui: nos 3 módulos, com a intro na tela ou não
  const host = temTour(moduleId) ? <ConhecerMaisHost moduleId={moduleId} /> : null;
  if (estado !== "visivel" || !config) return host;
  const terminar = (como: FimDaIntro) => { terminou.current = true; marcarIntroVista(moduleId, getRef.current, setRef.current, como); setEstado("nada"); };
  // 17/10 (dono: "tipo Finanças, que tem vários"): a guiada faz a 1ª ação e o "olha"; os passos seguintes (config.maisPassos)
  // rodam no motor de 1 toque, que mostra o cartão do fim com tudo o que entrou
  const maisPassos = config.formato === "guiada" ? config.maisPassos : undefined;
  /** os passos de 1 toque a partir de `base` passos anteriores — retomando no passo gravado, quando há (B1) */
  const deUmToque = (cfg: IntroDeUmToqueConfig, base: number, rotulos: string[]) => {
    const r = retomada.current;
    const corte = r ? Math.min(Math.max(0, r.passo - 1 - base), Math.max(0, cfg.passos.length - 1)) : 0;
    return <IntroDeUmToque config={{ ...cfg, passos: cfg.passos.slice(corte) }} aoTerminar={terminar} passoInicial={base + corte} rotulosIniciais={corte && r ? r.rotulos : rotulos} />;
  };
  return (
    <>
      {host}
      {config.formato === "guiada"
        ? (continuacao
          ? deUmToque({ ...config, formato: "toque", passos: maisPassos ?? [] }, config.tipo === "habito" ? 3 : 2, continuacao.rotulos)
          : <IntroGuiada config={config} aoTerminar={terminar} depoisDoMontar={depoisDoMontar.current} aoContinuar={maisPassos?.length ? (rotulo) => setContinuacao({ rotulos: rotulo ? [rotulo] : [] }) : undefined} />)
        : deUmToque(config, 0, [])}
    </>
  );
}
