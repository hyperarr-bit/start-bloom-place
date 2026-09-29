import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { fecharSemanaDoDesafio, gastosParaDesafio, lerDesafios, mondayOf } from "@/components/challenges/challenges";

export const CHAVE_DESAFIOS = "finance-challenges";

/** A segunda-feira de agora como ESTADO: muda na volta ao app e num relógio de 1 min
 *  (o app passa dias vivo em segundo plano — ver useMesCorrente). */
const useSemanaCorrente = () => {
  const [semana, setSemana] = useState(() => mondayOf(new Date()));
  useEffect(() => {
    const conferir = () => setSemana(mondayOf(new Date()));
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
  return semana;
};

/**
 * FECHA O DESAFIO DA SEMANA QUE PASSOU, COM OU SEM PAINEL (29/09).
 *
 * O resultado do desafio semanal (Finanças › Painel) só era gravado com o card
 * montado — quem cumpria "Semana sem delivery" e não abria o Painel no domingo
 * ganhava uma derrota na segunda. Aqui, na primeira abertura do app numa semana
 * nova (e na volta ao app quando a semana vira com ele aberto), a semana do
 * desafio é AVALIADA inteira com os gastos de todos os baldes (lib em
 * components/challenges) e o resultado entra no histórico — que alimenta as
 * insígnias de desafio.
 *
 * Gravação de SISTEMA (`system: true`): não é gesto da pessoa — sem isso a
 * chave (que casa com /financ/) contaria como "1º lançamento" na ativação.
 * E avisa um card aberto com a mesma chave (avisarEscritaDeFora).
 */
export const useFechamentoDoDesafio = () => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  const semana = useSemanaCorrente();
  const feitoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded || !user?.id) return;
    const alvo = `${user.id}|${semana}`;
    if (feitoPara.current === alvo) return;
    // Sem desafio gravado (nunca usou, ou os dados da conta ainda não chegaram
    // — ex.: o instante do login, com o store do convidado): não queima a trava;
    // reavalia quando o store mudar (o `get` muda junto).
    const bruto = get<unknown>(CHAVE_DESAFIOS, undefined);
    if (bruto === undefined || bruto === null) return;
    feitoPara.current = alvo;
    const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
    const antes = lerDesafios(bruto);
    const novo = fecharSemanaDoDesafio(
      antes,
      (weekStart) => gastosParaDesafio((chave) => get<unknown>(chave, undefined), weekStart, perfil),
      new Date(),
    );
    if (!novo) return;
    set(CHAVE_DESAFIOS, novo, { system: true });
    avisarEscritaDeFora(CHAVE_DESAFIOS, novo);
    if (novo.history.length > antes.history.length) {
      const fechado = novo.history[novo.history.length - 1];
      trackEvent(fechado.result === "win" ? "challenge_won" : "challenge_lost", { challenge: fechado.key, origem: "abertura" });
    }
  }, [loaded, user?.id, semana, get, set]);
};
