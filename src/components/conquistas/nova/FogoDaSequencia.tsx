import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { lerFaixaVista, mudancaDeFaixa } from "@/lib/fogo-sequencia";
import { FogoSequencia } from "@/components/fogo/FogoSequencia";
import { CHAVE_FOGO_CADERNO, fogoDoCaderno } from "./fogo-caderno";

/**
 * O fogo do cartão da sequência (Conquistas do caderno). Uma animação curta ao subir de faixa; primeira visita e
 * queda são silenciosas. 26/10: o desenho vem do FOGO UNIFICADO (components/fogo/FogoSequencia — o mesmo da pílula
 * da Home nova e da folha da sequência), que rende aqui exatamente o que já existia: `cn-fogo`, a faísca ✦ do ouro,
 * `data-subiu` da subida de faixa — mais a chama viva (tremulação sutil) quando acesa.
 */
export const FogoDaSequencia = ({ dias }: { dias: number }) => {
  const { get, set, loaded } = useUserData();
  const reduzir = useReducedMotion();
  const faixa = fogoDoCaderno(dias);
  const vista = lerFaixaVista(get(CHAVE_FOGO_CADERNO, null));
  const [subida, setSubida] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded || vista === faixa.indice) return;
    set(CHAVE_FOGO_CADERNO, faixa.indice, { system: true });
    if (mudancaDeFaixa(faixa.indice, vista) === "subiu" && !reduzir) setSubida(faixa.indice);
    else setSubida(null);
  }, [loaded, vista, faixa.indice, reduzir, set]);

  useEffect(() => {
    if (subida === null) return;
    const timer = setTimeout(() => setSubida(null), 1100);
    return () => clearTimeout(timer);
  }, [subida]);

  return (
    <FogoSequencia
      dias={dias} estado={dias > 0 ? "aceso" : "neutro"} tamanho={42} brilho={dias >= 100} faisca
      subiu={!reduzir && subida === faixa.indice}
      className="cn-fogo" testid="cn-fogo"
    />
  );
};
