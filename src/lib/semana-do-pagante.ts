/**
 * SEMANA DO PAGANTE — 1 aviso por dia nos 7 dias depois de a pessoa pagar (16/10/2026, 1.0.16).
 *
 * Por quê (dado do dono, 16/10): 63% dos pagantes somem; quem usa o app em 4+ dias na
 * 1ª semana paga fica 46%. O lembrete do dia 2 (lib/lembrete-dia2) cobre só os 7 primeiros
 * dias NO APARELHO — com teste de 3 dias, a semana depois da cobrança fica quase descoberta,
 * e ele arma só "amanhã" (quem não abre de novo não recebe mais nada). Este aqui arma os 7
 * de uma vez, então chega mesmo pra quem não voltou.
 *
 * As regras (o agendamento de verdade mora em lib/notificacoes, sincronizarSemanaDoPagante):
 *  - QUANDO COMEÇA: o fim do teste da loja (teste com renovação ligada, armado antes — a
 *    pessoa costuma não abrir o app no dia da cobrança) ou a data da compra paga (quem
 *    comprou sem teste, ou a 1ª abertura depois da cobrança). Teste cancelado → desarma.
 *    Renovação de um ano/mês depois NÃO começa outra semana (compra original ≤ 15 dias).
 *  - QUANDO TOCA: os 7 primeiros horários depois do começo, na hora de uso da pessoa (a
 *    mesma do lembrete do dia 2: a combinada na missão, senão a 1ª abertura de hoje,
 *    08:00–21:30). "sem aviso" na missão = nenhum. O de HOJE nunca é marcado (ela já abriu).
 *  - O QUE DIZ: Finanças → Rotina → Saúde em rodízio (os 3 módulos que seguram gente),
 *    começando pelo que ela mais usa; textos curtos de planner, diferentes a cada dia; o de
 *    AMANHÃ leva o número dela quando existe ("Hoje dá pra gastar até R$ 43"). Domingo é o
 *    resumo da semana. Nada de preço, cobrança, assinatura ou cancelar.
 *  - QUEM DESLIGA: a mesma chave "Primeira semana" da central de avisos.
 *  - O lembrete do dia 2 cede o dia que este cobre (uma notificação por dia, nunca duas).
 *
 * Estado do APARELHO (`core-semana-pagante`, em CHAVES_DO_APARELHO).
 */
import { localDayKey } from "./utils";
import { somarDias } from "./sequencia";
import { MODULOS, type ModuloDaMissao } from "./missao-doses";
import { EVENTO_DIA2, clampHora, conteudoDoModulo, horaDoLembrete, lerDia2, registrosPorModulo, type Leitor } from "./lembrete-dia2";
import { trackEvent } from "./analytics";

export const CHAVE_SEMANA_PAGANTE = "core-semana-pagante";
/** Faixa própria (930000 = dia 2, 940000 = cobrança, 950000 = recuperação do paywall). Ids: BASE + dia (1..7). */
export const BASE_SEMANA_PAGANTE = 960000;
export const DIAS_DA_SEMANA_DO_PAGANTE = 7;
/** Compra original mais velha que isto = renovação, não pagante novo. */
const ORIGINAL_ATE_DIAS = 15;

export interface EstadoSemanaPagante {
  v: 1;
  /** quando a semana começa (fim do teste ou a compra paga), em ms */
  inicioMs: number;
  origem: "fim_do_teste" | "compra";
  /** a loja já disse que é pagamento (e não só teste com renovação ligada) */
  confirmado?: boolean;
  /** o último agendamento, pra não refazer igual */
  ultimo?: { assinatura: string; dias?: string[] };
}

export function lerSemanaDoPagante(): EstadoSemanaPagante | null {
  try {
    const raw = localStorage.getItem(CHAVE_SEMANA_PAGANTE);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoSemanaPagante;
    return e && e.v === 1 && typeof e.inicioMs === "number" && Number.isFinite(e.inicioMs) ? e : null;
  } catch { return null; }
}
export function gravarSemanaDoPagante(e: EstadoSemanaPagante | null): void {
  try {
    if (e) localStorage.setItem(CHAVE_SEMANA_PAGANTE, JSON.stringify(e));
    else localStorage.removeItem(CHAVE_SEMANA_PAGANTE);
  } catch { /* sem storage */ }
}

/* ------------------------------------------------------------ a verdade da loja */

/** O subconjunto do PurchasesEntitlementInfo que esta conta lê. */
export type EntitlementDaLoja = {
  periodType?: string;
  willRenew?: boolean;
  expirationDateMillis?: number | null;
  latestPurchaseDateMillis?: number | null;
  originalPurchaseDateMillis?: number | null;
  unsubscribeDetectedAt?: string | null;
};

export type DecisaoSemana =
  | { acao: "armar"; estado: EstadoSemanaPagante }
  | { acao: "cancelar" }
  | { acao: "nada" };

/**
 * O que fazer com a semana a partir dos entitlements ATIVOS do RevenueCat.
 * Pura: quem grava e agenda é conferirSemanaDoPagante.
 */
export function decidirSemanaDoPagante(
  ativos: Record<string, EntitlementDaLoja> | null | undefined,
  atual: EstadoSemanaPagante | null,
  agora: number = Date.now(),
): DecisaoSemana {
  const lista = Object.values(ativos ?? {}).filter(Boolean);
  const pago = lista.find((e) => e.periodType && e.periodType !== "TRIAL");
  if (pago) {
    if (atual?.confirmado) return { acao: "nada" };
    const ultima = typeof pago.latestPurchaseDateMillis === "number" ? pago.latestPurchaseDateMillis : null;
    const original = typeof pago.originalPurchaseDateMillis === "number" ? pago.originalPurchaseDateMillis : ultima;
    // vitalício/sem data, renovação antiga ou pagamento de mais de 7 dias: fora
    if (ultima === null || original === null) return { acao: "nada" };
    if (agora - original > ORIGINAL_ATE_DIAS * 86_400_000) return { acao: "nada" };
    if (agora - ultima > DIAS_DA_SEMANA_DO_PAGANTE * 86_400_000) return { acao: "nada" };
    // já armada pelo fim do teste: mantém o começo (é o mesmo momento, ± minutos) e só confirma
    const inicioMs = atual && Math.abs(atual.inicioMs - ultima) < 2 * 86_400_000 ? atual.inicioMs : ultima;
    return { acao: "armar", estado: { v: 1, inicioMs, origem: atual?.origem ?? "compra", confirmado: true } };
  }
  const teste = lista.find((e) => e.periodType === "TRIAL");
  if (teste) {
    if (teste.willRenew === false || teste.unsubscribeDetectedAt) return atual ? { acao: "cancelar" } : { acao: "nada" };
    const fim = typeof teste.expirationDateMillis === "number" ? teste.expirationDateMillis : null;
    if (fim === null || fim <= agora) return { acao: "nada" };
    if (atual && atual.inicioMs === fim) return { acao: "nada" };
    return { acao: "armar", estado: { v: 1, inicioMs: fim, origem: "fim_do_teste" } };
  }
  return { acao: "nada" };
}

/**
 * Boot (revenuecat.conferirTrialCartao, só pra quem o banco diz que é assinante): aplica a
 * decisão e pede o reagendamento ao hook do lembrete (use-lembrete-dia2 escuta EVENTO_DIA2 e
 * chama sincronizarLembreteDia2, que sincroniza a semana com a chave e o leitor da conta).
 */
export function conferirSemanaDoPagante(
  ativos: Record<string, EntitlementDaLoja> | null | undefined,
  agora: number = Date.now(),
): DecisaoSemana["acao"] {
  const atual = lerSemanaDoPagante();
  const d = decidirSemanaDoPagante(ativos, atual, agora);
  if (d.acao === "nada") return "nada";
  gravarSemanaDoPagante(d.acao === "armar" ? d.estado : null);
  trackEvent("semana_pagante_estado", d.acao === "armar" ? { acao: "armar", origem: d.estado.origem, confirmado: !!d.estado.confirmado } : { acao: "cancelar" });
  try { window.dispatchEvent(new Event(EVENTO_DIA2)); } catch { /* sem window */ }
  return d.acao;
}

/* ------------------------------------------------------------ o conteúdo */

export const MODULOS_QUE_SEGURAM = ["financas", "rotina", "saude"] as const satisfies readonly ModuloDaMissao[];
export type ModuloQueSegura = (typeof MODULOS_QUE_SEGURAM)[number];

/** Três textos por módulo — o rodízio nunca repete o mesmo texto na semana. */
export const TEXTOS_DA_SEMANA: Record<ModuloQueSegura, ReadonlyArray<{ title: string; body: string }>> = {
  financas: [
    { title: "Quanto dá pra gastar hoje?", body: "Anota o 1º gasto do dia em Finanças — 10 segundos e o mês fica no controle." },
    { title: "Um gasto anotado agora poupa um susto no fim do mês", body: "Leva 10 segundos em Finanças. O CORE soma e mostra quanto sobra." },
    { title: "As contas da semana estão no radar?", body: "Confere em Finanças o que vence e marca o que já foi pago." },
  ],
  rotina: [
    { title: "Seus hábitos de hoje estão te esperando", body: "Marca os quadradinhos na Rotina — 10 segundos e a sequência continua." },
    { title: "O que entra no seu dia hoje?", body: "Põe 1 tarefa na Rotina e risca quando fizer. Dia planejado, cabeça leve." },
    { title: "Mais um dia pra sua sequência", body: "Abre a Rotina e marca o que você já fez hoje." },
  ],
  saude: [
    { title: "Já bebeu água hoje?", body: "Marca o 1º copo em Saúde — o CORE acompanha a meta do dia." },
    { title: "Como foi a noite?", body: "Anota o sono em Saúde e vê a sua semana tomando forma." },
    { title: "Um minuto pra você", body: "Água, sono e remédios do dia num lugar só — abre a Saúde." },
  ],
};
export const TEXTO_DO_DOMINGO = {
  title: "Domingo é dia de olhar a semana",
  body: "Abre o CORE e vê como foi: gastos, hábitos e saúde num lugar só. 1 minuto pra planejar a próxima.",
  rota: "/home",
} as const;

/** O primeiro do rodízio: o dos 3 que a pessoa mais usa (empate/nada: Finanças). */
export function primeiroDoRodizio(get: Leitor): ModuloQueSegura {
  try {
    const n = registrosPorModulo(get);
    let melhor: ModuloQueSegura = "financas";
    for (const m of MODULOS_QUE_SEGURAM) if (n[m] > n[melhor]) melhor = m;
    return melhor;
  } catch { return "financas"; }
}

export interface AvisoDaSemana {
  id: number;
  /** 1..7 */
  dia: number;
  quando: Date;
  title: string;
  body: string;
  rota: string;
  modulo: ModuloQueSegura | "resumo";
  temNumero: boolean;
}

export type PlanoSemana =
  | { ok: true; avisos: AvisoDaSemana[] }
  | { ok: false; motivo: "desligado" | "sem_estado" | "sem_aviso" | "fim_da_semana" };

/**
 * Os avisos que AINDA cabem (futuros, depois de hoje), com id = BASE + dia.
 * `hora` em minutos desde 0h (ou "sem"); por padrão a hora de uso do lembrete do dia 2.
 */
export function planejarSemanaDoPagante(
  get: Leitor,
  estado: EstadoSemanaPagante | null,
  p: { ligado: boolean; agora?: Date; hora?: number | "sem" },
): PlanoSemana {
  if (!p.ligado) return { ok: false, motivo: "desligado" };
  if (!estado) return { ok: false, motivo: "sem_estado" };
  const agora = p.agora ?? new Date();
  const hora = p.hora ?? (() => { const e = lerDia2(); return e ? horaDoLembrete(e) : clampHora(19 * 60); })();
  if (hora === "sem") return { ok: false, motivo: "sem_aviso" };
  const h = clampHora(hora);

  // os 7 horários: a 1ª ocorrência da hora depois do começo, e um por dia daí em diante
  const diaInicio = localDayKey(new Date(estado.inicioMs));
  const emDia = (dia: string) => { const [y, m, d] = dia.split("-").map(Number); return new Date(y, m - 1, d, Math.floor(h / 60), h % 60, 0, 0); };
  let primeiro = diaInicio;
  if (emDia(primeiro).getTime() <= estado.inicioMs) primeiro = somarDias(primeiro, 1);

  const hoje = localDayKey(agora);
  const amanha = somarDias(hoje, 1);
  const inicioRodizio = MODULOS_QUE_SEGURAM.indexOf(primeiroDoRodizio(get));
  const usados: Record<ModuloQueSegura, number> = { financas: 0, rotina: 0, saude: 0 };
  const avisos: AvisoDaSemana[] = [];
  let girou = 0;
  for (let dia = 1; dia <= DIAS_DA_SEMANA_DO_PAGANTE; dia++) {
    const chaveDia = somarDias(primeiro, dia - 1);
    const quando = emDia(chaveDia);
    const domingo = quando.getDay() === 0;
    let aviso: Omit<AvisoDaSemana, "id" | "dia" | "quando">;
    if (domingo) {
      aviso = { title: TEXTO_DO_DOMINGO.title, body: TEXTO_DO_DOMINGO.body, rota: TEXTO_DO_DOMINGO.rota, modulo: "resumo", temNumero: false };
    } else {
      const modulo = MODULOS_QUE_SEGURAM[(inicioRodizio + girou) % MODULOS_QUE_SEGURAM.length];
      girou += 1;
      const texto = TEXTOS_DA_SEMANA[modulo][usados[modulo] % TEXTOS_DA_SEMANA[modulo].length];
      usados[modulo] += 1;
      aviso = { title: texto.title, body: texto.body, rota: MODULOS[modulo].rota, modulo, temNumero: false };
      // o de AMANHÃ sai com o dado mais novo dela, quando há número (o texto é fixo depois de agendado)
      if (chaveDia === amanha) {
        try {
          const c = conteudoDoModulo(get, modulo, quando, hoje);
          if (c.temNumero) aviso = { title: c.title, body: c.body, rota: c.rota, modulo, temNumero: true };
        } catch { /* fica o texto do rodízio */ }
      }
    }
    // hoje ela já abriu o app; o passado não se agenda
    if (chaveDia <= hoje || quando.getTime() <= agora.getTime()) continue;
    avisos.push({ id: BASE_SEMANA_PAGANTE + dia, dia, quando, ...aviso });
  }
  if (!avisos.length) return { ok: false, motivo: "fim_da_semana" };
  return { ok: true, avisos };
}

/** A assinatura do plano: igual à última → nada a refazer no sistema. */
export const assinaturaDaSemana = (plano: PlanoSemana): string =>
  plano.ok === true ? plano.avisos.map((a) => `${a.id}@${a.quando.toISOString()}|${a.title}|${a.body}`).join("#") : `motivo:${plano.motivo}`;

/** Os dias locais ("YYYY-MM-DD") que a semana do pagante cobre — o lembrete do dia 2 cede esses. */
export const diasCobertos = (plano: PlanoSemana): string[] => (plano.ok === true ? plano.avisos.map((a) => localDayKey(a.quando)) : []);
