import type { CSSProperties } from "react";
import { ARGOLAS_STORIES, CAPAS, CapaPlanner, Espiral, type CapaId, type DadosCapa } from "./CapaPlanner";
import { Roseta } from "./Roseta";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";
import { AnelRaridadeSvg } from "./adesivos-raridade";
import { Carteirinha, type DadosCarteirinha } from "./Carteirinha";
import { SeloNivel } from "./SeloNivel";
import { resumoRaridades } from "./album-paginas";
import type { DadosArtes } from "./artes-dados";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { RARIDADE_LABEL, XP_RARIDADE, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";

/**
 * Artes 1080×1920 pros Stories (26/09; carteirinha e raridade em 27/09; o
 * ÁLBUM no lugar das insígnias na mesma tarde) — renderizadas do PRÓPRIO
 * componente (a capa e a roseta da tela) e fotografadas com html-to-image;
 * ver gerar-imagem.tsx. Tudo em estilo inline e cor fixa: a foto não pode
 * depender do tema do aparelho. (A Instrument Serif vem do import da
 * CapaPlanner.) Zona segura: nada acima de 236 px nem abaixo de 1640 px.
 *
 * `parte`: as artes que viram VÍDEO (capa e álbum) também saem em camadas —
 * "fundo" (papel + manchete + rodapé), "pagina" (a página do álbum sem os
 * adesivos que vão pipocar) e "texto" (o bloco do nome) — que o vídeo anima
 * no canvas. A arte inteira é o último quadro do vídeo.
 */

export const STORIES = { w: 1080, h: 1920 };
/** Recorte da roseta no PNG transparente (o adesivo pra colar na foto). */
export const RECORTE_ROSETA = { x: 130, y: 520, w: 820, h: 1000 };
/** A página do álbum na arte: a mesma caixa da capa em pé na arte da Capa (é ela que abre no vídeo). */
export const PAGINA_FOTO = { w: 760, h: 1080, x: 160, y: 400 };
/** A grade 3 × 2 dentro da página: célula 200 × 300 a partir de (96, 190); adesivo de 176. */
export const GRADE_FOTO = { esq: 96, topo: 190, cel: 200, alt: 300, gap: 16, tam: 176, colunas: 3 };
/** O bloco do nome (a camada de texto do vídeo): 1080 × 220, desenhado em y = 1490. */
export const BLOCO_NOME_FOTO = { h: 220, y: 1490 };

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

export type ParteDaArte = "tudo" | "fundo" | "pagina" | "texto";

/** O bloco do nome sob a página aberta ("Ana Beatriz" · "nível Ouro · 15 de 65 adesivos"). */
export const BlocoNomeFoto = ({ nome, linha }: { nome: string; linha: string }) => (
  <div style={{ position: "absolute", left: 40, right: 40, top: 14, textAlign: "center" }} data-bloco-nome="">
    <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
    <div style={{ fontSize: 24, color: "#6f665a", marginTop: 6, fontWeight: 500 }}>{linha}</div>
  </div>
);

/** Stories da capa: "Meu planner de vida." e o planner em pé sobre a mesa. */
export const StoriesCapa = ({ capa, parte = "tudo", adesivos, total, ...dados }: DadosCapa & { capa: CapaId; parte?: ParteDaArte; adesivos?: number; total?: number }) => {
  const c = CAPAS[capa] ?? CAPAS.grafite;
  if (parte === "texto") {
    return (
      <div style={{ position: "relative", width: STORIES.w, height: BLOCO_NOME_FOTO.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="capa-texto">
        <BlocoNomeFoto nome={dados.nome} linha={`nível ${dados.nivel} · ${adesivos ?? 0} de ${total ?? 0} adesivos`} />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: c.mesa }} data-stories="capa" data-parte={parte}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 50% 38%,rgba(255,255,255,.55),transparent 70%)" }} />
      <div style={{ ...manchete, top: 268, fontSize: 84, lineHeight: 1 }}>Meu planner de vida.</div>
      {parte === "tudo" && (
        <div style={{ position: "absolute", left: PAGINA_FOTO.x, top: PAGINA_FOTO.y }}>
          <CapaPlanner capa={capa} formato="stories" {...dados} />
        </div>
      )}
      {/* no vídeo o nome aparece sob a página aberta: o rodapé desce pra dar lugar */}
      <div style={rodape(c.rodape, parte === "fundo" ? 1614 : 1516)}>CORE · ORGANIZE SUA VIDA</div>
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

/* ------------------------------------------------------------------------- *
 * ÁLBUM (27/09): a página dos mais raros, em foto
 * ------------------------------------------------------------------------- */

/** [fundo, cor] do chip de raridade na foto (as cores do modo claro de .chip-rar, fixas). */
const CHIP_FOTO: Record<Raridade, [string, string]> = {
  comum: ["rgba(43,43,47,.08)", "#6f665a"],
  raro: ["rgba(59,130,246,.14)", "#2563eb"],
  epico: ["linear-gradient(90deg,#ede9fe,#e0f2fe,#fce7f3)", "#6d28d9"],
  lendario: ["linear-gradient(90deg,#fff3c4,#e9c65a)", "#6b4a05"],
};

const Cadeado = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Uma célula da grade (200 × 300): o adesivo (com o anel SVG da raridade),
 * o nome e o chip. Na foto e no sprite do vídeo é a MESMA célula, por isso o
 * vídeo cola cada adesivo exatamente onde a arte parada o mostra. `semAnel`:
 * o vídeo desenha o anel girando no canvas.
 */
export const CelulaAdesivoFoto = ({ b, indice, semAnel }: { b: Badge; indice: number; semAnel?: boolean }) => {
  const raridade = raridadeDe(b);
  const brilha = b.unlocked && !semAnel && (raridade === "epico" || raridade === "lendario");
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  const [fundo, cor] = CHIP_FOTO[raridade];
  const { cel, alt, tam } = GRADE_FOTO;
  return (
    <div data-celula={b.id} data-aberto={b.unlocked ? "true" : "false"} style={{ width: cel, height: alt, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, boxSizing: "border-box" }}>
      <div style={{ position: "relative", width: tam, height: tam, flexShrink: 0 }}>
        {brilha && <AnelRaridadeSvg raridade={raridade} tamanho={tam} />}
        <div style={{ position: "absolute", inset: 0, transform: `rotate(${b.unlocked ? giroDoAdesivo(indice) : 0}deg)`, opacity: b.unlocked ? 1 : 0.32, filter: b.unlocked ? undefined : "grayscale(1)" }}>
          <Adesivo id={b.id} tamanho={tam} bordaGrossa />
        </div>
        {!b.unlocked && (
          <div style={{ position: "absolute", right: -8, bottom: 4, height: 38, padding: "0 14px", borderRadius: 999, background: "#2b2b2f", color: "#fff", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }}>
            {rotulo ?? <Cadeado />}
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, height: 56, width: cel + 12, fontSize: 23, fontWeight: 800, lineHeight: 1.15, color: b.unlocked ? "#2b2b2f" : "#8c8272", textAlign: "center", letterSpacing: "-.01em", overflow: "hidden" }}>{b.name}</div>
      {(raridade !== "comum" || !b.unlocked) && (
        <div style={{ marginTop: 4, height: 30, padding: "0 12px", borderRadius: 999, background: b.unlocked ? fundo : "rgba(43,43,47,.08)", color: b.unlocked ? cor : "#6f665a", fontSize: 14, fontWeight: 800, letterSpacing: ".16em", display: "inline-flex", alignItems: "center", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {b.unlocked ? RARIDADE_LABEL[raridade] : `A caminho · ${RARIDADE_LABEL[raridade]}`}
        </div>
      )}
    </div>
  );
};

interface PaginaFotoProps {
  maisRaros: Badge[];
  proximos: Badge[];
  titulo: string;
  adesivos: number;
  total: number;
  nivel: string;
  xp: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  mes: string;
  /** Deixa vazias as vagas dos colados (o vídeo cola cada um no seu lugar). */
  semAdesivos?: boolean;
  /** O vídeo desenha a espiral numa camada própria (ela fica parada enquanto a capa gira). */
  semEspiral?: boolean;
}

/** A página do álbum (760 × 1080): furos, espiral, "MEU ÁLBUM", os mais raros em 3 × 2 e o rodapé com o nível. */
export const PaginaAlbumFoto = ({ maisRaros, proximos, titulo, adesivos, total, nivel, xp, porRaridade, mes, semAdesivos, semEspiral }: PaginaFotoProps) => {
  const itens = [...maisRaros, ...proximos].slice(0, GRADE_FOTO.colunas * 2);
  const { w, h } = PAGINA_FOTO;
  const { esq, topo, cel, alt, gap, colunas } = GRADE_FOTO;
  return (
    <div data-pagina-foto="" style={{ position: "relative", width: w, height: h, background: "#fffdf8", borderRadius: "10px 44px 44px 10px", boxShadow: "inset 0 0 0 2px rgba(43,43,47,.06)", overflow: "hidden", fontFamily: INTER, color: "#2b2b2f", WebkitFontSmoothing: "antialiased" }}>
      <div style={pontilhado("rgba(60,50,40,.13)", 52)} />
      {ARGOLAS_STORIES.map((y, i) => (
        <i key={i} style={{ position: "absolute", left: 14, top: y - 10, width: 20, height: 20, borderRadius: "50%", background: "#ece5d6", boxShadow: "inset 0 2px 4px rgba(0,0,0,.28)" }} />
      ))}
      {!semEspiral && <Espiral f="stories" />}
      <div style={{ position: "absolute", left: esq, right: 40, top: 56, display: "flex", alignItems: "baseline" }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".2em", color: "#b3236c" }}>MEU ÁLBUM</span>
        <span style={{ marginLeft: "auto", fontSize: 22, fontWeight: 700, letterSpacing: ".18em", color: "#8c8272" }}>{mes}</span>
      </div>
      <div style={{ position: "absolute", left: esq, right: 40, top: 108, display: "flex", alignItems: "baseline" }}>
        <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: ".02em" }}>{titulo}</span>
        <span style={{ marginLeft: "auto", fontSize: 30, fontWeight: 700, color: "#8c8272", fontVariantNumeric: "tabular-nums" }}>{adesivos} de {total}</span>
      </div>
      <div style={{ position: "absolute", left: esq, top: topo, display: "grid", gridTemplateColumns: `repeat(${colunas}, ${cel}px)`, gap: `${gap}px ${gap}px` }}>
        {itens.map((b, i) => (b.unlocked && semAdesivos ? <div key={b.id} style={{ width: cel, height: alt }} /> : <CelulaAdesivoFoto key={b.id} b={b} indice={i} />))}
      </div>
      <div style={{ position: "absolute", left: esq, right: 40, top: 850, borderTop: "2px dashed rgba(43,43,47,.18)" }} />
      <div style={{ position: "absolute", left: esq, right: 40, top: 882, display: "flex", alignItems: "center", gap: 18 }}>
        <SeloNivel nivel={nivel} tamanho={72} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 27, fontWeight: 800, whiteSpace: "nowrap" }}>
            Nível {nivel} <span style={{ fontWeight: 600, color: "#8c8272" }}>· {xp.toLocaleString("pt-BR")} XP</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#8c8272", marginTop: 4 }}>{resumoRaridades(porRaridade)}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", lineHeight: 1.05, flexShrink: 0 }}>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" }}>
            {adesivos} <span style={{ fontSize: 24, fontWeight: 700, color: "#8c8272" }}>de {total}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".16em", color: "#8c8272" }}>ADESIVOS</div>
        </div>
      </div>
    </div>
  );
};

/** O título da 1ª página do álbum (o mesmo da tela). */
export const tituloDoAlbum = (maisRaros: Badge[]) => (maisRaros.length ? "OS MAIS RAROS" : "COMEÇANDO O ÁLBUM");

/**
 * NOVA · Álbum: "Meu álbum de adesivos." e a página dos mais raros aberta
 * sobre o papel, com o nome embaixo. É o último quadro do vídeo.
 */
export const StoriesAlbum = ({ parte = "tudo", ...d }: DadosArtes & { parte?: ParteDaArte }) => {
  const pagina = (extra: Partial<PaginaFotoProps> = {}) => (
    <PaginaAlbumFoto maisRaros={d.maisRaros} proximos={d.proximos} titulo={tituloDoAlbum(d.maisRaros)} adesivos={d.adesivos} total={d.total} nivel={d.nivel} xp={d.xp} porRaridade={d.porRaridade} mes={d.mes} {...extra} />
  );
  if (parte === "pagina") return pagina({ semAdesivos: true, semEspiral: true });
  if (parte === "texto") {
    return (
      <div style={{ position: "relative", width: STORIES.w, height: BLOCO_NOME_FOTO.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="album-texto">
        <BlocoNomeFoto nome={d.nome} linha={`nível ${d.nivel} · membro desde ${d.membroDesde}`} />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "#f4ecdc" }} data-stories="album" data-parte={parte}>
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 262, fontSize: 84, lineHeight: 1 }}>Meu álbum de adesivos.</div>
      {parte === "tudo" && (
        <>
          <div style={{ position: "absolute", left: PAGINA_FOTO.x, top: PAGINA_FOTO.y, borderRadius: "10px 44px 44px 10px", boxShadow: "0 60px 90px -40px rgba(0,0,0,.45)" }}>{pagina()}</div>
          <div style={{ position: "absolute", left: 0, top: BLOCO_NOME_FOTO.y, width: STORIES.w, height: BLOCO_NOME_FOTO.h }}>
            <BlocoNomeFoto nome={d.nome} linha={`nível ${d.nivel} · membro desde ${d.membroDesde}`} />
          </div>
        </>
      )}
      <div style={rodape("#8c8272", 1614)}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};
