import { ChevronRight, X } from "lucide-react";

/**
 * A ENTRADA DA RETROSPECTIVA NOVA (02/11, dono: "o cartão continua com o visual antigo de planner — tem que mudar").
 * Com a retrospectiva nova ligada pro mês, o cartão da Home e o banner de Finanças ganham a cara da abertura
 * aprovada em 30/10 (fundo grafite, "Seu outubro, / do seu jeito." com a 2ª linha em magenta) — a mesma do aviso
 * (AvisoRetroNova). Um objeto: igual no claro e no escuro. Sem lombada, espiral, lacre nem foil.
 */
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FUNDO = "linear-gradient(172deg, #2c2b31 0%, #232228 55%, #1d1c21 100%)";
const BORDA = "inset 0 0 0 1px rgba(255,255,255,.09)";
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type Props = {
  /** nome do mês como a retrospectiva guarda ("Outubro") */
  mes: string;
  ano: number;
  mesIdx: number;
  onAbrir: () => void;
  onFechar: () => void;
  /** "home" = o cartão da Home (com botão); "banner" = a faixa compacta de Finanças */
  variante?: "home" | "banner";
};

export function CartaoRetroNova({ mes, ano, mesIdx, onAbrir, onFechar, variante = "home" }: Props) {
  const minusculo = mes.toLowerCase();
  const selo = `${MESES_CURTOS[mesIdx] ?? ""} / ${String(ano).slice(-2)}`;

  if (variante === "banner") {
    return (
      <div className="relative w-full overflow-hidden" style={{ borderRadius: 14, background: FUNDO, boxShadow: BORDA, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-testid="wrapped-banner" data-estilo="novo">
        <div className="relative flex items-center gap-2" style={{ padding: "11px 10px 11px 16px" }}>
          <button onClick={onAbrir} className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform">
            <span className="flex-1 leading-tight min-w-0">
              <span className="block" style={{ color: "#d6d0d8", fontSize: 9.5, letterSpacing: ".1em", fontWeight: 800 }}>RETROSPECTIVA · {selo}</span>
              <span className="block" style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 3, whiteSpace: "nowrap" }}>
                <span style={{ color: "#fffdf8" }}>Seu {minusculo}, </span>
                <span style={{ color: "#db2777" }}>do seu jeito.</span>
              </span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#d6d0d8" }} />
          </button>
          <button onClick={onFechar} aria-label="Dispensar retrospectiva" className="shrink-0 grid place-items-center w-7 h-7 rounded-full p-0" style={{ color: "rgba(255,253,248,.55)", background: "rgba(255,255,255,.06)" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: 18, background: FUNDO, boxShadow: BORDA, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-testid="retrospectiva-na-home" data-estilo="novo" data-track-bloco="retrospectiva">
      <button onClick={onFechar} aria-label="Dispensar retrospectiva" className="absolute top-2.5 right-2.5 grid place-items-center w-8 h-8 rounded-full p-0" style={{ color: "rgba(255,253,248,.55)", zIndex: 2 }}>
        <X className="w-4 h-4" />
      </button>
      <button onClick={onAbrir} className="relative block w-full text-left active:scale-[0.99] transition-transform" style={{ padding: "16px 18px 18px", zIndex: 1 }}>
        <span className="flex items-center justify-between" style={{ color: "#d6d0d8", fontSize: 10.5, letterSpacing: ".1em", fontWeight: 800, paddingRight: 34 }}>
          <span>RETROSPECTIVA</span>
          <span style={{ letterSpacing: ".01em", fontWeight: 700 }}>{selo}</span>
        </span>
        <span className="block" style={{ marginTop: 14, fontSize: 27, fontWeight: 900, letterSpacing: "-0.032em", lineHeight: 1.12 }}>
          <span className="block" style={{ color: "#fffdf8" }}>Seu {minusculo},</span>
          <span className="block" style={{ color: "#db2777" }}>do seu jeito.</span>
        </span>
        <span className="inline-flex items-center" style={{ marginTop: 16, height: 38, padding: "0 16px", borderRadius: 999, background: "#fffdf8", color: "#16121c", fontSize: 13.5, fontWeight: 800 }}>
          Ver minha retrospectiva
        </span>
      </button>
    </div>
  );
}

export default CartaoRetroNova;
