import { MoreHorizontal, DollarSign, TrendingDown, TrendingUp, ArrowUpRight, ClipboardList, ArrowRight, Clock, ArrowUp } from "lucide-react";

export const AccessGateUI = () => {
  const url = `${window.location.origin}/`;

  // Tamanhos fluidos baseados em svh (small viewport height = estável no iOS Safari)
  const s = {
    container: {
      paddingTop: "clamp(2.5rem, 6svh, 4.5rem)",
      paddingBottom: "clamp(0.75rem, 2svh, 1.5rem)",
      gap: "clamp(0.625rem, 1.8svh, 1.25rem)",
    },
    title: { fontSize: "clamp(1.875rem, 5.5svh, 3rem)" },
    h2: { fontSize: "clamp(1.125rem, 2.8svh, 1.625rem)", lineHeight: 1.2 },
    sub: { fontSize: "clamp(0.75rem, 1.7svh, 1rem)" },
    cardsGap: { gap: "clamp(0.375rem, 1svh, 0.75rem)" },
    card: { padding: "clamp(0.5rem, 1.3svh, 1rem)", gap: "clamp(0.5rem, 1.2svh, 0.75rem)" },
    cardIcon: {
      width: "clamp(2.25rem, 5svh, 3rem)",
      height: "clamp(2.25rem, 5svh, 3rem)",
    },
    cardLucide: { width: "clamp(1rem, 2.2svh, 1.25rem)", height: "clamp(1rem, 2.2svh, 1.25rem)" },
    cardLabel: { fontSize: "clamp(0.6875rem, 1.4svh, 0.875rem)" },
    cardValue: { fontSize: "clamp(0.875rem, 2svh, 1.125rem)" },
    instr: {
      padding: "clamp(0.625rem, 1.6svh, 1rem)",
      gap: "clamp(0.375rem, 1svh, 0.625rem)",
    },
    instrTitle: { fontSize: "clamp(0.75rem, 1.7svh, 0.95rem)" },
    instrCircle: {
      width: "clamp(1.25rem, 2.8svh, 1.75rem)",
      height: "clamp(1.25rem, 2.8svh, 1.75rem)",
      fontSize: "clamp(0.625rem, 1.4svh, 0.8rem)",
    },
    instrText: { fontSize: "clamp(0.6875rem, 1.5svh, 0.875rem)" },
    cta: {
      paddingTop: "clamp(0.625rem, 1.8svh, 1rem)",
      paddingBottom: "clamp(0.625rem, 1.8svh, 1rem)",
      paddingLeft: "clamp(1rem, 3svw, 1.5rem)",
      paddingRight: "clamp(1rem, 3svw, 1.5rem)",
      fontSize: "clamp(0.75rem, 1.7svh, 1rem)",
    },
    footer: { fontSize: "clamp(0.625rem, 1.3svh, 0.75rem)" },
    haloOuter: {
      width: "clamp(7rem, 22svh, 11rem)",
      height: "clamp(7rem, 22svh, 11rem)",
      top: "clamp(-3.5rem, -7svh, -2.5rem)",
      right: "clamp(-3.5rem, -7svh, -2.5rem)",
    },
    haloBtn: {
      width: "clamp(3rem, 7svh, 3.75rem)",
      height: "clamp(3rem, 7svh, 3.75rem)",
      top: "clamp(0.5rem, 1.2svh, 0.875rem)",
      right: "clamp(0.75rem, 1.6svh, 1.125rem)",
    },
    haloIcon: { width: "clamp(1.5rem, 3.5svh, 1.875rem)", height: "clamp(1.5rem, 3.5svh, 1.875rem)" },
  };

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-white overflow-x-hidden overflow-y-auto">
      {/* Indicador apontando pros 3 pontinhos do TikTok */}
      <div className="absolute top-0 right-0 pointer-events-none">
        <div className="absolute rounded-full bg-green-100" style={s.haloOuter} />
        <div className="absolute rounded-full bg-green-700 flex items-center justify-center shadow-md animate-pulse" style={s.haloBtn}>
          <ArrowUp className="text-white" style={s.haloIcon} strokeWidth={2.5} />
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 flex flex-col" style={s.container}>
        {/* CORE título */}
        <h1 className="text-center font-black tracking-tight leading-none text-black" style={s.title}>
          CORE
        </h1>

        {/* Headline */}
        <div className="space-y-1 text-center" style={{ marginTop: "clamp(0.625rem, 1.8svh, 1.25rem)" }}>
          <h2 className="font-bold tracking-tight text-black" style={s.h2}>
            Controle sua vida financeira em um só lugar
          </h2>
          <p className="text-neutral-500 leading-snug" style={s.sub}>
            Receitas, gastos, contas, desejos e investimentos sem complicação.
          </p>
        </div>

        {/* Cards de exemplo */}
        <div className="flex flex-col" style={{ ...s.cardsGap, marginTop: "clamp(0.625rem, 1.8svh, 1.25rem)" }}>
          {/* Receitas */}
          <div className="flex items-center rounded-xl border border-neutral-200 bg-white shadow-sm" style={s.card}>
            <div className="flex-shrink-0 rounded-lg bg-green-100 flex items-center justify-center" style={s.cardIcon}>
              <DollarSign className="text-green-600" style={s.cardLucide} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0" style={{ marginLeft: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
              <p className="text-neutral-500 leading-tight" style={s.cardLabel}>Receitas</p>
              <p className="font-bold text-green-600 leading-tight" style={s.cardValue}>R$ 3.000,00</p>
            </div>
            <TrendingUp className="text-green-400 flex-shrink-0" style={s.cardLucide} strokeWidth={2.5} />
          </div>

          {/* Gastos */}
          <div className="flex items-center rounded-xl border border-neutral-200 bg-white shadow-sm" style={s.card}>
            <div className="flex-shrink-0 rounded-lg bg-red-100 flex items-center justify-center" style={s.cardIcon}>
              <TrendingDown className="text-red-500" style={s.cardLucide} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0" style={{ marginLeft: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
              <p className="text-neutral-500 leading-tight" style={s.cardLabel}>Gastos</p>
              <p className="font-bold text-red-500 leading-tight" style={s.cardValue}>R$ 635,00</p>
            </div>
            <TrendingDown className="text-red-300 flex-shrink-0" style={s.cardLucide} strokeWidth={2.5} />
          </div>

          {/* Saldo do mês */}
          <div className="flex items-center rounded-xl border border-neutral-200 bg-white shadow-sm" style={s.card}>
            <div className="flex-shrink-0 rounded-lg bg-green-100 flex items-center justify-center" style={s.cardIcon}>
              <ArrowUpRight className="text-green-600" style={s.cardLucide} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0" style={{ marginLeft: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
              <p className="text-neutral-500 leading-tight" style={s.cardLabel}>Saldo do mês</p>
              <p className="font-bold text-green-600 leading-tight" style={s.cardValue}>+R$ 2.365,00</p>
            </div>
            <TrendingUp className="text-green-400 flex-shrink-0" style={s.cardLucide} strokeWidth={2.5} />
          </div>
        </div>

        {/* Instrução */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col" style={{ ...s.instr, marginTop: "clamp(0.625rem, 1.8svh, 1.25rem)" }}>
          <div className="flex items-center" style={{ gap: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
            <div className="flex-shrink-0 rounded-full bg-neutral-200 flex items-center justify-center" style={s.instrCircle}>
              <ClipboardList className="text-neutral-700" style={{ width: "60%", height: "60%" }} strokeWidth={2} />
            </div>
            <p className="font-bold text-black" style={s.instrTitle}>Para acessar agora:</p>
          </div>
          <div className="flex flex-col pl-1" style={{ gap: "clamp(0.375rem, 1svh, 0.625rem)", marginTop: "clamp(0.375rem, 1svh, 0.625rem)" }}>
            <div className="flex items-center" style={{ gap: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
              <div className="flex-shrink-0 rounded-full bg-neutral-200 flex items-center justify-center font-semibold text-neutral-700" style={s.instrCircle}>
                1
              </div>
              <p className="text-neutral-700 leading-snug" style={s.instrText}>
                Toque em <MoreHorizontal className="inline mx-0.5 -mt-0.5" style={{ width: "1em", height: "1em" }} /> no <span className="font-semibold text-black">canto superior direito</span>
              </p>
            </div>
            <div className="border-t border-neutral-200" />
            <div className="flex items-center" style={{ gap: "clamp(0.5rem, 1.2svh, 0.75rem)" }}>
              <div className="flex-shrink-0 rounded-full bg-neutral-200 flex items-center justify-center font-semibold text-neutral-700" style={s.instrCircle}>
                2
              </div>
              <p className="text-neutral-700 leading-snug" style={s.instrText}>
                Depois, toque em <span className="font-semibold text-black">"Abrir no navegador"</span>
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <a
          href={url}
          className="w-full flex items-center justify-between bg-black text-white rounded-full font-semibold active:opacity-80 transition-opacity"
          style={{ ...s.cta, marginTop: "clamp(0.625rem, 1.8svh, 1.25rem)" }}
        >
          <span className="flex-1 text-center">Toque nos 3 pontos para continuar</span>
          <ArrowRight className="flex-shrink-0" style={{ width: "1.1em", height: "1.1em" }} strokeWidth={2.5} />
        </a>

        <div className="flex items-center justify-center text-neutral-500" style={{ ...s.footer, gap: "clamp(0.25rem, 0.8svh, 0.5rem)", marginTop: "clamp(0.5rem, 1.4svh, 0.875rem)" }}>
          <Clock style={{ width: "1em", height: "1em" }} />
          <span>Leva menos de 2 minutos para configurar.</span>
        </div>
      </div>
    </div>
  );
};
