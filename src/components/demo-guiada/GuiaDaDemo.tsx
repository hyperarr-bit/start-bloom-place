/**
 * A MISSÃO DE 1 MINUTO — a demo da web vira o 1º registro da pessoa (28/09,
 * redesenhada em 30/09).
 *
 * O ritmo é o da Missão do teste grátis do app (dono: "quando o usuário faz
 * algo aparece comemoração, porque isso converteu bem lá") — e cada passo tem
 * UMA ação óbvia e um botão de seguir (dono, 30/09, no iPhone: "fica um tempo
 * e o usuário fica meio que perdido, não sabe onde clicar pra continuar"):
 *   1/3  ÁREA ESCOLHIDA — nasce feito (cartão "Passo 1 de 3 · feito ✓",
 *        botão "Começar →"; anda sozinho em 3 s);
 *   2/3  1 TOQUE — holofote no formulário do módulo com o POST-IT dos chips
 *        prontos ("☕ Café · R$ 12", "🚗 Uber · R$ 23"…) e "✎ escrever o meu";
 *        na Rotina o toque é o quadradinho de HOJE da tabela de hábitos, na
 *        Saúde o "+ Copo". 9% completavam digitando (41 s); agora é 1 toque.
 *        → a COMEMORAÇÃO da Missão do app ("Primeiro registro feito!", o
 *        gráfico que sobe, a barra 33 → 66%) com o botão "Ver meu mês →";
 *   3/3  OLHAR — holofote no resumo que recalculou, com o número dela subindo
 *        e o botão "Continuar →";
 *   →    "MISSÃO CUMPRIDA" numa peça só: a lista da missão com os 3
 *        quadradinhos marcando, 66 → 100%, confete, e as DUAS saídas sempre
 *        visíveis: "Levar pros meus números →" (= o "Quase lá", com o item) e
 *        "Ver os outros módulos" (fecha, pulsa a barra de módulos e a demo
 *        segue igual à de hoje).
 * TRAVA SUAVE (plano funil-novo-plano/plano.md, 1.2): o CTA fixo de baixo vira
 * "1 toque e é seu →" até o 1º registro OU 20 s OU 1 toque nele (tocar nele
 * não sai da demo: reacende o post-it; o 2º toque é o "Quase lá" de sempre).
 * 52% pulam pelo "Quase lá" em 13 s e são a maioria de quem compra — a trava
 * dura custaria venda. "Pular" na faixa, a barra de módulos e o "Quase lá"
 * continuam vivos o tempo todo.
 * SEM adesivo e sem festa empilhada: uma peça de cada vez.
 *
 * Esta peça só é montada pelo Preview quando o braço da demo é "on"; ela
 * mesma não sabe de A/B. O escuro nunca intercepta toque (ver pecas.tsx).
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/analytics";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { AREA_DO_TIPO, NOME_DO_MODULO, rotuloCurto, type FimDaMissao, type ItemDaDemo, type TipoDoItem } from "@/lib/demo-guiada";
import { AREA_PROOF, AREA_TRACKS, GASTO_ANCHOR, QUIZ, VICTORY_PHRASE, type AreaKey, type QuizQ } from "@/lib/funnel";
import { CHAVE_DA_PERGUNTA_1 } from "@/lib/funil-b";
import { alvoDaMissao, gravacoesDoChip, itemDoChip, TEMPOS_DA_MISSAO, type ChipDaMissao, type Numero, type ViaDoRegistro } from "./alvos";
import { Anel, BalaoDoPasso3, CartaoDoPasso1, ComemoracaoDaMissao, FaixaDaMissao, MissaoCumprida, PostItDaMissao, PostItDaPergunta } from "./pecas";

/** Cada gravação da demo: chave, valor novo, valor de antes e se veio de um gesto da pessoa. */
export type OuvinteDaDemo = (chave: string, valor: unknown, anterior: unknown, gesto: boolean) => void;

/** A ponte pro snapshot da demo (o `get`/`set` do PreviewUserDataProvider): é por ela que os chips gravam. */
export interface PonteDaDemo {
  get: <T>(chave: string, padrao: T) => T;
  set: (chave: string, valor: unknown) => void;
}

/** O estado "trava suave" do CTA fixo de baixo: o rótulo e o que fazer no toque. */
export interface TravaDoCta {
  rotulo: string;
  aoTocar: () => void;
}

/** inicio = passo 1 · achar/anotar = passo 2 (procurando o alvo / post-it na tela) ·
 *  registrou = o chip virou ✓ e a linha apareceu · festa1 = "Primeiro registro
 *  feito!" · olhar = passo 3 · cumprida = "Missão cumprida" com as duas saídas.
 *  FUNIL B (30/09): perguntaB1/ecoB1 = a 1ª pergunta do quiz (quanto sai por
 *  mês / quanto tempo mantém um hábito) no lugar do cartão do passo 1, com o
 *  eco da resposta; perguntaB3 = a vitória da semana, antes da "Missão cumprida". */
type Fase = "inicio" | "achar" | "anotar" | "registrou" | "festa1" | "olhar" | "cumprida" | "perguntaB1" | "ecoB1" | "perguntaB3";

/** As 2 perguntas do quiz que viram toques no B (as MESMAS chaves que o paywall lê). */
const perguntasDoB = (area: AreaKey): { chave1: "gasto" | "consistencia"; p1: QuizQ | null; p3: QuizQ | null } => {
  const trilha: QuizQ[] = area === "dinheiro" ? QUIZ : AREA_TRACKS[area];
  const chave1 = CHAVE_DA_PERGUNTA_1[area];
  return { chave1, p1: trilha.find((q) => q.key === chave1) ?? null, p3: trilha.find((q) => q.key === "vitoria") ?? null };
};

/** O eco da 1ª resposta — a tela de impacto do quiz de hoje, dentro do app. */
const ecoDaResposta = (area: AreaKey, label: string, pedido: string): ReactNode => {
  if (area === "dinheiro") {
    const a = GASTO_ANCHOR[label];
    return a
      ? <>Pela sua estimativa, <span className="underline decoration-2 underline-offset-2">{a.month} somem por mês</span> sem você ver — {a.year} no ano. Agora {pedido} e vê ele no seu mês.</>
      : <>A maioria não faz ideia — e é assim que o dinheiro some. Agora {pedido} e vê ele no seu mês.</>;
  }
  const p = AREA_PROOF[area];
  return <>{p.echo[label] ?? ""} {p.reframe} Agora: {pedido}.</>;
};

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
  /** O `get`/`set` do snapshot da demo (os chips gravam por aqui). */
  ponte: MutableRefObject<PonteDaDemo | null>;
  /** O item nasceu: o Preview guarda (URL das pílulas, CTA, sessão). */
  aoItem: (item: ItemDaDemo) => void;
  /** A missão acabou (a faixa sai). */
  aoFim: (motivo: FimDaMissao) => void;
  /** "Levar pros meus números": o mesmo destino do "Quase lá", com o item. */
  irParaCadastro: (item: ItemDaDemo) => void;
  /** A trava suave do CTA fixo: `null` = o CTA de sempre. */
  aoTravar: (trava: TravaDoCta | null) => void;
  /** FUNIL B (30/09): as 2 respostas do quiz viram toques da missão. `respostas` = o que já foi
   *  respondido (a URL/sessão); `aoResposta` guarda (memória, sessão, aparelho, URL da volta). */
  funilB?: { area: AreaKey; respostas: Record<string, string>; aoResposta: (chave: "gasto" | "consistencia" | "vitoria", label: string) => void };
}

export default function GuiaDaDemo({ modulo, tipo, ouvinte, ponte, aoItem, aoFim, irParaCadastro, aoTravar, funilB }: PropsDaMissao) {
  const cfg = alvoDaMissao(tipo);
  const reduzir = !!useReducedMotion();
  const perguntas = funilB ? perguntasDoB(funilB.area) : null;
  // B: a 1ª pergunta abre a missão (se ela ainda não respondeu — a URL/sessão lembra)
  const [fase, setFase] = useState<Fase>(() => (perguntas?.p1 && !funilB?.respostas[perguntas.chave1] ? "perguntaB1" : "inicio"));
  const [resposta1, setResposta1] = useState<string | null>(() => (perguntas ? funilB?.respostas[perguntas.chave1] ?? null : null));
  const [resposta3, setResposta3] = useState<string | null>(() => funilB?.respostas.vitoria ?? null);
  const faseRef = useRef<Fase>(fase);
  faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  /** remonta o anel do passo 2 (rola de novo até o post-it) quando o CTA travado é tocado */
  const [acende, setAcende] = useState(0);
  const [item, setItem] = useState<ItemDaDemo | null>(null);
  const [numero, setNumero] = useState<Numero | null>(null);
  const numeroRef = useRef<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  /** o anel do passo 2 saiu porque o alvo sumiu da tela (trocou de aba): a faixa oferece "mostrar onde" */
  const [perdeuAlvo, setPerdeuAlvo] = useState(false);
  /** o chip que ela tocou (vira ✓ no post-it enquanto a linha aparece) */
  const [tocado, setTocado] = useState<string | null>(null);
  const viaRef = useRef<ViaDoRegistro | null>(null);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);

  const evento = (nome: string, extra: Record<string, unknown> = {}) => {
    try { trackEvent(nome, { guia: "on", area: AREA_DO_TIPO[tipo], modulo, ...(funilB ? { funil: "b" } : {}), ...extra }); } catch { /* medição nunca derruba a demo */ }
  };
  const passoAtual = () => {
    const f = faseRef.current;
    return f === "inicio" || f === "perguntaB1" || f === "ecoB1" ? 1 : f === "achar" || f === "anotar" ? 2 : 3;
  };

  /* A TRAVA SUAVE do CTA fixo. Acaba com o 1º registro, com o tempo, com 1
   * toque nela ou com o "Pular" — o que vier primeiro, uma vez só. */
  const travadaRef = useRef(true);
  const aoTravarRef = useRef(aoTravar);
  aoTravarRef.current = aoTravar;
  const destravar = (motivo: "item" | "tempo" | "cta" | "pular") => {
    if (!travadaRef.current) return;
    travadaRef.current = false;
    evento("demo_guia_trava", { motivo, segundos: segundos(), passo: passoAtual() });
    aoTravarRef.current(null);
  };
  const reacender = () => {
    evento("demo_guia_cta", { estado: "travado", segundos: segundos(), passo: passoAtual() });
    destravar("cta");
    // tocar no CTA travado não sai da demo: leva pro post-it (e o 2º toque é o "Quase lá" de sempre)
    const f = faseRef.current;
    if (f === "inicio") setFase("achar");
    else if (f === "anotar") setAcende((n) => n + 1);
    // (B: nas perguntas o post-it já está na tela — só destrava)
  };
  useEffect(() => {
    evento("demo_guia_view");
    aoTravarRef.current({ rotulo: "1 toque e é seu", aoTocar: reacender });
    const t = window.setTimeout(() => destravar("tempo"), TEMPOS_DA_MISSAO.trava);
    return () => { window.clearTimeout(t); aoTravarRef.current(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* PASSO 1 — o cartão fica na tela antes de a demo andar sozinha ("Começar →" adianta). */
  useEffect(() => {
    if (fase !== "inicio") return;
    evento("demo_guia_passo", { n: 1 });
    const t = window.setTimeout(() => {
      if (faseRef.current === "inicio") setFase("achar");
    }, reduzir ? Math.min(900, TEMPOS_DA_MISSAO.inicio) : TEMPOS_DA_MISSAO.inicio);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* FUNIL B — as perguntas do quiz como toques da missão. A 1ª abre a missão
   * (no lugar do cartão do passo 1) e o eco da resposta anda sozinho depois de
   * um tempo (o botão adianta); a 3ª vem depois de olhar o número. */
  useEffect(() => {
    if (fase === "perguntaB1" && perguntas) evento("demo_guia_pergunta", { chave: perguntas.chave1, n: 1 });
    if (fase === "perguntaB3") evento("demo_guia_pergunta", { chave: "vitoria", n: 3 });
    if (fase !== "ecoB1") return;
    const t = window.setTimeout(() => {
      if (faseRef.current === "ecoB1") setFase("achar");
    }, reduzir ? 900 : TEMPOS_DA_MISSAO.eco);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  const responder1 = (label: string) => {
    if (!perguntas || !funilB || faseRef.current !== "perguntaB1") return;
    setResposta1(label);
    funilB.aoResposta(perguntas.chave1, label);
    setFase("ecoB1");
  };
  const responder3 = (label: string) => {
    if (!funilB || faseRef.current !== "perguntaB3") return;
    setResposta3(label);
    funilB.aoResposta("vitoria", label);
    // o chip vira ✓ antes de a "Missão cumprida" entrar (causa → efeito)
    window.setTimeout(() => { if (faseRef.current === "perguntaB3") setFase("cumprida"); }, reduzir ? 0 : 350);
  };
  /** Depois do passo 3 (olhar): no B, a vitória da semana; senão, "Missão cumprida". */
  const irParaOFim = () => setFase(perguntas?.p3 && !resposta3 ? "perguntaB3" : "cumprida");

  /* PASSO 2 — achar o formulário (a aba do módulo como reserva: a missão toca
   * nela sozinha). Módulo pesado monta tarde: procura a cada 300 ms por ~5 s;
   * não achou → segue só com a faixa (fail-open). */
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

  /* Ela abriu o teclado no meio do passo 2 (o anel some sozinho): só medição, 1× por missão. */
  useEffect(() => {
    if (fase !== "anotar") return;
    let contou = false;
    const aoFocar = (e: FocusEvent) => {
      const el = e.target;
      if (contou || !(el instanceof HTMLElement) || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
      contou = true;
      evento("demo_guia_teclado", { passo: 2, segundos: segundos() });
    };
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* O item nasce aqui: a gravação que veio de um gesto dela, numa chave do
   * módulo, com algo que não estava lá antes. O número do passo 3 é lido
   * AGORA — a tela ainda mostra o "antes". */
  useEffect(() => {
    ouvinte.current = (chave, valor, anterior, gesto) => {
      const f = faseRef.current;
      if ((f !== "inicio" && f !== "achar" && f !== "anotar") || !gesto || !cfg.chaves.includes(chave)) return;
      const ler = (k: string) => {
        try {
          if (ponte.current) return ponte.current.get<unknown>(k, undefined);
        } catch { /* cai no espelho */ }
        return (window as unknown as { __PREVIEW_SEEDS__?: Record<string, unknown> }).__PREVIEW_SEEDS__?.[k];
      };
      let achado: ReturnType<typeof cfg.achar> = null;
      try { achado = cfg.achar(chave, valor, anterior, ler); } catch { achado = null; }
      if (!achado) return;
      const novo = achado.item;
      const via: ViaDoRegistro = viaRef.current === "chip" ? "chip" : achado.via;
      let n: Numero | null = null;
      try { n = cfg.numero(chave, valor, anterior, novo); } catch { n = null; }
      faseRef.current = "registrou";
      numeroRef.current = n;
      setItem(novo);
      setNumero(n);
      setFase("registrou");
      aoItem(novo);
      evento("demo_guia_passo", { n: 3, tipo: novo.tipo, via });
      evento("demo_guia_registro", { tipo: novo.tipo, via, segundos: segundos() });
      destravar("item");
    };
    return () => { ouvinte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* REGISTROU → a comemoração (o chip ficou ✓ e a linha apareceu: causa → efeito). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const t = window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      setFase("festa1");
    }, reduzir ? 150 : TEMPOS_DA_MISSAO.registrou);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* CHIPS — 1 toque grava no snapshot da demo pelo mesmo `set` do módulo, no
   * formato que ele já lê (alvos.ts); a tela que mostra a chave é avisada
   * (avisarEscritaDeFora) e o ouvinte acima faz o resto. */
  const tocarChip = (chip: ChipDaMissao) => {
    const novo = itemDoChip(tipo, chip);
    const p = ponte.current;
    evento("demo_guia_chip", { tipo, nome: chip.nome, valor: chip.valor, ok: !!(novo && p) });
    if (!novo || !p) return; // fail-open: sem ponte, o post-it continua e ela pode escrever
    viaRef.current = "chip";
    setTocado(chip.nome);
    try {
      for (const g of gravacoesDoChip(novo, chip)) {
        const proximo = g.proximo(p.get<unknown>(g.chave, undefined));
        if (proximo === undefined) continue;
        p.set(g.chave, proximo);
        avisarEscritaDeFora(g.chave, proximo);
      }
    } catch { /* a missão nunca derruba a demo */ }
  };
  const escreverOMeu = () => {
    evento("demo_guia_escrever", { tipo, segundos: segundos() });
    const campo = alvo?.querySelector<HTMLInputElement>("input, textarea");
    try { campo?.focus(); } catch { /* noop */ }
  };

  /* Depois do "Primeiro registro feito!": PASSO 3, olhar o resumo que
   * recalculou (sem âncora ou sem número: direto pra "Missão cumprida"). */
  const aposPrimeiraFesta = (via: "botao" | "auto") => {
    if (faseRef.current !== "festa1") return;
    evento("demo_guia_continuar", { de: "festa1", via });
    const o = cfg.olhar;
    if (!o || !numeroRef.current) { irParaOFim(); return; }
    const acharResumo = () => {
      const el = o.achar();
      return el && visivel(el) ? el : null;
    };
    const agora = acharResumo();
    if (agora) { setOlharEm(agora); setFase("olhar"); return; }
    // anotou por outro caminho e o resumo está em outra aba: a missão leva até lá antes de mostrar
    const aba = cfg.passos.find((p) => p.aba);
    const botao = aba ? document.querySelector<HTMLElement>(aba.seletor) : null;
    if (!botao) { irParaOFim(); return; }
    botao.click();
    let tentativas = 0;
    const tentar = () => {
      if (faseRef.current !== "festa1") return;
      const el = acharResumo();
      if (el) { setOlharEm(el); setFase("olhar"); return; }
      if (++tentativas >= 10) { irParaOFim(); return; }
      window.setTimeout(tentar, 200);
    };
    window.setTimeout(tentar, 200);
  };
  const cumprir = (via: "botao" | "auto") => {
    if (faseRef.current !== "olhar") return;
    evento("demo_guia_continuar", { de: "olhar", via });
    irParaOFim();
  };

  const mostrarOnde = () => {
    evento("demo_guia_onde", { passo: 2 });
    setPerdeuAlvo(false);
    setFase("achar");
  };

  useEffect(() => {
    if (fase !== "cumprida") return;
    evento("demo_guia_feito", { tipo, segundos: segundos(), via: viaRef.current ?? "digitado" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const pular = () => {
    evento("demo_guia_pular", { motivo: "botao", passo: passoAtual() });
    destravar("pular");
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

  const completa = fase === "cumprida";
  const feitos = fase === "inicio" || fase === "achar" || fase === "anotar" || fase === "perguntaB1" || fase === "ecoB1" ? 1 : completa ? 3 : 2;
  const rotulo = item ? rotuloCurto(item) : "";
  const texto =
    completa
      ? <><strong>Missão cumprida ✓</strong> {rotulo} vai com você.</>
      : fase === "perguntaB3"
        ? <><strong>1º registro:</strong> {rotulo} ✓ · <strong>Agora: sua vitória da semana</strong></>
        : fase === "perguntaB1" || fase === "ecoB1"
          ? <>Área escolhida ✓ · <strong>Agora: 1 toque, {funilB?.area === "dinheiro" ? "quanto sai por mês?" : "quanto tempo dura seu hábito?"}</strong></>
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
  const viu = cfg.olhe.replace(/^olha /, "Olhou ");
  // B: a 3ª linha da missão é a vitória que ela escolheu (a promessa do paywall)
  const terceiraLinha = resposta3 ? `Vitória: ${VICTORY_PHRASE[resposta3] ?? resposta3}` : viu;

  return (
    <div>
      <FaixaDaMissao feitos={feitos} texto={texto} aoPular={completa ? undefined : pular} cumprida={completa} />
      <AnimatePresence>
        {fase === "inicio" && (
          <CartaoDoPasso1 key="inicio" modulo={NOME_DO_MODULO[tipo]} pedido={cfg.pedido} aoContinuar={() => { evento("demo_guia_mostrar"); setFase("achar"); }} />
        )}
        {(fase === "perguntaB1" || fase === "ecoB1") && perguntas?.p1 && funilB && (
          <PostItDaPergunta
            key="perguntaB1"
            testid="demo-guia-pergunta1"
            passo="Passo 1 de 3 · 1 toque"
            pergunta={perguntas.p1.q}
            chips={perguntas.p1.opts}
            tocado={resposta1}
            aoChip={responder1}
            eco={fase === "ecoB1" && resposta1 ? {
              texto: ecoDaResposta(funilB.area, resposta1, cfg.pedido),
              botao: "Continuar",
              aoBotao: () => { evento("demo_guia_continuar", { de: "ecoB1", via: "botao" }); setFase("achar"); },
            } : null}
          />
        )}
        {fase === "perguntaB3" && perguntas?.p3 && (
          <PostItDaPergunta
            key="perguntaB3"
            testid="demo-guia-pergunta3"
            passo="Passo 3 de 3 · 1 toque"
            pergunta={perguntas.p3.q}
            chips={perguntas.p3.opts}
            tocado={resposta3}
            aoChip={responder3}
          />
        )}
        {anelVivo && alvo && (fase === "anotar" || fase === "registrou") && (
          <Anel
            key={`anotar-${acende}`} fixo interativo duracao={null} alvo={alvo} testid="demo-guia-anel-2" abaixo={!!cfg.postItAbaixo}
            aoSair={() => { setAnelVivo(false); if (faseRef.current === "anotar") setPerdeuAlvo(true); }}
            balao={(
              <PostItDaMissao
                pergunta={cfg.pergunta}
                chips={cfg.chips}
                tocado={tocado}
                aoChip={tocarChip}
                aoEscrever={cfg.escrever ? escreverOMeu : undefined}
                dica={cfg.chips.length && cfg.escrever ? "Ou escreve o seu ali no campo e toca no +." : undefined}
              />
            )}
          />
        )}
        {fase === "festa1" && item && (
          <ComemoracaoDaMissao
            key="festa1"
            titulo="Primeiro registro feito!"
            chip={`🔥 ${rotulo} ✓`}
            de={33}
            para={66}
            rodape="Missão de 1 minuto · 2 de 3"
            duracao={TEMPOS_DA_MISSAO.primeiroRegistro}
            aoFim={() => aposPrimeiraFesta("auto")}
            botao={cfg.botaoOlhar}
            aoBotao={() => aposPrimeiraFesta("botao")}
          />
        )}
        {fase === "olhar" && olharEm && numero && (
          <Anel
            key="olhar" fixo interativo alvo={olharEm} recorte={cfg.olhar?.recorte} duracao={TEMPOS_DA_MISSAO.olhar} testid="demo-guia-anel-3"
            aoSair={() => cumprir("auto")}
            balao={(
              <BalaoDoPasso3
                titulo={<>{numero.titulo} — já com {item ? `o seu ${item.nome}` : "o seu registro"}:</>}
                antes={numero.antes}
                depois={numero.depois}
                formatar={numero.formatar}
                aoContinuar={() => cumprir("botao")}
              />
            )}
          />
        )}
        {fase === "cumprida" && item && cumprida && (
          <MissaoCumprida
            key="cumprida"
            linhas={[`Área escolhida: ${NOME_DO_MODULO[tipo]}`, cumprida.feito, terceiraLinha]}
            destaque={rotulo}
            titulo={cumprida.titulo}
            sub={cumprida.sub}
            aoLevar={levar}
            aoExplorar={explorar}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
