import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/** Gráficos da progressão de carga — chunk separado (22/09): a recharts só desce
 *  quando a pessoa abre a aba com gráfico, não ao abrir o Treino. */
type Ponto = { date: string; carga: number; volume: number };

export function GraficoProgressao({ dados, cor }: { dados: Ponto[]; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
        <Line type="monotone" dataKey="carga" stroke={cor} strokeWidth={2} dot={{ r: 3 }} name="Carga (kg)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoVolume({ dados, cor }: { dados: Ponto[]; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Line type="monotone" dataKey="volume" stroke={cor} strokeWidth={2} dot={{ r: 3 }} name="Volume (kg)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
