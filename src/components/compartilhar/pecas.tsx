import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import { LETRAS_DA_SEMANA, faixaDeSemanas, semanasDoMes } from "./calendario";
import { caminhoDaOnda } from "./onda";
import { INTER, SERIF } from "./marca";
import { diaDoMes, mesCurto } from "./textos";

/**
 * AS PEÇAS DOS CARDS (29/09): o número gigante, o calendário do mês, a faixa
 * de semanas e a água. Tudo em estilo inline e cor fixa (a foto não pode
 * depender do tema do aparelho). As casas do calendário levam `data-cel` e
 * `data-feito`: o vídeo mede onde cada uma está e acende uma por uma.
 */

export { INTER, SERIF };

/** O NÚMERO protagonista (Inter 900, apertado). `data-numero` = o vídeo conta em cima dele. */
export const Numero = ({ children, tam, cor, style, sombra }: { children: ReactNode; tam: number; cor: string; style?: CSSProperties; sombra?: string }) => (
  <div
    data-numero=""
    style={{
      fontFamily: INTER,
      fontWeight: 900,
      fontSize: tam,
      lineHeight: 0.8,
      letterSpacing: "-0.06em",
      color: cor,
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
      textShadow: sombra,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Rótulo em caixa alta espaçada (o "jeito de planner"). */
export const Rotulo = ({ children, cor, tam = 26, style }: { children: ReactNode; cor: string; tam?: number; style?: CSSProperties }) => (
  <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: tam, letterSpacing: ".16em", textTransform: "uppercase", color: cor, lineHeight: 1.1, ...style }}>{children}</div>
);

export interface CoresDoCalendario {
  letras: string;
  /** Dia feito: o disco e o número dentro. */
  feito: string;
  feitoTexto: string;
  /** Dia que passou sem treino. */
  vazio: string;
  vazioTexto: string;
  /** Dia que ainda não chegou. */
  futuro: string;
  futuroTexto: string;
  /** Linhas da grade (estilo planner). */
  grade?: string;
}

export type EstiloDoCalendario = "disco" | "carimbo" | "brilho";

interface PropsCalendario {
  ano: number;
  mesIdx: number;
  /** Dias feitos (1–31). */
  feitos: Set<number>;
  /** "AAAA-MM-DD": os dias depois dele ficam apagados (mês corrente). */
  hoje: string;
  largura: number;
  cores: CoresDoCalendario;
  estilo?: EstiloDoCalendario;
  /** Mostrar só o estado "apagado" (camada do vídeo) ou só os feitos (a outra camada). */
  so?: "apagado" | "aceso";
  /** Altura da linha (padrão = a largura da coluna); mais baixa quando o mês tem 6 semanas. */
  alturaLinha?: number;
}

/**
 * O CALENDÁRIO DO MÊS: letras da semana (S T Q Q S S D) e as casas. Dia
 * feito = disco cheio (ou carimbo com ✓, ou disco que brilha). A casa tem
 * `data-cel` = o dia, pra o vídeo achar.
 */
export const CalendarioDoMes = ({ ano, mesIdx, feitos, hoje, largura, cores, estilo = "disco", so, alturaLinha }: PropsCalendario) => {
  const semanas = semanasDoMes(ano, mesIdx);
  const passo = largura / 7;
  const alto = alturaLinha ?? passo;
  const disco = Math.round(Math.min(passo, alto) * 0.86);
  const fonte = Math.round(Math.min(passo, alto) * 0.32);
  return (
    <div data-calendario="" style={{ width: largura, fontFamily: INTER }}>
      <div style={{ display: "flex", marginBottom: passo * 0.14 }}>
        {LETRAS_DA_SEMANA.map((l, i) => (
          <div key={i} style={{ width: passo, textAlign: "center", fontSize: fonte * 0.9, fontWeight: 800, letterSpacing: ".08em", color: cores.letras, visibility: so === "aceso" ? "hidden" : undefined }}>{l}</div>
        ))}
      </div>
      {semanas.map((semana, li) => (
        <div key={li} style={{ display: "flex", height: alto, borderTop: cores.grade && so !== "aceso" ? `2px solid ${cores.grade}` : undefined }}>
          {semana.map((d, ci) => {
            if (d == null) return <div key={ci} style={{ width: passo, height: alto }} />;
            const dia = diaDoMes(ano, mesIdx, d);
            const feito = feitos.has(d);
            const futuro = dia > hoje;
            const aparece = so === "aceso" ? feito : true;
            const pintaFeito = feito && so !== "apagado";
            const fundo = pintaFeito ? cores.feito : futuro ? cores.futuro : cores.vazio;
            const texto = pintaFeito ? cores.feitoTexto : futuro ? cores.futuroTexto : cores.vazioTexto;
            return (
              <div key={ci} data-cel={d} data-feito={feito ? "" : undefined} style={{ width: passo, height: alto, display: "grid", placeItems: "center", position: "relative", visibility: aparece ? undefined : "hidden" }}>
                {estilo === "carimbo" && !pintaFeito ? null : estilo === "carimbo" ? (
                  <div style={{ width: disco, height: disco, borderRadius: "50%", background: fundo, color: texto, display: "grid", placeItems: "center", transform: `rotate(${((d * 37) % 17) - 8}deg)`, boxShadow: `inset 0 0 0 ${Math.round(disco * 0.06)}px rgba(255,255,255,.35)` }}>
                    <Check size={disco * 0.56} strokeWidth={3.4} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: disco,
                      height: disco,
                      borderRadius: "50%",
                      background: fundo,
                      color: texto,
                      display: "grid",
                      placeItems: "center",
                      fontSize: fonte,
                      fontWeight: pintaFeito ? 800 : 600,
                      fontVariantNumeric: "tabular-nums",
                      boxShadow: estilo === "brilho" && pintaFeito ? `0 0 ${disco * 0.5}px ${cores.feito}` : undefined,
                    }}
                  >
                    {d}
                  </div>
                )}
                {estilo === "carimbo" && !pintaFeito && (
                  <div style={{ position: "absolute", left: passo * 0.12, top: passo * 0.1, fontSize: fonte * 0.8, fontWeight: 700, color: texto }}>{d}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

interface PropsFaixa {
  inicio: string;
  hoje: string;
  feitos: Set<string>;
  largura: number;
  cores: { feito: string; vazio: string; rotulo: string };
  so?: "apagado" | "aceso";
}

/**
 * A FAIXA DE SEMANAS (o total desde o 1º treino): uma coluna por semana, 7
 * quadradinhos (SEG→DOM) de cima pra baixo, o mês em cima de onde começa.
 * `data-cel` = o dia.
 */
export const FaixaDeSemanas = ({ inicio, hoje, feitos, largura, cores, so }: PropsFaixa) => {
  const { semanas, meses } = faixaDeSemanas(inicio, hoje);
  const passo = Math.min(56, largura / Math.max(1, semanas.length));
  const lado = passo * 0.8;
  return (
    <div data-faixa="" style={{ width: largura, fontFamily: INTER }}>
      <div style={{ position: "relative", height: 40, visibility: so === "aceso" ? "hidden" : undefined }}>
        {meses.map((m) => (
          <div key={`${m.coluna}-${m.mesIdx}`} style={{ position: "absolute", left: m.coluna * passo, top: 0, fontSize: 22, fontWeight: 800, letterSpacing: ".1em", color: cores.rotulo }}>{mesCurto(m.mesIdx)}</div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {semanas.map((coluna, c) => (
          <div key={c} style={{ width: passo, display: "flex", flexDirection: "column" }}>
            {coluna.map((d, i) => {
              const feito = !!d && feitos.has(d);
              const pinta = feito && so !== "apagado";
              const visivel = !!d && (so !== "aceso" || feito);
              return (
                <div key={i} style={{ width: passo, height: passo, display: "grid", placeItems: "center" }}>
                  <div data-cel={d ?? undefined} data-feito={feito ? "" : undefined} style={{ width: lado, height: lado, borderRadius: lado * 0.28, background: pinta ? cores.feito : cores.vazio, visibility: visivel ? undefined : "hidden" }} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * A ÁGUA: a forma da onda (o mesmo caminho do vídeo) pintada com um degradê.
 * Ocupa o card inteiro; `superficie` diz até onde enche.
 */
export const Agua = ({ largura, altura, superficie, cor1, cor2, fase = 0.9, amplitude = 16, comprimento = 520, brilho = true }: { largura: number; altura: number; superficie: number; cor1: string; cor2: string; fase?: number; amplitude?: number; comprimento?: number; brilho?: boolean }) => {
  const d = caminhoDaOnda({ largura, altura, superficie, amplitude, comprimento, fase });
  const d2 = caminhoDaOnda({ largura, altura, superficie: superficie + 10, amplitude: amplitude * 0.8, comprimento: comprimento * 0.8, fase: fase + 2.2 });
  return (
    <svg data-agua="" width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
      <defs>
        <linearGradient id="agua-cor" x1="0" y1={superficie} x2="0" y2={altura} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={cor1} />
          <stop offset="1" stopColor={cor2} />
        </linearGradient>
      </defs>
      {brilho && <path d={d2} fill={cor1} opacity={0.45} />}
      <path d={d} fill="url(#agua-cor)" />
    </svg>
  );
};

/** Um número pequeno com a legenda embaixo (a linha de estatísticas). */
export const Estatistica = ({ valor, legenda, cor, corLegenda, tam = 64 }: { valor: ReactNode; legenda: string; cor: string; corLegenda: string; tam?: number }) => (
  <div style={{ fontFamily: INTER, minWidth: 0 }}>
    <div style={{ fontSize: tam, fontWeight: 900, letterSpacing: "-0.04em", color: cor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    <div style={{ fontSize: tam * 0.36, fontWeight: 700, color: corLegenda, marginTop: tam * 0.16, lineHeight: 1.2 }}>{legenda}</div>
  </div>
);
