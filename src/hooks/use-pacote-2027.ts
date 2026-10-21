import { useCallback } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { CHAVE_COMPROMISSOS } from "@/lib/compromissos";
import { CHAVE_CONSULTAS } from "@/lib/consulta-avisos";
import { CHAVE_DATAS } from "@/lib/relacoes";
import {
  CHAVE_COFRINHO_2027, CHAVE_DICA_2027, CHAVE_PACOTE_2027, CHAVE_PLANO_2027, aplicarPlano2027, lerCofrinho, lerPlano2027,
  pacote2027Liberado, type Cofrinho2027, type Pacote2027, type Plano2027,
} from "@/lib/pacote-2027";

const CHAVE_METAS = "goals-board-v2";
const CHAVE_ETIQUETAS = "goals-etiquetas";

/** O pacote "Seu 2027" da conta: `pacote` null = não comprou (nada do pacote aparece). */
export const usePacote2027 = () => {
  const { get, set, loaded } = useUserData();
  const bruto = get<unknown>(CHAVE_PACOTE_2027, null);
  const pacote: Pacote2027 | null = pacote2027Liberado(bruto) ? bruto : null;
  const plano: Plano2027 = lerPlano2027(get<unknown>(CHAVE_PLANO_2027, null));
  const cofrinho: Cofrinho2027 = lerCofrinho(get<unknown>(CHAVE_COFRINHO_2027, null));
  /** a explicação da 1ª abertura já foi vista (na conta: não volta ao reabrir, nem em outro aparelho) */
  const dicaVista = get<string>(CHAVE_DICA_2027, "") === "true";

  /** Progresso (revisões) e cofrinho: gravação de SISTEMA (não conta como anotação do dia nem ativação). */
  const salvarProgresso = useCallback((p: Plano2027) => set(CHAVE_PLANO_2027, p, { system: true }), [set]);
  const salvarCofrinho = useCallback((c: Cofrinho2027) => set(CHAVE_COFRINHO_2027, c, { system: true }), [set]);
  const marcarDicaVista = useCallback(() => set(CHAVE_DICA_2027, "true", { system: true }), [set]);

  /**
   * Salva o "Planejar 2027": o plano no pacote + as metas, datas, check-ups e as 12 revisões nos módulos (o que é do
   * pacote é refeito; o resto fica). Avisa as telas abertas de cada chave.
   */
  const salvarPlano = useCallback((p: Plano2027, agora: Date = new Date()): Plano2027 => {
    const novo = aplicarPlano2027(p, {
      goals: get<unknown>(CHAVE_METAS, []),
      etiquetas: get<unknown>(CHAVE_ETIQUETAS, {}),
      relDates: get<unknown>(CHAVE_DATAS, []),
      consultas: get<unknown>(CHAVE_CONSULTAS, []),
      compromissos: get<unknown>(CHAVE_COMPROMISSOS, []),
    });
    const escrever = (k: string, v: unknown) => { set(k, v); avisarEscritaDeFora(k, v); };
    escrever(CHAVE_METAS, novo.goals);
    escrever(CHAVE_ETIQUETAS, novo.etiquetas);
    escrever(CHAVE_DATAS, novo.relDates);
    escrever(CHAVE_CONSULTAS, novo.consultas);
    escrever(CHAVE_COMPROMISSOS, novo.compromissos);
    const salvo: Plano2027 = { ...p, criadasMetas: novo.criadasMetas, salvoEm: agora.toISOString() };
    set(CHAVE_PLANO_2027, salvo, { system: true });
    return salvo;
  }, [get, set]);

  return { pacote, plano, cofrinho, dicaVista, loaded, salvarProgresso, salvarCofrinho, salvarPlano, marcarDicaVista };
};
