import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { CHAVE_KIT, CHAVE_KIT_DIVIDAS, CHAVE_KIT_PROGRESSO } from "@/lib/kit-primeiro-mes";
import { mondayOf } from "@/components/challenges/challenges";
import Index from "@/pages/Index";

/**
 * /dev/kit — SÓ NO SERVIDOR DE DESENVOLVIMENTO (rota dentro de
 * `import.meta.env.DEV`). Finanças de verdade com o Kit Primeiro Mês liberado,
 * em memória (nada vai pro servidor). Pra fotografar antes de ir pro ar.
 *   ?dia=N      · hoje é o dia N do plano (padrão 5)
 *   ?feitos=K   · os K primeiros dias marcados (padrão dia-1)
 *   ?dividas=1  · planilha com 3 dívidas de exemplo
 *   ?sem=1      · conta SEM o kit (nada do kit aparece)
 */
const seeds = (dia: number, feitos: number, dividas: boolean, sem: boolean): Record<string, unknown> => {
  const compra = new Date();
  compra.setDate(compra.getDate() - (dia - 1));
  const inicio = localDayKey(compra);
  const hoje = localDayKey();
  const base: Record<string, unknown> = {
    "spotlight-done-financas": "true",
    "finance-incomes": [{ id: "i1", description: "Salário", value: 2800, date: hoje }],
    "finance-fixed-expenses": [
      { id: "f1", description: "Aluguel", value: 950, day: 5 },
      { id: "f2", description: "Internet", value: 99.9, day: 10 },
    ],
    "finance-expenses": [{ id: "e1", description: "Mercado", value: 86.4, category: "alimentacao", date: hoje }],
  };
  if (sem) return base;
  return {
    ...base,
    [CHAVE_KIT]: { comprado: true, em: compra.toISOString() },
    [CHAVE_KIT_PROGRESSO]: {
      inicio,
      feitos: Object.fromEntries(Array.from({ length: Math.max(0, feitos) }, (_, i) => [String(i + 1), hoje])),
      desafios: [],
    },
    "finance-challenges": { active: { key: "registro-5-dias", weekStart: mondayOf(new Date()) }, history: [] },
    ...(dividas
      ? {
          [CHAVE_KIT_DIVIDAS]: [
            { id: "d1", nome: "Cartão (rotativo)", saldo: 2400, juros: 12, parcela: 350 },
            { id: "d2", nome: "Carnê da loja", saldo: 480, juros: 0, parcela: 120 },
            { id: "d3", nome: "Empréstimo do banco", saldo: 3600, juros: 3.5, parcela: 260 },
          ],
        }
      : {}),
  };
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const DevKit = () => {
  const [params] = useSearchParams();
  const dia = Number(params.get("dia") ?? 5) || 5;
  const feitos = params.has("feitos") ? Number(params.get("feitos")) : dia - 1;
  const inicial = useMemo(
    () => seeds(dia, feitos, params.get("dividas") === "1", params.get("sem") === "1"),
    [dia, feitos, params],
  );
  return <Provedor inicial={inicial}><Index /></Provedor>;
};

export default DevKit;
