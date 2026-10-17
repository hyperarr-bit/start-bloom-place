import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Lightbulb } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { introLigada } from "@/lib/intro-modulo";
import {
  EVENTO_ABRIR_TOUR, EVENTO_FIM_TOUR, TOURS, abrirConhecerMais, lembreteDevido, marcarLembreteVisto, marcarTourFeito, registrarAbertura, temTour, tourFeito,
  type FimDoTour, type ModuloComTour, type OrigemDoTour, type PedidoDeTour,
} from "@/lib/conhecer-mais";
import { Anel } from "@/components/demo-guiada/pecas";
import { ROLAGEM_DO_OLHAR, rolarAte } from "@/components/missao-doses/PassoDoDia";
import { abrirAba } from "@/components/cartoes-modulo/registro";
import "./intro-modulo.css";

/**
 * CONHECER MAIS — o passeio opcional de 1 min (lib/conhecer-mais): uma faixa escura no topo ("Conhecer mais ·
 * Finanças · 2 de 4 · Sair"), e em cada parada o anel no card real com um balão de 1 frase e "Próxima"
 * (a última: "Terminar"). Toque fora não faz nada (o anel é `fixo`); nenhuma ação é pedida. A parada que
 * mora em outra aba troca a aba sozinha e espera o card montar (até ~1,5 s); card que não existe na conta
 * é pulado sem drama. Terminar ou passar por todas = feito (aparelho + conta): a oferta não volta.
 */
export const TEMPOS_DO_TOUR = { esperaDoCard: 250, tentativas: 6 };
const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };

export function ConhecerMais({ modulo, origem, aoFim }: { modulo: ModuloComTour; origem: OrigemDoTour; aoFim: (completo: boolean) => void }) {
  const { get, set } = useUserData();
  const reduzir = !!useReducedMotion();
  const tour = TOURS[modulo];
  const total = tour.paradas.length;
  const [n, setN] = useState(0);
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [acende, setAcende] = useState(0);
  /** a âncora sumiu (a aba redesenhou e trocou o nó): acha o card de novo em vez de acender o nó velho */
  const [busca, setBusca] = useState(0);
  const nRef = useRef(0); nRef.current = n;
  const vivo = useRef(true);
  const terminou = useRef(false);

  useEffect(() => {
    vivo.current = true;
    trackEvent("conhecer_mais_abrir", { modulo, origem });
    document.documentElement.setAttribute("data-conhecer-mais", "1");
    return () => { vivo.current = false; document.documentElement.removeAttribute("data-conhecer-mais"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fim = useCallback((completo: boolean, viaSair = false) => {
    if (terminou.current) return;
    terminou.current = true;
    if (viaSair) trackEvent("conhecer_mais_sair", { modulo, n: nRef.current + 1 });
    trackEvent("conhecer_mais_fim", { modulo, completo });
    if (completo) marcarTourFeito(modulo, get, set);
    aoFim(completo);
    // quem abriu fica sabendo que acabou (a missão, quando abriu pela festa da dose, leva a pessoa de volta pro caminho dela)
    try { window.dispatchEvent(new CustomEvent<FimDoTour>(EVENTO_FIM_TOUR, { detail: { modulo, origem, completo } })); } catch { /* sem window */ }
  }, [modulo, origem, get, set, aoFim]);

  /* cada parada: troca a aba (se precisar), espera o card, rola até ele e acende o anel */
  useEffect(() => {
    const parada = tour.paradas[n];
    if (!parada) { fim(true); return; }
    let tentativas = 0;
    const timers: number[] = [];
    setAlvo(null);
    if (parada.aba) abrirAba(parada.aba);
    const procurar = () => {
      if (!vivo.current || nRef.current !== n) return;
      const el = parada.achar();
      if (el && visivel(el)) {
        trackEvent("conhecer_mais_parada", { modulo, n: n + 1, id: parada.id });
        const mostrar = () => { if (!vivo.current || nRef.current !== n) return; setAlvo(el); setAcende((x) => x + 1); };
        try { rolarAte(el, ROLAGEM_DO_OLHAR.fracaoDoTopo, reduzir ? 0 : ROLAGEM_DO_OLHAR.duracaoMs, () => { if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, 200)); }); } catch { mostrar(); }
        return;
      }
      if (++tentativas < TEMPOS_DO_TOUR.tentativas) timers.push(window.setTimeout(procurar, TEMPOS_DO_TOUR.esperaDoCard));
      else if (n + 1 < total) setN(n + 1); else fim(true); // o card não existe nesta conta: pula
    };
    timers.push(window.setTimeout(procurar, parada.aba ? 120 : 0));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, busca]);

  const proxima = () => { if (n + 1 < total) setN(n + 1); else fim(true); };
  const parada = tour.paradas[n];
  const ultima = n + 1 >= total;

  const faixa = (
    <div className="cm-faixa" data-testid="conhecer-mais-faixa" data-camada-guia="conhecer-mais" role="presentation">
      <span className="cm-faixa-titulo">Conhecer mais · {tour.nome}</span>
      <span className="cm-faixa-passo" data-testid="conhecer-mais-passo">{n + 1} de {total}</span>
      <button type="button" className="cm-faixa-sair" data-testid="conhecer-mais-sair" onClick={() => fim(false, true)}>Sair</button>
    </div>
  );
  const balao = parada ? (
    <div className="cm-balao" data-testid="conhecer-mais-balao">
      <span className="cm-balao-passo">Olha · {n + 1} de {total}</span>
      <span className="cm-balao-titulo">{parada.titulo}</span>
      <span className="cm-balao-texto">{parada.texto}</span>
      <div className="cm-balao-acoes">
        <button type="button" className="cm-balao-sair" onClick={() => fim(false, true)}>Sair</button>
        <button type="button" className="cm-balao-proxima" data-testid="conhecer-mais-proxima" onClick={proxima}>{ultima ? "Terminar" : "Próxima"} <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {createPortal(faixa, document.body)}
      <AnimatePresence>
        {alvo && parada && (
          <Anel key={`parada-${n}-${acende}`} fixo interativo duracao={null} alvo={alvo} testid="conhecer-mais-anel"
            aoSair={(motivo) => { if (motivo === "ancora_invisivel" && vivo.current) { setAlvo(null); setBusca((x) => x + 1); } }} balao={balao} />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * O HOST: vive nos 3 módulos (montado pela IntroDoModulo, esteja a intro na tela ou não). Escuta o pedido
 * de abrir (`abrirConhecerMais` — fim da intro, lembrete, botão de dicas, missão), conta as aberturas do
 * módulo neste aparelho e, na 3ª, mostra UM lembrete inline dispensável ("Ver" / "Agora não") — depois
 * disso, nunca mais sozinho.
 */
export function ConhecerMaisHost({ moduleId }: { moduleId: string }) {
  const { get, set } = useUserData();
  const [pedido, setPedido] = useState<PedidoDeTour | null>(null);
  const [lembrete, setLembrete] = useState(false);
  const getRef = useRef(get); getRef.current = get;
  const setRef = useRef(set); setRef.current = set;

  useEffect(() => {
    if (!temTour(moduleId)) return;
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<PedidoDeTour>).detail;
      if (!d || d.modulo !== moduleId) return;
      setLembrete(false);
      setPedido(d);
    };
    window.addEventListener(EVENTO_ABRIR_TOUR, ouvir);
    const aberturas = registrarAbertura(moduleId);
    if (lembreteDevido(moduleId, aberturas, getRef.current)) {
      setLembrete(true);
      trackEvent("conhecer_mais_oferta", { modulo: moduleId, origem: "lembrete" });
    }
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, ouvir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  if (!temTour(moduleId)) return null;
  const oferta = TOURS[moduleId].paradas.length;
  return (
    <>
      {lembrete && !pedido && (
        <div className="cm-lembrete mb-4" data-testid="conhecer-mais-lembrete" role="note">
          <Lightbulb className="w-4 h-4 shrink-0" style={{ color: "#d97706" }} aria-hidden="true" />
          <span className="cm-lembrete-texto">Dica: tem {oferta} coisas úteis aqui que pouca gente descobre. Ver em 1{"\u00a0"}min?</span>
          <button type="button" className="cm-lembrete-ver" data-testid="conhecer-mais-lembrete-ver" onClick={() => { marcarLembreteVisto(moduleId); setLembrete(false); abrirConhecerMais(moduleId, "lembrete"); }}>Ver</button>
          <button type="button" className="cm-lembrete-nao" data-testid="conhecer-mais-lembrete-nao" onClick={() => { marcarLembreteVisto(moduleId); setLembrete(false); }}>Agora não</button>
        </div>
      )}
      {pedido && <ConhecerMais modulo={pedido.modulo} origem={pedido.origem} aoFim={() => setPedido(null)} />}
    </>
  );
}

/**
 * O acesso permanente: o botão "Dicas" no cabeçalho do módulo (só nos módulos com passeio, com a chave da intro
 * ligada). Só o ícone (17/10, print do dono a 390 px: com a palavra "Dicas" o cabeçalho de Finanças não cabia e o
 * ✨ ficava achatado) — a mesma forma e tamanho do botão do tema, ao lado dele; o nome fica no aria-label e no
 * `title` (o leitor de tela e o toque longo dizem "Dicas").
 */
export function AcessoConhecerMais({ moduleId }: { moduleId: string }) {
  if (!temTour(moduleId) || !introLigada()) return null;
  return (
    <button
      type="button"
      // as mesmas classes do botão do tema (ThemeToggle); `bg-muted` também tira este botão da regra global de
      // index.css que infla botões só-ícone (padding 8 px + margin −8 px) — a área de toque de 44 px aqui é o ::before
      className="relative shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors before:absolute before:-inset-1 before:content-['']"
      data-testid="conhecer-mais-acesso" aria-label="Dicas" title={`Dicas de ${TOURS[moduleId].nome}`} onClick={() => abrirConhecerMais(moduleId, "menu")}>
      <Lightbulb className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

/** Pra oferta do fim da intro: o passeio ainda não foi feito nesta conta/aparelho? */
export const podeOferecerTour = (moduleId: string, get: <T>(k: string, f: T) => T): boolean => temTour(moduleId) && !tourFeito(moduleId, get);
