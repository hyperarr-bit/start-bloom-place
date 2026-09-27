import { Miniatura } from "./prancheta";
import { TopoEBarras } from "./moldura";
import { DESCRICAO_DO_TEMA, ORDEM_DOS_TEMAS, nomeDoTema, type TemaDaRetro } from "./temas";
import type { Base, Pele, PeleDaFolha } from "./pele";

/**
 * A FOLHA DE TEMAS (26/09, desenho do designer): abre pelo chip "Tema" da
 * capa, por cima da página, com as 3 capas em miniatura — a DE VERDADE, com
 * o nome e o mês da pessoa (não um print). Tocar numa troca o tema na hora.
 * "Muda as páginas. O card final é sempre o do planner."
 */

const LARGURA_DA_MINI = 100;

export const FolhaDeTema = ({ tema, peles, base, curta, total, folha, folgaBaixo, onEscolher, onFechar }: {
  tema: TemaDaRetro;
  peles: Record<TemaDaRetro, Pele>;
  base: Base;
  curta: boolean;
  total: number;
  folha: PeleDaFolha;
  /** a área segura de baixo, em unidades de desenho */
  folgaBaixo: number;
  onEscolher: (t: TemaDaRetro) => void;
  onFechar: () => void;
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tema da retrospectiva"
      data-testid="folha-de-tema"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: "24px 24px 0 0", padding: `12px 22px ${28 + folgaBaixo}px`, background: folha.bg, color: folha.fg, boxShadow: "0 -20px 40px -20px rgba(0,0,0,.5)", pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar a escolha de tema"
        className="p-0"
        style={{ display: "block", width: 64, height: 20, margin: "0 auto 8px", background: "none", border: 0, cursor: "pointer" }}
      >
        <i style={{ display: "block", width: 40, height: 4, borderRadius: 2, margin: "0 auto", background: "currentColor", opacity: 0.25, color: folha.fg }} />
      </button>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.01em" }}>Tema da retrospectiva</div>
      <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 3 }}>Muda as páginas. O card final é sempre o do planner.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 18 }}>
        {ORDEM_DOS_TEMAS.map((t) => {
          const on = t === tema;
          const pele = peles[t];
          const pagina = curta ? pele.capaCurta(base) : pele.capa(base);
          const rotulo = on ? (t === "paginas" ? "padrão · atual" : "atual") : t === "paginas" ? "padrão" : DESCRICAO_DO_TEMA[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              aria-label={`${nomeDoTema(t, base.retro.mes)}${on ? " (atual)" : ""}`}
              onClick={() => onEscolher(t)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "none", border: 0, padding: 0, color: "inherit", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span
                style={{
                  display: "block", borderRadius: 12, overflow: "hidden",
                  boxShadow: on ? `0 0 0 3px ${folha.acento}, 0 10px 20px -12px rgba(0,0,0,.6)` : "0 10px 20px -12px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.1)",
                }}
              >
                <Miniatura largura={LARGURA_DA_MINI} fundoCor={pagina.fundoCor}>
                  {pagina.fundo}
                  <div style={{ position: "absolute", inset: 0 }}>{pagina.conteudo}</div>
                  <TopoEBarras moldura={pagina.moldura} total={total} atual={0} chip estatica />
                </Miniatura>
              </span>
              <b style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.15 }}>{nomeDoTema(t, base.retro.mes)}</b>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", opacity: on ? 1 : 0.6, color: on ? folha.acento : undefined }}>{rotulo}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 11.5, opacity: 0.62, textAlign: "center" }}>Dá pra trocar de novo a qualquer hora.</div>
    </div>
  );
};
