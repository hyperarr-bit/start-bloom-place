// Rótulos legíveis para o painel admin.
// Os eventos/analytics gravam IDs crus (ex.: tab_id="month-turnover", module_id="hiperfoco").
// Aqui traduzimos para texto que faz sentido na UI do admin.
//
// IMPORTANTE: estes mapas espelham os `id`/`v` das abas definidas em cada página de módulo
// (src/pages/*.tsx). Ao adicionar/renomear uma aba no app, atualize aqui também.

export const MODULE_LABELS: Record<string, string> = {
  financas: "Finanças",
  rotina: "Rotina",
  desenvolvimento: "Desenvolvimento",
  saude: "Saúde",
  casa: "Casa",
  estudos: "Estudos",
  biblioteca: "Biblioteca",
  beleza: "Beleza",
  viagens: "Viagens",
  carreira: "Carreira",
  treino: "Treino",
  dieta: "Dieta",
  hiperfoco: "Mente (Hiperfoco)",
  relacionamentos: "Relacionamentos",
  pet: "Pet",
  detox: "Detox",
  conquistas: "Conquistas",
};

// Abas por módulo, keyed por `${module}:${tabId}`.
export const TAB_LABELS: Record<string, string> = {
  // Finanças
  "financas:dashboard": "Dashboard",
  "financas:financeiro": "Meu Financeiro",
  "financas:investimentos": "Investimentos",
  "financas:itens": "Desejos",
  "financas:viagem": "Viagem",
  "financas:simuladores": "Simuladores",
  "financas:limites": "Limites",
  "financas:relatorios": "Relatórios",
  "financas:saude": "Saúde Financeira",
  // Rotina
  "rotina:semana": "Minha Semana",
  "rotina:mes": "Meu Mês",
  "rotina:diario": "Diário",
  "rotina:revisao": "Revisão",
  "rotina:foco": "Foco",
  // Desenvolvimento
  "desenvolvimento:sobre": "Sobre Mim",
  "desenvolvimento:metas": "Metas",
  "desenvolvimento:diario": "Diário",
  "desenvolvimento:humor": "Humor & Score",
  "desenvolvimento:respiracao": "Respiração",
  "desenvolvimento:gratidao": "Gratidão",
  "desenvolvimento:carta": "Carta",
  "desenvolvimento:desafios": "30 Dias",
  // Saúde
  "saude:hoje": "Hoje",
  "saude:evolucao": "Evolução",
  "saude:log": "Log Médico",
  // Casa
  "casa:comodos": "Cômodos",
  "casa:mercado": "Mercado",
  "casa:rotina": "Rotina",
  "casa:despensa": "Despensa",
  "casa:cardapio": "Cardápio",
  "casa:manutencao": "Manutenção",
  "casa:coop": "Co-op",
  "casa:seguranca": "Segurança",
  "casa:utilidades": "Utilidades",
  // Estudos
  "estudos:estudos": "Estudos",
  "estudos:grade": "Grade",
  "estudos:tarefas": "Tarefas",
  "estudos:caderno": "Caderno",
  "estudos:pomodoro": "Pomodoro",
  // Biblioteca
  "biblioteca:lendo": "Lendo Agora",
  "biblioteca:estante": "Estante",
  "biblioteca:insights": "Insights",
  "biblioteca:emprestados": "Emprestados",
  "biblioteca:desafio": "Desafio",
  // Beleza
  "beleza:routine": "Rotina",
  "beleza:shelf": "Bancada",
  "beleza:diary": "Diário",
  // Viagens
  "viagens:destinos": "Destinos",
  "viagens:cronograma": "Roteiro",
  "viagens:mala": "Mala",
  "viagens:budget": "Budget",
  "viagens:divisor": "Rachar",
  "viagens:lugares": "Lugares",
  "viagens:diario": "Diário",
  "viagens:moeda": "Câmbio",
  "viagens:seguranca": "SOS",
  "viagens:countdown": "Timer",
  // Carreira
  "carreira:jobs": "Vagas",
  "carreira:portfolio": "Portfólio",
  "carreira:network": "Rede",
  "carreira:skills": "Skills",
  "carreira:interview": "Prep Entrevista",
  // Treino
  "treino:hoje": "Hoje",
  "treino:semana": "Semana",
  "treino:config": "Config",
  "treino:resumo": "Resumo",
  "treino:progressao": "Progressão",
  "treino:records": "Recordes",
  // Dieta
  "dieta:cardapio": "Cardápio",
  "dieta:jejum": "Jejum",
  "dieta:receitas": "Receitas",
  "dieta:lista": "Lista",
  "dieta:diario": "Diário",
  // Hiperfoco
  "hiperfoco:dia": "Dia",
  "hiperfoco:busca": "Busca",
  "hiperfoco:metas": "Metas",
  "hiperfoco:estrategia": "Estratégia",
  "hiperfoco:timeline": "Timeline",
  "hiperfoco:ideias": "Ideias",
  "hiperfoco:sonhos": "Sonhos",
  // Relacionamentos
  "relacionamentos:pessoas": "Pessoas",
  "relacionamentos:agenda": "Agenda",
  "relacionamentos:momentos": "Momentos",
  "relacionamentos:presentes": "Presentes",
  "relacionamentos:eventos": "Eventos",
  // Pet
  "pet:pets": "Pets",
  "pet:saude": "Saúde",
  "pet:rotina": "Rotina",
  "pet:gastos": "Gastos",
  "pet:diario": "Diário",
  // Detox
  "detox:rastreador": "Rastreador",
  "detox:diario": "Diário",
  "detox:conquistas": "Conquistas",
  "detox:stats": "Stats",
};

// Cards de Finanças (event_data->>'card' em finance_card_view / finance_card_interact)
export const CARD_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "month-comparison": "Comparativo mensal",
  "month-turnover": "Movimentação do mês",
  summary: "Resumo",
  incomes: "Receitas",
  calculator: "Calculadora",
  "fixed-expenses": "Despesas fixas",
  expenses: "Despesas",
  notes: "Notas",
  "bills-due": "Contas a vencer",
  installments: "Parcelamentos",
  "annual-budget": "Orçamento anual",
  "monthly-budget": "Orçamento mensal",
  investments: "Investimentos",
  wishlist: "Lista de desejos",
  "travel-budget": "Orçamento de viagem",
  simulators: "Simuladores",
  "category-budgets": "Limites por categoria",
  reports: "Relatórios",
  "financial-health": "Saúde financeira",
};

export const moduleLabel = (id: string | null | undefined): string =>
  (id && MODULE_LABELS[id]) || id || "(desconhecido)";

export const tabLabel = (moduleId: string, tabId: string | null | undefined): string => {
  if (!tabId || tabId === "(sem aba)") return "Visão geral";
  return TAB_LABELS[`${moduleId}:${tabId}`] || tabId;
};

export const cardLabel = (key: string | null | undefined): string =>
  (key && CARD_LABELS[key]) || key || "—";
