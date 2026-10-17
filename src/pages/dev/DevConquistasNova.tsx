import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { ConquistasNova, type CamadaDev } from "@/components/conquistas/nova/ConquistasNova";

/**
 * /dev/conquistas-nova — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a
 * rota dentro de `import.meta.env.DEV`; some do build). A CONQUISTAS 2
 * (16/10) com os dados da demo "Ana Beatriz", em memória, sem conta:
 *   ?dias=N              · N dias seguidos até ONTEM (padrão 12); &hoje=1 inclui hoje
 *   ?teste=1|2|3         · a pessoa no teste grátis, no dia N da missão (ajusta os dias: 1 → só hoje; 2 → ontem; 3 → anteontem e ontem)
 *   ?camada=toast|marco|colecao|sequencia|album|pagina|colar · abre já com a camada por cima
 *                          (album = o livro na capa; pagina = a página com mais vagas perto de fechar; colar = a página da figurinha nova)
 *   ?novas=0             · nenhuma figurinha esperando pra colar (padrão: 1, o "Humor em Dia")
 *   ?tema=escuro         · modo escuro
 *   ?zero=1              · conta nova sem nada colado
 */

const dias = (de: number, ate: number, hoje: string, pular: string[] = []) => {
  const out: string[] = [];
  for (let i = de; i >= ate; i--) {
    const d = somarDias(hoje, -i);
    if (!pular.includes(d)) out.push(d);
  }
  return out;
};

const seeds = (hoje: string): Record<string, unknown> => {
  const mes = hoje.slice(0, 7);
  const diaDoMes = Number(hoje.slice(8, 10));
  const doMes = (passo = 1, ate = diaDoMes) => {
    const out: string[] = [];
    for (let d = 1; d <= ate; d += passo) out.push(`${mes}-${String(d).padStart(2, "0")}`);
    return out;
  };
  const heat: Record<string, boolean> = {};
  for (const d of dias(48, 1, hoje)) heat[d] = true;
  const agua: Record<string, number> = {};
  for (const d of dias(24, 2, hoje)) agua[d] = 8;
  const treinos = [...dias(90, diaDoMes + 1, hoje).filter((_, i) => i % 2 === 0), ...doMes(1).filter((_, i) => i % 3 !== 2)].slice(-40);
  const humor: Record<string, { mood: number; note: string }> = {};
  for (const d of dias(9, 1, hoje)) humor[d] = { mood: 4, note: "" };
  const habitLog: Record<string, string[]> = {};
  doMes(1).forEach((d, i) => { habitLog[d] = i % 3 === 2 ? ["Meditar", "Ler"] : ["Meditar", "Água"]; });
  const gastos = ["Mercado", "Uber", "Farmácia", "Padaria", "Restaurante", "Ônibus", "Ifood", "Cinema"].map((n, i) => ({
    id: `g${i}`, name: n, value: [620, 88, 142, 54, 260, 42, 165, 169][i], category: ["mercado", "transporte", "saúde", "mercado", "lazer", "transporte", "delivery", "lazer"][i], date: `${mes}-${String(Math.min(diaDoMes, 1 + i * 2)).padStart(2, "0")}`,
  }));
  return {
    "core-user-name": "Ana Beatriz",
    "finance-incomes": [{ id: "r1", description: "Salário", value: 4200, date: `${mes}-05` }],
    "finance-expenses": gastos,
    "finance-fixed-expenses": [{ id: "f1", name: "Aluguel", value: 1300 }, { id: "f2", name: "Internet", value: 120 }],
    "finance-investments": [{ id: "i1", name: "Tesouro Selic", type: "renda fixa", value: 5000 }],
    "finance-challenges": { active: null, history: [{ key: "sem-delivery", weekStart: somarDias(hoje, -13), result: "win" }] },
    "heatmap-log": heat,
    "rotina-habit-log": habitLog,
    "mood-log": humor,
    "lib-books": [
      { id: "l1", title: "Essencialismo", status: "lido", pages: 260, endDate: somarDias(hoje, -40) },
      { id: "l4", title: "O Poder do Agora", status: "lendo" },
    ],
    "saude-workout-log": treinos,
    "water-log": agua,
    "core-saude-water-goal": 8,
    "detox-habits": [{ id: "d1", name: "Instagram", icon: "📱", startDate: somarDias(hoje, -5), createdAt: somarDias(hoje, -5), relapses: [], record: 5 }],
    "conquistas-desbloqueadas": {
      "first-income": somarDias(hoje, -60), "first-expense": somarDias(hoje, -60), "rotina-1": somarDias(hoje, -59), "treino-1": somarDias(hoje, -58),
      "sequencia-2": somarDias(hoje, -11), "sequencia-3": somarDias(hoje, -10), "sequencia-7": somarDias(hoje, -6), "rotina-7": somarDias(hoje, -6),
      "saver-20": somarDias(hoje, -30), "leitura-estante": somarDias(hoje, -40), "agua-7": somarDias(hoje, -17), "leitura-1": somarDias(hoje, -40),
      "humor-7": somarDias(hoje, -2), "investor-1k": somarDias(hoje, -33), "challenger": somarDias(hoje, -7), "protetor-1": somarDias(hoje, -4),
    },
    // tudo visto, menos o "Humor em Dia" (colado anteontem) — é o "novo desde a última visita"
    "conquistas-album-visto": ["first-income", "first-expense", "rotina-1", "treino-1", "sequencia-2", "sequencia-3", "sequencia-7", "rotina-7", "saver-20", "leitura-estante", "agua-7", "leitura-1", "investor-1k", "challenger", "protetor-1", "treino-12", "meta-semanal-4", "rotina-21"],
  };
};

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

const DevConquistasNova = () => {
  const [params] = useSearchParams();
  const hoje = localDayKey();
  const teste = Number(params.get("teste") || 0);
  const testeDia = teste >= 1 && teste <= 3 ? (teste as 1 | 2 | 3) : null;
  const camadaCru = params.get("camada");
  const camada = (["toast", "marco", "colecao", "sequencia", "album", "pagina", "colar"].includes(camadaCru ?? "") ? camadaCru : null) as CamadaDev;

  const inicial = useMemo(() => {
    if (params.get("zero") === "1") return { "core-user-name": "Ana Beatriz", "conquistas-desbloqueadas": {}, "conquistas-album-visto": [] };
    const s = seeds(hoje);
    const comHoje = params.get("hoje") === "1";
    if (testeDia) {
      // teste grátis: conta nova de poucos dias — só a missão e os primeiros registros
      const n = testeDia - 1; // dias anotados antes de hoje
      s["core-dias-anotados"] = dias(n, 1, hoje).concat(comHoje || testeDia === 1 ? [hoje] : []);
      // dia 2: só o 1º dia anotado (o "Voltei" é o prêmio de HOJE); dia 3: ontem colou o "Voltei"
      s["conquistas-desbloqueadas"] = { "first-expense": somarDias(hoje, -n), ...(testeDia === 3 ? { "sequencia-2": somarDias(hoje, -1), "rotina-1": somarDias(hoje, -1) } : {}) };
      s["conquistas-album-visto"] = Object.keys(s["conquistas-desbloqueadas"] as Record<string, string>);
      s["finance-expenses"] = (s["finance-expenses"] as unknown[]).slice(0, 2);
      for (const k of ["heatmap-log", "rotina-habit-log", "mood-log", "lib-books", "saude-workout-log", "water-log", "detox-habits", "finance-investments", "finance-challenges"]) delete s[k];
      if (testeDia >= 2) s["heatmap-log"] = { [somarDias(hoje, -1)]: true };
      return s;
    }
    const nDias = Number(params.get("dias") || 12);
    const ate = comHoje ? 0 : 1;
    // uma quarta protegida no meio da semana passada pra mostrar o gelo
    const lista = dias(nDias - 1 + ate, ate, hoje);
    s["core-dias-anotados"] = ["2026-07-12", ...lista];
    // sem a chave do visto, a tela grava a linha de base em silêncio (tudo o que está colado vira visto): nenhuma figurinha esperando
    if (params.get("novas") === "0") delete s["conquistas-album-visto"];
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, params.toString()]);

  useEffect(() => {
    if (params.get("tema") === "escuro") document.documentElement.classList.add("dark");
  }, [params]);

  return (
    <Provedor inicial={inicial}>
      <ConquistasNova testeDia={testeDia} camada={camada} />
    </Provedor>
  );
};

export default DevConquistasNova;
