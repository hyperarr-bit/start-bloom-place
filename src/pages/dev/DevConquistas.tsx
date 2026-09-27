import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { TelaConquistas } from "@/components/conquistas/TelaConquistas";
import { MomentoAdesivo } from "@/components/conquistas/Momentos";
import { useConquistas } from "@/components/conquistas/use-conquistas";

/**
 * /dev/conquistas — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota
 * dentro de `import.meta.env.DEV`; some do build). A tela de Conquistas de
 * verdade com os dados da demo "Ana Beatriz", pra olhar, fotografar e filmar
 * sem conta: ?semana=completa · ?momento=epico|lendario|raro|comum ·
 * ?sem=1 (pouco dado: 1 adesivo, o álbum mostra os próximos) · ?zero=1 (nada
 * colado: "COMEÇANDO O ÁLBUM") · ?desafios=off · ?bar=0.
 */

const dias = (de: number, ate: number, hoje: string, pular: string[] = []) => {
  const out: string[] = [];
  for (let i = de; i >= ate; i--) {
    const d = somarDias(hoje, -i);
    if (!pular.includes(d)) out.push(d);
  }
  return out;
};

const seeds = (hoje: string, semanaCompleta: boolean, poucos: boolean, zero = false): Record<string, unknown> => {
  const mes = hoje.slice(0, 7);
  // semana normal (sábado): SEG…SEX feitos com QUA protegida, SÁB hoje em aberto, DOM futuro
  const lista = semanaCompleta ? dias(19, 0, hoje, [somarDias(hoje, -4)]) : dias(18, 1, hoje, [somarDias(hoje, -3)]);
  const heat: Record<string, boolean> = {};
  for (const d of dias(21, 1, hoje)) heat[d] = true;
  const agua: Record<string, number> = {};
  for (const d of dias(24, 2, hoje)) agua[d] = 8;
  const treinos = dias(64, 1, hoje).filter((_, i) => i % 2 === 0).slice(0, 32);
  const humor: Record<string, { mood: number; note: string }> = {};
  for (const d of dias(9, 1, hoje)) humor[d] = { mood: 4, note: "" };
  // receitas 4.200 − (variáveis 1.540 + fixos 1.420) = sobrou R$ 1.240 (o Painel da demo)
  const gastos = ["Mercado", "Uber", "Farmácia", "Padaria", "Restaurante", "Ônibus", "Ifood", "Cinema"].map((n, i) => ({
    id: `g${i}`, name: n, value: [620, 88, 142, 54, 260, 42, 165, 169][i], category: ["mercado", "transporte", "saúde", "mercado", "lazer", "transporte", "lazer", "lazer"][i], date: `${mes}-${String(3 + i * 2).padStart(2, "0")}`,
  }));
  const base: Record<string, unknown> = {
    "core-user-name": "Ana Beatriz",
    // um dia solto em julho: "membro desde julho de 2026" (a demo não tem conta)
    "core-dias-anotados": ["2026-07-12", ...lista],
    "conquistas-capa": "grafite",
    // sem o piso gravado, 1.200 XP viraria Platina pela escada antiga (a migração de quem já tinha nível)
    "conquistas-nivel-piso": "Ouro",
    "finance-incomes": [{ id: "r1", name: "Salário", value: 4200, date: `${mes}-05` }],
    "finance-expenses": gastos,
    "finance-fixed-expenses": [{ id: "f1", name: "Aluguel", value: 1300 }, { id: "f2", name: "Internet", value: 120 }],
    "finance-investments": [{ id: "i1", name: "Tesouro Selic", type: "renda fixa", value: 5000 }],
    "treino-meta-semanal": 5,
    "finance-challenges": { active: null, history: [{ key: "sem-delivery", weekStart: somarDias(hoje, -13), result: "win" }, { key: "cafe-em-casa", weekStart: somarDias(hoje, -6), result: "win" }] },
    "heatmap-log": heat,
    "mood-log": humor,
    "lib-books": [
      { id: "l1", title: "Essencialismo", status: "lido", endDate: somarDias(hoje, -40) },
      { id: "l2", title: "Hábitos Atômicos", status: "lido", endDate: somarDias(hoje, -22) },
      { id: "l3", title: "Rápido e Devagar", status: "lido", endDate: somarDias(hoje, -6) },
      { id: "l4", title: "O Poder do Agora", status: "lendo" },
      { id: "l5", title: "Mindset", status: "quero-ler" },
    ],
    "saude-workout-log": treinos,
    "water-log": agua,
    "core-saude-water-goal": 8,
    "journal-entries": { [somarDias(hoje, -1)]: { gratitude: ["Café da manhã com calma"] }, [somarDias(hoje, -2)]: { learned: "Dormir cedo rende" } },
    "conquistas-desbloqueadas": {
      "first-income": "2026-07-12", "first-expense": "2026-07-12", "rotina-1": "2026-07-13", "treino-1": "2026-07-14",
      "sequencia-7": "2026-07-19", "rotina-7": "2026-07-19", "saver-20": "2026-07-31", "leitura-estante": "2026-08-02",
      "agua-7": "2026-08-09", "treino-12": "2026-08-14", "leitura-1": "2026-08-20", "humor-7": "2026-08-28",
      "investor-1k": "2026-09-03", "rotina-21": "2026-09-10", "challenger": "2026-09-21", "protetor-1": somarDias(hoje, -2),
    },
  };
  if (zero) {
    return { "core-user-name": "Ana Beatriz", "conquistas-desbloqueadas": {} };
  }
  if (poucos) {
    return {
      "core-user-name": "Ana Beatriz",
      "core-dias-anotados": dias(4, 1, hoje),
      "finance-expenses": gastos.slice(0, 2),
      "conquistas-desbloqueadas": { "first-expense": somarDias(hoje, -3) },
    };
  }
  return base;
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

const MomentoDemo = ({ raridade, onFechar }: { raridade: string; onFechar: () => void }) => {
  const conq = useConquistas();
  const id = { lendario: "ano-365", epico: "rotina-21", raro: "rotina-7", comum: "first-income" }[raridade] ?? "rotina-21";
  const badge = conq.adesivos.find((b) => b.id === id);
  if (!badge) return null;
  return <MomentoAdesivo badge={{ ...badge, unlocked: true }} nome="Ana Beatriz" membroDesde="julho de 2026" onContinuar={onFechar} />;
};

const BarraDev = ({ hoje }: { hoje: string }) => {
  const [, setParams] = useSearchParams();
  const ctx = useContextDev();
  const anotar = () => {
    const lista = ctx.get<string[]>("core-dias-anotados", []);
    if (!lista.includes(hoje)) ctx.set("core-dias-anotados", [...lista, hoje]);
  };
  const momento = (r: string) => setParams((p) => { p.set("momento", r); return p; });
  return (
    <div className="fixed left-2 bottom-2 z-[500] flex flex-wrap gap-1 rounded-lg bg-black/80 p-1.5 text-[10px] text-white" data-testid="barra-dev">
      <button type="button" onClick={anotar} className="rounded bg-white/15 px-2 py-1">anotar hoje</button>
      <button type="button" onClick={() => momento("epico")} className="rounded bg-white/15 px-2 py-1">momento épico</button>
      <button type="button" onClick={() => momento("lendario")} className="rounded bg-white/15 px-2 py-1">momento lendário</button>
    </div>
  );
};

// pequeno atalho pro contexto (a barra fica dentro do Provedor)
import { useContext } from "react";
const useContextDev = () => useContext(UserDataContext)!;

const DevConquistas = () => {
  const [params, setParams] = useSearchParams();
  const hoje = localDayKey();
  const semanaCompleta = params.get("semana") === "completa";
  const poucos = params.get("sem") === "1";
  const zero = params.get("zero") === "1";
  const momento = params.get("momento");
  const inicial = useMemo(() => {
    const s = seeds(hoje, semanaCompleta, poucos, zero);
    if (params.get("desafios") === "off") s["finance-challenges-hidden"] = true;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, semanaCompleta, poucos, zero]);

  useEffect(() => {
    if (params.get("tema") === "escuro") document.documentElement.classList.add("dark");
  }, [params]);

  return (
    <Provedor inicial={inicial}>
      <TelaConquistas />
      {momento && <MomentoDemo raridade={momento} onFechar={() => setParams((p) => { p.delete("momento"); return p; })} />}
      {params.get("bar") !== "0" && <BarraDev hoje={hoje} />}
    </Provedor>
  );
};

export default DevConquistas;
