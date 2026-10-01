import { trackEventBeacon } from "@/lib/analytics";
import { aparelhoDaWeb, type AparelhoWeb } from "@/components/LojasCard";

/**
 * OS DOIS SELOS OFICIAIS (App Store / Google Play) — a única porta de
 * download do site (01/10).
 *
 * Todo selo passa por `/baixar?origem=site_<onde>&loja=<ios|android>`: a
 * função da Vercel (api/baixar.js) grava o clique no servidor
 * (`baixar_click`) e manda pra loja — no computador também, porque o
 * parâmetro `loja` diz qual. Assim a medição fica num lugar só, junto com o
 * link da bio do Instagram.
 *
 * Ordem: a loja do aparelho vem primeiro e maior. No computador aparecem os
 * dois do mesmo tamanho (o celular é outro aparelho) e abrem em aba nova,
 * pra pessoa não perder a página.
 *
 * O evento `loja_click` sai com keepalive (trackEventBeacon): o clique
 * navega pra fora no mesmo instante e um insert comum morreria junto com a
 * página.
 */
export type Loja = "ios" | "android";

export const urlBaixar = (origem: string, loja: Loja) => `/baixar?origem=${encodeURIComponent(origem)}&loja=${loja}`;

export const lojaDoAparelho = (ap: AparelhoWeb): Loja | null =>
  ap === "iphone" ? "ios" : ap === "android" ? "android" : null;

const SELOS: Record<Loja, { src: string; alt: string; largura: number; altura: number; testid: string }> = {
  // SVG oficial pt-BR da Apple (119.66×40). PNG oficial do Google (646×250,
  // já com a margem transparente que a marca exige).
  ios: { src: "/selos/app-store.svg", alt: "Baixar na App Store", largura: 1197, altura: 400, testid: "selo-app-store" },
  android: { src: "/selos/google-play.png", alt: "Disponível no Google Play", largura: 646, altura: 250, testid: "selo-google-play" },
};

interface Props {
  /** vira `origem=site_<onde>` no /baixar e `onde` no evento */
  onde: string;
  /** prefixo da origem — "site" na landing, "web" dentro do app logado */
  prefixo?: "site" | "web";
  /** altura do selo em px (o maior; o secundário é um pouco menor no celular) */
  altura?: number;
  className?: string;
}

export function SelosDasLojas({ onde, prefixo = "site", altura = 52, className = "" }: Props) {
  const ap = aparelhoDaWeb();
  const principal = lojaDoAparelho(ap);
  const ordem: Loja[] = principal === "android" ? ["android", "ios"] : ["ios", "android"];
  const origem = `${prefixo}_${onde}`;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} data-testid="selos-das-lojas" data-aparelho={ap}>
      {ordem.map((loja) => {
        const s = SELOS[loja];
        // no celular o selo da OUTRA loja fica menor; no computador os dois iguais
        const h = principal && loja !== principal ? Math.round(altura * 0.82) : altura;
        // o PNG do Google tem margem transparente de ~10% — compensa pra os dois
        // ficarem com a mesma altura visual
        const hReal = loja === "android" ? Math.round(h * 1.17) : h;
        const w = Math.round((s.largura / s.altura) * hReal);
        return (
          <a
            key={loja}
            href={urlBaixar(origem, loja)}
            target={principal ? undefined : "_blank"}
            rel={principal ? undefined : "noopener"}
            data-testid={s.testid}
            data-loja={loja}
            aria-label={s.alt}
            className="inline-flex shrink-0 rounded-lg transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => trackEventBeacon("loja_click", { loja, onde: origem, aparelho: ap })}
          >
            <img src={s.src} alt={s.alt} width={w} height={hReal} style={{ height: hReal, width: w }} decoding="async" />
          </a>
        );
      })}
    </div>
  );
}
