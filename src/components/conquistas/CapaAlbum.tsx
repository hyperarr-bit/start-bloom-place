import type { CSSProperties } from "react";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";
import { AdesivoRaro, AnelRaridadeSvg } from "./adesivos-raridade";
import "./conquistas.css";

/**
 * A CAPA DO ÁLBUM DE FIGURINHAS (27/09): lombada magenta, faixa "ÁLBUM DE
 * FIGURINHAS · CORE · 2026", "Figurinhas da minha vida." em serif, a
 * figurinha mais rara no meio com 4 pequenas em volta, "16 de 65 · de Ana".
 * Tudo escala com `--k` (largura ÷ 200): serve pra mini-capa do card (104),
 * pra capa que vira na tela cheia e pra foto do vídeo (760 × 1010).
 *
 * `foto`: o anel da raridade vai em SVG (o html-to-image não garante
 * conic-gradient + mask) e nada anima.
 */
interface Props {
  largura: number;
  /** Por padrão 1,32 × largura (a proporção do álbum). */
  altura?: number;
  maisRaros: Badge[];
  abertos: number;
  total: number;
  nome: string;
  /** "2026" */
  ano: number;
  foto?: boolean;
  style?: CSSProperties;
}

const MINIS: CSSProperties[] = [
  { left: 0, top: 0 },
  { right: 0, top: "calc(6px * var(--k))" },
  { left: "calc(4px * var(--k))", bottom: 0 },
  { right: "calc(6px * var(--k))", bottom: "calc(-2px * var(--k))" },
];

const Figurinha = ({ b, tam, foto, grossa, giro }: { b: Badge; tam: number; foto: boolean; grossa?: boolean; giro?: number }) => {
  const raridade = raridadeDe(b);
  if (!foto) return <AdesivoRaro id={b.id} raridade={raridade} tamanho={tam} bordaGrossa={grossa} giro={giro} />;
  const brilha = raridade === "epico" || raridade === "lendario";
  return (
    <span style={{ position: "relative", display: "inline-block", width: tam, height: tam, lineHeight: 0, transform: giro ? `rotate(${giro}deg)` : undefined }}>
      {brilha && <AnelRaridadeSvg raridade={raridade} tamanho={tam} />}
      <span style={{ position: "relative", display: "block" }}><Adesivo id={b.id} tamanho={tam} bordaGrossa={grossa} /></span>
    </span>
  );
};

export const CapaAlbum = ({ largura, altura, maisRaros, abertos, total, nome, ano, foto = false, style }: Props) => {
  const k = largura / 200;
  const h = altura ?? Math.round(largura * 1.32);
  const heroi = maisRaros[0];
  const minis = maisRaros.slice(1, 5);
  return (
    <div className="alb-capa" data-capa-album="" style={{ width: largura, height: h, "--k": k, ...style } as CSSProperties}>
      <div className="alb-capa-lombada" />
      <div className="alb-capa-face">
        <div className="alb-capa-faixa"><span>ÁLBUM DE FIGURINHAS</span><b>CORE · {ano}</b></div>
        <div className="alb-capa-titulo">Figurinhas da<br />minha vida.</div>
        <div className="alb-capa-arte">
          {heroi ? (
            <span className="alb-capa-heroi"><Figurinha b={heroi} tam={92 * k} foto={foto} grossa /></span>
          ) : (
            <span className="alb-capa-heroi" data-vazio="">?</span>
          )}
          {minis.map((b, i) => (
            <span key={b.id} className="alb-capa-mini" style={MINIS[i]}><Figurinha b={b} tam={40 * k} foto={foto} giro={giroDoAdesivo(i + 1)} /></span>
          ))}
        </div>
        <div className="alb-capa-rodape">
          <span className="alb-capa-conta tabular-nums">
            <span><b>{abertos}</b> de {total}</span>
            {/* (02/10) a barrinha fina das páginas do álbum, na cor da faixa */}
            <i className="alb-capa-barra" aria-hidden><i style={{ width: `${total > 0 ? Math.min(100, Math.round((abertos / total) * 100)) : 0}%` }} /></i>
          </span>
          <span className="alb-capa-dono">de {nome}</span>
        </div>
        <div className="alb-capa-brilho" />
      </div>
    </div>
  );
};
