import { MoreHorizontal, DollarSign, TrendingDown, TrendingUp, ArrowUpRight, ClipboardList, ArrowRight, Clock } from "lucide-react";

export const AccessGateUI = () => {
  const url = `${window.location.origin}/`;

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-white overflow-x-hidden overflow-y-auto">
      {/* Seta curva apontando pros 3 pontinhos */}
      <svg
        className="absolute top-12 right-6 pointer-events-none"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
      >
        <path
          d="M10 70 Q 20 30 65 18"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M55 14 L68 16 L62 26"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      <div className="max-w-sm mx-auto px-5 pt-20 pb-8 flex flex-col gap-5">
        {/* CORE título */}
        <h1 className="text-center text-[64px] font-black tracking-tight leading-none text-black">
          CORE
        </h1>

        {/* Headline */}
        <div className="space-y-3 text-center">
          <h2 className="text-[26px] font-bold tracking-tight leading-tight text-black">
            Controle sua vida financeira em um só lugar
          </h2>
          <p className="text-base text-neutral-500 leading-snug">
            Receitas, gastos, contas, desejos e investimentos sem complicação.
          </p>
        </div>

        {/* Cards de exemplo */}
        <div className="space-y-3 mt-2">
          {/* Receitas */}
          <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-500">Receitas</p>
              <p className="text-lg font-bold text-green-600">R$ 3.000,00</p>
            </div>
            <TrendingUp className="w-6 h-6 text-green-400 flex-shrink-0" strokeWidth={2.5} />
          </div>

          {/* Gastos */}
          <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-500" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-500">Gastos</p>
              <p className="text-lg font-bold text-red-500">R$ 635,00</p>
            </div>
            <TrendingDown className="w-6 h-6 text-red-300 flex-shrink-0" strokeWidth={2.5} />
          </div>

          {/* Saldo do mês */}
          <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-green-600" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-500">Saldo do mês</p>
              <p className="text-lg font-bold text-green-600">+R$ 2.365,00</p>
            </div>
            <TrendingUp className="w-6 h-6 text-green-400 flex-shrink-0" strokeWidth={2.5} />
          </div>
        </div>

        {/* Instrução */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-neutral-700" strokeWidth={2} />
            </div>
            <p className="text-base font-bold text-black">Para acessar agora:</p>
          </div>
          <div className="space-y-2.5 pl-1">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-700">
                1
              </div>
              <p className="text-sm text-neutral-700">
                Toque em <MoreHorizontal className="inline w-5 h-5 mx-0.5 -mt-0.5" /> no <span className="font-semibold text-black">canto superior direito</span>
              </p>
            </div>
            <div className="border-t border-neutral-200" />
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-700">
                2
              </div>
              <p className="text-sm text-neutral-700">
                Depois, toque em <span className="font-semibold text-black">"Abrir no navegador"</span>
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={url}
          className="w-full flex items-center justify-between bg-black text-white rounded-full py-4 px-6 text-base font-semibold active:opacity-80 transition-opacity"
        >
          <span className="flex-1 text-center">Toque nos 3 pontos para continuar</span>
          <ArrowRight className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
        </a>

        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
          <Clock className="w-4 h-4" />
          <span>Leva menos de 2 minutos para configurar.</span>
        </div>
      </div>
    </div>
  );
};
