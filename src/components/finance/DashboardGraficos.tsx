import { useEffect, useRef, useState, type ReactNode } from "react";
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

/**
 * SÓ PERTO DA TELA (17/10, desempenho). Os três gráficos ficam no FIM do Dashboard (abaixo do desafio, dos 4
 * números e dos alertas), mas montavam — e animavam, medindo texto e pintando — em toda abertura de Finanças:
 * no perfil com a CPU 4× mais lenta, a recharts era ~440 ms dos ~4 s de trabalho da abertura (mais a pintura
 * da animação que ninguém via). Agora cada gráfico ocupa a MESMA caixa (largura e altura de sempre, como o
 * fallback do Suspense no Dashboard) e só monta quando chega a 150 px da tela (o 1º gráfico fica ~260 px abaixo
 * da dobra num iPhone de 844 px: quem não rola não paga nada; quem rola vê a mesma animação de entrada, agora
 * na hora em que ele aparece). Sem IntersectionObserver (WebView muito velho), monta na hora, como antes.
 */
function QuandoPerto({ largura, altura, children }: { largura: string; altura: number; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [perto, setPerto] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (perto || !caixa.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); setPerto(true); } }, { rootMargin: "150px 0px" });
    io.observe(caixa.current);
    return () => io.disconnect();
  }, [perto]);
  if (perto) return <>{children}</>;
  return <div ref={caixa} style={{ width: largura, height: altura }} aria-hidden="true" data-grafico-espera="" />;
}
const mil = (v: number) => `${(v / 1000).toFixed(0)}k`;

export function GraficoCategorias({ dados, cores }: { dados: { name: string; value: number }[]; cores: string[] }) {
  return (
    <QuandoPerto largura="50%" altura={180}>
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
    </QuandoPerto>
  );
}

export function GraficoReceitasDespesas({ dados, corReceita, corDespesa }: { dados: { month: string; Receitas: number; Despesas: number }[]; corReceita: string; corDespesa: string }) {
  return (
    <QuandoPerto largura="100%" altura={180}>
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
    </QuandoPerto>
  );
}

export function GraficoPatrimonio({ dados, cor }: { dados: { month: string; Patrimônio: number }[]; cor: string }) {
  return (
    <QuandoPerto largura="100%" altura={150}>
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
    </QuandoPerto>
  );
}
