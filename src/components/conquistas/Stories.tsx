import type { CSSProperties } from "react";
import { CAPAS, CapaPlanner, type CapaId, type DadosCapa } from "./CapaPlanner";
import { Roseta } from "./Roseta";
import { Adesivo } from "./adesivos-arte";
import { AnelRaridadeSvg } from "./adesivos-raridade";
import { Carteirinha, type DadosCarteirinha } from "./Carteirinha";
import { Faixa } from "./Faixa";
import type { Insignia } from "./insignias";
import { RARIDADE_LABEL, XP_RARIDADE, type Raridade } from "@/components/gamification/types";

/**
 * Artes 1080×1920 pros Stories (26/09; carteirinha, insígnias e raridade em
 * 27/09) — renderizadas do PRÓPRIO componente (a capa e a roseta da tela) e
 * fotografadas com html-to-image; ver gerar-imagem.tsx. Tudo em estilo inline
 * e cor fixa: a foto não pode depender do tema do aparelho. (A Instrument
 * Serif vem do import da CapaPlanner.) Zona segura: nada acima de 236 px nem
 * abaixo de 1640 px.
 */

export const STORIES = { w: 1080, h: 1920 };
/** Recorte da roseta no PNG transparente (o adesivo pra colar na foto). */
export const RECORTE_ROSETA = { x: 130, y: 520, w: 820, h: 1000 };
/** Recorte da faixa de insígnias no PNG transparente. */
export const RECORTE_INSIGNIAS = { x: 0, y: 470, w: 1080, h: 970 };

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
const rodape = (cor: string, top = 1516): CSSProperties => ({
  position: "absolute", left: 0, right: 0, top, textAlign: "center",
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

const FUNDO_RARIDADE: Record<Raridade, string> = {
  comum: "#f4ecdc",
  raro: "linear-gradient(180deg,#eef4ff 0%,#dbe7fb 100%)",
  epico: "linear-gradient(160deg,#f3e8ff 0%,#e0f2fe 45%,#fce7f3 100%)",
  lendario: "linear-gradient(180deg,#fff7d6 0%,#f3dfa0 100%)",
};

/** Stories do adesivo novo: o adesivo grande na folha pontilhada — fundo holográfico no épico, dourado no lendário. */
export const StoriesAdesivo = ({ id, titulo, descricao, raridade = "comum", nome, membroDesde }: { id: string; titulo: string; descricao: string; raridade?: Raridade; nome: string; membroDesde: string }) => {
  const brilha = raridade === "epico" || raridade === "lendario";
  const nomeRar = RARIDADE_LABEL[raridade].toLowerCase();
  return (
    <div style={{ ...base, background: FUNDO_RARIDADE[raridade] }} data-stories="adesivo" data-raridade={raridade}>
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 300, fontSize: 84, lineHeight: 1.02 }}>
        {raridade === "comum" ? "Mais um adesivo" : `Adesivo ${nomeRar}`}
        <br />
        no meu planner.
      </div>
      <div style={{ position: "absolute", left: 260, top: brilha ? 600 : 560, width: 560, height: 560 }}>
        {brilha && <AnelRaridadeSvg raridade={raridade} tamanho={560} />}
        <div style={{ position: "absolute", inset: 0, transform: "rotate(-5deg)" }}>
          <Adesivo id={id} tamanho={560} bordaGrossa />
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: brilha ? 1236 : 1206, textAlign: "center" }}>
        {raridade !== "comum" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 44, padding: "0 20px", borderRadius: 999, background: "rgba(43,43,47,.08)", fontSize: 20, fontWeight: 800, letterSpacing: ".2em", color: "#2b2b2f", marginBottom: 22 }}>
            ADESIVO {RARIDADE_LABEL[raridade].toUpperCase()} · +{XP_RARIDADE[raridade]} XP
          </div>
        )}
        <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05 }}>{titulo}</div>
        <div style={{ fontSize: 32, color: "#6f665a", marginTop: 14, fontWeight: 500 }}>{descricao}</div>
        <div style={{ fontSize: 26, color: "#8c8272", marginTop: 34, fontWeight: 600 }}>
          {nome} · membro desde {membroDesde}
        </div>
      </div>
      <div style={rodape("#8c8272")}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

const Washi = ({ left, top, rot }: { left: number; top: number; rot: number }) => (
  <div style={{ position: "absolute", left, top, width: 230, height: 60, transform: `rotate(${rot}deg)`, background: "repeating-linear-gradient(90deg,rgba(210,45,128,.5) 0 18px,rgba(255,255,255,.55) 18px 36px)", opacity: 0.85, boxShadow: "0 1px 2px rgba(0,0,0,.12)" }} />
);

/** Stories da carteirinha: "Organizada, com carteirinha." e o cartão com fitas washi. */
export const StoriesCarteirinha = (dados: DadosCarteirinha) => (
  <div style={{ ...base, background: "#f4ecdc" }} data-stories="carteirinha">
    <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
    <div style={{ ...manchete, top: 372, fontSize: 84, lineHeight: 1.02 }}>
      Organizada,
      <br />
      com carteirinha.
    </div>
    <div style={{ position: "absolute", left: 87, top: 720, width: 906, transform: "rotate(-2.5deg)", transformOrigin: "center" }}>
      <div style={{ transform: "scale(2.29)", transformOrigin: "top left" }}>
        <Carteirinha {...dados} compacta />
      </div>
    </div>
    <Washi left={8} top={682} rot={-40} />
    <Washi left={842} top={1258} rot={-40} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 1436, textAlign: "center" }}>
      <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-.04em", color: "#2b2b2f" }}>core</div>
      <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: ".22em", color: "#8c8272", marginTop: 4 }}>ORGANIZE SUA VIDA</div>
    </div>
  </div>
);

const ANGULO_FAIXA = -28;

/**
 * NOVA · Insígnias: a faixa de escoteiro atravessa a arte em −28° com as 6
 * insígnias bordadas, cada uma com o número de verdade. `transparente`: só a
 * faixa, recortada — pra colar na foto.
 */
export const StoriesInsignias = ({ insignias, nome, membroDesde, nivel, transparente = false }: DadosPessoa & { insignias: Insignia[]; transparente?: boolean }) => {
  const faixa = (
    <div style={{ position: "absolute", left: "50%", top: 955, transform: `translate(-50%,-50%) rotate(${ANGULO_FAIXA}deg)` }}>
      <Faixa comprimento={1520} largura={224} patches={insignias.slice(0, 6)} tamPatch={180} passo={190} inicio={195} giroPatch={-ANGULO_FAIXA} />
    </div>
  );
  if (transparente) {
    return (
      <div style={{ position: "relative", width: RECORTE_INSIGNIAS.w, height: RECORTE_INSIGNIAS.h, overflow: "hidden", fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="insignias-transparente">
        <div style={{ position: "absolute", left: -RECORTE_INSIGNIAS.x, top: -RECORTE_INSIGNIAS.y, width: STORIES.w, height: STORIES.h }}>{faixa}</div>
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "#f4ecdc" }} data-stories="insignias">
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 236, fontSize: 84, lineHeight: 1.02 }}>
        Minha vida,
        <br />
        com insígnias.
      </div>
      {faixa}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1452, textAlign: "center" }}>
        <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05 }}>{nome}</div>
        <div style={{ fontSize: 28, color: "#6f665a", marginTop: 10, fontWeight: 500 }}>nível {nivel} · membro desde {membroDesde}</div>
      </div>
      <div style={rodape("#8c8272", 1600)}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};
