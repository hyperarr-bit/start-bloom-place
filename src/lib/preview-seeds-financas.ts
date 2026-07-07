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
const FIXED = (prefix: string) => [
  { id: `${prefix}-f1`, value: 1850, cardName: "inter", category: "moradia", description: "Aluguel", paymentMethod: "debito" },
  { id: `${prefix}-f2`, value: 420, category: "plano_saude", description: "Plano de saúde", paymentMethod: "boleto" },
  { id: `${prefix}-f3`, value: 320, category: "educacao", description: "Curso de inglês", paymentMethod: "pix" },
  { id: `${prefix}-f4`, value: 178, category: "contas_casa", description: "Energia elétrica", paymentMethod: "pix" },
  { id: `${prefix}-f5`, value: 120, category: "academia", description: "Academia", paymentMethod: "pix" },
  { id: `${prefix}-f6`, value: 99, category: "internet_telefone", description: "Internet", paymentMethod: "boleto" },
  { id: `${prefix}-f7`, value: 62, category: "contas_casa", description: "Água", paymentMethod: "pix" },
  { id: `${prefix}-f8`, value: 55, category: "assinaturas", description: "Streaming", paymentMethod: "credito", cardName: "nubank" },
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

export const FINANCAS_SEED: Record<string, any> = {
  "finance-last-seen-month": "Julho-2026",
  "finance-streak": 41,
  "finance-lastCheckIn": "2026-07-06",
  "finance-trips": [],

  // ------------------------------------------------------- mês atual (julho)
  "finance-incomes": [
    { id: "i-1", date: "2026-07-01", value: 6200, description: "Salário" },
  ],
  "finance-fixed-expenses": FIXED("jul"),
  "finance-expenses": [
    { id: "e-1", date: "2026-07-02", value: 235, category: "alimentacao", description: "Mercado da semana", paymentMethod: "pix" },
    { id: "e-2", date: "2026-07-03", value: 42, category: "delivery", description: "iFood", paymentMethod: "credito", cardName: "nubank" },
    { id: "e-3", date: "2026-07-04", value: 38, category: "transporte", description: "Uber", paymentMethod: "pix" },
    { id: "e-4", date: "2026-07-05", value: 28, category: "farmacia", description: "Farmácia", paymentMethod: "pix" },
    { id: "e-5", date: "2026-07-05", value: 89, category: "restaurante", description: "Almoço de domingo", paymentMethod: "credito", cardName: "nubank" },
    { id: "e-6", date: "2026-07-06", value: 32, category: "alimentacao", description: "Padaria", paymentMethod: "pix" },
  ],
  "finance-installments": INSTALLMENT(9),

  "finance-dueDays": [
    {
      day: 5, color: "yellow",
      bills: [
        { id: "b-1", name: "Aluguel", paid: true, value: 1850 },
        { id: "b-2", name: "Plano de Saúde", paid: true, value: 420 },
      ],
    },
    {
      day: 10, color: "slate",
      bills: [
        { id: "b-3", name: "Energia", paid: true, value: 178 },
        // Único ponto de atenção do demo: vence em poucos dias → alerta útil
        { id: "b-4", name: "Internet", paid: false, value: 99 },
      ],
    },
    {
      day: 20, color: "indigo",
      bills: [
        { id: "b-5", name: "Streaming", paid: true, value: 55 },
        { id: "b-6", name: "Academia", paid: true, value: 120 },
      ],
    },
    {
      day: 27, color: "emerald",
      bills: [
        // 42 (iFood) + 89 (restaurante) + 150 (parcela do celular) = gastos
        // reais do nubank no mês — a fatura bate com o app de propósito.
        { id: "b-7", name: "Fatura Nubank", paid: false, value: 281 },
      ],
    },
  ],

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

  // --------------------------------------- meses anteriores (junho / maio)
  // Alimentam o gráfico Receitas vs Despesas, a Evolução do Patrimônio e a
  // Comparação Mensal (todos leem estas chaves, não o array do mês atual).
  "finance-2026-junho-incomes": [
    { id: "jun-i1", date: "2026-06-01", value: 6200, description: "Salário" },
  ],
  "finance-2026-junho-fixed": FIXED("jun"),
  "finance-2026-junho-expenses": [
    { id: "jun-e1", date: "2026-06-03", value: 610, category: "alimentacao", description: "Mercado do mês", paymentMethod: "pix" },
    { id: "jun-e2", date: "2026-06-07", value: 96, category: "delivery", description: "iFood", paymentMethod: "credito", cardName: "nubank" },
    { id: "jun-e3", date: "2026-06-10", value: 118, category: "transporte", description: "Uber", paymentMethod: "pix" },
    { id: "jun-e4", date: "2026-06-14", value: 145, category: "restaurante", description: "Jantar fora", paymentMethod: "credito", cardName: "nubank" },
    { id: "jun-e5", date: "2026-06-15", value: 76, category: "lazer", description: "Cinema", paymentMethod: "pix" },
    { id: "jun-e6", date: "2026-06-18", value: 129, category: "vestuario", description: "Camiseta", paymentMethod: "debito", cardName: "inter" },
    { id: "jun-e7", date: "2026-06-20", value: 54, category: "farmacia", description: "Farmácia", paymentMethod: "pix" },
    { id: "jun-e8", date: "2026-06-22", value: 120, category: "presente", description: "Presente de aniversário", paymentMethod: "pix" },
    { id: "jun-e9", date: "2026-06-25", value: 82, category: "alimentacao", description: "Padaria", paymentMethod: "pix" },
    { id: "jun-e10", date: "2026-06-28", value: 90, category: "pets", description: "Petshop", paymentMethod: "pix" },
  ],
  "finance-2026-junho-installments": INSTALLMENT(8),

  "finance-2026-maio-incomes": [
    { id: "mai-i1", date: "2026-05-01", value: 6200, description: "Salário" },
  ],
  "finance-2026-maio-fixed": FIXED("mai"),
  "finance-2026-maio-expenses": [
    { id: "mai-e1", date: "2026-05-04", value: 640, category: "alimentacao", description: "Mercado do mês", paymentMethod: "pix" },
    { id: "mai-e2", date: "2026-05-08", value: 112, category: "delivery", description: "iFood", paymentMethod: "credito", cardName: "nubank" },
    { id: "mai-e3", date: "2026-05-12", value: 95, category: "transporte", description: "Uber", paymentMethod: "pix" },
    { id: "mai-e4", date: "2026-05-16", value: 178, category: "restaurante", description: "Restaurante", paymentMethod: "credito", cardName: "nubank" },
    { id: "mai-e5", date: "2026-05-17", value: 150, category: "lazer", description: "Show", paymentMethod: "pix" },
    { id: "mai-e6", date: "2026-05-20", value: 220, category: "vestuario", description: "Tênis", paymentMethod: "debito", cardName: "inter" },
    { id: "mai-e7", date: "2026-05-23", value: 63, category: "farmacia", description: "Farmácia", paymentMethod: "pix" },
    { id: "mai-e8", date: "2026-05-27", value: 92, category: "alimentacao", description: "Padaria", paymentMethod: "pix" },
    { id: "mai-e9", date: "2026-05-29", value: 130, category: "pets", description: "Petshop", paymentMethod: "pix" },
  ],
  "finance-2026-maio-installments": INSTALLMENT(7),
};
