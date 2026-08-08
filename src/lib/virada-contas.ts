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
  /** Balde do mês novo: mesmos dias/nomes/valores, todo `paid` em false. */
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

  const dias = (Array.isArray(dueDays) ? dueDays : []).map((d) => ({
    ...d,
    bills: Array.isArray(d?.bills) ? d.bills : [],
  }));
  // Sem nenhuma conta cadastrada não há o que carimbar. Importa mais do que
  // parece: o hook roda também no estado de CONVIDADO (store vazio) e um
  // carimbo gravado ali migraria pra conta no cadastro, fazendo o balde real
  // parecer já virado.
  if (!temContas(dias)) return null;

  const zeradas = dias.map((d) => ({
    ...d,
    bills: d.bills.map((b) => (b?.paid ? { ...b, paid: false } : b)),
  }));
  const zerou = dias.some((d) => d.bills.some((b) => b?.paid));

  let arquivo: ViradaDeContas["arquivo"] = null;
  if (ehCarimbo(carimboAtual)) {
    const [ano, mes] = carimboAtual.split("-").map(Number);
    arquivo = { chave: chaveArquivada(ano, mes - 1, "dueDays"), contas: dias };
  }

  return { zeradas, zerou, arquivo, carimbo: mesAgora };
};

/**
 * Aplica a virada pelas portas de quem chamou.
 *
 * Existem DOIS chamadores de propósito, e os dois precisam ser idempotentes:
 *  - o hook do App (`use-virada-do-mes`), que atende quem nunca abre a aba de
 *    Finanças mas vê "contas a pagar" no hub e nas conquistas;
 *  - a própria tela de Finanças, porque lá o balde vive num estado do React
 *    (`usePersistedState`) que NÃO relê a chave depois de hidratar — escrita
 *    externa seria invisível e o próximo toque na tela ressuscitaria o array
 *    velho por cima.
 *
 * A ordem entre eles não é garantida (efeito de filho roda antes do pai), daí
 * as duas travas: o carimbo já gravado faz o segundo virar no-op, e o arquivo
 * existente nunca é sobrescrito — senão o segundo a rodar salvaria por cima
 * do retrato bom um retrato já zerado.
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
