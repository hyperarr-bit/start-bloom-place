import { useEffect } from "react";
import { useAuthOpcional } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import { CHAVE_MISSAO_NA_CONTA, lerMissao, missaoDaConta, missaoDeAntesDa1019, missaoValida } from "@/lib/missao-doses";
import {
  CHAVE_ORIGEM_CONTA, anotarOrigemEmMemoria, classificarOrigem, definirContaHomeNova, lerMarcadorOrigem, marcadorDe, marcarOrigemTentada,
  origemConhecida, origemEmMemoria, registrarOrigem, type OrigemDaConta,
} from "@/lib/home-nova";

type Conta = { id?: string; created_at?: string } | null | undefined;
type Leitor = <T>(key: string, fallback: T) => T;

/**
 * A conta que o useUserData tem na mão é DESTA conta? `loaded` sozinho não prova: no render em que o login troca o
 * convidado pela conta (cadastro no app), o `loaded` ainda é o do convidado — o provider só zera no efeito. A conta de
 * verdade chega com `contaCompleta` (no mesmo lote do `loaded`); undefined = provider sem o campo (testes) = vale.
 */
export const contaCarregadaDeVerdade = (loaded: boolean, contaCompleta: boolean | undefined): boolean =>
  loaded && contaCompleta !== false;

/**
 * 26/10 — A DECISÃO DA ORIGEM (pura, sem gravar; anota só na memória desta abertura). Chamada no RENDER por quem
 * precisa dela antes de pintar: OrigemDaContaNaSessao (App, que também grava) e a própria Home (pages/Home, pra
 * nunca depender da ordem da árvore). Devolve a origem e se o marcador ainda falta na conta.
 *   1. marcador já na conta → vale ele (outro aparelho/reinstalação: nunca reclassifica);
 *   2. já decidida nesta abertura (memória) ou neste aparelho (espelho) → vale ela (e sobe pra conta se faltar);
 *   3. senão, no app: a regra (classificarOrigem) — conta < 48 h e sem missão de antes = "nova"; o resto "antiga".
 *      Sem created_at: null (indecidível — não grava nada; a Home fica com a de hoje nesta abertura).
 * No site: só o marcador da conta (nada é decidido nem gravado).
 */
export function decidirOrigemDaConta(user: Conta, get: Leitor): { origem: OrigemDaConta | null; faltaNaConta: boolean } {
  const uid = user?.id;
  if (!uid) return { origem: null, faltaNaConta: false };
  marcarOrigemTentada(uid);
  const naConta = lerMarcadorOrigem(get<unknown>(CHAVE_ORIGEM_CONTA, null));
  let origem: OrigemDaConta | null = naConta;
  if (!origem) {
    origem = origemEmMemoria(uid) ?? origemConhecida(uid);
    const criada = user?.created_at;
    if (!origem && isNativeShell() && criada) {
      let temMissaoDeAntes = false;
      try {
        // P1 (varredura novato, 26/10): só conta a missão de ANTES da 1.0.19 (sem o carimbo `criadaNa`). A missão que a
        // 1.0.19 cria no cadastro dentro do app (carimbada) nunca faz da conta nova uma "antiga".
        temMissaoDeAntes = missaoDeAntesDa1019(missaoValida(get<unknown>(CHAVE_MISSAO_NA_CONTA, null)));
        // a missão local conta se é DESTA conta (dono) — ou, sem dono (missão sem braço), se nasceu depois da conta
        const local = lerMissao();
        const diaDaConta = localDayKey(new Date(criada));
        if (local && missaoDeAntesDa1019(local) && (local.dono ? missaoDaConta(local, uid) : local.inicio >= diaDaConta)) temMissaoDeAntes = true;
      } catch { temMissaoDeAntes = true; /* na dúvida, antiga */ }
      origem = classificarOrigem({ nativo: true, criadoEm: criada, temMissaoDeAntes });
    }
  }
  if (origem && origemEmMemoria(uid) !== origem) anotarOrigemEmMemoria(uid, origem);
  return { origem, faltaNaConta: !naConta && !!origem && isNativeShell() };
}

/**
 * A ORIGEM DA CONTA NA SESSÃO (1.0.19, 26/10 — modo "novas"/"novas+admin" da chave `home_nova`, lib/home-nova).
 *
 * Montado no App ANTES das rotas (como o DonoDaMissaoNaSessao): define a conta da sessão pra quem decide sem React
 * (tour, missão, rotas) e, com a conta CARREGADA do servidor (desta conta — contaCarregadaDeVerdade), decide a origem
 * dela UMA vez (decidirOrigemDaConta). A decisão entra na memória JÁ NO RENDER (a Home vê a origem certa no mesmo
 * passe — e ela mesma decide se precisar) e é gravada (conta + espelho + aviso) no efeito. No site nada é decidido.
 * A missão em doses nasce no EFEITO do MissaoDosesNaWeb, depois deste render: ela nunca vira a conta nova em antiga.
 * P1 (varredura novato, 26/10): isso NÃO valia no cadastro dentro do app — no render da troca convidado → conta, o
 * `loaded` ainda era o do convidado e a missão nascia (com dono) antes de a conta ser lida; aqui ela contava como
 * "missão de antes" → Home antiga pra sempre. Consertado nas duas pontas: a missão só nasce com a conta desta pessoa
 * lida (MissaoDosesNaWeb, contaCarregadaDeVerdade) e só a missão SEM o carimbo `criadaNa` (de antes da 1.0.19) conta.
 *
 * Reclassificar contas já marcadas "antiga" por esse bug (TestFlight): NÃO — decisão de 26/10. Nenhuma build de loja
 * teve o bug (a 1.0.19 ainda não saiu), então só contas de teste foram marcadas; qualquer heurística de "desfazer"
 * (marcador 1.0.19 + conta < 48 h + missão do mesmo dia) também pegaria quem começou o teste na 1.0.18 e atualizou
 * logo — e cliente antigo nunca pode virar "nova". Conta de teste marcada errado: criar outra.
 */
export function OrigemDaContaNaSessao() {
  const auth = useAuthOpcional();
  const user = auth?.user ?? null;
  const { get, set, loaded, contaCompleta } = useUserData();
  const uid = user?.id ?? null;
  definirContaHomeNova(uid);

  const pronta = !!uid && contaCarregadaDeVerdade(loaded, contaCompleta);
  const { origem, faltaNaConta } = pronta
    ? decidirOrigemDaConta(user as Conta, get)
    : { origem: null as OrigemDaConta | null, faltaNaConta: false };

  useEffect(() => {
    if (!uid || !origem) return;
    registrarOrigem(uid, origem);
    if (faltaNaConta) set(CHAVE_ORIGEM_CONTA, marcadorDe(origem), { system: true });
  }, [uid, origem, faltaNaConta, set]);

  return null;
}
