import type { CSSProperties } from "react";
import { Roseta } from "./Roseta";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";
import { AnelRaridadeSvg } from "./adesivos-raridade";
import { CapaAlbum } from "./CapaAlbum";
import { Insignia } from "./Insignia";
import { NOME_FAIXA, fraseDe, linhaDe, nomeDoMes, periodoTexto, type Insignia as DadosInsignia } from "./insignias";
import type { DadosArtes } from "./artes-dados";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { RARIDADE_FEM } from "./album-paginas";
import { XP_RARIDADE, raridadeDe, type Badge, type Raridade } from "@/components/gamification/types";

/**
 * Artes 1080×1920 pros Stories (26/09; as INSÍGNIAS v3 e o álbum de
 * figurinhas em 27/09) — renderizadas do PRÓPRIO componente e fotografadas
 * com html-to-image; ver gerar-imagem.tsx. Tudo em estilo inline e cor fixa:
 * a foto não pode depender do tema do aparelho. Zona segura: nada acima de
 * 236 px nem abaixo de 1640 px.
 *
 * As artes que viram VÍDEO também saem em CAMADAS (`parte`): o canvas move
 * as fotos e desenha o que muda a cada quadro (o número contando, o brilho,
 * a sombra). A arte inteira ("tudo") é o último quadro do vídeo.
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
const rodape = (cor: string, top = 1600): CSSProperties => ({
  position: "absolute", left: 0, right: 0, top, textAlign: "center",
  fontSize: 24, fontWeight: 600, letterSpacing: ".22em", color: cor,
});
/** A mesa de papel (o fundo das artes das insígnias). */
const MESA = "linear-gradient(180deg,#f6efe4 0%,#efe3d3 100%)";

export type ParteDaArte = "tudo" | "fundo" | "fita" | "objeto" | "pagina" | "texto";

/* ------------------------------------------------------------------------- *
 * O bloco do nome (a camada de texto dos vídeos)
 * ------------------------------------------------------------------------- */

/** O bloco do nome: 1080 × 130, desenhado em y = 1450. */
export const BLOCO_NOME_FOTO = { h: 130, y: 1450 };

export const BlocoNomeFoto = ({ nome, linha }: { nome: string; linha: string }) => (
  <div style={{ position: "absolute", left: 40, right: 40, top: 8, textAlign: "center" }} data-bloco-nome="">
    <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
    <div style={{ fontSize: 26, color: "#6f665a", marginTop: 8, fontWeight: 500 }}>{linha}</div>
  </div>
);

interface DadosPessoa {
  nome: string;
  membroDesde: string;
  nivel: string;
}

/* ------------------------------------------------------------------------- *
 * ROSETA (só nos marcos da sequência) e ADESIVO (do detalhe) — como antes
 * ------------------------------------------------------------------------- */

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
      <div style={rodape("#8a94a6", 1516)}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

const FUNDO_RARIDADE: Record<Raridade, string> = {
  comum: "#f4ecdc",
  raro: "linear-gradient(180deg,#eef4ff 0%,#dbe7fb 100%)",
  epico: "linear-gradient(160deg,#f3e8ff 0%,#e0f2fe 45%,#fce7f3 100%)",
  lendario: "linear-gradient(180deg,#fff7d6 0%,#f3dfa0 100%)",
};

/** Stories do adesivo (figurinha): o adesivo grande na folha pontilhada — fundo holográfico no épico, dourado no lendário. */
export const StoriesAdesivo = ({ id, titulo, descricao, raridade = "comum", nome, membroDesde }: { id: string; titulo: string; descricao: string; raridade?: Raridade; nome: string; membroDesde: string }) => {
  const brilha = raridade === "epico" || raridade === "lendario";
  const nomeRar = RARIDADE_FEM[raridade].toLowerCase();
  return (
    <div style={{ ...base, background: FUNDO_RARIDADE[raridade] }} data-stories="adesivo" data-raridade={raridade}>
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 300, fontSize: 84, lineHeight: 1.02 }}>
        {raridade === "comum" ? "Mais uma figurinha" : `Figurinha ${nomeRar}`}
        <br />
        no meu álbum.
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
            FIGURINHA {RARIDADE_FEM[raridade].toUpperCase()} · +{XP_RARIDADE[raridade]} XP
          </div>
        )}
        <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: "-.03em", color: "#2b2b2f", lineHeight: 1.05 }}>{titulo}</div>
        <div style={{ fontSize: 32, color: "#6f665a", marginTop: 14, fontWeight: 500 }}>{descricao}</div>
        <div style={{ fontSize: 26, color: "#8c8272", marginTop: 34, fontWeight: 600 }}>
          {nome} · membro desde {membroDesde}
        </div>
      </div>
      <div style={rodape("#8c8272", 1516)}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * MINHA CONQUISTA DO MÊS (a insígnia enorme) — imagem e camadas do vídeo
 * ------------------------------------------------------------------------- */

/** O objeto na arte: 620 px, centro (540, 800). O vídeo desenha o número e a sombra aqui. */
export const OBJETO_CONQUISTA = { tam: 620, cx: 540, cy: 800 };
/** A fita "MINHA CONQUISTA · SETEMBRO 2026": a camada é uma faixa 1080 × 130 em y = 236. */
export const FITA_FOTO = { y: 236, h: 130 };
/** O bloco de texto (frase, linha, nome): 1080 × 440 em y = 1150; as fatias sobem em tempos diferentes no vídeo. */
export const TEXTO_CONQUISTA = { y: 1150, h: 440, frase: [0, 210] as const, linha: [210, 290] as const, nome: [290, 440] as const };

/** "SETEMBRO 2026" */
export const mesAnoDe = (mesIdx: number, ano: number) => `${nomeDoMes(mesIdx).toUpperCase()} ${ano}`;

/** A sombra suave do objeto na foto (o feDropShadow do SVG não é garantido na foto do WebKit; um degradê é). */
const SombraDoObjeto = ({ cx, cy, tam }: { cx: number; cy: number; tam: number }) => (
  <div aria-hidden style={{ position: "absolute", left: cx - tam * 0.42, top: cy + tam * 0.34, width: tam * 0.84, height: tam * 0.32, borderRadius: "50%", background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,.30) 0%, rgba(0,0,0,.14) 45%, rgba(0,0,0,0) 100%)" }} />
);

const Fita = ({ texto, marcador }: { texto: string; marcador?: string }) => (
  <div data-fita="" style={{ position: "absolute", left: "50%", top: 26, transform: "translateX(-50%) rotate(-1.6deg)", background: "#d22d80", color: "#fff", padding: "14px 40px", borderRadius: 6, fontSize: 26, fontWeight: 800, letterSpacing: ".22em", whiteSpace: "nowrap", boxShadow: "0 10px 24px -12px rgba(0,0,0,.5)", opacity: 0.96 }}>
    {texto}{marcador ? <span style={{ marginLeft: 26, opacity: 0.75, letterSpacing: ".06em" }}>{marcador}</span> : null}
  </div>
);

interface ConquistaProps extends DadosPessoa {
  ins: DadosInsignia;
  mesIdx: number;
  ano: number;
  parte?: ParteDaArte;
  /** "1/3" no Story da sequência. */
  marcador?: string;
}

/** O bloco de texto da conquista (frase em serif, a linha do número, o nome) — 1080 × 440. */
const TextoConquista = ({ ins, nome, membroDesde, nivel, mesIdx }: ConquistaProps) => {
  const frase = fraseDe(ins, mesIdx);
  const linha = `${linhaDe(ins, mesIdx)} · insígnia de ${ins.faixa ? NOME_FAIXA[ins.faixa].toLowerCase() : "início"}`;
  return (
    <div style={{ position: "relative", width: STORIES.w, height: TEXTO_CONQUISTA.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased", color: "#2b2b2f" }} data-stories="conquista-texto">
      <div style={{ position: "absolute", left: 70, right: 70, top: 0, height: TEXTO_CONQUISTA.frase[1], display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: frase.length > 26 ? 78 : 92, lineHeight: 1.02 }}>{frase}</div>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: TEXTO_CONQUISTA.linha[0] + 8, textAlign: "center", fontSize: 32, fontWeight: 600, color: "#6f665a" }}>{linha}</div>
      <div style={{ position: "absolute", left: 40, right: 40, top: TEXTO_CONQUISTA.nome[0] + 16, textAlign: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
        <div style={{ fontSize: 26, color: "#6f665a", marginTop: 8, fontWeight: 500 }}>nível {nivel} · membro desde {membroDesde}</div>
      </div>
    </div>
  );
};

/**
 * NOVA · "Minha conquista do mês": a insígnia enorme, a fita, o número, a
 * frase em serif ("Setembro foi de academia."), "19 treinos · insígnia de
 * ouro", nome + nível, rodapé CORE.
 */
export const StoriesConquista = (p: ConquistaProps) => {
  const { ins, parte = "tudo", marcador, mesIdx, ano } = p;
  const { tam, cx, cy } = OBJETO_CONQUISTA;
  if (parte === "texto") return <TextoConquista {...p} />;
  if (parte === "fita") {
    return (
      <div style={{ position: "relative", width: STORIES.w, height: FITA_FOTO.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="conquista-fita">
        <Fita texto={`MINHA CONQUISTA · ${mesAnoDe(mesIdx, ano)}`} marcador={marcador} />
      </div>
    );
  }
  if (parte === "objeto") {
    return (
      <div style={{ position: "relative", width: tam, height: tam, fontFamily: INTER }} data-stories="conquista-objeto">
        <Insignia ins={ins} tamanho={tam} estatico semNumero semSombra />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: MESA }} data-stories="conquista" data-parte={parte} data-insignia={ins.id}>
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ position: "absolute", left: cx - 400, top: cy - 400, width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${ins.cor}22 0%, ${ins.cor}00 62%)` }} />
      {parte === "tudo" && (
        <>
          <div style={{ position: "absolute", left: 0, top: FITA_FOTO.y, width: STORIES.w, height: FITA_FOTO.h }}>
            <Fita texto={`MINHA CONQUISTA · ${mesAnoDe(mesIdx, ano)}`} marcador={marcador} />
          </div>
          <SombraDoObjeto cx={cx} cy={cy} tam={tam} />
          <div style={{ position: "absolute", left: cx - tam / 2, top: cy - tam / 2, width: tam, height: tam }}>
            <Insignia ins={ins} tamanho={tam} estatico semSombra />
          </div>
          <div style={{ position: "absolute", left: 0, top: TEXTO_CONQUISTA.y, width: STORIES.w, height: TEXTO_CONQUISTA.h }}>
            <TextoConquista {...p} />
          </div>
        </>
      )}
      <div style={rodape("#8c7a80")}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * MINHAS 3 CONQUISTAS — o resumo (a imagem; e o último trecho do vídeo)
 * ------------------------------------------------------------------------- */

export const TRES_FOTO = { tam: 250, esq: 90, topo: 500, linha: 300 };

export const StoriesTres = ({ tres, nome, membroDesde, nivel, mesIdx }: DadosPessoa & { tres: DadosInsignia[]; mesIdx: number }) => {
  const { tam, esq, topo, linha } = TRES_FOTO;
  return (
    <div style={{ ...base, background: MESA }} data-stories="tres">
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 270, fontSize: 84, lineHeight: 1 }}>
        Minhas 3 conquistas
        <br />
        de {nomeDoMes(mesIdx)}.
      </div>
      {tres.slice(0, 3).map((ins, i) => {
        const l = linhaDe(ins, mesIdx);
        return (
          <div key={ins.id} data-tres-item={ins.id} style={{ position: "absolute", left: esq, right: esq, top: topo + i * linha, height: linha, display: "flex", alignItems: "center", gap: 40 }}>
            <div style={{ position: "relative", width: tam, height: tam, flexShrink: 0 }}>
              <SombraDoObjeto cx={tam / 2} cy={tam / 2} tam={tam} />
              <div style={{ position: "absolute", inset: 0 }}><Insignia ins={ins} tamanho={tam} estatico semSombra /></div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: ".2em", color: ins.cor }}>{ins.nome.toUpperCase()}</div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: l.length > 18 ? 52 : 62, lineHeight: 1.05, marginTop: 8 }}>{l}</div>
              <div style={{ fontSize: 26, color: "#6f665a", fontWeight: 600, marginTop: 10 }}>insígnia de {ins.faixa ? NOME_FAIXA[ins.faixa].toLowerCase() : "início"} · {periodoTexto(ins, mesIdx)}</div>
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, top: BLOCO_NOME_FOTO.y, width: STORIES.w, height: BLOCO_NOME_FOTO.h }}>
        <BlocoNomeFoto nome={nome} linha={`nível ${nivel} · membro desde ${membroDesde}`} />
      </div>
      <div style={rodape("#8c7a80")}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};

/* ------------------------------------------------------------------------- *
 * MEU ÁLBUM DE FIGURINHAS — o álbum aberto na página dos mais raros
 * ------------------------------------------------------------------------- */

/** O livro na arte: 760 × 1010 em (160, 400); a lombada tem 22 px (é onde a capa dobra no vídeo). */
export const LIVRO_FOTO = { w: 760, h: 1010, x: 160, y: 400, lombada: 22 };
/** A grade 3 × 2 dentro da página: célula 210 × 300 a partir de (60, 150); figurinha de 176. */
export const GRADE_FOTO = { esq: 60, topo: 150, cel: 210, alt: 300, gap: 10, tam: 176, colunas: 3 };

const Cadeado = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Uma VAGA numerada da página (210 × 300): "Nº 46", a caixa tracejada
 * quando vazia com a silhueta e a pílula, a figurinha colada (um pouco
 * torta, com o anel SVG nas épicas/lendárias) e o nome. Na foto e no sprite
 * do vídeo é a MESMA célula. `semAnel`: o vídeo desenha o anel girando.
 */
export const CelulaFigurinhaFoto = ({ b, n, indice, semAnel }: { b: Badge; n: number; indice: number; semAnel?: boolean }) => {
  const raridade = raridadeDe(b);
  const brilha = b.unlocked && !semAnel && (raridade === "epico" || raridade === "lendario");
  const rotulo = b.unlocked ? null : rotuloProgresso(b);
  const { cel, alt, tam } = GRADE_FOTO;
  return (
    <div data-celula={b.id} data-aberto={b.unlocked ? "true" : "false"} style={{ position: "relative", width: cel, height: alt, flexShrink: 0, boxSizing: "border-box", fontFamily: INTER }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: cel, height: cel, borderRadius: 22, border: b.unlocked ? "3px solid transparent" : "3px dashed #c8bfad", background: b.unlocked ? "transparent" : "rgba(255,255,255,.35)", boxSizing: "border-box" }} />
      <div style={{ position: "absolute", left: 12, top: 8, fontSize: 17, fontWeight: 800, letterSpacing: ".06em", color: b.unlocked ? "#c8bfad" : "#a39a8a" }}>Nº {nDeDois(n)}</div>
      <div style={{ position: "absolute", left: (cel - tam) / 2, top: (cel - tam) / 2 + 4, width: tam, height: tam }}>
        {brilha && <AnelRaridadeSvg raridade={raridade} tamanho={tam} />}
        <div style={{ position: "absolute", inset: 0, transform: `rotate(${b.unlocked ? giroDoAdesivo(indice) : 0}deg)`, opacity: b.unlocked ? 1 : 0.3, filter: b.unlocked ? undefined : "grayscale(1)" }}>
          <Adesivo id={b.id} tamanho={tam} bordaGrossa />
        </div>
        {!b.unlocked && b.progresso && b.progresso.atual > 0 && (
          <div style={{ position: "absolute", right: -6, bottom: 2, height: 38, padding: "0 14px", borderRadius: 999, background: "#2b2b2f", color: "#fff", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }}>
            {rotulo ?? <Cadeado />}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: -6, right: -6, top: cel + 10, height: 56, fontSize: 23, fontWeight: 800, lineHeight: 1.15, color: b.unlocked ? "#2b2b2f" : "#a39a8a", textAlign: "center", letterSpacing: "-.01em", overflow: "hidden" }}>{b.name}</div>
    </div>
  );
};

const nDeDois = (n: number) => String(n).padStart(2, "0");

interface PaginaFigurinhasProps {
  maisRaros: Badge[];
  proximos: Badge[];
  figurinhas: Badge[];
  adesivos: number;
  total: number;
  ano: number;
  /** Deixa vazias as vagas dos colados (o vídeo cola cada um no seu lugar). */
  semAdesivos?: boolean;
}

/** A página do álbum (760 × 1010): a banda "OS MAIS RAROS · 16 de 65" e as 6 vagas numeradas. */
export const PaginaFigurinhasFoto = ({ maisRaros, proximos, figurinhas, adesivos, total, ano, semAdesivos }: PaginaFigurinhasProps) => {
  const itens = [...maisRaros, ...proximos].slice(0, GRADE_FOTO.colunas * 2);
  const { w, h, lombada } = LIVRO_FOTO;
  const { esq, topo, cel, alt, gap, colunas } = GRADE_FOTO;
  const numero = (id: string) => figurinhas.findIndex((b) => b.id === id) + 1;
  return (
    <div data-pagina-foto="" style={{ position: "relative", width: w, height: h, background: "#fbf6ea", borderRadius: "10px 44px 44px 10px", boxShadow: "inset 0 0 0 2px rgba(43,43,47,.06)", overflow: "hidden", fontFamily: INTER, color: "#2b2b2f", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ ...pontilhado("rgba(60,50,40,.12)", 44) }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: lombada, background: "linear-gradient(90deg,#7a1547,#a81f62 60%,#8d1a52)" }} />
      <div style={{ position: "absolute", left: esq, right: 40, top: 44, height: 66, borderRadius: 16, background: "linear-gradient(90deg,#a81f62,#d22d80 60%,#a81f62)", color: "#fff", display: "flex", alignItems: "center", padding: "0 26px", boxShadow: "0 4px 8px rgba(0,0,0,.15)" }}>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: ".14em" }}>{maisRaros.length ? "OS MAIS RAROS" : "COMEÇANDO O ÁLBUM"}</span>
        <span style={{ marginLeft: "auto", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", opacity: 0.92 }}>{adesivos} de {total}</span>
      </div>
      <div style={{ position: "absolute", left: esq, top: topo, display: "grid", gridTemplateColumns: `repeat(${colunas}, ${cel}px)`, gap: `${gap}px ${gap}px` }}>
        {itens.map((b, i) => (b.unlocked && semAdesivos ? <div key={b.id} style={{ width: cel, height: alt }} /> : <CelulaFigurinhaFoto key={b.id} b={b} n={numero(b.id)} indice={i} />))}
      </div>
      <div style={{ position: "absolute", left: esq, right: 40, top: h - 62, display: "flex", alignItems: "baseline", fontSize: 20, fontWeight: 700, letterSpacing: ".16em", color: "#a39a8a" }}>
        <span>FIGURINHAS DA MINHA VIDA</span>
        <span style={{ marginLeft: "auto" }}>CORE · {ano}</span>
      </div>
    </div>
  );
};

/** A capa do álbum no tamanho da página (a camada que vira no vídeo). */
export const CapaAlbumFoto = ({ maisRaros, adesivos, total, nome, ano, capa, nivel }: Pick<DadosArtes, "maisRaros" | "adesivos" | "total" | "nome" | "ano" | "capa" | "nivel">) => (
  <CapaAlbum largura={LIVRO_FOTO.w} altura={LIVRO_FOTO.h} maisRaros={maisRaros} abertos={adesivos} total={total} nome={nome} ano={ano} capa={capa} nivel={nivel} foto />
);

/**
 * Álbum: "Meu álbum de figurinhas." e o álbum aberto na página dos mais
 * raros, com o nome embaixo. É o último quadro do vídeo (a capa abre e as
 * figurinhas colam uma a uma).
 */
export const StoriesAlbum = ({ parte = "tudo", ...d }: DadosArtes & { parte?: ParteDaArte }) => {
  const pagina = (semAdesivos = false) => (
    <PaginaFigurinhasFoto maisRaros={d.maisRaros} proximos={d.proximos} figurinhas={d.figurinhas} adesivos={d.adesivos} total={d.total} ano={d.ano} semAdesivos={semAdesivos} />
  );
  if (parte === "pagina") return pagina(true);
  if (parte === "texto") {
    return (
      <div style={{ position: "relative", width: STORIES.w, height: BLOCO_NOME_FOTO.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }} data-stories="album-texto">
        <BlocoNomeFoto nome={d.nome} linha={`${d.adesivos} de ${d.total} figurinhas · nível ${d.nivel}`} />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: "linear-gradient(180deg,#efe6f0 0%,#e6d9e4 100%)" }} data-stories="album" data-parte={parte}>
      <div style={{ ...pontilhado("rgba(60,50,40,.16)"), opacity: 0.9 }} />
      <div style={{ ...manchete, top: 262, fontSize: 84, lineHeight: 1 }}>Meu álbum de figurinhas.</div>
      {parte === "tudo" && (
        <>
          {/* a pilha de páginas à direita e a sombra do livro na mesa */}
          <div style={{ position: "absolute", left: LIVRO_FOTO.x + 12, top: LIVRO_FOTO.y + 12, width: LIVRO_FOTO.w + 6, height: LIVRO_FOTO.h, borderRadius: "10px 44px 44px 10px", background: "repeating-linear-gradient(180deg,#f2ead8 0 4px,#d9d0bc 4px 6px)", boxShadow: "0 60px 90px -40px rgba(0,0,0,.45)" }} />
          <div style={{ position: "absolute", left: LIVRO_FOTO.x, top: LIVRO_FOTO.y, borderRadius: "10px 44px 44px 10px", boxShadow: "0 30px 60px -30px rgba(0,0,0,.5)" }}>{pagina()}</div>
          <div style={{ position: "absolute", left: 0, top: BLOCO_NOME_FOTO.y, width: STORIES.w, height: BLOCO_NOME_FOTO.h }}>
            <BlocoNomeFoto nome={d.nome} linha={`${d.adesivos} de ${d.total} figurinhas · nível ${d.nivel}`} />
          </div>
        </>
      )}
      <div style={rodape("#8c7a80")}>CORE · ORGANIZE SUA VIDA</div>
    </div>
  );
};
