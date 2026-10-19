/**
 * /hoje VARIANTE "demo" (19/10, `/hoje?v=demo`): o "Ver meu CORE" abre Finanças DE VERDADE (a demo do /preview) com
 * os números da pessoa. Aqui mora só a regra pura: a semente de Finanças (FINANCAS_SEED) com a renda e as contas dela
 * no lugar das do exemplo, e o resto do exemplo (gastos, cartão, metas, histórico) na escala da renda dela.
 *
 * COERÊNCIA DO NÚMERO (o que ela viu no funil = o que o Dashboard mostra):
 *   · o funil diz "R$ X por dia" = (renda − contas) ÷ dias até o fim do mês (calcular → computeDailyBudget);
 *   · o Dashboard faz a MESMA conta, mas tirando também os gastos variáveis e as parcelas do mês. Então:
 *     - NENHUMA parcela (o "Celular novo" de R$ 150/mês do exemplo sairia do número dela);
 *     - os gastos do mês corrente são só 3 pequenos de HOJE (~30% do dia dela, no máximo 5% da sobra do mês; dia
 *       apertado, abaixo de R$ 25: nenhum). O herói fica ~2% abaixo do número do
 *       funil e a linha "já saiu R$ 42 dos R$ 142 do dia" mostra o número EXATO do funil (praHojeDoDia);
 *     - as contas do MEU MÊS saem das contas dela (fixedId), nunca as do exemplo — conta de exemplo sem custo fixo
 *       viraria "conta avulsa" e sairia do saldo (computeLooseBillsOutflow), deixando o número negativo;
 *   · os 4 meses de antes (gráficos, Comparação Mensal) têm a renda e as contas dela e os gastos do exemplo
 *     proporcionais ao que sobra pra ela (sobra positiva quando o mês dela fecha).
 * Nada daqui é gravado: o PreviewUserDataProvider é em memória. A compra continua gravando só renda + contas
 * (itensParaGravar), como antes.
 */
import { calcular, itensParaGravar, type Conta } from "./conteudo";
import { localDayKey } from "@/lib/utils";

/** A renda e a sobra do EXEMPLO (FINANCAS_SEED): 6.200 de salário, 3.104 de fixos. */
const RENDA_DO_EXEMPLO = 6200;
const SOBRA_DO_EXEMPLO = 6200 - 3104;

/** O dia em que cada conta vence na demo (pro MEU MÊS). Internet: daqui a 2 dias (o único alerta, como no exemplo). */
const DIA_DA_CONTA: Record<string, number> = {
  academia: 3, aluguel: 5, condominio: 5, saude: 8, luz: 10, celular: 12, carro: 15, agua: 18, streaming: 20, cartao: 25,
};
const CORES = ["yellow", "slate", "indigo", "emerald", "rose", "cyan", "orange", "purple"];
const NOMES_MES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Lanc = [dia: number, valor: number, categoria: string, descricao: string, pagamento: string, cartao?: string];
/** Os gastos dos 4 meses de antes (os mesmos do exemplo), do mais recente pro mais antigo — escalados pela sobra dela. */
const HISTORICO: Lanc[][] = [
  [[2, 640, "alimentacao", "Mercado do mês", "pix"], [6, 112, "delivery", "iFood", "credito", "nubank"], [9, 131, "transporte", "Uber", "pix"], [13, 168, "restaurante", "Jantar fora", "credito", "nubank"], [16, 62, "lazer", "Cinema", "pix"], [19, 89, "farmacia", "Farmácia", "pix"], [23, 74, "alimentacao", "Padaria", "pix"], [27, 95, "pets", "Petshop", "pix"]],
  [[3, 598, "alimentacao", "Mercado do mês", "pix"], [8, 84, "delivery", "iFood", "credito", "nubank"], [11, 122, "transporte", "Uber", "pix"], [15, 139, "restaurante", "Jantar fora", "credito", "nubank"], [21, 58, "farmacia", "Farmácia", "pix"], [26, 110, "vestuario", "Tênis", "debito"]],
  [[3, 610, "alimentacao", "Mercado do mês", "pix"], [7, 96, "delivery", "iFood", "credito", "nubank"], [10, 118, "transporte", "Uber", "pix"], [14, 145, "restaurante", "Jantar fora", "credito", "nubank"], [15, 76, "lazer", "Cinema", "pix"], [18, 129, "vestuario", "Camiseta", "debito"], [20, 54, "farmacia", "Farmácia", "pix"], [25, 82, "alimentacao", "Padaria", "pix"]],
  [[4, 640, "alimentacao", "Mercado do mês", "pix"], [8, 112, "delivery", "iFood", "credito", "nubank"], [12, 95, "transporte", "Uber", "pix"], [16, 178, "restaurante", "Restaurante", "credito", "nubank"], [17, 150, "lazer", "Show", "pix"], [23, 63, "farmacia", "Farmácia", "pix"], [27, 92, "alimentacao", "Padaria", "pix"]],
];
/** Gasto variável de cada mês do planejamento anual (o exemplo), escalado como o histórico. */
const VARIAVEIS_ANUAL = [1640, 1485, 1590, 1420, 1680, 1520, 1560, 1450, 1610, 1500, 1580, 1470];
/** Limites das categorias VARIÁVEIS do exemplo (as de custo fixo saem das contas dela). */
const LIMITES_VARIAVEIS: Record<string, number> = {
  alimentacao: 900, delivery: 200, transporte: 300, restaurante: 250, farmacia: 120, vestuario: 300, lazer: 200, pets: 150, presente: 150,
};

const arred = (v: number, passo: number) => Math.max(passo, Math.round(v / passo) * passo);
const arredCima = (v: number, passo: number) => Math.ceil(v / passo) * passo;
const ehChaveDoHistorico = (k: string) => /^finance-\d{4}-[a-z]+-(incomes|fixed|expenses|installments)$/.test(k);

export interface DemoDoHoje {
  sementes: Record<string, unknown>;
  /** o número do funil (por dia) e o gasto de exemplo de hoje — pros testes e pro evento */
  porDiaDoFunil: number;
  gastoDeHoje: number;
}

/**
 * As sementes de Finanças da demo do /hoje: `base` = getSeedsForModule("financas") (o PreviewUserDataProvider passa).
 * Troca renda, contas, MEU MÊS, gastos do mês, parcelas, histórico e planejamento; escala metas/aportes/limites.
 */
export function demoDoHoje(base: Record<string, unknown>, renda: number, contas: Conta[], agora: Date = new Date()): DemoDoHoje {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const hoje = agora.getDate();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diaKey = (n: number) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(Math.max(1, n), diasNoMes)).padStart(2, "0")}`;
  const validas = contas.filter((c) => c.valor > 0);
  const r = calcular(renda, validas, agora);
  const { receita, fixos } = itensParaGravar(renda, validas, agora);
  const escala = Math.max(0.15, renda / RENDA_DO_EXEMPLO); // metas, aportes, desejos
  const sobra = Math.max(0, renda - r.fixos);
  const escalaGastos = sobra > 0 ? sobra / SOBRA_DO_EXEMPLO : 0.05; // gasto variável dos meses de antes

  /* as contas dela, com dia de vencimento (viram as contas do MEU MÊS pelo fixedId) */
  const diaInternet = Math.min(hoje + 2, diasNoMes);
  const fixosComDia = fixos.map((f, i) => ({ ...f, day: Math.min(validas[i].id === "internet" ? diaInternet : DIA_DA_CONTA[validas[i].id] ?? 10, diasNoMes) }));
  const porDia = new Map<number, Array<Record<string, unknown>>>();
  for (const f of fixosComDia) {
    const paga = f.day < hoje;
    porDia.set(f.day, [...(porDia.get(f.day) ?? []), { id: `fx-${f.id}`, name: f.description, paid: paga, value: f.value, fixedId: f.id }]);
  }
  const dueDays = [...porDia.entries()].sort((a, b) => a[0] - b[0]).map(([day, bills], i) => ({ day, color: CORES[i % CORES.length], bills }));

  /* gastos de HOJE: pequenos, proporcionais ao dia dela (sem número de dia apertado: nada) */
  const usaCartao = !validas.some((c) => c.id === "cartao"); // escolheu "Cartão": a fatura já é conta dela, sem 2ª fatura
  // ~30% do dia dela, mas nunca mais que 5% da sobra do mês (no fim do mês o "dia" é o mês inteiro que sobrou)
  const dia = r.aperto ? 0 : Math.min(r.porDia, (sobra * 0.05) / 0.3);
  const deHoje = localDayKey(agora);
  const gastos = dia >= 25 ? [
    { id: "hd-e1", date: deHoje, value: Math.round(dia * 0.08), category: "alimentacao", description: "Padaria", paymentMethod: "pix" },
    { id: "hd-e2", date: deHoje, value: Math.round(dia * 0.1), category: "transporte", description: "Uber", paymentMethod: "pix" },
    { id: "hd-e3", date: deHoje, value: Math.round(dia * 0.12), category: "delivery", description: "iFood", ...(usaCartao ? { paymentMethod: "credito", cardName: "nubank" } : { paymentMethod: "pix" }) },
  ] : [];
  const gastoDeHoje = gastos.reduce((s, g) => s + g.value, 0);

  /* os 4 meses de antes: renda e contas dela, gastos do exemplo na escala da sobra dela */
  const historico: Record<string, unknown> = {};
  HISTORICO.forEach((lancs, i) => {
    const d = new Date(ano, mes - (i + 1), 1);
    const a = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const nome = NOMES_MES[d.getMonth()];
    const px = `hd${nome.slice(0, 3)}`;
    const dd = (n: number) => `${a}-${mm}-${String(n).padStart(2, "0")}`;
    historico[`finance-${a}-${nome}-incomes`] = renda > 0 ? [{ id: `${px}-i1`, date: dd(1), value: renda, description: "Renda do mês" }] : [];
    historico[`finance-${a}-${nome}-fixed`] = fixosComDia.map((f, k) => ({ ...f, id: `${px}-f${k + 1}` }));
    historico[`finance-${a}-${nome}-expenses`] = lancs.map(([n, valor, category, description, paymentMethod, cardName], k) => ({
      id: `${px}-e${k + 1}`, date: dd(n), value: Math.max(5, Math.round(valor * escalaGastos)), category, description, paymentMethod,
      ...(cardName && usaCartao ? { cardName } : paymentMethod === "credito" ? { paymentMethod: "pix" } : {}),
    }));
    historico[`finance-${a}-${nome}-installments`] = [];
  });

  /* limites: os variáveis na escala dos gastos; os das contas dela com folga (nenhum aviso de "estourou" de cara) */
  const limites: Record<string, number> = {};
  for (const [cat, v] of Object.entries(LIMITES_VARIAVEIS)) limites[cat] = arred(v * Math.max(escalaGastos, 0.1), 10);
  for (const f of fixosComDia) limites[f.category] = (limites[f.category] ?? 0) + f.value;
  for (const f of new Set(fixosComDia.map((x) => x.category))) limites[f] = arredCima(limites[f] * 1.1, 50);

  const metas = (base["finance-goals"] as Array<Record<string, unknown>> | undefined) ?? [];
  const aportes = (base["finance-investments"] as Array<Record<string, unknown>> | undefined) ?? [];
  const desejos = (base["finance-wishlist"] as Array<Record<string, unknown>> | undefined) ?? [];
  const aporteMensal = arred(500 * escala, 50);

  const sementes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) if (!ehChaveDoHistorico(k)) sementes[k] = v;
  Object.assign(sementes, {
    // sem o perfil "Minha empresa" do exemplo: é o CORE DELA
    "finance-perfis": [],
    "finance-perfil-ativo": "pessoal",
    // a renda entra no dia 1 (o mês "já rodando"), no formato do app
    "finance-incomes": receita.map((x) => ({ ...x, date: diaKey(1) })),
    "finance-fixed-expenses": fixosComDia,
    "finance-dueDays": dueDays,
    "finance-expenses": gastos,
    "finance-installments": [],
    "finance-goals": metas.map((g) => ({
      ...g, targetValue: arred(Number(g.targetValue) * escala, 100), currentValue: arred(Number(g.currentValue) * escala, 100),
    })),
    "finance-investments": aportes.map((x) => ({
      ...x,
      currentValue: arred(Number(x.currentValue) * escala, 10),
      investedAmount: arred(Number(x.investedAmount) * escala, 10),
      monthlyContribution: arred(Number(x.monthlyContribution) * escala, 10),
    })),
    "finance-wishlist": desejos.map((w) => ({ ...w, savedAmount: Math.min(Number(w.price) || 0, arred(Number(w.savedAmount) * escala, 10)) })),
    "finance-category-budgets": limites,
    "finance-notes": [
      { id: "n-1", text: validas.some((c) => c.id === "internet") ? "Renegociar o plano da internet" : "Revisar as assinaturas que não uso" },
      { id: "n-2", text: `Guardar R$ ${aporteMensal.toLocaleString("pt-BR")} na reserva dia 30` },
      { id: "n-3", text: "Conferir a fatura do cartão antes de vencer" },
    ],
    "finance-annual": MESES.map((month, i) => (i < mes
      ? { month, receitas: renda, custosFixos: r.fixos, custosVariaveis: arred(VARIAVEIS_ANUAL[i] * escalaGastos, 10), dividas: 0 }
      : i === mes
        ? { month, receitas: renda, custosFixos: r.fixos, custosVariaveis: gastoDeHoje, dividas: 0 }
        : { month, receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 })),
    "finance-monthly-budgets": MESES.map((month) => ({ month, value: arred(r.fixos + sobra * 0.7, 50), hasNote: false })),
    ...historico,
  });
  return { sementes, porDiaDoFunil: r.porDia, gastoDeHoje };
}
