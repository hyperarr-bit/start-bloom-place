import "@fontsource/instrument-serif/latin-400-italic.css";
import type { CSSProperties } from "react";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";
import { AdesivoRaro, AnelRaridadeSvg } from "./adesivos-raridade";
import { CAPAS, HotStamp, type CapaId } from "./CapaPlanner";
import { FigurinhaColada } from "./FigurinhaAlbum";
import { gravacaoDoNivel } from "./SeloNivel";
import "./conquistas.css";

/**
 * A CAPA DO ÁLBUM DE FIGURINHAS (02/10, álbum 3D): HERDA A CAPA PREMIUM do
 * planner — o mesmo material (couro grafite, vichy, linho sálvia, veludo
 * lilás, kraft, marinho, bordô, noite: `CAPAS`), a mesma costura e o mesmo
 * HOT STAMPING no metal do nível (`gravacaoDoNivel`): "ÁLBUM DE FIGURINHAS ·
 * 2026" em cima, "Figurinhas da minha vida." gravado em serif, a figurinha
 * mais rara numa JANELA REDONDA prensada no material, a etiqueta de papel
 * "17 de 65 · de Ana" e o "core" embaixo. Tudo escala com `--k` (largura ÷
 * 200): serve pra mini-capa do card (104), pra capa que vira na tela cheia e
 * pra foto do vídeo (760 × 1010).
 *
 * `foto`: nada de foil/máscara (o html-to-image não garante), o anel da
 * raridade vai em SVG e o relevo do hot stamping some (FotoWebKit).
 */
interface Props {
  largura: number;
  /** Por padrão 1,42 × largura (a proporção do álbum). */
  altura?: number;
  maisRaros: Badge[];
  abertos: number;
  total: number;
  nome: string;
  /** "2026" */
  ano: number;
  /** A capa escolhida no planner. */
  capa?: CapaId;
  /** O nível (o metal da gravação). */
  nivel?: string;
  foto?: boolean;
  style?: CSSProperties;
}

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

const FigurinhaFoto = ({ b, tam, giro }: { b: Badge; tam: number; giro?: number }) => {
  const raridade = raridadeDe(b);
  const brilha = raridade === "epico" || raridade === "lendario";
  return (
    <span style={{ position: "relative", display: "inline-block", width: tam, height: tam, lineHeight: 0, transform: giro ? `rotate(${giro}deg)` : undefined }}>
      {brilha && <AnelRaridadeSvg raridade={raridade} tamanho={tam} />}
      <span style={{ position: "relative", display: "block" }}><Adesivo id={b.id} tamanho={tam} bordaGrossa /></span>
    </span>
  );
};

export const CapaAlbum = ({ largura, altura, maisRaros, abertos, total, nome, ano, capa = "grafite", nivel = "Bronze", foto = false, style }: Props) => {
  const k = largura / 200;
  const h = altura ?? Math.round(largura * 1.42);
  const c = CAPAS[capa] ?? CAPAS.grafite;
  const g = gravacaoDoNivel(nivel);
  const heroi = maisRaros[0];
  const minis = maisRaros.slice(1, 3);
  const stamp = (texto: string, tamanho: number, extra: Partial<Parameters<typeof HotStamp>[0]> = {}) => (
    <HotStamp texto={texto} paradas={g.paradas} contorno={g.contorno} tamanho={tamanho * k} peso={800} sombra={c.prensaSombra} luz={c.prensaLuz} largura={largura} altura={tamanho * k * 1.25} {...extra} />
  );
  return (
    <div className="alb-capa" data-capa-album={capa} data-material="" style={{ width: largura, height: h, "--k": k, ...style } as CSSProperties}>
      <div
        className="alb-capa-face"
        style={{
          backgroundColor: c.bg, backgroundImage: c.camadas, backgroundSize: c.tamanhos, backgroundRepeat: "repeat",
          boxShadow: foto
            ? `inset 0 0 0 1px ${c.chanfro}`
            : `inset 1px 1px 0 ${c.clara ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.16)"}, inset -1px -1px 0 ${c.clara ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.45)"}, inset 0 0 0 1px ${c.chanfro}`,
        }}
      >
        {/* a costura no fio da capa (sombra do ponto + o fio), como na capa do planner */}
        <div className="alb-capa-costura" aria-hidden style={{ borderColor: c.prensaSombra, opacity: 0.55, transform: "translateY(.6px)" }} />
        <div className="alb-capa-costura" aria-hidden style={{ borderColor: c.costura }} />
        {/* a lombada: a dobra do material, mais escura, com o vinco */}
        <div className="alb-capa-dobra" aria-hidden />
        <div className="alb-capa-topo">{stamp(`ÁLBUM DE FIGURINHAS · ${ano}`, 6.6, { espaco: 1.3 * k, altura: 9 * k })}</div>
        <div className="alb-capa-titulo" data-titulo-capa="">
          {stamp("Figurinhas da", 25, { fonte: SERIF, italico: true, peso: 400, contornoFino: true, espaco: -0.3 * k, altura: 30 * k })}
          {stamp("minha vida.", 25, { fonte: SERIF, italico: true, peso: 400, contornoFino: true, espaco: -0.3 * k, altura: 30 * k })}
        </div>
        {/* a JANELA redonda prensada no material, com a figurinha mais rara */}
        <div className="alb-capa-janela" style={{ background: c.rebaixo, boxShadow: `inset 0 calc(2px * var(--k)) calc(5px * var(--k)) ${c.prensaSombra}, 0 1px 0 ${c.prensaLuz}` }}>
          {heroi ? (
            <span className="alb-capa-heroi">
              {foto ? <FigurinhaFoto b={heroi} tam={78 * k} /> : <FigurinhaColada id={heroi.id} raridade={raridadeDe(heroi)} tamanho={78 * k} grande giro={-5} />}
            </span>
          ) : (
            <span className="alb-capa-heroi" data-vazio="">?</span>
          )}
        </div>
        {minis.map((b, i) => (
          <span key={b.id} className="alb-capa-mini" data-pos={i} aria-hidden>
            {foto ? <FigurinhaFoto b={b} tam={34 * k} giro={giroDoAdesivo(i + 1)} /> : <AdesivoRaro id={b.id} raridade={raridadeDe(b)} tamanho={34 * k} giro={giroDoAdesivo(i + 1)} style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.3))" }} />}
          </span>
        ))}
        {/* a etiqueta de papel: quantas coladas e de quem é */}
        <div className="alb-capa-etiqueta" style={{ background: c.papel, boxShadow: foto ? "0 2px 3px rgba(0,0,0,.4)" : `0 1px 1px rgba(0,0,0,.22), 0 calc(6px * var(--k)) calc(12px * var(--k)) calc(-5px * var(--k)) rgba(0,0,0,.6)` }}>
          <i style={{ borderColor: c.papelMoldura }} aria-hidden />
          <span className="tabular-nums"><b>{abertos}</b> de {total}</span>
          <span className="alb-capa-dono">de {nome}</span>
        </div>
        <div className="alb-capa-core" aria-hidden>{stamp("core", 13, { peso: 900, espaco: -0.4 * k, largura: 40 * k, altura: 16 * k })}</div>
      </div>
    </div>
  );
};
