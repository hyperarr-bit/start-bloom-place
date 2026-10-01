import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import Home from "@/pages/Home";

/**
 * /dev/home-landing — SÓ NO SERVIDOR DE DESENVOLVIMENTO (some do build). A Home
 * de verdade com dados de EXEMPLO em memória, pra fotografar o hero da landing
 * (01/10) com a tela "vivida": tarefas do dia já marcadas, água andando,
 * sequência de dias. Nada vai pro servidor, não precisa de conta. Mesmo
 * padrão do /dev/tarefas; a tela é o app real, só o conteúdo é de exemplo
 * (regra da memória feedback-posts-print-real).
 */
const seeds = (hoje: string): Record<string, unknown> => ({
  "core-user-name": "Ana",
  "core-home-widgets-v2": [{ id: "tasks", size: "large" }],
  "core-saude-water": { [hoje]: 6 },
  "core-saude-water-goal": 8,
  "core-hub-streak": { count: 12, lastDate: hoje },
  "rotina-habits": ["Beber 2L de água", "Ler 20 min", "Treinar"],
  "rotina-day-tasks": [
    { id: "r1", texto: "Tomar o remédio da pressão", feito: true, dia: hoje, hora: "08:00", aviso: 0 },
    { id: "r2", texto: "Beber 500 ml de água", feito: true, dia: hoje, hora: "10:30", aviso: 0 },
    { id: "r3", texto: "Pagar a conta de luz", feito: true, dia: hoje, hora: "12:00", aviso: 0 },
    { id: "r4", texto: "Treino de pernas", feito: false, dia: hoje, hora: "18:30", aviso: 30 },
    { id: "r5", texto: "Separar a roupa de amanhã", feito: false, dia: hoje, hora: "21:00", aviso: 0 },
  ],
});

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

export default function DevHomeLanding() {
  const hoje = localDayKey();
  const inicial = useMemo(() => seeds(hoje), [hoje]);
  return <Provedor inicial={inicial}><Home /></Provedor>;
}
