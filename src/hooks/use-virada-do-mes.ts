import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMonthData } from "@/components/finance/storage-keys";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import {
  mesclarSemDuplicar, separarPorMes, chaveArquivada, viradaDeFixos, CHAVE_FIXOS, CHAVE_CARIMBO_FIXOS, type Lancamento,
} from "@/lib/virada-do-mes";
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
 * Roda uma vez por sessão E por mês (26/09: o mês pode virar com o app
 * aberto — ver abaixo) e é idempotente: separa por DATA e mescla por id.
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

/*
 * ═══ A TELA DE FINANÇAS RELÊ DEPOIS DA VIRADA (26/09, auditoria) ═══
 *
 * O Index (e a planilha do mês, que mora dentro dele) segura
 * `finance-expenses`, `-incomes`, `-dueDays` e `-installments` em
 * `usePersistedState`, que hidrata UMA vez e não relê a chave. Quando
 * Finanças é a primeira tela do dia 1º — o aviso "seu limite de hoje" das
 * 8h abre direto em /financas — ela monta com o cache de setembro e hidrata
 * ANTES deste hook (efeito de filho roda antes do pai). A virada gravava
 * outubro no store e a tela seguia com setembro: o "quanto posso gastar"
 * somava setembro e o primeiro toque gravava os ✓ de setembro por cima de
 * outubro — já com o carimbo de outubro, nada os zerava de novo no mês.
 *
 * Duas saídas foram pesadas:
 *  - PORTÃO na rota (Finanças espera a virada): prende a tela atrás da carga
 *    do servidor em TODA abertura direta — com rede ruim, Finanças presa num
 *    "carregando" — e pede um tempo-limite que, ao estourar, devolve o mesmo
 *    risco;
 *  - REMONTAR a tela quando a virada grava (a escolhida): ela aparece na
 *    hora com o cache e renasce com outubro assim que a virada termina.
 *
 * O cuidado que torna a remontagem segura é a ORDEM. A versão é publicada
 * por `useSyncExternalStore` e a virada roda em `useLayoutEffect`: as
 * gravações (setState do provider) e a versão nova saem juntas, no mesmo
 * passe síncrono do commit — o Index novo nasce lendo o store já virado e
 * não sobra janela pra um toque cair entre a gravação e a remontagem. Com
 * `useEffect`, a versão (prioridade síncrona) renderizaria ANTES das
 * gravações (prioridade normal) e o Index novo nasceria velho de novo.
 */
let versaoDaVirada = 0;
const ouvintesDaVirada = new Set<() => void>();
const publicarVirada = () => {
  versaoDaVirada += 1;
  ouvintesDaVirada.forEach((avisar) => avisar());
};
const assinarVirada = (avisar: () => void) => {
  ouvintesDaVirada.add(avisar);
  return () => { ouvintesDaVirada.delete(avisar); };
};
const lerVersaoDaVirada = () => versaoDaVirada;

/** Muda toda vez que a virada grava dado que uma tela pode ter em memória —
 *  quem segura baldes de Finanças usa como `key` pra remontar (Index). */
export const useVersaoDaVirada = () => useSyncExternalStore(assinarVirada, lerVersaoDaVirada, lerVersaoDaVirada);

/**
 * O mês de agora como ESTADO (26/09): muda na volta ao app
 * (visibilitychange/focus) e num relógio de 1 min. Pra quem calcula "o mês
 * atual" na tela e não pode congelar com o app aberto na meia-noite do dia 1º
 * (Orçamento Mensal, gráficos do Dashboard).
 */
export const useMesCorrente = () => {
  const [mes, setMes] = useState(() => mesCorrenteId());
  useEffect(() => {
    const conferir = () => setMes(mesCorrenteId());
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", conferir);
    const relogio = window.setInterval(conferir, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", conferir);
      window.clearInterval(relogio);
    };
  }, []);
  return mes;
};

export const useViradaDoMes = () => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();

  /*
   * O MÊS VIRA COM O APP ABERTO (26/09, auditoria da virada 30/09 → 01/10).
   *
   * A trava abaixo era "uma vez por sessão": no celular o app passa dias
   * vivo em segundo plano, então quem deixou o app aberto no dia 30 e voltou
   * no dia 1º não arquivava nada até matar o app — e, quando matava, a
   * virada arquivava o balde de OUTUBRO como se fosse setembro (o ✓ pago no
   * dia 1º virava histórico de setembro e outubro voltava a "não pago").
   * Agora o mês é estado: a volta ao app (visibilitychange/focus) e um
   * relógio de 1 min o atualizam, e a trava passa a ser (quem, mês).
   */
  const mesVisto = useMesCorrente();
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

  // (26/09) useLayoutEffect de propósito — ver "A TELA DE FINANÇAS RELÊ
  // DEPOIS DA VIRADA": as gravações e a versão precisam sair no mesmo passe.
  useLayoutEffect(() => {
    const quem = user?.id ?? "convidado";
    const hoje = new Date();
    const agora = mesCorrenteId(hoje);
    // (26/09) trava por (quem, MÊS) — ver "O MÊS VIRA COM O APP ABERTO".
    const alvo = `${quem}|${agora}`;
    if (!loaded || feitoPara.current === alvo) return;

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
    feitoPara.current = alvo;
    // (26/09) Toda escrita desta passada passa por `gravar`: se alguma tocou
    // DADO (não só carimbo), a tela de Finanças remonta no fim — ver "A TELA
    // DE FINANÇAS RELÊ DEPOIS DA VIRADA".
    let mexeuEmDados = false;
    const gravar = (chave: string, valor: unknown) => {
      if (chave !== CHAVE_CARIMBO_CONTAS && chave !== CHAVE_CARIMBO_FIXOS) mexeuEmDados = true;
      set(chave, valor, { system: true });
    };
    // chaves de mês passado que receberam lançamento NESTA passada (26/09):
    // é o "teve movimento" dos fixos, e vale até pra convidado, cujo `get`
    // ainda não enxerga a escrita feita neste mesmo efeito.
    const chavesArquivadas = new Set<string>();

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
        gravar(chave, mesclarSemDuplicar(lerBalde(chave), itens));
        mesesTocados.add(chave.split("-").slice(1, 3).join("/"));
        chavesArquivadas.add(chave);
      }
      gravar(balde.corrente, ficam);
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
     * lib/virada-contas.ts. (26/09: este é o ÚNICO chamador — a tela de
     * Finanças nunca chamou; por isso ela REMONTA quando a virada grava, ver
     * `useVersaoDaVirada`.)
     */
    const virada = viradaDeContas(contas, get<string>(CHAVE_CARIMBO_CONTAS, ""), hoje);
    if (virada) {
      const r = aplicarViradaDeContas(virada, {
        ler: (chave, padrao) => get(chave, padrao),
        gravar: (chave, valor) => gravar(chave, valor),
        gravarContas: (zeradas) => gravar(CHAVE_CONTAS, zeradas),
      });
      if (r.zerou) trackEvent("virada_mes_zerou_contas", { arquivou: r.arquivou ? 1 : 0 });
    }

    /*
     * CUSTOS FIXOS DO MÊS QUE ACABOU (26/09) — regra em lib/virada-do-mes
     * (`viradaDeFixos`). Sem isto a retrospectiva do dia 1º, a Comparação
     * Mensal/Anual e os gráficos liam setembro SEM o aluguel. Movimento =
     * receita ou gasto datado no mês (arquivado agora ou antes). Chave do
     * mês que já existe — planilha que a pessoa editou, mesmo vazia — nunca
     * é sobrescrita; rodar de novo não duplica (o carimbo já diz o mês).
     */
    const teveMovimento = (ano: number, mes: number) =>
      (["expenses", "incomes"] as const).some((sufixo) => {
        const chave = chaveArquivada(ano, mes, sufixo);
        return chavesArquivadas.has(chave) || lerBalde(chave).length > 0;
      });
    const fixosAgora = readMonthData(uid, CHAVE_FIXOS) ?? get<unknown[]>(CHAVE_FIXOS, []);
    const vf = viradaDeFixos(fixosAgora, get<string>(CHAVE_CARIMBO_FIXOS, ""), hoje, teveMovimento);
    if (vf) {
      if (vf.arquivo && (readMonthData(uid, vf.arquivo.chave) ?? get<unknown>(vf.arquivo.chave, null)) == null) {
        gravar(vf.arquivo.chave, vf.arquivo.fixos);
        trackEvent("virada_mes_fixos", { itens: vf.arquivo.fixos.length });
      }
      gravar(CHAVE_CARIMBO_FIXOS, vf.carimbo);
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
    const fontes = [agora, ...mesesAnteriores(agora, MESES_DE_PARCELAS)].map((mes) => ({
      mes,
      chave: chaveArquivadaDeParcelas(mes),
      itens: lerBalde(chaveArquivadaDeParcelas(mes)) as unknown as Parcela[],
    }));
    const vp = viradaDeParcelas(parcelas, agora, fontes);
    if (vp) {
      for (const [mes, retratos] of Object.entries(vp.arquivos)) {
        const chave = chaveArquivadaDeParcelas(mes);
        gravar(chave, mesclarSemDuplicar(lerBalde(chave), retratos as unknown as Lancamento[]));
      }
      for (const [mes, itens] of Object.entries(vp.fontesAtualizadas)) {
        gravar(chaveArquivadaDeParcelas(mes), itens);
      }
      gravar(CHAVE_PARCELAS, vp.lista);
      trackEvent("virada_mes_parcelas", {
        avancadas: vp.lista.length,
        retratos: Object.values(vp.arquivos).reduce((s, l) => s + l.length, 0),
      });
    }
    // (26/09) Gravou dado? Quem segura baldes em memória (Index) remonta
    // agora, no mesmo passe síncrono das gravações acima.
    if (mexeuEmDados) publicarVirada();
  }, [loaded, user?.id, get, set, mesVisto]);
};
