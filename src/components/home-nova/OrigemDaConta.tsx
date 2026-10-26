import { useEffect } from "react";
import { useAuthOpcional } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";
import { CHAVE_MISSAO_NA_CONTA, lerMissao, missaoDaConta, missaoValida } from "@/lib/missao-doses";
import {
  CHAVE_ORIGEM_CONTA, anotarOrigemEmMemoria, classificarOrigem, definirContaHomeNova, lerMarcadorOrigem, marcadorDe, origemConhecida,
  origemEmMemoria, registrarOrigem, type OrigemDaConta,
} from "@/lib/home-nova";

/**
 * A ORIGEM DA CONTA NA SESSÃO (1.0.19, 26/10 — modo "novas" da chave `home_nova`, lib/home-nova).
 *
 * Montado no App ANTES das rotas (como o DonoDaMissaoNaSessao): define a conta da sessão pra quem decide sem React
 * (tour, missão, rotas) e, com a conta CARREGADA do servidor, decide a origem dela UMA vez:
 *   1. marcador já na conta → vale ele (outro aparelho/reinstalação: nunca reclassifica);
 *   2. já decidida nesta abertura (memória) ou neste aparelho (espelho) → vale ela, e sobe pra conta se faltar;
 *   3. senão, a regra (classificarOrigem): no app, conta < 48 h e sem missão de antes = "nova"; o resto "antiga".
 * A decisão entra na memória JÁ NO RENDER (a Home, renderizada depois deste nó, vê a origem certa no mesmo passe —
 * a conta nova não pisca a Home antiga) e é gravada (conta + espelho + aviso) no efeito. No site nada é decidido.
 */
export function OrigemDaContaNaSessao() {
  const auth = useAuthOpcional();
  const user = auth?.user ?? null;
  const { get, set, loaded } = useUserData();
  const uid = user?.id ?? null;
  definirContaHomeNova(uid);

  let origem: OrigemDaConta | null = null;
  let falta: boolean = false; // o marcador ainda não está na conta
  if (uid && loaded) {
    const naConta = lerMarcadorOrigem(get<unknown>(CHAVE_ORIGEM_CONTA, null));
    if (naConta) origem = naConta;
    else {
      origem = origemEmMemoria(uid) ?? origemConhecida(uid);
      if (!origem && isNativeShell()) {
        let temMissaoDeAntes = false;
        try {
          temMissaoDeAntes = !!missaoValida(get<unknown>(CHAVE_MISSAO_NA_CONTA, null));
          // a missão local conta se é DESTA conta (dono) — ou, sem dono (missão sem braço), se nasceu depois da conta
          const local = lerMissao();
          const criada = (user as { created_at?: string } | null)?.created_at;
          const diaDaConta = criada ? localDayKey(new Date(criada)) : "";
          if (local && (local.dono ? missaoDaConta(local, uid) : local.inicio >= diaDaConta)) temMissaoDeAntes = true;
        } catch { temMissaoDeAntes = true; /* na dúvida, antiga */ }
        origem = classificarOrigem({ nativo: true, criadoEm: (user as { created_at?: string } | null)?.created_at, temMissaoDeAntes });
      }
      falta = !!origem && isNativeShell();
    }
    if (origem && origemEmMemoria(uid) !== origem) anotarOrigemEmMemoria(uid, origem);
  }

  useEffect(() => {
    if (!uid || !origem) return;
    registrarOrigem(uid, origem);
    if (falta) set(CHAVE_ORIGEM_CONTA, marcadorDe(origem), { system: true });
  }, [uid, origem, falta, set]);

  return null;
}
