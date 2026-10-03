/**
 * LEMBRETE DO DIA 2 (e da 1ª semana) — a parte PURA (03/10/2026).
 *
 * Por que existe (medido em 03/10, 364 pagantes de 8–45 dias, iPhone + Android):
 * só 16% ainda usam o app; 62% não abriram nenhuma vez na última semana. O que
 * separa quem fica: voltar no DIA 2 (quem voltou → 24% ficam; quem não voltou →
 * 10%) e usar 4+ dos 7 primeiros dias (77% × 20%). E só 2% de quem sumiu tocou
 * numa notificação na 1ª semana — os lembretes de hoje dependem de a pessoa
 * LIGAR (1 em 4 liga). Este aqui não depende: é UMA notificação local por dia,
 * nos 7 primeiros dias no aparelho, com um motivo concreto pra voltar.
 *
 * As regras, todas aqui (o agendamento de verdade mora em lib/notificacoes):
 *  - QUANDO: amanhã, na hora em que a pessoa abriu o app HOJE pela 1ª vez,
 *    limitada a 08:00–21:30. Se a Missão em doses combinou uma hora
 *    ("Te lembro às 20h"), essa hora vale a semana inteira — escolha explícita
 *    ganha de inferência. "sem aviso" na missão = nenhum lembrete da semana.
 *  - A cada abertura o pendente é cancelado e refeito pra amanhã: quem abriu
 *    antes da hora não recebe o de hoje (já voltou). No máximo 1 por dia.
 *  - PARA no dia 8: o lembrete só é marcado enquanto AMANHÃ ainda é ≤ dia 7.
 *  - "1º uso no aparelho" = o dia em que o app logado abriu pela 1ª vez aqui —
 *    MAS nunca antes do dia em que a conta nasceu: quem é cliente há meses e
 *    atualizou pra 1.0.10 (ou trocou de celular) NÃO ganha uma semana de aviso.
 *  - CONTEÚDO: calculado na hora de agendar (notificação local tem texto fixo),
 *    com dado da própria pessoa, do módulo que ela mais usou — e, enquanto há
 *    Missão em doses com passo pendente, é o passo de amanhã ("Dia 2 da missão:
 *    Rotina"). Uma notificação só: a missão e o dia 2 nunca duplicam.
 *
 * O estado mora no localStorage do APARELHO (`core-dia2`, mantida nas duas
 * listas KEEP do logout — use-auth e use-user-data), como a Missão do iPhone.
 */
import { isNativeShell } from "./native-shell";
import { localDayKey } from "./utils";
import { CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, diasEfetivos, somarDias } from "./sequencia";
import { computeDailyBudget, computeMonthlyOutflow } from "./finance-totals";
import { somaParcelasDoMes, type Parcela } from "./finance-parcelas";
import { reais } from "./dinheiro";
import {
  MODULOS, MODULO_DA_AREA, ORDEM_MODULOS, diaDaMissao, missaoCumprida, passoPendente,
  type EstadoMissaoDoses, type Lembrete, type ModuloDaMissao,
} from "./missao-doses";
import type { AreaKey } from "./funnel";

export const CHAVE_DIA2 = "core-dia2";
/** Faixa de id própria (as outras: 700000 resgate, 800000 teste, 900000 missão, 920000 cobrança). */
export const BASE_DIA2 = 930000;
export const ID_DIA2 = BASE_DIA2 + 1;
/** Quantos dias desde o 1º uso o lembrete acompanha (o do dia 8 não existe). */
export const DIAS_DE_LEMBRETE = 7;
export const HORA_MIN = 8 * 60;
export const HORA_MAX = 21 * 60 + 30;
/** Quem quer reagendar (a missão combinou a hora, a pré-folha decidiu a permissão) dispara isto. */
export const EVENTO_DIA2 = "lembrete-dia2:reagendar";

export type Leitor = <T>(key: string, fallback: T) => T;

export interface EstadoDia2 {
  v: 1;
  /** o dia local do 1º uso neste aparelho (nunca antes do dia da conta) */
  primeiroUso: string;
  /** a 1ª abertura de HOJE: o dia e os minutos desde 0h */
  abertura?: { dia: string; min: number };
  /** combinada na comemoração da missão: minutos desde 0h, ou "sem" (= nenhum lembrete da semana) */
  horaEscolhida?: number | "sem";
  /** a permissão foi pedida (ou adiada) uma vez — não insiste */
  permissao?: { dia: string; resultado: string; origem: string };
  /** o último agendamento (ou o último motivo de não agendar), pra não refazer igual */
  ultimo?: { assinatura: string; quando?: string; title?: string; body?: string; motivo?: string };
}

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

export function lerDia2(): EstadoDia2 | null {
  try {
    const raw = ls.get(CHAVE_DIA2);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoDia2;
    return e && e.v === 1 && typeof e.primeiroUso === "string" ? e : null;
  } catch { return null; }
}
export const gravarDia2 = (e: EstadoDia2): EstadoDia2 => { ls.set(CHAVE_DIA2, JSON.stringify(e)); return e; };
export const apagarDia2 = (): void => ls.del(CHAVE_DIA2);

const minutosDe = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const clampHora = (min: number): number => Math.min(HORA_MAX, Math.max(HORA_MIN, Math.round(min)));
export const rotuloDeMinutos = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Dias inteiros entre dois dias locais ("YYYY-MM-DD"), ao meio-dia pra não tropeçar em horário de verão. */
const diasEntre = (de: string, ate: string): number =>
  Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86_400_000);

/**
 * Registra a abertura de agora. Idempotente dentro do dia: a 1ª abertura de hoje
 * é a que fica (é a hora dela que vira o lembrete de amanhã).
 */
export function registrarAbertura(agora: Date = new Date(), criadoEm?: string | null): EstadoDia2 {
  const hoje = localDayKey(agora);
  let e = lerDia2();
  if (!e) {
    let primeiroUso = hoje;
    // conta antiga: o "1º uso" é o dia da conta — quem já é cliente não ganha a semana de avisos
    if (criadoEm) {
      const d = new Date(criadoEm);
      if (!Number.isNaN(d.getTime())) { const diaConta = localDayKey(d); if (diaConta < hoje) primeiroUso = diaConta; }
    }
    e = { v: 1, primeiroUso };
  }
  if (e.abertura?.dia !== hoje) e = { ...e, abertura: { dia: hoje, min: minutosDe(agora) } };
  return gravarDia2(e);
}

/** O dia do uso em que `dia` cai (1 = o dia do 1º uso). */
export const diaDoUso = (e: EstadoDia2, dia: string): number => diasEntre(e.primeiroUso, dia) + 1;

export const HORA_DA_MISSAO: Record<Lembrete, number | "sem"> = { "8h": 8 * 60, "12h": 12 * 60, "20h": 20 * 60, sem: "sem" };

/** A comemoração da missão combinou a hora: vale a semana toda (escolha explícita > inferência). */
export function combinarHora(l: Lembrete, agora: Date = new Date()): EstadoDia2 {
  const e = lerDia2() ?? registrarAbertura(agora);
  return gravarDia2({ ...e, horaEscolhida: HORA_DA_MISSAO[l] });
}

/** A hora do lembrete: a combinada, senão a da 1ª abertura de hoje (limitada a 08:00–21:30). */
export function horaDoLembrete(e: EstadoDia2): number | "sem" {
  if (e.horaEscolhida !== undefined) return e.horaEscolhida;
  return clampHora(e.abertura?.min ?? 19 * 60);
}

/** Qual chip da comemoração ("8h" | "12h" | "20h") fica pré-marcado: o mais perto da hora em que ela abriu hoje. */
export function horaSugeridaDaMissao(e: EstadoDia2 | null = lerDia2()): Lembrete {
  if (!e || !isNativeShell()) return "12h";
  const h = horaDoLembrete(e);
  if (h === "sem") return "sem";
  const opcoes: Array<["8h" | "12h" | "20h", number]> = [["8h", 8 * 60], ["12h", 12 * 60], ["20h", 20 * 60]];
  return opcoes.reduce((melhor, atual) => (Math.abs(atual[1] - h) < Math.abs(melhor[1] - h) ? atual : melhor))[0];
}

export type QuandoDia2 = { quando: Date; origemHora: "missao" | "abertura" } | { motivo: "sem_aviso" | "fim_da_semana" };

/** Quando sai o próximo lembrete: amanhã, na hora dela — ou por que não sai. */
export function quandoLembrar(e: EstadoDia2, agora: Date = new Date()): QuandoDia2 {
  const amanha = somarDias(localDayKey(agora), 1);
  if (diaDoUso(e, amanha) > DIAS_DE_LEMBRETE) return { motivo: "fim_da_semana" };
  const hora = horaDoLembrete(e);
  if (hora === "sem") return { motivo: "sem_aviso" };
  const [y, m, d] = amanha.split("-").map(Number);
  return { quando: new Date(y, m - 1, d, Math.floor(hora / 60), hora % 60, 0, 0), origemHora: e.horaEscolhida !== undefined ? "missao" : "abertura" };
}

/* ------------------------------------------------------------------ o conteúdo */

export interface ConteudoDia2 {
  title: string;
  body: string;
  /** o módulo do texto, ou "missao" quando é o passo de amanhã da Missão em doses */
  modulo: ModuloDaMissao | "missao";
  /** o texto traz um número da própria pessoa (R$ X, N hábitos, meta de copos…) */
  temNumero: boolean;
  rota: string;
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const mapa = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** Quantos registros há num valor: lista = itens; mapa por dia = o que tem dentro de cada dia. */
const tamanho = (v: unknown): number => {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") {
    return Object.values(v as object).reduce<number>((s, x) => {
      if (Array.isArray(x)) return s + x.filter(Boolean).length;        // {SEGUNDA: [true, false]} → os marcados
      if (x && typeof x === "object") return s + (Object.keys(x as object).length ? 1 : 0);
      if (typeof x === "number") return s + (x > 0 ? 1 : 0);             // {"2026-10-03": 2} → 1 dia com copo
      return s + (x ? 1 : 0);
    }, 0);
  }
  if (typeof v === "number") return v > 0 ? 1 : 0;
  return v ? 1 : 0;
};
const DIAS_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const diaDaRotina = (d: Date) => DIAS_SEMANA[(d.getDay() + 6) % 7];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const soma = (v: unknown) => lista(v).reduce<number>((s, e) => s + (Number(mapa(e).value) || Number(mapa(e).amount) || 0), 0);

/** Quantos registros a pessoa tem em cada módulo (pelas chaves que o módulo grava). */
export function registrosPorModulo(get: Leitor): Record<ModuloDaMissao, number> {
  const out = {} as Record<ModuloDaMissao, number>;
  for (const m of ORDEM_MODULOS) {
    out[m] = MODULOS[m].chaves.reduce((s, k) => { try { return s + tamanho(get<unknown>(k, undefined)); } catch { return s; } }, 0);
  }
  return out;
}

/** O módulo mais usado (empate: a ordem da grade), ou null se nunca registrou nada. */
export function moduloMaisUsado(get: Leitor): ModuloDaMissao | null {
  const n = registrosPorModulo(get);
  let melhor: ModuloDaMissao | null = null;
  for (const m of ORDEM_MODULOS) if (n[m] > 0 && (melhor === null || n[m] > n[melhor])) melhor = m;
  return melhor;
}

/** O texto genérico (bom) de cada módulo, pra quando não há número da pessoa. */
const FALLBACK: Record<ModuloDaMissao, { title: string; body: string }> = {
  financas: { title: "Anota o gasto de hoje", body: "O mês soma sozinho e mostra quanto sobra — leva 10 segundos." },
  rotina: { title: "Monta a sua rotina de hoje", body: "Cria 1 hábito e marca o quadradinho — a sequência começa aí." },
  saude: { title: "Como vai o seu dia na Saúde?", body: "Marca o 1º copo d'água — o CORE acompanha a meta do dia." },
  treino: { title: "Monta o treino de hoje", body: "Anota 1 exercício e a semana ganha forma — 10 segundos." },
  dieta: { title: "Marca a 1ª refeição de hoje", body: "Leva 10 segundos — a Dieta mostra o que falta no dia." },
  desenvolvimento: { title: "Qual meta sai do papel hoje?", body: "Escolhe 1 e quebra em passos — 10 segundos em Metas." },
  hiperfoco: { title: "O que está na sua cabeça hoje?", body: "Anota 1 pensamento no Hiperfoco — sai da cabeça, vai pro papel." },
  estudos: { title: "Qual matéria entra hoje?", body: "Anota nos Estudos e as revisões ficam no lugar." },
  carreira: { title: "Qual é a tarefa do dia?", body: "Anota na Carreira e o dia de trabalho fica num lugar só." },
  biblioteca: { title: "Que livro você está lendo?", body: "Anota na Biblioteca e marca as páginas de hoje." },
  casa: { title: "Falta algo na casa?", body: "Anota 1 item da compra — no mercado, é só marcar." },
  beleza: { title: "Hora da rotina de pele", body: "Marca o 1º passo do skincare de hoje na Beleza." },
  viagens: { title: "Pra onde você quer ir?", body: "Anota 1 destino nas Viagens — depois vem o roteiro." },
  relacionamentos: { title: "Quem importa pra você?", body: "Anota 1 pessoa nas Relações — datas e momentos ficam ligados a ela." },
  pet: { title: "Como está o seu pet hoje?", body: "Marca 1 cuidado do dia — vacina, banho, remédio." },
  detox: { title: "Menos tela hoje?", body: "Marca 1 hábito de detox — um pedaço do dia de volta." },
};

const comModulo = (m: ModuloDaMissao, c: { title: string; body: string }, temNumero: boolean): ConteudoDia2 =>
  ({ ...c, modulo: m, temNumero, rota: MODULOS[m].rota });

/** O texto do módulo, com o número da pessoa quando ele existe. `amanha` é o dia em que a notificação toca. */
export function conteudoDoModulo(get: Leitor, modulo: ModuloDaMissao, amanha: Date, hoje: string = localDayKey()): ConteudoDia2 {
  const fb = FALLBACK[modulo];
  try {
    switch (modulo) {
      case "financas": {
        type Conta = { name?: string; paid?: boolean };
        const dueDays = lista(get<unknown>("finance-dueDays", [])) as Array<{ day?: number; bills?: Conta[] }>;
        const contas = (dia: number) => dueDays.filter((d) => Number(d?.day) === dia).flatMap((d) => lista(d?.bills) as Conta[]).filter((b) => b?.name && !b.paid);
        const depois = new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate() + 1);
        const hojeConta = contas(amanha.getDate())[0];
        if (hojeConta) return comModulo("financas", { title: `${hojeConta.name} vence hoje`, body: "Paga e marca como paga em Finanças — 5 segundos, e o mês fica em dia." }, true);
        const amanhaConta = contas(depois.getDate())[0];
        if (amanhaConta && depois.getMonth() === amanha.getMonth()) return comModulo("financas", { title: `${amanhaConta.name} vence amanhã`, body: "Já está no seu radar em Finanças. Confere se o dinheiro está separado." }, true);
        const receitas = soma(get<unknown>("finance-incomes", []));
        if (receitas > 0) {
          const saida = computeMonthlyOutflow(soma(get<unknown>("finance-expenses", [])), soma(get<unknown>("finance-fixed-expenses", [])), somaParcelasDoMes(lista(get<unknown>("finance-installments", [])) as Parcela[]));
          const orc = computeDailyBudget(receitas, saida, dueDays, lista(get<unknown>("finance-fixed-expenses", [])), amanha);
          if (!orc.cantSpend && orc.perDay > 0) return comModulo("financas", { title: `Hoje dá pra gastar até R$ ${reais(Math.floor(orc.perDay))}`, body: "Sem apertar o mês. Anota o 1º gasto do dia e o CORE recalcula na hora." }, true);
        }
        return comModulo("financas", fb, false);
      }
      case "rotina": {
        const nomes = lista(get<unknown>("rotina-habits", [])).map((h) => (typeof h === "string" ? h : String(mapa(h).name ?? ""))).filter((n) => n.trim());
        if (!nomes.length) return comModulo("rotina", fb, false);
        const seq = calcularSequencia(diasEfetivos(get<unknown>(CHAVE_DIAS_ANOTADOS, undefined), get<unknown>(CHAVE_HUB_STREAK, null), hoje), hoje);
        // só promete a sequência se ela chega viva em amanhã (hoje já anotado)
        const cauda = seq.hojeFeito && seq.dias > 0 ? ` e a sua sequência de ${plural(seq.dias, "dia", "dias")} continua` : "";
        return comModulo("rotina", { title: `${plural(nomes.length, "hábito te esperando", "hábitos te esperando")} hoje`, body: `Marca os quadradinhos — leva 10 segundos${cauda}.` }, true);
      }
      case "treino": {
        const plano = mapa(get<unknown>("saude-workouts-v2", {}));
        const ativos = lista(get<unknown>("treino-active-days", [])) as string[];
        const dia = diaDaRotina(amanha);
        const d = mapa(plano[dia]);
        const musculos = lista(d.muscles).map(String).filter(Boolean);
        const exercicios = lista(d.exercises);
        if (ativos.includes(dia) && musculos.length) return comModulo("treino", { title: `Hoje é treino de ${musculos.slice(0, 2).join(" e ").toLowerCase()}`, body: "Seu treino já tá montado no CORE. Anota as cargas e vê a evolução." }, true);
        if (ativos.includes(dia) && exercicios.length) return comModulo("treino", { title: `Hoje é dia de treino · ${plural(exercicios.length, "exercício", "exercícios")}`, body: "Seu treino já tá montado no CORE. Anota as cargas e vê a evolução." }, true);
        return comModulo("treino", fb, false);
      }
      case "saude": {
        const meta = Number(get<unknown>("core-saude-water-goal", 8)) || 8;
        return comModulo("saude", { title: `Meta de hoje: ${plural(meta, "copo d'água", "copos d'água")}`, body: "O 1º copo conta já de manhã — marca em Saúde e o CORE acompanha o dia." }, true);
      }
      case "dieta": {
        const n = lista(get<unknown>("core-dieta-meals", [])).length;
        return n > 0 ? comModulo("dieta", { title: `${plural(n, "refeição pra marcar", "refeições pra marcar")} hoje`, body: "Marca cada uma e o dia fecha sozinho na Dieta." }, true) : comModulo("dieta", fb, false);
      }
      case "desenvolvimento": {
        const n = lista(get<unknown>("goals-board-v2", [])).length;
        return n > 0 ? comModulo("desenvolvimento", { title: `${plural(n, "meta", "metas")} no seu plano`, body: "Dá 1 passo em uma delas hoje — progresso visível é o que mantém a meta viva." }, true) : comModulo("desenvolvimento", fb, false);
      }
      case "biblioteca": {
        type Livro = { title?: string; status?: string; pages?: number; currentPage?: number };
        const lendo = (lista(get<unknown>("lib-books", [])) as Livro[]).filter((b) => b?.status === "lendo" && b?.title)[0];
        if (!lendo) return comModulo("biblioteca", fb, false);
        const faltam = Math.max(0, (Number(lendo.pages) || 0) - (Number(lendo.currentPage) || 0));
        return comModulo("biblioteca", { title: faltam > 0 ? `Faltam ${plural(faltam, "página", "páginas")} de ${lendo.title}` : `${lendo.title} te espera`, body: "10 minutos hoje já andam bem." }, faltam > 0);
      }
      default:
        return comModulo(modulo, fb, false);
    }
  } catch {
    return comModulo(modulo, fb, false);
  }
}

/** O passo de AMANHÃ da Missão em doses, se há um pendente (uma notificação só: missão e dia 2 não duplicam). */
export function conteudoDaMissao(missao: EstadoMissaoDoses | null, hoje: string = localDayKey()): ConteudoDia2 | null {
  if (!missao || !missao.boasVindas || missaoCumprida(missao)) return null;
  const pendente = passoPendente(missao);
  if (!pendente) return null;
  // missão abandonada há dias: volta ao texto do módulo (o "dia N da missão" já não faz sentido)
  if (diaDaMissao(missao, somarDias(hoje, 1)) > 5) return null;
  const cfg = MODULOS[pendente.modulo];
  const feitos = ([1, 2, 3] as const).filter((n) => missao.feitos[n]).length;
  return {
    title: `🔥 Dia ${pendente.n} da missão: ${cfg.emoji} ${cfg.nome}`,
    body: `${cfg.pedido} — 40 segundos e o passo ${pendente.n} de 3 fica feito${feitos ? ` (${feitos} de 3 já foram)` : ""}.`,
    modulo: "missao",
    temNumero: false,
    rota: cfg.rota,
  };
}

/**
 * O conteúdo do lembrete que toca em `amanha`: o passo da missão, senão o módulo
 * mais usado com o número da pessoa, senão o módulo da área da porta, senão Finanças.
 */
export function conteudoDoLembrete(get: Leitor, p: { missao: EstadoMissaoDoses | null; amanha: Date; area?: string | null; hoje?: string }): ConteudoDia2 {
  const hoje = p.hoje ?? localDayKey();
  const daMissao = conteudoDaMissao(p.missao, hoje);
  if (daMissao) return daMissao;
  const modulo = moduloMaisUsado(get) ?? (p.area && p.area in MODULO_DA_AREA ? MODULO_DA_AREA[p.area as AreaKey] : "financas");
  return conteudoDoModulo(get, modulo, p.amanha, hoje);
}

/* ------------------------------------------------------------------ o plano */

export type PlanoDia2 =
  | { ok: true; quando: Date; origemHora: "missao" | "abertura"; conteudo: ConteudoDia2; diaDoUso: number }
  | { ok: false; motivo: "desligado" | "sem_aviso" | "fim_da_semana" };

/** Tudo o que o agendador precisa, sem tocar no plugin. */
export function planejarLembreteDia2(get: Leitor, e: EstadoDia2, p: { ligado: boolean; missao: EstadoMissaoDoses | null; area?: string | null; agora?: Date }): PlanoDia2 {
  if (!p.ligado) return { ok: false, motivo: "desligado" };
  const agora = p.agora ?? new Date();
  const q = quandoLembrar(e, agora);
  if ("motivo" in q) return { ok: false, motivo: q.motivo };
  const hoje = localDayKey(agora);
  return { ok: true, quando: q.quando, origemHora: q.origemHora, conteudo: conteudoDoLembrete(get, { missao: p.missao, amanha: q.quando, area: p.area, hoje }), diaDoUso: diaDoUso(e, localDayKey(q.quando)) };
}

/** A assinatura do plano: igual à última → nada a refazer no sistema. */
export const assinaturaDoPlano = (plano: PlanoDia2): string =>
  plano.ok === true ? `${plano.quando.toISOString()}|${plano.conteudo.title}|${plano.conteudo.body}` : `motivo:${plano.motivo}`;

/** Dia da semana 1–7 (segunda = 1, domingo = 7), pro evento. */
export const diaDaSemana1a7 = (d: Date): number => ((d.getDay() + 6) % 7) + 1;
