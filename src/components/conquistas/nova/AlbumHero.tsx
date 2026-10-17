import { ChevronRight } from "lucide-react";
import { raridadeDe, type Badge } from "@/components/gamification/types";
import { CapaAlbum } from "../CapaAlbum";
import { maisRaros } from "../album-paginas";
import { AdesivoRaro } from "../adesivos-raridade";
import { fraseDaPaginaMaisPerto, fraseDoPremio } from "./recompensas";
import type { EstadoConquistasNova } from "./use-conquistas-nova";
import "./conquistas-nova.css";

/**
 * O ÁLBUM COMO HERÓI (16/10, dono: "dar um foco maior no álbum em si, abrir o
 * álbum e etc., acho que converte bem o usuário"; dado: quem abre o álbum no
 * teste paga 53% × 31%). Logo abaixo do cartão da sequência: a CAPA grande e
 * tocável (a mesma do álbum 3D), a contagem com a barra, "faltam N figurinhas
 * na página das raras" e — quando há figurinha nova — o PACOTINHO ("1
 * figurinha nova pra colar") com o selo "1 NOVA" por cima da capa.
 * O toque levanta a capa (260 ms) e abre o álbum de verdade (AlbumTela).
 * Textos curtos e concretos (dono 16/10: nada de frase abstrata).
 */
export const AlbumHero = ({ e, levantando, onAbrir, onPacotinho }: { e: EstadoConquistasNova; levantando: boolean; onAbrir: () => void; onPacotinho: () => void }) => {
  const raros = maisRaros(e.adesivos, e.desbloqueadas);
  const pct = e.total > 0 ? Math.round((e.abertos / e.total) * 100) : 0;
  const novas = e.pendentes.length;
  const proximo: Badge | null = e.premio.adesivo;
  return (
    <section className="cn-card cn-album cn-pontilhado" aria-labelledby="cn-titulo-album" data-testid="cn-album" data-novas={novas}>
      <div className="cn-album-corpo">
        <button type="button" onClick={onAbrir} aria-label="Abrir o álbum" className="cn-album-capa" data-levantando={levantando ? "" : undefined} data-testid="cn-album-capa">
          <CapaAlbum largura={132} maisRaros={raros} abertos={e.abertos} total={e.total} nome={e.nome} ano={e.ano} />
          {novas > 0 && (
            <span className="cn-album-selo" data-testid="cn-album-selo" aria-hidden>
              <b>{novas}</b> {novas === 1 ? "nova" : "novas"}
            </span>
          )}
        </button>
        <div className="min-w-0 flex flex-col">
          <span id="cn-titulo-album" className="cn-caps" style={{ color: "hsl(var(--accent))" }}>Álbum de figurinhas</span>
          <span className="mt-1.5 leading-none tracking-[-.02em] font-black text-[20px] tabular-nums" data-testid="cn-album-contagem">
            <b className="text-[30px]">{e.abertos}</b> de {e.total} <span className="text-[12px] font-bold text-muted-foreground tracking-normal">coladas</span>
          </span>
          <span className="flex items-center gap-2 mt-2 text-[11px] font-extrabold text-muted-foreground">
            <span className="cn-barra flex-1"><i style={{ width: `${pct}%` }} /></span>
            <span className="tabular-nums">{pct}%</span>
          </span>
          {novas > 0 ? (
            <button type="button" className="cn-album-pacote" onClick={onPacotinho} data-testid="cn-album-pacotinho" aria-label={`${novas} ${novas === 1 ? "figurinha nova" : "figurinhas novas"} pra colar — abrir o álbum`}>
              <span className="cn-album-pacote-fig" aria-hidden />
              <span className="min-w-0 text-left">
                <b className="block text-[11.5px] text-foreground leading-tight">{novas === 1 ? "1 figurinha nova pra colar" : `${novas} figurinhas novas pra colar`}</b>
                <small className="block text-[10px] text-muted-foreground">toque pra abrir o álbum</small>
              </span>
            </button>
          ) : e.abertos === 0 ? (
            <span className="mt-2.5 text-[11.5px] text-muted-foreground leading-[1.35]" data-testid="cn-album-vazio">
              Nenhuma figurinha ainda. <b className="text-foreground">Anota algo hoje</b> e a primeira cola.
            </span>
          ) : e.paginaMaisPerto ? (
            <span className="mt-2.5 text-[11.5px] text-muted-foreground leading-[1.35]" data-testid="cn-album-pagina">
              {fraseDaPaginaMaisPerto(e.paginaMaisPerto.faltam, e.paginaMaisPerto.plural, e.paginaMaisPerto.parte)}
            </span>
          ) : (
            <span className="mt-2.5 text-[11.5px] text-muted-foreground leading-[1.35]">Álbum completo.</span>
          )}
        </div>
      </div>
      {/* o próximo adesivo da sequência já tem vaga marcada no álbum */}
      {proximo && (
        <div className="cn-album-amanha" data-testid="cn-album-amanha">
          <span className="shrink-0 grid place-items-center w-9 h-9"><AdesivoRaro id={proximo.id} raridade={raridadeDe(proximo)} tamanho={34} trancado /></span>
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.3] font-bold text-foreground">{fraseDoPremio(e.premio)}</span>
        </div>
      )}
      <button type="button" onClick={onAbrir} className="cn-album-abrir" data-testid="cn-album-abrir">
        {/* o texto num span: a regra global do alvo de toque pega botão com svg como único elemento filho */}
        <span>Abrir o álbum</span> <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </section>
  );
};
