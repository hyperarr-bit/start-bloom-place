import { useEffect, useRef } from "react";
import { readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { mesclarSemDuplicar, separarPorMes, type Lancamento } from "@/lib/virada-do-mes";

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
     * As duas coisas por motivos diferentes, e a primeira custou duas
     * rodadas perdidas (02/08):
     *
     * O `get` do useUserData responde do `store`, que é hidratado do
     * Supabase. Mas o módulo de Finanças grava com `writeJsonForUser`, que
     * escreve SÓ no localStorage. Então as duas cópias divergem: aqui na
     * conta do dono o localStorage tinha 6 lançamentos e o `get` devolvia 0.
     * Eu estava perguntando pra camada errada e concluindo "não tem nada
     * fora do lugar" — enquanto a tela mostrava os 6.
     *
     * `readMonthData` é o mesmo leitor que a tela usa, então enxerga o que
     * a pessoa enxerga. E o `set` grava nas DUAS pontas (localStorage agora,
     * Supabase no flush), o que de quebra sincroniza o que estava só local.
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
    if (carregados.every((itens) => itens.length === 0)) return;
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
        set(chave, mesclarSemDuplicar(lerBalde(chave), itens));
        mesesTocados.add(chave.split("-").slice(1, 3).join("/"));
      }
      set(balde.corrente, ficam);
      movidosTotal += movidos;
    }

    if (movidosTotal > 0) {
      trackEvent("virada_mes_arquivou", {
        movidos: movidosTotal,
        meses: [...mesesTocados].join(","),
      });
    }
  }, [loaded, user?.id, get, set]);
};
