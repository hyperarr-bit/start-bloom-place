import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { TEMA_BELEZA } from "@/components/beleza/kit";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { MiniCalendario, MiniChips, MiniLinhas, quadrosValor } from "./blocos";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

const COR = "bg-pink-100 text-pink-900";
const ACESA = "bg-pink-600";

/**
 * Os 5 cartões da BELEZA (pêssego & malva, os tokens do próprio módulo). A classe leva
 * "tema-beleza" junto: a folha é um portal fora da raiz da página e sem o escopo os
 * --bz-* não existem — era o fundo transparente do bug de 10/10.
 * Ordem do diagnóstico: Skincare (N), Cabelo, Cuidados; Meus produtos e Fotos pra depois.
 */
export const cartoesBeleza = ({ irParaSkincare }: { irParaSkincare: () => void }): ConfigCartoes => ({
  moduleId: "beleza",
  classe: `${TEMA_BELEZA} ct-beleza`,
  nome: "Beleza",
  agora: {
    texto: "Monta sua rotina de skincare em 3 toques.",
    botao: "Fazer agora",
    seletor: '[data-testid="montar-rotina"], [data-testid="rotina-pronta"], [data-testid="skincare-de-hoje"]',
    antes: irParaSkincare,
    apoio: "Como é a sua pele, o que quer cuidar, quanto já conhece — e a rotina sai pronta.",
    miniatura: (
      <Miniatura sementes={{}} largura={430} altura={150} intervalo={1300} quadros={quadrosValor([0, 1, 1], { x: "34%", y: "52%" })}>
        <MiniChips titulo="1/3 · COMO É A SUA PELE?" emoji="✨" cor={COR} corAcesa={ACESA} chips={["Oleosa", "Mista", "Seca", "Sensível"]} abaixo={<p className="text-[11px] text-muted-foreground">Depois: o que quer cuidar e quanto já conhece. Sai pronta, de manhã e de noite.</p>} />
      </Miniatura>
    ),
  },
  cartoes: [
    {
      titulo: "Sua rotina, manhã e noite",
      texto: "Cada passo com o produto e os dias — toca no quadradinho quando fizer.",
      miniatura: (
        <Miniatura sementes={getSeedsForModule("beleza")} largura={470} altura={210} dedinho={{ x: "70%", y: "66%" }}>
          <div className={`${TEMA_BELEZA} p-3 -mt-4`}><SkincareRoutine /></div>
        </Miniatura>
      ),
    },
    {
      titulo: "Cabelo: o cronograma",
      texto: "Hidratação, nutrição e reconstrução no ritmo das suas lavagens.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={210}>
          <MiniCalendario titulo="CRONOGRAMA CAPILAR" emoji="💇‍♀️" cor={COR} corMarca={ACESA} marcados={[2, 5, 9, 12, 16, 19, 23, 26]} legendas={{ 2: "Hidratação", 5: "Nutrição", 9: "Reconstrução" }} />
        </Miniatura>
      ),
    },
    {
      titulo: "Cuidados: a próxima data",
      texto: "Unha, sobrancelha, depilação — o app conta os dias sozinho.",
      miniatura: (
        <Miniatura sementes={{}} largura={430} altura={170}>
          <MiniLinhas titulo="CUIDADOS" emoji="💅" cor={COR} corBotao={ACESA} caixa={false} itens={["Unha · em 3 dias", "Sobrancelha · em 9 dias", "Depilação · em 20 dias"]} subtitulos={{ "Unha · em 3 dias": "a cada 15 dias · R$ 45", "Sobrancelha · em 9 dias": "a cada 20 dias · R$ 30", "Depilação · em 20 dias": "a cada 30 dias · R$ 90" }} />
        </Miniatura>
      ),
    },
  ],
  depois: { itens: ["Meus produtos", "Fotos da pele"] },
});

/** Pelo registro (sem a página por perto): a aba abre pelo rótulo. */
export default (): ConfigCartoes => cartoesBeleza({ irParaSkincare: () => abrirAba("SKINCARE") });
