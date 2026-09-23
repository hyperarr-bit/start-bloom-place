import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";

/**
 * GRÁFICOS DO DASHBOARD DE FINANÇAS — chunk separado (22/09, varredura de velocidade).
 *
 * A recharts (+ lodash, d3) pesa ~360 KB minificados e vinha junto com o módulo
 * inteiro, antes do primeiro pixel do dashboard (a tela mais vista do app:
 * 1.177 s por visita). Aqui ela chega DEPOIS, por lazy(); o Dashboard reserva
 * a altura exata de cada gráfico pra tela não pular. Mesmos dados, mesmas cores.
 */
const brl = (value: number) => `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const mil = (v: number) => `${(v / 1000).toFixed(0)}k`;

export function GraficoCategorias({ dados, cores }: { dados: { name: string; value: number }[]; cores: string[] }) {
  return (
    <ResponsiveContainer width="50%" height={180}>
      <PieChart>
        <Pie data={dados} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
          {dados.map((_, index) => (
            <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => brl(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GraficoReceitasDespesas({ dados, corReceita, corDespesa }: { dados: { month: string; Receitas: number; Despesas: number }[]; corReceita: string; corDespesa: string }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={dados}>
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={mil} />
        <Tooltip formatter={(value: number) => brl(value)} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="Receitas" fill={corReceita} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Despesas" fill={corDespesa} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoPatrimonio({ dados, cor }: { dados: { month: string; Patrimônio: number }[]; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={dados}>
        <defs>
          <linearGradient id="colorPatrimony" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={cor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={mil} />
        <Tooltip formatter={(value: number) => brl(value)} />
        <Area type="monotone" dataKey="Patrimônio" stroke={cor} fill="url(#colorPatrimony)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
