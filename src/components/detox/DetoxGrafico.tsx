import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

/** Barras das últimas 4 semanas — chunk separado (22/09), a recharts não entra no Detox inteiro. */
export function GraficoSemanas({ dados }: { dados: { name: string; pure: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dados}>
        <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, 7]} />
        <Bar dataKey="pure" radius={[4, 4, 0, 0]}>
          {dados.map((_, i) => (
            <Cell key={i} fill="hsl(var(--primary))" opacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
