/**
 * A conta que continuava PAGA no mês seguinte (08/08).
 *
 * SINTOMA que chegou de usuária: "não estou conseguindo colocar a opção de
 * pago quando eu pago o item". Não era o toque que falhava — o ✓ já estava
 * lá, do mês passado. Não havia o que marcar.
 *
 * CAUSA: `finance-dueDays` é UMA chave só, sem mês no nome, e o `paid` de
 * cada conta mora dentro dela. Quando o mês virava, ninguém zerava nada:
 *  - `use-virada-do-mes` arquivava só `finance-expenses` e `finance-incomes`
 *    (que têm data por item) e ignorava as contas de propósito, por não
 *    saberem de que mês eram;
 *  - o único reset existente vivia dentro do `copyToMonth` do cartão de
 *    virada, que LÊ `finance-{ano}-{mes}-dueDays` — chave que ninguém nunca
 *    escreveu. Ou seja: o reset dependia de um arquivo que não existia, e o
 *    arquivo dependia de um escritor que não existia.
 *
 * O estrago era silencioso e permanente: o cabeçalho do MEU MÊS dizia
 * "✓ contas em dia" em agosto por causa de julho, os alertas de vencimento
 * sumiam, e os 15 pontos de "contas em dia" do score de Saúde Financeira
 * ficavam cheios para sempre. Número inflado é pior que número ausente:
 * a pessoa toma decisão em cima dele.
 *
 * O CONSERTO é um CARIMBO de mês (`finance-dueDays-mes`, chave NOVA e
 * opcional — nada de renomear chave com 966 assinantes em cima). Ele diz a
 * que mês pertencem os ✓ que estão no balde corrente. Na primeira abertura
 * de um mês novo: arquiva o retrato do mês que acabou e devolve o balde com
 * todo `paid` em false, PRESERVANDO dia, nome, valor e o vínculo com o custo
 * fixo — conta é recorrente, o que expira é o pagamento.
 *
 * LEGADO (carimbo ausente): zera SEM arquivar. Sem carimbo não dá para saber
 * de que mês eram aqueles ✓ — podem ser de julho ou de março. Arquivar num
 * mês chutado colocaria número falso na retrospectiva, que é justamente a
 * tela que a pessoa lê como verdade (a mesma regra do lib/virada-do-mes.ts:
 * não inventar dado). Zerar só afirma o presente: "este mês ainda não foi
 * pago". Quem tiver pago algo hoje remarca com um toque; quem não zerar
 * carrega uma mentira o mês inteiro. Da próxima virada em diante o carimbo
 * existe e o arquivamento é exato.
 *
 * ═══ AUDITORIA DA VIRADA 30/09 → 01/10 (26/09) ═══
 *
 * 1. O ✓ DE QUEM ACABOU DE CHEGAR SUMIA. O caminho LEGADO acima (sem
 *    carimbo → zera tudo) não pegava só quem tinha conta antes de 08/08:
 *    pegava TODA pessoa nova. O hook só carimba quando já existe conta, e
 *    ele se dá por atendido na primeira escrita da sessão — no tutorial de
 *    Finanças a 1ª escrita é a RENDA, antes de qualquer conta. Resultado:
 *    a pessoa cadastrava o aluguel, marcava ✓ (o "momento de valor" do
 *    teste grátis) e, na abertura seguinte, o ✓ tinha sumido. Agora o ✓ de
 *    uma conta que NASCEU no mês corrente fica — ela não existia no mês
 *    passado, então o pagamento só pode ser deste. O mês de nascimento sai
 *    do id: todo escritor de conta usa `Date.now()` (MonthCalendar,
 *    BillsDueCards, `fx-<id do fixo>` do finance-sync, cópia do mês). Id
 *    ilegível = não sei = zera, como sempre foi.
 *
 * 2. CARIMBO DO FUTURO não faz a virada andar pra trás. Relógio adiantado
 *    ou outro aparelho num fuso à frente (Lisboa vira o mês às 20h de
 *    Brasília) gravava "2026-10" ainda em setembro; o aparelho certo via
 *    carimbo ≠ mês dele, arquivava o balde NO MÊS FUTURO (arquivo que depois
 *    nunca mais seria sobrescrito — o outubro de verdade se perdia) e
 *    regravava o carimbo pra trás. Carimbo à frente do relógio = no-op.
 *
 * 3. O retrato dos CUSTOS FIXOS do mês que acabou mora no hook
 *    (use-virada-do-mes + lib/virada-do-mes `viradaDeFixos`), com carimbo
 *    próprio — não aqui: este carimbo só existe pra quem tem conta do mês.
 */

import { chaveArquivada } from "@/lib/virada-do-mes";

/** Chave NOVA: a que mês pertencem os ✓ que estão em `finance-dueDays`. */
export const CHAVE_CARIMBO_CONTAS = "finance-dueDays-mes";

/** Chave do balde corrente de contas — a mesma de sempre, sem renomear. */
export const CHAVE_CONTAS = "finance-dueDays";

export interface Conta {
  id: string;
  name: string;
  paid: boolean;
  value?: number;
  fixedId?: string;
}

export interface DiaDeContas {
  day: number;
  color: string;
  bills: Conta[];
}

export interface ViradaDeContas {
  /** Balde do mês novo: mesmos dias/nomes/valores, `paid` em false — menos o
   *  da conta que nasceu no próprio mês novo (26/09, cabeçalho item 1). */
  zeradas: DiaDeContas[];
  /** Havia ✓ para limpar? Se não, o balde não precisa ser regravado. */
  zerou: boolean;
  /** Retrato do mês que acabou — null quando o mês dele é desconhecido. */
  arquivo: { chave: string; contas: DiaDeContas[] } | null;
  /** Valor a gravar no carimbo depois de aplicar. */
  carimbo: string;
}

/** "YYYY-MM" do mês LOCAL. Nunca por toISOString: no Brasil (UTC-3) a virada
 *  do dia 1 às 00h já cairia no mês anterior. */
export const mesCorrenteId = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const ehCarimbo = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/* Janela de plausibilidade do carimbo de tempo no id (26/09): antes de 2020
 * o app não existia; depois de amanhã é relógio errado. Fora dela = não sei. */
const INICIO_PLAUSIVEL = new Date(2020, 0, 1).getTime();
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Mês LOCAL ("YYYY-MM") em que a conta nasceu, lido do id (26/09).
 *
 * Todo escritor de conta grava `Date.now()` no id: MonthCalendar e
 * BillsDueCards direto, o finance-sync como `fx-<id do custo fixo>` (o fixo
 * também nasce com `Date.now()`, e a conta não existe antes dele), a cópia
 * do mês como `Date.now() + Math.random()`. Qualquer outra coisa — id de
 * seed, id digitado, relógio absurdo — devolve null, e quem chama trata
 * como "não sei de quando é".
 */
export const mesDeNascimento = (id: unknown, hoje: Date = new Date()): string | null => {
  if (typeof id !== "string" && typeof id !== "number") return null;
  const m = /^(?:fx-)?(\d{13})/.exec(String(id));
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms) || ms < INICIO_PLAUSIVEL || ms > hoje.getTime() + UM_DIA_MS) return null;
  return mesCorrenteId(new Date(ms));
};

/** Tem pelo menos uma conta cadastrada? (dia vazio não conta) */
export const temContas = (dias: unknown): boolean =>
  Array.isArray(dias) &&
  dias.some((d: any) => Array.isArray(d?.bills) && d.bills.length > 0);

/**
 * Decide a virada das contas. Devolve `null` quando não há nada a fazer —
 * é o caminho de TODA abertura normal do app, então precisa ser barato:
 * uma comparação de string.
 */
export const viradaDeContas = (
  dueDays: DiaDeContas[] | undefined,
  carimboAtual: unknown,
  hoje: Date = new Date(),
): ViradaDeContas | null => {
  const mesAgora = mesCorrenteId(hoje);
  if (carimboAtual === mesAgora) return null;
  // (26/09) Carimbo À FRENTE do relógio deste aparelho: outro aparelho num
  // fuso adiantado (ou com relógio errado) já virou. Virar daqui arquivaria o
  // balde no mês FUTURO e regravaria o carimbo pra trás — no-op.
  if (ehCarimbo(carimboAtual) && carimboAtual > mesAgora) return null;

  const dias = (Array.isArray(dueDays) ? dueDays : []).map((d) => ({
    ...d,
    bills: Array.isArray(d?.bills) ? d.bills : [],
  }));
  // Sem nenhuma conta cadastrada não há o que carimbar. Importa mais do que
  // parece: o hook roda também no estado de CONVIDADO (store vazio) e um
  // carimbo gravado ali migraria pra conta no cadastro, fazendo o balde real
  // parecer já virado.
  if (!temContas(dias)) return null;

  // (26/09) Conta que NASCEU neste mês não tem ✓ de mês passado pra expirar:
  // o ✓ dela é deste mês e fica. Era o que apagava o primeiro "paguei" de
  // toda pessoa nova (ver o cabeçalho, item 1).
  const expira = (b: Conta | undefined) => !!b?.paid && mesDeNascimento(b?.id, hoje) !== mesAgora;
  const zeradas = dias.map((d) => ({
    ...d,
    bills: d.bills.map((b) => (expira(b) ? { ...b, paid: false } : b)),
  }));
  const zerou = dias.some((d) => d.bills.some(expira));

  let arquivo: ViradaDeContas["arquivo"] = null;
  if (ehCarimbo(carimboAtual)) {
    const [ano, mes] = carimboAtual.split("-").map(Number);
    // (26/09) Conta nascida DEPOIS do mês arquivado não existia nele — não
    // entra no retrato (acontece quando o carimbo ficou parado, ex.: balde
    // vazio na virada anterior). Id ilegível entra, como sempre entrou.
    const doMes = dias.map((d) => ({
      ...d,
      bills: d.bills.filter((b) => {
        const nasceu = mesDeNascimento(b?.id, hoje);
        return nasceu === null || nasceu <= carimboAtual;
      }),
    }));
    if (temContas(doMes)) arquivo = { chave: chaveArquivada(ano, mes - 1, "dueDays"), contas: doMes };
  }

  return { zeradas, zerou, arquivo, carimbo: mesAgora };
};

/**
 * Aplica a virada pelas portas de quem chamou.
 *
 * O desenho previa DOIS chamadores idempotentes — o hook do App
 * (`use-virada-do-mes`) e a própria tela de Finanças. ATENÇÃO (26/09): o
 * segundo nunca foi ligado. `git log -S viradaDeContas` mostra o Index sem
 * chamada desde 08/08; o único chamador é o hook. Consequência medida no
 * teste src/test/virada-mes-auditoria.test.tsx: quando Finanças é a PRIMEIRA
 * tela da sessão do dia 1º (toque no aviso "limite de hoje" ou recarregar a
 * aba), o `usePersistedState` dela hidrata ANTES do hook (efeito de filho
 * roda antes do pai) e fica com o balde de setembro em memória; o primeiro
 * toque na tela gravava os ✓ de setembro de volta — com o carimbo já em
 * outubro, nada os zerava de novo. Desde 26/09 a tela REMONTA quando a
 * virada grava (use-virada-do-mes, `useVersaoDaVirada`, usada como `key`
 * no Index) e renasce lendo o store já virado.
 *
 * As travas continuam valendo pra quem chamar: o carimbo já gravado faz a
 * segunda chamada virar no-op, e o arquivo existente nunca é sobrescrito —
 * senão um segundo chamador salvaria por cima do retrato bom um já zerado.
 */
export const aplicarViradaDeContas = (
  virada: ViradaDeContas,
  portas: {
    ler: <T>(chave: string, padrao: T) => T;
    gravar: (chave: string, valor: unknown) => void;
    gravarContas: (contas: DiaDeContas[]) => void;
  },
): { arquivou: boolean; zerou: boolean } => {
  let arquivou = false;
  if (virada.arquivo && !temContas(portas.ler<any>(virada.arquivo.chave, null))) {
    portas.gravar(virada.arquivo.chave, virada.arquivo.contas);
    arquivou = true;
  }
  if (virada.zerou) portas.gravarContas(virada.zeradas);
  portas.gravar(CHAVE_CARIMBO_CONTAS, virada.carimbo);
  return { arquivou, zerou: virada.zerou };
};
