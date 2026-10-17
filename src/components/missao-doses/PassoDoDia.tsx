import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Crosshair } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { MontarFinancas, deveMostrarMontarFinancas, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import { MODELOS as MODELOS_DE_TREINO, aplicarModelo } from "@/lib/treino-plano";
import { trackEvent } from "@/lib/analytics";
import { Anel, BotaoSeguir, Confete, ContaSubindo, PostItDaMissao } from "@/components/demo-guiada/pecas";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { CHIPS_DE_HABITO, PERGUNTA_HABITO_MARCAR, PERGUNTA_HABITO_VAZIO, alvoDaMissao, gravacoesDoChip, itemDoChip, linhaDeHoje, linhaDoNovoHabito, type AlvoDaMissao, type ChipDaMissao, type Numero } from "@/components/demo-guiada/alvos";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { reais, rotuloCurto } from "@/lib/demo-guiada";
import { DOSE_CURTA, HORAS_DO_LEMBRETE, MODULOS, TOTAL_PASSOS_B, diaDaMissao, eventoDaMissao, sequenciaDaMissao, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao } from "@/lib/missao-doses";
import { horaSugeridaDaMissao } from "@/lib/lembrete-dia2";
import "./missao-doses.css";

/** O "Pular" da faixa só aparece depois disto (ou ao 2º toque na faixa) — seção 5 do estudo. */
export const PULAR_DEPOIS_DE_MS = 20_000;
export const TEMPOS_DO_PASSO = {
  antesDoAnel: 300,
  /** o chip vira ✓ e a linha aparece ANTES de a comemoração entrar (causa → efeito) */
  registrou: 550,
  /** o "olhar explicado" anda sozinho depois disso ("Entendi" adianta) */
  olhar: 15_000,
};

type Fase = "achar" | "anotar" | "registrou" | "olhar" | "festa";
export type ViaDoPulo = "link_boas_vindas" | "faixa_20s" | "toque_fora" | "passo";

const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };

/* 10/10 (dono: "ficou muito rápido o MEU MÊS; deixa mais embaixo e lento pra o usuário ver") — a rolagem até o
 * card é ANIMADA à mão (rAF, ease-in-out, ~1 s): o `behavior: smooth` no WKWebView é curto/instantâneo e, quando o
 * scroller é um container (não o window), nem anima. O card para com o TOPO a ~55 % da altura visível — a metade
 * de baixo — pra o balão "Olha o seu mês" caber ACIMA dele sem tampar o cabeçalho nem os chips Entrou/Saiu. */
export const ROLAGEM_DO_OLHAR = { duracaoMs: 1000, fracaoDoTopo: 0.54, pausaMs: 500, numeroS: 1.5 };
/** O scroller real do elemento: o ancestral com overflow rolável e conteúdo maior que a janela, senão o window. */
export const scrollerDe = (el: Element): HTMLElement | Window => {
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    try {
      const ov = getComputedStyle(p).overflowY;
      if ((ov === "auto" || ov === "scroll") && p.scrollHeight > p.clientHeight + 4) return p;
    } catch { /* noop */ }
    p = p.parentElement;
  }
  return window;
};
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** Rola até o topo do `el` ficar em `fracao` da altura visível, animado; chama `aoTerminar` quando parar
 *  (callback síncrono, não promessa: nos testes com relógio falso a microtask só rodaria depois do teste). */
export function rolarAte(el: Element, fracao: number, duracaoMs: number, aoTerminar: () => void): void {
  const resolve = aoTerminar;
  {
    const scroller = scrollerDe(el);
    const janela = scroller === window;
    const altura = janela ? (window.visualViewport?.height ?? window.innerHeight) : (scroller as HTMLElement).clientHeight;
    const topoScroller = janela ? 0 : (scroller as HTMLElement).getBoundingClientRect().top;
    const de = janela ? window.scrollY : (scroller as HTMLElement).scrollTop;
    const alvoY = de + (el.getBoundingClientRect().top - topoScroller) - altura * fracao;
    const max = janela ? Math.max(0, document.documentElement.scrollHeight - altura) : Math.max(0, (scroller as HTMLElement).scrollHeight - altura);
    const para = Math.max(0, Math.min(max, alvoY));
    const ir = (y: number) => { if (janela) window.scrollTo(0, y); else (scroller as HTMLElement).scrollTop = y; };
    if (duracaoMs <= 0 || Math.abs(para - de) < 2) { ir(para); resolve(); return; }
    // quadros por setTimeout de 16 ms com Date.now (não rAF/performance.now): no WKWebView dá os mesmos ~60 fps e,
    // nos testes com relógio falso, a animação anda junto com o relógio
    const t0 = Date.now();
    const passo = () => {
      const t = Math.min(1, (Date.now() - t0) / duracaoMs);
      ir(de + (para - de) * easeInOut(t));
      if (t < 1) window.setTimeout(passo, 16); else resolve();
    };
    passo();
  }
}
const significativo = (v: unknown): boolean => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v > 0;
  return !!v;
};
const tamanho = (v: unknown): number => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : typeof v === "number" ? v : significativo(v) ? 1 : 0);

/* 1.0.16 (desenho 8, seção 4.2) — a dose nunca pede o que a conta VAZIA não tem:
 *   · Treino: "escolhe um treino pronto" (1 toque aplica o modelo — o mesmo `aplicarModelo` da aba
 *     PLANO, com os exercícios) em vez de "anota 1 exercício" (Treino vazio pagava 9%);
 *   · Saúde sem meta de água: o chip É a meta (6/8/10 copos) e já marca o 1º copo (10 s). */
const MODELOS_DA_DOSE = ["ABC Clássico", "Upper / Lower", "Full Body 3x"];
export const CHIPS_DE_TREINO: ChipDaMissao[] = MODELOS_DE_TREINO
  .filter((m) => MODELOS_DA_DOSE.includes(m.name)).concat(MODELOS_DE_TREINO.filter((m) => !MODELOS_DA_DOSE.includes(m.name)))
  .slice(0, 3).map((m) => ({ emoji: m.emoji, nome: m.name }));
export const CHIPS_DE_META_AGUA: ChipDaMissao[] = [6, 8, 10].map((n) => ({ emoji: "💧", nome: `Meta de ${n} copos` }));
/** A meta do chip ("Meta de 8 copos" → 8) — fora do `valor`, que o post-it mostra como R$. */
const metaDoChip = (c: ChipDaMissao): number => Number(/(\d+)/.exec(c.nome)?.[1] ?? 0);

/**
 * O PASSO DO DIA dentro do módulo de verdade (D3/D7 → olhar → D4): a faixa
 * grudada no topo ("Missão · dia 1 de 3 · Finanças"), o anel no botão de
 * adicionar com o post-it de chips (1 toque = um registro DE VERDADE na conta,
 * pelo mesmo `set` do módulo), o "olhar explicado" no resumo que recalculou
 * (Entendi / Pular este passo) e a comemoração com o de amanhã combinado.
 *
 * Nada aqui trava: o escuro do anel não intercepta toque (é a sombra do anel),
 * toque fora solta o anel (a instrução fica na faixa, com "mostrar onde"), o
 * "Pular" da faixa só aparece aos 20 s ou no 2º toque nela, e a missão escuta
 * o registro por qualquer caminho (chip, campo, quadradinho).
 */
/**
 * 10/10 (chave DIA1_CHEIO, lib/dia1-cheio) — o braço B muda SÓ a comemoração e a faixa:
 *   · `braco: "B"` (modo "dose"): as 3 doses são do dia 1 → a festa pergunta "Bora a próxima? 20 s"
 *     (+ "Agora não") em vez de combinar a hora de amanhã; na 3ª, "Fechar por hoje";
 *   · `modo: "aprofundar"` (dias 2 e 3 do B): a faixa diz "Aprofundar · dia N" e a festa é curta.
 * Sem `braco` (chave desligada, ou braço A) tudo aqui é o de hoje, byte a byte.
 */
export type BracoDoPasso = "A" | "B" | null | undefined;
export type ModoDoPasso = "dose" | "aprofundar";

export function PassoDoDia({ missao, n, modulo, hoje, aoFeito, aoPular, aoCombinar, aoAmanhaAgora, aoVerFim, braco, modo = "dose", aoBoraProxima, aoAgoraNao, aoFecharDia }: {
  missao: EstadoMissaoDoses;
  n: DiaDaMissao;
  modulo: ModuloDaMissao;
  hoje: string;
  aoFeito: (rotulo: string, segundos: number) => void;
  aoPular: (via: ViaDoPulo, passo: "toque" | "olhar", segundos: number) => void;
  aoCombinar: (lembrete: Lembrete) => void;
  aoAmanhaAgora: () => void;
  aoVerFim: () => void;
  braco?: BracoDoPasso;
  modo?: ModoDoPasso;
  /** braço B: "Bora a próxima? 20 s" */
  aoBoraProxima?: () => void;
  /** braço B: "Agora não" no meio das doses */
  aoAgoraNao?: () => void;
  /** braço B: a 3ª dose feita (ou um "aprofundar" feito) — fecha a festa */
  aoFecharDia?: () => void;
}) {
  const cfg = MODULOS[modulo];
  const alvoCfg: AlvoDaMissao | null = cfg.tipo ? alvoDaMissao(cfg.tipo) : null;
  const { get, set } = useUserData();
  /* 10/10 — ROTINA NUMA CONTA VAZIA (dono: "tem que ENSINAR o usuário a criar o hábito, não só clicar
   * no botão"): sem hábito, a dose tem 2 passos dentro do módulo — (A) "criar": anel + post-it no campo
   * real "+ Hábito"; os chips só PREENCHEM o campo e a pessoa toca em Adicionar (o hábito nasce pelo
   * código normal da Rotina); (B) "marcar": o anel vai pro quadradinho de HOJE da linha nova. Com hábito
   * (conta antiga, dia 2), direto no (B) como sempre. Lido UMA vez no mount. */
  const [semHabito] = useState(() => cfg.tipo === "habito" && !(Array.isArray(get<unknown>("rotina-habits", undefined)) && (get<unknown[]>("rotina-habits", []) ?? []).length > 0));
  const [subPasso, setSubPasso] = useState<"criar" | "marcar" | null>(semHabito ? "criar" : null);
  const [semMetaAgua] = useState(() => cfg.tipo === "agua" && modo === "dose" && !(Number(get<unknown>("core-saude-water-goal", 0)) > 0));
  const treinoPronto = modulo === "treino" && modo === "dose";
  /* 1.0.16 — FINANÇAS: a dose 1 é o "Vamos montar suas Finanças" (conta nova, Finanças vazia, chave ligada).
   * "Pronto" = a dose (o número DELA já está no módulo); "Pular" = segue pro 1º gasto pelo chip. Lido no mount. */
  const { user } = useAuth();
  const { isGuest } = useUserData();
  const [montarAberto, setMontarAberto] = useState(() => {
    if (modulo !== "financas" || modo !== "dose") return false;
    try { return deveMostrarMontarFinancas({ criadoEm: (user as { created_at?: string } | null)?.created_at, get, isGuest: !!isGuest }); } catch { return false; }
  });
  const subPassoRef = useRef(subPasso);
  subPassoRef.current = subPasso;
  const chips: ChipDaMissao[] = subPasso === "criar" ? CHIPS_DE_HABITO : subPasso === "marcar" ? [] : treinoPronto ? CHIPS_DE_TREINO : semMetaAgua ? CHIPS_DE_META_AGUA : (alvoCfg?.chips ?? []);
  const pergunta = subPasso === "criar" ? PERGUNTA_HABITO_VAZIO : subPasso === "marcar" ? PERGUNTA_HABITO_MARCAR
    : treinoPronto ? "Escolhe um treino pronto" : semMetaAgua ? "Quantos copos por dia?" : (alvoCfg?.pergunta ?? cfg.pedido);
  const chipTocado = useRef<ChipDaMissao | null>(null);
  const reduzir = !!useReducedMotion();
  const [fase, setFase] = useState<Fase>("achar");
  const faseRef = useRef<Fase>("achar");
  faseRef.current = fase;
  const [alvo, setAlvo] = useState<Element | null>(null);
  const [anelVivo, setAnelVivo] = useState(false);
  const [acende, setAcende] = useState(0);
  const [perdeuAlvo, setPerdeuAlvo] = useState(false);
  const [tocado, setTocado] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [numero, setNumero] = useState<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  const [pularVisivel, setPularVisivel] = useState(false);
  const toquesNaFaixa = useRef(0);
  const viaRef = useRef<"chip" | null>(null);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);

  // a página desce a altura da faixa enquanto o passo está na tela
  useEffect(() => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "view" }));
    return () => { document.documentElement.removeAttribute("data-missao-doses-faixa"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Pular" na faixa: aos 20 s
  useEffect(() => {
    const t = window.setTimeout(() => setPularVisivel(true), PULAR_DEPOIS_DE_MS);
    return () => window.clearTimeout(t);
  }, []);

  /* ACHAR o botão de adicionar (a aba do módulo como reserva). Módulo pesado monta tarde: procura
   * a cada 300 ms por ~5 s; não achou → segue só com a faixa e o post-it solto (fail-open). */
  useEffect(() => {
    if (fase !== "achar" || montarAberto) return;
    let vivo = true;
    let tentativas = 0;
    let tocouAba = false;
    const timers: number[] = [];
    const passos = alvoCfg?.passos ?? (cfg.seletor ? [{ seletor: cfg.seletor }] : []);
    let abriuCampo = false;
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      const [principal, ...reservas] = passos;
      const el = principal ? document.querySelector(principal.seletor) : null;
      // passo A da Rotina: o alvo é a LINHA DO CAMPO "Nome do hábito..." — abre pelo botão "+ Hábito" (uma vez)
      if (subPassoRef.current === "criar" && el && visivel(el)) {
        const linha = linhaDoNovoHabito();
        if (linha && visivel(linha)) {
          // o campo da Rotina nasce com autoFocus (teclado aberto = o anel se esconde): solta o foco — o post-it
          // com os 3 prontos é o que ensina; quem quiser escrever toca no campo
          try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch { /* noop */ }
          setAlvo(linha); setAnelVivo(true); setFase("anotar"); return;
        }
        if (!abriuCampo) { abriuCampo = true; (el as HTMLElement).click(); }
        if (++tentativas >= 17) { setAlvo(el); setAnelVivo(true); setFase("anotar"); return; }
        timers.push(window.setTimeout(procurar, 300));
        return;
      }
      if (el && visivel(el)) {
        setAlvo(alvoCfg?.anel ? alvoCfg.anel(el) : el);
        setAnelVivo(true);
        setFase("anotar");
        return;
      }
      const aba = reservas.find((p) => p.aba && document.querySelector(p.seletor));
      if (aba && !tocouAba) { tocouAba = true; document.querySelector<HTMLElement>(aba.seletor)?.click(); }
      if (++tentativas >= 17 || !principal) { setFase("anotar"); return; }
      timers.push(window.setTimeout(procurar, 300));
    };
    timers.push(window.setTimeout(procurar, reduzir ? 100 : TEMPOS_DO_PASSO.antesDoAnel));
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, montarAberto]);

  /* O REGISTRO: a missão escuta as chaves do módulo na conta dela. Algo novo numa chave = o toque
   * aconteceu (chip, campo ou quadradinho — qualquer caminho). O número do "olhar" é lido AGORA. */
  const anterior = useRef<Record<string, unknown> | null>(null);
  const assinatura = cfg.chaves.map((k) => { try { return JSON.stringify(get<unknown>(k, undefined) ?? null); } catch { return ""; } }).join("|");
  useEffect(() => {
    if (!anterior.current) {
      anterior.current = Object.fromEntries(cfg.chaves.map((k) => [k, get<unknown>(k, undefined)]));
      return;
    }
    for (const k of cfg.chaves) {
      const valor = get<unknown>(k, undefined);
      const ant = anterior.current[k];
      let mudou = false;
      try { mudou = JSON.stringify(valor ?? null) !== JSON.stringify(ant ?? null); } catch { mudou = valor !== ant; }
      if (!mudou) continue;
      anterior.current[k] = valor;
      const f = faseRef.current;
      if (f !== "achar" && f !== "anotar") continue;
      let rot: string | null = null;
      let num: Numero | null = null;
      let via: string = "digitado";
      if (alvoCfg) {
        try {
          const achado = alvoCfg.achar(k, valor, ant, (kk) => get<unknown>(kk, undefined));
          if (!achado) continue;
          if (cfg.tipo === "habito" && k === "rotina-habits") {
            // o hábito NASCEU (pelo Adicionar da Rotina): no passo A isso é a passagem pro passo B —
            // o anel vai pro quadradinho de HOJE da linha nova (a tabela redesenha num instante)
            if (subPassoRef.current === "criar") {
              trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "criar_habito", acao: "feito", nome: achado.item.nome, segundos: segundos() }));
              setSubPasso("marcar");
              setTocado(null);
              setAnelVivo(false);
              window.setTimeout(() => {
                if (faseRef.current !== "anotar") return;
                const btn = document.querySelector('[data-spotlight="add-habit"]');
                const linha = btn ? linhaDeHoje(btn) : null;
                setPerdeuAlvo(false); // o anel velho (do campo) pode ter avisado "âncora sumiu" na saída — não é perda
                if (linha && linha !== btn && visivel(linha)) { setAlvo(linha); setAcende((x) => x + 1); setAnelVivo(true); }
                else { setAlvo(null); }
              }, 350);
            }
            continue; // criar hábito nunca conta como "marcou"
          }
          // o rótulo é o do CHIP que ela tocou (o gasto real da dose — "Café · R$ 12"); hábito = o nome dele (como sempre)
          const c = viaRef.current === "chip" ? chipTocado.current : null;
          rot = cfg.tipo === "habito" ? rotuloCurto(achado.item) : c ? (c.valor != null ? `${c.nome} · R$ ${reais(c.valor)}` : c.nome) : rotuloCurto(achado.item);
          via = viaRef.current === "chip" ? "chip" : achado.via;
          try { num = alvoCfg.numero(k, valor, ant, achado.item); } catch { num = null; }
        } catch { continue; }
      } else {
        // sem tipo da demo: vale "entrou algo novo" (lista/objeto cresceu ou passou a existir)
        if (!significativo(valor) || tamanho(valor) <= tamanho(ant)) continue;
        rot = `${cfg.toque} anotado`;
        via = "modulo";
      }
      faseRef.current = "registrou";
      setRotulo(rot);
      setNumero(num);
      setFase("registrou");
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "feito", via, segundos: segundos() }));
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  /* REGISTROU → o chip ficou ✓ e a linha apareceu; depois, o OLHAR (ou direto a festa). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      const el = alvoCfg?.olhar?.achar() ?? null;
      if (el && visivel(el)) {
        // 10/10: rolagem VISÍVEL até o card (metade de baixo) → pausa → o anel acende e o balão entra → o número
        // conta por 1,5 s; a festa só no "Entendi" ou 15 s depois do balão (o relógio do Anel nasce com ele)
        const mostrar = () => {
          if (faseRef.current !== "registrou") return;
          setOlharEm(el);
          setFase("olhar");
          trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view" }));
        };
        try {
          rolarAte(el, ROLAGEM_DO_OLHAR.fracaoDoTopo, reduzir ? 0 : ROLAGEM_DO_OLHAR.duracaoMs, () => {
            if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, ROLAGEM_DO_OLHAR.pausaMs));
          });
        } catch { mostrar(); }
      } else {
        setFase("festa");
      }
    }, reduzir ? 150 : TEMPOS_DO_PASSO.registrou));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  useEffect(() => {
    if (fase !== "festa") return;
    aoFeito(rotulo, segundos());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* CHIPS — 1 toque grava NA CONTA pelo mesmo `set` do módulo, no formato que ele já lê (alvos.ts). */
  const tocarChip = (chip: ChipDaMissao) => {
    if (!cfg.tipo) return;
    // 1.0.16: Treino — o chip aplica o modelo pronto (plano + dias de treino), pelo formato da aba PLANO
    if (treinoPronto) {
      const modelo = MODELOS_DE_TREINO.find((m) => m.name === chip.nome);
      trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: chip.nome, ok: !!modelo, tipo: "treino_modelo" }));
      if (!modelo) return;
      chipTocado.current = chip; viaRef.current = "chip"; setTocado(chip.nome);
      try {
        const r = aplicarModelo((get<Record<string, never>>("saude-workouts-v2", {}) ?? {}) as Record<string, never>, modelo);
        set("saude-workouts-v2", r.plano); avisarEscritaDeFora("saude-workouts-v2", r.plano);
        set("treino-active-days", r.diasAtivos); avisarEscritaDeFora("treino-active-days", r.diasAtivos);
        trackEvent("treino_modelo", { modelo: modelo.name, dias: r.diasAtivos.length, origem: "missao" });
      } catch { /* a missão nunca derruba o módulo */ }
      return;
    }
    // 1.0.16: Saúde sem meta — o chip grava a meta e o 1º copo (o copo segue pelo caminho de sempre, abaixo)
    const meta = semMetaAgua ? metaDoChip(chip) : 0;
    if (meta > 0) {
      try { set("core-saude-water-goal", meta); avisarEscritaDeFora("core-saude-water-goal", meta); } catch { /* noop */ }
      chip = { emoji: "💧", nome: `1 copo d'água · meta ${meta}` };
    }
    const item = itemDoChip(cfg.tipo, semMetaAgua ? { emoji: "💧", nome: "1 copo d'água" } : chip);
    trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: chip.nome, valor: chip.valor, ok: !!item }));
    if (!item) return;
    chipTocado.current = chip;
    setTocado(chip.nome);
    // passo A da Rotina: o chip só PREENCHE o campo real (e dá foco) — quem cria é o Adicionar da Rotina
    if (subPassoRef.current === "criar") {
      const campo = (alvo?.querySelector("input") ?? document.querySelector('input[placeholder="Nome do hábito..."]')) as HTMLInputElement | null;
      if (campo) {
        try {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          setter ? setter.call(campo, chip.nome) : (campo.value = chip.nome);
          campo.dispatchEvent(new Event("input", { bubbles: true }));
          // sem focar: o teclado esconderia o post-it (o ✓ no chip + "toca em Adicionar" ficam na tela)
        } catch { /* noop */ }
      }
      return;
    }
    viaRef.current = "chip";
    try {
      for (const g of gravacoesDoChip(item, chip)) {
        const proximo = g.proximo(get<unknown>(g.chave, undefined));
        if (proximo === undefined) continue;
        set(g.chave, proximo);
        /* 10/10 — A CAUSA do "apertei e nem criou": o `set` do useUserData grava no store, mas a tela do
         * módulo guarda a chave num usePersistedState (estado próprio) e NÃO redesenha — a tabela ficava
         * velha e a próxima gravação dela apagava o registro. O aviso é o que a demo da web já fazia. */
        avisarEscritaDeFora(g.chave, proximo);
      }
    } catch { /* a missão nunca derruba o módulo */ }
  };
  const escreverOMeu = () => {
    trackEvent("missao_doses_escrever", eventoDaMissao({ dia: n, modulo }));
    const campo = alvo?.querySelector<HTMLInputElement>("input, textarea");
    try { campo?.focus(); } catch { /* noop */ }
  };

  /* 16/10 (1.0.16 — o anel do passo 1 sumia antes do toque, `anel_saiu motivo=ancora_invisivel`): quando o
   * módulo redesenha e troca o nó, o anel RE-ACHA a âncora pelo mesmo caminho do "achar" — o botão/linha
   * de adicionar; no passo A da Rotina, a linha do campo; no B, a linha de HOJE da tabela (que se refaz
   * quando o hábito nasce). Lido na hora (subPassoRef), não no mount. */
  const reacharAlvo = useCallback((): Element | null => {
    const sel = (alvoCfg?.passos ?? (cfg.seletor ? [{ seletor: cfg.seletor }] : []))[0]?.seletor;
    if (subPassoRef.current === "criar") {
      const linha = linhaDoNovoHabito();
      return linha && visivel(linha) ? linha : null;
    }
    const el = sel ? document.querySelector(sel) : null;
    if (!el || !visivel(el)) return null;
    if (subPassoRef.current === "marcar") {
      const linha = linhaDeHoje(el);
      return linha !== el && visivel(linha) ? linha : null;
    }
    return alvoCfg?.anel ? alvoCfg.anel(el) : el;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pularPelaFaixa = () => aoPular("faixa_20s", faseRef.current === "olhar" ? "olhar" : "toque", segundos());
  const toqueNaFaixa = () => {
    toquesNaFaixa.current += 1;
    if (toquesNaFaixa.current >= 2) setPularVisivel(true);
  };
  const mostrarOnde = () => {
    setPerdeuAlvo(false);
    const el = reacharAlvo();
    if (el) setAlvo(el);
    setAcende((x) => x + 1); setAnelVivo(true);
  };
  const entendi = useCallback((via: "botao" | "auto") => {
    if (faseRef.current !== "olhar") return;
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "feito", via }));
    setFase("festa");
  }, [n, modulo]);
  const pularOlhar = () => {
    if (faseRef.current !== "olhar") return;
    aoPular("passo", "olhar", segundos());
    setFase("festa");
  };

  const B = braco === "B";
  const total = B ? TOTAL_PASSOS_B : 3;
  const feitos = ([1, 2, 3] as DiaDaMissao[]).filter((k) => missao.feitos[k] || (k === n && fase === "festa")).length + (B && missao.homeTour ? 1 : 0);
  /* A FAIXA (10/10, print do dono: título truncado, "mostrar onde" quebrado em 2 linhas cobrindo o
   * cabeçalho): UMA linha de altura fixa, "Missão · dose 1 de 4" sem o nome do módulo (ele já está no
   * cabeçalho logo abaixo), à direita só "Pular" e um alvo ⌖ pra "mostrar onde" (ícone, nunca texto). */
  const faixa = (
    <div className="md-faixa" data-testid="missao-doses-faixa" data-fase={fase} onClick={toqueNaFaixa} role="presentation">
      <span className="md-faixa-quadros" aria-label={`${feitos} de ${total} feitos`} role="img">
        {Array.from({ length: total }, (_, i) => <Quadradinho key={i} marcado={i < feitos} claro tam={14} />)}
      </span>
      <span className="md-faixa-titulo">
        {modo === "aprofundar" ? <>Aprofundar · dia {diaDaMissao(missao, hoje)}</>
          : B ? <>Missão · dose {n} de {total}</>
          : <>Missão · dia {n} de 3</>}
      </span>
      {perdeuAlvo && fase === "anotar" && (
        <button type="button" className="md-faixa-onde" data-testid="missao-doses-onde" aria-label="Mostrar onde tocar" title="Mostrar onde" onClick={(e) => { e.stopPropagation(); mostrarOnde(); }}><Crosshair className="w-4 h-4" /></button>
      )}
      {pularVisivel && fase !== "festa" && !montarAberto && (
        <button type="button" className="md-faixa-pular" data-testid="missao-doses-pular" onClick={(e) => { e.stopPropagation(); pularPelaFaixa(); }}>Pular</button>
      )}
    </div>
  );

  const postIt = (
    <PostItDaMissao
      rotulo={subPasso === "criar" ? "1 de 2 · criar" : subPasso === "marcar" ? "2 de 2 · marcar" : "Agora · 1 toque"}
      pergunta={pergunta}
      descricao={cfg.tipo === "gasto" ? "Toca num pronto ou escreve o seu. Cada gasto entra na linha de cima e o mês soma sozinho."
        : subPasso === "criar" ? "Escolhe um ou escreve o seu, e toca em Adicionar."
        : subPasso === "marcar" ? "É a linha de HOJE, na coluna do hábito novo. Toca no quadradinho."
        : cfg.tipo === "habito" ? "Toca num quadradinho da linha de HOJE." : undefined}
      chips={chips}
      tocado={tocado}
      aoChip={tocarChip}
      aoEscrever={alvoCfg?.escrever ? escreverOMeu : undefined}
      dica={chips.length && alvoCfg?.escrever ? "Ou escreve o seu ali no campo e toca no +." : undefined}
    />
  );

  /* 1.0.16 — a dose de Finanças = "Vamos montar suas Finanças" (folha fixa abaixo da faixa da missão) */
  const montarPronto = (r: ResumoMontar) => {
    setMontarAberto(false);
    const rot = r.semFolga || !(r.porDia > 0) ? `Renda e ${r.contas} ${r.contas === 1 ? "conta" : "contas"} do mês` : `Pode gastar R$ ${reais(Math.floor(r.porDia))} por dia`;
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "feito", contas: r.contas, segundos: segundos() }));
    faseRef.current = "registrou";
    setRotulo(rot);
    setNumero(null);
    setFase("festa");
  };
  const montarPulou = () => {
    setMontarAberto(false);
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "pulou", segundos: segundos() }));
  };

  return (
    <>
      {createPortal(faixa, document.body)}
      {montarAberto && <MontarFinancas origem="missao" onPronto={montarPronto} onPular={montarPulou} />}
      {/* fora do AnimatePresence (um portal ali dentro era descartado: o post-it solto NUNCA montava) */}
      {!alvo && fase === "anotar" && !montarAberto && createPortal(
          <motion.div key="postit-solto" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 64px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="missao-doses-postit-solto">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{postIt}</div>
          </motion.div>,
          document.body,
        )}
      <AnimatePresence>
        {anelVivo && alvo && (fase === "anotar" || fase === "registrou") && (
          <Anel
            /* 10/10 (dono): toque FORA e rolagem NÃO fecham o post-it (`fixo`: o anel segue o alvo e o toque só
               clareia o escuro); só "Pular"/o tempo (60 s)/a âncora sumir soltam — e aí a faixa mostra ⌖ pra reabrir. */
            key={`anotar-${acende}`} fixo interativo duracao={60_000} alvo={alvo} reachar={reacharAlvo} testid="missao-doses-anel" abaixo={!!alvoCfg?.postItAbaixo}
            aoSair={(motivo, info) => {
              setAnelVivo(false);
              if (faseRef.current !== "anotar") return;
              setPerdeuAlvo(true);
              // 1.0.16 (defeito 5): a âncora sumiu de vez — o post-it com os chips FICA na tela, solto (os chips
              // gravam sozinhos); o ⌖ da faixa tenta achar de novo
              if (motivo === "ancora_invisivel") setAlvo(null);
              trackEvent("missao_doses_anel_saiu", eventoDaMissao({ dia: n, modulo, motivo, voltou: !!info?.voltou, ms: info?.ms ?? null }));
            }}
            balao={postIt}
          />
        )}
        {fase === "olhar" && olharEm && (
          <Anel
            key="olhar" fixo interativo alvo={olharEm} recorte={alvoCfg?.olhar?.recorte} duracao={TEMPOS_DO_PASSO.olhar} testid="missao-doses-anel-olhar"
            aoSair={() => entendi("auto")}
            balao={(
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="missao-doses-olhar">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1">Olha · 1 de 1</span>
                <span className="block text-[15px] font-extrabold leading-snug">{cfg.olhar.titulo}</span>
                <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{cfg.olhar.texto}</span>
                {numero && (
                  <span className="flex items-baseline gap-2 mt-2">
                    <span className="text-[12px] text-white/50">{numero.titulo}:</span>
                    <span className="text-[13px] text-white/50 line-through tabular-nums">{numero.formatar(numero.antes)}</span>
                    <span className="text-white/50 text-[13px]">→</span>
                    <span className="text-[22px] font-black tracking-tight leading-none"><ContaSubindo de={numero.antes} para={numero.depois} formatar={numero.formatar} duracao={ROLAGEM_DO_OLHAR.numeroS} /></span>
                  </span>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <BotaoSeguir claro onClick={() => entendi("botao")} testid="missao-doses-entendi">Entendi</BotaoSeguir>
                  <button type="button" className="text-[12.5px] font-semibold text-white/70 underline underline-offset-2 min-h-10" data-testid="missao-doses-pular-passo" onClick={pularOlhar}>Pular este passo</button>
                </div>
              </div>
            )}
          />
        )}
        {fase === "festa" && (
          <ComemoracaoDoDia
            key="festa"
            n={n}
            missao={missao}
            modulo={modulo}
            rotulo={rotulo}
            hoje={hoje}
            aoCombinar={aoCombinar}
            aoAmanhaAgora={aoAmanhaAgora}
            aoVerFim={aoVerFim}
            braco={braco}
            modo={modo}
            aoBoraProxima={aoBoraProxima}
            aoAgoraNao={aoAgoraNao}
            aoFecharDia={aoFecharDia}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * A COMEMORAÇÃO DO DIA (D4): "Dia 1 da missão ✓ · Primeiro registro feito!",
 * o que ela fez já está no módulo + a explicação, a barra 1/3, e o de AMANHÃ
 * combinado com a hora do lembrete. "Combinado, até amanhã" fecha; "Quero
 * fazer o toque de amanhã agora" leva pro próximo módulo. No dia 3: "Ver o que
 * você construiu".
 */
export function ComemoracaoDoDia({ n, missao, modulo, rotulo, hoje, aoCombinar, aoAmanhaAgora, aoVerFim, braco, modo = "dose", aoBoraProxima, aoAgoraNao, aoFecharDia }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoAmanhaAgora: () => void; aoVerFim: () => void;
  braco?: BracoDoPasso; modo?: ModoDoPasso; aoBoraProxima?: () => void; aoAgoraNao?: () => void; aoFecharDia?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const cfg = MODULOS[modulo];
  const proximo = n === 1 ? MODULOS[missao.modulos[1]] : n === 2 ? MODULOS[missao.modulos[2]] : null;
  // 03/10: no app, o chip pré-marcado é o mais perto da hora em que ela abriu o app hoje
  // (é a hora que o Lembrete do dia 2 usaria sozinho); a escolha dela, se já houve, vence.
  const [hora, setHora] = useState<Lembrete>(missao.lembrete ?? horaSugeridaDaMissao());
  const B = braco === "B";
  const titulo = modo === "aprofundar" ? `Dia ${diaDaMissao(missao, hoje)} aprofundado!`
    : B ? (n === 1 ? "Primeira dose feita!" : n === 2 ? "Segunda dose feita!" : "Terceira dose feita!")
    : n === 1 ? "Primeiro registro feito!" : n === 2 ? "Dia 2 feito!" : "Missão cumprida!";

  /* 1.0.16 — BRAÇO A ("uma dose por dia", desenho 8 seção 4.2): comemoração PEQUENA nos dias 1 e 2 (cartão
     de baixo, sem confete), com o adesivo do dia num aviso pequeno e o de amanhã TRANCADO; no dia 3, a ÚNICA
     festa em tela cheia do teste — o adesivo "3 dias seguidos" (ou "Missão completa", se pulou um dia). */
  if (braco === "A" && modo === "dose") {
    return <ComemoracaoUmPorDia n={n} missao={missao} modulo={modulo} rotulo={rotulo} hoje={hoje} aoCombinar={aoCombinar} aoVerFim={aoVerFim} aoFecharDia={aoFecharDia} />;
  }

  /* APROFUNDAR (B, dias 2–3): festa curta — o que ela fez já está no módulo; "Fechar". */
  if (modo === "aprofundar") {
    return createPortal(
      <motion.div className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center px-4 pb-6 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.55)" }} data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-modo="aprofundar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <motion.div initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }} className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 text-center text-[#16121c] shadow-2xl">
          <span className="inline-block rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5">🔥 Dia {diaDaMissao(missao, hoje)} · {cfg.emoji} {cfg.nome} ✓</span>
          <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-2.5">{titulo}</p>
          <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
            {cfg.emoji} <b className="text-[#16121c]">{rotulo}</b> já está {cfg.onde}. Um uso de verdade por dia é o que faz o hábito pegar.
          </p>
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-fechar-dia" onClick={aoFecharDia}>Fechar</button>
        </motion.div>
      </motion.div>,
      document.body,
    );
  }

  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center px-4 pb-6 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.55)" }} data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <Confete />
      <motion.div
        initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
        className="relative w-full max-w-[340px] rounded-3xl bg-white p-5 text-center text-[#16121c] shadow-2xl"
      >
        <span className="inline-block rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3.5 py-1.5">{B ? `🔥 Dose ${n} de ${TOTAL_PASSOS_B} ✓` : `🔥 Dia ${n} da missão ✓`}</span>
        <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-2.5">{titulo}</p>
        <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
          {cfg.emoji} <b className="text-[#16121c]">{rotulo}</b> já está {cfg.onde}. {cfg.olhar.texto}
        </p>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-3.5">
          <motion.div className="h-full rounded-full bg-emerald-500" initial={reduzir ? false : { width: `${Math.round(((n - 1) / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} animate={{ width: `${Math.round((n / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">{B ? `Missão de hoje · ${n} de ${TOTAL_PASSOS_B}` : `Missão dos 3 dias · ${n} de 3 toques`}</p>

        {/* BRAÇO B (DIA1_CHEIO): as 3 doses são de HOJE — a festa puxa a próxima (20 s), ou "Agora não" */}
        {B && proximo ? (
          <>
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-proxima-dose">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Próxima dose · {proximo.emoji} {proximo.nome}</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">{proximo.pedido}</span>
              <span className="block text-[12px] text-[#4f5a64] mt-1">Uns 20 segundos. Depois a missão de hoje fica em {n + 1} de {TOTAL_PASSOS_B}.</span>
            </div>
            <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-bora-proxima" onClick={aoBoraProxima}>
              Bora a próxima? 20 s <ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" className="md-link" data-testid="missao-doses-agora-nao" onClick={aoAgoraNao}>Agora não</button>
          </>
        ) : B ? (
          <>
            {/* a 3ª dose feita: falta o 4º passo — arrumar a Home (o tour, 5 toques) */}
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-falta-home">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Falta 1 · 🏡 Sua Home</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">Falta 1: arrumar sua Home</span>
              <span className="block text-[12px] text-[#4f5a64] mt-1">5 toques e ela fica do seu jeito — e a missão de hoje fecha.</span>
            </div>
            <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-fechar-dia" onClick={aoFecharDia}>
              Arrumar minha Home <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : proximo ? (
          <>
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-amanha">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Amanhã · {proximo.emoji} {proximo.nome}</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">{proximo.pedido}</span>
              <span className="block text-[12px] text-[#4f5a64] mt-1.5">Te lembro às:</span>
              <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label="Hora do lembrete">
                {HORAS_DO_LEMBRETE.map((h) => (
                  <button key={h.id} type="button" role="radio" aria-checked={hora === h.id} className="md-hora" data-marcada={hora === h.id ? "" : undefined} data-sem={h.id === "sem" ? "" : undefined} data-testid={`missao-doses-hora-${h.id}`} onClick={() => setHora(h.id)}>{h.rotulo}</button>
                ))}
              </div>
            </div>
            <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-combinado" data-hora={hora} onClick={() => aoCombinar(hora)}>
              {hora === "sem" ? "Combinado, até amanhã" : `Combinado, me lembra às ${hora}`}
            </button>
            {/* 1.0.16, braço A (uma dose por dia): sem adiantar — o de amanhã é amanhã (é o que o teste mede) */}
            {braco !== "A" && <button type="button" className="md-link" data-testid="missao-doses-amanha-agora" onClick={aoAmanhaAgora}>Quero fazer o toque de amanhã agora</button>}
          </>
        ) : (
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={aoVerFim}>
            Ver o que você construiu <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** O adesivo que a dose n do braço A dá (só dado/evento — a tela de Conquistas mora em outro lugar). */
export const adesivoDaDose = (n: DiaDaMissao, seguidos: number): { id: string; nome: string } =>
  n === 3 && seguidos >= 3 ? { id: "missao_3_seguidos", nome: "3 dias seguidos" } : { id: `missao_dia_${n}`, nome: `Dia ${n}` };

/** A sequência da missão contando a dose que acabou de sair (o estado pode ainda não ter gravado). */
const seguidosCom = (missao: EstadoMissaoDoses, n: DiaDaMissao, hoje: string, rotulo: string): number =>
  sequenciaDaMissao({ ...missao, feitos: { ...missao.feitos, [n]: missao.feitos[n] ?? { dia: hoje, rotulo } } }, hoje);

function ComemoracaoUmPorDia({ n, missao, modulo, rotulo, hoje, aoCombinar, aoVerFim, aoFecharDia }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoVerFim: () => void; aoFecharDia?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const cfg = MODULOS[modulo];
  const proximo = n === 1 ? MODULOS[missao.modulos[1]] : n === 2 ? MODULOS[missao.modulos[2]] : null;
  const seguidos = seguidosCom(missao, n, hoje, rotulo);
  const adesivo = adesivoDaDose(n, seguidos);
  const [hora, setHora] = useState<Lembrete>(missao.lembrete ?? horaSugeridaDaMissao());

  if (n === 3) {
    return createPortal(
      <motion.div className="fixed inset-0 z-[230] flex flex-col items-center justify-center px-6 text-center text-white" style={{ background: "linear-gradient(180deg,#2a1840 0%,#16121c 100%)", paddingTop: "var(--app-safe-top)" }} data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={3} data-braco="A" data-tela-cheia="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Confete />
        <motion.div initial={reduzir ? false : { scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
          className="w-40 h-40 rounded-[28px] grid place-items-center text-[64px] shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]" style={{ background: "#FFF4C2" }} data-testid="missao-doses-adesivo" data-adesivo={adesivo.id}>
          {adesivo.id === "missao_3_seguidos" ? "🔥" : "🏆"}
        </motion.div>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-white/60 mt-6">Adesivo novo</p>
        <p className="text-[30px] font-black tracking-[-0.02em] leading-tight mt-1">{adesivo.id === "missao_3_seguidos" ? "3 dias seguidos!" : "Missão completa!"}</p>
        <p className="text-[14px] text-white/80 leading-snug mt-2 max-w-[320px]" data-testid="missao-doses-festa-texto">
          {cfg.emoji} <b className="text-white">{rotulo}</b> já está {cfg.onde}. {adesivo.id === "missao_3_seguidos" ? "Você usou o CORE 3 dias seguidos — é isso que faz o hábito pegar." : "Os 3 passos estão feitos. A sequência recomeça a cada dia que você volta."}
        </p>
        <button type="button" className="md-botao mt-7 max-w-[320px]" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={aoVerFim}>
          Ver o que você construiu <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pb-6 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.45)" }} data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-braco="A" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div initial={reduzir ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative w-full max-w-[360px] rounded-3xl bg-white p-5 text-left text-[#16121c] shadow-2xl">
        <motion.div initial={reduzir ? false : { y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
          className="absolute -top-4 right-4 rounded-full bg-[#16121c] text-white text-[12px] font-extrabold px-3 py-1.5 shadow-lg" data-testid="missao-doses-adesivo" data-adesivo={adesivo.id}>
          🏷️ Adesivo · {adesivo.nome}
        </motion.div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((i) => <Quadradinho key={i} marcado={i <= n} tam={16} />)}
        </div>
        <p className="text-[22px] font-black tracking-[-0.02em] leading-tight mt-2">Dia {n} de 3 feito ✅</p>
        {n === 2 && seguidos >= 2 && <p className="text-[14px] font-extrabold mt-0.5" data-testid="missao-doses-sequencia">Sequência: {seguidos} dias 🔥</p>}
        <p className="text-[13.5px] text-[#4f5a64] leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
          {cfg.emoji} <b className="text-[#16121c]">{rotulo}</b> já está {cfg.onde}.
        </p>
        {proximo && (
          <div className="mt-3.5 rounded-2xl px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-amanha">
            <span className="block text-[13.5px] font-extrabold leading-snug">Amanhã: {proximo.emoji} {proximo.nome} · {DOSE_CURTA[proximo.modulo].seg} s</span>
            <span className="block text-[12px] text-[#4f5a64] mt-0.5">{n === 1 ? "e o adesivo do dia 2 🔒" : "e o adesivo 3 dias seguidos é seu 🔒"}</span>
            {n === 2 && (
              <>
                <span className="block text-[12px] text-[#4f5a64] mt-2">Te lembro às:</span>
                <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label="Hora do lembrete">
                  {HORAS_DO_LEMBRETE.map((h) => (
                    <button key={h.id} type="button" role="radio" aria-checked={hora === h.id} className="md-hora" data-marcada={hora === h.id ? "" : undefined} data-sem={h.id === "sem" ? "" : undefined} data-testid={`missao-doses-hora-${h.id}`} onClick={() => setHora(h.id)}>{h.rotulo}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {n === 2 ? (
          <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-combinado" data-hora={hora} onClick={() => aoCombinar(hora)}>
            {hora === "sem" ? "Combinado, até amanhã" : `Combinado, me lembra às ${hora}`}
          </button>
        ) : (
          <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-continuar" onClick={aoFecharDia}>
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
