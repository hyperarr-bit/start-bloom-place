/**
 * Módulos FALSOS pro teste do funil-demo (src/test/experimente.test.tsx): gravam pelo MESMO useUserData que os
 * módulos de verdade usam (o contexto do PreviewUserDataProvider), nas MESMAS chaves — sem baixar o módulo inteiro.
 */
import { useUserData } from "@/hooks/use-user-data";
import { useVoltarDoModulo } from "@/lib/volta-da-demo";
import { DIAS_DA_ROTINA, diaDeHoje } from "@/components/demo-guiada/alvos";

type Gasto = { id: string; description: string; value: number; category?: string; date?: string; paymentMethod?: string };

/** toque de verdade: o provider só conta como "dela" a gravação logo depois de um pointerdown */
const Botao = ({ id, onClick }: { id: string; onClick: () => void }) => (
  <button type="button" data-testid={id} onClick={onClick}>{id}</button>
);

export function FinancasFalsa() {
  const { get, set } = useUserData();
  const voltar = useVoltarDoModulo();
  const gastos = get<Gasto[]>("finance-expenses", []);
  return (
    <div>
      <p data-testid="falso-n-gastos">{gastos.length}</p>
      <p data-testid="falso-gastos">{gastos.map((g) => g.description).join("|")}</p>
      <Botao id="falso-gasto" onClick={() => set("finance-expenses", [...gastos, { id: "x-1", description: "Pizza", value: 45, category: "restaurante", date: "2026-10-14", paymentMethod: "pix" }])} />
      <Botao id="falso-editar-exemplo" onClick={() => set("finance-expenses", gastos.map((g, i) => (i === 0 ? { ...g, description: "Mercado grande", value: 999 } : g)))} />
      <Botao id="falso-apagar-gasto" onClick={() => set("finance-expenses", gastos.filter((g) => g.id !== "x-1"))} />
      <Botao id="falso-seta" onClick={voltar} />
    </div>
  );
}

export function RotinaFalsa() {
  const { get, set } = useUserData();
  const habitos = get<string[]>("rotina-habits", []);
  return (
    <div>
      <p data-testid="falso-habitos">{habitos.join("|")}</p>
      <Botao id="falso-habito" onClick={() => set("rotina-habits", [...habitos, "Tomar vitamina"])} />
      <Botao
        id="falso-marcar"
        onClick={() => {
          const grade = { ...get<Record<string, boolean[]>>("rotina-habits-checked", {}) };
          const hoje = [...(grade[diaDeHoje()] ?? Array(habitos.length).fill(false))];
          const i = hoje.findIndex((x) => !x);
          hoje[i < 0 ? 0 : i] = true;
          grade[diaDeHoje()] = hoje;
          set("rotina-habits-checked", grade);
        }}
      />
    </div>
  );
}

export function TreinoFalso() {
  const { get, set } = useUserData();
  return (
    <div>
      <Botao
        id="falso-exercicio"
        onClick={() => {
          const plano = { ...get<Record<string, { muscles?: string[]; exercises?: Array<{ name: string }> }>>("saude-workouts-v2", {}) };
          const dia = DIAS_DA_ROTINA[0];
          const d = plano[dia] ?? { muscles: [], exercises: [] };
          plano[dia] = { ...d, exercises: [...(d.exercises ?? []), { name: "Burpee" }] };
          set("saude-workouts-v2", plano);
        }}
      />
    </div>
  );
}

export function SaudeFalsa() {
  return <p data-testid="falso-saude">saude</p>;
}

export function DietaFalsa() {
  return <p data-testid="falso-dieta">dieta</p>;
}
