/**
 * /funil-a — as frases, os destinos do 13º e a divisão do plano num lugar só (os testes leem daqui). Puro.
 *
 * Os recursos citados em `recursos` existem no app (conferidos no código em 18/10):
 *   parcelas com o mês em que acabam (InstallmentTracker / lib/finance-parcelas) · contas a vencer com aviso
 *   (BillsDueCards + PedirLembretes, no app da loja) · "quanto posso gastar hoje" (lib/finance-totals
 *   computeDailyBudget + LembreteDoLimite) · reserva de emergência com meses e guardado (finance/EmergencyFund) ·
 *   orçamento por categoria (CategoryBudgets) · balanço anual mês a mês (AnnualBudget) · lista de desejos com preço,
 *   quanto já guardou e data (WishlistItems) · simuladores (Simulators).
 */
import { centavos } from "./calculo";

export const TITULO_PAGINA = "CORE · Seu 13º de 2026";

/* ------------------------------------------------ entrada */
export const SELO_ENTRADA = "13º de 2026 · tabelas oficiais";
export const TITULO_ENTRADA_A = "Quanto do seu 13º vai cair";
export const TITULO_ENTRADA_DESTAQUE = "de verdade";
export const TITULO_ENTRADA_B = "na sua conta?";
export const SUB_ENTRADA = "Digite seu salário bruto. Na hora você vê as 2 parcelas, as datas e o que o INSS e o IR levam.";
export const ROTULO_SALARIO = "Seu salário bruto (o da carteira)";
export const BOTAO_CALCULAR = "Calcular meu 13º";
export const SELO_ESFORCO = "Grátis · sem cadastro · 1 campo";
export const PRIVACIDADE = "A conta é feita aqui no seu celular. Seu salário não é enviado pra ninguém.";
export const EXEMPLOS_SALARIO = [1800, 2500, 3500, 5000] as const;
export const LINK_ENTROU_2026 = "Entrei na empresa em 2026";
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;

/** Mês de entrada (1–12) → avos do 13º. Conta o mês de entrada inteiro (quem entrou até o dia 15). */
export const avosDoMes = (mesEntrada: number | null): number =>
  mesEntrada == null ? 12 : Math.min(12, Math.max(1, 12 - mesEntrada + 1));

/* ------------------------------------------------ resultado */
export const SELO_RESULTADO = "Seu 13º · 2026";
export const LINHA_TOTAL = "caem na sua conta, somando as 2 parcelas";
export const POR_QUE_MENOR = "Por que a 2ª vem menor? Todo o INSS e o IR do 13º saem dela. A 1ª vem inteira.";
export const RODAPE_CALCULO =
  "Cálculo sem dependentes, pensão, horas extras ou comissões. Tabelas: INSS da Portaria MPS/MF 13/2026 e IR com a redução da Lei 15.270/2025.";
export const BOTAO_RESULTADO = "Decidir pra onde vai esse dinheiro";

/* ------------------------------------------------ destino */
export type ChaveDestino = "dividas" | "reserva" | "natal" | "janeiro" | "desejo";

export type Destino = {
  chave: ChaveDestino;
  emoji: string;
  rotulo: string;
  /** como aparece em "Seu plano: …" */
  plano: string;
  /** a divisão do 13º líquido: o 1º pote é o do destino; as frações somam 1 */
  potes: readonly { rotulo: string; fracao: number }[];
  recursos: readonly [string, string, string];
};

export const DESTINOS: readonly Destino[] = [
  {
    chave: "dividas", emoji: "🧾", rotulo: "Quitar dívidas e parcelas", plano: "entrar em 2027 com menos parcelas",
    potes: [{ rotulo: "Quitar ou adiantar parcelas", fracao: 0.7 }, { rotulo: "Contas de dezembro", fracao: 0.2 }, { rotulo: "Livre pra você", fracao: 0.1 }],
    recursos: [
      "Cada parcela com o mês em que ela acaba",
      "Contas a vencer com aviso no dia",
      "Quanto você pode gastar hoje, já descontando as parcelas",
    ],
  },
  {
    chave: "reserva", emoji: "🛟", rotulo: "Começar minha reserva", plano: "começar sua reserva de emergência",
    potes: [{ rotulo: "Reserva de emergência", fracao: 0.6 }, { rotulo: "Contas de dezembro", fracao: 0.25 }, { rotulo: "Livre pra você", fracao: 0.15 }],
    recursos: [
      "Reserva de emergência: quantos meses você quer e quanto já guardou",
      "Quanto você pode gastar hoje sem mexer na reserva",
      "Orçamento por categoria pro resto do mês",
    ],
  },
  {
    chave: "natal", emoji: "🎁", rotulo: "Natal e presentes sem estourar", plano: "passar o fim de ano sem estourar",
    potes: [{ rotulo: "Presentes e festas", fracao: 0.4 }, { rotulo: "Guardar pra janeiro", fracao: 0.4 }, { rotulo: "Livre pra você", fracao: 0.2 }],
    recursos: [
      "Teto por categoria: presente, lazer, mercado",
      "Quanto você pode gastar hoje até o fim do mês",
      "Lista de desejos com quanto já guardou pra cada um",
    ],
  },
  {
    chave: "janeiro", emoji: "📅", rotulo: "Começar 2027 sem aperto", plano: "atravessar janeiro sem aperto",
    potes: [{ rotulo: "Contas de janeiro (IPVA, IPTU, material)", fracao: 0.6 }, { rotulo: "Reserva", fracao: 0.25 }, { rotulo: "Livre pra você", fracao: 0.15 }],
    recursos: [
      "As contas de janeiro no calendário do mês, com aviso",
      "Balanço do ano mês a mês",
      "Quanto você pode gastar hoje, já com as contas reservadas",
    ],
  },
  {
    chave: "desejo", emoji: "✈️", rotulo: "Realizar um desejo (viagem, compra)", plano: "tirar um desejo do papel",
    potes: [{ rotulo: "O seu desejo", fracao: 0.5 }, { rotulo: "Reserva", fracao: 0.3 }, { rotulo: "Contas de dezembro", fracao: 0.2 }],
    recursos: [
      "Lista de desejos: preço, quanto já guardou e a data",
      "Simulador: quanto tempo pra juntar o que falta",
      "Quanto você pode gastar hoje sem atrasar o desejo",
    ],
  },
];

export const destinoDe = (chave: string | null | undefined): Destino | null => DESTINOS.find((d) => d.chave === chave) ?? null;

/**
 * O 13º líquido dividido nos potes do destino. Arredonda pra dezena (menos o último, que fecha a conta),
 * então a soma dos potes é EXATAMENTE o líquido.
 */
export function dividir(liquido13: number, destino: Destino): { rotulo: string; valor: number }[] {
  const out: { rotulo: string; valor: number }[] = [];
  let usado = 0;
  destino.potes.forEach((p, i) => {
    const ultimo = i === destino.potes.length - 1;
    const valor = ultimo ? centavos(liquido13 - usado) : Math.max(0, Math.round((liquido13 * p.fracao) / 10) * 10);
    usado = centavos(usado + valor);
    out.push({ rotulo: p.rotulo, valor });
  });
  return out;
}

export const TITULO_DESTINO = "Pra onde vai o seu 13º?";

/* ------------------------------------------------ plano + preço */
export const SELO_PLANO = "Seu plano do 13º";
export const TITULO_RECURSOS = "O CORE segura esse plano até o dinheiro cair, e depois dele:";
export const MODULOS_INCLUSOS = ["Finanças", "Rotina", "Treino", "Dieta", "Saúde", "Metas"] as const;
export const MAIS_MODULOS = "+10";
export const LINHA_MODULOS = "16 módulos inclusos no mesmo plano";
export const PRECO = "97,90";
export const VALOR = 97.9;
export const POR_MES = "8,16";
export const SELO_PRECO = "Plano anual";
export const BOTAO_PIX = `Pagar R$ ${PRECO} no Pix`;
export const SUB_BOTAO_PIX = "O código aparece aqui, sem sair da página.";
export const GARANTIA = "7 dias de garantia. Pagamento único no Pix, sem renovação automática.";
export const FAQ: readonly { p: string; r: string }[] = [
  { p: "É mensal?", r: "Não. É 1 ano de CORE com um pagamento só, no Pix. Não renova sozinho." },
  { p: "Funciona no iPhone e no Android?", r: "Sim. E também no computador, com a mesma conta." },
  { p: "Vocês guardam meu salário?", r: "Não. O cálculo do 13º é feito no seu celular. No app, você só lança o que quiser." },
];

/** "R$ 97,90 = 2,9% do seu 13º" (uma casa, vírgula). */
export const percentualDoPreco = (liquido13: number): string | null => {
  if (!(liquido13 > 0)) return null;
  const p = (VALOR / liquido13) * 100;
  if (p >= 100) return null;
  return p.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

/* ------------------------------------------------ dados / pix */
export const RESUMO_PIX = `Anual · R$ ${PRECO} · Pix · 1 ano de acesso`;
