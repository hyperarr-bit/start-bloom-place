import { fluxoEnxutoLigado } from "@/lib/fluxo-enxuto";
import { localDayKey } from "@/lib/utils";

/**
 * CONQUISTAS COM CALMA NOS PRIMEIROS DIAS (1.0.21, FLUXO ENXUTO e modo 1.0.12).
 *
 * O visual das festas (Conquistas 2 / Codex: CelebracaoFigurinha, o toast `.cf-chegada`, os marcos) NÃO muda — só
 * QUANDO e QUANTAS aparecem. REGRA DO DONO (27/10, no lugar da de 1 festa/abertura e 2/dia nas 72 h):
 *   · DIA 1 da conta (o dia local em que ela nasceu): até 3 festas (a da pedra + 2);
 *   · DIAS 2 e 3: até 2 por dia;
 *   · no máximo 1 festa por ABERTURA do app;
 *   · o resto entra QUIETO no álbum (vira "visto", nunca mais vira festa atrasada; o número de novas aparece no ícone
 *     das Conquistas);
 *   · figurinha RARA (ou mais) SEMPRE comemora: não conta no limite e nunca é cortada;
 *   · nunca por cima de cadastro, boas-vindas, missão ou folha (`outraTelaAberta` nos Momentos);
 *   · reabrir não repete festa (`core-festas-mostradas`);
 *   · do 4º dia em diante, a fila de sempre;
 *   · SAI a regra "a festa espera a missão sair" (com ela só 26% viam festa; na 1.0.12, 66%) — a festa só espera a
 *     camada da missão que está NA TELA (dose, comemoração, convite), nunca a missão inteira do dia.
 *   · marcos da sequência (7/30/100) e capas não contam nem são cortados (não existem nos 3 primeiros dias).
 * A contagem do dia fica no aparelho (`core-festas-calma` = { dia, n }), a da abertura em memória.
 */
export const DIAS_DE_CALMA = 3;
export const MAX_FESTAS_POR_ABERTURA = 1;
export const MAX_FESTAS_DIA_1 = 3;
export const MAX_FESTAS_DIAS_2_E_3 = 2;
/** @deprecated a regra de 27/10 tem o limite por dia da conta (`maxFestasNoDia`) — fica pro código antigo que lê. */
export const MAX_FESTAS_POR_DIA = MAX_FESTAS_DIAS_2_E_3;
export const CHAVE_FESTAS_CALMA = "core-festas-calma";

/** O limite do dia N da conta (1 = o dia em que ela nasceu). */
export const maxFestasNoDia = (diaDaConta: number): number => (diaDaConta <= 1 ? MAX_FESTAS_DIA_1 : MAX_FESTAS_DIAS_2_E_3);

const DIA_MS = 86_400_000;
/** O dia da conta pelo CALENDÁRIO local (1 = o dia do cadastro, 2 = o seguinte…). Sem data = 0. */
export function diaDaConta(criadoEm: string | null | undefined, agora: number = Date.now()): number {
  if (!criadoEm) return 0;
  const t = new Date(criadoEm).getTime();
  if (!Number.isFinite(t)) return 0;
  const meiaNoite = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  return Math.round((meiaNoite(agora) - meiaNoite(t)) / DIA_MS) + 1;
}

/** As chaves dos avisos que já apareceram NESTA abertura (o que está na tela continua na fila). */
const nestaAbertura = new Set<string>();
/** Só testes: simula fechar e abrir o app. */
export const _novaAberturaFestas = (): void => { nestaAbertura.clear(); };

/**
 * O QUE É UMA "ABERTURA": abrir o app do zero, OU voltar pra ele depois de ≥ 5 min no fundo (o iPhone guarda o app
 * aberto por horas — sem isto, quem não mata o app veria 1 festa no dia inteiro e o "dia 1: até 3" nunca aconteceria).
 * A volta dispara `EVENTO_NOVA_ABERTURA_FESTAS` (os Momentos relêem a fila).
 */
export const MIN_NO_FUNDO_NOVA_ABERTURA_MS = 5 * 60_000;
export const EVENTO_NOVA_ABERTURA_FESTAS = "festas-calma:nova-abertura";
let noFundoDesde: number | null = null;
let ouvindo = false;
const irProFundo = (agora: number = Date.now()) => { if (noFundoDesde === null) noFundoDesde = agora; };
const voltarDoFundo = (agora: number = Date.now()) => {
  const desde = noFundoDesde;
  noFundoDesde = null;
  if (desde === null || agora - desde < MIN_NO_FUNDO_NOVA_ABERTURA_MS) return;
  nestaAbertura.clear();
  try { window.dispatchEvent(new Event(EVENTO_NOVA_ABERTURA_FESTAS)); } catch { /* sem window */ }
};
/** Só testes: a ida e a volta do fundo com o relógio dado. */
export const _fundoFestas = { irProFundo, voltarDoFundo };
/** Liga os ouvidos da ida/volta do fundo (1x por app; os Momentos chamam ao montar). */
export function ouvirAberturasDasFestas(): void {
  if (ouvindo || typeof document === "undefined") return;
  ouvindo = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") irProFundo(); else voltarDoFundo(); });
  // app das lojas: o segundo plano pelo Capacitor (o visibilitychange do WKWebView nem sempre chega)
  void import("@capacitor/app")
    .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => { if (isActive) voltarDoFundo(); else irProFundo(); }))
    .catch(() => { /* sem plugin: fica o visibilitychange */ });
}

const lerDia = (hoje: string): number => {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_FESTAS_CALMA) || "null") as { dia?: unknown; n?: unknown } | null;
    return v && v.dia === hoje && typeof v.n === "number" && Number.isFinite(v.n) ? v.n : 0;
  } catch { return 0; }
};

/** A calma vale pra esta conta? (enxuto ligado — fixo no modo 1.0.12 — e conta nos dias 1 a 3 do calendário) */
export function calmaDasFestasVale(criadoEm: string | null | undefined, agora: number = Date.now()): boolean {
  if (!criadoEm || !fluxoEnxutoLigado()) return false;
  const d = diaDaConta(criadoEm, agora);
  return d >= 1 && d <= DIAS_DE_CALMA;
}

/**
 * Decisão pura sobre a fila: o que já apareceu nesta abertura fica; o resto, só até o orçamento (abertura e dia);
 * o que sobra sai da fila e devolve os ids a silenciar. `contaNoLimite(item)` = false deixa passar sem contar.
 */
export function aplicarCalma<T>(
  fila: T[],
  chaveDe: (item: T) => string,
  idsDe: (item: T) => string[],
  contaNoLimite: (item: T) => boolean,
  hoje: string = localDayKey(),
  /** o dia da conta (1 = o do cadastro): o limite do dia 1 é 3, dos dias 2 e 3 é 2 */
  dia: number = 2,
): { fila: T[]; silenciar: string[] } {
  const usadasNaAbertura = nestaAbertura.size;
  let orcamento = Math.max(0, Math.min(MAX_FESTAS_POR_ABERTURA - usadasNaAbertura, maxFestasNoDia(dia) - lerDia(hoje)));
  const out: T[] = [];
  const silenciar: string[] = [];
  for (const item of fila) {
    if (!contaNoLimite(item) || nestaAbertura.has(chaveDe(item))) { out.push(item); continue; }
    if (orcamento > 0) { orcamento -= 1; out.push(item); continue; }
    silenciar.push(...idsDe(item));
  }
  return { fila: out, silenciar };
}

/** O aviso APARECEU (1x por chave por abertura): conta na abertura e no dia. */
export function registrarFestaNaCalma(chave: string, hoje: string = localDayKey()): void {
  if (nestaAbertura.has(chave)) return;
  nestaAbertura.add(chave);
  try { localStorage.setItem(CHAVE_FESTAS_CALMA, JSON.stringify({ dia: hoje, n: lerDia(hoje) + 1 })); } catch { /* storage bloqueado */ }
}
