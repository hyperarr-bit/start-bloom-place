import { localDayKey, parseLocalDay } from "@/lib/utils";
import { CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK, calcularSequencia, diasEfetivos, somarDias } from "@/lib/sequencia";
import { aguaDoMes, habitoCampeao, lerDadosDaVida } from "@/lib/retrospectiva";
import { medirVida } from "@/components/gamification/badges-vida";
import { lerMesesArquivados } from "@/components/gamification/badges-financas";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { medirInsignias, type Get, type Insignia } from "@/components/conquistas/insignias";
import { diaDoMes, diasNoMes, mesAno, nomeDoMes } from "./textos";
import type { DadosAgua, DadosAzul, DadosCard, DadosHabitos, DadosLivros, DadosMetas, DadosNumero, DadosPoupanca, DadosSequencia, DadosSono, DadosTreinos, Livro } from "./tipos";

/**
 * OS DADOS DE VERDADE DOS CARDS (29/09): cada card lê a MESMA chave e a
 * MESMA conta que o app já faz (as insígnias, a retrospectiva, o badge de
 * mês no azul) — nada de número paralelo. E só oferece o card com o MÍNIMO
 * que dá orgulho (o Spotify só faz Wrapped com 30 músicas): um card de "1
 * treino" não sai.
 */

export const MINIMOS = {
  treinosNoMes: 4,
  treinosNoTotal: 10,
  poupancaPct: 5,
  livros: 1,
  sequencia: 7,
  aguaDias: 7,
  sonoNoites: 7,
  habitoDias: 7,
  metasFeitas: 1,
} as const;

export interface CardsDoApp {
  treinos?: DadosTreinos;
  treinosTotal?: DadosTreinos;
  azul?: DadosAzul;
  poupanca?: DadosPoupanca;
  livros?: DadosLivros;
  livrosAno?: DadosLivros;
  sequencia?: DadosSequencia;
  agua?: DadosAgua;
  sono?: DadosSono;
  habitos?: DadosHabitos;
  metas?: DadosMetas;
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const ehDia = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Os nomes dos hábitos feitos num dia (lista de nomes ou objeto nome → feito). */
const nomesFeitos = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : Object.entries(objeto(v)).filter(([, f]) => !!f).map(([n]) => n);

/**
 * Todos os cards que a pessoa pode postar HOJE (o mês corrente; o "mês no
 * azul" é o último mês fechado). Sem o mínimo, o card não vem.
 */
export function cardsDoApp(get: Get, hoje: string = localDayKey(), valoresLigados = false): CardsDoApp {
  const agora = parseLocalDay(hoje);
  const ano = agora.getFullYear(), mesIdx = agora.getMonth();
  const prefixo = diaDoMes(ano, mesIdx, 1).slice(0, 8);
  const noMes = (d: unknown): d is string => typeof d === "string" && d.startsWith(prefixo);
  const ler = (k: string) => get<unknown>(k, undefined);
  const vida = medirVida(get, hoje);
  const dados = lerDadosDaVida(ler);
  const M = medirInsignias(get, hoje);
  const out: CardsDoApp = {};

  // treinos (a lista de dias de `saude-workout-log`)
  const treinosMes = vida.treinos.filter(noMes);
  if (treinosMes.length >= MINIMOS.treinosNoMes) {
    out.treinos = { tipo: "treinos", periodo: "mes", ano, mesIdx, hoje, dias: treinosMes, semanasNaMeta: M["tre-semanas"]?.valor ?? vida.semanasNaMeta, recordes: M["tre-recordes"]?.valor ?? 0 };
  }
  if (vida.treinos.length >= MINIMOS.treinosNoTotal) {
    out.treinosTotal = { tipo: "treinos", periodo: "total", ano, mesIdx, hoje, dias: vida.treinos.filter((d) => d <= hoje), semanasNaMeta: vida.semanasNaMeta, recordes: vida.recordesPessoais };
  }

  // mês no azul: a corrida dos meses FECHADOS (do mais recente pra trás), em ordem cronológica
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const corrida = [];
  for (const m of lerMesesArquivados(get, agora, perfil)) {
    if (!m.medido || m.saldo <= 0) break;
    corrida.push({ mes: m.mes, pct: m.receitas > 0 ? Math.round((m.saldo / m.receitas) * 100) : null, saldo: m.saldo });
  }
  if (corrida.length) out.azul = { tipo: "azul", meses: corrida.reverse(), valoresLigados };

  // guardei X% (o mês corrente, a mesma conta da insígnia "Guardei do que ganhei")
  const pct = M["fin-guardei"]?.valor ?? 0;
  if (pct >= MINIMOS.poupancaPct) out.poupanca = { tipo: "poupanca", ano, mesIdx, pct: Math.round(pct), valor: M["fin-sobrou"]?.valor, valoresLigados };

  // livros (lib-books "lido" com a data de fim no mês/ano)
  type LivroSalvo = { title?: unknown; author?: unknown; cover?: unknown; pages?: unknown; status?: unknown; endDate?: unknown };
  const livros = lista(ler("lib-books")) as LivroSalvo[];
  const paraCard = (b: LivroSalvo): Livro => ({ titulo: texto(b.title) || "Sem título", autor: texto(b.author) || undefined, capa: texto(b.cover) || undefined, paginas: Number(b.pages) > 0 ? Number(b.pages) : undefined });
  const lidos = livros.filter((b) => b?.status === "lido" && typeof b.endDate === "string");
  const doMes = lidos.filter((b) => noMes(b.endDate)).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  const doAno = lidos.filter((b) => String(b.endDate).startsWith(`${ano}-`)).sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  if (doMes.length >= MINIMOS.livros) out.livros = { tipo: "livros", periodo: "mes", ano, mesIdx, livros: doMes.map(paraCard), metaDoAno: vida.metaDoAno, noAno: doAno.length };
  if (doAno.length >= 2) out.livrosAno = { tipo: "livros", periodo: "ano", ano, mesIdx, livros: doAno.map(paraCard), metaDoAno: vida.metaDoAno, noAno: doAno.length };

  // sequência (core-dias-anotados + protetores — a mesma conta da Home)
  const efetivos = diasEfetivos(get<unknown>(CHAVE_DIAS_ANOTADOS, undefined), get<unknown>(CHAVE_HUB_STREAK, null), hoje);
  const seq = calcularSequencia(efetivos, hoje);
  if (seq.dias >= MINIMOS.sequencia) {
    const feitos = new Set(efetivos);
    out.sequencia = { tipo: "sequencia", dias: seq.dias, recorde: seq.recorde, ultimos: Array.from({ length: 28 }, (_, i) => feitos.has(somarDias(hoje, i - 27))) };
  }

  // água (water-log + core-saude-water, a maior do dia; a meta da Hidratação)
  const diasAteHoje = Math.min(diasNoMes(ano, mesIdx), agora.getDate());
  const agua = aguaDoMes(ano, mesIdx, dados);
  const porDia = Array.from({ length: diasAteHoje }, (_, i) => (agua.porDia.get(i + 1) ?? 0) / Math.max(1, vida.metaAgua));
  if (porDia.filter((f) => f >= 1).length >= MINIMOS.aguaDias) out.agua = { tipo: "agua", ano, mesIdx, hoje, porDia };

  // sono (sleep-log + core-saude-sleep, a maior da noite)
  const metaSono = Math.min(12, Math.max(4, Number(get<unknown>("core-saude-sleep-goal", 8)) || 8));
  const horas = Array.from({ length: diasAteHoje }, (_, i) => {
    const k = diaDoMes(ano, mesIdx, i + 1);
    const h = Math.max(Number(objeto(dados.sono)[k]) || 0, Number(objeto(dados.sonoHub)[k]) || 0);
    return h > 0 ? h : null;
  });
  if (horas.filter((h) => h != null && h >= metaSono).length >= MINIMOS.sonoNoites) out.sono = { tipo: "sono", ano, mesIdx, horas, meta: metaSono };

  // o hábito campeão do mês (rotina-habit-log + a chave legada)
  const campeao = habitoCampeao(ano, mesIdx, dados);
  if (campeao && campeao.dias >= MINIMOS.habitoDias) {
    const alvo = campeao.nome.toLowerCase();
    const dias = new Set<string>();
    for (const reg of [dados.habitos, dados.habitosLegado]) for (const [k, v] of Object.entries(reg ?? {})) if (ehDia(k) && noMes(k) && nomesFeitos(v).some((n) => n.toLowerCase() === alvo)) dias.add(k);
    out.habitos = { tipo: "habitos", ano, mesIdx, hoje, habito: campeao.nome, dias: [...dias].sort() };
  }

  // as metas do mês (month-goals[AAAA-MM]); os textos só entram com a escolha da pessoa
  type Meta = { text?: unknown; done?: unknown };
  const metas = lista(objeto(ler("month-goals"))[prefixo.slice(0, 7)]) as Meta[];
  const feitas = metas.filter((m) => !!m?.done).length;
  if (feitas >= MINIMOS.metasFeitas) out.metas = { tipo: "metas", ano, mesIdx, feitas, total: metas.length, textos: [...metas.filter((m) => !!m?.done), ...metas.filter((m) => !m?.done)].map((m) => texto(m?.text)) };

  return out;
}

/**
 * O CARD de uma insígnia (a "Minha conquista do mês" do planner): a
 * insígnia que tem card próprio vira ele (treinos → o calendário; mês no
 * azul → a água…); a que não tem vira o card GERAL com o número dela.
 * Sensível (R$, peso) sem "mostrar valores" → null (fica o de hoje).
 */
export function cardDaInsignia(ins: Insignia, cards: CardsDoApp, { mesIdx, ano, valoresLigados = false }: { mesIdx: number; ano: number; valoresLigados?: boolean }): DadosCard | null {
  if (ins.sensivel && !valoresLigados) return null;
  const porId: Record<string, DadosCard | undefined> = {
    "tre-mes": cards.treinos, "tre-semanas": cards.treinos, "tre-recordes": cards.treinos, "tre-total": cards.treinosTotal,
    "fin-azul": cards.azul, "fin-guardei": cards.poupanca,
    "lei-livros": cards.livros, "lei-paginas": cards.livros, "lei-ano": cards.livrosAno,
    "seq-viva": cards.sequencia, "seq-recorde": cards.sequencia,
    "sau-agua": cards.agua, "sau-sono": cards.sono,
    "rot-campeao": cards.habitos,
    "met-mes": cards.metas,
  };
  const proprio = porId[ins.id];
  if (proprio) return proprio;
  if (!ins.temDado) return null;
  const quando = ins.periodo === "mes" ? `em ${nomeDoMes(mesIdx)}` : ins.periodo === "agora" ? "agora" : "desde que comecei";
  const geral: DadosNumero = {
    tipo: "numero",
    modulo: ins.areaNome,
    cor: ins.cor,
    numero: ins.texto,
    rotulo: ins.sub ? `${ins.unid} ${ins.sub}`.trim() : ins.unid || ins.nome.toLowerCase(),
    sub: quando,
    periodo: ins.periodo === "mes" ? mesAno(mesIdx, ano) : "ATÉ AGORA",
  };
  return geral;
}
