import { ChevronRight, Sparkles } from "lucide-react";
import { CapaAlbum } from "../CapaAlbum";
import { maisRaros } from "../album-paginas";
import type { EstadoConquistasNova } from "./use-conquistas-nova";

/** O álbum é o protagonista. Progresso e ação aparecem uma vez cada. */
export const AlbumHero = ({ e, levantando, onAbrir, onPacotinho }: { e: EstadoConquistasNova; levantando: boolean; onAbrir: () => void; onPacotinho: () => void }) => {
  const novas = e.pendentes.length;
  const pct = e.total ? Math.round(e.coladas / e.total * 100) : 0;
  return <section className="cn-card cn-album" aria-labelledby="cn-titulo-album" data-testid="cn-album" data-novas={novas}>
    <div className="cn-album-heading">
      <h2 id="cn-titulo-album">Meu álbum</h2>
      <span className="cn-album-contagem" data-testid="cn-album-contagem" aria-label={`${e.coladas} de ${e.total} figurinhas coladas`} aria-live="polite"><b>{e.coladas}</b> / {e.total}</span>
    </div>
    <div className="cn-caderno-palco">
      <button type="button" onClick={onAbrir} aria-label="Abrir o álbum" className="cn-album-capa" data-levantando={levantando ? "" : undefined} data-testid="cn-album-capa">
        <CapaAlbum referencia largura={154} maisRaros={maisRaros(e.adesivos, e.desbloqueadas)} abertos={e.coladas} total={e.total} nome={e.nome} ano={e.ano}/>
      </button>
      {novas > 0 && <span className="cn-caderno-nova" data-testid="cn-album-selo">{novas} {novas === 1 ? "nova" : "novas"}</span>}
    </div>
    <div className="cn-caderno-progresso" role="progressbar" aria-label="Figurinhas coladas" aria-valuenow={e.coladas} aria-valuemin={0} aria-valuemax={e.total}><i style={{width: `${pct}%`}}/></div>
    {e.abertos === 0 && <p className="cn-album-nota" data-testid="cn-album-vazio">Seu primeiro registro vira figurinha.</p>}
    {novas > 0 && <button type="button" className="cn-album-colar" onClick={onPacotinho} data-testid="cn-album-pacotinho"><Sparkles aria-hidden/><span>Colar {novas} {novas === 1 ? "figurinha" : "figurinhas"}</span></button>}
    <button type="button" onClick={onAbrir} className={`cn-album-abrir${novas === 0 ? " cn-album-abrir-principal" : ""}`} data-testid="cn-album-abrir">Abrir álbum<ChevronRight aria-hidden/></button>
  </section>;
};
