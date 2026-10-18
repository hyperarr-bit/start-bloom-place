/**
 * Motor matemático puro do `/funil-c` ("O Número do Dia").
 * Espelha a lógica real do módulo de Finanças do CORE (`computeDailyBudget` e `forecast` em `src/lib/finance-totals.ts`):
 *   Renda Mensal − Custos Fixos & Parcelas − Sobra Protegida = Saldo Livre do Mês ÷ Dias Restantes = Teto Diário.
 */

export type NivelComprometido = 40 | 55 | 70 | 82;
export type ModoPlano = "equilibrio" | "quitar" | "blindagem";
export type EscapeDinheiro = "pix_diario" | "parcelas_cartao" | "vencimentos_casa";

export interface OpcaoComprometido {
  pct: NivelComprometido;
  titulo: string;
  sub: string;
  tag: string;
}

export const FAIXAS_RENDA = [2500, 3500, 4500, 6000, 8500, 12000] as const;

export const OPCOES_COMPROMETIDO: readonly OpcaoComprometido[] = [
  {
    pct: 40,
    titulo: "Controlado (~40%)",
    sub: "Moradia e contas fixas cabem com folga no salário",
    tag: "40%",
  },
  {
    pct: 55,
    titulo: "Metade do ganho (~55%)",
    sub: "Contas da casa + fatura do cartão já levam metade",
    tag: "55%",
  },
  {
    pct: 70,
    titulo: "Apertado (~70%)",
    sub: "Sobra pouco depois de pagar boletos e parcelas",
    tag: "70%",
  },
  {
    pct: 82,
    titulo: "No limite (~82%)",
    sub: "O salário cai e quase tudo já está comprometido",
    tag: "82%",
  },
] as const;

export const OPCOES_ESCAPE: ReadonlyArray<{ id: EscapeDinheiro; label: string; ferramentaCore: string }> = [
  {
    id: "pix_diario",
    label: "Vou passando Pix e cartão no dia a dia sem saber meu limite",
    ferramentaCore: "Teto Diário 'Quanto posso gastar hoje' com recálculo em 5s",
  },
  {
    id: "parcelas_cartao",
    label: "As parcelas do cartão somam de um mês pro outro e comem a sobra",
    ferramentaCore: "Rastreador de Parcelas (k de N) por fatura + Simulador 'Cabe no bolso?'",
  },
  {
    id: "vencimentos_casa",
    label: "Esqueço datas de vencimento ou divido contas da casa no olho",
    ferramentaCore: "Calendário 'Meu Mês' com alertas + Rateio de contas (Você / Meio a meio)",
  },
];

export const MODOS_PLANO: ReadonlyArray<{
  id: ModoPlano;
  nome: string;
  descricao: string;
  fatorReserva: number;
}> = [
  {
    id: "equilibrio",
    nome: "Equilíbrio 50/30/20",
    descricao: "Protege uma sobra saudável todo mês sem sufocar seu dia a dia",
    fatorReserva: 0.24,
  },
  {
    id: "quitar",
    nome: "Secar Parcelas",
    descricao: "Enxuga o limite diário para quitar faturas e parcelamentos rápido",
    fatorReserva: 0.34,
  },
  {
    id: "blindagem",
    nome: "Reserva Máxima",
    descricao: "Prioriza blindar caixa rápido para imprevistos e metas do ano",
    fatorReserva: 0.42,
  },
];

export const PRECO_ANUAL_REAIS = 97.9;
export const PRECO_POR_DIA_CENTAVOS = "0,27";

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export function infoCalendarioMes(agora = new Date()): {
  diaHoje: number;
  diasNoMes: number;
  diasRestantes: number;
  diasParaCalculo: number;
  nomeMes: string;
} {
  const ano = agora.getFullYear();
  const mesIdx = agora.getMonth();
  const diaHoje = agora.getDate();
  const diasNoMes = new Date(ano, mesIdx + 1, 0).getDate();
  const diasRestantes = Math.max(1, diasNoMes - diaHoje + 1);
  // Se estiver nos últimos 6 dias do mês, projeta sobre um ciclo padrão de 30 dias para o teto não distorcer,
  // mantendo a exibição transparente para o usuário.
  const diasParaCalculo = diasRestantes >= 7 ? diasRestantes : 30;
  const nomeMes = MESES_PT[mesIdx] ?? "mês";
  return { diaHoje, diasNoMes, diasRestantes, diasParaCalculo, nomeMes };
}

export interface ResultadoMapaMes {
  renda: number;
  comprometidoPct: NivelComprometido;
  comprometidoReais: number;
  saldoAposFixos: number;
  sobraMensal: number;
  sobraAnual: number;
  saldoParaGastar: number;
  tetoDiario: number;
  gastoDiarioSemControle: number;
  diaApagao: number;
  diasDescobertos: number;
  diasParaPagarCore: number;
  scoreAtual: number;
  scoreComCore: number;
  diasParaCalculo: number;
  nomeMes: string;
}

export function calcularMapaDoMes(args: {
  renda: number;
  comprometidoPct: NivelComprometido;
  modo: ModoPlano;
  agora?: Date;
}): ResultadoMapaMes {
  const renda = Math.max(1000, Math.min(50000, Math.round(args.renda)));
  const pct = args.comprometidoPct;
  const comprometidoReais = Math.round((renda * pct) / 100);
  const saldoAposFixos = Math.max(150, renda - comprometidoReais);

  const cfgModo = MODOS_PLANO.find((m) => m.id === args.modo) ?? MODOS_PLANO[0];
  const sobraBruta = Math.round(saldoAposFixos * cfgModo.fatorReserva);
  const sobraMensal = Math.max(120, sobraBruta);
  const sobraAnual = sobraMensal * 12;

  const { diasParaCalculo, nomeMes } = infoCalendarioMes(args.agora);
  const saldoParaGastar = Math.max(90, saldoAposFixos - sobraMensal);
  const tetoDiario = Math.max(10, Math.round(saldoParaGastar / diasParaCalculo));

  // Sem teto diário visível, o ritmo típico nos primeiros 15 dias consome ~1,55x a 1,75x do limite real
  const multiplicadorDescontrole = pct >= 70 ? 1.68 : pct >= 55 ? 1.56 : 1.45;
  const gastoDiarioSemControle = Math.max(tetoDiario + 15, Math.round((saldoAposFixos / 30) * multiplicadorDescontrole));
  const diasQueDura = Math.max(9, Math.min(26, Math.floor(saldoAposFixos / gastoDiarioSemControle)));
  const diaApagao = diasQueDura;
  const diasDescobertos = Math.max(4, 30 - diaApagao);

  const economiaPorDia = Math.max(8, Math.round(sobraMensal / 30));
  const diasParaPagarCore = Math.max(1, Math.min(7, Math.ceil(PRECO_ANUAL_REAIS / economiaPorDia)));

  const scoreAtual = pct >= 82 ? 31 : pct >= 70 ? 42 : pct >= 55 ? 54 : 64;
  const scoreComCore = Math.min(94, scoreAtual + 28);

  return {
    renda,
    comprometidoPct: pct,
    comprometidoReais,
    saldoAposFixos,
    sobraMensal,
    sobraAnual,
    saldoParaGastar,
    tetoDiario,
    gastoDiarioSemControle,
    diaApagao,
    diasDescobertos,
    diasParaPagarCore,
    scoreAtual,
    scoreComCore,
    diasParaCalculo,
    nomeMes,
  };
}

export function formatarMoeda(valor: number): string {
  return Math.round(valor).toLocaleString("pt-BR");
}

/**
 * Regra de segurança de produção exigida no prompt:
 * `coreaplicativo.com.br` e `www.coreaplicativo.com.br` NUNCA abrem o funil experimental —
 * continuam redirecionando para a landing `/` preservando a query (`destinoNaLanding`).
 */
export function ehDominioProducao(hostname?: string): boolean {
  const h = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).trim().toLowerCase();
  return h === "coreaplicativo.com.br" || h === "www.coreaplicativo.com.br";
}
