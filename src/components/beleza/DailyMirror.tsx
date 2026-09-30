import { localDayKey } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChaveDaBeleza } from "./estado-compartilhado";
import { CartaoBeleza, FaixaBeleza } from "./kit";

const getDateKey = () => localDayKey();

const skinOptions = [
  { id: "seca", label: "Seca", emoji: "🌵" },
  { id: "oleosa", label: "Oleosa", emoji: "🛢️" },
  { id: "acne", label: "Acne", emoji: "🔴" },
  { id: "boa", label: "Boa", emoji: "✨" },
  { id: "sensivel", label: "Sensível", emoji: "🍅" },
];

export const DailyMirror = () => {
  const today = getDateKey();
  // Mesma fonte da Rotina e do Diário (26/09, varredura): cada um tinha a sua
  // cópia e o "Sensível" daqui só valia lá depois de trocar de aba; o anel
  // não andava ao marcar passo.
  const [checkins, setCheckins] = useChaveDaBeleza<Record<string, string>>("skincare-daily-checkin", {});
  const [morningChecked] = useChaveDaBeleza<Record<string, number[]>>("skincare-morning-checked", {});
  const [nightChecked] = useChaveDaBeleza<Record<string, number[]>>("skincare-night-checked", {});

  const todaySkin = checkins[today] || "";

  const selectSkin = (id: string) => {
    setCheckins(prev => ({ ...prev, [today]: id }));
  };

  // Streak
  const streak = (() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const key = localDayKey(d);
      const m = morningChecked[key];
      const n = nightChecked[key];
      if ((m && m.length > 0) || (n && n.length > 0)) count++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const weekDays = 7;
  const pct = Math.min(streak, weekDays) / weekDays;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  /* Visual da Beleza (28/09): era a faixa verde-esmeralda de sempre; agora o rosé
     do módulo, o anel no magenta da marca e as peles em pílula. */
  return (
    <CartaoBeleza data-card="espelho-do-dia">
      <FaixaBeleza icone={<Sparkles className="w-4 h-4 text-bz-acento" />} titulo="ESPELHO DO DIA" />
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width="68" height="68" className="transform -rotate-90" aria-hidden="true">
              <circle cx="34" cy="34" r={r} fill="none" stroke="hsl(var(--bz-blush))" strokeWidth="5" />
              <circle cx="34" cy="34" r={r} fill="none" stroke="hsl(var(--bz-acento))" strokeWidth="5"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[16px] font-extrabold text-bz-acento leading-none">{Math.min(streak, 7)}</span>
              <span className="text-[8.5px] text-bz-suave mt-0.5">/7 dias</span>
            </div>
          </div>

          {/* min-w-0: sem isso o flex-1 não encolhe abaixo do conteúdo e a
              coluna toda escapava 31px pela direita a 360px (29/07) */}
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-bz-tinta mb-0.5">Como está sua pele hoje?</p>
            <p className="text-[11.5px] text-bz-suave mb-2.5">
              {streak > 0 ? `🔥 ${streak} ${streak === 1 ? "dia" : "dias consecutivos"} de rotina` : "Comece sua sequência hoje!"}
            </p>

            {/* Quebra linha em vez de rolar de lado: a 360 px "Boa" e
                "Sensível" ficavam escondidos sem indicação (26/09, varredura). */}
            <div className="flex flex-wrap gap-1.5">
              {skinOptions.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSkin(s.id)}
                  className={cn(
                    "shrink-0 h-9 px-3 rounded-full text-[11.5px] font-semibold transition-all border",
                    todaySkin === s.id
                      ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta"
                      : "bg-bz-cartao border-bz-linha-forte text-bz-suave",
                  )}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {todaySkin === "sensivel" && (
          <div className="mt-3 px-3 py-2 rounded-2xl bg-bz-alerta">
            <p className="text-[11.5px] text-bz-alerta-tinta font-medium">
              🛑 Pele sensível detectada — ácidos e esfoliantes foram ocultados da rotina noturna. Foco em hidratação!
            </p>
          </div>
        )}
      </div>
    </CartaoBeleza>
  );
};
