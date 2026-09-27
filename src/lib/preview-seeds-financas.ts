// Seed do demo de Finanças (/preview/financas) — o formato é idêntico ao que o
// app grava, então o módulo renderiza sem NaN / Invalid Date.
//
// REGRAS deste seed (decisão de produto, 07/2026):
// 1. Estado ASPIRACIONAL: a demo é superfície de venda — mostra uma pessoa
//    organizada (saldo positivo, score alto, metas andando), não um caos com
//    saldo negativo. Um único ponto de atenção fica de propósito (Internet a
//    vencer + moradia perto do limite) pra demonstrar alertas.
// 2. SEM cards mortos: inclui os meses anteriores (maio/junho, chaves
//    finance-2026-<mes>-*) pros gráficos do Dashboard e a Comparação Mensal
//    renderizarem. Se adicionar card novo no app, garanta dado aqui.
// 3. Valores redondos a 2 casas — nada de 416.6666… (o bug do "R$ 416,667").
/* eslint-disable */

// Custos fixos do mês (mesma lista replicada nos meses passados) — total R$ 3.104
// `day` = dia do vencimento: faz o fixo aparecer no calendário MEU MÊS.
/** Dia N do mês CORRENTE como "YYYY-MM-DD". As datas do mês vivo eram fixas
 *  em julho, e apareciam como "2 de jul." dentro de um cabeçalho de setembro —
 *  inclusive nos prints dos posts do Instagram (11/09). */
const diaDoMes = (n: number): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(Math.min(n, 28)).padStart(2, "0")}`;
};

/* Demo relativa a HOJE (26/09, varredura): as contas tinham dia fixo e, do dia
 * 19 em diante, a demo abria com "4 contas atrasadas" — e "Energia" (paga) ao
 * lado de "Energia elétrica" (em aberto), porque o nome da conta não batia com
 * o do fixo e o sync criava outra. Agora as contas saem dos próprios fixos
 * (fixedId), paga = dia já passou, e o único ponto de atenção é a Internet
 * vencendo em 2 dias, em qualquer dia do mês. */
const HOJE = new Date().getDate();
const DIAS_NO_MES = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const DIA_INTERNET = Math.min(HOJE + 2, DIAS_NO_MES);

const FIXED = (prefix: string) => [
  { id: `${prefix}-f1`, value: 1850, cardName: "inter", category: "moradia", description: "Aluguel", paymentMethod: "debito", day: 5 },
  { id: `${prefix}-f2`, value: 420, category: "plano_saude", description: "Plano de saúde", paymentMethod: "boleto", day: 8 },
  { id: `${prefix}-f3`, value: 320, category: "educacao", description: "Curso de inglês", paymentMethod: "pix", day: 15 },
  { id: `${prefix}-f4`, value: 178, category: "contas_casa", description: "Energia elétrica", paymentMethod: "pix", day: 10 },
  { id: `${prefix}-f5`, value: 120, category: "academia", description: "Academia", paymentMethod: "pix", day: 3 },
  { id: `${prefix}-f6`, value: 99, category: "internet_telefone", description: "Internet", paymentMethod: "boleto", day: DIA_INTERNET },
  { id: `${prefix}-f7`, value: 62, category: "contas_casa", description: "Água", paymentMethod: "pix", day: 18 },
  { id: `${prefix}-f8`, value: 55, category: "assinaturas", description: "Streaming", paymentMethod: "credito", cardName: "nubank", day: 20 },
];

// Parcelamento único e pequeno (demonstra o recurso sem afundar o saldo)
const INSTALLMENT = (paid: number) => [{
  id: "inst-1",
  date: "2025-11-15",
  cardName: "nubank",
  category: "eletronicos",
  totalValue: 1800,
  description: "Celular novo",
  installmentValue: 150,
  paidInstallments: paid,
  totalInstallments: 12,
}];

type Lanc = [dia: number, valor: number, categoria: string, descricao: string, pagamento: string, cartao?: string];
/* Os 4 meses de antes, do mais recente pro mais antigo (eram agosto, julho, junho, maio). */
const MODELOS: { parcelasPagas: number; gastos: Lanc[] }[] = [
  { parcelasPagas: 9, gastos: [[2, 640, "alimentacao", "Mercado do mês", "pix"], [6, 112, "delivery", "iFood", "credito", "nubank"], [9, 131, "transporte", "Uber", "pix"], [13, 168, "restaurante", "Jantar fora", "credito", "nubank"], [16, 62, "lazer", "Cinema", "pix"], [19, 89, "farmacia", "Farmácia", "pix"], [23, 74, "alimentacao", "Padaria", "pix"], [27, 95, "pets", "Petshop", "pix"]] },
  { parcelasPagas: 8, gastos: [[3, 598, "alimentacao", "Mercado do mês", "pix"], [8, 84, "delivery", "iFood", "credito", "nubank"], [11, 122, "transporte", "Uber", "pix"], [15, 139, "restaurante", "Jantar fora", "credito", "nubank"], [21, 58, "farmacia", "Farmácia", "pix"], [26, 110, "vestuario", "Tênis", "debito", "inter"]] },
  { parcelasPagas: 8, gastos: [[3, 610, "alimentacao", "Mercado do mês", "pix"], [7, 96, "delivery", "iFood", "credito", "nubank"], [10, 118, "transporte", "Uber", "pix"], [14, 145, "restaurante", "Jantar fora", "credito", "nubank"], [15, 76, "lazer", "Cinema", "pix"], [18, 129, "vestuario", "Camiseta", "debito", "inter"], [20, 54, "farmacia", "Farmácia", "pix"], [22, 120, "presente", "Presente de aniversário", "pix"], [25, 82, "alimentacao", "Padaria", "pix"], [28, 90, "pets", "Petshop", "pix"]] },
  { parcelasPagas: 7, gastos: [[4, 640, "alimentacao", "Mercado do mês", "pix"], [8, 112, "delivery", "iFood", "credito", "nubank"], [12, 95, "transporte", "Uber", "pix"], [16, 178, "restaurante", "Restaurante", "credito", "nubank"], [17, 150, "lazer", "Show", "pix"], [20, 220, "vestuario", "Tênis", "debito", "inter"], [23, 63, "farmacia", "Farmácia", "pix"], [27, 92, "alimentacao", "Padaria", "pix"], [29, 130, "pets", "Petshop", "pix"]] },
];
const NOMES_MES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function mesesAnteriores(): Record<string, any> {
  const out: Record<string, any> = {};
  const hoje = new Date();
  MODELOS.forEach((m, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (i + 1), 1);
    const ano = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const nome = NOMES_MES[d.getMonth()];
    const px = nome.slice(0, 3);
    const dia = (n: number) => `${ano}-${mm}-${String(n).padStart(2, "0")}`;
    out[`finance-${ano}-${nome}-incomes`] = [{ id: `${px}-i1`, date: dia(1), value: 6200, description: "Salário" }];
    out[`finance-${ano}-${nome}-fixed`] = FIXED(px);
    out[`finance-${ano}-${nome}-expenses`] = m.gastos.map(([n, value, category, description, paymentMethod, cardName], k) =>
      ({ id: `${px}-e${k + 1}`, date: dia(n), value, category, description, paymentMethod, ...(cardName ? { cardName } : {}) }));
    out[`finance-${ano}-${nome}-installments`] = INSTALLMENT(m.parcelasPagas);
  });
  return out;
}

export const FINANCAS_SEED: Record<string, any> = {
  // 15/09: um perfil de empresa ao lado do pessoal (09/09: PF × PJ) — a demo
  // mostra o seletor; os lançamentos seguem no pessoal.
  "finance-perfis": [{ id: "pj-demo", nome: "Minha empresa" }],
  "finance-perfil-ativo": "pessoal",
  "finance-last-seen-month": (() => { const d = new Date(); const n = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][d.getMonth()]; return `${n}-${d.getFullYear()}`; })(),
  "finance-streak": 41,
  "finance-lastCheckIn": "2026-07-06",
  "finance-trips": [],

  // ------------------------------------------------------- mês atual (julho)
  "finance-incomes": [
    { id: "i-1", date: diaDoMes(1), value: 6200, description: "Salário" },
  ],
  "finance-fixed-expenses": FIXED("jul"),
  "finance-expenses": [
    { id: "e-1", date: diaDoMes(2), value: 235, category: "alimentacao", description: "Mercado", paymentMethod: "pix" },
    { id: "e-2", date: diaDoMes(3), value: 42, category: "delivery", description: "iFood", paymentMethod: "credito", cardName: "nubank" },
    { id: "e-3", date: diaDoMes(4), value: 38, category: "transporte", description: "Uber", paymentMethod: "pix" },
    { id: "e-4", date: diaDoMes(5), value: 28, category: "farmacia", description: "Farmácia", paymentMethod: "pix" },
    { id: "e-5", date: diaDoMes(5), value: 89, category: "restaurante", description: "Almoço de domingo", paymentMethod: "credito", cardName: "nubank" },
    { id: "e-6", date: diaDoMes(6), value: 32, category: "alimentacao", description: "Padaria", paymentMethod: "pix" },
  ],
  "finance-installments": INSTALLMENT(9),

  "finance-dueDays": (() => {
    const cores = ["yellow", "slate", "indigo", "emerald", "rose", "cyan", "orange", "purple"];
    const porDia = new Map<number, any[]>();
    for (const f of FIXED("jul")) {
      const bill = { id: `fx-${f.id}`, name: f.description, paid: f.description !== "Internet" && f.day < HOJE, value: f.value, fixedId: f.id };
      porDia.set(f.day, [...(porDia.get(f.day) ?? []), bill]);
    }
    return [...porDia.entries()].sort((a, b) => a[0] - b[0]).map(([day, bills], i) => ({ day, color: cores[i % cores.length], bills }));
  })(),
  // Fatura do Nubank DERIVADA (como a de um cliente): cartão com vencimento →
  // "Fatura Nubank · R$ 281" (iFood 42 + restaurante 89 + parcela 150). A conta
  // digitada à mão que existia aqui era contada de novo no "quanto posso gastar".
  "finance-card-config": { nubank: { closingDay: 20, dueDay: 27 } },
  "finance-faturas-pagas": HOJE > 27 ? { [`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}:nubank`]: true } : {},

  // ------------------------------------------------- metas, desejos, aportes
  "finance-goals": [
    { id: "g-1", name: "Reserva de emergência", deadline: "2027-06-30", targetValue: 24000, currentValue: 15600 },
    { id: "g-2", name: "Viagem Fernando de Noronha", deadline: "2026-12-20", targetValue: 8000, currentValue: 5400 },
    { id: "g-3", name: "Trocar de carro", deadline: "2028-06-30", targetValue: 45000, currentValue: 9500 },
  ],
  "finance-wishlist": [
    {
      id: "w-1",
      link: "https://www.amazon.com.br/dp/B0DZK3M8GJ",
      name: "Apple iPad (Wi-Fi, 128 GB) - Prateado",
      price: 3399,
      category: "Outros",
      imageUrl: "https://m.media-amazon.com/images/I/41kLdymn2jL.jpg",
      priority: "media",
      savedAmount: 2550,
    },
  ],
  // 3 tipos → mostra a leitura de diversificação da Saúde Financeira
  "finance-investments": [
    { id: "inv-1", name: "Tesouro Selic", type: "renda_fixa", startDate: "2025-06-01", currentValue: 15100, expectedReturn: 12, investedAmount: 14200, monthlyContribution: 500 },
    { id: "inv-2", name: "ETF BOVA11", type: "renda_variavel", startDate: "2025-09-10", currentValue: 6850, expectedReturn: 15, investedAmount: 6000, monthlyContribution: 300 },
    { id: "inv-3", name: "Bitcoin", type: "cripto", startDate: "2026-01-05", currentValue: 1980, expectedReturn: 20, investedAmount: 1500, monthlyContribution: 100 },
  ],

  // -------------------------------------------------- limites por categoria
  // moradia fica em 1.850/1.900 (97%) de propósito — demonstra o aviso de limite.
  "finance-category-budgets": {
    alimentacao: 900,
    delivery: 200,
    transporte: 300,
    restaurante: 250,
    farmacia: 120,
    vestuario: 300,
    lazer: 200,
    pets: 150,
    presente: 150,
    moradia: 1900,
    contas_casa: 350,
    plano_saude: 450,
    assinaturas: 80,
    academia: 150,
    educacao: 400,
    eletronicos: 300,
    internet_telefone: 120,
  },

  "finance-notes": [
    { id: "n-1", text: "Renegociar plano da internet — promoção até dia 25" },
    { id: "n-2", text: "Aportar R$ 500 no Tesouro Selic dia 30" },
    { id: "n-3", text: "Conferir fatura do cartão antes de vencer" },
  ],

  // -------------------------------------------- planejamento anual e mensal
  "finance-annual": [
    { month: "Janeiro", receitas: 6200, custosFixos: 3104, custosVariaveis: 1640, dividas: 150 },
    { month: "Fevereiro", receitas: 6200, custosFixos: 3104, custosVariaveis: 1485, dividas: 150 },
    { month: "Março", receitas: 6200, custosFixos: 3104, custosVariaveis: 1590, dividas: 150 },
    { month: "Abril", receitas: 6200, custosFixos: 3104, custosVariaveis: 1420, dividas: 150 },
    { month: "Maio", receitas: 6200, custosFixos: 3104, custosVariaveis: 1680, dividas: 150 },
    { month: "Junho", receitas: 6200, custosFixos: 3104, custosVariaveis: 1520, dividas: 150 },
    { month: "Julho", receitas: 6200, custosFixos: 3104, custosVariaveis: 464, dividas: 150 },
    { month: "Agosto", receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 },
    { month: "Setembro", receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 },
    { month: "Outubro", receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 },
    { month: "Novembro", receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 },
    { month: "Dezembro", receitas: 0, custosFixos: 0, custosVariaveis: 0, dividas: 0 },
  ],
  "finance-monthly-budgets": [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ].map((month) => ({ month, value: 4800, hasNote: false })),

  // Os 4 meses ANTERIORES, relativos a hoje (26/09): eram chaves fixas
  // (maio–agosto de 2026). Em outubro, "setembro" não teria arquivo e a
  // Comparação Mensal, os gráficos e a Retrospectiva da demo — a vitrine do
  // funil — abririam vazios. Mesmos valores de antes, datas do mês certo.
  ...mesesAnteriores(),
};
