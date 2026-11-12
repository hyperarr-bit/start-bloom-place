import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useAuthOpcional } from "@/hooks/use-auth";
import { definirDonoDaMissao, guardarForcaDaUrl, missaoDosesLigada } from "@/lib/missao-doses";
import { guardarForcaDia1Cheio } from "@/lib/dia1-cheio";
import { guardarForcaDias23 } from "@/lib/dias23";
import { guardarForcaConstruiu } from "@/lib/construiu-ab";

/*
 * 11/11 (velocidade 1.0.26, item 1 aprovado pelo dono): a PORTA LEVE da missão em doses. O App importava
 * MissaoDosesNaWeb direto, e ela puxava pra dentro do 1º pedaço a missão inteira (folhas, boas-vindas, plano de
 * amanhã, álbum, demo guiada, montar módulo…), mesmo pra quem não vai ver nada disso. Agora o App importa só isto:
 *  - o dono da missão na sessão e as forças de QA pelo link continuam rodando na hora, em qualquer rota;
 *  - com a missão ligada (app da loja, ou a chave/força na web), o pedaço da missão é PEDIDO na mesma hora em que a
 *    porta monta (junto com o da Home, que também é sob demanda) — chega antes de a conta vir do servidor, que é quem
 *    decide mostrar qualquer folha (nada aparece antes de `loaded`). Com a missão desligada, nunca baixa.
 * O comportamento é o mesmo de antes: `MissaoDosesLigada` = o que a MissaoDosesNaWeb mostrava com a missão ligada.
 * Teste: src/test/missao-doses-portao.test.tsx.
 */
let pedido: Promise<typeof import("./MissaoDosesNaWeb")> | null = null;
/** Pede o pedaço da missão uma vez só (a lazy abaixo reaproveita o mesmo pedido). */
export const pedirPedacoDaMissao = () => (pedido ??= import("./MissaoDosesNaWeb"));
const MissaoDosesLigadaLazy = lazy(() => pedirPedacoDaMissao().then((m) => ({ default: m.MissaoDosesLigada })));

/**
 * 1.0.16 (4.8): define o DONO da missão pra sessão ANTES das rotas renderizarem (App monta isto antes do
 * <Routes>) — assim a Home, o tour e os Momentos já leem a missão filtrada pela conta logada no 1º render.
 */
export function DonoDaMissaoNaSessao() {
  const auth = useAuthOpcional();
  definirDonoDaMissao(auth?.user?.id);
  return null;
}

export function MissaoDosesNaWeb() {
  const { search } = useLocation();
  // a força de QA pelo link, em qualquer rota (o link do dono pode cair em qualquer página)
  guardarForcaDaUrl(search);
  guardarForcaDia1Cheio(search);
  guardarForcaDias23(search);
  guardarForcaConstruiu(search);
  const ligada = missaoDosesLigada();
  if (!ligada) return null;
  void pedirPedacoDaMissao();
  return <Suspense fallback={null}><MissaoDosesLigadaLazy /></Suspense>;
}
