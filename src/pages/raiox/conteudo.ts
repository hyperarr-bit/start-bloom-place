/**
 * RAIO-X DO MÊS — copy, preços e tabelas num lugar só. Os componentes não têm frase solta.
 * Pagamento desta versão: SÓ Pix (Asaas, oferta a97, R$ 97,90 uma vez). Sem cartão e sem Cakto.
 *
 * ESTIMATIVA — revisar com dado real
 * Valor mensal por faixa (R$/mês), na ordem das opções de cada pergunta.
 */
import { OFERTA_PIX_ANUAL, PLANOS, porMes } from "@/pages/venda/conteudo";

export const CHAVES = ["delivery", "assinaturas", "transporte_app", "compras_online", "formiga"] as const;
export type Chave = (typeof CHAVES)[number];
export type Faixa = 0 | 1 | 2 | 3;

export const TABELA: Record<Chave, readonly [number, number, number, number]> = {
  delivery: [30, 290, 680, 1160],
  assinaturas: [15, 75, 135, 200],
  transporte_app: [25, 140, 380, 660],
  compras_online: [15, 90, 240, 420],
  formiga: [10, 130, 350, 650],
};

export const PRECO = PLANOS.anual.valor;
export const PRECO_TEXTO = PLANOS.anual.preco;
export const OFERTA = OFERTA_PIX_ANUAL;
export const POR_MES = porMes(PRECO);

/** A frase de destaque do preço. Um lugar só, pra tela e teste lerem a mesma. */
export const PRECO_DESTAQUE = `R$ ${PRECO_TEXTO} no Pix, uma vez só (R$ ${POR_MES}/mês)`;

export const GARANTIA = "7 dias de garantia. Não gostou, devolvemos tudo. Sem renovação automática no Pix.";

export const META_TITULO = "RAIO-X DO SEU MÊS";
export const PROMESSA_Q1 = "Descubra em 30 segundos quanto dinheiro escapa do seu bolso sem você perceber";
export const RODAPE_Q1 = "Sem cadastro. Grátis.";

export type Pergunta = {
  n: 1 | 2 | 3 | 4 | 5;
  chave: Chave;
  pergunta: string;
  opcoes: readonly [string, string, string, string];
};

export const PERGUNTAS: readonly Pergunta[] = [
  {
    n: 1,
    chave: "delivery",
    pergunta: "Quantas vezes por semana você pede delivery?",
    opcoes: ["Quase nunca", "1 a 2 vezes", "3 a 4 vezes", "Todo dia"],
  },
  {
    n: 2,
    chave: "assinaturas",
    pergunta: "Quantas assinaturas você paga? (streaming, música, apps)",
    opcoes: ["0 ou 1", "2 a 3", "4 a 5", "6 ou mais"],
  },
  {
    n: 3,
    chave: "transporte_app",
    pergunta: "Quantas corridas de Uber ou 99 você faz por semana?",
    opcoes: ["Quase nunca", "1 a 2", "3 a 5", "Todo dia"],
  },
  {
    n: 4,
    chave: "compras_online",
    pergunta: "Quantas vezes por mês você compra online algo que não estava planejando? (Shopee, Shein, Mercado Livre…)",
    opcoes: ["Quase nunca", "1 a 2", "3 a 5", "6 ou mais"],
  },
  {
    n: 5,
    chave: "formiga",
    pergunta: "Lanchinho, café, açaí, conveniência… quantas vezes por semana?",
    opcoes: ["Quase nunca", "1 a 3", "4 a 7", "Mais de 1 por dia"],
  },
];

export const ROTULO: Record<Chave, string> = {
  delivery: "Delivery",
  assinaturas: "Assinaturas",
  transporte_app: "Corridas",
  compras_online: "Compras online",
  formiga: "Gasto formiga",
};

export const EMOJI: Record<Chave, string> = {
  delivery: "🛵",
  assinaturas: "📺",
  transporte_app: "🚗",
  compras_online: "🛍️",
  formiga: "☕",
};

export const DICA: Record<Chave, string> = {
  delivery: "Pedido no app some rápido. No fim do mês, pesa.",
  assinaturas: "Cada uma parece pequena. Juntas, não.",
  transporte_app: "Corrida curta vira conta grande na semana.",
  compras_online: "O que não estava na lista entra sem você notar.",
  formiga: "Café e lanche não parecem gasto. Somados, são.",
};

/**
 * Os 3 passos do plano. Só entra o que existe no app (conferido em 18/10/2026):
 * - desafio "Semana sem delivery" e "Gastar menos que a semana passada" e "3 dias sem gastar"
 *   (src/components/challenges/challenges.ts);
 * - limite por categoria (CategoryBudgets — Delivery e Transporte são categorias do app);
 * - "quanto dá pra gastar hoje" (Dashboard, dailyBudget);
 * - contas fixas e lembrete de vencimento (FixedExpensesTable, BillsDueCards);
 * - lista de desejos (WishlistItems) e meta do mês (month-goals).
 */
export const PASSOS_PLANO: Record<Chave, readonly [string, string, string]> = {
  delivery: [
    "Desafio “Semana sem delivery”",
    "Limite da categoria Delivery",
    "Ver quanto ainda dá pra gastar hoje",
  ],
  assinaturas: [
    "Anotar cada assinatura nas contas fixas",
    "Lembrete antes da conta vencer",
    "Ver o total de assinaturas no mês",
  ],
  transporte_app: [
    "Lançar cada corrida em Transporte",
    "Limite da categoria Transporte",
    "Desafio “Gastar menos que a semana passada”",
  ],
  compras_online: [
    "Colocar na lista de desejos antes de comprar",
    "Ver o gasto da categoria no mês",
    "Meta do mês pra guardar o que sobrar",
  ],
  formiga: [
    "Anotar o lanche no dia em que acontece",
    "Ver quanto ainda dá pra gastar hoje",
    "Desafio “3 dias sem gastar”",
  ],
};

/** Beats da demo (animação). O valor em R$ é a estimativa da semana do lead, não um contador que o app já tenha. */
export const ROTEIRO_DEMO: Record<Chave, { titulo: string; beats: readonly [string, string, string] }> = {
  delivery: {
    titulo: "Semana sem delivery",
    beats: ["O desafio abre na segunda", "Os dias vão ficando limpos", "A semana fecha sem pedido"],
  },
  assinaturas: {
    titulo: "Assinaturas na mesa",
    beats: ["Cada uma entra nas contas fixas", "O lembrete chega antes do vencimento", "O total do mês fica visível"],
  },
  transporte_app: {
    titulo: "Corridas no limite",
    beats: ["A corrida cai em Transporte", "O limite da categoria aparece", "A semana fica abaixo da anterior"],
  },
  compras_online: {
    titulo: "Compra que espera",
    beats: ["O item vai pra lista de desejos", "O mês mostra o que já saiu", "A meta guarda o que sobrou"],
  },
  formiga: {
    titulo: "O lanche no dia",
    beats: ["O café entra no dia em que acontece", "O “dá pra gastar hoje” desce", "Três dias fecham sem gasto extra"],
  },
};

export const LINHAS_CALCULO = ["Delivery", "Assinaturas", "Corridas", "Compras online", "Gasto formiga"] as const;

export const CORES_CARD = ["#DBD6F5", "#F6D5E6", "#FAF0D1", "#D1F0DC"] as const;

/** Os 5 primeiros nomes do chip. Os outros 11 módulos existem (lib/modulos.tsx tem 16). */
export const CHIPS = ["Finanças", "Rotina", "Treino", "Dieta", "Metas"] as const;
export const CHIPS_A_MAIS = 11;

export const FAQ: readonly { p: string; r: string }[] = [
  { p: "É mensal?", r: "Não. É 1 ano de acesso, pagamento único no Pix." },
  { p: "Funciona no iPhone e no Android?", r: "Sim, e também no computador." },
  { p: "Preciso mandar meu extrato?", r: "Não. O Raio-X é uma estimativa pelas suas respostas. O extrato é opcional e é lido só no seu celular." },
];

/**
 * Avaliações REAIS, as mesmas conferidas em src/pages/site/Landing.tsx (App Store / Play, 01/10).
 * Array vazio = a seção some. Nada de nota inventada nem “+1000”.
 */
export const AVALIACOES: readonly { nome: string; loja: string; texto: string }[] = [
  { nome: "Sabryna1610", loja: "App Store", texto: "Gente, que aplicativo incrível!!! Era tudo que eu precisava, eu amei demais. Vale muito a pena pagar" },
  { nome: "Nath M.", loja: "Google Play", texto: "baixei hoje e até o momento, EU AMEIIIIII O APP. Super fácil de mexer, bem dinâmico, Muito visual." },
  { nome: "Rebeca G.", loja: "Google Play", texto: "Estou gostando bastante do Core! Acho muito legal reunir várias áreas da vida em um só lugar." },
];

export const CONFIANCA_PREFIXO = "CORE Aplicativo";
export const CONFIANCA_PAGAMENTO = "Pagamento pela Asaas";

export const EXTRATO_TITULO = "Quer o número exato?";
export const EXTRATO_TEXTO = "Envie o extrato do banco ou a fatura do cartão (OFX ou CSV). A leitura é feita aqui, no seu celular.";
export const EXTRATO_ERRO = "Não consegui ler esse arquivo. Exporta como OFX ou CSV no app do banco.";
export const EXTRATO_VOLTAR = "Voltar pra minha estimativa";
export const EXTRATO_COMO = "Como baixo o extrato?";

/**
 * Sem caminho inventado de menu. O TODO fica no código: conferir no app de cada banco antes de detalhar o toque.
 * TODO("validar no app do banco")
 */
export const BANCOS: readonly { nome: string; nota: string }[] = [
  { nome: "Nubank", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "Inter", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "Itaú", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "Bradesco", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "Santander", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "C6 Bank", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "BB", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
  { nome: "Caixa", nota: "No app, abra o extrato e exporte OFX ou CSV. O caminho certo ainda precisa ser conferido no app." },
];

export const BOTAO_PIX = `Pagar R$ ${PRECO_TEXTO} no Pix`;
export const SUB_PIX = "o código aparece aqui, sem sair da página";
export const PIX_EMAIL_TITULO = "Pra entrar no app com a conta já paga";
export const PIX_EMAIL_SUB = "É com este e-mail que você entra no CORE.";
export const PIX_NAO_MUDOU = "Pagou e a tela não mudou? O acesso chega no e-mail em até 2 minutos.";
export const PIX_ESCANEAR = "Prefiro escanear";

export const SUCESSO_TITULO = "Seu CORE está liberado";
export const CONSENTIMENTO = "Salvar os lançamentos do meu Raio-X na minha conta";

export const CTA_ESCOLHA = "Escolher qual vazamento fechar →";
export const CTA_EXTREMO = "Quero garantir que continue assim →";
export const EXTREMO_TITULO = "Você está no controle 👏";
export const EXTREMO_SUB = "Quer garantir que continue assim?";
export const LINK_EXTRATO = "Quer o número exato? Use seu extrato (opcional)";
export const LINK_EMAIL = "Me manda esse Raio-X por e-mail";
export const DEMO_PULAR = "Pular →";
export const DEMO_CTA = "Quero isso →";
export const DEMO_PROXIMO = "Próximo";

export function reais(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function mesAno(d = new Date()): string {
  const mes = d.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const ano = d.toLocaleDateString("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" });
  return `${mes}/${ano}`;
}
