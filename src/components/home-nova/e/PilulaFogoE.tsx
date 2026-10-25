import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { Fogo } from "@/components/conquistas/Fogo";
import { localDayKey } from "@/lib/utils";
import type { Sequencia } from "@/components/conquistas/use-conquistas";

/**
 * A PÍLULA DO FOGO — APAGADA × ACESA (opção E, rodada 2, 25/10). Porte da direção A v3 (ramo v1019-home,
 * commit 207f953e, TopoNova.tsx `estadoDoFogo` + .css `hn-acende`), aqui como arquivo próprio pra não mexer
 * no TopoNova compartilhado (na versão de verdade os dois ramos usam UM componente).
 *
 * Estilo Duolingo: enquanto o dia NÃO está garantido (a mesma regra `hojeFeito` do useSequencia), o fogo
 * fica APAGADO — dessaturado e translúcido (~42 %), sem brilho, o número a ~60 % na cor da faixa. Quando o
 * dia é garantido, ACENDE: cor cheia + um pulso de 0,6 s, UMA vez por dia (chave no aparelho;
 * prefers-reduced-motion desliga o pulso). Sem sequência: cinza neutro. Toque leva às Conquistas.
 */
export type SeqDaPilula = Pick<Sequencia, "dias" | "faixa" | "hojeFeito">;
export type EstadoDoFogo = "neutro" | "apagado" | "aceso";

/** neutro = sem sequência · apagado = sequência viva mas HOJE ainda não garantido · aceso = garantido hoje. */
export const estadoDoFogo = (seq: SeqDaPilula): EstadoDoFogo => (seq.dias <= 0 ? "neutro" : seq.hojeFeito ? "aceso" : "apagado");

const CHAVE_ACESO = "he-fogo-aceso-em";
/** O acendimento (pulso) toca UMA vez por dia: a 1ª vez que a pílula aparece acesa hoje. */
const acendeAgora = (hoje: string): boolean => {
  try { if (localStorage.getItem(CHAVE_ACESO) === hoje) return false; localStorage.setItem(CHAVE_ACESO, hoje); return true; } catch { return true; }
};

interface Props {
  seq: SeqDaPilula;
  onTocar?: () => void;
  animar?: boolean;
}

export const PilulaFogoE = ({ seq, onTocar, animar = true }: Props) => {
  const navigate = useNavigate();
  const estado = estadoDoFogo(seq);
  const [acendendo, setAcendendo] = useState(false);
  useEffect(() => {
    if (!animar || estado !== "aceso") return;
    if (!acendeAgora(localDayKey())) return;
    setAcendendo(true);
    const t = window.setTimeout(() => setAcendendo(false), 700);
    return () => window.clearTimeout(t);
  }, [estado, animar]);
  const cor = { "--dias-c": seq.faixa.hojeTexto } as CSSProperties;
  const rotulo = estado === "neutro" ? "Sem sequência — abrir Conquistas" : `${seq.dias} dias de sequência${estado === "apagado" ? ", hoje ainda não garantido" : ", garantido hoje"} — abrir Conquistas`;
  return (
    <button
      type="button"
      onClick={() => (onTocar ? onTocar() : navigate("/conquistas", { state: { origem: "home" } }))}
      aria-label={rotulo}
      data-testid="hn-pilula-fogo"
      data-fogo={estado}
      className={`hn-card !rounded-full h-11 pl-2.5 pr-3.5 flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform${acendendo ? " he-acende" : ""}`}
      style={cor}
    >
      {estado === "neutro"
        ? <Flame className="w-[22px] h-[22px] text-muted-foreground" strokeWidth={2.2} aria-hidden />
        : <Fogo faixa={seq.faixa} tamanho={22} viva={estado === "aceso"} semBrilho={estado === "apagado"} className={estado === "apagado" ? "he-fogo-apagado" : undefined} />}
      {/* rodada 3: o número em PRETO (como o "🔥 0" do Cal AI); só o fogo leva a cor da faixa. Apagado = cinza-escuro. */}
      <span
        className={`text-[17px] font-bold tabular-nums leading-none ${estado === "neutro" ? "text-muted-foreground" : estado === "apagado" ? "text-foreground/65" : "text-foreground"}`}
        data-testid="hn-pilula-dias"
      >
        {seq.dias}
      </span>
    </button>
  );
};
