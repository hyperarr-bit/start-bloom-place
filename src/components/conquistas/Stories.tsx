import type { CSSProperties } from "react";
import { CAPAS, CapaPlanner, type CapaId, type DadosCapa } from "./CapaPlanner";
import { Roseta } from "./Roseta";
import { Adesivo } from "./adesivos-arte";

/**
 * Artes 1080×1920 pros Stories (26/09) — renderizadas do PRÓPRIO componente
 * (a capa e a roseta da tela) e fotografadas com html-to-image; ver
 * gerar-imagem.tsx. Tudo em estilo inline e cor fixa: a foto não pode depender
 * do tema do aparelho. (A Instrument Serif vem do import da CapaPlanner.)
 */

export const STORIES = { w: 1080, h: 1920 };
/** Recorte da roseta no PNG transparente (o adesivo pra colar na foto). */
export const RECORTE_ROSETA = { x: 130, y: 520, w: 820, h: 1000 };

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const base: CSSProperties = {
  position: "relative", width: STORIES.w, height: STORIES.h, overflow: "hidden",
  fontFamily: INTER, WebkitFontSmoothing: "antialiased", color: "#2b2b2f",
};
const manchete: CSSProperties = { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, color: "#2b2b2f" };
const pontilhado = (cor: string, passo = 44): CSSProperties => ({
  position: "absolute", inset: 0,
  backgroundImage: `radial-gradient(circle, ${cor} 1.4px, transparent 1.6px)`, backgroundSize: `${passo}px ${passo}px`,
});
const rodape = (cor: string): CSSProperties => ({
  position: "absolute", left: 0, right: 0, top: 1516, textAlign: "center",
  fontSize: 24, fontWeight: 600, letterSpacing: ".22em", color: cor,
});

/** Stories da capa: "Meu planner de vida." e o planner em pé sobre a mesa. */
export const StoriesCapa = ({ capa, ...dados }: DadosCapa & { capa: CapaId }) => {
  const c = CAPAS[capa] ?? CAPAS.grafite;
  return (
    <div style={{ ...base, background: c.mesa }} data-stories="capa">
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 50% 38%,rgba(255,255,255,.55),transparent 70%)" }} />
      <div style={{ ...manchete, top: 268, fontSize: 84, lineHeight: 1 }}>Meu planner de vida.</div>
      <div style={{ position: "absolute", left: 160, top: 400 }}>
        <CapaPlanner capa={capa} formato="stories" {...dados} />
      </div>
      <div style={rodape(c.rodape)}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

interface DadosPessoa {
  nome: string;
  membroDesde: string;
  nivel: string;
}

/**
 * Stories da roseta (marco de sequência). `transparente`: só a roseta, o nome
 * e o "membro desde", recortados — o PNG vira adesivo pra colar na foto.
 */
export const StoriesRoseta = ({ dias, nome, membroDesde, nivel, transparente = false }: DadosPessoa & { dias: number; transparente?: boolean }) => {
  const conteudo = (
    <>
      <div style={{ position: "absolute", left: 190, top: 560, width: 700, height: 860, transform: "rotate(-4deg)" }}>
        <Roseta dias={dias} nivel={nivel} membroDesde={membroDesde} largura={700} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1380, textAlign: "center" }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05 }}>{nome}</div>
        <div style={{ fontSize: 28, color: "#6b7280", marginTop: 10, fontWeight: 500 }}>membro desde {membroDesde}</div>
      </div>
    </>
  );
  if (transparente) {
    return (
      <div style={{ position: "relative", width: RECORTE_ROSETA.w, height: RECORTE_ROSETA.h, overflow: "hidden", fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="roseta-transparente">
        <div style={{ position: "absolute", left: -RECORTE_ROSETA.x, top: -RECORTE_ROSETA.y, width: STORIES.w, height: STORIES.h }}>{conteudo}</div>
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "#efe9f6" }} data-stories="roseta">
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.8 }} />
      <div style={{ ...manchete, top: 300, fontSize: 84, lineHeight: 1.02 }}>
        Constância
        <br />
        tem prêmio.
      </div>
      {conteudo}
      <div style={rodape("#8a94a6")}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

/** Stories do adesivo novo: o adesivo grande na folha pontilhada. */
export const StoriesAdesivo = ({ id, titulo, descricao, nome, membroDesde }: { id: string; titulo: string; descricao: string; nome: string; membroDesde: string }) => (
  <div style={{ ...base, background: "#f4ecdc" }} data-stories="adesivo">
    <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
    <div style={{ ...manchete, top: 300, fontSize: 84, lineHeight: 1.02 }}>
      Mais um adesivo
      <br />
      no meu planner.
    </div>
    <div style={{ position: "absolute", left: 260, top: 560, width: 560, height: 560, transform: "rotate(-5deg)" }}>
      <Adesivo id={id} tamanho={560} bordaGrossa />
    </div>
    <div style={{ position: "absolute", left: 60, right: 60, top: 1206, textAlign: "center" }}>
      <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05 }}>{titulo}</div>
      <div style={{ fontSize: 32, color: "#6f665a", marginTop: 14, fontWeight: 500 }}>{descricao}</div>
      <div style={{ fontSize: 26, color: "#8c8272", marginTop: 34, fontWeight: 600 }}>
        {nome} · membro desde {membroDesde}
      </div>
    </div>
    <div style={rodape("#8c8272")}>CORE · ORGANIZE SUA VIDA</div>
  </div>
);
