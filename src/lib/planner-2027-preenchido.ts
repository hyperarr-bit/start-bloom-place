/**
 * O PLANNER QUE SE PREENCHE SOZINHO (31/10, novidades-guardadas/2026-10-31/upsell-tela-cheia/BRIEF.md).
 *
 * As folhas "Meu mês" (Finanças) e "Minha semana" (Rotina) do planner 2027 saem PREENCHIDAS com o mês e a semana ATUAIS
 * quando ela tem dados no CORE — como o export do Codex (FinanceNotebookShare / RotinaCodexShare), mas lendo os módulos
 * de HOJE do app. Sem dados = null (a folha sai no modelo com linhas, como antes). Cada vez que o planner abre, isto é
 * lido de novo: o planner baixado sai sempre atualizado.
 *
 * Tudo puro (recebe `get` e `agora`) e tolerante: formato estranho vira lista vazia, nunca "NaN"/"undefined".
 *
 * Finanças (perfil ativo, etiqueta `perfil` — doPerfil):
 *   finance-incomes / finance-expenses   só os itens com data NO MÊS ATUAL
 *   finance-fixed-expenses               entram todo mês
 *   finance-installments                 somaParcelasDoMes, só se finance-last-seen-month = mês atual
 *   finance-dueDays                      as contas do mês com ✓ (mês visto ≠ atual: vencimentos saem dos fixos, sem ✓)
 *   finance-category-budgets(-perfis)    limite por categoria
 *   despesas = variáveis + fixos + parcelas + contas avulsas (a MESMA regra do app: finance-totals.ts)
 * Rotina:
 *   rotina-habits + rotina-habits-checked + rotina-habits-week (carimbo: outra semana = nada marcado)
 *   rotina-schedule {"7:00": {Segunda: "…"}} + rotina-compromissos (ocorrencias da semana) → agenda por horário
 *   rotina-urgencies (não feitas) → "O que importa"
 */
import { doPerfil, doPerfilDueDays, PERFIL_PESSOAL, PERFIL_TODOS } from "@/lib/finance-perfil";
import { computeLooseBillsOutflow, computeMonthlyOutflow } from "@/lib/finance-totals";
import { somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";
import { nomesDosHabitos, DIAS_DA_ROTINA } from "@/lib/rotina-habitos";
import { ocorrencias } from "@/lib/compromissos";
import { localDayKey } from "@/lib/utils";

export interface LinhaDoMes { dia: number | null; nome: string; valor: number }
export interface MesDoPlanner {
  /** "Outubro de 2026" */
  rotulo: string;
  receitas: LinhaDoMes[];
  gastos: LinhaDoMes[];
  totalReceitas: number;
  /** variáveis (o total do bloco Gastos) */
  totalGastos: number;
  /** a saída do mês inteira (variáveis + fixos + parcelas + avulsas) — o cartão "Despesas" */
  totalDespesas: number;
  orcamento: { nome: string; gastei: number; limite: number }[];
  vencimentos: { nome: string; dia: number | null; valor: number; paga: boolean }[];
}
export interface SemanaDoPlanner {
  /** "26 de out a 1 de nov" */
  rotulo: string;
  /** o dia do mês de seg…dom */
  dias: number[];
  habitos: { nome: string; feitos: boolean[] }[];
  agenda: { hora: string; celulas: string[] }[];
  importa: string[];
}
type Get = <T>(k: string, f: T) => T;

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_DA_AGENDA_ROTINA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const MAX_HORARIOS_DA_AGENDA = 4;

const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((i): i is Record<string, unknown> => !!i && typeof i === "object") : []);
const limpa = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Os nomes das categorias do app (src/lib/finance-categories.ts — lá importa React; aqui só os rótulos). */
const ROTULO_DA_CATEGORIA: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado", transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  entretenimento: "Entretenimento", saude: "Saúde", farmacia: "Farmácia", vestuario: "Vestuário", beleza: "Beleza", educacao: "Educação",
  eletronicos: "Eletrônicos", servicos: "Serviços", delivery: "Delivery", presente: "Presente", casa: "Casa", pets: "Pets", filhos: "Filhos",
  viagem: "Viagem", outros: "Outros", moradia: "Moradia", contas_casa: "Contas da casa", plano_saude: "Plano de saúde", academia: "Academia",
  assinaturas: "Assinaturas", internet_telefone: "Internet e telefone", seguros: "Seguros", impostos: "Impostos", dividas: "Dívidas",
};
function rotuloDaCategoria(valor: string, custom: Map<string, string>): string {
  if (!valor) return "Outros";
  return custom.get(valor) ?? ROTULO_DA_CATEGORIA[valor] ?? (valor.charAt(0).toUpperCase() + valor.slice(1).replace(/_/g, " "));
}

const mesIdDe = (agora: Date) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
const diaDe = (data: unknown): number | null => {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(data)) return null;
  const d = Number(data.slice(8, 10));
  return d >= 1 && d <= 31 ? d : null;
};

/** O mês ATUAL do Finanças (null = nada do Finanças pra pôr na folha: o modelo com linhas). */
export function lerMesDoPlanner(get: Get, agora: Date = new Date()): MesDoPlanner | null {
  const perfilBruto = get<unknown>("finance-perfil-ativo", PERFIL_PESSOAL);
  const perfil = typeof perfilBruto === "string" && perfilBruto && perfilBruto !== PERFIL_TODOS ? perfilBruto : PERFIL_PESSOAL;
  const mesId = mesIdDe(agora);
  const visto = get<unknown>("finance-last-seen-month", "");
  const mesVisto = visto === `${MESES[agora.getMonth()]}-${agora.getFullYear()}`;
  /** o item é deste mês: com data, a data; sem data, só se o Finanças já virou pro mês atual */
  const doMes = (i: Record<string, unknown>) => (typeof i.date === "string" && /^\d{4}-\d{2}/.test(i.date) ? i.date.startsWith(mesId) : mesVisto);

  const incomes = doPerfil(lista(get<unknown>("finance-incomes", [])), perfil).filter(doMes);
  const expenses = doPerfil(lista(get<unknown>("finance-expenses", [])), perfil).filter(doMes);
  const fixed = doPerfil(lista(get<unknown>("finance-fixed-expenses", [])), perfil);
  const parcelas = mesVisto ? doPerfil(lista(get<unknown>("finance-installments", [])), perfil) : [];
  const dueDaysBrutos = mesVisto ? lista(get<unknown>("finance-dueDays", [])).filter((d) => Number.isInteger(d.day) && Array.isArray(d.bills)) : [];
  const dueDays = doPerfilDueDays(dueDaysBrutos as unknown as { day: number; bills: Record<string, unknown>[] }[], perfil);

  const linha = (i: Record<string, unknown>, rotuloPadrao: string): LinhaDoMes => ({
    dia: diaDe(i.date), nome: limpa(i.description ?? i.name, 60) || rotuloPadrao, valor: centavos(Math.max(0, num(i.value ?? i.amount))),
  });
  const receitas = incomes.map((i) => linha(i, "Receita")).filter((l) => l.valor > 0).sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0));
  const gastos = expenses.map((i) => linha(i, "Gasto")).filter((l) => l.valor > 0).sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0));

  const somaVar = expenses.reduce((s, e) => s + Math.max(0, num(e.value)), 0);
  const somaFixos = fixed.reduce((s, e) => s + Math.max(0, num(e.value ?? e.amount)), 0);
  const somaParcelas = somaParcelasDoMes(parcelas as unknown as Parcela[]);
  const avulsas = computeLooseBillsOutflow(dueDays, fixed);
  const totalDespesas = centavos(computeMonthlyOutflow(somaVar, somaFixos, somaParcelas, avulsas));
  const totalReceitas = centavos(incomes.reduce((s, i) => s + Math.max(0, num(i.value)), 0));

  // vencimentos: as contas do mês (com ✓) — sem o mês visto, os fixos com dia, sem ✓
  const contasDoMes = dueDays.flatMap((d) => (d.bills ?? []).filter((b) => b && typeof b === "object").map((b) => ({
    nome: limpa(b.name ?? b.description, 60), dia: Number.isInteger(d.day) && d.day >= 1 && d.day <= 31 ? d.day : null,
    valor: centavos(Math.max(0, num(b.value))), paga: b.paid === true,
  }))).filter((c) => c.nome);
  const vencimentos = (contasDoMes.length ? contasDoMes : fixed.map((f) => {
    const dia = Number(f.day);
    return { nome: limpa(f.description ?? f.name, 60), dia: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null, valor: centavos(Math.max(0, num(f.value ?? f.amount))), paga: false };
  }).filter((c) => c.nome)).sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99));

  // orçamento: as categorias com limite (maiores primeiro); sem limite nenhum, as que mais gastaram (o limite fica pra escrever)
  const custom = new Map(lista(get<unknown>("finance-custom-categories", [])).map((c) => [String(c.value ?? ""), limpa(c.label, 30)] as const).filter(([v, l]) => v && l));
  const limites: Record<string, unknown> = perfil === PERFIL_PESSOAL
    ? (get<unknown>("finance-category-budgets", {}) as Record<string, unknown>) ?? {}
    : ((get<unknown>("finance-category-budgets-perfis", {}) as Record<string, Record<string, unknown>>) ?? {})[perfil] ?? {};
  const gasto = new Map<string, number>();
  for (const e of [...expenses, ...fixed]) {
    const c = typeof e.category === "string" ? e.category : "outros";
    gasto.set(c, (gasto.get(c) ?? 0) + Math.max(0, num(e.value ?? e.amount)));
  }
  const comLimite = Object.entries(limites && typeof limites === "object" && !Array.isArray(limites) ? limites : {})
    .map(([c, v]) => ({ c, limite: centavos(Math.max(0, num(v))) })).filter((x) => x.limite > 0).sort((a, b) => b.limite - a.limite);
  const orcamento = (comLimite.length
    ? comLimite.map((x) => ({ nome: rotuloDaCategoria(x.c, custom), gastei: centavos(gasto.get(x.c) ?? 0), limite: x.limite }))
    : [...gasto.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ nome: rotuloDaCategoria(c, custom), gastei: centavos(v), limite: 0 })));

  if (!receitas.length && !gastos.length && !vencimentos.length && !orcamento.length) return null;
  return {
    rotulo: `${MESES[agora.getMonth()]} de ${agora.getFullYear()}`,
    receitas, gastos, totalReceitas, totalGastos: centavos(somaVar), totalDespesas, orcamento, vencimentos,
  };
}

/** "9:00" / "09:30" → "9:00" (a chave da agenda) e minutos pra ordenar */
const normalHora = (h: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(h.trim()); return m ? `${Number(m[1])}:${m[2]}` : ""; };
const minutos = (h: string) => { const [a, b] = h.split(":").map(Number); return ((a === 0 ? 24 : a) * 60) + (b || 0); };

/** A semana ATUAL da Rotina (seg–dom). null = nada da Rotina pra pôr na folha. */
export function lerSemanaDoPlanner(get: Get, agora: Date = new Date()): SemanaDoPlanner | null {
  const seg = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - ((agora.getDay() + 6) % 7));
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + i));
  const semanaId = localDayKey(seg);

  const nomes = nomesDosHabitos(get<unknown>("rotina-habits", [])).map((h) => limpa(h)).filter(Boolean).slice(0, 12);
  const daSemana = get<unknown>("rotina-habits-week", "") === semanaId;
  const checked = daSemana ? (get<unknown>("rotina-habits-checked", {}) as Record<string, unknown>) ?? {} : {};
  const habitos = nomes.map((nome, i) => ({
    nome,
    feitos: DIAS_DA_ROTINA.map((dia) => { const l = (checked as Record<string, unknown>)[dia]; return Array.isArray(l) && l[i] === true; }),
  }));

  // agenda: a grade da Rotina (texto por horário e dia) + os compromissos desta semana, no horário deles
  const porHora = new Map<string, string[][]>();
  const por = (hora: string, dia: number, texto: string) => {
    const h = normalHora(hora);
    if (!h || !texto) return;
    if (!porHora.has(h)) porHora.set(h, Array.from({ length: 7 }, () => []));
    const cel = porHora.get(h)![dia];
    if (!cel.includes(texto)) cel.push(texto);
  };
  const grade = get<unknown>("rotina-schedule", {});
  if (grade && typeof grade === "object" && !Array.isArray(grade)) {
    for (const [hora, linha] of Object.entries(grade as Record<string, unknown>)) {
      if (!linha || typeof linha !== "object") continue;
      DIAS_DA_AGENDA_ROTINA.forEach((dia, i) => por(hora, i, limpa((linha as Record<string, unknown>)[dia], 40)));
    }
  }
  for (const o of ocorrencias(get<unknown>("rotina-compromissos", []) as never, seg, 7)) {
    const i = Math.round((new Date(o.quando.getFullYear(), o.quando.getMonth(), o.quando.getDate()).getTime() - seg.getTime()) / 864e5);
    if (i >= 0 && i < 7) por(o.compromisso.hora, i, limpa(o.compromisso.titulo, 40));
  }
  const horas = [...porHora.entries()]
    .map(([hora, cel]) => ({ hora, cel, n: cel.filter((c) => c.length).length }))
    .filter((x) => x.n > 0)
    // os horários mais cheios (até 4), na ordem do dia
    .sort((a, b) => b.n - a.n || minutos(a.hora) - minutos(b.hora))
    .slice(0, MAX_HORARIOS_DA_AGENDA)
    .sort((a, b) => minutos(a.hora) - minutos(b.hora));
  const agenda = horas.map((x) => ({ hora: x.hora, celulas: x.cel.map((c) => c.join(" · ")) }));

  const importa = lista(get<unknown>("rotina-urgencies", [])).filter((u) => u.done !== true).map((u) => limpa(u.text, 60)).filter(Boolean).slice(0, 8);

  if (!habitos.length && !agenda.length && !importa.length) return null;
  const [a, b] = [diasDaSemana[0], diasDaSemana[6]];
  return {
    rotulo: `${a.getDate()} de ${MESES_CURTOS[a.getMonth()]} a ${b.getDate()} de ${MESES_CURTOS[b.getMonth()]}`,
    dias: diasDaSemana.map((d) => d.getDate()),
    habitos, agenda, importa,
  };
}

/** O mês e a semana pra pôr no planner (o PlannerB lê de novo a cada abertura). */
export const lerMesESemanaDoPlanner = (get: Get, agora: Date = new Date()) => ({ mes: lerMesDoPlanner(get, agora), semana: lerSemanaDoPlanner(get, agora) });
