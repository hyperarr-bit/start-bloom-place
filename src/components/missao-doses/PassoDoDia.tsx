import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { MontarFinancas, deveMostrarMontarFinancas, ATRIBUTO_NA_TELA as ATRIBUTO_MONTAR_NA_TELA, EVENTO_MONTAR_FINANCAS_FIM, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import { MODELOS as MODELOS_DE_TREINO, aplicarModelo } from "@/lib/treino-plano";
import { trackEvent } from "@/lib/analytics";
import { marcarCartoesVistos } from "@/lib/tour-home";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { Anel, BotaoSeguir, Confete, ContaSubindo, PostItDaMissao, alturaVisivel, fundoDoTopoFixo, topoPreferidoDoAnel } from "@/components/demo-guiada/pecas";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { CHIPS_DE_HABITO, PERGUNTA_HABITO_MARCAR, PERGUNTA_HABITO_VAZIO, alvoDaMissao, cardMeuMes, gravacoesDoChip, lerReais, itemDoChip, linhaDeHoje, linhaDoNovoHabito, nomesDosHabitos, type AlvoDaMissao, type ChipDaMissao, type Numero, type Retangulo } from "@/components/demo-guiada/alvos";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { reais, rotuloCurto } from "@/lib/demo-guiada";
import { localDayKey } from "@/lib/utils";
import { doseCurta, HORAS_DO_LEMBRETE, MAX_VISTAS_DO_SETUP, MODULOS, TOTAL_PASSOS_B, diaDaMissao, eventoDaMissao, marcarDoseNaTela, msDesdePrimeiraVista, registrarMontagem, setupDaDose, tomarComecar, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao, type SetupDaDose } from "@/lib/missao-doses";
import { introConcluida } from "@/lib/intro-modulo";
import { lerTelaDoNumero } from "@/lib/montar-financas";
import { CONHECER_MAIS, SETUPS_ENCAIXADOS, metaGuiadaDaIntro } from "./encaixes";
import { horaSugeridaDaMissao, porDiaExato } from "@/lib/lembrete-dia2";
import { useConquistas, useSequencia } from "@/components/conquistas/use-conquistas";
import { AdesivoRaro } from "@/components/conquistas/adesivos-raridade";
import { temArte } from "@/components/conquistas/adesivos-arte";
import { Fogo } from "@/components/conquistas/Fogo";
import { ArteDoAdesivo, useAdesivoDaDose, type AdesivoDaDose } from "./adesivo-da-dose";
import "./missao-doses.css";

/** 17/10 (relatório 11, D2) — a copy do 1º gasto. */
export const PERGUNTA_DO_GASTO = "Já gastou com alguma coisa hoje?";
export const DESCRICAO_DO_GASTO = "Toca num e ele já entra ali embaixo, em CUSTOS VARIÁVEIS. Dá pra mudar depois.";
export const AINDA_NAO_GASTEI = "Ainda não gastei nada hoje →";
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
export type ViaDoPulo = "link_boas_vindas" | "faixa_20s" | "toque_fora" | "passo" | "ainda_nao";

const visivel = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8; };

/* 17/10 (relatório 11, D2/B7): o anel do 1º gasto abraça o card CUSTOS VARIÁVEIS do TÍTULO até a linha do campo — o
 * formulário de CUSTOS FIXOS, igualzinho ("+ / Valor / Dia"), fica fora do anel (e embaixo do post-it). */
const cardDoNovoGasto = (botao: Element): Element | null => botao.parentElement?.closest(".rounded-lg, .rounded-xl, .rounded-2xl") ?? null;
const recorteDoNovoGasto = (card: Element): Retangulo | null => {
  const r = card.getBoundingClientRect();
  const botao = card.querySelector('[data-spotlight="add-expense"]');
  const linha = botao?.parentElement?.querySelector("input") ? botao.parentElement : botao;
  const fim = linha ? linha.getBoundingClientRect().bottom + 8 : r.top + 120;
  return { top: r.top, left: r.left, width: r.width, height: Math.max(24, fim - r.top), bottom: fim };
};
/** A aba ativa do módulo (os botões de aba levam `data-active` e `data-spotlight`), pros eventos. */
const abaAtiva = (): string | null => {
  try {
    const a = document.querySelector('[data-spotlight][data-active="true"]')?.getAttribute("data-spotlight") ?? null;
    return a ? a.replace(/^tab-/, "") : null;
  } catch { return null; }
};
/** Um botão de ABA do módulo (o DASHBOARD ao lado do MEU FINANCEIRO era tocável por baixo do escuro: 64 de 93 perdas). */
const botaoDeAba = (alvo: EventTarget | null): HTMLElement | null =>
  alvo instanceof Element ? (alvo.closest('[data-spotlight^="tab-"], [data-spotlight="financeiro"]') as HTMLElement | null) : null;

/* 10/10 (dono: "ficou muito rápido o MEU MÊS; deixa mais embaixo e lento pra o usuário ver") — a rolagem até o
 * card é ANIMADA à mão (rAF, ease-in-out, ~1 s): o `behavior: smooth` no WKWebView é curto/instantâneo e, quando o
 * scroller é um container (não o window), nem anima. O card para com o TOPO a ~55 % da altura visível — a metade
 * de baixo — pra o balão "Olha o seu mês" caber ACIMA dele sem tampar o cabeçalho nem os chips Entrou/Saiu. */
export const ROLAGEM_DO_OLHAR = { duracaoMs: 1000, fracaoDoTopo: 0.54, pausaMs: 500, numeroS: 1.5 };
/** O "olha" de Finanças é um movimento só, ≤ 4 s (dono, 17/10), contado de quando o anel APARECE: o número cai
 *  (1,5 s) → rola até o MEU MÊS (0,45 s; o anel desenha no 1º quadro estável, ~0,25 s) → o "Saiu" conta (1,6 s)
 *  ≈ 3,8 s. Sem renda, só o MEU MÊS (2 s). Cada número conta em 0,8 s (+ 0,1 s) e sobra mais de meio segundo pra ler. */
export const OLHA_DE_FINANCAS = { podeMs: 1450, rolagemMs: 400, mesMs: 1550, soMesMs: 2000, numeroS: 0.8, atrasoS: 0.1, pausaMs: 150, daTelaDoNumeroMs: 150 };
/** A fração da tela onde a rolagem deixa o topo do card pro anel nascer já no lugar dele (sem 2ª rolagem). */
const fracaoDoAnel = (el: Element, recorte?: ((e: Element) => Retangulo | null) | null): number => {
  try {
    const card = el.getBoundingClientRect();
    const r = (recorte ? recorte(el) : null) ?? card;
    const altura = window.visualViewport?.height ?? window.innerHeight;
    return Math.max(0.05, Math.min(0.9, (topoPreferidoDoAnel(r.height) - (r.top - card.top)) / altura));
  } catch { return ROLAGEM_DO_OLHAR.fracaoDoTopo; }
};
/** "R$ 1.267" / "R$ 1.267,50" — o formato do "Saiu" do MEU MÊS */
const reaisDoMes = (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Math.round(x * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
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

export function PassoDoDia({ missao, n, modulo, hoje, aoFeito, aoPular, aoCombinar, aoAmanhaAgora, aoVerFim, braco, modo = "dose", aoBoraProxima, aoAgoraNao, aoFecharDia, aoMostrarAdesivo, aoScoreAntes, retomarGasto = false, aoGastoGuiado, aoConhecerMais, aoSetup }: {
  missao: EstadoMissaoDoses;
  n: DiaDaMissao;
  modulo: ModuloDaMissao;
  hoje: string;
  aoFeito: (rotulo: string, segundos: number) => void;
  aoPular: (via: ViaDoPulo, passo: "toque" | "olhar", segundos: number, extra?: Record<string, unknown>) => void;
  aoCombinar: (lembrete: Lembrete) => void;
  aoAmanhaAgora: () => void;
  aoVerFim: () => void;
  braco?: BracoDoPasso;
  modo?: ModoDoPasso;
  /** braço B: a passagem pro próximo módulo — sozinha ao fim da barra ("auto") ou no "Ir agora" ("botao") */
  aoBoraProxima?: (via?: "auto" | "botao") => void;
  /** braço B: "Agora não" no meio das doses */
  aoAgoraNao?: () => void;
  /** braço B: a 3ª dose feita (ou um "aprofundar" feito) — fecha a festa */
  aoFecharDia?: () => void;
  /** 1.0.16, braço A: a comemoração mostrou estes adesivos (ids do registro) — a missão guarda */
  aoMostrarAdesivo?: (ids: string[]) => void;
  /** 1.0.16, braço A (dose 2+): o score do dia quando a dose abriu — a dica do dia 2 ("foi de X pra Y") */
  aoScoreAntes?: (score: number) => void;
  /** 1.0.16 (17/10): o app foi fechado DEPOIS do Montar e antes do 1º gasto — a dose volta direto no passo do gasto,
   *  com os chips prontos (o Montar nunca recomeça; a dose já está gravada) */
  retomarGasto?: boolean;
  /** o 1º gasto guiado depois do Montar ficou pendente ("pendente") ou terminou de qualquer jeito ("fim") — a
   *  missão guarda, pra retomar se o app for fechado no meio */
  aoGastoGuiado?: (estado: "pendente" | "fim") => void;
  /** "Conhecer mais do <módulo> (1 min)" na comemoração (opcional, nunca sozinho) — encaixes.ts → CONHECER_MAIS */
  aoConhecerMais?: () => void;
  /** o quiz encaixado da 1ª dose (Rotina, Treino) apareceu ("visto") ou foi pulado — a missão guarda (uma vez só) */
  aoSetup?: (setup: SetupDaDose, acao: "visto" | "pulou") => void;
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
  /* 1.0.16 (contrato com a introdução dos módulos): o módulo já foi apresentado — a introdução guiada (ramo
   * v1016-cartoes) fez a 1ª ação dele numa visita por curiosidade. A dose NÃO repete a 1ª ação: vira continuação
   * (Rotina: marca o hábito de hoje — o que ela criou; Saúde: mais 1 copo, sem a meta de novo; Finanças: o gasto
   * de hoje, sem o Montar). Nos DOIS braços (regra final do dono, 17/10: "toda outra dose é a guiada simples, ou a
   * continuação se a introdução daquele módulo já foi feita"); sem braço (chave desligada) é a 1.0.15. Lido uma
   * vez no mount. */
  const comBraco = braco === "A" || braco === "B";
  const [introFeita] = useState(() => { try { return comBraco && modo === "dose" && introConcluida(modulo, get); } catch { return false; } });
  const [semMetaAgua] = useState(() => cfg.tipo === "agua" && modo === "dose" && !introFeita && !(Number(get<unknown>("core-saude-water-goal", 0)) > 0));
  /** a dose continua o que ela já fez no módulo (a introdução, ou o hábito que já existe num dia 2+) */
  const [continuacao] = useState(() => comBraco && modo === "dose" && (introFeita || (cfg.tipo === "habito" && !semHabito && n > 1)));
  const [habitoDela] = useState(() => { const nomes = cfg.tipo === "habito" ? nomesDosHabitos(get<unknown>("rotina-habits", [])).filter(Boolean) : []; return nomes.length === 1 ? nomes[0] : null; });
  /* Treino: "escolhe um treino pronto" só pra quem ainda não tem plano — com plano (a introdução aplicou um modelo, ou
   * ela montou o dela), a dose é anotar 1 exercício de hoje (nunca um 2º modelo por cima). Lido no mount. */
  const [temPlanoDeTreino] = useState(() => {
    if (modulo !== "treino") return false;
    try { return Object.values((get<Record<string, { exercises?: unknown[] }>>("saude-workouts-v2", {}) ?? {}) as Record<string, { exercises?: unknown[] }>).some((d) => Array.isArray(d?.exercises) && d.exercises.length > 0); } catch { return false; }
  });
  const treinoPronto = modulo === "treino" && modo === "dose" && !temPlanoDeTreino;
  /** 17/10 (relatório 11): a dose de Finanças — anel no card inteiro, copy nova, "✎ outro", "Ainda não gastei nada hoje" */
  const doseDeGasto = cfg.tipo === "gasto" && modo === "dose" && comBraco; // sem braço (chave desligada): a 1.0.15, campo a campo
  const anelDe = (el: Element): Element => {
    if (doseDeGasto) { const card = cardDoNovoGasto(el); if (card && visivel(card)) return card; }
    return alvoCfg?.anel ? alvoCfg.anel(el) : el;
  };
  const getRef = useRef(get);
  getRef.current = get;
  /** B10: a montagem desta dose (1ª, 2ª…) — gravada na missão no mount */
  const montagemRef = useRef(1);
  /* 1.0.16 — O QUIZ DA 1ª DOSE (regra final do dono, 17/10; lib/missao-doses → setupDaDose): só a 1ª dose — a área
   * escolhida no funil — abre o "monte o seu módulo", nos dois braços; as outras doses nunca. FINANÇAS: o "Vamos
   * montar suas Finanças" (conta nova, Finanças vazia, chave ligada); "Pronto" = a dose (o número DELA já está no
   * módulo) e o 1º gasto vem guiado em seguida; "Pular" = segue pro 1º gasto pelo chip. Os quiz dos outros ramos
   * (Rotina, Treino, Metas) entram por encaixes.ts — sem eles, a dose guiada simples. Lido no mount. */
  const setup = setupDaDose(n, modulo, modo);
  const { user } = useAuth();
  const { isGuest } = useUserData();
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  const [montarAberto, setMontarAberto] = useState(() => {
    /* D1/B11 (ramo v1016-financas): o app fechou NA tela do número ("Você pode gastar hoje R$ X", já decidido) — o
     * Montar reabre nela, com os chips do 1º gasto (lib/montar-financas lerTelaDoNumero, hoje, nesta conta). A dose
     * já gravada não troca essa volta pelo passo do gasto. Sem a tela do número em aberto: o passo do gasto. */
    if (setup !== "montar-financas" || introFeita) return false;
    try {
      if (retomarGasto && !lerTelaDoNumero(criadoEm)) return false;
      return deveMostrarMontarFinancas({ criadoEm, get, isGuest: !!isGuest });
    } catch { return false; }
  });
  const encaixe = setup && setup !== "montar-financas" ? SETUPS_ENCAIXADOS[setup] ?? null : null;
  const [setupAberto, setSetupAberto] = useState(() => {
    if (!encaixe || !setup || introFeita) return false;
    // uma vez só: pulou = nunca mais; fechou o app no meio = volta no máximo 1 vez (a missão guarda, na conta também)
    if (missao.setupPulado?.[setup] || (missao.setupVistas?.[setup] ?? 0) >= MAX_VISTAS_DO_SETUP) return false;
    try { return encaixe.deveMostrar({ criadoEm, get, isGuest: !!isGuest }); } catch { return false; }
  });
  /** Metas: a 1ª dose é a meta guiada de 1 toque da introdução do módulo (a mesma pergunta e os mesmos chips) */
  const [metaGuiada] = useState(() => (setup === "meta-guiada" && !introFeita ? metaGuiadaDaIntro() : null));
  /** depois do "pronto" de um quiz encaixado: a frase do post-it no passo que conta como a dose */
  const [fraseDoSetup, setFraseDoSetup] = useState<string | null>(null);
  const fraseDoSetupRef = useRef(fraseDoSetup);
  fraseDoSetupRef.current = fraseDoSetup;
  /** depois do "pronto" de um quiz encaixado: o alvo que ele indicou (o 1º item), se indicou */
  const alvoDoSetup = (): Element | null => {
    if (!fraseDoSetupRef.current || !encaixe?.alvoDepoisDoPronto) return null;
    try { const el = encaixe.alvoDepoisDoPronto(); return el && visivel(el) ? el : null; } catch { return null; }
  };
  const setupNaTela = useRef(false);
  setupNaTela.current = montarAberto || setupAberto;
  /* Depois do "Pronto" do Montar a dose JÁ está feita (o número dela está no módulo). O 1º gasto pelo chip vem
   * em seguida como um extra OPCIONAL (~5 s, desenho 8 4.2 passo 3): "Agora não" e o "Pular" da faixa vão direto
   * pra comemoração (nunca contam como dose pulada), e a comemoração fala do número — o gasto entra de carona. */
  const [montarFeito, setMontarFeito] = useState(retomarGasto);
  const montarFeitoRef = useRef(retomarGasto);
  const rotuloDoMontar = useRef(retomarGasto ? (missao.feitos[n]?.rotulo ?? "") : "");
  const [gastoExtra, setGastoExtra] = useState<string | null>(null);
  /** quantos gastos de hoje o "gastoExtra" junta (a tela do número deixa anotar mais de um) */
  const [gastosNoExtra, setGastosNoExtra] = useState(1);
  const subPassoRef = useRef(subPasso);
  subPassoRef.current = subPasso;
  const chips: ChipDaMissao[] = fraseDoSetup ? [] : subPasso === "criar" ? CHIPS_DE_HABITO : subPasso === "marcar" ? [] : treinoPronto ? CHIPS_DE_TREINO : semMetaAgua ? CHIPS_DE_META_AGUA : metaGuiada ? metaGuiada.chips : (alvoCfg?.chips ?? []);
  const pergunta = fraseDoSetup ? fraseDoSetup : subPasso === "criar" ? PERGUNTA_HABITO_VAZIO : subPasso === "marcar" ? PERGUNTA_HABITO_MARCAR
    : metaGuiada ? metaGuiada.pergunta
    // 17/10 (relatório 11, D2): o 1º gasto pergunta do jeito que se fala, em qualquer caminho (depois do Montar, sem
    // ele, ou continuação) — "Toca num e ele já entra ali embaixo, em CUSTOS VARIÁVEIS"
    : doseDeGasto ? PERGUNTA_DO_GASTO
    : continuacao && cfg.tipo === "habito" ? "Já fez o seu hábito hoje?"
    : continuacao && cfg.tipo === "agua" ? "Mais 1 copo d'água hoje?"
    : continuacao && cfg.tipo === "exercicio" && !treinoPronto ? "Anota 1 exercício de hoje:"
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
  /** por que o anel do passo saiu (o evento de "voltou" conta) e quando */
  const motivoDaSaida = useRef<string | null>(null);
  const saiuEm = useRef<number | null>(null);
  const [tocado, setTocado] = useState<string | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [numero, setNumero] = useState<Numero | null>(null);
  const [olharEm, setOlharEm] = useState<Element | null>(null);
  const [pularVisivel, setPularVisivel] = useState(false);
  const toquesNaFaixa = useRef(0);
  const viaRef = useRef<"chip" | null>(null);
  const t0 = useRef(Date.now());
  const segundos = () => Math.round((Date.now() - t0.current) / 1000);

  // a página desce a altura da faixa enquanto o passo está na tela; `data-missao-dose` avisa quem precisa ficar
  // quieto (toast/popup de adesivo, cartões de boas-vindas do módulo) — da faixa até a comemoração fechar
  useEffect(() => {
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    const soltarDose = marcarDoseNaTela();
    if (modo === "dose" && comBraco) { try { montagemRef.current = registrarMontagem(n).montagem; } catch { /* noop */ } }
    const passagem = modo === "dose" ? tomarTransicao(modulo) : null;
    if (passagem) trackEvent("missao_doses_transicao", eventoDaMissao({ de: passagem.de, para: passagem.para, ms: passagem.ms, via: passagem.via, indice: n }));
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "view", ...(continuacao ? { continuacao: true, intro_feita: introFeita } : {}), ...(setup ? { setup, setup_aberto: montarAberto || setupAberto } : {}), ...(retomarGasto ? { retomada: "gasto_depois_do_montar" } : {}), ...(comBraco ? { montagem: montagemRef.current } : {}), ...(doseDeGasto ? { aba: abaAtiva() } : {}) }));
    if (montarAberto) trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "view" }));
    if (montarAberto || setupAberto) {
      const comecar = tomarComecar();
      if (comecar !== null) trackEvent("missao_doses_modulo_abriu", eventoDaMissao({ dia: n, modulo, ms_desde_comecar: comecar, tela: montarAberto ? "montar" : "setup" }));
    }
    if (setupAberto && setup) {
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "setup", setup, acao: "view" }));
      try { aoSetup?.(setup, "visto"); } catch { /* noop */ }
    }
    return () => { document.documentElement.removeAttribute("data-missao-doses-faixa"); soltarDose(); };
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
    if (fase !== "achar" || montarAberto || setupAberto) return;
    let vivo = true;
    let tentativas = 0;
    let tocouAba = false;
    const timers: number[] = [];
    const passos = alvoCfg?.passos ?? (cfg.seletor ? [{ seletor: cfg.seletor }] : []);
    let abriuCampo = false;
    const procurar = () => {
      if (!vivo || faseRef.current !== "achar") return;
      // o "Vamos montar suas Finanças" (da missão ou do módulo) ainda na tela: espera ele sair — sem gastar tentativa
      if (document.documentElement.hasAttribute(ATRIBUTO_MONTAR_NA_TELA) || (encaixe && document.documentElement.hasAttribute(encaixe.atributo))) { timers.push(window.setTimeout(procurar, 300)); return; }
      const [principal, ...reservas] = passos;
      const doSetup = alvoDoSetup();
      if (doSetup) { setAlvo(doSetup); setAnelVivo(true); setFase("anotar"); return; }
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
        setAlvo(anelDe(el));
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
  }, [fase, montarAberto, setupAberto]);

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
      // o quiz da 1ª dose grava os itens do módulo (as contas, os hábitos, o modelo de treino): criar nunca é a dose
      if (setupNaTela.current) continue;
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
          if (cfg.tipo === "gasto") valorDoGasto.current = typeof achado.item.valor === "number" && achado.item.valor > 0 ? achado.item.valor : null;
        } catch { continue; }
      } else {
        // sem tipo da demo: vale "entrou algo novo" (lista/objeto cresceu ou passou a existir)
        if (!significativo(valor) || tamanho(valor) <= tamanho(ant)) continue;
        rot = `${cfg.toque} anotado`;
        via = "modulo";
      }
      faseRef.current = "registrou";
      if (montarFeitoRef.current) {
        // o gasto de carona depois do Montar: a dose continua sendo o número dela (o rótulo do Montar fica)
        aoGastoGuiado?.("fim");
        setGastoExtra(rot);
        setRotulo(rotuloDoMontar.current);
        setNumero(null);
      } else {
        setRotulo(rot);
        setNumero(num);
      }
      setFase("registrou");
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: montarFeitoRef.current ? "gasto_extra" : "toque", acao: "feito", via, segundos: segundos(), ...(comBraco ? { montagem: montagemRef.current, ms_desde_primeiro_view: msDesdePrimeiraVista(n) } : {}) }));
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  /* O "QUANTO POSSO GASTAR HOJE" de ANTES do gasto (o número que o Montar acabou de mostrar, ou o da conta) — só na
   * dose de Finanças, com renda anotada. */
  const porDiaAntes = useRef<number | null>(null);
  /** o valor do gasto que entrou (chip ou digitado): é o que o "Saiu" do MEU MÊS somou */
  const valorDoGasto = useRef<number | null>(null);
  /** o "por dia" depois do gasto (a comemoração conta "agora dá R$ X por dia") */
  const [porDiaDepois, setPorDiaDepois] = useState<number | null>(null);
  /** O "OLHA" DE FINANÇAS (dono, 17/10: "no passo da missão não mostra o Meu Mês tipo o antigo?") — UM movimento
   *  contínuo, ≤ 4 s, que dá pra pular. Com renda, 2 tempos: "pode" = o QUANTO POSSO GASTAR HOJE caindo; "mes" = a
   *  rolagem pousa no MEU MÊS e o "Saiu" do mês conta (a batida do 1.0.14, com o mesmo ContaSubindo). Sem renda
   *  (pulou o Montar, ou Finanças é a 2ª/3ª dose — sem quiz), só o "mes". Nos dois braços. */
  const [tempoDoOlhar, setTempoDoOlhar] = useState<"pode" | "mes" | null>(null);
  const [doisTempos, setDoisTempos] = useState(false);
  /** D1 com "Ainda não gastei nada hoje" no Montar: o MEU MÊS mostra as contas do mês (sem o "Saiu" contando) */
  const [olhaSemGasto, setOlhaSemGasto] = useState(false);
  /** D1: o 1º gasto (ou o "ainda não") veio da tela do número — o ✓ já apareceu lá; o MEU MÊS entra logo */
  const daTelaDoNumero = useRef(false);
  const tempoDoOlharRef = useRef(tempoDoOlhar);
  tempoDoOlharRef.current = tempoDoOlhar;
  const indoProMes = useRef(false);
  useEffect(() => {
    if (cfg.tipo !== "gasto" || modo !== "dose" || montarAberto || porDiaAntes.current !== null) return;
    if (fase !== "achar" && fase !== "anotar") return;
    try { const v = porDiaExato(get); if (v !== null) porDiaAntes.current = Math.round(v); } catch { /* sem número: só o MEU MÊS */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, montarAberto]);

  /** 1º tempo: o card mora no DASHBOARD (no painel limpo, o 1º bloco) — troca de aba, espera ele montar e acende ele
   *  com o número antes → depois (o "depois" é o que o card mostra). */
  const olharNoPodeGastar = (timers: number[]) => {
    const lerNumero = (): number | null => {
      const t = document.querySelector('[data-spotlight="pode-gastar"] [data-testid="pode-gastar-valor"]')?.textContent ?? "";
      const n = Number(t.replace(/[^\d]/g, ""));
      return t && Number.isFinite(n) ? n : null;
    };
    const card = () => document.querySelector('[data-spotlight="pode-gastar"]');
    if (!card()) (document.querySelector('[data-spotlight="tab-dashboard"]') as HTMLElement | null)?.click();
    let tentativas = 0;
    const procurar = () => {
      if (faseRef.current !== "registrou") return;
      const el = card();
      if (!el || !visivel(el)) {
        if (++tentativas >= 12) { olharNoMeuMes(timers); return; } // o card não veio (~3 s): fica só o MEU MÊS
        timers.push(window.setTimeout(procurar, 250));
        return;
      }
      const antes = porDiaAntes.current ?? 0;
      let depois = lerNumero();
      if (depois === null) { try { const v = porDiaExato(get); depois = v === null ? 0 : Math.round(v); } catch { depois = antes; } }
      setNumero({ titulo: "Por dia", antes, depois, formatar: (x) => `R$ ${reais(Math.round(x))}` });
      setPorDiaDepois(depois);
      setDoisTempos(true);
      const mostrar = () => {
        if (faseRef.current !== "registrou") return;
        setOlharEm(el);
        setTempoDoOlhar("pode");
        setFase("olhar");
        trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view", alvo: "pode_gastar", caiu: depois < antes })); // sem valor em reais
      };
      try {
        rolarAte(el, fracaoDoAnel(el), reduzir ? 0 : ROLAGEM_DO_OLHAR.duracaoMs, () => {
          if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, ROLAGEM_DO_OLHAR.pausaMs));
        });
      } catch { mostrar(); }
    };
    timers.push(window.setTimeout(procurar, 250));
  };

  /** O "Saiu" do MEU MÊS (já com o gasto) → antes = ele − o gasto. */
  const numeroDoMes = (card: Element): Numero | null => {
    const chip = Array.from(card.querySelectorAll("span")).find((sp) => /^\s*↓?\s*Saiu\b/.test(sp.textContent ?? ""));
    const saiu = chip ? lerReais(chip.textContent) : null;
    if (saiu === null || !(saiu > 0) || !valorDoGasto.current) return null;
    return { titulo: "Saiu no mês", antes: Math.max(0, saiu - (valorDoGasto.current ?? 0)), depois: saiu, formatar: reaisDoMes };
  };
  /** O MEU MÊS na tela: no painel limpo ele mora no DASHBOARD; no de sempre, na aba MEU FINANCEIRO — troca de aba se
   *  precisar e espera ele montar (~2 s); não veio → `null`. */
  const acharMeuMes = (timers: number[], aoAchar: (card: Element | null) => void) => {
    const abas = ['[data-spotlight="tab-dashboard"]', '[data-spotlight="financeiro"]'];
    let tentativas = 0;
    const procurar = () => {
      const f = faseRef.current;
      if (f !== "olhar" && f !== "registrou") return;
      const card = cardMeuMes();
      if (card && visivel(card)) { aoAchar(card); return; }
      if (tentativas === 0 || tentativas === 5) (document.querySelector(abas[tentativas === 0 ? 0 : 1]) as HTMLElement | null)?.click();
      if (++tentativas >= 10) { aoAchar(null); return; }
      timers.push(window.setTimeout(procurar, 200));
    };
    procurar();
  };
  /** Só o MEU MÊS (sem renda) — o "olha" de 1 tempo. */
  const olharNoMeuMes = (timers: number[]) => {
    acharMeuMes(timers, (card) => {
      if (faseRef.current !== "registrou") return;
      if (!card) { setFase("festa"); return; }
      const num = numeroDoMes(card);
      setNumero(num);
      const mostrar = () => {
        if (faseRef.current !== "registrou") return;
        setOlharEm(card);
        setTempoDoOlhar("mes");
        setFase("olhar");
        trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view", alvo: "meu_mes", contou: !!num }));
      };
      // (17/10) o "olha" de Finanças é UM movimento ≤ 4 s desde o toque: rolagem curta (0,4 s) e respiro curto (0,15 s)
      try {
        rolarAte(card, fracaoDoAnel(card, alvoCfg?.olhar?.recorte), reduzir ? 0 : OLHA_DE_FINANCAS.rolagemMs, () => {
          if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, OLHA_DE_FINANCAS.pausaMs));
        });
      } catch { mostrar(); }
    });
  };
  /** 2º tempo: do número pro MEU MÊS — a rolagem pousa nele e o "Saiu" conta. Uma vez só (o relógio e o
   *  "Entendi" podem chegar juntos). */
  const timersDoMes = useRef<number[]>([]);
  useEffect(() => () => timersDoMes.current.forEach((t) => window.clearTimeout(t)), []);
  const irProMeuMes = useCallback(() => {
    if (faseRef.current !== "olhar" || indoProMes.current) return;
    indoProMes.current = true;
    // o anel do número sai ANTES da rolagem (e de qualquer troca de aba: a âncora dele sumiria e o anel fecharia o olha)
    setOlharEm(null);
    acharMeuMes(timersDoMes.current, (card) => {
      if (faseRef.current !== "olhar") return;
      if (!card) { setFase("festa"); return; }
      const num = numeroDoMes(card);
      const pousar = () => { if (faseRef.current !== "olhar") return; setNumero(num); setOlharEm(card); setTempoDoOlhar("mes"); };
      try { rolarAte(card, fracaoDoAnel(card, alvoCfg?.olhar?.recorte), reduzir ? 0 : OLHA_DE_FINANCAS.rolagemMs, pousar); } catch { pousar(); }
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view", alvo: "meu_mes", tempo: 2, contou: !!num }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, modulo, reduzir]);
  /* Cada tempo segura o número contar e um respiro, contado de quando o anel APARECE (o anel só desenha com a tela
   * assentada); no fim, a festa entra sozinha (dá pra pular antes). Se o anel não aparecer (teclado aberto, a tela
   * não assentou), o relógio começa mesmo assim em 2,5 s — o "olha" nunca prende a dose. */
  const [olhaNaTela, setOlhaNaTela] = useState<"pode" | "mes" | null>(null);
  useEffect(() => {
    if (fase !== "olhar" || !tempoDoOlhar || olhaNaTela === tempoDoOlhar) return;
    const t = window.setTimeout(() => setOlhaNaTela(tempoDoOlhar), 2500);
    return () => window.clearTimeout(t);
  }, [fase, tempoDoOlhar, olhaNaTela]);
  useEffect(() => {
    if (fase !== "olhar" || !olhaNaTela || olhaNaTela !== tempoDoOlhar) return;
    const t = window.setTimeout(() => {
      if (olhaNaTela === "pode") { irProMeuMes(); return; }
      if (faseRef.current !== "olhar") return;
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "feito", via: "auto" }));
      setFase("festa");
    }, olhaNaTela === "pode" ? OLHA_DE_FINANCAS.podeMs : doisTempos ? OLHA_DE_FINANCAS.mesMs : OLHA_DE_FINANCAS.soMesMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, olhaNaTela, tempoDoOlhar]);

  /* REGISTROU → o chip ficou ✓ e a linha apareceu; depois, o OLHAR (ou direto a festa). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      /* 1.0.16 (dono, 17/10 — os dois braços): a dose de Finanças termina OLHANDO o "QUANTO POSSO GASTAR HOJE"
       * mudar com o gasto que ela acabou de anotar. O card mora no DASHBOARD (no painel limpo, o 1º bloco): troca
       * de aba, espera ele montar e acende ele com o número antes → depois (o "depois" é o que o card mostra). Sem
       * renda (pulou o Montar, nada anotado) não há número: fica o "olhar" de sempre do MEU MÊS. */
      if (cfg.tipo === "gasto" && modo === "dose") {
        if (porDiaAntes.current !== null) olharNoPodeGastar(timers);
        else olharNoMeuMes(timers);
        return;
      }
      // 1.0.16, braço A: a dose é curta (10–30 s, desenho 8 4.0) — sem o "olhar explicado" da 1.0.10 nos outros módulos
      if (braco === "A" && modo === "dose") { setFase("festa"); return; }
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
    }, reduzir ? 150 : daTelaDoNumero.current ? OLHA_DE_FINANCAS.daTelaDoNumeroMs : TEMPOS_DO_PASSO.registrou));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const festaEm = useRef<number | null>(null);
  useEffect(() => {
    if (fase !== "festa") return;
    festaEm.current = Date.now();
    if (montarFeitoRef.current) aoGastoGuiado?.("fim");
    // a dose de Finanças foi a apresentação do módulo: os cartões de boas-vindas (chave da intro desligada) não
    // aparecem depois por cima — por qualquer caminho (Montar, gasto guiado, continuação)
    if (modulo === "financas" && modo === "dose") { try { marcarCartoesVistos("financas"); } catch { /* storage bloqueado */ } }
    aoFeito(rotulo, segundos());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* CHIPS — 1 toque grava NA CONTA pelo mesmo `set` do módulo, no formato que ele já lê (alvos.ts). */
  /** Onde o chip foi tocado (o post-it no anel, solto ou colado embaixo da faixa), quando e a que horas (relatório 11 §7). */
  const ondeDoChip = (): Record<string, unknown> => ({
    onde: !alvo ? "postit_solto" : anelFora ? "postit_doca" : "postit_anel",
    ms_desde_view: Date.now() - t0.current,
    hora_local: new Date().getHours(),
  });
  const tocarChip = (chip: ChipDaMissao) => {
    if (!cfg.tipo) return;
    // 1.0.16: Treino — o chip aplica o modelo pronto (plano + dias de treino), pelo formato da aba PLANO
    if (treinoPronto) {
      const modelo = MODELOS_DE_TREINO.find((m) => m.name === chip.nome);
      trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: chip.nome, ok: !!modelo, tipo: "treino_modelo", ...ondeDoChip() }));
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
    // (17/10: sem `valor` — nada de reais em evento, nem o do chip)
    trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: chip.nome, ok: !!item, ...ondeDoChip() }));
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
    // post-it solto (a âncora tinha sumido ou ela voltou do 2º plano): acha a linha do campo agora e devolve o anel
    let base: Element | null = alvo;
    if (!base) {
      base = reacharAlvo();
      if (base) { setPerdeuAlvo(false); setAlvo(base); setAcende((x) => x + 1); setAnelVivo(true); }
    }
    const campo = base?.querySelector<HTMLInputElement>("input, textarea");
    try { campo?.focus(); } catch { /* noop */ }
  };

  /* 16/10 (1.0.16 — o anel do passo 1 sumia antes do toque, `anel_saiu motivo=ancora_invisivel`): quando o
   * módulo redesenha e troca o nó, o anel RE-ACHA a âncora pelo mesmo caminho do "achar" — o botão/linha
   * de adicionar; no passo A da Rotina, a linha do campo; no B, a linha de HOJE da tabela (que se refaz
   * quando o hábito nasce). Lido na hora (subPassoRef), não no mount. */
  const reacharAlvo = useCallback((): Element | null => {
    const doSetup = alvoDoSetup();
    if (doSetup) return doSetup;
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
    return anelDe(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 1.0.16 (defeito 5 + dados das builds 38/40, 17/10: no "anota 1 gasto" o anel saía por âncora sumida 84×, app
   * em 2º plano 67× e tempo 36×): o post-it com os chips NUNCA some — sem âncora ele fica solto (os chips gravam
   * sozinhos) e o app segue procurando o alvo; achou, o anel volta sozinho (nada de depender do ⌖). Sem desistir:
   * a cada 750 ms no começo, depois a cada 2 s, enquanto o passo estiver na tela; voltar do 2º plano procura na hora. */
  const [voltouDoFundo, setVoltouDoFundo] = useState(0);
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible" && faseRef.current === "anotar") setVoltouDoFundo((x) => x + 1); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);
  useEffect(() => {
    if (fase !== "anotar" || alvo || montarAberto || setupAberto) return;
    let tentativas = 0;
    let t = 0;
    const tentar = () => {
      tentativas += 1;
      const el = reacharAlvo();
      if (el) {
        setPerdeuAlvo(false); setAlvo(el); setAcende((x) => x + 1); setAnelVivo(true);
        trackEvent("missao_doses_anel_voltou", eventoDaMissao({ dia: n, modulo, tentativas, ...(motivoDaSaida.current ? { motivo: motivoDaSaida.current } : {}), ...(saiuEm.current ? { ms_fora: Date.now() - saiuEm.current } : {}) }));
        saiuEm.current = null;
        motivoDaSaida.current = null;
        return;
      }
      t = window.setTimeout(tentar, tentativas < 40 ? 750 : 2000);
    };
    t = window.setTimeout(tentar, voltouDoFundo ? 0 : 750);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, alvo, montarAberto, setupAberto, subPasso, voltouDoFundo]);

  /* B8 (relatório 11: 64 de 93 perdas da âncora = ela tocou na aba DASHBOARD, ao lado, tocável por baixo do escuro):
   * no meio do passo, um toque numa ABA do módulo não troca de aba — o post-it chacoalha e diz "primeiro o gasto".
   * Só na fase do toque (o "achar" e o "olha" trocam de aba por código em outras fases). O "Pular" e a seta de voltar
   * seguem livres. */
  const [chacoalha, setChacoalha] = useState(0);
  const [avisoDeAba, setAvisoDeAba] = useState(false);
  useEffect(() => {
    if (fase !== "anotar") return;
    let t = 0;
    const aoClicar = (e: MouseEvent) => {
      const aba = botaoDeAba(e.target);
      if (!aba || aba.getAttribute("data-active") === "true") return;
      e.preventDefault();
      e.stopPropagation();
      setChacoalha((x) => x + 1);
      setAvisoDeAba(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setAvisoDeAba(false), 2600);
      trackEvent("missao_doses_aba", eventoDaMissao({ dia: n, modulo, de: abaAtiva(), para: (aba.getAttribute("data-spotlight") ?? "").replace(/^tab-/, ""), bloqueada: true, ms_desde_view: Date.now() - t0.current }));
    };
    document.addEventListener("click", aoClicar, true);
    return () => { document.removeEventListener("click", aoClicar, true); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /* D4 (relatório 11, B6): ela rolou e o alvo saiu da área visível — o anel recolhe (sem escuro) e o post-it fica
   * COLADO embaixo da faixa, só a pergunta e os chips (que gravam igual); o alvo voltou, o anel desenha de novo no
   * lugar (sem rolar a tela dela). Só depois de o anel ter aparecido (a rolagem dele até o alvo não conta). */
  const [anelFora, setAnelFora] = useState(false);
  const anelForaRef = useRef(false);
  const anelApareceu = useRef(false);
  /** só uma rolagem DEPOIS de o anel aparecer recolhe ele (a rolagem dele até o alvo, e redesenho sem rolar, não) */
  const rolouDesdeOAnel = useRef(false);
  const foraDesde = useRef<number | null>(null);
  const fecharFora = () => {
    if (foraDesde.current === null) return;
    const ms = Date.now() - foraDesde.current;
    foraDesde.current = null;
    if (ms > 2000) trackEvent("missao_doses_postit_fora", eventoDaMissao({ dia: n, modulo, ms_fora: ms, scroll_y: Math.round(window.scrollY) }));
  };
  useEffect(() => {
    if (fase !== "anotar" || !alvo || !anelVivo) {
      if (anelForaRef.current) { anelForaRef.current = false; setAnelFora(false); fecharFora(); }
      return;
    }
    const medir = () => {
      if (!anelApareceu.current || !alvo.isConnected) return;
      if (!anelForaRef.current && !rolouDesdeOAnel.current) return;
      const r = (doseDeGasto ? recorteDoNovoGasto(alvo) : null) ?? alvo.getBoundingClientRect();
      const fora = r.bottom < fundoDoTopoFixo() + 24 || r.top > alturaVisivel() - 24;
      if (fora === anelForaRef.current) return;
      anelForaRef.current = fora;
      if (fora) foraDesde.current = Date.now(); else fecharFora();
      setAnelFora(fora);
    };
    const aoRolar = () => { if (anelApareceu.current) rolouDesdeOAnel.current = true; medir(); };
    const t = window.setInterval(medir, 300);
    window.addEventListener("scroll", aoRolar, { passive: true, capture: true });
    window.addEventListener("resize", medir);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("scroll", aoRolar, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, alvo, anelVivo]);
  useEffect(() => () => fecharFora(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Os sinais das primeiras 48 h (relatório 11 §7, nunca valor em reais): o post-it apareceu (anel ou solto) e em
   * quanto tempo; o teclado abriu/fechou no passo; quanto o módulo levou do "Começar" até a 1ª tela da dose. */
  const postItVisto = useRef(false);
  const marcarPostItVisto = (ancora: "anel" | "solto") => {
    if (postItVisto.current) return;
    postItVisto.current = true;
    trackEvent("missao_doses_postit", eventoDaMissao({ dia: n, modulo, ancora, ms_desde_view: Date.now() - t0.current, aba: doseDeGasto ? abaAtiva() : null, montagem: montagemRef.current }));
    const comecar = tomarComecar();
    if (comecar !== null) trackEvent("missao_doses_modulo_abriu", eventoDaMissao({ dia: n, modulo, ms_desde_comecar: comecar, tela: "postit" }));
  };
  useEffect(() => {
    if (fase === "anotar" && !alvo && !montarAberto && !setupAberto) marcarPostItVisto("solto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, alvo, montarAberto, setupAberto]);
  useEffect(() => {
    if (fase !== "anotar") return;
    const ehCampo = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(el.tagName);
    let aberto = false;
    const mudou = (agora: boolean) => {
      if (agora === aberto) return;
      aberto = agora;
      trackEvent("missao_doses_teclado", eventoDaMissao({ dia: n, modulo, aberto, ms_desde_view: Date.now() - t0.current }));
    };
    const entrou = (e: FocusEvent) => { if (ehCampo(e.target)) mudou(true); };
    const saiu = () => window.setTimeout(() => mudou(ehCampo(document.activeElement)), 120);
    document.addEventListener("focusin", entrou);
    document.addEventListener("focusout", saiu);
    return () => { document.removeEventListener("focusin", entrou); document.removeEventListener("focusout", saiu); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  /** Depois do Montar, "Agora não" (ou o "Pular" da faixa) = a dose está feita, sem o gasto de carona. */
  const fecharSemGasto = (acao: "agora_nao" | "ainda_nao" = "agora_nao") => {
    if (faseRef.current !== "achar" && faseRef.current !== "anotar") return;
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "gasto_extra", acao, segundos: segundos(), montagem: montagemRef.current }));
    aoGastoGuiado?.("fim");
    faseRef.current = "festa";
    setAnelVivo(false);
    setFase("festa");
  };
  /** O que o "pular" leva junto pro evento (relatório 11 §7: fase, aba, post-it à vista, montagem). */
  const extrasDoPulo = (): Record<string, unknown> => (comBraco ? { fase: faseRef.current, aba: abaAtiva(), postit_visivel: faseRef.current === "anotar" ? true : null, montagem: montagemRef.current } : {});
  const pularPelaFaixa = () => {
    if (montarFeitoRef.current) { fecharSemGasto(); return; }
    aoPular("faixa_20s", faseRef.current === "olhar" ? "olhar" : "toque", segundos(), extrasDoPulo());
  };
  /* "Ainda não gastei nada hoje →" (D2): depois do Montar (ou na retomada) a dose JÁ está gravada — vai pra festa;
   * sem o Montar, ela não tem o que anotar hoje: a dose fica pra amanhã (o mesmo caminho do "Pular", medido à parte). */
  const aindaNaoGastei = () => {
    if (montarFeitoRef.current) { fecharSemGasto("ainda_nao"); return; }
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "ainda_nao", segundos: segundos(), montagem: montagemRef.current }));
    aoPular("ainda_nao", "toque", segundos(), extrasDoPulo());
  };
  const toqueNaFaixa = () => {
    toquesNaFaixa.current += 1;
    if (toquesNaFaixa.current >= 2) setPularVisivel(true);
  };
  const entendi = useCallback((via: "botao" | "auto") => {
    if (faseRef.current !== "olhar") return;
    // Finanças: o "Entendi" do 1º tempo (o número) adianta pro 2º (o MEU MÊS); o do 2º, pra festa
    if (via === "botao" && tempoDoOlharRef.current === "pode") { irProMeuMes(); return; }
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "feito", via }));
    setFase("festa");
  }, [n, modulo, irProMeuMes]);
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
      {/* 17/10 (relatório 11, B4): sem o ⌖ "mostrar onde" — 1 uso em 145 e remontava o anel no nó morto; o post-it
          nunca some (solto/colado embaixo da faixa) e o anel volta sozinho */}
      {pularVisivel && fase !== "festa" && !montarAberto && !setupAberto && (
        <button type="button" className="md-faixa-pular" data-testid="missao-doses-pular" onClick={(e) => { e.stopPropagation(); pularPelaFaixa(); }}>Pular</button>
      )}
    </div>
  );

  /* O post-it do passo. `compacto` = colado embaixo da faixa (o alvo fora da tela ou sumido): só a pergunta e os chips,
   * que gravam igual. Tocar numa ABA do módulo no meio do passo não troca de aba: o post-it chacoalha (B8). */
  /** Depois do "Rotina pronta" (sem a marca no guia da própria tela): onde fica o quadradinho, com o nome do 1º hábito */
  const fraseDoQuadradinhoDoSetup = (): string => {
    try {
      const primeiro = nomesDosHabitos(get<unknown>("rotina-habits", [])).filter(Boolean)[0];
      return primeiro ? `É o quadradinho de hoje, na coluna de ${primeiro}.` : "É o quadradinho da linha de HOJE.";
    } catch { return "É o quadradinho da linha de HOJE."; }
  };
  const postItDe = (compacto: boolean) => (
    <motion.div animate={chacoalha && !reduzir ? { x: chacoalha % 2 ? [0, -9, 9, -6, 6, -2, 0] : [0, 9, -9, 6, -6, 2, 0] } : undefined} transition={{ duration: 0.45 }}>
      <PostItDaMissao
        rotulo={avisoDeAba ? "Primeiro o gasto — depois é só explorar" : subPasso === "criar" ? "1 de 2 · criar" : subPasso === "marcar" ? "2 de 2 · marcar" : "Agora · 1 toque"}
        pergunta={pergunta}
        descricao={doseDeGasto ? DESCRICAO_DO_GASTO
          : metaGuiada ? metaGuiada.detalhe
          : fraseDoSetup && cfg.tipo === "habito" ? fraseDoQuadradinhoDoSetup()
          : semMetaAgua ? "Escolhe a sua meta — o 1º copo de hoje já entra junto."
          : continuacao && cfg.tipo === "habito" ? (habitoDela ? `“${habitoDela}”: toca no quadradinho da linha de HOJE.` : "Toca no quadradinho da linha de HOJE.")
          : continuacao && cfg.tipo === "agua" ? "Ele entra na sua meta de hoje."
          : subPasso === "criar" ? "Escolhe um ou escreve o seu, e toca em Adicionar."
          : subPasso === "marcar" ? "É a linha de HOJE, na coluna do hábito novo. Toca no quadradinho."
          : cfg.tipo === "habito" ? "Toca num quadradinho da linha de HOJE." : undefined}
        chips={chips}
        tocado={tocado}
        aoChip={tocarChip}
        aoEscrever={alvoCfg?.escrever ? escreverOMeu : undefined}
        rotuloEscrever={doseDeGasto ? "✎ outro" : undefined}
        dica={chips.length && alvoCfg?.escrever && !doseDeGasto ? "Ou escreve o seu ali no campo e toca no +." : undefined}
        secundaria={doseDeGasto ? { texto: AINDA_NAO_GASTEI, aoTocar: aindaNaoGastei, testid: "missao-doses-ainda-nao" } : undefined}
        compacto={compacto}
      />
    </motion.div>
  );
  const postIt = postItDe(false);

  /* 1.0.16 — a dose de Finanças = "Vamos montar suas Finanças" (folha fixa abaixo da faixa da missão) */
  const montarPronto = (r: ResumoMontar) => {
    const rot = r.semFolga || !(r.porDia > 0) ? `Renda e ${r.contas} ${r.contas === 1 ? "conta" : "contas"} do mês` : `Pode gastar R$ ${reais(Math.floor(r.porDia))} por dia`;
    /* D1 (relatório 11; ramo v1016-financas): o 1º gasto pode vir JÁ na tela do número ("Você pode gastar hoje R$ X")
     * — `primeiroGasto` {nome} (tocou um chip ali) ou `null` ("Ainda não gastei nada hoje"). Com o campo, nada de anel:
     * direto pro MEU MÊS e a festa (a dose conta nos dois casos: o Montar gravou renda e contas). Sem o campo (o Montar
     * de antes), o 1º gasto guiado pelo anel, como sempre. */
    const comGasto = r as ResumoMontar & { primeiroGasto?: { nome: string; valor?: number } | null };
    const veioPrimeiroGasto = Object.prototype.hasOwnProperty.call(comGasto, "primeiroGasto");
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "feito", contas: r.contas, segundos: segundos(), ...(veioPrimeiroGasto ? { primeiro_gasto: comGasto.primeiroGasto ? "chip" : "nenhum" } : {}) }));
    // a tela substitui os cartões de Finanças (como no caminho do módulo, useMontarFinancasNoModulo.aoPronto)
    try { marcarCartoesVistos("financas"); } catch { /* storage bloqueado */ }
    rotuloDoMontar.current = rot;
    montarFeitoRef.current = true;
    // o número que o Montar acabou de mostrar É o do card (a mesma conta, arredondada igual): é o "antes" do olhar
    porDiaAntes.current = r.semFolga || !(r.porDia > 0) ? null : Math.round(r.porDia);
    setRotulo(rot);
    setNumero(null);
    setMontarFeito(true);
    if (veioPrimeiroGasto) {
      const g = comGasto.primeiroGasto ?? null;
      porDiaAntes.current = null; // o número já caiu na frente dela, na tela do Montar: o "olha" é só o MEU MÊS
      daTelaDoNumero.current = true;
      if (g) {
        // a tela do número deixa anotar mais de um: o "Saiu" do MEU MÊS conta a soma dos de HOJE (os que ela anotou ali)
        const deHoje = gastosDeHoje();
        const valor = deHoje.total > 0 ? deHoje.total : typeof g.valor === "number" && g.valor > 0 ? g.valor : valorDoGastoPeloNome(g.nome);
        valorDoGasto.current = valor;
        const nomes = deHoje.nomes.length ? deHoje.nomes : [g.nome];
        const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
        setGastoExtra(valor ? `${lista} · R$ ${reais(valor)}` : lista);
        setGastosNoExtra(nomes.length);
      } else {
        setOlhaSemGasto(true);
      }
      aoFeito(rot, segundos());
      aoGastoGuiado?.("fim");
      setMontarAberto(false);
      faseRef.current = "registrou";
      setFase("registrou");
      return;
    }
    // a dose conta JÁ (fechar o app no gasto de carona não pode desfazer o Montar); a comemoração chama de
    // novo no fim e a missão ignora a 2ª vez (o dia já está gravado)
    aoFeito(rot, segundos());
    // fechar o app daqui até o gasto: ao reabrir, a dose volta NO PASSO DO GASTO (nunca no Montar)
    aoGastoGuiado?.("pendente");
    // a dose está feita; o 1º gasto vem de carona (opcional): o "achar" volta a procurar o "+ Novo gasto"
    // assim que o Montar sair da tela (o atributo <html data-montar-financas> some no desmontar)
    setMontarAberto(false);
  };
  /** Os gastos variáveis de HOJE na conta (na tela do número, os que ela acabou de anotar): nomes e a soma. */
  const gastosDeHoje = (): { nomes: string[]; total: number } => {
    try {
      const dia = localDayKey();
      const lista = (getRef.current<Array<{ description?: unknown; value?: unknown; date?: unknown }>>("finance-expenses", []) ?? []).filter((e) => e && e.date === dia);
      return { nomes: lista.map((e) => String(e.description ?? "").trim()).filter(Boolean), total: lista.reduce((t, e) => t + (Number(e.value) || 0), 0) };
    } catch { return { nomes: [], total: 0 }; }
  };
  /** O valor do gasto que o Montar acabou de gravar (o mais novo com esse nome) — pro "Saiu" do MEU MÊS contar. */
  const valorDoGastoPeloNome = (nome: string): number | null => {
    try {
      const lista = (getRef.current<Array<{ description?: unknown; value?: unknown }>>("finance-expenses", []) ?? []);
      for (let i = lista.length - 1; i >= 0; i--) {
        if (String(lista[i]?.description ?? "").trim().toLowerCase() === nome.trim().toLowerCase()) { const v = Number(lista[i]?.value); return v > 0 ? v : null; }
      }
    } catch { /* noop */ }
    return null;
  };
  /* B11 (relatório 11): o Montar marca "decidido" na ENTRADA do "Montando" — fechar o app na tela do número perdia a
   * dose (ela só gravava no "Ver minhas Finanças"). Agora a dose grava ali mesmo (o mesmo rótulo do número, que é a
   * conta do card) e o 1º gasto fica pendente: reabrir volta no passo do gasto. */
  useEffect(() => {
    if (!montarAberto || !comBraco) return;
    let t = 0;
    const aoDecidir = (e: Event) => {
      const d = (e as CustomEvent<{ resultado?: string; contas?: number }>).detail;
      if (d?.resultado !== "pronto" || montarFeitoRef.current) return;
      t = window.setTimeout(() => {
        if (montarFeitoRef.current) return;
        let porDia: number | null = null;
        try { const v = porDiaExato(getRef.current); porDia = v === null ? null : Math.round(v); } catch { porDia = null; }
        const contas = d.contas ?? 0;
        const rot = porDia && porDia > 0 ? `Pode gastar R$ ${reais(porDia)} por dia` : `Renda e ${contas} ${contas === 1 ? "conta" : "contas"} do mês`;
        rotuloDoMontar.current = rot;
        aoFeito(rot, segundos());
        aoGastoGuiado?.("pendente");
        trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "decidiu", segundos: segundos() }));
      }, 300);
    };
    window.addEventListener(EVENTO_MONTAR_FINANCAS_FIM, aoDecidir);
    return () => { window.removeEventListener(EVENTO_MONTAR_FINANCAS_FIM, aoDecidir); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montarAberto]);
  const montarPulou = () => {
    setMontarAberto(false);
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "pulou", segundos: segundos() }));
  };
  /* O quiz encaixado de outro ramo (encaixes.ts): "pronto" = os itens dela já estão no módulo — o post-it diz a frase
   * do quiz e o anel vai pro 1º item (na Rotina, o quadradinho de HOJE: marcar o 1º É a dose); "pular" = a dose
   * guiada simples. */
  const setupPronto = (resumo?: unknown) => {
    if (!encaixe || !setup) return;
    // o que o quiz gravou (os hábitos, o modelo de treino) vira o "antes" do registro: criar nunca é a dose, nem
    // quando a gravação e o "pronto" chegam no mesmo toque
    try { anterior.current = Object.fromEntries(cfg.chaves.map((k) => [k, get<unknown>(k, undefined)])); } catch { /* noop */ }
    let rotuloDaDose: string | null = null;
    try { rotuloDaDose = encaixe.prontoEhADose?.(resumo) ?? null; } catch { rotuloDaDose = null; }
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "setup", setup, acao: "feito", segundos: segundos(), dose_no_pronto: !!rotuloDaDose }));
    setSetupAberto(false);
    if (rotuloDaDose) {
      /* o "pronto" JÁ É a dose (Rotina: marcou o 1º quadradinho no guia da própria tela; Treino: a semana montada) —
       * a comemoração entra direto, uma só (o registro do quiz foi ignorado enquanto ele estava na tela) */
      faseRef.current = "registrou";
      setRotulo(rotuloDaDose);
      setNumero(null);
      setFase("registrou");
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "feito", via: "setup", segundos: segundos(), ...(comBraco ? { montagem: montagemRef.current, ms_desde_primeiro_view: msDesdePrimeiraVista(n) } : {}) }));
      return;
    }
    setFraseDoSetup(encaixe.depoisDoPronto);
    if (cfg.tipo === "habito") setSubPasso("marcar");
  };
  const setupPulou = () => {
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "setup", setup, acao: "pulou", segundos: segundos() }));
    if (setup) { try { aoSetup?.(setup, "pulou"); } catch { /* noop */ } }
    setSetupAberto(false);
  };

  return (
    <>
      {createPortal(faixa, document.body)}
      {/* braço A, dose 2+: o score de ANTES da dose (a dica do dia 2 conta "foi de X pra Y") */}
      {braco === "A" && modo === "dose" && n >= 2 && missao.scoreAntes?.[n] === undefined && aoScoreAntes && <LerScoreDoDia aoLer={aoScoreAntes} />}
      {montarAberto && <MontarFinancas origem="missao" onPronto={montarPronto} onPular={montarPulou} />}
      {setupAberto && encaixe && <encaixe.Componente origem="missao" onPronto={setupPronto} onPular={setupPulou} />}
      {/* fora do AnimatePresence (um portal ali dentro era descartado: o post-it solto NUNCA montava) */}
      {!alvo && fase === "anotar" && !montarAberto && !setupAberto && createPortal(
          <motion.div key="postit-solto" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 64px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="missao-doses-postit-solto">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{doseDeGasto ? postItDe(true) : postIt}</div>
          </motion.div>,
          document.body,
        )}
      {/* D4: o alvo saiu da área visível — o post-it fica colado embaixo da faixa (o anel recolhido segue o alvo) */}
      {anelFora && anelVivo && alvo && fase === "anotar" && createPortal(
          <motion.div key="postit-doca" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 10px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="missao-doses-postit-doca">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{postItDe(true)}</div>
          </motion.div>,
          document.body,
        )}
      <AnimatePresence>
        {anelVivo && alvo && (fase === "anotar" || fase === "registrou") && (
          <Anel
            /* 10/10 (dono): toque FORA e rolagem NÃO fecham o post-it (`fixo`: o anel segue o alvo e o toque só
               clareia o escuro); só "Pular"/o tempo (60 s)/a âncora sumir soltam — e aí a faixa mostra ⌖ pra reabrir. */
            /* 17/10: sem tempo — o post-it do passo fica até o registro, o "Pular" ou o "Agora não" (36 saíam pelo
               tempo de 60 s e o passo ficava sem chips) */
            key={`anotar-${acende}`} fixo interativo duracao={null} alvo={alvo} reachar={reacharAlvo} testid="missao-doses-anel" abaixo={!!alvoCfg?.postItAbaixo}
            recorte={doseDeGasto ? recorteDoNovoGasto : fraseDoSetup && encaixe?.recorteDepoisDoPronto ? encaixe.recorteDepoisDoPronto : undefined} recolhido={anelFora}
            aoAparecer={() => { anelApareceu.current = true; rolouDesdeOAnel.current = false; marcarPostItVisto("anel"); }}
            aoSair={(motivo, info) => {
              setAnelVivo(false);
              anelApareceu.current = false;
              if (faseRef.current !== "anotar") return;
              setPerdeuAlvo(true);
              saiuEm.current = Date.now();
              // 1.0.16 (defeito 5) + 17/10: a âncora sumiu de vez, o app foi pro 2º plano (ela saiu pra ver o valor no
              // banco e voltou) ou o anel saiu por qualquer outro motivo — o post-it com os chips FICA na tela, solto
              // (os chips gravam sozinhos), e a procura acima traz o anel de volta sozinha
              motivoDaSaida.current = motivo;
              setAlvo(null);
              trackEvent("missao_doses_anel_saiu", eventoDaMissao({ dia: n, modulo, motivo, voltou: !!info?.voltou, ms: info?.ms ?? null, aba_na_saida: abaAtiva(), postit_visivel: true }));
            }}
            balao={postIt}
          />
        )}
        {fase === "olhar" && olharEm && (
          <Anel
            key={`olhar-${tempoDoOlhar ?? "unico"}`} fixo interativo alvo={olharEm} recorte={tempoDoOlhar === "pode" ? undefined : alvoCfg?.olhar?.recorte} duracao={TEMPOS_DO_PASSO.olhar} testid="missao-doses-anel-olhar"
            rapido={!!tempoDoOlhar} aoAparecer={tempoDoOlhar ? () => setOlhaNaTela(tempoDoOlhar) : undefined}
            aoSair={() => entendi("auto")}
            balao={(
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="missao-doses-olhar">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1" data-testid="missao-doses-olhar-tempo">{doisTempos ? `Olha · ${tempoDoOlhar === "mes" ? 2 : 1} de 2` : "Olha · 1 de 1"}</span>
                <span className="block text-[15px] font-extrabold leading-snug" data-testid="missao-doses-olhar-titulo">{tempoDoOlhar === "pode" ? "Quanto você pode gastar hoje" : tempoDoOlhar === "mes" && doisTempos ? "E o seu mês" : cfg.olhar.titulo}</span>
                <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{tempoDoOlhar === "pode" ? "Esse gasto já entrou na conta — e o número se ajusta sozinho a cada gasto que você anota." : tempoDoOlhar === "mes" && olhaSemGasto ? "Suas contas do mês já estão aqui. Cada gasto que você anotar entra no dia dele." : tempoDoOlhar === "mes" ? "O gasto entrou no dia de hoje e o “Saiu” do mês somou sozinho." : cfg.olhar.texto}</span>
                {numero && tempoDoOlhar === "pode" && numero.antes === numero.depois ? (
                  /* o gasto é pequeno perto do mês: o "por dia" arredondado nem mexe — mostra o que saiu, sem fingir */
                  <span className="block mt-2 text-[13px] text-white/80" data-testid="missao-doses-olhar-numero">
                    <b className="text-[22px] font-black tracking-tight text-white">{numero.formatar(numero.depois)}</b> por dia
                    {valorDoGasto.current ? <span className="block text-[12px] text-white/60 mt-0.5">Saíram R$ {reais(valorDoGasto.current)} do que sobra no mês.</span> : null}
                  </span>
                ) : numero && (
                  <span className="flex items-baseline gap-2 mt-2" data-testid="missao-doses-olhar-numero">
                    <span className="text-[12px] text-white/50">{numero.titulo}:</span>
                    <span className="text-[13px] text-white/50 line-through tabular-nums">{numero.formatar(numero.antes)}</span>
                    <span className="text-white/50 text-[13px]">→</span>
                    <span className="text-[22px] font-black tracking-tight leading-none"><ContaSubindo de={numero.antes} para={numero.depois} formatar={numero.formatar} duracao={tempoDoOlhar ? OLHA_DE_FINANCAS.numeroS : ROLAGEM_DO_OLHAR.numeroS} {...(tempoDoOlhar ? { atraso: OLHA_DE_FINANCAS.atrasoS } : {})} /></span>
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
            aoBoraProxima={(via) => {
              const para = n === 1 ? missao.modulos[1] : n === 2 ? missao.modulos[2] : null;
              if (para) guardarTransicao({ de: modulo, para, t0: festaEm.current ?? Date.now(), via: via ?? "botao" });
              aoBoraProxima?.(via);
            }}
            aoAgoraNao={aoAgoraNao}
            aoFecharDia={aoFecharDia}
            aoConhecerMais={aoConhecerMais}
            aoMostrarAdesivo={aoMostrarAdesivo}
            gastoExtra={gastoExtra}
            gastosNoExtra={gastosNoExtra}
            porDiaAgora={porDiaDepois}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** Lê o score do dia UMA vez (no instante em que a dose abre — ou em que a missão começa) e devolve pra missão. */
export function LerScoreDoDia({ aoLer }: { aoLer: (score: number) => void }) {
  const dados = useLifeHubData();
  const leu = useRef(false);
  useEffect(() => {
    if (leu.current) return;
    leu.current = true;
    const s = Number(dados.dayScore);
    if (Number.isFinite(s)) aoLer(Math.round(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * A COMEMORAÇÃO DO DIA (D4): "Dia 1 da missão ✓ · Primeiro registro feito!",
 * o que ela fez já está no módulo + a explicação, a barra 1/3, e o de AMANHÃ
 * combinado com a hora do lembrete. "Combinado, até amanhã" fecha; "Quero
 * fazer o toque de amanhã agora" leva pro próximo módulo. No dia 3: "Ver o que
 * você construiu".
 */
export function ComemoracaoDoDia({ n, missao, modulo, rotulo, hoje, aoCombinar, aoAmanhaAgora, aoVerFim, braco, modo = "dose", aoBoraProxima, aoAgoraNao, aoFecharDia, aoMostrarAdesivo, gastoExtra, gastosNoExtra = 1, porDiaAgora, aoConhecerMais }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoAmanhaAgora: () => void; aoVerFim: () => void;
  braco?: BracoDoPasso; modo?: ModoDoPasso; aoBoraProxima?: (via?: "auto" | "botao") => void; aoAgoraNao?: () => void; aoFecharDia?: () => void;
  /** braço A: os ids dos adesivos que esta comemoração mostrou */
  aoMostrarAdesivo?: (ids: string[]) => void;
  /** braço A, Finanças: o gasto que entrou de carona depois do Montar ("Café · R$ 12") */
  gastoExtra?: string | null;
  /** quantos gastos o `gastoExtra` junta ("os gastos de hoje") */
  gastosNoExtra?: number;
  /** Finanças: o "por dia" que o card mostrou no "olha" (já com o gasto de hoje) */
  porDiaAgora?: number | null;
  /** o link quieto "Conhecer mais do <módulo> (1 min)" (encaixes.ts) */
  aoConhecerMais?: () => void;
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

  /* 1.0.16 — BRAÇO A ("uma dose por dia", desenho 8 seção 4.2/4.4): comemoração PEQUENA (folha de baixo,
     sem confete) com o adesivo REAL que a dose abriu e o de amanhã TRANCADO; a ÚNICA festa em tela cheia do
     teste é a do adesivo "3 dias seguidos" (adesivo-da-dose.tsx). */
  if (braco === "A" && modo === "dose") {
    return <ComemoracaoUmPorDia n={n} missao={missao} modulo={modulo} rotulo={rotulo} hoje={hoje} aoCombinar={aoCombinar} aoVerFim={aoVerFim} aoFecharDia={aoFecharDia} aoMostrarAdesivo={aoMostrarAdesivo} gastoExtra={gastoExtra} gastosNoExtra={gastosNoExtra} porDiaAgora={porDiaAgora} aoConhecerMais={aoConhecerMais} />;
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
          {/* 1.0.16: a dose de Finanças virou o Montar (nos dois braços) — o texto do "olhar" fala de um gasto que talvez não exista */}
          {modulo === "financas" && /^(Pode gastar|Renda e )/.test(rotulo)
            ? <>{cfg.emoji} {fraseDoFeito(modulo, rotulo, porDiaAgora)}</>
            : <>{cfg.emoji} <b className="text-[#16121c]">{rotulo}</b> já está {cfg.onde}. {cfg.olhar.texto}</>}
        </p>
        {/* o 1º gasto depois do Montar (na tela do número ou de carona) — nos dois braços */}
        {gastoExtra && <p className="text-[12.5px] text-[#4f5a64] leading-snug mt-1" data-testid="missao-doses-gasto-extra">{fraseDoGastoExtra(gastoExtra, gastosNoExtra)}</p>}
        <div className="h-2 rounded-full bg-black/10 overflow-hidden mt-3.5">
          <motion.div className="h-full rounded-full bg-emerald-500" initial={reduzir ? false : { width: `${Math.round(((n - 1) / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} animate={{ width: `${Math.round((n / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-[11px] text-black/50 mt-1.5 font-semibold">{B ? `Missão de hoje · ${n} de ${TOTAL_PASSOS_B}` : `Missão dos 3 dias · ${n} de 3 toques`}</p>

        {/* BRAÇO B (DIA1_CHEIO): as 3 doses são de HOJE — a festa LEVA pra próxima sozinha (17/10: 22% e 18% se
            perdiam entre um módulo e outro); "Ir agora" adianta, "Agora não" para */}
        {B && proximo ? (
          <>
            <PassagemDaProxima proximo={proximo} n={n} reduzir={reduzir} aoIr={(via) => aoBoraProxima?.(via)} aoAgoraNao={aoAgoraNao} />
            {/* o link quieto também aqui (dono, 17/10: "no fim da comemoração de cada dose"); tocar fecha a festa — e a
                passagem junto (o tempo dela morre com ela) — e abre o passeio do módulo */}
            <LinkConhecerMais modulo={modulo} aoConhecerMais={aoConhecerMais} />
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
            <LinkConhecerMais modulo={modulo} aoConhecerMais={aoConhecerMais} />
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

/**
 * A PASSAGEM PRO PRÓXIMO MÓDULO NO BRAÇO B (dados das builds 38/40, 17/10: de quem terminou Finanças só 78% viram a
 * Rotina; de quem terminou a Rotina, 82% viram a Saúde — dentro de cada passo, 89–97% terminam). A festa não pede
 * mais pra ela achar o caminho: mostra "Agora a Rotina — 20 s" com uma barra e vai sozinha ao fim dela; "Ir agora"
 * adianta e "Agora não" para (o de sempre: a próxima volta em 3 h). Evento `missao_doses_transicao` {de, para, ms,
 * via} quando a próxima dose aparece de verdade (ms = da festa até ela).
 */
export const PASSAGEM_B_MS = 3500;
const ARTIGO: Partial<Record<ModuloDaMissao, string>> = {
  financas: "as", rotina: "a", saude: "a", treino: "o", dieta: "a", desenvolvimento: "as", hiperfoco: "o", estudos: "os",
  carreira: "a", biblioteca: "a", casa: "a", beleza: "a", viagens: "as", relacionamentos: "as", pet: "o", detox: "o",
};
export const agoraO = (modulo: ModuloDaMissao): string => `Agora ${ARTIGO[modulo] ?? "o"} ${MODULOS[modulo].nome}`;
function PassagemDaProxima({ proximo, n, reduzir, aoIr, aoAgoraNao }: { proximo: (typeof MODULOS)[ModuloDaMissao]; n: DiaDaMissao; reduzir: boolean; aoIr: (via: "auto" | "botao") => void; aoAgoraNao?: () => void }) {
  const foi = useRef(false);
  const ir = (via: "auto" | "botao") => { if (foi.current) return; foi.current = true; aoIr(via); };
  useEffect(() => {
    const t = window.setTimeout(() => ir("auto"), PASSAGEM_B_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div className="mt-3.5 rounded-2xl text-left px-4 py-3" style={{ background: "#FFF8D6" }} data-testid="missao-doses-proxima-dose" data-passagem="auto">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#8a4b12" }}>Dose {n + 1} de {TOTAL_PASSOS_B} · {proximo.emoji} {proximo.nome}</span>
        <span className="block text-[16px] font-extrabold leading-snug mt-0.5" data-testid="missao-doses-agora-o">{agoraO(proximo.modulo)} — 20 s</span>
        <span className="block text-[12.5px] text-[#4f5a64] mt-1">{proximo.pedido}.</span>
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mt-2.5" aria-hidden>
          <motion.div className="h-full rounded-full" style={{ background: "hsl(var(--accent))" }} initial={{ width: reduzir ? "100%" : "0%" }} animate={{ width: "100%" }} transition={{ duration: reduzir ? 0 : PASSAGEM_B_MS / 1000, ease: "linear" }} />
        </div>
      </div>
      <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-bora-proxima" onClick={() => ir("botao")}>
        Ir agora <ArrowRight className="w-4 h-4" />
      </button>
      <button type="button" className="md-link" data-testid="missao-doses-agora-nao" onClick={() => { foi.current = true; aoAgoraNao?.(); }}>Agora não</button>
    </>
  );
}
/** A transição em curso (da festa de uma dose até a próxima aparecer) — vive na memória da abertura do app. */
let transicaoEmCurso: { de: ModuloDaMissao; para: ModuloDaMissao; t0: number; via: "auto" | "botao" } | null = null;
export function guardarTransicao(t: NonNullable<typeof transicaoEmCurso>): void { transicaoEmCurso = t; }
/** A dose que acabou de aparecer fecha a transição dela (10 min no máximo: depois disso não é passagem, é volta). */
export function tomarTransicao(para: ModuloDaMissao, agora: number = Date.now()): NonNullable<typeof transicaoEmCurso> & { ms: number } | null {
  const t = transicaoEmCurso;
  if (!t || t.para !== para) return null;
  transicaoEmCurso = null;
  const ms = agora - t.t0;
  return ms >= 0 && ms <= 10 * 60_000 ? { ...t, ms } : null;
}

const DE_ARTIGO: Record<string, string> = { as: "das", a: "da", o: "do", os: "dos" };
/** "Conhecer mais das Finanças (1 min)" — só com o tour do outro ramo encaixado (encaixes.ts → CONHECER_MAIS). */
export const rotuloConhecerMais = (modulo: ModuloDaMissao): string => `Conhecer mais ${DE_ARTIGO[ARTIGO[modulo] ?? "o"]} ${MODULOS[modulo].nome} (1 min)`;
function LinkConhecerMais({ modulo, aoConhecerMais }: { modulo: ModuloDaMissao; aoConhecerMais?: () => void }) {
  if (!aoConhecerMais || !CONHECER_MAIS.abrir) return null;
  try { if (CONHECER_MAIS.temPara && !CONHECER_MAIS.temPara(modulo)) return null; } catch { return null; }
  return (
    <button type="button" className="md-link mt-2 w-full text-center" data-testid="missao-doses-conhecer-mais" onClick={aoConhecerMais}>
      {rotuloConhecerMais(modulo)}
    </button>
  );
}

/**
 * A frase do que a dose deixou feito, do jeito que se fala ("Você pode gastar R$ 61 por dia — e isso já está
 * nas suas Finanças."). `rotulo` é o que a missão grava no dia (o da Rotina é o nome do hábito; o da Saúde
 * sem meta traz a meta escolhida; o do Montar, o número dela).
 */
export function fraseDoFeito(modulo: ModuloDaMissao, rotulo: string, porDiaAgora?: number | null): string {
  const cfg = MODULOS[modulo];
  const r = rotulo.trim();
  if (modulo === "financas") {
    const porDia = /^Pode gastar (R\$ [\d.,]+) por dia$/.exec(r);
    // o número de AGORA (o card acabou de mostrar, já com o gasto de hoje), senão o do Montar
    if (porDia) return `Você pode gastar ${typeof porDiaAgora === "number" ? `R$ ${reais(Math.round(porDiaAgora))}` : porDia[1]} por dia — e isso já está nas suas Finanças.`;
    if (/^Renda e /.test(r)) return `${r} — tudo já está nas suas Finanças.`;
    return `${r} já está nas suas Finanças.`;
  }
  if (modulo === "rotina") return `“${r}” já está na sua Rotina, com o quadradinho de hoje marcado.`;
  if (modulo === "saude") {
    const meta = /meta (\d+)/.exec(r);
    return meta ? `1 copo d'água marcado. Sua meta agora é de ${meta[1]} copos por dia.` : "1 copo d'água marcado na sua Saúde.";
  }
  if (modulo === "treino") return `O treino “${r}” já está montado na sua semana.`;
  return `“${r}” já está ${cfg.onde}.`;
}

/** O gasto de carona depois do Montar ("Café · R$ 12") numa frase. */
export const fraseDoGastoExtra = (g: string, quantos = 1): string => {
  const m = /^(.+?) · (R\$ .+)$/.exec(g.trim());
  if (quantos > 1) return m ? `E os gastos de hoje (${m[1]}, ${m[2]}) já entraram no seu mês.` : `E “${g.trim()}” já entraram no seu mês.`;
  return m ? `E o gasto de hoje (${m[1]}, ${m[2]}) já entrou no seu mês.` : `E “${g.trim()}” já entrou no seu mês.`;
};

/** O próximo adesivo da sequência, TRANCADO (a silhueta do de amanhã): o do registro, se tiver arte; senão o fogo apagado. */
function AdesivoDeAmanha({ dias, tamanho }: { dias: 2 | 3; tamanho: number }) {
  const conq = useConquistas();
  const id = `sequencia-${dias}`;
  const b = conq.adesivos.find((x) => x.id === id);
  if (b && temArte(id)) return <span aria-hidden data-testid="missao-doses-adesivo-amanha" data-adesivo={id}><AdesivoRaro id={id} raridade={b.raridade ?? "comum"} tamanho={tamanho} trancado /></span>;
  return <span aria-hidden className="md-adesivo-fogo" data-trancado="" style={{ width: tamanho, height: tamanho }} data-testid="missao-doses-adesivo-amanha" data-adesivo={id}><Fogo dias={0} tamanho={Math.round(tamanho * 0.62)} /></span>;
}

/** A legenda do adesivo na comemoração pequena ("Adesivo novo: Primeira Despesa" / "Adesivos novos: X e Y"). */
export const legendaDoAdesivo = (a: AdesivoDaDose | null, extras: Array<{ nome: string }>): string | null => {
  if (!a) return extras.length ? `${extras.length === 1 ? "Adesivo novo" : "Adesivos novos"}: ${extras.map((e) => e.nome).join(" e ")}` : null;
  if (a.tipo === "recomeca") return "Voltou! A sequência recomeça hoje.";
  if (a.tipo === "marca") return extras.length === 1 ? `Seu dia 1 ficou marcado — e veio o adesivo ${extras[0].nome}.` : "Seu dia 1 ficou marcado.";
  if (!extras.length) return `Adesivo novo: ${a.nome}`;
  if (extras.length === 1) return `Adesivos novos: ${a.nome} e ${extras[0].nome}`;
  return `Adesivos novos: ${a.nome} e mais ${extras.length}`;
};

function ComemoracaoUmPorDia({ n, missao, modulo, rotulo, hoje, aoCombinar, aoVerFim, aoFecharDia, aoMostrarAdesivo, gastoExtra, gastosNoExtra = 1, porDiaAgora, aoConhecerMais }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoVerFim: () => void; aoFecharDia?: () => void;
  aoMostrarAdesivo?: (ids: string[]) => void; gastoExtra?: string | null; gastosNoExtra?: number; porDiaAgora?: number | null; aoConhecerMais?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const cfg = MODULOS[modulo];
  const proximo = n === 1 ? MODULOS[missao.modulos[1]] : n === 2 ? MODULOS[missao.modulos[2]] : null;
  const escolha = useAdesivoDaDose(n, modulo, missao.adesivosMostrados, aoMostrarAdesivo);
  const seq = useSequencia();
  const [hora, setHora] = useState<Lembrete>(missao.lembrete ?? horaSugeridaDaMissao());
  const frase = fraseDoFeito(modulo, rotulo, porDiaAgora);
  void hoje;

  /* A ÚNICA festa em tela cheia do teste: o adesivo "3 dias seguidos" */
  if (escolha.telaCheia && escolha.principal && escolha.principal.tipo !== "recomeca") {
    const a = escolha.principal;
    return createPortal(
      <motion.div className="fixed inset-0 z-[230] flex flex-col items-center justify-center px-6 text-center text-white" style={{ background: "linear-gradient(180deg,#2a1840 0%,#16121c 100%)", paddingTop: "var(--app-safe-top)", paddingBottom: "var(--app-safe-bottom, 0px)" }}
        role="dialog" aria-modal="true" aria-label="3 dias seguidos"
        data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-braco="A" data-tela-cheia="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Confete />
        <motion.div initial={reduzir ? false : { scale: 0.6, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
          data-testid="missao-doses-adesivo" data-adesivo={a.id}>
          <ArteDoAdesivo adesivo={a} tamanho={156} />
        </motion.div>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-white/60 mt-6">Adesivo novo</p>
        <p className="text-[30px] font-black tracking-[-0.02em] leading-tight mt-1">3 dias seguidos!</p>
        <p className="text-[15px] text-white/85 leading-snug mt-2 max-w-[320px]">Você usou o CORE três dias seguidos. É assim que um hábito pega.</p>
        <p className="text-[13px] text-white/60 leading-snug mt-3 max-w-[320px]" data-testid="missao-doses-festa-texto">{cfg.emoji} {frase}</p>
        {escolha.extras.length > 0 && <p className="text-[12.5px] text-white/60 mt-2" data-testid="missao-doses-adesivo-extras">E mais {escolha.extras.length} {escolha.extras.length === 1 ? "adesivo" : "adesivos"} na sua coleção.</p>}
        <button type="button" className="md-botao mt-7 max-w-[320px]" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={aoVerFim}>
          Ver o que você construiu <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>,
      document.body,
    );
  }

  const a = escolha.principal;
  const legenda = legendaDoAdesivo(a, escolha.extras);
  const comArte = !!a && a.tipo !== "recomeca";
  const fechaMissao = n === 3 || !proximo;
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label={`Dia ${n} de 3 feito`}
      data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-braco="A" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div initial={reduzir ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="md-tema relative w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 text-left shadow-2xl">
        {comArte && a && (
          <motion.div initial={reduzir ? false : { y: -10, rotate: -14, scale: 0.7, opacity: 0 }} animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.25 }}
            className="absolute -top-7 right-4" data-testid="missao-doses-adesivo" data-adesivo={a.id}>
            <ArteDoAdesivo adesivo={a} tamanho={68} />
          </motion.div>
        )}
        <div className="flex items-center gap-1.5" role="img" aria-label={`${n} de 3 dias feitos`}>
          {[1, 2, 3].map((i) => <Quadradinho key={i} marcado={i <= n} tam={16} />)}
        </div>
        <p className="text-[22px] font-black tracking-[-0.02em] leading-tight mt-2 pr-16">Dia {n} de 3 feito ✅</p>
        {legenda && <p className="text-[13.5px] font-bold leading-snug mt-1" data-testid="missao-doses-adesivo-legenda">{legenda}</p>}
        {n >= 2 && seq.dias >= 2 && <p className="text-[13.5px] font-extrabold mt-1" data-testid="missao-doses-sequencia">Sequência: {seq.dias} dias 🔥</p>}
        <p className="text-[13.5px] text-muted-foreground leading-snug mt-2" data-testid="missao-doses-festa-texto">{cfg.emoji} {frase}</p>
        {gastoExtra && <p className="text-[12.5px] text-muted-foreground leading-snug mt-1" data-testid="missao-doses-gasto-extra">{fraseDoGastoExtra(gastoExtra, gastosNoExtra)}</p>}
        {proximo && (
          <div className="mt-3.5 rounded-2xl px-4 py-3 flex items-center gap-3 bg-[#FFF8D6] text-[#16121c] dark:bg-[#2a2618] dark:text-foreground" data-testid="missao-doses-amanha">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-extrabold leading-snug">Amanhã: {proximo.emoji} {proximo.nome} · {doseCurta(proximo.modulo, n + 1).seg} s</span>
              <span className="block text-[12px] opacity-75 mt-0.5">{n === 1 ? "O adesivo do dia 2 te espera 🔒" : "E o adesivo dos 3 dias é seu 🔒"}</span>
            </span>
            <AdesivoDeAmanha dias={n === 1 ? 2 : 3} tamanho={40} />
          </div>
        )}
        {n === 2 && proximo && (
          <>
            <span className="block text-[12px] text-muted-foreground mt-3">Te lembro às:</span>
            <div className="flex flex-wrap gap-2 mt-1.5" role="radiogroup" aria-label="Hora do lembrete">
              {HORAS_DO_LEMBRETE.map((h) => (
                <button key={h.id} type="button" role="radio" aria-checked={hora === h.id} className="md-hora" data-marcada={hora === h.id ? "" : undefined} data-sem={h.id === "sem" ? "" : undefined} data-testid={`missao-doses-hora-${h.id}`} onClick={() => setHora(h.id)}>{h.rotulo}</button>
              ))}
            </div>
          </>
        )}
        {fechaMissao ? (
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={aoVerFim}>
            Ver o que você construiu <ArrowRight className="w-4 h-4" />
          </button>
        ) : n === 2 ? (
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-combinado" data-hora={hora} onClick={() => aoCombinar(hora)}>
            {hora === "sem" ? "Combinado, até amanhã" : `Combinado, me lembra às ${hora}`}
          </button>
        ) : (
          <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-continuar" onClick={aoFecharDia}>
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        )}
        <LinkConhecerMais modulo={modulo} aoConhecerMais={aoConhecerMais} />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
