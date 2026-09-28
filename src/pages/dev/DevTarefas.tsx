import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import Home from "@/pages/Home";
import Carreira from "@/pages/Carreira";

/**
 * /dev/tarefas — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota
 * dentro de `import.meta.env.DEV`; some do build). A Home de verdade (e a
 * Carreira › Meu dia) com tarefas de exemplo em memória — nada vai pro
 * servidor, não precisa de conta. Pra fotografar o desenho da tarefa com
 * horário e detalhes (28/09) antes de ir pro ar.
 *   ?tela=carreira  · a lista dentro do módulo (BlocoDeFases)
 *   ?vazio=1        · o widget sem nenhuma tarefa
 * O tema escuro vem do próprio app (localStorage "core-theme-mode").
 */

const seeds = (hoje: string, vazio: boolean): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    "core-user-name": "Ana Beatriz",
    "core-home-widgets-v2": [{ id: "tasks", size: "large" }],
    "core-saude-water": { [hoje]: 3 },
    "core-saude-water-goal": 8,
    "rotina-habits": ["Beber 2L de água", "Ler 20 min"],
    "career-day-phases": [
      { id: "f1", nome: "Prospecção", memo: "", counts: { [hoje]: 3 } },
      { id: "f2", nome: "Follow-up", memo: "", counts: { [hoje]: 1 } },
    ],
  };
  if (vazio) return base;
  return {
    ...base,
    // Rotina › tarefas de hoje: o remédio (feito) e a água, as duas com horário
    "rotina-day-tasks": [
      { id: "r1", texto: "Tomar o remédio da pressão", feito: true, dia: hoje, hora: "08:00", aviso: 0 },
      { id: "r2", texto: "Beber 500 ml de água", feito: false, dia: hoje, hora: "10:30", aviso: 0 },
      // tarefa ANTIGA, sem nenhum campo novo — tem que continuar igual
      { id: "r0", texto: "Ontem: separar as roupas", feito: false, dia: "2026-09-27" },
    ],
    // Carreira › Meu dia: as demandas do trabalho, com detalhes
    "career-day-tasks": [
      {
        id: "c1", texto: "Ligar pro fornecedor da tinta", feito: false, dia: hoje, hora: "15:00", aviso: 30,
        detalhes: "Pedir orçamento de 18 L da Suvinil fosca, branco neve.\nConfirmar se entregam até sexta.\nFalar com a Rita: (11) 98877-6655",
      },
      {
        id: "c2", texto: "Mandar o relatório de setembro pro Paulo", feito: false, dia: hoje,
        detalhes: "Vendas por região + comparativo com agosto.\nAnexar em PDF, não em planilha.",
      },
    ],
    // a "Nova tarefa" da ação rápida (urgência): continua sem horário
    "rotina-urgencies": [{ id: "u1", text: "Pagar o boleto da escola", done: false }],
  };
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  // `get` muda de identidade quando os dados mudam: os useMemo dos hooks recalculam
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const DevTarefas = () => {
  const [params] = useSearchParams();
  const hoje = localDayKey();
  const vazio = params.get("vazio") === "1";
  const inicial = useMemo(() => seeds(hoje, vazio), [hoje, vazio]);
  return (
    <Provedor inicial={inicial}>
      {params.get("tela") === "carreira" ? <Carreira /> : <Home />}
    </Provedor>
  );
};

export default DevTarefas;
