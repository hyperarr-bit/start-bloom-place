import { useCallback, useEffect, useRef, useState } from "react";
import { missaoWebConvidada } from "@/lib/missao-web";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { MontarFinancas, deveMostrarMontarFinancas, ATRIBUTO_NA_TELA as ATRIBUTO_MONTAR_NA_TELA, EVENTO_MONTAR_FINANCAS_FIM, type ResumoMontar } from "@/components/finance/montar/MontarFinancas";
import { MODELOS as MODELOS_DE_TREINO, aplicarModelo } from "@/lib/treino-plano";
import { montarTreinoProprio } from "@/lib/intro-modulo-acoes";
import { trackEvent } from "@/lib/analytics";
import { marcarCartoesVistos } from "@/lib/tour-home";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { Anel, BotaoSeguir, Confete, ContaSubindo, PostItDaMissao, alturaVisivel, fundoDoTopoFixo, topoPreferidoDoAnel, type OutroDoPostIt } from "@/components/demo-guiada/pecas";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { CHIPS_DE_HABITO, criarHabitoPeloCampo, PERGUNTA_HABITO_MARCAR, PERGUNTA_HABITO_VAZIO, alvoDaMissao, cardMeuMes, gravacoesDoChip, lerReais, itemDoChip, linhaDeHoje, linhaDoNovoHabito, nomesDosHabitos, type AlvoDaMissao, type ChipDaMissao, type Numero, type Retangulo } from "@/components/demo-guiada/alvos";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { reais, rotuloCurto } from "@/lib/demo-guiada";
import { localDayKey } from "@/lib/utils";
import { doseCurta, emSegundos, HORAS_DO_LEMBRETE, MAX_VISTAS_DO_SETUP, MODULOS, TOTAL_PASSOS_B, diaDaMissao, eventoDaMissao, marcarDoseNaTela, msDesdePrimeiraVista, registrarMontagem, setupDaDose, tomarComecar, type DiaDaMissao, type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao, type SetupDaDose } from "@/lib/missao-doses";
import { introConcluida } from "@/lib/intro-modulo";
import { EV_PRIMEIRO_GASTO, lerTelaDoNumero, msDesdeOResultado } from "@/lib/montar-financas";
import { CHAVE_SEM_GASTO, marcarDiaSemGasto } from "@/lib/acao-do-dia";
import { CONHECER_MAIS, SETUPS_ENCAIXADOS, metaGuiadaDaIntro } from "./encaixes";
import { horaSugeridaDaMissao, porDiaExato, praHojeDasFinancas } from "@/lib/lembrete-dia2";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { ArteDoAdesivo, useAdesivoDaDose, type AdesivoDaDose } from "./adesivo-da-dose";
import "./missao-doses.css";
import { lembretesSoNoApp } from "@/lib/missao-web";
import { EscolhaDeHora } from "./EscolhaDeHora";
import { entrada, MOV, MOV_MS, saida } from "@/lib/movimento";
import { BaixarAppPopup } from "@/missao/BaixarAppPopup";

/** 1.0.17 (dono 19/10: "minimalista, uma ideia por tela") — a copy do 1º gasto: uma pergunta, os chips, "+ Outro" e a
 *  saída quieta. Sem frase explicando o toque (o post-it já diz). */
export const PERGUNTA_DO_GASTO = "Gastou algo hoje?";
export const AINDA_NAO_GASTEI = "Ainda não";
/** O balão do "olha" de Finanças (um só, no MEU MÊS): a linha do número do card QUANTO POSSO GASTAR HOJE. */
export const HOJE_AINDA_DA = "Dá pra gastar hoje";
/** 17/10 (dono, opção 3): com gasto, o balão mostra a sobra de HOJE — a mesma conta da linha "Sobram R$ X pra hoje" do
 *  card QUANTO POSSO GASTAR HOJE do Dashboard (lib/montar-financas `praHojeDoDia`). */
export const SOBRA_PRA_HOJE = "Sobra hoje";
export const JA_PASSOU_HOJE = "Passou do de hoje";
/** 1.0.17: as memórias do "+ Outro" das doses (o que ela escreveu volta como chip "seu") */
export const LISTAS_DA_DOSE = { gasto: "missao-gasto", habito: "missao-habito", treino: "missao-treino", exercicio: "missao-exercicio", meta: "missao-meta" } as const;
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
/** O "olha" de Finanças é UM balão no MEU MÊS (17/10, revisão do dono: nada de ir e voltar pelo Dashboard), ≤ 4 s
 *  desde o toque: rolagem curta (0,4 s) → respiro (0,15 s) → o anel desenha no 1º quadro estável → o "Saiu" e o
 *  número contam (0,8 s + 0,1 s) → a festa entra sozinha 2,4 s depois do anel ("não gastei": só o número, 1,9 s). */
export const OLHA_DE_FINANCAS = { rolagemMs: 400, pausaMs: 150, comGastoMs: 2400, semGastoMs: 1900, numeroS: 0.8, atrasoS: 0.1 };
/** O que o balão do "olha" de Finanças mostra: o "Saiu" do mês (antes → depois, com gasto) e o número do card QUANTO
 *  POSSO GASTAR HOJE do Dashboard (`antes` só quando o gasto mexeu nele) — sem renda, sem o número. */
/** `pode.sobra`: o número é a SOBRA de hoje (com gasto; "Sobra pra hoje") — sem ela, o "Hoje ainda dá pra gastar" (o número grande do card). */
type OlhaDeFinancas = { saiu: Numero | null; pode: { antes: number | null; depois: number; sobra?: boolean } | null; semGasto: boolean };
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
  // funil da missão na web (protótipo 18/10): a convidada do /missao conta como conta nova (os quizzes abrem; os dados vão pro guest:*)
  const isGuest = useUserData().isGuest && !missaoWebConvidada();
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  const [montarAberto, setMontarAberto] = useState(() => {
    /* B11: o app morreu no "Montando…" (já decidido) ANTES de o número aparecer — o Montar reabre direto no número
     * ("Você pode gastar hoje R$ X"; lib/montar-financas lerTelaDoNumero, hoje, nesta conta). O número que já
     * apareceu não volta: a retomada é o tutorial do 1º gasto (o passo do gasto, com os chips). */
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
  /** 1.0.17 QA: o quiz encaixado já fez o pedido (Rotina: "Sua rotina está pronta. Marca o primeiro" + "Entendi") — a dose
   *  espera o registro sem post-it/anel (um pedido só); a faixa da missão segue */
  const [quieto, setQuieto] = useState(false);
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
  /** "Ainda não gastei nada hoje" depois do Montar: o dia sem gasto foi anotado e o "olha" é só o número */
  const semGastoRef = useRef(false);
  /** quando o post-it do 1º gasto apareceu (o tutorial) — o `ms_tutorial` do evento do passo 1 */
  const tutorialEm = useRef<number | null>(null);
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
    : continuacao && cfg.tipo === "exercicio" && !treinoPronto ? "Qual exercício você fez hoje?"
    : treinoPronto ? "Qual treino combina com você?" : semMetaAgua ? "Quantos copos por dia?" : (alvoCfg?.pergunta ?? cfg.pedido);
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
        // o 1º gasto depois do Montar (o tutorial): a dose continua sendo o número dela (o rótulo do Montar fica)
        aoGastoGuiado?.("fim");
        setGastoExtra(rot);
        setRotulo(rotuloDoMontar.current);
        setNumero(null);
        evPrimeiroGasto("gasto", { via });
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
  /** O "OLHA" DE FINANÇAS (17/10, revisão do dono: "um balão só e curto", com o painel de sempre no Dashboard) — UM
   *  balão no MEU MÊS, na aba onde ela está (MEU FINANCEIRO — sem ir e voltar pelo Dashboard): o "Saiu" do mês
   *  contando com o gasto e, com renda, "Hoje ainda dá pra gastar R$ X" — o MESMO número do card QUANTO POSSO GASTAR
   *  HOJE do Dashboard (porDiaExato, arredondado igual), riscado quando o gasto mexeu nele (um café num mês com 15
   *  dias pela frente mexe centavos: o número fica, sem fingir queda). "Ainda não gastei nada hoje": só o número.
   *  17/10 (dono, opção 3): COM gasto, no lugar do "Hoje ainda dá", "Sobra pra hoje ~~R$ 123~~ R$ 111" — a linha
   *  "Sobram R$ X pra hoje" do card do Dashboard (praHojeDasFinancas = a mesma conta).
   *  Nos dois braços; a missão sem braço (a 1.0.15) olha o mesmo MEU MÊS com o balão de sempre. */
  const [olhaFin, setOlhaFin] = useState<OlhaDeFinancas | null>(null);
  useEffect(() => {
    if (cfg.tipo !== "gasto" || modo !== "dose" || montarAberto || porDiaAntes.current !== null) return;
    if (fase !== "achar" && fase !== "anotar") return;
    try { const v = porDiaExato(get); if (v !== null) porDiaAntes.current = Math.round(v); } catch { /* sem número: só o MEU MÊS */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, montarAberto]);

  /** O "Saiu" do MEU MÊS (já com o gasto) → antes = ele − o gasto. */
  const numeroDoMes = (card: Element): Numero | null => {
    const chip = Array.from(card.querySelectorAll("span")).find((sp) => /^\s*↓?\s*Saiu\b/.test(sp.textContent ?? ""));
    const saiu = chip ? lerReais(chip.textContent) : null;
    if (saiu === null || !(saiu > 0) || !valorDoGasto.current) return null;
    return { titulo: "Saiu no mês", antes: Math.max(0, saiu - (valorDoGasto.current ?? 0)), depois: saiu, formatar: reaisDoMes };
  };
  /** O MEU MÊS na tela: no Dashboard de sempre ele mora na aba MEU FINANCEIRO (a do formulário do gasto: acha na hora,
   *  sem trocar de aba); no painel limpo, também no DASHBOARD. Espera ele montar (~2 s); não veio → `null`. */
  const acharMeuMes = (timers: number[], aoAchar: (card: Element | null) => void) => {
    const abas = ['[data-spotlight="financeiro"]', '[data-spotlight="tab-dashboard"]'];
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
  /** O "olha" de Finanças: rola até o MEU MÊS e acende ele com o balão (um só). */
  const olharNoMeuMes = (timers: number[]) => {
    acharMeuMes(timers, (card) => {
      if (faseRef.current !== "registrou") return;
      if (!card) { setFase("festa"); return; }
      const semGasto = semGastoRef.current;
      const saiu = semGasto ? null : numeroDoMes(card);
      const antes = porDiaAntes.current;
      let pode: OlhaDeFinancas["pode"] = null;
      if (antes !== null) {
        // o número do card do Dashboard AGORA (já com o gasto): a mesma conta, arredondada igual (cantSpend → R$ 0)
        let depois = antes;
        try { const v = porDiaExato(getRef.current); depois = v === null ? 0 : Math.round(v); } catch { depois = antes; }
        pode = { antes: depois !== antes ? antes : null, depois };
        setPorDiaDepois(depois);
        /* 17/10 (dono, opção 3): com gasto, "Sobra pra hoje ~~R$ 123~~ R$ 111" — a linha "Sobram R$ X pra hoje" do card do
           Dashboard (a mesma conta), que um café MEXE (o número grande, a média do mês, quase não). "Não gastei": o de cima. */
        if (!semGasto) {
          let ph: ReturnType<typeof praHojeDasFinancas> = null;
          try { ph = praHojeDasFinancas(getRef.current); } catch { ph = null; }
          if (ph && ph.gasto > 0) {
            const antesDoGasto = Math.round((ph.sobra + (valorDoGasto.current ?? 0)) * 100) / 100;
            pode = { antes: ph.sobra >= 0 && antesDoGasto !== ph.sobra ? antesDoGasto : null, depois: ph.sobra, sobra: true };
          }
        }
      }
      setOlhaFin({ saiu, pode, semGasto });
      setNumero(saiu); // a missão sem braço (a 1.0.15) mostra o balão de sempre, com o "Saiu" contando
      const mostrar = () => {
        if (faseRef.current !== "registrou") return;
        setOlharEm(card);
        setFase("olhar");
        // sem valor em reais: só se o "Saiu" contou e se o número do card mudou
        trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "view", alvo: "meu_mes", contou: !!saiu, ...(pode ? { caiu: pode.antes !== null } : {}), ...(semGasto ? { sem_gasto: true } : {}) }));
        evPrimeiroGasto("olha", { com_gasto: !semGasto, numero: !!pode, caiu: !!pode && pode.antes !== null });
      };
      // ≤ 4 s desde o toque: rolagem curta (0,4 s) e respiro curto (0,15 s)
      try {
        rolarAte(card, fracaoDoAnel(card, alvoCfg?.olhar?.recorte), reduzir ? 0 : OLHA_DE_FINANCAS.rolagemMs, () => {
          if (reduzir) mostrar(); else timers.push(window.setTimeout(mostrar, OLHA_DE_FINANCAS.pausaMs));
        });
      } catch { mostrar(); }
    });
  };
  /* O balão segura o número contar e um respiro, contado de quando o anel APARECE (o anel só desenha com a tela
   * assentada); no fim, a festa entra sozinha ("Entendi" adianta). Se o anel não aparecer (teclado aberto, a tela não
   * assentou), o relógio começa mesmo assim em 2,5 s — o "olha" nunca prende a dose. */
  const [olhaNaTela, setOlhaNaTela] = useState(false);
  useEffect(() => {
    if (fase !== "olhar" || !olhaFin || olhaNaTela) return;
    const t = window.setTimeout(() => setOlhaNaTela(true), 2500);
    return () => window.clearTimeout(t);
  }, [fase, olhaFin, olhaNaTela]);
  useEffect(() => {
    if (fase !== "olhar" || !olhaFin || !olhaNaTela) return;
    const t = window.setTimeout(() => {
      if (faseRef.current !== "olhar") return;
      trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "olhar", acao: "feito", via: "auto" }));
      setFase("festa");
    }, olhaFin.semGasto ? OLHA_DE_FINANCAS.semGastoMs : OLHA_DE_FINANCAS.comGastoMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, olhaFin, olhaNaTela]);

  /* REGISTROU → o chip ficou ✓ e a linha apareceu; depois, o OLHAR (ou direto a festa). */
  useEffect(() => {
    if (fase !== "registrou") return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      if (faseRef.current !== "registrou") return;
      setAnelVivo(false);
      /* Finanças (os dois braços, e a missão sem braço): o "olha" é o balão do MEU MÊS — o "Saiu" somou e, com renda,
       * o "Hoje ainda dá pra gastar" do card do Dashboard (ver `olhaFin`). */
      if (cfg.tipo === "gasto" && modo === "dose") { olharNoMeuMes(timers); return; }
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
    // "não gastei": nenhum chip pra virar ✓ nem linha pra aparecer — o balão entra logo
    }, reduzir || semGastoRef.current ? 150 : TEMPOS_DO_PASSO.registrou));
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
  /** O passo 1 de Finanças da missão, do número ao 1º gasto (lib/montar-financas EV_PRIMEIRO_GASTO) — só no tutorial
   *  que vem DEPOIS do Montar (ou na retomada dele). `ms` desde a tela do número (nesta abertura), `ms_tutorial` desde
   *  o post-it. Nunca valor em reais. */
  const evPrimeiroGasto = (acao: string, extra: Record<string, unknown> = {}) => {
    if (!montarFeitoRef.current || cfg.tipo !== "gasto") return;
    try {
      trackEvent(EV_PRIMEIRO_GASTO, eventoDaMissao({
        acao, ms: msDesdeOResultado(),
        ...(tutorialEm.current !== null && acao !== "tutorial" ? { ms_tutorial: Date.now() - tutorialEm.current } : {}),
        ...(retomarGasto ? { retomada: true } : {}), ...extra,
      }));
    } catch { /* a medição nunca derruba a missão */ }
  };
  const tocarChip = (chip: ChipDaMissao) => {
    if (!cfg.tipo) return;
    // 1.0.16: Treino — o chip aplica o modelo pronto (plano + dias de treino), pelo formato da aba PLANO
    if (treinoPronto) {
      const modelo = MODELOS_DE_TREINO.find((m) => m.name === chip.nome);
      trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: modelo && !chip.proprio ? chip.nome : "outro", ok: true, tipo: modelo ? "treino_modelo" : "treino_proprio", ...ondeDoChip() }));
      chipTocado.current = chip; viaRef.current = "chip"; setTocado(chip.nome);
      if (!modelo) {
        // 1.0.17: o treino DELA ("+ Outro"): vira o treino de hoje, com ele como 1º exercício
        try { montarTreinoProprio({ get, gravar: (k, v) => { set(k, v); avisarEscritaDeFora(k, v); } }, chip.nome); } catch { /* a missão nunca derruba o módulo */ }
        return;
      }
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
    // 1.0.17: a opção que ELA escreveu vai como "outro" (o texto dela nunca sai do aparelho em evento)
    const nomeNoEvento = chip.proprio ? "outro" : chip.nome;
    const evChip = (ok: boolean) => trackEvent("missao_doses_chip", eventoDaMissao({ dia: n, modulo, nome: nomeNoEvento, ok, ...(chip.proprio ? { proprio: true } : {}), ...ondeDoChip() }));
    // passo A da Rotina (1.0.17, bug da 1.0.16): o chip CRIA o hábito em 1 toque — abre o campo se estiver fechado,
    // preenche e toca no Adicionar da Rotina (o hábito nasce pelo código do módulo); o evento diz se deu de verdade
    if (subPassoRef.current === "criar") {
      if (!item) { evChip(false); return; }
      chipTocado.current = chip;
      setTocado(chip.nome);
      criarHabitoPeloCampo(chip.nome, (ok) => { evChip(ok); if (!ok) setTocado(null); });
      return;
    }
    evChip(!!item);
    if (cfg.tipo === "gasto") evPrimeiroGasto("chip", { chip: nomeNoEvento });
    if (!item) return;
    chipTocado.current = chip;
    setTocado(chip.nome);
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
  const focoNoCampoDoPostIt = () => {
    try { return !!(document.activeElement as Element | null)?.closest?.("[data-escolha-campo]"); } catch { return false; }
  };
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
      /* 20/10 (vídeo do dono no iPhone, build 42): o "+ Outro" abre o campo DENTRO do post-it; o teclado sobe, a área
       * visível encolhe e o iPhone rola — o alvo "saía da tela", o post-it recolhia levando o campo junto, o teclado
       * fechava e o post-it voltava fechado (loop, nunca dava pra digitar). Escrevendo no post-it, nada muda de lugar. */
      if (focoNoCampoDoPostIt()) return;
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
    // o tutorial do 1º gasto depois do Montar ABRIU (o post-it no formulário de verdade)
    if (montarFeitoRef.current && cfg.tipo === "gasto") { tutorialEm.current = Date.now(); evPrimeiroGasto("tutorial", { ancora, aba: abaAtiva() }); }
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
  /* "Ainda não gastei nada hoje →" (D2): depois do Montar (ou na retomada) a dose JÁ está gravada — o mesmo registro
   * do "não gastei nada hoje" da Home (lib/acao-do-dia, `finance-sem-gasto`: conta pra sequência), o balão curto no MEU
   * MÊS ("Hoje ainda dá pra gastar R$ X") e a festa. Sem o Montar, ela não tem o que anotar hoje: a dose fica pra
   * amanhã (o mesmo caminho do "Pular", medido à parte). */
  const aindaNaoGastei = () => {
    if (montarFeitoRef.current) { naoGasteiHoje(); return; }
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "toque", acao: "ainda_nao", segundos: segundos(), montagem: montagemRef.current }));
    aoPular("ainda_nao", "toque", segundos(), extrasDoPulo());
  };
  const naoGasteiHoje = () => {
    if (faseRef.current !== "achar" && faseRef.current !== "anotar") return; // o toque duplo registra 1 vez
    faseRef.current = "registrou";
    try {
      const novo = marcarDiaSemGasto(getRef.current<unknown>(CHAVE_SEM_GASTO, {}), localDayKey());
      if (novo) set(CHAVE_SEM_GASTO, novo);
    } catch { /* a missão nunca derruba o módulo */ }
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "gasto_extra", acao: "ainda_nao", segundos: segundos(), montagem: montagemRef.current }));
    evPrimeiroGasto("nao_gastei");
    aoGastoGuiado?.("fim"); // reabrir não volta no tutorial
    semGastoRef.current = true;
    setRotulo(rotuloDoMontar.current);
    setNumero(null);
    setAnelVivo(false);
    setFase("registrou");
  };
  const toqueNaFaixa = () => {
    toquesNaFaixa.current += 1;
    if (toquesNaFaixa.current >= 2) setPularVisivel(true);
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
  /* 1.0.17 (dono 19/10: "e se ela não comeu nenhuma daquelas?") — o "+ Outro" de cada lista da dose: o campo abre ali
   * mesmo e a opção dela vai pelo MESMO caminho do chip (o gasto com o R$ dela; o hábito preenche o campo; o treino
   * dela vira o treino de hoje; a meta de água num stepper). Sem lista quando não há o que escolher (marcar, 1 copo). */
  const outroDaDose: OutroDoPostIt | undefined = ((): OutroDoPostIt | undefined => {
    if (!cfg.tipo || fraseDoSetup || subPasso === "marcar" || !chips.length) return undefined;
    if (semMetaAgua) return { numero: { min: 2, max: 20, inicial: 8, formatar: (x) => `${x} copos`, rotulo: "Outra meta" }, aoEscolher: ({ valor }) => tocarChip({ emoji: "💧", nome: `Meta de ${valor ?? 8} copos`, proprio: true }) };
    if (cfg.tipo === "agua") return undefined;
    if (doseDeGasto || cfg.tipo === "gasto") return { lista: LISTAS_DA_DOSE.gasto, placeholder: "Ex.: Mercado", comValor: true, aoEscolher: ({ nome, valor }) => tocarChip({ emoji: "🧾", nome, valor: valor ?? 0, categoria: "outros", proprio: true }) };
    if (subPasso === "criar") return { lista: LISTAS_DA_DOSE.habito, placeholder: "Ex.: Caminhar 10 min", aoEscolher: ({ nome }) => tocarChip({ emoji: "✨", nome, proprio: true }) };
    if (treinoPronto) return { lista: LISTAS_DA_DOSE.treino, placeholder: "Ex.: Natação", aoEscolher: ({ nome }) => tocarChip({ emoji: "🏋️", nome, proprio: true }) };
    if (cfg.tipo === "exercicio") return { lista: LISTAS_DA_DOSE.exercicio, placeholder: "Ex.: Bicicleta", aoEscolher: ({ nome }) => tocarChip({ emoji: "🏋️", nome, proprio: true }) };
    if (cfg.tipo === "meta") return { lista: LISTAS_DA_DOSE.meta, placeholder: "Ex.: Aprender a nadar", aoEscolher: ({ nome }) => tocarChip({ emoji: "🎯", nome, proprio: true }) };
    return undefined;
  })();
  const postItDe = (compacto: boolean) => (
    <motion.div animate={chacoalha && !reduzir ? { x: chacoalha % 2 ? [0, -9, 9, -6, 6, -2, 0] : [0, 9, -9, 6, -6, 2, 0] } : undefined} transition={{ duration: 0.45 }}>
      <PostItDaMissao
        rotulo={avisoDeAba ? "Primeiro o gasto" : subPasso === "criar" ? "1 de 2" : subPasso === "marcar" ? "2 de 2" : ""}
        pergunta={pergunta}
        descricao={metaGuiada ? metaGuiada.detalhe
          : fraseDoSetup && cfg.tipo === "habito" ? fraseDoQuadradinhoDoSetup()
          : semMetaAgua ? "O 1º copo já entra junto."
          : continuacao && cfg.tipo === "habito" ? (habitoDela ? `“${habitoDela}”: o quadradinho de hoje.` : "Toque no quadradinho de hoje.")
          : subPasso === "marcar" || cfg.tipo === "habito" ? "Toque no quadradinho de hoje." : undefined}
        chips={chips}
        tocado={tocado}
        aoChip={tocarChip}
        outro={outroDaDose}
        secundaria={doseDeGasto ? { texto: AINDA_NAO_GASTEI, aoTocar: aindaNaoGastei, testid: "missao-doses-ainda-nao" } : undefined}
        compacto={compacto}
      />
    </motion.div>
  );
  const postIt = postItDe(false);

  /* 1.0.16 — a dose de Finanças = "Vamos montar suas Finanças" (folha fixa abaixo da faixa da missão). O "Continuar →"
   * da tela do número (SÓ o número — 17/10, revisão do dono) traz pra cá: a dose já conta e o 1º gasto é o TUTORIAL no
   * formulário de verdade (o anel no "+ Novo gasto", o post-it "Já gastou com alguma coisa hoje?"). */
  const montarPronto = (r: ResumoMontar) => {
    const rot = r.semFolga || !(r.porDia > 0) ? `Renda e ${r.contas} ${r.contas === 1 ? "conta" : "contas"} do mês` : `Pode gastar R$ ${reais(Math.floor(r.porDia))} por dia`;
    trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "montar_financas", acao: "feito", contas: r.contas, segundos: segundos() }));
    // a tela substitui os cartões de Finanças (como no caminho do módulo, useMontarFinancasNoModulo.aoPronto)
    try { marcarCartoesVistos("financas"); } catch { /* storage bloqueado */ }
    rotuloDoMontar.current = rot;
    montarFeitoRef.current = true;
    // o número que o Montar acabou de mostrar É o do card (a mesma conta, arredondada igual): é o "antes" do olhar
    porDiaAntes.current = r.semFolga || !(r.porDia > 0) ? null : Math.round(r.porDia);
    setRotulo(rot);
    setNumero(null);
    setMontarFeito(true);
    // a dose conta JÁ (fechar o app no tutorial não pode desfazer o Montar); a comemoração chama de novo no fim e a
    // missão ignora a 2ª vez (o dia já está gravado)
    aoFeito(rot, segundos());
    // fechar o app daqui até o gasto: ao reabrir, a dose volta NO TUTORIAL DO GASTO (nunca no Montar)
    aoGastoGuiado?.("pendente");
    // o "achar" volta a procurar o "+ Novo gasto" assim que o Montar sair da tela (o atributo <html
    // data-montar-financas> some no desmontar)
    setMontarAberto(false);
  };
  /* B11 (relatório 11): o Montar marca "decidido" na ENTRADA do "Montando" — fechar o app ali ou na tela do número perdia a
   * dose (ela só gravava no botão da tela do número). Agora a dose grava ali mesmo (o mesmo rótulo do número, que é a
   * conta do card) e o 1º gasto fica pendente: reabrir volta no número ainda não visto ou, se já viu, no tutorial. */
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
    let jaPediu = false;
    try { jaPediu = !!encaixe.pedidoJaFeito?.(resumo); } catch { jaPediu = false; }
    if (jaPediu) { setQuieto(true); trackEvent("missao_doses_passo", eventoDaMissao({ dia: n, modulo, passo: "setup", setup, acao: "espera_quieta", segundos: segundos() })); }
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
      {!alvo && fase === "anotar" && !montarAberto && !setupAberto && !quieto && createPortal(
          <motion.div key="postit-solto" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 64px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="missao-doses-postit-solto">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{doseDeGasto ? postItDe(true) : postIt}</div>
          </motion.div>,
          document.body,
        )}
      {/* D4: o alvo saiu da área visível — o post-it fica colado embaixo da faixa (o anel recolhido segue o alvo) */}
      {anelFora && anelVivo && alvo && fase === "anotar" && !quieto && createPortal(
          <motion.div key="postit-doca" className="fixed inset-x-0 z-[200] flex justify-center pointer-events-none" style={{ top: "calc(var(--missao-doses-faixa-h) + var(--app-safe-top) + 10px)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="missao-doses-postit-doca">
            <div className="w-[92%] max-w-[360px] pointer-events-auto">{postItDe(true)}</div>
          </motion.div>,
          document.body,
        )}
      <AnimatePresence>
        {anelVivo && alvo && !quieto && (fase === "anotar" || fase === "registrou") && (
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
            key={olhaFin ? "olhar-financas" : "olhar"} fixo interativo alvo={olharEm} recorte={alvoCfg?.olhar?.recorte} duracao={TEMPOS_DO_PASSO.olhar} testid="missao-doses-anel-olhar"
            rapido={!!olhaFin} aoAparecer={olhaFin ? () => setOlhaNaTela(true) : undefined}
            aoSair={() => entendi("auto")}
            balao={olhaFin && doseDeGasto ? (
              /* Finanças (17/10, revisão do dono): UM balão, curto — o "Saiu" do mês e o número do card do Dashboard.
                 A missão SEM braço (a 1.0.15, chave desligada) fica com o balão de sempre, logo abaixo. */
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="missao-doses-olhar" data-olha="financas" data-sem-gasto={olhaFin.semGasto ? "" : undefined}>
                <span className="block text-[15px] font-extrabold leading-snug" data-testid="missao-doses-olhar-titulo">{olhaFin.semGasto ? "Dia sem gasto ✓" : "Seu mês"}</span>
                {olhaFin.saiu || olhaFin.pode ? (
                  <div className="mt-1.5 divide-y divide-white/10" data-testid="missao-doses-olhar-numero">
                    {olhaFin.saiu && (
                      <div className="flex items-baseline justify-between gap-3 py-1.5" data-testid="missao-doses-olhar-saiu">
                        <span className="text-[13px] text-white/65">{olhaFin.saiu.titulo}</span>
                        <span className="flex items-baseline gap-2 whitespace-nowrap">
                          <s className="text-[13px] text-white/45 tabular-nums">{olhaFin.saiu.formatar(olhaFin.saiu.antes)}</s>
                          <span className="text-[20px] font-black tracking-tight leading-none"><ContaSubindo de={olhaFin.saiu.antes} para={olhaFin.saiu.depois} formatar={olhaFin.saiu.formatar} duracao={OLHA_DE_FINANCAS.numeroS} atraso={OLHA_DE_FINANCAS.atrasoS} /></span>
                        </span>
                      </div>
                    )}
                    {olhaFin.pode && (() => {
                      const { antes, depois, sobra } = olhaFin.pode;
                      const passou = !!sobra && depois < 0;
                      // a sobra sai no formato da linha do card (centavos quando tem); o "Hoje ainda dá", inteiro como o número grande
                      const formatar = sobra ? (x: number) => `R$ ${reais(x)}` : (x: number) => `R$ ${reais(Math.round(x))}`;
                      return (
                        <div className="flex items-baseline justify-between gap-3 py-1.5" data-testid="missao-doses-olhar-pode" data-valor={depois} data-sobra={sobra ? "" : undefined}>
                          <span className="text-[13px] text-white/65">{passou ? JA_PASSOU_HOJE : sobra ? SOBRA_PRA_HOJE : HOJE_AINDA_DA}</span>
                          <span className="flex items-baseline gap-2 whitespace-nowrap">
                            {antes !== null && <s className="text-[13px] text-white/45 tabular-nums">{formatar(antes)}</s>}
                            <span className="text-[20px] font-black tracking-tight leading-none">
                              {antes !== null
                                ? <ContaSubindo de={antes} para={depois} formatar={formatar} duracao={OLHA_DE_FINANCAS.numeroS} atraso={OLHA_DE_FINANCAS.atrasoS} />
                                : <span className="tabular-nums">{formatar(passou ? -depois : depois)}</span>}
                            </span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{olhaFin.semGasto ? "Suas contas já estão aqui." : "Entrou no seu mês."}</span>
                )}
                <div className="mt-2.5">
                  <BotaoSeguir claro onClick={() => entendi("botao")} testid="missao-doses-entendi">Entendi</BotaoSeguir>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-3.5 text-white shadow-2xl ring-1 ring-white/15" style={{ background: "#16121c" }} data-testid="missao-doses-olhar">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60 mb-1" data-testid="missao-doses-olhar-tempo">Olha · 1 de 1</span>
                <span className="block text-[15px] font-extrabold leading-snug" data-testid="missao-doses-olhar-titulo">{cfg.olhar.titulo}</span>
                <span className="block text-[12.5px] text-white/80 leading-snug mt-1">{cfg.olhar.texto}</span>
                {numero && (
                  <span className="flex items-baseline gap-2 mt-2" data-testid="missao-doses-olhar-numero">
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
        <motion.div initial={reduzir ? false : { y: 26, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }} className="md-tema relative w-full max-w-[340px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 text-center shadow-2xl">
          <span className="inline-block rounded-full bg-foreground text-background text-[12px] font-extrabold px-3.5 py-1.5">🔥 Dia {diaDaMissao(missao, hoje)} · {cfg.emoji} {cfg.nome} ✓</span>
          <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-2.5">{titulo}</p>
          <p className="text-[13.5px] text-muted-foreground leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
            {cfg.emoji} <b className="text-foreground">{rotulo}</b> já está {cfg.onde}. Um uso de verdade por dia é o que faz o hábito pegar.
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
        /* 17/10 (print do dono): o cartão seguia branco no modo escuro — agora é o papel do tema, como no braço A */
        className="md-tema relative w-full max-w-[340px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 text-center shadow-2xl"
      >
        <span className="inline-block rounded-full bg-foreground text-background text-[12px] font-extrabold px-3.5 py-1.5">{B ? `🔥 Dose ${n} de ${TOTAL_PASSOS_B} ✓` : `🔥 Dia ${n} da missão ✓`}</span>
        <p className="text-[21px] font-black tracking-[-0.02em] leading-tight mt-2.5">{titulo}</p>
        <p className="text-[13.5px] text-muted-foreground leading-snug mt-1.5" data-testid="missao-doses-festa-texto">
          {/* 1.0.16: a dose de Finanças virou o Montar (nos dois braços) — o texto do "olhar" fala de um gasto que talvez não exista */}
          {modulo === "financas" && /^(Pode gastar|Renda e )/.test(rotulo)
            ? <>{cfg.emoji} {fraseDoFeito(modulo, rotulo, porDiaAgora)}</>
            : <>{cfg.emoji} <b className="text-foreground">{rotulo}</b> já está {cfg.onde}. {cfg.olhar.texto}</>}
        </p>
        {/* o 1º gasto depois do Montar (o tutorial no formulário) — nos dois braços */}
        {gastoExtra && <p className="text-[12.5px] text-muted-foreground leading-snug mt-1" data-testid="missao-doses-gasto-extra">{fraseDoGastoExtra(gastoExtra, gastosNoExtra)}</p>}
        <div className="h-2 rounded-full bg-foreground/10 overflow-hidden mt-3.5">
          <motion.div className="h-full rounded-full bg-emerald-500" initial={reduzir ? false : { width: `${Math.round(((n - 1) / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} animate={{ width: `${Math.round((n / (B ? TOTAL_PASSOS_B : 3)) * 100)}%` }} transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 font-semibold">{B ? `Missão de hoje · ${n} de ${TOTAL_PASSOS_B}` : `Missão dos 3 dias · ${n} de 3 toques`}</p>

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
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3 bg-[#FFF8D6] text-[#16121c] dark:bg-[#2a2618] dark:text-foreground" data-testid="missao-doses-falta-home">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a4b12] dark:text-[#e9c47c]">Falta 1 · 🏡 Sua Home</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">Falta 1: arrumar sua Home</span>
              <span className="block text-[12px] opacity-75 mt-1">5 toques e ela fica do seu jeito — e a missão de hoje fecha.</span>
            </div>
            <button type="button" className="md-botao mt-3.5" data-tom="magenta" data-testid="missao-doses-fechar-dia" onClick={aoFecharDia}>
              Arrumar minha Home <ArrowRight className="w-4 h-4" />
            </button>
            <LinkConhecerMais modulo={modulo} aoConhecerMais={aoConhecerMais} />
          </>
        ) : proximo ? (
          <>
            <div className="mt-3.5 rounded-2xl text-left px-4 py-3 bg-[#FFF8D6] text-[#16121c] dark:bg-[#2a2618] dark:text-foreground" data-testid="missao-doses-amanha">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a4b12] dark:text-[#e9c47c]">Amanhã · {proximo.emoji} {proximo.nome}</span>
              <span className="block text-[15px] font-extrabold leading-snug mt-0.5">{proximo.pedido}</span>
              <span className="block text-[12px] opacity-75 mt-1.5">Te lembro às:</span>
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
      <div className="mt-3.5 rounded-2xl text-left px-4 py-3 bg-[#FFF8D6] text-[#16121c] dark:bg-[#2a2618] dark:text-foreground" data-testid="missao-doses-proxima-dose" data-passagem="auto">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a4b12] dark:text-[#e9c47c]">Dose {n + 1} de {TOTAL_PASSOS_B} · {proximo.emoji} {proximo.nome}</span>
        <span className="block text-[16px] font-extrabold leading-snug mt-0.5" data-testid="missao-doses-agora-o">{agoraO(proximo.modulo)} — {emSegundos(doseCurta(proximo.modulo, n + 1).seg)}</span>
        <span className="block text-[12.5px] opacity-75 mt-1">{proximo.pedido}.</span>
        <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2.5" aria-hidden>
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
export const rotuloConhecerMais = (modulo: ModuloDaMissao): string => `Mais dicas ${DE_ARTIGO[ARTIGO[modulo] ?? "o"]} ${MODULOS[modulo].nome}`;
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
  // 1.0.17 (dono: "minimalista"): UMA linha curta do que ficou feito — sem repetir o que ela acabou de ver
  if (modulo === "financas") {
    const porDia = /^Pode gastar (R\$ [\d.,]+) por dia$/.exec(r);
    // o número de AGORA (o card acabou de mostrar, já com o gasto de hoje), senão o do Montar
    if (porDia) return `${typeof porDiaAgora === "number" ? `R$ ${reais(Math.round(porDiaAgora))}` : porDia[1]} por dia, já nas suas Finanças.`;
    if (/^Renda e /.test(r)) return "Suas contas do mês já estão nas Finanças.";
    return `${r} nas suas Finanças.`;
  }
  if (modulo === "rotina") return `“${r}” está na sua Rotina.`;
  if (modulo === "saude") {
    const meta = /meta (\d+)/.exec(r);
    return meta ? `Meta de ${meta[1]} copos. O 1º já foi.` : "1 copo d'água marcado.";
  }
  if (modulo === "treino") return `“${r}” está na sua semana.`;
  return `“${r}” ${cfg.onde}.`;
}

/** O gasto de carona depois do Montar ("Café · R$ 12") numa frase. */
export const fraseDoGastoExtra = (g: string, quantos = 1): string => {
  const m = /^(.+?) · (R\$ .+)$/.exec(g.trim());
  if (quantos > 1) return m ? `E os gastos de hoje (${m[1]}, ${m[2]}) já entraram no seu mês.` : `E “${g.trim()}” já entraram no seu mês.`;
  return m ? `E o gasto de hoje (${m[1]}, ${m[2]}) já entrou no seu mês.` : `E “${g.trim()}” já entrou no seu mês.`;
};

/** A legenda do adesivo na comemoração pequena ("Adesivo novo: Primeira Despesa" / "Adesivos novos: X e Y"). */
export const legendaDoAdesivo = (a: AdesivoDaDose | null, extras: Array<{ nome: string }>): string | null => {
  if (!a) return extras.length ? `${extras.length === 1 ? "Adesivo novo" : "Adesivos novos"}: ${extras.map((e) => e.nome).join(" e ")}` : null;
  if (a.tipo === "recomeca") return "Voltou! A sequência recomeça hoje.";
  if (a.tipo === "marca") return extras.length === 1 ? `Seu dia 1 ficou marcado — e veio o adesivo ${extras[0].nome}.` : "Seu dia 1 ficou marcado.";
  if (!extras.length) return `Adesivo novo: ${a.nome}`;
  if (extras.length === 1) return `Adesivos novos: ${a.nome} e ${extras[0].nome}`;
  return `Adesivos novos: ${a.nome} e mais ${extras.length}`;
};

/** 1.0.17: a folha da comemoração sai DESCENDO (base, 280 ms) antes de a missão trocar de tela — nunca some no seco. */
export const SAIDA_DA_FESTA_MS = MOV_MS.base;

function ComemoracaoUmPorDia({ n, missao, modulo, rotulo, hoje, aoCombinar, aoVerFim, aoFecharDia, aoMostrarAdesivo, porDiaAgora, aoConhecerMais }: {
  n: DiaDaMissao; missao: EstadoMissaoDoses; modulo: ModuloDaMissao; rotulo: string; hoje: string;
  aoCombinar: (l: Lembrete) => void; aoVerFim: () => void; aoFecharDia?: () => void;
  aoMostrarAdesivo?: (ids: string[]) => void; gastoExtra?: string | null; gastosNoExtra?: number; porDiaAgora?: number | null; aoConhecerMais?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const proximo = n === 1 ? MODULOS[missao.modulos[1]] : n === 2 ? MODULOS[missao.modulos[2]] : null;
  const escolha = useAdesivoDaDose(n, modulo, missao.adesivosMostrados, aoMostrarAdesivo);
  const seq = useSequencia();
  const [hora, setHora] = useState<Lembrete>(missao.lembrete ?? horaSugeridaDaMissao());
  const frase = fraseDoFeito(modulo, rotulo, porDiaAgora);
  void hoje;
  // 18/10 (funil da missão na WEB): o "Te lembro às" do dia 2 sai — o "Combinado" abre o pop-up "Baixe o app pra
  // receber os lembretes" e o "Agora não" combina "sem lembrete" (o navegador não manda notificação)
  const [soNoApp] = useState(lembretesSoNoApp);
  const [popupApp, setPopupApp] = useState(false);
  /* 1.0.17 (dono: "o corte entre Finanças e a Home é brusco"): o botão primeiro faz a folha DESCER e o fundo clarear
     (280 ms); só então a missão troca de tela. Um toque só (o 2º toque no meio da saída não chama de novo). */
  const [saindo, setSaindo] = useState(false);
  const sair = (depois: () => void) => {
    if (saindo) return;
    setSaindo(true);
    window.setTimeout(depois, reduzir ? MOV_MS.rapido : SAIDA_DA_FESTA_MS);
  };

  /* A ÚNICA festa em tela cheia do teste: o adesivo "3 dias seguidos" */
  if (escolha.telaCheia && escolha.principal && escolha.principal.tipo !== "recomeca") {
    const a = escolha.principal;
    return createPortal(
      <motion.div className="fixed inset-0 z-[230] flex flex-col items-center justify-center px-6 text-center text-white" style={{ background: "linear-gradient(180deg,#2a1840 0%,#16121c 100%)", paddingTop: "var(--app-safe-top)", paddingBottom: "var(--app-safe-bottom, 0px)" }}
        role="dialog" aria-modal="true" aria-label="3 dias seguidos"
        data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-braco="A" data-tela-cheia="" initial={{ opacity: 0 }} animate={{ opacity: saindo ? 0 : 1 }} exit={{ opacity: 0 }} transition={saindo ? saida(reduzir) : entrada(reduzir, MOV.calmo)}>
        <Confete atraso={reduzir ? 0 : 0.7} />
        <motion.div initial={reduzir ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={entrada(reduzir, MOV.calmo, 0.25)}
          data-testid="missao-doses-adesivo" data-adesivo={a.id}>
          <ArteDoAdesivo adesivo={a} tamanho={156} />
        </motion.div>
        <motion.div initial={reduzir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.calmo, 0.5)}>
          <p className="text-[30px] font-black tracking-[-0.02em] leading-tight mt-6">3 dias seguidos!</p>
          <p className="text-[15px] text-white/80 leading-snug mt-2 max-w-[320px]" data-testid="missao-doses-festa-texto">É assim que um hábito pega.</p>
        </motion.div>
        <button type="button" className="md-botao mt-8 max-w-[320px]" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={() => sair(aoVerFim)}>
          Ver meu resumo
        </button>
      </motion.div>,
      document.body,
    );
  }

  const a = escolha.principal;
  const comArte = !!a && a.tipo !== "recomeca";
  const fechaMissao = n === 3 || !proximo;
  return createPortal(
    <motion.div className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10 overflow-y-auto" style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label={`Dia ${n} feito`}
      data-camada-guia="missao-doses-festa" data-testid="missao-doses-festa" data-dia={n} data-braco="A" data-saindo={saindo ? "" : undefined}
      initial={{ opacity: 0 }} animate={{ opacity: saindo ? 0 : 1 }} exit={{ opacity: 0 }} transition={saindo ? saida(reduzir) : entrada(reduzir, MOV.base)}>
      <motion.div initial={reduzir ? false : { y: 40, opacity: 0 }} animate={saindo && !reduzir ? { y: "110%", opacity: 1 } : { y: 0, opacity: 1 }} transition={saindo ? saida(reduzir) : entrada(reduzir, MOV.calmo, 0.05)}
        className="md-tema relative w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 pt-6 text-left shadow-2xl">
        {comArte && a && (
          <motion.div initial={reduzir ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={entrada(reduzir, MOV.calmo, 0.35)}
            className="absolute -top-7 right-4" data-testid="missao-doses-adesivo" data-adesivo={a.id} aria-label={`Adesivo: ${a.nome}`} role="img">
            <ArteDoAdesivo adesivo={a} tamanho={64} />
          </motion.div>
        )}
        <div className="flex items-center gap-1.5" role="img" aria-label={`${n} de 3 dias feitos`}>
          {[1, 2, 3].map((i) => <Quadradinho key={i} marcado={i <= n} tam={16} />)}
        </div>
        <p className="text-[24px] font-black tracking-[-0.02em] leading-tight mt-2.5 pr-16" data-testid="missao-doses-festa-titulo">Dia {n} feito.</p>
        {n >= 2 && seq.dias >= 2 && <p className="text-[14px] font-bold mt-1" data-testid="missao-doses-sequencia">🔥 {seq.dias} dias seguidos</p>}
        <p className="text-[14px] text-muted-foreground leading-snug mt-1.5" data-testid="missao-doses-festa-texto">{frase}</p>
        {proximo && (
          <p className="text-[16px] font-extrabold leading-snug mt-4" data-testid="missao-doses-amanha">Amanhã: {proximo.nome}.</p>
        )}
        {n === 2 && proximo && !soNoApp && (
          <>
            <span className="block text-[12.5px] text-muted-foreground mt-2.5 mb-1.5">Te lembro às</span>
            <EscolhaDeHora valor={hora} aoMudar={setHora} />
          </>
        )}
        {fechaMissao ? (
          <button type="button" className="md-botao mt-5" data-tom="magenta" data-testid="missao-doses-ver-fim" onClick={() => sair(aoVerFim)}>
            Ver meu resumo
          </button>
        ) : n === 2 && soNoApp ? (
          <button type="button" className="md-botao mt-5" data-tom="magenta" data-testid="missao-doses-combinado" data-hora="sem" onClick={() => setPopupApp(true)}>
            Combinado
          </button>
        ) : n === 2 ? (
          <button type="button" className="md-botao mt-5" data-tom="magenta" data-testid="missao-doses-combinado" data-hora={hora} onClick={() => sair(() => aoCombinar(hora))}>
            Combinado
          </button>
        ) : (
          <button type="button" className="md-botao mt-5" data-tom="magenta" data-testid="missao-doses-continuar" onClick={() => sair(() => aoFecharDia?.())}>
            Até amanhã
          </button>
        )}
        <LinkConhecerMais modulo={modulo} aoConhecerMais={aoConhecerMais} />
      </motion.div>
      {popupApp && <BaixarAppPopup contexto="festa_dia2" onAgoraNao={() => { setPopupApp(false); aoCombinar("sem"); }} />}
    </motion.div>,
    document.body,
  );
}
