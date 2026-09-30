/**
 * A MISSÃO DE 1 MINUTO — a demo da web vira o 1º registro da pessoa (28/09).
 *
 * Desenho (scratchpad funil-web-28-09/relatorio.md, seção b), no ritmo da
 * Missão do teste grátis do app (dono: "quando o usuário faz algo aparece
 * comemoração, porque isso converteu bem lá"):
 *   1/3  ÁREA ESCOLHIDA — nasce feito (progresso dado: cartão-fidelidade com o
 *        1º selo carimbado vence cartão vazio);
 *   2/3  ANOTAR — holofote no botão de adicionar do módulo; ela anota UM item
 *        dela (ex.: Café · R$ 12) → a COMEMORAÇÃO da Missão do app: "Primeiro
 *        registro feito!", o gráfico que sobe, a barra verde de 33% → 66%;
 *   3/3  OLHAR (~4 s) — holofote no resumo que recalculou, com o número dela
 *        subindo;
 *   →    "Missão cumprida 🏆" (a comemoração do dia 3 do app, 66% → 100%) e a
 *        folha com DUAS saídas: "Levar isso pros meus números" (= o "Quase lá",
 *        com o item junto) e "Ver os outros módulos" (fecha, pulsa a barra de
 *        módulos e a demo segue igual à de hoje).
 * SEM adesivo: no app, o que converteu foi a comemoração da Missão sozinha (a
 * 1.0.6 não tinha festa de adesivo; a da 1.0.7 atropelou a comemoração e saiu).
 * "Pular" sempre na faixa; o CTA fixo de baixo continua; a barra de módulos
 * continua funcionando o tempo todo (trocar de módulo encerra a missão sem
 * prender ninguém — quem registra isso é o Preview).
 *
 * Esta peça só é montada pelo Preview quando o braço da demo é "on"; ela
 * mesma não sabe de A/B. Nada aqui intercepta toque (ver pecas.tsx).
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { AREA_DO_TIPO, NOME_DO_MODULO, rotuloCurto, type FimDaMissao, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { alvoDaMissao, TEMPOS_DA_MISSAO, type Numero } from "./alvos";
import { Anel, CartaoDoPasso1, ComemoracaoDaMissao, ContaSubindo, FaixaDaMissao, FolhaCumprida } from "./pecas";

/** Cada gravação da demo: chave, valor novo, valor de antes e se veio de um gesto da pessoa. */
export type OuvinteDaDemo = (chave: string, valor: unknown, anterior: unknown, gesto: boolean) => void;

/** inicio = passo 1 (o cartão "Passo 1 de 3 ✓") · achar/anotar = passo 2 ·
 *  festa1 = "Primeiro registro feito!" · olhar = passo 3 · festa2 = "Missão
 *  cumprida 🏆" · cumprida = a folha com as duas saídas.
 *  30/09 (dono: "quando clicamos em algo ela simplesmente pula o passo"): toque
 *  fora não fecha mais o passo 2 nem o 3 (Anel `fixo`); o alvo saiu da tela →
 *  "mostrar onde" na faixa; o resumo do passo 3 em outra aba → a missão leva até lá. */
type Fase = "inicio" | "achar" | "anotar" | "festa1" | "olhar" | "festa2" | "cumprida";

const visivel = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width >= 8 && r.height >= 8;
};

/** Um pulso na barra de módulos ("dá pra trocar aqui em cima"). Web Animations: nada de estado. */
const pulsarBarra = (reduzir: boolean) => {
  const barra = document.querySelector<HTMLElement>(".demo-tour-nav");
  if (!barra || typeof barra.animate !== "function") return;
  try {
    barra.animate(
      reduzir
        ? [{ backgroundColor: "hsl(var(--accent) / 0.16)" }, { backgroundColor: "transparent" }]
        : [
            { boxShadow: "inset 0 0 0 0 hsl(var(--accent) / 0)", transform: "scale(1)" },
            { boxShadow: "inset 0 0 0 3px hsl(var(--accent) / .75)", transform: "scale(1.015)", offset: 0.35 },
            { boxShadow: "inset 0 0 0 0 hsl(var(--accent) / 0)", transform: "scale(1)" },
          ],
      { duration: reduzir ? 700 : 900, easing: "ease-out" },
    );
  } catch { /* enfeite: nunca derruba a demo */ }
};

export interface PropsDaMissao {
  modulo: string;
  tipo: TipoDoItem;
  /** O Preview repassa pra cá cada gravação do PreviewUserDataProvider. */
  ouvinte: MutableRefObject<OuvinteDaDemo | null>;
  /** O item nasceu: o Preview guarda (URL das pílulas, CTA, sessão). */
  aoItem: (item: ItemDaDemo) => void;
  /** A missão acabou (a faixa sai). */
  aoFim: (motivo: FimDaMissao) => void;
  /** "Levar isso pros meus números": o mesmo destino do "Quase lá", com o item. */
  irParaCadastro: (item: ItemDaDemo) => void;
}

export default function GuiaDaDemo({ modulo, tipo, ouvinte, aoItem, aoFim, irParaCadastro }: PropsDaMissao) {
  const cfg = alvoDaMissao(tipo);
  const reduzir = !!useReducedMotion();
  const [fase, setFase] = useState<Fase>("inicio");
  const faseRef = useRef<Fase>(fase);
  faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  const [item, setItem] = useState<ItemDaDemo | null>(null);
  const [numero, setNumero] = useState<Numero | null>(null);
  const numeroRef = useRef<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  /** o anel do passo 2 saiu porque o alvo sumiu da tela (trocou de aba): a faixa oferece "mostrar onde" */
  const [perdeuAlvo, setPerdeuAlvo] = useState(false);
  const t0 = useRef(Date.now());

  const evento = (nome: string, extra: Record<string, unknown> = {}) => {
    try { trackEvent(nome, { guia: "on", area: AREA_DO_TIPO[tipo], modulo, ...extra }); } catch { /* medição nunca derruba a demo */ }
  };
  const passoAtual = () => (faseRef.current === "inicio" ? 1 : faseRef.current === "achar" || faseRef.current === "anotar" ? 2 : 3);

  useEffect(() => {
    evento("demo_guia_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* PASSO 1 — o cartão fica na tela antes de a demo andar sozinha ("Mostrar onde →" adianta). */
  useEffect(() => {
    if (fase !== "inicio") return;
    evento("demo_guia_passo", { n: 1 });
    const t = window.setTimeout(() => {
      if (faseRef.current === "inicio") setFase("achar");
    }, reduzir ? Math.min(900, TEMPOS_DA_MISSAO.inicio) : TEMPOS_DA_MISSAO.inicio);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* PASSO 2 — achar o botão de adicionar (a aba do módulo como reserva: a
   * missão toca nela sozinha). Módulo pesado monta tarde: procura a cada
   * 300 ms por ~5 s; não achou → segue só com a faixa (fail-open). */
  useEffect(() => {
    if (fase !== "achar") return;
    evento("demo_guia_passo", { n: 2 });
    let vivo = true;
    let tentativas = 0;
    let tocouAba = false;
    const timers: number[] = [];
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      const [principal, ...reservas] = cfg.passos;
      const el = document.querySelector(principal.seletor);
      if (el && visivel(el)) {
        setAlvo(cfg.anel ? cfg.anel(el) : el);
        setAnelVivo(true);
        setFase("anotar");
        return;
      }
      const aba = reservas.find((p) => p.aba && document.querySelector(p.seletor));
      if (aba && !tocouAba) {
        tocouAba = true;
        document.querySelector<HTMLElement>(aba.seletor)?.click();
      }
      if (++tentativas >= 17) { setFase("anotar"); return; }
      timers.push(window.setTimeout(procurar, 300));
    };
    const espera = TEMPOS_DA_MISSAO.antesDoHolofote;
    timers.push(window.setTimeout(procurar, reduzir ? Math.min(400, espera) : espera));
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* O item nasce aqui: a gravação que veio de um gesto dela, na chave do
   * módulo, com algo que não estava lá antes. O número do passo 3 é lido
   * AGORA — a tela ainda mostra o "antes". E sobe a comemoração. */
  useEffect(() => {
    ouvinte.current = (chave, valor, anterior, gesto) => {
      const f = faseRef.current;
      if ((f !== "inicio" && f !== "achar" && f !== "anotar") || !gesto || chave !== cfg.chave) return;
      const novo = cfg.achar(valor, anterior);
      if (!novo) return;
      let n: Numero | null = null;
      try { n = cfg.numero(valor, anterior, novo); } catch { n = null; }
      faseRef.current = "festa1";
      numeroRef.current = n;
      setItem(novo);
      setNumero(n);
      setAnelVivo(false);
      setFase("festa1");
      aoItem(novo);
      evento("demo_guia_passo", { n: 3, tipo: novo.tipo });
    };
    return () => { ouvinte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Depois do "Primeiro registro feito!": PASSO 3, olhar o resumo que
   * recalculou (sem âncora ou sem número: direto pra "Missão cumprida"). */
  const aposPrimeiraFesta = () => {
    if (faseRef.current !== "festa1") return;
    const o = cfg.olhar;
    if (!o || !numeroRef.current) { setFase("festa2"); return; }
    const acharResumo = () => {
      let el = document.querySelector(o.seletor);
      if (el && o.perto) el = o.perto(el);
      return el && visivel(el) ? el : null;
    };
    const agora = acharResumo();
    if (agora) { setOlharEm(agora); setFase("olhar"); return; }
    // anotou por outro caminho e o resumo está em outra aba: a missão leva até lá antes de mostrar
    const aba = cfg.passos.find((p) => p.aba);
    const botao = aba ? document.querySelector<HTMLElement>(aba.seletor) : null;
    if (!botao) { setFase("festa2"); return; }
    botao.click();
    let tentativas = 0;
    const tentar = () => {
      if (faseRef.current !== "festa1") return;
      const el = acharResumo();
      if (el) { setOlharEm(el); setFase("olhar"); return; }
      if (++tentativas >= 10) { setFase("festa2"); return; }
      window.setTimeout(tentar, 200);
    };
    window.setTimeout(tentar, 200);
  };

  const mostrarOnde = () => {
    evento("demo_guia_onde", { passo: 2 });
    setPerdeuAlvo(false);
    setFase("achar");
  };

  useEffect(() => {
    if (fase !== "festa2") return;
    evento("demo_guia_feito", { tipo, segundos: Math.round((Date.now() - t0.current) / 1000) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const pular = () => {
    evento("demo_guia_pular", { motivo: "botao", passo: passoAtual() });
    aoFim("pulou");
  };
  const levar = () => {
    if (!item) return;
    evento("demo_guia_levar", { tipo: item.tipo });
    // o funil conta o "Quase lá" por este clique também (braço da missão × controle)
    try { trackEvent("funnel_click", { cta: "demo_quase_la", via: "guia" }); } catch { /* noop */ }
    aoFim("levar");
    irParaCadastro(item);
  };
  const explorar = () => {
    evento("demo_guia_explorar", { via: "folha" });
    pulsarBarra(reduzir);
    aoFim("explorar");
  };

  const completa = fase === "festa2" || fase === "cumprida";
  const feitos = fase === "inicio" || fase === "achar" || fase === "anotar" ? 1 : completa ? 3 : 2;
  const rotulo = item ? rotuloCurto(item) : "";
  const texto =
    completa
      ? <><strong>Missão cumprida ✓</strong> {rotulo} vai com você.</>
      : item
        ? <><strong>1º registro:</strong> {rotulo} ✓ · {cfg.olhe}</>
        : (
          <>
            Área escolhida ✓ · <strong>Agora: {cfg.pedido}</strong>
            {fase === "anotar" && perdeuAlvo && (
              <> · <button type="button" onClick={mostrarOnde} className="font-semibold underline underline-offset-2" data-testid="demo-guia-onde">mostrar onde</button></>
            )}
          </>
        );
  const cumprida = item ? cfg.cumprida(item) : null;

  return (
    <div>
      <FaixaDaMissao feitos={feitos} texto={texto} aoPular={completa ? undefined : pular} cumprida={completa} />
      <AnimatePresence>
        {fase === "inicio" && (
          <CartaoDoPasso1 key="inicio" modulo={NOME_DO_MODULO[tipo]} pedido={cfg.pedido} aoContinuar={() => { evento("demo_guia_mostrar"); setFase("achar"); }} />
        )}
        {anelVivo && alvo && fase === "anotar" && (
          <Anel
            key="anotar" fixo duracao={null} alvo={alvo} rotulo="Passo 2 de 3 · anota"
            aoSair={() => { setAnelVivo(false); if (faseRef.current === "anotar") setPerdeuAlvo(true); }}
          >
            <span className="block text-[13.5px] font-semibold leading-snug">{cfg.dica}</span>
          </Anel>
        )}
        {fase === "festa1" && (
          <ComemoracaoDaMissao
            key="festa1"
            titulo="Primeiro registro feito!"
            chip="🔥 1º registro ✓"
            de={33}
            para={66}
            rodape="Missão de 1 minuto · 66%"
            duracao={TEMPOS_DA_MISSAO.primeiroRegistro}
            aoFim={aposPrimeiraFesta}
          />
        )}
        {fase === "olhar" && olharEm && numero && (
          <Anel key="olhar" fixo alvo={olharEm} recorte={cfg.olhar?.recorte} rotulo="Passo 3 de 3 · olha" duracao={TEMPOS_DA_MISSAO.olhar} aoSair={() => setFase("festa2")}>
            <span className="block text-[13px] font-semibold text-white/85 leading-snug">{numero.titulo} — já com {item ? `o seu ${item.nome}` : "o seu registro"}:</span>
            <span className="flex items-baseline gap-2 mt-1">
              <span className="text-[13px] text-white/50 line-through tabular-nums">{numero.formatar(numero.antes)}</span>
              <span className="text-white/50 text-[13px]">→</span>
              <span className="text-[26px] font-black tracking-tight leading-none">
                <ContaSubindo de={numero.antes} para={numero.depois} formatar={numero.formatar} />
              </span>
            </span>
          </Anel>
        )}
        {fase === "festa2" && (
          <ComemoracaoDaMissao
            key="festa2"
            titulo="Missão cumprida 🏆"
            chip="🔥🔥🔥 missão completa"
            de={66}
            para={100}
            rodape="Missão de 1 minuto · 100%"
            duracao={TEMPOS_DA_MISSAO.cumprida}
            aoFim={() => setFase("cumprida")}
          />
        )}
        {fase === "cumprida" && item && cumprida && (
          <FolhaCumprida key="folha" rotulo={rotulo} titulo={cumprida.titulo} sub={cumprida.sub} aoLevar={levar} aoExplorar={explorar} />
        )}
      </AnimatePresence>
    </div>
  );
}
