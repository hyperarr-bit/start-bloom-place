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
 * │ · Fonte: METRICAS-<MODULO>.md (novidades-guardadas/2026-10-28/briefing-codex-modulos) — "uso real" = ≥10 s em │
 * │   2+ dias. Finanças já preenchida com o briefing-codex-financas; o resto está PRELIMINAR (relatório de 10/10, │
 * │   complexidade_10_10) até a análise de todos os módulos chegar.                                               │
 * └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** A chave. Desligada = ninguém recebe o padrão enxuto (o "Organizar abas" funciona igual pra todos). */
export const ABAS_ENXUTAS = false;

/** Abas de pouco uso que a conta nova começa sem ver, por módulo. */
export const ABAS_POUCO_USO: Readonly<Record<string, readonly string[]>> = {
  // briefing-codex-financas (28/10): uso real Meu financeiro 37,6% · Dashboard 22,1% · o resto 0,4%–3,4%
  financas: ["investimentos", "itens", "viagem", "simuladores", "limites", "relatorios", "saude"],
  // PRELIMINAR (10/10): "abas quase mortas" do relatório de complexidade — rever com o METRICAS-<MODULO>.md
  viagens: ["passeios", "divisor", "lugares", "diario", "moeda", "seguranca", "countdown"],
  carreira: ["network", "interview"], // Rede, Prep
  biblioteca: ["insights", "emprestados"],
  casa: ["manutencao"],
  desenvolvimento: ["carta"],
  // sem dado ainda: ficam como estão
  rotina: [],
  saude: [],
  treino: [],
  dieta: [],
  beleza: [],
  estudos: [],
  hiperfoco: [],
  relacionamentos: [],
  pet: [],
  detox: [],
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
