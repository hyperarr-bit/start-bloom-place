import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Crosshair, Lightbulb } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { reais, rotuloCurto } from "@/lib/demo-guiada";
import { marcarPassoDaIntro, type IntroGuiadaConfig } from "@/lib/intro-modulo";
import { Anel, BotaoSeguir, ContaSubindo, PostItDaMissao, useMarcaDaTelaDeslocada } from "@/components/demo-guiada/pecas";
import { CHIPS_DE_HABITO, criarHabitoPeloCampo, PERGUNTA_HABITO_MARCAR, PERGUNTA_HABITO_VAZIO, alvoDaMissao, gravacoesDoChip, itemDoChip, linhaDeHoje, linhaDoNovoHabito, type ChipDaMissao, type Numero } from "@/components/demo-guiada/alvos";
import { ROLAGEM_DO_OLHAR, rolarAte } from "@/components/missao-doses/PassoDoDia";
import { abrirConhecerMais, ofertaDoTour } from "@/lib/conhecer-mais";
import { podeOferecerTour } from "./ConhecerMais";
import "./intro-modulo.css";

/**
 * A INTRO GUIADA DO MÓDULO (16/10): a MESMA mecânica da dose da missão —
 * faixa no topo, anel no controle real, post-it com chips (1 toque = registro de
 * verdade na conta), o "olhar" no resumo que recalculou — só que sem missão em volta:
 * sem dia 1/2/3, sem "amanhã", sem festa em tela cheia. Termina num cartão pequeno
 * ("pronto") que some sozinho. Reaproveita Anel/PostItDaMissao/alvos da demo guiada e
 * `rolarAte` do PassoDoDia; nada é copiado da missão além da ordem das fases.
 *
 * Fail-open como a missão: sem âncora, só a faixa + o post-it solto; toque fora não
 * fecha; "Pular" na faixa aos 12 s ou no 2º toque nela. Nunca trava.
 *
 * Eventos: modulo_intro_vista {modulo, formato:"guiada"} · modulo_intro_chip {modulo, nome}
 * · modulo_intro_registrou {modulo, via, segundos} · modulo_intro_olhar {modulo, via}
 * · modulo_intro_pulou {modulo, fase, segundos} · modulo_intro_anel_saiu {modulo, motivo}
 * · modulo_intro_concluida {modulo, segundos}.
 */
export const TEMPOS_DA_INTRO = { antesDoAnel: 300, registrou: 550, olhar: 15_000, pronto: 6_000, prontoComOferta: 12_000, pularDepoisDe: 12_000 };

type Fase = "achar" | "anotar" | "registrou" | "olhar" | "pronto";
const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
/** Rotina: o QUADRADINHO de hoje — não a linha inteira, que tem a célula do nome vazia. "ultima" = a coluna do hábito
 *  que acabou de nascer; "primeira" = o 1º hábito, quando a lista já existia (o montar criou; "marca o primeiro quando fizer"). */
const celulaDeHoje = (linha: Element, qual: "primeira" | "ultima"): Element => {
  const celulas = Array.from(linha.querySelectorAll("td")).filter((td) => td.querySelector("button, input, [role=checkbox]"));
  return (qual === "ultima" ? celulas.at(-1) : celulas[0]) ?? linha;
};

export function IntroGuiada({ config, aoTerminar, depoisDoMontar = false, aoContinuar }: { config: IntroGuiadaConfig; aoTerminar: (como: "feita" | "pulada") => void; /** a intro começou logo depois do montar do módulo ("pronto"): Rotina pede "marca o primeiro quando fizer" */ depoisDoMontar?: boolean; /** 17/10 (dono: "tipo Finanças, que tem vários"): depois do "olha", em vez do cartão do fim, continua nos passos de 1 toque (config.maisPassos) — recebe o rótulo do que entrou */ aoContinuar?: (rotulo: string) => void }) {
  const alvoCfg = alvoDaMissao(config.tipo);
  const { get, set } = useUserData();
  const reduzir = !!useReducedMotion();
  useMarcaDaTelaDeslocada(); // a faixa sai de cena enquanto o teclado do iPhone desloca a tela (20/10)
  // Rotina numa conta vazia: (A) criar o hábito pelo campo real, (B) marcar o quadradinho de hoje
  const [semHabito] = useState(() => config.tipo === "habito" && !((get<unknown[]>("rotina-habits", []) ?? []).length > 0));
  const [subPasso, setSubPasso] = useState<"criar" | "marcar" | null>(semHabito ? "criar" : null);
  const subPassoRef = useRef(subPasso); subPassoRef.current = subPasso;
  const chips: ChipDaMissao[] = subPasso === "criar" ? CHIPS_DE_HABITO : subPasso === "marcar" ? [] : alvoCfg.chips;
  // depois do montar (os itens já existem): o pedido vira "marca o primeiro quando fizer"
  const copiaDoMontar = depoisDoMontar && !subPasso ? config.depoisDoMontar : undefined;
  const pergunta = copiaDoMontar?.pergunta ?? (subPasso === "criar" ? PERGUNTA_HABITO_VAZIO : subPasso === "marcar" ? PERGUNTA_HABITO_MARCAR : alvoCfg.pergunta);

  const [fase, setFase] = useState<Fase>("achar");
  const faseRef = useRef<Fase>("achar"); faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  const [acende, setAcende] = useState(0);
  const [perdeuAlvo, setPerdeuAlvo] = useState(false);
  /** Rotina, criar → marcar: o anel troca de alvo em ~350 ms; nesse intervalo o post-it não vai pro topo */
  const [reancorando, setReancorando] = useState(false);
  /** 1.0.17 (telemetria): criar → marcar troca a âncora (o campo some, a linha nova nasce) — o anel que sai nesse meio NÃO
   *  é "âncora perdida" (não vai como modulo_intro_anel_saiu nem acende o ⌖) */
  const reancorandoRef = useRef(false);
  const [tocado, setTocado] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [numero, setNumero] = useState<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  // 17/10 (regra do dono): "Pular" SEMPRE à vista, desde o 1º segundo — nunca escondido atrás de tempo ou 2º toque
  const [pularVisivel, setPularVisivel] = useState(true);
  const toquesNaFaixa = useRef(0);
  const chipTocado = useRef<ChipDaMissao | null>(null);
  const viaRef = useRef<"chip" | null>(null);
  /** o valor do que ela registrou (o "olha" alternativo deriva o número de antes dele) */
  const valorRef = useRef<number | null>(null);
  /** o "olha" foi no resumo alternativo (Finanças: QUANTO POSSO GASTAR HOJE, no Dashboard)? */
  const [olharAlt, setOlharAlt] = useState(false);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);
  const m = config.moduleId;

  useEffect(() => {
    document.documentElement.setAttribute("data-intro-modulo-faixa", "1");
    trackEvent("modulo_intro_vista", { modulo: m, formato: "guiada" });
    const t = window.setTimeout(() => setPularVisivel(true), TEMPOS_DA_INTRO.pularDepoisDe);
    return () => { document.documentElement.removeAttribute("data-intro-modulo-faixa"); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ACHAR o controle real (a aba como reserva); módulo pesado monta tarde → tenta por ~5 s */
  useEffect(() => {
    if (fase !== "achar") return;
    let vivo = true, tentativas = 0, tocouAba = false, abriuCampo = false;
    const timers: number[] = [];
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      const [principal, ...reservas] = alvoCfg.passos;
      const el = principal ? document.querySelector(principal.seletor) : null;
      if (subPassoRef.current === "criar" && el && visivel(el)) {
        const linha = linhaDoNovoHabito();
        if (linha && visivel(linha)) {
          try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch { /* noop */ }
          setAlvo(linha); setAnelVivo(true); setFase("anotar"); return;
        }
        if (!abriuCampo) { abriuCampo = true; (el as HTMLElement).click(); }
        if (++tentativas >= 17) { setAlvo(el); setAnelVivo(true); setFase("anotar"); return; }
        timers.push(window.setTimeout(procurar, 300)); return;
      }
      if (el && visivel(el)) {
        const abraco = alvoCfg.anel ? alvoCfg.anel(el) : el;
        setAlvo(config.tipo === "habito" && abraco !== el ? celulaDeHoje(abraco, "primeira") : abraco); // Rotina: o quadradinho do 1º hábito, não a linha
        setAnelVivo(true); setFase("anotar"); return;
      }
      const aba = reservas.find((p) => p.aba && document.querySelector(p.seletor));
      if (aba && !tocouAba) { tocouAba = true; document.querySelector<HTMLElement>(aba.seletor)?.click(); }
      if (++tentativas >= 17 || !principal) { setFase("anotar"); return; }
      timers.push(window.setTimeout(procurar, 300));
    };
    timers.push(window.setTimeout(procurar, reduzir ? 100 : TEMPOS_DA_INTRO.antesDoAnel));
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* O REGISTRO: escuta as chaves do módulo na conta (chip, campo ou quadradinho — qualquer caminho) */
  const anterior = useRef<Record<string, unknown> | null>(null);
  const assinatura = alvoCfg.chaves.map((k) => { try { return JSON.stringify(get<unknown>(k, undefined) ?? null); } catch { return ""; } }).join("|");
  useEffect(() => {
    if (!anterior.current) { anterior.current = Object.fromEntries(alvoCfg.chaves.map((k) => [k, get<unknown>(k, undefined)])); return; }
    for (const k of alvoCfg.chaves) {
      const valor = get<unknown>(k, undefined);
      const ant = anterior.current[k];
      let mudou = false;
      try { mudou = JSON.stringify(valor ?? null) !== JSON.stringify(ant ?? null); } catch { mudou = valor !== ant; }
      if (!mudou) continue;
      anterior.current[k] = valor;
      const f = faseRef.current;
      if (f !== "achar" && f !== "anotar") continue;
      let achado: ReturnType<typeof alvoCfg.achar> = null;
      try { achado = alvoCfg.achar(k, valor, ant, (kk) => get<unknown>(kk, undefined)); } catch { achado = null; }
      if (!achado) continue;
      if (config.tipo === "habito" && k === "rotina-habits") {
        // o hábito NASCEU: passa pro (B) — o anel vai pro quadradinho de HOJE da linha nova
        if (subPassoRef.current === "criar") {
          trackEvent("modulo_intro_registrou", { modulo: m, via: "criar_habito", segundos: segundos() });
          reancorandoRef.current = true;
          setSubPasso("marcar"); setTocado(null); setAnelVivo(false); setReancorando(true);
          window.setTimeout(() => {
            setReancorando(false); reancorandoRef.current = false;
            if (faseRef.current !== "anotar") return;
            const btn = document.querySelector('[data-spotlight="add-habit"]');
            const linha = btn ? linhaDeHoje(btn) : null;
            setPerdeuAlvo(false);
            if (linha && linha !== btn && visivel(linha)) { setAlvo(celulaDeHoje(linha, "ultima")); setAcende((x) => x + 1); setAnelVivo(true); } else setAlvo(null);
          }, 350);
        }
        continue;
      }
      const c = viaRef.current === "chip" ? chipTocado.current : null;
      const rot = config.tipo === "habito" ? rotuloCurto(achado.item) : c ? (c.valor != null ? `${c.nome} · R$ ${reais(c.valor)}` : c.nome) : rotuloCurto(achado.item);
      let num: Numero | null = null;
      try { num = alvoCfg.numero(k, valor, ant, achado.item); } catch { num = null; }
      valorRef.current = achado.item.valor ?? c?.valor ?? null;
      faseRef.current = "registrou";
      setRotulo(rot); setNumero(num); setFase("registrou");
      trackEvent("modulo_intro_registrou", { modulo: m, via: viaRef.current === "chip" ? "chip" : achado.via, segundos: segundos() });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  /* REGISTROU → OLHAR (rolagem visível até o resumo, o número sobe) → ou direto PRONTO.
   * Com `olharNoResumo` (Finanças depois do Montar: o QUANTO POSSO GASTAR HOJE, no Dashboard), a intro abre a
   * aba do resumo, espera o card montar (até ~1,5 s), lê o número de depois e deriva o de antes; sem o card,
   * cai no resumo padrão do alvo (MEU MÊS). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const timers: number[] = [];
    const apontar = (el: Element, resumo: "padrao" | "alternativo") => {
      const mostrar = () => { if (faseRef.current !== "registrou") return; setOlharEm(el); setFase("olhar"); trackEvent("modulo_intro_olhar", { modulo: m, via: "view", resumo }); };
      try { rolarAte(el, ROLAGEM_DO_OLHAR.fracaoDoTopo, reduzir ? 0 : ROLAGEM_DO_OLHAR.duracaoMs, () => { if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, ROLAGEM_DO_OLHAR.pausaMs)); }); } catch { mostrar(); }
    };
    const padrao = () => {
      if (faseRef.current !== "registrou") return;
      const el = alvoCfg.olhar?.achar() ?? null;
      if (el && visivel(el)) apontar(el, "padrao"); else setFase("pronto");
    };
    timers.push(window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      const alt = config.olharNoResumo;
      let querAlt = false;
      try { querAlt = !!alt && alt.quando(get); } catch { querAlt = false; }
      if (!alt || !querAlt) { padrao(); return; }
      alt.abrir();
      let tentativas = 0;
      const procurar = () => {
        if (faseRef.current !== "registrou") return;
        const el = alt.achar();
        if (el && visivel(el)) {
          const bruto = alt.ler(el);
          const valor = valorRef.current ?? 0;
          if (bruto !== null) {
            const antes = alt.antes(bruto, valor);
            const depois = alt.exibir ? alt.exibir(bruto) : Math.round(bruto);
            setNumero(antes !== depois ? { titulo: alt.numero.titulo, antes, depois, formatar: alt.numero.formatar } : null);
          } else setNumero(null);
          setOlharAlt(true);
          apontar(el, "alternativo");
          return;
        }
        if (++tentativas < 6) timers.push(window.setTimeout(procurar, 250)); else padrao();
      };
      timers.push(window.setTimeout(procurar, 150));
    }, reduzir ? 150 : TEMPOS_DA_INTRO.registrou));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* PRONTO: o cartão pequeno fica uns segundos e a intro termina. Com o passeio "Conhecer mais" por fazer, o cartão
   * oferece ele como controle SECUNDÁRIO acima do "Pronto" (nunca automático) e fica mais tempo na tela. */
  const oferta = podeOferecerTour(m, get) ? ofertaDoTour(m) : null;
  useEffect(() => {
    if (fase !== "pronto") return;
    if (aoContinuar) { aoContinuar(rotulo); return; } // os passos seguintes mostram o fim
    trackEvent("modulo_intro_concluida", { modulo: m, segundos: segundos() });
    if (oferta) trackEvent("conhecer_mais_oferta", { modulo: m, origem: "fim_tutorial" });
    const t = window.setTimeout(() => aoTerminar("feita"), oferta ? TEMPOS_DA_INTRO.prontoComOferta : TEMPOS_DA_INTRO.pronto);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  const verMais = () => { aoTerminar("feita"); window.setTimeout(() => abrirConhecerMais(m, "fim_tutorial"), 0); };

  const tocarChip = (chip: ChipDaMissao) => {
    const item = itemDoChip(config.tipo, chip);
    trackEvent("modulo_intro_chip", { modulo: m, nome: chip.proprio ? "outro" : chip.nome, ...(chip.proprio ? {} : { valor: chip.valor }), ok: !!item });
    if (!item) return;
    chipTocado.current = chip; setTocado(chip.nome);
    if (subPassoRef.current === "criar") {
      // 1 TOQUE: abre o campo da Rotina se estiver fechado, preenche e toca no "Adicionar" dela — o hábito nasce pelo
      // código do módulo (1.0.17: antes, com o campo fechado, o chip não fazia nada)
      reancorandoRef.current = true;
      criarHabitoPeloCampo(chip.nome, (ok) => { if (ok) window.setTimeout(() => { if (subPassoRef.current === "criar") reancorandoRef.current = false; }, 2000); if (!ok) { reancorandoRef.current = false; setTocado(null); trackEvent("modulo_intro_chip", { modulo: m, nome: chip.proprio ? "outro" : chip.nome, ok: false, motivo: "sem_campo" }); } });
      return;
    }
    viaRef.current = "chip";
    try {
      for (const g of gravacoesDoChip(item, chip)) {
        const proximo = g.proximo(get<unknown>(g.chave, undefined));
        if (proximo === undefined) continue;
        set(g.chave, proximo);
        avisarEscritaDeFora(g.chave, proximo); // a tela do módulo guarda a chave num usePersistedState
      }
    } catch { /* a intro nunca derruba o módulo */ }
  };
  const escreverOMeu = () => { try { alvo?.querySelector<HTMLInputElement>("input, textarea")?.focus(); } catch { /* noop */ } };
  /* 1.0.17 (dono 19/10): "Agora não" quieto no post-it (no lugar do "Pular" da faixa): fecha SÓ este tutorial, marcado
     como visto — nunca volta. */
  const pular = (fase: "toque" | "olhar") => { trackEvent("modulo_intro_pulou", { modulo: m, fase, segundos: segundos(), via: "agora_nao" }); aoTerminar("pulada"); };
  const toqueNaFaixa = () => { toquesNaFaixa.current += 1; if (toquesNaFaixa.current >= 2) setPularVisivel(true); };
  const mostrarOnde = () => { setPerdeuAlvo(false); setAcende((x) => x + 1); setAnelVivo(true); };
  const entendi = useCallback((via: "botao" | "auto") => { if (faseRef.current !== "olhar") return; trackEvent("modulo_intro_olhar", { modulo: m, via }); setFase("pronto"); }, [m]);

  /* 17/10 (uma voz só em todos os tutoriais): a faixa conta "1 de 4 · toca em 1 gasto seu", "2 de 4 · agora olha" — os passos da
   * guiada (ação[+marcar na Rotina] → olha) mais os de 1 toque que vêm depois (config.maisPassos) */
  // os passos da 1.0.16: ação [+ marcar na Rotina vazia] → olha → os de 1 toque (config.maisPassos)
  const passosDaGuiada = config.tipo === "habito" ? 3 : 2;
  const totalDePassos = passosDaGuiada + (config.maisPassos?.length ?? 0);
  const passoAtual = fase === "olhar" ? passosDaGuiada : subPasso === "marcar" ? 2 : 1;
  useEffect(() => { marcarPassoDaIntro(m, passoAtual); }, [m, passoAtual]);
  const faixa = (
    <div className="im-faixa" data-testid="intro-modulo-faixa" data-camada-guia="intro-modulo" data-fase={fase} data-passo={passoAtual} style={{ background: config.cor.faixa, color: config.cor.tinta }} onClick={toqueNaFaixa} role="presentation">
      <span className="im-faixa-titulo">Primeira vez aqui · {fase === "pronto" ? "pronto ✓" : fase === "olhar" ? "olhe aqui" : config.pedido}</span>
      {/* 1.0.17: "Agora não" quieto, à vista desde o 1º segundo — fecha SÓ este tutorial (marcado como visto) */}
      {pularVisivel && fase !== "pronto" && (
        <button type="button" className="im-faixa-pular" data-quieto="" data-testid="intro-modulo-agora-nao" onClick={(e) => { e.stopPropagation(); pular(fase === "olhar" ? "olhar" : "toque"); }}>Agora não</button>
      )}
      {perdeuAlvo && !reancorando && fase === "anotar" && (
        <button type="button" className="im-faixa-onde bg-faixa" data-testid="intro-modulo-onde" aria-label="Mostrar onde tocar" onClick={(e) => { e.stopPropagation(); mostrarOnde(); }}><Crosshair className="w-4 h-4" /></button>
      )}

    </div>
  );

  const postIt = (
    <PostItDaMissao
      rotulo={`${passoAtual} de ${totalDePassos}`}
      pergunta={pergunta}
      descricao={copiaDoMontar?.descricao ?? (subPasso === "marcar" || (config.tipo === "habito" && subPasso !== "criar") ? "Toque no quadradinho de hoje." : undefined)}
      chips={chips}
      tocado={tocado}
      aoChip={tocarChip}
      outro={!chips.length || config.tipo === "agua" ? undefined
        : config.tipo === "gasto" ? { lista: `intro-${m}-gasto`, placeholder: "Ex.: Mercado", comValor: true, aoEscolher: ({ nome, valor }) => tocarChip({ emoji: "🧾", nome, valor: valor ?? 0, categoria: "outros", proprio: true }) }
        : { lista: `intro-${m}-${subPasso === "criar" ? "habito" : config.tipo}`, placeholder: subPasso === "criar" ? "Ex.: Caminhar 10 min" : "Escreva aqui", aoEscolher: ({ nome }) => tocarChip({ emoji: "✨", nome, proprio: true }) }}
    />
  );

  return (
    <>
      {createPortal(faixa, document.body)}
      {/* portais ficam FORA do AnimatePresence: um portal não é um elemento válido pra ele (ele descarta) */}
      {(!alvo || !anelVivo) && !reancorando && fase === "anotar" && createPortal(
        <motion.div className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--intro-modulo-faixa-h) + var(--app-safe-top, 0px) + 64px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="intro-modulo-postit-solto">
          <div className="w-[92%] max-w-[360px] pointer-events-auto">{postIt}</div>
        </motion.div>, document.body)}
      {fase === "pronto" && !aoContinuar && createPortal(
        <motion.div className="im-pronto" data-testid="intro-modulo-pronto" initial={reduzir ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
          <div className="im-pronto-linha">
            <span className="im-pronto-check"><Check className="w-4 h-4" strokeWidth={3} /></span>
            <span className="im-pronto-texto"><b>{rotulo}</b> entrou. {config.pronto}</span>
          </div>
          {oferta && (
            /* dono 17/10: um BOTÃO de verdade (borda clara, ≥48 px, lâmpada na frente, "›" atrás), secundário ao "Pronto" cheio */
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
      {/* o post-it fica EM CIMA do alvo em todos os passos (na Rotina o anel é só o quadradinho; embaixo ele cobria o card CONSISTÊNCIA) */}
      <AnimatePresence>
        {anelVivo && alvo && (fase === "anotar" || fase === "registrou") && (
          <Anel key={`anotar-${acende}`} fixo interativo duracao={60_000} alvo={alvo} testid="intro-modulo-anel" abaixo={false}
            aoSair={(motivo) => { setAnelVivo(false); if (faseRef.current !== "anotar" || reancorandoRef.current) return; setPerdeuAlvo(true); trackEvent("modulo_intro_anel_saiu", { modulo: m, motivo }); }}
            balao={postIt} />
        )}
        {fase === "olhar" && olharEm && (
          <Anel key="olhar" fixo interativo alvo={olharEm} recorte={olharAlt ? undefined : alvoCfg.olhar?.recorte} duracao={TEMPOS_DA_INTRO.olhar} testid="intro-modulo-anel-olhar" aoSair={() => entendi("auto")}
            balao={(
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="intro-modulo-olhar">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">{passosDaGuiada} de {totalDePassos}</span>
                <span className="block text-[16px] font-extrabold leading-snug">{olharAlt && config.olharNoResumo ? config.olharNoResumo.titulo : config.olhar.titulo}</span>
                <span className="block text-[13px] text-white/80 leading-snug mt-1">{olharAlt && config.olharNoResumo ? config.olharNoResumo.texto : config.olhar.texto}</span>
                {numero && (
                  <span className="flex items-baseline gap-2 mt-2">
                    <span className="text-[12px] text-white/50">{numero.titulo}:</span>
                    <span className="text-[13px] text-white/50 line-through tabular-nums">{numero.formatar(numero.antes)}</span>
                    <span className="text-white/50 text-[13px]">→</span>
                    <span className="text-[22px] font-black tracking-tight leading-none"><ContaSubindo de={numero.antes} para={numero.depois} formatar={numero.formatar} duracao={ROLAGEM_DO_OLHAR.numeroS} /></span>
                  </span>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <BotaoSeguir claro onClick={() => entendi("botao")} testid="intro-modulo-entendi">Entendi</BotaoSeguir>
                </div>
              </div>
            )} />
        )}
      </AnimatePresence>
    </>
  );
}
