import type { CSSProperties } from "react";
import { AssinaturaCore, INTER, SERIF } from "@/components/compartilhar/marca";
import { CardDeCompartilhar } from "@/components/compartilhar/cards";
import { Agua, CalendarioDoMes, Estatistica, Numero, Rotulo } from "@/components/compartilhar/pecas";
import { diasMarcadosNoMes, maiorCorrida } from "@/components/compartilhar/calendario";
import { capitalizar, lerMesId, mesAno, nomeDoMes, palavra, plural, porcento, UNIDADES } from "@/components/compartilhar/textos";
import type { DadosAzul, DadosTreinos } from "@/components/compartilhar/tipos";

/**
 * AS 3 DIREÇÕES DO CARD-MODELO (29/09) — SÓ NO /dev/compartilhar. Os dois
 * cards que o dono mostrou ("35 treinos" e "1 mês no azul") em três jeitos:
 *
 *  A · PÔSTER  — bloco de cor do assunto, número gigante branco (Strava/Wrapped)
 *  B · PLANNER — papel pontilhado, fita, calendário com grade e carimbo ✓
 *  C · NOITE   — grafite, brilho da cor do assunto (Apple Fitness)
 *
 * A escolhida vira o sistema (src/components/compartilhar/cards.tsx); as
 * outras ficam aqui pra comparação.
 */

export type Direcao = "poster" | "planner" | "noite";
const W = 1080, H = 1920;
const base: CSSProperties = { position: "relative", width: W, height: H, overflow: "hidden", fontFamily: INTER, WebkitFontSmoothing: "antialiased" };
const pontos = (cor: string, passo = 40): CSSProperties => ({ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${cor} 1.6px, transparent 1.9px)`, backgroundSize: `${passo}px ${passo}px` });

/* ------------------------------------------------------------------ TREINOS */

const dadosDoTreino = (d: DadosTreinos) => {
  const feitos = diasMarcadosNoMes(d.ano, d.mesIdx, d.dias);
  return { feitos, set: new Set(feitos), n: feitos.length, corrida: d.melhorSequencia ?? maiorCorrida(feitos) };
};

/** A · Pôster — é o card de produção (a direção escolhida). */
export const TreinoPoster = ({ d }: { d: DadosTreinos }) => <CardDeCompartilhar dados={d} formato="stories" />;

export const TreinoPlanner = ({ d }: { d: DadosTreinos }) => {
  const t = dadosDoTreino(d);
  const azul = "#2563eb";
  return (
    <div style={{ ...base, background: "#faf6ee" }} data-direcao="planner">
      <div style={{ ...pontos("rgba(60,50,40,.14)", 40) }} />
      {/* a fita */}
      <div style={{ position: "absolute", left: 250, top: 250, width: 580, height: 84, background: "rgba(59,130,246,.82)", transform: "rotate(-2.2deg)", display: "grid", placeItems: "center", boxShadow: "0 8px 18px -12px rgba(0,0,0,.45)" }}>
        <Rotulo cor="#fff" tam={26}>Treino · {nomeDoMes(d.mesIdx)} {d.ano}</Rotulo>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center" }}>
        <Numero tam={400} cor={azul} style={{ display: "inline-block" }}>{t.n}</Numero>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 92, color: "#2b2b2f", marginTop: 26, lineHeight: 1 }}>
          {palavra(t.n, UNIDADES.treino)} em {nomeDoMes(d.mesIdx)}.
        </div>
      </div>
      {/* a página do planner com a grade */}
      <div style={{ position: "absolute", left: 90, top: 860, width: 900, padding: "26px 24px 14px", background: "#fffdf8", borderRadius: 28, boxShadow: "0 30px 60px -34px rgba(60,40,20,.45), inset 0 0 0 2px rgba(43,43,47,.06)" }}>
        <CalendarioDoMes
          ano={d.ano} mesIdx={d.mesIdx} feitos={t.set} hoje={d.hoje} largura={852} alturaLinha={96} estilo="carimbo"
          cores={{ letras: "#8c8272", feito: azul, feitoTexto: "#fff", vazio: "transparent", vazioTexto: "#8c8272", futuro: "transparent", futuroTexto: "#c9c0b0", grade: "rgba(43,43,47,.08)" }}
        />
      </div>
      <div style={{ position: "absolute", left: 110, right: 110, top: 1500, display: "flex", flexDirection: "column", gap: 12, fontSize: 32, fontWeight: 700, color: "#2b2b2f" }}>
        {[`${plural(d.semanasNaMeta ?? 0, UNIDADES.semana)} seguidas na meta`, `${plural(d.recordes ?? 0, UNIDADES.recorde)} batidos`].map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, border: `3px solid ${azul}`, display: "grid", placeItems: "center", color: azul, fontSize: 26, fontWeight: 900 }}>✓</span>{s}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1700 }}><AssinaturaCore tom="#2b2b2f" tamanho={56} alinhar="center" /></div>
    </div>
  );
};

export const TreinoNoite = ({ d }: { d: DadosTreinos }) => {
  const t = dadosDoTreino(d);
  return (
    <div style={{ ...base, background: "#0c0f17" }} data-direcao="noite">
      <div style={{ position: "absolute", left: -200, top: 120, width: 1480, height: 1100, background: "radial-gradient(closest-side, rgba(59,130,246,.42), rgba(59,130,246,0))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 262, textAlign: "center" }}><Rotulo cor="rgba(191,219,254,.9)" tam={24}>Treino · {mesAno(d.mesIdx, d.ano)}</Rotulo></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center" }}>
        <Numero tam={440} cor="#fff" style={{ display: "inline-block", backgroundImage: "linear-gradient(180deg,#ffffff 30%,#93c5fd 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t.n}</Numero>
        <div style={{ color: "#fff", fontSize: 64, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 20 }}>{palavra(t.n, UNIDADES.treino)} em {nomeDoMes(d.mesIdx)}</div>
      </div>
      <div style={{ position: "absolute", left: 124, top: 860 }}>
        <CalendarioDoMes
          ano={d.ano} mesIdx={d.mesIdx} feitos={t.set} hoje={d.hoje} largura={832} alturaLinha={92} estilo="brilho"
          cores={{ letras: "rgba(255,255,255,.45)", feito: "#3b82f6", feitoTexto: "#fff", vazio: "rgba(255,255,255,.06)", vazioTexto: "rgba(255,255,255,.45)", futuro: "rgba(255,255,255,.02)", futuroTexto: "rgba(255,255,255,.2)" }}
        />
      </div>
      <div style={{ position: "absolute", left: 124, right: 124, top: 1500, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, textAlign: "center" }}>
        <Estatistica valor={t.corrida} legenda="dias seguidos" cor="#fff" corLegenda="rgba(255,255,255,.6)" tam={58} />
        <Estatistica valor={d.semanasNaMeta ?? 0} legenda="semanas na meta" cor="#fff" corLegenda="rgba(255,255,255,.6)" tam={58} />
        <Estatistica valor={d.recordes ?? 0} legenda="recordes" cor="#fff" corLegenda="rgba(255,255,255,.6)" tam={58} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1710 }}><AssinaturaCore tom="#ffffff" tamanho={54} alinhar="center" /></div>
    </div>
  );
};

/* --------------------------------------------------------------------- AZUL */

const dadosDoAzul = (d: DadosAzul) => {
  const ultimo = d.meses[d.meses.length - 1];
  const { mesIdx, ano } = lerMesId(ultimo?.mes ?? "2026-08");
  return { n: d.meses.length, mesIdx, ano, pct: ultimo?.pct ?? null };
};

/** A · Pôster — é o card de produção (a direção escolhida). */
export const AzulPoster = ({ d }: { d: DadosAzul }) => <CardDeCompartilhar dados={d} formato="stories" />;

export const AzulPlanner = ({ d }: { d: DadosAzul }) => {
  const a = dadosDoAzul(d);
  // o pote: a água sobe dentro dele
  const pote = { x: 250, y: 760, w: 580, h: 700 };
  return (
    <div style={{ ...base, background: "#faf6ee" }} data-direcao="planner">
      <div style={{ ...pontos("rgba(60,50,40,.14)", 40) }} />
      <div style={{ position: "absolute", left: 250, top: 250, width: 580, height: 84, background: "rgba(16,185,129,.8)", transform: "rotate(1.8deg)", display: "grid", placeItems: "center", boxShadow: "0 8px 18px -12px rgba(0,0,0,.45)" }}>
        <Rotulo cor="#fff" tam={26}>Finanças · {nomeDoMes(a.mesIdx)} {a.ano}</Rotulo>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 130, lineHeight: 0.98, color: "#2b2b2f" }}>
        {capitalizar(nomeDoMes(a.mesIdx))} fechou
        <br />
        <span style={{ color: "#1d4ed8" }}>no azul.</span>
      </div>
      <div style={{ position: "absolute", left: pote.x, top: pote.y, width: pote.w, height: pote.h, borderRadius: "70px 70px 90px 90px", overflow: "hidden", background: "rgba(255,255,255,.7)", boxShadow: "inset 0 0 0 6px rgba(43,43,47,.12), 0 40px 70px -40px rgba(60,40,20,.5)" }}>
        <Agua largura={pote.w} altura={pote.h} superficie={pote.h * 0.36} cor1="#60a5fa" cor2="#1d4ed8" amplitude={12} comprimento={300} />
        <div style={{ position: "absolute", left: 0, right: 0, top: pote.h * 0.44, textAlign: "center", color: "#fff" }}>
          {a.pct != null && <Numero tam={200} cor="#fff" style={{ display: "inline-block" }}>{porcento(a.pct)}</Numero>}
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 18, letterSpacing: ".02em" }}>do que entrou, sobrou</div>
        </div>
        <div style={{ position: "absolute", left: pote.w / 2 - 110, top: -2, width: 220, height: 46, borderRadius: "0 0 18px 18px", background: "rgba(43,43,47,.12)" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1530, textAlign: "center", fontSize: 34, fontWeight: 700, color: "#6b6258" }}>
        {plural(a.n, UNIDADES.mesNoAzul)} {a.n === 1 ? "— o primeiro." : "seguidos."}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1700 }}><AssinaturaCore tom="#2b2b2f" tamanho={56} alinhar="center" /></div>
    </div>
  );
};

export const AzulNoite = ({ d }: { d: DadosAzul }) => {
  const a = dadosDoAzul(d);
  const orbe = { x: 190, y: 560, lado: 700 };
  return (
    <div style={{ ...base, background: "#0b0f19" }} data-direcao="noite">
      <div style={{ position: "absolute", left: -200, top: 300, width: 1480, height: 1100, background: "radial-gradient(closest-side, rgba(59,130,246,.35), rgba(59,130,246,0))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 262, textAlign: "center" }}><Rotulo cor="rgba(191,219,254,.9)" tam={24}>Finanças · {mesAno(a.mesIdx, a.ano)}</Rotulo></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 340, textAlign: "center", color: "#fff", fontSize: 110, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 0.95 }}>
        {capitalizar(nomeDoMes(a.mesIdx))} fechou
        <br />
        <span style={{ color: "#60a5fa" }}>no azul.</span>
      </div>
      <div style={{ position: "absolute", left: orbe.x, top: orbe.y + 40, width: orbe.lado, height: orbe.lado, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,.04)", boxShadow: "0 0 0 10px rgba(255,255,255,.06), 0 0 120px rgba(59,130,246,.55)" }}>
        <Agua largura={orbe.lado} altura={orbe.lado} superficie={orbe.lado * 0.34} cor1="#60a5fa" cor2="#1e3a8a" amplitude={14} comprimento={340} />
        <div style={{ position: "absolute", left: 0, right: 0, top: orbe.lado * 0.4, textAlign: "center", color: "#fff" }}>
          {a.pct != null && <Numero tam={190} cor="#fff" style={{ display: "inline-block" }}>{porcento(a.pct)}</Numero>}
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 16, opacity: 0.9 }}>do que entrou, sobrou</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1420, textAlign: "center", color: "rgba(255,255,255,.75)", fontSize: 34, fontWeight: 700 }}>
        {plural(a.n, UNIDADES.mesNoAzul)} {a.n === 1 ? "" : "seguidos"}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1710 }}><AssinaturaCore tom="#ffffff" tamanho={54} alinhar="center" /></div>
    </div>
  );
};

export const DIRECOES: { id: Direcao; nome: string; ideia: string; Treino: (p: { d: DadosTreinos }) => JSX.Element; Azul: (p: { d: DadosAzul }) => JSX.Element }[] = [
  { id: "poster", nome: "A · Pôster", ideia: "Bloco de cor do assunto e o número gigante (Strava/Wrapped).", Treino: TreinoPoster, Azul: AzulPoster },
  { id: "planner", nome: "B · Planner", ideia: "Papel pontilhado, fita, calendário com grade e carimbo.", Treino: TreinoPlanner, Azul: AzulPlanner },
  { id: "noite", nome: "C · Noite", ideia: "Grafite com o brilho da cor do assunto (Apple Fitness).", Treino: TreinoNoite, Azul: AzulNoite },
];
