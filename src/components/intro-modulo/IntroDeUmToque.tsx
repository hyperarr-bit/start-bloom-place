import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Lightbulb } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import type { IntroDeUmToqueConfig, OpcaoDaIntro, PassoDaIntro } from "@/lib/intro-modulo";
import { abrirAba } from "@/components/cartoes-modulo/registro";
import { Anel, BotaoSeguir, PostItDaMissao } from "@/components/demo-guiada/pecas";
import type { ChipDaMissao } from "@/components/demo-guiada/alvos";
import { ROLAGEM_DO_OLHAR, rolarAte } from "@/components/missao-doses/PassoDoDia";
import { abrirConhecerMais, ofertaDoTour } from "@/lib/conhecer-mais";
import { podeOferecerTour } from "./ConhecerMais";
import "./intro-modulo.css";

/**
 * A INTRO DE VÁRIOS PASSOS (17/10, dono: "só 1 passo não; tipo Finanças, que tem vários"): o modelo da intro guiada
 * — ação real de 1 toque → "olha" mostrando onde entrou / o que mudou → próxima ação — cobrindo as 2–4 ações mais
 * usadas de cada módulo (dados em scratchpad/definitiva/dados-intro). A faixa de planner no topo conta "2 de 4" e tem
 * "Pular" sempre à vista; cada passo é um de três tipos:
 *   · CHIPS: o post-it com a pergunta e 2–5 chips, ANCORADO no controle real do módulo (o anel; sem âncora, solto
 *     embaixo da faixa) — 1 toque grava de verdade (`executar`) e o que entrou vira a confirmação do fim;
 *   · ESCUTAR: o post-it só com a instrução, o anel no controle real, e o passo espera a pessoa fazer a ação no módulo
 *     (as chaves da conta mudam → segue); com `foco`, o chip abre o campo real primeiro;
 *   · OLHAR: o anel num card real com um balão de 1 frase e "Entendi" — sem ação; se o card não existe nesta conta,
 *     o passo é pulado em silêncio (~2,5 s).
 * O cartão do fim diz tudo o que entrou ("Pão com café e Frango com arroz já estão aqui…"), oferece o "Ver mais N
 * dicas · 1 min" (só onde há passeio) e "Pronto". Nunca trava: âncora que não aparece = post-it solto; toque fora não fecha.
 * Serve também de continuação da intro guiada (Finanças/Rotina/Saúde): `passoInicial` e `rotulosIniciais`.
 *
 * Eventos: modulo_intro_vista {modulo, formato:"toque", passos} · modulo_intro_acao {modulo, via:"chip"|"foco", opcao,
 * passo} · modulo_intro_registrou {modulo, via, passo, segundos} · modulo_intro_olhar {modulo, passo, via:"botao"|"pulado"}
 * · modulo_intro_concluida {modulo, segundos, passos} · modulo_intro_pulou {modulo, fase:"toque", passo, segundos}
 * · modulo_intro_anel_saiu {modulo, motivo}.
 */
export const TEMPOS_DO_TOQUE = { antesDoAnel: 300, registrou: 550, pronto: 6_000, prontoComOferta: 12_000, tentativasDoOlhar: 8 };

type Fase = "achar" | "anotar" | "registrou" | "pronto";
const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
const chipDe = (o: OpcaoDaIntro): ChipDaMissao => ({ emoji: o.emoji, nome: o.rotulo });

export function IntroDeUmToque({ config, aoTerminar, passoInicial = 0, rotulosIniciais = [] }: {
  config: IntroDeUmToqueConfig;
  aoTerminar: (como: "feita" | "pulada") => void;
  /** quantos passos vieram antes (a intro guiada): a faixa conta a partir deles */
  passoInicial?: number;
  /** o que já entrou antes (a guiada): vai junto no cartão do fim */
  rotulosIniciais?: string[];
}) {
  const { get, set } = useUserData();
  const reduzir = !!useReducedMotion();
  const m = config.moduleId;
  const [n, setN] = useState(0);
  const passo: PassoDaIntro | undefined = config.passos[n];
  const nRef = useRef(n); nRef.current = n;
  const [fase, setFase] = useState<Fase>("achar");
  const faseRef = useRef<Fase>("achar"); faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  const [acende, setAcende] = useState(0);
  const [tocado, setTocado] = useState<string | null>(null);
  const [rotulos, setRotulos] = useState<string[]>(rotulosIniciais);
  const getRef = useRef(get); getRef.current = get;
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);
  const timers = useRef<number[]>([]);
  const depois = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const total = passoInicial + config.passos.length;
  const numero = passoInicial + n + 1;

  useEffect(() => {
    document.documentElement.setAttribute("data-intro-modulo-faixa", "1");
    if (!passoInicial) trackEvent("modulo_intro_vista", { modulo: m, formato: "toque", passos: config.passos.length });
    return () => { document.documentElement.removeAttribute("data-intro-modulo-faixa"); timers.current.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** avança pro próximo passo (ou pro fim) */
  const seguir = () => {
    setAnelVivo(false);
    if (nRef.current + 1 < config.passos.length) { setN(nRef.current + 1); setTocado(null); setAlvo(null); setFase("achar"); }
    else setFase("pronto");
  };

  /* ACHAR o controle real deste passo (a aba dele primeiro); módulo pesado monta tarde → tenta por ~5 s; sem ele, o post-it
   * solto — e um passo de OLHAR sem o card (esta conta não tem) é pulado em silêncio */
  useEffect(() => {
    if (fase !== "achar" || !passo) return;
    let vivo = true, tentativas = 0, tocouAba = false;
    const limite = passo.olhar ? TEMPOS_DO_TOQUE.tentativasDoOlhar : 17;
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      if (passo.alvo?.aba && !tocouAba) { tocouAba = true; abrirAba(passo.alvo.aba); }
      let el: Element | null = null;
      try { el = passo.alvo?.achar() ?? null; } catch { el = null; }
      if (el && visivel(el)) {
        const mostrar = () => { if (!vivo || faseRef.current !== "achar") return; setAlvo(el); setAnelVivo(true); setFase("anotar"); };
        if (passo.olhar) { try { rolarAte(el, ROLAGEM_DO_OLHAR.fracaoDoTopo, reduzir ? 0 : ROLAGEM_DO_OLHAR.duracaoMs, () => { if (reduzir) mostrar(); else depois(mostrar, 200); }); } catch { mostrar(); } }
        else mostrar();
        return;
      }
      if (++tentativas >= limite || !passo.alvo) {
        if (passo.olhar) { trackEvent("modulo_intro_olhar", { modulo: m, passo: numero, via: "pulado" }); seguir(); return; }
        setAlvo(null); setAnelVivo(false); setFase("anotar"); return;
      }
      depois(procurar, 300);
    };
    if (!passo.alvo && !passo.olhar) { setAlvo(null); setAnelVivo(false); setFase("anotar"); return; } // sem controle pra apontar: o post-it solto, já
    depois(procurar, reduzir ? 100 : TEMPOS_DO_TOQUE.antesDoAnel);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, n]);

  const registrou = (rotulo: string, via: "chip" | "foco") => {
    if (faseRef.current !== "anotar" && faseRef.current !== "achar") return;
    faseRef.current = "registrou";
    setRotulos((r) => [...r, rotulo]);
    setFase("registrou");
    trackEvent("modulo_intro_registrou", { modulo: m, via, passo: numero, segundos: segundos() });
    const p = config.passos[nRef.current];
    depois(() => { try { p?.depois?.(); } catch { /* a intro nunca derruba o módulo */ } seguir(); }, reduzir ? 100 : TEMPOS_DO_TOQUE.registrou);
  };
  const entendi = () => { if (faseRef.current !== "anotar") return; trackEvent("modulo_intro_olhar", { modulo: m, passo: numero, via: "botao" }); seguir(); };

  /* O passo que ESCUTA (depois do foco, ou ação no próprio módulo): as chaves do módulo na conta */
  const chaves = passo?.escutar?.chaves ?? [];
  const assinatura = chaves.map((k) => { try { return JSON.stringify(get<unknown>(k, undefined) ?? null); } catch { return ""; } }).join("|");
  const anterior = useRef<Record<string, unknown>>({});
  useEffect(() => { anterior.current = Object.fromEntries(chaves.map((k) => [k, getRef.current<unknown>(k, undefined)])); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!passo?.escutar || fase === "pronto" || fase === "registrou") return;
    for (const k of chaves) {
      const valor = get<unknown>(k, undefined);
      const ant = anterior.current[k];
      let mudou = false;
      try { mudou = JSON.stringify(valor ?? null) !== JSON.stringify(ant ?? null); } catch { mudou = valor !== ant; }
      if (!mudou) continue;
      anterior.current[k] = valor;
      let rotulo: string | null = null;
      try { rotulo = passo.escutar.rotulo(valor, ant, k); } catch { rotulo = null; }
      if (rotulo) { registrou(rotulo, "foco"); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  const gravar = (k: string, v: unknown) => { set(k, v); avisarEscritaDeFora(k, v); };
  const tocarChip = (chip: ChipDaMissao) => {
    if (!passo || tocado) return;
    const o = passo.opcoes.find((x) => x.rotulo === chip.nome);
    if (!o) return;
    setTocado(chip.nome);
    if (passo.foco) {
      trackEvent("modulo_intro_acao", { modulo: m, via: "foco", opcao: o.id, passo: numero });
      // tudo síncrono, dentro do toque: no iPhone o teclado só abre por foco dado na própria ação da pessoa
      try {
        passo.foco.abrir?.();
        const campo = document.querySelector<HTMLElement>(passo.foco.seletor);
        campo?.scrollIntoView?.({ block: "center", behavior: reduzir ? "auto" : "smooth" });
        campo?.focus?.();
      } catch { /* sem campo: a pessoa está no módulo, no lugar certo */ }
      if (!passo.escutar) registrou(o.rotulo, "foco");
      else setTocado(null); // o ✓ só quando a gravação chegar
      return;
    }
    trackEvent("modulo_intro_acao", { modulo: m, via: "chip", opcao: o.id, passo: numero });
    let rotulo: string | void = undefined;
    try { rotulo = passo.executar?.({ get, gravar }, o); } catch { /* a intro nunca derruba o módulo */ }
    registrou(rotulo || o.rotulo, "chip");
  };
  const pular = () => { trackEvent("modulo_intro_pulou", { modulo: m, fase: "toque", passo: numero, segundos: segundos() }); aoTerminar("pulada"); };

  /* PRONTO: o cartão pequeno fica uns segundos e a intro termina; com o passeio por fazer, oferece ele (secundário) */
  const oferta = podeOferecerTour(m, get) ? ofertaDoTour(m) : null;
  useEffect(() => {
    if (fase !== "pronto") return;
    trackEvent("modulo_intro_concluida", { modulo: m, segundos: segundos(), passos: total });
    if (oferta) trackEvent("conhecer_mais_oferta", { modulo: m, origem: "fim_tutorial" });
    const t = window.setTimeout(() => aoTerminar("feita"), oferta ? TEMPOS_DO_TOQUE.prontoComOferta : TEMPOS_DO_TOQUE.pronto);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  const verMais = () => { aoTerminar("feita"); window.setTimeout(() => abrirConhecerMais(m, "fim_tutorial"), 0); };

  const pedido = passo?.pedido ?? config.pedido;
  /** o passo está usando o controle do próprio módulo (achou o alvo): sem chips, sem pergunta dobrada */
  const noModulo = passo?.quandoNoModulo && alvo ? passo.quandoNoModulo : null;
  const faixa = (
    <div className="im-faixa" data-testid="intro-modulo-faixa" data-camada-guia="intro-modulo" data-fase={fase} data-formato="toque" data-passo={numero} style={{ background: config.cor.faixa, color: config.cor.tinta }} role="presentation">
      <span className="im-faixa-titulo">Primeira vez aqui · {fase === "pronto" ? "pronto ✓" : total > 1 ? `${numero} de ${total} · ${pedido}` : pedido}</span>
      {fase !== "pronto" && (
        <button type="button" className="im-faixa-pular" data-testid="intro-modulo-pular" onClick={pular}>Pular</button>
      )}
    </div>
  );
  const balao = passo?.olhar ? (
    <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="intro-modulo-olhar">
      <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">Olha · {numero} de {total}</span>
      <span className="block text-[15px] font-extrabold leading-snug">{passo.olhar.titulo}</span>
      <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{passo.olhar.texto}</span>
      <div className="mt-3 flex items-center gap-3">
        <BotaoSeguir claro onClick={entendi} testid="intro-modulo-entendi">Entendi</BotaoSeguir>
      </div>
    </div>
  ) : passo && noModulo ? (
    // o módulo já faz a pergunta (Beleza): só a instrução, sem chips — a resposta é no controle dele
    <PostItDaMissao
      rotulo={total > 1 ? `${numero} de ${total} · ${noModulo.rotulo ?? "aqui"}` : `Agora · ${noModulo.rotulo ?? "aqui"}`}
      pergunta={noModulo.pergunta}
      descricao={noModulo.descricao}
      chips={[]}
      aoChip={() => {}}
    />
  ) : passo ? (
    <PostItDaMissao
      rotulo={total > 1 ? `${numero} de ${total} · 1 toque` : "Agora · 1 toque"}
      pergunta={passo.pergunta}
      descricao={passo.descricao}
      chips={passo.opcoes.map(chipDe)}
      tocado={tocado}
      aoChip={tocarChip}
    />
  ) : null;
  const oQueEntrou = rotulos.length > 1 ? `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}` : rotulos[0] ?? "";

  return (
    <>
      {createPortal(faixa, document.body)}
      {/* portais ficam FORA do AnimatePresence (um portal não é um elemento válido pra ele) */}
      {(!alvo || !anelVivo) && fase === "anotar" && balao && !passo?.olhar && !noModulo && createPortal(
        <motion.div className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--intro-modulo-faixa-h) + var(--app-safe-top, 0px) + 64px)" }} initial={reduzir ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="intro-modulo-postit-solto">
          <div className="w-[92%] max-w-[360px] pointer-events-auto">{balao}</div>
        </motion.div>, document.body)}
      {fase === "pronto" && createPortal(
        <motion.div className="im-pronto" data-testid="intro-modulo-pronto" initial={reduzir ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
          <div className="im-pronto-linha">
            <span className="im-pronto-check"><Check className="w-4 h-4" strokeWidth={3} /></span>
            <span className="im-pronto-texto">{oQueEntrou ? <><b>{oQueEntrou}</b> {rotulos.length > 1 ? "já estão aqui" : "já está aqui"}. </> : null}{config.pronto}</span>
          </div>
          {oferta && (
            <button type="button" className="im-pronto-oferta" data-testid="intro-modulo-conhecer-mais" onClick={verMais}>
              <Lightbulb className="im-pronto-oferta-icone" aria-hidden="true" />
              <span className="im-pronto-oferta-textos">
                <span className="im-pronto-oferta-titulo">{oferta.titulo}</span>
                <span className="im-pronto-oferta-linha">{oferta.linha}</span>
              </span>
              <ChevronRight className="im-pronto-oferta-seta" aria-hidden="true" />
            </button>
          )}
          <button type="button" className="im-pronto-principal" data-testid="intro-modulo-fechar" onClick={() => aoTerminar("feita")}>Pronto</button>
        </motion.div>, document.body)}
      <AnimatePresence>
        {anelVivo && alvo && passo && (fase === "anotar" || fase === "registrou") && (
          <Anel key={`passo-${n}-${acende}`} fixo interativo duracao={passo.olhar ? 20_000 : 60_000} alvo={alvo} testid={passo.olhar ? "intro-modulo-anel-olhar" : "intro-modulo-anel"} abaixo={!!passo.alvo?.abaixo} rapido={!!passo.olhar}
            reachar={() => { try { return passo.alvo?.achar() ?? null; } catch { return null; } }}
            aoSair={(motivo) => {
              setAnelVivo(false);
              if (faseRef.current !== "anotar") return;
              if (passo.olhar) { entendi(); return; } // o olhar acabou (tempo, rolagem): segue
              setAcende((x) => x + 1); trackEvent("modulo_intro_anel_saiu", { modulo: m, motivo });
            }}
            balao={balao} />
        )}
      </AnimatePresence>
    </>
  );
}
