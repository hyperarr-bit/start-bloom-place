import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { somarDias } from "@/lib/sequencia";
import { mondayOf } from "@/components/challenges/challenges";
import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";

/**
 * /dev/desafios — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de
 * `import.meta.env.DEV`; some do build). O card DESAFIO DA SEMANA (Finanças › Painel)
 * em cada cena do rodízio, com dados de demo e o "agora" fixo num dia da semana, pra
 * fotografar: ?cena=segunda (padrão) | meio | vitoria | derrota | faxina · ?tema=escuro.
 */

const Provedor = ({ inicial, children }: { inicial: Record<string, unknown>; children: ReactNode }) => {
  const [dados, setDados] = useState(inicial);
  const atual = useRef(dados);
  atual.current = dados;
  const get = useCallback(<T,>(k: string, f: T): T => (k in atual.current ? (atual.current[k] as T) : f), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((k: string, v: unknown) => setDados((d) => ({ ...d, [k]: v })), []);
  const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: true, fetchKey: async () => null }), [get, set]);
  return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
};

type Gasto = { id: string; date: string; value: number; category: string; description: string; paymentMethod?: string };
let n = 0;
const g = (date: string, value: number, category: string, description: string, paymentMethod = "pix"): Gasto => ({ id: `d${++n}`, date, value, category, description, paymentMethod });

/** O hábito das 4 semanas antes da segunda `seg` (datas relativas: a demo vale em qualquer semana). */
const habito = (seg: string): Gasto[] => {
  const d = (semanasAtras: number, dow: number) => somarDias(seg, -7 * semanasAtras + dow); // dow 0 = segunda
  return [
    g(d(1, 0), 118, "mercado", "Mercado"), g(d(1, 2), 42, "mercado", "Hortifruti"), g(d(1, 4), 64, "mercado", "Mercado"),
    g(d(1, 1), 24, "transporte", "Uber"), g(d(1, 3), 19, "transporte", "99"), g(d(2, 4), 31, "transporte", "Uber"),
    g(d(1, 1), 48, "delivery", "iFood", "credito"), g(d(2, 3), 39, "delivery", "iFood", "credito"), g(d(1, 5), 86, "restaurante", "Almoço de sábado", "credito"),
    g(d(1, 2), 12, "alimentacao", "Café"), g(d(1, 3), 9, "alimentacao", "Pão de queijo"), g(d(2, 1), 15, "restaurante", "Lanche"), g(d(2, 2), 18, "alimentacao", "Docinho"),
    g(d(1, 4), 139, "vestuario", "Shopee", "credito"), g(d(3, 2), 59, "eletronicos", "Shein", "credito"),
    g(d(1, 5), 90, "lazer", "Cinema"), g(d(1, 6), 60, "entretenimento", "Bar"),
    g(d(2, 5), 70, "outros", "Diversos"),
  ];
};

const seeds = (seg: string, cena: string): { dados: Record<string, unknown>; agora: Date } => {
  const dia = (i: number) => somarDias(seg, i); // 0 = segunda … 6 = domingo
  const as = (d: string, h = 10) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00`);
  const base: Record<string, unknown> = {
    "core-user-name": "Ana Beatriz",
    "finance-expenses": habito(seg),
    "finance-fixed-expenses": [
      { id: "f1", description: "Aluguel", value: 1500, category: "moradia", paymentMethod: "pix", day: 5 },
      { id: "f2", description: "Netflix", value: 44.9, category: "assinaturas", paymentMethod: "credito", cardName: "nubank", day: 12 },
      { id: "f3", description: "Spotify", value: 21.9, category: "assinaturas", paymentMethod: "credito", cardName: "nubank", day: 15 },
      { id: "f4", description: "Globoplay", value: 29.9, category: "assinaturas", paymentMethod: "credito", cardName: "nubank", day: 20 },
    ],
    "finance-dueDays": [
      { day: Number(dia(3).slice(8, 10)), color: "yellow", bills: [{ id: "b1", name: "Luz", paid: true, value: 180 }, { id: "b2", name: "Internet", paid: false, value: 99 }] },
    ],
    "finance-installments": [
      { id: "p1", description: "Celular novo", totalValue: 1800, installmentValue: 150, paidInstallments: 1, totalInstallments: 12, cardName: "nubank", category: "eletronicos", date: somarDias(seg, -24) },
    ],
    "finance-emergency-fund": { meses: 6, guardado: 1200, registrada: true },
    "finance-incomes": [{ id: "r1", description: "Salário", value: 3400, date: `${seg.slice(0, 7)}-05` }],
    "finance-challenges": { active: null, history: [{ key: "uber-2x", weekStart: somarDias(seg, -7), result: "win", nivel: 1, motivo: "cumpriu" }] },
  };
  const gastos = base["finance-expenses"] as Gasto[];
  const semana = (lista: Gasto[]) => { base["finance-expenses"] = [...gastos, ...lista]; };
  const ativo = (key: string, nivel = 1, meta?: Record<string, unknown>) => {
    base["finance-challenges"] = { active: { key, weekStart: seg, nivel, ...(meta ? { meta } : {}) }, history: [], ofertas: { weekStart: seg, itens: [{ key, nivel }] } };
  };
  switch (cena) {
    case "meio":
      ativo("sem-delivery");
      semana([g(dia(0), 118, "mercado", "Mercado"), g(dia(1), 24, "transporte", "Uber"), g(dia(2), 12, "alimentacao", "Café")]);
      return { dados: base, agora: as(dia(3)) }; // quinta, zero delivery até aqui
    case "vitoria":
      ativo("registro-5-dias");
      semana([0, 1, 2, 3, 4].map((i) => g(dia(i), 20 + i, "alimentacao", "Almoço")));
      return { dados: base, agora: as(dia(5)) }; // sábado
    case "derrota":
      ativo("sem-delivery");
      semana([g(dia(0), 118, "mercado", "Mercado"), g(dia(1), 48, "delivery", "iFood", "credito"), g(dia(2), 12, "alimentacao", "Café")]);
      return { dados: base, agora: as(dia(3)) };
    case "faxina":
      ativo("faxina-assinaturas", 1, { ids: ["f2", "f3", "f4"], total: 96.7 });
      semana([g(dia(0), 118, "mercado", "Mercado"), g(dia(1), 24, "transporte", "Uber")]);
      return { dados: base, agora: as(dia(2)) };
    default:
      return { dados: base, agora: as(dia(0), 9) }; // segunda de manhã: as 4 opções
  }
};

const DevDesafios = () => {
  const [params] = useSearchParams();
  const cena = params.get("cena") || "segunda";
  const seg = mondayOf(new Date(`${localDayKey()}T12:00:00`));
  const { dados, agora } = useMemo(() => seeds(seg, cena), [seg, cena]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", params.get("tema") === "escuro");
  }, [params]);

  return (
    <Provedor inicial={dados}>
      <div className="min-h-dvh bg-background px-4 pt-6 pb-10">
        <div className="max-w-lg mx-auto space-y-3" data-testid="dev-desafios">
          <WeeklyChallenge expenses={dados["finance-expenses"] as never} agoraDev={agora} />
        </div>
      </div>
    </Provedor>
  );
};

export default DevDesafios;
