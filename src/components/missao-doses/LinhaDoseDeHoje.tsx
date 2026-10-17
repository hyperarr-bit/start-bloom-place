import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { DOSE_CURTA, EVENTO_MISSAO_DOSES, MODULOS, diaDaMissao, doseDeHojeDevida, eventoDaMissao, lerMissao, passoPendente } from "@/lib/missao-doses";

/**
 * "DOSE DE HOJE" NAS PENDÊNCIAS (1.0.16, braço A — desenho 8 seção 4.5). A única presença da missão na
 * Home além do convite 1x por dia: UMA linha dentro da lista "Pendências de hoje" que já existe (não é
 * card novo, não entra no score), até a dose ser feita — à vista mesmo com a lista fechada. Toque → o módulo
 * da dose (o passo entra lá). Nada com a missão do braço B, com "Explorar por conta própria", depois do 7º
 * dia, pulada hoje ou com a dose feita.
 */
export function useDoseDeHoje() {
  const [m, setM] = useState(() => lerMissao());
  useEffect(() => {
    const reler = () => setM(lerMissao());
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);
  const hoje = localDayKey();
  if (!m || !doseDeHojeDevida(m, hoje)) return null;
  const p = passoPendente(m);
  return p ? { n: p.n, modulo: p.modulo, diaCal: diaDaMissao(m, hoje) } : null;
}

export function LinhaDoseDeHoje({ dose }: { dose: NonNullable<ReturnType<typeof useDoseDeHoje>> }) {
  const navigate = useNavigate();
  const cfg = MODULOS[dose.modulo];
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden" data-testid="pendencia-dose-de-hoje">
      <button
        type="button"
        onClick={() => {
          trackEvent("home_pendencia", { tipo: "dose_de_hoje", destino: cfg.rota });
          trackEvent("missao_pendencia_dose", eventoDaMissao({ indice: dose.n, modulo: dose.modulo }));
          navigate(cfg.rota);
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-all text-left"
      >
        <span className="text-sm" aria-hidden>{cfg.emoji}</span>
        <span className="text-xs font-medium flex-1 min-w-0">
          <span className="font-bold">Dose de hoje</span> · {cfg.nome} · {DOSE_CURTA[dose.modulo].seg} s
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">Dia {dose.n} de 3</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
