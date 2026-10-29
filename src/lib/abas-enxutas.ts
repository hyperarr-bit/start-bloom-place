/**
 * PADRÃO ENXUTO DAS ABAS PARA CONTA NOVA (1.0.22, dono 28/10 — "achou completo mas confuso").
 *
 * Com a chave ligada, a conta NOVA (o mesmo marcador de origem "nova" da Home nova — lib/home-nova, `core-home-nova-origem`)
 * abre cada módulo com as abas de pouco uso JÁ ocultas, e no fim da fileira aparece "Mostrar todas as abas". Nada é
 * gravado na conta enquanto a pessoa não mexer: o padrão é calculado na hora. Conta ANTIGA nunca muda sozinha.
 *
 * ┌ COMO PREENCHER ───────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ · A chave do módulo é o mesmo id da rota/ModuleDrawer ("financas", "rotina", "desenvolvimento"…).             │
 * │ · Os valores são os ids das abas (os `id` da lista de abas de cada página), NUNCA a aba de entrada do módulo  │
 * │   nem uma aba que a missão/tutorial aponte (o teste abas-ocultas.test.ts cobra a lista ABAS_QUE_NUNCA_SAEM). │
 * │ · Id que não existe é ignorado (aba renomeada não quebra nada).                                               │
 * │ · Fonte: briefing-codex-modulos/00-VISAO-GERAL.md + METRICAS-<MODULO>.md (28/10) e briefing-codex-financas.   │
 * │   O número de cada aba está no comentário ao lado da lista.                                                   │
 * └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** A chave. LIGADA (dono 28/10: "concordo com tudo, liga") = conta nova começa enxuta; `?abas-enxutas=off` desliga neste
 *  aparelho (QA). Desligada = ninguém recebe o padrão enxuto (o "Organizar abas" funciona igual pra todos). */
export const ABAS_ENXUTAS = true;

/**
 * Abas de pouco uso que a conta nova começa sem ver, por módulo. Fonte: briefing-codex-modulos/00-VISAO-GERAL.md (28/10;
 * pagantes ativos 28/09–27/10; "uso real" = ≥10 s em 2+ dias, em % de quem ABRIU o módulo; viva ≥5%, fraca 1–5%,
 * morta <1%) e briefing-codex-financas. Regra: todas as MORTAS + as fracas que não são a de entrada nem alvo de
 * lembrete/atalho com uso. Link/lembrete/"+" que abre uma aba oculta abre mesmo assim (lib/abas-ocultas).
 */
export const ABAS_POUCO_USO: Readonly<Record<string, readonly string[]>> = {
  // vivas: Meu financeiro 47,6% · Dashboard 28% | ocultas: Investimentos 4,3 · Saúde fin. 3 · Desejos 2,9 · Relatórios 2,8 ·
  // Simuladores 1,4 · Limites 1,3 · Viagem 0,5 (morta; duplica Viagens›Budget)
  financas: ["investimentos", "itens", "viagem", "simuladores", "limites", "relatorios", "saude"],
  // vivas: Minha semana 43,5 · Meu mês 7,9 (abrir no dia 1 → 37% × 24% pagam) · Foco 5,4 | ocultas: Diário 2,2 · Revisão 0,3
  rotina: ["diario", "revisao"],
  // vivas: Hoje 36,2 · Log médico 9,1 | fraca Evolução 4,8 (quase viva, alvo do tutorial) fica
  saude: [],
  // vivas: Plano 19,5 · Hoje 15,4 | fracas Semana 4,2 · Evolução 2,5 ficam (módulo de 4 abas; gravar treino converte)
  treino: [],
  // vivas: Cardápio 19,4 · Diário 6,9 | ocultas: Lista 1,6 · Jejum 0,8 · Receitas 0,6 (avaliação 5★: "ocultar jejum")
  dieta: ["lista", "jejum", "receitas"],
  // vivas: Skincare 23,4 · Cabelo 7,5 · Cuidados 6 | fraca Meus produtos 3,6 fica (4 abas, alvo de link)
  beleza: [],
  // vivas: Cômodos 8,6 · Mercado 6,4 | fraca Despensa 3,9 fica | ocultas: Utilidades 2,5 · Rotina 2,3 · Cardápio 0,7 ·
  // Co-op 0,7 · Segurança 0,7 · Manutenção 0
  casa: ["utilidades", "rotina", "cardapio", "coop", "seguranca", "manutencao"],
  // vivas: Lendo agora 23 · Estante 9,4 | ocultas: Desafio 0,9 · Emprestados 0 · Insights 0
  biblioteca: ["desafio", "emprestados", "insights"],
  // viva: Sobre mim 7,4 | fracas Metas 4,2 (missão) · Humor 2,1 · Diário 2,1 ficam | ocultas: 30 dias 2,3 · Gratidão 1,3
  // (duplica Rotina›Diário e o "+") · Respiração 0,6 · Carta 0,2
  desenvolvimento: ["desafios", "gratidao", "respiracao", "carta"],
  // viva: Estudos 11,3 | fraca Método 2,6 fica (os 5 passos, 22/09) | ocultas: Caderno 1,8 · Tarefas 1,3 · Grade 0,8
  estudos: ["caderno", "tarefas", "grade"],
  // viva: Pessoas 9,9 | Datas 0,8 FICA (alvo do aviso de aniversário) | ocultas: Momentos 1,3 · Presentes 0,3
  relacionamentos: ["momentos", "presentes"],
  // viva: Rastreador 10 | ocultas: Conquistas 0,6 · Stats 0,3 · Diário 0,3
  detox: ["conquistas", "stats", "diario"],
  // nenhuma viva; entrada Dia 4,6 | fracas Metas 3,1 · Ideias 1 (a Ideia do "+" grava aqui) ficam | ocultas: Sonhos 1,3 ·
  // Estratégia 0,3 · Timeline 0 · Busca 0 (Busca/Timeline mostram a mesma lista do Dia)
  hiperfoco: ["sonhos", "estrategia", "timeline", "busca"],
  // viva: Meu dia 8,5 | fraca Vagas 1,4 fica | ocultas: Skills 0,3 · Rede 0,3 · Prep 0 · Portfolio 0
  carreira: ["skills", "network", "interview", "portfolio"],
  // viva: Hoje 8,3 | Saúde 1,3 FICA (alvo do lembrete de vacina, ?aba=saude) | ocultas: Gastos 1 · Diário 0
  pet: ["gastos", "diario"],
  // viva: Destinos 5,1 | fraca Budget 1,3 fica | ocultas (todas <0,5%): Roteiro · Timer · Mala · Lugares · SOS · Passeios ·
  // Rachar · Câmbio · Diário
  viagens: ["cronograma", "countdown", "mala", "lugares", "seguranca", "passeios", "divisor", "moeda", "diario"],
};

/**
 * Abas que o padrão enxuto NUNCA pode esconder: a de entrada de cada módulo e as que a missão do teste / os cartões
 * apontam (MissaoDoTrial, missao-doses/PassoDoDia, cartoes-casa). Esconder uma delas deixaria a dica sem alvo.
 */
export const ABAS_QUE_NUNCA_SAEM: Readonly<Record<string, readonly string[]>> = {
  financas: ["financeiro", "dashboard"],
  rotina: ["semana"],
  treino: ["hoje", "plano"],
  saude: ["hoje"],
  desenvolvimento: ["sobre", "metas"],
  casa: ["comodos", "mercado"],
  viagens: ["destinos"],
  carreira: ["dia"],
  biblioteca: ["lendo"],
  pet: ["hoje"],
  relacionamentos: ["pessoas"],
  dieta: ["cardapio"],
  hiperfoco: ["dia"],
  detox: ["rastreador"],
  estudos: ["estudos"],
  beleza: ["routine"],
};
