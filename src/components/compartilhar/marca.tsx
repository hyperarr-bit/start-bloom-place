import type { CSSProperties } from "react";

/**
 * A MARCA NOS CARDS (29/09): o ÍCONE DO APP de verdade (o quadrado branco
 * com "CORE" em Inter Bold, o mesmo da loja — `ios/…/AppIcon-512@2x.png`,
 * `public/icon-512.png`), pequeno, mais o @ do Instagram. Como o Strava: a
 * marca assina, não grita. No Stories o link vai pela figurinha de link do
 * próprio Instagram (a pessoa põe onde quiser); o card não tem QR nem URL.
 *
 * ⚠ O @ é o perfil que os anúncios usam desde 14/09 (@coreorganizesuavida).
 * Confirmar com o dono antes de ligar a chave — é uma linha só aqui.
 */
export const INSTAGRAM_DO_CORE = "@coreorganizesuavida";

export const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

/** O ícone do app, desenhado (e não uma PNG): nítido em qualquer tamanho e igual ao da loja. */
export const IconeCore = ({ tamanho = 64, borda = false, style }: { tamanho?: number; borda?: boolean; style?: CSSProperties }) => (
  <div
    aria-label="CORE"
    style={{
      width: tamanho,
      height: tamanho,
      borderRadius: tamanho * 0.2237,
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: borda ? "inset 0 0 0 1.5px rgba(20,20,30,.10)" : undefined,
      fontFamily: INTER,
      fontWeight: 700,
      fontSize: tamanho * 0.262,
      letterSpacing: "-0.02em",
      color: "#2b2b2b",
      lineHeight: 1,
      ...style,
    }}
  >
    CORE
  </div>
);

/**
 * A assinatura: ícone + @. `tom` = a cor do texto ao lado (claro no fundo
 * escuro, escuro no claro). `semArroba` pra quando o @ não couber (adesivo).
 */
export const AssinaturaCore = ({ tom, tamanho = 60, semArroba = false, handle = INSTAGRAM_DO_CORE, alinhar = "left" }: { tom: string; tamanho?: number; semArroba?: boolean; handle?: string; alinhar?: "left" | "center" }) => (
  <div data-assinatura="" style={{ display: "flex", alignItems: "center", justifyContent: alinhar === "center" ? "center" : "flex-start", gap: tamanho * 0.3, fontFamily: INTER }}>
    <IconeCore tamanho={tamanho} borda={tom !== "#ffffff"} />
    {!semArroba && (
      <div style={{ display: "flex", flexDirection: "column", gap: 2, color: tom, lineHeight: 1.1 }}>
        <span style={{ fontSize: tamanho * 0.4, fontWeight: 800, letterSpacing: "-0.01em" }}>CORE</span>
        <span style={{ fontSize: tamanho * 0.36, fontWeight: 500, opacity: 0.78 }}>{handle}</span>
      </div>
    )}
  </div>
);
