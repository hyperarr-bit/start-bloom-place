import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { TEMA_BELEZA } from "@/components/beleza/kit";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { Miniatura } from "./Miniatura";
import { abrirAba } from "./registro";
import type { ConfigCartoes } from "./CartoesDoModulo";

/** Os 3 cartões da BELEZA (pêssego & malva, os tokens do próprio módulo). */
export const cartoesBeleza = ({ irParaSkincare }: { irParaSkincare: () => void }): ConfigCartoes => ({
  moduleId: "beleza",
  classe: "ct-beleza",
  nome: "Beleza",
  agora: {
    titulo: "Faz isso agora",
    texto: "Monta sua rotina de skincare em 3 toques.",
    botao: "Fazer agora",
    seletor: '[data-testid="montar-rotina"], [data-testid="rotina-pronta"], [data-testid="skincare-de-hoje"]',
    antes: irParaSkincare,
  },
  essencial: {
    titulo: "Onde fica o essencial",
    texto: "Três abas pra começar:",
    abas: ["✨ SKINCARE", "💇‍♀️ CABELO", "💅 CUIDADOS"],
    miniatura: (
      <Miniatura sementes={getSeedsForModule("beleza")} largura={470} altura={210} dedinho={{ x: "70%", y: "66%" }} legenda="Em SKINCARE: a rotina de manhã e de noite — toca no quadradinho de cada passo feito.">
        <div className={`${TEMA_BELEZA} p-3 -mt-4`}><SkincareRoutine /></div>
      </Miniatura>
    ),
  },
  depois: {
    titulo: "O que não precisa hoje",
    itens: ["Meus produtos", "Fotos da pele", "Cronograma capilar"],
  },
});

/** Pelo registro (sem a página por perto): a aba abre pelo rótulo. */
export default (): ConfigCartoes => cartoesBeleza({ irParaSkincare: () => abrirAba("SKINCARE") });
