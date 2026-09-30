// @ts-nocheck
// cópia congelada de 78883beb:src/components/beleza/DailyMirror.tsx (o app das lojas: iPhone 1.0.7/1.0.8, Android 125) — NÃO editar; é o leitor antigo dos testes de compatibilidade
import { localDayKey } from "@/lib/utils";
import { useChaveDaBeleza } from "./estado-compartilhado";

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

  return (
    <div className="space-y-3">
      {/* Consistency Ring + Check-in — Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-emerald-200 dark:bg-emerald-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">✨ ESPELHO DO DIA</span>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <div className="flex items-center gap-4">
            {/* Ring */}
            <div className="relative shrink-0">
              <svg width="68" height="68" className="transform -rotate-90">
                <circle cx="34" cy="34" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <circle cx="34" cy="34" r={r} fill="none" stroke="hsl(142, 76%, 56%)" strokeWidth="4"
                  strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                  className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{Math.min(streak, 7)}</span>
                <span className="text-[8px] text-muted-foreground">/7 dias</span>
              </div>
            </div>

            {/* min-w-0: sem isso o flex-1 não encolhe abaixo do conteúdo e a
                coluna toda escapava 31px pela direita a 360px (29/07) */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground mb-0.5">Como está sua pele hoje?</p>
              <p className="text-[10px] text-muted-foreground mb-2.5">
                {streak > 0 ? `🔥 ${streak} ${streak === 1 ? "dia" : "dias consecutivos"} de rotina` : "Comece sua sequência hoje!"}
              </p>

              {/* Quebra linha em vez de rolar de lado: a 360 px "Boa" e
                  "Sensível" ficavam escondidos sem indicação (26/09, varredura). */}
              <div className="flex flex-wrap gap-1.5">
                {skinOptions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSkin(s.id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                      todaySkin === s.id
                        ? "bg-emerald-100 dark:bg-emerald-800/30 border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {todaySkin === "sensivel" && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
              <p className="text-[10px] text-red-700 dark:text-red-300 font-medium">
                🛑 Pele sensível detectada — ácidos e esfoliantes foram ocultados da rotina noturna. Foco em hidratação!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
