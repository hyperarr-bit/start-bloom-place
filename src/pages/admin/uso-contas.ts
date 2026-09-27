/**
 * CONTA DE USO (27/09) — a mesma conta da função admin_uso do banco, em TS.
 *
 * Serve ao modo reserva da aba "Uso" (enquanto a função não está no banco, a
 * tela busca module_analytics pelo REST e agrega aqui) e aos testes: o
 * fixture compara estes números com os do scratchpad/admin/uso.mjs, que é a
 * referência que o dono já usou pra decidir abas (13/09).
 *
 * Regras (iguais às do SQL, supabase/migrations/20260927120000_admin_rapido.sql):
 *  - visita = 1 linha de module_analytics; duração com teto de 1800 s;
 *  - aba vazia ('' ou null) conta no módulo, não na aba;
 *  - mediana = s[floor(n/2)] da lista ordenada (a "de cima" quando n é par);
 *  - voltou = usou em 2+ dias diferentes (dia no calendário de Brasília);
 *  - período anterior = a janela do mesmo tamanho logo antes de `de`;
 *  - cada pessoa entra em "todos" e em "com"/"sem" assinatura.
 */

export const TETO_VISITA_S = 1800;

export type Segmento = "todos" | "com" | "sem";
export const SEGMENTOS: Segmento[] = ["todos", "com", "sem"];

export interface LinhaVisita {
  user_id: string;
  module_id: string;
  tab_id: string | null;
  duration_seconds: number | null;
  entered_at: string;
}

export interface EventoCard {
  user_id: string | null;
  event_name: string;
  modulo: string | null;
  aba: string | null;
  card: string | null;
}

export interface MetricasUso {
  pessoas: number;
  com_assinatura: number;
  visitas: number;
  seg_total: number;
  mediana_seg: number;
  voltaram: number;
  pessoas_ant: number;
  visitas_ant: number;
  seg_total_ant: number;
}
export interface ModuloUso extends MetricasUso { modulo: string }
export interface AbaUso extends MetricasUso { modulo: string; aba: string }
export interface CardUso { modulo: string; aba: string; card: string; viram: number; usaram: number }
export interface TotaisUso {
  ativos: number;
  com_assinatura: number;
  visitas: number;
  seg_total: number;
  voltaram: number;
  ativos_ant: number;
  visitas_ant: number;
  seg_total_ant: number;
}
export interface RecorteUso {
  totais: TotaisUso;
  modulos: ModuloUso[];
  abas: AbaUso[];
  cards: CardUso[];
  /** pessoas por dia, por módulo, alinhado com `dias` */
  serie: Record<string, number[]>;
  ativos_dia: number[];
}
export interface UsoPayload {
  fonte: "sql" | "reserva";
  periodo: { de: string; ate: string; de_anterior: string };
  dias: string[];
  segmentos: Record<Segmento, RecorteUso>;
}

/* ------------------------------------------------------------ datas */

const H3 = 3 * 3600e3;
const DIA_MS = 86400e3;
const dois = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" das partes UTC de um instante (nunca o fuso de quem abre a tela). */
const chaveUTC = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
};

/**
 * Dia no calendário de Brasília ("YYYY-MM-DD") de um instante do banco.
 * É o `(entered_at - interval '3 hours')::date` do SQL: BRT é UTC-3 o ano
 * todo desde 2019. Não é localDayKey de propósito — a conta tem que dar o
 * mesmo dia que a função admin_uso, seja qual for o fuso do navegador.
 */
export const diaBRT = (quando: string | number | Date): string => chaveUTC(new Date(quando).getTime() - H3);

const proximoDia = (d: string) => chaveUTC(Date.parse(`${d}T00:00:00Z`) + DIA_MS);

/** Dias BRT cobertos por [de, ate), em ordem. */
export function diasDoPeriodo(de: string, ate: string): string[] {
  const out: string[] = [];
  const fim = diaBRT(new Date(ate).getTime() - 1);
  for (let d = diaBRT(de); d <= fim; d = proximoDia(d)) out.push(d);
  return out;
}

/**
 * Janela de N dias que começa à meia-noite de Brasília: "7 dias" = hoje + os
 * 6 dias inteiros antes. O período anterior tem o mesmo tamanho.
 */
export function janelaDeDias(dias: number, agora: Date = new Date()): { de: string; ate: string; de_anterior: string } {
  const hoje = diaBRT(agora);
  const inicio = Date.parse(`${hoje}T00:00:00Z`) + H3 - (dias - 1) * DIA_MS;
  const ate = agora.getTime();
  return {
    de: new Date(inicio).toISOString(),
    ate: new Date(ate).toISOString(),
    de_anterior: new Date(inicio - (ate - inicio)).toISOString(),
  };
}

/** Mediana do jeito do uso.mjs: o valor do meio; com n par, o de CIMA. */
export function medianaDeCima(valores: number[]): number {
  if (!valores.length) return 0;
  const s = [...valores].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/* ------------------------------------------------------ agregação */

interface Acumulado {
  pessoas: Set<string>;
  comAssinatura: Set<string>;
  visitas: number;
  seg: number;
  segs: number[];
  diasPorPessoa: Map<string, Set<string>>;
  pessoasAnt: Set<string>;
  visitasAnt: number;
  segAnt: number;
}

const novoAcumulado = (): Acumulado => ({
  pessoas: new Set(), comAssinatura: new Set(), visitas: 0, seg: 0, segs: [],
  diasPorPessoa: new Map(), pessoasAnt: new Set(), visitasAnt: 0, segAnt: 0,
});

function somar(acc: Acumulado, uid: string, assinante: boolean, atual: boolean, seg: number, dia: string) {
  if (atual) {
    acc.pessoas.add(uid);
    if (assinante) acc.comAssinatura.add(uid);
    acc.visitas += 1;
    acc.seg += seg;
    acc.segs.push(seg);
    let dias = acc.diasPorPessoa.get(uid);
    if (!dias) { dias = new Set(); acc.diasPorPessoa.set(uid, dias); }
    dias.add(dia);
  } else {
    acc.pessoasAnt.add(uid);
    acc.visitasAnt += 1;
    acc.segAnt += seg;
  }
}

const voltaram = (acc: Acumulado) => [...acc.diasPorPessoa.values()].filter((d) => d.size >= 2).length;

const metricas = (acc: Acumulado): MetricasUso => ({
  pessoas: acc.pessoas.size,
  com_assinatura: acc.comAssinatura.size,
  visitas: acc.visitas,
  seg_total: acc.seg,
  mediana_seg: medianaDeCima(acc.segs),
  voltaram: voltaram(acc),
  pessoas_ant: acc.pessoasAnt.size,
  visitas_ant: acc.visitasAnt,
  seg_total_ant: acc.segAnt,
});

const SEP = "\u0000";

/** Pessoas que viram / usaram cada card, por recorte. */
export function agregarCards(
  eventos: EventoCard[],
  assinantes: Set<string>,
  excluir: Set<string> = new Set(),
): Record<Segmento, CardUso[]> {
  const mapas: Record<Segmento, Map<string, { viram: Set<string>; usaram: Set<string> }>> = {
    todos: new Map(), com: new Map(), sem: new Map(),
  };
  for (const e of eventos) {
    if (!e.user_id || excluir.has(e.user_id)) continue;
    if (e.event_name !== "card_view" && e.event_name !== "card_interact") continue;
    const chave = [e.modulo || "?", e.aba ?? "", e.card || "?"].join(SEP);
    const segs: Segmento[] = ["todos", assinantes.has(e.user_id) ? "com" : "sem"];
    for (const s of segs) {
      let g = mapas[s].get(chave);
      if (!g) { g = { viram: new Set(), usaram: new Set() }; mapas[s].set(chave, g); }
      (e.event_name === "card_interact" ? g.usaram : g.viram).add(e.user_id);
    }
  }
  const saida = {} as Record<Segmento, CardUso[]>;
  for (const s of SEGMENTOS) {
    saida[s] = [...mapas[s].entries()]
      .map(([k, g]) => {
        const [modulo, aba, card] = k.split(SEP);
        return { modulo, aba, card, viram: g.viram.size, usaram: g.usaram.size };
      })
      .sort((a, b) => cmp(a.modulo, b.modulo) || cmp(a.aba, b.aba) || b.viram - a.viram || b.usaram - a.usaram || cmp(a.card, b.card));
  }
  return saida;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface OpcoesAgregar {
  de: string;
  ate: string;
  assinantes: Set<string>;
  /** contas que não entram (no SQL: is_test_user + e-mail do dono) */
  excluir?: Set<string>;
  cards?: EventoCard[];
  fonte?: UsoPayload["fonte"];
}

/**
 * Agrega linhas de module_analytics do período atual E do anterior (as que
 * caírem fora de [de_anterior, ate) são ignoradas) no mesmo formato que a
 * função admin_uso devolve.
 */
export function agregarUso(linhas: LinhaVisita[], opts: OpcoesAgregar): UsoPayload {
  const deMs = Date.parse(opts.de);
  const ateMs = Date.parse(opts.ate);
  const antMs = deMs - (ateMs - deMs);
  const excluir = opts.excluir ?? new Set<string>();
  const dias = diasDoPeriodo(opts.de, opts.ate);
  const indiceDia = new Map(dias.map((d, i) => [d, i]));

  const tot = {} as Record<Segmento, { ativos: Set<string>; comAss: Set<string>; visitas: number; seg: number; dias: Map<string, Set<string>>; ativosAnt: Set<string>; visitasAnt: number; segAnt: number }>;
  const mods = {} as Record<Segmento, Map<string, Acumulado>>;
  const abas = {} as Record<Segmento, Map<string, Acumulado>>;
  const serieMod = {} as Record<Segmento, Map<string, Array<Set<string>>>>;
  const serieTot = {} as Record<Segmento, Array<Set<string>>>;
  for (const s of SEGMENTOS) {
    tot[s] = { ativos: new Set(), comAss: new Set(), visitas: 0, seg: 0, dias: new Map(), ativosAnt: new Set(), visitasAnt: 0, segAnt: 0 };
    mods[s] = new Map();
    abas[s] = new Map();
    serieMod[s] = new Map();
    serieTot[s] = dias.map(() => new Set<string>());
  }
  const modulosAtuais = new Set<string>();

  for (const l of linhas) {
    const t = Date.parse(l.entered_at);
    if (!(t >= antMs && t < ateMs)) continue;
    if (excluir.has(l.user_id)) continue;
    const atual = t >= deMs;
    const seg = Math.min(l.duration_seconds || 0, TETO_VISITA_S);
    const dia = diaBRT(t);
    const aba = l.tab_id ? l.tab_id : null;
    const assinante = opts.assinantes.has(l.user_id);
    if (atual) modulosAtuais.add(l.module_id);

    for (const s of ["todos", assinante ? "com" : "sem"] as Segmento[]) {
      const T = tot[s];
      if (atual) {
        T.ativos.add(l.user_id);
        if (assinante) T.comAss.add(l.user_id);
        T.visitas += 1;
        T.seg += seg;
        let dd = T.dias.get(l.user_id);
        if (!dd) { dd = new Set(); T.dias.set(l.user_id, dd); }
        dd.add(dia);
      } else {
        T.ativosAnt.add(l.user_id);
        T.visitasAnt += 1;
        T.segAnt += seg;
      }

      let m = mods[s].get(l.module_id);
      if (!m) { m = novoAcumulado(); mods[s].set(l.module_id, m); }
      somar(m, l.user_id, assinante, atual, seg, dia);

      if (aba) {
        const k = l.module_id + SEP + aba;
        let a = abas[s].get(k);
        if (!a) { a = novoAcumulado(); abas[s].set(k, a); }
        somar(a, l.user_id, assinante, atual, seg, dia);
      }

      if (atual) {
        const i = indiceDia.get(dia);
        if (i !== undefined) {
          let sm = serieMod[s].get(l.module_id);
          if (!sm) { sm = dias.map(() => new Set<string>()); serieMod[s].set(l.module_id, sm); }
          sm[i].add(l.user_id);
          serieTot[s][i].add(l.user_id);
        }
      }
    }
  }

  const cards = agregarCards(opts.cards ?? [], opts.assinantes, excluir);
  const segmentos = {} as Record<Segmento, RecorteUso>;
  for (const s of SEGMENTOS) {
    const T = tot[s];
    const serie: Record<string, number[]> = {};
    for (const mod of modulosAtuais) {
      const sm = serieMod[s].get(mod);
      serie[mod] = sm ? sm.map((x) => x.size) : dias.map(() => 0);
    }
    segmentos[s] = {
      totais: {
        ativos: T.ativos.size,
        com_assinatura: T.comAss.size,
        visitas: T.visitas,
        seg_total: T.seg,
        voltaram: [...T.dias.values()].filter((d) => d.size >= 2).length,
        ativos_ant: T.ativosAnt.size,
        visitas_ant: T.visitasAnt,
        seg_total_ant: T.segAnt,
      },
      modulos: [...mods[s].entries()]
        .map(([modulo, acc]) => ({ modulo, ...metricas(acc) }))
        .sort((a, b) => b.pessoas - a.pessoas || cmp(a.modulo, b.modulo)),
      abas: [...abas[s].entries()]
        .map(([k, acc]) => {
          const [modulo, aba] = k.split(SEP);
          return { modulo, aba, ...metricas(acc) };
        })
        .sort((a, b) => cmp(a.modulo, b.modulo) || b.pessoas - a.pessoas || cmp(a.aba, b.aba)),
      cards: cards[s],
      serie,
      ativos_dia: serieTot[s].map((x) => x.size),
    };
  }

  return {
    fonte: opts.fonte ?? "reserva",
    periodo: { de: opts.de, ate: opts.ate, de_anterior: new Date(antMs).toISOString() },
    dias,
    segmentos,
  };
}

/* ------------------------------------------------ leituras prontas */

/** Minutos por pessoa no período. */
export const minutosPorPessoa = (m: Pick<MetricasUso, "seg_total" | "pessoas">): number =>
  m.pessoas > 0 ? m.seg_total / 60 / m.pessoas : 0;

/** Variação de pessoas contra o período anterior (null = não dá pra comparar). */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return atual > 0 ? null : 0;
  return (atual - anterior) / anterior;
}

export interface AbaAvaliada extends AbaUso {
  tipo: "abre_e_sai" | "pouca_gente" | "forte";
  motivo: string;
}

/**
 * Abas fracas e fortes.
 *
 * Régua do uso.mjs (13/09: "≥15 pessoas mas mediana ≤ 12 s, ou < 15 pessoas"),
 * com duas mudanças: o corte de "pouca gente" é proporcional (15 de 1.243
 * ativos ≈ 1,2%), pra valer em 7 ou 90 dias e em qualquer recorte; e aba
 * rápida em que a pessoa VOLTA (Saúde › Hoje, check-in de 10 s) não é fraca —
 * só é "abre e sai" quando menos de 1/3 volta em outro dia.
 * Forte = alcance com hábito: mais gente voltando em 2+ dias.
 */
export function classificarAbas(abas: AbaUso[], ativos: number): { fracas: AbaAvaliada[]; fortes: AbaAvaliada[]; corte: number } {
  const corte = Math.max(5, Math.round(ativos * 0.012));
  const atuais = abas.filter((a) => a.pessoas > 0);
  const pct = (a: AbaUso) => (a.pessoas > 0 ? a.voltaram / a.pessoas : 0);

  const abreESai: AbaAvaliada[] = atuais
    .filter((a) => a.pessoas >= corte && a.mediana_seg <= 12 && pct(a) < 1 / 3)
    .sort((a, b) => b.pessoas - a.pessoas)
    .map((a) => ({ ...a, tipo: "abre_e_sai", motivo: `${a.pessoas} pessoas, ${a.mediana_seg} s por visita, ${Math.round(pct(a) * 100)}% voltaram` }));
  const poucaGente: AbaAvaliada[] = atuais
    .filter((a) => a.pessoas < corte)
    .sort((a, b) => a.pessoas - b.pessoas || a.visitas - b.visitas)
    .map((a) => ({ ...a, tipo: "pouca_gente", motivo: `só ${a.pessoas} ${a.pessoas === 1 ? "pessoa" : "pessoas"} no período` }));
  const fortes: AbaAvaliada[] = atuais
    .filter((a) => a.pessoas >= corte && a.voltaram > 0 && pct(a) >= 0.4)
    .sort((a, b) => b.voltaram - a.voltaram || b.pessoas - a.pessoas)
    .map((a) => ({ ...a, tipo: "forte", motivo: `${a.voltaram} voltaram em 2+ dias (${Math.round(pct(a) * 100)}%), ${a.mediana_seg} s por visita` }));

  return { fracas: [...abreESai, ...poucaGente], fortes, corte };
}
