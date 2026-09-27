import { useId } from "react";
import { Flame } from "lucide-react";
import { TextoEmAnel } from "./TextoEmAnel";

/**
 * CARTEIRINHA DO CLUBE (27/09) — o mockup `cartao.html` (26/09) virou peça de
 * verdade: papel com grão, borda em foil, faixa magenta "CORE · CLUBE DO
 * PLANNER", os campos datilografados e o carimbo redondo do nível. Só existe
 * pra virar a arte dos Stories "Organizada, com carteirinha." — por isso não
 * tem tema: é um objeto, cor fixa, 398×252 no tamanho de desenho.
 */

export const MEDIDAS_CARTEIRINHA = { w: 398, h: 252 };

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const FOIL = "linear-gradient(135deg,#fff3c4 0%,#e9c65a 22%,#b8860b 48%,#fff1b0 62%,#d4a629 78%,#8f6a0c 100%)";
const TINTA = "#b7791f";
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export interface DadosCarteirinha {
  nome: string;
  membroDesde: string;
  dias: number;
  nivel: string;
  xp: number;
  adesivos: number;
  total: number;
  /** "DESDE 2026" */
  ano: number;
  /** Mês do carimbo (hoje). */
  quando?: Date;
  /** Sem o "· 1.200 xp" ao lado do nível (a arte dos Stories, como no mockup). */
  compacta?: boolean;
}

const Rotulo = ({ children }: { children: string }) => (
  <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".18em", color: "#8c8272", textTransform: "uppercase", lineHeight: 1.2 }}>{children}</div>
);
const Valor = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#2b2b2f", marginTop: 2, lineHeight: 1.15, ...style }}>{children}</div>
);

export const Carteirinha = ({ nome, membroDesde, dias, nivel, xp, adesivos, total, ano, quando = new Date(), compacta }: DadosCarteirinha) => {
  const uid = `cart${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const carimbo = `${MESES_CURTOS[quando.getMonth()]} · ${quando.getFullYear()}`;
  return (
    <div data-carteirinha="" style={{ padding: 2.5, borderRadius: 18, background: FOIL, boxShadow: "0 20px 44px -18px rgba(0,0,0,.5)", width: MEDIDAS_CARTEIRINHA.w, fontFamily: INTER, color: "#2b2b2f", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ width: 393, height: 247, position: "relative", borderRadius: 16, overflow: "hidden", background: "#fbf6ea" }}>
        {/* grão do papel */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.45 }} preserveAspectRatio="none" aria-hidden>
          <filter id={`${uid}g`}>
            <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 .16 0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${uid}g)`} />
        </svg>
        <div style={{ position: "absolute", inset: 7, border: "1px solid rgba(43,43,47,.28)", borderRadius: 11 }} />
        <div style={{ position: "absolute", inset: 10, border: "1px solid rgba(43,43,47,.10)", borderRadius: 9 }} />
        {/* faixa magenta */}
        <div style={{ position: "absolute", left: 7, right: 7, top: 7, height: 38, background: "#d22d80", borderRadius: "11px 11px 0 0", display: "flex", alignItems: "center", padding: "0 14px 0 34px", color: "#fff" }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".26em" }}>CORE · CLUBE DO PLANNER</span>
          <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em", opacity: 0.85 }}>DESDE {ano}</span>
        </div>
        {/* furo */}
        <div style={{ position: "absolute", left: 15, top: 19, width: 13, height: 13, borderRadius: "50%", background: "#efe8d8", boxShadow: "inset 0 1.5px 2px rgba(0,0,0,.4)" }} />
        {/* campos */}
        <div style={{ position: "absolute", left: 24, top: 58, width: 222 }}>
          <Rotulo>Nome</Rotulo>
          <div style={{ fontSize: nome.length > 16 ? 21 : 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.05, color: "#2b2b2f", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 8, marginTop: 13 }}>
            <div><Rotulo>Membro desde</Rotulo><Valor>{membroDesde}</Valor></div>
            <div>
              <Rotulo>Sequência</Rotulo>
              <Valor style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Flame style={{ width: 14, height: 14, color: "#ea580c", flexShrink: 0 }} strokeWidth={2.2} aria-hidden />
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{dias} {dias === 1 ? "dia" : "dias"}</span>
              </Valor>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 8, marginTop: 11 }}>
            <div>
              <Rotulo>Nível</Rotulo>
              <Valor>
                {nivel}{!compacta && <span style={{ fontWeight: 600, color: "#8c8272", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}> · {xp.toLocaleString("pt-BR")} xp</span>}
              </Valor>
            </div>
            <div><Rotulo>Adesivos</Rotulo><Valor style={{ fontVariantNumeric: "tabular-nums" }}>{adesivos} de {total}</Valor></div>
          </div>
        </div>
        {/* carimbo redondo do nível */}
        <svg viewBox="0 0 120 120" style={{ position: "absolute", right: 20, top: 66, width: 118, height: 118, transform: "rotate(-12deg)", opacity: 0.9, overflow: "visible" }} aria-hidden>
          <defs>
            <filter id={`${uid}t`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <g filter={`url(#${uid}t)`}>
            <g fill="none" stroke={TINTA}>
              <circle cx="60" cy="60" r="57" strokeWidth="3" />
              <circle cx="60" cy="60" r="51" strokeWidth="1" />
              <circle cx="60" cy="60" r="35" strokeWidth="1" />
            </g>
            <TextoEmAnel cx={60} cy={60} r={43} texto={`NÍVEL ${nivel.toUpperCase()} · CLUBE DO PLANNER · `} fontSize={9.2} fill={TINTA} />
            <text x="60" y="66" textAnchor="middle" fontFamily={INTER} fontSize={nivel.length > 5 ? 17 : 21} fontWeight={900} letterSpacing="1" fill={TINTA}>{nivel.toUpperCase()}</text>
            <polygon points="60,40 62.6,46.2 69.3,46.6 64.2,50.9 65.8,57.4 60,53.9 54.2,57.4 55.8,50.9 50.7,46.6 57.4,46.2" fill={TINTA} />
            <text x="60" y="80" textAnchor="middle" fontFamily={INTER} fontSize="6.5" fontWeight={800} letterSpacing="1.6" fill={TINTA}>{carimbo}</text>
          </g>
        </svg>
        {/* rodapé */}
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12, color: "#8a8070" }}>Válida enquanto a vida estiver organizada.</div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-.03em", color: "#2b2b2f" }}>core</div>
        </div>
      </div>
    </div>
  );
};
