/**
 * CONTEÚDO DO FUNIL "SOMA-ASSINATURAS" (/funil-e, 18/10) — copy, a tabela de
 * serviços/preços e os textos das telas num lugar só (os testes leem daqui).
 * Puro, sem React.
 *
 * O mecanismo (por que não é quiz): a pessoa TOCA nas assinaturas que paga e
 * o total sai com os preços públicos de hoje — conta exata sobre a seleção
 * dela, não estimativa por faixa. Sem extrato, sem cadastro.
 */

/* ------------------------------------------------ a ferramenta (T1) */
export const SELO_FERRAMENTA = "Grátis · sem cadastro · 20 segundos";
export const TITULO_FERRAMENTA = "Quanto as suas assinaturas comem do seu mês?";
export const SUB_FERRAMENTA = "Toque nas que você paga. O total sai na hora, com os preços de hoje.";
export const TRAVA_FERRAMENTA = "Nada sai do seu celular. A conta é feita aqui mesmo.";
export const CTA_FERRAMENTA = "Ver quanto dá no ano";
export const LINK_SEM_ASSINATURA = "Não pago nenhuma assinatura";
export const OUTRA_TITULO = "Tem outra? Toque pra somar:";
export const TOTAL_ROTULO = "seu total por mês";

/** Um serviço da grade. `preco` = o plano mais comum, por MÊS, em reais. */
export type Servico = {
  id: string;
  nome: string;
  emoji: string;
  /** preço público do plano mais comum (mensal, R$) */
  preco: number;
  /** qual plano é este preço (aparece no cupom) */
  plano: string;
};

/**
 * PREÇOS — revisar com a página de preço oficial de cada serviço antes de
 * ligar a campanha (foto de 18/10/2026, plano mais comum, valor mensal).
 * Se um preço oficial mudou, muda aqui: o número que a pessoa vê é o que
 * ancora o preço do CORE — errar pra cima quebra a confiança, errar pra
 * baixo quebra a âncora.
 */
export const SERVICOS: Servico[] = [
  { id: "netflix", nome: "Netflix", emoji: "📺", preco: 44.9, plano: "Padrão" },
  { id: "spotify", nome: "Spotify", emoji: "🎧", preco: 21.9, plano: "Individual" },
  { id: "youtube", nome: "YouTube Premium", emoji: "▶️", preco: 24.9, plano: "Individual" },
  { id: "prime", nome: "Amazon Prime", emoji: "📦", preco: 19.9, plano: "Mensal" },
  { id: "disney", nome: "Disney+", emoji: "✨", preco: 43.9, plano: "Padrão" },
  { id: "max", nome: "Max", emoji: "🎥", preco: 29.9, plano: "Padrão" },
  { id: "globoplay", nome: "Globoplay", emoji: "🌎", preco: 24.9, plano: "Mensal" },
  { id: "appletv", nome: "Apple TV+", emoji: "🍎", preco: 24.9, plano: "Mensal" },
  { id: "icloud", nome: "iCloud+", emoji: "☁️", preco: 3.9, plano: "50 GB" },
  { id: "chatgpt", nome: "ChatGPT Plus", emoji: "🤖", preco: 100, plano: "≈ US$ 20" },
  { id: "canva", nome: "Canva Pro", emoji: "🎨", preco: 54.9, plano: "Mensal" },
  { id: "crunchyroll", nome: "Crunchyroll", emoji: "🍥", preco: 19.99, plano: "Fan" },
  { id: "gamepass", nome: "Xbox Game Pass", emoji: "🎮", preco: 44.99, plano: "Ultimate" },
  { id: "psplus", nome: "PS Plus", emoji: "🕹️", preco: 34.9, plano: "Essencial" },
  { id: "deezer", nome: "Deezer", emoji: "🎵", preco: 21.9, plano: "Individual" },
  { id: "paramount", nome: "Paramount+", emoji: "⛰️", preco: 19.9, plano: "Mensal" },
];

/** Valores rápidos do "Outra assinatura" (academia, app menor, Tinder…). Cada toque soma um item. */
export const VALORES_OUTRA = [9.9, 19.9, 34.9, 49.9, 99.9] as const;

/* ------------------------------------------------ o resultado (T2) */
export const SELO_RESULTADO = "Seu somatório";
export const LINHA_RESULTADO = "saem do seu bolso todo mês, sem você pedir.";
export const CUPOM_TITULO = "Seu cupom";
export const PERGUNTA_NAO_USOU = "Qual delas você NÃO usou no último mês? Toque em cima.";
export const LISTA_TITULO = "Sua lista de cancelamento";
export const LISTA_DICA = "Cancele no próprio app do serviço (Conta → Assinatura → Cancelar). Leva 2 minutos — tira um print desta lista pra não esquecer.";
export const EMAIL_PLACEHOLDER = "Prefere receber a lista no e-mail?";
export const CTA_RESULTADO = "Quero que pare de vazar";
export const NOTA_PRECOS = "Preços públicos dos planos mais comuns. O seu pode ser outro — e é justamente isso que o CORE te ajuda a ver.";

/** O caso "não pago nenhuma": segue pro mesmo preço, com outra conversa. */
export const ZERO_TITULO = "Você é raro(a) 👏";
export const ZERO_LINHA = "A maioria paga mais de R$ 200 por mês em assinaturas sem perceber. Sem assinatura, o vazamento costuma morar no dia a dia: delivery, lanchinho, comprinha online.";

/* ------------------------------------------------ o preço (T3) */
export const PRECO_TITULO = "Pare de pagar o que não usa";
export const PRECO_SUB = "O CORE é o app que vigia o seu dinheiro — e te avisa antes de vazar.";
/**
 * Os 3 passos — CONFERIDOS no código em 18/10/2026 (não prometer o que não existe):
 *  1. Contas a vencer com aviso na VÉSPERA: src/lib/notificacoes.ts ("N contas vencem amanhã"),
 *     dados em finance-dueDays (src/lib/reagendar.ts);
 *  2. Teto de gasto por categoria: src/components/CategoryBudgets.tsx (+ desafio "Gastar menos que
 *     semana passada" usa o teto da semana anterior, src/components/challenges/challenges.ts);
 *  3. Desafio da semana: src/components/challenges/WeeklyChallenge.tsx — "Semana sem delivery",
 *     "3 dias sem gastar", "Gastar menos que semana passada" (challenges.ts). O card mostra
 *     progresso ao vivo e grava a vitória no histórico (alimenta insígnias) — NÃO mostra R$
 *     economizado, então a copy não promete economia em reais aqui.
 */
export const PASSOS_PRECO = [
  { titulo: "Contas a vencer, sem susto", texto: "Cadastre a Netflix e cia. com o dia do vencimento: o app te avisa na véspera de cada cobrança." },
  { titulo: "Teto por categoria", texto: "Defina um teto pra delivery, mercado, transporte… e veja na hora onde o mês está estourando." },
  { titulo: "Desafio da semana", texto: "“Semana sem delivery”, “3 dias sem gastar”: um vazamento fechado por vez, com progresso ao vivo e cada vitória virando insígnia." },
] as const;
export const MODULOS_LINHA = "16 módulos inclusos";
export const MODULOS_CHIPS = ["Finanças", "Rotina", "Treino", "Dieta", "Metas", "+11"] as const;
export const SELO_PLANO = "Plano anual";
export const PRECO_LINHA_1 = "uma vez · 1 ano de CORE";
export const PRECO_LINHA_2 = "dá R$ 8,16 por mês";
export const CTA_PIX = "Pagar R$ 97,90 no Pix";
export const CTA_PIX_SUB = "o código aparece aqui, sem sair da página";
export const CTA_CARTAO = "Cartão em até 12x";
export const GARANTIA_LINHA = "7 dias de garantia. Não gostou, devolvemos tudo. Sem renovação automática no Pix.";
export const FAQ = [
  { q: "É mensal?", a: "Não. É 1 ano de acesso, pagamento único no Pix (ou parcelado no cartão). Não renova sozinho no Pix." },
  { q: "Funciona no iPhone e no Android?", a: "Sim, e também no computador. Tudo sincronizado com a mesma conta." },
  { q: "Preciso conectar meu banco ou mandar extrato?", a: "Não. Nada de senha de banco, extrato ou Open Finance. Você cadastra uma conta a vencer em 10 segundos e o CORE passa a te avisar na véspera." },
] as const;
