import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { localDayKey } from "@/lib/utils";
import { EVENTO_MISSAO_DOSES, MODULOS, diaDaMissao, dias23NaMissao, doseDeHojeDevida, doseDoDia1DoBracoB, eventoDaMissao, lerMissao, passoPendente } from "@/lib/missao-doses";

/** 1.0.18 (dias23): tocar "Dia 2 · escolhe o seu" nas Pendências reabre a folha da escolha (a orquestra escuta). */
export const EVENTO_ABRIR_ESCOLHA_DIA2 = "missao-doses:abrir-escolha-dia2";

/**
 * "DOSE DE HOJE" NAS PENDÊNCIAS (1.0.16, braço A — desenho 8 seção 4.5). A única presença da missão na
 * Home além do convite 1x por dia: UMA linha dentro da lista "Pendências de hoje" que já existe (não é
 * card novo, não entra no score), até a dose ser feita — à vista mesmo com a lista fechada. Toque → o módulo
 * da dose (o passo entra lá). Nada com a missão do braço B, com "Explorar por conta própria", depois do 7º
 * dia, pulada hoje ou com a dose feita.
 */
export function useDoseDeHoje(opcoes: { bracoB?: boolean } = {}) {
  const [m, setM] = useState(() => lerMissao());
  useEffect(() => {
    const reler = () => setM(lerMissao());
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    return () => window.removeEventListener(EVENTO_MISSAO_DOSES, reler);
  }, []);
  const hoje = localDayKey();
  // 1.0.19 (varredura novato-2, bug 2): só a Home nova pede o braço B — a dose que ficou no meio do dia 1
  if (opcoes.bracoB && m && doseDoDia1DoBracoB(m, hoje)) {
    const pb = passoPendente(m);
    if (pb) return { n: pb.n, modulo: pb.modulo, diaCal: 1, braco: "B" as const };
  }
  if (!m || !doseDeHojeDevida(m, hoje)) return null;
  const p = passoPendente(m);
  if (!p) return null;
  const diaCal = diaDaMissao(m, hoje);
  // 1.0.18 (dias23): no dia 2, antes de ela escolher, a linha é a escolha (não "Rotina")
  const escolher = p.n === 2 && diaCal >= 2 && dias23NaMissao(m) && !m.escolha2;
  return { n: p.n, modulo: p.modulo, diaCal, ...(escolher ? { escolher: true as const } : {}) };
}

export type DoseDeHoje = NonNullable<ReturnType<typeof useDoseDeHoje>>;

/** O toque na linha (as duas versões, a de hoje e a da Home nova): a escolha do dia 2 ou o módulo da dose (o passo entra lá). */
export function tocarNaDose(dose: DoseDeHoje, navigate: (rota: string) => void): void {
  const cfg = MODULOS[dose.modulo];
  if ("escolher" in dose && dose.escolher) {
    trackEvent("home_pendencia", { tipo: "dose_de_hoje", destino: "escolha_dia2" });
    trackEvent("missao_pendencia_dose", eventoDaMissao({ indice: dose.n, modulo: null, escolha: true }));
    try { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ESCOLHA_DIA2)); } catch { /* noop */ }
    return;
  }
  const b = "braco" in dose && dose.braco === "B" ? { braco_linha: "B" } : {};
  trackEvent("home_pendencia", { tipo: "dose_de_hoje", destino: cfg.rota, ...b });
  trackEvent("missao_pendencia_dose", eventoDaMissao({ indice: dose.n, modulo: dose.modulo, ...b }));
  navigate(cfg.rota);
}

export function LinhaDoseDeHoje({ dose }: { dose: DoseDeHoje }) {
  const navigate = useNavigate();
  const cfg = MODULOS[dose.modulo];
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden" data-testid="pendencia-dose-de-hoje">
      <button
        type="button"
        data-track="pendencia:dose_de_hoje"
        onClick={() => {
          if ("escolher" in dose && dose.escolher) {
            trackEvent("home_pendencia", { tipo: "dose_de_hoje", destino: "escolha_dia2" });
            trackEvent("missao_pendencia_dose", eventoDaMissao({ indice: dose.n, modulo: null, escolha: true }));
            try { window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ESCOLHA_DIA2)); } catch { /* noop */ }
            return;
          }
          trackEvent("home_pendencia", { tipo: "dose_de_hoje", destino: cfg.rota });
          trackEvent("missao_pendencia_dose", eventoDaMissao({ indice: dose.n, modulo: dose.modulo }));
          navigate(cfg.rota);
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-all text-left"
      >
        <span className="text-sm" aria-hidden>{"escolher" in dose && dose.escolher ? "✨" : cfg.emoji}</span>
        <span className="text-xs font-medium flex-1 min-w-0">
          <span className="font-bold">Dose de hoje</span> · {"escolher" in dose && dose.escolher ? "escolhe o seu" : cfg.nome}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">Dia {dose.n} de 3</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
