import { useEffect, useRef } from "react";
import { readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { mesclarSemDuplicar, separarPorMes, type Lancamento } from "@/lib/virada-do-mes";
import {
  aplicarViradaDeContas,
  viradaDeContas,
  temContas,
  mesCorrenteId,
  CHAVE_CARIMBO_CONTAS,
  CHAVE_CONTAS,
  type DiaDeContas,
} from "@/lib/virada-contas";
import {
  viradaDeParcelas, mesesAnteriores, chaveArquivadaDeParcelas, type Parcela,
} from "@/lib/finance-parcelas";

/** Balde corrente das parcelas — a mesma chave de sempre, sem renomear. */
const CHAVE_PARCELAS = "finance-installments";
/** Até onde olhar pra trás por parcela nascida em planilha de mês antigo. */
const MESES_DE_PARCELAS = 24;

/**
 * Aplica a separação por mês assim que os dados carregam (01/08).
 *
 * Passa pelo `useUserData` de propósito. O `writeJsonForUser` do módulo de
 * Finanças grava SÓ no localStorage — arquivar por ali seria desfeito no
 * próximo sync vindo do Supabase. O `set` daqui é o que faz o upsert em
 * `user_data`, então o conserto viaja com a conta e vale no app da loja
 * também, não só neste navegador.
 *
 * Roda uma vez por sessão e é idempotente: separa por DATA e mescla por id.
 * Se não houver nada fora do lugar, não escreve chave nenhuma — o custo pra
 * quem já está certo é ler dois arrays pequenos.
 *
 * Vive no App, não na tela de Finanças: quem abre a retrospectiva pela
 * notificação nunca passou por Finanças, e é justamente essa pessoa que via
 * o mês vazio.
 */

const BALDES = [
  { corrente: "finance-expenses", sufixo: "expenses" as const },
  { corrente: "finance-incomes", sufixo: "incomes" as const },
];

export const useViradaDoMes = () => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  /*
   * A trava é a IDENTIDADE, não uma flag de sessão — e isso custou uma
   * rodada perdida (02/08).
   *
   * Com `useRef(false)` simples não funcionava: este hook mora junto das
   * rotas, então já está montado na tela de /entrar. Ali o `loaded` fica
   * verdadeiro para o estado de CONVIDADO, com store vazio — a flag queimava
   * nesse instante e, depois do login, quando os dados da conta finalmente
   * chegavam, o efeito via a flag e voltava sem fazer nada.
   *
   * Guardando QUEM foi atendido, a troca de convidado → usuário conta como
   * um novo alvo e o arquivamento roda com os dados certos na mão.
   */
  const feitoPara = useRef<string | null>(null);

  useEffect(() => {
    const quem = user?.id ?? "convidado";
    if (!loaded || feitoPara.current === quem) return;

    const hoje = new Date();
    let movidosTotal = 0;
    const mesesTocados = new Set<string>();

    /*
     * LER pelo leitor do próprio módulo de Finanças, ESCREVER pelo `set`.
     *
     * Leitura: `readMonthData` é o mesmo leitor que a tela de Finanças usa
     * (localStorage direto). Ler pela mesma porta que a tela garante que
     * este código enxerga exatamente o que a pessoa enxerga — o `get` fica
     * de reserva, pro caso do store já ter o valor e o cache local não.
     *
     * Escrita: `set` grava nas DUAS pontas — localStorage na hora e upsert
     * em `user_data` no flush. `writeJsonForUser`, que o módulo usa, grava
     * só local; arquivar por ali não viajaria com a conta e o conserto não
     * valeria no app da loja.
     */
    const uid = user?.id ?? null;
    const lerBalde = (chave: string): Lancamento[] => {
      const doModulo = readMonthData(uid, chave);
      if (Array.isArray(doModulo) && doModulo.length > 0) return doModulo;
      return get<Lancamento[]>(chave, []);
    };

    /*
     * NÃO queimar a trava enquanto não há o que olhar (02/08).
     *
     * `loaded` fica verdadeiro assim que a hidratação LOCAL termina — e num
     * dispositivo novo ela termina achando nada, porque os dados só chegam
     * depois, do Supabase. O efeito rodava nesse buraco, via dois baldes
     * vazios, dava o serviço por feito e nunca mais voltava.
     *
     * No celular de quem já usa o app o localStorage está cheio e passaria
     * despercebido — foi assim que quase subiu. Correção não pode depender
     * de sorte de timing: enquanto os dois baldes estiverem vazios, o efeito
     * simplesmente não se dá por atendido e reavalia quando o store mudar.
     * Custo de esperar: ler dois arrays pequenos.
     */
    const carregados = BALDES.map((b) => lerBalde(b.corrente));
    // As contas do mês entram na MESMA espera: elas moram num balde sem data
    // por item (`finance-dueDays`) e são o motivo de o ✓ de "pago" sobreviver
    // à virada — ver lib/virada-contas.ts.
    const contas = (readMonthData(uid, CHAVE_CONTAS) ??
      get<DiaDeContas[]>(CHAVE_CONTAS, [])) as DiaDeContas[];
    // As parcelas entram na mesma espera (07/09): balde vazio + contas vazias
    // + lançamentos vazios = ainda não há o que olhar.
    const parcelas = lerBalde(CHAVE_PARCELAS) as unknown as Parcela[];
    if (carregados.every((itens) => itens.length === 0) && !temContas(contas) && parcelas.length === 0) return;
    feitoPara.current = quem;

    for (let i = 0; i < BALDES.length; i++) {
      const balde = BALDES[i];
      const atuais = carregados[i];
      if (atuais.length === 0) continue;

      const { ficam, arquivar, movidos } = separarPorMes(atuais, hoje, balde.sufixo);
      if (movidos === 0) continue;

      // Arquiva ANTES de encolher o balde corrente: se algo falhar no meio, o
      // pior cenário é lançamento duplicado (que a mesclagem por id resolve na
      // próxima passada), nunca lançamento perdido.
      for (const [chave, itens] of Object.entries(arquivar)) {
        set(chave, mesclarSemDuplicar(lerBalde(chave), itens), { system: true });
        mesesTocados.add(chave.split("-").slice(1, 3).join("/"));
      }
      set(balde.corrente, ficam, { system: true });
      movidosTotal += movidos;
    }

    if (movidosTotal > 0) {
      trackEvent("virada_mes_arquivou", {
        movidos: movidosTotal,
        meses: [...mesesTocados].join(","),
      });
    }

    /*
     * CONTAS DO MÊS: o ✓ de "pago" expira, a conta não.
     *
     * Aqui a separação NÃO pode ser por data do lançamento (conta não tem
     * data, tem DIA — ela é recorrente). Quem diz de que mês são os ✓ é o
     * carimbo `finance-dueDays-mes`. Tudo que decide isso está em
     * lib/virada-contas.ts, compartilhado com a tela de Finanças: os dois
     * chamadores rodam, os dois são idempotentes.
     */
    const virada = viradaDeContas(contas, get<string>(CHAVE_CARIMBO_CONTAS, ""), hoje);
    if (virada) {
      const r = aplicarViradaDeContas(virada, {
        ler: (chave, padrao) => get(chave, padrao),
        gravar: (chave, valor) => set(chave, valor, { system: true }),
        gravarContas: (zeradas) => set(CHAVE_CONTAS, zeradas, { system: true }),
      });
      if (r.zerou) trackEvent("virada_mes_zerou_contas", { arquivou: r.arquivou ? 1 : 0 });
    }

    /*
     * PARCELAS: "k de N" avança sozinho na virada (07/09).
     *
     * Avaliações da Play (set/2026): "não é repetida para os próximos meses
     * até finalizar" / "não atualiza para o próximo mês, tendo que adicionar
     * novamente". A regra toda mora em lib/finance-parcelas: registro do
     * balde carimbado com mês anterior deixa um RETRATO na chave daquele mês
     * e avança no próprio balde; parcela nascida dentro da planilha de um
     * mês antigo é trazida pro balde uma única vez (marca `levada`).
     *
     * Roda AQUI, e não na tela de Finanças, pelo mesmo motivo dos outros
     * baldes: `set` de sistema não dispara ativação nem degrau do teste
     * grátis (`/finance-installments/` é gatilho de first_installment) — uma
     * escrita de boot pela tela contaria como gesto da pessoa. A tela ainda
     * recalcula a projeção ao renderizar (pura), pro caso de já estar
     * montada quando isto roda.
     */
    const agora = mesCorrenteId(hoje);
    const fontes = [agora, ...mesesAnteriores(agora, MESES_DE_PARCELAS)].map((mes) => ({
      mes,
      chave: chaveArquivadaDeParcelas(mes),
      itens: lerBalde(chaveArquivadaDeParcelas(mes)) as unknown as Parcela[],
    }));
    const vp = viradaDeParcelas(parcelas, agora, fontes);
    if (vp) {
      for (const [mes, retratos] of Object.entries(vp.arquivos)) {
        const chave = chaveArquivadaDeParcelas(mes);
        set(chave, mesclarSemDuplicar(lerBalde(chave), retratos as unknown as Lancamento[]), { system: true });
      }
      for (const [mes, itens] of Object.entries(vp.fontesAtualizadas)) {
        set(chaveArquivadaDeParcelas(mes), itens, { system: true });
      }
      set(CHAVE_PARCELAS, vp.lista, { system: true });
      trackEvent("virada_mes_parcelas", {
        avancadas: vp.lista.length,
        retratos: Object.values(vp.arquivos).reduce((s, l) => s + l.length, 0),
      });
    }
  }, [loaded, user?.id, get, set]);
};
