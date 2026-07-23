import { Unlock, Bell, Star } from "lucide-react";
import { APP_PRECOS } from "@/lib/native-shell";

/**
 * Timeline do TRIAL (shell) — substitui a GuaranteeTimeline do web (garantia
 * de 7 dias é conceito do Pix vitalício). Padrão Cal AI/BitePal: mostrar o
 * que acontece em cada dia do teste reduz o medo de assinar. Mesmo molde
 * visual da timeline web.
 */
const PASSOS = [
  { Icon: Unlock, title: "Hoje", sub: "Acesso total aos 16 módulos, de graça. Sem limite." },
  { Icon: Bell, title: "Dia 2", sub: "A gente te avisa que o teste tá acabando — sem surpresa na fatura." },
  { Icon: Star, title: "Dia 3", sub: `Assinatura começa: ${APP_PRECOS.anual.preco}/ano. Cancele antes e não paga nada.` },
];

export function TrialTimeline() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Como funciona o teste grátis
      </div>
      <div className="space-y-0">
        {PASSOS.map((t, i) => (
          <div key={t.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${i === 2 ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
                <t.Icon className="w-4 h-4" />
              </span>
              {i < PASSOS.length - 1 && <span className="w-0.5 flex-1 min-h-4 bg-accent/20 my-1" />}
            </div>
            <div className={i < PASSOS.length - 1 ? "pb-4" : ""}>
              <div className="text-[13.5px] font-bold leading-tight mt-1.5">{t.title}</div>
              <div className="text-[12px] text-muted-foreground leading-snug mt-0.5">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
