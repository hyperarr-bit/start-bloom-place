import { ChevronRight, Paintbrush, Sparkles } from "lucide-react";
import { CapaAlbum } from "../CapaAlbum";
import type { Badge } from "../../gamification/types";
import type { CorCapa } from "../capa-pessoal";
import type { EstadoConquistasNova } from "./use-conquistas-nova";

export const AlbumHero = ({ e, levantando, onAbrir, onPacotinho, onComecar, onPersonalizar, capa, cor, primeiraColada, emMissao = false }: {
  e: EstadoConquistasNova; levantando: boolean; onAbrir: () => void; onPacotinho: () => void;
  onComecar: () => void; onPersonalizar: () => void; capa: Badge[]; cor: CorCapa; primeiraColada: boolean; emMissao?: boolean;
}) => {
  const novas = e.pendentes.length;
  const pct = e.total ? Math.round(e.coladas / e.total * 100) : 0;
  return <section className="cn-card cn-album cn-album-pessoal" aria-labelledby="cn-titulo-album" data-testid="cn-album" data-novas={novas}>
    <div className="cn-album-heading"><h2 id="cn-titulo-album">Meu álbum</h2>
      <span className="cn-album-contagem" data-testid="cn-album-contagem" aria-label={`${e.abertos} conquistadas; ${e.coladas} de ${e.total} figurinhas coladas`} aria-live="polite" aria-atomic="true"><span className="cn-album-fracao" aria-hidden><b>{e.coladas}</b><span> / {e.total}</span></span><small aria-hidden>{e.coladas === 1 ? "colada" : "coladas"}</small></span>
    </div>
    <div className="cn-caderno-palco"><button type="button" onClick={onAbrir} aria-label="Abrir o álbum" className="cn-album-capa" data-levantando={levantando ? "" : undefined} data-testid="cn-album-capa"><CapaAlbum referencia largura={176} maisRaros={[]} figurinhasCapa={capa} corCapa={cor} abertos={e.coladas} total={e.total} nome={e.nome} ano={e.ano}/></button>
      {novas > 0 && <span className="cn-caderno-nova" data-testid="cn-album-selo">{novas} {novas === 1 ? "nova" : "novas"}</span>}
    </div>
    {e.abertos > 0 && <div className="cn-caderno-progresso" role="progressbar" aria-label="Figurinhas coladas" aria-valuenow={e.coladas} aria-valuemin={0} aria-valuemax={e.total}><i style={{width:`${pct}%`}}/></div>}
    {e.abertos === 0 && <p className="cn-album-nota" data-testid="cn-album-vazio">{emMissao ? "Faça o primeiro registro da sua missão e ganhe uma figurinha." : "Seu álbum começa com um registro."}</p>}
    {primeiraColada && <p className="cn-primeira-colada" role="status">Sua primeira figurinha já deixou sua marca.<br/><span>Agora escolha uma cor para a capa.</span></p>}
    {novas > 0 ? <button type="button" className="cn-album-colar" onClick={onPacotinho} data-testid="cn-album-pacotinho"><Sparkles aria-hidden/><span>Colar {novas} {novas===1?"figurinha":"figurinhas"}</span></button> : <button type="button" className="cn-album-abrir cn-album-abrir-principal" onClick={e.abertos===0?onComecar:onAbrir} data-testid="cn-album-abrir">{e.abertos===0?(emMissao ? "Ir para minha missão" : "Começar minha coleção"):"Abrir álbum"}<ChevronRight aria-hidden/></button>}
    <div className="cn-album-acoes">{novas>0 && <button type="button" onClick={onAbrir} data-testid="cn-album-abrir">Abrir álbum</button>}<button type="button" onClick={onPersonalizar} data-testid="cn-personalizar"><Paintbrush size={15} aria-hidden/>Personalizar capa</button></div>
  </section>;
};
