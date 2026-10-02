import { Instagram } from "lucide-react";
import type { Badge, Raridade } from "@/components/gamification/types";
import { rotuloProgresso } from "@/lib/conquistas-registro";
import { CapaAlbum } from "./CapaAlbum";
import { resumoRaridades } from "./album-paginas";
import "./conquistas.css";

/**
 * O CARD DE ENTRADA DO ÁLBUM (27/09, embaixo de "Meus adesivos", que fica
 * igual): a mini-capa torta à esquerda, "ÁLBUM DE FIGURINHAS", "16 de 65
 * coladas", a barra, "1 épico · 5 raros · 10 comuns", "Perto de colar: X ·
 * 6/7" — ou, com figurinha nova desde a última abertura, o PACOTINHO ("2
 * figurinhas novas · toque pra abrir o pacotinho"). "Abrir o álbum" abre a
 * tela cheia; "Compartilhar" vai direto pra prévia do vídeo do álbum.
 */
interface Props {
  maisRaros: Badge[];
  abertos: number;
  total: number;
  porRaridade: Record<Raridade, { abertos: number; total: number }>;
  proximo: Badge | null;
  /** Figurinhas coladas desde a última vez que o álbum foi aberto. */
  novas: number;
  nome: string;
  ano: number;
  onAbrir: () => void;
  /**
   * O PACOTINHO (02/10, vídeo do dono no iPhone: "toque pra abrir o pacotinho"
   * não respondia). Antes a linha chamava o MESMO `onAbrir` do botão "Abrir o
   * álbum": o álbum abria na capa e na 1ª página, e a figurinha nova — que é
   * o motivo do toque — ficava numa página lá na frente, sem nada na tela
   * dizendo que o pacotinho abriu. Agora o pacotinho tem o próprio caminho:
   * abre o álbum DIRETO na página da figurinha nova, que cola com o pop.
   */
  onAbrirPacotinho?: () => void;
  onCompartilhar: () => void;
}

export const CardAlbum = ({ maisRaros, abertos, total, porRaridade, proximo, novas, nome, ano, onAbrir, onAbrirPacotinho, onCompartilhar }: Props) => {
  const pct = total > 0 ? Math.round((abertos / total) * 100) : 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-3.5" aria-labelledby="titulo-album" data-testid="album-card" data-novas={novas}>
      <div className="grid gap-x-3.5" style={{ gridTemplateColumns: "104px 1fr" }}>
        <button type="button" onClick={onAbrir} aria-label="Abrir o álbum" className="text-left active:scale-[0.98] transition-transform" style={{ transform: "rotate(-3deg)", transformOrigin: "center" }}>
          <CapaAlbum largura={104} maisRaros={maisRaros} abertos={abertos} total={total} nome={nome} ano={ano} />
        </button>
        <div className="min-w-0">
          <h2 id="titulo-album" className="pin-rot" style={{ color: "hsl(var(--accent))" }}>Álbum de figurinhas</h2>
          <div className="mt-1 leading-[1.1] tracking-[-.02em] font-black text-[22px]" data-testid="album-card-contagem">
            <b className="text-[30px]">{abertos}</b> de {total} <span className="text-[13px] font-bold text-muted-foreground tracking-normal">coladas</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] font-extrabold text-muted-foreground">
            <span className="alb-card-barra"><i style={{ width: `${pct}%` }} /></span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">{resumoRaridades(porRaridade)}</div>
          {novas > 0 ? (
            <button type="button" className="alb-pacote" onClick={onAbrirPacotinho ?? onAbrir} data-testid="album-pacotinho" aria-label={`${novas} ${novas === 1 ? "figurinha nova" : "figurinhas novas"} — abrir o pacotinho`}>
              <span className="alb-pacote-fig" aria-hidden />
              <span className="min-w-0">
                <b className="block text-[11.5px] text-foreground">{novas} {novas === 1 ? "figurinha nova" : "figurinhas novas"}</b>
                <small className="block text-[10px] text-muted-foreground">toque pra abrir o pacotinho</small>
              </span>
            </button>
          ) : proximo ? (
            <div className="text-[11px] text-muted-foreground mt-1.5 leading-[1.35]" data-testid="album-card-proximo">
              Perto de colar: <b className="text-foreground">{proximo.name}</b>{rotuloProgresso(proximo) ? ` · ${rotuloProgresso(proximo)}` : ""}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 mt-3.5">
        <button type="button" onClick={onAbrir} className="flex-1 h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center active:scale-[0.99] transition-transform" data-testid="album-abrir">
          Abrir o álbum
        </button>
        <button type="button" onClick={onCompartilhar} className="h-11 px-3.5 rounded-xl border border-border bg-card font-bold text-[12.5px] inline-flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform" data-testid="album-compartilhar">
          <Instagram className="w-4 h-4" aria-hidden /> Compartilhar
        </button>
      </div>
    </section>
  );
};
