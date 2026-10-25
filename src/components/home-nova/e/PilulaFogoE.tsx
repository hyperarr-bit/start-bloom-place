import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/utils";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { CHAVE_FOGO_ACESO_HOME_NOVA } from "@/lib/home-nova";
import { FogoSequencia, estadoDoFogo as estadoDoFogoUnificado, type EstadoDoFogo } from "@/components/fogo/FogoSequencia";

/**
 * A PÍLULA DO FOGO — APAGADA × ACESA (Home nova, 1.0.19). 26/10: o desenho é o FOGO UNIFICADO (components/fogo —
 * o mesmo da sequência das Conquistas do Codex, na paleta suave do caderno); o número em preto (como o "🔥 0" do Cal AI).
 *
 * Estilo Duolingo: enquanto o dia NÃO está garantido (a mesma regra `hojeFeito` do useSequencia), o fogo fica
 * APAGADO — a chama desbotada e parada, o número em cinza-escuro. Quando o dia é garantido, ACENDE: a chama viva
 * (tremulação sutil) + o pulso de acender (0,6 s), UMA vez por dia (chave do aparelho `core-home-nova-fogo`;
 * prefers-reduced-motion desliga). Sem sequência: cinza. O toque abre a FOLHA DA SEQUÊNCIA.
 */
export type SeqDaPilula = Pick<Sequencia, "dias" | "faixa" | "hojeFeito">;
export type { EstadoDoFogo };

/** neutro = sem sequência · apagado = sequência viva mas HOJE ainda não garantido · aceso = garantido hoje. */
export const estadoDoFogo = (seq: SeqDaPilula): EstadoDoFogo => estadoDoFogoUnificado(seq);

const CHAVE_ACESO = CHAVE_FOGO_ACESO_HOME_NOVA; // chave do aparelho (lib/chaves-do-aparelho)
/** O acendimento (pulso) toca UMA vez por dia: a 1ª vez que a pílula aparece acesa hoje. */
const acendeAgora = (hoje: string): boolean => {
  try { if (localStorage.getItem(CHAVE_ACESO) === hoje) return false; localStorage.setItem(CHAVE_ACESO, hoje); return true; } catch { return true; }
};

interface Props {
  seq: SeqDaPilula;
  onTocar: () => void;
  animar?: boolean;
}

export const PilulaFogoE = ({ seq, onTocar, animar = true }: Props) => {
  const estado = estadoDoFogo(seq);
  const [acendendo, setAcendendo] = useState(false);
  useEffect(() => {
    if (!animar || estado !== "aceso") return;
    if (!acendeAgora(localDayKey())) return;
    setAcendendo(true);
    const t = window.setTimeout(() => setAcendendo(false), 700);
    return () => window.clearTimeout(t);
  }, [estado, animar]);
  const rotulo = estado === "neutro" ? "Sem sequência — ver sua sequência" : `${seq.dias} dias de sequência${estado === "apagado" ? ", hoje ainda não garantido" : ", garantido hoje"} — ver sua sequência`;
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-label={rotulo}
      data-testid="hn-pilula-fogo"
      data-fogo={estado}
      data-acendendo={acendendo ? "1" : undefined}
      className="hn-card !rounded-full h-11 pl-2 pr-3.5 flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
    >
      <FogoSequencia dias={seq.dias} estado={estado} tamanho={26} acender={acendendo} />
      <span
        className={`text-[17px] font-bold tabular-nums leading-none ${estado === "neutro" ? "text-muted-foreground" : estado === "apagado" ? "text-foreground/65" : "text-foreground"}`}
        data-testid="hn-pilula-dias"
      >
        {seq.dias}
      </span>
    </button>
  );
};
